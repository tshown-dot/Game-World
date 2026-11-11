// Gear Shift (Lesson 4-4: Write and Solve Multiplication and Division Equations): the math.
// No screen code here, so it can be tested with plain node (see test_gear_shift_math.js).
//
// The idea: a hidden drive wheel (the letter) turns, a gear multiplies or divides its speed (× 4), and the output
// wheel spins at 52. The equation is the gearbox: 4n = 52. Shift to the opposite gear (÷ 4) to find n.
//
// Equation kinds (eq.kind):
//   times    k·x = c        (4n = 52)                       x = c ÷ k
//   div      x ÷ k = c      (t ÷ 3 = 10)                    x = c × k
//   twostep  k·x + b = c    (85d + 52 = 562)   boss         undo + b first, then × k
//   half     ½(m·x) = c     (½(8h) = 44)       boss         combine ½ × m first, then undo
// eq.flipped puts the number on the left: 12 = 2y.
// Every answer is a whole number (decimals are Lesson 4-5).

export const SIGN = { '+': '+', '-': '−', '×': '×', '÷': '÷' };
export const OPS = ['+', '-', '×', '÷'];
const INVERSE = { '+': '-', '-': '+', '×': '÷', '÷': '×' };
const near = (a, b) => Math.abs(a - b) < 1e-6;
const about = (a, b) => Math.abs(a - b) < 0.01;   // a rounded typed answer (3.33 for 10 ÷ 3)
let nextId = 1;

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

/** 2392 -> "2,392"; 3.3333 -> "≈3.33"; a negative gets a real minus sign. */
export function fmt(v) {
  if (v < 0) return `−${fmt(-v)}`;
  if (Number.isInteger(Math.round(v * 1e6) / 1e6)) return Math.round(v).toLocaleString('en-US');
  const r = Math.round(v * 100) / 100;
  return `${near(r, v) ? '' : '≈'}${r.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}
/** A typed amount: "2,392", "2392", "$158", "158.00", " 6 ". Returns the number or null. */
export function parseNumber(raw) {
  const t = String(raw ?? '').trim().replace(/^\$/, '').replace(/^\+/, '').replace(/,/g, '').replace(/\s/g, '');
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n < 1e7 ? n : null;
}
/** One step: v op n. */
export function apply(v, op, n) {
  return op === '+' ? v + n : op === '-' ? v - n : op === '×' ? v * n : v / n;
}

/* ================================================================== */
/* Equations                                                           */
/* ================================================================== */
export function makeEq({ kind, letter = 'x', k, b = 0, m = 0, c, flipped = false }) {
  const x = kind === 'times' ? c / k : kind === 'div' ? c * k : kind === 'twostep' ? (c - b) / k : c / (m / 2);
  return { kind, letter, k, b, m, c, x, flipped };
}
/** The gearbox side: "4n", "t ÷ 3", "85d + 52", "½(8h)". */
export function exprText(eq) {
  const L = eq.letter;
  if (eq.kind === 'times') return `${fmt(eq.k)}${L}`;
  if (eq.kind === 'div') return `${L} ÷ ${fmt(eq.k)}`;
  if (eq.kind === 'twostep') return `${fmt(eq.k)}${L} + ${fmt(eq.b)}`;
  return `½(${fmt(eq.m)}${L})`;
}
export const eqText = (eq) => (eq.flipped ? `${fmt(eq.c)} = ${exprText(eq)}` : `${exprText(eq)} = ${fmt(eq.c)}`);
/** What the gearbox puts out when value v goes in. */
export function runForward(eq, v) {
  if (eq.kind === 'times') return eq.k * v;
  if (eq.kind === 'div') return v / eq.k;
  if (eq.kind === 'twostep') return eq.k * v + eq.b;
  return (eq.m / 2) * v;
}
/** The step that undoes the outside gear: times -> ÷ k, div -> × k, twostep -> − b (first). */
export function undoStep(eq) {
  if (eq.kind === 'times') return { op: '÷', n: eq.k };
  if (eq.kind === 'div') return { op: '×', n: eq.k };
  if (eq.kind === 'twostep') return { op: '-', n: eq.b };
  return null;                                         // half: combine first
}
/** After one correct step, what equation is left? twostep -> times; half -> times. */
export function afterStep(eq, value) {
  if (eq.kind === 'twostep') return makeEq({ kind: 'times', letter: eq.letter, k: eq.k, c: value, flipped: eq.flipped });
  if (eq.kind === 'half') return makeEq({ kind: 'times', letter: eq.letter, k: eq.m / 2, c: eq.c, flipped: eq.flipped });
  return null;
}
/** "4 × 13 = 52" style check, written the same way round as the equation. */
export function checkLine(eq, v) {
  const out = runForward(eq, v);
  const L = eq.letter;
  const expr = exprText(eq).replace(`${fmt(eq.k)}${L}`, `${fmt(eq.k)} × ${fmt(v)}`).replace(`${fmt(eq.m)}${L}`, `${fmt(eq.m)} × ${fmt(v)}`).replace(L, fmt(v));
  if (!near(out, eq.c)) return `${expr} = ${fmt(out)}, not ${fmt(eq.c)}`;
  return eq.flipped ? `${fmt(eq.c)} = ${expr}` : `${expr} = ${fmt(eq.c)}`;
}

/* ================================================================== */
/* Stories (from the kinds of problems in the textbook lesson)         */
/* ================================================================== */
// rel: the story in one sentence, used when a written equation does not match it
const SHARES = [
  { letter: 'n', text: (k, c) => `Theresia picked the same number of tomatoes each day. In ${k} days she picked ${fmt(c)}. How many, n, did she pick each day?`, rel: (k, c) => `${k} days of n tomatoes make ${fmt(c)}`, k: [3, 9], x: [6, 25] },
  { letter: 's', text: (k, c) => `${fmt(c)} drama club students ride in ${k} vans, the same number in each van. How many students, s, ride in each van?`, rel: (k, c) => `${k} vans with s students each make ${fmt(c)}`, k: [3, 8], x: [5, 12] },
  { letter: 'w', text: (k, c) => `Lolo typed ${fmt(c)} words in ${k} minutes, the same number each minute. How many words, w, did she type each minute?`, rel: (k, c) => `${k} minutes of w words make ${fmt(c)}`, k: [5, 15], x: [40, 80] },
  { letter: 'm', text: (k, c) => `Felipe earned $${fmt(c)} in ${k} weeks, the same amount each week. How much, m, did he earn each week?`, rel: (k, c) => `${k} weeks of $m make $${fmt(c)}`, k: [4, 12], x: [60, 300] },
  { letter: 'r', text: (k, c) => `Abel uses ${fmt(c)} toothpicks to make ${k} equal rows. How many toothpicks, r, go in each row?`, rel: (k, c) => `${k} rows of r toothpicks make ${fmt(c)}`, k: [6, 18], x: [20, 90] },
  { letter: 'b', text: (k, c) => `The school used ${fmt(c)} pounds of sand. Each bag holds ${k} pounds. How many bags, b, did they use?`, rel: (k, c) => `b bags of ${k} pounds make ${fmt(c)}`, k: [20, 50], x: [30, 130] },
];
// The total is the unknown: x ÷ k = c
const TOTALS = [
  { letter: 'c', text: (k, c) => `Kelsey and her sisters, ${k} girls in all, each spent ${c} hours cleaning. How many hours, c, did they spend in all?`, rel: (k, c) => `c hours shared by ${k} girls is ${c} each`, k: [3, 6], x: [2, 6] },
  { letter: 'p', text: (k, c) => `A pizza was cut into equal slices for ${k} friends. Each friend got ${c} slices. How many slices, p, were there?`, rel: (k, c) => `p slices shared by ${k} friends is ${c} each`, k: [2, 6], x: [2, 4] },
];

/* ================================================================== */
/* Generators                                                          */
/* ================================================================== */
const LETTERS = ['n', 'y', 'm', 't', 'k', 'a', 'w', 'u'];

/** Zone 1: a gearbox to undo (small numbers, the machine works out the answer). */
export function genGear(rnd, { flipped = false, kind = rnd() < 0.5 ? 'times' : 'div' } = {}) {
  const k = int(rnd, 2, 12);
  const c = kind === 'times' ? k * int(rnd, 2, 15) : int(rnd, 2, 15);
  return { id: nextId++, type: 'gear', calc: false, eq: makeEq({ kind, letter: pick(rnd, LETTERS), k, c, flipped }) };
}
/** Zone 3: bigger numbers; the student types the answer after shifting. */
export function genHeavy(rnd, { kind = rnd() < 0.5 ? 'times' : 'div', flipped = false } = {}) {
  let k, c;
  if (kind === 'times') {
    if (flipped) { k = int(rnd, 2, 9) * 100; c = k * int(rnd, 3, 12); }        // 7,200 = 800s
    else { k = int(rnd, 11, 75); c = k * int(rnd, 12, 99); }                  // 23d = 2,392
  } else if (rnd() < 0.5) { k = int(rnd, 101, 250); c = int(rnd, 3, 9); }      // r ÷ 187 = 9
  else { k = int(rnd, 11, 25); c = int(rnd, 21, 99); }                        // y ÷ 11 = 87
  return { id: nextId++, type: 'gear', calc: true, eq: makeEq({ kind, letter: pick(rnd, LETTERS), k, c, flipped }) };
}
/** Zone 2: one story, both equations (× and ÷), then shift. */
export function genTwoWays(rnd, { total = false } = {}) {
  const s = pick(rnd, total ? TOTALS : SHARES);
  const k = int(rnd, s.k[0], s.k[1]), x = int(rnd, s.x[0], s.x[1]);
  const eq = total ? makeEq({ kind: 'div', letter: s.letter, k, c: x }) : makeEq({ kind: 'times', letter: s.letter, k, c: k * x });
  return { id: nextId++, type: 'twoways', calc: false, eq, story: s.text(k, eq.c), rel: s.rel(k, eq.c), tiles: shuffle(rnd, [k, eq.c]) };
}
/** Boss: half off (t ÷ 2 = 79). Write it, shift, type the answer. */
export function genHalf(rnd) {
  const c = int(rnd, 12, 95);
  const eq = makeEq({ kind: 'div', letter: 't', k: 2, c });
  return { id: nextId++, type: 'write', calc: true, eq, half: true, tiles: [2, c],
    story: `Students pay half the daily rate for snorkeling tickets. The student price is $${c}. What is the daily rate, t?`,
    rel: `half of t is $${c}` };
}
/** Boss: the triangle, ½(8h) = 44. Combine, shift, type. */
export function genTriangle(rnd) {
  const m = pick(rnd, [4, 6, 8, 10, 12]), x = int(rnd, 3, 15);
  const eq = makeEq({ kind: 'half', letter: 'h', m, c: (m / 2) * x });
  return { id: nextId++, type: 'half', calc: true, eq,
    story: `A triangle has a base of ${m} cm and an area of ${fmt(eq.c)} square cm. Area = ½ × base × height, so ½(${m}h) = ${fmt(eq.c)}. What is the height, h?` };
}
/** Boss: two steps (85d + 52 = 562). Undo + first, then ×. */
export function genTwoStep(rnd, which = null) {
  const tpls = [
    { letter: 'd', text: (k, b, c) => `Veronica drove ${c} miles: ${k} miles every day, and only ${b} miles on her last day. So ${k}d + ${b} = ${c}. How many full days, d, did she drive ${k} miles?` },
    { letter: 'h', text: (k, b, c) => `A plumber charges $${k} each hour plus a $${b} trip fee. The bill was $${c}: ${k}h + ${b} = ${c}. How many hours, h, did the plumber work?` },
  ];
  const tpl = which === null ? pick(rnd, tpls) : tpls[which];
  const k = int(rnd, 25, 90), x = int(rnd, 3, 9), b = int(rnd, 10, k - 1);
  const eq = makeEq({ kind: 'twostep', letter: tpl.letter, k, b, c: k * x + b });
  return { id: nextId++, type: 'twostep', calc: true, eq, story: tpl.text(k, b, eq.c) };
}

/** Zone 4: which equation fits the story? (equal shares) */
export function genPickEquation(rnd) {
  const s = pick(rnd, SHARES);
  const k = int(rnd, s.k[0], s.k[1]), x = int(rnd, s.x[0], s.x[1]), c = k * x, L = s.letter;
  const right = pick(rnd, [`${k}${L} = ${fmt(c)}`, `${fmt(c)} ÷ ${k} = ${L}`]);
  const options = shuffle(rnd, [
    { text: right, ok: true, trap: null },
    { text: `${L} ÷ ${k} = ${fmt(c)}`, ok: false, trap: 'wrong_relationship' },
    { text: `${k} ÷ ${fmt(c)} = ${L}`, ok: false, trap: 'flipped_division' },
    { text: `${fmt(c)} × ${k} = ${L}`, ok: false, trap: 'multiplied_both' },
  ]);
  return { id: nextId++, type: 'pick', ask: 'equation', story: s.text(k, c), rel: s.rel(k, c), options, eq: makeEq({ kind: 'times', letter: L, k, c }) };
}
export const PROPERTIES = ['Addition Property of Equality', 'Subtraction Property of Equality', 'Multiplication Property of Equality', 'Division Property of Equality'];
/** Zone 4: which property solves it? 8n = 16 -> Division; a ÷ 9 = 2 -> Multiplication. */
export function genPickProperty(rnd) {
  const g = genGear(rnd);
  const ans = g.eq.kind === 'times' ? 3 : 2;
  return { id: nextId++, type: 'pick', ask: 'property', eq: g.eq, options: PROPERTIES.map((t, i) => ({ text: t, ok: i === ans, trap: i === ans ? null : 'wrong_property' })) };
}

export const ZONES = [
  { name: 'Gear Down', blurb: 'Shift to the opposite gear: × undoes ÷, ÷ undoes ×' },
  { name: 'Two Ways', blurb: 'Write a × equation AND a ÷ equation, then shift' },
  { name: 'Heavy Load', blurb: 'Big numbers: shift, then work it out yourself' },
  { name: 'Right Gear', blurb: 'Quick picks: which equation? which property?' },
  { name: 'The Stuck Gearbox', blurb: 'Boss: half off, a triangle and two-step trips' },
];

export function genZone(rnd, zone) {
  if (zone === 0) return shuffle(rnd, [genGear(rnd, { kind: 'times' }), genGear(rnd, { kind: 'div' }), genGear(rnd, { kind: 'times' }), genGear(rnd, { kind: 'div' }),
    genGear(rnd, { kind: 'times', flipped: true }), genGear(rnd, { kind: 'div', flipped: true })]);
  if (zone === 1) return [genTwoWays(rnd), genTwoWays(rnd), genTwoWays(rnd, { total: true }), genTwoWays(rnd)];
  if (zone === 2) return shuffle(rnd, [genHeavy(rnd, { kind: 'times' }), genHeavy(rnd, { kind: 'times' }), genHeavy(rnd, { kind: 'div' }), genHeavy(rnd, { kind: 'div' }), genHeavy(rnd, { kind: 'times', flipped: true })]);
  if (zone === 3) return shuffle(rnd, [genPickEquation(rnd), genPickEquation(rnd), genPickEquation(rnd), genPickEquation(rnd), genPickProperty(rnd), genPickProperty(rnd)]);
  const first = int(rnd, 0, 1);
  return [genHalf(rnd), genTriangle(rnd), genTwoStep(rnd, first), genHeavy(rnd), genTwoStep(rnd, 1 - first)];
}

/** A fresh problem of the same kind, after two misses. */
export function genBackup(rnd, p) {
  if (p.type === 'twoways') return genTwoWays(rnd, { total: p.eq.kind === 'div' });
  if (p.type === 'write') return genHalf(rnd);
  if (p.type === 'half') return genTriangle(rnd);
  if (p.type === 'twostep') return genTwoStep(rnd);
  if (p.type === 'pick') return p.ask === 'property' ? genPickProperty(rnd) : genPickEquation(rnd);
  return p.calc ? genHeavy(rnd, { kind: p.eq.kind, flipped: p.eq.flipped }) : genGear(rnd, { kind: p.eq.kind, flipped: p.eq.flipped });
}

/* ================================================================== */
/* Writing an equation from tiles                                      */
/* ================================================================== */
/**
 * Reads tiles: [{t:'num', v:4}, {t:'op', v:'×'}, {t:'var'}, {t:'eq'}, {t:'num', v:52}]. Each side is one term or
 * "term op term". Returns { ok, ops, value(v) -> [left, right] } or { ok: false }.
 */
export function readTiles(tiles) {
  const at = tiles.findIndex((t) => t.t === 'eq');
  if (at < 0 || tiles.filter((t) => t.t === 'eq').length !== 1 || tiles.filter((t) => t.t === 'var').length !== 1) return { ok: false };
  const sides = [tiles.slice(0, at), tiles.slice(at + 1)];
  for (const s of sides) {
    if (s.length !== 1 && s.length !== 3) return { ok: false };
    if (s[0].t === 'op' || (s.length === 3 && (s[1].t !== 'op' || s[2].t === 'op'))) return { ok: false };
  }
  const ops = new Set(tiles.filter((t) => t.t === 'op').map((t) => t.v));
  const val = (t, v) => (t.t === 'var' ? v : t.v);
  const side = (s, v) => (s.length === 1 ? val(s[0], v) : apply(val(s[0], v), s[1].v, val(s[2], v)));
  const shape = sides.map((s) => s.map((t) => (t.t === 'op' ? t.v : t.t)).join(' '));
  return { ok: true, ops, shape, sides, value: (v) => [side(sides[0], v), side(sides[1], v)] };
}
export function tilesText(tiles, letter) {
  return tiles.map((t) => (t.t === 'num' ? fmt(t.v) : t.t === 'var' ? letter : t.t === 'eq' ? '=' : SIGN[t.v])).join(' ');
}
/** Is this a true equation for the story, using the operation asked for ('×', '÷' or either)? */
export function checkWritten(p, tiles, need = null) {
  const r = readTiles(tiles);
  const L = p.eq.letter;
  if (!r.ok) return { correct: false, nudge: true, key: 'incomplete', message: `Build a whole equation: the letter ${L} once, numbers joined by × or ÷, and one = sign.` };
  if (need && !r.ops.has(need)) return { correct: false, nudge: true, key: 'need_op', message: `This row needs a ${need === '×' ? 'multiplication (×)' : 'division (÷)'} equation.` };
  const [a, b] = r.value(p.eq.x);
  if (near(a, b)) return { correct: true, key: 'correct', message: `Yes! ${tilesText(tiles, L)} says ${p.rel}.` };
  const shapes = r.shape.join(' | ');
  if (p.half && /var × num|num × var/.test(shapes)) {
    return { correct: false, key: 'half_trap', message: `Half of ${L} means ${L} is split into 2 equal parts: ${L} ÷ 2 = ${fmt(p.eq.c)}. Multiplying makes it bigger, not half.` };
  }
  const nums = tiles.filter((t) => t.t === 'num').map((t) => t.v);
  if (/num ÷ var|num ÷ num/.test(shapes) && nums.length === 2 && nums[0] < nums[1] && tiles.findIndex((t) => t.t === 'num') < tiles.findIndex((t) => t.t === 'op' && t.v === '÷')) {
    return { correct: false, key: 'flipped_division', message: `Order matters in division. The bigger total is split up, so it comes first: ${fmt(Math.max(...nums))} ÷ ${fmt(Math.min(...nums))}.` };
  }
  if (/num × num/.test(shapes)) return { correct: false, key: 'multiplied_both', message: `Multiplying the two numbers makes something far too big. Say it in words: ${p.rel}.` };
  if (/var ÷ num/.test(shapes) && p.eq.kind === 'times') return { correct: false, key: 'wrong_relationship', message: `${L} is how many in EACH group, so it is the smaller number. Say it in words: ${p.rel}.` };
  return { correct: false, key: 'check_fails', message: `That doesn't match the story. Say it in words: ${p.rel}.` };
}

/* ================================================================== */
/* Shifting gears and working it out                                   */
/* ================================================================== */
/** The student drops a gear (op, n) on the output. Returns what comes out and whether the check works. */
export function checkGear(eq, op, n) {
  const step = undoStep(eq);
  const value = apply(eq.c, op, n);
  const correct = op === step.op && near(n, step.n);
  const L = eq.letter;
  const fix = `${SIGN[step.op]} ${fmt(step.n)}`;
  let key = 'correct', message = `Shifted to ${fix}.`;
  if (!correct) {
    if (eq.kind === 'twostep' && op === '÷' && near(n, eq.k)) {
      key = 'twostep_order'; message = `The + ${fmt(eq.b)} happened LAST, so undo it FIRST: ${fix}. Then undo the × ${fmt(eq.k)}.`;
    } else if (eq.kind !== 'twostep' && op === (eq.kind === 'times' ? '×' : '÷') && near(n, eq.k)) {
      key = 'did_not_undo'; message = `The gearbox already ${eq.kind === 'times' ? 'MULTIPLIES' : 'DIVIDES'} by ${fmt(eq.k)}. Doing it again gives ${fmt(value)}. Shift to the opposite gear: ${fix}.`;
    } else if (eq.kind === 'times' && (op === '-' || op === '+') && near(n, eq.k)) {
      key = 'add_sub_with_coefficient'; message = `${fmt(eq.k)}${L} means ${fmt(eq.k)} TIMES ${L}, not ${fmt(eq.k)} plus ${L}. Undo times with divide: ${fix}.`;
    } else if (near(n, eq.c)) {
      key = 'used_total'; message = `That used the output, ${fmt(eq.c)}. Shift by the gear in the box instead: ${fix}.`;
    } else if (op === step.op) {
      key = 'wrong_amount'; message = `Right kind of gear, wrong size. Undo exactly the gear in the box: ${fix}.`;
    } else {
      key = 'wrong_op'; message = `${eq.kind === 'times' ? 'Undo multiplying with dividing' : eq.kind === 'div' ? 'Undo dividing with multiplying' : `Undo the + ${fmt(eq.b)} with − ${fmt(eq.b)}`}: ${fix}.`;
    }
  }
  return { correct, key, message, value };
}
/** After the right gear, the student works out c op n themselves (Heavy Load and the boss). */
export function checkCalc(c, op, n, raw) {
  const v = parseNumber(raw);
  if (v === null) return { correct: false, nudge: true, key: 'not_a_number', message: 'Type a number.' };
  const want = apply(c, op, n);
  const sum = `${fmt(c)} ${SIGN[op]} ${fmt(n)}`;
  if (near(v, want)) return { correct: true, key: 'correct', value: v, message: `${sum} = ${fmt(want)}.` };
  if (op === '÷' && about(v, c * n)) return { correct: false, key: 'multiplied_instead', value: v, message: `That's ${fmt(c)} × ${fmt(n)}. The gear says DIVIDE: ${sum}.` };
  if (op === '×' && about(v, c / n)) return { correct: false, key: 'divided_instead', value: v, message: `That's ${fmt(c)} ÷ ${fmt(n)}. The gear says MULTIPLY: ${sum}.` };
  if (op === '÷' && about(v, n / c)) return { correct: false, key: 'flipped_division', value: v, message: `That's ${fmt(n)} ÷ ${fmt(c)}, the wrong way round. Divide the bigger total: ${sum}.` };
  if ([10, 100, 0.1, 0.01].some((f) => near(v, want * f))) return { correct: false, key: 'place_value', value: v, message: `Close, but the place value is off. Estimate first: ${sum} should be about ${fmt(Math.round(want / 10 ** Math.floor(Math.log10(want))) * 10 ** Math.floor(Math.log10(want)))}.` };
  return { correct: false, key: 'arith', value: v, message: `Check your ${op === '÷' ? 'division' : op === '×' ? 'multiplication' : 'subtraction'}: ${sum} is not ${fmt(v)}. Work it again.` };
}
/** Boss triangle: ½ × m first. */
export function checkHalf(eq, raw) {
  const v = parseNumber(raw);
  if (v === null) return { correct: false, nudge: true, key: 'not_a_number', message: 'Type a number.' };
  const want = eq.m / 2;
  if (near(v, want)) return { correct: true, key: 'correct', message: `½ × ${eq.m} = ${fmt(want)}, so the gearbox is ${fmt(want)}${eq.letter} = ${fmt(eq.c)}.` };
  if (near(v, eq.m * 2)) return { correct: false, key: 'half_trap', message: `Half of ${eq.m} is smaller than ${eq.m}: ½ × ${eq.m} = ${eq.m} ÷ 2.` };
  return { correct: false, key: 'combine_error', message: `½ × ${eq.m} means half of ${eq.m}. What is ${eq.m} ÷ 2?` };
}
/** Zone 4 picks. */
export function checkPick(p, i) {
  const o = p.options[i];
  const right = p.options.find((x) => x.ok);
  if (o.ok) return { correct: true, key: 'correct', message: p.ask === 'property' ? `Yes! ${eqText(p.eq)} is undone with ${SIGN[undoStep(p.eq).op]} ${fmt(p.eq.k)}: the ${o.text}.` : `Yes! ${o.text} says ${p.rel}.` };
  const msg = {
    wrong_relationship: `${p.eq.letter} is how many in EACH group, the smaller number. ${right.text} says ${p.rel}.`,
    flipped_division: `${o.text} divides the small number by the big one. Split the total: ${right.text}.`,
    multiplied_both: `${o.text} multiplies the two numbers, far too big. ${right.text} says ${p.rel}.`,
    wrong_property: `${eqText(p.eq)} is undone with ${SIGN[undoStep(p.eq).op]} ${fmt(p.eq.k)}, so use the ${right.text}.`,
  }[o.trap];
  return { correct: false, key: o.trap, message: msg };
}

/* ================================================================== */
/* Worked solutions (after two misses)                                 */
/* ================================================================== */
export function workedSolution(p) {
  const eq = p.eq, L = eq.letter;
  if (p.type === 'pick') {
    const right = p.options.find((x) => x.ok).text;
    if (p.ask === 'property') return [`${eqText(eq)}: the gear is ${eq.kind === 'times' ? `× ${eq.k}` : `÷ ${eq.k}`}.`, `Undo it with ${SIGN[undoStep(eq).op]} ${fmt(eq.k)} on both sides.`, `That is the ${right}.`];
    return [`In words: ${p.rel}.`, `As an equation: ${right}.`, `Check: ${L} = ${fmt(eq.x)} makes it true ✓`];
  }
  const lines = [];
  if (p.type === 'twoways') {
    lines.push(eq.kind === 'times' ? `× equation: ${fmt(eq.k)}${L} = ${fmt(eq.c)}` : `× equation: ${fmt(eq.k)} × ${fmt(eq.c)} = ${L}`);
    lines.push(eq.kind === 'times' ? `÷ equation: ${fmt(eq.c)} ÷ ${fmt(eq.k)} = ${L}` : `÷ equation: ${L} ÷ ${fmt(eq.k)} = ${fmt(eq.c)}`);
  } else if (p.type === 'write') lines.push(`Write it: ${eqText(eq)} (${p.rel})`);
  let e = eq;
  if (eq.kind === 'half') { e = afterStep(eq); lines.push(`Combine: ½ × ${eq.m} = ${fmt(e.k)}, so ${eqText(e)}`); }
  if (eq.kind === 'twostep') {
    const left = eq.c - eq.b;
    lines.push(`Undo + ${fmt(eq.b)} first: ${fmt(eq.c)} − ${fmt(eq.b)} = ${fmt(left)}, so ${fmt(eq.k)}${L} = ${fmt(left)}`);
    e = afterStep(eq, left);
  }
  const s = undoStep(e);
  lines.push(`Undo ${e.kind === 'times' ? `× ${fmt(e.k)} with ÷ ${fmt(e.k)}` : `÷ ${fmt(e.k)} with × ${fmt(e.k)}`} on both sides: ${fmt(e.c)} ${SIGN[s.op]} ${fmt(s.n)} = ${fmt(e.x)}`);
  lines.push(`${L} = ${fmt(eq.x)}`);
  lines.push(`Check: ${checkLine(eq, eq.x)} ✓`);
  return lines;
}
