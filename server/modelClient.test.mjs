import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ModelClientError,
  createModelClient,
  parseDraftContent,
} from './modelClient.mjs';

const validDraft = {
  answers: [
    {
      questionId: 'q1',
      suggestedAnswer: 'A concise answer.',
      supportingParagraphs: ['1', '2'],
      confidence: 0.8,
    },
  ],
  warnings: [],
};

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

test('posts an OpenAI-compatible request using configured model settings', async () => {
  const requests = [];
  const client = createModelClient({
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return jsonResponse({
        choices: [{ message: { content: JSON.stringify(validDraft) } }],
      });
    },
    env: {
      MODEL_BASE_URL: 'https://model.example/v1/',
      MODEL_ALLOWED_HOSTS: 'model.example',
      MODEL_API_KEY: 'top-secret',
      STUDY_MODEL: 'example/model',
      STUDY_MAX_TOKENS: '321',
    },
  });

  const result = await client.generate({ questionId: 'q1', questionText: 'Why?', paragraphs: ['Because.'] });

  assert.deepEqual(result, validDraft);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://model.example/v1/chat/completions');
  assert.equal(requests[0].init.method, 'POST');
  assert.equal(requests[0].init.headers.authorization, 'Bearer top-secret');
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    model: 'example/model',
    messages: [
      {
        role: 'system',
        content: requests[0].init.body && JSON.parse(requests[0].init.body).messages[0].content,
      },
      {
        role: 'user',
        content: JSON.stringify({ questionId: 'q1', questionText: 'Why?', paragraphs: ['Because.'] }),
      },
    ],
    max_tokens: 321,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });
});

test('uses the required default model and allows a per-call max token override', async () => {
  let payload;
  const client = createModelClient({
    fetchImpl: async (_url, init) => {
      payload = JSON.parse(init.body);
      return jsonResponse({ choices: [{ message: { content: JSON.stringify(validDraft) } }] });
    },
    env: {
      MODEL_BASE_URL: 'https://model.example/v1',
      MODEL_ALLOWED_HOSTS: 'model.example',
      MODEL_API_KEY: 'key',
    },
  });

  await client.generate({ questionId: 'q1' }, { maxTokens: 16 });
  assert.equal(payload.model, 'openai/gpt-5.6-terra');
  assert.equal(payload.max_tokens, 16);
});

test('uses OPENROUTER_API_KEY without requiring a duplicate secret variable', async () => {
  let authorization;
  const client = createModelClient({
    fetchImpl: async (_url, init) => {
      authorization = init.headers.authorization;
      return jsonResponse({ choices: [{ message: { content: JSON.stringify(validDraft) } }] });
    },
    env: {
      MODEL_BASE_URL: 'https://openrouter.ai/api/v1',
      OPENROUTER_API_KEY: 'openrouter-secret',
    },
  });

  await client.generate({ questionId: 'q1' });
  assert.equal(authorization, 'Bearer openrouter-secret');
});

test('parses plain strict JSON and one json fence only', () => {
  assert.deepEqual(parseDraftContent(JSON.stringify(validDraft)), validDraft);
  assert.deepEqual(
    parseDraftContent(`\`\`\`json\n${JSON.stringify(validDraft)}\n\`\`\``),
    validDraft,
  );

  for (const content of [
    `Draft: ${JSON.stringify(validDraft)}`,
    `\`\`\`\n${JSON.stringify(validDraft)}\n\`\`\``,
    `\`\`\`json\n${JSON.stringify(validDraft)}\n\`\`\` trailing`,
    '{"answers":[],"warnings":"none"}',
    '{"answers":[{"questionId":"q","suggestedAnswer":"a","supportingParagraphs":[],"confidence":2}],"warnings":[]}',
  ]) {
    assert.throws(() => parseDraftContent(content), ModelClientError);
  }
});

test('rejects model endpoints outside the configured HTTPS allowlist', async () => {
  for (const baseUrl of [
    'http://openrouter.ai/api/v1',
    'https://user:password@openrouter.ai/api/v1',
    'https://attacker.example/api/v1',
  ]) {
    const client = createModelClient({
      fetchImpl: async () => assert.fail('provider must not be called'),
      env: { MODEL_BASE_URL: baseUrl, MODEL_API_KEY: 'key' },
    });
    await assert.rejects(
      client.generate({ questionId: 'q1' }),
      (error) => error instanceof ModelClientError && error.code === 'MODEL_CONFIG_ERROR',
    );
  }
});

test('rejects oversized or semantically unrelated model answers', async () => {
  for (const draft of [
    { ...validDraft, answers: Array.from({ length: 9 }, () => validDraft.answers[0]) },
    { ...validDraft, answers: [{ ...validDraft.answers[0], suggestedAnswer: 'x'.repeat(2_001) }] },
    { ...validDraft, answers: [{ ...validDraft.answers[0], questionId: 'another-question' }] },
  ]) {
    const client = createModelClient({
      fetchImpl: async () => jsonResponse({ choices: [{ message: { content: JSON.stringify(draft) } }] }),
      env: {
        MODEL_BASE_URL: 'https://openrouter.ai/api/v1',
        MODEL_API_KEY: 'key',
      },
    });
    await assert.rejects(client.generate({ questionId: 'q1' }), ModelClientError);
  }
});

test('reports provider failures without leaking the API key', async () => {
  const secret = 'never-print-this-key';
  const client = createModelClient({
    fetchImpl: async () => new Response(`upstream rejected ${secret}`, { status: 502 }),
    env: {
      MODEL_BASE_URL: 'https://model.example/v1',
      MODEL_ALLOWED_HOSTS: 'model.example',
      MODEL_API_KEY: secret,
    },
  });

  await assert.rejects(
    client.generate({ questionId: 'q1' }),
    (error) =>
      error instanceof ModelClientError &&
      error.code === 'MODEL_PROVIDER_ERROR' &&
      !error.message.includes(secret),
  );
});
