// Tests for Trail Mapper's math (trail.js). Run with:  node towns/topic-4-equation-valley/games/4-10-trail-mapper/test_trail_mapper_math.js
import assert from 'node:assert/strict';
import {
  seeded, near, fmt, parseNumber, run, ruleText, pair, fitGrid, snap, DIALS, ZONES, genZone,
  genStake, genFix, checkStakes, stakeAnswer, genDrop, checkDrop, dropAnswer, genRule, ruleFromDials, dialsOf, checkRule, ruleAnswer,
} from './trail.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261119);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
const KINDS = ['times', 'plus', 'line', 'minus', 'puppy'];
const onCrossing = (g, q) => q.x >= 0 && q.y >= 0 && q.x <= g.xMax && q.y <= g.yMax && near(q.x / g.xStep, Math.round(q.x / g.xStep)) && near(q.y / g.yStep, Math.round(q.y / g.yStep));

test('rules, numbers and the map grid', () => {
  assert.equal(run({ form: 'times', m: 3 }, 4), 12); assert.equal(run({ form: 'plus', b: 4 }, 3), 7); assert.equal(run({ form: 'line', m: 2, b: 3 }, 4), 11); assert.equal(run({ form: 'minus', m: 2, b: 5 }, 4), 3);
  assert.equal(ruleText({ form: 'times', m: 3 }, 't', 'd'), 'd = 3t'); assert.equal(ruleText({ form: 'plus', b: 4 }), 'y = x + 4'); assert.equal(ruleText({ form: 'line', m: 0.5, b: 1 }, 'w', 'p'), 'p = 0.5w + 1'); assert.equal(ruleText({ form: 'minus', m: 2, b: 5 }), 'y = 2x − 5');
  assert.equal(pair(2, 6), '(2, 6)'); assert.equal(fmt(1250), '1,250'); assert.equal(parseNumber('$1,250'), 1250); assert.equal(parseNumber('abc'), null);
  const g = fitGrid([{ x: 2, y: 20 }, { x: 8, y: 80 }, { x: 10, y: 0 }]); assert.deepEqual(g, { xStep: 1, yStep: 10, xMax: 10, yMax: 100 });
  assert.deepEqual(snap(g, 2.4, 33), { x: 2, y: 30 }); assert.deepEqual(snap(g, -3, 500), { x: 0, y: 100 }); assert.equal(fitGrid([{ x: 1, y: -2 }]), null);
});

test(`stakes: ${RUNS} of each kind fit the map, and the right stakes pass`, () => {
  for (let i = 0; i < RUNS; i++) {
    const kind = KINDS[i % 4], zero = i % 3 === 0 && kind !== 'minus', hidden = i % 5 === 0 && (kind === 'times' || kind === 'plus') && !zero, n = 3 + (i % 2);
    const p = genStake(rnd, kind, { n, zero, hidden });
    assert.equal(p.type, 'stake'); assert.equal(p.want.length, n); assert.equal(p.fixed.length, hidden ? 2 : 0); assert.equal(p.rows.length, n + p.fixed.length);
    for (const r of p.rows) { assert.ok(onCrossing(p.grid, r), `${ruleText(p.rule)}: ${pair(r.x, r.y)} is a crossing on the map`); assert.ok(near(r.y, run(p.rule, r.x))); }
    assert.equal(new Set(p.rows.map((r) => r.x)).size, p.rows.length); if (zero) assert.equal(p.rows[0].x, 0);
    const good = checkStakes(p, p.want.map((r) => ({ ...r }))); assert.ok(good.ok && good.hits.every(Boolean) && !good.strays.length);
    assert.ok(checkStakes(p, p.want.slice(1)).nudge, 'a missing stake only nudges'); assert.ok(noJunk(stakeAnswer(p)) && noJunk(ruleText(p.rule, p.X, p.Y)));
  }
});

test('stakes: each kind of mistake is named, and the message does not give the point away', () => {
  const p = { rule: { form: 'times', m: 5 }, grid: { xStep: 1, yStep: 5, xMax: 10, yMax: 50 }, X: 't', Y: 'd', hidden: false, fixed: [], want: [{ x: 2, y: 10 }, { x: 4, y: 20 }, { x: 6, y: 30 }] };
  const c = (pts) => checkStakes(p, pts.map(([x, y]) => ({ x, y })));
  assert.ok(c([[2, 10], [4, 20], [6, 30]]).ok);
  assert.equal(c([[10, 2], [4, 20], [6, 30]]).key, 'swapped'); assert.ok(/ACROSS/.test(c([[10, 2], [4, 20], [6, 30]]).message));
  assert.equal(c([[2, 50], [4, 20], [6, 30]]).key, 'scale');                      // 10 squares up instead of 10
  assert.equal(c([[2, 10], [4, 20], [6, 25]]).key, 'off'); assert.deepEqual(c([[2, 10], [4, 20], [6, 25]]).hits, [true, true, false]); assert.deepEqual(c([[2, 10], [4, 20], [6, 25]]).strays, [{ x: 6, y: 25 }]);
  assert.ok(/d = 5\(6\)/.test(c([[2, 10], [4, 20], [6, 25]]).message) && !/30/.test(c([[2, 10], [4, 20], [6, 25]]).message));
  assert.equal(c([[2, 10], [4, 20], [7, 35]]).key, 'off'); assert.ok(/no stake above t = 6/.test(c([[2, 10], [4, 20], [7, 35]]).message));
  const tp = { ...p, rule: { form: 'times', m: 3 }, grid: { xStep: 1, yStep: 2, xMax: 10, yMax: 20 }, want: [{ x: 2, y: 6 }, { x: 4, y: 12 }, { x: 5, y: 15 }].slice(0, 2) };
  assert.equal(checkStakes(tp, [{ x: 2, y: 6 }, { x: 4, y: 7 + 0 }].map((q) => (q.y === 7 ? { x: 4, y: 7 } : q))).key, 'times_plus');   // 4 + 3 instead of 3 × 4
  const plus = { ...p, rule: { form: 'plus', b: 4 }, grid: { xStep: 1, yStep: 1, xMax: 10, yMax: 10 }, want: [{ x: 2, y: 6 }, { x: 1, y: 5 }] };
  assert.equal(checkStakes(plus, [{ x: 2, y: 8 }, { x: 1, y: 5 }]).key, 'times_plus'); assert.ok(/ADD 4/.test(checkStakes(plus, [{ x: 2, y: 8 }, { x: 1, y: 5 }]).message));
  const line = { ...p, rule: { form: 'line', m: 2, b: 3 }, grid: { xStep: 1, yStep: 1, xMax: 10, yMax: 10 }, want: [{ x: 0, y: 3 }, { x: 2, y: 7 }] };
  assert.equal(checkStakes(line, [{ x: 0, y: 0 }, { x: 2, y: 7 }]).key, 'forgot_start'); assert.equal(checkStakes(line, [{ x: 0, y: 3 }, { x: 2, y: 4 }]).key, 'forgot_start');
  const hid = { ...p, hidden: true, fixed: [{ x: 1, y: 5 }, { x: 2, y: 10 }], want: [{ x: 4, y: 20 }, { x: 6, y: 30 }] };
  assert.ok(/two stakes you were given/.test(checkStakes(hid, [{ x: 4, y: 25 }, { x: 6, y: 30 }]).message));
});

test('fix the map: exactly one stake is wrong, and moving it fixes the map', () => {
  const traps = new Set();
  for (let i = 0; i < RUNS; i++) {
    const p = genFix(rnd, i % 2 ? 'times' : 'plus'); traps.add(p.trap);
    assert.ok(p.fix && p.preset.length === 4 && p.want.length === 4);
    const off = p.preset.filter((q) => !p.want.some((r) => r.x === q.x && r.y === q.y)); assert.equal(off.length, 1); assert.deepEqual(off[0], p.preset[p.bad]); assert.ok(onCrossing(p.grid, off[0]));
    const res = checkStakes(p, p.preset); assert.ok(!res.ok && !res.nudge && noJunk(res.message) && res.strays.length === 1);
    assert.equal(res.key, p.trap === 'swapped' ? 'swapped' : p.trap === 'times_plus' ? 'times_plus' : res.key);
    assert.ok(checkStakes(p, p.preset.map((q, k) => (k === p.bad ? { ...p.want[p.bad] } : q))).ok);
    const wrongOne = p.preset.filter((_, k) => k !== (p.bad + 1) % 4); assert.ok(!checkStakes(p, [...wrongOne, { x: p.want[(p.bad + 1) % 4].x, y: p.want[(p.bad + 1) % 4].y }]).ok, 'picking up a good stake and putting it back changes nothing');
  }
  assert.deepEqual([...traps].sort(), ['off', 'swapped', 'times_plus']);
});

test('reading the map, forward and backward', () => {
  for (let i = 0; i < RUNS; i++) {
    const backward = i % 2 === 1, rocks = i % 7 === 0, p = genDrop(rnd, KINDS[i % 2], { backward, rocks });
    assert.ok(onCrossing(p.grid, p.ask) && near(p.ask.y, run(p.rule, p.ask.x)) && !p.rows.some((r) => r.x === p.ask.x), 'the point asked for is on the trail and not already marked');
    assert.equal(p.answer, backward ? p.ask.x : p.ask.y); assert.equal(p.given, backward ? p.ask.y : p.ask.x); assert.notEqual(p.answer, p.given);
    assert.ok(checkDrop(p, p.answer).ok && noJunk(checkDrop(p, p.answer).message) && noJunk(dropAnswer(p)));
    assert.equal(checkDrop(p, p.given).key, 'wrong_axis');
    const step = backward ? p.grid.xStep : p.grid.yStep, max = backward ? p.grid.xMax : p.grid.yMax;
    for (let v = 0; v <= max + 1e-9; v += step) { if (near(v, p.answer)) continue; const res = checkDrop(p, v); assert.ok(!res.ok && noJunk(res.key) && noJunk(res.message)); }
    if (rocks) assert.ok(p.seen < p.ask.x && p.rows.filter((r) => r.x <= p.seen).length >= 2, 'two points can still be seen, and the answer is under the rocks');
  }
  const p = { rule: { form: 'times', m: 5 }, grid: { xStep: 1, yStep: 5, xMax: 10, yMax: 50 }, X: 't', Y: 'd', ask: { x: 4, y: 20 }, backward: true, given: 20, answer: 4 };
  assert.equal(checkDrop(p, 4).ok, true); assert.equal(checkDrop(p, 7).key, 'off'); assert.ok(/ACROSS to the trail, then straight DOWN/.test(checkDrop(p, 7).message));
});

test('map to rule: the dials, and each kind of wrong rule', () => {
  assert.deepEqual(ruleFromDials(3, 0), { form: 'times', m: 3, b: 0 }); assert.deepEqual(ruleFromDials(1, 4), { form: 'plus', m: 1, b: 4 }); assert.deepEqual(ruleFromDials(2, 3), { form: 'line', m: 2, b: 3 }); assert.deepEqual(ruleFromDials(2, -5), { form: 'minus', m: 2, b: 5 });
  assert.equal(ruleText(ruleFromDials(1, 0)), 'y = x');
  for (let i = 0; i < RUNS; i++) {
    const p = genRule(rnd, KINDS[i % 5]), d = dialsOf(p.rule);
    assert.ok(DIALS.m.includes(d.m) && d.b >= DIALS.b.lo && d.b <= DIALS.b.hi && Number.isInteger(d.b), `${ruleText(p.rule)} can be set on the dials`);
    assert.equal(ruleText(ruleFromDials(d.m, d.b)), ruleText(p.rule)); assert.ok(p.rows.length === 3 && p.rows.every((r) => onCrossing(p.grid, r)));
    const good = checkRule(p, d.m, d.b); assert.ok(good.ok && noJunk(good.message) && noJunk(ruleAnswer(p)));
    for (const m of DIALS.m) for (const b of [-5, -1, 0, 1, 2, 3, 4, 5, 6, 10]) { if (m === d.m && b === d.b) continue; const res = checkRule(p, m, b); assert.ok(!res.ok && noJunk(res.message) && !res.message.includes(ruleText(p.rule, p.X, p.Y)) && res.mine.form); }
    if (p.rule.form === 'times') assert.equal(checkRule(p, 1, p.rule.m).key, 'times_plus');
    if (p.rule.form === 'plus') assert.equal(checkRule(p, p.rule.b, 0).key, 'times_plus');
    assert.equal(checkRule(p, d.m, d.b + 1).key, 'forgot_start'); assert.equal(checkRule(p, DIALS.m[(DIALS.m.indexOf(d.m) + 2) % DIALS.m.length], d.b).key, 'steep');
  }
});

test('zones', () => {
  assert.equal(ZONES.length, 5);
  for (let i = 0; i < 300; i++) {
    const z = [0, 1, 2, 3, 4].map((k) => genZone(rnd, k));
    assert.ok(z[0].length === 4 && z[0].every((r) => r.type === 'stake' && !r.fix && !r.hidden) && z[0][2].rows[0].x === 0);
    assert.ok(z[1].length === 6 && z[1].every((r) => r.type === 'drop')); assert.deepEqual(z[1].map((r) => r.backward), [false, false, false, true, true, true]);
    assert.ok(z[2].length === 5 && z[2].every((r) => r.type === 'rule') && z[2][4].rule.form === 'line');
    assert.ok(z[3].length === 4 && z[3].every((r) => r.fix));
    assert.deepEqual(z[4].map((r) => r.type), ['stake', 'stake', 'rule', 'drop', 'rule']); assert.ok(z[4][0].rule.form === 'line' && z[4][0].rows[0].x === 0 && z[4][1].hidden && z[4][3].rocks && z[4][3].backward && z[4][4].rule.m === 0.5);
  }
});

console.log(`\n${passed} tests passed`);
