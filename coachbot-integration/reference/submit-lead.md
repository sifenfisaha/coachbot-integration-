# POST /api/public/leads

Submit a new lead. Triggers the agent (Vapi call for voice workspaces, WhatsApp message via the Inngest agent-turn function for WhatsApp workspaces).

## Request

```http
POST /api/public/leads
Authorization: Bearer ck_live_<key>
Content-Type: application/json
```

### Body schema

```ts
{
  // Required
  name: string,                                  // 1-120 chars
  phone: string,                                 // E.164-style, 7-32 chars
  consent: true,                                 // Must be literal true

  // Optional
  email?: string,                                // RFC 5322 email
  goal?: string,                                 // Up to 2000 chars
  metadata?: Record<string, unknown>,            // Free-form bag
  formResponses?: Record<string, string>         // Voice Form Builder answers
}
```

### Field guidance

| Field | Notes |
|---|---|
| `name` | The lead's full name. Used in greetings; Coachbot derives `{{leadFirstName}}` from the first word for use in voice prompts. |
| `phone` | E.164-style. Coachbot normalises by stripping all non-digits except `+` and prepending `+` if missing. Reject from your side anything that doesn't include a country code — the agent can't dial without one. |
| `email` | Optional but strongly recommended. The booking tool (`bookConsult`) requires it. Without an email, the agent has to ask for it mid-call. |
| `goal` | Optional. The lead's stated intent. Goes straight into the agent's "what you already know" prompt section. |
| `consent` | Must be the literal boolean `true`. Required by GDPR. Verify on the client AND server before forwarding. |
| `metadata` | Free-form `{ string: any }` bag. Every entry shows up in the agent prompt as `{{leadMetadata}}` (voice) or a "What else we know" section (WhatsApp). Use for `companyName`, `industry`, `source`, `utm_*`, etc. |
| `formResponses` | Only meaningful for voice workspaces that have configured the Form Builder. Maps `{ questionId: answerString }`. Optional — the agent can collect missing answers on the call. |

### `metadata` examples

```json
{
  "companyName": "Acme Corp",
  "industry": "B2B SaaS",
  "source": "homepage form",
  "utm_source": "google",
  "utm_campaign": "spring-launch"
}
```

Values that aren't strings get `JSON.stringify`'d. Nullish or empty-string values are dropped silently.

## Success responses

### Voice workspace — `201 Created`

```json
{
  "ok": true,
  "leadId": "f54466f4-afc3-4e27-84f9-a3be6fcac978",
  "status": "in_progress",
  "vapiCallId": "019ea22e-80ca-7001-95fb-4932d5c048f2",
  "callQueued": true
}
```

The lead's phone should ring within ~10 seconds.

### WhatsApp workspace — `201 Created`

```json
{
  "ok": true,
  "leadId": "f54466f4-afc3-4e27-84f9-a3be6fcac978",
  "status": "new",
  "messageQueued": true
}
```

The Inngest agent-turn function fires within a few seconds and sends the first WhatsApp message.

## Failure responses

### `400 Bad Request` — validation

```json
{
  "ok": false,
  "error": "Validation failed.",
  "issues": [
    { "path": ["phone"], "message": "Phone must be a valid E.164-style number." }
  ]
}
```

Map the `issues` array back to your form fields. Don't retry — fix the input.

### `400 Bad Request` — invalid JSON

```json
{
  "ok": false,
  "error": "Request body must be valid JSON."
}
```

### `400 Bad Request` — consent missing/false

```json
{
  "ok": false,
  "error": "`consent` must be true."
}
```

### `401 Unauthorized`

See `authentication.md`.

### `409 Conflict` — duplicate phone

```json
{
  "ok": false,
  "error": "duplicate_phone",
  "message": "A lead with this phone number already exists in the workspace."
}
```

**Treat as soft success.** The first attempt succeeded — the lead is already in Coachbot, possibly mid-conversation. Don't show an error to the user filling the form.

The same phone can exist in *different* workspaces (the unique constraint is `(workspace_id, phone)`).

### `429 Too Many Requests`

See rate limits in `authentication.md`. Honor the `Retry-After` header.

### `502 Bad Gateway` — voice dispatch failed

```json
{
  "ok": false,
  "error": "voice_dispatch_failed",
  "message": "Vapi /call failed (400): { \"statusCode\":400, \"message\": \"...\" }"
}
```

Voice workspaces only. Vapi rejected the call request. The lead row + call_session **were rolled back** server-side so retrying with the same phone won't trigger `409`.

Common causes:
- Vapi balance exhausted (operator needs to top up).
- Operator's Vapi configuration has a typo (assistant id, phone number id).
- Lead's phone number can't be dialed by Vapi's number (region blocked).

The full Vapi error is in `message`. The operator should check `/admin/<slug>/logs` for the same row.

Retry once with backoff. If it keeps failing, surface a generic "couldn't reach you" message to the user — the operator has to fix the underlying issue.

### `500 Internal Server Error`

Coachbot bug. Retry once with backoff. If it persists, report to the operator.

## Complete example

```bash
curl -X POST https://<host>/api/public/leads \
  -H "Authorization: Bearer $COACHBOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "phone": "+447123456789",
    "email": "jane@acme.com",
    "goal": "Looking to migrate from a competitor",
    "consent": true,
    "metadata": {
      "companyName": "Acme Corp",
      "industry": "B2B SaaS",
      "source": "homepage form"
    }
  }'
```
