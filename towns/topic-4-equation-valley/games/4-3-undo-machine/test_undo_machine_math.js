// Tests for Undo Machine (undo.js). Run with:  node towns/topic-4-equation-valley/games/4-3-undo-machine/test_undo_machine_math.js
import assert from 'node:assert/strict';
import { seeded, genRun, genTwo, genMystery, eqText, startOf, pushesOf, landOf, checkLine, checkRun, genStory, checkBuild, ZONES, genZone } from './undo.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261122);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
const KINDS = ['start_plus', 'start_minus', 'push_plus', 'push_minus'];

test('an equation is one run of the cart', () => {
  const sp = { kind: 'start_plus', unknown: 'start', letter: 'x', a: 7, c: 23, x: 16 };
  assert.equal(eqText(sp), 'x + 7 = 23'); assert.equal(eqText({ ...sp, flipped: true }), '23 = x + 7'); assert.equal(eqText(sp, 16), '16 + 7 = 23');
  assert.equal(startOf(sp, 16), 16); assert.deepEqual(pushesOf(sp, 16), [7]); assert.equal(landOf(sp, 16), 23);
  assert.equal(checkLine(sp, 16), '16 + 7 = 23 ✓'); assert.equal(checkLine(sp, 30), '30 + 7 = 37, not 23');
  const pm = { kind: 'push_minus', unknown: 'push', letter: 'k', s: 30, c: 12, x: 18 };
  assert.equal(eqText(pm), '30 − k = 12'); assert.equal(startOf(pm, 18), 30); assert.deepEqual(pushesOf(pm, 18), [-18]); assert.equal(landOf(pm, 18), 12);
  assert.equal(eqText({ kind: 'two', letter: 'n', a: 3, b: 4, c: 20 }), 'n + 3 + 4 = 20');
});

test(`runs: ${RUNS} of each kind fit the track and have one answer`, () => {
  for (let i = 0; i < RUNS; i++) {
    for (const kind of KINDS) {
      const max = [30, 40, 60, 100][i % 4], r = genRun(rnd, kind, { max, flipped: i % 3 === 0 });
      assert.equal(landOf(r, r.x), r.c, eqText(r)); assert.equal(checkRun(r, r.x).ok, true);
      assert.ok(r.axis.lo === 0 && r.axis.hi >= max && r.axis.hi % 10 === 0);
      for (const v of [r.x, r.c, startOf(r, r.x)]) assert.ok(v >= 0 && v <= r.axis.hi, `${eqText(r)}: ${v} is on the track`);
      assert.ok(r.x >= 3 && noJunk(eqText(r)) && (r.unknown === 'start') === kind.startsWith('start'));
      let answers = 0; for (let v = 0; v <= r.axis.hi; v++) if (checkRun(r, v).ok) answers++;
      assert.equal(answers, 1, `${eqText(r)} has exactly one answer on the track`);
    }
  }
});

test('what a wrong run means', () => {
  const sp = { kind: 'start_plus', unknown: 'start', letter: 'x', a: 7, c: 23, x: 16 };
  assert.equal(checkRun(sp, 30).key, 'did_not_undo'); assert.ok(/30 \+ 7 = 37, not 23\. The machine ADDS 7.*BEFORE the flag: 23 − 7/.test(checkRun(sp, 30).message));
  assert.equal(checkRun(sp, 23).key, 'started_on_flag'); assert.equal(checkRun(sp, 7).key, 'used_the_number');
  assert.equal(checkRun(sp, 14).key, 'off'); assert.ok(checkRun(sp, 14).message.endsWith('The cart stopped 2 SHORT of the flag.')); assert.ok(checkRun(sp, 19).message.endsWith('3 PAST the flag.'));
  const sm = { kind: 'start_minus', unknown: 'start', letter: 'x', a: 5, c: 12, x: 17 };
  assert.equal(checkRun(sm, 7).key, 'did_not_undo'); assert.ok(/PAST the flag: 12 \+ 5/.test(checkRun(sm, 7).message));
  assert.ok(checkRun(sm, 20).message.endsWith('3 SHORT of the flag.'), 'going backward, stopping at 15 is short of 12'); assert.ok(checkRun(sm, 15).message.endsWith('2 PAST the flag.'));
  const pp = { kind: 'push_plus', unknown: 'push', letter: 'c', s: 9, c: 23, x: 14 };
  assert.equal(checkRun(pp, 23).key, 'used_total'); assert.equal(checkRun(pp, 32).key, 'did_not_undo'); assert.equal(checkRun(pp, 10).key, 'off');
  const two = { kind: 'two', unknown: 'start', letter: 'n', a: 3, b: 4, c: 20, x: 13 };
  assert.equal(checkRun(two, 17).key, 'combine'); assert.equal(checkRun(two, 16).key, 'combine'); assert.equal(checkRun(two, 13).ok, true); assert.equal(checkLine(two, 13), '13 + 3 + 4 = 20 ✓');
  for (let i = 0; i < RUNS; i++) {
    const r = i % 5 === 4 ? genTwo(rnd) : genRun(rnd, KINDS[i % 4]);
    for (const v of [r.x + 1, r.x - 2, r.c, r.x + 9]) { if (v < 0 || v === r.x) continue; const res = checkRun(r, v); assert.ok(!res.ok && noJunk(res.key) && noJunk(res.message) && res.land === landOf(r, v), `${eqText(r)} with ${v}`); }
  }
});

test('mystery machine: test carts show the hidden push', () => {
  for (let i = 0; i < RUNS; i++) {
    const m = genMystery(rnd);
    assert.ok(m.tests === 2 && m.x >= 0 && m.x <= m.axis.hi && m.c >= 0 && m.c <= m.axis.hi && Math.abs(m.push) >= 3);
    assert.equal(landOf(m, 20) - 20, m.push, 'any test cart shows the push'); assert.equal(checkRun(m, m.x).ok, true);
    const res = checkRun(m, m.x + 1); assert.equal(res.key, 'mystery'); assert.ok(res.message.includes(`The cart went from ${m.x + 1} to ${m.c + 1}`) && /adds|takes away/.test(res.message));
    assert.equal(eqText(m), `x ? ? = ${m.c}`);
  }
});

test('write it: any true way of writing the story counts', () => {
  for (let i = 0; i < RUNS; i++) {
    const kind = KINDS[i % 4], p = genStory(rnd, kind), r = p.run;
    assert.ok(noJunk(p.story) && p.tiles.length === 3 && new Set(p.tiles.map((t) => t.text)).size === 3 && p.story.includes(String(r.c)) && r.story);
    const ways = kind === 'start_plus' ? [['L', '+', 'p', 'q'], ['p', '+', 'L', 'q'], ['q', '-', 'p', 'L'], ['q', '-', 'L', 'p']]
      : kind === 'start_minus' ? [['L', '-', 'p', 'q'], ['L', '-', 'q', 'p'], ['q', '+', 'p', 'L'], ['p', '+', 'q', 'L']]
        : kind === 'push_plus' ? [['p', '+', 'L', 'q'], ['L', '+', 'p', 'q'], ['q', '-', 'p', 'L'], ['q', '-', 'L', 'p']]
          : [['p', '-', 'L', 'q'], ['p', '-', 'q', 'L'], ['q', '+', 'L', 'p'], ['L', '+', 'q', 'p']];
    for (const w of ways) assert.equal(checkBuild(p, ...w).correct, true, `${p.story} <- ${w.join(' ')}`);
    const wrong = kind.endsWith('plus') ? ['L', '-', 'p', 'q'] : ['L', '+', 'p', 'q'];
    assert.equal(checkBuild(p, ...wrong).key, 'story_order'); assert.equal(checkBuild(p, 'L', null, 'p', 'q').nudge, true);
    assert.equal(checkRun(r, r.x).ok, true);
  }
});

test('zones', () => {
  assert.equal(ZONES.length, 5);
  for (let i = 0; i < 300; i++) {
    const z = [0, 1, 2, 3, 4].map((k) => genZone(rnd, k));
    assert.ok(z[0].length === 5 && z[0].every((r) => r.unknown === 'start' && !r.fuse)); assert.ok(z[1].length === 5 && z[1].every((r) => r.unknown === 'push'));
    assert.ok(z[2].length === 6 && z[2].every((r) => r.fuse > 0) && z[2].some((r) => r.flipped) && z[2].some((r) => r.axis.hi === 100));
    assert.deepEqual(z[3].map((r) => r.type), ['build', 'run', 'build', 'run', 'build', 'run']); assert.equal(z[3][1].id, z[3][0].run.id, 'the story is followed by its own run');
    assert.deepEqual(z[4].map((r) => r.kind), ['two', 'mystery', z[4][2].kind, 'two', 'mystery']); assert.ok(z[4][2].flipped && z[4][2].axis.hi === 100);
  }
});

console.log(`\n${passed} tests passed`);
