# Horus

Local-first open-source OSINT terminal for prediction market traders.

## Monorepo layout

- `horus-ui/` — frontend terminal (MapLibre + deck.gl)
- `horus-relay/` — local relay/proxy + normalized feeds API
- `horus-skill/` — agent skill spec + integration notes

## Quickstart

```bash
# terminal 1
cd horus-relay
npm install
npm run dev

# terminal 2
cd horus-ui
python3 -m http.server 8080
# open http://localhost:8080
```

UI expects relay on `http://localhost:8787`.

## Why local-first

- avoids browser CORS pain
- easier agent connectivity
- better privacy and control
- open ecosystem for feed connectors
