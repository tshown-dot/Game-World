// Food Truck (Lesson 4-5: Write and Solve Equations with Rational Numbers): the math.
// No screen code here, so it can be tested with plain node (see test_food_truck_math.js).
//
// Every number is kept as an exact fraction { n, d } so 0.1 + 0.2 is exactly 0.3 and 1/3 stays 1/3.
// Equation kinds (eq.kind), with a and c fractions:
//   plus   x + a = c  (or a + x)      x = c − a
//   minus  x − a = c                  x = c + a
//   times  a·x = c                    x = c ÷ a  (or c × the reciprocal of a)
//   div    x ÷ a = c                  x = c × a
// eq.flipped puts c on the left. eq.style says how numbers are shown: 'money' | 'decimal' | 'fraction'.

/* ================================================================== */
/* Exact fractions                                                     */
/* ================================================================== */
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
export function fr(n, d = 1) {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
export const add = (a, b) => fr(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a, b) => fr(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a, b) => fr(a.n * b.n, a.d * b.d);
export const div = (a, b) => fr(a.n * b.d, a.d * b.n);
export const same = (a, b) => a.n === b.n && a.d === b.d;
export const value = (a) => a.n / a.d;
export const recip = (a) => fr(a.d, a.n);
export const dec = (x, places = 2) => fr(Math.round(x * 10 ** places), 10 ** places);   // 5.43 -> 543/100
export const OPS = { '+': add, '-': sub, '×': mul, '÷': div };
export const SIGN = { '+': '+', '-': '−', '×': '×', '÷': '÷' };
export const apply = (a, op, b) => OPS[op](a, b);

/** Does this fraction have an exact decimal (denominator made only of 2s and 5s)? */
function terminates(a) {
  let d = a.d;
  while (d % 2 === 0) d /= 2;
  while (d % 5 === 0) d /= 5;
  return d === 1;
}
/** 9/4 as "2.25" (decimal), "2.25" (money keeps 2 places: "7.50"), or "2 1/4" (fraction). */
export function show(a, style = 'fraction') {
  if (a.n < 0) return `−${show(fr(-a.n, a.d), style)}`;
  if (style !== 'fraction' && terminates(a)) {
    const v = value(a);
    if (style === 'money') return v.toFixed(Number.isInteger(v) ? 0 : 2);
    return String(Math.round(v * 1e6) / 1e6);
  }
  if (a.d === 1) return String(a.n);
  const whole = Math.floor(a.n / a.d), rest = a.n - whole * a.d;
  return whole ? `${whole} ${rest}/${a.d}` : `${rest}/${a.d}`;
}
/**
 * A typed answer: "2.25", "$2.25", "2 1/4", "9/4", "18/8", ".5", "7." Returns a fraction or null.
 * Any equal value counts: 2.25, 2 1/4, 9/4 and 18/8 are all the same number.
 */
export function parseAnswer(raw) {
  const t = String(raw ?? '').trim().replace(/^\$/, '').replace(/,/g, '').replace(/\s+/g, ' ');
  let m;
  if ((m = t.match(/^(\d+) (\d+)\/(\d+)$/))) return Number(m[3]) ? add(fr(Number(m[1])), fr(Number(m[2]), Number(m[3]))) : null;
  if ((m = t.match(/^(\d+)\/(\d+)$/))) return Number(m[2]) ? fr(Number(m[1]), Number(m[2])) : null;
  if ((m = t.match(/^(\d*)\.?(\d*)$/)) && /\d/.test(t)) {
    const places = m[2].length;
    if (places > 6) return null;
    return fr(Number(`${m[1] || 0}${m[2]}`), 10 ** places);
  }
  return null;
}

/* ================================================================== */
/* Equations                                                           */
/* ================================================================== */
export function makeEq({ kind, letter = 'x', a, c, flipped = false, letterFirst = true, style = 'decimal' }) {
  const x = kind === 'plus' ? sub(c, a) : kind === 'minus' ? add(c, a) : kind === 'times' ? div(c, a) : mul(c, a);
  return { kind, letter, a, c, x, flipped, letterFirst, style };
}
/** a shown as a coefficient: 3t, 1.8x, (2/3)y */
function coef(eq) {
  const s = show(eq.a, eq.style === 'money' ? 'decimal' : eq.style);
  return eq.a.d === 1 || (eq.style !== 'fraction' && terminates(eq.a)) ? s : `(${s})`;
}
export function exprText(eq) {
  const L = eq.letter, a = show(eq.a, eq.style);
  if (eq.kind === 'plus') return eq.letterFirst ? `${L} + ${a}` : `${a} + ${L}`;
  if (eq.kind === 'minus') return `${L} − ${a}`;
  if (eq.kind === 'times') return `${coef(eq)}${L}`;
  return `${L} ÷ ${a}`;
}
export const eqText = (eq) => (eq.flipped ? `${show(eq.c, eq.style)} = ${exprText(eq)}` : `${exprText(eq)} = ${show(eq.c, eq.style)}`);
export function runForward(eq, v) {
  return eq.kind === 'plus' ? add(v, eq.a) : eq.kind === 'minus' ? sub(v, eq.a) : eq.kind === 'times' ? mul(eq.a, v) : div(v, eq.a);
}
export function undoStep(eq) {
  return { plus: { op: '-', n: eq.a }, minus: { op: '+', n: eq.a }, times: { op: '÷', n: eq.a }, div: { op: '×', n: eq.a } }[eq.kind];
}
/** "2.6 × ... = ..." check line, the same way round as the equation. */
export function checkLine(eq, v) {
  const out = runForward(eq, v), s = (q) => show(q, eq.style);
  const L = eq.letter;
  let expr = exprText(eq);
  expr = eq.kind === 'times' ? `${coef(eq)} × ${s(v)}` : expr.replace(L, s(v));
  if (!same(out, eq.c)) return `${expr} = ${s(out)}, not ${s(eq.c)}`;
  return eq.flipped ? `${s(eq.c)} = ${expr}` : `${expr} = ${s(eq.c)}`;
}

/* ================================================================== */
/* Generators                                                          */
/* ================================================================== */
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
const LETTERS = ['m', 't', 'y', 'x', 'r', 'v', 'k', 'z'];
const cents = (rnd, lo, hi) => fr(int(rnd, lo * 100, hi * 100), 100);
/** Fraction families: the two numbers in one problem share a family, so a common denominator is at most 12. */
const FAMILIES = [[2, 4, 8], [3, 6, 12], [2, 5, 10], [2, 4, 12], [3, 6]];
/** A fraction (maybe a mixed number up to maxWhole) whose denominator comes from `dens`. */
function fraction(rnd, maxWhole, dens = [2, 3, 4, 5, 6, 8, 10, 12]) {
  const d = pick(rnd, dens);
  return add(fr(int(rnd, 0, maxWhole)), fr(int(rnd, 1, d - 1), d));
}
const family = (rnd) => pick(rnd, FAMILIES);
const prob = (type, eq, extra = {}) => ({ id: nextId++, type, eq, ...extra });

/** Zone 1: money and decimals, + and −. Two are story tickets. */
export function genRegister(rnd, { kind = rnd() < 0.5 ? 'plus' : 'minus', flipped = false } = {}) {
  const a = cents(rnd, 1, 30), x = cents(rnd, 1, 30);
  const c = kind === 'plus' ? add(x, a) : sub(x, a);
  if (value(c) <= 0) return genRegister(rnd, { kind, flipped });
  return prob('solve', makeEq({ kind, letter: pick(rnd, LETTERS), a, c, flipped, letterFirst: rnd() < 0.7, style: 'decimal' }));
}
const MONEY_STORIES = [
  { letter: 'c', make: (rnd) => { const a = cents(rnd, 2, 9), x = cents(rnd, 2, 9); return { eq: makeEq({ kind: 'plus', letter: 'c', a, c: add(a, x), letterFirst: false, style: 'money' }),
    story: (e) => `Carmen spent $${show(e.c, 'money')} on a notebook and a compass. The notebook cost $${show(e.a, 'money')}. What did the compass, c, cost?` }; } },
  { letter: 'b', make: (rnd) => { const a = cents(rnd, 8, 15), x = cents(rnd, 8, 15); return { eq: makeEq({ kind: 'plus', letter: 'b', a, c: add(a, x), letterFirst: false, style: 'money' }),
    story: (e) => `Lorna's team shirt cost $${show(e.a, 'money')}. Lorna and Ben paid $${show(e.c, 'money')} for both shirts. What did Ben's shirt, b, cost?` }; } },
  { letter: 't', make: (rnd) => { const a = cents(rnd, 3, 12), x = cents(rnd, 12, 30); return { eq: makeEq({ kind: 'minus', letter: 't', a, c: sub(x, a), style: 'money' }),
    story: (e) => `After paying $${show(e.a, 'money')} for lunch, Ana had $${show(e.c, 'money')} left. How much money, t, did she start with?` }; } },
];
const PRICE_STORIES = [
  { make: (rnd) => { const k = int(rnd, 3, 9), p = cents(rnd, 0.35, 1.5); return { eq: makeEq({ kind: 'times', letter: 'm', a: fr(k), c: mul(fr(k), p), style: 'money' }),
    story: (e) => `Molly bought ${show(e.a)} oranges for $${show(e.c, 'money')}. She paid the same for each. What did each orange, m, cost?` }; } },
  { make: (rnd) => { const k = int(rnd, 3, 6), p = fr(int(rnd, 20, 70)); return { eq: makeEq({ kind: 'times', letter: 't', a: fr(k), c: mul(fr(k), p), style: 'money' }),
    story: (e) => `Mr. Marlon bought ${show(e.a)} water park tickets for $${show(e.c, 'money')}. Each ticket cost the same. What did each ticket, t, cost?` }; } },
  { make: (rnd) => { const w = fr(4 * int(rnd, 6, 20)); return { eq: makeEq({ kind: 'times', letter: 'w', a: fr(9, 4), c: mul(fr(9, 4), w), style: 'decimal' }),
    story: (e) => `In one study, the number of women who were supertasters was 2.25 times the number of men. ${show(e.c)} women were supertasters. How many men, w?` }; } },
];
const RECIPE_STORIES = [
  { make: (rnd) => { const whole = fr(int(rnd, 4, 8)), a = fraction(rnd, 3); return { eq: makeEq({ kind: 'plus', letter: 's', a, c: whole, letterFirst: false, style: 'fraction' }),
    story: (e) => `A ${show(e.c)}-foot fruit snack is cut into two pieces. One piece is ${show(e.a)} feet long. How long is the other piece, s?` }; } },
  { make: (rnd) => { const f = family(rnd), a = fraction(rnd, 4, f), x = fraction(rnd, 4, f); return { eq: makeEq({ kind: 'plus', letter: 'm', a, c: add(a, x), letterFirst: false, style: 'fraction' }),
    story: (e) => `Yelena needs to swim ${show(e.c)} miles this week. So far she has swum ${show(e.a)} miles. How many more miles, m, does she need?` }; } },
  { make: (rnd) => { const f = family(rnd), a = fraction(rnd, 4, f), left = fraction(rnd, 4, f); return { eq: makeEq({ kind: 'minus', letter: 'f', a, c: left, style: 'fraction' }),
    story: (e) => `The cook used ${show(e.a)} cups of flour and has ${show(e.c)} cups left. How much flour, f, was in the bag?` }; } },
];

/** Story ticket: the student first picks the equation that fits, then solves it. */
function storyProblem(rnd, tpl) {
  const { eq, story } = tpl.make(rnd);
  const L = eq.letter, a = show(eq.a, eq.style), c = show(eq.c, eq.style);
  const right = eqText(eq);
  const wrongs = {
    plus: [`${L} − ${a} = ${c}`, `${a} + ${c} = ${L}`],
    minus: [`${L} + ${a} = ${c}`, `${a} − ${L} = ${c}`],
    times: [`${L} ÷ ${a} = ${c}`, `${c} × ${a} = ${L}`],
  }[eq.kind];
  const options = shuffle(rnd, [{ text: right, ok: true }, ...wrongs.map((text) => ({ text, ok: false }))]);
  return prob('story', eq, { story: story(eq), options });
}
export const genMoneyStory = (rnd) => storyProblem(rnd, pick(rnd, MONEY_STORIES));
export const genPriceStory = (rnd) => storyProblem(rnd, pick(rnd, PRICE_STORIES));
export const genRecipeStory = (rnd) => storyProblem(rnd, pick(rnd, RECIPE_STORIES));

/** Zone 2: × and ÷ with decimals. 1.8x = 40.14, r ÷ 5.5 = 18.2 */
export function genPrice(rnd, { kind = rnd() < 0.6 ? 'times' : 'div', flipped = false } = {}) {
  const a = dec(int(rnd, 12, 48) / 10, 1);
  const x = rnd() < 0.5 ? dec(int(rnd, 11, 99) / 10, 1) : fr(int(rnd, 3, 40));
  const c = kind === 'times' ? mul(a, x) : div(x, a);
  if (!terminates(c) || c.d > 1000) return genPrice(rnd, { kind, flipped });
  return prob('solve', makeEq({ kind, letter: pick(rnd, LETTERS), a, c, flipped, style: 'decimal' }));
}
/** Zone 3: + and − with fractions and mixed numbers (borrowing on purpose some of the time). */
export function genRecipe(rnd, { kind = rnd() < 0.5 ? 'plus' : 'minus', flipped = false } = {}) {
  const f = family(rnd);
  const a = fraction(rnd, 4, f), x = fraction(rnd, 6, f);
  const c = kind === 'plus' ? add(x, a) : sub(x, a);
  if (value(c) <= 0) return genRecipe(rnd, { kind, flipped });
  return prob('solve', makeEq({ kind, letter: pick(rnd, LETTERS), a, c, flipped, letterFirst: rnd() < 0.7, style: 'fraction' }));
}
/** Zone 4: × and ÷ by a fraction. Predict bigger or smaller first, then use the reciprocal. */
export function genBatch(rnd, { kind = rnd() < 0.7 ? 'times' : 'div', story = false } = {}) {
  if (story) {                                         // Helen's pool: 1 5/8 gallons a trip
    const per = pick(rnd, [fr(13, 8), fr(3, 2), fr(5, 4), fr(7, 4)]), trips = fr(int(rnd, 4, 12));
    const eq = makeEq({ kind: 'times', letter: 't', a: per, c: mul(per, trips), style: 'fraction' });
    return prob('predict', eq, { story: `Helen carries ${show(per)} gallons of water each trip. The pool holds ${show(eq.c)} gallons. How many trips, t, does she need?` });
  }
  const a = pick(rnd, [fr(1, 2), fr(2, 3), fr(3, 4), fr(3, 5), fr(5, 6), fr(3, 8), fr(3, 2), fr(4, 3), fr(5, 4), fr(5, 2)]);
  // times: x is a whole number or a fraction over a's top number; div: c is a small whole number, so x = c × a is friendly
  const c = kind === 'times'
    ? mul(a, rnd() < 0.6 || a.n === 1 ? fr(int(rnd, 2, 15)) : fraction(rnd, 3, [a.n]))   // x's bottom cancels a's top
    : fr(int(rnd, 2, 12));
  return prob('predict', makeEq({ kind, letter: pick(rnd, LETTERS), a, c, style: 'fraction' }));
}
/** Boss: which value makes it true? (0.26y = 0.676, 0.435 + x = 0.92) */
export function genChoose(rnd, kind = rnd() < 0.5 ? 'times' : 'plus') {
  if (kind === 'times') {
    const a = dec(int(rnd, 11, 89) / 100), x = dec(int(rnd, 12, 49) / 10, 1);
    const eq = makeEq({ kind, letter: 'y', a, c: mul(a, x), style: 'decimal' });
    const opts = [{ v: x, ok: true }, { v: mul(eq.c, a), trap: 'multiplied_by_coef' }, { v: a, trap: 'copied_number' }, { v: mul(x, fr(10)), trap: 'place_value' }];
    return prob('choose', eq, { options: shuffle(rnd, opts).map((o) => ({ ...o, text: `y = ${show(o.v, 'decimal')}` })) });
  }
  const a = dec(int(rnd, 101, 499) / 1000, 3), x = dec(int(rnd, 101, 499) / 1000, 3);
  const eq = makeEq({ kind, letter: 'x', a, c: add(a, x), style: 'decimal' });
  const opts = [{ v: x, ok: true }, { v: add(eq.c, a), trap: 'did_not_undo' }, { v: add(x, fr(1, 100)), trap: 'off_a_bit' }, { v: sub(x, fr(1, 100)), trap: 'off_a_bit' }];
  return prob('choose', eq, { options: shuffle(rnd, opts).map((o) => ({ ...o, text: `x = ${show(o.v, 'decimal')}` })) });
}
/** Boss: Johnny added 3.5 to only one side. Find the mistake, then solve it properly. */
export function genCritique(rnd) {
  const a = dec(int(rnd, 11, 89) / 10, 1), c = dec(int(rnd, 11, 99) / 10, 1);
  const eq = makeEq({ kind: 'minus', letter: 'x', a, c, style: 'decimal' });
  const options = shuffle(rnd, [
    { text: `He must add ${show(a, 'decimal')} to BOTH sides`, ok: true },
    { text: `He should subtract ${show(a, 'decimal')} instead`, trap: 'critique_subtract' },
    { text: 'Nothing: he is right', trap: 'critique_fine' },
    { text: `He should multiply by ${show(a, 'decimal')}`, trap: 'critique_multiply' },
  ]);
  return prob('critique', eq, { story: `Johnny solved ${eqText(eq)} by adding ${show(a, 'decimal')} to the LEFT side only. What went wrong?`, options });
}

export const ZONES = [
  { name: 'Cash Register', blurb: 'Money and decimals: + and −' },
  { name: 'Price Per Item', blurb: 'Decimals: × and ÷' },
  { name: 'Recipe Card', blurb: 'Fractions and mixed numbers: + and −' },
  { name: 'Batch Math', blurb: 'Predict, then multiply by the reciprocal' },
  { name: 'Lunch Rush', blurb: 'Boss: a mixed line, plus find the mistake' },
];
export function genZone(rnd, zone) {
  if (zone === 0) return shuffle(rnd, [genRegister(rnd, { kind: 'plus' }), genRegister(rnd, { kind: 'minus' }), genRegister(rnd, { flipped: true }), genRegister(rnd), genMoneyStory(rnd), genMoneyStory(rnd)]);
  if (zone === 1) return shuffle(rnd, [genPrice(rnd, { kind: 'times' }), genPrice(rnd, { kind: 'div' }), genPrice(rnd, { flipped: true }), genPriceStory(rnd), genPriceStory(rnd)]);
  if (zone === 2) return shuffle(rnd, [genRecipe(rnd, { kind: 'plus' }), genRecipe(rnd, { kind: 'minus' }), genRecipe(rnd, { flipped: true }), genRecipeStory(rnd), genRecipeStory(rnd)]);
  if (zone === 3) return shuffle(rnd, [genBatch(rnd, { kind: 'times' }), genBatch(rnd, { kind: 'times' }), genBatch(rnd, { kind: 'div' }), genBatch(rnd), genBatch(rnd, { story: true })]);
  return [genChoose(rnd, 'times'), genCritique(rnd), genPriceStory(rnd), genRecipeStory(rnd), genChoose(rnd, 'plus')];
}
export function genBackup(rnd, p) {
  if (p.type === 'choose') return genChoose(rnd, p.eq.kind);
  if (p.type === 'critique') return genCritique(rnd);
  if (p.type === 'predict') return genBatch(rnd, { kind: p.eq.kind, story: Boolean(p.story) });
  if (p.type === 'story') return p.eq.style === 'money' && (p.eq.kind === 'plus' || p.eq.kind === 'minus') ? genMoneyStory(rnd) : p.eq.style === 'fraction' ? genRecipeStory(rnd) : genPriceStory(rnd);
  if (p.eq.style === 'fraction') return genRecipe(rnd, { kind: p.eq.kind, flipped: p.eq.flipped });
  if (p.eq.kind === 'times' || p.eq.kind === 'div') return genPrice(rnd, { kind: p.eq.kind, flipped: p.eq.flipped });
  return genRegister(rnd, { kind: p.eq.kind, flipped: p.eq.flipped });
}

/* ================================================================== */
/* Checking                                                            */
/* ================================================================== */
/** The opposite block. For × and ÷ by a fraction, dividing and multiplying by the reciprocal both count. */
export function checkBlock(eq, op, n) {
  const step = undoStep(eq);
  const recipOp = { '×': '÷', '÷': '×' }[step.op];
  const correct = (op === step.op && same(n, step.n)) || (recipOp && op === recipOp && same(n, recip(step.n)));
  const s = (q) => show(q, eq.style);
  const fix = `${SIGN[step.op]} ${s(step.n)}${eq.kind === 'times' && eq.a.d > 1 && eq.style === 'fraction' ? ` (or × ${show(recip(eq.a))}, the reciprocal)` : ''}`;
  if (correct) return { correct, key: 'correct', message: `Right block: ${SIGN[op]} ${s(n)}.` };
  const doing = { plus: `ADDS ${s(eq.a)}`, minus: `TAKES AWAY ${s(eq.a)}`, times: `MULTIPLIES BY ${s(eq.a)}`, div: `DIVIDES BY ${s(eq.a)}` }[eq.kind];
  const sameOp = { plus: '+', minus: '-', times: '×', div: '÷' }[eq.kind];
  if (op === sameOp && same(n, eq.a)) {
    if (eq.kind === 'times' && eq.style === 'fraction') return { correct: false, key: 'not_reciprocal', message: `Multiplying by ${s(eq.a)} again won't undo it. Multiply by the RECIPROCAL, ${show(recip(eq.a))} (flip it), or divide by ${s(eq.a)}.` };
    return { correct: false, key: 'did_not_undo', message: `The ticket ${doing}. Doing that again won't undo it. Use the opposite: ${fix}.` };
  }
  if (same(n, eq.c)) return { correct: false, key: 'used_total', message: `That used the total, ${s(eq.c)}. Undo the step done to ${eq.letter}: ${fix}.` };
  if (op === step.op || op === recipOp) return { correct: false, key: 'wrong_amount', message: `Right kind of block, wrong amount. The ticket ${doing}, so use ${fix}.` };
  return { correct: false, key: 'wrong_op', message: `The ticket ${doing}. Undo it with the opposite: ${fix}.` };
}

/** The student works out c op n. */
export function checkCalc(eq, op, n, raw) {
  const v = parseAnswer(raw);
  if (!v) return { correct: false, nudge: true, key: 'not_a_number', message: 'Type a number, like 2.25, 2 1/4 or 9/4.' };
  const want = apply(eq.c, op, n);
  const s = (q) => show(q, eq.style);
  const sum = `${s(eq.c)} ${SIGN[op]} ${s(n)}`;
  if (same(v, want)) {
    const simplest = eq.style === 'fraction' ? show(want) : s(want);
    return { correct: true, key: 'correct', value: v, message: `${sum} = ${simplest}.${eq.style === 'fraction' && raw.trim() !== simplest ? ` (Simplest form: ${simplest}.)` : ''}` };
  }
  const near = (q) => Math.abs(value(v) - value(q)) < 0.006;
  const shifted = (f) => Math.abs(value(v) - value(want) * f) <= 1e-6 * Math.abs(value(want) * f);   // same digits, decimal point moved
  if (eq.style !== 'fraction' && value(v) !== 0 && [10, 100, 1 / 10, 1 / 100].some(shifted)) {
    return { correct: false, key: 'place_value', value: v, message: `The digits look right but the decimal point moved. Estimate: ${sum} is about ${Math.round(value(want) * 10) / 10}.` };
  }
  if (op === '×' || op === '÷') {
    const other = apply(eq.c, op === '×' ? '÷' : '×', n);
    if (near(other)) return { correct: false, key: 'not_reciprocal', value: v, message: `That ${op === '×' ? 'divided' : 'multiplied'} instead. The block says ${SIGN[op]} ${s(n)}: ${sum}.` };
    return { correct: false, key: eq.style === 'fraction' ? 'fraction_times' : 'decimal_times', value: v,
      message: eq.style === 'fraction' ? `Multiply tops and bottoms: ${sum}. (To divide by a fraction, multiply by its reciprocal.)` : `Check it: does ${checkLine(eq, v).split(',')[0]}? Count the decimal places in your answer.` };
  }
  if (near(apply(eq.c, op === '+' ? '-' : '+', n))) return { correct: false, key: 'added_instead', value: v, message: `That ${op === '+' ? 'subtracted' : 'added'}. The block says ${SIGN[op]} ${s(n)}: ${sum}.` };
  if (eq.style === 'fraction') {
    const wholeOnly = fr(Math.floor(value(eq.c)) + (op === '+' ? 1 : -1) * Math.floor(value(n)));
    const fa = sub(eq.c, fr(Math.floor(value(eq.c)))), fb = sub(n, fr(Math.floor(value(n))));
    const sloppy = add(wholeOnly, op === '-' ? fr(Math.abs(fa.n * fb.d - fb.n * fa.d), fa.d * fb.d) : add(fa, fb));
    if (op === '-' && value(fa) < value(fb) && same(v, sloppy)) {
      return { correct: false, key: 'mixed_borrow', value: v, message: `The fraction part of ${s(eq.c)} is smaller than ${show(fb)}, so borrow 1 whole first (or change both to improper fractions): ${sum}.` };
    }
    if (eq.c.d !== n.d && v.d === eq.c.d + n.d) return { correct: false, key: 'add_denominators', value: v, message: `Don't add or subtract the bottoms. Use a common denominator first: ${sum}.` };
    return { correct: false, key: 'common_denominator', value: v, message: `Rename both with a common denominator, then ${op === '+' ? 'add' : 'subtract'}: ${sum}.` };
  }
  return { correct: false, key: 'decimal_align', value: v, message: `Line up the decimal points (write ${s(eq.c)} and ${s(n)} with the same number of places), then ${op === '+' ? 'add' : 'subtract'}.` };
}

/** Zone 4: will the answer be bigger or smaller than the number it equals? */
export function checkPredict(eq, saysBigger) {
  const shrinks = eq.kind === 'times' ? value(eq.a) > 1 : value(eq.a) < 1;   // x = c ÷ a  or  x = c × a
  const bigger = !shrinks;
  const s = (q) => show(q, eq.style);
  const why = eq.kind === 'times'
    ? `${eq.letter} times ${s(eq.a)} gives ${s(eq.c)}. Multiplying by ${value(eq.a) < 1 ? 'less' : 'more'} than 1 makes a number ${value(eq.a) < 1 ? 'smaller' : 'bigger'}, so ${eq.letter} is ${bigger ? 'BIGGER' : 'SMALLER'} than ${s(eq.c)}.`
    : `${eq.letter} divided by ${s(eq.a)} gives ${s(eq.c)}. Dividing by ${value(eq.a) < 1 ? 'less' : 'more'} than 1 makes a number ${value(eq.a) < 1 ? 'bigger' : 'smaller'}, so ${eq.letter} is ${bigger ? 'BIGGER' : 'SMALLER'} than ${s(eq.c)}.`;
  if (saysBigger === bigger) return { correct: true, key: 'correct', message: `Good prediction! ${why}` };
  return { correct: false, key: 'mult_makes_bigger', message: `Not always! ${why}` };
}
/** Story and critique tickets: pick an option. */
export function checkOption(p, i) {
  const o = p.options[i], right = p.options.find((x) => x.ok);
  if (o.ok) {
    if (p.type === 'critique') return { correct: true, key: 'correct', message: `Yes! Whatever you do to one side, do to the other. Now solve it properly.` };
    if (p.type === 'choose') return { correct: true, key: 'correct', message: `Yes! Check: ${checkLine(p.eq, o.v)} ✓` };
    return { correct: true, key: 'correct', message: `Yes! ${o.text} fits the story.` };
  }
  if (p.type === 'choose') {
    const tip = { multiplied_by_coef: 'That multiplied instead of dividing.', copied_number: 'That is a number from the equation, not the solution.', place_value: 'Estimate first: the decimal point is in the wrong place.', did_not_undo: 'That added instead of subtracting.', off_a_bit: 'Close, but line up the decimal points carefully.' }[o.trap];
    return { correct: false, key: o.trap, message: `${tip} Check: ${checkLine(p.eq, o.v)}. The answer is ${right.text}.` };
  }
  if (p.type === 'critique') {
    return { correct: false, key: o.trap, message: `An equation is a balance: adding ${show(p.eq.a, 'decimal')} to only one side breaks it. He must add ${show(p.eq.a, 'decimal')} to BOTH sides.` };
  }
  return { correct: false, key: 'story_equation', message: `Read it again: ${right.text} says what the story says.` };
}

/* ================================================================== */
/* Worked solutions (after two misses)                                 */
/* ================================================================== */
export function workedSolution(p) {
  const eq = p.eq, L = eq.letter, s = (q) => show(q, eq.style);
  if (p.type === 'choose') {
    const right = p.options.find((o) => o.ok);
    return [`Undo the ${eq.kind === 'times' ? `× ${s(eq.a)}: ${s(eq.c)} ÷ ${s(eq.a)}` : `+ ${s(eq.a)}: ${s(eq.c)} − ${s(eq.a)}`} = ${s(eq.x)}`, `So ${right.text}.`, `Check: ${checkLine(eq, eq.x)} ✓`];
  }
  const lines = [];
  if (p.type === 'story') lines.push(`The equation: ${eqText(eq)}`);
  if (p.type === 'critique') lines.push(`Add ${s(eq.a)} to BOTH sides, not just one.`);
  if (p.type === 'predict') lines.push(`Predict: ${checkPredict(eq, true).message.replace(/^(Good prediction! |Not always! )/, '')}`);
  const st = undoStep(eq);
  const recipNote = eq.kind === 'times' && eq.style === 'fraction' && eq.a.d > 1 ? ` (same as × ${show(recip(eq.a))})` : '';
  lines.push(`Undo with ${SIGN[st.op]} ${s(st.n)}${recipNote} on both sides: ${s(eq.c)} ${SIGN[st.op]} ${s(st.n)} = ${s(eq.x)}`);
  lines.push(`${L} = ${s(eq.x)}`);
  lines.push(`Check: ${checkLine(eq, eq.x)} ✓`);
  return lines;
}
