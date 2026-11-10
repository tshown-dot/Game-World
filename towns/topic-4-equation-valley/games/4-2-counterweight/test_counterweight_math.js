// Tests for Lesson 4-2 "Counterweight" math (balance.js).  Run with:  node test_counterweight_math.js
import assert from 'node:assert/strict';
import {
  seeded, side, applyOp, weigh, isBalanced, eqText, parseAmount, sameSolutions,
  genRebalance, genIsolate, genProperty, genInspect, genBoss, genZone, genBackup, ZONES, PROPERTIES, MISTAKES, OPS,
  checkRebalance, checkIsolate, checkProperty, checkStamp, checkMistake, checkPartial, checkChain, workedSolution,
} from './balance.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 3000;
const rnd = seeded(20261110);

// Turns a displayed side like "(7 + 5) × 3 − 2" into its value, so we can prove the text matches the math.
const evalText = (text) => Function(`return (${text.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')});`)();
const isWhole = (v) => Number.isInteger(Math.round(v * 1e9) / 1e9) && v >= 0;
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);

test('amounts: whole numbers in several formats; no zero, no decimals, no huge numbers', () => {
  assert.equal(parseAmount('4', '+'), 4);
  assert.equal(parseAmount(' 04 ', '×'), 4);
  assert.equal(parseAmount('+4', '-'), 4);
  assert.equal(parseAmount('12', '÷'), 12);
  assert.equal(parseAmount('0', '÷'), null, 'never divide by zero');
  assert.equal(parseAmount('0', '×'), null);
  assert.equal(parseAmount('0', '+'), null, 'adding zero changes nothing');
  assert.equal(parseAmount('2.5', '+'), null);
  assert.equal(parseAmount('-3', '+'), null);
  assert.equal(parseAmount('100', '+'), null);
  assert.equal(parseAmount('', '+'), null);
  assert.equal(parseAmount('abc', '+'), null);
});

test('sides: display text always matches the weight, with parentheses when a whole side is multiplied', () => {
  const s = applyOp(applyOp(side(0, 12, '7 + 5'), '+', 4), '×', 3);
  assert.equal(s.text, '(7 + 5 + 4) × 3');
  assert.equal(weigh(s, null), 48);
  assert.equal(evalText(s.text), 48);
  assert.equal(applyOp(side(0, 24), '÷', 4).text, '24 ÷ 4');
});

test(`rebalance (number sides, + and −): ${RUNS} problems are fair and checked correctly`, () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genRebalance(rnd);
    const { op, n } = p.sabotage;
    assert.ok(isBalanced(p.start) && !isBalanced(p.after), 'starts balanced, sabotage tips it');
    for (const s of [p.start.left, p.start.right, p.after.left, p.after.right]) {
      assert.ok(isWhole(weigh(s, null)) && weigh(s, null) > 0, `positive whole weights: ${s.text}`);
      assert.ok(Math.abs(evalText(s.text) - weigh(s, null)) < 1e-9, `text matches value: ${s.text}`);
    }
    assert.ok(n >= 1 && n <= 99 && parseAmount(String(n), op) === n, 'the right amount can be typed');
    const ok = checkRebalance(p, op, n);
    assert.ok(ok.correct && ok.key === 'correct', 'the same move fixes it');
    const opp = { '+': '-', '-': '+' }[op];
    const bad = checkRebalance(p, opp, n);
    assert.ok(!bad.correct && bad.key === 'opposite_op', 'doing the opposite is caught');
    const amt = checkRebalance(p, op, n + 1);
    assert.ok(!amt.correct && amt.key === 'different_amount', 'a different amount is caught');
    assert.ok(noJunk(p.prompt) && noJunk(ok.message) && noJunk(bad.message) && noJunk(amt.message));
  }
});

test(`rebalance (× and ÷): ${RUNS} problems; dividing always comes out whole`, () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genRebalance(rnd, { ops: ['×', '÷'] });
    const { op, n } = p.sabotage;
    assert.ok(n >= 2, 'multiply or divide by at least 2');
    assert.ok(isWhole(weigh(p.after[p.sabotage.side], null)), `whole after ${op}: ${p.after[p.sabotage.side].text}`);
    const fixed = checkRebalance(p, op, n).result;
    assert.ok(isWhole(weigh(fixed[p.fixSide], null)), 'the fixed side is whole too');
    assert.ok(checkRebalance(p, op, n).correct);
    const opp = { '×': '÷', '÷': '×' }[op];
    const r = checkRebalance(p, opp, n);
    assert.ok(!r.correct && r.key === 'opposite_op');
    assert.ok(Math.abs(evalText(p.after[p.sabotage.side].text) - weigh(p.after[p.sabotage.side], null)) < 1e-9);
  }
});

test(`rebalance with x-blocks: ${RUNS} problems keep x a whole number and are fixable`, () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genRebalance(rnd, { ops: ['-', '÷'], variable: true });
    assert.ok(Number.isInteger(p.start.x) && p.start.x >= 2, 'x is a whole number');
    assert.ok(isBalanced(p.start) && !isBalanced(p.after));
    assert.ok(checkRebalance(p, p.sabotage.op, p.sabotage.n).correct);
    assert.ok(Number.isInteger(p.after.left.a) && Number.isInteger(p.after.left.b), 'no fractions of x-blocks');
  }
});

test(`isolate: ${RUNS} problems; the right step frees x, common wrong steps get the right message`, () => {
  const seen = new Set();
  for (let i = 0; i < RUNS; i++) {
    const p = genIsolate(rnd);
    seen.add(p.kind);
    const good = checkIsolate(p, p.answer.op, p.answer.n);
    assert.ok(good.correct, eqText(p.start));
    assert.equal(weigh(good.result.right, null), p.start.x, 'x comes out to the hidden value');
    assert.ok(weigh(p.start.right, null) > 0, 'positive right side');
    if (p.kind === 'times') {
      assert.equal(checkIsolate(p, '×', p.answer.n).key, 'multiplied_instead');
      assert.equal(checkIsolate(p, '-', p.answer.n).key, 'add_sub_with_coefficient');
      if (p.answer.n !== 2) assert.equal(checkIsolate(p, '÷', 2).key, 'wrong_divisor');
    } else if (p.kind === 'plus') {
      assert.equal(checkIsolate(p, '+', p.answer.n).key, 'added_instead');
      assert.equal(checkIsolate(p, '-', p.answer.n + 1).key, 'wrong_amount');
    } else {
      assert.equal(checkIsolate(p, '-', p.answer.n).key, 'subtracted_instead');
      assert.equal(checkIsolate(p, '+', p.answer.n + 1).key, 'wrong_amount');
    }
    assert.ok(noJunk(good.message));
  }
  assert.deepEqual([...seen].sort(), ['minus', 'plus', 'times'], 'all three kinds appear');
});

test('property questions: 4 choices (the four properties), right answer matches the step', () => {
  const ops = new Set();
  for (let i = 0; i < RUNS; i++) {
    const p = genProperty(rnd);
    ops.add(p.op);
    assert.deepEqual(p.choices, PROPERTIES);
    assert.equal(p.choices.length, 4);
    assert.ok(isBalanced(p.start) && isBalanced(p.after), 'both equations are true');
    assert.ok(checkProperty(p, p.answer).correct);
    for (const wrong of PROPERTIES.filter((c) => c !== p.answer)) assert.equal(checkProperty(p, wrong).correct, false);
    assert.ok(isWhole(weigh(p.after.right, null)), 'division comes out whole');
    assert.ok(noJunk(p.prompt) && noJunk(checkProperty(p, p.answer).message));
  }
  assert.equal(ops.size, 4, 'all four properties get asked');
});

test(`inspector: ${RUNS} repairs; "balanced" exactly when the same thing happened to both sides`, () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genInspect(rnd);
    assert.equal(p.equivalent, p.kind === 'same', `${p.kind}: ${eqText(p.after)}`);
    for (const s of [p.after.left, p.after.right]) {
      assert.ok(Math.abs(evalText(s.text) - weigh(s, null)) < 1e-9, `text matches value: ${s.text}`);
      assert.ok(weigh(s, null) > 0, `positive: ${s.text}`);
    }
    assert.ok(checkStamp(p, p.equivalent).correct && !checkStamp(p, !p.equivalent).correct);
    if (!p.equivalent) {
      assert.ok(p.mistake in MISTAKES);
      assert.ok(checkMistake(p, p.mistake).correct);
      for (const other of Object.keys(MISTAKES).filter((k) => k !== p.mistake)) assert.equal(checkMistake(p, other).correct, false);
    }
  }
});

test('boss partial steps: dividing by the right number leaves the asked-for b-blocks', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genBoss(rnd, 'partial');
    const good = checkPartial(p, p.answer.op, p.answer.n);
    assert.ok(good.correct);
    assert.ok(isWhole(good.result.right.b), 'whole number on the right');
    assert.equal(checkPartial(p, '÷', p.start.left.a).key, 'went_too_far', 'dividing all the way to 1b is explained');
    assert.equal(checkPartial(p, '×', p.answer.n).key, 'wrong_op');
  }
});

test('boss chains: same two steps in the same order balance; swapped order is caught', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genBoss(rnd, 'chain');
    assert.ok(checkChain(p, p.moves).correct);
    const swapped = checkChain(p, [p.moves[1], p.moves[0]]);
    assert.ok(!swapped.correct && swapped.key === 'order', `order matters: ${eqText(p.after)}`);
    assert.ok(weigh(p.after.left, null) > 0);
    assert.ok(Math.abs(evalText(p.after.left.text) - weigh(p.after.left, null)) < 1e-9);
  }
});

test('boss critiques: only the "same step both sides" version is right', () => {
  const seen = new Set();
  for (let i = 0; i < RUNS; i++) {
    const p = genBoss(rnd, 'critique');
    seen.add(p.mistake);
    assert.equal(p.equivalent, p.mistake === null);
    assert.equal(p.equivalent, sameSolutions(p.start, p.after));
    assert.ok(noJunk(p.prompt));
  }
  assert.equal(seen.size, 3);
});

test('a full run: 5 zones, 2 property questions, every problem has a worked solution and a backup', () => {
  for (let run = 0; run < 200; run++) {
    const zones = ZONES.map((_, z) => genZone(rnd, z));
    assert.deepEqual(zones.map((z) => z.length), [4, 3, 4, 4, 5]);
    const all = zones.flat();
    assert.equal(all.filter((p) => p.type === 'property').length, 2, 'only one or two property questions');
    assert.equal(new Set(zones[3].map((p) => p.kind)).size, 4, 'the inspector shows 4 different kinds');
    for (const p of all) {
      const lines = workedSolution(p);
      assert.ok(lines.length >= 2 && lines.every(noJunk), `worked solution for ${p.type}`);
      assert.equal(genBackup(rnd, p).type, p.type, 'backup problem is the same type');
      assert.ok(noJunk(p.prompt));
    }
  }
});

test('every operation is offered and named', () => {
  assert.deepEqual(OPS, ['+', '-', '×', '÷']);
});

console.log(`\n${passed} tests passed`);
