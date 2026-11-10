/**
 * Term Popper (Lesson 3-7) - math + board tests. Run: node cartridges/shooter/test_shooter_math.js
 */
import assert from 'assert';
import {
  parseTerm, getTermSignature, doTermsMatch, formatTerm, formatSum, formatCombination,
  explainUnlike, lookAlike, sumCoefficients,
} from './js/terms.js?v=20261110pop1';
import { Board, RADIUS } from './js/board.js?v=20261110pop1';
import { makeRng, buildBoard, dropCeiling, nextShot, randomTerm } from './js/generator.js?v=20261110pop1';
import { STAGES, BOSS, DANGER_Y } from './js/curriculum.js?v=20261110pop1';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`  ❌ ${name}`);
    throw e;
  }
}
const T = (s) => parseTerm(s);

console.log('🎯 Term Popper (Like Terms) Math Verification\n');

// ---------------------------------------------------------------- terms
test('verification gate: $15, 15, 15.00 are all constants', () => {
  for (const s of ['15', '$15', '15.00', '$15.00']) assert.strictEqual(getTermSignature(s), '', s);
  assert.deepStrictEqual(T('$15.00'), { coef: 15, sig: '' });
  assert.strictEqual(doTermsMatch('$15', '15.00'), true);
  assert.strictEqual(doTermsMatch('7', '-3'), true);
});

test('parses coefficients, signs, letters and exponents', () => {
  assert.deepStrictEqual(T('3x'), { coef: 3, sig: 'x' });
  assert.deepStrictEqual(T('x'), { coef: 1, sig: 'x' });
  assert.deepStrictEqual(T('-x'), { coef: -1, sig: 'x' });
  assert.deepStrictEqual(T('−x'), { coef: -1, sig: 'x' });
  assert.deepStrictEqual(T('-3x²'), { coef: -3, sig: 'x^2' });
  assert.deepStrictEqual(T('2x^2'), { coef: 2, sig: 'x^2' });
  assert.deepStrictEqual(T('x^1'), { coef: 1, sig: 'x' });
  assert.deepStrictEqual(T('Y³'), { coef: 1, sig: 'y^3' });
  assert.strictEqual(T(''), null);
  assert.strictEqual(T('3x+2'), null);
  assert.strictEqual(T('^2'), null);
  assert.strictEqual(T('xy'), null);
});

test('like terms need same letter AND same exponent', () => {
  assert.strictEqual(doTermsMatch('3x', '-5x'), true);
  assert.strictEqual(doTermsMatch('3x²', '-x²'), true);
  assert.strictEqual(doTermsMatch('x²', 'x'), false);
  assert.strictEqual(doTermsMatch('2x³', '3x²'), false);
  assert.strictEqual(doTermsMatch('2y²', '3x²'), false);
  assert.strictEqual(doTermsMatch('3x', '2y'), false);
  assert.strictEqual(doTermsMatch('3x', '3'), false);
});

test('formats terms the way students write them', () => {
  assert.strictEqual(formatTerm({ coef: 1, sig: 'x' }), 'x');
  assert.strictEqual(formatTerm({ coef: -1, sig: 'x' }), '−x');
  assert.strictEqual(formatTerm({ coef: 5, sig: 'x^2' }), '5x²');
  assert.strictEqual(formatTerm({ coef: -4, sig: '' }), '−4');
  assert.strictEqual(formatTerm({ coef: 1, sig: '' }), '1');
  for (const s of ['3x', '-x', 'x²', '-12y²', '7', '-3']) {
    assert.deepStrictEqual(T(formatTerm(T(s))), T(s), `round trip ${s}`);
  }
});

test('combination equations read as subtraction', () => {
  assert.strictEqual(formatSum([T('3x'), T('2x'), T('-5x')]), '3x + 2x − 5x');
  assert.strictEqual(formatCombination([T('3x'), T('2x'), T('-5x')]), '3x + 2x − 5x = 0');
  assert.strictEqual(formatCombination([T('5y'), T('-2y')]), '5y − 2y = 3y');
  assert.strictEqual(formatCombination([T('2x²'), T('x²')]), '2x² + x² = 3x²');
  assert.strictEqual(formatCombination([T('2x'), T('-3x')]), '2x − 3x = −x');
  assert.strictEqual(formatCombination([T('4'), T('-1')]), '4 − 1 = 3');
  assert.strictEqual(sumCoefficients([T('x'), T('x'), T('x')]), 3);
});

test('misfire explanations name the actual difference', () => {
  assert.match(explainUnlike(T('3x'), T('3x²')), /different exponents/);
  assert.match(explainUnlike(T('4'), T('4x')), /4 is a constant/);
  assert.match(explainUnlike(T('2y'), T('5')), /5 is a constant/);
  assert.match(explainUnlike(T('2x'), T('2y')), /different variables/);
  assert.strictEqual(explainUnlike(T('2x'), T('-x')), '');
});

test('look-alikes keep the number but change the kind', () => {
  const rng = makeRng(7);
  for (let i = 0; i < 300; i++) {
    const t = randomTerm(BOSS, rng);
    const f = lookAlike(t, BOSS.sigs, rng);
    assert.ok(f, `look-alike for ${formatTerm(t)}`);
    assert.strictEqual(f.coef, t.coef);
    assert.notStrictEqual(f.sig, t.sig);
    assert.ok(BOSS.sigs.includes(f.sig));
  }
  assert.strictEqual(lookAlike(T('3x'), ['x']), null);
});

// ---------------------------------------------------------------- board
function boardFrom(rows) {
  const b = new Board();
  rows.forEach((row, r) => row.forEach((s, c) => { if (s) b.set(r, c, T(s)); }));
  return b;
}

test('hex neighbors: 6 inside, parity flips after pushRow', () => {
  const b = new Board();
  assert.strictEqual(b.neighbors(2, 5).length, 6);
  assert.strictEqual(b.colsIn(0), 14);
  assert.strictEqual(b.colsIn(1), 13);
  const x0 = b.center(0, 3).x;
  b.set(0, 3, T('x'));
  b.pushRow([]);
  assert.strictEqual(b.colsIn(0), 13);
  assert.strictEqual(b.colsIn(1), 14);
  assert.deepStrictEqual(b.get(1, 3), T('x'));
  assert.strictEqual(b.center(1, 3).x, x0, 'bubble keeps its x after a ceiling drop');
});

test('like terms combine into one bubble at the highest cell', () => {
  const b = boardFrom([['3x', '2y'], ['2x']]);
  // (1,0) is under (0,0) and (0,1) on an unshifted row 0 / shifted row 1
  const spot = b.neighbors(1, 0).find((n) => !b.get(n.r, n.c) && n.r === 2);
  const res = b.resolveShot(spot.r, spot.c, T('x'));
  assert.strictEqual(res.kind, 'combine');
  assert.strictEqual(res.total, 6);
  assert.deepStrictEqual(res.keeper, { r: 0, c: 0 });
  assert.deepStrictEqual(b.get(0, 0), T('6x'));
  assert.strictEqual(b.get(1, 0), null);
  assert.strictEqual(b.get(spot.r, spot.c), null);
  assert.strictEqual(formatCombination(res.cells.map((p) => p.t)), '3x + 2x + x = 6x');
  assert.deepStrictEqual(b.get(0, 1), T('2y'), 'unlike neighbor untouched');
});

test('opposites cancel to zero; bubbles still hanging elsewhere stay', () => {
  const b = new Board();
  b.set(0, 0, T('5y'));
  b.set(0, 1, T('3'));
  b.set(1, 0, T('4x')); // shifted row: touches (0,0) and (0,1)
  const res = b.resolveShot(1, 1, T('-3')); // touches (0,1) and (0,2)
  assert.strictEqual(res.kind, 'zero');
  assert.strictEqual(formatCombination(res.cells.map((p) => p.t)), '3 \u2212 3 = 0');
  assert.strictEqual(b.get(0, 1), null);
  assert.deepStrictEqual(b.get(1, 0), T('4x'), '4x still hangs from 5y');
  assert.strictEqual(res.dropped.length, 0);
});

test('unanchored bubbles drop after a pop', () => {
  const b = new Board();
  b.set(0, 0, T('2x'));
  b.set(1, 0, T('3')); // shifted row: (1,0) touches (0,0) and (0,1)
  b.set(2, 0, T('y'));
  const res = b.resolveShot(0, 1, T('-2x'));
  assert.strictEqual(res.kind, 'zero');
  assert.strictEqual(b.count(), 0);
  assert.strictEqual(res.dropped.length, 2);
});

test('unlike terms stick; misfire only if a like term was on the board', () => {
  const b = boardFrom([['3x', '2y']]);
  const res = b.resolveShot(1, 0, T('4x²'));
  assert.strictEqual(res.kind, 'stick');
  assert.strictEqual(res.misfire, false, 'no x² anywhere: free placement');
  const res2 = b.resolveShot(1, 1, T('5y²'));
  assert.strictEqual(res2.kind, 'stick');
  assert.strictEqual(res2.misfire, false);
  const res3 = b.resolveShot(2, 0, T('x'));
  assert.strictEqual(res3.kind, 'stick');
  assert.strictEqual(res3.misfire, true, '3x was on the board');
  assert.ok(res3.unlikeNeighbor);
});

test('a shot touching two separate like groups joins both', () => {
  const b = new Board();
  b.set(0, 0, T('2x'));
  b.set(0, 1, T('5'));
  b.set(0, 2, T('3x'));
  b.set(1, 0, T('y'));
  // (1,1) on shifted row touches (0,1) and (0,2); place 4 between... use a constant joining 5 only
  const res = b.resolveShot(1, 1, T('-5'));
  assert.strictEqual(res.kind, 'zero');
  // now (0,1) empty; shoot x into (0,1): touches 2x and 3x
  const res2 = b.resolveShot(0, 1, T('-5x'));
  assert.strictEqual(res2.kind, 'zero');
  assert.strictEqual(res2.cells.length, 3);
});

test('snapCell attaches to the ceiling or next to a bubble', () => {
  const b = boardFrom([['x']]);
  const p = b.center(1, 0);
  const s = b.snapCell(p.x, p.y);
  assert.deepStrictEqual(s, { r: 1, c: 0 });
  const far = b.center(4, 7);
  const s2 = b.snapCell(far.x, far.y);
  assert.ok(s2.r === 0 || b.neighbors(s2.r, s2.c).some((n) => b.get(n.r, n.c)));
});

// ---------------------------------------------------------------- generator
test('starting boards use only the stage\'s kinds of terms, no zeros, small groups', () => {
  for (const st of [...STAGES, BOSS]) {
    for (let seed = 1; seed <= 200; seed++) {
      const b = new Board({ top: st.top || 0 });
      buildBoard(b, st, makeRng(seed));
      assert.strictEqual(b.count(), Array.from({ length: st.rows }, (_, r) => b.colsIn(r)).reduce((a, n) => a + n, 0));
      for (const { t } of b.filled()) {
        assert.ok(st.sigs.includes(t.sig), `${st.id} sig ${t.sig}`);
        assert.ok(t.coef !== 0 && Math.abs(t.coef) <= st.coefMax);
        if (st.negChance === 0) assert.ok(t.coef > 0, 'stage 1 board is all positive');
      }
      for (const g of b.groups()) assert.ok(g.cells.length <= 3, 'fresh boards have small like groups');
      assert.ok(b.lowestEdge() < DANGER_Y - 100, 'room to play at the start');
    }
  }
});

test('shots are mostly useful: exact cancels are common, never coefficient 0', () => {
  for (const st of [...STAGES, BOSS]) {
    const rng = makeRng(99);
    let cancels = 0;
    let n = 0;
    for (let seed = 0; seed < 150; seed++) {
      const b = new Board({ top: st.top || 0 });
      buildBoard(b, st, rng);
      for (let k = 0; k < 10; k++) {
        const s = nextShot(b, st, rng);
        n++;
        assert.ok(s.coef !== 0, 'no 0-coefficient shots');
        assert.ok(st.sigs.includes(s.sig), `${st.id} shot sig ${s.sig}`);
        if (b.groups().some((g) => g.sig === s.sig && g.sum + s.coef === 0)) cancels++;
      }
    }
    assert.ok(cancels / n > 0.4, `${st.id}: ${(100 * cancels / n).toFixed(0)}% of shots can cancel something`);
  }
});

// ---------------------------------------------------------------- simulation
test('bot plays 3,000 shots per stage without breaking the board', () => {
  for (const st of [...STAGES, BOSS]) {
    const rng = makeRng(2026);
    let games = 0;
    let zeros = 0;
    for (let shot = 0, b = null, clock = 0; shot < 3000; shot++) {
      if (!b || b.lowestEdge() >= DANGER_Y) {
        b = new Board({ top: st.top || 0 });
        buildBoard(b, st, rng);
        clock = st.clock;
        games++;
      }
      const s = nextShot(b, st, rng);
      // smart-ish bot: aim next to a like group with the right sum, else anywhere
      const options = [];
      for (let r = 0; r < b.rows; r++) {
        for (let c = 0; c < b.colsIn(r); c++) {
          if (b.get(r, c)) continue;
          if (r !== 0 && !b.neighbors(r, c).some((n) => b.get(n.r, n.c))) continue;
          options.push({ r, c });
        }
      }
      if (!options.length) { b = null; continue; }
      const good = options.filter(({ r, c }) => b.neighbors(r, c).some((n) => {
        const t = b.get(n.r, n.c);
        return t && t.sig === s.sig;
      }));
      const pickFrom = good.length && rng() < 0.8 ? good : options;
      const { r, c } = pickFrom[Math.floor(rng() * pickFrom.length)];
      const res = b.resolveShot(r, c, s);
      if (res.kind === 'zero') zeros++;
      // invariants
      for (const { r: rr, c: cc, t } of b.filled()) {
        assert.ok(t.coef !== 0, 'no zero bubbles left on the board');
        assert.ok(Number.isInteger(t.coef));
        assert.ok(rr >= 0 && cc < b.colsIn(rr));
      }
      assert.strictEqual(b.dropFloating().length, 0, 'everything left is anchored');
      if (res.kind !== 'stick') {
        assert.ok(res.cells.every((p) => p.t.sig === s.sig), 'only like terms combine');
        assert.strictEqual(sumCoefficients(res.cells.map((p) => p.t)), res.total);
      }
      clock -= res.misfire ? 3 : 1;
      if (clock <= 0) { dropCeiling(b, st, rng); clock = st.clock; }
      if (b.count() === 0) b = null;
    }
    assert.ok(zeros > 100, `${st.id}: bot made ${zeros} zero-pops`);
    assert.ok(games >= 1);
  }
});

test('stage goals and boss settings are sane', () => {
  assert.strictEqual(STAGES.length, 3);
  STAGES.forEach((s) => assert.ok(s.goal >= 4 && s.goal <= 8 && s.clock >= 6));
  assert.ok(BOSS.hp >= 6 && BOSS.shiftEvery >= 3);
  const b = new Board({ top: BOSS.top });
  buildBoard(b, BOSS, makeRng(3));
  assert.ok(b.lowestEdge() + 2 * 48.5 < DANGER_Y, 'boss board has at least 2 rows of room');
  assert.ok(RADIUS * 2 * 14 <= 800);
});

console.log(`✅ All ${passed} Term Popper tests passed`);
