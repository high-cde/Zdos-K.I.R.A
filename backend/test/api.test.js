const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { spawn } = require('node:child_process');
const path = require('node:path');

const backendDir = path.resolve(__dirname, '..');
const adminPassword = 'kira-test-password-2026';
let serverProcess;
let apiBase;

before(async () => {
  serverProcess = spawn(process.execPath, ['src/index.js'], {
    cwd: backendDir,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: '0',
      ADMIN_PASSWORD: adminPassword,
      SESSION_SECRET: 'a'.repeat(64),
      ALLOWED_ORIGINS: 'http://localhost:8080',
      PUBLIC_CHAT_COOLDOWN_MS: '5000',
      LLM_API_KEY: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error(`Backend non avviato in tempo. ${output}`)), 10000);
    serverProcess.stdout.setEncoding('utf8');
    serverProcess.stderr.setEncoding('utf8');
    serverProcess.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/in ascolto su 127\.0\.0\.1:(\d+)/);
      if (match) {
        apiBase = `http://127.0.0.1:${match[1]}`;
        clearTimeout(timeout);
        resolve();
      }
    });
    serverProcess.stderr.on('data', (chunk) => { output += chunk; });
    serverProcess.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    serverProcess.once('exit', (code, signal) => {
      clearTimeout(timeout);
      reject(new Error(`Backend terminato prima dell'avvio (code=${code}, signal=${signal}). ${output}`));
    });
  });
});

after(async () => {
  if (!serverProcess || serverProcess.exitCode !== null) return;
  serverProcess.kill('SIGTERM');
  await new Promise((resolve) => serverProcess.once('exit', resolve));
});

test('API locale: autenticazione, telemetria, logout e fallback AI', async () => {
  const health = await fetch(`${apiBase}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });

  const publicChat = await fetch(`${apiBase}/api/v1/public/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8080' },
    body: JSON.stringify({ message: 'Ciao K.I.R.A.' })
  });
  assert.equal(publicChat.status, 503);
  assert.equal(publicChat.headers.get('access-control-allow-origin'), 'http://localhost:8080');
  assert.match((await publicChat.json()).error, /non è configurato/i);

  const publicCooldown = await fetch(`${apiBase}/api/v1/public/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8080' },
    body: JSON.stringify({ message: 'Seconda richiesta troppo presto.' })
  });
  assert.equal(publicCooldown.status, 429);
  assert.ok(Number(publicCooldown.headers.get('retry-after')) > 0);

  const privateBeforeLogin = await fetch(`${apiBase}/api/v1/znode/pulse`);
  assert.equal(privateBeforeLogin.status, 401);

  const wrongLogin = await fetch(`${apiBase}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'password-sbagliata' })
  });
  assert.equal(wrongLogin.status, 401);

  const login = await fetch(`${apiBase}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: adminPassword })
  });
  assert.equal(login.status, 200);
  const { token, expiresIn } = await login.json();
  assert.equal(typeof token, 'string');
  assert.equal(expiresIn, 3600);
  const authHeaders = { Authorization: `Bearer ${token}` };

  const session = await fetch(`${apiBase}/api/v1/auth/session`, { headers: authHeaders });
  assert.deepEqual(await session.json(), { authenticated: true });

  const telemetryResponse = await fetch(`${apiBase}/api/v1/znode/pulse`, { headers: authHeaders });
  assert.equal(telemetryResponse.status, 200);
  const telemetry = (await telemetryResponse.json()).telemetry;
  assert.equal(telemetry.nodeStatus, 'active');
  assert.equal(typeof telemetry.uptime, 'number');
  assert.equal(typeof telemetry.freeMemory, 'number');
  assert.ok(Array.isArray(telemetry.cpuLoad));

  const aiResponse = await fetch(`${apiBase}/api/v1/tasks/dispatch`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskType: 'assistant', prompt: 'Rispondi con un saluto.' })
  });
  assert.equal(aiResponse.status, 503);
  assert.match((await aiResponse.json()).error, /non è configurato/i);

  const logout = await fetch(`${apiBase}/api/v1/auth/logout`, { method: 'POST', headers: authHeaders });
  assert.equal(logout.status, 204);
  const revokedSession = await fetch(`${apiBase}/api/v1/auth/session`, { headers: authHeaders });
  assert.equal(revokedSession.status, 401);
});
