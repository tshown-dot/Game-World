// Tests for Boss Castle (castle.js). Run with:  node towns/topic-3-expression-town/games/3-boss-castle/test_boss_castle_math.js
import assert from 'node:assert/strict';
import {
  seeded, fmt, parseNumber, pow, gcd, lcm, near, ZONES, genZone, genBackup,
  genPower, genWritePower, genGcfOrLcm, genGcf, genLcm, genOrder, genWriteExpr, genEvaluate, genDistribute, genFactor, genCombine, genDilemma,
  checkNum, checkChoice, checkBoxes, workedSolution,
} from './castle.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261112);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
const typed = (v) => fmt(v).replace(/,/g, '');
const fill = (p, over = {}) => Object.fromEntries(Object.entries({ ...p.want, ...over }).map(([k, v]) => [k, String(v)]));

test('numbers, powers, GCF and LCM helpers', () => {
  for (const [raw, want] of [['64', 64], ['1,024', 1024], ['64.0', 64], ['$15', 15], [' 7 ', 7], ['-3', -3]]) assert.equal(parseNumber(raw), want, raw);
  for (const raw of ['', 'x', '2^3', '6(x+1)']) assert.equal(parseNumber(raw), null, raw);
  assert.equal(pow(4, 3), '4³'); assert.equal(gcd(18, 24), 6); assert.equal(lcm(8, 12), 24);
});

test(`every zone: ${RUNS} runs make clean, solvable problems`, () => {
  assert.equal(ZONES.length, 5);
  for (let i = 0; i < RUNS / 5; i++) {
    for (let z = 0; z < 5; z++) {
      const list = genZone(rnd, z);
      assert.equal(list.length, 5);
      for (const p of list) {
        assert.ok(noJunk(p.prompt.replace(/<[^>]+>/g, '')), p.prompt);
        assert.ok(noJunk(p.show));
        for (const line of workedSolution(p)) assert.ok(noJunk(line), `${p.type}: ${line}`);
        if (p.kind === 'num') {
          assert.ok(Number.isInteger(p.answer) && p.answer >= 0, `${p.type}: whole-number answers (${p.answer})`);
          assert.ok(checkNum(p, typed(p.answer)).correct && checkNum(p, `${p.answer}.0`).correct);
          assert.ok(checkNum(p, '').nudge);
          for (const t of p.traps) assert.equal(checkNum(p, String(t.v)).key, t.key, `${p.type} trap ${t.key}`);
          assert.ok(!checkNum(p, String(p.answer + 1001)).correct);
        }
        if (p.kind === 'choice') {
          assert.equal(p.options.filter((o) => o.ok).length, 1);
          assert.equal(new Set(p.options.map((o) => o.text)).size, p.options.length, 'no repeated options');
          p.options.forEach((o, k) => { const r = checkChoice(p, k); assert.equal(r.correct, o.ok); assert.ok(noJunk(r.message)); });
        }
        if (p.kind === 'boxes') {
          assert.ok(checkBoxes(p, fill(p)).correct, `${p.type}: ${p.answerText}`);
          assert.ok(checkBoxes(p, { ...fill(p), [Object.keys(p.want)[0]]: '' }).nudge);
        }
      }
      const back = genBackup(rnd, list[0]);
      assert.equal(back.type, list[0].type); assert.notEqual(back.id, list[0].id);
    }
  }
});

test('the Gate: exponents', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genPower(rnd);
    assert.equal(p.answer, p.b ** p.e);
    assert.equal(checkNum(p, String(p.b * p.e)).key, 'base_times_exponent', '4³ = 12');
    const s = genPower(rnd, { small: true });
    assert.ok(s.e === 0 || s.e === 1);
    if (s.e === 0) { assert.equal(s.answer, 1); assert.equal(checkNum(s, '0').key, 'zero_exponent'); }
    const w = genWritePower(rnd);
    if (w.want.b !== w.want.e) assert.equal(checkBoxes(w, { b: String(w.want.e), e: String(w.want.b) }).key, 'swapped');
    assert.equal(checkBoxes(w, { b: String(w.want.b), e: String(w.want.e + 1) }).key, 'count_factors');
  }
});

test('the Treasury: GCF or LCM, and the greatest / least one', () => {
  const seen = new Set();
  for (let i = 0; i < RUNS; i++) {
    const c = genGcfOrLcm(rnd); seen.add(c.answerText);
    assert.equal(checkChoice(c, c.options.findIndex((o) => !o.ok)).key, 'gcf_vs_lcm');
    const g = genGcf(rnd);
    assert.equal(g.answer, gcd(g.a, g.b)); assert.ok(g.answer > 1);
    assert.equal(checkNum(g, String(lcm(g.a, g.b))).key, 'gcf_vs_lcm');
    const m = genLcm(rnd);
    assert.equal(m.answer, lcm(m.a, m.b)); assert.ok(m.answer < m.a * m.b, 'the product is never the LCM here');
    assert.equal(checkNum(m, String(m.a * m.b)).key, 'not_least');
  }
  assert.deepEqual([...seen].sort(), ['GCF', 'LCM']);
});

test('the Clock Tower: order of operations slips', () => {
  const key = { addMul: 'left_to_right', subAdd: 'add_before_subtract', paren: 'parentheses_first', mulPow: 'exponent_first', divMul: 'mul_before_div' };
  for (let i = 0; i < RUNS; i++) {
    for (const f of Object.keys(key)) {
      const p = genOrder(rnd, f);
      const t = p.traps.find((x) => x.key === key[f]);
      if (t) assert.equal(checkNum(p, String(t.v)).key, key[f]);
    }
  }
  assert.equal(genOrder(seeded(1), 'addMul').answer, (() => { const p = genOrder(seeded(1), 'addMul'); const [a, , b, , c] = p.show.split(' ').map(Number); return a + b * c; })());
});

test('the Library: writing and evaluating expressions', () => {
  for (let i = 0; i < RUNS; i++) {
    const w = genWriteExpr(rnd);
    assert.equal(w.options.filter((o) => o.ok).length, 1);
    const e = genEvaluate(rnd, 'coefPow');
    assert.equal(checkNum(e, String(e.traps.find((t) => t.key === 'power_first').v)).key, 'power_first', '3x² read as (3x)²');
    const d = genEvaluate(rnd, 'paren');
    assert.equal(checkNum(d, String(d.traps[0].v)).key, 'distribute_all');
  }
});

test('the Throne: distribute, factor, combine and the dilemma', () => {
  for (let i = 0; i < RUNS; i++) {
    const d = genDistribute(rnd);
    assert.equal(checkBoxes(d, fill(d, { c: d.c })).key, 'distribute_all', '4(2x + 3) = 8x + 3');
    const f = genFactor(rnd);
    assert.equal(gcd(f.want.p, f.want.q), 1, 'the GCF is really the greatest');
    const small = [2, 3, 5, 7].find((s) => s < f.want.g && f.want.g % s === 0);
    if (small) { const k = f.want.g / small; assert.equal(checkBoxes(f, { g: String(small), p: String(f.want.p * k), q: String(f.want.q * k) }).key, 'not_greatest'); }
    const c = genCombine(rnd);
    assert.equal(checkBoxes(c, { m: String(c.want.m + c.want.c), c: '0' }).key, 'combine_unlike');
    const [a, b] = genDilemma(rnd);
    assert.equal(checkChoice(a, a.options.findIndex((o) => o.key === 'distribute_all')).key, 'distribute_all');
    const [m, k] = a.answerText.split('x + ').map(Number);
    const x = Number(b.prompt.match(/when x = (\d+)/)[1]);
    assert.equal(b.answer, m * x + k, 'the simplified form gives the same value');
  }
});

console.log(`\n${passed} tests passed`);
