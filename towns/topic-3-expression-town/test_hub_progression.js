// Expression Town (Topic 3) on the shared town engine: stage order, unlocks, older saves, full access, saving.
// Run with:  node towns/topic-3-expression-town/test_hub_progression.js
//
// The town's buildings come from js/expressionTown.js (built from js/nodes.js); the rules come from
// shared/town/townState.js. Older saves (from the town's own engine) must keep every building they had open.
import assert from 'node:assert/strict';
import { STAGES, CONFIG } from './js/expressionTown.js';
import { TownState } from '../../shared/town/townState.js';

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS', name); }

function fakeStore(students) {
  const saved = {}, results = []; let loads = 0;
  return {
    saved, results, get loads() { return loads; },
    async loadStudent(code) {
      loads++;
      const s = students[code];
      if (s === 'offline') return { ok: false, error: 'offline' };
      if (!s) return { ok: false, error: 'bad_code' };
      return { ok: true, open: s.open || [false, false, true], fullAccess: Boolean(s.full), progress: s.progress || null };
    },
    saveProgress(code, p) { saved[code] = JSON.parse(JSON.stringify(p)); return Promise.resolve({ pending: 0 }); },
    logResult(code, r) { results.push({ code, ...r }); return Promise.resolve({ pending: 0 }); },
  };
}
const make = (store) => new TownState({ townId: CONFIG.townId, label: CONFIG.label, stages: STAGES, store, legacyIds: CONFIG.legacyIds });
const withSave = async (topic3) => {
  const s = make(fakeStore({ K7M2QX: { progress: { v: 1, towns: { topic_3: topic3 } } } }));
  await s.load('K7M2QX');
  return s;
};
const ORDER = ['node_3_1', 'node_3_2', 'node_3_2_lcm', 'node_3_3', 'node_3_4_expr', 'node_3_5', 'node_3_6', 'node_3_7', 'node_apex'];

await test('stage order, lessons and games', () => {
  assert.deepEqual(STAGES.map((s) => s.id), ORDER);
  assert.deepEqual(STAGES.map((s) => s.lessonCode), ['3-1', '3-2', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7', 'BOSS']);
  assert.ok(STAGES.every((s) => s.built && s.url && s.url.startsWith('./cartridges/') && s.coords && s.building));
  assert.equal(STAGES.find((s) => s.id === 'node_3_2_lcm').url, './cartridges/lcm/index.html');
  assert.equal(STAGES.find((s) => s.id === 'node_3_4_expr').url, './cartridges/algebraic/index.html');
  assert.equal(STAGES.find((s) => s.id === 'node_3_6').url, './cartridges/distributive/index.html');
  assert.ok(STAGES.at(-1).isBoss && STAGES.filter((s) => s.isBoss).length === 1, 'the Boss Castle is the only boss');
  assert.ok(!STAGES.some((s) => s.id === 'node_3_4'), 'the old node_3_4 id is not a stage');
  assert.equal(CONFIG.legacyIds.node_3_4, 'node_3_2_lcm');
});

await test('roads: the road from 3-3 to 3-4 crosses the river on the bridge', () => {
  const road = [STAGES[3].coords, ...STAGES[4].via, STAGES[4].coords];
  assert.ok(road.some((p, i) => i > 0 && p.y === road[i - 1].y && Math.min(p.x, road[i - 1].x) < 580 && Math.max(p.x, road[i - 1].x) > 580 && p.y === 545), 'a level stretch passes x = 580 at the bridge (y 490 + 55)');
  for (let i = 1; i < STAGES.length; i++) {
    const pts = [STAGES[i - 1].coords, ...STAGES[i].via, STAGES[i].coords];
    for (let k = 1; k < pts.length; k++) assert.ok(pts[k].x === pts[k - 1].x || pts[k].y === pts[k - 1].y, `road ${i} turns square corners`);
  }
});

await test('a new student: only 3-1 open, then each clear opens the next', async () => {
  const s = await withSave({});
  assert.deepEqual(ORDER.map((id) => s.stageState(id)), ['open', ...Array(8).fill('locked')]);
  for (let i = 0; i < ORDER.length - 1; i++) {
    assert.equal(s.stageState(ORDER[i + 1]), 'locked', `${ORDER[i + 1]} locked before ${ORDER[i]} is cleared`);
    const res = s.completeStage(ORDER[i], { score: 9, total: 10 });
    assert.equal(s.stageState(ORDER[i + 1]), 'open', `clearing ${ORDER[i]} opens ${ORDER[i + 1]}`);
    assert.equal(res.opened && res.opened.id, ORDER[i + 1]);
    if (ORDER[i + 2]) assert.equal(s.stageState(ORDER[i + 2]), 'locked');
  }
});

await test('older save: cleared 3-5 while 3-6 was being built (3-7 open, 3-6 never added)', async () => {
  const s = await withSave({ unlockedNodes: ['node_3_1', 'node_3_2', 'node_3_2_lcm', 'node_3_3', 'node_3_4_expr', 'node_3_5', 'node_3_7'], nodeRecords: { node_3_5: { cleared: true, stars: 3 } } });
  assert.equal(s.stageState('node_3_6'), 'open');
  assert.equal(s.stageState('node_3_7'), 'open');
  assert.equal(s.stageState('node_apex'), 'locked', 'nothing past what they reached');
});

await test('older save: LCM was Stage 3-4 (node_3_4)', async () => {
  const gcfOnly = await withSave({ unlockedNodes: ['node_3_1', 'node_3_2', 'node_3_3', 'node_3_4'], nodeRecords: { node_3_2: { cleared: true, stars: 3 } } });
  assert.equal(gcfOnly.stageState('node_3_2_lcm'), 'open', 'the LCM unlock carries over');
  assert.equal(gcfOnly.stageState('node_3_3'), 'open', 'keeps 3-3 open');
  assert.equal(gcfOnly.stageState('node_3_4_expr'), 'locked', 'does NOT get the new 3-4 for free');
  const lcmDone = await withSave({ unlockedNodes: ['node_3_1', 'node_3_2', 'node_3_3', 'node_3_4', 'node_3_5'], nodeRecords: { node_3_4: { cleared: true, stars: 2, bestScore: 8, total: 10 } } });
  assert.equal(lcmDone.records.node_3_2_lcm.stars, 2, 'LCM stars move to the 3-2 LCM stage');
  assert.equal(lcmDone.records.node_3_4, undefined, 'the old record key is gone');
  assert.equal(lcmDone.stageState('node_3_4_expr'), 'open', 'a student already past 3-4 gets the new 3-4');
  assert.equal(lcmDone.stageState('node_3_5'), 'open');
  assert.equal(lcmDone.stageState('node_3_6'), 'locked', 'nothing ahead of the student');
  const pemdas = await withSave({ unlockedNodes: ['node_3_1', 'node_3_2', 'node_3_3'], nodeRecords: {} });
  assert.equal(pemdas.stageState('node_3_2_lcm'), 'open', 'a student with 3-3 open gets the LCM stage that now sits before it');
});

await test('sign-in, full access, saving and the results log', async () => {
  const store = fakeStore({
    K7M2QX: {}, TEACH2: { full: true }, XYZ234: 'offline',
    S4VEE2: { open: [false, false, true, true, false, false, false, false], progress: {
      v: 1, level: 3, xp: 40, coins: 120,
      towns: { topic_3: { unlockedNodes: ['node_3_1', 'node_3_2'], nodeRecords: { node_3_1: { cleared: true, stars: 3, bestScore: 10, total: 10 } } }, topic_4: { nodeRecords: { node_4_2: { cleared: true } } } },
    } },
  });
  const s = make(store);
  for (const bad of ['', '12', 'K7M2Q0']) assert.equal((await s.load(bad)).success, false, `rejects "${bad}"`);
  assert.equal(store.loads, 0, 'bad code shapes never ask the sheet');
  assert.equal((await make(store).load('AAAAAA')).error, 'bad_code');
  assert.equal((await make(store).load('XYZ234')).error, 'offline');
  const fresh = make(store);
  assert.ok((await fresh.load(' k7m-2qx ')).success && fresh.code === 'K7M2QX', 'tidies the code');
  assert.ok(fresh.level === 1 && fresh.coins === 50 && !fresh.fullAccess);
  const teacher = make(store);
  await teacher.load('TEACH2');
  assert.ok(ORDER.every((id) => teacher.stageState(id) === 'open'), 'full access opens everything, Boss Castle included');
  const r = make(store);
  await r.load('S4VEE2');
  assert.ok(r.level === 3 && r.xp === 40 && r.coins === 120 && r.records.node_3_1.stars === 3);
  assert.ok(r.stageState('node_3_2') === 'open' && r.stageState('node_3_3') === 'locked');
  const win = r.completeStage('node_3_2', { score: 8, total: 10, bossDefeated: true, practiceMode: false });
  assert.ok(win.stars === 2 && win.opened.id === 'node_3_2_lcm');
  const saved = store.saved.S4VEE2;
  assert.equal(saved.towns.topic_3.nodeRecords.node_3_2.cleared, true);
  assert.deepEqual(saved.towns.topic_3.unlockedNodes, ['node_3_1', 'node_3_2'], 'the old unlock list is passed through');
  assert.equal(saved.towns.topic_4.nodeRecords.node_4_2.cleared, true, "another town's data is untouched");
  const row = store.results.at(-1);
  assert.deepEqual([row.code, row.town, row.lesson, row.game, row.score, row.problems_attempted, row.accuracy, row.boss_defeated, row.practice_mode],
    ['S4VEE2', 'topic-3', '3-2', 'node_3_2', 8, 10, 80, true, false]);
  assert.ok(!JSON.stringify([store.saved, store.results]).match(/pin|passcode|password|"name"/i), 'nothing mentions pins, passcodes or names');
});

await test('the Boss Castle: a practice-only clear does not beat the town boss', async () => {
  const s = await withSave({ nodeRecords: Object.fromEntries(ORDER.slice(0, 8).map((id) => [id, { cleared: true, stars: 3 }])) });
  s.completeStage('node_apex', { score: 9, total: 10, practiceMode: true });
  assert.equal(s.records.node_apex.practiceOnly, true);
  s.completeStage('node_apex', { score: 9, total: 10, practiceMode: false });
  assert.equal(s.records.node_apex.practiceOnly, undefined);
});

console.log(`\n${passed} tests passed`);
