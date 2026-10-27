# K.I.R.A zLLM gateway

`POST /api/v1/zllm/generate` usa ora un provider reale compatibile con l'API OpenAI. Quando manca la configurazione, restituisce `503 ai_not_configured`: non produce più testo dimostrativo. `GET /health` riporta `inferenceConfigured` e il modello configurato, senza esporre credenziali.

## Variabili server

Impostare queste variabili nel secret manager o nell'ambiente del servizio, mai nel repository e mai nel codice frontend:

- `ZLLM_API_KEY` (obbligatoria): credenziale del provider.
- `ZLLM_API_BASE_URL` (opzionale): base HTTPS OpenAI-compatible; default `https://api.openai.com/v1`. HTTP è consentito solo per localhost.
- `ZLLM_MODEL` (opzionale): modello di default; default `gpt-4o-mini`.
- `ZLLM_MODEL_PRIMARY` / `ZLLM_MODEL_SECONDARY` (opzionali): override per tier.
- `ZLLM_TIMEOUT_MS` (opzionale): timeout limitato a 1–60 secondi; default 30 secondi.

Riavviare il backend dopo aver configurato l'ambiente. Una risposta `GET /health` con `inferenceConfigured: true` conferma solo la presenza della chiave lato server, non garantisce credito, accessibilità o correttezza del provider.

## Endpoint

`POST /api/v1/zllm/generate` accetta JSON `{ "prompt": "...", "tier": "primary" }`. Il prompt deve contenere da 1 a 8000 caratteri; il body HTTP è limitato a 16 KiB. Il rate limit attuale è 10 richieste per IP al minuto (in memoria del singolo processo), non sostituisce autenticazione, quota o protezione distribuita per un servizio pubblico.

La pagina x-zdos.it deve usare un'origine HTTPS con reverse proxy TLS verso il backend, oppure essere servita dallo stesso host del backend. Non configurare il browser per chiamare direttamente un endpoint HTTP remoto. Configurare CORS con l'origine effettiva del sito.

## Verifica

Eseguire `npm test` da `backend/`: i test sono locali e non contattano provider esterni. Dopo il deploy, verificare health, una richiesta con prompt innocuo e la gestione `503` quando la chiave è assente. Non usare chiavi inserite nel repository; se una credenziale è stata pubblicata, revocarla e sostituirla.
