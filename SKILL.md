---
name: coachbot-integration
description: Integrate the Coachbot Public API into a backend so an external website's form can submit leads into a Coachbot workspace. Trigger when the user wants to send a form submission from their own site to Coachbot, build a server proxy that POSTs leads with a workspace API key, poll lead status, handle duplicate/voice-dispatch errors, or wire a third-party intake (website, landing page, CRM, ad backend) into Coachbot. Look for terms like "Coachbot", "ck_live_", "/api/public/leads", or the host of a Coachbot deployment.
---

# Coachbot integration skill

Coachbot is a multi-tenant SaaS that automates lead qualification on WhatsApp or outbound voice calls (via Vapi). Each workspace can issue **API keys** that let an external backend submit leads into Coachbot from the operator's own form — same dispatch pipeline as Coachbot's built-in `/forms/<slug>` UI, just authenticated.

The user wants to wire their external form into Coachbot. Your job is to write the **server-side proxy** that takes the form submission and POSTs it to Coachbot. Use the reference files in `reference/` for the full API contract and the templates in `examples/` for ready-to-paste code.

## What you need before writing code

Ask the user for:

1. **Their Coachbot host** — e.g. `https://coachbot-pi.vercel.app`. This is the base URL the operator's Coachbot is deployed at. Default to this if they say "the standard one" or similar.
2. **The API key** — looks like `ck_live_<32 hex chars>`. Generated in Coachbot's Settings → API Keys (one-time reveal). **Never** ask the user to paste it into chat — instead tell them to put it in an env var like `COACHBOT_API_KEY` and reference it from there.
3. **Which backend they're on** — Next.js, Express, Hono, a serverless function, etc. Pick the matching template from `examples/`.
4. **What form fields they're sending** — at minimum: name, phone, email, consent. Anything else (Company Name, source, UTM) goes into the `metadata` bag.

## Hard rules

1. **Never put the API key in client-side JavaScript.** The browser can scrape it. Always proxy through a server route.
2. **Phone must be E.164.** Coachbot rejects anything that doesn't match `^\+?[0-9 ()-]+$`. Normalise on the server: strip everything except digits and `+`, prepend `+` if missing.
3. **`consent` must be literally `true`.** GDPR. The form needs a required checkbox; the server must verify it before forwarding.
4. **Treat 409 as a soft success.** Same phone submitted twice = the previous lead is still in flight. Don't surface this as an error to the user filling the form.
5. **On voice workspaces, 502 means Vapi rejected the call** and the lead was rolled back server-side. Show the user a generic "couldn't reach you" message; the integration's owner sees the exact Vapi error in their Coachbot Logs page.

## The flow you're implementing

```
User's site form
        │
        ▼
Their backend route   ← validate + normalize, never expose the API key
        │
        ▼
POST <host>/api/public/leads   ← Authorization: Bearer <api key>
        │
        ▼
Coachbot returns 201 with leadId  ────► return success to the user
   or 4xx/5xx with error string    ────► retry / show error / log
```

## Decision tree

- **Operator has a JSON-posting form** (most common) → use `examples/nextjs-route-handler.ts` if they're on Next.js, otherwise `examples/express.js`.
- **Operator has a serverless edge worker** → use `examples/hono.ts`.
- **Operator just wants to test from the command line first** → use `examples/curl.sh`.
- **Operator wants to know the lead's status later** → after submitting, store the returned `leadId`. Use `GET /api/public/leads/<id>` to poll. See `reference/read-lead.md`.

## Where the deep reference lives

Read these in `reference/` when the user asks something specific:

| File | Covers |
|---|---|
| `api-overview.md` | The 60-second mental model + when to use the API. |
| `authentication.md` | API key format, generation, rotation, rate limits. |
| `submit-lead.md` | `POST /api/public/leads` — every field, every success/failure response. |
| `read-lead.md` | `GET /api/public/leads/:id` — polling pattern for status + transcript + recording. |
| `errors.md` | Every error code, when it fires, how the client should react. |

## When this skill should NOT trigger

- The user is **building Coachbot itself** (working in the Coachbot repo, editing the agent prompt, adding a feature). This skill is for *consumers* of the API.
- The user is asking general questions about WhatsApp or Vapi that don't involve Coachbot's API.
- The user just wants to use Coachbot's hosted form at `/forms/<slug>` — they don't need the API at all.

In those cases, decline politely and let the user redirect.
