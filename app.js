(() => {
  'use strict';
  const cfg = window.KIRA_CONFIG || {};
  const apiBase = String(cfg.apiBase || '').trim().replace(/\/$/, '');
  const byId = (id) => document.getElementById(id);
  const loginPanel = byId('login-panel');
  const dashboard = byId('dashboard');
  const connectionDot = byId('connection-dot');
  const connectionLabel = byId('connection-label');
  let token = sessionStorage.getItem('kira.session') || '';
  let toastTimer;

  function endpoint(path) { return `${apiBase}${path}`; }
  function setConnection(online, text) {
    connectionDot.className = `status-dot ${online ? 'online' : 'offline'}`;
    connectionLabel.textContent = text;
  }
  function toast(message) {
    const el = byId('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
  }
  async function request(path, options = {}, authenticated = true) {
    const headers = new Headers(options.headers || {});
    if (options.body) headers.set('Content-Type', 'application/json');
    if (authenticated && token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(endpoint(path), { ...options, headers, cache: 'no-store' });
    let data = {};
    try { data = await response.json(); } catch (_) { /* server may return an empty error */ }
    if (response.status === 401 && authenticated) {
      logout(false);
      throw new Error('Sessione scaduta. Accedi di nuovo.');
    }
    if (!response.ok) throw new Error(data.error || `Richiesta non riuscita (${response.status}).`);
    return data;
  }
  function showLogin(message = '') {
    loginPanel.classList.remove('hidden');
    dashboard.classList.add('hidden');
    byId('login-error').textContent = message;
  }
  function showDashboard() {
    loginPanel.classList.add('hidden');
    dashboard.classList.remove('hidden');
    byId('api-url-label').textContent = apiBase || 'Non configurato';
    refreshTelemetry();
  }
  function logout(showMessage = true) {
    const currentToken = token;
    if (currentToken && apiBase) {
      fetch(endpoint('/api/v1/auth/logout'), { method: 'POST', headers: { Authorization: `Bearer ${currentToken}` }, keepalive: true }).catch(() => {});
    }
    token = '';
    sessionStorage.removeItem('kira.session');
    showLogin('');
    if (showMessage) toast('Sessione chiusa.');
  }
  async function checkHealth() {
    if (!apiBase) {
      setConnection(false, 'API da configurare');
      byId('setup-notice').textContent = 'Il frontend è pronto, ma manca l’URL HTTPS del backend. Impostare apiBase in config.js dopo aver pubblicato e protetto l’API sul VPS.';
      byId('setup-notice').classList.remove('hidden');
      byId('login-button').disabled = true;
      return false;
    }
    try {
      const data = await request('/health', {}, false);
      if (data.status !== 'ok') throw new Error('API non pronta');
      setConnection(true, 'API online');
      byId('setup-notice').classList.add('hidden');
      byId('login-button').disabled = false;
      return true;
    } catch (err) {
      setConnection(false, 'API non raggiungibile');
      byId('setup-notice').textContent = `Backend non raggiungibile: ${err.message}`;
      byId('setup-notice').classList.remove('hidden');
      return false;
    }
  }
  function formatDuration(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    const days = Math.floor(value / 86400);
    const hours = Math.floor((value % 86400) / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    return days ? `${days}g ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  }
  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
    return `${Math.round(value / 1024 ** 2)} MB`;
  }
  async function refreshTelemetry() {
    if (!token || !apiBase) return;
    byId('refresh-button').disabled = true;
    try {
      const data = await request('/api/v1/znode/pulse');
      const t = data.telemetry;
      byId('metric-status').textContent = t.nodeStatus === 'active' ? 'Operativo' : 'Inattivo';
      byId('metric-uptime').textContent = formatDuration(t.uptime);
      byId('metric-memory').textContent = formatBytes(t.freeMemory);
      byId('metric-memory-total').textContent = `su ${formatBytes(t.totalMemory)} totali`;
      const loads = Array.isArray(t.cpuLoad) ? t.cpuLoad.slice(0, 3).map((x) => Number(x).toFixed(2)).join(' / ') : '—';
      byId('metric-cpu').textContent = loads;
      byId('last-updated').textContent = `Aggiornato: ${new Date(t.timestamp).toLocaleTimeString('it-IT')}`;
    } catch (err) {
      toast(err.message);
    } finally {
      byId('refresh-button').disabled = false;
    }
  }

  byId('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    byId('login-error').textContent = '';
    if (!await checkHealth()) return;
    const button = byId('login-button');
    button.disabled = true;
    button.textContent = 'Verifica…';
    try {
      const data = await request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ password: byId('password').value }) }, false);
      token = data.token;
      sessionStorage.setItem('kira.session', token);
      byId('password').value = '';
      setConnection(true, 'API online · sessione attiva');
      showDashboard();
    } catch (err) {
      byId('login-error').textContent = err.message;
    } finally {
      button.disabled = false;
      button.innerHTML = 'Accedi <span aria-hidden="true">→</span>';
    }
  });
  byId('logout-button').addEventListener('click', () => logout());
  byId('refresh-button').addEventListener('click', refreshTelemetry);
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => openView(button.dataset.view)));
  document.querySelectorAll('[data-open]').forEach((button) => button.addEventListener('click', () => openView(button.dataset.open)));
  function openView(name) {
    document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${name}`));
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.view === name));
  }
  byId('prompt-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    byId('prompt-error').textContent = '';
    const prompt = byId('prompt').value.trim();
    if (!prompt) { byId('prompt-error').textContent = 'Inserisci un prompt.'; return; }
    const button = byId('send-button');
    const state = byId('response-state');
    button.disabled = true;
    button.textContent = 'Elaborazione…';
    state.textContent = 'IN ELABORAZIONE';
    state.className = 'response-state busy';
    byId('response-title').textContent = 'Il modello sta elaborando';
    byId('response-output').textContent = 'Attendi la risposta del provider AI configurato sul server…';
    byId('response-meta').textContent = '';
    try {
      const data = await request('/api/v1/tasks/dispatch', { method: 'POST', body: JSON.stringify({ taskType: byId('task-type').value, prompt }) });
      byId('response-title').textContent = 'Risposta completata';
      byId('response-output').textContent = data.execution.result;
      const usage = data.execution.usage;
      byId('response-meta').textContent = `Modello: ${data.execution.model}${usage?.total_tokens ? ` · Token: ${usage.total_tokens}` : ''}`;
      state.textContent = 'COMPLETATA';
      state.className = 'response-state done';
    } catch (err) {
      byId('response-title').textContent = 'Richiesta non completata';
      byId('response-output').textContent = err.message;
      state.textContent = 'ERRORE';
      state.className = 'response-state';
    } finally {
      button.disabled = false;
      button.innerHTML = 'Invia richiesta <span aria-hidden="true">↑</span>';
    }
  });

  checkHealth().then(async (online) => {
    if (!online || !token) return;
    try {
      await request('/api/v1/auth/session');
      setConnection(true, 'API online · sessione attiva');
      showDashboard();
    } catch (_) { logout(false); }
  });
  window.setInterval(() => { if (token && !dashboard.classList.contains('hidden')) refreshTelemetry(); }, 30000);
})();
