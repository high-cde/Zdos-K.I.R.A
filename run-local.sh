#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
SITE="$ROOT/site"

if [[ ! -f "$BACKEND/.env" || ! -d "$BACKEND/node_modules/express" ]]; then
  echo "Prima esegui: $ROOT/setup-local.sh" >&2
  exit 1
fi
if [[ ! -f "$SITE/config.js" ]]; then
  echo "config.js locale mancante; rilancia setup-local.sh." >&2
  exit 1
fi

cd "$BACKEND"
node src/index.js &
API_PID=$!
python3 -m http.server 8080 --bind 127.0.0.1 --directory "$SITE" &
WEB_PID=$!
cleanup() {
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
  wait "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
sleep 1
if ! kill -0 "$API_PID" 2>/dev/null; then
  echo "Il backend non è partito. Controlla la configurazione locale; non condividere il file .env." >&2
  exit 1
fi
echo "Console locale attiva: http://localhost:8080"
echo "API locale:           http://127.0.0.1:3000"
echo "Non esporre le porte 8080 o 3000 su Internet. Premi Ctrl+C per chiudere."
wait
