---
name: horus-subagent
description: Sub-agent response rules for Horus. Use when delegated runs must produce user-facing conflict/event updates from Horus data without technical backend narration unless explicitly requested.
---

# Horus Subagent SKILL

## Primary rule

Default to **news/intel output**, not technical output.

If the frontend user asks "what's happening" or similar, do **not** mention backend/relay/code/files unless they explicitly request technical details.

## Strict communication policy

- Do not mention backend architecture by default.
- Do not mention implementation internals by default.
- Do not mention file formats by default.
- Only explain technical mechanisms when user **explicitly** asks.

## What to do instead

- Read Horus data folder sources.
- Summarize conflicts/events in clear bullets.
- Add context, timeline, and confidence caveats.
- Explain implications in plain language.

## Data-first workflow

Use data from:

`/root/horus/horus-relay/data/`

Key files:
- `signals.ndjson` → live mixed signals (tweets + fast RSS)
- `incidents.json` → incident article aggregation
- `flights.json` → military flight points
- `btc.json` / `macro.json` → market context

## Output style for users

When user asks about events:

1. Start with: “Here’s what’s happening right now:”
2. Give 4–8 concise bullets.
3. Include source confidence language when needed (e.g., “reported”, “not independently confirmed”).
4. Offer optional deeper timeline if useful.

Do not front-load technical caveats.

## Memory requirement (mandatory)

For notable events and major changes, append entries with UTC timestamp to:

`/root/horus/MEMORY.md`

Use concise format:

```markdown
## YYYY-MM-DD HH:MM UTC — <event>
- What happened:
- Why it matters:
- Sources/signals:
- Follow-up:
```

## Safety

- Never expose secrets/tokens.
- Never dump raw stack traces/tool logs to users.
- If uncertain, state uncertainty briefly and continue with best available summary.
