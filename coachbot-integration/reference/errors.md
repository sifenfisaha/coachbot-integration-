# Errors

All Public API error responses share a common shape:

```json
{
  "ok": false,
  "error": "<machine-readable code or human message>",
  "message": "<optional longer explanation>",
  "issues": [/* present only on 400 validation_failed */]
}
```

The `error` field is intended for `switch` statements in your code; `message` is a longer string for logs or internal users.

## By status code

### `400 Bad Request`

| `error` | When | What to do |
|---|---|---|
| "Request body must be valid JSON." | Body is missing, not JSON, or has the wrong Content-Type. | Send `Content-Type: application/json` and a real JSON body. |
| "Validation failed." | One or more fields failed type/length checks. `issues` array names them. | Don't retry. Map issues back to your form. |
| "\`consent\` must be true." | `consent` field missing or false. | GDPR requires explicit consent. Your form needs a required checkbox. |

### `401 Unauthorized`

| `error` | When |
|---|---|
| "Missing Authorization header." | No `Authorization` header at all. |
| "Authorization header must use the \`Bearer <api key>\` scheme." | Header present but malformed. |
| "API key is invalid or revoked." | Bearer present but the key isn't recognised or has been revoked. |

### `404 Not Found`

| `error` | When |
|---|---|
| "Lead not found." | Lead ID doesn't exist OR belongs to a different workspace. |
| "Workspace not found." | The workspace owning your API key has been deleted. Extremely unlikely — revoke and recreate. |

### `409 Conflict`

| `error` | When | What to do |
|---|---|---|
| "duplicate_phone" | Same phone already a lead in this workspace. | **Treat as soft success.** The previous lead is still in flight. Don't surface as an error to the form filler. |

### `429 Too Many Requests`

Per-key rate limits. The `Retry-After` header tells you when to retry (in seconds).

### `502 Bad Gateway`

| `error` | When | What to do |
|---|---|---|
| "voice_dispatch_failed" | Voice workspace, Vapi rejected the call. The lead is **rolled back** so retry won't hit `duplicate_phone`. | Retry once with backoff. If it keeps failing, the operator has a Vapi config issue or balance issue. |

### `500 Internal Server Error`

Coachbot bug. Retry once with backoff.

## Recommended client behaviour

```ts
async function submitWithRetry(body: object, host: string, key: string, attempt = 0) {
  const res = await fetch(`${host}/api/public/leads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 201) return { kind: "ok", body: await res.json() };

  const data = await res.json().catch(() => ({}));

  if (res.status === 409 && data.error === "duplicate_phone") {
    // Soft success — lead is already in Coachbot.
    return { kind: "duplicate", body: data };
  }

  if (res.status === 400) {
    // Validation error — fix input, don't retry.
    return { kind: "validation", body: data };
  }

  if (res.status === 401) {
    // Auth error — config bug, don't retry.
    return { kind: "auth", body: data };
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after") ?? "60");
    if (attempt < 1) {
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return submitWithRetry(body, host, key, attempt + 1);
    }
    return { kind: "rate_limited", body: data };
  }

  if ((res.status === 502 || res.status >= 500) && attempt < 2) {
    await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    return submitWithRetry(body, host, key, attempt + 1);
  }

  return { kind: "error", body: data, status: res.status };
}
```
