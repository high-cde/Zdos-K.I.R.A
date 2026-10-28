const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const os = require('os');
require('dotenv').config();
const aiGateway = require('./core/ai-gateway');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const adminPassword = process.env.ADMIN_PASSWORD || '';
const sessionSecret = process.env.SESSION_SECRET || '';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://high-cde.github.io')
  .split(',').map((value) => value.trim()).filter(Boolean);

if (adminPassword.length < 16 || sessionSecret.length < 32) {
  throw new Error('Configure ADMIN_PASSWORD (16+ chars) and SESSION_SECRET (32+ chars) before starting the API.');
}
if (isProduction && !process.env.LLM_API_KEY) throw new Error('Production configuration requires LLM_API_KEY.');
if (allowedOrigins.includes('*')) throw new Error('Wildcard CORS origins are not allowed.');

app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store');
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
}));
app.use(express.json({ limit: '16kb', strict: true }));

const loginAttempts = new Map();
const apiAttempts = new Map();
const activeSessions = new Map();
function limiter(store, { limit, windowMs, message }) {
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let state = store.get(key);
    if (!state || now - state.started > windowMs) state = { started: now, count: 0 };
    state.count += 1;
    store.set(key, state);
    if (store.size > 5000) {
      for (const [storedKey, value] of store) if (now - value.started > windowMs) store.delete(storedKey);
    }
    if (state.count > limit) return res.status(429).json({ error: message });
    next();
  };
}
const loginLimiter = limiter(loginAttempts, { limit: 8, windowMs: 10 * 60 * 1000, message: 'Troppi tentativi. Riprova tra qualche minuto.' });
const aiLimiter = limiter(apiAttempts, { limit: 20, windowMs: 60 * 60 * 1000, message: 'Limite temporaneo di richieste raggiunto.' });

function encode(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function sign(payload) {
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const body = encode(payload);
  const content = `${header}.${body}`;
  const signature = crypto.createHmac('sha256', sessionSecret).update(content).digest('base64url');
  return `${content}.${signature}`;
}
function isValidToken(token) {
  if (typeof token !== 'string' || token.length > 2048) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const content = `${parts[0]}.${parts[1]}`;
  const expected = crypto.createHmac('sha256', sessionSecret).update(content).digest();
  let actual;
  try { actual = Buffer.from(parts[2], 'base64url'); } catch (_) { return false; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return false;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const now = Math.floor(Date.now() / 1000);
    const digest = crypto.createHash('sha256').update(token).digest('hex');
    const activeUntil = activeSessions.get(digest);
    if (!activeUntil || activeUntil <= now) { activeSessions.delete(digest); return false; }
    return header.alg === 'HS256' && payload.sub === 'admin' && Number(payload.exp) > now;
  } catch (_) { return false; }
}
function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match || !isValidToken(match[1])) return res.status(401).json({ error: 'Sessione non valida o scaduta.' });
  req.authToken = match[1];
  next();
}
function passwordMatches(candidate) {
  if (typeof candidate !== 'string' || !adminPassword) return false;
  const expected = crypto.createHash('sha256').update(adminPassword).digest();
  const provided = crypto.createHash('sha256').update(candidate).digest();
  return crypto.timingSafeEqual(expected, provided);
}

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.post('/api/v1/auth/login', loginLimiter, (req, res) => {
  const password = req.body?.password;
  if (!passwordMatches(password)) return res.status(401).json({ error: 'Password non valida.' });
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 60 * 60;
  const token = sign({ sub: 'admin', iat: now, exp: expiresAt });
  activeSessions.set(crypto.createHash('sha256').update(token).digest('hex'), expiresAt);
  if (activeSessions.size > 1000) {
    for (const [digest, expiration] of activeSessions) if (expiration <= now) activeSessions.delete(digest);
  }
  return res.json({ token, expiresIn: 3600 });
});
app.get('/api/v1/auth/session', requireAuth, (req, res) => res.json({ authenticated: true }));
app.post('/api/v1/auth/logout', requireAuth, (req, res) => {
  const digest = crypto.createHash('sha256').update(req.authToken).digest('hex');
  activeSessions.delete(digest);
  res.status(204).end();
});
app.get('/api/v1/znode/pulse', requireAuth, (req, res) => {
  res.json({ success: true, telemetry: {
    nodeStatus: 'active', uptime: os.uptime(), freeMemory: os.freemem(), totalMemory: os.totalmem(),
    cpuLoad: os.loadavg(), timestamp: new Date().toISOString()
  } });
});
app.post('/api/v1/tasks/dispatch', requireAuth, aiLimiter, async (req, res, next) => {
  const { taskType, prompt } = req.body || {};
  const allowedTasks = new Set(['assistant', 'writing', 'coding']);
  if (!allowedTasks.has(taskType)) return res.status(400).json({ error: 'Modalità non supportata.' });
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 5000) {
    return res.status(400).json({ error: 'Il prompt deve contenere da 1 a 5.000 caratteri.' });
  }
  try {
    const result = await aiGateway.dispatchPrompt(prompt.trim(), taskType);
    return res.json({ success: true, execution: { taskId: crypto.randomUUID(), result: result.output, model: result.model, usage: result.usage } });
  } catch (error) { return next(error); }
});
app.post('/api/v1/zllm/generate', requireAuth, aiLimiter, async (req, res, next) => {
  const { prompt } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 5000) {
    return res.status(400).json({ error: 'Il prompt deve contenere da 1 a 5.000 caratteri.' });
  }
  try {
    const result = await aiGateway.dispatchPrompt(prompt.trim(), 'assistant');
    return res.json({ success: true, result: { model: result.model, response: result.output, usage: result.usage } });
  } catch (error) { return next(error); }
});

app.use((req, res) => res.status(404).json({ error: 'Endpoint non trovato.' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.message === 'Origin not allowed') return res.status(403).json({ error: 'Origine non autorizzata.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Richiesta troppo grande.' });
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return res.status(504).json({ error: 'Il provider AI non ha risposto in tempo.' });
  if (error.statusCode === 503) return res.status(503).json({ error: 'Il provider AI non è configurato sul server.' });
  console.error('[api] Errore richiesta:', error.message);
  return res.status(502).json({ error: 'Richiesta al provider AI non completata.' });
});

const server = app.listen(PORT, '127.0.0.1', () => console.log(`[KIRA] API in ascolto su 127.0.0.1:${PORT}`));
server.requestTimeout = 60000;
