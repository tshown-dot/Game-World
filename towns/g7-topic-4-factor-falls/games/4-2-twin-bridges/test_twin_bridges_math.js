// Tests for Twin Bridges' math (bridges.js). Run with:  node towns/g7-topic-4-factor-falls/games/4-2-twin-bridges/test_twin_bridges_math.js
import assert from 'node:assert/strict';
import {
  seeded, near, fmt, parseNumber, sum, paren, same, valueOf, POSTS, DIALS, PROPS, plain, agreeAt,
  genTest, checkTest, genRaft, checkRaft, genBuild, checkBuild, buildAnswer, genChain, walkChain, checkSpan, chainAnswer, ZONES, genZone,
} from './bridges.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261113);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
const E = (m, k) => ({ text: plain(m, k), m, k });
/** Work an expression's text out with plain arithmetic, to check the stored m and k against what is printed. */
function evalText(text, v, x) {
  const js = text.replace(/−/g, '-').replace(/·/g, '*').replace(/(\d+)\/(\d+)\(/g, '($1/$2)*(').replace(/(\d)\(/g, '$1*(').replace(/-\(/g, '-1*(')
    .replace(new RegExp(`(\\d)${v}`, 'g'), '$1*X').replace(new RegExp(`\\b${v}\\b`, 'g'), 'X').replace(/X/g, `(${x})`);
  return Function(`"use strict"; return (${js});`)();
}
const textMatches = (ex, v) => POSTS.every((x) => near(evalText(ex.text, v, x), valueOf(ex, x)));

test('writing numbers and expressions', () => {
  assert.equal(fmt(-3), '−3'); assert.equal(fmt(2.5), '2.5'); assert.equal(fmt(4), '4');
  assert.equal(plain(-3, 12), '−3x + 12'); assert.equal(plain(1, -4, 'g'), 'g − 4'); assert.equal(plain(5, 0, 't'), '5t'); assert.equal(plain(0, 7), '7'); assert.equal(plain(-1, 2), '−x + 2');
  assert.equal(paren(-3, 'x', -4), '−3(x − 4)'); assert.equal(sum([2, 'x'], [-5, '']), '2x − 5');
  assert.deepEqual(['15', '15.00', '−3', '-3', '5/2', '2 1/2', 'abc'].map(parseNumber), [15, 15, -3, -3, 2.5, 2.5, null]);
  assert.deepEqual(POSTS, [-3, -2, -1, 0, 1, 2, 3, 4], 'the posts include negatives and zero');
});

test('twins agree at every post; other bridges agree at one post at most', () => {
  assert.equal(valueOf(E(-3, 12), 4), 0); assert.equal(valueOf(E(2, 1), -3), -5);
  assert.ok(same(E(2, 6), E(2, 6)) && !same(E(2, 6), E(2, 5)));
  assert.deepEqual(agreeAt(E(2, 6), E(2, 6)), POSTS);
  assert.deepEqual(agreeAt(E(2, 4), E(3, 3)), [1], '2(x + 2) and 3x + 3 cross at x = 1');
  assert.deepEqual(agreeAt(E(2, 4), E(2, 2)), [], 'side by side: never');
});

test('test rounds: twins, plain non-twins and the lucky post', () => {
  for (let i = 0; i < RUNS; i++) {
    const eq = genTest(rnd, { eq: true }), no = genTest(rnd, { eq: false }), lucky = genTest(rnd, { lucky: true });
    for (const p of [eq, no, lucky]) { assert.ok(textMatches(p.A, p.v) && textMatches(p.B, p.v), `${p.A.text} | ${p.B.text}`); assert.ok(noJunk(p.why) && p.tests === 3 && p.A.text !== p.B.text); }
    assert.ok(eq.eq && same(eq.A, eq.B) && agreeAt(eq.A, eq.B).length === POSTS.length);
    assert.ok(!no.eq && !same(no.A, no.B) && agreeAt(no.A, no.B).length <= 1);
    assert.ok(!lucky.eq && POSTS.includes(lucky.lucky) && agreeAt(lucky.A, lucky.B).length === 1 && agreeAt(lucky.A, lucky.B)[0] === lucky.lucky, 'exactly one post agrees');
  }
});

test('calling a test: the lucky post, an ignored test, doubting real twins', () => {
  for (let i = 0; i < 300; i++) {
    const lucky = genTest(rnd, { lucky: true }), other = POSTS.find((x) => x !== lucky.lucky);
    assert.equal(checkTest(lucky, [], true).nudge, true, 'no test yet: only a nudge');
    let r = checkTest(lucky, [lucky.lucky], true);
    assert.ok(!r.ok && r.key === 'one_test_value' && /not proof/.test(r.message) && noJunk(r.message));
    r = checkTest(lucky, [lucky.lucky, other], true);
    assert.ok(!r.ok && r.key === 'ignored_test' && /one post that splits is enough/.test(r.message));
    assert.ok(checkTest(lucky, [other], false).ok && checkTest(lucky, [lucky.lucky], false).ok);
    const eq = genTest(rnd, { eq: true });
    assert.ok(checkTest(eq, [0, 2], true).ok && /Twins at every post/.test(checkTest(eq, [0], true).message));
    r = checkTest(eq, [0, 1, 2], false);
    assert.ok(!r.ok && r.key === 'doubted_twins' && noJunk(r.message));
  }
});

test('rafts: every card is a twin with a property, or a trap with a reason', () => {
  const forms = ['dist', 'collect', 'assoc'], seen = new Set();
  for (let i = 0; i < RUNS; i++) {
    const p = genRaft(rnd, forms[i % 3]);
    assert.ok(textMatches(p.target, p.v), p.target.text);
    assert.ok(p.cards.length >= 4 && p.cards.length <= 6 && p.seconds > 0);
    assert.equal(new Set(p.cards.map((c) => c.text)).size, p.cards.length, 'no raft twice');
    assert.ok(p.cards.some((c) => c.twin) && p.cards.some((c) => !c.twin), 'some of each');
    p.cards.forEach((c, k) => {
      assert.ok(textMatches(c, p.v), `${c.text} in ${p.target.text}`);
      assert.equal(c.twin, same(c, p.target)); assert.notEqual(c.text, p.target.text);
      const hook = checkRaft(p, k, true), pass = checkRaft(p, k, false);
      if (c.twin) {
        assert.ok(hook.ok && Object.values(PROPS).includes(hook.property) && !hook.quiet);
        assert.ok(!pass.ok && pass.key === 'missed_twin' && noJunk(pass.message));
      } else {
        assert.ok(pass.ok && pass.quiet, 'letting a trap go is right, and quiet');
        assert.ok(!hook.ok && noJunk(hook.key) && noJunk(hook.message) && POSTS.includes(hook.at) && !near(valueOf(c, hook.at), valueOf(p.target, hook.at)), 'a hooked trap names a post where it splits');
        seen.add(hook.key);
      }
    });
  }
  for (const k of ['first_term_only', 'sign_error', 'combine_unlike', 'lost_negative', 'times_not_plus']) assert.ok(seen.has(k), k);
});

test('build: the dials can reach every twin, and each slip is recognised', () => {
  const forms = ['assoc', 'distNeg', 'dist', 'combine', 'sub', 'dec', 'frac', 'hidden'], keys = new Set();
  for (let i = 0; i < RUNS; i++) {
    const p = genBuild(rnd, forms[i % forms.length]), { m, k } = p.A;
    assert.ok(Number.isInteger(m) && Number.isInteger(k) && m >= DIALS.m.lo && m <= DIALS.m.hi && k >= DIALS.k.lo && k <= DIALS.k.hi, `${p.A.text} -> ${m}, ${k}`);
    assert.ok(m !== 0 || p.form === 'combine', 'the letter stays in the answer');
    if (p.hidden) assert.ok(p.tests === 3 && !/[a-z]/.test(p.A.text), 'a hidden bridge shows no expression'); else assert.ok(textMatches(p.A, p.v), p.A.text);
    const right = checkBuild(p, m, k);
    assert.ok(right.ok && right.agree.length === POSTS.length && noJunk(right.message) && (p.hidden ? right.property === null : Object.values(PROPS).includes(right.property)));
    for (const t of p.traps) {
      assert.ok(Number.isInteger(t.m) && Number.isInteger(t.k) && !(t.m === m && t.k === k), 'a trap is a wrong answer the dials can show');
      const r = checkBuild(p, t.m, t.k);
      assert.ok(!r.ok && r.key === t.key && noJunk(r.message) && r.agree.length <= 1); keys.add(r.key);
    }
    let r = checkBuild(p, m, k + 3);
    if (!p.traps.some((t) => t.m === m && t.k === k + 3)) { assert.ok(r.key === 'number_part' && /3 too high/.test(r.message) && r.agree.length === 0); }
    r = checkBuild(p, m + 7, k);
    if (!p.traps.some((t) => t.m === m + 7 && t.k === k)) assert.ok(r.key === 'x_part' && r.agree.length === 1 && r.agree[0] === 0, 'a wrong letter part meets only at 0');
    r = checkBuild(p, m + 7, k + 11);
    if (!p.traps.some((t) => t.m === m + 7 && t.k === k + 11)) assert.equal(r.key, 'off');
    assert.ok(noJunk(buildAnswer(p)) && buildAnswer(p).includes(plain(m, k, p.v)));
    assert.equal(r.mine.text, plain(m + 7, k + 11, p.v));
  }
  for (const k of ['first_term_only', 'sign_error', 'times_not_plus', 'lost_negative', 'combine_unlike', 'subtract_group']) assert.ok(keys.has(k), k);
});

test('build: worked examples', () => {
  const p = { v: 'x', A: { text: '−3(x − 4)', m: -3, k: 12 }, prop: 'D', traps: [{ m: -3, k: -4, key: 'first_term_only', message: 'both' }, { m: -3, k: -12, key: 'sign_error', message: 'sign' }] };
  assert.ok(checkBuild(p, -3, 12).ok); assert.equal(checkBuild(p, -3, 12).property, 'DISTRIBUTIVE PROPERTY');
  assert.equal(checkBuild(p, -3, -4).key, 'first_term_only'); assert.equal(checkBuild(p, -3, -12).key, 'sign_error');
  assert.equal(checkBuild(p, 3, 12).key, 'x_part'); assert.equal(checkBuild(p, -3, 10).key, 'number_part');
  assert.match(checkBuild(p, -3, 10).message, /2 too low/);
});

test('chains: exactly one wrong step, found by walking a post', () => {
  const slips = ['distribute', 'reorder', 'combine'], bads = new Set();
  for (let i = 0; i < RUNS; i++) {
    const p = genChain(rnd, slips[i % 3]);
    assert.equal(p.lines.length, 4); assert.ok(p.walks === 3 && noJunk(p.why) && noJunk(p.key));
    p.lines.forEach((l) => assert.ok(textMatches(l, p.v) && l.text.length <= 22, l.text));
    const breaks = p.lines.map((l, k) => k > 0 && !same(l, p.lines[k - 1])).filter(Boolean).length;
    assert.equal(breaks, 1, 'one step breaks the chain'); assert.equal(p.bad, { distribute: 1, reorder: 2, combine: 3 }[p.slip]); bads.add(p.bad);
    assert.ok(same(p.A, p.lines[0]) && !same(p.lines[3], p.A), 'the last line is not a twin of the first');
    assert.ok(Number.isInteger(p.A.m) && Math.abs(p.A.m) <= DIALS.m.hi && Math.abs(p.A.k) <= DIALS.k.hi && p.A.m !== 0);
    const falls = POSTS.map((x) => walkChain(p, x).falls);
    assert.ok(falls.every((f) => f === p.bad || f === -1) && falls.filter((f) => f === p.bad).length >= POSTS.length - 1, 'at most one lucky post');
    for (let k = 1; k < 4; k++) { const r = checkSpan(p, k); assert.equal(r.ok, k === p.bad); if (!r.ok) assert.equal(r.key, 'wrong_span'); assert.ok(noJunk(r.message)); }
    assert.ok(chainAnswer(p).includes(`line ${p.bad + 1}`));
    // the repair: the right last line is a twin of the first; the wrong last line is caught by name
    assert.ok(checkBuild(p, p.A.m, p.A.k).ok);
    const again = checkBuild(p, p.lines[3].m, p.lines[3].k);
    assert.ok(!again.ok && again.key === p.key && /same as the wrong last line/.test(again.message));
  }
  assert.deepEqual([...bads].sort(), [1, 2, 3]);
});

test('zones', () => {
  assert.equal(ZONES.length, 5); ZONES.forEach((z) => assert.ok(noJunk(z.name) && noJunk(z.blurb)));
  for (let i = 0; i < 200; i++) {
    const z = [0, 1, 2, 3, 4].map((n) => genZone(rnd, n));
    assert.deepEqual(z.map((r) => r.length), [6, 3, 6, 3, 5]);
    assert.ok(z[0].every((p) => p.type === 'test') && z[0].filter((p) => p.lucky !== null).length === 2 && z[0].filter((p) => p.eq).length === 2, 'two twins, two lucky posts, two plain non-twins');
    assert.deepEqual(z[1].map((p) => p.form).sort(), ['assoc', 'collect', 'dist']);
    assert.ok(z[2].every((p) => p.type === 'build' && !p.hidden));
    assert.deepEqual(z[3].map((p) => p.slip).sort(), ['combine', 'distribute', 'reorder']);
    assert.ok(z[4].some((p) => p.hidden) && z[4].some((p) => p.type === 'chain') && z[4].filter((p) => p.form === 'sub').length === 2 && z[4].some((p) => ['dec', 'frac'].includes(p.form)));
    assert.equal(new Set(z.flat().map((p) => p.id)).size, 23, 'every round has its own id');
  }
});

console.log(`\n${passed} tests passed`);
