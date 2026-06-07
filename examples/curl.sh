#!/usr/bin/env bash
#
# Coachbot Public API — curl reference. Use these to verify your key
# works and to debug the integration without writing any code first.
#
# Set the env vars (or substitute inline):
#   export COACHBOT_HOST=https://coachbot-pi.vercel.app
#   export COACHBOT_API_KEY=ck_live_...

# ──────────────────────────────────────────────────────────────────
# 1. Submit a lead — minimal
# ──────────────────────────────────────────────────────────────────
curl -i -X POST "${COACHBOT_HOST}/api/public/leads" \
  -H "Authorization: Bearer ${COACHBOT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "phone": "+447123456789",
    "email": "test@example.com",
    "consent": true
  }'

# Expected: 201 with { ok: true, leadId, status, callQueued|messageQueued }

# ──────────────────────────────────────────────────────────────────
# 2. Submit a lead — with metadata + goal
# ──────────────────────────────────────────────────────────────────
curl -i -X POST "${COACHBOT_HOST}/api/public/leads" \
  -H "Authorization: Bearer ${COACHBOT_API_KEY}" \
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
      "source": "homepage form",
      "utm_source": "google",
      "utm_campaign": "spring-launch"
    }
  }'

# ──────────────────────────────────────────────────────────────────
# 3. Read a lead's current state
# ──────────────────────────────────────────────────────────────────
LEAD_ID=f54466f4-afc3-4e27-84f9-a3be6fcac978
curl -i "${COACHBOT_HOST}/api/public/leads/${LEAD_ID}" \
  -H "Authorization: Bearer ${COACHBOT_API_KEY}"

# Expected: 200 with { ok: true, lead: {...}, voiceCall: {...} | null }

# ──────────────────────────────────────────────────────────────────
# 4. Auth failure (no Bearer)
# ──────────────────────────────────────────────────────────────────
curl -i "${COACHBOT_HOST}/api/public/leads/${LEAD_ID}"

# Expected: 401 with { ok: false, error: "Missing Authorization header." }

# ──────────────────────────────────────────────────────────────────
# 5. Validation failure (bad phone)
# ──────────────────────────────────────────────────────────────────
curl -i -X POST "${COACHBOT_HOST}/api/public/leads" \
  -H "Authorization: Bearer ${COACHBOT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test",
    "phone": "not a number",
    "email": "test@example.com",
    "consent": true
  }'

# Expected: 400 with { ok: false, error: "Validation failed.", issues: [...] }

# ──────────────────────────────────────────────────────────────────
# 6. Duplicate phone (soft success)
# ──────────────────────────────────────────────────────────────────
# Submit the same phone twice. The second call returns 409 — your
# client should treat this as a success because the first submit
# already created the lead.
