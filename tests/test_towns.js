// Tests the town list and unlock rules in shared/towns.js.  Run with:  node tests/test_towns.js
import assert from 'node:assert/strict';
import { TOWNS, townStates, townSummary } from '../shared/towns.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const stateOf = (states, n) => states.find((s) => s.town.number === n).state;

test('there are 8 towns, numbered 1-8, with unique ids', () => {
  assert.equal(TOWNS.length, 8);
  assert.deepEqual(TOWNS.map((t) => t.number), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(new Set(TOWNS.map((t) => t.id)).size, 8);
  assert.ok(TOWNS.filter((t) => t.built).every((t) => t.url && t.bossId), 'built towns have a page and a boss');
});

test('a brand-new student: Expression Town is open, Equation Valley is locked, unbuilt towns are coming soon', () => {
  const s = townStates({});
  assert.equal(stateOf(s, 3), 'open');
  assert.equal(stateOf(s, 4), 'locked');
  for (const n of [1, 2, 5, 6, 7, 8]) assert.equal(stateOf(s, n), 'soon', `town ${n}`);
});

test('a teacher tick cannot open a town that is not built', () => {
  const s = townStates({ open: [true, true, true, true, true, true, true, true] });
  assert.equal(stateOf(s, 1), 'soon');
  assert.equal(stateOf(s, 5), 'soon');
  assert.equal(stateOf(s, 4), 'open');
});

test('full access opens every built town but not unbuilt ones', () => {
  const s = townStates({ fullAccess: true });
  assert.equal(stateOf(s, 3), 'open');
  assert.equal(stateOf(s, 4), 'open');
  assert.equal(stateOf(s, 5), 'soon');
});

test('summary counts stages, stars and the boss', () => {
  const town = TOWNS[2];
  const progress = { towns: { topic_3: { nodeRecords: {
    node_3_1: { cleared: true, stars: 3 }, node_3_2: { cleared: true, stars: 2 }, node_3_3: { cleared: false },
  } } } };
  assert.deepEqual(townSummary(town, progress), { cleared: 2, stars: 5, bossBeaten: false, played: true });
  progress.towns.topic_3.nodeRecords.node_apex = { cleared: true, stars: 1 };
  assert.equal(townSummary(town, progress).bossBeaten, true);
  assert.deepEqual(townSummary(town, null), { cleared: 0, stars: 0, bossBeaten: false, played: false });
});

test('a boss cleared only in practice mode is not beaten (owner decision)', () => {
  const valley = TOWNS[3];
  const progress = { towns: { topic_4: { nodeRecords: { node_4_boss: { cleared: true, stars: 2, practiceOnly: true } } } } };
  assert.equal(townSummary(valley, progress).bossBeaten, false);
  progress.towns.topic_4.nodeRecords.node_4_boss.practiceOnly = undefined;
  assert.equal(townSummary(valley, progress).bossBeaten, true);
});

test('Equation Valley stays locked until the Expression Town boss is beaten, then opens', () => {
  const before = townStates({ progress: { towns: { topic_3: { nodeRecords: { node_3_1: { cleared: true } } } } } });
  assert.equal(stateOf(before, 4), 'locked');
  assert.match(before[3].reason, /Expression Town boss/);
  const after = townStates({ progress: { towns: { topic_3: { nodeRecords: { node_apex: { cleared: true } } } } } });
  assert.equal(stateOf(after, 4), 'open');
  assert.equal(stateOf(townStates({ open: [false, false, false, true] }), 4), 'open', 'a teacher tick opens it early');
  const played = townStates({ progress: { towns: { topic_4: { nodeRecords: { node_4_2: { cleared: true } } } } } });
  assert.equal(stateOf(played, 4), 'open', 'once played, it never locks again');
});

test('future: building Town 1 later never locks a student out of a town they already played', () => {
  const t1 = TOWNS[0];
  const saved = { built: t1.built, bossId: t1.bossId };
  t1.built = true; t1.bossId = 'node_1_boss';
  try {
    const played = townStates({ progress: { towns: { topic_3: { nodeRecords: { node_3_1: { cleared: true } } } } } });
    assert.equal(stateOf(played, 1), 'open', 'Town 1 becomes the first built town');
    assert.equal(stateOf(played, 3), 'open', 'Town 3 stays open because they already played it');
    const fresh = townStates({});
    assert.equal(stateOf(fresh, 3), 'locked', 'a brand-new student would now start at Town 1');
  } finally {
    t1.built = saved.built; t1.bossId = saved.bossId;
  }
});

console.log(`\n${passed} tests passed`);
