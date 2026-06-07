/**
 * Express endpoint that proxies a form submission to Coachbot's
 * Public API. Drop into an existing Express app:
 *
 *   const leads = require('./coachbot-leads');
 *   app.post('/api/leads', express.json(), leads.submit);
 *
 * Set env vars:
 *   COACHBOT_HOST=https://coachbot-pi.vercel.app
 *   COACHBOT_API_KEY=ck_live_...
 */
const COACHBOT_HOST =
  process.env.COACHBOT_HOST || "https://coachbot-pi.vercel.app";
const COACHBOT_API_KEY = process.env.COACHBOT_API_KEY;

function normalizePhone(raw) {
  const cleaned = String(raw).replace(/[^\d+]/g, "");
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

exports.submit = async function submit(req, res) {
  if (!COACHBOT_API_KEY) {
    return res
      .status(500)
      .json({ error: "Server misconfigured: COACHBOT_API_KEY missing." });
  }

  const { fullName, phone, email, companyName, initialInquiry, consent } =
    req.body || {};

  if (!fullName || !phone || !email) {
    return res
      .status(400)
      .json({ error: "fullName, phone, and email are required." });
  }
  if (consent !== true) {
    return res
      .status(400)
      .json({ error: "You must agree to be contacted." });
  }

  const payload = {
    name: String(fullName).trim(),
    phone: normalizePhone(phone),
    email: String(email).trim(),
    goal: initialInquiry ? String(initialInquiry).trim() : undefined,
    consent: true,
    metadata: {
      ...(companyName ? { companyName: String(companyName) } : {}),
      source: "website form",
    },
  };

  let response;
  try {
    response = await fetch(`${COACHBOT_HOST}/api/public/leads`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${COACHBOT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[coachbot] network error", err);
    return res.status(502).json({ error: "Service unreachable." });
  }

  const data = await response.json().catch(() => ({}));

  if (response.status === 201) {
    return res.status(201).json({ ok: true, leadId: data.leadId });
  }
  if (response.status === 409 && data.error === "duplicate_phone") {
    return res.status(200).json({ ok: true, duplicate: true });
  }
  if (response.status === 400) {
    return res
      .status(400)
      .json({ error: data.message || "Please check your details." });
  }
  if (response.status === 401) {
    console.error("[coachbot] auth error", data);
    return res.status(500).json({ error: "Service temporarily unavailable." });
  }
  if (response.status === 502) {
    console.error("[coachbot] voice dispatch failed", data);
    return res
      .status(502)
      .json({ error: "We couldn't reach you just now. Try again shortly." });
  }
  console.error(
    "[coachbot] unexpected response",
    response.status,
    data,
  );
  return res.status(500).json({ error: "Something went wrong." });
};
