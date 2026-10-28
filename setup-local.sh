#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
SITE="$ROOT/site"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Errore: installa Node.js 18 o successivo (con npm) e rilancia questo script." >&2
  exit 1
fi
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( NODE_MAJOR < 18 )); then echo "Errore: serve Node.js 18 o successivo." >&2; exit 1; fi
command -v python3 >/dev/null 2>&1 || { echo "Errore: python3 non trovato." >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "Errore: openssl non trovato." >&2; exit 1; }

if [[ -f "$BACKEND/.env" ]]; then
  echo "Configurazione backend già presente: non la sovrascrivo."
else
  read -r -s -p "Crea una password amministratore (almeno 16 caratteri): " ADMIN_PASSWORD
  echo
  if (( ${#ADMIN_PASSWORD} < 16 )); then echo "Password troppo corta (minimo 16 caratteri)." >&2; exit 1; fi
  read -r -s -p "Ripeti la password: " ADMIN_PASSWORD_CONFIRM
  echo
  if [[ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]]; then echo "Le password non coincidono." >&2; exit 1; fi
  read -r -s -p "Chiave API AI (facoltativa, Invio per saltare): " LLM_API_KEY
  echo

  dotenv_quote() {
    local value="$1"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    printf '"%s"' "$value"
  }

  umask 077
  {
    printf 'NODE_ENV=development\n'
    printf 'PORT=3000\n'
    printf 'ADMIN_PASSWORD=%s\n' "$(dotenv_quote "$ADMIN_PASSWORD")"
    printf 'SESSION_SECRET=%s\n' "$(openssl rand -hex 32)"
    printf 'ALLOWED_ORIGINS=http://localhost:8080\n'
    printf 'LLM_API_KEY=%s\n' "$(dotenv_quote "$LLM_API_KEY")"
    printf 'LLM_BASE_URL=https://api.openai.com/v1\n'
    printf 'LLM_MODEL=gpt-4o-mini\n'
  } > "$BACKEND/.env"
  chmod 600 "$BACKEND/.env"
  unset ADMIN_PASSWORD ADMIN_PASSWORD_CONFIRM LLM_API_KEY
  echo "Configurazione privata salvata in backend/.env (permessi 600)."
fi

printf '%s\n' '// Config locale: l’API ascolta solo sul laptop.' 'window.KIRA_CONFIG = Object.freeze({' '  apiBase: "http://127.0.0.1:3000"' '});' > "$SITE/config.js"

if [[ ! -d "$BACKEND/node_modules/express" ]]; then
  echo "Installazione dipendenze Node…"
  (cd "$BACKEND" && npm ci --omit=dev --no-audit --no-fund)
fi

(cd "$BACKEND" && npm run check)
echo
echo "Configurazione completata. Avvia con: $ROOT/run-local.sh"
echo "Apri poi http://localhost:8080 nel browser del laptop."
echo "Il sito statico e l’API sono legati al loopback: non sono pubblicati su Internet."
