---
name: horus
description: Build, maintain, and extend Horus (local-first OSINT terminal). Use when working on Horus relay ingestion, RSS/source pipelines, macro data (Finnhub), map/feed UI behavior, agent-chat bridge, security hardening, or run/deploy reliability.
---

# Horus Skill

Shared operating guide for agents working on **Horus**.

## Current Architecture (authoritative)

Horus is now **backend-first**:

- Relay ingests/polls upstreams on schedule
- Relay persists data into local files (`horus-relay/data/`)
- Frontend reads only relay endpoints (no direct upstream fetches)

### Repos/paths

```text
horus/
├── horus-relay/
│   ├── src/server.js
│   ├── data/                # runtime data files (ignored)
│   ├── .env                # secrets/local config (ignored)
│   └── .env.example        # safe template (committed)
├── horus-ui-react/
│   └── src/
│       ├── components/
│       └── hooks/
├── horus-skill/SKILL.md
└── scripts/check-stack.sh
```

## Run

```bash
cd /root/horus/horus-relay && npm install && npm run dev
cd /root/horus/horus-ui-react && npm install && npm run dev -- --host 100.83.149.17 --port 8080
```

(Host can be changed; Tailscale IP above is example from this machine.)

## Security rules (hard)

1. Keep secrets in `.env` only.
2. Never commit `.env`, runtime data files, or tokens.
3. Keep relay private/local unless intentionally exposed (prefer Tailscale).
4. Return sanitized bridge errors to UI (no stack traces in chat bubbles).
5. Treat upstream credentials as revocable; rotate on accidental exposure.

## Data model & storage

### Signals

- File: `horus-relay/data/signals.ndjson`
- One JSON object per line
- Rolling cap via `MAX_SIGNALS` (currently 100)
- Contains mixed sources (tweets + selected fast RSS items)

Why NDJSON: append-friendly, resilient under frequent writes, easy rolling trim.

### Other files

- `btc.json`
- `macro.json`
- `flights.json`
- `incidents.json`
- `chat.json`

## Relay endpoints (frontend should use only these)

- `GET /healthz`
- `GET /api/signals`
- `GET /api/btc`
- `GET /api/macro`
- `GET /api/flights`
- `GET /api/incidents`
- `GET /api/chat`
- `POST /api/chat`
- `GET /api/snapshots`

## Upstreams

### Free RSS (no key)

Multi-source incidents aggregator includes Reuters/BBC/Al Jazeera/regional + FinancialJuice and others.

### Finnhub (requires user key)

- Used for macro tiles (SPY/QQQ/UUP proxy)
- Registration is fast: `https://finnhub.io/register`
- Create an account (email + password) and get an API key from dashboard
- Use a real account you control and keep keys private
- Put key in relay `.env`

```env
FINNHUB_KEY=...
```

### J7

- Relay supports J7 login using username/password in `.env`
- Auto-token flow + socket auth to ingest tweet stream into `signals.ndjson`

```env
J7_USERNAME=...
J7_PASSWORD=...
```


### How users get J7 credentials (important)

J7 credentials are not standard self-signup email/password.

Users must:
1. Join J7 Discord: `https://discord.gg/CEcatgcq`
2. Go to the **get-login** channel
3. Click the credential/login button
4. Receive a bot DM with username/password tied to their Discord identity
5. Place those values in relay `.env`:

```env
J7_USERNAME=...
J7_PASSWORD=...
```

Do not hardcode shared credentials in source. Each user should use their own Discord-issued J7 login.

## Frontend behavior conventions

- Live signal feed: newest at top
- Relative time labels update every second (`just now`, `3s ago`, `2m ago`)
- Fast feeds (e.g., JPost/FinancialJuice) can trigger red flash + alert sound
- Macro cards use integer display (no cents)
- TradingView popup supports all tracked macro tiles

## Agent chat bridge

Relay chat posts to OpenClaw via gateway call (`agent`, `--expect-final`) using:

```env
OPENCLAW_SESSION_KEY=agent:main:web:horus-chat
```

UI must receive clean assistant text or a sanitized fallback string.

## Environment variables (current)

```env
HOST=0.0.0.0
PORT=8787
MAX_SIGNALS=100

BTC_POLL_MS=5000
FLIGHTS_POLL_MS=90000
INCIDENTS_POLL_MS=60000

FINNHUB_KEY=
J7_USERNAME=
J7_PASSWORD=

OPENCLAW_SESSION_KEY=agent:main:web:horus-chat
```

## When extending Horus

1. Prefer adding pollers/normalizers in relay, not frontend fetch hacks.
2. Keep frontend source-agnostic (consume normalized relay payloads).
3. Add source health markers in relay state for debugging.
4. Keep failures degraded, not fatal (fallback + cached last-known-good).
5. Update `.env.example` whenever adding required config.

## Don’ts

- Don’t hardcode API keys or tokens in frontend.
- Don’t add direct third-party fetches in React components.
- Don’t expose raw backend/tool errors to users.
- Don’t bypass relay persistence model.

