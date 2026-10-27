const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { WebSocketServer } = require('ws');
require('dotenv').config();

const aiGateway = require('./core/ai-gateway');
const agentExecutor = require('./core/agent-executor');
const kiraDaemon = require('./core/kira-daemon');
const znodeBridge = require('./znode/znode-bridge');
const zlangRunner = require('./zlang/zlang-runner');
const zclipperEngine = require('./zclipper/zclipper-engine');
const securityEngine = require('./security/security-engine');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors({
  origin: ['https://high-cde.github.io', 'https://x-zdos.it', 'http://localhost:3000', 'http://5.189.180.13:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(__dirname, '../../')));
app.use(express.static(path.join(__dirname, '../../public')));

const DSN_TOKEN = process.env.DSN_CONTRACT_ADDRESS || "0xfc90516a1f736FaC557e09D8853dB80dA192c296";

app.get('/health', (req, res) => {
  res.json({
    status: "active",
    system: "ZDOS-K.I.R.A Sovereign Super AI OS (Master Evolution)",
    engine: "Fly Brain, zLLM, zBAG, ZLang & ZNode Mobile Pulse",
    inferenceConfigured: aiGateway.getStatus().configured,
    llm: aiGateway.getStatus(),
    token: DSN_TOKEN,
    timestamp: new Date().toISOString()
  });
});

// Endpoint per la telemetria mobile Termux (ZNode)
app.get('/api/v1/znode/pulse', (req, res) => {
  res.json({
    success: true,
    telemetry: znodeBridge.getMobileTelemetry()
  });
});

app.post('/api/v1/tasks/dispatch', async (req, res) => {
  const { taskType, prompt, tier, dsnFee } = req.body;
  const executionResult = await agentExecutor.runAutonomousTask(taskType, prompt, dsnFee);
  res.json({ success: true, execution: executionResult, allocatedToken: DSN_TOKEN });
});

const kiraRateLimits = new Map();
app.use('/api/v1/zllm/generate', (req, res, next) => {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const current = kiraRateLimits.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    kiraRateLimits.set(key, { startedAt: now, count: 1 });
    return next();
  }
  if (current.count >= 10) {
    res.set('Retry-After', '60');
    return res.status(429).json({ success: false, error: 'rate_limited', message: 'Limite temporaneo raggiunto. Riprova tra un minuto.' });
  }
  current.count += 1;
  return next();
});

app.post('/api/v1/zllm/generate', async (req, res) => {
  const { prompt, tier } = req.body || {};
  try {
    const result = await aiGateway.dispatchPrompt(prompt, tier === 'secondary' ? 'secondary' : 'primary');
    res.json({ success: true, result });
  } catch (error) {
    if (!error.statusCode) console.error('[zLLM] Errore imprevisto del gateway AI.');
    res.status(error.statusCode || 502).json({
      success: false,
      error: error.code || 'ai_error',
      message: error.statusCode ? error.message : 'Errore interno del gateway AI.'
    });
  }
});

app.post('/api/v1/security/audit', async (req, res) => {
  const { target, toolType } = req.body;
  const auditResult = await securityEngine.runAudit(target || "localhost", toolType || "port-scan");
  res.json({ success: true, timestamp: new Date().toISOString(), auditResult });
});

wss.on('connection', (ws) => {
  console.log('[ZDOS-WS] Connessione telemetrica stabilita.');
  ws.send(JSON.stringify({ event: 'CONNECTED', message: 'ZDOS-K.I.R.A Secure Telemetry stream active.' }));
});

const PORT = process.env.PORT || 3000;

// Avviamo il nucleo vitale autonomo di K.I.R.A.
kiraDaemon.start();

server.listen(PORT, () => {
  console.log(`[ZDOS-K.I.R.A] Master System & ZNode Mobile Bridge attivo sulla porta ${PORT}`);
});
