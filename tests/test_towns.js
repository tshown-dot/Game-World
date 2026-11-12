// Tests the town list and unlock rules in shared/towns.js.  Run with:  node tests/test_towns.js
import assert from 'node:assert/strict';
import { TOWNS, townStates, townSummary, townsOf } from '../shared/towns.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const stateOf = (states, n, grade = 6) => states.find((s) => s.town.number === n && s.town.grade === grade).state;

test('8 Grade 6 towns then 8 Grade 7 towns, numbered 1-8, with unique ids', () => {
  assert.equal(TOWNS.length, 16);
  assert.deepEqual(TOWNS.map((t) => t.grade), [...Array(8).fill(6), ...Array(8).fill(7)], 'Grade 6 first: the order matches the sheet flags');
  for (const g of [6, 7]) assert.deepEqual(townsOf(g).map((t) => t.number), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(new Set(TOWNS.map((t) => t.id)).size, 16);
  assert.deepEqual(townsOf(6).map((t) => t.id), [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `topic_${n}`), 'Grade 6 ids never change');
  assert.ok(townsOf(7).every((t) => t.id.startsWith('g7_')));
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


/* ---- Grade 7 Isles: open only by teacher tick or full access (owner decision) ---- */
const G7 = (flags) => [...Array(8).fill(false), ...flags];
const allG6Beaten = { towns: { topic_3: { nodeRecords: { node_apex: { cleared: true } } }, topic_4: { nodeRecords: { node_4_boss: { cleared: true } } } } };

test('Grade 7: Factor Falls is locked by default, even after beating every Grade 6 boss', () => {
  assert.equal(stateOf(townStates({}), 4, 7), 'locked');
  const s = townStates({ progress: allG6Beaten });
  assert.equal(stateOf(s, 4, 7), 'locked');
  assert.match(s.find((e) => e.town.id === 'g7_topic_4').reason, /Ask your teacher/);
  assert.equal(stateOf(townStates({ open: [true, true, true, true, true, true, true, true] }), 4, 7), 'locked', 'Grade 6 ticks do not open Grade 7');
  assert.equal(stateOf(townStates({ open: [false, false, false, true] }), 4, 7), 'locked', 'an older sheet script (8 flags) leaves Grade 7 closed');
});

test('Grade 7: a teacher tick or a full-access code opens Factor Falls; unbuilt Grade 7 towns stay coming soon', () => {
  const ticked = townStates({ open: G7([false, false, false, true]) });
  assert.equal(stateOf(ticked, 4, 7), 'open');
  assert.equal(stateOf(ticked, 4, 6), 'locked', 'a Grade 7 tick does not open Grade 6 towns');
  assert.equal(stateOf(ticked, 3, 6), 'open');
  const full = townStates({ fullAccess: true });
  assert.equal(stateOf(full, 4, 7), 'open');
  for (const n of [1, 2, 3, 5, 6, 7, 8]) assert.equal(stateOf(townStates({ open: G7(Array(8).fill(true)), fullAccess: true }), n, 7), 'soon');
  const played = townStates({ progress: { towns: { g7_topic_4: { nodeRecords: { node_g7_4_1: { cleared: true } } } } } });
  assert.equal(stateOf(played, 4, 7), 'open', 'once played, it never locks again (even if the tick is removed)');
});

test('Grade 7: beating a Grade 7 boss opens the next built Grade 7 town, and nothing in Grade 6', () => {
  const t5 = TOWNS.find((t) => t.id === 'g7_topic_5');
  const saved = { built: t5.built, bossId: t5.bossId };
  t5.built = true; t5.bossId = 'node_g7_5_boss';
  try {
    const beat = { towns: { g7_topic_4: { nodeRecords: { node_g7_4_boss: { cleared: true } } } } };
    assert.equal(stateOf(townStates({ progress: beat }), 5, 7), 'open');
    const locked = townStates({});
    assert.equal(stateOf(locked, 5, 7), 'locked');
    assert.match(locked.find((e) => e.town.id === 'g7_topic_5').reason, /Factor Falls boss/);
    assert.equal(stateOf(townStates({ progress: beat }), 4, 6), 'locked', 'Grade 6 Equation Valley still needs its own boss');
  } finally { t5.built = saved.built; t5.bossId = saved.bossId; }
});

console.log(`\n${passed} tests passed`);
