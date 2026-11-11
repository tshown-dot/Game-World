// Tests for Ride Gate's math (gate.js). Run with:  node towns/topic-4-equation-valley/games/4-6-ride-gate/test_ride_gate_math.js
import assert from 'node:assert/strict';
import {
  seeded, fmt, ruleText, flipped, complement, passes, SYMS, genSignRule, genSign, genRider, genLine, genReadLine, genOtherSide, genTwoLetters,
  genWhoIsRight, genCalc, genRecord, genNotAllowed, genZone, genBackup, ZONES, readTiles, tilesText,
  checkWritten, checkRider, checkLine, checkPick, workedSolution,
} from './gate.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 3000;
const rnd = seeded(20261114);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
// "h ≥ 42" or "42 ≤ h" -> tiles
const tilesOf = (text, letters) => text.split(' ').map((w) => (SYMS.includes(w) ? { t: 'sym', v: w } : letters.includes(w) ? { t: 'var', v: w } : { t: 'num', v: Number(w) }));

test('who passes each rule, especially the boundary', () => {
  const r = (sym) => ({ letter: 'h', sym, n: 42 });
  assert.deepEqual([41, 42, 43].map((v) => passes(r('≥'), v)), [false, true, true]);
  assert.deepEqual([41, 42, 43].map((v) => passes(r('>'), v)), [false, false, true]);
  assert.deepEqual([41, 42, 43].map((v) => passes(r('≤'), v)), [true, true, false]);
  assert.deepEqual([41, 42, 43].map((v) => passes(r('<'), v)), [true, false, false]);
  assert.deepEqual([41, 42, 43].map((v) => passes(r('≠'), v)), [true, false, true]);
  assert.ok(passes({ letter: 's', sym: '>', n: 19.7 }, 19.8) && !passes({ letter: 's', sym: '>', n: 19.7 }, 19.7));
  assert.equal(ruleText(r('≥')), 'h ≥ 42');
  assert.equal(flipped(r('≥')), '42 ≤ h');
  assert.equal(complement(r('<')).sym, '≥', 'everyone not under 42 is 42 or more');
  assert.equal(fmt(7.5, true), '$7.50');
});

test(`signs: ${RUNS} generated; the sentence really means the rule`, () => {
  const words = { '≥': /AT LEAST|NO LESS THAN|AND OLDER/, '≤': /UP TO|NO MORE THAN|AT MOST|OR LESS/, '>': /TALLER THAN|OLDER THAN|LONGER THAN|FASTER THAN/, '<': /UNDER|YOUNGER THAN|SHORTER THAN|BELOW|LESS THAN/, '≠': /CLOSED|NOT RIDE/ };
  for (let i = 0; i < RUNS; i++) {
    const r = genSignRule(rnd);
    assert.ok(noJunk(r.sign) && r.sign.includes(String(r.n)));
    assert.match(r.sign, words[r.sym], `${r.sign} -> ${ruleText(r)}`);
  }
});

test('writing a rule: both orders count; each mistake has its own hint', () => {
  const p = { type: 'write', rule: { letter: 'h', sym: '≥', n: 42 } };
  for (const f of ['h ≥ 42', '42 ≤ h']) assert.ok(checkWritten(p, tilesOf(f, ['h'])).correct, f);
  assert.equal(checkWritten(p, tilesOf('h > 42', ['h'])).key, 'boundary', 'at least written as >');
  assert.equal(checkWritten(p, tilesOf('h ≤ 42', ['h'])).key, 'direction');
  assert.equal(checkWritten(p, tilesOf('42 ≥ h', ['h'])).key, 'flipped_order', 'number first but the symbol not turned');
  assert.equal(checkWritten(p, tilesOf('h ≠ 42', ['h'])).key, 'not_equal');
  assert.equal(checkWritten(p, tilesOf('h ≥ 24', ['h'])).key, 'wrong_number');
  assert.ok(checkWritten(p, tilesOf('h ≥', ['h'])).nudge, 'unfinished: a reminder, not a miss');
  const under = { type: 'write', rule: { letter: 'a', sym: '<', n: 8 } };
  assert.equal(checkWritten(under, tilesOf('a ≤ 8', ['a'])).key, 'boundary', '"under 8" written as ≤ 8');
  const not = { type: 'write', rule: { letter: 'r', sym: '≠', n: 4 } };
  assert.ok(checkWritten(not, tilesOf('4 ≠ r', ['r'])).correct);
  assert.equal(checkWritten(not, tilesOf('r < 4', ['r'])).key, 'not_equal');
  for (const t of ['h > 42', 'h ≤ 42', '42 ≥ h', 'h ≠ 42']) assert.ok(noJunk(checkWritten(p, tilesOf(t, ['h'])).message));
});

test('the other side, two letters, and calculating the boundary', () => {
  for (let i = 0; i < 500; i++) {
    const o = genOtherSide(rnd);
    assert.ok(checkWritten(o, tilesOf(ruleText(o.rule), [o.rule.letter])).correct);
    assert.equal(checkWritten(o, tilesOf(ruleText(o.shown), [o.rule.letter])).key, 'other_side', 'writing the sign\'s own rule is caught');
    for (let v = o.shown.n - 3; v <= o.shown.n + 3; v++) assert.notEqual(passes(o.shown, v), passes(o.rule, v), 'every value is on exactly one side');
    const two = genTwoLetters(rnd);
    const L = [two.rule.letter, two.rule.other];
    assert.ok(checkWritten(two, tilesOf(ruleText(two.rule), L)).correct);
    assert.ok(checkWritten(two, tilesOf(`${two.rule.other} ${{ '>': '<', '<': '>' }[two.rule.sym]} ${two.rule.letter}`, L)).correct, 'g < m is the same as m > g');
    assert.equal(checkWritten(two, tilesOf(`${two.rule.letter} ${{ '>': '<', '<': '>' }[two.rule.sym]} ${two.rule.other}`, L)).key, 'direction');
    const c = genCalc(rnd);
    assert.ok(c.tiles.includes(c.rule.n) && c.tiles.length === 3);
    assert.ok(checkWritten(c, tilesOf(ruleText(c.rule), [c.rule.letter])).correct);
    const decoy = c.tiles.find((v) => v !== c.rule.n);
    assert.equal(checkWritten(c, tilesOf(`${c.rule.letter} ${c.rule.sym} ${decoy}`, [c.rule.letter])).key, 'calc_first');
    assert.ok(/at least|holds/.test(c.ask) && noJunk(c.ask));
  }
  const rec = genRecord(seeded(1));
  assert.equal(rec.rule.sym, '>');
  assert.equal(checkWritten(rec, tilesOf(`s ≥ ${rec.rule.n}`, ['s'])).key, 'boundary', 'tying the record does not beat it');
  const na = genNotAllowed(seeded(2));
  assert.equal(checkWritten(na, tilesOf(`p ≤ ${na.rule.n}`, ['p'])).key, 'other_side');
});

test(`riders: ${RUNS} decisions; boundary riders are common and explained`, () => {
  let boundary = 0;
  for (let i = 0; i < RUNS; i++) {
    const p = genRider(rnd);
    assert.ok(['h', 'a', 'r'].includes(p.rule.letter), 'rider signs are about the rider');
    const ok = passes(p.rule, p.v);
    assert.ok(checkRider(p, ok).correct && !checkRider(p, !ok).correct);
    if (p.v === p.rule.n) { boundary++; assert.equal(checkRider(p, !ok).key, 'boundary_rider'); }
    assert.ok(noJunk(checkRider(p, !ok).message));
  }
  assert.ok(boundary > RUNS * 0.2, `boundary riders: ${boundary}`);
});

test('number lines: build and read', () => {
  const r = { letter: 'a', sym: '≥', n: 8 };
  assert.ok(checkLine(r, { at: 8, closed: true, dir: 'right' }).correct);
  assert.equal(checkLine(r, { at: 7, closed: true, dir: 'right' }).key, 'line_number');
  assert.equal(checkLine(r, { at: 8, closed: false, dir: 'right' }).key, 'line_circle');
  assert.equal(checkLine(r, { at: 8, closed: true, dir: 'left' }).key, 'line_direction');
  assert.ok(checkLine({ letter: 'h', sym: '<', n: 40 }, { at: 40, closed: false, dir: 'left' }).correct);
  for (let i = 0; i < 500; i++) {
    const p = genReadLine(rnd);
    assert.equal(p.options.length, 4);
    assert.equal(new Set(p.options.map((o) => o.text)).size, 4);
    assert.equal(p.options.filter((o) => o.ok).length, 1);
    p.options.forEach((o, j) => { const res = checkPick(p, j); assert.equal(res.correct, Boolean(o.ok)); assert.ok(noJunk(res.message)); });
    assert.notEqual(genLine(rnd).rule.sym, '≠', 'no ≠ on a number line');
  }
});

test('who is right: Elias and Nina', () => {
  const counts = { both: 0, elias: 0, nina: 0 };
  for (let i = 0; i < 1000; i++) {
    const p = genWhoIsRight(rnd);
    counts[p.mode]++;
    const sameRule = (t) => {                          // does the text mean the sign's rule? test values around the boundary
      const [a, s, b] = t.split(' ');
      const rule = a === p.rule.letter ? { letter: a, sym: s, n: Number(b) } : { letter: b, sym: { '<': '>', '>': '<', '≤': '≥', '≥': '≤' }[s], n: Number(a) };
      return [-2, -1, 0, 1, 2].every((d) => passes(rule, p.rule.n + d) === passes(p.rule, p.rule.n + d));
    };
    const answer = sameRule(p.elias) && sameRule(p.nina) ? 0 : sameRule(p.elias) ? 1 : sameRule(p.nina) ? 2 : 3;
    assert.ok(p.options[answer].ok, `${p.elias} / ${p.nina} (${p.mode})`);
    p.options.forEach((o, j) => assert.equal(checkPick(p, j).correct, Boolean(o.ok)));
  }
  assert.ok(counts.both > 0 && counts.elias > 0 && counts.nina > 0);
});

test('zones: right kinds, worked solutions and backups for everything', () => {
  assert.equal(ZONES.length, 5);
  for (let r = 0; r < 200; r++) {
    const zones = ZONES.map((_, z) => genZone(rnd, z));
    assert.ok(zones[0].every((p) => p.type === 'write') && new Set(zones[0].map((p) => p.rule.sym)).size === 5, 'all five symbols in zone 1');
    assert.ok(zones[1].every((p) => p.type === 'rider') && zones[1].length >= 8);
    assert.ok(zones[2].every((p) => p.type === 'line' || p.type === 'readline'));
    assert.ok(zones[3].some((p) => p.other) && zones[3].some((p) => p.two) && zones[3].some((p) => p.type === 'pick'));
    assert.ok(zones[4].some((p) => p.calc) && zones[4].some((p) => p.type === 'rider') && zones[4].at(-1).v === zones[4].at(-1).rule.n, 'the boss ends on a boundary rider');
    for (const p of zones.flat()) {
      const lines = workedSolution(p);
      assert.ok(lines.length >= 2 && lines.every(noJunk), `${p.type}: ${lines.join(' | ')}`);
      const b = genBackup(rnd, p);
      assert.equal(b.type, p.type);
      assert.equal(Boolean(b.two), Boolean(p.two));
      assert.equal(Boolean(b.calc), Boolean(p.calc));
      if (p.type === 'write' && !p.two) assert.ok(checkWritten(p, tilesOf(ruleText(p.rule), [p.rule.letter])).correct);
    }
  }
  assert.equal(tilesText(tilesOf('42 ≤ h', ['h'])), '42 ≤ h');
  assert.equal(readTiles(tilesOf('h ≥', ['h'])), null);
});

console.log(`\n${passed} tests passed`);
