// Tests for Gear Shift (gears.js). Run with:  node towns/topic-4-equation-valley/games/4-4-gear-shift/test_gear_shift_math.js
import assert from 'node:assert/strict';
import { seeded, DIAL, genTrip, genOffset, genMystery, eqText, tripOf, landOf, checkLine, checkTrip, genStory, checkBuild, ZONES, genZone } from './gears.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261123);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
const KINDS = ['gear', 'flag', 'turns'];
/** Every number the student could set for this trip. */
function choices(r) {
  const d = r.unknown === 'flag' ? r.axis : DIAL[r.unknown], out = [];
  for (let v = d.lo; v <= d.hi; v++) out.push(v);
  return out;
}

test('an equation is one trip of the gear', () => {
  const gear = { kind: 'gear', unknown: 'size', letter: 'x', k: 4, c: 36, x: 9 };
  assert.equal(eqText(gear), '4x = 36'); assert.equal(eqText({ ...gear, flipped: true }), '36 = 4x'); assert.equal(eqText(gear, 9), '4 × 9 = 36');
  assert.deepEqual(tripOf(gear, 9), { start: 0, size: 9, turns: 4, flag: 36 }); assert.equal(landOf(gear, 9), 36);
  assert.equal(checkLine(gear, 9), '4 × 9 = 36 ✓'); assert.equal(checkLine(gear, 8), '4 × 8 = 32, not 36');
  const flag = { kind: 'flag', unknown: 'flag', letter: 'r', k: 5, c: 7, x: 35 };
  assert.equal(eqText(flag), 'r ÷ 5 = 7'); assert.deepEqual(tripOf(flag, 35), { start: 0, size: 7, turns: 5, flag: 35 }); assert.equal(checkLine(flag, 30), '5 × 7 = 35, not 30');
  const turns = { kind: 'turns', unknown: 'turns', letter: 't', s: 9, c: 63, x: 7 };
  assert.equal(eqText(turns), '9t = 63'); assert.deepEqual(tripOf(turns, 7), { start: 0, size: 9, turns: 7, flag: 63 });
  const off = { kind: 'offset', unknown: 'size', letter: 'n', k: 3, b: 5, c: 26, x: 7 };
  assert.equal(eqText(off), '3n + 5 = 26'); assert.equal(landOf(off, 7), 26); assert.equal(checkLine(off, 7), '3 × 7 + 5 = 26 ✓');
});

test(`trips: ${RUNS} of each kind fit the track and the dials, with one answer`, () => {
  for (let i = 0; i < RUNS; i++) {
    for (const kind of [...KINDS, 'offset']) {
      const max = [40, 60, 100][i % 3], r = kind === 'offset' ? genOffset(rnd) : genTrip(rnd, kind, { max, flipped: i % 3 === 0 });
      assert.equal(checkTrip(r, r.x).ok, true, eqText(r)); assert.ok(noJunk(eqText(r)) && r.axis.hi % 10 === 0);
      const t = tripOf(r, r.x); assert.ok(t.flag <= r.axis.hi && t.start + t.size * t.turns === t.flag);
      const all = choices(r); assert.ok(all.includes(r.x), `${eqText(r)}: ${r.x} can be set`);
      assert.equal(all.filter((v) => checkTrip(r, v).ok).length, 1, `${eqText(r)} has exactly one answer`);
      if (kind !== 'offset') assert.notEqual(r.kind === 'turns' ? r.s : r.k, r.kind === 'flag' ? r.c : r.x, 'the two factors differ');
    }
  }
});

test('what a wrong trip means', () => {
  const gear = { kind: 'gear', unknown: 'size', letter: 'x', k: 4, c: 36, x: 9 };
  assert.equal(checkTrip(gear, 32).key, 'add_vs_times'); assert.ok(/4x means 4 TIMES x/.test(checkTrip(gear, 32).message));
  assert.equal(checkTrip(gear, 4).key, 'used_the_number'); assert.equal(checkTrip(gear, 8).key, 'off'); assert.ok(checkTrip(gear, 8).message.endsWith('The gear stopped 4 SHORT of the flag.')); assert.ok(checkTrip(gear, 10).message.endsWith('4 PAST the flag.'));
  const flag = { kind: 'flag', unknown: 'flag', letter: 'r', k: 5, c: 10, x: 50 };
  assert.equal(checkTrip(flag, 10).key, 'one_turn'); assert.equal(checkTrip(flag, 15).key, 'add_vs_times'); assert.equal(checkTrip(flag, 2).key, 'did_not_undo'); assert.ok(/undo it by multiplying: 10 × 5/.test(checkTrip(flag, 2).message));
  assert.ok(checkTrip(flag, 45).message.endsWith('The gear stopped 5 PAST the flag.'));
  const turns = { kind: 'turns', unknown: 'turns', letter: 't', s: 9, c: 63, x: 7 };
  assert.equal(checkTrip(turns, 9).key, 'used_the_number'); assert.ok(checkTrip(turns, 5).message.endsWith('18 SHORT of the flag (2 turns).'));
  const off = { kind: 'offset', unknown: 'size', letter: 'n', k: 3, b: 6, c: 27, x: 7 };
  assert.equal(checkTrip(off, 9).key, 'forgot_start'); assert.ok(/starts at 6, not at 0.*27 − 6 = 21/.test(checkTrip(off, 9).message));
  for (let i = 0; i < RUNS; i++) {
    const r = i % 4 === 3 ? genOffset(rnd) : genTrip(rnd, KINDS[i % 3]);
    for (const v of choices(r)) { if (v === r.x) continue; const res = checkTrip(r, v); assert.ok(!res.ok && noJunk(res.key) && noJunk(res.message) && res.land === landOf(r, v), `${eqText(r)} with ${v}`); }
  }
});

test('mystery gear: one test turn shows its size', () => {
  for (let i = 0; i < RUNS; i++) {
    const m = genMystery(rnd);
    assert.ok(m.tests === 1 && m.x === m.g * m.n && m.x <= m.axis.hi && m.unknown === 'flag');
    assert.equal(tripOf(m, 0).size, m.g, 'one turn moves the hidden size'); assert.equal(checkTrip(m, m.x).ok, true);
    assert.equal(checkTrip(m, m.g).key, 'one_turn'); assert.equal(checkTrip(m, m.x + 1).key, 'off'); assert.equal(eqText(m), `x ÷ ${m.n} = ?`);
    assert.equal(choices(m).filter((v) => checkTrip(m, v).ok).length, 1);
  }
});

test('write it: any true way of writing the story counts', () => {
  for (let i = 0; i < RUNS; i++) {
    const kind = KINDS[i % 3], p = genStory(rnd, kind), r = p.trip;
    assert.ok(noJunk(p.story) && p.tiles.length === 3 && new Set(p.tiles.map((t) => t.text)).size === 3 && r.story);
    const ways = kind === 'flag' ? [['L', '÷', 'p', 'q'], ['L', '÷', 'q', 'p'], ['p', '×', 'q', 'L'], ['q', '×', 'p', 'L']]
      : [['p', '×', 'L', 'q'], ['L', '×', 'p', 'q'], ['q', '÷', 'p', 'L'], ['q', '÷', 'L', 'p']];
    for (const w of ways) assert.equal(checkBuild(p, ...w).correct, true, `${p.story} <- ${w.join(' ')}`);
    const wrong = kind === 'flag' ? ['L', '×', 'p', 'q'] : ['L', '÷', 'p', 'q'];
    assert.equal(checkBuild(p, ...wrong).key, 'story_order'); assert.equal(checkBuild(p, 'L', null, 'p', 'q').nudge, true);
    assert.equal(checkTrip(r, r.x).ok, true);
  }
});

test('zones', () => {
  assert.equal(ZONES.length, 5);
  for (let i = 0; i < 300; i++) {
    const z = [0, 1, 2, 3, 4].map((k) => genZone(rnd, k));
    assert.ok(z[0].length === 5 && z[0].every((r) => r.kind === 'gear' && !r.fuse)); assert.ok(z[1].length === 5 && z[1].every((r) => r.kind === 'flag'));
    assert.ok(z[2].length === 6 && z[2].slice(0, 3).every((r) => r.kind === 'turns' && !r.fuse) && z[2].slice(3).every((r) => r.fuse > 0) && z[2].some((r) => r.flipped));
    assert.deepEqual(z[3].map((r) => r.type), ['build', 'trip', 'build', 'trip', 'build', 'trip']); assert.equal(z[3][1].id, z[3][0].trip.id, 'the story is followed by its own trip');
    assert.deepEqual(z[4].map((r) => r.kind), ['offset', 'mystery', z[4][2].kind, 'offset', 'mystery']); assert.ok(z[4][2].flipped);
  }
});

console.log(`\n${passed} tests passed`);
