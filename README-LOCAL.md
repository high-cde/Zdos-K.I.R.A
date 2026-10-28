# ZDOS-K.I.R.A su Ubuntu — solo locale

Questa versione gira sul laptop e ascolta esclusivamente su `127.0.0.1`. Non richiede GitHub Pages, VPS, dominio o reverse proxy. La cartella `site/` è l’unica esposta dal server statico locale; il file privato `backend/.env` non viene servito dal web server.

## Requisiti

- Ubuntu con Node.js 18+ e npm
- Python 3 e OpenSSL (normalmente già presenti)
- Connessione Internet durante il primo `npm ci` per scaricare le dipendenze

## Installazione e avvio

1. Estrai il pacchetto in una cartella del laptop, per esempio `~/ZDOS-KIRA-local`.
2. Apri il Terminale sul laptop e spostati nella cartella estratta, per esempio:

   ```bash
   cd ~/ZDOS-KIRA-local
   ```

3. Esegui la configurazione iniziale:

   ```bash
   ./setup-local.sh
   ```

   Lo script chiede una password amministratore (minimo 16 caratteri), la conferma e, facoltativamente, una chiave API AI. Password e chiave non vengono mostrate mentre le digiti. La chiave AI, se inserita, rimane solo in `backend/.env` sul laptop; non aggiungerla a Git né inviarla in chat. La configurazione privata ha permessi `600`.

4. Avvia l’app:

   ```bash
   ./run-local.sh
   ```

5. Sul browser dello stesso laptop apri **http://localhost:8080**. Fai login con la password amministratore creata al punto 3. Lascia aperto il Terminale mentre la usi. Premi `Ctrl+C` per arrestare entrambi i processi.

## Assistente AI

Se salti la chiave API, login e telemetria locale funzionano, ma l’assistente risponderà che il provider AI non è configurato. Puoi interrompere l’app, modificare sul laptop `backend/.env` impostando `LLM_API_KEY`, quindi riavviare. La chiave viene inviata dal backend al provider AI scelto; verifica le condizioni e i costi del tuo provider. Non inserire password, chiavi o dati sensibili nei prompt.

## Sicurezza e limiti

- Non aprire porte sul router e non configurare port forwarding.
- Non modificare `--bind 127.0.0.1` negli script: serve a mantenere il servizio accessibile solo dal laptop.
- I due servizi ascoltano su `127.0.0.1:3000` (API) e `127.0.0.1:8080` (interfaccia).
- Le sessioni si invalidano chiudendo/riavviando il backend; il logout revoca il token sul server.
- Non sono attivi comandi shell, scansioni, transazioni token, compilazioni o sandbox.
- Se una porta è già occupata, chiudi l’app che la usa prima di avviare K.I.R.A.

Per disinstallare, arresta il programma e cancella la cartella estratta. Se hai usato una chiave API, revocala dal pannello del provider prima di eliminare il laptop o il disco.
