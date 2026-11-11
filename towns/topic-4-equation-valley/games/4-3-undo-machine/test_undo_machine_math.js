// Tests for Undo Machine's math (undo.js). Run with:  node towns/topic-4-equation-valley/games/4-3-undo-machine/test_undo_machine_math.js
import assert from 'node:assert/strict';
import {
  seeded, fmt, parseNumber, makeEq, exprText, eqText, runForward, combined, undoStep, readTiles, tilesText,
  genUndo, genMoney, genStory, genTaken, genMulti, genSortRound, genZone, genBackup, ZONES,
  checkWritten, checkUndo, checkLine, checkCombine, checkTaken, checkSort, workedSolution,
} from './undo.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 3000;
const rnd = seeded(20261111);
const near = (a, b) => Math.abs(a - b) < 0.005;
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
// Turns "n + 7 = 25" into a checker: does value v make it true?
const truth = (text, letter, v) => {
  const [l, r] = text.replace(/−/g, '-').split('=').map((side) => side.replace(new RegExp(`\\b${letter}\\b`, 'g'), `(${v})`));
  return near(Function(`return ${l}`)(), Function(`return ${r}`)());
};
// Tiles for an equation text, as the student would place them
const tilesOf = (text, letter) => text.replace(/−/g, '-').split(/\s+/).map((w) => (w === '=' ? { t: 'eq' } : w === '+' || w === '-' ? { t: 'op', v: w } : w === letter ? { t: 'var', v: w } : { t: 'num', v: Number(w) }));

test('typed amounts: many formats, junk refused', () => {
  for (const [raw, v] of [['18', 18], ['18.0', 18], ['$5.25', 5.25], [' 5.250 ', 5.25], ['+7', 7], ['.75', 0.75], ['1,250', 1250], ['$7', 7]]) assert.equal(parseNumber(raw), v, raw);
  for (const raw of ['', 'abc', '-3', '5.257', '1.2.3', '$', 'x']) assert.equal(parseNumber(raw), null, raw);
  assert.equal(fmt(7), '7'); assert.equal(fmt(1.75), '1.75'); assert.equal(fmt(2.5), '2.50');
});

test('equation text matches the math for every kind', () => {
  const cases = [
    [makeEq({ kind: 'plus', letter: 'n', a: 7, c: 25 }), 'n + 7 = 25', 18],
    [makeEq({ kind: 'plus', letter: 'a', a: 13, c: 22, flipped: true, letterFirst: false }), '22 = 13 + a', 9],
    [makeEq({ kind: 'minus', letter: 'y', a: 19, c: 34 }), 'y − 19 = 34', 53],
    [makeEq({ kind: 'minus', letter: 's', a: 19, c: 32, flipped: true }), '32 = s − 19', 51],
    [makeEq({ kind: 'taken', letter: 'g', a: 44, c: 38 }), '44 − g = 38', 6],
    [makeEq({ kind: 'multi', letter: 'd', a: 143, b: 295, c: 826 }), '143 + 295 + d = 826', 388],
    [makeEq({ kind: 'plus', letter: 's', a: 1.75, c: 7, flipped: true, money: true }), '7 = s + 1.75', 5.25],
  ];
  for (const [eq, text, x] of cases) {
    assert.equal(eqText(eq), text);
    assert.equal(eq.x, x, text);
    assert.ok(truth(text, eq.letter, x), `${x} makes ${text} true`);
    assert.ok(near(runForward(eq, x), eq.c));
  }
  assert.equal(eqText(combined(cases[5][0])), '438 + d = 826');
  assert.deepEqual(undoStep(cases[0][0]), { op: '-', n: 7 });
  assert.deepEqual(undoStep(cases[2][0]), { op: '+', n: 19 });
});

test(`undo problems: ${RUNS} generated; whole numbers, positive, text always true for the answer`, () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genUndo(rnd, { flipped: i % 2 === 0, big: i % 3 === 0 });
    const { eq } = p;
    assert.ok(eq.x > 0 && eq.c > 0 && eq.a > 0 && Number.isInteger(eq.x) && Number.isInteger(eq.c));
    assert.ok(truth(eqText(eq), eq.letter, eq.x), eqText(eq));
    assert.ok(!truth(eqText(eq), eq.letter, eq.x + 1), 'only one answer');
    const s = undoStep(eq);
    assert.ok(checkUndo(eq, s.op, s.n).correct, 'the opposite step solves it');
  }
});

test('undo: the right block works; each common mistake gets its own hint', () => {
  const eq = makeEq({ kind: 'plus', letter: 'n', a: 12, c: 16 });
  const good = checkUndo(eq, '-', 12);
  assert.ok(good.correct && good.value === 4 && good.back === 16);
  assert.match(good.message, /n = 4\. Check: 4 \+ 12 = 16 ✓/);
  const again = checkUndo(eq, '+', 12);
  assert.ok(!again.correct && again.key === 'did_not_undo' && again.value === 28);
  assert.match(again.message, /28 \+ 12 = 40, not 16/, 'shows the failed check');
  assert.equal(checkUndo(eq, '-', 16).key, 'used_total');
  assert.equal(checkUndo(eq, '-', 5).key, 'wrong_amount');
  assert.equal(checkUndo(eq, '+', 5).key, 'wrong_op');
  const m = makeEq({ kind: 'minus', letter: 't', a: 40, c: 3 });
  assert.ok(checkUndo(m, '+', 40).correct && checkUndo(m, '+', 40).value === 43);
  assert.equal(checkUndo(m, '-', 40).key, 'did_not_undo');
  const f = makeEq({ kind: 'minus', letter: 's', a: 19, c: 32, flipped: true });
  assert.equal(checkLine(f, 51), '32 = 51 − 19');
  const money = makeEq({ kind: 'plus', letter: 's', a: 1.75, c: 7, flipped: true, money: true });
  assert.ok(checkUndo(money, '-', 1.75).correct && checkUndo(money, '-', 1.75).value === 5.25, 'money works to the cent');
  assert.equal(checkUndo(money, '+', 1.75).key, 'did_not_undo');
  for (const r of [good, again, checkUndo(eq, '-', 16), checkUndo(m, '-', 40)]) assert.ok(noJunk(r.message));
});

test(`money problems: ${RUNS} generated; quarters only, answers come out to the cent`, () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genMoney(rnd, { story: i % 2 === 0 });
    const { eq } = p;
    assert.ok(near((eq.a * 4) % 1, 0) && near((eq.x * 4) % 1, 0), 'quarters');
    assert.ok(eq.flipped && eq.money && eq.x >= 2);
    assert.ok(checkUndo(eq, '-', eq.a).correct);
    assert.ok(truth(eqText(eq), eq.letter, eq.x));
    if (p.story) assert.ok(p.story.includes(`$${fmt(eq.c)}`) && p.story.includes(`$${fmt(eq.a)}`));
  }
});

test('reading tiles: equations, order and broken rows', () => {
  const r = readTiles(tilesOf('n + 7 = 25', 'n'));
  assert.ok(r.ok && r.value === 18 && !r.letterAlone);
  assert.equal(readTiles(tilesOf('25 = 7 + n', 'n')).value, 18);
  assert.equal(readTiles(tilesOf('44 - g = 38', 'g')).value, 6);
  assert.ok(readTiles(tilesOf('44 - g = 38', 'g')).numMinusVar);
  assert.ok(readTiles(tilesOf('25 - 7 = n', 'n')).letterAlone);
  assert.equal(readTiles(tilesOf('143 + 295 + d = 826', 'd')).value, 388);
  for (const bad of ['n + 7', 'n + = 25', '= 25', 'n + 7 = 25 = 3', '7 + 25 = 32']) assert.equal(readTiles(tilesOf(bad, 'n')).ok, false, bad);
  assert.equal(tilesText(tilesOf('y - 19 = 34', 'y')), 'y − 19 = 34');
});

test('writing from a story: right forms accepted, traps caught', () => {
  const add = genStory(seeded(5), { kind: 'plus', fewer: false });
  const L = add.eq.letter, a = fmt(add.eq.a), c = fmt(add.eq.c);
  const forms = add.eq.letterFirst ? [`${L} + ${a} = ${c}`, `${a} + ${L} = ${c}`, `${c} = ${L} + ${a}`] : [`${a} + ${L} = ${c}`, `${L} + ${a} = ${c}`];
  for (const f of forms) assert.ok(checkWritten(add, tilesOf(f, L)).correct, f);
  const solved = checkWritten(add, tilesOf(`${L} = ${c} - ${a}`, L));
  assert.ok(solved.nudge && solved.key === 'pre_solved', 'already-solved form is a reminder, not a miss');
  assert.equal(checkWritten(add, tilesOf(`${L} - ${a} = ${c}`, L)).key, 'wrong_op');
  assert.equal(checkWritten(add, tilesOf(`${L} + ${c} = ${a}`, L)).key, 'wrong_numbers');
  assert.ok(checkWritten(add, tilesOf(`${L} +`, L)).nudge, 'unfinished row is a reminder');

  const few = genStory(seeded(9), { kind: 'minus', fewer: true });
  const F = few.eq.letter, fa = fmt(few.eq.a), fc = fmt(few.eq.c);
  assert.ok(checkWritten(few, tilesOf(`${F} - ${fa} = ${fc}`, F)).correct);
  const trap = checkWritten(few, tilesOf(`${fc} - ${fa} = ${F}`, F));
  assert.equal(trap.key, 'fewer_trap', '"14 fewer" written as 60 − 14 = p is caught');
  assert.ok(trap.message.includes(`${F} − ${fa} = ${fc}`));
  assert.equal(checkWritten(few, tilesOf(`${fa} - ${F} = ${fc}`, F)).key, 'fewer_trap');

  const lost = genStory(seeded(3), { kind: 'minus', fewer: false });
  const T = lost.eq.letter;
  assert.equal(checkWritten(lost, tilesOf(`${fmt(lost.eq.a)} - ${T} = ${fmt(lost.eq.c)}`, T)).key, 'order');
  assert.equal(checkWritten(lost, tilesOf(`${T} + ${fmt(lost.eq.a)} = ${fmt(lost.eq.c)}`, T)).key, 'wrong_op');

  const tk = genTaken(seeded(4));
  const G = tk.eq.letter;
  assert.ok(checkWritten(tk, tilesOf(`${fmt(tk.eq.a)} - ${G} = ${fmt(tk.eq.c)}`, G)).correct);
  assert.equal(checkWritten(tk, tilesOf(`${G} - ${fmt(tk.eq.a)} = ${fmt(tk.eq.c)}`, G)).key, 'order');
  assert.ok(checkWritten(tk, tilesOf(`${fmt(tk.eq.a)} - ${fmt(tk.eq.c)} = ${G}`, G)).nudge, 'already solved: reminder');

  const mu = genMulti(seeded(6));
  const D = mu.eq.letter;
  assert.ok(checkWritten(mu, tilesOf(`${fmt(mu.eq.a)} + ${fmt(mu.eq.b)} + ${D} = ${fmt(mu.eq.c)}`, D)).correct);
  assert.ok(checkWritten(mu, tilesOf(`${D} + ${fmt(mu.eq.b)} + ${fmt(mu.eq.a)} = ${fmt(mu.eq.c)}`, D)).correct, 'any order of the parts');
  assert.equal(checkWritten(mu, tilesOf(`${fmt(mu.eq.a)} + ${fmt(mu.eq.b)} - ${D} = ${fmt(mu.eq.c)}`, D)).key, 'wrong_op');
});

test(`stories: ${RUNS} generated; the story numbers are the tiles, and the intended equation is accepted`, () => {
  for (let i = 0; i < RUNS; i++) {
    const p = [genStory(rnd), genTaken(rnd), genMulti(rnd), genMoney(rnd, { story: true })][i % 4];
    const { eq } = p;
    assert.ok(noJunk(p.story) && noJunk(p.cue));
    for (const v of p.tiles) assert.ok(p.story.includes(fmt(v)), `tile ${v} is in the story`);
    assert.ok(eq.x > 0 && eq.c > 0, 'no zero or negative answers');
    assert.ok(checkWritten(p, tilesOf(eqText(eq), eq.letter)).correct, eqText(eq));
    assert.ok(p.story.includes(`${eq.letter}`), 'story names the letter');
  }
});

test('boss: combine first, and the taken-away twist', () => {
  const eq = makeEq({ kind: 'multi', letter: 'd', a: 143, b: 295, c: 826 });
  assert.ok(checkCombine(eq, '438').correct);
  assert.equal(checkCombine(eq, '388').key, 'skipped_combine');
  assert.equal(checkCombine(eq, '428').key, 'combine_error');
  assert.ok(checkCombine(eq, 'zz').nudge);
  assert.ok(checkUndo(combined(eq), '-', 438).correct && checkUndo(combined(eq), '-', 438).value === 388);
  const t = makeEq({ kind: 'taken', letter: 'g', a: 44, c: 38 });
  assert.ok(checkTaken(t, '6').correct && checkTaken(t, '$6.00').correct);
  const add = checkTaken(t, '82');
  assert.equal(add.key, 'added_both');
  assert.match(add.message, /44 − 82 = -38, not 38|44 − 82 = −38, not 38/);
  assert.equal(checkTaken(t, '38').key, 'copied_number');
  assert.equal(checkTaken(t, '7').key, 'check_fails');
});

test(`sorting chute: ${RUNS / 10} rounds; 3 matches and 3 traps, every crate labelled honestly`, () => {
  for (let i = 0; i < RUNS / 10; i++) {
    const round = genSortRound(rnd);
    assert.equal(round.length, 6);
    assert.equal(round.filter((c) => c.match).length, 3);
    for (const cr of round) {
      assert.equal(near(cr.eq.x, cr.target.x), cr.match, `${eqText(cr.eq)} vs ${eqText(cr.target)}`);
      assert.ok(cr.eq.c > 0 && cr.eq.x > 0);
      assert.ok(checkSort(cr, cr.match).correct && !checkSort(cr, !cr.match).correct);
      assert.ok(noJunk(checkSort(cr, !cr.match).message));
    }
    const same = round.find((c) => c.trap === 'same_numbers');
    assert.equal(checkSort(same, true).key, 'same_numbers');
  }
});

test('zones: 5 zones, right problem kinds, worked solutions and backups for everything', () => {
  assert.equal(ZONES.length, 5);
  for (let r = 0; r < 200; r++) {
    const zones = ZONES.map((_, z) => genZone(rnd, z));
    assert.ok(zones[0].every((p) => p.type === 'undo' && !p.eq.flipped));
    assert.ok(zones[1].every((p) => p.type === 'story') && zones[1].some((p) => p.fewer));
    assert.ok(zones[2].every((p) => p.eq.flipped) && zones[2].filter((p) => p.eq.money).length === 2);
    assert.ok(zones[3].every((p) => p.type === 'sort'));
    assert.deepEqual(new Set(zones[4].map((p) => p.type)), new Set(['multi', 'story', 'taken']));
    for (const p of zones.flat()) {
      const lines = workedSolution(p);
      assert.ok(lines.length >= 3 && lines.every(noJunk), `worked solution for ${p.type}`);
      if (p.type !== 'sort') {
        const b = genBackup(rnd, p);
        assert.equal(b.type, p.type, 'backup is the same type');
        assert.equal(Boolean(b.eq.money), Boolean(p.eq.money));
        assert.ok(lines.at(-1).includes('✓'), 'worked solution ends with the check');
      }
    }
  }
  const w = workedSolution({ type: 'undo', eq: makeEq({ kind: 'plus', letter: 'n', a: 7, c: 25 }) });
  assert.deepEqual(w, ['Undo + 7 with − 7 on both sides: n + 7 − 7 = 25 − 7', 'n = 18', 'Check: 18 + 7 = 25 ✓']);
});

console.log(`\n${passed} tests passed`);
