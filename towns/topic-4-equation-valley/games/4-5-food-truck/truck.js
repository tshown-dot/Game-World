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
//
// The game is an action game. Tickets are worked with five moves, one per zone:
//   sort      call each ticket as it rolls by: is the letter MORE or LESS than the number it equals?
//   tool      pick the tool that gets the letter alone (− 2.75, × 3/2 ...), and the ticket unwinds
//   ring      punch the exact answer into the register
//   build     write the ticket from a customer's words, with tiles
//   critique  the new cook's ticket has one wrong line: tap it

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
  if (eq.style === 'fraction' && eq.a.d > 1) return `(${imp(eq.a)})`;   // (5/4)k, so its reciprocal 4/5 is easy to see
  const s = show(eq.a, eq.style === 'money' ? 'decimal' : eq.style);
  return eq.a.d === 1 || (eq.style !== 'fraction' && terminates(eq.a)) ? s : `(${s})`;
}
export function exprText(eq) {
  const L = eq.letter, a = show(eq.a, eq.style);
  if (eq.kind === 'plus') return eq.letterFirst ? `${L} + ${a}` : `${a} + ${L}`;
  if (eq.kind === 'minus') return `${L} − ${a}`;
  if (eq.kind === 'times') return `${coef(eq)}${L}`;
  return `${L} ÷ ${eq.style === 'fraction' && eq.a.d > 1 ? imp(eq.a) : a}`;
}
export const eqText = (eq) => (eq.flipped ? `${show(eq.c, eq.style)} = ${exprText(eq)}` : `${exprText(eq)} = ${show(eq.c, eq.style)}`);
export function runForward(eq, v) {
  return eq.kind === 'plus' ? add(v, eq.a) : eq.kind === 'minus' ? sub(v, eq.a) : eq.kind === 'times' ? mul(eq.a, v) : div(v, eq.a);
}
/** 3/2 stays 3/2 (a reciprocal is easier to see than 1 1/2). */
export const imp = (a) => (a.d === 1 ? String(a.n) : `${a.n}/${a.d}`);
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

/** Money and decimals, + and −. */
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

/** × and ÷ with decimals. 1.8x = 40.14, r ÷ 5.5 = 18.2 */
export function genPrice(rnd, { kind = rnd() < 0.6 ? 'times' : 'div', flipped = false } = {}) {
  const a = dec(int(rnd, 12, 48) / 10, 1);
  const x = rnd() < 0.5 ? dec(int(rnd, 11, 99) / 10, 1) : fr(int(rnd, 3, 40));
  const c = kind === 'times' ? mul(a, x) : div(x, a);
  if (!terminates(c) || c.d > 1000) return genPrice(rnd, { kind, flipped });
  return prob('solve', makeEq({ kind, letter: pick(rnd, LETTERS), a, c, flipped, style: 'decimal' }));
}
/** + and − with fractions and mixed numbers (borrowing on purpose some of the time). */
export function genRecipe(rnd, { kind = rnd() < 0.5 ? 'plus' : 'minus', flipped = false } = {}) {
  const f = family(rnd);
  const a = fraction(rnd, 4, f), x = fraction(rnd, 6, f);
  const c = kind === 'plus' ? add(x, a) : sub(x, a);
  if (value(c) <= 0) return genRecipe(rnd, { kind, flipped });
  return prob('solve', makeEq({ kind, letter: pick(rnd, LETTERS), a, c, flipped, letterFirst: rnd() < 0.7, style: 'fraction' }));
}
/** × and ÷ by a fraction: the reciprocal. */
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
/* ================================================================== */
/* Checking                                                            */
/* ================================================================== */
/** The opposite block. For × and ÷ by a fraction, dividing and multiplying by the reciprocal both count. */
export function checkBlock(eq, op, n) {
  const step = undoStep(eq);
  const recipOp = { '×': '÷', '÷': '×' }[step.op];
  const correct = (op === step.op && same(n, step.n)) || (recipOp && op === recipOp && same(n, recip(step.n)));
  const s = (q) => amount(eq, q);
  const fix = `${SIGN[step.op]} ${s(step.n)}${eq.kind === 'times' && eq.a.d > 1 && eq.style === 'fraction' ? ` (or × ${imp(recip(eq.a))}, the reciprocal)` : ''}`;
  if (correct) return { correct, key: 'correct', message: `Right block: ${SIGN[op]} ${s(n)}.` };
  const doing = { plus: `ADDS ${s(eq.a)}`, minus: `TAKES AWAY ${s(eq.a)}`, times: `MULTIPLIES BY ${s(eq.a)}`, div: `DIVIDES BY ${s(eq.a)}` }[eq.kind];
  const sameOp = { plus: '+', minus: '-', times: '×', div: '÷' }[eq.kind];
  if (op === sameOp && same(n, eq.a)) {
    if (eq.kind === 'times' && eq.style === 'fraction') return { correct: false, key: 'not_reciprocal', message: `Multiplying by ${s(eq.a)} again won't undo it. Multiply by the RECIPROCAL, ${imp(recip(eq.a))} (flip it), or divide by ${s(eq.a)}.` };
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

/* ================================================================== */
/* More or less? (the estimate)                                        */
/* ================================================================== */
/** Is the letter MORE or LESS than the number it equals? */
export const moreOrLess = (eq) => (value(eq.x) > value(eq.c) ? 'more' : 'less');
function whyMoreLess(eq) {
  const L = eq.letter, s = (q) => show(q, eq.style), small = value(eq.a) < 1;
  if (eq.kind === 'plus') return `Something was added to ${L} to reach ${s(eq.c)}, so ${L} started out smaller.`;
  if (eq.kind === 'minus') return `Something was taken away from ${L} to leave ${s(eq.c)}, so ${L} started out bigger.`;
  if (eq.kind === 'times') return `Multiplying by ${small ? 'less' : 'more'} than 1 makes a number ${small ? 'smaller' : 'bigger'}, so ${L} was ${small ? 'bigger' : 'smaller'} before.`;
  return `Dividing by ${small ? 'less' : 'more'} than 1 makes a number ${small ? 'bigger' : 'smaller'}, so ${L} was ${small ? 'smaller' : 'bigger'} before.`;
}
/** says: 'more', 'less', or null when the ticket rolled away uncalled. Returns null when the call was right. */
export function checkEstimate(eq, says) {
  const right = moreOrLess(eq);
  if (says === right) return null;
  const s = (q) => show(q, eq.style);
  const fact = `${eq.letter} = ${s(eq.x)}, which is ${right.toUpperCase()} than ${s(eq.c)}.`;
  if (!says) return { key: 'too_slow', message: `That ticket got away. ${fact} ${whyMoreLess(eq)}` };
  return { key: eq.kind === 'times' || eq.kind === 'div' ? 'mult_makes_bigger' : 'add_sub_direction', message: `${fact} ${whyMoreLess(eq)}` };
}
const SMALL = [dec(0.5, 1), dec(0.25), dec(0.2, 1), fr(1, 2), fr(2, 3), fr(3, 4), fr(3, 5)];
const BIG = [dec(1.5, 1), dec(2.5, 1), fr(4), fr(3, 2), fr(5, 4), fr(5, 2)];
/** A ticket to call. what: 'times<1' 'times>1' 'div<1' 'div>1' 'plus' 'minus' */
export function genEstimate(rnd, what) {
  const letter = pick(rnd, LETTERS);
  if (what === 'plus' || what === 'minus') {
    const a = dec(int(rnd, 5, 60) / 10, 1), x = dec(int(rnd, 5, 90) / 10, 1), c = what === 'plus' ? add(x, a) : sub(x, a);
    if (value(c) <= 0) return genEstimate(rnd, what);
    return prob('sort', makeEq({ kind: what, letter, a, c, letterFirst: rnd() < 0.7, style: 'decimal' }));
  }
  const kind = what.startsWith('times') ? 'times' : 'div', a = pick(rnd, what.endsWith('<1') ? SMALL : BIG);
  const style = terminates(a) && rnd() < 0.6 ? 'decimal' : 'fraction';
  return prob('sort', makeEq({ kind, letter, a, c: fr(int(rnd, 2, 24)), flipped: rnd() < 0.15, style }));
}

/* ================================================================== */
/* Which undo? (the tools)                                             */
/* ================================================================== */
const byFraction = (eq) => (eq.kind === 'times' || eq.kind === 'div') && eq.style === 'fraction' && eq.a.d > 1;
const amount = (eq, n) => (byFraction(eq) ? imp(n) : show(n, eq.style));
/** Four tools for a ticket: the undo, and the moves students really try instead. Each is { op, n, text }. */
export function toolsFor(rnd, eq) {
  const step = undoStep(eq), sameOp = { plus: '+', minus: '-', times: '×', div: '÷' }[eq.kind], additive = eq.kind === 'plus' || eq.kind === 'minus';
  const list = [{ op: step.op, n: step.n }, { op: sameOp, n: eq.a }];
  if (byFraction(eq)) list.push({ op: step.op === '÷' ? '×' : '÷', n: recip(eq.a) }, { op: '-', n: eq.a });   // × 3/2 is the same move as ÷ 2/3
  else list.push({ op: step.op, n: eq.c }, { op: additive ? '÷' : '-', n: eq.a }, { op: additive ? '×' : '+', n: eq.a });
  const out = [];
  for (const tool of list) { const text = `${SIGN[tool.op]} ${amount(eq, tool.n)}`; if (out.length < 4 && !out.some((o) => o.text === text)) out.push({ ...tool, text }); }
  return shuffle(rnd, out);
}
/** One line of work: the tool applied to both sides. */
function bothSides(eq, op, n) {
  const left = `${exprText(eq)} ${SIGN[op]} ${amount(eq, n)}`, right = `${show(eq.c, eq.style)} ${SIGN[op]} ${amount(eq, n)}`;
  return eq.flipped ? `${right} = ${left}` : `${left} = ${right}`;
}
/**
 * Use a tool on the ticket. Returns { correct, key, message, lines }: lines is what the ticket shows as it unwinds
 * (or fails to).
 */
export function unwind(eq, op, n) {
  const res = checkBlock(eq, op, n), s = (q) => show(q, eq.style), L = eq.letter;
  const lines = [bothSides(eq, op, n)];
  if (res.correct) {
    if (byFraction(eq)) lines.push(eq.kind === 'times' ? `${imp(eq.a)} × ${imp(recip(eq.a))} = 1, so ${L} is alone` : `÷ ${imp(eq.a)} then × ${imp(eq.a)} leaves ${L} alone`);
    lines.push(`${L} = ${s(eq.x)}`, `Check: ${checkLine(eq, eq.x)} ✓`);
    return { correct: true, key: 'correct', message: res.message, lines };
  }
  const additive = eq.kind === 'plus' || eq.kind === 'minus';
  if (additive && (op === '+' || op === '-')) {                 // x + 2.75 + 2.75 = ...  ->  x + 5.5 = 8.75
    const off = add(eq.kind === 'plus' ? eq.a : sub(fr(0), eq.a), op === '+' ? n : sub(fr(0), n)), c = apply(eq.c, op, n);
    if (off.n !== 0 && value(c) > 0) lines.push(`${L} ${off.n > 0 ? '+' : '−'} ${s(fr(Math.abs(off.n), off.d))} = ${s(c)}   (${L} is still not alone)`);
  }
  if (!additive && (op === '×' || op === '÷')) {                // (2/3)x × 2/3  ->  (4/9)x
    const k = apply(eq.kind === 'times' ? eq.a : recip(eq.a), op, n);
    if (!same(k, fr(1))) lines.push(`${byFraction(eq) ? `(${imp(k)})` : s(k)}${L} = ${s(apply(eq.c, op, n))}   (${L} is still not alone)`);
  }
  return { correct: false, key: res.key, message: res.message, lines };
}

/* ================================================================== */
/* Ring it up (the exact answer)                                       */
/* ================================================================== */
/** The student typed the value of the letter. Any equal form counts: 2.25, 2 1/4, 9/4. */
export function checkRing(eq, raw) {
  const v = parseAnswer(raw);
  if (!v) return { correct: false, nudge: true, key: 'not_a_number', message: 'Punch in a number, like 2.25, 2 1/4 or 9/4.' };
  if (same(v, eq.x)) return { correct: true, key: 'correct', message: `Check: ${checkLine(eq, v)} ✓` };
  const step = undoStep(eq), diag = checkCalc(eq, step.op, step.n, raw);
  return { correct: false, key: diag.key, message: `The register checked it: ${checkLine(eq, v)}. ${diag.message}` };
}

/* ================================================================== */
/* Build the ticket from the order                                     */
/* ================================================================== */
/** family: 'money' (+ and −), 'price' (×), 'recipe' (fractions). Tiles: the letter and the two numbers. */
export function genBuild(rnd, family) {
  const tpl = pick(rnd, { money: MONEY_STORIES, price: PRICE_STORIES, recipe: RECIPE_STORIES }[family]);
  const { eq, story } = tpl.make(rnd);
  if (same(eq.a, eq.c) || same(eq.x, eq.a) || same(eq.x, eq.c)) return genBuild(rnd, family);   // three different numbers, so no two tiles look alike
  const tiles = shuffle(rnd, [{ id: 'L', text: eq.letter }, { id: 'a', text: show(eq.a, eq.style) }, { id: 'c', text: show(eq.c, eq.style) }]);
  return prob('build', eq, { story: story(eq), tiles });
}
/** The student built  first (op) second = third  from the tiles 'L', 'a', 'c'. Any true way of writing it counts. */
export function checkBuild(p, first, op, second, third) {
  const eq = p.eq;
  if (!first || !op || !second || !third) return { correct: false, nudge: true, key: 'incomplete', message: 'Fill every space on the ticket, and pick + − × or ÷.' };
  const val = (id) => ({ L: eq.x, a: eq.a, c: eq.c }[id]);
  const additive = eq.kind === 'plus' || eq.kind === 'minus', usesAdd = op === '+' || op === '-';
  if (additive !== usesAdd) {
    return { correct: false, key: 'story_op', message: additive ? 'This order is about parts and a total (or an amount taken away): it needs + or −.' : 'This order is about equal groups: it needs × or ÷.' };
  }
  if ((op === '÷' && val(second).n === 0) || !same(apply(val(first), op, val(second)), val(third))) {
    const hint = eq.kind === 'plus' ? 'Two parts make a total. Which number is the total?' : eq.kind === 'minus' ? 'An amount was taken away from the start, and something was left. Which number is what was left?' : 'Equal groups: which number is how many groups, and which is the total?';
    return { correct: false, key: 'story_order', message: `That ticket does not say what the customer said. ${hint}` };
  }
  return { correct: true, key: 'correct', message: 'That ticket matches the order.' };
}

/* ================================================================== */
/* The new cook's slip                                                 */
/* ================================================================== */
/** A worked ticket with one wrong line. lines[0] is the ticket; wrong is 1 or 2. */
export function genSlip(rnd, slip = pick(rnd, ['one_side', 'wrong_op', 'arithmetic'])) {
  const base = rnd() < 0.5 ? genRegister(rnd) : genPrice(rnd, { kind: 'times' });
  const eq = { ...base.eq, flipped: false }, s = (q) => show(q, eq.style), L = eq.letter, step = undoStep(eq);
  const good = bothSides(eq, step.op, step.n), sameOp = { plus: '+', minus: '-', times: '×', div: '÷' }[eq.kind];
  let lines, wrong, explain;
  if (slip === 'one_side') {
    lines = [eqText(eq), `${exprText(eq)} ${SIGN[step.op]} ${s(step.n)} = ${s(eq.c)}`, `${L} = ${s(eq.c)}`]; wrong = 1;
    explain = `The cook did ${SIGN[step.op]} ${s(step.n)} to one side only. Do it to BOTH sides: ${good}, so ${L} = ${s(eq.x)}.`;
  } else if (slip === 'wrong_op') {
    lines = [eqText(eq), bothSides(eq, sameOp, eq.a), `${L} = ${s(apply(eq.c, sameOp, eq.a))}`]; wrong = 1;
    explain = `${SIGN[sameOp]} ${s(eq.a)} does not undo ${SIGN[sameOp]} ${s(eq.a)}. Use the opposite: ${good}, so ${L} = ${s(eq.x)}.`;
  } else {
    const off = add(eq.x, pick(rnd, [fr(1), fr(1, 10), fr(-1, 10)]));
    lines = [eqText(eq), good, `${L} = ${s(value(off) > 0 ? off : add(eq.x, fr(1)))}`]; wrong = 2;
    explain = `The step was right, but the arithmetic slipped: ${s(eq.c)} ${SIGN[step.op]} ${s(step.n)} = ${s(eq.x)}.`;
  }
  return prob('critique', eq, { slip, lines, wrong, explain });
}
export function checkSlip(p, i) {
  if (i === p.wrong) return { correct: true, key: 'correct', message: `You found it. ${p.explain}` };
  return { correct: false, key: 'critique', message: `${i === 1 ? 'That line is fine: the same thing was done to both sides.' : 'That line follows from the one above it. The mistake came earlier.'} ${p.explain}` };
}

/* ================================================================== */
/* Zones                                                               */
/* ================================================================== */
export const ZONES = [
  { name: 'More or Less?', blurb: 'Call each ticket before it rolls away' },
  { name: 'Which Undo?', blurb: 'Decimals and money: pick the tool' },
  { name: 'Flip It', blurb: 'Fractions: undo with the reciprocal' },
  { name: 'Ring It Up', blurb: 'Punch in the exact answer' },
  { name: 'Lunch Rush', blurb: 'Boss: write the ticket, call it, ring it up' },
];
const rail = (rnd, kinds) => ({ id: nextId++, type: 'sort', tickets: kinds.map((k) => genEstimate(rnd, k)) });
const tool = (rnd, p) => ({ id: nextId++, type: 'tool', eq: p.eq, tools: toolsFor(rnd, p.eq) });
const ring = (p) => ({ id: nextId++, type: 'ring', eq: p.eq, story: p.story || null });
/** The rounds of a zone, in order. */
export function genZone(rnd, zone) {
  if (zone === 0) return [rail(rnd, ['plus', 'times<1', 'minus', 'times>1', 'times<1', 'div>1']), rail(rnd, shuffle(rnd, ['times<1', 'div<1', 'times>1', 'div>1', 'div<1', 'plus', 'times<1']))];
  if (zone === 1) return shuffle(rnd, [genRegister(rnd, { kind: 'plus' }), genRegister(rnd, { kind: 'minus' }), genRegister(rnd, { flipped: true }), genPrice(rnd, { kind: 'times' }), genPrice(rnd, { kind: 'div' }), genPrice(rnd, { flipped: true })]).map((p) => tool(rnd, p));
  if (zone === 2) return [genRecipe(rnd, { kind: 'plus' }), genBatch(rnd, { kind: 'times' }), genRecipe(rnd, { kind: 'minus' }), genBatch(rnd, { kind: 'times' }), genBatch(rnd, { kind: 'div' }), genBatch(rnd, { kind: 'times' })].map((p) => tool(rnd, p));
  if (zone === 3) return [genRegister(rnd, { kind: 'plus' }), genRegister(rnd, { kind: 'minus' }), genPrice(rnd, { kind: 'times' }), genRecipe(rnd), genBatch(rnd, { kind: 'times' }), genBatch(rnd, { kind: 'div' })].map(ring);
  const first = genBuild(rnd, 'money'), second = genBuild(rnd, pick(rnd, ['price', 'recipe']));
  return [first, ring(first), rail(rnd, shuffle(rnd, ['times<1', 'div<1', 'times>1', 'minus', 'div>1', 'times<1'])), genSlip(rnd, pick(rnd, ['one_side', 'wrong_op'])), second, ring(second), genSlip(rnd, 'arithmetic')];
}
