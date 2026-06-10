/**
 * Hono endpoint that proxies a form submission to Coachbot's Public
 * API. Works on Cloudflare Workers, Bun, Node, and Deno.
 *
 *   import { Hono } from 'hono';
 *   import leads from './coachbot-leads';
 *   const app = new Hono();
 *   app.route('/api/leads', leads);
 *
 * For Cloudflare Workers, set the env vars as worker secrets:
 *   wrangler secret put COACHBOT_HOST
 *   wrangler secret put COACHBOT_API_KEY
 */
import { Hono } from "hono";

type Env = {
  Bindings: {
    COACHBOT_HOST?: string;
    COACHBOT_API_KEY: string;
  };
};

const app = new Hono<Env>();

function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, "");
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

app.post("/", async (c) => {
  const host = c.env.COACHBOT_HOST || "https://coachbot-pi.vercel.app";
  const key = c.env.COACHBOT_API_KEY;
  if (!key) {
    return c.json(
      { error: "Server misconfigured: COACHBOT_API_KEY missing." },
      500,
    );
  }

  const body = await c.req
    .json<{
      fullName?: string;
      phone?: string;
      email?: string;
      companyName?: string;
      initialInquiry?: string;
      consent?: boolean;
    }>()
    .catch(() => null);

  if (!body) {
    return c.json({ error: "Body must be valid JSON." }, 400);
  }
  if (!body.fullName || !body.phone || !body.email) {
    return c.json(
      { error: "fullName, phone, and email are required." },
      400,
    );
  }
  if (body.consent !== true) {
    return c.json({ error: "You must agree to be contacted." }, 400);
  }

  const payload = {
    name: body.fullName.trim(),
    phone: normalizePhone(body.phone),
    email: body.email.trim(),
    goal: body.initialInquiry?.trim() || undefined,
    consent: true,
    metadata: {
      ...(body.companyName ? { companyName: body.companyName } : {}),
      source: "website form",
    },
  };

  const res = await fetch(`${host}/api/public/leads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as {
    leadId?: string;
    error?: string;
    message?: string;
  };

  if (res.status === 201) return c.json({ ok: true, leadId: data.leadId }, 201);
  if (res.status === 409 && data.error === "duplicate_phone") {
    return c.json({ ok: true, duplicate: true });
  }
  if (res.status === 400) {
    return c.json({ error: data.message ?? "Please check your details." }, 400);
  }
  if (res.status === 401) {
    console.error("[coachbot] auth error", data);
    return c.json({ error: "Service temporarily unavailable." }, 500);
  }
  if (res.status === 502) {
    console.error("[coachbot] voice dispatch failed", data);
    return c.json(
      { error: "We couldn't reach you just now. Try again shortly." },
      502,
    );
  }
  console.error("[coachbot] unexpected response", res.status, data);
  return c.json({ error: "Something went wrong." }, 500);
});

export default app;
