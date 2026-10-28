# ZDOS-K.I.R.A. Online

Control center responsive con AI Manus server-side, autenticazione amministrativa e strumenti difensivi read-only.

## Runtime

Il server ascolta su `PORT` (default `3000`) e serve il pannello da `public/`. `GET /health` è pubblico; tutte le altre route `/api/*` richiedono il bearer token ottenuto dal login. Configura `KIRA_ADMIN_PASSWORD` con una password sicura, `MANUS_API_URL` con l’URL base del provider compatibile con le API chat completions e `MANUS_API_KEY` tramite le variabili protette del deployment. Senza le credenziali del provider, la chat mostra un errore esplicito e non simula risposte AI. `KIRA_MODEL` è opzionale: se non specificato, il server seleziona un modello disponibile dal catalogo del provider.

La chat mantiene il contesto degli ultimi otto messaggi riusciti durante la sessione del browser. Invio spedisce il messaggio, Maiusc+Invio inserisce una nuova riga e “Nuova conversazione” azzera il contesto. Le conversazioni non vengono salvate sul server.

Le sessioni e il rate limit sono in memoria: il deployment è intenzionalmente single-instance e un riavvio invalida le sessioni attive. L’audit non apre connessioni ai target e non persiste dati sensibili.

## GitHub Pages

`npm run build` copia il frontend in `docs/`. Il workflow `.github/workflows/pages.yml` pubblica `docs/` con GitHub Actions. `public/config.js` contiene solo l’URL HTTPS pubblico del backend, che non è una credenziale; quando il pannello gira sul backend usa invece API relative. GitHub Pages esegue solo il frontend statico, mentre login e AI restano nel backend.
