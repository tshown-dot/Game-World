// Undo Machine (Lesson 4-3: Write and Solve Addition and Subtraction Equations): the math.
// No screen code here, so it can be tested with plain node (see test_undo_machine_math.js).
//
// The idea: a machine takes a hidden crate (the letter), does one step (like + 7) and pushes out a number (25).
// The equation is the machine: n + 7 = 25. To find n, run the machine backwards with the inverse step (− 7).
//
// Equation kinds (eq.kind):
//   plus    x + a = c   (or a + x = c)          x = c − a
//   minus   x − a = c                           x = c + a
//   taken   a − x = c   (the letter is taken)   x = a − c      (boss twist)
//   multi   a + b + x = c                       combine a + b first, then undo   (boss)
// eq.flipped puts the total on the left: 22 = 13 + a.

export const OP_SIGN = { '+': '+', '-': '−' };     // − is the real minus sign, for display
const near = (a, b) => Math.abs(a - b) < 0.005;
const round2 = (v) => Math.round(v * 100) / 100;

/** Repeatable random numbers for tests (mulberry32). */
export function seeded(seed = 1) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];
const shuffle = (rnd, list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
let nextId = 1;

/** 25 -> "25", 1.75 -> "1.75", 2.5 -> "2.50" (money keeps two places). */
export function fmt(v) {
  const r = round2(v);
  if (r < 0) return `−${fmt(-r)}`;                   // a real minus sign, like the rest of the game
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

/** A typed amount: "18", "18.0", "$5.25", " 5.250 ", "+7". Returns the number or null. */
export function parseNumber(raw) {
  const t = String(raw ?? '').trim().replace(/^\$/, '').replace(/^\+/, '').replace(/,/g, '');
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n > 99999) return null;
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return null;   // more than cents: not a game amount
  return round2(n);
}

/* ================================================================== */
/* Equations                                                           */
/* ================================================================== */
export function makeEq({ kind, letter = 'x', a, b = 0, c, flipped = false, letterFirst = true, money = false }) {
  const x = kind === 'plus' ? c - a : kind === 'minus' ? c + a : kind === 'taken' ? a - c : c - a - b;
  return { kind, letter, a: round2(a), b: round2(b), c: round2(c), x: round2(x), flipped, letterFirst, money };
}
/** The machine side: "n + 7", "13 + a", "44 − g", "143 + 295 + d". */
export function exprText(eq) {
  const { kind, letter: L, a, b } = eq;
  if (kind === 'plus') return eq.letterFirst ? `${L} + ${fmt(a)}` : `${fmt(a)} + ${L}`;
  if (kind === 'minus') return `${L} − ${fmt(a)}`;
  if (kind === 'taken') return `${fmt(a)} − ${L}`;
  return `${fmt(a)} + ${fmt(b)} + ${L}`;
}
export const eqText = (eq) => (eq.flipped ? `${fmt(eq.c)} = ${exprText(eq)}` : `${exprText(eq)} = ${fmt(eq.c)}`);
/** What the machine pushes out when value v goes in. */
export function runForward(eq, v) {
  if (eq.kind === 'plus') return round2(v + eq.a);
  if (eq.kind === 'minus') return round2(v - eq.a);
  if (eq.kind === 'taken') return round2(eq.a - v);
  return round2(eq.a + eq.b + v);
}
/** After combining: 143 + 295 + d = 826 becomes 438 + d = 826. */
export function combined(eq) {
  return makeEq({ kind: 'plus', letter: eq.letter, a: eq.a + eq.b, c: eq.c, flipped: eq.flipped, letterFirst: false, money: eq.money });
}
/** The step that undoes the machine: plus -> ['-', a], minus -> ['+', a]. */
export function undoStep(eq) {
  if (eq.kind === 'plus') return { op: '-', n: eq.a };
  if (eq.kind === 'minus') return { op: '+', n: eq.a };
  return null;
}

/* ================================================================== */
/* Stories (from the kinds of problems in the textbook lesson)         */
/* ================================================================== */
// cue: the words that tell the operation; fewer: a "fewer than" / "younger than" sentence (a classic trap)
const STORIES = {
  plus: [
    { letter: 'f', text: (a, c) => `George had some plastic figures. He bought ${a} more, and now he has ${c}. How many figures, f, did he have before?`, cue: 'bought more', range: [3, 30] },
    { letter: 's', text: (a, c) => `A school bus had some students. At the last stop, ${a} more got on, and it reached school with ${c}. How many students, s, were on before the stop?`, cue: 'got on', range: [4, 25] },
    { letter: 'c', text: (a, c) => `Joy added ${a} new contacts to her phone. Now she has ${c} contacts. How many contacts, c, did she have before?`, cue: 'added', range: [6, 40] },
    { letter: 'm', text: (a, c) => `Cabrini had some markers. She bought ${a} more and now has ${c}. How many markers, m, did she start with?`, cue: 'bought more', range: [3, 20] },
    { letter: 'd', letterFirst: false, text: (a, c) => `A race is ${c} kilometers long. Ana has already run ${a} kilometers. How many kilometers, d, are left?`, cue: 'already run plus what is left makes the whole race', range: [5, 40] },
  ],
  minus: [
    { letter: 't', text: (a, c) => `You had some trading cards. You gave ${a} to a friend and have ${c} left. How many cards, t, did you start with?`, cue: 'gave away', range: [4, 30] },
    { letter: 't', text: (a, c) => `The temperature dropped ${a}°F from breakfast to dinner. At dinner it was ${c}°F. What was the temperature, t, at breakfast?`, cue: 'dropped', range: [5, 25] },
    { letter: 'h', text: (a, c) => `A traffic helicopter came down ${a} meters and now hovers at ${c} meters. What was its first height, h?`, cue: 'came down', range: [20, 150] },
    { letter: 'p', fewer: true, text: (a, c) => `Vivian read ${a} fewer pages than she was assigned. She read ${c} pages. How many pages, p, was she assigned?`, cue: 'fewer pages than assigned', range: [5, 25] },
    { letter: 'y', fewer: true, text: (a, c) => `Clive is ${a} years younger than Josh. Clive is ${c}. How old is Josh, y?`, cue: 'younger than Josh', range: [3, 30] },
  ],
};
const MONEY_STORY = { letter: 's', letterFirst: true, flipped: true, text: (a, c) => `Jeremy bought a sandwich and a drink for $${fmt(c)} in all. The drink cost $${fmt(a)}. What did the sandwich, s, cost?`, cue: 'sandwich plus drink makes the total' };
const TAKEN_STORIES = [
  { letter: 'e', text: (a, c) => `A jar held ${a} cookies. After the class ate some, e, there were ${c} left. How many cookies were eaten?` },
  { letter: 'g', text: (a, c) => `A team had ${a} water bottles. They handed out g bottles and have ${c} left. How many did they hand out?` },
];
const MULTI_STORIES = [
  { letter: 'd', text: (a, b, c) => `The drama club sold ${c} tickets in three days: ${a} on day one and ${b} on day two. How many tickets, d, sold on day three?` },
  { letter: 'p', text: (a, b, c) => `A bag of ${c} mixed nuts has ${a} almonds, ${b} pecans and some pistachios, p. How many pistachios are there?` },
];

/** Number tiles for the "write it" step (the letter, + − and = are always available). */
function tilesFor(rnd, eq) {
  return shuffle(rnd, eq.kind === 'multi' ? [eq.a, eq.b, eq.c] : [eq.a, eq.c]);
}

/* ================================================================== */
/* Generators                                                          */
/* ================================================================== */
const LETTERS = ['n', 'x', 'y', 'm', 't', 'k', 'a', 'w'];

/** Zone 1: an equation to undo (letter first, total on the right). */
export function genUndo(rnd, { flipped = false, big = false } = {}) {
  const kind = rnd() < 0.5 ? 'plus' : 'minus';
  const a = big ? int(rnd, 12, 99) : int(rnd, 3, 40);
  const x = big ? int(rnd, 20, 250) : int(rnd, 2, 60);
  const c = kind === 'plus' ? x + a : x - a;
  if (c < 1) return genUndo(rnd, { flipped, big });
  const letterFirst = kind === 'minus' || !flipped || rnd() < 0.5;
  return { id: nextId++, type: 'undo', eq: makeEq({ kind, letter: pick(rnd, LETTERS), a, c, flipped, letterFirst }) };
}
/** Money: 7 = s + 1.75. */
export function genMoney(rnd, { story = false } = {}) {
  const a = int(rnd, 1, 19) * 0.25;                    // $0.25 to $4.75
  const x = int(rnd, 8, 36) * 0.25;                    // $2.00 to $9.00
  const eq = makeEq({ kind: 'plus', letter: 's', a, c: x + a, flipped: true, letterFirst: true, money: true });
  if (!story) return { id: nextId++, type: 'undo', eq };
  return { id: nextId++, type: 'story', eq, story: MONEY_STORY.text(eq.a, eq.c), cue: MONEY_STORY.cue, fewer: false, tiles: tilesFor(rnd, eq) };
}
/** Zone 2: a story to write as an equation, then undo. */
export function genStory(rnd, { kind = rnd() < 0.5 ? 'plus' : 'minus', fewer = null } = {}) {
  let pool = STORIES[kind];
  if (fewer !== null) pool = pool.filter((s) => Boolean(s.fewer) === fewer);
  const s = pick(rnd, pool);
  const a = int(rnd, s.range[0], s.range[1]);
  const x = int(rnd, kind === 'minus' ? 5 : 2, 60);
  const c = kind === 'plus' ? x + a : x - a;
  if (c < 1) return genStory(rnd, { kind, fewer });
  const eq = makeEq({ kind, letter: s.letter, a, c, letterFirst: s.letterFirst !== false });
  return { id: nextId++, type: 'story', eq, story: s.text(a, c), cue: s.cue, fewer: Boolean(s.fewer), tiles: tilesFor(rnd, eq) };
}
/** Boss twist: the letter is the amount taken away (44 − g = 38). */
export function genTaken(rnd) {
  const s = pick(rnd, TAKEN_STORIES);
  const a = int(rnd, 20, 60), x = int(rnd, 3, a - 4);
  const eq = makeEq({ kind: 'taken', letter: s.letter, a, c: a - x });
  return { id: nextId++, type: 'taken', eq, story: s.text(a, a - x), cue: 'some were taken away from the start', fewer: false, tiles: tilesFor(rnd, eq) };
}
/** Boss: three parts make a total (143 + 295 + d = 826). */
export function genMulti(rnd) {
  const s = pick(rnd, MULTI_STORIES);
  const a = int(rnd, 20, 300), b = int(rnd, 20, 300), x = int(rnd, 10, 300);
  const eq = makeEq({ kind: 'multi', letter: s.letter, a, b, c: a + b + x });
  return { id: nextId++, type: 'multi', eq, story: s.text(a, b, a + b + x), cue: 'the three parts make the total', fewer: false, tiles: tilesFor(rnd, eq) };
}

/** Zone 4: crates on a chute. Which have the same solution as the target? */
export function genSortRound(rnd) {
  const sol = int(rnd, 3, 12);
  const ta = int(rnd, 10, 40);
  const target = makeEq({ kind: 'plus', letter: 'x', a: ta, c: sol + ta, flipped: true });
  const crates = [];
  const matchEq = () => {
    const kind = rnd() < 0.5 ? 'plus' : 'minus';
    const a = int(rnd, 2, 30);
    const c = kind === 'plus' ? sol + a : sol - a;
    if (c < 1 || near(a, target.a)) return matchEq();
    return makeEq({ kind, letter: 'x', a, c, flipped: rnd() < 0.5, letterFirst: kind === 'minus' || rnd() < 0.6 });
  };
  for (let i = 0; i < 3; i++) crates.push({ eq: matchEq(), match: true, trap: null });
  // Trap 1: same numbers as the target, but subtraction (36 = x − 32 has a different solution)
  crates.push({ eq: makeEq({ kind: 'minus', letter: 'x', a: target.a, c: target.c, flipped: true }), match: false, trap: 'same_numbers' });
  // Trap 2: the solution is close but not the same
  const off = sol + pick(rnd, [-2, -1, 1, 2]);
  const a2 = int(rnd, 2, 30);
  crates.push({ eq: makeEq({ kind: 'plus', letter: 'x', a: a2, c: off + a2, letterFirst: rnd() < 0.5 }), match: false, trap: 'close' });
  // Trap 3: the answer's number appears in it, but it does not solve to it
  crates.push({ eq: makeEq({ kind: 'minus', letter: 'x', a: sol, c: int(rnd, 3, 20) }), match: false, trap: 'number_shows' });
  return shuffle(rnd, crates).map((cr) => ({ id: nextId++, type: 'sort', target, ...cr }));
}

export const ZONES = [
  { name: 'Run It Backward', blurb: 'Undo the machine with the opposite step' },
  { name: 'Story to Machine', blurb: 'Write the equation from the story, then undo it' },
  { name: 'Flip Side', blurb: 'The total is on the left. Money too!' },
  { name: 'Sorting Chute', blurb: 'Same solution as the target? Sort every crate' },
  { name: 'The Jammed Machine', blurb: 'Boss: combine, then undo. Watch for tricks!' },
];

export function genZone(rnd, zone) {
  if (zone === 0) return Array.from({ length: 6 }, () => genUndo(rnd));
  if (zone === 1) return [genStory(rnd, { kind: 'plus', fewer: false }), genStory(rnd, { kind: 'minus', fewer: false }), genStory(rnd, { kind: 'minus', fewer: true }), genStory(rnd), genStory(rnd)];
  if (zone === 2) return shuffle(rnd, [genUndo(rnd, { flipped: true }), genUndo(rnd, { flipped: true }), genUndo(rnd, { flipped: true, big: true }), genUndo(rnd, { flipped: true, big: true }), genMoney(rnd), genMoney(rnd)]);
  if (zone === 3) return genSortRound(rnd);
  return [genMulti(rnd), genStory(rnd, { kind: 'minus', fewer: true }), genTaken(rnd), genMoney(rnd, { story: true }), genMulti(rnd)];
}

/** A fresh problem of the same kind, after two misses. */
export function genBackup(rnd, p) {
  if (p.type === 'multi') return genMulti(rnd);
  if (p.type === 'taken') return genTaken(rnd);
  if (p.type === 'story') return p.eq.money ? genMoney(rnd, { story: true }) : genStory(rnd, { kind: p.eq.kind, fewer: p.fewer });
  if (p.eq.money) return genMoney(rnd);
  return genUndo(rnd, { flipped: p.eq.flipped, big: p.eq.a > 40 || p.eq.x > 60 });
}

/* ================================================================== */
/* Step 1: write the equation from tiles                               */
/* ================================================================== */
/**
 * Reads the tiles the student placed: [{t:'var'}, {t:'op', v:'+'}, {t:'num', v:7}, {t:'eq'}, {t:'num', v:25}].
 * Returns { ok, coef, k, letterAlone, numMinusVar, varMinusNum, ops } or { ok: false } if it is not an equation yet.
 * The equation is coef·x = k after moving everything over (coef is +1 or −1 for these equations).
 */
export function readTiles(tiles) {
  const eqAt = tiles.findIndex((t) => t.t === 'eq');
  if (eqAt < 0 || tiles.filter((t) => t.t === 'eq').length !== 1) return { ok: false };
  if (tiles.filter((t) => t.t === 'var').length !== 1) return { ok: false };
  const sides = [tiles.slice(0, eqAt), tiles.slice(eqAt + 1)];
  const info = { ok: true, coef: 0, k: 0, letterAlone: false, numMinusVar: false, varMinusNum: false, ops: new Set() };
  for (let s = 0; s < 2; s++) {
    const side = sides[s];
    if (!side.length || side.length % 2 === 0) return { ok: false };
    const sign = s === 0 ? 1 : -1;                  // left side minus right side
    let mult = 1;
    for (let i = 0; i < side.length; i++) {
      const tok = side[i];
      if (i % 2 === 1) {
        if (tok.t !== 'op') return { ok: false };
        mult = tok.v === '-' ? -1 : 1;
        info.ops.add(tok.v);
        continue;
      }
      if (tok.t === 'num') {
        info.k -= sign * mult * tok.v;
        if (i + 2 < side.length && side[i + 1].v === '-' && side[i + 2].t === 'var') info.numMinusVar = true;
      } else if (tok.t === 'var') {
        info.coef += sign * mult;
        if (i + 2 < side.length && side[i + 1].v === '-' && side[i + 2].t === 'num') info.varMinusNum = true;
      } else return { ok: false };
    }
    if (side.length === 1 && side[0].t === 'var') info.letterAlone = true;
  }
  if (info.coef === 0) return { ok: false };
  info.value = round2(info.k / info.coef);
  return info;
}
export function tilesText(tiles) {
  return tiles.map((t) => (t.t === 'num' ? fmt(t.v) : t.t === 'var' ? t.v : t.t === 'eq' ? '=' : OP_SIGN[t.v])).join(' ');
}

export function checkWritten(p, tiles) {
  const eq = p.eq;
  const r = readTiles(tiles);
  const L = eq.letter;
  if (!r.ok) {
    return { correct: false, nudge: true, key: 'incomplete', message: `Build a whole equation: use the letter ${L} once, numbers joined by + or −, and one = sign.` };
  }
  const right = near(r.value, eq.x);
  if (right && r.letterAlone) {
    return { correct: false, nudge: true, key: 'pre_solved', message: `That's already the answer worked out! First write what the story SAYS happens, like ${exprText(eq)} = ${fmt(eq.c)}.` };
  }
  if (right) return { correct: true, key: 'correct', message: `Yes! ${tilesText(tiles)} matches the story.` };
  const want = eq.kind === 'minus' || eq.kind === 'taken' ? '−' : '+';
  if (p.fewer && (r.letterAlone || r.numMinusVar)) {
    return { correct: false, key: 'fewer_trap', message: `Careful with "${p.cue}". ${L} is the bigger, unknown amount, and the ${fmt(eq.a)} comes OFF it: ${L} − ${fmt(eq.a)} = ${fmt(eq.c)}.` };
  }
  if (eq.kind === 'taken' && r.varMinusNum) {
    return { correct: false, key: 'order', message: `Order matters in subtraction. The story starts with ${fmt(eq.a)} and ${L} is taken away from it: ${fmt(eq.a)} − ${L} = ${fmt(eq.c)}.` };
  }
  if (eq.kind === 'minus' && r.numMinusVar) {
    return { correct: false, key: 'order', message: `Order matters in subtraction. The story starts with ${L}, so write ${L} first: ${exprText(eq)} = ${fmt(eq.c)}.` };
  }
  if (!r.ops.has(want === '−' ? '-' : '+') || (want === '+' && r.ops.has('-'))) {
    return { correct: false, key: 'wrong_op', message: `"${p.cue}" means ${want === '+' ? 'adding' : 'taking away'}, so the equation needs ${want}: ${exprText(eq)} = ${fmt(eq.c)}.` };
  }
  return { correct: false, key: 'wrong_numbers', message: `Give each number its job. ${fmt(eq.c)} is the total at the end, so it goes alone on one side: ${exprText(eq)} = ${fmt(eq.c)}.` };
}

/* ================================================================== */
/* Step 2: undo the machine                                            */
/* ================================================================== */
/** The student drops an undo block (op, n) into the machine. Returns what comes out and whether the check works. */
export function checkUndo(eq, op, n) {
  const step = undoStep(eq);
  const value = round2(op === '+' ? eq.c + n : eq.c - n);
  const back = runForward(eq, value);                  // the check: put it back in
  const correct = near(value, eq.x);
  const L = eq.letter;
  const does = eq.kind === 'plus' ? `ADDS ${fmt(eq.a)}` : `TAKES AWAY ${fmt(eq.a)}`;
  const fix = `${OP_SIGN[step.op]} ${fmt(step.n)}`;
  let key = 'correct', message = `${L} = ${fmt(eq.x)}. Check: ${checkLine(eq, eq.x)} ✓`;
  if (!correct) {
    if (op !== step.op && near(n, eq.a)) {
      key = 'did_not_undo';
      message = `The machine ${does}. Doing that AGAIN gives ${fmt(value)}, and the check fails: ${checkLine(eq, value)}. Undo it with the opposite step, ${fix}.`;
    } else if (near(n, eq.c)) {
      key = 'used_total';
      message = `That used the total, ${fmt(eq.c)}. Undo the machine's step instead: it ${does}, so use ${fix}.`;
    } else if (op === step.op) {
      key = 'wrong_amount';
      message = `Right direction, wrong amount. The machine ${does}, so undo exactly that: ${fix}.`;
    } else {
      key = 'wrong_op';
      message = `The machine ${does}. ${eq.kind === 'plus' ? 'Undo adding with subtracting' : 'Undo taking away with adding'}: ${fix}.`;
    }
  }
  return { correct, key, message, value, back };
}
/** "18 + 7 = 25 ✓" style check, written the same way round as the equation. */
export function checkLine(eq, v) {
  const out = runForward(eq, v);
  const expr = exprText(eq).replace(new RegExp(`\\b${eq.letter}\\b`), fmt(v));
  if (!near(out, eq.c)) return `${expr} = ${fmt(out)}, not ${fmt(eq.c)}`;
  return eq.flipped ? `${fmt(eq.c)} = ${expr}` : `${expr} = ${fmt(eq.c)}`;
}

/** Boss: combine the known parts first (143 + 295 = 438). */
export function checkCombine(eq, raw) {
  const v = parseNumber(raw);
  if (v === null) return { correct: false, nudge: true, key: 'not_a_number', message: 'Type a number.' };
  const total = round2(eq.a + eq.b);
  if (near(v, total)) return { correct: true, key: 'correct', message: `${fmt(eq.a)} + ${fmt(eq.b)} = ${fmt(total)}. Now the machine is ${fmt(total)} + ${eq.letter} = ${fmt(eq.c)}.` };
  if (near(v, eq.c - eq.a - eq.b)) return { correct: false, key: 'skipped_combine', message: `That's the final answer, but first combine the parts you know: ${fmt(eq.a)} + ${fmt(eq.b)} = ?` };
  return { correct: false, key: 'combine_error', message: `Add the two parts you know: ${fmt(eq.a)} + ${fmt(eq.b)}. Line up the place values and try again.` };
}
/** Boss twist: a − x = c, typed answer. */
export function checkTaken(eq, raw) {
  const v = parseNumber(raw);
  if (v === null) return { correct: false, nudge: true, key: 'not_a_number', message: 'Type a number.' };
  const L = eq.letter;
  if (near(v, eq.x)) return { correct: true, key: 'correct', value: v, message: `${L} = ${fmt(v)}. Check: ${checkLine(eq, v)} ✓` };
  if (near(v, eq.a + eq.c)) {
    return { correct: false, key: 'added_both', value: v, message: `Here ${L} is the amount TAKEN AWAY, not the start. Adding gives ${fmt(v)}, but ${checkLine(eq, v)}. Taking ${L} from ${fmt(eq.a)} leaves ${fmt(eq.c)}, so ${L} is the gap: ${fmt(eq.a)} − ${fmt(eq.c)}.` };
  }
  if (near(v, eq.c) || near(v, eq.a)) {
    return { correct: false, key: 'copied_number', value: v, message: `That's a number from the story. ${L} is how many were taken: what do you take from ${fmt(eq.a)} to leave ${fmt(eq.c)}?` };
  }
  return { correct: false, key: 'check_fails', value: v, message: `Check it: ${checkLine(eq, v)}. ${L} is the gap between ${fmt(eq.a)} and ${fmt(eq.c)}.` };
}

/* ================================================================== */
/* Zone 4: sorting crates                                              */
/* ================================================================== */
export function checkSort(crate, saysMatch) {
  const { eq, target, match, trap } = crate;
  const correct = saysMatch === match;
  const solved = `${eqText(eq)} gives x = ${fmt(eq.x)}`;
  const tgt = `${eqText(target)} gives x = ${fmt(target.x)}`;
  if (correct) return { correct, key: 'correct', message: `${match ? 'Match' : 'Not a match'}! ${solved}; ${tgt}.` };
  let key = 'sort_solve_first', message = `Solve both before you sort: ${solved}, but ${tgt}.`;
  if (trap === 'same_numbers') { key = 'same_numbers'; message = `Same numbers is not the same solution! ${solved}, but ${tgt}. The − changes everything.`; }
  else if (trap === 'number_shows') { key = 'number_shows'; message = `${fmt(target.x)} appears in it, but that isn't the solution: ${solved}.`; }
  else if (match) { key = 'missed_match'; message = `Different numbers can still have the same solution: ${solved}, and ${tgt}. Match!`; }
  return { correct, key, message };
}

/* ================================================================== */
/* Worked solutions (after two misses)                                 */
/* ================================================================== */
export function workedSolution(p) {
  const eq = p.eq;
  const L = eq.letter;
  if (p.type === 'sort') return [`Target: ${eqText(p.target)}, so x = ${fmt(p.target.x)}.`, `Crate: ${eqText(eq)}, so x = ${fmt(eq.x)}.`, `${near(eq.x, p.target.x) ? 'Same solution: MATCH.' : 'Different solution: NOT a match.'}`];
  const lines = [];
  if (p.story) lines.push(`Write it: ${eqText(eq)}`);
  if (eq.kind === 'taken') {
    lines.push(`${L} is taken from ${fmt(eq.a)} and ${fmt(eq.c)} is left.`, `${L} = ${fmt(eq.a)} − ${fmt(eq.c)} = ${fmt(eq.x)}`, `Check: ${checkLine(eq, eq.x)} ✓`);
    return lines;
  }
  let e = eq;
  if (eq.kind === 'multi') {
    e = combined(eq);
    lines.push(`Combine: ${fmt(eq.a)} + ${fmt(eq.b)} = ${fmt(eq.a + eq.b)}, so ${eqText(e)}`);
  }
  const s = undoStep(e);
  const sign = OP_SIGN[s.op];
  const both = e.flipped
    ? `${fmt(e.c)} ${sign} ${fmt(s.n)} = ${exprText(e)} ${sign} ${fmt(s.n)}`
    : `${exprText(e)} ${sign} ${fmt(s.n)} = ${fmt(e.c)} ${sign} ${fmt(s.n)}`;
  lines.push(`Undo ${e.kind === 'plus' ? `+ ${fmt(e.a)} with − ${fmt(e.a)}` : `− ${fmt(e.a)} with + ${fmt(e.a)}`} on both sides: ${both}`);
  lines.push(e.flipped ? `${fmt(e.x)} = ${L}` : `${L} = ${fmt(e.x)}`);
  lines.push(`Check: ${checkLine(eq, e.x)} ✓`);
  return lines;
}
