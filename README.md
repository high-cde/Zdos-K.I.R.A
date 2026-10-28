# ZDOS-K.I.R.A

K.I.R.A. è una chat AI statica pubblicabile su GitHub Pages. Non richiede login e non usa un backend condiviso. Per ricevere risposte, ciascun visitatore inserisce la propria chiave API OpenAI nell’interfaccia.

## Uso su GitHub Pages

Apri il sito Pages, inserisci una chiave API OpenAI nel riquadro di configurazione e scrivi un messaggio. La chiave resta in memoria nella scheda corrente e scompare ricaricando o chiudendo la pagina. Le richieste vengono inviate direttamente dal browser a `https://api.openai.com/v1/chat/completions`; né GitHub Pages né un server K.I.R.A. ricevono la chiave. Ogni utente usa e paga il proprio account API OpenAI.

La chiave API non è la password dell’account ChatGPT e un abbonamento ChatGPT non include automaticamente credito API. Non inserire chiavi in issue, prompt, repository, `config.js` o messaggi condivisi. Non usare il sito con una chiave attiva su dispositivi condivisi; rimuovi la chiave dalla pagina al termine e revocala dal provider se sospetti che sia stata esposta.

## Configurazione

`config.js` contiene solo valori pubblici: endpoint OpenAI e nome del modello. Non aggiungere segreti. Il modello predefinito è `gpt-4o-mini` e può essere cambiato lì se la chiave ha accesso a un altro modello compatibile con Chat Completions.

GitHub Pages può servire soltanto file statici: non può custodire una chiave API privata. Questa modalità BYOK (Bring Your Own Key) mantiene il segreto fuori dal repository, ma il codice JavaScript della pagina usa la chiave in chiaro in memoria del browser. Per un servizio AI condiviso con chiave server-side serve invece un backend HTTPS protetto da autenticazione, limiti di utilizzo e monitoraggio dei costi; non esporre un gateway AI pubblico e anonimo.

## Backend locale legacy

La cartella `backend/` contiene l’implementazione Node.js per un’eventuale installazione privata. Non è richiesta dalla chat GitHub Pages attuale e la pagina statica non invia richieste a quel backend. Se la si installa, seguire `backend/.env.example` e i template in `backend/deploy/`; mantenere password e chiavi AI fuori da Git.
