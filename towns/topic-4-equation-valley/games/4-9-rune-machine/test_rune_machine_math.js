// Tests for Rune Machine (rune.js). Run with:  node towns/topic-4-equation-valley/games/4-9-rune-machine/test_rune_machine_math.js
import assert from 'node:assert/strict';
import {
  seeded, fmt, parseNumber, run, ruleText, plugIn, needs, FORMS, ZONES,
  genCrack, genFill, genPredict, genMaya, genZone, genBackup,
  checkRule, checkFill, checkPredict, checkMaya, workedSolution, answerRule,
} from './rune.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261111);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
const typed = (v) => fmt(v).replace('−', '-');

test('numbers: formats and parsing', () => {
  assert.equal(fmt(1250), '1,250'); assert.equal(fmt(61.25), '61.25'); assert.equal(fmt(-7), '−7'); assert.equal(fmt(36.6), '36.6');
  for (const [raw, want] of [['15', 15], ['$15', 15], ['15.00', 15], ['1,250', 1250], [' 61.25 ', 61.25], ['-7', -7], ['−7', -7], ['.5', 0.5]]) assert.equal(parseNumber(raw), want, raw);
  for (const raw of ['', 'abc', '5x', '1/2', '--3', null]) assert.equal(parseNumber(raw), null, String(raw));
});

test('rules: run and write', () => {
  assert.equal(run({ form: 'times', m: 8 }, 3), 24);
  assert.equal(run({ form: 'plus', b: 2 }, 3), 5);
  assert.equal(run({ form: 'line', m: 2, b: -7 }, 3), -1);
  assert.equal(run({ form: 'down', m: 5, b: 75 }, 4), 55);
  assert.equal(run({ form: 'times', m: 12.2 }, 3), 36.6);
  assert.equal(ruleText({ form: 'times', m: 8 }, 'b', 'c'), 'c = 8b');
  assert.equal(ruleText({ form: 'line', m: 2, b: -7 }), 'y = 2x − 7');
  assert.equal(ruleText({ form: 'down', m: 5, b: 75 }, 'w', 'a'), 'a = 75 − 5w');
  assert.equal(plugIn({ form: 'times', m: 8 }, 'b', 'c', 5), 'c = 8(5) = 40');
  assert.equal(plugIn({ form: 'down', m: 5, b: 75 }, 'w', 'a', 4), 'a = 75 − 5(4) = 55');
});

test(`every zone: ${RUNS} runs make sensible problems with clean text`, () => {
  assert.equal(ZONES.length, 5);
  for (let i = 0; i < RUNS / 5; i++) {
    for (let z = 0; z < 5; z++) {
      const list = genZone(rnd, z);
      assert.equal(list.length, 5);
      for (const p of list) {
        assert.ok(p.rows.length >= 3, 'at least 3 rows');
        for (const r of p.rows) { assert.equal(r.y, run(p.rule, r.x)); assert.ok(r.y >= 0 || p.rule.b < 0, 'no negative amounts in stories'); }
        assert.ok(p.rows.every((r, k) => k === 0 || r.x > p.rows[k - 1].x), 'inputs go up');
        assert.notEqual(p.X, p.Y);
        for (const line of workedSolution(p)) assert.ok(noJunk(line), line);
        if (p.question) assert.ok(noJunk(p.question), p.question);
        if (z >= 3 && p.type === 'crack') assert.ok(p.skip, 'tricky tables skip inputs');
        if (z < 4) assert.ok(p.rows.every((r) => Number.isInteger(r.y)), 'decimals only in the boss');
        if (p.type === 'crack' && z < 3) assert.ok(['times', 'plus'].includes(p.rule.form), 'two-step rules are only written in the boss');
      }
      const back = genBackup(rnd, list[0]);
      assert.equal(back.type, list[0].type); assert.notEqual(back.id, list[0].id);
    }
  }
});

test(`crack: ${RUNS} tables; the real rule passes, and it is the only rule of its shape that does`, () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genCrack(rnd, { kind: ['times', 'plus', 'line', 'down', 'decimal'][i % 5], skip: i % 2 === 0 });
    const res = checkRule(p, { ...p.rule });
    assert.ok(res.correct && res.rows.every(Boolean), answerRule(p));
    assert.ok(noJunk(res.message));
    const off = { ...p.rule, [needs(p.rule.form)[0]]: p.rule[needs(p.rule.form)[0]] + 1 };
    const bad = checkRule(p, off);
    assert.ok(!bad.correct && bad.rows.some((r) => !r) && noJunk(bad.message));
  }
  // an equivalent rule written another way still works: y = 1x + 3 for y = x + 3
  const p = genCrack(seeded(5), { kind: 'plus' });
  assert.ok(checkRule(p, { form: 'line', m: 1, b: p.rule.b }).correct);
});

test('crack: the misconceptions are named', () => {
  for (let i = 0; i < 300; i++) {
    const t = genCrack(rnd, { kind: 'times' });
    assert.equal(checkRule(t, { form: 'plus', b: t.rule.m }).key, 'add_vs_times', 'y = x + 8 for y = 8x');
    assert.equal(checkRule(t, { form: 'times', m: 1 / t.rule.m }).key, 'swapped', 'x = 8y');
    const s = genCrack(rnd, { kind: 'times', skip: true });
    const big = s.rows.slice(1).map((r, k) => ({ dx: r.x - s.rows[k].x, dy: r.y - s.rows[k].y })).find((j) => j.dx > 1);
    assert.equal(checkRule(s, { form: 'times', m: big.dy }).key, 'skipped_inputs', 'used the jump across a skip');
    const l = genCrack(rnd, { kind: 'line' });
    assert.equal(checkRule(l, { form: 'times', m: l.rule.m }).key, 'forgot_start');
    const d = genCrack(rnd, { kind: 'down' });
    assert.equal(checkRule(d, { form: 'times', m: d.rule.m }).key, 'forgot_start');
    assert.equal(checkRule(d, { form: 'line', m: d.rule.m, b: d.rule.b }).key, 'wrong_direction', 'y = 5w + 75 for a falling amount');
  }
  const p = genCrack(seeded(9), { kind: 'plus' });
  assert.ok(checkRule(p, { form: 'line', m: 2 }).nudge, 'an empty box is a nudge, not a miss');
  assert.ok(checkRule(p, null).nudge);
  for (const f of FORMS) assert.ok(needs(f).length >= 1);
});

test(`fill: ${RUNS} tables; right values in any format pass, common slips are caught`, () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genFill(rnd, { kind: ['times', 'plus', 'line', 'down'][i % 4] });
    assert.equal(p.blanks.length, 2);
    const want = p.blanks.map((k) => p.rows[k].y);
    assert.ok(checkFill(p, want.map(typed)).correct);
    assert.ok(checkFill(p, want.map((v) => `${typed(v)}.00`)).correct, 'accepts 15.00');
    assert.ok(checkFill(p, [typed(want[0]), '']).nudge);
    const wrong = checkFill(p, [typed(want[0] + 1), typed(want[1])]);
    assert.ok(!wrong.correct && noJunk(wrong.message) && wrong.row === p.blanks[0]);
  }
  const p = { ...genFill(seeded(2), { kind: 'line' }) };
  const x = p.rows[p.blanks[0]].x, r = p.rule;
  const second = typed(p.rows[p.blanks[1]].y);
  assert.equal(checkFill(p, [typed(r.m * x), second]).key, 'forgot_start');
  if (!(r.m * (x + r.b) === run(r, x))) assert.equal(checkFill(p, [typed(r.m * (x + r.b)), second]).key, 'order_of_ops');
});

test(`predict: ${RUNS} problems forward and backward`, () => {
  for (let i = 0; i < RUNS; i++) {
    const backward = i % 2 === 0;
    const kind = backward ? ['times', 'plus', 'down'][i % 3] : ['times', 'plus', 'line', 'decimal'][i % 4];
    const p = genPredict(rnd, { kind, backward });
    assert.ok(p.target > p.rows[p.rows.length - 1].x || (kind === 'down'), 'reads ahead of the table');
    assert.ok(checkPredict(p, typed(p.answer)).correct);
    assert.ok(checkPredict(p, `$${typed(p.answer)}`).correct, 'accepts $');
    assert.ok(checkPredict(p, '').nudge);
    const bad = checkPredict(p, typed(p.answer + 1));
    assert.ok(!bad.correct && noJunk(bad.message));
    if (backward) {
      const out = run(p.rule, p.answer);
      if (out !== p.answer) assert.equal(checkPredict(p, typed(run(p.rule, out))).key, 'forward_instead', 'ran the machine forward');
    } else {
      assert.equal(p.answer, run(p.rule, p.target));
    }
  }
  const d = genPredict(seeded(4), { kind: 'down', backward: true });
  assert.equal(run(d.rule, d.answer), 0, 'Ethan owes $0');
  assert.equal(checkPredict(d, typed(d.rule.b)).key, 'forward_instead');
  const l = genPredict(seeded(6), { kind: 'line' });
  const r0 = l.rows[0];
  assert.equal(checkPredict(l, typed((r0.y / r0.x) * l.target)).key, 'scaled_with_start');
});

test(`Maya: ${RUNS} critiques; her rule fits row 1 only, and "row 2" is the answer`, () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genMaya(rnd);
    assert.equal(run(p.maya, p.rows[0].x), p.rows[0].y, 'fits row 1');
    for (const r of p.rows.slice(1)) assert.notEqual(run(p.maya, r.x), r.y, 'breaks every later row');
    assert.equal(p.options.filter((o) => o.ok).length, 1);
    p.options.forEach((o, k) => { const res = checkMaya(p, k); assert.equal(res.correct, o.ok); assert.ok(noJunk(res.message)); });
    const none = p.options.findIndex((o) => o.row === -1);
    assert.equal(checkMaya(p, none).key, 'first_row_only');
  }
});

console.log(`\n${passed} tests passed`);
