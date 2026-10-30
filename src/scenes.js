// -----------------------------------------------------------------------------
// Scene action handlers (manifest `scene_actions`, Gladys 5.1+).
//
// - `shorten_url`: shorten an address (a keyword and a title are optional)
//   and hand the short address to the next actions — "send the short link of
//   today's menu by Telegram". An address YOURLS already knows gives its
//   existing short link (`created` says which).
// - `get_link_clicks`: the clicks of any link, followed or not, for a
//   message ("Newsletter: 42 clicks").
//
// The scene gives free text (variables included): every field is checked
// before it reaches YOURLS.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { isKeyword, missingCredentials } from './config.js';
import { ERROR_KINDS, YourlsError } from './yourls/client.js';
import { ACTION_TEXT, CONNECTION_TEXT, ERROR_TEXT, labelled, pick } from './texts.js';

const logger = createLogger({ name: 'yourls-scenes' });

const MAX_URL_LENGTH = 2000;
const MAX_TITLE_LENGTH = 200;

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** The client, or the reason it cannot be used, in the language of the names. */
function clientOf(hub) {
  const missing = missingCredentials(hub.config);
  if (missing) {
    throw new Error(pick(CONNECTION_TEXT[missing], hub.config.language));
  }
  return hub.client;
}

/** A YOURLS error, explained in the language of the names. */
function explain(hub, err) {
  if (!(err instanceof YourlsError)) {
    return err;
  }
  const language = hub.config.language;
  // A plugin's refusal says more than "unexpected answer".
  const reason =
    err.kind === ERROR_KINDS.HTTP
      ? labelled(pick(ERROR_TEXT[err.kind], language), err.message, language)
      : pick(ERROR_TEXT[err.kind], language);
  return new Error(reason, { cause: err });
}

/** A keyword field: '' when empty, the keyword of a full short address too. */
function keywordField(hub, raw) {
  const keyword = text(raw).replace(/\/+$/, '').split('/').pop();
  if (keyword && !isKeyword(keyword)) {
    throw new Error(pick(ACTION_TEXT.badKeyword, hub.config.language));
  }
  return keyword;
}

const outputsOf = (link) => ({
  keyword: link.keyword,
  short_url: link.shortUrl,
  long_url: link.longUrl,
  title: link.title,
  clicks: link.clicks,
});

export const SCENE_ACTIONS = {
  async shorten_url(hub, { fields = {} }) {
    const client = clientOf(hub);
    const url = text(fields.url);
    let parsed;
    try {
      parsed = url.length <= MAX_URL_LENGTH ? new URL(url) : null;
    } catch {
      parsed = null;
    }
    // YOURLS itself stores "notaurl" as a link: a scene variable left empty
    // must not become one.
    if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(pick(ACTION_TEXT.badUrl, hub.config.language));
    }
    const keyword = keywordField(hub, fields.keyword);
    const title = text(fields.title).slice(0, MAX_TITLE_LENGTH);
    let result;
    try {
      result = await client.shorten({ url, keyword, title });
    } catch (err) {
      throw explain(hub, err);
    }
    logger.info(
      `Scene action: ${result.created ? 'new' : 'existing'} short link "${result.link.keyword}"`,
    );
    return { ...outputsOf(result.link), created: result.created };
  },

  async get_link_clicks(hub, { fields = {} }) {
    const client = clientOf(hub);
    const keyword = keywordField(hub, fields.keyword);
    if (!keyword) {
      throw new Error(pick(ERROR_TEXT[ERROR_KINDS.NOT_FOUND], hub.config.language));
    }
    try {
      return outputsOf(await client.link(keyword));
    } catch (err) {
      throw explain(hub, err);
    }
  },
};
