# GET /api/public/leads/:id

Read the current state of a single lead. Always scoped to the workspace owning the API key.

## Request

```http
GET /api/public/leads/:id
Authorization: Bearer ck_live_<key>
```

`:id` is the UUID returned in the `leadId` field of a previous `POST /api/public/leads` response.

## Success response — `200 OK`

```json
{
  "ok": true,
  "lead": {
    "id": "f54466f4-afc3-4e27-84f9-a3be6fcac978",
    "channel": "voice",
    "name": "Jane Doe",
    "phone": "+447123456789",
    "email": "jane@acme.com",
    "goal": "Looking to migrate from a competitor",
    "status": "booked",
    "qualificationNotes": null,
    "bookingUid": "xshQhAccwdqJKxTDKFAUNi",
    "bookingStart": "2026-06-08T13:00:00.000Z",
    "metadata": {
      "companyName": "Acme Corp",
      "industry": "B2B SaaS"
    },
    "createdAt": "2026-06-07T13:03:37.162Z",
    "updatedAt": "2026-06-07T13:09:11.444Z"
  },
  "voiceCall": {
    "status": "ended",
    "startedAt": "2026-06-07T13:03:42.000Z",
    "endedAt": "2026-06-07T13:09:05.000Z",
    "durationSeconds": 323,
    "summary": "Jane confirmed she's evaluating us to replace Competitor X. Budget ~£500/mo. Booked Monday 2pm.",
    "transcript": "Assistant: Hi Jane, this is Riley...\n\nLead: Yeah, hi...\n\n...",
    "recordingUrl": "https://storage.vapi.ai/.../019ea22e-80ca-7001-95fb-4932d5c048f2.wav",
    "endedReason": "customer-ended-call"
  }
}
```

`voiceCall` is `null` for WhatsApp workspaces. For voice workspaces, it carries the latest `call_session` row.

## Lead status values

| `status` | Means |
|---|---|
| `new` | Just arrived. Agent hasn't reached out yet. |
| `in_conversation` | Agent has reached out and is qualifying. |
| `booked` | Qualified + booked onto Cal.com. `bookingUid` + `bookingStart` populated. |
| `unqualified` | Agent decided the lead isn't a fit. Reason in `qualificationNotes`. |
| `needs_human` | Either the agent escalated, or an operator clicked "Take over" in the dashboard. |

## Polling strategy

If your CRM needs to react to status changes:

- Poll every **10–30 seconds** while `lead.status` is `new` or `in_conversation`.
- **Stop polling** once status reaches a terminal state: `booked`, `unqualified`, `needs_human`. These don't change without operator action.
- For voice workspaces specifically, also stop polling when `voiceCall.status === "ended"` — the call won't restart.
- Don't poll faster than every 5 seconds. The hourly rate limit (100 requests) burns through quickly.

## Failure responses

### `401 Unauthorized`

See `authentication.md`.

### `404 Not Found`

```json
{ "ok": false, "error": "Lead not found." }
```

Either:
- The lead ID doesn't exist.
- The lead belongs to a different workspace from your API key.

We deliberately don't distinguish — leaking which leads exist across workspaces would be a security regression.

### `429 Too Many Requests`

Polling too aggressively. Back off and honor `Retry-After`.

## Idempotency

`GET` is fully idempotent. Polling the same ID 10 times in a row returns the same response (modulo any state changes in between).

## Example — polling until booked

```ts
async function waitForBooking(leadId: string, host: string, key: string) {
  const TERMINAL = new Set(["booked", "unqualified", "needs_human"]);
  while (true) {
    const res = await fetch(`${host}/api/public/leads/${leadId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") ?? "30");
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      throw new Error(`Coachbot read failed: ${res.status}`);
    }
    const { lead, voiceCall } = await res.json();
    if (TERMINAL.has(lead.status)) return { lead, voiceCall };
    if (voiceCall?.status === "ended") return { lead, voiceCall };
    await new Promise((r) => setTimeout(r, 15_000)); // 15s between polls
  }
}
```
