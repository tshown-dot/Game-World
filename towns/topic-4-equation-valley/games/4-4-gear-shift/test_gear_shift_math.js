// Tests for Gear Shift's math (gears.js). Run with:  node towns/topic-4-equation-valley/games/4-4-gear-shift/test_gear_shift_math.js
import assert from 'node:assert/strict';
import {
  seeded, fmt, parseNumber, apply, makeEq, exprText, eqText, runForward, undoStep, afterStep, checkLine, readTiles, tilesText,
  genGear, genHeavy, genTwoWays, genHalf, genTriangle, genTwoStep, genPickEquation, genPickProperty, genZone, genBackup, ZONES, PROPERTIES,
  checkWritten, checkGear, checkCalc, checkHalf, checkPick, workedSolution,
} from './gears.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 3000;
const rnd = seeded(20261112);
const near = (a, b) => Math.abs(a - b) < 1e-6;
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
// "4n = 52" or "½(8h) = 44" -> does value v make it true?
const truth = (text, letter, v) => {
  const js = (side) => side.replace(/,/g, '').replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/½/g, '0.5*')
    .replace(new RegExp(`(\\d)${letter}\\b`, 'g'), `$1*(${v})`).replace(new RegExp(`\\b${letter}\\b`, 'g'), `(${v})`);
  const [l, r] = text.split('=').map(js);
  return near(Function(`return ${l}`)(), Function(`return ${r}`)());
};
const tilesOf = (text, letter) => text.split(/\s+/).map((w) => (w === '=' ? { t: 'eq' } : w === '×' || w === '÷' ? { t: 'op', v: w } : w === letter ? { t: 'var' } : { t: 'num', v: Number(w.replace(/,/g, '')) }));

test('typed amounts: many formats, junk refused; big numbers get commas', () => {
  for (const [raw, v] of [['2,392', 2392], ['2392', 2392], ['$158', 158], ['158.00', 158], [' 6 ', 6], ['1 683', 1683], ['+9', 9]]) assert.equal(parseNumber(raw), v, raw);
  for (const raw of ['', 'abc', '-3', '1.2.3', '$', 'x9']) assert.equal(parseNumber(raw), null, raw);
  assert.equal(fmt(2392), '2,392'); assert.equal(fmt(7200), '7,200'); assert.equal(fmt(10 / 3), '≈3.33'); assert.equal(fmt(-38), '−38'); assert.equal(fmt(2.5), '2.5');
});

test('equation text matches the math for every kind', () => {
  const cases = [
    [makeEq({ kind: 'times', letter: 'n', k: 4, c: 52 }), '4n = 52', 13],
    [makeEq({ kind: 'times', letter: 'y', k: 2, c: 12, flipped: true }), '12 = 2y', 6],
    [makeEq({ kind: 'div', letter: 't', k: 3, c: 10 }), 't ÷ 3 = 10', 30],
    [makeEq({ kind: 'div', letter: 'a', k: 5, c: 22, flipped: true }), '22 = a ÷ 5', 110],
    [makeEq({ kind: 'times', letter: 'd', k: 23, c: 2392 }), '23d = 2,392', 104],
    [makeEq({ kind: 'twostep', letter: 'd', k: 85, b: 52, c: 562 }), '85d + 52 = 562', 6],
    [makeEq({ kind: 'half', letter: 'h', m: 8, c: 44 }), '½(8h) = 44', 11],
  ];
  for (const [eq, text, x] of cases) {
    assert.equal(eqText(eq), text);
    assert.equal(eq.x, x, text);
    assert.ok(truth(text, eq.letter, x), `${x} makes ${text} true`);
    assert.ok(near(runForward(eq, x), eq.c));
    assert.ok(checkLine(eq, x).length > 3 && !checkLine(eq, x).includes('not'), checkLine(eq, x));
  }
  assert.equal(checkLine(cases[0][0], 13), '4 × 13 = 52');
  assert.equal(checkLine(cases[1][0], 6), '12 = 2 × 6');
  assert.equal(checkLine(cases[0][0], 208), '4 × 208 = 832, not 52');
  assert.equal(checkLine(cases[5][0], 6), '85 × 6 + 52 = 562');
  assert.deepEqual(undoStep(cases[0][0]), { op: '÷', n: 4 });
  assert.deepEqual(undoStep(cases[2][0]), { op: '×', n: 3 });
  assert.deepEqual(undoStep(cases[5][0]), { op: '-', n: 52 });
  assert.equal(eqText(afterStep(cases[5][0], 510)), '85d = 510');
  assert.equal(eqText(afterStep(cases[6][0])), '4h = 44');
});

test(`gearboxes: ${RUNS} of each kind; whole-number answers, only one answer, the opposite gear solves it`, () => {
  for (let i = 0; i < RUNS; i++) {
    for (const p of [genGear(rnd, { flipped: i % 2 === 0 }), genHeavy(rnd, { flipped: i % 5 === 0, kind: i % 5 === 0 ? 'times' : undefined })]) {
      const { eq } = p;
      assert.ok(Number.isInteger(eq.x) && eq.x > 0 && Number.isInteger(eq.c) && eq.c > 0, eqText(eq));
      assert.ok(truth(eqText(eq), eq.letter, eq.x) && !truth(eqText(eq), eq.letter, eq.x + 1));
      const s = undoStep(eq);
      assert.ok(checkGear(eq, s.op, s.n).correct);
      assert.ok(near(checkGear(eq, s.op, s.n).value, eq.x));
      if (p.calc) assert.ok(checkCalc(eq.c, s.op, s.n, String(eq.x)).correct && checkCalc(eq.c, s.op, s.n, fmt(eq.x)).correct, 'typed with or without commas');
    }
  }
});

test('shifting: each common mistake gets its own hint', () => {
  const t = makeEq({ kind: 'times', letter: 'n', k: 4, c: 52 });
  assert.equal(checkGear(t, '×', 4).key, 'did_not_undo');
  assert.match(checkGear(t, '×', 4).message, /208/);
  assert.equal(checkGear(t, '-', 4).key, 'add_sub_with_coefficient');
  assert.equal(checkGear(t, '÷', 52).key, 'used_total');
  assert.equal(checkGear(t, '÷', 2).key, 'wrong_amount');
  assert.equal(checkGear(t, '+', 9).key, 'wrong_op');
  const d = makeEq({ kind: 'div', letter: 't', k: 3, c: 10 });
  assert.equal(checkGear(d, '÷', 3).key, 'did_not_undo');
  assert.match(checkGear(d, '÷', 3).message, /≈3\.33/, 'shows what dividing again would give');
  assert.ok(checkGear(d, '×', 3).correct && checkGear(d, '×', 3).value === 30);
  const two = makeEq({ kind: 'twostep', letter: 'd', k: 85, b: 52, c: 562 });
  assert.equal(checkGear(two, '÷', 85).key, 'twostep_order');
  assert.ok(checkGear(two, '-', 52).correct && checkGear(two, '-', 52).value === 510);
  for (const r of [checkGear(t, '×', 4), checkGear(t, '-', 4), checkGear(two, '÷', 85), checkGear(d, '+', 3)]) assert.ok(noJunk(r.message), r.message);
});

test('working it out: right answers in any format, and the usual slips', () => {
  assert.ok(checkCalc(2392, '÷', 23, '104').correct);
  assert.equal(checkCalc(2392, '÷', 23, '55,016').key, 'multiplied_instead');
  assert.equal(checkCalc(9, '×', 187, '1,683').correct, true);
  assert.equal(checkCalc(10, '×', 3, '3.33').key, 'divided_instead');
  assert.equal(checkCalc(15, '÷', 3, '0.2').key, 'flipped_division');
  assert.equal(checkCalc(2392, '÷', 23, '1040').key, 'place_value');
  assert.equal(checkCalc(2392, '÷', 23, '106').key, 'arith');
  assert.ok(checkCalc(2392, '÷', 23, 'abc').nudge);
  assert.ok(checkCalc(562, '-', 52, '510').correct);
  const tri = makeEq({ kind: 'half', letter: 'h', m: 8, c: 44 });
  assert.ok(checkHalf(tri, '4').correct);
  assert.equal(checkHalf(tri, '16').key, 'half_trap');
  assert.equal(checkHalf(tri, '3').key, 'combine_error');
});

test('reading tiles', () => {
  const r = readTiles(tilesOf('4 × n = 52', 'n'));
  assert.ok(r.ok && near(r.value(13)[0], 52));
  assert.ok(readTiles(tilesOf('52 ÷ 4 = n', 'n')).ok);
  assert.ok(readTiles(tilesOf('n = 52 ÷ 4', 'n')).ok);
  for (const bad of ['4 × n', '× n = 52', '4 × n = 52 = 3', '4 × = 52', '4 × 52 = 208']) assert.equal(readTiles(tilesOf(bad, 'n')).ok, false, bad);
  assert.equal(tilesText(tilesOf('52 ÷ 4 = n', 'n'), 'n'), '52 ÷ 4 = n');
});

test('two ways: any true × and ÷ equation is accepted; traps caught', () => {
  const p = genTwoWays(seeded(7));
  const { k, c } = p.eq, L = p.eq.letter;
  for (const f of [`${k} × ${L} = ${c}`, `${L} × ${k} = ${c}`, `${c} = ${k} × ${L}`]) assert.ok(checkWritten(p, tilesOf(f, L), '×').correct, f);
  for (const f of [`${c} ÷ ${k} = ${L}`, `${L} = ${c} ÷ ${k}`, `${c} ÷ ${L} = ${k}`]) assert.ok(checkWritten(p, tilesOf(f, L), '÷').correct, f);
  assert.ok(checkWritten(p, tilesOf(`${k} × ${L} = ${c}`, L), '÷').nudge, 'a × equation in the ÷ row is a reminder');
  assert.equal(checkWritten(p, tilesOf(`${k} ÷ ${c} = ${L}`, L), '÷').key, 'flipped_division');
  assert.equal(checkWritten(p, tilesOf(`${L} ÷ ${k} = ${c}`, L), '÷').key, 'wrong_relationship');
  assert.equal(checkWritten(p, tilesOf(`${c} × ${k} = ${L}`, L), '×').key, 'multiplied_both');
  const tot = genTwoWays(seeded(8), { total: true });
  const T = tot.eq.letter;
  assert.ok(checkWritten(tot, tilesOf(`${T} ÷ ${tot.eq.k} = ${tot.eq.c}`, T), '÷').correct);
  assert.ok(checkWritten(tot, tilesOf(`${tot.eq.k} × ${tot.eq.c} = ${T}`, T), '×').correct);
  const half = genHalf(seeded(9));
  assert.ok(checkWritten(half, tilesOf(`t ÷ 2 = ${half.eq.c}`, 't')).correct);
  assert.ok(checkWritten(half, tilesOf(`${half.eq.c} × 2 = t`, 't')).correct, 'already-solved form is fine here');
  assert.equal(checkWritten(half, tilesOf(`t × 2 = ${half.eq.c}`, 't')).key, 'half_trap');
});

test(`stories: ${RUNS} generated; tiles come from the story; the textbook forms are accepted`, () => {
  for (let i = 0; i < RUNS; i++) {
    const p = i % 3 === 0 ? genHalf(rnd) : genTwoWays(rnd, { total: i % 3 === 1 });
    assert.ok(noJunk(p.story) && noJunk(p.rel));
    for (const v of p.tiles) assert.ok(p.story.includes(fmt(v)) || (p.half && v === 2), `tile ${v} in story`);
    assert.ok(Number.isInteger(p.eq.x) && p.eq.x > 0);
    const { k, c } = p.eq, L = p.eq.letter;
    if (p.type === 'twoways') {
      const mul = p.eq.kind === 'times' ? `${k} × ${L} = ${c}` : `${k} × ${c} = ${L}`;
      const div = p.eq.kind === 'times' ? `${c} ÷ ${k} = ${L}` : `${L} ÷ ${k} = ${c}`;
      assert.ok(checkWritten(p, tilesOf(mul, L), '×').correct && checkWritten(p, tilesOf(div, L), '÷').correct, `${mul} / ${div}`);
    }
  }
});

test(`boss: ${RUNS} triangles and two-step trips; every step comes out whole`, () => {
  for (let i = 0; i < RUNS; i++) {
    const tri = genTriangle(rnd).eq;
    assert.ok(Number.isInteger(tri.m / 2) && Number.isInteger(tri.x) && truth(eqText(tri), 'h', tri.x));
    const two = genTwoStep(rnd, i % 2).eq;
    assert.ok(two.b < two.k && Number.isInteger(two.x) && two.x > 0 && truth(eqText(two), two.letter, two.x));
    const left = apply(two.c, '-', two.b);
    assert.ok(checkCalc(two.c, '-', two.b, String(left)).correct);
    const e2 = afterStep(two, left);
    assert.ok(checkGear(e2, '÷', two.k).correct && near(checkGear(e2, '÷', two.k).value, two.x));
  }
});

test('zone 4 picks: one right answer, every trap explained', () => {
  for (let i = 0; i < 500; i++) {
    const p = i % 3 ? genPickEquation(rnd) : genPickProperty(rnd);
    assert.equal(p.options.length, 4);
    assert.equal(p.options.filter((o) => o.ok).length, 1);
    p.options.forEach((o, j) => {
      const r = checkPick(p, j);
      assert.equal(r.correct, o.ok);
      assert.ok(noJunk(r.message), r.message);
      if (p.ask === 'equation') assert.equal(truth(o.text, p.eq.letter, p.eq.x), o.ok, `${o.text} with ${p.eq.x}`);
    });
  }
  const prop = genPickProperty(seeded(2));
  assert.equal(prop.options.find((o) => o.ok).text, prop.eq.kind === 'times' ? PROPERTIES[3] : PROPERTIES[2]);
});

test('zones: right kinds, worked solutions end with a check, backups match', () => {
  assert.equal(ZONES.length, 5);
  for (let r = 0; r < 200; r++) {
    const zones = ZONES.map((_, z) => genZone(rnd, z));
    assert.ok(zones[0].every((p) => p.type === 'gear' && !p.calc) && zones[0].some((p) => p.eq.flipped));
    assert.ok(zones[1].every((p) => p.type === 'twoways') && zones[1].some((p) => p.eq.kind === 'div'));
    assert.ok(zones[2].every((p) => p.type === 'gear' && p.calc));
    assert.ok(zones[3].every((p) => p.type === 'pick') && zones[3].some((p) => p.ask === 'property'));
    assert.deepEqual(new Set(zones[4].map((p) => p.type)), new Set(['write', 'half', 'twostep', 'gear']));
    assert.equal(new Set(zones[4].filter((p) => p.type === 'twostep').map((p) => p.eq.letter)).size, 2, 'both two-step stories');
    for (const p of zones.flat()) {
      const lines = workedSolution(p);
      assert.ok(lines.length >= 3 && lines.every(noJunk), `worked solution for ${p.type}: ${lines.join(' | ')}`);
      if (p.type !== 'pick') assert.ok(lines.at(-1).startsWith('Check:') && lines.at(-1).endsWith('✓'));
      const b = genBackup(rnd, p);
      assert.equal(b.type, p.type);
      assert.equal(Boolean(b.calc), Boolean(p.calc));
    }
  }
  assert.deepEqual(workedSolution({ type: 'gear', eq: makeEq({ kind: 'times', letter: 'n', k: 4, c: 52 }) }),
    ['Undo × 4 with ÷ 4 on both sides: 52 ÷ 4 = 13', 'n = 13', 'Check: 4 × 13 = 52 ✓']);
});

console.log(`\n${passed} tests passed`);
