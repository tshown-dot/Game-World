// Tests for Trail Mapper (trail.js). Run with:  node towns/topic-4-equation-valley/games/4-10-trail-mapper/test_trail_mapper_math.js
import assert from 'node:assert/strict';
import {
  seeded, fmt, parseNumber, run, ruleText, plugIn, needs, fitGrid, snap, ZONES, near,
  genPlot, genRead, genMeaning, genRule, genOdd, genOffPoint, genMary, genGoal, genZone, genBackup,
  checkPlot, checkRead, checkMeaning, checkRule, checkOdd, checkOffPoint, checkMary, checkGoal, workedSolution,
} from './trail.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261112);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
const typed = (v) => fmt(v).replace('−', '-');
const onGrid = (g, q) => near(q.x / g.xStep, Math.round(q.x / g.xStep)) && near(q.y / g.yStep, Math.round(q.y / g.yStep)) && q.x >= 0 && q.y >= 0 && q.x <= g.xMax && q.y <= g.yMax;

test('numbers, rules and the map', () => {
  for (const [raw, want] of [['91', 91], ['$50', 50], ['50.00', 50], ['1,250', 1250], ['2.5', 2.5], ['-5', -5]]) assert.equal(parseNumber(raw), want, raw);
  for (const raw of ['', 'x', '(3, 4)', '1/2']) assert.equal(parseNumber(raw), null, raw);
  assert.equal(run({ form: 'minus', m: 2, b: 5 }, 4), 3);
  assert.equal(ruleText({ form: 'line', m: 0.5, b: 1 }, 'w', 'p'), 'p = 0.5w + 1');
  assert.equal(plugIn({ form: 'line', m: 5, b: 5 }, 't', 'd', 3), 'd = 5(3) + 5 = 20');
  assert.deepEqual(fitGrid([{ x: 1, y: 4 }, { x: 3, y: 12 }, { x: 10, y: 0 }]), { xStep: 1, yStep: 2, xMax: 10, yMax: 20 });
  assert.equal(fitGrid([{ x: 2, y: 2.5 }, { x: 10, y: 0 }]).yStep, 0.5, 'halves only when needed');
  assert.equal(fitGrid([{ x: 2, y: 3 }, { x: 10, y: 0 }]).yStep, 1);
  assert.equal(fitGrid([{ x: 1, y: -2 }]), null, 'first quadrant only');
  const g = { xStep: 1, yStep: 5, xMax: 10, yMax: 50 };
  assert.deepEqual(snap(g, 3.4, 17), { x: 3, y: 15 });
  assert.deepEqual(snap(g, -2, 80), { x: 0, y: 50 });
});

test(`every zone: ${RUNS} runs; every point fits its map, text is clean`, () => {
  assert.equal(ZONES.length, 5);
  for (let i = 0; i < RUNS / 5; i++) {
    for (let z = 0; z < 5; z++) {
      const list = genZone(rnd, z);
      assert.equal(list.length, 5);
      for (const p of list) {
        if (p.grid) {
          for (const q of p.rows) assert.ok(onGrid(p.grid, q), `${p.type}: ${q.x},${q.y} on the map`);
          if (p.ask) assert.ok(onGrid(p.grid, p.ask));
          if (p.pts) for (const q of p.pts) assert.ok(onGrid(p.grid, q));
          if (p.table) for (const q of p.table) assert.ok(onGrid(p.grid, q));
          if (z < 4) assert.ok(p.grid.yStep >= 1, 'halves only in the boss');
        }
        if (['plot', 'read', 'meaning', 'rule', 'odd', 'offpoint'].includes(p.type)) assert.ok(p.grid, `${p.type} has a map`);
        for (const r of p.rows) assert.ok(r.y >= 0, 'first quadrant');
        for (const line of workedSolution(p)) assert.ok(noJunk(line), line);
        if (p.question) assert.ok(noJunk(p.question));
        if (p.options) for (const o of p.options) assert.ok(noJunk(o.text));
      }
      const back = genBackup(rnd, list[0]);
      assert.equal(back.type, list[0].type); assert.notEqual(back.id, list[0].id);
    }
  }
});

test(`plot: ${RUNS} trails; right points pass, backwards and slips are caught`, () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genPlot(rnd, { kind: ['times', 'plus', 'line', 'minus', 'puppy'][i % 5] });
    const pts = p.rows.map((r) => ({ ...r }));
    assert.ok(checkPlot(p, pts).correct);
    assert.ok(checkPlot(p, [...pts].reverse()).correct, 'order does not matter');
    assert.ok(checkPlot(p, pts.slice(0, 2)).nudge, 'missing a point is a nudge');
    const off = pts.map((q, k) => (k === 1 ? { x: q.x, y: q.y + p.grid.yStep } : q));
    const res = checkPlot(p, off);
    assert.ok(!res.correct && !res.nudge && noJunk(res.message));
    if (p.rule.form === 'line' || p.rule.form === 'minus') {
      const bad = pts.map((q) => ({ x: q.x, y: p.rule.m * q.x }));
      assert.equal(checkPlot(p, bad).key, 'forgot_start');
    }
    const sw = p.rows.find((r) => r.x !== r.y);
    assert.equal(checkPlot(p, [...pts.filter((q) => q !== pts[p.rows.indexOf(sw)]), { x: sw.y, y: sw.x }]).key, 'swapped_point', 'plotted (y, x)');
  }
});

test(`read and meaning: ${RUNS} maps`, () => {
  for (let i = 0; i < RUNS; i++) {
    const backward = i % 2 === 1;
    const p = genRead(rnd, { kind: ['times', 'plus', 'line'][i % 3], backward });
    assert.ok(!p.rows.some((r) => r.x === p.ask.x), 'the asked point is not already in the logbook');
    assert.ok(checkRead(p, typed(p.answer)).correct);
    assert.ok(checkRead(p, `${typed(p.answer)}.0`).correct);
    assert.ok(checkRead(p, '').nudge);
    const given = backward ? p.ask.y : p.ask.x;
    if (!near(given, p.answer)) assert.equal(checkRead(p, typed(given)).key, 'wrong_axis');
    const bad = checkRead(p, typed(p.answer + 1000));
    assert.ok(!bad.correct && noJunk(bad.message));
    const q = genMeaning(rnd);
    assert.equal(q.options.filter((o) => o.ok).length, 1);
    q.options.forEach((o, k) => { const r = checkMeaning(q, k); assert.equal(r.correct, o.ok); assert.ok(noJunk(r.message)); });
  }
});

test(`rule from the map: ${RUNS} trails; misconceptions named`, () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genRule(rnd, { kind: ['times', 'plus', 'line', 'minus'][i % 4] });
    const r = p.rule;
    assert.ok(checkRule(p, { ...r }).correct, ruleText(r));
    const k = needs(r.form)[0];
    const off = checkRule(p, { ...r, [k]: r[k] + 1 });
    assert.ok(!off.correct && noJunk(off.message));
    if (r.form === 'times') {
      assert.equal(checkRule(p, { form: 'plus', b: r.m }).key, 'add_vs_times');
      assert.equal(checkRule(p, { form: 'times', m: 1 / r.m }).key, 'swapped');
    }
    if (r.form === 'line' || r.form === 'minus') assert.equal(checkRule(p, { form: 'times', m: r.m }).key, 'forgot_start');
    if (r.form === 'minus') assert.equal(checkRule(p, { form: 'line', m: r.m, b: r.b }).key, 'plus_vs_minus');
    if (r.form === 'plus') assert.ok(checkRule(p, { form: 'line', m: 1, b: r.b }).correct, 'y = 1x + 3 is the same trail');
  }
  assert.ok(checkRule(genRule(rnd), { form: 'line', m: 2 }).nudge);
});

test(`spot the bad map: ${RUNS} sets; exactly one of the three disagrees`, () => {
  const seen = new Set();
  for (let i = 0; i < RUNS; i++) {
    const p = genOdd(rnd); seen.add(p.odd);
    const x = p.rows[1].x;
    const says = { rule: run(p.plaqueRule, x), table: p.table[1].y, map: run(p.mapRule, x) };
    const all = p.rows.map((row, k) => ({ rule: run(p.plaqueRule, row.x), table: p.table[k].y, map: run(p.mapRule, row.x) }));
    for (const w of ['rule', 'table', 'map']) {
      const others = ['rule', 'table', 'map'].filter((o) => o !== w);
      const agree = all.every((v) => near(v[others[0]], v[others[1]]));
      assert.equal(agree, w === p.odd, `${w}: the other two agree only when ${w} is the odd one (${JSON.stringify(says)})`);
    }
    for (const w of ['rule', 'table', 'map']) { const res = checkOdd(p, w); assert.equal(res.correct, w === p.odd); assert.ok(noJunk(res.message)); }
    const o = genOffPoint(rnd);
    o.pts.forEach((q, k) => assert.equal(near(run(o.rule, q.x), q.y), k !== o.bad));
    o.pts.forEach((_, k) => { const res = checkOffPoint(o, k); assert.equal(res.correct, k === o.bad); assert.ok(noJunk(res.message)); });
  }
  assert.deepEqual([...seen].sort(), ['map', 'rule', 'table']);
});

test(`Mary: ${RUNS} ratio equations`, () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genMary(rnd);
    for (const r of p.rows) assert.ok(near(r.x / p.k, r.y));
    assert.equal(p.options.filter((o) => o.ok).length, 1);
    p.options.forEach((o, k) => { const res = checkMary(p, k); assert.equal(res.correct, o.ok); assert.ok(noJunk(res.message)); });
    assert.equal(checkMary(p, p.options.findIndex((o) => o.key === 'mary_multiply')).key, 'mary_multiply');
  }
});

test(`goals: ${RUNS} "at least" problems round up`, () => {
  let rounded = 0;
  for (let i = 0; i < RUNS; i++) {
    const p = genGoal(rnd);
    const rate = p.cents / 100;
    assert.ok(p.answer * p.cents >= p.goal * 100, 'enough money');
    assert.ok((p.answer - 1) * p.cents < p.goal * 100, 'one fewer is not enough');
    assert.ok(checkGoal(p, String(p.answer)).correct);
    assert.ok(checkGoal(p, '').nudge);
    if (!Number.isInteger(p.exact)) {
      rounded++;
      assert.equal(checkGoal(p, String(p.answer - 1)).key, 'rounded_down');
      assert.equal(checkGoal(p, p.exact.toFixed(2)).key, 'not_whole');
    }
    assert.equal(checkGoal(p, typed(p.goal * rate)).key, 'multiplied');
  }
  assert.ok(rounded > RUNS / 2, 'most goals need rounding up');
  const pom = { ...genGoal(seeded(1)), cents: 55, goal: 50, exact: 5000 / 55, answer: 91, rule: { form: 'times', m: 0.55 } };
  assert.ok(checkGoal(pom, '91').correct); assert.equal(checkGoal(pom, '90').key, 'rounded_down');
});

console.log(`\n${passed} tests passed`);
