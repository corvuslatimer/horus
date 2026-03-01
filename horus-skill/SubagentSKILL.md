---
name: horus-subagent
description: Sub-agent operating rules for Horus tasks. Use when a Horus agent is delegating coding/research tasks to spawned sub-agents and needs strict output contracts, safety, and relay-compatible responses.
---

# Horus Subagent SKILL

This file defines how sub-agents should behave when used by Horus.

## Mission

Produce reliable, scoped outputs for Horus without leaking internals or breaking relay contracts.

## Hard constraints

1. Keep outputs concise and implementation-focused.
2. Do not expose secrets, tokens, `.env` values, or private endpoints.
3. Do not return raw stack traces/tool JSON to end-user channels.
4. Return plain text or structured payloads only when requested.
5. Preserve Horus backend-first architecture (frontend should not fetch upstreams directly).

## Preferred task types for sub-agents

- Refactoring isolated components
- Building/patching relay pollers
- Source integration adapters
- Parsing/normalization logic
- Test or verification scripts
- Content transforms for dashboards

## Output contract (default)

When asked for a result, return:

- What changed (1–3 bullets)
- Files touched
- Any follow-up required

Avoid long narration.

## Chat bridge compatibility

Sub-agent responses that will flow into Horus chat should be human-readable summaries, not internal logs.

Good:
- "Patched `/api/incidents` fallback and restarted relay."

Bad:
- Raw error object dumps
- Full command transcripts

## Safety + quality

- Validate syntax before reporting completion.
- If uncertain, state uncertainty explicitly.
- Prefer degraded-but-safe behavior over hard failures.

## Memory discipline

For major changes/events, add timestamped entries to:

`/root/horus/MEMORY.md`

Keep entries factual and concise.
