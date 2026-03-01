# Horus MEMORY.md

Purpose: durable project memory for Horus (architecture changes, data-source changes, outages, major market/conflict event handling decisions).

## Rules

- Log notable events with **UTC date/time**.
- Keep entries concise and factual.
- Record what changed, why, and impact.
- Prefer bullet format for quick scanning.
- Do not store secrets/tokens/passwords.

## Entry Template

```markdown
## YYYY-MM-DD HH:MM UTC — <title>
- What happened:
- Change made:
- Why:
- Impact:
- Follow-up:
```

## 2026-03-01 09:00 UTC — Backend-first relay architecture stabilized
- What happened: Horus moved from mixed frontend/upstream calls to backend-first relay model.
- Change made: Relay now handles ingestion/polling and persists data files; frontend reads relay endpoints only.
- Why: Remove CORS fragility, improve consistency, preserve history.
- Impact: More stable feed behavior and easier diagnostics.
- Follow-up: Continue replacing temporary J7 dependency with owned signal pipeline.

## 2026-03-01 09:10 UTC — Signals persistence moved to NDJSON
- What happened: Live signal storage migrated to rolling line-based file.
- Change made: `signals.ndjson` used as primary feed persistence; relay serves `/api/signals` from it.
- Why: Append-friendly writes, simpler trimming, better durability under high-frequency updates.
- Impact: Unified feed history retained for frontend consumption.
- Follow-up: Keep max-lines policy tuned (`MAX_SIGNALS`).

## 2026-03-01 09:20 UTC — Multi-RSS incidents expanded
- What happened: Added broader free RSS set (Reuters/BBC/Al Jazeera/regional/FinancialJuice/etc.).
- Change made: Incidents aggregator now merges and de-dupes multi-source RSS.
- Why: Reduce single-source risk and improve signal coverage.
- Impact: Incidents panel receives more consistent updates.
- Follow-up: Add source scoring/priority and periodic health metrics.

## 2026-03-01 09:25 UTC — Macro data wiring + Finnhub key model
- What happened: Macro tiles wired through Finnhub in relay.
- Change made: Added `/api/macro` with SPY/QQQ and UUP proxy for DXY.
- Why: Replace placeholders and keep backend-owned data flow.
- Impact: Macro panel now data-driven from relay.
- Follow-up: Validate symbol reliability and fallback behavior.

## 2026-03-01 09:45 UTC — News response style guardrail
- What happened: Agent over-shared backend internals in user-facing updates.
- Change made: Skill updated to default to clean news bullets/explanations, technical internals only on explicit request.
- Why: Users usually want situational updates, not implementation details.
- Impact: Better UX and clearer communication.
- Follow-up: Maintain this as a hard style rule for Horus agent replies.
