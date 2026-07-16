import test from 'node:test';
import assert from 'node:assert/strict';

import { SourcePolicyError, validateSourceUrl } from './sourcePolicy.mjs';

test('accepts canonical jw.org HTTPS URLs and returns source metadata', () => {
  assert.deepEqual(validateSourceUrl('https://www.jw.org/en/bible-teachings/'), {
    canonicalUrl: 'https://www.jw.org/en/bible-teachings/',
    host: 'www.jw.org',
    path: '/en/bible-teachings/',
    finder: null,
  });

  assert.deepEqual(validateSourceUrl('https://jw.org/fr/'), {
    canonicalUrl: 'https://jw.org/fr/',
    host: 'jw.org',
    path: '/fr/',
    finder: null,
  });
});

test('parses Finder document id and locale', () => {
  assert.deepEqual(
    validateSourceUrl('https://www.jw.org/finder?wtlocale=F&docid=1102025201'),
    {
      canonicalUrl: 'https://www.jw.org/finder?wtlocale=F&docid=1102025201',
      host: 'www.jw.org',
      path: '/finder',
      finder: { docid: '1102025201', wtlocale: 'F' },
    },
  );
});

test('rejects non-HTTPS, non-JW, root-only, and incomplete Finder URLs', () => {
  const cases = [
    ['http://www.jw.org/en/', 'HTTPS'],
    ['https://example.com/en/', 'jw.org'],
    ['https://media.jw.org/en/', 'jw.org'],
    ['https://www.jw.org:444/en/', 'standard HTTPS port'],
    ['https://user:pass@www.jw.org/en/', 'credentials'],
    ['https://www.jw.org/', 'path'],
    ['https://www.jw.org/finder?wtlocale=E', 'docid'],
    ['https://www.jw.org/finder?docid=%20%20', 'docid'],
    ['not a URL', 'valid URL'],
  ];

  for (const [url, expectedMessage] of cases) {
    assert.throws(
      () => validateSourceUrl(url),
      (error) =>
        error instanceof SourcePolicyError &&
        error.message.includes(expectedMessage),
      url,
    );
  }
});
