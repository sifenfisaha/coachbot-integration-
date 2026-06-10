# Coachbot Public API — overview

## When the API is the right answer

- You have a custom-designed lead form on your own website and don't want to migrate to Coachbot's `/forms/<slug>` UI.
- You're capturing leads from somewhere that isn't a form — chat widget, Calendly submission, ad landing page, webhook from another product.
- You want to enrich the lead with extra fields (Company Name, UTM source, sales-rep round-robin info) that Coachbot's first-class columns don't model.

If you just want a hosted form, use `/forms/<slug>` instead — it's free, branded, validated, and runs the same dispatch pipeline behind it.

## The two endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/public/leads` | Submit a new lead. Triggers the agent (voice call or WhatsApp message). |
| `GET` | `/api/public/leads/:id` | Read a single lead — status, transcript, recording. Use for polling. |

Both endpoints expect `Authorization: Bearer ck_live_<key>` and return JSON.

## Base URL

Whatever host the operator's Coachbot is deployed at. Examples:

- `https://coachbot-pi.vercel.app`
- `https://leads.<their-domain>.com`

If unsure, the operator can find their canonical host in Vercel project settings or by visiting their Coachbot dashboard.

## Security model

- **Workspace-scoped Bearer keys.** Each key belongs to exactly one workspace; a leaked key from Workspace A can never read Workspace B's leads.
- **One-time reveal.** When the operator generates a key, Coachbot shows the plaintext once. After that it's SHA-256 hashed and gone. Lose it and you regenerate.
- **Soft revoke.** Revoking a key flips a `revoked_at` timestamp; subsequent requests get `401`. The key row stays for audit.
- **Server-side only.** Never embed the key in client JS. Always proxy through a backend route.

## Rate limits

Per-key:

| Window | Limit |
|---|---|
| 60 seconds | 5 requests |
| 60 minutes | 100 requests |

`429 rate_limited` responses include a `Retry-After` header (in seconds).

## When the API is NOT what you want

- The operator is comfortable with the built-in `/forms/<slug>` and just needs branding/customization — point them at Coachbot's Design page instead.
- The operator wants to *receive* lead status changes pushed to them (webhooks) — that's on the roadmap but not implemented yet. Use polling against `GET /leads/:id` for now.
- The operator wants to manage multiple workspaces from one key — keys are workspace-scoped by design. They'd need one key per workspace.
