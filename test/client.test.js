// -----------------------------------------------------------------------------
// The YOURLS client against the real answers of YOURLS 1.10.6
// (test/fixtures/yourls/v1.10.6.json), and the parsing of the configuration.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeConfig, parseKeywords, parseServerUrl } from '../src/config.js';
import { ERROR_KINDS, YourlsClient, count } from '../src/yourls/client.js';

const real = JSON.parse(
  await readFile(new URL('./fixtures/yourls/v1.10.6.json', import.meta.url), 'utf8'),
);

/** A client answering every request with one recorded answer. */
function replay(name) {
  const calls = [];
  const client = new YourlsClient({
    url: 'https://sho.rt',
    signature: 'SIGNATURE',
    request: async (url, options) => {
      calls.push({ url, ...options });
      const { status, body } = real[name];
      return { status, body: typeof body === 'string' ? body : JSON.stringify(body) };
    },
  });
  return { client, calls };
}

const kindOf = async (promise) => {
  try {
    await promise;
  } catch (err) {
    return err.kind;
  }
  return 'resolved';
};

test('stats: totals and the most clicked links', async () => {
  const { client, calls } = replay('stats_top');
  const result = await client.top(10);
  assert.equal(result.links, 7);
  assert.equal(result.clicks, 8);
  assert.deepEqual(result.top[0], {
    keyword: 'news',
    shortUrl: 'http://sho.rt/news',
    longUrl: 'https://www.example.org/newsletter',
    title: 'Example Domain',
    clicks: 5,
  });
  assert.equal(calls[0].url, 'https://sho.rt/yourls-api.php');
  assert.deepEqual(calls[0].form, {
    filter: 'top',
    limit: '10',
    action: 'stats',
    format: 'json',
    signature: 'SIGNATURE',
  });
  // A fresh install (the three sample links of YOURLS).
  assert.equal((await replay('empty_stats_top').client.top()).top.length, 3);
});

test('url-stats: one link; a missing keyword is not_found', async () => {
  const link = await replay('url_stats').client.link('news');
  assert.equal(link.clicks, 5);
  assert.equal(link.keyword, 'news');
  assert.equal(
    await kindOf(replay('url_stats_missing').client.link('nope')),
    ERROR_KINDS.NOT_FOUND,
  );
});

test('version, and the refusals: token, password, not YOURLS', async () => {
  assert.equal(await replay('version').client.version(), '1.10.6');
  assert.equal(await kindOf(replay('no_auth').client.top()), ERROR_KINDS.AUTH);
  assert.equal(await kindOf(replay('bad_signature').client.top()), ERROR_KINDS.AUTH);
  assert.equal(await kindOf(replay('bad_password').client.top()), ERROR_KINDS.AUTH);
  // Apache's own 403 page at the root is not YOURLS refusing a token.
  assert.equal(await kindOf(replay('not_yourls').client.top()), ERROR_KINDS.NOT_YOURLS);
});

test('shorturl: created, existing address, keyword taken, no address', async () => {
  const created = await replay('shorturl_keyword').client.shorten({
    url: 'https://www.example.org/newsletter',
    keyword: 'news',
  });
  assert.equal(created.created, true);
  assert.equal(created.link.shortUrl, 'http://sho.rt/news');
  const existing = await replay('shorturl_same_url').client.shorten({
    url: 'https://www.example.org/newsletter',
  });
  assert.equal(existing.created, false);
  assert.equal(existing.link.keyword, 'news');
  assert.equal(
    await kindOf(replay('shorturl_keyword_taken').client.shorten({ url: 'x', keyword: 'news' })),
    ERROR_KINDS.KEYWORD_TAKEN,
  );
  assert.equal(
    await kindOf(replay('shorturl_no_url').client.shorten({ url: '' })),
    ERROR_KINDS.BAD_URL,
  );
});

test('network failures, redirects and TLS', async () => {
  const failing = (fn) =>
    new YourlsClient({ url: 'https://sho.rt', signature: 's', request: fn }).top();
  const refused = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
  assert.equal(await kindOf(failing(() => Promise.reject(refused))), ERROR_KINDS.UNREACHABLE);
  const tls = Object.assign(new TypeError('fetch failed'), {
    cause: { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' },
  });
  assert.equal(await kindOf(failing(() => Promise.reject(tls))), ERROR_KINDS.TLS);
  assert.equal(
    await kindOf(failing(async () => ({ status: 301, body: '' }))),
    ERROR_KINDS.REDIRECT,
  );
  assert.equal(
    await kindOf(failing(async () => ({ status: 502, body: 'Bad gateway' }))),
    ERROR_KINDS.HTTP,
  );
});

test('counts: numbers since 1.9, strings before', () => {
  assert.equal(count(5), 5);
  assert.equal(count('12'), 12);
  assert.equal(count(null), 0);
  assert.equal(count('-3'), 0);
});

test('the address: bare host, admin or API address, sub-directory, credentials refused', () => {
  assert.equal(parseServerUrl('sho.rt'), 'https://sho.rt');
  assert.equal(parseServerUrl('http://192.168.1.10:8080/admin/'), 'http://192.168.1.10:8080');
  assert.equal(parseServerUrl('https://sho.rt/admin/tools.php'), 'https://sho.rt');
  assert.equal(parseServerUrl('https://example.org/s/yourls-api.php'), 'https://example.org/s');
  assert.equal(parseServerUrl('https://user:pw@sho.rt'), null);
  assert.equal(parseServerUrl('ftp://sho.rt'), null);
  assert.equal(parseServerUrl('  '), '');
});

test('the keywords: separators, short addresses, duplicates, invalid ones, ten at most', () => {
  assert.deepEqual(parseKeywords('news, menu;news\nhttps://sho.rt/docs/ a+b'), [
    'news',
    'menu',
    'docs',
  ]);
  const many = Array.from({ length: 15 }, (_, i) => `k${i}`).join(',');
  assert.equal(parseKeywords(many).length, 10);
  const config = normalizeConfig({ url: 'sho.rt', signature: ' tok \n', poll_interval: 7 });
  assert.equal(config.signature, 'tok');
  assert.equal(config.pollIntervalMs, 300_000);
  assert.equal(config.language, 'fr');
});
