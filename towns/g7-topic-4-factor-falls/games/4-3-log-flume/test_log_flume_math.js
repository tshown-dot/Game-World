// Tests for Log Flume (flume.js). Run with:
//   node towns/g7-topic-4-factor-falls/games/4-3-log-flume/test_log_flume_math.js
import assert from 'node:assert/strict';
import {
  seeded, fmt, parseNumber, near, r2, termText, logText, exprText, channelsOf, totalOf, simplified, ZONES, genZone, genBackup,
  genSort, genQuick, genFraction, genPerimeter, genSelect, genOrderTest,
  checkSortMove, checkTotals, checkBoxes, checkSelect, checkTest, workedSolution,
} from './flume.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261115);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
/** Works out what an expression's TEXT equals, so stored totals can be checked against the text students see. */
function evalText(text, vals) {
  let js = text.replace(/−/g, '-').replace(/(\d+)\/(\d+)/g, '($1/$2)').replace(/(\d|\))\s*\(/g, '$1*(');
  for (const v of Object.keys(vals)) js = js.replace(new RegExp(`(\\d|\\))${v}`, 'g'), `$1*${v}`);
  return Function(...Object.keys(vals), `return ${js};`)(...Object.values(vals));   // eslint-disable-line no-new-func
}
const VALS = { c: 2, f: 3, n: -2, y: 5, a: 4, b: -3, k: 7, h: 1.5, d: -1, x: 6, p: 2.5, z: 3, t: 2 };
const totals = (p) => Object.fromEntries(p.channels.map((ch) => [ch, String(totalOf(p.terms, ch))]));

test('writing terms, logs and expressions', () => {
  assert.equal(termText(-1, 'x'), '−x'); assert.equal(termText(3, 'c'), '3c'); assert.equal(termText(-5), '−5');
  assert.equal(logText({ c: 3, v: 'c' }), '+3c'); assert.equal(logText({ c: -4, v: 'c' }), '−4c'); assert.equal(logText({ c: 7, v: '' }), '+7');
  const book = [{ c: -2, v: 'c' }, { c: 3, v: 'c' }, { c: -5, v: '' }, { c: -4, v: 'c' }, { c: 7, v: '' }];   // the textbook's example
  assert.equal(exprText(book), '−2c + 3c − 5 − 4c + 7');
  assert.deepEqual(channelsOf(book), ['c', '']);
  assert.equal(totalOf(book, 'c'), -3); assert.equal(totalOf(book, ''), 2);
  assert.equal(simplified(book), '−3c + 2');
  for (const [raw, want] of [['-3', -3], ['−3', -3], ['+2', 2], ['2.5', 2.5], ['5/6', 5 / 6], ['7 1/2', 7.5]]) assert.ok(near(parseNumber(raw), want), raw);
});

test(`every zone: ${RUNS} runs make clean problems whose answers equal the original`, () => {
  assert.equal(ZONES.length, 5);
  for (let i = 0; i < RUNS / 5; i++) {
    for (let z = 0; z < 5; z++) {
      const list = genZone(rnd, z);
      assert.ok(list.length >= 4);
      if (z === 4) assert.equal(list.length, 5, 'the boss bar needs 5 hits');
      for (const p of list) {
        assert.ok(noJunk(p.prompt.replace(/<[^>]+>/g, '')), p.prompt);
        for (const line of workedSolution(p)) assert.ok(noJunk(line), `${p.type}: ${line}`);
        if (p.show && p.answerText && p.type !== 'orderTest') assert.ok(near(evalText(p.show, VALS), evalText(p.answerText, VALS)), `${p.show} = ${p.answerText}`);
        if (z < 2 && p.terms) assert.ok(p.terms.every((t) => Number.isInteger(t.c)), 'whole numbers before Decimal Logs');
      }
      const back = genBackup(rnd, list[0]);
      assert.equal(back.type, list[0].type); assert.notEqual(back.id, list[0].id);
    }
  }
});

test('sorting: each log has one right channel, and wrong ones are explained', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genSort(rnd, { vars: 1 + (i % 2), decimal: i % 3 === 0, lone: i % 4 === 0 });
    assert.ok(p.terms.some((t) => t.c < 0) && p.terms.some((t) => t.c > 0));
    assert.equal(p.channels.at(-1), '');
    p.terms.forEach((t, k) => {
      for (const ch of p.channels) {
        const res = checkSortMove(p, k, ch);
        assert.equal(res.correct, ch === t.v);
        if (!res.correct) { assert.ok(noJunk(res.message)); assert.equal(res.key, !t.v ? 'number_in_variable' : !ch ? 'variable_in_numbers' : 'mixed_variables'); }
      }
    });
    if (p.lone && p.vars === 2) assert.equal(p.terms.filter((t) => t.v === p.channels[1]).length, 1, 'a term with no partner');
  }
});

test('channel totals: signs, lost negatives and decimal slips', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genSort(rnd, { vars: 1 + (i % 2), decimal: i % 2 === 0 });
    const good = totals(p);
    assert.ok(checkTotals(p, good).correct);
    assert.ok(checkTotals(p, { ...good, [p.channels[0]]: '' }).nudge);
    const ch = p.channels[0], want = totalOf(p.terms, ch), mine = p.terms.filter((t) => t.v === ch);
    const flipped = checkTotals(p, { ...good, [ch]: String(-want) });
    assert.ok(!flipped.correct && flipped.channel === ch && ['sign_error', 'lost_negative'].includes(flipped.key));
    const abs = r2(mine.reduce((s, t) => s + Math.abs(t.c), 0));
    if (mine.some((t) => t.c < 0) && !near(abs, -want) && !near(abs, want)) assert.equal(checkTotals(p, { ...good, [ch]: String(abs) }).key, 'lost_negative');
    assert.ok(noJunk(checkTotals(p, { ...good, [ch]: String(want + 100) }).message));
  }
  const slip = { channels: ['n', ''], terms: [{ c: -5.1, v: 'n' }, { c: -3, v: 'n' }, { c: 3.2, v: '' }, { c: 5, v: '' }], answerText: '−8.1n + 8.2' };   // the book's 3.2 − 5.1n − 3n + 5
  assert.ok(checkTotals(slip, { n: '-8.1', '': '8.2' }).correct);
  assert.equal(checkTotals(slip, { n: '-5.4', '': '8.2' }).key, 'decimal_slip');
});

test('quick simplify, fractions and the garden', () => {
  for (let i = 0; i < RUNS; i++) {
    const q = genQuick(rnd, { vars: 1 + (i % 2), decimal: i % 2 === 1 });
    const good = Object.fromEntries(Object.entries(q.want).map(([k, v]) => [k, String(v)]));
    assert.ok(checkBoxes(q, good).correct, q.show);
    const all = r2(q.terms.reduce((s, t) => s + t.c, 0)), first = q.channels[0];
    if (!near(all, q.want[first])) assert.equal(checkBoxes(q, { ...good, [first]: String(all) }).key, 'combine_unlike');
    const f = genFraction(rnd);
    assert.ok(checkBoxes(f, { m: f.mText, k: String(f.want.k) }).correct, `${f.show} = ${f.answerText}`);
    assert.equal(checkBoxes(f, { m: f.want.m.toFixed(2), k: String(f.want.k) }).key, Number.isInteger(f.want.m * 100) ? 'correct' : 'use_a_fraction');
    assert.equal(checkBoxes(f, { m: `${f.n1 + f.n2}/${f.d1 + f.d2}`, k: String(f.want.k) }).key, 'fraction_addition');
    const g = genPerimeter(rnd);
    assert.ok(checkBoxes(g, { m: String(g.want.m), k: String(g.want.k) }).correct);
    assert.equal(checkBoxes(g, { m: String(g.a + g.c), k: String(r2(g.b + g.d)) }).key, 'half_perimeter');
    assert.ok(near(evalText(g.show, VALS), evalText(g.answerText, VALS)));
  }
});

test('select every twin: cards are judged by what their text equals', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genSelect(rnd);
    const good = p.cards.map((c, k) => (c.ok ? k : -1)).filter((k) => k >= 0);
    assert.ok(good.length >= 2 && good.length < p.cards.length);
    assert.equal(new Set(p.cards.map((c) => c.text)).size, p.cards.length);
    for (const c of p.cards) {
      const same = [VALS, { ...VALS, a: -1, b: 2, k: 0.5, h: 3, d: 4, x: -2, y: 1, n: 3, p: -1 }].every((vals) => near(evalText(c.text, vals), evalText(p.show, vals)));
      assert.equal(c.ok, same, `${c.text} vs ${p.show}`);
      if (!c.ok) assert.ok(c.key && noJunk(c.message));
    }
    assert.ok(checkSelect(p, good).correct);
    assert.equal(checkSelect(p, good.slice(1)).key, 'missed_twin');
    const bad = p.cards.findIndex((c) => !c.ok);
    assert.equal(checkSelect(p, [...good, bad]).key, p.cards[bad].key);
  }
});

test('11t − 4t and 4t − 11t', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genOrderTest(rnd, { eq: i % 2 === 0 });
    assert.ok(near(evalText(p.A, { [p.v]: p.x0 }), p.va) && near(evalText(p.B, { [p.v]: p.x0 }), p.vb));
    assert.equal(p.va === p.vb, p.eq);
    assert.ok(checkTest(p, String(p.va), String(p.vb), p.eq).correct);
    assert.ok(checkTest(p, '', '', p.eq).nudge);
    assert.equal(checkTest(p, String(p.va), String(p.vb), !p.eq).key, p.eq ? 'same_values' : 'commute_subtraction');
    if (!p.eq) assert.equal(checkTest(p, String(p.va), String(-p.vb), false).key, 'sign_error');
  }
});

console.log(`\n${passed} tests passed`);
