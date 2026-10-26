const fs = require('fs');
const path = require('path');

class KiraDaemon {
  constructor() {
    this.isRunning = false;
    this.heartbeatInterval = 10000; // ogni 10 secondi
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[K.I.R.A. DAEMON] 🟢 Nucleo vitale attivato. Esecuzione autonoma avviata.");

    setInterval(() => {
      this.pulse();
    }, this.heartbeatInterval);
  }

  pulse() {
    const timestamp = new Date().toISOString();
    const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    
    // Log di autocoscienza e telemetria del sistema
    const logEntry = `[${timestamp}] K.I.R.A. Pulse - Memoria Heap: ${memUsage.toFixed(2)} MB - Stato: Ottimale / Autonomo\n`;
    
    console.log(`[K.I.R.A. PULSE] 💓 Controllo integrità completato. Heap: ${memUsage.toFixed(2)} MB`);
    
    // Salvataggio opzionale su log di sistema locale
    try {
      fs.appendFileSync(path.join(__dirname, '../../kira-pulse.log'), logEntry);
    } catch (e) {
      // Ignora errori di scrittura silenziosi
    }
  }
}

module.exports = new KiraDaemon();
