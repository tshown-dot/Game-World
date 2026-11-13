// Gear Shift (Lesson 4-4: Write and Solve Multiplication and Division Equations): the math.
// No screen code here, so it can be tested with plain node (see test_gear_shift_math.js).
//
// A gear rolls along a toothed track. Every turn moves it the same number of teeth, and it has to stop
// exactly on a flag. Every equation is one trip:  turns × teeth per turn = flag.  The letter is the part
// the student sets.
//   gear     k·x = c       the gear makes k turns; choose how many teeth it moves per turn
//   flag     x ÷ k = c     k turns of c teeth each; place the flag where it will stop
//   turns    s·x = c       the gear moves s teeth per turn; choose how many turns
//   offset   k·x + b = c   the gear starts at b, then makes k turns (boss)
//   mystery  the gear's size is hidden; one free test turn shows it, then place the flag for n turns (boss)
// r.unknown says what the student sets: 'size', 'turns' or 'flag'. r.x is the answer.

let nextId = 1;
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
const LETTERS = ['x', 'n', 'm', 'g', 't', 'p', 'w', 'd'];
const axisTo = (max) => ({ lo: 0, hi: Math.max(20, Math.ceil(max / 10) * 10) });
/** How far each dial turns. */
export const DIAL = { size: { lo: 1, hi: 20 }, turns: { lo: 1, hi: 15 } };

/* ================================================================== */
/* One trip of the gear                                                */
/* ================================================================== */
/** max: the biggest number on the track. flipped: write it as 36 = 4x. fuse: seconds before the gear rolls by itself. */
export function genTrip(rnd, kind, { max = 60, flipped = false, fuse = 0, letter = pick(rnd, LETTERS) } = {}) {
  const base = { id: nextId++, type: 'trip', kind, letter, flipped, fuse, axis: axisTo(max) };
  for (let guard = 0; guard < 200; guard++) {
    const k = int(rnd, 2, 9), n = int(rnd, 2, 12);
    if (k * n > max || k === n) continue;                         // the two numbers differ, so a mix-up shows
    if (kind === 'gear') return { ...base, unknown: 'size', k, c: k * n, x: n };
    if (kind === 'flag') return { ...base, unknown: 'flag', k, c: n, x: k * n };
    if (kind === 'turns') return { ...base, unknown: 'turns', s: n, c: k * n, x: k };
  }
  throw new Error(`no trip for ${kind}`);
}
/** The gear starts part-way along: k·x + b = c. */
export function genOffset(rnd, { fuse = 0 } = {}) {
  const b = int(rnd, 2, 12), k = int(rnd, 2, 6), x = int(rnd, 2, 9);
  return { id: nextId++, type: 'trip', kind: 'offset', unknown: 'size', letter: pick(rnd, LETTERS), k, b, c: k * x + b, x, flipped: false, fuse, axis: axisTo(k * x + b + 4) };
}
/** A hidden gear. tests: free test turns (one turn each) before the flag has to be placed. */
export function genMystery(rnd) {
  const g = int(rnd, 3, 9), n = int(rnd, 6, 11);
  return { id: nextId++, type: 'trip', kind: 'mystery', unknown: 'flag', letter: 'x', g, n, x: g * n, flipped: false, fuse: 0, tests: 1, axis: axisTo(100) };
}
/** The equation as the student sees it. v: put this number in for the letter. */
export function eqText(r, v = null) {
  const L = v === null ? r.letter : String(v), times = (a, b) => (v === null ? `${a}${b}` : `${a} × ${b}`);
  const [left, right] = r.kind === 'gear' ? [times(r.k, L), r.c] : r.kind === 'flag' ? [`${L} ÷ ${r.k}`, r.c] : r.kind === 'turns' ? [times(r.s, L), r.c]
    : r.kind === 'offset' ? [`${times(r.k, L)} + ${r.b}`, r.c] : [`${L} ÷ ${r.n}`, '?'];
  return r.flipped ? `${right} = ${left}` : `${left} = ${right}`;
}
/** The trip when the student's number is v: where the gear starts, teeth per turn, how many turns, and where the flag is. */
export function tripOf(r, v) {
  if (r.kind === 'gear') return { start: 0, size: v, turns: r.k, flag: r.c };
  if (r.kind === 'flag') return { start: 0, size: r.c, turns: r.k, flag: v };
  if (r.kind === 'turns') return { start: 0, size: r.s, turns: v, flag: r.c };
  if (r.kind === 'offset') return { start: r.b, size: v, turns: r.k, flag: r.c };
  return { start: 0, size: r.g, turns: r.n, flag: v };
}
export const landOf = (r, v) => { const t = tripOf(r, v); return t.start + t.size * t.turns; };
/** "4 × 9 = 36 ✓" or "4 × 8 = 32, not 36" */
export function checkLine(r, v) {
  const t = tripOf(r, v), land = landOf(r, v), sum = `${t.turns} × ${t.size}${t.start ? ` + ${t.start}` : ''} = ${land}`;
  return land === t.flag ? `${sum} ✓` : `${sum}, not ${t.flag}`;
}
/** The gear rolled. Returns { ok, land, key, message }. */
export function checkTrip(r, v) {
  const t = tripOf(r, v), land = landOf(r, v), line = checkLine(r, v);
  if (land === t.flag) return { ok: true, land, key: 'correct', message: line };
  const no = (key, text) => ({ ok: false, land, key, message: `${line}. ${text}` });
  const { k, c, s, b, n, g } = r;
  if (r.kind === 'mystery') return v === g ? no('one_turn', `That is where ONE turn stops. The gear makes ${n} turns.`) : no('off', `${n} turns of ${g} teeth go to ${n * g}.`);
  if (r.kind === 'flag') {
    if (v === c) return no('one_turn', `That is where ONE turn stops. The gear makes ${k} turns of ${c}.`);
    if (v === c + k) return no('add_vs_times', `${k} turns of ${c} teeth is ${k} TIMES ${c}, not ${k} + ${c}.`);
    if (Number.isInteger(c / k) && v === c / k) return no('did_not_undo', `${r.letter} was DIVIDED by ${k} to get ${c}, so undo it by multiplying: ${c} × ${k}.`);
    return no('off', `The gear stopped ${Math.abs(land - v)} ${land > v ? 'PAST' : 'SHORT of'} the flag.`);
  }
  const known = r.kind === 'turns' ? s : k;
  if (r.kind === 'offset' && Number.isInteger(c / k) && v === c / k) return no('forgot_start', `The gear starts at ${b}, not at 0. It only has ${c} − ${b} = ${c - b} teeth to cover.`);
  if (v === c - known - (b || 0) || v === c - known) return no('add_vs_times', `${known}${r.letter} means ${known} TIMES ${r.letter}. Undo it by dividing, not subtracting.`);
  if (v === known) return no('used_the_number', r.kind === 'turns' ? `${s} is the teeth per turn. The letter is how many TURNS.` : `${k} is the number of turns. The letter is the TEETH per turn.`);
  const gap = Math.abs(land - c), each = t.size;
  return no('off', `The gear stopped ${gap} ${land > c ? 'PAST' : 'SHORT of'} the flag${gap % each === 0 && r.kind === 'turns' ? ` (${gap / each} turn${gap / each === 1 ? '' : 's'})` : ''}.`);
}

/* ================================================================== */
/* Write it: build the equation from a story                           */
/* ================================================================== */
const STORIES = {
  gear: [
    (r) => `${r.k} crates hold the same number of gears. There are ${r.c} gears in all. How many gears, ${r.letter}, are in each crate?`,
    (r) => `A mine cart makes ${r.k} equal trips and carries ${r.c} loads of ore in all. How many loads, ${r.letter}, does it carry each trip?`,
  ],
  flag: [
    (r) => `A rope is cut into ${r.k} equal pieces. Each piece is ${r.c} meters long. How long, ${r.letter}, was the rope?`,
    (r) => `Some bolts are shared equally among ${r.k} boxes. Each box gets ${r.c} bolts. How many bolts, ${r.letter}, were there?`,
  ],
  turns: [
    (r) => `Each crate holds ${r.s} bolts. How many crates, ${r.letter}, do ${r.c} bolts fill?`,
    (r) => `A ticket costs $${r.s}. How many tickets, ${r.letter}, can be bought with $${r.c}?`,
  ],
};
const STORY_LETTER = { gear: 'g', flag: 'r', turns: 'c' };
/** A story, its tiles (the letter and the two numbers) and the trip that checks it. Tile ids: L, p (the number with the letter), q (the other side). */
export function genStory(rnd, kind) {
  const trip = genTrip(rnd, kind, { max: 60, letter: STORY_LETTER[kind] }), p = kind === 'turns' ? trip.s : trip.k;
  if (new Set([trip.x, p, trip.c]).size < 3) return genStory(rnd, kind);      // three different numbers, so no two tiles look alike
  const tiles = shuffle(rnd, [{ id: 'L', text: trip.letter }, { id: 'p', text: String(p) }, { id: 'q', text: String(trip.c) }]);
  return { id: nextId++, type: 'build', kind, story: pick(rnd, STORIES[kind])(trip), trip: { ...trip, story: true }, tiles };
}
/** The student built  first (op) second = third  from the tiles. op is '×' or '÷'. Any true way of writing it counts. */
export function checkBuild(p, first, op, second, third) {
  if (!first || !op || !second || !third) return { correct: false, nudge: true, key: 'incomplete', message: 'Fill every space, and pick × or ÷.' };
  const r = p.trip, val = (id) => ({ L: r.x, p: r.kind === 'turns' ? r.s : r.k, q: r.c }[id]);
  const made = op === '×' ? val(first) * val(second) : val(first) / val(second);
  if (made === val(third)) return { correct: true, key: 'correct', message: 'That equation tells the story. Now roll the gear to solve it.' };
  const hint = { gear: 'Equal groups: the number of groups TIMES the amount in each makes the total.', flag: 'The whole amount, DIVIDED into equal parts, gives the size of each part.',
    turns: 'The amount in each group TIMES the number of groups makes the total.' }[p.kind];
  return { correct: false, key: 'story_order', message: `That equation does not tell the story. ${hint}` };
}

/* ================================================================== */
/* Zones                                                               */
/* ================================================================== */
export const ZONES = [
  { name: 'Pick the Gear', blurb: 'Choose the teeth per turn to reach the flag' },
  { name: 'Set the Flag', blurb: 'Equal turns: where will the gear stop?' },
  { name: 'Count the Turns', blurb: 'How many turns? Then a mixed rush' },
  { name: 'Write It', blurb: 'Build the equation from a story, then roll it' },
  { name: 'The Stuck Gearbox', blurb: 'Boss: a head start, and a mystery gear' },
];
/** The rounds of a zone, in order. A story is followed by the trip that solves it. */
export function genZone(rnd, zone) {
  if (zone === 0) return [0, 1, 2, 3, 4].map((i) => genTrip(rnd, 'gear', { max: i < 2 ? 40 : 60 }));
  if (zone === 1) return [0, 1, 2, 3, 4].map((i) => genTrip(rnd, 'flag', { max: i < 2 ? 40 : 60 }));
  if (zone === 2) return [genTrip(rnd, 'turns', { max: 40 }), genTrip(rnd, 'turns', { max: 60 }), genTrip(rnd, 'turns', { max: 100 }),
    ...shuffle(rnd, ['gear', 'flag', 'turns']).map((k, i) => genTrip(rnd, k, { max: 100, flipped: i !== 1, fuse: 16 }))];
  if (zone === 3) return shuffle(rnd, ['gear', 'flag', 'turns']).flatMap((k) => { const s = genStory(rnd, k); return [s, s.trip]; });
  return [genOffset(rnd, { fuse: 18 }), genMystery(rnd), genTrip(rnd, pick(rnd, ['gear', 'turns']), { max: 100, flipped: true, fuse: 16 }), genOffset(rnd, { fuse: 18 }), genMystery(rnd)];
}
