import { createServer as createHttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { createModelClient, ModelClientError } from './modelClient.mjs';
import { SourcePolicyError, validateSourceUrl } from './sourcePolicy.mjs';

const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_PUBLIC_ORIGIN = 'https://angelolockdev.github.io';
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_RATE_LIMIT_MAX = 5;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_RATE_LIMIT_CLIENTS = 10_000;
const DEFAULT_MAX_CONCURRENT = 2;
const DEFAULT_GLOBAL_RATE_LIMIT_MAX = 20;
const DEFAULT_GLOBAL_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_QUESTION_ID_CHARS = 128;
const MAX_TEXT_CHARS = 2_000;
const MAX_PARAGRAPHS = 12;

function validatePublicOrigin(value) {
  try {
    const origin = new URL(value);
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.origin !== value) {
      throw new Error('invalid public origin');
    }
    return origin.origin;
  } catch {
    throw new Error('PUBLIC_ORIGIN must be one exact HTTPS origin.');
  }
}

function corsHeaders(request, publicOrigin) {
  if (request.headers.origin !== publicOrigin) return {};
  return {
    'access-control-allow-origin': publicOrigin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'Origin',
  };
}

function sendJson(response, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    ...headers,
  });
  response.end(payload);
}

function sendError(response, status, code, message, headers) {
  sendJson(response, status, { error: { code, message } }, headers);
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clientAddress(request, trustProxy) {
  if (trustProxy) {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim() !== '') {
      return forwarded.split(',')[0].trim();
    }
  }
  return request.socket.remoteAddress || 'unknown';
}

function consumeRateLimit(
  entries,
  client,
  maxRequests,
  windowMs,
  now = Date.now(),
  maxClients = MAX_RATE_LIMIT_CLIENTS,
) {
  const existing = entries.get(client);
  if (!existing || existing.resetAt <= now) {
    if (!existing && entries.size >= maxClients) {
      for (const [key, entry] of entries) {
        if (entry.resetAt <= now) entries.delete(key);
      }
      if (entries.size >= maxClients) {
        return { allowed: false, retryAfter: Math.ceil(windowMs / 1000) };
      }
    }
    entries.set(client, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfter: 0 };
}

async function readJsonBody(request) {
  const contentLength = Number(request.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    request.resume();
    throw Object.assign(new Error('too large'), { code: 'BODY_TOO_LARGE' });
  }

  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) {
      request.resume();
      throw Object.assign(new Error('too large'), { code: 'BODY_TOO_LARGE' });
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('invalid json'), { code: 'INVALID_JSON' });
  }
}

function requireNonEmptyString(value, field, maxLength) {
  if (typeof value !== 'string' || value.trim() === '' || value.length > maxLength) {
    throw Object.assign(new Error(`${field} must be a non-empty string of at most ${maxLength} characters.`), {
      code: 'INVALID_REQUEST',
    });
  }
  return value;
}

function validateStudyRequest(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw Object.assign(new Error('Request body must be a JSON object.'), {
      code: 'INVALID_REQUEST',
    });
  }
  if (body.mode !== 'manual' && body.mode !== 'guided') {
    throw Object.assign(new Error('mode must be manual or guided.'), {
      code: 'INVALID_REQUEST',
    });
  }
  if (body.source === null || typeof body.source !== 'object' || Array.isArray(body.source)) {
    throw Object.assign(new Error('source.canonicalUrl is required.'), {
      code: 'INVALID_REQUEST',
    });
  }

  const sourceUrl = requireNonEmptyString(body.source.canonicalUrl, 'source.canonicalUrl', 2_048);
  const source = validateSourceUrl(sourceUrl);
  const questionId = requireNonEmptyString(body.questionId, 'questionId', MAX_QUESTION_ID_CHARS);
  const questionText = requireNonEmptyString(body.questionText, 'questionText', MAX_TEXT_CHARS);
  if (
    !Array.isArray(body.paragraphs) ||
    body.paragraphs.length === 0 ||
    body.paragraphs.length > MAX_PARAGRAPHS ||
    !body.paragraphs.every((paragraph) =>
      typeof paragraph === 'string' && paragraph.trim() !== '' && paragraph.length <= MAX_TEXT_CHARS)
  ) {
    throw Object.assign(
      new Error('paragraphs must be a non-empty array of non-empty strings.'),
      { code: 'INVALID_REQUEST' },
    );
  }
  if (
    body.personalAnswer !== undefined &&
    (typeof body.personalAnswer !== 'string' || body.personalAnswer.length > MAX_TEXT_CHARS)
  ) {
    throw Object.assign(new Error(`personalAnswer must contain at most ${MAX_TEXT_CHARS} characters.`), {
      code: 'INVALID_REQUEST',
    });
  }

  return {
    mode: body.mode,
    modelInput: {
      source,
      questionId,
      questionText,
      paragraphs: body.paragraphs,
      ...(typeof body.personalAnswer !== 'string' || body.personalAnswer.trim() === ''
        ? {}
        : { personalAnswer: body.personalAnswer }),
    },
  };
}

/**
 * @param {{modelClient?: {generate: Function}, env?: Record<string, string | undefined>, requestTimeoutMs?: number, rateLimitMax?: number, rateLimitWindowMs?: number, rateLimitMaxClients?: number, maxConcurrent?: number, globalRateLimitMax?: number, globalRateLimitWindowMs?: number}} options
 */
export function createServer(options = {}) {
  const env = options.env ?? process.env;
  const modelClient = options.modelClient ?? createModelClient({ fetchImpl: fetch, env });
  const publicOrigin = validatePublicOrigin(env.PUBLIC_ORIGIN || DEFAULT_PUBLIC_ORIGIN);
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const rateLimitMax = positiveInteger(
    options.rateLimitMax ?? env.RATE_LIMIT_MAX,
    DEFAULT_RATE_LIMIT_MAX,
  );
  const rateLimitWindowMs = positiveInteger(
    options.rateLimitWindowMs ?? env.RATE_LIMIT_WINDOW_MS,
    DEFAULT_RATE_LIMIT_WINDOW_MS,
  );
  const rateLimitMaxClients = positiveInteger(
    options.rateLimitMaxClients ?? env.RATE_LIMIT_MAX_CLIENTS,
    MAX_RATE_LIMIT_CLIENTS,
  );
  const trustProxy = env.TRUST_PROXY === 'true';
  const maxConcurrent = positiveInteger(
    options.maxConcurrent ?? env.MAX_CONCURRENT_GENERATIONS,
    DEFAULT_MAX_CONCURRENT,
  );
  const globalRateLimitMax = positiveInteger(
    options.globalRateLimitMax ?? env.GLOBAL_RATE_LIMIT_MAX,
    DEFAULT_GLOBAL_RATE_LIMIT_MAX,
  );
  const globalRateLimitWindowMs = positiveInteger(
    options.globalRateLimitWindowMs ?? env.GLOBAL_RATE_LIMIT_WINDOW_MS,
    DEFAULT_GLOBAL_RATE_LIMIT_WINDOW_MS,
  );
  const rateLimitEntries = new Map();
  const globalRateLimitEntries = new Map();
  let activeGuidedRequests = 0;

  const server = createHttpServer(async (request, response) => {
    const headers = {
      'x-request-id': randomUUID(),
      ...corsHeaders(request, publicOrigin),
    };

    if (request.method === 'OPTIONS') {
      response.writeHead(204, headers);
      response.end();
      return;
    }

    if (request.method === 'GET' && request.url === '/health') {
      sendJson(
        response,
        200,
        { status: 'ok', service: 'family-bible-study-api' },
        headers,
      );
      return;
    }

    if (request.method !== 'POST' || request.url !== '/api/study/generate') {
      sendError(response, 404, 'NOT_FOUND', 'Route not found.', headers);
      return;
    }

    if (request.headers.origin !== publicOrigin) {
      sendError(
        response,
        403,
        'ORIGIN_NOT_ALLOWED',
        'Request origin is not allowed.',
        headers,
      );
      return;
    }

    const mediaType = String(request.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
    if (mediaType !== 'application/json') {
      sendError(response, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.', headers);
      return;
    }

    const rateLimit = consumeRateLimit(
      rateLimitEntries,
      clientAddress(request, trustProxy),
      rateLimitMax,
      rateLimitWindowMs,
      Date.now(),
      rateLimitMaxClients,
    );
    if (!rateLimit.allowed) {
      sendError(response, 429, 'RATE_LIMITED', 'Too many requests.', {
        ...headers,
        'retry-after': String(rateLimit.retryAfter),
      });
      return;
    }

    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      if (error.code === 'BODY_TOO_LARGE') {
        sendError(
          response,
          413,
          'BODY_TOO_LARGE',
          'Request body must not exceed 64KB.',
          headers,
        );
      } else {
        sendError(
          response,
          400,
          'INVALID_JSON',
          'Request body must be valid JSON.',
          headers,
        );
      }
      return;
    }

    let study;
    try {
      study = validateStudyRequest(body);
    } catch (error) {
      const code = error instanceof SourcePolicyError ? error.code : 'INVALID_REQUEST';
      sendError(response, 400, code, error.message, headers);
      return;
    }

    if (study.mode === 'manual') {
      sendJson(response, 200, { mode: 'manual', suggestion: null }, headers);
      return;
    }

    const globalRateLimit = consumeRateLimit(
      globalRateLimitEntries,
      'global',
      globalRateLimitMax,
      globalRateLimitWindowMs,
    );
    if (!globalRateLimit.allowed) {
      sendError(response, 429, 'GLOBAL_RATE_LIMITED', 'The guided generation budget is temporarily exhausted.', {
        ...headers,
        'retry-after': String(globalRateLimit.retryAfter),
      });
      return;
    }

    if (activeGuidedRequests >= maxConcurrent) {
      sendError(
        response,
        429,
        'CONCURRENCY_LIMITED',
        'Too many guided requests are already running.',
        headers,
      );
      return;
    }
    activeGuidedRequests += 1;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error('Model request timed out.')),
      requestTimeoutMs,
    );
    timeout.unref?.();

    try {
      const suggestion = await modelClient.generate(study.modelInput, {
        signal: controller.signal,
      });
      sendJson(response, 200, { mode: 'guided', suggestion }, headers);
    } catch (error) {
      if (controller.signal.aborted) {
        sendError(response, 504, 'MODEL_TIMEOUT', 'Model request timed out.', headers);
      } else if (error instanceof ModelClientError) {
        sendError(response, 502, error.code, error.message, headers);
      } else {
        sendError(response, 502, 'MODEL_PROVIDER_ERROR', 'Model request failed.', headers);
      }
    } finally {
      clearTimeout(timeout);
      activeGuidedRequests -= 1;
    }
  });

  server.headersTimeout = Math.min(10_000, requestTimeoutMs);
  server.requestTimeout = requestTimeoutMs + 5_000;
  server.keepAliveTimeout = 5_000;
  server.maxRequestsPerSocket = 100;
  return server;
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  createServer().listen(port, host, () => {
    console.log(`family-bible-study-api listening on http://${host}:${port}`);
  });
}
