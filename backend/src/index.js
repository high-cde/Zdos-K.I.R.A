const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
require('dotenv').config();

const aiGateway = require('./core/ai-gateway');
const zlangRunner = require('./zlang/zlang-runner');
const zclipperEngine = require('./zclipper/zclipper-engine');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

const DSN_TOKEN = process.env.DSN_CONTRACT_ADDRESS || "0xfc90516a1f736FaC557e09D8853dB80dA192c296";

app.get('/health', (req, res) => {
  res.json({
    status: "active",
    system: "ZDOS-K.I.R.A Fly Brain (Full Throttle)",
    engine: "ZClipper / Paperclip Autonomous DAO",
    token: DSN_TOKEN,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/v1/tasks/dispatch', async (req, res) => {
  const { taskType, prompt, tier, dsnFee } = req.body;
  const budget = zclipperEngine.allocateTaskBudget(taskType, dsnFee || 10);
  const aiResult = await aiGateway.dispatchPrompt(prompt || "Autonomous execution", tier || "primary");

  res.json({
    success: true,
    taskId: "task_" + Math.random().toString(36).substring(2, 9),
    budget,
    aiResult,
    allocatedToken: DSN_TOKEN
  });
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ event: 'CONNECTED', message: 'ZDOS-K.I.R.A Fly Brain telemetry stream active.' }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[ZDOS-K.I.R.A] Engines active on port ${PORT} | $DSN Linked: ${DSN_TOKEN}`);
});
