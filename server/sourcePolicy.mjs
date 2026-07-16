/** Error raised when a source URL is outside the approved JW source policy. */
export class SourcePolicyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SourcePolicyError';
    this.code = 'INVALID_SOURCE_URL';
  }
}

/**
 * @typedef {{docid: string, wtlocale: string | null}} FinderSource
 * @typedef {{canonicalUrl: string, host: 'jw.org' | 'www.jw.org', path: string, finder: FinderSource | null}} ValidatedSource
 */

/** @param {unknown} value @returns {ValidatedSource} */
export function validateSourceUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new SourcePolicyError('Source canonicalUrl must be a valid URL.');
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new SourcePolicyError('Source canonicalUrl must be a valid URL.');
  }

  if (url.protocol !== 'https:') {
    throw new SourcePolicyError('Source canonicalUrl must use HTTPS.');
  }
  if (url.hostname !== 'jw.org' && url.hostname !== 'www.jw.org') {
    throw new SourcePolicyError('Source canonicalUrl host must be jw.org or www.jw.org.');
  }
  if (url.port !== '') {
    throw new SourcePolicyError('Source canonicalUrl must use the standard HTTPS port.');
  }
  if (url.username !== '' || url.password !== '') {
    throw new SourcePolicyError('Source canonicalUrl must not include credentials.');
  }
  if (url.pathname === '/') {
    throw new SourcePolicyError('Source canonicalUrl must include a content path.');
  }

  let finder = null;
  if (url.pathname === '/finder' || url.pathname === '/finder/') {
    const docid = url.searchParams.get('docid');
    if (!docid || docid.trim() === '') {
      throw new SourcePolicyError('JW Finder URLs must include a docid query parameter.');
    }
    finder = {
      docid,
      wtlocale: url.searchParams.get('wtlocale'),
    };
  }

  return {
    canonicalUrl: url.href,
    host: /** @type {'jw.org' | 'www.jw.org'} */ (url.hostname),
    path: url.pathname,
    finder,
  };
}
