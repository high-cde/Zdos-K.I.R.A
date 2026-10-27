# ZDOS-K.I.R.A

Console statica per GitHub Pages con API Node separata sul VPS. GitHub Pages serve solo HTML/CSS/JavaScript; le credenziali e il provider AI restano sul server.

## Configurazione del frontend

Impostare `apiBase` in `config.js` sull’origine pubblica HTTPS dell’API, per esempio `https://api.example.com` (senza slash finale). Questo file è pubblico: non inserirvi password, token o chiavi. La Pages origin prevista è `https://high-cde.github.io`.

## Configurazione backend

Il backend richiede Node.js 18 o successivo. Sul VPS:

1. Creare l’utente di servizio `kira`, una cartella applicativa non pubblica e installare `backend/package-lock.json` con `npm ci --omit=dev`.
2. Creare `/etc/zdos-kira/kira.env` copiando `backend/.env.example`; sostituire ogni segnaposto, usare `openssl rand -hex 32` per `SESSION_SECRET` e limitarne l’accesso (per esempio proprietario `root`, gruppo `kira`, modo `0640`). Il template systemd carica esattamente questo percorso; in esecuzione manuale `dotenv` cerca invece `backend/.env`.
3. Impostare `NODE_ENV=production`, `ADMIN_PASSWORD` con una password casuale lunga (almeno 16 caratteri), `ALLOWED_ORIGINS=https://high-cde.github.io` e le credenziali del provider in `LLM_API_KEY`.
4. Installare il servizio `backend/deploy/zdos-kira.service.example` come unità systemd e configurare un reverse proxy HTTPS (per esempio Caddy o Nginx con certificato valido) verso `127.0.0.1:3000`. L’app ascolta solo su localhost; non esporre direttamente la porta Node a Internet.
5. Impostare `config.js` con l’URL HTTPS effettivo, avviare il servizio e verificare `/health`.

Non usare credenziali che siano già state committate nel repository. Ruotarle presso il provider prima di inserirle sul VPS. La cronologia Git può conservare file rimossi dai commit successivi; la loro rimozione richiede una procedura separata di bonifica della cronologia.

## Funzioni attive

- Login amministratore sul backend con token firmato a scadenza di un’ora e limiti ai tentativi.
- Telemetria VPS accessibile solo con sessione autenticata.
- Risposte AI reali attraverso un endpoint compatibile OpenAI configurato lato server.

Non sono attivi strumenti shell, scansioni di rete, transazioni DSN, compilazione ZLang o sandbox. Non inserire dati sensibili nei prompt. Il backend non archivia la cronologia delle conversazioni.


Template di supporto:

- `backend/deploy/zdos-kira.service.example` per eseguire il processo come servizio systemd con utente non privilegiato.
- `backend/deploy/Caddyfile.example` per terminare TLS e inoltrare il traffico HTTPS a `127.0.0.1:3000`.

Sostituire il dominio d’esempio e verificare DNS/certificato prima di puntare GitHub Pages all’API.
