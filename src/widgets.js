// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `yourls_top_links`.
//
// The use case: a glance at the wall tablet tells which short links draw the
// clicks, the most clicked first, with the totals of the instance. The
// figures are sent as values, not bound to device features: the widget works
// before the device is added.
//
// Budget (8 components, 2 texts): two tiles, one text when YOURLS does not
// answer, one status list of ten rows at most, a Refresh button. The tiles
// and the button can be hidden in the settings of the widget.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { WIDGET_KEY } from './hub.js';
import { ERROR_TEXT, pick } from './texts.js';

// Action key of the button: permanent once published.
export const ACTIONS = Object.freeze({ REFRESH: 'refresh' });

// Settings of the widget (manifest `widgets[].settings`): permanent too.
export const ROWS = ['5', '10'];
export const DEFAULT_SETTINGS = { rows: '10', show_totals: true, show_refresh: true };

export const TEXT = {
  pick: {
    en: 'Fill in your YOURLS in the configuration of the integration.',
    fr: "Renseignez votre YOURLS dans la configuration de l'intégration.",
    de: 'Trage dein YOURLS in der Konfiguration der Integration ein.',
    es: 'Indique su YOURLS en la configuración de la integración.',
  },
  empty: {
    en: 'No short link yet: create one in YOURLS.',
    fr: 'Aucun lien court pour le moment : créez-en un dans YOURLS.',
    de: 'Noch kein Kurzlink: Lege einen in YOURLS an.',
    es: 'Todavía no hay ningún enlace corto: cree uno en YOURLS.',
  },
  clicks: { en: 'Clicks', fr: 'Clics', de: 'Klicks', es: 'Clics' },
  links: { en: 'Links', fr: 'Liens', de: 'Links', es: 'Enlaces' },
  refresh: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
  refreshed: {
    en: 'YOURLS read again.',
    fr: 'YOURLS relu.',
    de: 'YOURLS neu gelesen.',
    es: 'YOURLS leído de nuevo.',
  },
};

const fit = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

const flag = (value, fallback) =>
  value === undefined || value === null ? fallback : value === true || value === 'true';

/** The settings of a widget instance, defaults for what is missing or invalid. */
export function normalizeSettings(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    rows: Number(ROWS.includes(String(source.rows)) ? source.rows : DEFAULT_SETTINGS.rows),
    showTotals: flag(source.show_totals, DEFAULT_SETTINGS.show_totals),
    showRefresh: flag(source.show_refresh, DEFAULT_SETTINGS.show_refresh),
  };
}

function message(text, language) {
  return {
    ttl_seconds: 300,
    components: [{ type: 'text', variant: 'body', text: pick(text, language) }],
  };
}

/** What a person reads for a link: its keyword, and its title when there is room. */
function rowLabel(link) {
  const title = link.title && link.title !== link.longUrl ? link.title : '';
  return fit(title ? `${link.keyword} · ${title}` : link.keyword, 40);
}

async function get(hub, { language = 'en', settings } = {}) {
  if (!hub.client) {
    return message(TEXT.pick, language);
  }
  const options = normalizeSettings(settings);
  const server = hub.server;
  if (server && server.links === 0 && !hub.error) {
    return message(TEXT.empty, language);
  }

  const components = [];
  if (options.showTotals) {
    components.push(
      {
        type: 'value',
        value: server?.clicks ?? 0,
        label: pick(TEXT.clicks, language),
        icon: 'mouse-pointer',
        color: WIDGET_COLORS.INFO,
      },
      {
        type: 'value',
        value: server?.links ?? 0,
        label: pick(TEXT.links, language),
        icon: 'link',
        color: WIDGET_COLORS.NEUTRAL,
      },
    );
  }

  if (hub.error) {
    components.push({
      type: 'text',
      variant: 'body',
      text: pick(ERROR_TEXT[hub.error.kind], language),
    });
  }

  const links = (server?.top ?? []).slice(0, options.rows);
  if (links.length > 0) {
    components.push({
      type: 'status',
      items: links.map((link, index) => ({
        label: rowLabel(link),
        value: link.clicks,
        icon: index === 0 && link.clicks > 0 ? 'award' : 'link-2',
        color: link.clicks > 0 ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.NEUTRAL,
      })),
    });
  }

  if (options.showRefresh) {
    components.push({
      type: 'button',
      label: pick(TEXT.refresh, language),
      icon: 'refresh-cw',
      style: 'secondary',
      action: { key: ACTIONS.REFRESH },
    });
  }

  return { ttl_seconds: 60, components };
}

async function action(hub, { actionKey }) {
  if (actionKey !== ACTIONS.REFRESH) {
    throw new Error(`Unknown action ${actionKey}`);
  }
  if (!hub.client) {
    return { message: TEXT.pick };
  }
  await hub.pollNow();
  if (hub.error) {
    return { message: ERROR_TEXT[hub.error.kind] };
  }
  return { message: TEXT.refreshed };
}

export const WIDGETS = {
  [WIDGET_KEY]: { get, action },
};
