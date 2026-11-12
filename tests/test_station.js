// Tests Station Mode (shared/station.js and the station parts of shared/progressStore.js). Run with: node tests/test_station.js
import assert from 'node:assert/strict';
import { startStation, getStation, lockedToTown, STATION_CODE } from '../shared/station.js';
import { createStore } from '../shared/progressStore.js';

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS', name); }
function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _map: m };
}

await test('?station turns a tab into a station; the scope is the page it started on', () => {
  const s = memoryStorage();
  assert.equal(startStation('world', { search: '', storage: s }), null, 'no ?station: normal sign-in');
  assert.deepEqual(startStation('world', { search: '?station', storage: s }), { scope: 'world' });
  assert.deepEqual(startStation('topic_4', { search: '', storage: s }), { scope: 'world' }, 'walking into a town keeps the world station');
  const t = memoryStorage();
  assert.deepEqual(startStation('topic_3', { search: '?station', storage: t }), { scope: 'topic_3' });
  assert.ok(lockedToTown(getStation(t), 'topic_3') && !lockedToTown(getStation(t), 'topic_4') && !lockedToTown(getStation(s), 'topic_3'));
  assert.equal(startStation('topic_3', { search: '?station=off', storage: t }), null, '?station=off goes back to normal');
  assert.equal(getStation(t), null);
  assert.ok(!/^[A-HJ-NP-Z2-9]{6}$/.test(STATION_CODE), 'the station code can never be a real student code');
});

await test('a station store: everything open, stars kept in the tab only, nothing sent to the sheet', async () => {
  const calls = [];
  const local = memoryStorage(), tab = memoryStorage();
  const store = createStore({ endpoint: 'https://example.test/exec', fetchImpl: async (url, init) => { calls.push(url); return { ok: true, json: async () => ({ ok: true }) }; },
    storage: local, stationStorage: tab, inStation: () => true, sleep: async () => {} });
  assert.equal(store.getActiveCode(), STATION_CODE, 'no sign-in: the station code is used');
  const res = await store.loadStudent(STATION_CODE, { fast: true });
  assert.ok(res.ok && res.fullAccess && res.open.length === 16 && res.open.every(Boolean) && res.source === 'station');
  assert.equal(res.progress, null);
  await store.saveProgress(STATION_CODE, { v: 1, xp: 50, towns: { topic_4: { nodeRecords: { a: { cleared: true } } } } });
  await store.logResult(STATION_CODE, { town: 'topic_4', score: 5 });
  assert.equal(calls.length, 0, 'not one request to the sheet');
  assert.equal(local._map.size, 0, 'nothing written to the Chromebook\'s long-term storage');
  const again = await store.loadStudent(STATION_CODE);
  assert.equal(again.progress.xp, 50, 'stars come back while the tab is open');
  assert.equal(store.pendingCount(STATION_CODE), 0);
  assert.ok(store.hasDeviceCopy(STATION_CODE));
  store.setActiveCode(STATION_CODE); store.clearActiveCode();
  assert.equal(local._map.size, 0, 'the real remembered code is left alone');
});

await test('outside a station, the station code is just a wrong code and sign-in works as before', async () => {
  const local = memoryStorage();
  local.setItem('gw_active_code', 'K7M2QX');
  const store = createStore({ endpoint: 'https://example.test/exec', fetchImpl: async () => ({ ok: true, json: async () => ({ ok: true, open: [], full_access: false, progress: null }) }),
    storage: local, inStation: () => false, sleep: async () => {} });
  assert.equal(store.getActiveCode(), 'K7M2QX');
  assert.equal(store.normalizeCode('station'), null, 'typing STATION at sign-in does nothing');
});

console.log(`\n${passed} tests passed`);
