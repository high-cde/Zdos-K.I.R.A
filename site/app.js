(() => {
  'use strict';

  const config = window.KIRA_CONFIG || {};
  const apiBase = String(config.apiBase || '').trim().replace(/\/$/, '');
  const byId = (id) => document.getElementById(id);
  const thread = byId('chat-thread');
  const welcome = byId('welcome-screen');
  const messages = byId('messages');
  const form = byId('chat-form');
  const input = byId('message');
  const sendButton = byId('send-button');
  const charCount = byId('char-count');
  const connectionDot = byId('connection-dot');
  const connectionLabel = byId('connection-label');
  const MAX_CHARS = 2000;
  let busy = false;
  let toastTimer;

  function setConnection(online, text) {
    connectionDot.className = `status-dot ${online ? 'online' : 'offline'}`;
    connectionLabel.textContent = text;
    connectionLabel.title = online ? 'API K.I.R.A. raggiungibile' : 'API non raggiungibile';
  }

  function showToast(message) {
    const toast = byId('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 4200);
  }

  async function checkHealth() {
    if (!apiBase) {
      setConnection(false, 'API non configurata');
      return false;
    }
    try {
      const response = await fetch(`${apiBase}/health`, { cache: 'no-store', credentials: 'omit' });
      const result = await response.json();
      const online = response.ok && result.status === 'ok';
      setConnection(online, online ? 'API online' : 'API non disponibile');
      return online;
    } catch (_) {
      setConnection(false, 'API non raggiungibile');
      return false;
    }
  }

  function scrollToBottom() {
    thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' });
  }

  function createMessage(role, text, meta = '') {
    const article = document.createElement('article');
    article.className = `message message-${role}`;

    const avatar = document.createElement('div');
    avatar.className = `message-avatar ${role === 'assistant' ? 'avatar-kira' : 'avatar-user'}`;
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = role === 'assistant' ? 'K' : 'TU';

    const content = document.createElement('div');
    content.className = 'message-content';
    const heading = document.createElement('div');
    heading.className = 'message-heading';
    const name = document.createElement('strong');
    name.textContent = role === 'assistant' ? 'K.I.R.A.' : 'TU';
    const time = document.createElement('span');
    time.textContent = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    heading.append(name, time);

    const body = document.createElement('div');
    body.className = 'message-body';
    body.textContent = text;
    content.append(heading, body);

    if (meta) {
      const detail = document.createElement('div');
      detail.className = 'message-meta';
      detail.textContent = meta;
      content.append(detail);
    }
    article.append(avatar, content);
    messages.append(article);
    welcome.classList.add('is-hidden');
    thread.classList.add('has-messages');
    scrollToBottom();
    return { article, body, content };
  }

  function addTypingMessage() {
    const message = createMessage('assistant', '');
    const typing = document.createElement('div');
    typing.className = 'typing-indicator';
    typing.setAttribute('aria-label', 'K.I.R.A. sta elaborando');
    for (let i = 0; i < 3; i += 1) {
      const dot = document.createElement('i');
      typing.append(dot);
    }
    message.body.append(typing);
    const label = document.createElement('span');
    label.className = 'typing-label';
    label.textContent = 'K.I.R.A. sta ragionando';
    message.body.append(label);
    return message;
  }

  function updateComposer() {
    const length = input.value.length;
    charCount.textContent = `${length.toLocaleString('it-IT')} / 2.000`;
    charCount.classList.toggle('near-limit', length > MAX_CHARS * 0.9);
    sendButton.disabled = busy || !input.value.trim() || length > MAX_CHARS;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
  }

  async function submitMessage(rawMessage) {
    const message = String(rawMessage || '').trim();
    if (!message || busy) return;
    if (message.length > MAX_CHARS) {
      showToast('Il messaggio supera il limite di 2.000 caratteri.');
      return;
    }
    if (!apiBase) {
      showToast('Endpoint API non configurato.');
      return;
    }

    createMessage('user', message);
    input.value = '';
    updateComposer();
    busy = true;
    sendButton.disabled = true;
    sendButton.classList.add('is-busy');
    const reply = addTypingMessage();

    try {
      const response = await fetch(`${apiBase}/api/v1/public/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        body: JSON.stringify({ message, taskType: byId('task-type').value })
      });
      let data = {};
      try { data = await response.json(); } catch (_) { /* il gateway potrebbe rispondere senza JSON */ }
      if (!response.ok) {
        if (response.status === 429) {
          const retry = response.headers.get('Retry-After');
          throw new Error(data.error || `Limite temporaneo raggiunto.${retry ? ` Riprova tra ${retry} secondi.` : ''}`);
        }
        throw new Error(data.error || `Richiesta non completata (${response.status}).`);
      }
      reply.body.textContent = data.reply || 'Non ho ricevuto una risposta utilizzabile.';
      const usage = data.usage?.total_tokens ? ` · ${data.usage.total_tokens} token` : '';
      const model = data.model ? `ZDOS AI · ${data.model}${usage}` : 'ZDOS AI';
      const detail = document.createElement('div');
      detail.className = 'message-meta';
      detail.textContent = model;
      reply.content.append(detail);
      setConnection(true, 'API online');
    } catch (error) {
      reply.body.textContent = error.message || 'Non riesco a raggiungere il servizio in questo momento.';
      reply.body.classList.add('message-error');
      if (error instanceof TypeError) setConnection(false, 'API non raggiungibile');
      showToast(error.message || 'Si è verificato un errore di connessione.');
    } finally {
      busy = false;
      sendButton.classList.remove('is-busy');
      updateComposer();
      input.focus();
      scrollToBottom();
    }
  }

  function clearConversation() {
    if (busy) return;
    messages.replaceChildren();
    welcome.classList.remove('is-hidden');
    thread.classList.remove('has-messages');
    input.value = '';
    updateComposer();
    input.focus();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitMessage(input.value);
  });

  input.addEventListener('input', updateComposer);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!sendButton.disabled) form.requestSubmit();
    }
  });

  document.querySelectorAll('[data-prompt]').forEach((button) => {
    button.addEventListener('click', () => submitMessage(button.dataset.prompt));
  });
  byId('new-chat').addEventListener('click', clearConversation);
  byId('clear-chat').addEventListener('click', clearConversation);

  updateComposer();
  checkHealth();
  window.setInterval(checkHealth, 60000);
})();
