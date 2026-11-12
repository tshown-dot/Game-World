// Tests for Twin Bridges (bridges.js). Run with:
//   node towns/g7-topic-4-factor-falls/games/4-2-twin-bridges/test_twin_bridges_math.js
import assert from 'node:assert/strict';
import {
  seeded, fmt, parseNumber, near, sum, paren, same, valueOf, ZONES, genZone, genBackup,
  genTest, genLucky, genProperty, genBuild, genSelect, genMaria, genProve,
  checkTest, checkChoice, checkBoxes, checkSelect, checkNum, workedSolution,
} from './bridges.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261114);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
const typed = (v) => String(v);
const fill = (p, over = {}) => Object.fromEntries(Object.entries({ ...p.want, ...over }).map(([k, v]) => [k, String(v)]));
/** Works out what an expression's TEXT equals for a value, so the stored m and k can be checked against the text. */
function evalText(text, v, x, y = 7) {
  let js = text.replace(/−/g, '-').replace(/·/g, '*').replace(/(\d)\s*\(/g, '$1*(').replace(/\)\s*\(/g, ')*(').replace(/^-\(/, '-1*(')
    .replace(new RegExp(`(\\d)${v}`, 'g'), `$1*${v}`).replace(/(\d)y/g, '$1*y').replace(/(\d+)\/(\d+)/g, '($1/$2)');
  return Function(v, 'y', `return ${js};`)(x, y);     // eslint-disable-line no-new-func
}

test('writing expressions and typed numbers', () => {
  assert.equal(sum([3, 'x'], [-15, '']), '3x − 15'); assert.equal(sum([-1, 'x'], [7, '']), '−x + 7'); assert.equal(sum([-16, ''], [-2, 'x']), '−16 − 2x');
  assert.equal(paren(-2, 'x', 8), '−2(x + 8)'); assert.equal(paren(3, 'x', -5), '3(x − 5)');
  for (const [raw, want] of [['-16', -16], ['−16', -16], ['2.5', 2.5], ['5/2', 2.5], ['2 1/2', 2.5], ['-2', -2]]) assert.ok(near(parseNumber(raw), want), raw);
  for (const raw of ['', 'x', '2x', '1/0']) assert.equal(parseNumber(raw), null);
});

test(`every zone: ${RUNS} runs make clean problems`, () => {
  assert.equal(ZONES.length, 5);
  for (let i = 0; i < RUNS / 5; i++) {
    for (let z = 0; z < 5; z++) {
      const list = genZone(rnd, z);
      assert.equal(list.length, 5);
      for (const p of list) {
        assert.ok(noJunk(p.prompt.replace(/<[^>]+>/g, '')), p.prompt);
        for (const line of workedSolution(p)) assert.ok(noJunk(line), `${p.type}: ${line}`);
        if (p.options) { assert.equal(p.options.filter((o) => o.ok).length, 1); assert.equal(new Set(p.options.map((o) => o.text)).size, p.options.length); p.options.forEach((o, k) => { const r = checkChoice(p, k); assert.equal(r.correct, o.ok); assert.ok(noJunk(r.message)); }); }
      }
      const back = genBackup(rnd, list[0]);
      assert.equal(back.type, list[0].type); assert.notEqual(back.id, list[0].id);
    }
  }
});

test('test the bridges: the stored values match the text, and the decision is checked', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genTest(rnd, { eq: i % 2 === 0 });
    for (const x of [-3, 2, 5]) { assert.ok(near(evalText(p.A.text, p.v, x), valueOf(p.A, x)), p.A.text); assert.ok(near(evalText(p.B.text, p.v, x), valueOf(p.B, x)), p.B.text); }
    assert.equal(same(p.A, p.B), p.eq);
    assert.equal(near(p.va, p.vb), p.eq, 'the test value shows the difference when there is one');
    assert.ok(checkTest(p, typed(p.va), typed(p.vb), p.eq).correct);
    assert.ok(checkTest(p, '', typed(p.vb), p.eq).nudge);
    assert.equal(checkTest(p, typed(p.va + 1), typed(p.vb), p.eq).key, 'evaluation_slip');
    const wrong = checkTest(p, typed(p.va), typed(p.vb), !p.eq);
    assert.ok(!wrong.correct && noJunk(wrong.message));
    if (!p.eq) assert.ok(['first_term_only', 'combine_unlike', 'commute_subtraction'].includes(wrong.key));
  }
  for (let i = 0; i < 300; i++) {
    const l = genLucky(rnd);
    assert.equal(valueOf(l.A, 0), valueOf(l.B, 0)); assert.notEqual(valueOf(l.A, 1), valueOf(l.B, 1));
    assert.equal(checkChoice(l, l.options.findIndex((o) => o.key === 'one_test_value')).key, 'one_test_value');
  }
});

test('properties: the two sides really are equivalent', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genProperty(rnd, 'CAD'[i % 3]);
    const v = (p.from.match(/[xntgdw]/) || ['x'])[0];
    const a = evalText(p.from.replace(/z/g, '3'), v, 4), b = evalText(p.to.replace(/z/g, '3'), v, 4);
    assert.ok(near(a, b), `${p.from} = ${p.to}`);
    assert.notEqual(p.from, p.to);
  }
});

test('build the twin: right boxes pass, sign slips are named', () => {
  for (let i = 0; i < RUNS; i++) {
    for (const form of ['distNeg', 'factor', 'combine', 'assoc', 'frac']) {
      const p = genBuild(rnd, form);
      assert.ok(checkBoxes(p, fill(p)).correct, `${form}: ${p.show} = ${p.answerText}`);
      assert.ok(checkBoxes(p, { ...fill(p), [Object.keys(p.want)[0]]: '' }).nudge);
      for (const x of [-2, 3]) assert.ok(near(evalText(p.show, p.v, x), evalText(p.answerText, p.v, x)), `${p.show} = ${p.answerText}`);
    }
    const d = genBuild(rnd, 'distNeg');
    assert.equal(checkBoxes(d, fill(d, { m: d.c })).key, 'first_term_only');
    assert.equal(checkBoxes(d, fill(d, { k: -d.want.k })).key, 'sign_error');
    const c = genBuild(rnd, 'combine');
    assert.equal(checkBoxes(c, { m: String(Math.abs(c.a) + c.c) }).key, 'lost_negative');
    const f = genBuild(rnd, 'frac');
    assert.ok(checkBoxes(f, { m: String(f.want.m), c: `${f.want.c}` }).correct);
    assert.equal(checkBoxes(f, { m: String(f.want.m), c: String(f.d + f.h[0] / f.h[1]) }).key, 'sign_error');
  }
  const f = { ...genBuild(seeded(3), 'frac') };
  if (near(f.want.c, 2.5)) for (const raw of ['2.5', '5/2', '2 1/2']) assert.ok(checkBoxes(f, { m: String(f.want.m), c: raw }).correct, raw);
});

test('find every twin: cards are labelled by what they equal, all-or-nothing', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genSelect(rnd, i % 2 ? 'dist' : 'collect');
    const good = p.cards.map((c, k) => (c.ok ? k : -1)).filter((k) => k >= 0);
    assert.ok(good.length >= 2 && good.length < p.cards.length, 'some twins and some decoys');
    assert.equal(new Set(p.cards.map((c) => c.text)).size, p.cards.length, 'no repeated cards');
    for (const c of p.cards) {
      for (const x of [-2, 3]) assert.ok(near(evalText(c.text, p.v, x), valueOf(c, x)), `${c.text} is what it says`);
      assert.equal(c.ok, [-2, 3, 5].every((x) => near(valueOf(c, x), valueOf(p.target, x))), `${c.text} vs ${p.target.text}`);
      if (!c.ok) assert.ok(c.key && noJunk(c.message));
    }
    assert.ok(checkSelect(p, good).correct);
    assert.ok(checkSelect(p, []).nudge);
    assert.equal(checkSelect(p, good.slice(1)).key, 'missed_twin');
    const bad = p.cards.findIndex((c) => !c.ok);
    const res = checkSelect(p, [...good, bad]);
    assert.ok(!res.correct && res.key === p.cards[bad].key && res.wrong.includes(bad));
  }
});

test('the boss: Maria and the proof', () => {
  for (let i = 0; i < RUNS; i++) {
    const m = genMaria(rnd);
    assert.ok(near(evalText(m.show, 'n', 3), evalText(m.answerText, 'n', 3)));
    const p = genProve(rnd);
    assert.equal(valueOf(p.A, p.x0), valueOf(p.B, p.x0));
    assert.ok(checkNum(p, typed(p.answer)).correct && checkNum(p, '').nudge);
    assert.ok(checkNum(p, `−${Math.abs(p.answer)}`).correct === (p.answer < 0) || p.answer === 0);
    for (const t of p.traps) assert.equal(checkNum(p, typed(t.v)).key, t.key);
  }
});

console.log(`\n${passed} tests passed`);
