# Backend K.I.R.A. Professional

K.I.R.A. Professional è disponibile sia sulla Pages autonoma `https://high-cde.github.io/Zdos-K.I.R.A/` sia come app nella vetrina Zclipper `https://high-cde.github.io/zclipper/kira/`. Entrambe usano questo backend separato per autenticazione, telemetria e richieste al modello AI. Nessuna password o chiave AI va nei file pubblici.

## Architettura

- Interfacce: `site/` nel repository `high-cde/Zdos-K.I.R.A` e `site/kira/` nel repository `high-cde/zclipper`.
- API pubblica: `https://api.x-zdos.it` sul VPS Ubuntu `5.189.180.13` dietro Nginx/HTTPS.
- Origine CORS da autorizzare: `https://high-cde.github.io` (l’origine non include il percorso `/zclipper/kira/`).
- Password amministratore, `SESSION_SECRET` e `LLM_API_KEY`: solo nel file privato `backend/.env` sul VPS.

## Deploy del backend sul VPS

1. Sul VPS, clona il repository aggiornato e prepara l’ambiente privato:

   ```bash
   git clone https://github.com/high-cde/Zdos-K.I.R.A.git /opt/Zdos-K.I.R.A
   cd /opt/Zdos-K.I.R.A
   cp backend/.env.example backend/.env
   chmod 600 backend/.env
   nano backend/.env
   ```

2. Sul server inserisci una password amministratore robusta di almeno 16 caratteri, un `SESSION_SECRET` casuale di almeno 32 caratteri e la tua chiave AI. Mantieni `ALLOWED_ORIGINS=https://high-cde.github.io`. Non copiare questi valori in GitHub Pages o in chat.

3. In Register.it, nella zona DNS di `x-zdos.it`, crea il record A `api` → `5.189.180.13`. Non cambiare il record apex `@`, nameserver, MX o TXT.

4. Copia la configurazione Nginx inclusa e attiva il certificato HTTPS dopo che il record API risolve verso il VPS:

   ```bash
   sudo cp deploy/nginx-api.conf /etc/nginx/sites-available/kira-api
   sudo ln -s /etc/nginx/sites-available/kira-api /etc/nginx/sites-enabled/kira-api
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d api.x-zdos.it
   ```

   Se Certbot non è installato, installalo prima dai pacchetti Ubuntu. La configurazione aggiunge un virtual host solo per `api.x-zdos.it` e non sostituisce il sito già servito su `x-zdos.it`.

5. Dalla root del repository avvia il container. Docker pubblica la porta solo su loopback del VPS; Nginx inoltra a `127.0.0.1:3000`:

   ```bash
   docker compose up -d --build
   ```

6. Verifica `https://api.x-zdos.it/health`: deve rispondere `{"status":"ok"}`. K.I.R.A. Professional mostrerà lo stato API e abiliterà il login quando l’endpoint è online. Se DNS/HTTPS/backend non sono ancora pronti, la pagina resta pubblica ma indica API non raggiungibile.

## Deploy della UI

Il repository `high-cde/Zdos-K.I.R.A` pubblica `site/` con GitHub Actions dal branch `main`; il workflow usa `https://api.x-zdos.it` come valore predefinito pubblico per la build. Il repository `high-cde/zclipper` pubblica il proprio contenuto `site/` dal branch `master`; la route integrata è `site/kira/`. In entrambi i casi la configurazione client contiene soltanto l’URL pubblico dell’API. Non inserire segreti in `config.js`.

Per la Pages autonoma, imposta **Settings → Pages → Build and deployment → Source → GitHub Actions**. Questo segue la [guida GitHub ai workflow Pages personalizzati](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) e la [documentazione REST GitHub Pages](https://docs.github.com/rest/pages/pages). La [guida alle sorgenti di pubblicazione](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) descrive il passaggio da branch a workflow.

## Sicurezza

- Le richieste AI passano al backend autenticato; la chiave del provider non viene inviata al browser.
- Il token di login resta nella sessione della scheda e scade dopo un’ora.
- Il backend limita i tentativi di login e le richieste AI; resta una sola istanza, poiché sessioni e limiti sono in memoria.
- Le configurazioni correnti rimuovono password fisse dai file. I vecchi commit possono conservarle: se una password precedente è stata usata davvero, cambiala e non riutilizzarla.

Per la modalità locale, consulta [README-LOCAL.md](README-LOCAL.md). Controlli backend: `cd backend && npm run check && npm test`.
