/**
 * Next.js App Router route handler that proxies a form submission to
 * Coachbot's Public API. Place at:
 *
 *   app/api/leads/route.ts
 *
 * Set the env vars on Vercel:
 *   COACHBOT_HOST=https://coachbot-pi.vercel.app
 *   COACHBOT_API_KEY=ck_live_...
 *
 * Your frontend form POSTs JSON to /api/leads (same-origin). This
 * route forwards it to Coachbot with the Bearer header that never
 * leaves the server.
 */
import { NextResponse } from "next/server";

const COACHBOT_HOST =
  process.env.COACHBOT_HOST ?? "https://coachbot-pi.vercel.app";
const COACHBOT_API_KEY = process.env.COACHBOT_API_KEY!;

/**
 * Strip everything except digits and a leading `+`. Coachbot will
 * reject anything that doesn't match E.164.
 */
function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, "");
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

export async function POST(request: Request) {
  if (!COACHBOT_API_KEY) {
    return NextResponse.json(
      { error: "Server misconfigured: COACHBOT_API_KEY is missing." },
      { status: 500 },
    );
  }

  let body: {
    fullName?: string;
    phone?: string;
    email?: string;
    companyName?: string;
    initialInquiry?: string;
    consent?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be valid JSON." },
      { status: 400 },
    );
  }

  // Server-side validation (in addition to the client's). Don't trust
  // the browser — anyone can POST whatever they like to this route.
  if (!body.fullName || !body.phone || !body.email) {
    return NextResponse.json(
      { error: "fullName, phone, and email are required." },
      { status: 400 },
    );
  }
  if (body.consent !== true) {
    return NextResponse.json(
      { error: "You must agree to be contacted." },
      { status: 400 },
    );
  }

  // Build the Coachbot payload. Everything that isn't a first-class
  // Coachbot field goes into `metadata` — the agent sees it.
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

  const res = await fetch(`${COACHBOT_HOST}/api/public/leads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${COACHBOT_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 201) {
    return NextResponse.json({ ok: true, leadId: data.leadId });
  }
  if (res.status === 409 && data.error === "duplicate_phone") {
    // Same phone is already a lead. Treat as a soft success — the
    // previous submission is still in flight. Don't show an error
    // to the user.
    return NextResponse.json({ ok: true, duplicate: true });
  }
  if (res.status === 400) {
    return NextResponse.json(
      { error: data.message ?? "Please check your details and try again." },
      { status: 400 },
    );
  }
  if (res.status === 401) {
    // Auth misconfiguration. Don't leak the detail to the user.
    console.error("[coachbot] auth error", data);
    return NextResponse.json(
      { error: "Service temporarily unavailable." },
      { status: 500 },
    );
  }
  if (res.status === 502) {
    // Voice dispatch failed (the Vapi side). Lead was rolled back —
    // the user can retry.
    console.error("[coachbot] voice dispatch failed", data);
    return NextResponse.json(
      {
        error:
          "We couldn't reach you just now. Try again in a few minutes.",
      },
      { status: 502 },
    );
  }

  console.error("[coachbot] unexpected response", res.status, data);
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}
