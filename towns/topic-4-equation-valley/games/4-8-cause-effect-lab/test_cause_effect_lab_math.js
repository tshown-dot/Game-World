// Tests for Cause and Effect Lab (lab.js). Run with:  node towns/topic-4-equation-valley/games/4-8-cause-effect-lab/test_cause_effect_lab_math.js
import assert from 'node:assert/strict';
import {
  seeded, PAIRS, UNRELATED, HUNTS, TIME_SITUATIONS, genWire, genHunt, genDial, genTime, genCritique, genBuild, genJonas, genZone, genBackup, ZONES,
  checkWire, checkHunt, checkDial, checkTime, checkPick, checkBuild, buildablePairs, workedSolution,
} from './lab.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261116);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);

test('the experiment list is consistent', () => {
  assert.ok(PAIRS.length >= 15);
  for (const p of PAIRS) {
    assert.ok(noJunk(p.cause.name) && noJunk(p.effect.name) && /^[a-zA-Z]$/.test(p.cause.letter) && /^[a-zA-Z]$/.test(p.effect.letter));
    assert.notEqual(p.cause.letter, p.effect.letter, `${p.cause.name}: two different letters`);
    assert.ok(['up', 'down'].includes(p.dir));
  }
  assert.ok(PAIRS.filter((p) => p.dir === 'down').length >= 3, 'some "more cause, less effect" pairs');
  for (const u of UNRELATED) assert.ok(!PAIRS.some((p) => p.cause.name === u.cause.name), 'unrelated causes are not real causes');
  for (const h of HUNTS) { assert.ok(h.yes.length >= 4 && h.no.length >= 4); assert.equal(new Set([...h.yes, ...h.no]).size, h.yes.length + h.no.length); }
  assert.ok(TIME_SITUATIONS.filter((s) => s.time === 'cause').length >= 3 && TIME_SITUATIONS.filter((s) => s.time === 'effect').length >= 3);
});

test(`wiring: ${RUNS} experiments; cause on the DIAL is right, backwards is caught`, () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genWire(rnd);
    const cause = p.cards.find((c) => c.role === 'cause'), effect = p.cards.find((c) => c.role === 'effect');
    assert.ok(checkWire(p, cause, effect).correct);
    const back = checkWire(p, effect, cause);
    assert.ok(!back.correct && back.key === 'swapped' && noJunk(back.message));
    assert.ok(checkWire(p, cause, null).nudge);
  }
  const j = genJonas(seeded(1));
  assert.equal(j.pair.cause.letter, 'L');
  assert.ok(noJunk(j.story) && /gallons/.test(j.story));
});

test(`factor hunts: ${RUNS}; six cards, some affect and some don't, every mistake explained`, () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genHunt(rnd);
    assert.equal(p.cards.length, 6);
    const yes = p.cards.map((c, j) => (c.affects ? j : -1)).filter((j) => j >= 0);
    assert.ok(yes.length >= 3 && yes.length <= 4);
    assert.ok(checkHunt(p, new Set(yes)).correct);
    const all = checkHunt(p, new Set([0, 1, 2, 3, 4, 5]));
    assert.equal(all.key, 'unrelated_factor');
    const some = checkHunt(p, new Set(yes.slice(1)));
    assert.equal(some.key, 'missed_factor');
    assert.ok(noJunk(all.message) && noJunk(some.message));
  }
});

test('turn the dial: up, down and same; "more is always more" is caught', () => {
  const freezer = { type: 'dial', pair: PAIRS.find((p) => /freezer/.test(p.cause.name)) };
  assert.ok(checkDial(freezer, 'down').correct);
  assert.equal(checkDial(freezer, 'up').key, 'more_is_more');
  const tickets = { type: 'dial', pair: PAIRS[0] };
  assert.ok(checkDial(tickets, 'up').correct);
  assert.equal(checkDial(tickets, 'down').key, 'direction');
  for (let i = 0; i < RUNS; i++) {
    const p = genDial(rnd, { same: i % 4 === 0 });
    for (const a of ['up', 'down', 'same']) { const r = checkDial(p, a); assert.equal(r.correct, a === p.pair.dir); assert.ok(noJunk(r.message)); }
    if (p.pair.dir === 'same') assert.equal(checkDial(p, 'up').key, 'not_related');
  }
});

test('time can be the cause or the effect', () => {
  for (const s of TIME_SITUATIONS) {
    const p = { type: 'time', situation: s };
    assert.ok(checkTime(p, s.time).correct);
    const other = checkTime(p, s.time === 'cause' ? 'effect' : 'cause');
    assert.ok(!other.correct && noJunk(other.message));
  }
});

test('the pants critique: either-one and backwards are caught', () => {
  for (let i = 0; i < 500; i++) {
    const p = genCritique(rnd);
    assert.equal(p.options.length, 4);
    assert.equal(p.options.filter((o) => o.ok).length, 1);
    p.options.forEach((o, j) => { const r = checkPick(p, j); assert.equal(r.correct, Boolean(o.ok)); assert.ok(noJunk(r.message)); });
    assert.equal(checkPick(p, p.options.findIndex((o) => o.trap === 'either_one')).key, 'either_one');
    assert.ok(noJunk(p.ask));
  }
});

test(`build your own: ${RUNS} banks; every bank can make a real experiment; backwards and unrelated are caught`, () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genBuild(rnd);
    assert.ok(p.cards.length >= 5 && p.cards.length <= 6);
    assert.equal(new Set(p.cards.map((c) => c.name)).size, p.cards.length, 'no repeated cards');
    const ok = buildablePairs(p);
    assert.ok(ok.length >= 1);
    const x = ok[0];
    const dial = p.cards.find((c) => c.name === x.cause.name), meter = p.cards.find((c) => c.name === x.effect.name);
    assert.ok(checkBuild(p, dial, meter).correct);
    assert.equal(checkBuild(p, meter, dial).key, 'swapped');
    const stranger = p.cards.find((c) => !PAIRS.some((y) => y.cause.name === c.name || y.effect.name === c.name));
    if (stranger) assert.equal(checkBuild(p, stranger, meter).key, 'not_related');
  }
});

test('zones: right kinds, worked solutions and backups for everything', () => {
  assert.equal(ZONES.length, 5);
  for (let r = 0; r < 200; r++) {
    const zones = ZONES.map((_, z) => genZone(rnd, z));
    assert.ok(zones[0].every((p) => p.type === 'wire') && new Set(zones[0].map((p) => p.pair.cause.name)).size === zones[0].length, 'different experiments');
    assert.ok(zones[1].every((p) => p.type === 'hunt') && new Set(zones[1].map((p) => p.effect)).size === zones[1].length);
    assert.ok(zones[2].every((p) => p.type === 'dial') && zones[2].some((p) => p.pair.dir === 'down') && zones[2].some((p) => p.pair.dir === 'same'));
    assert.ok(zones[3].some((p) => p.type === 'time') && zones[3].some((p) => p.type === 'pick'));
    assert.deepEqual(new Set(zones[4].map((p) => p.type)), new Set(['wire', 'dial', 'hunt', 'pick', 'build']));
    for (const p of zones.flat()) {
      const lines = workedSolution(p);
      assert.ok(lines.length >= 2 && lines.every(noJunk), `${p.type}: ${lines.join(' | ')}`);
      assert.equal(genBackup(rnd, p).type, p.type);
    }
  }
});

console.log(`\n${passed} tests passed`);
