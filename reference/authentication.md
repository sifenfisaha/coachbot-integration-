# Authentication

Every Public API endpoint expects:

```
Authorization: Bearer ck_live_<32 hex characters>
```

## Key format

```
ck_live_a1b2c3d4...
```

- 128 bits of entropy in the random part — effectively unguessable.
- The 8 hex characters right after `ck_live_` are stored as a "prefix" for indexed lookup.
- The full key is SHA-256 hashed for storage. Coachbot compares hashes in constant time.

## Generating a key

The Coachbot operator does this once, from their dashboard:

1. **Settings → API keys → New API key**.
2. Type a human-readable name (e.g. `production-site`, `staging`, `partner-acme`).
3. Click **Generate key**. The plaintext key is displayed **exactly once** in a one-time-reveal panel.
4. Copy it immediately into a secrets manager.

Coachbot will never show the plaintext again. If the operator loses it, they revoke and generate a new one.

## How to store the key

- In a secrets manager: 1Password, Vercel/Netlify env vars, AWS Secrets Manager, Doppler, etc.
- In a `.env` file that's git-ignored.
- **Never** in source code, version control, or anywhere a JS bundle could read it.

Typical env var name: `COACHBOT_API_KEY`.

## How to send the key

Always in the `Authorization: Bearer …` header. Never as a query string. Never in the body.

```bash
curl -X POST https://<host>/api/public/leads \
  -H "Authorization: Bearer $COACHBOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '...'
```

## Key lifecycle

| Stage | What happens |
|---|---|
| **Create** | Operator generates key in Settings. One-time plaintext reveal. Coachbot stores the hash + prefix. |
| **Use** | Every successful request stamps `last_used_at`. Visible on the Settings → API keys table. |
| **Monitor** | If a key shows recent traffic but you didn't make the request, treat it as compromised. Revoke + rotate. |
| **Revoke** | Flips `revoked_at`. Subsequent requests get `401 "API key is invalid or revoked."` |

## Rotation pattern

For zero-downtime key rotation:

1. Generate a new key, store the plaintext in your secrets manager.
2. Deploy the new key to production (env var change + redeploy or runtime config refresh).
3. Verify traffic on the new key (Settings → API keys → `last_used_at` updates).
4. Revoke the old key.

## Rate limits

Per-key:

| Window | Limit |
|---|---|
| 60 seconds | 5 requests |
| 60 minutes | 100 requests |

Both limits are tracked on the `api_key_id`, not the workspace, so multiple keys per workspace each have their own budget.

`429 Too Many Requests` responses include a `Retry-After` header in seconds.

## Authentication errors

| Status | `error` value | What it means |
|---|---|---|
| 401 | "Missing Authorization header." | No `Authorization` header at all. |
| 401 | "Authorization header must use the \`Bearer <api key>\` scheme." | Header present but malformed. |
| 401 | "API key is invalid or revoked." | Bearer present but the key isn't recognised. |
| 429 | "Rate limit exceeded. Wait a minute before retrying." | Per-minute burst limit. |
| 429 | "Hourly rate limit exceeded." | Per-hour limit. |
