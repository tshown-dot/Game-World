// Tests for Food Truck's math (truck.js). Run with:  node towns/topic-4-equation-valley/games/4-5-food-truck/test_food_truck_math.js
import assert from 'node:assert/strict';
import {
  fr, add, sub, mul, div, same, value, recip, dec, show, parseAnswer, apply, makeEq, exprText, eqText, runForward, undoStep, checkLine, seeded,
  genRegister, genPrice, genRecipe, genBatch, genChoose, genCritique, genMoneyStory, genPriceStory, genRecipeStory, genZone, genBackup, ZONES,
  checkBlock, checkCalc, checkPredict, checkOption, workedSolution,
} from './truck.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 3000;
const rnd = seeded(20261113);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);

test('exact fractions: no rounding errors', () => {
  assert.ok(same(add(dec(0.1), dec(0.2)), dec(0.3)), '0.1 + 0.2 is exactly 0.3');
  assert.ok(same(add(fr(1, 3), fr(1, 6)), fr(1, 2)));
  assert.ok(same(div(fr(5), fr(2, 3)), fr(15, 2)));
  assert.ok(same(recip(fr(13, 8)), fr(8, 13)));
  assert.ok(same(sub(dec(9.28), dec(5.43)), dec(3.85)));
});

test('showing numbers: decimals, money and mixed numbers', () => {
  assert.equal(show(fr(9, 4), 'fraction'), '2 1/4');
  assert.equal(show(fr(3, 4)), '3/4');
  assert.equal(show(fr(9, 4), 'decimal'), '2.25');
  assert.equal(show(fr(15, 2), 'money'), '7.50');
  assert.equal(show(fr(7), 'money'), '7');
  assert.equal(show(fr(1, 3), 'decimal'), '1/3', 'a fraction with no exact decimal stays a fraction');
  assert.equal(show(fr(-38)), '−38');
});

test('typed answers: every equal form counts', () => {
  const want = fr(9, 4);
  for (const raw of ['2.25', '$2.25', '2 1/4', '9/4', '18/8', ' 2  1/4 ', '2.250']) assert.ok(same(parseAnswer(raw), want), raw);
  assert.ok(same(parseAnswer('.5'), fr(1, 2)));
  assert.ok(same(parseAnswer('7.'), fr(7)));
  assert.ok(same(parseAnswer('1,250.5'), fr(2501, 2)));
  for (const raw of ['', 'abc', '2/0', '1/2/3', '-3', '2 1/', '$']) assert.equal(parseAnswer(raw), null, raw);
});

test('equation text matches the math', () => {
  const cases = [
    [makeEq({ kind: 'plus', letter: 'm', a: dec(5.43), c: dec(9.28) }), 'm + 5.43 = 9.28', dec(3.85)],
    [makeEq({ kind: 'minus', letter: 't', a: dec(24.45), c: dec(13.27), flipped: true }), '13.27 = t − 24.45', dec(37.72)],
    [makeEq({ kind: 'times', letter: 'x', a: dec(1.8, 1), c: dec(40.14) }), '1.8x = 40.14', dec(22.3, 1)],
    [makeEq({ kind: 'div', letter: 'r', a: dec(5.5, 1), c: dec(18.2, 1) }), 'r ÷ 5.5 = 18.2', dec(100.1, 1)],
    [makeEq({ kind: 'plus', letter: 'y', a: fr(10, 3), c: fr(9, 2), style: 'fraction' }), 'y + 3 1/3 = 4 1/2', fr(7, 6)],
    [makeEq({ kind: 'times', letter: 'y', a: fr(2, 3), c: fr(5), style: 'fraction' }), '(2/3)y = 5', fr(15, 2)],
    [makeEq({ kind: 'times', letter: 't', a: fr(13, 8), c: fr(13), style: 'fraction' }), '(1 5/8)t = 13', fr(8)],
  ];
  for (const [eq, text, x] of cases) {
    assert.equal(eqText(eq), text);
    assert.ok(same(eq.x, x), `${text}: x = ${show(eq.x)}`);
    assert.ok(same(runForward(eq, x), eq.c));
    assert.ok(!checkLine(eq, x).includes('not'), checkLine(eq, x));
  }
  assert.equal(checkLine(cases[5][0], fr(15, 2)), '(2/3) × 7 1/2 = 5');
  assert.equal(checkLine(cases[0][0], dec(3.85)), '3.85 + 5.43 = 9.28');
});

test(`generators: ${RUNS} of each; positive answers, exact decimals where decimals are shown, friendly fractions`, () => {
  for (let i = 0; i < RUNS; i++) {
    for (const p of [genRegister(rnd, { flipped: i % 3 === 0 }), genPrice(rnd, { flipped: i % 4 === 0 }), genRecipe(rnd, { flipped: i % 3 === 0 }), genBatch(rnd, { story: i % 5 === 0 }),
      genMoneyStory(rnd), genPriceStory(rnd), genRecipeStory(rnd)]) {
      const { eq } = p;
      assert.ok(value(eq.x) > 0 && value(eq.c) > 0 && value(eq.a) > 0, `${eqText(eq)}`);
      assert.ok(same(runForward(eq, eq.x), eq.c));
      const txt = eqText(eq);
      assert.ok(noJunk(txt));
      if (eq.style !== 'fraction') assert.ok(!/\d \d|\//.test(txt), `decimal problems show no fractions: ${txt}`);
      if (eq.style === 'fraction') {
        assert.ok(eq.x.d <= 12 && eq.c.d <= 24, `friendly fractions: ${txt}, x = ${show(eq.x)}`);
        assert.ok(value(eq.x) <= 30);
      } else assert.ok(eq.x.d <= 1000 && eq.c.d <= 1000, `at most thousandths: ${txt}`);
      const st = undoStep(eq);
      assert.ok(checkBlock(eq, st.op, st.n).correct);
      for (const raw of [show(eq.x, eq.style), show(eq.x, 'fraction'), `${eq.x.n}/${eq.x.d}`]) assert.ok(checkCalc(eq, st.op, st.n, raw).correct, `${txt}: ${raw}`);
      if (p.story) assert.ok(noJunk(p.story));
      if (p.options) assert.equal(p.options.filter((o) => o.ok).length, 1);
    }
  }
});

test('the opposite block: reciprocal counts; each common mistake gets its own hint', () => {
  const t = makeEq({ kind: 'times', letter: 'y', a: fr(2, 3), c: fr(5), style: 'fraction' });
  assert.ok(checkBlock(t, '÷', fr(2, 3)).correct, 'divide by 2/3');
  assert.ok(checkBlock(t, '×', fr(3, 2)).correct, 'or multiply by the reciprocal 3/2');
  assert.equal(checkBlock(t, '×', fr(2, 3)).key, 'not_reciprocal');
  assert.match(checkBlock(t, '×', fr(2, 3)).message, /RECIPROCAL, 1 1\/2|RECIPROCAL, 3\/2/);
  const p = makeEq({ kind: 'plus', letter: 'm', a: dec(5.43), c: dec(9.28) });
  assert.equal(checkBlock(p, '+', dec(5.43)).key, 'did_not_undo');
  assert.equal(checkBlock(p, '-', dec(9.28)).key, 'used_total');
  assert.equal(checkBlock(p, '-', dec(5.34)).key, 'wrong_amount');
  assert.equal(checkBlock(p, '×', dec(5.43)).key, 'wrong_op');
  for (const r of [checkBlock(t, '×', fr(2, 3)), checkBlock(p, '+', dec(5.43))]) assert.ok(noJunk(r.message));
});

test('working it out: right forms, simplest form shown, and the classic slips', () => {
  const p = makeEq({ kind: 'plus', letter: 'm', a: dec(5.43), c: dec(9.28) });
  assert.ok(checkCalc(p, '-', dec(5.43), '3.85').correct);
  assert.equal(checkCalc(p, '-', dec(5.43), '38.5').key, 'place_value');
  assert.equal(checkCalc(p, '-', dec(5.43), '14.71').key, 'added_instead');
  assert.equal(checkCalc(p, '-', dec(5.43), '3.95').key, 'decimal_align');
  const m = makeEq({ kind: 'minus', letter: 'y', a: fr(11, 4), c: fr(9, 4), style: 'fraction' });    // y − 2 3/4 = 2 1/4
  const mixed = makeEq({ kind: 'plus', letter: 'y', a: fr(11, 4), c: fr(21, 4), style: 'fraction' });   // y + 2 3/4 = 5 1/4 -> 2 1/2
  assert.ok(checkCalc(mixed, '-', fr(11, 4), '2 1/2').correct);
  assert.ok(checkCalc(mixed, '-', fr(11, 4), '10/4').correct, 'unsimplified counts');
  assert.match(checkCalc(mixed, '-', fr(11, 4), '10/4').message, /Simplest form: 2 1\/2/);
  assert.equal(checkCalc(mixed, '-', fr(11, 4), '3 1/2').key, 'mixed_borrow', '5 1/4 − 2 3/4 done as 3 and 3/4 − 1/4');
  assert.ok(checkCalc(m, '+', fr(11, 4), '5').correct);
  const f = makeEq({ kind: 'plus', letter: 'y', a: fr(1, 3), c: fr(1, 2), style: 'fraction' });
  assert.equal(checkCalc(f, '-', fr(1, 3), '0/1').key, 'common_denominator');
  const t = makeEq({ kind: 'times', letter: 'y', a: fr(2, 3), c: fr(5), style: 'fraction' });
  assert.ok(checkCalc(t, '×', fr(3, 2), '7 1/2').correct && checkCalc(t, '÷', fr(2, 3), '7.5').correct);
  assert.equal(checkCalc(t, '÷', fr(2, 3), '3 1/3').key, 'not_reciprocal', 'multiplied by 2/3 instead of dividing');
  const d = makeEq({ kind: 'times', letter: 'x', a: dec(1.8, 1), c: dec(40.14) });
  assert.equal(checkCalc(d, '÷', dec(1.8, 1), '2.23').key, 'place_value');
  assert.ok(checkCalc(d, '÷', dec(1.8, 1), 'xyz').nudge);
});

test('predict: bigger or smaller, for × and ÷ by numbers above and below 1', () => {
  const cases = [[fr(5, 6), 'times', true], [fr(5), 'times', false], [fr(3, 2), 'times', false], [fr(3, 4), 'div', false], [fr(5, 2), 'div', true]];
  for (const [a, kind, bigger] of cases) {
    const eq = makeEq({ kind, letter: 'x', a, c: fr(25), style: 'fraction' });
    assert.equal(value(eq.x) > 25, bigger, `${eqText(eq)}`);
    assert.ok(checkPredict(eq, bigger).correct);
    const wrong = checkPredict(eq, !bigger);
    assert.ok(!wrong.correct && wrong.key === 'mult_makes_bigger' && noJunk(wrong.message));
  }
  for (let i = 0; i < RUNS; i++) {
    const { eq } = genBatch(rnd);
    assert.ok(checkPredict(eq, value(eq.x) > value(eq.c)).correct, eqText(eq));
  }
});

test('boss: which value makes it true, and Johnny\'s one-sided mistake', () => {
  for (let i = 0; i < 1000; i++) {
    const ch = genChoose(rnd, i % 2 ? 'times' : 'plus');
    assert.equal(ch.options.length, 4);
    assert.equal(new Set(ch.options.map((o) => o.text)).size, 4, 'four different choices');
    ch.options.forEach((o, j) => {
      assert.equal(same(runForward(ch.eq, o.v), ch.eq.c), Boolean(o.ok), o.text);
      const r = checkOption(ch, j);
      assert.equal(r.correct, Boolean(o.ok));
      assert.ok(noJunk(r.message));
    });
    const cr = genCritique(rnd);
    assert.ok(/LEFT side only/.test(cr.story) && !/\d \d\/\d/.test(cr.story), 'shown in decimals');
    cr.options.forEach((o, j) => assert.equal(checkOption(cr, j).correct, Boolean(o.ok)));
  }
  const ch = genChoose(seeded(3), 'times');
  assert.ok(ch.options.some((o) => o.trap === 'multiplied_by_coef'), 'the 0.17576 trap is there');
});

test('zones: right kinds, worked solutions end with a check, backups match', () => {
  assert.equal(ZONES.length, 5);
  for (let r = 0; r < 200; r++) {
    const zones = ZONES.map((_, z) => genZone(rnd, z));
    assert.ok(zones[0].every((p) => p.eq.style !== 'fraction' && (p.eq.kind === 'plus' || p.eq.kind === 'minus')));
    assert.ok(zones[1].every((p) => p.eq.kind === 'times' || p.eq.kind === 'div'));
    assert.ok(zones[2].every((p) => p.eq.style === 'fraction' && (p.eq.kind === 'plus' || p.eq.kind === 'minus')));
    assert.ok(zones[3].every((p) => p.type === 'predict') && zones[3].some((p) => p.story));
    assert.deepEqual(new Set(zones[4].map((p) => p.type)), new Set(['choose', 'critique', 'story']));
    for (const p of zones.flat()) {
      const lines = workedSolution(p);
      assert.ok(lines.length >= 3 && lines.every(noJunk), `${p.type}: ${lines.join(' | ')}`);
      assert.ok(lines.at(-1).startsWith('Check:') && lines.at(-1).endsWith('✓'));
      const b = genBackup(rnd, p);
      assert.equal(b.type, p.type);
      assert.equal(b.eq.style === 'fraction', p.eq.style === 'fraction');
    }
  }
});

console.log(`\n${passed} tests passed`);
