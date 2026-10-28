(() => {
  'use strict';

  const config = window.ZDOS_CONFIG || {};
  const apiBase = String(config.apiBase || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = String(config.model || 'gpt-4o-mini');
  const $ = (id) => document.getElementById(id);
  const chatHistory = [];
  let apiKey = '';
  let toastTimer;

  function toast(message) {
    const node = $('toast');
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('show'), 4500);
  }

  function setKeyStatus(active) {
    $('api-status-dot').className = `status-dot ${active ? 'green' : 'amber'}`;
    $('api-status').textContent = active ? `K.I.R.A. PRONTA · ${model}` : 'PRONTA · SERVE LA TUA API KEY';
    $('key-active').classList.toggle('hidden', !active);
    $('key-form').classList.toggle('hidden', active);
  }

  function addMessage(role, text) {
    const article = document.createElement('article');
    article.className = `chat-message ${role}`;
    const label = document.createElement('span');
    label.className = 'message-label';
    label.textContent = role === 'user' ? 'TU' : 'K.I.R.A.';
    const content = document.createElement('p');
    content.textContent = text;
    article.append(label, content);
    $('chat-log').appendChild(article);
    $('chat-log').scrollTop = $('chat-log').scrollHeight;
    return content;
  }

  function friendlyError(status, details) {
    if (status === 401 || status === 403) return 'OpenAI non ha accettato la chiave. Controlla che sia corretta e abilitata, poi rimuovila e inseriscila di nuovo.';
    if (status === 429) return 'Limite o credito API OpenAI raggiunto. Controlla quota e fatturazione nel tuo account OpenAI.';
    if (status === 404) return `Il modello “${model}” non è disponibile per questa chiave. Verifica il modello in config.js.`;
    if (status >= 500) return 'OpenAI non è al momento disponibile. Riprova tra poco.';
    return details || `Richiesta non riuscita (HTTP ${status}).`;
  }

  async function sendMessage(event) {
    event.preventDefault();
    const prompt = $('chat-prompt').value.trim();
    $('chat-error').textContent = '';
    if (!prompt) return;
    if (!apiKey) {
      $('chat-error').textContent = 'Per usare l’AI, inserisci prima la tua chiave API OpenAI nel riquadro “Configurazione personale”.';
      $('api-key').focus();
      return;
    }

    $('chat-prompt').value = '';
    chatHistory.push({ role: 'user', content: prompt });
    addMessage('user', prompt);
    const answer = addMessage('assistant', 'Sto elaborando…');
    answer.classList.add('pending');
    const button = $('send-button');
    button.disabled = true;
    button.dataset.label = button.textContent;
    button.textContent = 'K.I.R.A. sta pensando…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const messages = [
        { role: 'system', content: 'Sei K.I.R.A., un assistente AI utile, chiaro e prudente. Rispondi in italiano se l’utente scrive in italiano. Aiuta con domande, scrittura, idee e codice. Non affermare di aver eseguito azioni esterne, pagamenti, scansioni o comandi: non hai strumenti né accesso al dispositivo.' },
        ...chatHistory.slice(-10)
      ];
      const response = await fetch(`${apiBase}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 1400 }),
        signal: controller.signal,
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(friendlyError(response.status, data?.error?.message));
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) throw new Error('Il provider ha restituito una risposta vuota.');
      answer.textContent = text.trim();
      answer.classList.remove('pending');
      chatHistory.push({ role: 'assistant', content: text.trim() });
      while (chatHistory.length > 12) chatHistory.shift();
    } catch (error) {
      answer.textContent = error.name === 'AbortError' ? 'La richiesta ha superato il tempo limite. Riprova.' : error.message || 'Connessione al provider non riuscita. Verifica la rete e riprova.';
      answer.classList.remove('pending');
      if (error.name !== 'AbortError') toast(answer.textContent);
    } finally {
      clearTimeout(timeout);
      button.disabled = false;
      button.textContent = button.dataset.label || 'Invia a K.I.R.A. ↗';
      delete button.dataset.label;
      $('chat-prompt').focus();
    }
  }

  $('key-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = $('api-key').value.trim();
    if (!value || /\s/.test(value)) {
      toast('Inserisci una chiave API valida senza spazi.');
      return;
    }
    apiKey = value;
    $('api-key').value = '';
    setKeyStatus(true);
    toast('Chiave attiva in memoria. Nessun controllo o addebito è stato eseguito.');
    $('chat-prompt').focus();
  });

  $('remove-key').addEventListener('click', () => {
    apiKey = '';
    setKeyStatus(false);
    toast('Chiave rimossa dalla memoria di questa pagina.');
    $('api-key').focus();
  });

  $('chat-form').addEventListener('submit', sendMessage);
  $('chat-prompt').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      $('chat-form').requestSubmit();
    }
  });
  $('clear-chat').addEventListener('click', () => {
    chatHistory.length = 0;
    $('chat-log').replaceChildren();
    addMessage('assistant', 'Nuova conversazione. Sono pronta: cosa vuoi chiedermi?');
    $('chat-error').textContent = '';
    $('chat-prompt').focus();
  });

  setKeyStatus(false);
})();
