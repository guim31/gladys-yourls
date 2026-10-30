// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// A self-hosted YOURLS: its address (the one of the short links, where
// yourls-api.php lives) and either the signature token (Tools page of the
// YOURLS admin) or a username and password.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Refresh intervals offered in the configuration, in seconds.
export const POLL_INTERVALS = ['60', '300', '900'];

// Links followed one by one: one request each per cycle.
export const MAX_KEYWORDS = 10;

export const DEFAULT_CONFIG = {
  url: '',
  signature: '',
  username: '',
  password: '',
  keywords: '',
  poll_interval: '300',
  language: 'fr',
};

// The API script and the admin pages: an address copied with them points
// below the root of YOURLS.
const BELOW_ROOT = /\/(yourls-api\.php|admin(\/.*)?)$/i;

// A keyword as YOURLS stores it: letters and digits by default, `-` and `_`
// with the usual plugins. Anything else is a typo (or a full address).
const KEYWORD = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * Parse the address typed by the user into a base URL: a bare host
 * (`sho.rt`), or a URL copied from the browser (`https://sho.rt/admin/`).
 * HTTPS by default for a bare host (a short link service is public). A path
 * is kept (YOURLS installed in a sub-directory).
 * @param {unknown} raw
 * @returns {string|null} `http(s)://host[:port][/path]`, '' when empty, null
 *   when unusable
 */
export function parseServerUrl(raw) {
  if (typeof raw !== 'string') {
    return '';
  }
  const text = raw.trim();
  if (!text) {
    return '';
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    return null;
  }
  // Credentials in the address would end up in the logs.
  if (url.username || url.password) {
    return null;
  }
  const path = url.pathname.replace(/\/+$/, '').replace(BELOW_ROOT, '').replace(/\/+$/, '');
  return `${url.origin}${path}`;
}

/** Host part shown to the user (no scheme). */
export const hostOf = (url) => (url ? url.replace(/^https?:\/\//, '') : '');

/**
 * The keywords of the followed links: separated by commas, spaces or new
 * lines; a full short address keeps its last part. Duplicates and invalid
 * entries are dropped, MAX_KEYWORDS at most.
 * @returns {string[]}
 */
export function parseKeywords(raw) {
  if (typeof raw !== 'string') {
    return [];
  }
  const keywords = [];
  for (const entry of raw.split(/[\s,;]+/)) {
    const keyword = entry.replace(/\/+$/, '').split('/').pop();
    if (KEYWORD.test(keyword) && !keywords.includes(keyword)) {
      keywords.push(keyword);
    }
  }
  return keywords.slice(0, MAX_KEYWORDS);
}

/** Whether a keyword typed in a scene action is one YOURLS can store. */
export const isKeyword = (value) => KEYWORD.test(value);

const trimmed = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const pollInterval = POLL_INTERVALS.includes(String(source.poll_interval))
    ? String(source.poll_interval)
    : DEFAULT_CONFIG.poll_interval;
  return {
    url: parseServerUrl(source.url),
    // A pasted token often carries a trailing space or new line.
    signature: trimmed(source.signature),
    username: trimmed(source.username),
    // A password may start or end with a space: kept as typed.
    password: typeof source.password === 'string' ? source.password : '',
    keywords: parseKeywords(source.keywords),
    pollIntervalMs: Number(pollInterval) * 1000,
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}

/**
 * What is missing to read YOURLS, null when the configuration is complete:
 * 'noUrl', 'invalidUrl' or 'noAuth'.
 */
export function missingCredentials(config) {
  if (config.url === null) {
    return 'invalidUrl';
  }
  if (config.url === '') {
    return 'noUrl';
  }
  return config.signature || (config.username && config.password) ? null : 'noAuth';
}
