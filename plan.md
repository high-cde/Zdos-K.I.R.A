# Piano ZDOS-K.I.R.A. Online

## Obiettivo
Portare online ZDOS-K.I.R.A. mantenendo l’esperienza di control center del repository esistente, usando GitHub Pages per il frontend statico e un backend server-side per autenticazione, AI e funzioni riservate. Le chiavi e le credenziali restano fuori dal browser.

## Architettura
- `server/`: server Express unico per il preview e la pubblicazione containerizzata; espone health check, login a sessione, telemetria, task dispatcher, chat AI, audit difensivo e compilazione ZLang simulata senza esecuzione arbitraria.
- `public/`: frontend responsive servito dal backend e copiato in `docs/` per GitHub Pages; usa API relative quando è sul backend e una configurazione runtime quando è su Pages.
- `docs/`: bundle statico GitHub Pages; nessuna chiave o credenziale viene inserita nel bundle.
- `Dockerfile`: immagine di produzione che installa le dipendenze e avvia il listener sulla porta `PORT`.
- `.github/workflows/pages.yml`: pubblicazione automatica di `docs/` su GitHub Pages.
- `public/manus-routes.json`: manifest delle route web visibili.

## Design
Sono state considerate tre direzioni: “terminal cyber-noir” (0,07), “control room glassmorphism” (0,06) e “editoriale tecnico chiaro” (0,04). Viene scelta **terminal cyber-noir**.

- **Movimento**: console operativa cyber-noir, con gerarchia da pannello SOC e ritmo da terminale.
- **Principi**: leggibilità prima dell’effetto, stato sempre visibile, azioni reversibili, separazione netta tra dati e comandi.
- **Colore**: fondo carbone e superfici grafite per ridurre il rumore; verde menta per salute e completamento; ambra per token e attenzione; rosso corallo solo per rischio e blocchi.
- **Layout**: barra laterale su desktop e barra superiore compatta su mobile; contenuto operativo a pannelli asimmetrici, con log e stato affiancati all’azione.
- **Segni distintivi**: wordmark “ZDOS // K.I.R.A.”, barra di stato con heartbeat, pannelli terminale con timestamp e griglia di metriche.
- **Interazione**: ogni azione mostra caricamento, esito e messaggio d’errore utile; nessun comando riservato viene eseguito senza backend e sessione.
- **Animazione**: transizioni brevi, heartbeat discreto e nessun movimento decorativo durante l’elaborazione AI.
- **Tipografia**: Inter/system per UI e JetBrains Mono/monospace per log e dati tecnici; titoli compatti, testo operativo medio e valori numerici ad alto contrasto.
- **Essenza**: una control room AI sovrana per osservare, pianificare e verificare operazioni tecniche senza esporre il nucleo riservato. Personalità: vigile, tecnica, misurata.
- **Voce**: titoli diretti e microcopy operativo. Esempi: “Nucleo online, nessuna chiave nel browser.” e “Analisi difensiva completata; nessun comando attivo eseguito.”
- **Wordmark**: segno `//` come doppio binario tra osservazione e azione, seguito da “K.I.R.A.” in monospazio.
- **Colore proprietario**: verde menta `#64f4bf`, usato come firma del sistema e non come decorazione generica.

## Potenziamento AI
Il backend usa il catalogo runtime dei modelli Manus e seleziona un modello disponibile server-side; se `KIRA_MODEL` è valorizzato viene rispettato. La chat conserva solo la sessione in memoria e non persiste prompt. Il dispatcher produce pianificazione e risultato tramite AI, con limiti di input e gestione esplicita di provider non disponibile.

## Pubblicazione
Il backend viene pubblicato come container Webdev con health path `/health`; il frontend viene anche preparato per GitHub Pages con workflow Actions. GitHub Pages non esegue Node: le richieste AI e protette puntano al backend pubblicato tramite `docs/config.js`, che non contiene segreti.
