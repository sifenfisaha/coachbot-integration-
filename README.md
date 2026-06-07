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

The skill lives at the root of this repo, so installing it is one command: clone the repo into Claude's skills directory under the folder name `coachbot-integration` (the skill name declared in `SKILL.md`).

### Option A — clone from GitHub (recommended)

User-level install (available in every Claude Code session):

```bash
git clone https://github.com/sifenfisaha/coachbot-integration-.git \
  ~/.claude/skills/coachbot-integration
```

To update later:

```bash
git -C ~/.claude/skills/coachbot-integration pull
```

### Option B — download a tarball (no git required)

```bash
mkdir -p ~/.claude/skills/coachbot-integration
curl -L https://github.com/sifenfisaha/coachbot-integration-/archive/refs/heads/master.tar.gz \
  | tar -xz --strip-components=1 -C ~/.claude/skills/coachbot-integration
```

### Option C — install into a single project

If a developer only wants the skill while working in one specific project:

```bash
cd <their project>
git clone https://github.com/sifenfisaha/coachbot-integration-.git \
  .claude/skills/coachbot-integration
```

Claude will pick it up automatically when run inside that project.

### Verify the install

```bash
ls ~/.claude/skills/coachbot-integration/SKILL.md
```

If that prints the path, Claude will load the skill on its next run. The skill's frontmatter `name` is `coachbot-integration` — keep the install folder named exactly that.

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

When Coachbot's API changes, edit `SKILL.md` + the `reference/` files, push to `master`, and tell users to re-run the `git pull` (Option A) or re-download the tarball (Option B). The skill is plain markdown — no build step.
