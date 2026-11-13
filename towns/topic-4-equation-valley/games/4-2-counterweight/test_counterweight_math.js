// Tests for Counterweight's math (balance.js). Run with:  node towns/topic-4-equation-valley/games/4-2-counterweight/test_counterweight_math.js
import assert from 'node:assert/strict';
import {
  seeded, OPS, INVERSE, PROPERTY, DIAL, pan, applyOp, weigh, settled, tilt, stepText, genMatch, hitPan, checkMatch, matchAnswer,
  genSolve, checkSolve, solveAnswer, genInspect, checkInspect, ZONES, genZone,
} from './balance.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261124);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
const whole = (v) => Math.abs(v - Math.round(v)) < 1e-9;

test('pans: text, weight and operations on a whole pan', () => {
  assert.equal(pan(1, 3).text, 'x + 3'); assert.equal(pan(2, 0).text, '2x'); assert.equal(pan(0, 9).text, '9'); assert.equal(pan(1, -5).text, 'x − 5'); assert.equal(pan(0.25, 0).text, 'x ÷ 4');
  const s = pan(1, 2);
  assert.equal(weigh(s, 4), 6); assert.equal(applyOp(s, '×', 3).text, '(x + 2) × 3'); assert.equal(weigh(applyOp(s, '×', 3), 4), 18); assert.equal(settled(applyOp(s, '×', 3)), '3x + 6');
  assert.equal(applyOp(pan(0, 12), '+', 6).text, '12 + 6'); assert.equal(applyOp(pan(0, 12), '-', 5).text, '12 − 5'); assert.equal(settled(applyOp(pan(4, 4), '÷', 4)), 'x + 1');
  assert.equal(tilt(pan(0, 12), pan(0, 12), 0), 0); assert.equal(tilt(pan(0, 18), pan(0, 12), 0), -1, 'the heavier left pan goes down'); assert.equal(tilt(pan(1, 2), pan(0, 9), 4), 1);
  assert.equal(stepText('-', 4), '− 4'); assert.equal(stepText('×', 3), '× 3'); assert.equal(INVERSE['÷'], '×'); assert.ok(/MULTIPLICATION/.test(PROPERTY['×']));
});

test(`match: ${RUNS} rounds; the same change levels the scale, and the amount fits the dial`, () => {
  for (let i = 0; i < RUNS; i++) {
    const ops = [[OPS[i % 4]], ['+', '×'], ['×', '-']][i % 9 < 7 ? 0 : i % 2 + 1], withX = i % 3 !== 0, curtain = i % 5 === 0;
    const p = genMatch(rnd, { ops, withX, curtain });
    assert.equal(tilt(p.left, p.right, p.x), 0, 'it starts level'); assert.ok(noJunk(p.left.text) && noJunk(p.right.text) && p.hits.length === ops.length && p.other !== p.side);
    assert.deepEqual(p.hits.map((h) => h.op), ops); if (withX) assert.ok(p.left.a > 0 || p.right.a > 0);
    let mine = p[p.other];
    p.hits.forEach((h, k) => {
      assert.ok(h.n >= DIAL.lo && h.n <= DIAL.hi && Number.isInteger(h.n));
      const before = hitPan(p, k), after = hitPan(p, k + 1); assert.ok(whole(weigh(after, p.x)) && weigh(after, p.x) >= 1 && weigh(after, p.x) <= 99, `${before.text} ${stepText(h.op, h.n)} is a whole weight`);
      assert.ok(whole(after.a) && whole(after.b), 'no broken blocks');
      const good = checkMatch(p, k, mine, h.op, h.n); assert.ok(good.ok && good.property === PROPERTY[h.op] && noJunk(good.message)); assert.ok(noJunk(matchAnswer(p, k)));
      const undo = checkMatch(p, k, mine, INVERSE[h.op], h.n); assert.ok(!undo.ok && undo.key === 'undid' && /SAME thing/.test(undo.message));
      const amount = checkMatch(p, k, mine, h.op, h.n + 1); assert.ok(!amount.ok && amount.key === 'amount');
      if (h.op === '×' && weigh(mine, p.x) * h.n !== weigh(mine, p.x) + h.n) assert.equal(checkMatch(p, k, mine, '+', h.n).key, 'mixed_ops');
      for (const res of [undo, amount]) assert.ok(noJunk(res.message) && res.pan.text.length > mine.text.length, 'the wrong change is still shown on the pan');
      mine = good.pan;
    });
    assert.equal(tilt(p.side === 'left' ? hitPan(p) : mine, p.side === 'left' ? mine : hitPan(p), p.x), 0, 'matched: level again');
  }
});

test('match: a different change that really does level the scale counts too', () => {
  const p = { x: 0, left: pan(0, 12), right: pan(0, 12, '8 + 4'), side: 'left', other: 'right', hits: [{ op: '×', n: 3 }], curtain: false };
  assert.ok(checkMatch(p, 0, p.right, '×', 3).ok); assert.ok(checkMatch(p, 0, p.right, '+', 24).ok, '12 + 24 is 36 too'); assert.equal(checkMatch(p, 0, p.right, '+', 3).key, 'mixed_ops'); assert.equal(checkMatch(p, 0, p.right, '-', 5).key, 'off');
  const c = { ...p, curtain: true }; assert.ok(/before and after/.test(checkMatch(c, 0, c.right, '×', 2).message) && !/saboteur did/.test(checkMatch(c, 0, c.right, '-', 5).message));
});

test('your move: the opposite operation gets x alone, and the scale never tips', () => {
  for (let i = 0; i < RUNS; i++) {
    const op = OPS[i % 4], p = genSolve(rnd, op);
    assert.equal(tilt(p.left, p.right, p.x), 0); assert.ok(whole(p.x) && p.x >= 1 && weigh(p.left, p.x) >= 1 && whole(weigh(p.left, p.x)), `${p.left.text} = ${p.right.text}`);
    assert.ok(p.n >= DIAL.lo && p.n <= DIAL.hi && noJunk(solveAnswer(p)) && solveAnswer(p).includes(`x = ${p.x}`));
    const good = checkSolve(p, INVERSE[op], p.n); assert.ok(good.ok && good.property === PROPERTY[INVERSE[op]] && [good.left.text, good.right.text].includes('x') && [good.left.text, good.right.text].includes(String(p.x)));
    for (const o of OPS) for (const n of [p.n, p.n + 1]) {
      if (o === INVERSE[op] && n === p.n) continue;
      const res = checkSolve(p, o, n); assert.ok(!res.ok && noJunk(res.message) && /Still level/.test(res.message)); assert.equal(tilt(res.left, res.right, p.x), 0, 'the same move on both pans keeps it level');
    }
    assert.equal(checkSolve(p, op, p.n).key, 'same_op'); assert.equal(checkSolve(p, INVERSE[op], p.n + 1).key, 'amount');
    assert.equal(checkSolve(p, op === '+' || op === '-' ? '÷' : '-', p.n).key, 'wrong_kind');
  }
  const p = { x: 4, op: '+', n: 5, left: pan(1, 5), right: pan(0, 9) };
  assert.equal(checkSolve(p, '-', 5).text, 'x = 4'); assert.equal(checkSolve(p, '+', 5).text, 'x + 10 = 14');
});

test('inspector: only the same change to both whole pans stays level', () => {
  for (let i = 0; i < RUNS; i++) {
    const kind = ['same', 'one_side', 'amounts', 'mixed', 'partial'][i % 5], p = genInspect(rnd, kind);
    assert.equal(p.level, kind === 'same'); assert.equal(tilt(p.left, p.right, p.x) === 0, p.level, `${p.left.text} = ${p.right.text} (x = ${p.x})`);
    assert.ok(noJunk(p.before) && noJunk(p.left.text) && noJunk(p.right.text) && noJunk(p.why) && whole(weigh(p.left, p.x)) && whole(weigh(p.right, p.x)));
    assert.ok(checkInspect(p, p.level).ok); const wrong = checkInspect(p, !p.level); assert.ok(!wrong.ok && noJunk(wrong.message)); assert.equal(wrong.key, p.level ? 'doubted_same' : kind);
    if (kind === 'partial') assert.ok(/x × \d \+ \d/.test(p.left.text + p.right.text), 'only the x-blocks were multiplied');
  }
});

test('zones', () => {
  assert.equal(ZONES.length, 5);
  for (let i = 0; i < 300; i++) {
    const z = [0, 1, 2, 3, 4].map((k) => genZone(rnd, k));
    assert.ok(z[0].length === 8 && z[0].every((r) => r.type === 'match' && r.hits.length === 1 && ['+', '-'].includes(r.hits[0].op)) && z[0].slice(0, 4).every((r) => !r.left.a && !r.right.a) && z[0].slice(4).every((r) => r.left.a || r.right.a));
    assert.ok(z[1].length === 8 && z[1].every((r) => ['×', '÷'].includes(r.hits[0].op)));
    assert.ok(z[2].length === 6 && z[2].every((r) => r.type === 'solve')); assert.equal(new Set(z[2].map((r) => r.op)).size, 4);
    assert.ok(z[3].length === 10 && z[3].every((r) => r.type === 'inspect')); assert.equal(z[3].filter((r) => r.level).length, 4);
    assert.deepEqual(z[4].map((r) => `${r.hits.length}${r.curtain ? 'c' : ''}`), ['2', '1c', '2', '1c', '1c']);
  }
});

console.log(`\n${passed} tests passed`);
