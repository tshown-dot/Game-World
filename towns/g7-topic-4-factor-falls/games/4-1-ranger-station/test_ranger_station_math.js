// Tests for Ranger Station (ranger.js). Run with:
//   node towns/g7-topic-4-factor-falls/games/4-1-ranger-station/test_ranger_station_math.js
import assert from 'node:assert/strict';
import {
  seeded, fmt, parseNumber, near, r2, exprText, valueAt, ZONES, genZone, genBackup,
  genBuild, genEvalStory, genEval, genBuild2, genEval2, genWhenNegative, checkBuild, checkNum, checkChoice, workedSolution,
} from './ranger.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261113);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
const typed = (v) => String(r2(v));

test('typed answers: negatives, money, fractions', () => {
  for (const [raw, want] of [['-3.3', -3.3], ['−3.3', -3.3], ['$47.46', 47.46], ['47.46', 47.46], ['1,250', 1250], ['18.5', 18.5], ['18 1/2', 18.5], ['37/2', 18.5], ['-$5', -5], ['.5', 0.5], ['-42', -42]]) assert.ok(near(parseNumber(raw), want), raw);
  for (const raw of ['', 'abc', '3x', '1/0', '--2']) assert.equal(parseNumber(raw), null, raw);
  assert.equal(fmt(-3.3), '−3.3'); assert.equal(fmt(3000), '3,000'); assert.equal(fmt(25.5), '25.5');
  assert.equal(exprText(-120, '+', 13, 'm'), '−120 + 13m'); assert.equal(exprText(35, '−', 4, 'm'), '35 − 4m');
  assert.equal(valueAt(-120, '+', 13, 6), -42); assert.equal(valueAt(73, '−', 1.5, 4), 67);
});

test(`every zone: ${RUNS} runs make clean, solvable problems`, () => {
  assert.equal(ZONES.length, 5);
  for (let i = 0; i < RUNS / 5; i++) {
    for (let z = 0; z < 5; z++) {
      const list = genZone(rnd, z);
      assert.equal(list.length, 5);
      for (const p of list) {
        assert.ok(noJunk(p.prompt.replace(/<[^>]+>/g, '')), p.prompt);
        for (const line of workedSolution(p)) assert.ok(noJunk(line), `${p.type}: ${line}`);
        if (p.kind === 'num') {
          assert.ok(near(p.answer, r2(p.answer)), 'answers have at most 2 decimals');
          assert.ok(checkNum(p, typed(p.answer)).correct, `${p.type} ${p.answer}`);
          assert.ok(checkNum(p, '').nudge);
          for (const t of p.traps) assert.equal(checkNum(p, typed(t.v)).key, t.key, `${p.type}: trap ${t.key}`);
          assert.ok(!checkNum(p, typed(p.answer + 1234.5)).correct);
          if (z < 2) assert.ok(p.answer >= 0, 'no negatives before Read the Gauge');
        }
        if (p.kind === 'choice') { assert.equal(p.options.filter((o) => o.ok).length, 1); p.options.forEach((o, k) => { const r = checkChoice(p, k); assert.equal(r.correct, o.ok); assert.ok(noJunk(r.message)); }); }
        if (p.kind === 'build') assert.equal(new Set(p.chips).size, p.chips.length, 'no two chips show the same number');
      }
      const back = genBackup(rnd, list[0]);
      assert.equal(back.type, list[0].type); assert.notEqual(back.id, list[0].id);
    }
  }
});

test('building one-variable expressions: start, rate and direction', () => {
  for (let i = 0; i < RUNS; i++) {
    for (const dir of ['up', 'down', 'neg']) {
      const p = genBuild(rnd, { dir });
      assert.ok(p.chips.includes(p.start) && p.chips.includes(p.rate));
      assert.equal(p.sign, dir === 'down' ? '−' : '+');
      assert.ok(checkBuild(p, { a: p.start, b: p.rate, sign: p.sign }).correct);
      assert.ok(checkBuild(p, { a: p.start, b: null, sign: p.sign }).nudge);
      assert.ok(checkBuild(p, { a: p.start, b: p.rate, sign: null }).nudge);
      assert.equal(checkBuild(p, { a: p.rate, b: Math.abs(p.start), sign: p.sign }).key, 'swapped_constant_rate');
      assert.equal(checkBuild(p, { a: p.start, b: p.rate, sign: p.sign === '+' ? '−' : '+' }).key, 'wrong_direction');
      if (dir === 'neg') { assert.ok(p.start < 0 && p.chips.includes(-p.start)); assert.equal(checkBuild(p, { a: -p.start, b: p.rate, sign: '+' }).key, 'lost_negative'); }
    }
  }
});

test('reading the gauge from a story', () => {
  for (let i = 0; i < RUNS; i++) {
    for (const dir of ['up', 'down', 'neg']) {
      const p = genEvalStory(rnd, { dir });
      assert.equal(p.answer, valueAt(p.start, p.sign, p.rate, p.n));
      if (dir === 'down') assert.ok(p.answer >= 0, 'a tank never holds less than nothing');
      assert.ok(['forgot_constant', 'wrong_direction'].includes(checkNum(p, typed(p.rate * p.n)).key), 'rate × n alone is caught (two slips can land on the same number)');
    }
  }
  const sub = { ...genEvalStory(seeded(2), { dir: 'neg' }) };
  assert.ok(sub.start < 0);
});

test('evaluating with decimals and negative results', () => {
  let negatives = 0;
  for (let i = 0; i < RUNS; i++) {
    for (const form of ['ax-b', 'ax+b', 'b-ax']) {
      const p = genEval(rnd, form);
      const ax = p.a * p.x;
      assert.ok(near(p.answer, r2(form === 'ax-b' ? ax - p.b : form === 'ax+b' ? ax + p.b : p.b - ax)));
      if (p.answer < 0) { negatives++; assert.ok(checkNum(p, `-${Math.abs(p.answer)}`).correct); assert.ok(checkNum(p, `−${Math.abs(p.answer)}`).correct); assert.equal(checkNum(p, typed(-p.answer)).key, 'lost_negative'); }
    }
  }
  assert.ok(negatives > RUNS / 4, 'plenty of negative results');
  const book = { ...genEval(seeded(1), 'ax-b'), a: 3, x: 0.4, b: 4.5, answer: -3.3, traps: [] };   // the textbook's 3x − 4.5 when x = 0.4
  assert.ok(checkNum(book, '-3.3').correct);
});

test('supply orders: two variables', () => {
  for (let i = 0; i < RUNS; i++) {
    const b = genBuild2(rnd);
    assert.ok(checkBuild(b, { a: b.p1, b: b.p2 }).correct);
    assert.equal(checkBuild(b, { a: b.p2, b: b.p1 }).key, 'swapped_prices');
    assert.equal(checkBuild(b, { a: b.qx, b: b.p2 }).key, 'used_amount');
    assert.ok(checkBuild(b, { a: b.p1, b: undefined }).nudge);
    const e = genEval2(rnd);
    assert.ok(near(e.answer * 100, Math.round(e.answer * 100)), 'whole cents');
    assert.ok(checkNum(e, `$${e.answer.toFixed(2)}`).correct, 'accepts $ and cents');
    const m = genEval2(rnd, { form: 'minus' });
    assert.ok(m.traps.some((t) => t.key === 'swapped_values'));
  }
});

test('when is b − mx negative?', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genWhenNegative(rnd);
    assert.equal(p.b - p.m * p.k, 0, 'zero exactly at the boundary');
    assert.ok(p.b - p.m * (p.k + 1) < 0 && p.b - p.m * (p.k - 1) > 0);
    assert.equal(new Set(p.options.map((o) => o.text)).size, 4, 'four different options');
  }
});

console.log(`\n${passed} tests passed`);
