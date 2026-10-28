(() => {
  const config = window.ZDOS_CONFIG || {};
  const apiBase = String(config.apiBase || '').replace(/\/$/, '');
  const $ = (id) => document.getElementById(id);
  const tokenKey = 'zdos-kira-session';
  const chatHistoryLimit = 8;
  const welcomeMessage = 'Ciao! Sono K.I.R.A., il tuo copilota AI. Posso aiutarti con un problema tecnico, un’idea o una decisione: raccontami cosa ti serve.';
  let token = sessionStorage.getItem(tokenKey) || '';
  let chatHistory = [];
  let chatBusy = false;
  let toastTimer;

  function toast(message) {
    const node = $('toast');
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('show'), 3800);
  }

  async function api(path, options = {}) {
    const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${apiBase}${path}`, { ...options, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) {
      const message = body?.error?.message || `Errore HTTP ${response.status}`;
      const err = new Error(message);
      err.status = response.status;
      throw err;
    }
    return body;
  }

  function setView(view) {
    document.querySelectorAll('.view').forEach((node) => node.classList.toggle('active', node.id === `view-${view}`));
    document.querySelectorAll('.nav-item').forEach((node) => node.classList.toggle('active', node.dataset.view === view));
    const titles = { overview: 'Panoramica sistema', assistant: 'AI Copilot', dispatcher: 'Task dispatcher', security: 'Audit difensivo', runtime: 'ZLang runtime', token: 'DSN / policy' };
    $('page-title').textContent = titles[view] || 'Control center';
  }

  function formatJson(data) { return JSON.stringify(data, null, 2); }
  function formatTime() { return new Date().toLocaleTimeString('it-IT', { hour12: false }); }
  function setBusy(button, busy, label) { if (!button) return; button.disabled = busy; if (busy) { button.dataset.label = button.textContent; button.textContent = label || 'Elaborazione…'; } else if (button.dataset.label) button.textContent = button.dataset.label; }

  async function checkPublicHealth() {
    try {
      const health = await api('/health');
      $('login-health').textContent = health.aiConfigured ? 'Backend online · AI gateway pronto' : 'Backend online · AI da configurare';
      $('login-health').previousElementSibling.className = `status-dot ${health.aiConfigured ? 'green' : 'amber'}`;
    } catch (err) {
      $('login-health').textContent = apiBase ? 'Backend non raggiungibile' : 'Apri il backend o configura docs/config.js';
    }
  }

  async function loadOverview() {
    try {
      const data = await api('/api/v1/overview');
      $('system-status').textContent = 'ONLINE';
      $('metric-status').textContent = data.status.toUpperCase();
      $('metric-uptime').textContent = `uptime ${data.process.uptime}s`;
      $('metric-ai').textContent = data.ai.configured ? 'READY' : 'OFFLINE';
      $('metric-model').textContent = data.ai.modelHint;
      $('metric-heap').textContent = `${data.process.heapUsedMb} MB`;
      $('contract-address').textContent = data.token.contract;
      $('pulse-summary').textContent = `Nodo attivo · ${new Date(data.timestamp).toLocaleTimeString('it-IT')}`;
      $('event-stream').textContent = `[${formatTime()}] heartbeat accepted\n[${formatTime()}] server boundary: protected\n[${formatTime()}] AI gateway: ${data.ai.configured ? 'ready' : 'not configured'}\n[${formatTime()}] policy gate: human review required`;
      $('last-sync').textContent = `SYNC ${formatTime()}`;
      const pulse = await api('/api/v1/znode/pulse');
      $('pulse-summary').textContent = `Nodo attivo · heap ${Math.round(pulse.telemetry.heapUsed / 1024 / 1024)} MB · ${formatTime()}`;
    } catch (err) {
      if (err.status === 401) return logout(false);
      $('system-status').textContent = 'DEGRADED';
      toast(err.message);
    }
  }

  function renderMessage(role, text) {
    const row = document.createElement('div');
    row.className = `chat-message ${role}`;
    const label = document.createElement('span');
    label.className = 'message-label'; label.textContent = role === 'user' ? 'OPERATOR' : 'K.I.R.A.';
    const p = document.createElement('p'); p.textContent = text;
    row.append(label, p); $('chat-log').appendChild(row); $('chat-log').scrollTop = $('chat-log').scrollHeight;
  }

  function clearChat() {
    if (chatBusy) return;
    chatHistory = [];
    $('chat-log').replaceChildren();
    renderMessage('assistant', welcomeMessage);
    $('chat-status').textContent = 'Nuova conversazione pronta.';
    $('chat-prompt').focus();
  }

  async function login(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    $('login-error').textContent = '';
    setBusy(button, true, 'Verifica…');
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ password: $('password').value }) });
      token = data.token; sessionStorage.setItem(tokenKey, token); form.reset(); $('login-view').classList.add('hidden'); $('app-shell').classList.remove('hidden'); setView('overview'); await loadOverview();
    } catch (err) { $('login-error').textContent = err.message; } finally { setBusy(button, false); }
  }

  function logout(callApi = true) {
    if (callApi && token) api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    token = ''; sessionStorage.removeItem(tokenKey); $('app-shell').classList.add('hidden'); $('login-view').classList.remove('hidden'); checkPublicHealth();
  }

  async function submitChat(event) {
    event.preventDefault();
    const prompt = $('chat-prompt').value.trim(); if (!prompt || chatBusy) return;
    const button = event.currentTarget.querySelector('button');
    const history = chatHistory.slice(-chatHistoryLimit);
    renderMessage('user', prompt);
    $('chat-prompt').value = '';
    chatBusy = true;
    $('chat-status').textContent = 'K.I.R.A. sta elaborando la risposta…';
    $('clear-chat').disabled = true;
    setBusy(button, true, 'K.I.R.A. sta pensando…');
    try {
      const data = await api('/api/v1/ai/chat', { method: 'POST', body: JSON.stringify({ prompt, history }) });
      renderMessage('assistant', data.response);
      chatHistory.push({ role: 'user', content: prompt }, { role: 'assistant', content: data.response });
      chatHistory = chatHistory.slice(-chatHistoryLimit);
      $('chat-status').textContent = data.model ? `Risposta ricevuta · ${data.model}` : 'Risposta ricevuta.';
    } catch (err) {
      renderMessage('assistant', `Non riesco a rispondere in questo momento: ${err.message}. La tua richiesta è stata mantenuta nel campo di testo.`);
      if (!$('chat-prompt').value) $('chat-prompt').value = prompt;
      $('chat-status').textContent = 'Risposta non disponibile. Puoi riprovare.';
      toast(err.message);
    } finally {
      chatBusy = false;
      $('clear-chat').disabled = false;
      setBusy(button, false);
    }
  }

  async function submitTask(event) {
    event.preventDefault(); const button = event.currentTarget.querySelector('button'); $('task-status').textContent = 'RUNNING'; $('task-output').textContent = '[dispatcher] invio al safety gate…'; setBusy(button, true, 'Pianificazione…');
    try { const data = await api('/api/v1/tasks/dispatch', { method: 'POST', body: JSON.stringify({ taskType: $('task-type').value, prompt: $('task-prompt').value, dsnFee: $('dsn-fee').value }) }); $('task-output').textContent = formatJson(data.execution); $('task-status').textContent = 'COMPLETE'; } catch (err) { $('task-output').textContent = `[dispatcher] ERROR\n${err.message}`; $('task-status').textContent = 'ERROR'; toast(err.message); } finally { setBusy(button, false); }
  }

  async function submitAudit(event) {
    event.preventDefault(); const button = event.currentTarget.querySelector('button'); $('audit-status').textContent = 'RUNNING'; $('audit-output').textContent = '[audit] applicazione dei controlli non distruttivi…'; setBusy(button, true, 'Review…');
    try { const data = await api('/api/v1/security/audit', { method: 'POST', body: JSON.stringify({ toolType: $('audit-tool').value, target: $('audit-target').value }) }); $('audit-output').textContent = formatJson(data.auditResult); $('audit-status').textContent = data.auditResult.status.toUpperCase(); } catch (err) { $('audit-output').textContent = `[audit] ERROR\n${err.message}`; $('audit-status').textContent = 'ERROR'; toast(err.message); } finally { setBusy(button, false); }
  }

  async function submitZlang(event) {
    event.preventDefault(); const button = event.currentTarget.querySelector('button'); $('zlang-status').textContent = 'VALIDATING'; setBusy(button, true, 'Validazione…');
    try { const data = await api('/api/v1/zlang/compile', { method: 'POST', body: JSON.stringify({ source: $('zlang-source').value }) }); $('zlang-output').textContent = formatJson(data.result); $('zlang-status').textContent = data.result.status.toUpperCase(); } catch (err) { $('zlang-output').textContent = `[zlang] ERROR\n${err.message}`; $('zlang-status').textContent = 'ERROR'; toast(err.message); } finally { setBusy(button, false); }
  }

  function init() {
    $('login-form').addEventListener('submit', login); $('logout-button').addEventListener('click', () => logout(true)); $('chat-form').addEventListener('submit', submitChat); $('clear-chat').addEventListener('click', clearChat); $('chat-prompt').addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        $('chat-form').requestSubmit();
      }
    }); $('task-form').addEventListener('submit', submitTask); $('audit-form').addEventListener('submit', submitAudit); $('zlang-form').addEventListener('submit', submitZlang); $('refresh-overview').addEventListener('click', loadOverview);
    document.querySelectorAll('[data-view]').forEach((node) => node.addEventListener('click', () => setView(node.dataset.view)));
    document.querySelectorAll('[data-open-view]').forEach((node) => node.addEventListener('click', () => setView(node.dataset.openView)));
    setInterval(() => { $('clock').textContent = formatTime(); }, 1000); $('clock').textContent = formatTime(); checkPublicHealth();
    if (token) { $('login-view').classList.add('hidden'); $('app-shell').classList.remove('hidden'); loadOverview(); }
  }
  init();
})();
