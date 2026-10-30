// -----------------------------------------------------------------------------
// YOURLS client: the API of a self-hosted YOURLS (`yourls-api.php`, JSON
// format). Checked against a real YOURLS 1.10.6 in Docker
// (test/fixtures/yourls); the actions used exist since YOURLS 1.5.
//
//   action=stats&filter=top&limit=10   the most clicked links, and the totals
//                                      (links, clicks) of the whole database
//   action=url-stats&shorturl=<kw>     one link: address, title, clicks
//   action=shorturl&url&keyword&title  create a short link (scene action)
//   action=version                     the version of YOURLS
//
// Every request is a POST: the signature token (or the username and
// password) travels in the body, never in an address a proxy would log.
// Redirects are not followed: the secret would be sent wherever the address
// points (an http:// address redirected to https:// is reported).
// -----------------------------------------------------------------------------

export const ERROR_KINDS = Object.freeze({
  UNREACHABLE: 'unreachable', // no answer: down, wrong address, firewall
  TLS: 'tls', // the certificate does not verify
  AUTH: 'auth', // signature or password refused
  NOT_YOURLS: 'not_yourls', // something answers, not the YOURLS API
  REDIRECT: 'redirect', // the address redirects (usually HTTP to HTTPS)
  NOT_FOUND: 'not_found', // no short link with this keyword
  KEYWORD_TAKEN: 'keyword_taken', // shorten: the keyword is used or reserved
  BAD_URL: 'bad_url', // shorten: YOURLS refused the address
  HTTP: 'http', // any other error
});

export class YourlsError extends Error {
  /**
   * @param {string} kind one of ERROR_KINDS
   * @param {string} message English, for the logs (never contains a secret)
   * @param {object} [extra] { status }
   */
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = 'YourlsError';
    this.kind = kind;
    Object.assign(this, extra);
  }
}

const TLS_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

export const MAX_BODY_BYTES = 2 * 1024 * 1024;

/**
 * The one function that talks to the network (fetch). The client takes it as
 * a parameter: the tests replace it with an in-memory YOURLS
 * (test/helpers/fakeYourls.js).
 * @param {string} url
 * @param {{ form: Record<string, string>, timeoutMs?: number }} options
 * @returns {Promise<{ status: number, body: string }>}
 */
export async function httpRequest(url, { form, timeoutMs = 10_000 }) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(form).toString(),
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) {
    await response.body?.cancel();
    throw new Error('Response too large');
  }
  return { status: response.status, body: await response.text() };
}

/** A count of the API (a number since 1.9, a string before): 0 when unusable. */
export function count(raw) {
  const number = typeof raw === 'string' ? Number(raw) : raw;
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** The keyword of a short address: its last part. */
export const keywordOf = (shortUrl) => text(shortUrl).replace(/\/+$/, '').split('/').pop() ?? '';

/** One link of an answer, normalized; null when it cannot be identified. */
export function normalizeLink(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const shortUrl = text(raw.shorturl);
  const keyword = text(raw.keyword) || keywordOf(shortUrl);
  if (!keyword) {
    return null;
  }
  return {
    keyword,
    shortUrl,
    longUrl: text(raw.url) || text(raw.longurl),
    title: text(raw.title),
    clicks: count(raw.clicks),
  };
}

/** The status YOURLS gives in its JSON (a string since 1.9), 0 when none. */
const jsonStatus = (data) => count(data?.statusCode) || count(data?.errorCode);

/** Map a network failure to an error kind. */
function networkError(err) {
  const code = err?.cause?.code ?? err?.code;
  if (TLS_CODES.has(code)) {
    return new YourlsError(ERROR_KINDS.TLS, `Certificate refused (${code})`);
  }
  if (err?.name === 'TimeoutError') {
    return new YourlsError(ERROR_KINDS.UNREACHABLE, 'No answer within 10 s');
  }
  return new YourlsError(ERROR_KINDS.UNREACHABLE, `Cannot reach YOURLS (${code ?? err?.message})`);
}

export class YourlsClient {
  /**
   * @param {object} options
   * @param {string} options.url base URL of YOURLS (src/config.js)
   * @param {string} [options.signature] the signature token
   * @param {string} [options.username]
   * @param {string} [options.password]
   * @param {Function} [options.request] HTTP seam, httpRequest by default
   */
  constructor({ url, signature, username, password, request = httpRequest }) {
    this.endpoint = `${url}/yourls-api.php`;
    this.auth = signature ? { signature } : { username, password };
    this.request = request;
  }

  /**
   * One API call: the parsed JSON, whatever its own status says (the
   * callers read it); throws a YourlsError for what no caller can use.
   */
  async call(action, params = {}) {
    let response;
    try {
      response = await this.request(this.endpoint, {
        form: { ...params, action, format: 'json', ...this.auth },
      });
    } catch (err) {
      throw networkError(err);
    }
    const { status, body } = response;
    if (status >= 300 && status < 400) {
      throw new YourlsError(ERROR_KINDS.REDIRECT, `The address redirects (HTTP ${status})`, {
        status,
      });
    }
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      data = null;
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new YourlsError(
        status >= 500 ? ERROR_KINDS.HTTP : ERROR_KINDS.NOT_YOURLS,
        `No YOURLS API at this address (HTTP ${status})`,
        { status },
      );
    }
    const code = jsonStatus(data) || status;
    if (status === 403 || code === 403) {
      // "Please log in" (no or wrong signature), "Invalid username or password".
      throw new YourlsError(ERROR_KINDS.AUTH, 'Signature or password refused', { status: 403 });
    }
    if (status >= 500) {
      throw new YourlsError(ERROR_KINDS.HTTP, `HTTP ${status}`, { status });
    }
    return { status: code, data };
  }

  /** The version of YOURLS, '' when it does not say. */
  async version() {
    const { data } = await this.call('version');
    return text(data.version);
  }

  /**
   * The totals of the database and the most clicked links, most clicked
   * first.
   */
  async top(limit = 10) {
    const { status, data } = await this.call('stats', { filter: 'top', limit: String(limit) });
    if (status !== 200 || !data.stats || typeof data.stats !== 'object') {
      throw new YourlsError(ERROR_KINDS.HTTP, `Unexpected stats answer (${status})`, { status });
    }
    // An object `link_1`, `link_2`… (an empty array when there is no link).
    const raw = data.links && typeof data.links === 'object' ? Object.values(data.links) : [];
    const links = raw.map(normalizeLink).filter(Boolean);
    links.sort((a, b) => b.clicks - a.clicks);
    return {
      links: count(data.stats.total_links),
      clicks: count(data.stats.total_clicks),
      top: links.slice(0, limit),
    };
  }

  /** One link by its keyword. */
  async link(keyword) {
    const { status, data } = await this.call('url-stats', { shorturl: keyword });
    if (status === 404) {
      throw new YourlsError(ERROR_KINDS.NOT_FOUND, `No short link "${keyword}"`, { status });
    }
    const link = status === 200 ? normalizeLink({ keyword, ...data.link }) : null;
    // Without a count, 0 would read as a reset and replay the milestones.
    if (!link || !Number.isFinite(Number(data.link?.clicks))) {
      throw new YourlsError(ERROR_KINDS.HTTP, `Unexpected url-stats answer (${status})`, {
        status,
      });
    }
    return link;
  }

  /**
   * Shorten an address. An address already shortened gives its existing
   * link (YOURLS keeps one link per address by default).
   * @returns {Promise<{ link: object, created: boolean }>}
   */
  async shorten({ url, keyword, title }) {
    const params = { url };
    if (keyword) {
      params.keyword = keyword;
    }
    if (title) {
      params.title = title;
    }
    const { status, data } = await this.call('shorturl', params);
    const code = text(data.code);
    if (data.status === 'success' || code === 'error:url') {
      const link = normalizeLink({ ...data.url, shorturl: data.shorturl });
      if (link) {
        return { link, created: data.status === 'success' };
      }
    }
    if (code === 'error:keyword') {
      throw new YourlsError(ERROR_KINDS.KEYWORD_TAKEN, `Keyword "${keyword}" taken or reserved`);
    }
    if (code === 'error:nourl' || code === 'error:nohttp') {
      throw new YourlsError(ERROR_KINDS.BAD_URL, 'Address refused by YOURLS');
    }
    // A plugin refusing (spam filter, allow-list…), a database error: its message.
    throw new YourlsError(
      ERROR_KINDS.HTTP,
      `Shorten refused (${status}${code ? `, ${code}` : ''}): ${text(data.message).slice(0, 150)}`,
      { status },
    );
  }
}
