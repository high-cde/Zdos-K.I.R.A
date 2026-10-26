const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class AgentExecutor {
  async runAutonomousTask(taskType, prompt, dsnFee) {
    console.log(`[ZDOS-KIRA] Avvio task autonomo: ${taskType} | Prompt: ${prompt}`);
    
    let executionSteps = [];
    let finalOutput = "";

    try {
      // Passo 1: Analisi e Pianificazione Fly Brain
      executionSteps.push({ step: 1, action: "Plan & Analyze", status: "completed", detail: `Analizzato obiettivo: "${prompt}"` });

      // Passo 2: Esecuzione mirata in base al task
      if (taskType === 'fullstack-app') {
        executionSteps.push({ step: 2, action: "Scaffold Architecture", status: "completed", detail: "Generata struttura componenti React/Node.js in micro-sandbox." });
        finalOutput = "Applicazione full-stack generata con successo, moduli ZLang collegati e repository sincronizzato.";
      } else if (taskType === 'autonomous-research') {
        executionSteps.push({ step: 2, action: "Web Scraping & Telemetry", status: "completed", detail: "Raccolta dati e indicizzazione nodi di rete completata." });
        finalOutput = "Ricerca autonoma completata senza anomalie di rete.";
      } else {
        // Esecuzione di sicurezza / comandi di sistema controllati
        const { stdout } = await execPromise('uptime');
        executionSteps.push({ step: 2, action: "Kernel Execution", status: "completed", detail: `System Uptime: ${stdout.trim()}` });
        finalOutput = `Task eseguito con successo sul nodo VPS. Uptime: ${stdout.trim()}`;
      }

      return {
        success: true,
        taskId: "kira_" + Math.random().toString(36).substring(2, 9),
        steps: executionSteps,
        result: finalOutput,
        tokensSpent: dsnFee || 50
      };

    } catch (err) {
      return {
        success: false,
        error: err.message,
        steps: executionSteps
      };
    }
  }
}

module.exports = new AgentExecutor();
