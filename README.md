# Coachbot integration — Claude Skill

A Claude skill that helps developers wire their own website / CRM / landing page into Coachbot's Public API.

## What it does

When Claude detects that the user is trying to integrate with Coachbot (mentions of "Coachbot", `ck_live_` keys, `/api/public/leads`, etc.), this skill takes over and:

- Asks the developer for their Coachbot host + which backend they're on.
- Picks the matching code template from `examples/`.
- Drops in a server route that POSTs to `/api/public/leads`, handles validation, duplicate phones, voice dispatch failures, and rate limits correctly.
- Walks the developer through generating the API key from Coachbot Settings and storing it as an env var.
- References the API docs in `reference/` when the developer asks about a specific field or error code.

## Install

From the GitHub repo:

```bash
npx skills add sifenfisaha/coachbot-integration- --skill coachbot-integration
```

Claude-targeted install:

```bash
npx skills add sifenfisaha/coachbot-integration- --skill coachbot-integration --agent claude --yes
```

Full GitHub URL form:

```bash
npx skills add https://github.com/sifenfisaha/coachbot-integration- --skill coachbot-integration
```

Or install directly in Claude with:

```bash
$skill-installer install https://github.com/sifenfisaha/coachbot-integration-/tree/master/coachbot-integration
```

For local testing:

```bash
mkdir -p ~/.claude/skills
cp -R coachbot-integration ~/.claude/skills/coachbot-integration
```

Restart Claude after installing so the skill is discovered.

## File layout

```
.
├── README.md                      # (this file)
└── coachbot-integration/          # the skill (install target)
    ├── SKILL.md                   # Trigger + main instructions Claude reads
    ├── reference/                 # Self-contained API reference
    │   ├── api-overview.md
    │   ├── authentication.md
    │   ├── submit-lead.md
    │   ├── read-lead.md
    │   └── errors.md
    └── examples/                  # Copy-paste-ready server templates
        ├── nextjs-route-handler.ts
        ├── express.js
        ├── hono.ts
        ├── simple-node-fetch.js
        └── curl.sh
```

## Updating

When Coachbot's API changes, edit `SKILL.md` + the `reference/` files and push to `master`. Users re-run the same `npx skills add …` command to pull the latest version. The skill is plain markdown — no build step.
