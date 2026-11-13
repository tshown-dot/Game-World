// Tests for Cause and Effect Lab (lab.js). Run with:  node towns/topic-4-equation-valley/games/4-8-cause-effect-lab/test_cause_effect_lab_math.js
import assert from 'node:assert/strict';
import {
  seeded, PAIRS, SOLO, UNRELATED, TIME_PAIRS, HUNTS, ZONES, fmt, level, genWire, checkWire, genBelt, checkBelt, beltAnswer, genWay, checkWay,
  genSpot, checkSpot, spotAnswer, genBuild, buildable, checkBuild, buildAnswer, genMystery, testCrank, checkMystery, mysteryAnswer, genZone,
} from './lab.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261116);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);

test('the experiment lists are consistent, and every machine has five readings', () => {
  assert.ok(PAIRS.length >= 15 && SOLO.length >= 6);
  for (const p of [...PAIRS, ...UNRELATED, ...TIME_PAIRS]) {
    assert.ok(noJunk(p.cause.name) && noJunk(p.effect.name) && /^[a-zA-Z]$/.test(p.cause.letter) && /^[a-zA-Z]$/.test(p.effect.letter));
    assert.notEqual(p.cause.letter, p.effect.letter, `${p.cause.name}: two different letters`);
    assert.ok(p.xs.length === 5 && p.ys.length === 5 && p.ys.every((y) => typeof y === 'number'));
    for (let i = 0; i < 5; i++) { assert.ok(noJunk(fmt(p.xs[i], p.cause.unit)) && noJunk(fmt(p.ys[i], p.effect.unit))); assert.ok(level(p, i) >= 0 && level(p, i) <= 100); }
  }
  for (const p of [...PAIRS, ...TIME_PAIRS]) {
    assert.ok(['up', 'down'].includes(p.dir));
    for (let i = 1; i < 5; i++) { assert.ok(p.xs[i] > p.xs[i - 1], `${p.cause.name}: the crank turns up`); assert.ok(p.dir === 'up' ? p.ys[i] > p.ys[i - 1] : p.ys[i] < p.ys[i - 1], `${p.effect.name} moves one way`); }
    assert.ok(level(p, 0) !== level(p, 4));
  }
  assert.ok(PAIRS.filter((p) => p.dir === 'down').length >= 3, 'some "more cause, less effect" experiments');
  for (const u of UNRELATED) { assert.equal(u.dir, 'same'); assert.equal(level(u, 0), 50); assert.ok(!PAIRS.some((p) => p.cause.name === u.cause.name)); }
  assert.equal(new Set(PAIRS.map((p) => p.cause.name)).size, PAIRS.length); assert.equal(new Set(PAIRS.map((p) => p.effect.name)).size, PAIRS.length);
  assert.equal(new Set(SOLO.flatMap((p) => [p.cause.name, p.effect.name])).size, SOLO.length * 2);
  for (const h of HUNTS) { assert.ok(h.yes.length >= 4 && h.no.length >= 4); assert.equal(new Set([...h.yes, ...h.no]).size, h.yes.length + h.no.length); }
  for (const kind of ['cause', 'effect']) assert.ok(TIME_PAIRS.filter((p) => p.time === kind).length >= 3);
  for (const p of TIME_PAIRS) assert.ok(/minutes|hours|days/.test(p.time === 'cause' ? p.cause.name : p.effect.name), 'the time variable is where it says');
});

test('readings are written the way a student would', () => {
  assert.equal(fmt(3, 'tickets'), '3 tickets'); assert.equal(fmt(15, '$'), '$15'); assert.equal(fmt(54, '°F'), '54°F'); assert.equal(fmt('blue', ''), 'blue'); assert.equal(fmt(2.5, 'hours'), '2.5 hours');
  const pizza = PAIRS.find((p) => p.cause.letter === 'k');
  assert.equal(pizza.dir, 'down'); assert.ok(level(pizza, 0) > level(pizza, 4)); assert.equal(level(pizza, 0), 88); assert.equal(level(pizza, 4), 12);
});

test(`wire: ${RUNS} machines; the cause on the crank is right, backwards is caught`, () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genWire(rnd), cause = p.tags.find((t) => t.role === 'cause'), effect = p.tags.find((t) => t.role === 'effect');
    assert.equal(p.tags.length, 2); assert.ok(checkWire(p, cause).ok && noJunk(checkWire(p, cause).message));
    const back = checkWire(p, effect); assert.ok(!back.ok && back.key === 'swapped' && noJunk(back.message));
    assert.ok(checkWire(p, null).nudge);
  }
  for (const pair of TIME_PAIRS) {
    const p = genWire(rnd, pair), back = checkWire(p, p.tags.find((t) => t.role === 'effect'));
    assert.equal(back.key, pair.time === 'effect' ? 'time_always_cause' : 'swapped'); assert.ok(checkWire(p, p.tags.find((t) => t.role === 'cause')).ok);
  }
});

test(`belt: ${RUNS} hunts; plugging and passing each tag`, () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genBelt(rnd), yes = p.tags.filter((t) => t.affects).length;
    assert.ok(p.tags.length === 6 && (yes === 3 || yes === 4) && noJunk(p.effect) && noJunk(beltAnswer(p)));
    p.tags.forEach((t, k) => {
      const plug = checkBelt(p, k, true), pass = checkBelt(p, k, false);
      if (t.affects) { assert.ok(plug.ok && !plug.quiet && noJunk(plug.message)); assert.ok(!pass.ok && pass.key === 'missed_factor' && pass.message.includes(t.name)); }
      else { assert.ok(pass.ok && pass.quiet); assert.ok(!plug.ok && plug.key === 'unrelated_factor' && plug.message.includes(t.name)); }
    });
  }
  for (const h of HUNTS) assert.equal(genBelt(rnd, h).effect, h.effect);
});

test('which way: up, down or the same', () => {
  for (let i = 0; i < RUNS; i++) {
    const dir = [null, 'up', 'down', 'same'][i % 4], p = genWay(rnd, dir), want = p.pair.dir;
    if (dir) assert.equal(want, dir);
    assert.ok(checkWay(p, want).ok && noJunk(checkWay(p, want).message)); assert.ok(checkWay(p, null).nudge);
    for (const a of ['up', 'down', 'same']) {
      if (a === want) continue;
      const res = checkWay(p, a); assert.ok(!res.ok && noJunk(res.message));
      assert.equal(res.key, want === 'same' ? 'not_related' : want === 'down' && a === 'up' ? 'more_is_more' : 'direction');
    }
  }
  const mine = genWay(rnd, null, SOLO[0]); assert.equal(mine.pair, SOLO[0]);
});

test('spot: exactly one machine is backwards', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genSpot(rnd);
    assert.equal(p.machines.length, 3); assert.equal(p.machines.filter((m) => m.backwards).length, 1); assert.ok(p.machines[p.bad].backwards && noJunk(spotAnswer(p)));
    assert.equal(new Set(p.machines.flatMap((m) => [m.crank.name, m.gauge.name])).size, 6);
    p.machines.forEach((m, k) => {
      const res = checkSpot(p, k); assert.ok(noJunk(res.message));
      if (m.backwards) { assert.ok(res.ok); assert.equal(m.crank, m.pair.effect); } else { assert.equal(res.key, 'fine_machine'); assert.equal(m.crank, m.pair.cause); }
    });
  }
});

test('build: any real experiment in the bank counts', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genBuild(rnd), tag = (name) => p.tags.find((t) => t.name === name), can = buildable(p);
    assert.ok(p.tags.length === 6 && new Set(p.tags.map((t) => t.name)).size === 6 && can.length === 2 && noJunk(buildAnswer(p)));
    for (const x of can) {
      const res = checkBuild(p, tag(x.cause.name), tag(x.effect.name)); assert.ok(res.ok && res.pair === x);
      assert.equal(checkBuild(p, tag(x.effect.name), tag(x.cause.name)).key, 'swapped');
    }
    assert.equal(checkBuild(p, tag(can[0].cause.name), tag(can[1].effect.name)).key, 'not_related');
    const decoy = p.tags.find((t) => !can.some((x) => [x.cause.name, x.effect.name].includes(t.name)));
    assert.equal(checkBuild(p, decoy, tag(can[0].effect.name)).key, 'not_related'); assert.ok(checkBuild(p, decoy, null).nudge);
  }
});

test('mystery gauge: one crank moves it, and two tests are always enough', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genMystery(rnd);
    assert.ok(p.pairs.length === 3 && p.tests === 2 && p.options.length === 3 && noJunk(mysteryAnswer(p)));
    assert.equal([0, 1, 2].filter((k) => testCrank(p, k)).length, 1); assert.ok(testCrank(p, p.real) && p.pair === p.pairs[p.real]);
    assert.deepEqual([...p.options].sort(), p.pairs.map((x) => x.effect.name).sort());
    p.options.forEach((name, k) => { const res = checkMystery(p, k); assert.ok(noJunk(res.message)); assert.equal(res.ok, name === p.pair.effect.name); if (!res.ok) assert.equal(res.key, 'wrong_gauge'); });
  }
});

test('zones', () => {
  assert.equal(ZONES.length, 5);
  for (let i = 0; i < 300; i++) {
    const z = [0, 1, 2, 3, 4].map((k) => genZone(rnd, k)), types = (k) => z[k].map((r) => r.type);
    assert.ok(z[0].length === 6 && z[0].every((r) => r.type === 'wire') && new Set(z[0].map((r) => r.pair)).size === 6);
    assert.ok(z[1].length === 3 && z[1].every((r) => r.type === 'belt') && new Set(z[1].map((r) => r.effect)).size === 3);
    assert.ok(z[2].length === 6 && z[2].every((r) => r.type === 'way'));
    for (const d of ['up', 'down', 'same']) assert.ok(z[2].some((r) => r.pair.dir === d), `zone 3 has a gauge that goes ${d}`);
    assert.deepEqual(types(3), ['wire', 'wire', 'wire', 'wire', 'spot', 'spot']);
    assert.equal(z[3].filter((r) => r.pair && r.pair.time === 'cause').length, 2); assert.equal(z[3].filter((r) => r.pair && r.pair.time === 'effect').length, 2);
    assert.deepEqual(types(4), ['mystery', 'belt', 'build', 'spot', 'mystery', 'build']);
  }
});

console.log(`\n${passed} tests passed`);
