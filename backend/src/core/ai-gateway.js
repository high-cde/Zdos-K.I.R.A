class AIServiceError extends Error {
  constructor(code, message, statusCode = 502) {
    super(message);
    this.name = 'AIServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class AIGateway {
  constructor({ env = process.env, fetchImpl = (...args) => fetch(...args) } = {}) {
    this.env = env;
    this.fetchImpl = fetchImpl;
  }

  getStatus() {
    return {
      configured: Boolean(this.env.ZLLM_API_KEY),
      provider: this.env.ZLLM_API_BASE_URL ? 'OpenAI-compatible' : 'OpenAI-compatible (default endpoint)',
      model: this.env.ZLLM_MODEL_PRIMARY || this.env.ZLLM_MODEL || 'gpt-4o-mini'
    };
  }

  async dispatchPrompt(prompt, tier = 'primary') {
    if (typeof prompt !== 'string' || !prompt.trim()) {
      throw new AIServiceError('invalid_prompt', 'Inserisci una richiesta testuale.', 400);
    }
    if (prompt.length > 8000) {
      throw new AIServiceError('prompt_too_long', 'La richiesta supera il limite di 8000 caratteri.', 400);
    }

    const apiKey = this.env.ZLLM_API_KEY;
    if (!apiKey) {
      throw new AIServiceError('ai_not_configured', 'Il provider AI non è configurato sul server.', 503);
    }

    const baseUrl = (this.env.ZLLM_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
    let parsedUrl;
    try {
      parsedUrl = new URL(baseUrl);
    } catch (_error) {
      throw new AIServiceError('invalid_ai_configuration', 'ZLLM_API_BASE_URL non è un URL valido.', 503);
    }
    const localHost = ['localhost', '127.0.0.1', '::1'].includes(parsedUrl.hostname);
    if (parsedUrl.protocol !== 'https:' && !(localHost && parsedUrl.protocol === 'http:')) {
      throw new AIServiceError('invalid_ai_configuration', 'Il provider AI deve usare HTTPS (HTTP è ammesso solo in locale).', 503);
    }

    const model = tier === 'secondary'
      ? (this.env.ZLLM_MODEL_SECONDARY || this.env.ZLLM_MODEL || this.env.ZLLM_MODEL_PRIMARY || 'gpt-4o-mini')
      : (this.env.ZLLM_MODEL_PRIMARY || this.env.ZLLM_MODEL || 'gpt-4o-mini');
    const timeoutMs = Math.min(Math.max(Number(this.env.ZLLM_TIMEOUT_MS) || 30000, 1000), 60000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await this.fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: 900,
          messages: [
            {
              role: 'system',
              content: 'Sei K.I.R.A., l’assistente AI dell’ecosistema ZDOS. Rispondi in modo chiaro e onesto. Non dichiarare di aver eseguito comandi, scansioni, transazioni o accessi a sistemi se non sono stati effettivamente eseguiti da uno strumento autorizzato.'
            },
            { role: 'user', content: prompt.trim() }
          ]
        })
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new AIServiceError('ai_timeout', 'Il provider AI non ha risposto entro il tempo previsto.', 504);
      }
      throw new AIServiceError('ai_unreachable', 'Il provider AI non è raggiungibile dal server.', 502);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const statusCode = response.status === 429 ? 503 : 502;
      const code = response.status === 429 ? 'ai_rate_limited' : 'ai_upstream_error';
      throw new AIServiceError(code, response.status === 429
        ? 'Il provider AI ha raggiunto il limite di richieste. Riprova più tardi.'
        : `Il provider AI ha rifiutato la richiesta (HTTP ${response.status}).`, statusCode);
    }

    let payload;
    try {
      payload = await response.json();
    } catch (_error) {
      throw new AIServiceError('invalid_ai_response', 'Il provider AI ha restituito una risposta non valida.', 502);
    }

    const answer = payload?.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) {
      throw new AIServiceError('empty_ai_response', 'Il provider AI non ha restituito testo.', 502);
    }

    return {
      status: 'completed',
      engine: 'OpenAI-compatible AI provider',
      model: payload.model || model,
      response: answer.trim()
    };
  }
}

module.exports = new AIGateway();
module.exports.AIGateway = AIGateway;
module.exports.AIServiceError = AIServiceError;
