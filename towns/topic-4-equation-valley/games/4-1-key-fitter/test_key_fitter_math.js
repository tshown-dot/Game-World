// Tests for Key Fitter (keys.js). Run with:  node towns/topic-4-equation-valley/games/4-1-key-fitter/test_key_fitter_math.js
import assert from 'node:assert/strict';
import {
  seeded, fmt, parseNumber, leftValue, lockText, substitute, genLock, genForge, checkForge,
  genBelt, checkTap, checkLock, genRing, genStoryRing, genMystery, checkTry, ZONES, genZone,
} from './keys.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261119);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
const same = (a, b) => Math.abs(a - b) < 1e-9;

test('substituting a key into a lock', () => {
  const lock = { kind: 'add', x: 'n', a: 8, c: 15, money: false };
  assert.equal(lockText(lock), 'n + 8 = 15');
  assert.equal(substitute(lock, 7).text, '7 + 8 = 15 = 15'); assert.equal(substitute(lock, 7).equal, true);
  assert.equal(substitute(lock, 9).text, '9 + 8 = 17 ≠ 15'); assert.equal(substitute(lock, 9).equal, false);
  assert.equal(lockText({ kind: 'mul', x: 'g', k: 3, c: 21 }), '3g = 21'); assert.equal(substitute({ kind: 'mul', x: 'g', k: 3, c: 21 }, 7).text, '3 × 7 = 21 = 21');
  assert.equal(lockText({ kind: 'divBy', x: 'm', a: 36, c: 4, flip: true }), '4 = 36 ÷ m');
  assert.equal(substitute({ kind: 'two', x: 'x', k: 6, a: 5, c: 29 }, 4).text, '6 × 4 + 5 = 24 + 5 = 29 = 29');
  assert.equal(lockText({ kind: 'subFrom', x: 'p', a: 12.5, c: 4.25, money: true }), '$12.50 − p = $4.25');
  assert.equal(fmt(4.1, true), '$4.10'); assert.equal(parseNumber('$4.10'), 4.1); assert.equal(parseNumber(' 12 '), 12); assert.equal(parseNumber('abc'), null); assert.equal(parseNumber('-3'), null);
});

test(`belts: ${RUNS} belts, the key opens exactly the locks it should`, () => {
  const traps = new Set(), kinds = new Set();
  for (let i = 0; i < RUNS; i++) {
    const style = ['whole', 'whole', 'decimal', 'money'][i % 4], opens = i % 4;
    const set = style === 'whole' ? (i % 8 < 4 ? ['add', 'sub', 'subFrom'] : ['mul', 'divBy', 'divOf']) : ['add', 'sub', 'subFrom', 'mul'];
    const belt = genBelt(rnd, { kinds: set, opens, style, count: 6 });
    assert.equal(belt.locks.length, 6); assert.equal(belt.locks.filter((l) => l.opens).length, opens);
    assert.equal(new Set(belt.locks.map(lockText)).size, 6, 'no lock twice on a belt');
    if (style === 'whole') assert.ok(Number.isInteger(belt.value)); if (style === 'money') assert.ok(belt.money && same(belt.value * 4, Math.round(belt.value * 4)));
    for (const lock of belt.locks) {
      kinds.add(lock.kind);
      assert.equal(same(leftValue(lock, belt.value), lock.c), lock.opens, `${lockText(lock)} with key ${belt.value}`);
      assert.ok(lock.c > 0 && noJunk(lockText(lock)) && lockText(lock).length <= 19, lockText(lock));
      assert.equal(checkTap(belt, lock, lock.opens), null, 'the right call is never a mistake');
      const res = checkTap(belt, lock, !lock.opens);
      assert.ok(noJunk(res.message) && noJunk(res.key), `${lockText(lock)}: ${res.message}`);
      if (lock.opens) assert.equal(res.key, 'missed_open'); else { assert.equal(res.key, lock.trap); traps.add(lock.trap); assert.ok(res.message.includes('≠'), 'a wrong tap shows both sides'); }
      // every lock needs a decision: KEY FITS, REJECT, or it reaches the OUT box undecided
      assert.equal(checkLock(belt, lock, lock.opens ? 'fit' : 'reject'), null, 'the right decision is never a mistake');
      const wrong = checkLock(belt, lock, lock.opens ? 'reject' : 'fit'), slow = checkLock(belt, lock, 'none');
      assert.equal(wrong.key, lock.opens ? 'missed_open' : lock.trap); assert.ok(noJunk(wrong.message));
      assert.ok(slow.key === 'too_slow' && noJunk(slow.message) && slow.message.includes(lock.opens ? ' = ' : '≠') && /Too slow/.test(slow.message), slow.message);
    }
  }
  assert.deepEqual([...traps].sort(), ['answer_as_key', 'concatenation', 'near_miss', 'used_the_number', 'wrong_op']);
  assert.deepEqual([...kinds].sort(), ['add', 'divBy', 'divOf', 'mul', 'sub', 'subFrom']);
});

test('belts: the traps are real mistakes', () => {
  for (let i = 0; i < RUNS; i++) {
    const belt = genBelt(rnd, { kinds: ['mul', 'add'], opens: 1 }), b = belt.value;
    for (const l of belt.locks.filter((x) => !x.opens)) {
      if (l.trap === 'concatenation') assert.equal(String(l.c), `${l.k}${b}`);
      if (l.trap === 'answer_as_key') assert.equal(l.c, b);
      if (l.trap === 'used_the_number') assert.equal(l.kind === 'mul' ? l.k : l.a, b);
      if (l.trap === 'wrong_op' && l.kind === 'mul') assert.equal(l.c, l.k + b);
      if (l.trap === 'near_miss') assert.ok(Math.abs(leftValue(l, b) - l.c) <= 2);
    }
  }
  const two = genBelt(rnd, { kinds: ['two'], opens: 2 });
  assert.ok(two.locks.every((l) => l.kind === 'two') && two.locks.some((l) => l.trap === 'forgot_part'));
});

test('key ring: free test keys, and the strip always holds the answer', () => {
  for (let i = 0; i < RUNS; i++) {
    const ring = i % 5 === 4 ? genStoryRing(rnd) : genRing(rnd, ['add', 'sub', 'subFrom', 'mul', 'divOf', 'divBy'][i % 6]);
    const { lo, hi, step } = ring.strip, s = ring.lock.solution;
    assert.ok(s >= lo && s <= hi && same((s - lo) / step, Math.round((s - lo) / step)), `${lockText(ring.lock)}: ${s} is on the strip ${lo}..${hi}`);
    assert.equal(checkTry(ring, s).ok, true);
    const miss = checkTry(ring, s + step);
    assert.ok(miss.ok === false && /too (big|small)/.test(miss.message) && miss.text.includes('≠'), miss.message);
    if (ring.story) assert.ok(/gift card/.test(ring.story) && ring.lock.money);
  }
  const jam = genRing(rnd, 'add', { order: 'jam', tries: 1 });
  assert.equal(checkTry(jam, jam.lock.solution).ok, false); assert.equal(checkTry(jam, jam.lock.solution + 1).ok, true);
  const r = { type: 'ring', order: 'open', lock: { kind: 'add', x: 'n', a: 8, c: 15, money: false, flip: false } };
  assert.ok(/9 \+ 8 = 17 ≠ 15\. The left side came out too big/.test(checkTry(r, 9).message));
});

test('mystery lock: each test key shows what it makes', () => {
  for (let i = 0; i < RUNS; i++) {
    const m = genMystery(rnd), s = m.lock.solution;
    assert.ok(s >= 0 && s <= 20 && m.tries === 4);
    assert.equal(checkTry(m, s).ok, true);
    const t = checkTry(m, 0);
    assert.equal(t.ok, false); assert.equal(t.text, `Key 0 makes ${m.lock.kind === 'add' ? m.lock.a : 0}`);
    // two test keys are enough to work the lock out
    const at1 = leftValue(m.lock, 1), at0 = leftValue(m.lock, 0);
    assert.equal(m.lock.kind === 'add' ? at1 - at0 : at1, m.lock.kind === 'add' ? 1 : m.lock.k);
  }
});

test('forge: any true lock is accepted', () => {
  const p = genForge(rnd); const v = p.value;
  assert.equal(checkForge(p, '+', 5, v + 5).correct, true); assert.equal(checkForge(p, '-', 2, v - 2).correct, true);
  assert.equal(checkForge(p, '×', 3, v * 3).correct, true); assert.equal(checkForge(p, '÷', 2, v / 2).correct, true);
  const wrong = checkForge(p, '+', 5, v + 6); assert.equal(wrong.key, 'forge_wrong'); assert.ok(wrong.message.includes(`Make the right side ${v + 5}`));
  assert.equal(checkForge(p, '+', null, 5).key, 'incomplete'); assert.equal(checkForge(p, '×', 0, 0).key, 'zero'); assert.equal(checkForge(p, '+', 0, v).key, 'zero');
  const q = genForge(rnd, ['×', '÷']);
  assert.equal(checkForge(q, '+', 5, q.value + 5).key, 'forge_op'); assert.equal(checkForge(q, '×', 2, q.value * 2).correct, true);
});

test('zones', () => {
  assert.equal(ZONES.length, 5);
  for (let i = 0; i < 300; i++) {
    const z = [0, 1, 2, 3, 4].map((k) => genZone(rnd, k));
    assert.ok(z[0].every((r) => r.type === 'belt' && !r.decimal) && z[0].length === 3);
    assert.ok(z[1].some((r) => r.locks.every((l) => !l.opens)), 'one Gear Locks belt has no lock that opens');
    assert.ok(z[2][0].decimal && !z[2][0].money && z[2][1].money && z[2].some((r) => r.locks.every((l) => !l.opens)));
    assert.deepEqual(z[3].map((r) => r.type + ':' + r.order), ['ring:open', 'ring:open', 'ring:open', 'ring:open', 'ring:jam']);
    assert.deepEqual(z[4].map((r) => r.type), ['belt', 'ring', 'forge', 'forge', 'mystery', 'mystery']);
    assert.ok(z[4][1].story && z[4][3].ops.includes('×') && !z[4][2].ops);
    for (const r of z.flat()) if (r.type === 'belt') assert.ok(r.locks.length >= 5 && noJunk(fmt(r.value, r.money)));
  }
  assert.ok(genLock(rnd, 'add').solution > 0);
});

console.log(`\n${passed} tests passed`);
