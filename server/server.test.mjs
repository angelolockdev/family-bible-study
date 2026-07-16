import test from 'node:test';
import assert from 'node:assert/strict';

import { createServer } from './server.mjs';

async function withServer(options, run) {
  const server = createServer(options);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

const requestBody = {
  source: { canonicalUrl: 'https://www.jw.org/en/bible-teachings/' },
  questionId: 'q1',
  questionText: 'What does the paragraph teach?',
  paragraphs: ['It teaches a supported point.'],
  mode: 'manual',
};

async function postJson(baseUrl, body, headers = {}) {
  return fetch(`${baseUrl}/api/study/generate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://angelolockdev.github.io',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('health returns service status and configured-origin CORS only', async () => {
  await withServer({ env: { PUBLIC_ORIGIN: 'https://app.example' } }, async (baseUrl) => {
    const allowed = await fetch(`${baseUrl}/health`, {
      headers: { origin: 'https://app.example' },
    });
    assert.equal(allowed.status, 200);
    assert.deepEqual(await allowed.json(), {
      status: 'ok',
      service: 'family-bible-study-api',
    });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://app.example');
    assert.match(allowed.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);

    const denied = await fetch(`${baseUrl}/health`, {
      headers: { origin: 'https://other.example' },
    });
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  });
});

test('uses the GitHub Pages origin by default and supports preflight', async () => {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/study/generate`, {
      method: 'OPTIONS',
      headers: { origin: 'https://angelolockdev.github.io' },
    });
    assert.equal(response.status, 204);
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'https://angelolockdev.github.io',
    );
    assert.match(response.headers.get('access-control-allow-methods'), /POST/);
  });
});

test('manual mode never calls the model and returns no suggestion', async () => {
  let modelCalls = 0;
  const modelClient = {
    async generate() {
      modelCalls += 1;
      throw new Error('must not run');
    },
  };

  await withServer({ modelClient }, async (baseUrl) => {
    const response = await postJson(baseUrl, requestBody);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { mode: 'manual', suggestion: null });
    assert.equal(modelCalls, 0);
  });
});

test('rejects an unapproved generation origin before calling the model', async () => {
  let modelCalls = 0;
  const modelClient = {
    async generate() {
      modelCalls += 1;
      return { answers: [], warnings: [] };
    },
  };

  await withServer(
    { modelClient, env: { PUBLIC_ORIGIN: 'https://app.example' } },
    async (baseUrl) => {
      const response = await postJson(
        baseUrl,
        { ...requestBody, mode: 'guided' },
        { origin: 'https://attacker.example' },
      );

      assert.equal(response.status, 403);
      assert.equal((await response.json()).error.code, 'ORIGIN_NOT_ALLOWED');
      assert.equal(modelCalls, 0);
    },
  );
});

test('rate limits generation requests per client address', async () => {
  await withServer(
    { rateLimitMax: 2, rateLimitWindowMs: 60_000 },
    async (baseUrl) => {
      assert.equal((await postJson(baseUrl, requestBody)).status, 200);
      assert.equal((await postJson(baseUrl, requestBody)).status, 200);

      const limited = await postJson(baseUrl, requestBody);
      assert.equal(limited.status, 429);
      assert.equal((await limited.json()).error.code, 'RATE_LIMITED');
      assert.ok(Number(limited.headers.get('retry-after')) > 0);
    },
  );
});

test('evicts expired client identities before the rate-limit map reaches capacity', async () => {
  await withServer(
    {
      env: { TRUST_PROXY: 'true' },
      rateLimitMax: 1,
      rateLimitWindowMs: 5,
      rateLimitMaxClients: 2,
    },
    async (baseUrl) => {
      assert.equal((await postJson(baseUrl, requestBody, { 'x-forwarded-for': '192.0.2.1' })).status, 200);
      assert.equal((await postJson(baseUrl, requestBody, { 'x-forwarded-for': '192.0.2.2' })).status, 200);
      await new Promise((resolve) => setTimeout(resolve, 10));
      assert.equal((await postJson(baseUrl, requestBody, { 'x-forwarded-for': '192.0.2.3' })).status, 200);
    },
  );
});

test('enforces a global generation budget across client addresses', async () => {
  await withServer(
    {
      env: { TRUST_PROXY: 'true' },
      modelClient: { async generate() { return { answers: [], warnings: [] }; } },
      globalRateLimitMax: 2,
      globalRateLimitWindowMs: 60_000,
    },
    async (baseUrl) => {
      const guided = { ...requestBody, mode: 'guided' };
      assert.equal((await postJson(baseUrl, guided, { 'x-forwarded-for': '192.0.2.1' })).status, 200);
      assert.equal((await postJson(baseUrl, guided, { 'x-forwarded-for': '192.0.2.2' })).status, 200);
      const limited = await postJson(baseUrl, guided, { 'x-forwarded-for': '192.0.2.3' });
      assert.equal(limited.status, 429);
      assert.equal((await limited.json()).error.code, 'GLOBAL_RATE_LIMITED');
    },
  );
});

test('rejects oversized fields and too many paragraphs before model execution', async () => {
  await withServer({}, async (baseUrl) => {
    for (const body of [
      { ...requestBody, questionId: 'x'.repeat(129) },
      { ...requestBody, questionText: 'x'.repeat(2_001) },
      { ...requestBody, paragraphs: Array.from({ length: 13 }, () => 'paragraph') },
      { ...requestBody, paragraphs: ['x'.repeat(2_001)] },
      { ...requestBody, personalAnswer: 'x'.repeat(2_001) },
    ]) {
      const response = await postJson(baseUrl, body);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, 'INVALID_REQUEST');
    }
  });
});

test('limits concurrent guided model calls', async () => {
  let release;
  const modelClient = {
    generate() {
      return new Promise((resolve) => {
        release = () => resolve({ answers: [], warnings: [] });
      });
    },
  };

  await withServer({ modelClient, maxConcurrent: 1 }, async (baseUrl) => {
    const first = postJson(baseUrl, { ...requestBody, mode: 'guided' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await postJson(baseUrl, { ...requestBody, mode: 'guided' });
    assert.equal(second.status, 429);
    assert.equal((await second.json()).error.code, 'CONCURRENCY_LIMITED');
    release();
    assert.equal((await (await first).json()).mode, 'guided');
  });
});

test('guided mode calls the injected model client and returns its validated draft', async () => {
  const calls = [];
  const draft = {
    answers: [
      {
        questionId: 'q1',
        suggestedAnswer: 'A suggestion.',
        supportingParagraphs: ['1'],
        confidence: 0.9,
      },
    ],
    warnings: [],
  };
  const modelClient = {
    async generate(input, options) {
      calls.push({ input, options });
      return draft;
    },
  };

  await withServer({ modelClient }, async (baseUrl) => {
    const response = await postJson(baseUrl, {
      ...requestBody,
      mode: 'guided',
      personalAnswer: 'My thought',
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { mode: 'guided', suggestion: draft });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].input, {
      source: {
        canonicalUrl: 'https://www.jw.org/en/bible-teachings/',
        host: 'www.jw.org',
        path: '/en/bible-teachings/',
        finder: null,
      },
      questionId: 'q1',
      questionText: 'What does the paragraph teach?',
      paragraphs: ['It teaches a supported point.'],
      personalAnswer: 'My thought',
    });
    assert.ok(calls[0].options.signal instanceof AbortSignal);
  });
});

test('returns JSON errors for malformed JSON and invalid study requests', async () => {
  await withServer({}, async (baseUrl) => {
    const malformed = await postJson(baseUrl, '{broken');
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), {
      error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
    });

    for (const body of [
      { ...requestBody, mode: 'automatic' },
      { ...requestBody, questionText: '' },
      { ...requestBody, paragraphs: [] },
      { ...requestBody, source: { canonicalUrl: 'https://example.com/article' } },
    ]) {
      const response = await postJson(baseUrl, body);
      assert.equal(response.status, 400);
      const payload = await response.json();
      assert.equal(typeof payload.error.code, 'string');
      assert.equal(typeof payload.error.message, 'string');
    }
  });
});

test('rejects request bodies larger than 64KB', async () => {
  await withServer({}, async (baseUrl) => {
    const response = await postJson(baseUrl, 'x'.repeat(64 * 1024 + 1));
    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), {
      error: { code: 'BODY_TOO_LARGE', message: 'Request body must not exceed 64KB.' },
    });
  });
});

test('aborts slow guided model requests at the configured timeout', async () => {
  const modelClient = {
    generate(_input, { signal }) {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    },
  };

  await withServer({ modelClient, requestTimeoutMs: 10 }, async (baseUrl) => {
    const response = await postJson(baseUrl, { ...requestBody, mode: 'guided' });
    assert.equal(response.status, 504);
    assert.equal((await response.json()).error.code, 'MODEL_TIMEOUT');
  });
});
