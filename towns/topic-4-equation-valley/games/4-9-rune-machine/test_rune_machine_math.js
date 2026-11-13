// Tests for Rune Machine (rune.js). Run with:  node towns/topic-4-equation-valley/games/4-9-rune-machine/test_rune_machine_math.js
import assert from 'node:assert/strict';
import {
  seeded, fmt, FORMS, run, ruleText, plugIn, needs, DIAL, genMachine, genCatch, checkCatch, genDials, checkRule, testRule, answerRule,
  genBack, checkBack, genFeed, feedRows, dialsFromFeed, ZONES, genZone,
} from './rune.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261121);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
const form = (i) => FORMS[i % 4];

test('rules: running them and writing them', () => {
  assert.equal(run({ form: 'times', m: 8 }, 5), 40); assert.equal(run({ form: 'plus', b: 7 }, 5), 12);
  assert.equal(run({ form: 'line', m: 2, b: 3 }, 5), 13); assert.equal(run({ form: 'down', m: 5, b: 60 }, 4), 40);
  assert.equal(ruleText({ form: 'times', m: 8, b: 0 }, 'b', 'c'), 'c = 8b'); assert.equal(ruleText({ form: 'plus', m: 1, b: 7 }, 't', 'b'), 'b = t + 7');
  assert.equal(ruleText({ form: 'line', m: 2, b: 3 }, 'r', 'c'), 'c = 2r + 3'); assert.equal(ruleText({ form: 'down', m: 5, b: 60 }, 'w', 'a'), 'a = 60 − 5w');
  assert.equal(ruleText({ form: 'line', m: 1, b: 4 }, 'x', 'y'), 'y = x + 4'); assert.equal(plugIn({ form: 'times', m: 8, b: 0 }, 'b', 'c', 5), 'c = 8(5) = 40');
  assert.equal(fmt(1250), '1,250'); assert.equal(fmt(-7), '−7'); assert.deepEqual(needs('down'), ['b', 'm']);
});

test(`machines: ${RUNS} machines fit the dials and the number line`, () => {
  for (let i = 0; i < RUNS; i++) {
    const m = genMachine(rnd, form(i)), r = m.rule;
    assert.ok(noJunk(ruleText(r, m.X, m.Y)) && noJunk(m.xName) && noJunk(m.yName));
    assert.ok(r.m >= DIAL.m.lo && r.m <= DIAL.m.hi, 'the multiplier is on the dial');
    assert.ok(r.b >= 0 && r.b <= (r.form === 'down' ? DIAL.start.hi : DIAL.b.hi), 'the added number is on the dial');
    for (let x = 0; x <= m.xmax; x++) assert.ok(run(r, x) >= 0 && run(r, x) <= 100 && Number.isInteger(run(r, x)), `${ruleText(r)} at ${x}`);
    if (r.form === 'down') assert.equal(run(r, m.xmax), 0, 'a shrinking rule reaches exactly 0');
  }
});

test('catch: where each stone lands, and what a miss means', () => {
  const keys = new Set();
  for (let i = 0; i < RUNS; i++) {
    const far = i % 7 === 6, p = genCatch(rnd, far ? form(i % 2) : form(i), { count: far ? 3 : 5, far });
    assert.equal(p.inputs.length, far ? 3 : 5); assert.equal(new Set(p.inputs).size, p.inputs.length, 'no stone twice');
    for (const x of p.inputs) {
      const y = run(p.rule, x);
      assert.ok(y >= p.line.lo && y <= p.line.hi, `${ruleText(p.rule)} at ${x} lands on the line 0..${p.line.hi}`);
      assert.equal(checkCatch(p, x, y), null);
      for (const off of [1, -1, 7]) { const res = checkCatch(p, x, y + off); assert.ok(noJunk(res.message) && res.message.includes(`Your basket was at ${fmt(y + off)}`)); keys.add(res.key); }
    }
    assert.ok(p.line.hi <= 200 && p.line.hi % 10 === 0);
  }
  const t = { rule: { form: 'times', m: 3, b: 0 }, X: 'x', Y: 'y' };
  assert.equal(checkCatch(t, 6, 9).key, 'add_vs_times'); assert.ok(checkCatch(t, 6, 9).message.startsWith('y = 3(6) = 18. Your basket was at 9.'));
  const l = { rule: { form: 'line', m: 2, b: 3 }, X: 'x', Y: 'y' };
  assert.equal(checkCatch(l, 5, 10).key, 'forgot_start'); assert.equal(checkCatch(l, 5, 16).key, 'order_of_ops'); assert.equal(checkCatch(l, 5, 40).key, 'calc');
  const d = { rule: { form: 'down', m: 5, b: 60 }, X: 'w', Y: 'a' };
  assert.equal(checkCatch(d, 4, 80).key, 'wrong_direction'); assert.equal(checkCatch(d, 4, 20).key, 'forgot_start');
  assert.equal(checkCatch({ rule: { form: 'plus', m: 1, b: 7 }, X: 'x', Y: 'y' }, 5, 35).key, 'add_vs_times');
  assert.ok(keys.has('close') && keys.has('calc'));
});

test('dials: the machine tests a rule on every row', () => {
  const keys = new Set();
  for (let i = 0; i < RUNS; i++) {
    const p = genDials(rnd, form(i), { skip: i % 2 === 0 });
    assert.equal(p.rows.length, 4); assert.ok(p.rows.every((r) => r.y === run(p.rule, r.x)) && noJunk(answerRule(p)));
    const right = testRule(p, p.rule);
    assert.ok(right.correct && right.firstBad === -1 && right.made.every((v, k) => v === right.table[k].y));
    if (p.rule.form === 'times') assert.equal(testRule(p, { form: 'line', m: p.rule.m, b: 0 }).correct, true, 'the same rule written another way is accepted');
    for (const g of [{ form: 'plus', m: 1, b: p.rule.m }, { form: 'times', m: p.rule.m, b: 0 }, { form: 'line', m: p.rule.m, b: 0 }, { form: 'times', m: p.rule.m + 1, b: 0 }, { form: 'plus', m: 1, b: 1 }]) {
      const res = testRule(p, g);
      if (res.correct) continue;
      keys.add(res.key);
      assert.ok(noJunk(res.message) && res.firstBad >= 0 && res.made[res.firstBad] !== res.table[res.firstBad].y);
    }
  }
  for (const k of ['add_vs_times', 'forgot_start', 'some_rows', 'no_rows']) assert.ok(keys.has(k), k);
  const skip = { rule: { form: 'times', m: 4, b: 0 }, X: 'x', Y: 'y', rows: [{ x: 1, y: 4 }, { x: 2, y: 8 }, { x: 4, y: 16 }, { x: 6, y: 24 }] };
  assert.equal(checkRule(skip, { form: 'times', m: 8, b: 0 }).key, 'skipped_inputs');
  const broken = genDials(rnd, 'line', { broken: true });
  assert.equal(broken.preset.form, 'plus'); assert.deepEqual(testRule(broken, broken.preset).rows.slice(0, 2), [true, false], 'the broken rule fits the first row only');
  assert.ok(broken.preset.b <= DIAL.b.hi);
});

test('back: which input makes the target', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genBack(rnd, form(i), { zero: i % 8 === 3 });
    assert.ok(p.answer >= p.strip.lo && p.answer <= p.strip.hi && run(p.rule, p.answer) === p.target);
    assert.equal(checkBack(p, p.answer), null);
    const res = checkBack(p, p.answer + 1);
    assert.ok(res.key === 'backward' && noJunk(res.message) && res.message.includes(`not ${fmt(p.target)}`), res.message);
    if (p.rule.form === 'down' && i % 8 === 3) assert.equal(p.target, 0);
  }
  assert.equal(checkBack({ rule: { form: 'times', m: 3, b: 0 }, X: 'x', Y: 'y', target: 27 }, 8).message, 'y = 3(8) = 24, not 27. Undo the × 3: what is 27 ÷ 3?');
});

test('feed: only the real rule survives the test, however the stones were chosen', () => {
  for (let i = 0; i < 400; i++) {
    const p = genFeed(rnd, form(i));
    const xs = i % 5 === 0 ? [3, 3, 3, 3] : Array.from({ length: p.stones }, () => p.strip.lo + Math.floor(rnd() * (p.strip.hi - p.strip.lo + 1)));
    const rows = feedRows(p, xs), d = dialsFromFeed(p, xs);
    assert.ok(rows.every((r, k) => r.y === run(p.rule, r.x) && (k === 0 || r.x > rows[k - 1].x)), 'the table is in order with no repeats');
    assert.ok(d.rows.length + d.hidden.length >= 2 && d.hidden.every((h) => !d.rows.some((r) => r.x === h.x)));
    assert.equal(testRule(d, p.rule).correct, true);
    // every setting of the dials: it passes only if it is the same rule on the whole strip
    for (const f of FORMS) for (let m = DIAL.m.lo; m <= DIAL.m.hi; m++) for (let b = 0; b <= (f === 'down' ? 60 : 20); b += f === 'down' ? 4 : 1) {
      if ((f === 'times' && b) || (f === 'plus' && m !== 1)) continue;
      const g = { form: f, m, b }, res = testRule(d, g);
      let sameRule = true; for (let x = p.strip.lo; x <= p.strip.hi; x++) if (run(g, x) !== run(p.rule, x)) sameRule = false;
      assert.equal(res.correct, sameRule, `${ruleText(g)} against ${ruleText(p.rule)}`);
    }
  }
});

test('zones', () => {
  assert.equal(ZONES.length, 5);
  for (let i = 0; i < 300; i++) {
    const z = [0, 1, 2, 3, 4].map((k) => genZone(rnd, k));
    assert.deepEqual(z[0].map((r) => r.type + ':' + r.rule.form), ['catch:times', 'catch:plus', 'catch:times']);
    assert.ok(z[1].length === 5 && z[1].every((r) => r.type === 'dials' && r.forms.length === 2) && z[1].some((r) => r.skip));
    assert.deepEqual(z[2].map((r) => r.type), ['back', 'back', 'catch', 'back', 'back']); assert.ok(z[2][2].far);
    assert.deepEqual(z[3].map((r) => r.type + ':' + r.rule.form), ['feed:times', 'feed:plus', 'feed:line']);
    assert.deepEqual(z[4].map((r) => r.type + ':' + r.rule.form), ['dials:line', 'catch:line', 'feed:down', 'back:down', 'dials:line']);
    assert.ok(z[4][4].broken && z[4][3].target === 0);
  }
});

console.log(`\n${passed} tests passed`);
