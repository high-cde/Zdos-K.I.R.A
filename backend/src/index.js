const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { WebSocketServer } = require('ws');
require('dotenv').config();

const aiGateway = require('./core/ai-gateway');
const zlangRunner = require('./zlang/zlang-runner');
const zclipperEngine = require('./zclipper/zclipper-engine');
const securityEngine = require('./security/security-engine');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ⚡ Abilitiamo CORS per consentire l'accesso da GitHub Pages e client esterni
app.use(cors({
  origin: ['https://high-cde.github.io', 'http://localhost:3000', 'http://5.189.180.13:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use(express.static(path.join(__dirname, '../../')));

const DSN_TOKEN = process.env.DSN_CONTRACT_ADDRESS || "0xfc90516a1f736FaC557e09D8853dB80dA192c296";

app.get('/health', (req, res) => {
  res.json({
    status: "active",
    system: "ZDOS-K.I.R.A Fly Brain & Security Grid",
    engine: "ZClipper / Paperclip Autonomous DAO",
    token: DSN_TOKEN,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/v1/tasks/dispatch', async (req, res) => {
  const { taskType, prompt, tier, dsnFee } = req.body;
  const budget = zclipperEngine.allocateTaskBudget(taskType || "default", dsnFee || 10);
  const aiResult = await aiGateway.dispatchPrompt(prompt || "Autonomous execution", tier || "primary");

  res.json({
    success: true,
    taskId: "task_" + Math.random().toString(36).substring(2, 9),
    budget,
    aiResult,
    allocatedToken: DSN_TOKEN
  });
});

app.post('/api/v1/security/audit', async (req, res) => {
  const { target, toolType } = req.body;
  const auditResult = await securityEngine.runAudit(target || "localhost", toolType || "port-scan");
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    auditResult
  });
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ event: 'CONNECTED', message: 'ZDOS-K.I.R.A Security Telemetry stream active.' }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[ZDOS-K.I.R.A] Security Grid & Engines active on port ${PORT} with CORS enabled.`);
});
