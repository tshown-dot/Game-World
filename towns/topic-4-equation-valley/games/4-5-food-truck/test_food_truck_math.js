// Tests for Food Truck (truck.js). Run with:  node towns/topic-4-equation-valley/games/4-5-food-truck/test_food_truck_math.js
import assert from 'node:assert/strict';
import {
  seeded, fr, add, sub, mul, div, same, value, recip, show, imp, parseAnswer, makeEq, eqText, checkLine, undoStep, apply,
  genRegister, genPrice, genRecipe, genBatch, moreOrLess, checkEstimate, genEstimate, toolsFor, unwind, checkRing,
  genBuild, checkBuild, genSlip, checkSlip, ZONES, genZone,
} from './truck.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261120);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
const anyEq = (i) => [genRegister, genPrice, genRecipe, genBatch][i % 4](rnd).eq;

test('exact fractions and how numbers are shown', () => {
  assert.ok(same(add(fr(1, 10), fr(2, 10)), fr(3, 10))); assert.ok(same(div(fr(4), fr(2, 3)), fr(6))); assert.ok(same(mul(fr(2, 3), fr(3, 2)), fr(1)));
  assert.equal(show(fr(9, 4), 'decimal'), '2.25'); assert.equal(show(fr(9, 4), 'fraction'), '2 1/4'); assert.equal(show(fr(15, 2), 'money'), '7.50'); assert.equal(show(fr(6), 'money'), '6');
  assert.equal(imp(fr(3, 2)), '3/2'); assert.equal(imp(fr(4)), '4'); assert.ok(same(recip(fr(2, 3)), fr(3, 2)));
  assert.equal(eqText(makeEq({ kind: 'times', letter: 'm', a: fr(2, 3), c: fr(4), style: 'fraction' })), '(2/3)m = 4');
  assert.equal(eqText(makeEq({ kind: 'plus', letter: 'p', a: fr(11, 4), c: fr(6), style: 'money' })), 'p + 2.75 = 6');
});

test('typed answers: every equal form counts', () => {
  for (const raw of ['2.25', '$2.25', '2 1/4', '9/4', '18/8', ' 2.250 ']) assert.ok(same(parseAnswer(raw), fr(9, 4)), raw);
  assert.ok(same(parseAnswer('.5'), fr(1, 2))); assert.ok(same(parseAnswer('7.'), fr(7))); assert.ok(same(parseAnswer('1,250'), fr(1250)));
  for (const raw of ['', 'abc', '1/0', '2 1/0', '-3', '1.2.3', '3 /4']) assert.equal(parseAnswer(raw), null, raw);
});

test('more or less: the estimate', () => {
  const want = { 'times<1': 'more', 'times>1': 'less', 'div<1': 'less', 'div>1': 'more', plus: 'less', minus: 'more' };
  for (let i = 0; i < RUNS; i++) {
    for (const [what, answer] of Object.entries(want)) {
      const eq = genEstimate(rnd, what).eq;
      assert.equal(moreOrLess(eq), answer, `${eqText(eq)} (${what})`);
      assert.notEqual(value(eq.x), value(eq.c)); assert.ok(value(eq.x) > 0 && noJunk(eqText(eq)) && eqText(eq).length <= 16, eqText(eq));
      assert.equal(checkEstimate(eq, answer), null);
      const wrong = checkEstimate(eq, answer === 'more' ? 'less' : 'more');
      assert.equal(wrong.key, what === 'plus' || what === 'minus' ? 'add_sub_direction' : 'mult_makes_bigger');
      assert.ok(noJunk(wrong.message) && wrong.message.includes(`which is ${answer.toUpperCase()} than`), wrong.message);
      assert.equal(checkEstimate(eq, null).key, 'too_slow');
    }
  }
  const eq = makeEq({ kind: 'times', letter: 'x', a: fr(1, 2), c: fr(6), style: 'decimal' });
  assert.equal(checkEstimate(eq, 'less').message, 'x = 12, which is MORE than 6. Multiplying by less than 1 makes a number smaller, so x was bigger before.');
});

test(`which undo: ${RUNS} tickets, the tools and what each does to the ticket`, () => {
  const keys = new Set();
  for (let i = 0; i < RUNS; i++) {
    const eq = anyEq(i), tools = toolsFor(rnd, eq);
    assert.equal(tools.length, 4, eqText(eq)); assert.equal(new Set(tools.map((t) => t.text)).size, 4, 'no tool twice');
    const results = tools.map((t) => unwind(eq, t.op, t.n));
    const fractionTimes = (eq.kind === 'times' || eq.kind === 'div') && eq.style === 'fraction' && eq.a.d > 1;
    assert.equal(results.filter((r) => r.correct).length, fractionTimes ? 2 : 1, `${eqText(eq)}: ${tools.map((t) => t.text).join(' | ')}`);
    for (const [k, r] of results.entries()) {
      assert.ok(r.lines.every(noJunk) && noJunk(r.message), `${eqText(eq)} ${tools[k].text}`);
      if (r.correct) {
        assert.ok(r.lines.includes(`${eq.letter} = ${show(eq.x, eq.style)}`) && /✓$/.test(r.lines.at(-1)));
        assert.ok(same(apply(eq.c, tools[k].op, tools[k].n), eq.x), 'a right tool really gives the answer');
      } else keys.add(r.key);
    }
  }
  for (const k of ['did_not_undo', 'not_reciprocal', 'used_total', 'wrong_op']) assert.ok(keys.has(k), k);
  const eq = makeEq({ kind: 'times', letter: 'm', a: fr(2, 3), c: fr(4), style: 'fraction' });
  assert.deepEqual(toolsFor(rnd, eq).map((t) => t.text).sort(), ['× 2/3', '× 3/2', '÷ 2/3', '− 2/3']);
  assert.deepEqual(unwind(eq, '×', fr(3, 2)).lines, ['(2/3)m × 3/2 = 4 × 3/2', '2/3 × 3/2 = 1, so m is alone', 'm = 6', 'Check: (2/3) × 6 = 4 ✓']);
  assert.equal(unwind(eq, '÷', fr(2, 3)).correct, true);
  const again = unwind(eq, '×', fr(2, 3)); assert.equal(again.key, 'not_reciprocal'); assert.ok(again.lines[1].startsWith('(4/9)m = 2 2/3') && /RECIPROCAL, 3\/2/.test(again.message));
  const plus = makeEq({ kind: 'plus', letter: 'p', a: fr(11, 4), c: fr(6), style: 'decimal' });
  assert.deepEqual(unwind(plus, '-', fr(11, 4)).lines, ['p + 2.75 − 2.75 = 6 − 2.75', 'p = 3.25', 'Check: 3.25 + 2.75 = 6 ✓']);
  assert.ok(unwind(plus, '+', fr(11, 4)).lines[1].startsWith('p + 5.5 = 8.75'));
});

test('ring it up: exact answers and what the register says', () => {
  for (let i = 0; i < RUNS; i++) {
    const eq = anyEq(i), x = eq.x;
    for (const raw of [show(x, 'fraction'), `${x.n}/${x.d}`, show(x, eq.style)]) assert.equal(checkRing(eq, raw).correct, true, `${eqText(eq)} <- ${raw}`);
    const wrong = checkRing(eq, show(add(x, fr(1)), 'fraction'));
    assert.ok(wrong.correct === false && noJunk(wrong.key) && noJunk(wrong.message) && /The register checked it: .*, not /.test(wrong.message), wrong.message);
    assert.equal(checkRing(eq, 'abc').nudge, true);
  }
  const eq = makeEq({ kind: 'plus', letter: 'p', a: fr(11, 4), c: fr(6), style: 'decimal' });
  assert.equal(checkRing(eq, '8.75').key, 'added_instead'); assert.ok(checkRing(eq, '8.75').message.includes('8.75 + 2.75 = 11.5, not 6'));
  const t = makeEq({ kind: 'times', letter: 'm', a: fr(2, 3), c: fr(4), style: 'fraction' });
  assert.equal(checkRing(t, '2 2/3').key, 'not_reciprocal'); assert.equal(checkRing(t, '6').message, 'Check: (2/3) × 6 = 4 ✓');
  assert.equal(checkRing(makeEq({ kind: 'times', letter: 'y', a: fr(18, 10), c: fr(4014, 100), style: 'decimal' }), '2.23').key, 'place_value');
});

test('build the ticket: any true way of writing the order counts', () => {
  const kinds = new Set();
  for (let i = 0; i < RUNS; i++) {
    const p = genBuild(rnd, ['money', 'price', 'recipe'][i % 3]), k = p.eq.kind; kinds.add(k);
    assert.ok(noJunk(p.story) && p.tiles.length === 3 && new Set(p.tiles.map((t) => t.text)).size === 3, p.story);
    const ways = k === 'plus' ? [['L', '+', 'a', 'c'], ['a', '+', 'L', 'c'], ['c', '-', 'a', 'L'], ['c', '-', 'L', 'a']]
      : k === 'minus' ? [['L', '-', 'a', 'c'], ['L', '-', 'c', 'a'], ['c', '+', 'a', 'L'], ['a', '+', 'c', 'L']]
        : [['a', '×', 'L', 'c'], ['L', '×', 'a', 'c'], ['c', '÷', 'a', 'L'], ['c', '÷', 'L', 'a']];
    for (const w of ways) assert.equal(checkBuild(p, ...w).correct, true, `${p.story} <- ${w.join(' ')}`);
    assert.equal(checkBuild(p, 'L', k === 'times' ? '+' : '×', 'a', 'c').key, 'story_op');
    const backwards = k === 'plus' ? ['L', '-', 'a', 'c'] : k === 'minus' ? ['L', '+', 'a', 'c'] : ['L', '÷', 'a', 'c'];
    assert.equal(checkBuild(p, ...backwards).key, 'story_order');
    assert.equal(checkBuild(p, 'L', null, 'a', 'c').nudge, true);
  }
  assert.deepEqual([...kinds].sort(), ['minus', 'plus', 'times']);
});

test("the new cook's slip: exactly one line is wrong", () => {
  for (let i = 0; i < RUNS; i++) {
    const slip = ['one_side', 'wrong_op', 'arithmetic'][i % 3], p = genSlip(rnd, slip), eq = p.eq, good = `${eq.letter} = ${show(eq.x, eq.style)}`;
    assert.equal(p.lines.length, 3); assert.equal(p.lines[0], eqText(eq)); assert.ok(p.lines.every(noJunk) && noJunk(p.explain));
    assert.equal(p.wrong, slip === 'arithmetic' ? 2 : 1);
    assert.notEqual(p.lines[2], good, 'the cook never lands on the right answer');
    assert.ok(p.explain.includes(show(eq.x, eq.style)), 'the explanation gives the right answer');
    assert.equal(checkSlip(p, p.wrong).correct, true); assert.equal(checkSlip(p, p.wrong === 1 ? 2 : 1).key, 'critique');
    if (slip === 'one_side') assert.equal(p.lines[1].split(' = ')[1], show(eq.c, eq.style), 'one side was left alone');
  }
});

test('zones', () => {
  assert.equal(ZONES.length, 5);
  for (let i = 0; i < 300; i++) {
    const z = [0, 1, 2, 3, 4].map((k) => genZone(rnd, k));
    assert.ok(z[0].every((r) => r.type === 'sort' && r.tickets.length >= 6));
    assert.ok(z[0].flatMap((r) => r.tickets).some((t) => moreOrLess(t.eq) === 'more') && z[0].flatMap((r) => r.tickets).some((t) => moreOrLess(t.eq) === 'less'));
    assert.ok(z[1].length === 6 && z[1].every((r) => r.type === 'tool' && r.eq.style === 'decimal' && r.tools.length === 4));
    assert.ok(z[2].length === 6 && z[2].every((r) => r.type === 'tool' && r.eq.style === 'fraction'));
    assert.ok(z[3].length === 6 && z[3].every((r) => r.type === 'ring'));
    assert.deepEqual(z[4].map((r) => r.type), ['build', 'ring', 'sort', 'critique', 'build', 'ring', 'critique']);
    assert.equal(z[4][1].eq, z[4][0].eq, 'the ticket you build is the ticket you ring up'); assert.ok(noJunk(z[4][1].story));
    for (const r of z.flat()) if (r.eq) assert.ok(value(r.eq.x) > 0 && noJunk(eqText(r.eq)) && noJunk(checkLine(r.eq, r.eq.x)));
  }
  assert.ok(same(sub(fr(1), fr(1, 4)), fr(3, 4)));
});

console.log(`\n${passed} tests passed`);
