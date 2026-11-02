# K.I.R.A. — ZDOS AI Workspace

K.I.R.A. è una chat AI pubblica di ZDOS, ospitata su GitHub Pages e collegata a un backend separato. L’interfaccia non richiede login e non contiene chiavi o credenziali. La route pubblica offre solo chat testuale; telemetria, sessioni amministrative e altre funzioni server restano protette.

- UI pubblica: <https://high-cde.github.io/Zdos-K.I.R.A/>
- API: <https://api.x-zdos.it>
- VPS previsto: Ubuntu `5.189.180.13`, dietro Nginx e HTTPS.
- Sorgente UI: cartella `site/` nel branch `main`; il branch Pages legacy `feature/real-pages-vps-backend` deve essere aggiornato con la stessa build pubblica.

## Funzioni pubbliche e limiti

La chat usa `POST /api/v1/public/chat`, senza token. Accetta le modalità `assistant`, `writing` e `coding`, fino a 2.000 caratteri per messaggio, e limita la risposta AI a 800 token. Il server consente al massimo **5 richieste per IP in un’ora** e applica un cooldown predefinito di **15 secondi** tra messaggi. Il cooldown può essere modificato sul server con `PUBLIC_CHAT_COOLDOWN_MS` (da 1.000 a 60.000 ms).

È un servizio pubblico: chiunque può consumare le richieste disponibili e l’uso del provider può generare costi. Imposta un limite di spesa anche nel pannello del provider AI e controlla l’utilizzo. Il rate limit è in memoria e può essere aggirato distribuendo le richieste su più IP o riavviando il servizio; per un lancio più ampio si consiglia anche un limite Nginx/WAF condiviso e monitoraggio server-side.

La chiave AI resta esclusivamente in `backend/.env` sul VPS. La configurazione browser espone solo l’URL HTTPS dell’API. La chat non conserva conversazioni in `localStorage` o `sessionStorage`.

## Backend e API amministrativa

La route pubblica AI è separata dalle route private. Login, sessioni, telemetria e le API amministrative mantengono l’autenticazione bearer token e la password amministratore lato server. `ADMIN_PASSWORD`, `SESSION_SECRET` e `LLM_API_KEY` restano obbligatori per l’avvio in produzione: non inserirli mai nei file Pages o in Git.

Per configurare il VPS:

1. Clona o aggiorna il repository in `/opt/Zdos-K.I.R.A` e configura le variabili server:

   ```bash
   git clone https://github.com/high-cde/Zdos-K.I.R.A.git /opt/Zdos-K.I.R.A
   cd /opt/Zdos-K.I.R.A
   cp backend/.env.example backend/.env
   chmod 600 backend/.env
   nano backend/.env
   ```

2. Nel file `backend/.env` inserisci una password amministratore di almeno 16 caratteri, un `SESSION_SECRET` casuale di almeno 32 caratteri e la chiave AI del provider. Mantieni `ALLOWED_ORIGINS=https://high-cde.github.io`. Non pubblicare i valori dei segreti.

3. Nel DNS di `x-zdos.it`, configura l’host API come record A `api` → `5.189.180.13`. Non cambiare record apex, nameserver, MX o TXT.

4. Dopo la propagazione DNS, attiva Nginx e TLS per `api.x-zdos.it` usando `deploy/nginx-api.conf` e Certbot. Il virtual host API è separato dal sito principale `x-zdos.it`.

5. Avvia o aggiorna il backend:

   ```bash
   docker compose up -d --build
   ```

6. Verifica `https://api.x-zdos.it/health` e poi prova una richiesta a `/api/v1/public/chat`. La chat non sarà operativa finché DNS, certificato HTTPS, backend e chiave provider non saranno configurati.

## Pubblicazione frontend

Il workflow GitHub Actions in `.github/workflows/pages.yml` costruisce il sito da `site/` e genera `config.js` con il solo endpoint HTTPS. La configurazione Pages attualmente usa il branch `feature/real-pages-vps-backend` come sorgente legacy alla root; quando si aggiorna quella Pages, copiare nella root del branch i quattro file statici `index.html`, `app.js`, `style.css` e `config.js` dalla cartella `site/` e pubblicare il commit. Non inserire segreti nel frontend.

## Verifiche locali

```bash
cd backend
npm run check
npm test
```

I test verificano che la route chat funzioni senza token, che il cooldown risponda `429` e che login, telemetria e logout restino protetti.
