# TODO — ZDOS-K.I.R.A. Online

- [x] **Frontend operativo responsive e compatibile con GitHub Pages**
  - Il pannello conserva i flussi di panoramica, dispatcher, audit difensivo, telemetria ZNode, runtime ZLang e tokenomics.
  - Il layout funziona su desktop e mobile senza dipendere da URL localhost o da un VPS hardcoded.
  - Il bundle statico non contiene chiavi AI, password o credenziali.

- [x] **Backend server-side e health check**
  - Il server ascolta su `0.0.0.0` e rispetta `PORT`, espone `GET /health` senza autenticazione e serve il frontend.
  - La configurazione containerizzata installa le dipendenze a partire dal lockfile e avvia il server in produzione.
  - Gli endpoint protetti restituiscono errori coerenti senza stack trace o segreti.

- [x] **Autenticazione amministrativa e protezione endpoint**
  - Il login richiede la variabile protetta `KIRA_ADMIN_PASSWORD`, crea una sessione bearer temporanea e supporta logout.
  - Le richieste protette senza sessione vengono rifiutate; input e dimensioni dei prompt sono validati.
  - Rate limit e CORS limitano gli abusi e non vengono usati cookie cross-site.

- [x] **Potenziamento AI integrato**
  - La chat AI usa il servizio Manus solo lato server e seleziona un modello dal catalogo disponibile, rispettando `KIRA_MODEL` se configurato.
  - Il dispatcher produce piano, rischi e risultato tramite AI senza eseguire shell, scraping o transazioni.
  - Se il provider non è configurato o restituisce un errore, l’UI mostra un esito trasparente e non simula una risposta riuscita.

- [x] **Audit, telemetria e runtime sicuri**
  - L’audit è dichiaratamente difensivo e non esegue port scan, RF capture, comandi o accessi a target arbitrari.
  - La telemetria restituisce solo metriche del processo/server e il contratto DSN configurato.
  - ZLang effettua solo validazione/compilazione dimostrativa in memoria e non esegue codice fornito dall’utente.

- [ ] **Checkpoint e pubblicazione**
  - Il progetto ha manifest `/manus-routes.json`, configurazione di build/deploy e logo metadata.
  - Il repository GitHub contiene workflow per pubblicare `docs/` su GitHub Pages.
  - La pubblicazione del backend viene confermata con health check; il frontend Pages usa l’URL pubblico del backend senza esporre segreti.
