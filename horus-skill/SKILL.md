# Horus Skill

Purpose: shared context for agents working on Horus — architecture, layout, security rules, conventions.

---

## What Horus Is

Local-first open-source OSINT terminal for prediction market traders.

1. Live signal feed — real-time tweet/geo events via j7tracker websocket
2. Map — conflict heatmap + military flights (Leaflet, no WebGL required)
3. Polymarket panel — live odds, top markets by volume

---

## Repo Layout

```
horus/
├── horus-ui/public/index.html   ← single-file frontend
├── horus-relay/src/server.js    ← Express backend / proxy / agent bridge
├── horus-relay/data/            ← JSON caches — NOT committed
├── horus-relay/.env             ← secrets — NOT committed
├── horus-relay/.env.example     ← safe template — committed
├── horus-skill/SKILL.md         ← this file
└── .gitignore
```

---

## Running Locally

```bash
cd horus-relay && npm install && npm run dev    # relay on 127.0.0.1:8787
cd horus-ui/public && python3 -m http.server 8080 --bind 127.0.0.1
```

---

## Security Rules (mandatory)

1. Relay binds 127.0.0.1 only. Never change to 0.0.0.0 — relay has no auth layer.
2. UI binds 127.0.0.1 only.
3. Never commit .env. Rotate any credential accidentally committed.
4. horus-relay/data/*.json is gitignored. Contains live data + chat logs.
5. Agent chat bridge is opt-in. Safe by default if env vars not set.
6. No API keys hardcoded in source. All secrets in .env.

---

## Relay Endpoints

GET  /health           relay health + cache status
GET  /api/btc          BTC price (Gemini -> CoinGecko fallback)
GET  /api/flights      military flight positions (OpenSky)
GET  /api/snapshots    combined agent-readable snapshot
GET  /api/chat         chat history
POST /api/chat         send {message} to agent bridge

---

## Frontend Layout

Three-column:
  [SIGNAL FEED (420px)] [MAP (flex)] [POLYMARKET + AGENT CHAT (420px)]

Header: HORUS + status dots + UTC clock
Footer: version + "Built by CORVUS LATIMER"

---

## UI Conventions

- Single HTML file, no build step
- CDN: Leaflet 1.9.4 (map), deck.gl loaded but unused (WebGL fails on RDP)
- J7 feed: browser WebSocket direct (no relay needed)
- BTC/flights: via relay (CORS fix)
- Polymarket: browser direct (gamma-api allows CORS)
- Feed items clickable if URL present
- No literal \n in tweet/feed text
- No library names in user-facing labels

---

## Env Vars

HOST=127.0.0.1
PORT=8787
OPENCLAW_BASE_URL=     # optional: gateway URL for agent bridge
OPENCLAW_SESSION_KEY=  # optional: session key
OPENCLAW_TOKEN=        # optional: gateway auth token

---

## Known Issues

- Agent chat bridge one-way (messages reach OpenClaw but response not captured back)
- Military filter uses callsign prefix heuristics only
- J7 JWT token hardcoded in frontend — will expire, make configurable
- Leaflet used as WebGL fallback (RDP software renderer)

---

## What Not To Do

- No build tools without discussion
- No public port exposure without relay auth
- No emoji/glyph renders inside canvas layers
- No library names in UI
