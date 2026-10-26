const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { WebSocketServer } = require('ws');
require('dotenv').config();

const aiGateway = require('./core/ai-gateway');
const agentExecutor = require('./core/agent-executor');
const openClawBridge = require('./core/openclaw-bridge');
const zlangRunner = require('./zlang/zlang-runner');
const zclipperEngine = require('./zclipper/zclipper-engine');
const securityEngine = require('./security/security-engine');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// CORS aperto per tutte le interfacce ufficiali (GitHub Pages, x-zdos.it, locale)
app.use(cors({
  origin: ['https://high-cde.github.io', 'https://x-zdos.it', 'http://localhost:3000', 'http://5.189.180.13:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Serviamo sia i file statici della cartella public che la root
app.use(express.static(path.join(__dirname, '../../')));
app.use(express.static(path.join(__dirname, '../../public')));

const DSN_TOKEN = process.env.DSN_CONTRACT_ADDRESS || "0xfc90516a1f736FaC557e09D8853dB80dA192c296";

// Health Check Globale
app.get('/health', (req, res) => {
  res.json({
    status: "active",
    system: "ZDOS-K.I.R.A Sovereign Super AI OS (Full Throttle)",
    engine: "Fly Brain ReAct, zLLM & OpenClaw ZAI",
    token: DSN_TOKEN,
    timestamp: new Date().toISOString()
  });
});

// Task Dispatcher (Agenti Autonomi ReAct)
app.post('/api/v1/tasks/dispatch', async (req, res) => {
  const { taskType, prompt, tier, dsnFee } = req.body;
  const budget = zclipperEngine.allocateTaskBudget(taskType || "default", dsnFee || 50);
  const executionResult = await agentExecutor.runAutonomousTask(taskType, prompt, dsnFee);

  res.json({
    success: true,
    budget,
    execution: executionResult,
    allocatedToken: DSN_TOKEN
  });
});

// zLLM & OpenClaw Neural Gateway
app.post('/api/v1/zllm/generate', async (req, res) => {
  const { prompt, tier } = req.body;
  const result = await openClawBridge.executeZLLMAction(prompt, tier || "primary");
  res.json({
    success: true,
    result
  });
});

// Cybersecurity & Penetration Suite
app.post('/api/v1/security/audit', async (req, res) => {
  const { target, toolType } = req.body;
  const auditResult = await securityEngine.runAudit(target || "localhost", toolType || "port-scan");
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    auditResult
  });
});

// WebSocket Live Telemetry
wss.on('connection', (ws) => {
  console.log('[ZDOS-WS] Connessione telemetrica stabilita.');
  ws.send(JSON.stringify({ event: 'CONNECTED', message: 'ZDOS-K.I.R.A Secure Telemetry stream active.' }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[ZDOS-K.I.R.A] Super Ecosystem attivo e sincronizzato sulla porta ${PORT}`);
});
