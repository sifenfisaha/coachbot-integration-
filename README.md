# Coachbot integration — Claude Skill

A Claude skill that helps developers wire their own website / CRM / landing page into Coachbot's Public API.

## What it does

When Claude detects that the user is trying to integrate with Coachbot (mentions of "Coachbot", `ck_live_` keys, `/api/public/leads`, etc.), this skill takes over and:

- Asks the developer for their Coachbot host + which backend they're on.
- Picks the matching code template from `examples/`.
- Drops in a server route that POSTs to `/api/public/leads`, handles validation, duplicate phones, voice dispatch failures, and rate limits correctly.
- Walks the developer through generating the API key from Coachbot Settings and storing it as an env var.
- References the API docs in `reference/` when the developer asks about a specific field or error code.

## Installation

### Option A — share via GitHub

1. Push this skill (the `coachbot-integration/` directory) to a public GitHub repo, e.g. `your-org/claude-skills`.
2. Send your friend (or anyone integrating) the command:
   ```bash
   mkdir -p ~/.claude/skills/coachbot-integration
   curl -L https://github.com/your-org/claude-skills/archive/main.tar.gz \
     | tar -xz --strip-components=2 -C ~/.claude/skills/coachbot-integration \
       claude-skills-main/coachbot-integration
   ```

### Option B — share as a zip

```bash
cd skills
zip -r coachbot-integration.zip coachbot-integration/
```

Send the zip. Recipient unzips it to `~/.claude/skills/coachbot-integration/`.

### Option C — drop into a single project

If a developer only wants the skill while working in one specific project:

```bash
cd <their project>
mkdir -p .claude/skills
cp -r /path/to/coachbot-integration .claude/skills/
```

Claude will pick it up automatically when run inside that project.

## File layout

```
coachbot-integration/
├── SKILL.md                       # Trigger + main instructions Claude reads
├── README.md                      # (this file)
├── reference/                     # Self-contained API reference
│   ├── api-overview.md
│   ├── authentication.md
│   ├── submit-lead.md
│   ├── read-lead.md
│   └── errors.md
└── examples/                      # Copy-paste-ready server templates
    ├── nextjs-route-handler.ts
    ├── express.js
    ├── hono.ts
    ├── simple-node-fetch.js
    └── curl.sh
```

## Updating

When Coachbot's API changes, edit `SKILL.md` + the `reference/` files and re-distribute. The skill is plain markdown — no build step.
