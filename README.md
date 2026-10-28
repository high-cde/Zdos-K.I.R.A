# ZDOS-K.I.R.A. Online

Control center responsive con AI Manus server-side, autenticazione amministrativa e strumenti difensivi read-only.

## Runtime

Il server ascolta su `PORT` (default `3000`) e serve il pannello da `public/`. `GET /health` è pubblico; tutte le altre route `/api/*` richiedono il bearer token ottenuto dal login. Configura `KIRA_ADMIN_PASSWORD` tramite il secret manager Webdev. Il gateway AI usa le variabili runtime Manus e seleziona il catalogo disponibile; `KIRA_MODEL` è opzionale.

Le sessioni e il rate limit sono in memoria: il deployment è intenzionalmente single-instance e un riavvio invalida le sessioni attive. L’audit non apre connessioni ai target e non persiste dati sensibili.

## GitHub Pages

`npm run build` copia il frontend in `docs/`. Il workflow `.github/workflows/pages.yml` pubblica `docs/` con GitHub Actions. `public/config.js` contiene solo l’URL HTTPS pubblico del backend, che non è una credenziale; quando il pannello gira sul backend usa invece API relative. GitHub Pages esegue solo il frontend statico, mentre login e AI restano nel backend.
