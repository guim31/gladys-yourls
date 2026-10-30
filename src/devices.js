// -----------------------------------------------------------------------------
// The Gladys device, proposed in the Discovery tab: the YOURLS instance (one
// per integration).
//
//   reachable            presence-sensor/binary   1 when YOURLS answers
//   links                counter-sensor/integer   short links in the database
//   clicks               counter-sensor/integer   clicks of every link
//   top_clicks           counter-sensor/integer   clicks of the most clicked link
//   top_link             text/text                keyword of the most clicked
//                                                 link, "-" without any link
//   link_clicks:<kw>     counter-sensor/integer   clicks of a followed link (one
//                                                 per keyword of the configuration)
//
// Published with should_poll: false: the integration reads YOURLS on its own
// timer (src/hub.js), at the interval of the configuration (up to 15 minutes,
// beyond the fixed list of the core scheduler).
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';

export const DEVICE_TYPE = 'instance';
export const DEVICE_ID = 'yourls';
export const MODEL = 'YOURLS';

// Suffixes of the feature external ids: permanent once published.
export const FEATURE_KEYS = Object.freeze({
  REACHABLE: 'reachable',
  LINKS: 'links',
  CLICKS: 'clicks',
  TOP_CLICKS: 'top_clicks',
  TOP_LINK: 'top_link',
  LINK_CLICKS: 'link_clicks',
});

// Feature names, in the language chosen in the configuration (Gladys does not
// tell a device integration the user's language). Frozen at creation in Gladys.
export const NAMES = {
  en: {
    [FEATURE_KEYS.REACHABLE]: 'Reachable',
    [FEATURE_KEYS.LINKS]: 'Short links',
    [FEATURE_KEYS.CLICKS]: 'Clicks',
    [FEATURE_KEYS.TOP_CLICKS]: 'Clicks of the top link',
    [FEATURE_KEYS.TOP_LINK]: 'Most clicked link',
    [FEATURE_KEYS.LINK_CLICKS]: (keyword) => `Clicks: ${keyword}`,
  },
  fr: {
    [FEATURE_KEYS.REACHABLE]: 'Joignable',
    [FEATURE_KEYS.LINKS]: 'Liens courts',
    [FEATURE_KEYS.CLICKS]: 'Clics',
    [FEATURE_KEYS.TOP_CLICKS]: 'Clics du lien le plus cliqué',
    [FEATURE_KEYS.TOP_LINK]: 'Lien le plus cliqué',
    [FEATURE_KEYS.LINK_CLICKS]: (keyword) => `Clics : ${keyword}`,
  },
  de: {
    [FEATURE_KEYS.REACHABLE]: 'Erreichbar',
    [FEATURE_KEYS.LINKS]: 'Kurzlinks',
    [FEATURE_KEYS.CLICKS]: 'Klicks',
    [FEATURE_KEYS.TOP_CLICKS]: 'Klicks des Top-Links',
    [FEATURE_KEYS.TOP_LINK]: 'Meistgeklickter Link',
    [FEATURE_KEYS.LINK_CLICKS]: (keyword) => `Klicks: ${keyword}`,
  },
  es: {
    [FEATURE_KEYS.REACHABLE]: 'Accesible',
    [FEATURE_KEYS.LINKS]: 'Enlaces cortos',
    [FEATURE_KEYS.CLICKS]: 'Clics',
    [FEATURE_KEYS.TOP_CLICKS]: 'Clics del enlace más visitado',
    [FEATURE_KEYS.TOP_LINK]: 'Enlace más visitado',
    [FEATURE_KEYS.LINK_CLICKS]: (keyword) => `Clics: ${keyword}`,
  },
};

// Display bounds (the core never applies them on write).
export const MAX_LINKS = 100_000_000;
export const MAX_CLICKS = 1_000_000_000_000;

export const deviceIds = (gladys) => gladys.externalIds(DEVICE_TYPE, DEVICE_ID);

/** The feature key of a followed link. */
export const linkFeatureKey = (keyword) =>
  `${FEATURE_KEYS.LINK_CLICKS}:${encodeURIComponent(keyword)}`;

const sensor = (name, externalId, category, type, extra) => ({
  name,
  external_id: externalId,
  category,
  type,
  read_only: true,
  has_feedback: false,
  ...extra,
});

const counter = (name, externalId, max) =>
  sensor(
    name,
    externalId,
    DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
    DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
    { keep_history: true, min: 0, max },
  );

/** The discovery payload of the instance, with one feature per followed link. */
export function buildDevice(gladys, { host, keywords = [], language = 'en' }) {
  const ids = deviceIds(gladys);
  const names = NAMES[language] ?? NAMES.en;
  return {
    name: `YOURLS ${host}`.slice(0, 255),
    external_id: ids.device,
    model: MODEL,
    should_poll: false,
    params: [],
    features: [
      sensor(
        names[FEATURE_KEYS.REACHABLE],
        ids.feature(FEATURE_KEYS.REACHABLE),
        DEVICE_FEATURE_CATEGORIES.PRESENCE_SENSOR,
        DEVICE_FEATURE_TYPES.SENSOR.BINARY,
        { keep_history: true, min: 0, max: 1 },
      ),
      counter(names[FEATURE_KEYS.LINKS], ids.feature(FEATURE_KEYS.LINKS), MAX_LINKS),
      counter(names[FEATURE_KEYS.CLICKS], ids.feature(FEATURE_KEYS.CLICKS), MAX_CLICKS),
      counter(names[FEATURE_KEYS.TOP_CLICKS], ids.feature(FEATURE_KEYS.TOP_CLICKS), MAX_CLICKS),
      sensor(
        names[FEATURE_KEYS.TOP_LINK],
        ids.feature(FEATURE_KEYS.TOP_LINK),
        DEVICE_FEATURE_CATEGORIES.TEXT,
        DEVICE_FEATURE_TYPES.TEXT.TEXT,
        { keep_history: false, min: 0, max: 0 },
      ),
      ...keywords.map((keyword) =>
        counter(
          names[FEATURE_KEYS.LINK_CLICKS](keyword).slice(0, 255),
          ids.feature(linkFeatureKey(keyword)),
          MAX_CLICKS,
        ),
      ),
    ],
  };
}

const withIds = (ids, values) =>
  values.map(({ key, ...value }) => ({ device_feature_external_id: ids.feature(key), ...value }));

/**
 * The states of the instance: `reachable` alone when YOURLS does not answer;
 * nothing for a followed link not found.
 * @param {object|null} server { links, clicks, top } of the last read
 * @param {Map<string, object|null>} followed the followed links by keyword
 */
export function deviceValues(gladys, { reachable, server, followed }) {
  const values = [{ key: FEATURE_KEYS.REACHABLE, state: reachable ? 1 : 0 }];
  if (reachable && server) {
    const top = server.top[0];
    values.push(
      { key: FEATURE_KEYS.LINKS, state: server.links },
      { key: FEATURE_KEYS.CLICKS, state: server.clicks },
      { key: FEATURE_KEYS.TOP_CLICKS, state: top?.clicks ?? 0 },
      { key: FEATURE_KEYS.TOP_LINK, text: top?.keyword || '-' },
    );
    for (const [keyword, link] of followed) {
      if (link) {
        values.push({ key: linkFeatureKey(keyword), state: link.clicks });
      }
    }
  }
  return withIds(deviceIds(gladys), values);
}
