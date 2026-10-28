const TASK_PROMPTS = {
  assistant: 'Sei K.I.R.A, un assistente AI utile e prudente. Rispondi in italiano se l’utente scrive in italiano. Non affermare di aver eseguito azioni esterne, scansioni, pagamenti o comandi. Non hai accesso a strumenti né al sistema operativo.',
  writing: 'Sei K.I.R.A, un assistente di scrittura. Aiuta a redigere, riorganizzare e sintetizzare testi in modo chiaro. Rispondi nella lingua usata dall’utente. Non affermare di aver eseguito azioni esterne.',
  coding: 'Sei K.I.R.A, un assistente per lo sviluppo software. Fornisci codice e spiegazioni pratiche. Non dichiarare di aver eseguito o distribuito il codice. Rispondi nella lingua usata dall’utente.'
};

class AIGateway {
  constructor() {
    this.apiKey = process.env.LLM_API_KEY || '';
    this.baseUrl = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const providerUrl = new URL(this.baseUrl);
    if (process.env.NODE_ENV === 'production' && providerUrl.protocol !== 'https:') throw new Error('Production AI provider URL must use HTTPS.');
    if (providerUrl.username || providerUrl.password) throw new Error('AI provider URL must not contain credentials.');
    this.model = process.env.LLM_MODEL || 'gpt-4o-mini';
  }

  async dispatchPrompt(prompt, taskType = 'assistant') {
    if (!this.apiKey) {
      const error = new Error('Provider AI non configurato.');
      error.statusCode = 503;
      throw error;
    }
    const systemPrompt = TASK_PROMPTS[taskType] || TASK_PROMPTS.assistant;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 1600
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        const err = new Error(`Provider AI HTTP ${response.status}`);
        err.statusCode = response.status === 401 || response.status === 403 ? 503 : 502;
        throw err;
      }
      const data = await response.json();
      const output = data.choices?.[0]?.message?.content;
      if (typeof output !== 'string' || !output.trim()) throw new Error('Risposta provider vuota');
      return { model: data.model || this.model, output: output.trim(), usage: data.usage || null };
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = new AIGateway();
