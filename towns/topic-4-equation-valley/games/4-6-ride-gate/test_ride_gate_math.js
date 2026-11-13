// Tests for Ride Gate's math (gate.js). Run with:  node towns/topic-4-equation-valley/games/4-6-ride-gate/test_ride_gate_math.js
import assert from 'node:assert/strict';
import {
  seeded, SYMS, fmt, ruleText, flipped, complement, passes, riderText, genSignRule, genRiders, genKeep, genRush, checkRider,
  genWrite, testRider, readTiles, tilesText, answerText, checkWritten, gateRun, consequence, ZONES, genZone,
} from './gate.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 3000;
const rnd = seeded(20261114);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
// "h ≥ 42" or "42 ≤ h" -> tiles
const tilesOf = (text) => text.split(' ').map((w) => (SYMS.includes(w) ? { t: 'sym', v: w } : /^[a-z]$/.test(w) ? { t: 'var', v: w } : { t: 'num', v: Number(w) }));
const FOUR = ['<', '≤', '>', '≥'];

test('who passes each rule, especially the boundary', () => {
  const r = (sym) => ({ letter: 'h', sym, n: 42, unit: 'in' });
  assert.deepEqual([41, 42, 43].map((v) => passes(r('≥'), v)), [false, true, true]);
  assert.deepEqual([41, 42, 43].map((v) => passes(r('>'), v)), [false, false, true]);
  assert.deepEqual([41, 42, 43].map((v) => passes(r('≤'), v)), [true, true, false]);
  assert.deepEqual([41, 42, 43].map((v) => passes(r('<'), v)), [true, false, false]);
  assert.deepEqual([41, 42, 43].map((v) => passes(r('≠'), v)), [true, false, true]);
  assert.ok(passes({ letter: 's', sym: '<', n: 19.7 }, 19.6) && !passes({ letter: 's', sym: '<', n: 19.7 }, 19.7));
  assert.equal(ruleText(r('≥')), 'h ≥ 42'); assert.equal(flipped(r('≥')), '42 ≤ h'); assert.equal(complement(r('<')).sym, '≥', 'everyone not under 42 is 42 or more');
  assert.equal(riderText(r('≥'), 42), '42 in'); assert.equal(riderText({ unit: '$' }, 120), '$120'); assert.equal(riderText({ unit: 'ride' }, 7), 'ride 7');
  assert.equal(riderText({ unit: 'people' }, 1), '1 person'); assert.equal(riderText({ unit: 'sec' }, 19.7), '19.7 sec'); assert.equal(fmt(19.700000001), '19.7');
});

test(`signs: ${RUNS} of them, every symbol, and the wording matches the symbol`, () => {
  const seen = new Set();
  for (let i = 0; i < RUNS; i++) {
    const r = genSignRule(rnd); seen.add(r.sym);
    assert.ok(noJunk(r.sign) && r.sign.includes(String(r.n)) && noJunk(r.what) && noJunk(r.unit) && Number.isInteger(r.n));
    if (/AT LEAST|NO LESS THAN|MINIMUM|AND UP|OR MORE/.test(r.sign)) assert.equal(r.sym, '≥', r.sign);
    if (/AT MOST|NO MORE THAN|UP TO|MAXIMUM|OR LESS|AND UNDER|NO OLDER/.test(r.sign)) assert.equal(r.sym, '≤', r.sign);
    if (/TALLER THAN|OLDER THAN|MORE THAN|^OVER/.test(r.sign) && !/NO /.test(r.sign)) assert.equal(r.sym, '>', r.sign);
    if (/SHORTER THAN|YOUNGER THAN|FEWER THAN|LESS THAN|^UNDER/.test(r.sign) && !/NO /.test(r.sign)) assert.equal(r.sym, '<', r.sign);
    if (/CLOSED|EXCEPT/.test(r.sign)) assert.equal(r.sym, '≠', r.sign);
  }
  assert.equal(seen.size, 5);
});

test('riders: the edge itself and one either side are always in the line', () => {
  for (let i = 0; i < RUNS; i++) {
    const rule = i % 5 === 0 ? genWrite(rnd, null, 'record').rule : genSignRule(rnd), step = Number.isInteger(rule.n) ? 1 : 0.1, riders = genRiders(rnd, rule, 6);
    assert.equal(riders.length, 6);
    for (const want of [rule.n, rule.n - step, rule.n + step]) assert.ok(riders.some((v) => Math.abs(v - want) < 1e-9), `${ruleText(rule)}: ${want} is in the line (${riders})`);
    assert.ok(riders.every((v) => v > 0 && noJunk(riderText(rule, v))));
    assert.ok(riders.some((v) => passes(rule, v)) && riders.some((v) => !passes(rule, v)), 'some get in and some do not');
  }
});

test('gatekeeper: every rider, both choices', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = i % 4 === 0 ? genRush(rnd) : genKeep(rnd, SYMS[i % 5]);
    assert.equal(p.type, 'keep'); assert.equal(p.riders.length, p.rush ? 9 : 6); assert.ok(p.seconds > 0);
    if (p.rush) assert.equal(new Set(p.riders.map((r) => r.rule)).size, 3, 'the sign changes twice');
    for (const { rule, v } of p.riders) {
      const ok = passes(rule, v), good = checkRider(rule, v, ok), bad = checkRider(rule, v, !ok);
      assert.ok(good.ok); assert.ok(!bad.ok && noJunk(bad.message) && bad.message.includes(ruleText(rule)));
      assert.equal(bad.key, v === rule.n ? 'boundary_rider' : 'rider_wrong');
    }
  }
  const r = { letter: 'h', sym: '>', n: 42, unit: 'in' };
  assert.ok(/does NOT include 42/.test(checkRider(r, 42, true).message)); assert.ok(/includes 42/.test(checkRider({ ...r, sym: '≥' }, 42, false).message));
  assert.ok(/EXCEPT 7/.test(checkRider({ letter: 'r', sym: '≠', n: 7, unit: 'ride' }, 7, true).message));
});

test('writing a rule: either order is right, and each mistake is named', () => {
  const p = { mode: null, rule: { letter: 'h', sym: '≥', n: 42, unit: 'in' }, work: '', riders: [40, 41, 42, 43, 47, 42] };
  const c = (text, q = p) => checkWritten(q, tilesOf(text));
  assert.ok(c('h ≥ 42').ok && c('42 ≤ h').ok); assert.deepEqual(c('42 ≤ h').student.sym, '≥');
  assert.equal(c('h > 42').key, 'boundary'); assert.equal(c('42 < h').key, 'boundary');
  assert.equal(c('h ≤ 42').key, 'direction'); assert.equal(c('h < 42').key, 'direction'); assert.ok(/h is less than 42/.test(c('h < 42').message));
  assert.equal(c('42 ≥ h').key, 'flipped_order'); assert.equal(c('h ≠ 42').key, 'not_equal');
  assert.equal(checkWritten(p, [{ t: 'var', v: 'h' }, null, { t: 'num', v: 42 }]).nudge, true); assert.equal(c('h ≥ h').nudge, true); assert.equal(c('42 ≥ 42').nudge, true);
  for (const wrong of ['h > 42', 'h ≤ 42', 'h < 42', 'h ≠ 42', '42 ≥ h']) assert.ok(!c(wrong).message.includes('h ≥ 42') && !c(wrong).message.includes('42 ≤ h'), `${wrong}: the message does not give the answer away`);
  const ne = { ...p, rule: { letter: 'r', sym: '≠', n: 7, unit: 'ride' } };
  assert.ok(c('r ≠ 7', ne).ok && c('7 ≠ r', ne).ok); assert.equal(c('r > 7', ne).key, 'not_equal');
  const other = { ...p, mode: 'other' };                     // "no riders under 42 inches"
  assert.equal(c('h < 42', other).key, 'other_side'); assert.equal(c('h > 42', other).key, 'boundary'); assert.ok(c('h ≥ 42', other).ok);
  const mirror = { ...p, mode: 'mirror' };
  assert.equal(c('h ≥ 42', mirror).nudge, true); assert.ok(c('42 ≤ h', mirror).ok); assert.equal(c('42 ≥ h', mirror).key, 'flipped_order');
  assert.equal(answerText(mirror), 'The rule, number first: 42 ≤ h.'); assert.equal(answerText(p), 'The rule: h ≥ 42 (or 42 ≤ h).');
  const rec = { ...p, mode: 'record', rule: { letter: 's', sym: '<', n: 19.7, unit: 'sec' } };
  assert.ok(c('s < 19.7', rec).ok); assert.ok(/FEWER seconds/.test(c('s > 19.7', rec).message));
  assert.equal(tilesText(tilesOf('42 ≤ h')), '42 ≤ h'); assert.equal(readTiles([]), null);
});

test('the gate runs exactly what was written, and a wrong rule always shows on a rider', () => {
  for (let i = 0; i < RUNS; i++) {
    const mode = [null, 'other', 'mirror', 'hidden', 'calc', 'record'][i % 6], sym = mode === null ? SYMS[i % 5] : FOUR[i % 4], p = genWrite(rnd, sym, mode, mode === 'calc' ? i % 2 : null), r = p.rule;
    assert.ok(noJunk(p.sign) && p.riders.length === 6 && p.tiles[0].t === 'var' && p.tiles[0].v === r.letter && p.tiles.some((t) => t.t === 'num' && t.v === r.n) && noJunk(answerText(p)));
    const right = checkWritten(p, tilesOf(flipped(r))); assert.ok(right.ok, `${p.sign} <- ${flipped(r)}`);
    assert.equal(gateRun(p, right.student).wrong, -1);
    if (mode !== 'mirror') assert.ok(checkWritten(p, tilesOf(ruleText(r))).ok);
    for (const s of SYMS) {
      if (s === r.sym) continue;
      const res = checkWritten(p, tilesOf(`${fmt(r.n)} ${{ '<': '>', '>': '<', '≤': '≥', '≥': '≤', '≠': '≠' }[s]} ${r.letter}`));
      assert.ok(!res.ok && res.student && res.student.sym === s && noJunk(res.message) && noJunk(res.key));
      const run = gateRun(p, res.student); assert.ok(run.wrong >= 0, `${ruleText(r)} written as ${s}: some rider shows the mistake`);
      assert.ok(noJunk(consequence(p, run.rows[run.wrong])) && run.rows[run.wrong].opens !== run.rows[run.wrong].should);
    }
    if (mode === 'calc') {
      assert.equal(p.tiles.length, 4); assert.ok(noJunk(p.work));
      const decoy = p.tiles.find((t) => t.t === 'num' && t.v !== r.n), res = checkWritten(p, [p.tiles[0], { t: 'sym', v: r.sym }, decoy]);
      assert.ok(res.key === 'calc_first' && res.student === null && res.message.includes(p.work));
    }
    if (mode === 'record') { assert.equal(r.sym, '<'); assert.ok(!Number.isInteger(r.n) || r.n > 15); }
    if (mode === 'other') assert.ok(/^NO|NOT FOR/.test(p.sign));
    if (mode === 'hidden') {
      assert.ok(/▒/.test(p.sign) && p.sign.includes(String(r.n)) && p.tests === 3 && p.range.lo >= 1 && p.range.lo < r.n - 1 && p.range.hi > r.n + 1, 'the edge and both sides can be tested');
      assert.deepEqual([r.n - 1, r.n, r.n + 1].map((v) => testRider(p, v)), [r.n - 1, r.n, r.n + 1].map((v) => passes(r, v)));
      const sig = (s) => [-1, 0, 1].map((d) => passes({ ...r, sym: s }, r.n + d)).join(); assert.equal(new Set(SYMS.map(sig)).size, 5, 'three tests tell all five symbols apart');
    }
  }
});

test('zones', () => {
  assert.equal(ZONES.length, 5);
  for (let i = 0; i < 300; i++) {
    const z = [0, 1, 2, 3, 4].map((k) => genZone(rnd, k));
    assert.ok(z[0].length === 3 && z[0].every((r) => r.type === 'keep' && !r.rush) && z[0].some((r) => r.riders[0].rule.sym === '≠'));
    assert.ok(z[1].length === 6 && z[1].every((r) => r.type === 'write' && r.mode === null)); assert.equal(new Set(z[1].map((r) => r.rule.sym)).size, 5);
    assert.deepEqual(z[2].map((r) => r.mode), ['other', 'mirror', 'other', 'mirror', 'other', 'mirror']);
    assert.ok(z[3].length === 4 && z[3].every((r) => r.mode === 'hidden')); assert.equal(new Set(z[3].map((r) => r.rule.sym)).size, 4);
    assert.deepEqual(z[4].map((r) => r.mode || r.type), ['calc', 'record', 'hidden', 'calc', 'keep']); assert.ok(z[4][4].rush && z[4][0].rule.letter !== z[4][3].rule.letter);
  }
});

console.log(`\n${passed} tests passed`);
