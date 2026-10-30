// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake YOURLS, a temporary
// /data and a manual clock, with the integration wired on top through
// registerHandlers. No timer runs: the tests read YOURLS with
// `world.hub.pollNow()`. (From guim31/gladys-shlink.)
// -----------------------------------------------------------------------------

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { deviceIds, linkFeatureKey } from '../../src/devices.js';
import { Store } from '../../src/store.js';
import { BASE, FakeYourls, SIGNATURE } from './fakeYourls.js';

// The integration logs every change; keep the test output readable.
process.env.LOG_LEVEL ??= 'silent';

/** A manual clock, shared by the hub and the tests: 30/10/2026, 10:00 local. */
export function createClock(start = new Date(2026, 9, 30, 10, 0, 0).getTime()) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/** A YOURLS with three links, `news` the most clicked. */
export function sampleYourls() {
  const yourls = new FakeYourls();
  yourls.addLink({
    keyword: 'news',
    url: 'https://www.example.org/newsletter',
    title: 'Newsletter',
    clicks: 8,
  });
  yourls.addLink({ keyword: 'docs', url: 'https://www.example.com/docs', clicks: 2 });
  yourls.addLink({
    keyword: 'menu',
    url: 'https://www.example.com/menu',
    title: 'Menu',
    clicks: 0,
  });
  return yourls;
}

export async function createWorld({
  yourls = sampleYourls(),
  config = { url: BASE, signature: SIGNATURE, keywords: 'news, menu', language: 'en' },
  devices = [],
  connect = true,
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-yourls-')),
  clock = createClock(),
  timings = {},
  timers = false,
} = {}) {
  const gladys = createFakeGladys({ config, devices });
  const app = registerHandlers(gladys, {
    store: new Store(dataDir),
    request: yourls.request,
    timers,
    timings,
    now: clock.now,
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
  }
  return { gladys, fake: gladys.fake, yourls, app, hub: app.hub, clock, dataDir };
}

export const idsOf = (world) => deviceIds(world.gladys);
export const linkFeature = (world, keyword) => idsOf(world).feature(linkFeatureKey(keyword));

/** Add the discovered device in Gladys, as the user would. */
export async function createDevices(world) {
  for (const device of world.fake.discoveredDevices) {
    await world.fake.deviceCreated(device);
  }
}

export { BASE, FakeYourls, SIGNATURE };
