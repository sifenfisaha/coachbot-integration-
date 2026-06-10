/**
 * Minimal example: a single function that submits one lead. Use this
 * inside any Node 18+ script, Lambda handler, or background job.
 *
 *   COACHBOT_HOST=https://coachbot-pi.vercel.app \
 *   COACHBOT_API_KEY=ck_live_... \
 *   node simple-node-fetch.js
 */

const COACHBOT_HOST =
  process.env.COACHBOT_HOST || "https://coachbot-pi.vercel.app";
const COACHBOT_API_KEY = process.env.COACHBOT_API_KEY;

function normalizePhone(raw) {
  const cleaned = String(raw).replace(/[^\d+]/g, "");
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

/**
 * Submit a lead to Coachbot.
 * Returns:
 *   { kind: "ok",         leadId }       — Coachbot accepted, agent is dispatching
 *   { kind: "duplicate" }                — Same phone already a lead (soft success)
 *   { kind: "validation", error }        — 400 — fix input
 *   { kind: "rate_limited" }             — 429 — back off
 *   { kind: "dispatch_failed", error }   — 502 — Vapi rejected; retry later
 *   { kind: "error", status, body }      — Everything else
 */
async function submitLead(input) {
  if (!COACHBOT_API_KEY) throw new Error("COACHBOT_API_KEY not set");

  const payload = {
    name: input.name,
    phone: normalizePhone(input.phone),
    email: input.email,
    goal: input.goal,
    consent: true,
    metadata: input.metadata,
  };

  const res = await fetch(`${COACHBOT_HOST}/api/public/leads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${COACHBOT_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 201) return { kind: "ok", leadId: data.leadId };
  if (res.status === 409 && data.error === "duplicate_phone") {
    return { kind: "duplicate" };
  }
  if (res.status === 400) {
    return { kind: "validation", error: data.message || data.error };
  }
  if (res.status === 429) return { kind: "rate_limited" };
  if (res.status === 502 && data.error === "voice_dispatch_failed") {
    return { kind: "dispatch_failed", error: data.message };
  }
  return { kind: "error", status: res.status, body: data };
}

// Example usage — remove or adapt when wiring into your own app.
if (require.main === module) {
  submitLead({
    name: "Test User",
    phone: "+447123456789",
    email: "test@example.com",
    goal: "Just exploring",
    metadata: { source: "node script" },
  })
    .then((result) => {
      console.log(result);
    })
    .catch((err) => {
      console.error("error:", err);
      process.exit(1);
    });
}

module.exports = { submitLead };
