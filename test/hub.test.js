// -----------------------------------------------------------------------------
// The integration end to end, against the SDK's fake Gladys and a fake YOURLS:
// discovery, states, the "Click milestone" trigger, outages, the widget, the
// scene actions, the timer of the container, quiet logs.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { TRIGGERS, WIDGET_KEY, passedMilestones, transportOf } from '../src/hub.js';
import {
  BASE,
  SIGNATURE,
  createDevices,
  createWorld,
  FakeYourls,
  idsOf,
  linkFeature,
  sampleYourls,
} from './helpers/world.js';

const stateOf = (world, featureId) =>
  world.fake.states.filter((s) => s.device_feature_external_id === featureId).at(-1);
const milestones = (world) => world.fake.sceneEvents.filter((e) => e.key === TRIGGERS.MILESTONE);

async function tick(world, ms = 300_000) {
  world.clock.advance(ms);
  await world.hub.pollNow();
}

test('discovery: one device, a feature per followed link, nothing published before an add', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  assert.deepEqual(world.fake.connectionStatus, { connected: true });
  const [device, ...others] = world.fake.discoveredDevices;
  assert.equal(others.length, 0);
  assert.equal(device.name, 'YOURLS sho.rt');
  assert.equal(device.should_poll, false);
  assert.deepEqual(
    device.features.map((f) => f.name),
    [
      'Reachable',
      'Short links',
      'Clicks',
      'Clicks of the top link',
      'Most clicked link',
      'Clicks: news',
      'Clicks: menu',
    ],
  );
  assert.equal(
    device.features[5].external_id,
    'ext:test-integration:instance:yourls:link_clicks:news',
  );
  assert.equal(world.fake.states.length, 0);
});

test('the added device: totals, top link, followed links, then only the changes', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createDevices(world);
  const ids = idsOf(world);
  assert.equal(stateOf(world, ids.feature('reachable')).state, 1);
  assert.equal(stateOf(world, ids.feature('links')).state, 3);
  assert.equal(stateOf(world, ids.feature('clicks')).state, 10);
  assert.equal(stateOf(world, ids.feature('top_clicks')).state, 8);
  assert.equal(stateOf(world, ids.feature('top_link')).text, 'news');
  assert.equal(stateOf(world, linkFeature(world, 'news')).state, 8);
  assert.equal(stateOf(world, linkFeature(world, 'menu')).state, 0);
  // A public address: the cloud badge.
  assert.deepEqual(world.fake.transports.at(-1), {
    device_external_id: ids.device,
    transport: 'cloud',
  });
  assert.ok(world.fake.widgetRefreshes.includes(WIDGET_KEY));

  const before = world.fake.states.length;
  await tick(world);
  assert.equal(world.fake.states.length, before, 'nothing changed, nothing sent');
  world.yourls.click('menu', 3);
  await tick(world);
  assert.deepEqual(
    world.fake.states.slice(before).map((s) => s.device_feature_external_id),
    [ids.feature('clicks'), linkFeature(world, 'menu')],
  );
});

test('click milestone: the first read records, each milestone passed fires once', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await tick(world);
  assert.equal(milestones(world).length, 0, 'the first read announces nothing');
  world.yourls.click('menu', 10);
  world.yourls.click('news', 50); // 8 -> 58: 10, 25 and 50
  world.yourls.click('docs', 100); // not followed
  await tick(world);
  const fired = milestones(world).map((e) => [e.data.keyword, e.data.milestone]);
  assert.deepEqual(fired, [
    ['news', 10],
    ['news', 25],
    ['news', 50],
    ['menu', 10],
  ]);
  assert.deepEqual(milestones(world).at(-1).data, {
    keyword: 'menu',
    milestone: 10,
    clicks: 10,
    short_url: 'https://sho.rt/menu',
    long_url: 'https://www.example.com/menu',
    title: 'Menu',
  });
  await tick(world);
  assert.equal(milestones(world).length, 4, 'never twice');
});

test('click milestone: kept across a restart, forgotten for a link no longer followed', async (t) => {
  const yourls = sampleYourls();
  const first = await createWorld({ yourls });
  await first.app.stop();
  // Clicks while the integration was stopped.
  yourls.click('news', 2);
  const second = await createWorld({ yourls, dataDir: first.dataDir });
  t.after(() => second.app.stop());
  assert.deepEqual(
    milestones(second).map((e) => e.data.milestone),
    [10],
  );
  // menu unfollowed, then followed again: no milestone for the clicks meanwhile.
  await second.fake.configUpdated({ url: BASE, signature: SIGNATURE, keywords: 'news' });
  yourls.click('menu', 30);
  await second.fake.configUpdated({ url: BASE, signature: SIGNATURE, keywords: 'news,menu' });
  assert.equal(milestones(second).length, 1);
});

test('click milestone: one Gladys refused is fired again at the next read', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const publish = world.gladys.publishSceneEvent.bind(world.gladys);
  let refuse = true;
  world.gladys.publishSceneEvent = async (key, data) => {
    if (refuse && data.milestone === 25) {
      throw new Error('429 Too Many Requests');
    }
    return publish(key, data);
  };
  world.yourls.click('news', 50); // 8 -> 58: 10, then 25 refused
  await tick(world);
  assert.deepEqual(
    milestones(world).map((e) => e.data.milestone),
    [10],
  );
  refuse = false;
  await tick(world);
  assert.deepEqual(
    milestones(world).map((e) => e.data.milestone),
    [10, 25, 50],
  );
  await tick(world);
  assert.equal(milestones(world).length, 3);
});

test('click milestone: another YOURLS address, even set while stopped, starts over', async (t) => {
  const yourls = sampleYourls();
  const first = await createWorld({ yourls });
  await first.app.stop();
  yourls.click('news', 50);
  const second = await createWorld({
    yourls,
    dataDir: first.dataDir,
    config: { url: `${BASE}/`, signature: SIGNATURE, keywords: 'news' },
  });
  t.after(() => second.app.stop());
  // `https://sho.rt/` is the same address once normalized: kept.
  assert.equal(milestones(second).length, 3);
  await second.app.stop();
  // Another YOURLS, whose `news` has far more clicks than the one remembered.
  const other = new FakeYourls({ base: 'https://go.example.test' });
  other.addLink({ keyword: 'news', clicks: 500 });
  const third = await createWorld({
    yourls: other,
    dataDir: first.dataDir,
    config: { url: 'go.example.test', signature: SIGNATURE, keywords: 'news' },
  });
  t.after(() => third.app.stop());
  assert.deepEqual(third.fake.connectionStatus, { connected: true });
  assert.equal(milestones(third).length, 0, 'nothing announced');
});

test('a keyword not found: no state for it, the rest goes on, the report says it', async (t) => {
  const world = await createWorld({
    config: { url: BASE, signature: SIGNATURE, keywords: 'news, nope', language: 'en' },
  });
  t.after(() => world.app.stop());
  await createDevices(world);
  assert.equal(stateOf(world, linkFeature(world, 'nope')), undefined);
  assert.equal(stateOf(world, linkFeature(world, 'news')).state, 8);
  assert.deepEqual(world.fake.connectionStatus, { connected: true });
  const ack = await world.fake.action('test_connection');
  assert.equal(
    ack.data.message.en,
    'YOURLS 1.10.6: Connected, 3 link(s), 10 click(s), keyword(s) not found: nope',
  );
  assert.match(ack.data.message.fr, /^YOURLS 1\.10\.6 : Connecté/);
});

test('an outage: unreachable after two failed reads, back after one', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createDevices(world);
  const reachable = idsOf(world).feature('reachable');
  world.yourls.down = true;
  await tick(world);
  assert.equal(stateOf(world, reachable).state, 1, 'one lost answer is not an outage');
  assert.deepEqual(world.fake.connectionStatus, { connected: true });
  assert.equal(world.fake.transports.at(-1).transport, 'cloud');
  await tick(world);
  assert.equal(stateOf(world, reachable).state, 0);
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.equal(world.fake.connectionStatus.message.fr, 'YOURLS ne répond pas');
  assert.equal(world.fake.transports.at(-1).transport, 'unreachable');
  world.yourls.down = false;
  await tick(world);
  assert.equal(stateOf(world, reachable).state, 1);
  assert.deepEqual(world.fake.connectionStatus, { connected: true });
  assert.equal(world.fake.transports.at(-1).transport, 'cloud');
});

test('credentials: a wrong token is reported, a username and password work', async (t) => {
  const wrong = await createWorld({ config: { url: BASE, signature: 'nope', language: 'en' } });
  t.after(() => wrong.app.stop());
  assert.equal(wrong.fake.connectionStatus.connected, false);
  assert.equal(wrong.fake.connectionStatus.message.en, 'signature token or password refused');
  const password = await createWorld({
    config: { url: `${BASE}/admin/`, username: 'admin', password: 'pw' },
  });
  t.after(() => password.app.stop());
  assert.deepEqual(password.fake.connectionStatus, { connected: true });
  assert.ok(password.yourls.requests.every((form) => !('signature' in form)));
  const empty = await createWorld({ config: { url: BASE } });
  t.after(() => empty.app.stop());
  assert.equal(empty.fake.connectionStatus.connected, false);
  assert.match(empty.fake.connectionStatus.message.fr, /jeton de signature/);
  assert.deepEqual(empty.fake.discoveredDevices, []);
});

test('the widget: totals, the most clicked links, settings, error and empty states', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const get = async (settings = {}, language = 'fr') => {
    const ack = await world.fake.widgetGet(WIDGET_KEY, { settings, language });
    assert.equal(ack.success, true, ack.error);
    validateWidgetContent(ack.data.content);
    return ack.data.content.components;
  };
  let components = await get();
  assert.deepEqual(
    components.map((c) => c.type),
    ['value', 'value', 'status', 'button'],
  );
  assert.equal(components[0].value, 10);
  assert.equal(components[0].label, 'Clics');
  assert.deepEqual(
    components[2].items.map((item) => [item.label, item.value]),
    [
      ['news · Newsletter', 8],
      ['docs', 2],
      ['menu · Menu', 0],
    ],
  );
  components = await get({ rows: '5', show_totals: false, show_refresh: false });
  assert.deepEqual(
    components.map((c) => c.type),
    ['status'],
  );

  const refresh = await world.fake.widgetAction(WIDGET_KEY, 'refresh', {});
  assert.equal(refresh.success, true, refresh.error);
  assert.equal(refresh.data.message.en, 'YOURLS read again.');

  world.yourls.down = true;
  await tick(world);
  components = await get({}, 'en');
  assert.equal(components.find((c) => c.type === 'text').text, 'YOURLS does not answer');

  const empty = await createWorld({ yourls: new (sampleYourls().constructor)() });
  t.after(() => empty.app.stop());
  const ack = await empty.fake.widgetGet(WIDGET_KEY, { settings: {}, language: 'en' });
  assert.equal(ack.data.content.components[0].text, 'No short link yet: create one in YOURLS.');
});

test('scene action "shorten_url": new link, existing address, checks and errors', async (t) => {
  const world = await createWorld({
    config: { url: BASE, signature: SIGNATURE, keywords: '', language: 'fr' },
  });
  t.after(() => world.app.stop());
  let ack = await world.fake.sceneAction('shorten_url', {
    url: 'https://www.example.com/menu-du-jour',
    keyword: 'midi',
    title: 'Menu du jour',
  });
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(ack.data.outputs, {
    keyword: 'midi',
    short_url: 'https://sho.rt/midi',
    long_url: 'https://www.example.com/menu-du-jour',
    title: 'Menu du jour',
    clicks: 0,
    created: true,
  });
  ack = await world.fake.sceneAction('shorten_url', { url: 'https://www.example.org/newsletter' });
  assert.equal(ack.data.outputs.short_url, 'https://sho.rt/news');
  assert.equal(ack.data.outputs.created, false);
  ack = await world.fake.sceneAction('shorten_url', { url: 'https://x.example/', keyword: 'news' });
  assert.equal(ack.success, false);
  assert.equal(ack.error, 'ce mot-clé est déjà pris ou réservé');
  for (const url of ['', 'notaurl', 'ftp://x.example/', `https://x.example/${'a'.repeat(2000)}`]) {
    ack = await world.fake.sceneAction('shorten_url', { url });
    assert.equal(ack.success, false, url);
    assert.match(ack.error, /http:\/\/ ou https:\/\//);
  }
  const before = world.yourls.requests.length;
  ack = await world.fake.sceneAction('shorten_url', { url: 'https://x.example/', keyword: 'a b' });
  assert.match(ack.error, /lettres, des chiffres/);
  assert.equal(world.yourls.requests.length, before, 'nothing reached YOURLS');
});

test('scene action "get_link_clicks": any link, by keyword or short address', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  let ack = await world.fake.sceneAction('get_link_clicks', { keyword: 'https://sho.rt/docs' });
  assert.equal(ack.success, true, ack.error);
  assert.equal(ack.data.outputs.clicks, 2);
  assert.equal(ack.data.outputs.keyword, 'docs');
  ack = await world.fake.sceneAction('get_link_clicks', { keyword: 'nope' });
  assert.equal(ack.success, false);
  assert.equal(ack.error, 'no short link with this keyword');
});

test('the container reads YOURLS on its own timer, without onPoll', async (t) => {
  const world = await createWorld({
    clock: { time: Date.now(), now: () => Date.now() },
    timers: true,
  });
  t.after(() => world.app.stop());
  // A one-minute interval would make this test slow: shorten the timer.
  world.hub.config.pollIntervalMs = 20;
  world.hub.schedulePoll();
  const before = world.yourls.requests.length;
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.ok(world.yourls.requests.length > before);
});

test('a normal cycle writes nothing at the info level, and no secret ever', async (t) => {
  const lines = [];
  const original = process.stdout.write.bind(process.stdout);
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createDevices(world);
  const level = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'info';
  process.stdout.write = (chunk) => {
    lines.push(String(chunk));
    return true;
  };
  let quiet;
  try {
    world.yourls.click('docs');
    await tick(world);
    await tick(world);
    quiet = [...lines];
    // The capture works: an outage is a lifecycle line.
    world.yourls.down = true;
    await tick(world);
    await tick(world);
  } finally {
    process.stdout.write = original;
    process.env.LOG_LEVEL = level;
  }
  assert.deepEqual(quiet, []);
  assert.ok(
    lines.some((line) => line.includes('YOURLS is unreachable')),
    lines.join(''),
  );
  assert.ok(!lines.join('').includes(SIGNATURE));
});

test('passedMilestones and transportOf', () => {
  assert.deepEqual(passedMilestones(8, 58), [10, 25, 50]);
  assert.deepEqual(passedMilestones(10, 24), []);
  assert.deepEqual(passedMilestones(999_999, 2_000_000), [1_000_000]);
  for (const url of ['http://192.168.1.10', 'http://yourls', 'http://s.lan', 'http://[fd00::1]']) {
    assert.equal(transportOf(url), 'local', url);
  }
  assert.equal(transportOf('https://sho.rt'), 'cloud');
});
