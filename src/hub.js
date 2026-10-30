// -----------------------------------------------------------------------------
// The YOURLS hub: YOURLS read on a timer of the container (the interval chosen
// in the configuration); the states of the device published when they change,
// the "Click milestone" scene event fired when a followed link passes one, and
// the views the widget and the scene actions read.
//
// Gladys never polls the device (should_poll: false): the interval goes up to
// 15 minutes, beyond the fixed list of the core scheduler.
//
// Requests per cycle: one for the totals and the ten most clicked links, then
// one per followed link (MAX_KEYWORDS at most).
//
// The clicks last seen per followed link are kept in /data (src/store.js): a
// restart neither announces a milestone twice nor misses one passed meanwhile.
// -----------------------------------------------------------------------------

import { DEVICE_TRANSPORTS, createLogger } from '@gladysassistant/integration-sdk';
import { buildDevice, deviceIds, deviceValues } from './devices.js';
import { ERROR_KINDS, YourlsClient, YourlsError } from './yourls/client.js';
import { hostOf, missingCredentials, normalizeConfig } from './config.js';
import { ProblemLog } from './problems.js';
import { CONNECTION_TEXT, ERROR_TEXT, REPORT_TEXT, labelled, pick } from './texts.js';

const logger = createLogger({ name: 'yourls-hub' });

export const WIDGET_KEY = 'yourls_top_links';

// Scene trigger keys (manifest `scene_triggers`): permanent once published.
export const TRIGGERS = Object.freeze({
  MILESTONE: 'click_milestone',
});

// The milestones the trigger announces (the options of its `milestone`
// filter in the manifest): round figures, 1-2.5-5 per power of ten.
export const MILESTONES = Object.freeze([
  10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000,
  1_000_000,
]);

export const HUB_TIMINGS = {
  // An unchanged value is sent again this often: Gladys shows "no recent
  // value" after 48 hours.
  heartbeatMs: 12 * 3600_000,
  // A scene action reads YOURLS again when the last read is older.
  freshMs: 15_000,
};

// Failed reads in a row before YOURLS counts as unreachable: one lost answer
// is not an outage.
export const FAILURES_FOR_DOWN = 2;
// The links of the widget and of the top of every cycle.
export const TOP_LINKS = 10;

// Errors that mean YOURLS cannot be reached (the others are a configuration
// to fix: signature refused, redirect).
const DOWN_KINDS = new Set([
  ERROR_KINDS.UNREACHABLE,
  ERROR_KINDS.TLS,
  ERROR_KINDS.NOT_YOURLS,
  ERROR_KINDS.HTTP,
]);

/** The milestones passed going from `before` to `after` clicks, smallest first. */
export const passedMilestones = (before, after) =>
  MILESTONES.filter((milestone) => before < milestone && milestone <= after);

/**
 * The badge of a YOURLS address: local on a private network, cloud on the
 * Internet (the usual place of a short link service).
 */
export function transportOf(url) {
  let host;
  try {
    host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  } catch {
    return DEVICE_TRANSPORTS.LOCAL;
  }
  const local =
    !host.includes('.') ||
    /\.(local|lan|home|internal|home\.arpa)$/i.test(host) ||
    /^(10|127)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^(fc|fd|fe80)/i.test(host) ||
    host === '::1';
  return local ? DEVICE_TRANSPORTS.LOCAL : DEVICE_TRANSPORTS.CLOUD;
}

export class YourlsHub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {object} options.store persistence (src/store.js)
   * @param {Function} [options.request] HTTP seam (src/yourls/client.js)
   * @param {boolean} [options.timers] the reading timer (off in tests)
   * @param {object} [options.timings] HUB_TIMINGS overrides
   * @param {() => number} [options.now]
   */
  constructor({ gladys, store, request, timers = true, timings, now }) {
    this.gladys = gladys;
    this.store = store;
    this.request = request;
    this.timersEnabled = timers;
    this.timings = { ...HUB_TIMINGS, ...timings };
    this.now = now ?? (() => Date.now());
    // Defaults until start(): a handler reached after a failed start still
    // answers with a readable message.
    this.config = normalizeConfig({});
    this.client = null;
    this.signature = null;
    this.version = '';
    /** @type {{ links: number, clicks: number, top: object[] }|null} */
    this.server = null;
    /** @type {Map<string, object|null>} the followed links by keyword, null when not found */
    this.followed = new Map();
    this.readAt = 0;
    this.error = null;
    this.failures = 0;
    this.reachable = null;
    this.polling = null;
    this.transport = null;
    this.connection = null;
    this.discovered = null;
    this.widgetSignature = null;
    this.saved = { clicks: {} };
    this.pollTimer = null;
    this.stopped = false;
    // What fails again at every cycle (Gladys refusing, the reading loop, a
    // followed link missing): one line when it starts, one when it ends.
    this.problems = new ProblemLog(logger);
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    const saved = await this.store.load();
    const clicks = saved?.clicks;
    this.saved = { clicks: clicks && typeof clicks === 'object' ? { ...clicks } : {} };
    await this.reconfigure(config);
  }

  /** Gladys reconnected (it restarted): send everything again. */
  async resync(config) {
    this.gladys.forgetPublishedStates?.();
    this.transport = null;
    this.connection = null;
    this.discovered = null;
    await this.reconfigure(config);
  }

  async reconfigure(config) {
    const previous = this.config;
    this.config = config;
    const signature = JSON.stringify([
      config.url,
      config.signature,
      config.username,
      config.password,
    ]);
    if (this.signature !== null && previous.url !== config.url) {
      // Another YOURLS: its links are not the ones remembered.
      this.saved.clicks = {};
    }
    if (signature !== this.signature) {
      this.signature = signature;
      this.client =
        missingCredentials(config) === null
          ? new YourlsClient({
              url: config.url,
              signature: config.signature,
              username: config.username,
              password: config.password,
              request: this.request,
            })
          : null;
      this.server = null;
      this.followed = new Map();
      this.version = '';
      this.readAt = 0;
      this.error = null;
      this.failures = 0;
      this.reachable = null;
      this.polling = null;
      this.transport = null;
    }
    // A link no longer followed is forgotten: followed again, it starts
    // without announcing the milestones it passed meanwhile.
    for (const keyword of Object.keys(this.saved.clicks)) {
      if (!config.keywords.includes(keyword)) {
        delete this.saved.clicks[keyword];
      }
    }
    try {
      if (this.client) {
        await this.pollNow({ publish: true });
      } else {
        await this.afterChanges(true, { publish: true });
      }
    } finally {
      this.schedulePoll();
    }
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.pollTimer);
    await this.store.flush();
  }

  schedulePoll() {
    clearTimeout(this.pollTimer);
    if (!this.timersEnabled || this.stopped || !this.client) {
      return;
    }
    this.pollTimer = setTimeout(async () => {
      try {
        await this.pollNow();
        this.problems.recover('poll', 'Reading YOURLS works again');
      } catch (err) {
        this.problems.fail('poll', `Poll failed: ${err.message}`, 'error');
      }
      this.schedulePoll();
    }, this.config.pollIntervalMs);
  }

  // --- Reading YOURLS ------------------------------------------------------------

  /** Read YOURLS now and publish what changed. */
  async pollNow({ publish = false } = {}) {
    const changed = await this.poll();
    await this.afterChanges(changed, { publish });
  }

  /** Read again when the last read failed or is older than `freshMs` (scene actions). */
  async refreshIfStale() {
    if (this.client && (this.error || this.now() - this.readAt >= this.timings.freshMs)) {
      await this.pollNow();
    }
  }

  /**
   * Read YOURLS and apply what changed. Concurrent calls share the read.
   * @returns {Promise<boolean>} whether the widget shows something new
   */
  poll() {
    if (!this.client) {
      return Promise.resolve(false);
    }
    if (!this.polling) {
      const polling = this.read(this.client).finally(() => {
        // A read of a previous client must not drop the promise of the current one.
        if (this.polling === polling) {
          this.polling = null;
        }
      });
      this.polling = polling;
    }
    return this.polling;
  }

  async read(client) {
    let result;
    try {
      result = await this.readServer(client);
    } catch (err) {
      if (!(err instanceof YourlsError)) {
        throw err;
      }
      return client === this.client && this.applyFailure(err);
    }
    return client === this.client && this.applySuccess(result);
  }

  /** The version (once), the totals and the top, and each followed link. */
  async readServer(client) {
    // Older YOURLS or a plugin may refuse `version`: not worth failing a read.
    const version = this.version || (await client.version().catch(() => ''));
    const server = await client.top(TOP_LINKS);
    const followed = new Map();
    for (const keyword of this.config.keywords) {
      try {
        followed.set(keyword, await client.link(keyword));
        this.problems.recover(`link ${keyword}`, `Short link "${keyword}" found again`);
      } catch (err) {
        if (!(err instanceof YourlsError) || err.kind !== ERROR_KINDS.NOT_FOUND) {
          throw err;
        }
        // A typo in the configuration, or a link deleted: the others go on.
        this.problems.fail(`link ${keyword}`, err.message);
        followed.set(keyword, null);
      }
    }
    return { version, server, followed };
  }

  async applySuccess({ version, server, followed }) {
    const firstRead = this.readAt === 0;
    if (this.error) {
      logger.info('YOURLS answers again');
    }
    if (firstRead) {
      logger.info(
        `YOURLS ${version || '?'} (${hostOf(this.config.url)}): ${server.links} link(s), ` +
          `${this.config.keywords.length} followed`,
      );
    }
    this.version = version;
    this.server = server;
    this.followed = followed;
    this.error = null;
    this.failures = 0;
    this.reachable = true;
    this.readAt = this.now();
    const signature = JSON.stringify(server);
    const widgetChanged = signature !== this.widgetSignature;
    this.widgetSignature = signature;

    let dirty = false;
    for (const [keyword, link] of followed) {
      if (link) {
        dirty = (await this.announceMilestones(keyword, link)) || dirty;
      }
    }
    // Written only when something changed: no wear of the SD card at every read.
    if (dirty) {
      this.store.save(this.saved);
    }
    await this.publishStates();
    return widgetChanged;
  }

  async applyFailure(err) {
    const wasError = this.error?.kind;
    this.error = { kind: err.kind, message: err.message };
    this.readAt = this.now();
    if (wasError !== err.kind) {
      logger.warn(`YOURLS: ${err.message}`);
    }
    if (DOWN_KINDS.has(err.kind)) {
      this.failures += 1;
      if (this.failures >= FAILURES_FOR_DOWN && this.reachable !== false) {
        logger.info('YOURLS is unreachable');
        this.reachable = false;
      }
    }
    await this.publishStates();
    return wasError !== err.kind;
  }

  /**
   * Fire "Click milestone" for each milestone a followed link passed since
   * the last read. The first read of a link only records its clicks; fewer
   * clicks than before (a link deleted and created again) start over.
   * @returns {Promise<boolean>} whether the saved state changed
   */
  async announceMilestones(keyword, link) {
    const before = this.saved.clicks[keyword];
    if (before === link.clicks) {
      return false;
    }
    this.saved.clicks[keyword] = link.clicks;
    if (!Number.isFinite(before) || link.clicks < before) {
      return true;
    }
    for (const milestone of passedMilestones(before, link.clicks)) {
      logger.info(`Short link "${keyword}" passed ${milestone} clicks`);
      await this.fire(TRIGGERS.MILESTONE, {
        keyword,
        milestone,
        clicks: link.clicks,
        short_url: link.shortUrl,
        long_url: link.longUrl,
        title: link.title,
      });
    }
    return true;
  }

  async fire(key, data) {
    try {
      await this.gladys.publishSceneEvent(key, data);
    } catch (err) {
      logger.warn(`Scene event ${key} refused: ${err.message}`);
    }
  }

  // --- Publishing to Gladys ----------------------------------------------------------

  isCreated() {
    const id = deviceIds(this.gladys).device;
    return (this.gladys.devices ?? []).some((device) => device.external_id === id);
  }

  /** Publish the Discovery list when it changed (a keyword added, a new address…). */
  async publishDevices({ force = false } = {}) {
    const devices = this.client
      ? [
          buildDevice(this.gladys, {
            host: hostOf(this.config.url),
            keywords: this.config.keywords,
            language: this.config.language,
          }),
        ]
      : [];
    const key = JSON.stringify(devices);
    if (!force && key === this.discovered) {
      return;
    }
    try {
      await this.gladys.publishDiscoveredDevices(devices);
      this.discovered = key;
      this.problems.recover('discovered', 'Discovered devices accepted again');
    } catch (err) {
      this.problems.fail('discovered', `Discovered devices refused: ${err.message}`);
    }
  }

  /** "Search" in the Discovery tab: read YOURLS, publish the device again. */
  async rediscover() {
    await this.poll();
    await this.afterChanges(true, { publish: true });
  }

  /**
   * The user added (or updated) the device: send all its states (the SDK
   * forgot what it had published for it), and its badge.
   */
  async onDeviceCreated() {
    this.transport = null;
    await this.publishStates();
    await this.publishTransports();
    this.gladys.requestWidgetRefresh(WIDGET_KEY);
  }

  /** Gladys asks for a refresh (onPoll, only if it polls anyway). */
  async pollDevice() {
    await this.pollNow();
  }

  /**
   * The states of the device, once added. The SDK skips the values Gladys
   * already has (and sends an unchanged one again after `heartbeatMs`).
   */
  async publishStates() {
    if (this.readAt === 0 || this.reachable === null || !this.isCreated()) {
      return;
    }
    // During an outage, `reachable` alone (once it counts as one).
    const states = deviceValues(this.gladys, {
      reachable: this.reachable,
      server: this.error ? null : this.server,
      followed: this.followed,
    });
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.problems.recover('states', 'States accepted again');
    } catch (err) {
      this.problems.fail('states', `States refused: ${err.message}`);
    }
  }

  async afterChanges(widgetChanged, { publish = false } = {}) {
    await this.publishDevices({ force: publish });
    await this.publishTransports();
    await this.publishConnectionStatus();
    if (widgetChanged) {
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    }
  }

  /** The badge of the device: local or cloud (by its address), or unreachable. */
  async publishTransports() {
    if (!this.client || this.readAt === 0 || !this.isCreated()) {
      return;
    }
    const transport = this.error ? DEVICE_TRANSPORTS.UNREACHABLE : transportOf(this.config.url);
    if (transport === this.transport) {
      return;
    }
    try {
      await this.gladys.publishTransports([
        { external_id: deviceIds(this.gladys).device, transport },
      ]);
      this.transport = transport;
      this.problems.recover('transports', 'Transports accepted again');
    } catch (err) {
      this.problems.fail('transports', `Transports refused: ${err.message}`);
    }
  }

  /** The status under the integration name. */
  connectionStatus() {
    const missing = missingCredentials(this.config);
    if (missing) {
      return { connected: false, message: CONNECTION_TEXT[missing] };
    }
    if (this.error) {
      return { connected: false, message: ERROR_TEXT[this.error.kind] };
    }
    return { connected: true };
  }

  async publishConnectionStatus() {
    const status = this.connectionStatus();
    const key = JSON.stringify(status);
    if (key === this.connection) {
      return;
    }
    try {
      await this.gladys.setConnectionStatus(status.connected, status.message);
      this.connection = key;
      this.problems.recover('connection', 'Connection status accepted again');
    } catch (err) {
      this.problems.fail('connection', `Connection status refused: ${err.message}`);
    }
  }

  // --- Views (widget, scene actions, report) ------------------------------------------

  /** Throws the reason YOURLS cannot answer, if any. */
  assertReadable() {
    const status = this.connectionStatus();
    if (!status.connected) {
      throw new Error(pick(status.message, this.config.language));
    }
  }

  /** "Test the connection": read YOURLS now, one line. */
  async testConnection() {
    await this.pollNow({ publish: true });
    const message = {};
    const status = this.connectionStatus();
    const missing = [...this.followed].filter(([, link]) => !link).map(([keyword]) => keyword);
    for (const [language, text] of Object.entries(REPORT_TEXT)) {
      if (!status.connected) {
        message[language] = pick(status.message, language);
        continue;
      }
      const parts = [text.ok, text.links(this.server.links), text.clicks(this.server.clicks)];
      if (missing.length > 0) {
        parts.push(text.missing(missing.join(', ')));
      }
      const name = this.version ? `YOURLS ${this.version}` : 'YOURLS';
      message[language] = labelled(name, parts.join(', '), language);
    }
    return message;
  }
}
