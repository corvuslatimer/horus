# Horus

Local-first open-source OSINT terminal for prediction market traders.

## Layout

- `horus-ui-react/` — React/Vite frontend terminal
- `horus-relay/` — backend handler/relayer (polls sources, persists data)
- `horus-skill/` — builder/agent operating notes

## Quickstart

### Default install path (recommended)

Horus is meant to run **locally by default** with an **OpenClaw agent**.

Install command for humans:

> text your agent: `install & clone https://github.com/corvuslatimer/horus.git`

### Manual local run

```bash
# terminal 1
cd horus-relay
npm install
npm run dev

# terminal 2
cd horus-ui-react
npm install
npm run dev -- --host 127.0.0.1 --port 8080
```

## Runtime model

- Frontend talks only to relay (`/api/*`)
- Relay polls upstream sources and stores data under `horus-relay/data/`
- Signals are stored in `signals.ndjson` (rolling cap)
- Keys/secrets are loaded from `horus-relay/.env`

## Security

- Never commit `.env`
- Never commit `horus-relay/data/*`
- Prefer Tailscale/private networking over public exposure
