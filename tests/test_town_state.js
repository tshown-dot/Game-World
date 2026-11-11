// Tests the shared town engine's progress rules (shared/town/townState.js).  Run with:  node tests/test_town_state.js
import assert from 'node:assert/strict';
import { TownState, calculateStars } from '../shared/town/townState.js';

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS', name); }

const STAGES = [
  { id: 's1', lessonCode: '4-1', built: false },
  { id: 's2', lessonCode: '4-2', built: true, xpReward: 150, coinsReward: 50 },
  { id: 's3', lessonCode: '4-3', built: false },
  { id: 's4', lessonCode: '4-4', built: true },
  { id: 'boss', lessonCode: 'BOSS', built: false, isBoss: true },
];

function fakeStore(students) {
  const saved = {}, results = [];
  return {
    saved, results,
    async loadStudent(code) {
      const s = students[code];
      if (!s) return { ok: false, error: 'bad_code' };
      return { ok: true, open: s.open || [], fullAccess: Boolean(s.full), progress: s.progress || null };
    },
    saveProgress(code, p) { saved[code] = JSON.parse(JSON.stringify(p)); return Promise.resolve({ pending: 0 }); },
    logResult(code, r) { results.push({ code, ...r }); return Promise.resolve({ pending: 0 }); },
  };
}
const make = (store) => new TownState({ townId: 'topic_4', label: 'topic-4', stages: STAGES.map((s) => ({ ...s })), store });

await test('stars from score', () => {
  assert.equal(calculateStars(9, 10), 3);
  assert.equal(calculateStars(7, 10), 2);
  assert.equal(calculateStars(3, 10), 1);
});

await test('first BUILT stage is open; unbuilt stages are "wip"; later stages wait', async () => {
  const s = make(fakeStore({ K7M2QX: { open: [false, false, false, true] } }));
  await s.load('K7M2QX');
  assert.equal(s.stageState('s1'), 'wip');
  assert.equal(s.stageState('s2'), 'open', 'Counterweight is open even though 4-1 is not built');
  assert.equal(s.stageState('s3'), 'wip');
  assert.equal(s.stageState('s4'), 'locked');
  assert.equal(s.stageState('boss'), 'wip');
});

await test('a stage a student already cleared stays open even if an earlier stage is built later', async () => {
  const stages = STAGES.map((s) => ({ ...s }));
  stages[0].built = true;                     // 4-1 gets built after the student already cleared 4-2
  const s = new TownState({ townId: 'topic_4', label: 'topic-4', stages, store: fakeStore({ K7M2QX: {
    open: [false, false, false, true], progress: { towns: { topic_4: { nodeRecords: { s2: { cleared: true, stars: 2 } } } } },
  } }) });
  await s.load('K7M2QX');
  assert.equal(s.stageState('s1'), 'open', 'the new first stage is open');
  assert.equal(s.stageState('s2'), 'open', 'the stage they already cleared is still open');
  assert.equal(s.stageState('s4'), 'open', 'and so is the one after it');
  const fresh = new TownState({ townId: 'topic_4', label: 'topic-4', stages, store: fakeStore({ NEW222: { open: [false, false, false, true] } }) });
  await fresh.load('NEW222');
  assert.equal(fresh.stageState('s2'), 'locked', 'a new student starts at the new first stage');
});

await test('clearing a stage opens the next built one, skipping unbuilt ones', async () => {
  const store = fakeStore({ K7M2QX: { open: [false, false, false, true] } });
  const s = make(store);
  await s.load('K7M2QX');
  const r = s.completeStage('s2', { score: 9, total: 10, bossDefeated: true });
  assert.equal(r.stars, 3);
  assert.equal(r.opened && r.opened.id, 's4', 'next BUILT stage opens');
  assert.equal(s.stageState('s4'), 'open');
});

await test('saving keeps other towns untouched and logs a result row for the sheet', async () => {
  const store = fakeStore({ K7M2QX: { open: [false, false, false, true], progress: {
    v: 1, level: 3, xp: 20, coins: 200, towns: { topic_3: { nodeRecords: { node_3_1: { cleared: true, stars: 3 } }, unlockedNodes: ['node_3_1'] } },
  } } });
  const s = make(store);
  await s.load('k7m-2qx');
  assert.equal(s.level, 3);
  s.completeStage('s2', { score: 7, total: 10, bossDefeated: true, practiceMode: true });
  const saved = store.saved.K7M2QX;
  assert.equal(saved.towns.topic_4.nodeRecords.s2.cleared, true);
  assert.equal(saved.towns.topic_3.nodeRecords.node_3_1.stars, 3, 'Expression Town data untouched');
  assert.deepEqual(saved.towns.topic_3.unlockedNodes, ['node_3_1']);
  assert.equal(saved.coins, 250);
  const row = store.results.at(-1);
  assert.deepEqual(
    { code: row.code, town: row.town, lesson: row.lesson, game: row.game, score: row.score, attempted: row.problems_attempted, acc: row.accuracy, boss: row.boss_defeated, practice: row.practice_mode },
    { code: 'K7M2QX', town: 'topic-4', lesson: '4-2', game: 's2', score: 7, attempted: 10, acc: 70, boss: true, practice: true },
  );
});

await test('the boss: a practice clear is marked practiceOnly; a timed win clears that for good', async () => {
  const BOSS = STAGES.map((st) => ({ ...st, built: true }));
  const store = fakeStore({ K7M2QX: { full: true } });
  const s = new TownState({ townId: 'topic_4', label: 'topic-4', stages: BOSS, store });
  await s.load('K7M2QX');
  s.completeStage('s2', { score: 8, total: 10, practiceMode: true });
  assert.equal(s.records.s2.practiceOnly, undefined, 'ordinary buildings: practice still counts');
  s.completeStage('boss', { score: 8, total: 10, bossDefeated: true, practiceMode: true });
  assert.equal(s.records.boss.cleared, true); assert.equal(s.records.boss.practiceOnly, true);
  s.completeStage('boss', { score: 9, total: 10, bossDefeated: true, practiceMode: false });
  assert.equal(s.records.boss.practiceOnly, undefined, 'a timed win defeats the boss');
  s.completeStage('boss', { score: 5, total: 10, bossDefeated: true, practiceMode: true });
  assert.equal(s.records.boss.practiceOnly, undefined, 'practicing later never takes the win away');
});

await test('a replay keeps the best stars and best score', async () => {
  const store = fakeStore({ K7M2QX: { open: [false, false, false, true] } });
  const s = make(store);
  await s.load('K7M2QX');
  s.completeStage('s2', { score: 10, total: 10 });
  s.completeStage('s2', { score: 4, total: 10 });
  assert.equal(s.records.s2.stars, 3);
  assert.equal(s.records.s2.bestScore, 10);
});

await test('a game can report its own stars', async () => {
  const s = make(fakeStore({ K7M2QX: { open: [false, false, false, true] } }));
  await s.load('K7M2QX');
  assert.equal(s.completeStage('s2', { score: 1, total: 10, stars: 2 }).stars, 2);
});

await test('full access opens every built stage, never unbuilt ones, and never rewrites records', async () => {
  const store = fakeStore({ TEACH2: { full: true } });
  const s = make(store);
  await s.load('TEACH2');
  assert.equal(s.stageState('s4'), 'open');
  assert.equal(s.stageState('s3'), 'wip');
  assert.deepEqual(s.records, {});
});

await test('the town itself can be locked: Equation Valley needs the Expression Town boss, or a teacher tick', async () => {
  const locked = make(fakeStore({ K7M2QX: {} }));
  const r = await locked.load('K7M2QX');
  assert.equal(r.success, true);
  assert.equal(r.townLocked, true);
  assert.match(r.reason, /Expression Town boss/);
  const ticked = make(fakeStore({ K7M2QX: { open: [false, false, false, true] } }));
  assert.equal((await ticked.load('K7M2QX')).townLocked, undefined);
  const beat = make(fakeStore({ K7M2QX: { progress: { towns: { topic_3: { nodeRecords: { node_apex: { cleared: true } } } } } } }));
  assert.equal((await beat.load('K7M2QX')).townLocked, undefined, 'beating the Expression Town boss opens it');
  const teacher = make(fakeStore({ TEACH2: { full: true } }));
  assert.equal((await teacher.load('TEACH2')).townLocked, undefined);
});

await test('bad and unknown codes are refused', async () => {
  const s = make(fakeStore({}));
  assert.deepEqual(await s.load('nope'), { success: false, error: 'bad_shape' });
  assert.deepEqual(await s.load('AAAAAA'), { success: false, error: 'bad_code' });
});

console.log(`\n${passed} tests passed`);
