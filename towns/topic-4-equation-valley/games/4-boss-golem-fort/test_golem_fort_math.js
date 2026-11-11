// Tests for Golem Fort (golem.js). Run with:  node towns/topic-4-equation-valley/games/4-boss-golem-fort/test_golem_fort_math.js
import assert from 'node:assert/strict';
import {
  seeded, fmt, parseNumber, fracText, near, run, ruleText, ZONES, genZone, genBackup,
  genSolution, genBalance, genStory, genSolveEq, genRational, genWriteIneq, genGraph, genSolveIneq, genVariables, genTableRule, genDilemma,
  checkNum, checkChoice, checkGraph, checkRule, workedSolution,
} from './golem.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261113);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
const typed = (v) => fmt(v).replace(/,/g, '').replace('−', '-');

test('typed answers in many formats', () => {
  for (const [raw, want] of [['23', 23], ['$15', 15], ['15.00', 15], ['4.75', 4.75], ['5/4', 1.25], ['1 1/4', 1.25], ['-3', -3], ['−3', -3], ['1,250', 1250], ['3 / 4', 0.75]]) assert.ok(near(parseNumber(raw), want), raw);
  for (const raw of ['', 'abc', '1/0', 'x=5', '2 1/0']) assert.equal(parseNumber(raw), null, raw);
  assert.equal(fracText(1.25), '1 1/4'); assert.equal(fracText(1 / 3), '1/3'); assert.equal(fracText(1.4), '1 2/5'); assert.equal(fracText(3), '3');
});

test(`every zone: ${RUNS} runs make clean, solvable problems`, () => {
  assert.equal(ZONES.length, 5);
  for (let i = 0; i < RUNS / 5; i++) {
    for (let z = 0; z < 5; z++) {
      const list = genZone(rnd, z);
      assert.equal(list.length, 5);
      for (const p of list) {
        assert.ok(noJunk(p.prompt.replace(/<[^>]+>/g, '')), p.prompt);
        assert.ok(['num', 'choice', 'graph', 'rule'].includes(p.kind));
        for (const line of workedSolution(p)) assert.ok(noJunk(line), `${p.type}: ${line}`);
        if (p.kind === 'choice') {
          assert.equal(p.options.filter((o) => o.ok).length, 1, p.type);
          assert.equal(new Set(p.options.map((o) => o.text)).size, p.options.length, `${p.type}: no repeated options ${p.options.map((o) => o.text)}`);
          p.options.forEach((o, k) => { const r = checkChoice(p, k); assert.equal(r.correct, o.ok); assert.ok(noJunk(r.message)); });
        }
        if (p.kind === 'num') {
          assert.ok(checkNum(p, typed(p.answer)).correct, `${p.type}: ${p.answer}`);
          assert.ok(checkNum(p, '').nudge);
          for (const t of p.traps) if (!near(t.v, p.answer)) assert.equal(checkNum(p, String(t.v)).key, t.key, `${p.type} trap`);
          assert.ok(!checkNum(p, String(p.answer + 1000)).correct);
          if (z < 2) assert.ok(Number.isInteger(p.answer) && p.answer > 0, 'whole-number answers before the Shoulders');
        }
      }
      const back = genBackup(rnd, list[0]);
      assert.equal(back.type, list[0].type); assert.notEqual(back.id, list[0].id);
    }
  }
});

test('the Feet: solutions and balance', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genSolution(rnd);
    const k = p.options.findIndex((o) => o.key === 'same_operation');
    assert.ok(k >= 0, 'the same-operation slip is offered');
    const b = genBalance(rnd);
    assert.equal(checkChoice(b, b.options.findIndex((o) => o.key === 'one_side')).key, 'one_side');
  }
});

test('the Arms and Shoulders: using the same operation is caught', () => {
  for (let i = 0; i < RUNS; i++) {
    for (const op of ['+', '−', '×', '÷']) { const p = genStory(rnd, op); assert.equal(checkNum(p, String(p.traps[0].v)).key, 'same_operation'); }
    for (const f of ['dec+', 'dec−', 'dec×', 'frac×', 'frac+']) {
      const p = genRational(rnd, f);
      assert.ok(checkNum(p, typed(p.answer)).correct);
      if (f === 'frac+') { assert.ok(checkNum(p, fracText(p.answer)).correct, `mixed number ${fracText(p.answer)}`); }
      if (!near(p.traps[0].v, p.answer)) assert.equal(checkNum(p, String(p.traps[0].v)).key, 'same_operation');
    }
  }
  const p = { ...genRational(seeded(3), 'frac+'), answer: 1.25 };
  for (const raw of ['1.25', '5/4', '1 1/4']) assert.ok(checkNum(p, raw).correct, raw);
});

test('the Shield: writing, solving and graphing inequalities', () => {
  const seen = new Set();
  for (let i = 0; i < RUNS; i++) {
    const w = genWriteIneq(rnd); seen.add(w.sign);
    const g = genGraph(rnd);
    const closed = g.sign === '≤' || g.sign === '≥', right = g.sign === '>' || g.sign === '≥';
    const good = { b: g.b, circle: closed ? 'closed' : 'open', dir: right ? 'right' : 'left' };
    assert.ok(checkGraph(g, good).correct);
    assert.ok(checkGraph(g, { ...good, dir: null }).nudge);
    assert.equal(checkGraph(g, { ...good, b: g.b + 1 }).key, 'boundary');
    assert.equal(checkGraph(g, { ...good, circle: closed ? 'open' : 'closed' }).key, 'open_closed');
    assert.equal(checkGraph(g, { ...good, dir: right ? 'left' : 'right' }).key, 'shade_direction');
    const s = genSolveIneq(rnd);
    assert.ok(s.options.some((o) => o.key === 'flipped_sign') && s.options.some((o) => o.key === 'same_operation'));
  }
  assert.deepEqual([...seen].sort(), ['<', '>', '≤', '≥']);
});

test('the Core: variables, table rules and the dilemma', () => {
  for (let i = 0; i < RUNS; i++) {
    const v = genVariables(rnd);
    assert.equal(checkChoice(v, v.options.findIndex((o) => !o.ok)).key, 'swapped_variables');
    for (const f of ['times', 'plus', 'line']) {
      const p = genTableRule(rnd, f);
      assert.ok(checkRule(p, { ...p.rule }).correct, ruleText(p.rule));
      assert.ok(checkRule(p, { form: 'line', m: 2 }).nudge);
      if (f === 'times') assert.equal(checkRule(p, { form: 'plus', b: p.rule.m }).key, 'add_vs_times');
      if (f === 'line') assert.equal(checkRule(p, { form: 'times', m: p.rule.m }).key, 'forgot_start');
      if (f === 'plus') assert.ok(checkRule(p, { form: 'line', m: 1, b: p.rule.b }).correct, 'y = 1x + 4 is the same rule');
    }
    const [a, b] = genDilemma(rnd);
    assert.equal(b.rule, a.rule, 'part 2 uses the same rule as part 1');
    assert.equal(run(b.rule, b.answer), run(a.rule, b.answer));
    assert.equal(a.options.find((o) => o.ok).text, ruleText(a.rule, a.X, a.Y));
    for (const t of b.traps) if (!near(t.v, b.answer)) assert.equal(checkNum(b, String(t.v)).key, t.key);
  }
});

console.log(`\n${passed} tests passed`);
