// Tests for Force Field's math (field.js). Run with:  node towns/topic-4-equation-valley/games/4-7-force-field/test_force_field_math.js
import assert from 'node:assert/strict';
import {
  seeded, fmt, ruleText, passes, passesAll, parseValue, lineFor, ticks, checkGraph, genRule, genGraph, genMeteors, genName3, genRead, genCount,
  genNeither, genOverlap, genGiftCard, genElevator, genZone, genBackup, ZONES, checkShower, checkName3, checkWritten, checkPick, workedSolution, SYMS,
} from './field.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 3000;
const rnd = seeded(20261115);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
const tilesOf = (text, letter) => text.split(' ').map((w) => (SYMS.includes(w) ? { t: 'sym', v: w } : w === letter ? { t: 'var', v: w } : { t: 'num', v: Number(w.replace(/[$,]/g, '')) }));

test('solutions, including the boundary, hundredths and 3y < 25', () => {
  const r = { letter: 'x', sym: '>', n: 7 };
  assert.deepEqual([6.99, 7, 7.01, 7.1].map((v) => passes(r, v)), [false, false, true, true], '7.01 IS a solution of x > 7');
  assert.ok(!passes({ letter: 't', sym: '>', n: 25 }, 25));
  assert.ok(passes({ letter: 'g', sym: '≤', n: 4 }, 4));
  const c = { letter: 'y', coef: 3, sym: '<', n: 25 };
  assert.equal(ruleText(c), '3y < 25');
  assert.deepEqual([6.5, 7, 8, 8.5, 9].map((v) => passes(c, v)), [true, true, true, false, false], 'the textbook\'s select-all problem');
  assert.ok(passesAll([{ letter: 't', sym: '≥', n: 15 }, { letter: 't', sym: '≤', n: 134 }], 15));
  assert.equal(fmt(1500), '1,500'); assert.equal(fmt(12.75, true), '$12.75'); assert.equal(fmt(7.01), '7.01');
});

test('typed values in many forms', () => {
  for (const [raw, v] of [['7.01', 7.01], ['$12.75', 12.75], ['2 1/2', 2.5], ['5/2', 2.5], ['1,505', 1505], ['.5', 0.5], [' 12 ', 12]]) assert.ok(Math.abs(parseValue(raw) - v) < 1e-9, raw);
  for (const raw of ['', 'abc', '2/0', '-3', '1.2.3']) assert.equal(parseValue(raw), null, raw);
});

test('number lines: whole numbers never below zero; tenths lines have only their ends labeled', () => {
  assert.deepEqual(lineFor({ letter: 'x', sym: '<', n: 3 }), { lo: 0, hi: 12, step: 1, labelEvery: true });
  const t = lineFor({ letter: 'y', sym: '<', n: 3.7 });
  assert.deepEqual(t, { lo: 3, hi: 4, step: 0.1, labelEvery: false });
  assert.equal(ticks(t).length, 11);
  assert.ok(ticks(t).includes(3.7));
  for (let i = 0; i < RUNS; i++) {
    const r = genRule(rnd, { decimal: i % 2 === 0 });
    const line = lineFor(r);
    assert.ok(line.lo >= 0 && ticks(line).some((v) => Math.abs(v - r.n) < 1e-9), `${ruleText(r)} is on its line`);
  }
});

test('graphing: each mistake has its own hint', () => {
  const r = { letter: 'y', sym: '<', n: 3.7 };
  assert.ok(checkGraph(r, { at: 3.7, closed: false, dir: 'left' }).correct);
  assert.equal(checkGraph(r, { at: 3.6, closed: false, dir: 'left' }).key, 'tenths');
  assert.equal(checkGraph(r, { at: 3.7, closed: true, dir: 'left' }).key, 'graph_circle');
  assert.equal(checkGraph(r, { at: 3.7, closed: false, dir: 'right' }).key, 'graph_direction');
  assert.equal(checkGraph({ letter: 'x', sym: '≥', n: 9 }, { at: 8, closed: true, dir: 'right' }).key, 'graph_number');
});

test(`meteor showers: ${RUNS}; boundary and near-boundary values, always some solutions and some not`, () => {
  let boundary = 0, hair = 0;
  for (let i = 0; i < RUNS; i++) {
    const p = i % 7 === 0 ? genOverlap(rnd) : i % 7 === 1 ? genElevator(rnd) : genMeteors(rnd, { coef: i % 3 === 0 });
    assert.equal(p.values.length, 5);
    assert.equal(new Set(p.values).size, 5, 'five different meteors');
    const yes = p.values.filter((v) => passesAll(p.rules, v)).length;
    assert.ok(yes > 0 && yes < 5, `mixed shower: ${p.rules.map(ruleText)} ${p.values}`);
    const all = new Set(p.values.map((v, j) => (passesAll(p.rules, v) ? j : -1)).filter((j) => j >= 0));
    assert.ok(checkShower(p, all).correct, 'zapping exactly the solutions wins');
    const none = checkShower(p, new Set());
    assert.ok(!none.correct && noJunk(none.message));
    if (p.values.some((v) => v === p.rules[0].n)) boundary++;
    if (p.values.some((v) => Math.abs(Math.abs(v - p.rules[0].n) - 0.01) < 1e-9)) hair++;
  }
  assert.ok(boundary > RUNS * 0.3 && hair > RUNS * 0.2, `boundary ${boundary}, a hundredth away ${hair}`);
});

test('meteor mistakes are explained: boundary, a hundredth away, substituting, both fields', () => {
  const p = { rules: [{ letter: 't', sym: '>', n: 25 }], values: [24, 25, 25.1, 27, 30] };
  assert.equal(checkShower(p, new Set([1, 2, 3, 4])).key, 'boundary_meteor', 'zapping 25 for t > 25');
  const q = { rules: [{ letter: 'x', sym: '>', n: 7 }], values: [6, 7, 7.01, 8, 9] };
  assert.equal(checkShower(q, new Set([3, 4])).key, 'decimal_near', 'missing 7.01');
  const c = { rules: [{ letter: 'y', coef: 3, sym: '<', n: 25 }], values: [6.5, 7, 8, 8.5, 9] };
  const res = checkShower(c, new Set([0, 1, 2, 3]));
  assert.equal(res.key, 'substitute');
  assert.match(res.message, /3 × 8.5 = 25.5/);
  const o = genOverlap(seeded(4));
  const lo = o.rules[0].n;
  const wrong = new Set(o.values.map((v, j) => (v >= lo ? j : -1)).filter((j) => j >= 0));
  if (o.values.some((v) => v > o.rules[1].n)) assert.ok(!checkShower(o, wrong).correct, 'too hot is not in BOTH fields');
});

test('name three: any three different correct values', () => {
  const le = { type: 'name3', rule: { letter: 'm', sym: '≤', n: 82 }, whole: false };
  const p = { type: 'name3', rule: { letter: 'x', sym: '>', n: 10.5 }, whole: false };
  assert.ok(checkName3(p, ['11', '10.6', '100']).correct);
  assert.ok(checkName3(p, ['10 3/4', '12', '1,000']).correct);
  assert.ok(checkName3(le, ['1', '0.5', '1/2']).nudge, '0.5 and 1/2 are the same value');
  assert.equal(checkName3(p, ['10.5', '11', '12']).key, 'boundary');
  assert.equal(checkName3(p, ['9', '11', '12']).key, 'wrong_side');
  assert.ok(checkName3(p, ['11', '11.0', '12']).nudge, 'the same value twice');
  assert.ok(checkName3(p, ['11', '', '12']).nudge);
  const w = { type: 'name3', rule: { letter: 'n', sym: '>', n: 21 }, whole: true };
  assert.ok(checkName3(w, ['22', '23', '50']).correct);
  assert.equal(checkName3(w, ['21.5', '23', '50']).key, 'not_whole');
  assert.ok(checkName3(le, ['82', '0.5', '1/4']).correct, 'the boundary counts for ≤, and fractions are fine');
  for (let i = 0; i < 1000; i++) {
    const g = genName3(rnd);
    const ex = workedSolution(g)[1].replace(/^For example: /, '').replace(/\.$/, '').split('; ');
    assert.equal(ex.length, 3);
    assert.ok(checkName3(g, ex).correct, `the worked example's values work: ${ruleText(g.rule)} ${ex}`);
  }
});

test('reading a field and Francine\'s gift card', () => {
  const p = { type: 'read', rule: { letter: 'y', sym: '<', n: 3.7 } };
  assert.ok(checkWritten(p, tilesOf('y < 3.7', 'y')).correct && checkWritten(p, tilesOf('3.7 > y', 'y')).correct);
  assert.equal(checkWritten(p, tilesOf('y ≤ 3.7', 'y')).key, 'graph_circle');
  assert.equal(checkWritten(p, tilesOf('y > 3.7', 'y')).key, 'graph_direction');
  assert.equal(checkWritten(p, tilesOf('3.7 < y', 'y')).key, 'flipped_order');
  for (let i = 0; i < 500; i++) {
    const g = genGiftCard(rnd);
    assert.equal(g.tiles.length, 4);
    const max = Math.max(...g.tiles), min = Math.min(...g.tiles);
    assert.ok(checkWritten(g, tilesOf(`v ≥ ${max}`, 'v')).correct);
    assert.equal(checkWritten(g, tilesOf(`v ≥ ${min}`, 'v')).key, 'not_max');
    assert.equal(checkWritten(g, tilesOf(`v > ${max}`, 'v')).key, 'graph_circle');
    assert.ok(noJunk(g.story));
  }
});

test('picks: how many solutions, and the value in neither field', () => {
  for (let i = 0; i < 500; i++) {
    for (const p of [genCount(rnd), genNeither(rnd)]) {
      assert.equal(p.options.length, 4);
      assert.equal(new Set(p.options.map((o) => o.text)).size, 4);
      assert.equal(p.options.filter((o) => o.ok).length, 1);
      p.options.forEach((o, j) => { const r = checkPick(p, j); assert.equal(r.correct, Boolean(o.ok)); assert.ok(noJunk(r.message)); });
      if (p.ask === 'neither') assert.ok(!passes(p.rules[0], p.rules[0].n) && !passes(p.rules[1], p.rules[0].n));
    }
  }
});

test('zones: right kinds, worked solutions and backups for everything', () => {
  assert.equal(ZONES.length, 5);
  for (let r = 0; r < 200; r++) {
    const zones = ZONES.map((_, z) => genZone(rnd, z));
    assert.ok(zones[0].every((p) => p.type === 'graph') && zones[0].some((p) => !Number.isInteger(p.rule.n)), 'some tenths lines');
    assert.ok(zones[1].every((p) => p.type === 'meteor') && zones[1].some((p) => p.rules[0].coef));
    assert.ok(zones[2].every((p) => p.type === 'name3') && zones[2].some((p) => p.whole));
    assert.ok(zones[3].some((p) => p.type === 'read') && zones[3].some((p) => p.type === 'pick'));
    assert.ok(zones[4].some((p) => p.rules?.length === 2) && zones[4].some((p) => p.gift) && zones[4].some((p) => p.ask === 'neither'));
    for (const p of zones.flat()) {
      const lines = workedSolution(p);
      assert.ok(lines.length >= 2 && lines.every(noJunk), `${p.type}: ${lines.join(' | ')}`);
      const b = genBackup(rnd, p);
      assert.equal(b.type, p.type);
      assert.equal(Boolean(b.gift), Boolean(p.gift));
      if (p.type === 'meteor') assert.equal(b.rules.length, p.rules.length);
    }
  }
});

console.log(`\n${passed} tests passed`);
