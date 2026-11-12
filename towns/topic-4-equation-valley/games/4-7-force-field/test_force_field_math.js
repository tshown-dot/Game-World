// Tests for Force Field (field.js). Run with:  node towns/topic-4-equation-valley/games/4-7-force-field/test_force_field_math.js
import assert from 'node:assert/strict';
import {
  seeded, SYMS, fmt, near, isSolution, inGraph, inBand, ruleGraph, sameGraph, ruleText, explain,
  genRule, genBandRule, genPods, genClues, classify, classifyZap, ZONES, genWaves, wholeEdge, pickStep, makeOrder, checkOrder,
} from './field.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261118);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
const KINDS = ['plain', 'decimal', 'words', 'story', 'solve'];

test('solutions, including the boundary', () => {
  const R = (sym, n) => ({ sym, n, letter: 'x' });
  assert.equal(isSolution(R('≤', 12), 12), true); assert.equal(isSolution(R('<', 12), 12), false);
  assert.equal(isSolution(R('≥', 12), 12), true); assert.equal(isSolution(R('>', 12), 12), false);
  assert.equal(isSolution(R('≤', 12), 11.99), true); assert.equal(isSolution(R('≤', 12), 12.01), false);
  assert.equal(isSolution(R('>', 7.5), 7.51), true); assert.equal(isSolution(R('>', 7.5), 7.5), false);
  assert.equal(explain(R('≤', 12), 12), '12 ≤ 12 is TRUE'); assert.equal(explain(R('<', 12), 12.01), '12.01 < 12 is FALSE');
});

test('the graph that matches a rule lands exactly the solutions', () => {
  for (let i = 0; i < RUNS; i++) {
    const rule = genRule(rnd, { kind: KINDS[i % KINDS.length] });
    const g = ruleGraph(rule);
    assert.equal(g.closed, rule.sym === '≤' || rule.sym === '≥'); assert.equal(g.dir, rule.sym === '>' || rule.sym === '≥' ? 'right' : 'left');
    for (const v of [rule.n, rule.n - 0.01, rule.n + 0.01, rule.range.lo, rule.range.hi, rule.n - 3, rule.n + 3]) assert.equal(inGraph(g, v), isSolution(rule, v), `${ruleText(rule)} at ${v}`);
    assert.ok(noJunk(rule.sign) && SYMS.includes(rule.sym));
    assert.ok(rule.n > rule.range.lo && rule.n < rule.range.hi, 'the boundary is on the number line shown');
    if (rule.kind === 'solve') {
      const v = rule.n + 1, left = rule.form === 'plus' ? v + rule.a : rule.form === 'minus' ? v - rule.a : v * rule.a;
      assert.equal(isSolution({ sym: rule.sym, n: rule.b }, left), isSolution(rule, v), `${rule.sign} solves to ${ruleText(rule)}`);
      assert.ok(noJunk(rule.steps));
    }
  }
});

test('words and stories mean the right symbol', () => {
  const seen = new Set();
  for (let i = 0; i < RUNS; i++) {
    const r = genRule(rnd, { kind: 'words' }); seen.add(`${r.sign.replace(/[\d. ]+$/, '')}|${r.sym}`);
  }
  for (const [phrase, sym] of [['AT LEAST', '≥'], ['AT MOST', '≤'], ['NO MORE THAN', '≤'], ['NO LESS THAN', '≥'], ['LESS THAN', '<'], ['FEWER THAN', '<'], ['MORE THAN', '>'], ['GREATER THAN', '>']]) assert.ok(seen.has(`${phrase}|${sym}`), `${phrase} is ${sym}`);
  assert.equal(seen.size, 8);
  for (let i = 0; i < 200; i++) { const s = genRule(rnd, { kind: 'story' }); assert.ok(/AT MOST|AT LEAST|NO MORE THAN|UNDER|WARMER THAN/.test(s.sign)); assert.equal(/AT MOST|NO MORE THAN/.test(s.sign), s.sym === '≤'); }
});

test(`pods: ${RUNS} waves each test the boundary and hold both kinds`, () => {
  for (let i = 0; i < RUNS; i++) {
    const rule = i % 6 === 5 ? genBandRule(rnd) : genRule(rnd, { kind: KINDS[i % KINDS.length] });
    const pods = genPods(rnd, rule, 5);
    assert.ok(pods.length >= 5 && pods.length <= 6);
    assert.equal(new Set(pods.map(fmt)).size, pods.length, 'no repeated values');
    assert.ok(pods.every((v) => v >= rule.range.lo && v <= rule.range.hi), 'every pod is on the number line');
    const sol = pods.filter((v) => isSolution(rule, v)).length;
    assert.ok(sol > 0 && sol < pods.length, 'some land, some are blocked');
    const edges = rule.band ? [rule.band.a, rule.band.b] : [rule.n];
    assert.ok(pods.some((v) => edges.some((e) => Math.abs(v - e) <= 1.01)), 'a pod at or right beside the boundary');
  }
});

test('hidden rules: the clues are enough to find the rule', () => {
  for (let i = 0; i < RUNS; i++) {
    const rule = genRule(rnd, { kind: i % 2 ? 'plain' : 'decimal' });
    const clues = genClues(rnd, rule), s = rule.range.step;
    assert.ok(clues.some((v) => near(v, rule.n)), 'a clue lands on the boundary itself (open or closed?)');
    assert.ok(clues.some((v) => near(v, rule.n - s)) && clues.some((v) => near(v, rule.n + s)), 'clues on both sides pin the boundary down');
    assert.ok(clues.some((v) => isSolution(rule, v)) && clues.some((v) => !isSolution(rule, v)));
  }
});

test('naming the mistake: direction, boundary, open or closed', () => {
  for (let i = 0; i < RUNS; i++) {
    const rule = genRule(rnd, { kind: KINDS[i % KINDS.length] });
    const good = ruleGraph(rule);
    // wrong circle only: the single value it gets wrong is the boundary
    const circle = { ...good, closed: !good.closed };
    assert.equal(inGraph(circle, rule.n) !== isSolution(rule, rule.n), true);
    assert.equal(classify(rule, circle, rule.n, inGraph(circle, rule.n)).key, good.closed ? 'edge_included' : 'edge_excluded');
    // wrong direction
    const flipped = { ...good, dir: good.dir === 'right' ? 'left' : 'right' };
    assert.equal(classify(rule, flipped, rule.n + 2, inGraph(flipped, rule.n + 2)).key, 'direction');
    // boundary in the wrong place
    const moved = { ...good, edge: rule.n + 2 * rule.range.step };
    const v = rule.n + rule.range.step;
    assert.notEqual(inGraph(moved, v), isSolution(rule, v));
    const res = classify(rule, moved, v, inGraph(moved, v));
    assert.equal(res.key, rule.kind === 'solve' ? 'solve_first' : 'boundary');
    assert.ok(noJunk(res.message) && res.message.includes(fmt(v)));
    assert.ok(sameGraph(good, { ...good }) && !sameGraph(good, circle));
  }
});

test('two rules at once, and zapping by hand', () => {
  for (let i = 0; i < RUNS; i++) {
    const rule = genBandRule(rnd), b = rule.band;
    assert.ok(b.a < b.b && b.a > rule.range.lo && b.b < rule.range.hi);
    assert.equal(isSolution(rule, b.a), b.aClosed); assert.equal(isSolution(rule, b.b), b.bClosed);
    assert.ok(isSolution(rule, (b.a + b.b) / 2) && !isSolution(rule, b.a - 1) && !isSolution(rule, b.b + 1));
    assert.equal(inBand({ ...b }, b.a), b.aClosed);
    assert.equal(classify(rule, null, b.a, !b.aClosed).key, b.aClosed ? 'edge_included' : 'edge_excluded');
    assert.equal(classify(rule, null, b.b + 2, true).key, 'band_range');
    const r = genRule(rnd, { kind: 'plain' });
    const yes = r.sym === '<' || r.sym === '≤' ? r.n - 2 : r.n + 2, no = r.sym === '<' || r.sym === '≤' ? r.n + 2 : r.n - 2;
    assert.equal(classifyZap(r, yes, true).key, 'zapped_solution'); assert.equal(classifyZap(r, no, false).key, 'missed_nonsolution');
    assert.equal(classifyZap(r, yes, false), null); assert.equal(classifyZap(r, no, true), null);
  }
});

test('zones and waves', () => {
  assert.equal(ZONES.length, 5);
  for (let i = 0; i < 300; i++) {
    for (let z = 0; z < 5; z++) {
      const waves = genWaves(rnd, z);
      assert.ok(waves.length >= 2);
      for (const w of waves) {
        assert.ok(['graph', 'zap', 'hidden', 'band'].includes(w.mode) && w.pods.length >= 4 && w.prep > 0 && noJunk(w.rule.sign));
        if (w.mode === 'hidden') { assert.ok(w.probes >= 5 && w.orders.length === 0); const s = w.rule.range.step; assert.ok(w.pods.every((v) => near(v / s, Math.round(v / s))), 'hidden-rule pods sit on the tick marks, like the clues'); }
        if (w.mode === 'zap') assert.ok(w.pods.length <= 9, 'one number key per pod');
        if (w.mode === 'band') assert.ok(w.rule.band);
        if (z === 0) assert.ok(w.rule.kind === 'plain' && Number.isInteger(w.rule.n), 'whole-number boundaries first');
      }
      if (z === 3) assert.ok(waves.every((w) => w.mode === 'zap'));
      if (z !== 4) assert.ok(waves.every((w) => w.orders.length >= 1), 'every wave has a turn for the student');
      if (z === 4) assert.deepEqual(waves.map((w) => w.mode), ['hidden', 'hidden', 'band', 'band']);
    }
  }
});

test('your turn: the smallest or largest whole number that works', () => {
  const R = (sym, n) => ({ sym, n, letter: 'x', range: { lo: 0, hi: 20, step: 1 } });
  assert.equal(wholeEdge(R('>', 8)), 9); assert.equal(wholeEdge(R('≥', 8)), 8); assert.equal(wholeEdge(R('>', 7.5)), 8); assert.equal(wholeEdge(R('≥', 7.5)), 8);
  assert.equal(wholeEdge(R('<', 8)), 7); assert.equal(wholeEdge(R('≤', 8)), 8); assert.equal(wholeEdge(R('<', 7.5)), 7); assert.equal(wholeEdge(R('≤', 7.5)), 7);
  const r = R('>', 8), o = makeOrder(r, 'whole_edge');
  assert.ok(/SMALLEST/.test(o.text) && /LARGEST/.test(makeOrder(R('≤', 8), 'whole_edge').text));
  assert.equal(checkOrder(r, o, 9).ok, true);
  assert.equal(checkOrder(r, o, 8).key, 'pick_solution'); assert.ok(/edge itself is not a solution/.test(checkOrder(r, o, 8).message));
  assert.equal(checkOrder(r, o, 10).key, 'whole_edge'); assert.ok(/9 is smaller and lands too/.test(checkOrder(r, o, 10).message));
  assert.equal(checkOrder(r, o, 8.5).key, 'pick_whole');
  assert.equal(checkOrder(r, makeOrder(r, 'nonwhole'), 9).key, 'pick_nonwhole'); assert.equal(checkOrder(r, makeOrder(r, 'nonwhole'), 8.5).ok, true);
  assert.equal(checkOrder(r, makeOrder(r, 'block'), 12).key, 'pick_nonsolution'); assert.equal(checkOrder(r, makeOrder(r, 'block'), 8).ok, true);
  assert.equal(checkOrder(r, makeOrder(r, 'land'), 3).key, 'pick_solution'); assert.equal(checkOrder(r, makeOrder(r, 'land'), 8.5).ok, true);
});

test(`your turn: every order in ${RUNS} waves can be filled on the line`, () => {
  const seen = new Set();
  for (let i = 0; i < RUNS; i++) {
    for (const w of genWaves(rnd, i % 5)) {
      const { lo, hi } = w.rule.range, s = pickStep(w.rule);
      for (const o of w.orders) {
        seen.add(o.type);
        assert.ok(o.example >= lo && o.example <= hi, `${o.text}: ${o.example} is on the line for ${w.rule.sign}`);
        assert.ok(near(o.example / s, Math.round(o.example / s)), 'and on a spot the student can pick');
        assert.equal(checkOrder(w.rule, o, o.example).ok, true, `${o.example} fills "${o.text}" for ${w.rule.sign}`);
        assert.ok(noJunk(o.text));
        // a number that cannot fill it is explained
        const bad = o.type === 'block' || o.type === 'first_only' || o.type === 'second_only' ? makeOrder(w.rule, w.rule.band ? 'both' : 'land').example : w.rule.band ? w.rule.band.b + 2 : makeOrder(w.rule, 'block').example;
        const res = checkOrder(w.rule, o, bad);
        assert.ok(res.ok === false && noJunk(res.message) && noJunk(res.key), `${bad} does not fill "${o.text}" for ${w.rule.sign}`);
      }
    }
  }
  assert.deepEqual([...seen].sort(), ['block', 'both', 'first_only', 'land', 'nonwhole', 'second_only', 'whole_edge']);
});

test('two rules at once: which rule does a number fit?', () => {
  const rule = { kind: 'band', letter: 't', band: { a: 3, aClosed: false, b: 9, bClosed: true }, range: { lo: 0, hi: 20, step: 1 } };
  assert.equal(checkOrder(rule, makeOrder(rule, 'both'), 9).ok, true); assert.equal(checkOrder(rule, makeOrder(rule, 'both'), 3).ok, false);
  assert.equal(checkOrder(rule, makeOrder(rule, 'first_only'), 12).ok, true); assert.equal(checkOrder(rule, makeOrder(rule, 'first_only'), 2).ok, false);
  assert.equal(checkOrder(rule, makeOrder(rule, 'second_only'), 3).ok, true); assert.equal(checkOrder(rule, makeOrder(rule, 'second_only'), 5).ok, false);
  assert.ok(/t > 3 is FALSE, t ≤ 9 is TRUE/.test(checkOrder(rule, makeOrder(rule, 'both'), 3).message));
});

console.log(`\n${passed} tests passed`);
