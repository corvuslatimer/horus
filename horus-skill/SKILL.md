# Horus Skill (Draft)

Purpose: let agents consume Horus normalized signals and prices from local relay.

## Endpoints

- `GET http://localhost:8787/health`
- `GET http://localhost:8787/api/btc`
- `GET http://localhost:8787/api/flights`

## Next

- add `/api/signals` feed stream
- add local websocket broadcast bus
- add action endpoints for market mapping + trade suggestions
