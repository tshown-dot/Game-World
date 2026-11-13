// Undo Machine (Lesson 4-3: Write and Solve Addition and Subtraction Equations): the math.
// No screen code here, so it can be tested with plain node (see test_undo_machine_math.js).
//
// A cart sits on a number-line track. The machine pushes it, and it has to stop exactly on a flag.
// Every equation is one run of the cart:  start + push = flag.  The letter is the part the student sets.
//   start_plus   x + a = c    place the cart; the machine pushes it a forward
//   start_minus  x − a = c    place the cart; the machine pushes it a back
//   push_plus    s + x = c    the cart starts at s; set how far forward to push
//   push_minus   s − x = c    the cart starts at s; set how far back to push
//   two          x + a + b = c   two pushes in a row (boss)
//   mystery      the push is hidden; the student sends test carts to find it (boss)
// r.unknown says what the student sets: 'start' or 'push'. r.x is the answer.

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
const LETTERS = ['x', 'n', 'm', 'k', 't', 'p', 'w', 'd'];
const axisTo = (max) => ({ lo: 0, hi: Math.max(20, Math.ceil(max / 10) * 10) });

/* ================================================================== */
/* One run of the cart                                                 */
/* ================================================================== */
/** max: the biggest number on the track. flipped: write it as 23 = x + 7. fuse: seconds before the machine fires by itself. */
export function genRun(rnd, kind, { max = 40, flipped = false, fuse = 0, letter = pick(rnd, LETTERS) } = {}) {
  const base = { id: nextId++, type: 'run', kind, letter, flipped, fuse, axis: axisTo(max), unknown: kind.startsWith('start') ? 'start' : 'push' };
  if (kind === 'start_plus') { const a = int(rnd, 3, 12), x = int(rnd, 3, max - a - 2); return { ...base, a, c: x + a, x }; }
  if (kind === 'start_minus') { const a = int(rnd, 3, 12), c = int(rnd, 2, max - a - 2); return { ...base, a, c, x: c + a }; }
  if (kind === 'push_plus') { const s = int(rnd, 2, Math.floor(max / 2)), x = int(rnd, 3, max - s - 2); return { ...base, s, c: s + x, x }; }
  const s = int(rnd, 15, max - 2), x = int(rnd, 3, s - 2);
  return { ...base, s, c: s - x, x };
}
/** Two pushes in a row: x + a + b = c. */
export function genTwo(rnd, { fuse = 0 } = {}) {
  const a = int(rnd, 2, 9), b = int(rnd, 2, 9), x = int(rnd, 3, 20);
  return { id: nextId++, type: 'run', kind: 'two', unknown: 'start', letter: pick(rnd, LETTERS), a, b, c: x + a + b, x, flipped: false, fuse, axis: axisTo(40) };
}
/** A hidden push. tests: how many free test carts the student may send before the one that counts. */
export function genMystery(rnd) {
  const push = pick(rnd, [1, -1]) * int(rnd, 3, 12), x = int(rnd, 14, 26);
  return { id: nextId++, type: 'run', kind: 'mystery', unknown: 'start', letter: 'x', push, c: x + push, x, flipped: false, fuse: 0, tests: 2, axis: axisTo(40) };
}
/** The equation as the student sees it. v: put this number in for the letter. */
export function eqText(r, v = null) {
  const L = v === null ? r.letter : String(v);
  const left = r.kind === 'start_plus' ? `${L} + ${r.a}` : r.kind === 'start_minus' ? `${L} − ${r.a}` : r.kind === 'push_plus' ? `${r.s} + ${L}`
    : r.kind === 'push_minus' ? `${r.s} − ${L}` : r.kind === 'two' ? `${L} + ${r.a} + ${r.b}` : `${L} ? ?`;
  return r.flipped ? `${r.c} = ${left}` : `${left} = ${r.c}`;
}
/** Where the cart starts, and each push it gets, when the student's number is v. */
export const startOf = (r, v) => (r.unknown === 'start' ? v : r.s);
export function pushesOf(r, v) {
  return { start_plus: [r.a], start_minus: [-r.a], push_plus: [v], push_minus: [-v], two: [r.a, r.b], mystery: [r.push] }[r.kind];
}
export const landOf = (r, v) => pushesOf(r, v).reduce((sum, p) => sum + p, startOf(r, v));
/** "16 + 7 = 23 ✓" or "30 + 7 = 37, not 23" */
export function checkLine(r, v) {
  const land = landOf(r, v);
  if (r.kind === 'mystery') return `The cart went from ${v} to ${land}`;
  const left = eqText({ ...r, flipped: false }, v).split(' = ')[0];
  return land === r.c ? `${left} = ${r.c} ✓` : `${left} = ${land}, not ${r.c}`;
}
/** The cart ran. Returns { ok, land, key, message }. */
export function checkRun(r, v) {
  const land = landOf(r, v), line = checkLine(r, v);
  if (land === r.c) return { ok: true, land, key: 'correct', message: r.kind === 'mystery' ? `${line}. Right on the flag!` : line };
  const no = (key, text) => ({ ok: false, land, key, message: `${line}. ${text}` });
  const { a, b, s, c } = r;
  if (r.kind === 'mystery') return no('mystery', `The machine ${r.push > 0 ? 'adds' : 'takes away'} ${Math.abs(r.push)}, so start ${Math.abs(r.push)} ${r.push > 0 ? 'BEFORE' : 'PAST'} the flag.`);
  if (r.unknown === 'start') {
    if (v === c) return no('started_on_flag', 'The flag is where the cart must END, not where it starts.');
    if (r.kind === 'start_plus' && v === c + a) return no('did_not_undo', `The machine ADDS ${a}, so the cart has to start ${a} BEFORE the flag: ${c} − ${a}.`);
    if (r.kind === 'start_minus' && v === c - a) return no('did_not_undo', `The machine takes the cart ${a} BACK, so it has to start ${a} PAST the flag: ${c} + ${a}.`);
    if (r.kind === 'two' && (v === c - a || v === c - b)) return no('combine', `There are TWO pushes: ${a} + ${b} = ${a + b} in all.`);
    if (v === a) return no('used_the_number', `${a} is how far the machine pushes, not where the cart starts.`);
  } else {
    if (v === c) return no('used_total', `${c} is the flag, not the push. How far is it from ${s} to ${c}?`);
    if (v === s + c) return no('did_not_undo', `The push is the DISTANCE between ${s} and ${c}, so subtract.`);
  }
  const forward = pushesOf(r, v).reduce((sum, p) => sum + p, 0) >= 0, gap = Math.abs(land - c), past = forward ? land > c : land < c;
  return no('off', `The cart stopped ${gap} ${past ? 'PAST' : 'SHORT of'} the flag.`);
}

/* ================================================================== */
/* Write it: build the equation from a story                           */
/* ================================================================== */
const STORIES = {
  start_plus: [
    (r) => `A bus had some riders. ${r.a} more got on, and now there are ${r.c}. How many riders, ${r.letter}, were on the bus at first?`,
    (r) => `Lena had some coins. She found ${r.a} more and now has ${r.c}. How many coins, ${r.letter}, did she start with?`,
  ],
  start_minus: [
    (r) => `Mia had some stickers. She gave away ${r.a} and has ${r.c} left. How many stickers, ${r.letter}, did she start with?`,
    (r) => `A tank lost ${r.a} liters of water and now holds ${r.c}. How many liters, ${r.letter}, did it hold before?`,
  ],
  push_plus: [
    (r) => `Sam has ${r.s} cards. After getting some more he has ${r.c}. How many cards, ${r.letter}, did he get?`,
    (r) => `The team has ${r.s} points and needs ${r.c} to win. How many more points, ${r.letter}, does it need?`,
  ],
  push_minus: [
    (r) => `The trail is ${r.s} km long. After hiking some of it, ${r.c} km are left. How many km, ${r.letter}, has the hiker gone?`,
    (r) => `A shop had ${r.s} pies. After selling some, ${r.c} are left. How many pies, ${r.letter}, were sold?`,
  ],
};
const STORY_LETTER = { start_plus: 'r', start_minus: 's', push_plus: 'c', push_minus: 'k' };
/** A story, its tiles (the letter and the two numbers) and the run that checks it. Tile ids: L, p (the number with the letter), q (the total). */
export function genStory(rnd, kind) {
  const run = genRun(rnd, kind, { max: 40, letter: STORY_LETTER[kind] }), p = run.unknown === 'start' ? run.a : run.s;
  if (new Set([run.x, p, run.c]).size < 3) return genStory(rnd, kind);      // three different numbers, so no two tiles look alike
  const tiles = shuffle(rnd, [{ id: 'L', text: run.letter }, { id: 'p', text: String(p) }, { id: 'q', text: String(run.c) }]);
  return { id: nextId++, type: 'build', kind, story: pick(rnd, STORIES[kind])(run), run: { ...run, story: true }, tiles };
}
/** The student built  first (op) second = third  from the tiles. op is '+' or '-'. Any true way of writing it counts. */
export function checkBuild(p, first, op, second, third) {
  if (!first || !op || !second || !third) return { correct: false, nudge: true, key: 'incomplete', message: 'Fill every space, and pick + or −.' };
  const r = p.run, val = (id) => ({ L: r.x, p: r.unknown === 'start' ? r.a : r.s, q: r.c }[id]);
  const made = op === '+' ? val(first) + val(second) : val(first) - val(second);
  if (made === val(third)) return { correct: true, key: 'correct', message: 'That equation tells the story. Now run the cart to solve it.' };
  const hint = { start_plus: 'Some were there, more were ADDED, and that made the total.', start_minus: 'Start with the unknown amount, TAKE AWAY, and that leaves what is left.',
    push_plus: 'Start with what there is, ADD the unknown, and that makes the total.', push_minus: 'Start with the whole amount, TAKE AWAY the unknown, and that leaves what is left.' }[p.kind];
  return { correct: false, key: 'story_order', message: `That equation does not tell the story. ${hint}` };
}

/* ================================================================== */
/* Zones                                                               */
/* ================================================================== */
export const ZONES = [
  { name: 'Find the Start', blurb: 'Place the cart so the push lands it on the flag' },
  { name: 'Find the Push', blurb: 'The start is fixed: set how far to push' },
  { name: 'Rush', blurb: 'Mixed carts, bigger numbers, a fuse' },
  { name: 'Write It', blurb: 'Build the equation from a story, then run it' },
  { name: 'The Jammed Machine', blurb: 'Boss: two pushes, and a mystery machine' },
];
/** The rounds of a zone, in order. A story is followed by the run that solves it. */
export function genZone(rnd, zone) {
  if (zone === 0) return ['start_plus', 'start_minus', 'start_plus', 'start_minus', 'start_plus'].map((k, i) => genRun(rnd, k, { max: i < 2 ? 30 : 40 }));
  if (zone === 1) return ['push_plus', 'push_minus', 'push_plus', 'push_minus', 'push_plus'].map((k, i) => genRun(rnd, k, { max: i < 2 ? 30 : 40 }));
  if (zone === 2) return shuffle(rnd, ['start_plus', 'start_minus', 'push_plus', 'push_minus', 'start_minus', 'push_minus']).map((k, i) => genRun(rnd, k, { max: i % 2 ? 100 : 60, flipped: i % 3 === 1, fuse: 14 }));
  if (zone === 3) return shuffle(rnd, ['start_plus', 'start_minus', 'push_plus', 'push_minus']).slice(0, 3).flatMap((k) => { const s = genStory(rnd, k); return [s, s.run]; });
  return [genTwo(rnd, { fuse: 16 }), genMystery(rnd), genRun(rnd, pick(rnd, ['start_minus', 'push_minus']), { max: 100, flipped: true, fuse: 16 }), genTwo(rnd, { fuse: 16 }), genMystery(rnd)];
}
