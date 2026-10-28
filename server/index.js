const crypto = require('crypto');
const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const DSN_CONTRACT = process.env.DSN_CONTRACT_ADDRESS || '0xfc90516a1f736FaC557e09D8853dB80dA192c296';
const sessions = new Map();
const attempts = new Map();
let modelCache = { expiresAt: 0, models: [] };

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  req.requestId = crypto.randomBytes(6).toString('hex');
  res.setHeader('X-Request-Id', req.requestId);
  next();
});
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' https:; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'self' https://*.manus.computer");
  next();
});
app.use(express.json({ limit: '64kb' }));

const allowedOrigins = new Set(
  (process.env.KIRA_ALLOWED_ORIGINS || 'https://high-cde.github.io')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.has(origin) || /^https:\/\/[a-z0-9-]+\.github\.io$/i.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function error(res, status, code, message, requestId) {
  return res.status(status).json({ ok: false, error: { code, message, requestId } });
}

function providerError(res, req, code, internalError, message) {
  console.error(`[${req.requestId}] ${code}: ${internalError?.message || internalError}`);
  return error(res, 503, code, message, req.requestId);
}

function cleanText(value, max = 4000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.expiresAt <= now) {
    attempts.set(key, { count: 1, expiresAt: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

function passwordMatches(candidate) {
  const configured = process.env.KIRA_ADMIN_PASSWORD || '';
  if (!configured || !candidate) return false;
  const left = Buffer.from(candidate);
  const right = Buffer.from(configured);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function issueSession() {
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, { createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function getToken(req) {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

function requireAuth(req, res, next) {
  const token = getToken(req);
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return error(res, 401, 'AUTH_REQUIRED', 'Sessione richiesta o scaduta.');
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  req.sessionToken = token;
  next();
}

function platformConfigured() {
  return Boolean(process.env.MANUS_API_URL && process.env.MANUS_API_KEY);
}

async function fetchJson(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.error) {
      const message = body?.error?.message || body?.message || `Provider HTTP ${response.status}`;
      throw new Error(message);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function availableModels() {
  if (!platformConfigured()) return [];
  if (modelCache.expiresAt > Date.now()) return modelCache.models;
  const body = await fetchJson(`${process.env.MANUS_API_URL.replace(/\/$/, '')}/v1/models`, {
    headers: { Authorization: `Bearer ${process.env.MANUS_API_KEY}` }
  });
  const models = Array.isArray(body.data) ? body.data.filter((model) => model && typeof model.id === 'string') : [];
  modelCache = { models, expiresAt: Date.now() + 5 * 60 * 1000 };
  return models;
}

async function selectedModel() {
  const models = await availableModels();
  const requested = cleanText(process.env.KIRA_MODEL, 120);
  if (requested) {
    if (!models.length || models.some((model) => model.id === requested)) return requested;
    throw new Error('KIRA_MODEL non è disponibile nel catalogo AI del progetto.');
  }
  if (!models.length) throw new Error('Nessun modello AI disponibile nel servizio Manus.');
  const preferred = models.find((model) => /gpt-5|claude|gemini/i.test(model.id));
  return (preferred || models[0]).id;
}

async function callKira(messages) {
  if (!platformConfigured()) throw new Error('Servizio AI non configurato nel backend.');
  const model = await selectedModel();
  const body = await fetchJson(`${process.env.MANUS_API_URL.replace(/\/$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MANUS_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model, messages })
  });
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('Il modello AI non ha restituito testo.');
  return { model, text: content.trim() };
}

const kiraSystem = `Sei K.I.R.A., un’assistente AI conversazionale e copilota di ZDOS-K.I.R.A. Rispondi in italiano salvo che l’utente preferisca un’altra lingua. Usa un tono naturale, cordiale e diretto; ascolta davvero la richiesta, tieni conto dei messaggi precedenti e adatta il livello di dettaglio. Dai risposte utili e concrete invece di formule generiche. Se la richiesta è ambigua, fai una domanda di chiarimento alla volta; se non conosci una risposta o ti mancano dati, dichiaralo chiaramente. Non fingere di aver eseguito comandi, scansioni, transazioni, ricerche o accessi a sistemi. Per le attività tecniche proponi azioni difensive, reversibili e autorizzate; se un’azione è rischiosa, spiega il limite e suggerisci un’alternativa sicura.`;

app.get('/health', (req, res) => {
  res.json({
    status: 'active',
    system: 'ZDOS-K.I.R.A. Online',
    engine: 'Fly Brain / Server-side AI gateway',
    authRequired: true,
    aiConfigured: platformConfigured(),
    token: DSN_CONTRACT,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || 'unknown';
  if (!rateLimit(`login:${ip}`, 8, 15 * 60 * 1000)) return error(res, 429, 'RATE_LIMITED', 'Troppi tentativi. Riprova più tardi.');
  if (!process.env.KIRA_ADMIN_PASSWORD) return error(res, 503, 'AUTH_NOT_CONFIGURED', 'Imposta KIRA_ADMIN_PASSWORD nelle variabili protette del progetto.');
  const password = cleanText(req.body?.password, 256);
  if (!passwordMatches(password)) return error(res, 401, 'INVALID_CREDENTIALS', 'Credenziali non valide.');
  const token = issueSession();
  res.json({ ok: true, token, expiresIn: SESSION_TTL_MS });
});

app.use('/api', (req, res, next) => {
  if (req.path === '/auth/login') return next();
  return requireAuth(req, res, next);
});

app.post('/api/auth/logout', (req, res) => {
  sessions.delete(req.sessionToken);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ ok: true, role: 'admin', sessionExpiresAt: sessions.get(req.sessionToken).expiresAt });
});

app.get('/api/v1/overview', (req, res) => {
  const memory = process.memoryUsage();
  res.json({
    ok: true,
    system: 'ZDOS-K.I.R.A. Online',
    status: 'operational',
    ai: { configured: platformConfigured(), gateway: 'Manus server-side', modelHint: process.env.KIRA_MODEL || 'catalog-auto' },
    architecture: ['Fly Brain orchestrator', 'ZClipper policy layer', 'ZLang safe compiler', 'ZNode telemetry'],
    token: { symbol: 'DSN', contract: DSN_CONTRACT, utility: 'compute_fuel_and_governance' },
    process: { uptime: Math.round(process.uptime()), heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(1)) },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/znode/pulse', (req, res) => {
  const memory = process.memoryUsage();
  res.json({
    ok: true,
    telemetry: {
      nodeStatus: 'active',
      system: 'ZDOS-K.I.R.A Mobile Pulse Gateway',
      uptime: Math.round(process.uptime()),
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      cpuLoad: typeof process.cpuUsage === 'function' ? process.cpuUsage() : null,
      timestamp: new Date().toISOString()
    }
  });
});

app.get('/api/v1/ai/models', async (req, res) => {
  try {
    const models = await availableModels();
    res.json({ ok: true, selected: process.env.KIRA_MODEL || (models[0]?.id ?? null), models: models.map((model) => model.id) });
  } catch (err) {
    providerError(res, req, 'AI_UNAVAILABLE', err, 'Catalogo AI non disponibile.');
  }
});

app.post('/api/v1/ai/chat', async (req, res) => {
  const prompt = cleanText(req.body?.prompt, 6000);
  if (!prompt) return error(res, 400, 'PROMPT_REQUIRED', 'Scrivi una richiesta prima di avviare K.I.R.A.');
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8).map((item) => ({
    role: item?.role === 'assistant' ? 'assistant' : 'user',
    content: cleanText(item?.content, 2400)
  })).filter((item) => item.content) : [];
  try {
    const result = await callKira([{ role: 'system', content: kiraSystem }, ...history, { role: 'user', content: prompt }]);
    res.json({ ok: true, model: result.model, response: result.text, timestamp: new Date().toISOString() });
  } catch (err) {
    providerError(res, req, 'AI_UNAVAILABLE', err, 'Servizio AI non disponibile.');
  }
});

app.post('/api/v1/tasks/dispatch', async (req, res) => {
  const taskType = cleanText(req.body?.taskType, 80) || 'technical-review';
  const prompt = cleanText(req.body?.prompt, 5000);
  if (!prompt) return error(res, 400, 'PROMPT_REQUIRED', 'Definisci l’obiettivo del task.');
  const dsnFee = Math.max(0, Math.min(100000, Number(req.body?.dsnFee || 0)));
  try {
    const result = await callKira([
      { role: 'system', content: `${kiraSystem} Sei anche il planner del dispatcher. Restituisci una risposta con: piano in 3 passi, rischi, risultato atteso e prossimo controllo. Non avviare operazioni esterne.` },
      { role: 'user', content: `Tipo task: ${taskType}\nObiettivo: ${prompt}` }
    ]);
    res.json({ ok: true, execution: {
      taskId: `kira_${crypto.randomBytes(5).toString('hex')}`,
      mode: 'server-side-ai-plan',
      steps: [
        { step: 1, action: 'Plan & Analyze', status: 'completed' },
        { step: 2, action: 'Safety Gate', status: 'completed', detail: 'Nessun comando o accesso esterno eseguito.' },
        { step: 3, action: 'AI Synthesis', status: 'completed', model: result.model }
      ],
      result: result.text,
      tokensSpent: dsnFee
    }});
  } catch (err) {
    providerError(res, req, 'AI_UNAVAILABLE', err, 'Dispatcher AI non disponibile.');
  }
});

app.post('/api/v1/security/audit', async (req, res) => {
  const target = cleanText(req.body?.target, 256);
  const toolType = cleanText(req.body?.toolType, 80) || 'defensive-review';
  if (!target) return error(res, 400, 'TARGET_REQUIRED', 'Indica un asset o un contratto da esaminare.');
  const suspicious = /[\s;|&`$<>]/.test(target);
  const result = {
    tool: 'ZDOS Defensive Posture Review',
    mode: 'non-destructive',
    target,
    requestedTool: toolType,
    status: suspicious ? 'blocked-for-review' : 'completed',
    findings: suspicious ? ['Target contiene caratteri non ammessi e non viene contattato.'] : [
      'Nessuna connessione attiva al target è stata eseguita.',
      'Verificare autorizzazione, aggiornamenti, autenticazione forte e logging sul perimetro reale.',
      'Per una scansione autorizzata usare uno strumento dedicato con scope e approvazione espliciti.'
    ],
    riskLevel: suspicious ? 'Review required' : 'Informational',
    timestamp: new Date().toISOString()
  };
  res.json({ ok: true, auditResult: result });
});

app.post('/api/v1/zlang/compile', (req, res) => {
  const source = cleanText(req.body?.source, 6000);
  if (!source) return error(res, 400, 'SOURCE_REQUIRED', 'Inserisci codice ZLang da validare.');
  const forbidden = /child_process|exec\s*\(|spawn\s*\(|process\.|require\s*\(|fetch\s*\(|curl\s|wget\s/i;
  const balanced = (source.match(/\{/g) || []).length === (source.match(/\}/g) || []).length;
  if (forbidden.test(source) || !balanced) {
    return res.json({ ok: true, result: { success: false, compiler: 'ZDOS ZLB2 Safe Runtime', status: 'rejected', output: 'Gate di sicurezza: sorgente non eseguibile o parentesi non bilanciate.' } });
  }
  res.json({ ok: true, result: {
    success: true,
    compiler: 'ZDOS ZLB2 Safe Runtime',
    status: 'validated',
    validatedOnly: true,
    bytecodeGenerated: false,
    output: `Validazione completata in memoria. ${source.split('\n').length} righe analizzate; nessuna esecuzione avviata.`
  }});
});

app.use(express.static(PUBLIC_DIR, { index: 'index.html', maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return error(res, 404, 'NOT_FOUND', 'Endpoint non trovato.');
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) if (session.expiresAt <= now) sessions.delete(token);
  for (const [key, attempt] of attempts) if (attempt.expiresAt <= now) attempts.delete(key);
}, 10 * 60 * 1000).unref();

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ZDOS-K.I.R.A.] online on 0.0.0.0:${PORT}; AI=${platformConfigured() ? 'ready' : 'not-configured'}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
