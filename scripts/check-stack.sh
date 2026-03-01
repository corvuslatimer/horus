#!/usr/bin/env bash
set -euo pipefail
RELAY_URL="${1:-http://127.0.0.1:8787}"
UI_URL="${2:-http://127.0.0.1:8080}"

echo "[1/5] relay health"
curl -fsS "$RELAY_URL/healthz" | python3 -m json.tool | sed -n '1,20p'

echo "[2/5] btc"
curl -fsS "$RELAY_URL/api/btc" | python3 -m json.tool | sed -n '1,20p'

echo "[3/5] flights"
curl -fsS "$RELAY_URL/api/flights" | python3 -m json.tool | sed -n '1,20p'

echo "[4/5] incidents"
curl -fsS "$RELAY_URL/api/incidents" | python3 -m json.tool | sed -n '1,20p'

echo "[5/5] ui"
curl -fsSI "$UI_URL" | sed -n '1,5p'

echo "OK"
