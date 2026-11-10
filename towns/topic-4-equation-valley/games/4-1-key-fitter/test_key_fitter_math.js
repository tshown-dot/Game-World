// Tests for Lesson 4-1 "Key Fitter" math (keys.js).  Run with:  node test_key_fitter_math.js
import assert from 'node:assert/strict';
import {
  seeded, r2, fmt, parseNumber, leftValue, lockText, substitute, genLock, genWordLock, genMasterKey, genForge,
  genRun, genBackup, checkKey, checkMaster, checkForge, workedSolution, ZONES,
} from './keys.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 3000;
const rnd = seeded(41);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);

/** Evaluates a displayed lock like "12 = 3m + 2.5" or "$4.10 = $6.25 − y" with the variable replaced by v. */
function lockHolds(text, x, v) {
  const js = text.replace(/\$/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
    .replace(new RegExp(`(\\d)${x}\\b`, 'g'), `$1*(${v})`).replace(new RegExp(`\\b${x}\\b`, 'g'), `(${v})`);
  const [l, r] = js.split('=');
  return Math.abs(Function(`return (${l});`)() - Function(`return (${r});`)()) < 1e-6;
}

test('number entry: whole, decimal and money formats; no negatives or 3 decimal places', () => {
  assert.equal(parseNumber('12'), 12);
  assert.equal(parseNumber(' 12 '), 12);
  assert.equal(parseNumber('12.5'), 12.5);
  assert.equal(parseNumber('$4.10'), 4.1);
  assert.equal(parseNumber('4.10'), 4.1);
  assert.equal(parseNumber('-3'), null);
  assert.equal(parseNumber('1.234'), null);
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber('abc'), null);
});

const KINDS = [
  ['add', {}], ['sub', {}], ['subFrom', {}], ['mul', {}], ['divBy', {}], ['divOf', {}], ['two', {}],
  ['mul', { decimal: true }], ['add', { decimal: true }], ['sub', { decimal: true }], ['subFrom', { decimal: true }],
  ['add', { money: true }], ['sub', { money: true }], ['subFrom', { money: true }],
];

test(`locks: ${RUNS} of each kind have 4 different keys and exactly one fits`, () => {
  for (const [kind, opts] of KINDS) {
    for (let i = 0; i < RUNS / 3; i++) {
      const lock = genLock(rnd, kind, opts);
      assert.equal(lock.keys.length, 4, `${kind}: 4 keys`);
      assert.equal(new Set(lock.keys.map((k) => k.value)).size, 4, `${kind}: different keys`);
      const fits = lock.keys.filter((k) => substitute(lock, k.value).equal);
      assert.equal(fits.length, 1, `${lockText(lock)}: exactly one key fits`);
      assert.equal(fits[0].value, lock.answer);
      assert.ok(lock.keys.every((k) => k.value > 0), 'all keys positive');
      if (!lock.decimal) assert.ok(lock.keys.every((k) => Number.isInteger(k.value)), `whole-number keys: ${lockText(lock)}`);
      if (lock.money) assert.ok(lock.keys.every((k) => r2(k.value) === k.value), 'money keys are whole cents');
      assert.ok(lockHolds(lockText(lock), lock.x, lock.solution), `the shown lock is true for its answer: ${lockText(lock)} with ${lock.x}=${lock.solution}`);
      assert.ok(lock.c > 0, 'the other side is positive');
    }
  }
});

test('"no key fits" locks: none of the 4 keys work, and NO KEY FITS is the answer', () => {
  for (let i = 0; i < RUNS; i++) {
    const lock = genLock(rnd, ['add', 'sub', 'mul', 'divBy', 'subFrom'][i % 5], { noKey: true });
    assert.equal(lock.keys.length, 4);
    assert.ok(lock.keys.every((k) => !substitute(lock, k.value).equal), lockText(lock));
    assert.ok(checkKey(lock, 'none').correct);
    const r = checkKey(lock, lock.keys[0].value);
    assert.ok(!r.correct && /NO KEY FITS/.test(r.message), 'picking a key says to look for NO KEY FITS');
  }
});

test('checking keys: the right key clicks, wrong keys get the hint for their mistake', () => {
  const seen = new Set();
  for (let i = 0; i < RUNS; i++) {
    const [kind, opts] = KINDS[i % KINDS.length];
    const lock = genLock(rnd, kind, opts);
    const right = checkKey(lock, lock.answer);
    assert.ok(right.correct && /Click!/.test(right.message));
    assert.equal(checkKey(lock, 'none').key, 'missed_key', 'NO KEY FITS on a lock that has a key is caught');
    for (const k of lock.keys.filter((k) => k.tag !== 'correct')) {
      const r = checkKey(lock, k.value);
      assert.ok(!r.correct);
      assert.equal(r.key, k.tag);
      seen.add(k.tag);
      assert.ok(noJunk(r.message) && r.message.includes('≠'), `hint shows the substitution: ${r.message}`);
    }
  }
  for (const tag of ['forward_op', 'answer_as_key', 'used_the_number', 'add_sub_instead', 'place_value', 'near_miss', 'forgot_divide']) {
    assert.ok(seen.has(tag), `the "${tag}" mistake shows up as a key`);
  }
});

test('substitution text: "16 + 9 = 25 ≠ 35", money keeps cents, two-step shows the middle step', () => {
  const lock = { kind: 'add', x: 'd', a: 9, c: 35, money: false };
  assert.equal(substitute(lock, 16).text, '16 + 9 = 25 ≠ 35');
  assert.equal(substitute(lock, 26).text, '26 + 9 = 35 = 35');
  const money = { kind: 'subFrom', x: 'y', a: 6.25, c: 4.1, money: true };
  assert.equal(substitute(money, 2.15).text, '$6.25 − $2.15 = $4.10 = $4.10');
  const two = { kind: 'two', x: 'n', k: 6, a: 5, c: 29, money: false };
  assert.equal(substitute(two, 4).text, '6 × 4 + 5 = 24 + 5 = 29 = 29');
  assert.equal(lockText({ ...two, flip: false }), '6n + 5 = 29');
  assert.equal(lockText({ kind: 'divBy', x: 'm', a: 36, c: 4, flip: true }), '4 = 36 ÷ m');
});

test('word problems: gift card prices use money and the right price fits', () => {
  for (let i = 0; i < 500; i++) {
    const w = genWordLock(rnd);
    assert.ok(w.money && noJunk(w.story));
    assert.ok(substitute(w, w.answer).equal);
    assert.equal(w.keys.filter((k) => substitute(w, k.value).equal).length, 1);
  }
});

test('master key: 1 to 3 of the 4 locks open, and the 5n-means-5-times-n trap is explained', () => {
  let sawConcat = false;
  for (let i = 0; i < RUNS; i++) {
    const m = genMasterKey(rnd);
    assert.equal(m.locks.length, 4);
    const opens = m.locks.filter((l) => l.opens).length;
    assert.ok(opens >= 1 && opens <= 3, `opens ${opens}`);
    for (const l of m.locks) assert.equal(substitute(l, m.value).equal, l.opens, lockText(l));
    const marks = Object.fromEntries(m.locks.map((l) => [l.id, l.opens]));
    assert.ok(checkMaster(m, marks).correct);
    const concat = m.locks.find((l) => l.trap === 'concatenation');
    if (concat) {
      sawConcat = true;
      const r = checkMaster(m, { ...marks, [concat.id]: true });
      assert.equal(r.key, 'concatenation');
      assert.match(r.message, /means .* × /);
    }
    const flipOne = { ...marks, [m.locks[0].id]: !m.locks[0].opens };
    assert.equal(checkMaster(m, flipOne).correct, false);
  }
  assert.ok(sawConcat);
});

test('forge a lock: any true equation for the key works; wrong ones show the check', () => {
  const f = genForge(rnd);
  const v = f.value;
  assert.ok(checkForge(f, '+', 5, v + 5).correct);
  assert.ok(checkForge(f, '-', 2, v - 2).correct);
  assert.ok(checkForge(f, '×', 3, 3 * v).correct);
  assert.ok(checkForge(f, '÷', 2, v / 2).correct);
  const wrong = checkForge(f, '+', 5, v + 6);
  assert.ok(!wrong.correct && wrong.key === 'forge_wrong' && wrong.message.includes(String(v + 5)));
  assert.equal(checkForge(f, '×', 0, 0).key, 'zero');
  assert.equal(checkForge(f, '+', 0, v).key, 'zero');
  assert.equal(checkForge(f, '+', null, 3).key, 'incomplete');
});

test('a full run: zone sizes, 2 "no key fits" locks, worked solutions and backups for everything', () => {
  for (let run = 0; run < 300; run++) {
    const zones = genRun(rnd);
    assert.equal(zones.length, ZONES.length);
    assert.deepEqual(zones.map((z) => z.length), [4, 4, 4, 2, 5]);
    assert.equal(zones.slice(0, 3).flat().filter((p) => p.noKey).length, 2);
    for (const p of zones.flat()) {
      const lines = workedSolution(p);
      assert.ok(lines.length >= 2 && lines.every(noJunk), `worked solution for ${p.type}`);
      const b = genBackup(rnd, p);
      assert.equal(b.type, p.type);
      if (p.type === 'lock') assert.equal(b.kind, p.kind, 'backup lock is the same kind');
    }
  }
});

console.log(`\n${passed} tests passed`);
