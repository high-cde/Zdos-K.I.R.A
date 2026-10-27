const test = require('node:test');
const assert = require('node:assert/strict');
const { AIGateway } = require('../src/core/ai-gateway');

const validEnv = {
  ZLLM_API_KEY: 'test-only-key',
  ZLLM_API_BASE_URL: 'https://llm.example.test/v1',
  ZLLM_MODEL: 'test-model'
};

test('refuses to claim completion when no server-side AI key is configured', async () => {
  const gateway = new AIGateway({ env: {}, fetchImpl: async () => { throw new Error('must not call network'); } });
  assert.deepEqual(gateway.getStatus().configured, false);
  await assert.rejects(gateway.dispatchPrompt('Ciao'), (error) => {
    assert.equal(error.code, 'ai_not_configured');
    assert.equal(error.statusCode, 503);
    return true;
  });
});

test('sends the prompt to an OpenAI-compatible provider and returns its real response', async () => {
  let captured;
  const gateway = new AIGateway({
    env: validEnv,
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        status: 200,
        json: async () => ({ model: 'test-model', choices: [{ message: { content: 'Risposta dal provider.' } }] })
      };
    }
  });

  const result = await gateway.dispatchPrompt('  Spiega ZDOS  ');
  assert.equal(captured.url, 'https://llm.example.test/v1/chat/completions');
  assert.equal(captured.options.headers.Authorization, 'Bearer test-only-key');
  assert.equal(captured.body.messages[1].content, 'Spiega ZDOS');
  assert.equal(result.response, 'Risposta dal provider.');
  assert.equal(result.status, 'completed');
});

test('rejects invalid prompt and non-HTTPS remote provider configuration', async () => {
  const gateway = new AIGateway({ env: { ...validEnv, ZLLM_API_BASE_URL: 'http://llm.example.test/v1' } });
  await assert.rejects(gateway.dispatchPrompt(''), (error) => error.code === 'invalid_prompt');
  await assert.rejects(gateway.dispatchPrompt('Ciao'), (error) => error.code === 'invalid_ai_configuration');
});

test('limits prompts to 8000 characters', async () => {
  const gateway = new AIGateway({ env: validEnv, fetchImpl: async () => { throw new Error('must not call network'); } });
  await assert.rejects(gateway.dispatchPrompt('x'.repeat(8001)), (error) => error.code === 'prompt_too_long');
});
