// Ranger Station (Grade 7, Lesson 4-1: Write and Evaluate Algebraic Expressions): the math.
// No screen code here, so it can be tested with plain node (see test_ranger_station_math.js).
//
// A one-variable expression is  start ± rate·v  (the start is the constant, the rate is the coefficient).
// A two-variable expression is  p1·x ± p2·y  (two prices, or two rates).
// Answer kinds:  build (drag number chips into the expression),  num (type a number),  choice (pick one).

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
export const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
export const near = (a, b) => Math.abs(a - b) < 1e-6;

/** 3000 -> "3,000"; 25.5 -> "25.5"; −3.3 -> "−3.3" */
export function fmt(v) {
  const x = r2(v);
  if (x < 0) return `−${fmt(-x)}`;
  return x.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
/** A typed number: "-3.3", "−3.3", "$47.46", "1,250", "18.5", "18 1/2", "37/2". */
export function parseNumber(raw) {
  let t = String(raw ?? '').trim().replace(/,/g, '').replace(/^−/, '-').replace(/^(-?)\$/, '$1').replace(/^\$(-?)/, '$1');
  const mixed = t.match(/^(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) { const d = Number(mixed[4]); if (!d) return null; const v = Number(mixed[2]) + Number(mixed[3]) / d; return mixed[1] ? -v : v; }
  const frac = t.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (frac) { const d = Number(frac[2]); return d ? Number(frac[1]) / d : null; }
  t = t.replace(/\s/g, '');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** start ± rate·v as text: "35 − 4m", "−120 + 13m" */
export const exprText = (start, sign, rate, v) => `${fmt(start)} ${sign} ${fmt(rate)}${v}`;
export const valueAt = (start, sign, rate, n) => r2(sign === '+' ? start + rate * n : start - rate * n);

/* ================================================================== */
/* Radio calls (the kinds of situations in the lesson)                 */
/* ================================================================== */
const CALLS = {
  up: [
    { v: 'w', unit: 'weeks', what: 'the account balance ($)', S: () => [120, 185, 217, 250], R: [12.5, 25.5, 15.25, 20], say: (S, R) => `Ranger Misumi started with $${fmt(S)} in the station fund and deposits $${fmt(R)} each week.` },
    { v: 'y', unit: 'years', what: 'the tree\'s height (ft)', S: () => [4, 6, 7, 9], R: [1.5, 2, 2.5], say: (S, R) => `A young pine began at ${fmt(S)} feet tall and grows ${fmt(R)} feet per year.` },
    { v: 'p', unit: 'plaques', what: 'the total weight (kg)', S: () => [0.2, 0.4, 0.5], R: [1.3, 1.5, 2.2], say: (S, R) => `An empty supply box weighs ${fmt(S)} kilogram. Each trail plaque packed in it weighs ${fmt(R)} kilograms.` },
    { v: 'h', unit: 'hours', what: 'the river level (in.)', S: () => [14, 18, 22, 30], R: [1.5, 2.5, 3], say: (S, R) => `The river is ${fmt(S)} inches deep and rising ${fmt(R)} inches each hour.` },
  ],
  down: [
    { v: 'm', unit: 'minutes', what: 'the water left (gal)', S: () => [35, 40, 48, 60], R: [4, 3, 2.5, 1.5], say: (S, R) => `A tank holding ${fmt(S)} gallons of water is leaking ${fmt(R)} gallons per minute.` },
    { v: 'h', unit: 'hours', what: 'the temperature (°F)', S: () => [64, 68, 73, 79], R: [1.5, 2, 2.5], say: (S, R) => `It was ${fmt(S)}°F at 1 P.M. and the temperature drops ${fmt(R)}°F each hour.` },
    { v: 's', unit: 'seconds', what: 'the grain left (ft³)', S: () => [2000, 3000, 4500], R: [2.5, 3.5, 4.5], say: (S, R) => `A full silo holds ${fmt(S)} cubic feet of grain and empties at ${fmt(R)} cubic feet per second.` },
    { v: 'd', unit: 'days', what: 'the food left (cups)', S: () => [12, 18, 24, 30], R: [0.5, 0.75, 1.5], say: (S, R) => `The camp dog feeder holds ${fmt(S)} cups and dispenses ${fmt(R)} cup${R > 1 ? 's' : ''} of food each day.` },
  ],
  neg: [
    { v: 'm', unit: 'minutes', what: 'the submarine\'s position (ft)', S: () => [90, 120, 150], R: [12, 13, 15], say: (S, R) => `A research submarine begins ${fmt(S)} feet BELOW the lake surface and ascends ${fmt(R)} feet per minute.` },
    { v: 'h', unit: 'hours', what: 'the temperature (°F)', S: () => [4, 6, 9, 12], R: [1.5, 2, 3], say: (S, R) => `At dawn it was ${fmt(S)}°F BELOW zero. The temperature rises ${fmt(R)}°F each hour.` },
  ],
};
function call(rnd, dir) {
  const c = pick(rnd, CALLS[dir]);
  const S = pick(rnd, c.S()), R = pick(rnd, c.R.filter((r) => r !== S));
  return { c, S, R, start: dir === 'neg' ? -S : S, sign: dir === 'down' ? '−' : '+', rate: R };
}

/** Build  start ± rate·v  from a radio call. Chips are the numbers the student can drag. */
export function genBuild(rnd, { dir = 'up' } = {}) {
  const k = call(rnd, dir);
  const chips = shuffle(rnd, dir === 'neg' ? [k.start, -k.start, k.rate] : [k.start, k.rate]);
  return { id: nextId++, kind: 'build', type: 'build', dir, two: false, story: k.c.say(k.S, k.R), v: k.c.v, unit: k.c.unit, what: k.c.what,
    start: k.start, sign: k.sign, rate: k.rate, chips, answerText: exprText(k.start, k.sign, k.rate, k.c.v),
    prompt: `${k.c.say(k.S, k.R)} Build the expression for <b>${k.c.what}</b> after <b>${k.c.v}</b> ${k.c.unit}.` };
}
/** Use the expression from a call: read the gauge after n of the variable. */
export function genEvalStory(rnd, { dir = 'up' } = {}) {
  const k = call(rnd, dir);
  let n = int(rnd, 4, 9);
  if (dir === 'down') n = Math.min(n, Math.floor(k.S / k.R));
  const answer = valueAt(k.start, k.sign, k.rate, n);
  if (near(answer, k.rate * n) || near(answer, 0)) return genEvalStory(rnd, { dir });   // the answer must differ from the common slips
  const expr = exprText(k.start, k.sign, k.rate, k.c.v);
  const flip = k.sign === '+' ? '−' : '+';
  return num({ type: 'evalStory', dir, story: k.c.say(k.S, k.R), expr, v: k.c.v, n, start: k.start, sign: k.sign, rate: k.rate, answer, label: 'value',
    prompt: `${k.c.say(k.S, k.R)} The gauge reads <b class="mono">${expr}</b>. What is ${k.c.what} after <b>${n} ${k.c.unit}</b>?`,
    traps: [
      { v: valueAt(k.start, flip, k.rate, n), key: 'wrong_direction', message: `Check the sign: the expression is ${expr}, so you ${k.sign === '+' ? 'ADD' : 'SUBTRACT'} ${fmt(k.rate)} × ${n} = ${fmt(k.rate * n)}.` },
      { v: r2(k.rate * n), key: 'forgot_constant', message: `That's only ${fmt(k.rate)} × ${n}. Don't forget the starting amount, ${fmt(k.start)}.` },
      { v: r2((k.start + (k.sign === '+' ? k.rate : -k.rate)) * n), key: 'added_first', message: `Multiply first: ${fmt(k.rate)} × ${n} = ${fmt(k.rate * n)}. Then ${k.sign === '+' ? 'add it to' : 'take it from'} ${fmt(k.start)}.` },
      ...(k.start < 0 ? [{ v: r2(-k.start + k.rate * n), key: 'lost_negative', message: `The start is NEGATIVE (below zero): ${fmt(k.start)} + ${fmt(k.rate * n)} = ${fmt(answer)}.` }] : []),
    ] });
}

/** Evaluate a bare expression with decimals: 3x − 4.5 when x = 0.4. Forms: ax-b, ax+b, b-ax. */
export function genEval(rnd, form = pick(rnd, ['ax-b', 'ax+b', 'b-ax'])) {
  const v = pick(rnd, ['x', 'd', 'n', 't', 'k']);
  const a = pick(rnd, [2, 3, 4, 5, 6, 8, 2.5, 1.5]), x = pick(rnd, [0.2, 0.4, 0.5, 1.2, 1.5, 2.5, 0.8]), b = pick(rnd, [4, 4.5, 2.3, 7, 1.8, 9.6, 12]);
  const ax = r2(a * x);
  const answer = form === 'ax-b' ? r2(ax - b) : form === 'ax+b' ? r2(ax + b) : r2(b - ax);
  const expr = form === 'ax-b' ? `${fmt(a)}${v} − ${fmt(b)}` : form === 'ax+b' ? `${fmt(a)}${v} + ${fmt(b)}` : `${fmt(b)} − ${fmt(a)}${v}`;
  const slip = r2(a * x * 10);
  const traps = [
    // the most specific slip first: a dropped negative sign
    ...(answer < 0 ? [{ v: -answer, key: 'lost_negative', message: form === 'b-ax' ? `${fmt(b)} − ${fmt(ax)} goes BELOW zero: ${fmt(answer)}.` : `${fmt(ax)} − ${fmt(b)} goes BELOW zero: ${fmt(answer)}.` }] : []),
    { v: form === 'ax-b' ? r2(a * (x - b)) : form === 'ax+b' ? r2(a * (x + b)) : r2((b - a) * x), key: 'added_first', message: `Multiply first: ${fmt(a)} × ${fmt(x)} = ${fmt(ax)}. Then ${form === 'ax+b' ? 'add' : 'subtract'}: the answer is ${fmt(answer)}.` },
    { v: form === 'ax-b' ? r2(slip - b) : form === 'ax+b' ? r2(slip + b) : r2(b - slip), key: 'decimal_slip', message: `Check the decimal: ${fmt(a)} × ${fmt(x)} = ${fmt(ax)}, not ${fmt(slip)}.` },
    { v: form === 'ax-b' ? r2(b - ax) : form === 'b-ax' ? r2(ax - b) : r2(ax - b), key: form === 'ax+b' ? 'wrong_direction' : 'subtracted_backwards', message: `Keep the order of the expression: ${expr.replace(v, `(${fmt(x)})`)} = ${fmt(answer)}.` },
  ];
  return num({ type: 'eval', form, expr, v, x, a, b, answer, label: 'value', prompt: `Evaluate <b class="mono">${expr}</b> when <b class="mono">${v} = ${fmt(x)}</b>.`, traps });
}

/* ---- two variables: a supply order ---- */
const usd = (v) => `$${v.toFixed(2)}`;
// xName / yName say what each letter stands for; say(k) is the radio call.
const ORDERS = [
  { X: 'g', Y: 'f', xName: 'pounds of granola', yName: 'pounds of flour', prices: [[3.25, 0.74], [2.8, 0.9], [4.5, 1.2]],
    say: (k) => `Granola costs ${usd(k.p1)} per pound and flour costs ${usd(k.p2)} per pound. The camp needs ${fmt(k.qx)} pounds of granola and ${fmt(k.qy)} pounds of flour.` },
  { X: 'w', Y: 't', xName: 'pounds of watermelon', yName: 'pounds of tomatoes', prices: [[0.68, 3.25], [0.5, 2.8], [0.72, 3.4]],
    say: (k) => `Watermelon costs ${usd(k.p1)} per pound and tomatoes cost ${usd(k.p2)} per pound. The camp needs ${fmt(k.qx)} pounds of watermelon and ${fmt(k.qy)} pounds of tomatoes.` },
  { X: 'g', Y: 'c', xName: 'gallons of gasoline', yName: 'cans of oil', prices: [[2.85, 3.15], [3.2, 4.6]],
    say: (k) => `Gasoline costs ${usd(k.p1)} per gallon and oil costs ${usd(k.p2)} per can. The station needs ${fmt(k.qx)} gallons of gasoline and ${fmt(k.qy)} cans of oil.` },
  { X: 'a', Y: 'c', xName: 'pounds of almonds', yName: 'pounds of cashews', prices: [[9.98, 12.98], [8.5, 11.4]],
    say: (k) => `Almonds cost ${usd(k.p1)} per pound and cashews cost ${usd(k.p2)} per pound. The camp needs ${fmt(k.qx)} pounds of almonds and ${fmt(k.qy)} pounds of cashews.` },
  { X: 's', Y: 'b', xName: 'hours with the scooter', yName: 'hours with the boat', prices: [[15.5, 22.8], [12.4, 20.6]],
    say: (k) => `A scooter rents for ${usd(k.p1)} per hour and a boat for ${usd(k.p2)} per hour. The crew needs the scooter for ${fmt(k.qx)} hours and the boat for ${fmt(k.qy)} hours.` },
];
function order(rnd) {
  for (;;) {
    const o = pick(rnd, ORDERS), [p1, p2] = pick(rnd, o.prices);
    const qx = pick(rnd, [2, 3, 4, 5, 6, 1.5, 2.5, 18.5]), qy = pick(rnd, [2, 3, 5, 6, 1.5, 2.5, 3.5]);
    const total = p1 * qx + p2 * qy;
    if (qx !== qy && near(total * 100, Math.round(total * 100)) && new Set([p1, p2, qx, qy]).size === 4) return { o, p1, p2, qx, qy, total: r2(total) };
  }
}
const orderSay = (k) => k.o.say(k);
/** Build  p1·x + p2·y  for an order. The amounts are chips too, but they are NOT part of the expression. */
export function genBuild2(rnd) {
  const k = order(rnd);
  return { id: nextId++, kind: 'build', type: 'build2', two: true, story: orderSay(k), X: k.o.X, Y: k.o.Y, xName: k.o.xName, yName: k.o.yName,
    p1: k.p1, p2: k.p2, qx: k.qx, qy: k.qy, chips: shuffle(rnd, [k.p1, k.p2, k.qx, k.qy]), answerText: `${fmt(k.p1)}${k.o.X} + ${fmt(k.p2)}${k.o.Y}`,
    prompt: `${orderSay(k)} Build the expression for the total cost of <b>${k.o.X}</b> ${k.o.xName} and <b>${k.o.Y}</b> ${k.o.yName}.` };
}
/** Evaluate a two-variable expression. form 'plus' is an order; 'minus' is bare numbers like 8.4n − 3.2p. */
export function genEval2(rnd, { form = 'plus' } = {}) {
  if (form === 'minus') {
    const a = pick(rnd, [8.4, 10.2, 6.5, 7.5, 9.4]), b = pick(rnd, [3.2, 2.3, 1.5, 0.5, 4.1]), x = int(rnd, 2, 6), y = int(rnd, 2, 5);
    if (x === y) return genEval2(rnd, { form });
    const answer = r2(a * x - b * y), expr = `${fmt(a)}n − ${fmt(b)}p`;
    return num({ type: 'eval2', form, expr, answer, label: 'value', prompt: `Evaluate <b class="mono">${expr}</b> when <b class="mono">n = ${x}</b> and <b class="mono">p = ${y}</b>.`,
      steps: [`${fmt(a)}(${x}) − ${fmt(b)}(${y})`, `${fmt(a * x)} − ${fmt(b * y)}`],
      traps: [
        { v: r2(a * y - b * x), key: 'swapped_values', message: `Match each value to its letter: n = ${x} goes with ${fmt(a)}, and p = ${y} goes with ${fmt(b)}.` },
        { v: r2(a * x + b * y), key: 'wrong_direction', message: `The expression SUBTRACTS: ${fmt(a * x)} − ${fmt(b * y)} = ${fmt(answer)}.` },
        { v: r2(a * x), key: 'one_term_only', message: `That's only ${fmt(a)} × ${x}. Now subtract ${fmt(b)} × ${y} = ${fmt(b * y)}.` },
      ] });
  }
  const k = order(rnd), expr = `${fmt(k.p1)}${k.o.X} + ${fmt(k.p2)}${k.o.Y}`;
  return num({ type: 'eval2', form, expr, story: orderSay(k), answer: k.total, label: 'cost $', money: true,
    prompt: `${orderSay(k)} Use <b class="mono">${expr}</b> to find the total cost.`,
    steps: [`${fmt(k.p1)}(${fmt(k.qx)}) + ${fmt(k.p2)}(${fmt(k.qy)})`, `${fmt(k.p1 * k.qx)} + ${fmt(k.p2 * k.qy)}`],
    traps: [
      { v: r2(k.p1 * k.qy + k.p2 * k.qx), key: 'swapped_values', message: `Match each amount to its price: ${fmt(k.qx)} ${k.o.xName} at ${usd(k.p1)}, and ${fmt(k.qy)} ${k.o.yName} at ${usd(k.p2)}.` },
      { v: r2(k.p1 * k.qx), key: 'one_term_only', message: `That's only the ${k.o.xName}. Add the ${k.o.yName} too: ${fmt(k.p2)} × ${fmt(k.qy)} = ${fmt(k.p2 * k.qy)}.` },
      { v: r2((k.p1 + k.p2) * (k.qx + k.qy)), key: 'added_first', message: `Each item has its own price: multiply ${fmt(k.p1)} × ${fmt(k.qx)} and ${fmt(k.p2)} × ${fmt(k.qy)} separately, then add.` },
    ] });
}
/** Higher order: for  b − m·x  to be negative, what must be true about x? */
export function genWhenNegative(rnd) {
  const m = int(rnd, 2, 6), k = int(rnd, 1, 5), b = m * k, v = pick(rnd, ['x', 'n', 't']);
  const expr = `${b} − ${m}${v}`;
  const options = shuffle(rnd, [
    { text: `${v} > ${k}`, ok: true, key: 'correct' },
    { text: `${v} < ${k}`, ok: false, key: 'reversed_inequality', message: `Test it: ${v} = ${k - 1} gives ${b} − ${m * (k - 1)} = ${b - m * (k - 1)}, which is not negative. ${m}${v} has to be BIGGER than ${b}.` },
    { text: `${v} > ${b}`, ok: false, key: 'used_constant', message: `True, but too strict: ${v} = ${k + 1} already gives ${b} − ${m * (k + 1)} = ${b - m * (k + 1)}. The value turns negative as soon as ${m}${v} passes ${b}.` },
    { text: `${v} < 0`, ok: false, key: 'negative_input', message: `A negative ${v} makes it bigger: ${v} = −1 gives ${b} + ${m} = ${b + m}. Subtracting MORE than ${b} is what makes it negative.` },
  ]);
  return { id: nextId++, kind: 'choice', type: 'whenNegative', expr, b, m, k, v, options, answerText: `${v} > ${k}`,
    prompt: `For <b class="mono">${expr}</b> to have a NEGATIVE value, what must be true about ${v}?` };
}
function num(extra) {
  const traps = (extra.traps || []).filter((t, i, all) => !near(t.v, extra.answer) && !all.slice(0, i).some((u) => near(u.v, t.v)));
  return { id: nextId++, kind: 'num', ...extra, traps };
}

/* ================================================================== */
/* Zones and backups                                                   */
/* ================================================================== */
export const ZONES = [
  { name: 'Set the Gauge', blurb: 'Start amount and rate: growing' },
  { name: 'Leaks and Drops', blurb: 'Amounts that shrink' },
  { name: 'Read the Gauge', blurb: 'Evaluate with decimals and negatives' },
  { name: 'Supply Run', blurb: 'Two variables' },
  { name: 'Storm Watch', blurb: 'Boss: below zero and a dilemma' },
];
export function genZone(rnd, zone) {
  if (zone === 0) return [genBuild(rnd, { dir: 'up' }), genBuild(rnd, { dir: 'up' }), genEvalStory(rnd, { dir: 'up' }), genBuild(rnd, { dir: 'up' }), genEvalStory(rnd, { dir: 'up' })];
  if (zone === 1) return [genBuild(rnd, { dir: 'down' }), genBuild(rnd, { dir: 'down' }), genEvalStory(rnd, { dir: 'down' }), genBuild(rnd, { dir: 'down' }), genEvalStory(rnd, { dir: 'down' })];
  if (zone === 2) return shuffle(rnd, [genEval(rnd, 'ax-b'), genEval(rnd, 'ax-b'), genEval(rnd, 'ax+b'), genEval(rnd, 'b-ax'), genEval(rnd, 'b-ax')]);
  if (zone === 3) return [genBuild2(rnd), genEval2(rnd), genBuild2(rnd), genEval2(rnd), genEval2(rnd, { form: 'minus' })];
  return [genBuild(rnd, { dir: 'neg' }), genEvalStory(rnd, { dir: 'neg' }), genBuild2(rnd), genEval2(rnd), genWhenNegative(rnd)];
}
export function genBackup(rnd, p) {
  if (p.type === 'build') return genBuild(rnd, { dir: p.dir });
  if (p.type === 'evalStory') return genEvalStory(rnd, { dir: p.dir });
  if (p.type === 'eval') return genEval(rnd, p.form);
  if (p.type === 'build2') return genBuild2(rnd);
  if (p.type === 'eval2') return genEval2(rnd, { form: p.form });
  return genWhenNegative(rnd);
}

/* ================================================================== */
/* Checking                                                            */
/* ================================================================== */
/** guess = { a, b, sign }: a = the start (or the first price), b = the rate (or the second price). */
export function checkBuild(p, guess) {
  const { a, b, sign } = guess || {};
  if (typeof a !== 'number' || typeof b !== 'number' || (!p.two && sign !== '+' && sign !== '−')) {
    return { correct: false, nudge: true, key: 'incomplete', message: p.two ? 'Put a number chip in both boxes.' : 'Put a chip in both boxes and choose + or −.' };
  }
  if (p.two) {
    if (near(a, p.p1) && near(b, p.p2)) return { correct: true, key: 'correct', message: `Order ready: ${p.answerText}. The amounts get plugged in later.` };
    if (near(a, p.p2) && near(b, p.p1)) return { correct: false, key: 'swapped_prices', message: `Swapped: ${p.X} stands for the ${p.xName}, at ${usd(p.p1)} each, so ${fmt(p.p1)} goes with ${p.X}.` };
    if ([a, b].some((v) => near(v, p.qx) || near(v, p.qy))) return { correct: false, key: 'used_amount', message: `${fmt(p.qx)} and ${fmt(p.qy)} are amounts: they are what ${p.X} and ${p.Y} stand for. The numbers IN the expression are the prices.` };
    return { correct: false, key: 'check_it', message: `Each letter is multiplied by its price: ${p.answerText}.` };
  }
  if (near(a, p.start) && near(b, p.rate) && sign === p.sign) return { correct: true, key: 'correct', message: `Gauge set: ${p.answerText}. It starts at ${fmt(p.start)} and ${p.sign === '+' ? 'rises' : 'falls'} ${fmt(p.rate)} for each 1 of ${p.v}.` };
  if (near(Math.abs(a), p.rate) && near(Math.abs(b), Math.abs(p.start))) return { correct: false, key: 'swapped_constant_rate', message: `Swapped: ${fmt(p.rate)} is what changes EACH time, so it multiplies ${p.v}. ${fmt(Math.abs(p.start))} is the starting amount and stands alone.` };
  if (p.start < 0 && near(a, -p.start)) return { correct: false, key: 'lost_negative', message: `"Below" means the start is NEGATIVE: use ${fmt(p.start)}, not ${fmt(-p.start)}.` };
  if (near(a, p.start) && near(b, p.rate)) return { correct: false, key: 'wrong_direction', message: p.sign === '−' ? `The amount is going DOWN, so subtract the ${fmt(p.rate)}${p.v}. Your gauge is rising!` : `The amount is going UP, so add the ${fmt(p.rate)}${p.v}. Your gauge is falling!` };
  return { correct: false, key: 'check_it', message: `Start amount first, then ${p.sign === '+' ? 'add' : 'subtract'} the rate times ${p.v}: ${p.answerText}.` };
}
export function checkNum(p, raw) {
  const v = parseNumber(raw);
  if (v === null) return { correct: false, nudge: true, key: 'incomplete', message: 'Type a number (decimals and negatives are fine).' };
  if (near(r2(v), p.answer)) return { correct: true, key: 'correct', message: `Gauge reads ${p.money ? '$' : ''}${p.money ? p.answer.toFixed(2) : fmt(p.answer)}. Right!` };
  const trap = p.traps.find((t) => near(r2(v), t.v));
  if (trap) return { correct: false, key: trap.key, message: trap.message };
  return { correct: false, key: 'check_it', message: `Substitute carefully, multiply first, then add or subtract: ${p.expr}.` };
}
export function checkChoice(p, i) {
  const o = p.options[i];
  if (o.ok) return { correct: true, key: 'correct', message: `Right! ${p.expr} is negative when ${o.text}: then ${p.m}${p.v} is more than ${p.b}.` };
  return { correct: false, key: o.key, message: o.message };
}

/* ================================================================== */
/* Worked solutions (after two misses)                                 */
/* ================================================================== */
export function workedSolution(p) {
  if (p.type === 'build') return [`Start amount (constant): ${fmt(p.start)}.`, `Change for each 1 of ${p.v} (rate, the coefficient): ${fmt(p.rate)}, going ${p.sign === '+' ? 'up' : 'down'}.`, `Expression: ${p.answerText}`];
  if (p.type === 'build2') return [`${p.X} = ${p.xName}, at ${usd(p.p1)} each: ${fmt(p.p1)}${p.X}.`, `${p.Y} = ${p.yName}, at ${usd(p.p2)} each: ${fmt(p.p2)}${p.Y}.`, `Total: ${p.answerText}`];
  if (p.type === 'evalStory') return [`${p.expr} with ${p.v} = ${p.n}`, `${fmt(p.rate)} × ${p.n} = ${fmt(p.rate * p.n)}`, `${fmt(p.start)} ${p.sign} ${fmt(p.rate * p.n)} = ${fmt(p.answer)}`];
  if (p.type === 'eval') { const ax = r2(p.a * p.x); return [`${p.expr} with ${p.v} = ${fmt(p.x)}`, `${fmt(p.a)} × ${fmt(p.x)} = ${fmt(ax)}`, `${p.form === 'b-ax' ? `${fmt(p.b)} − ${fmt(ax)}` : `${fmt(ax)} ${p.form === 'ax+b' ? '+' : '−'} ${fmt(p.b)}`} = ${fmt(p.answer)}`]; }
  if (p.type === 'eval2') return [p.expr, ...p.steps, `= ${fmt(p.answer)}`];
  return [`${p.expr} is 0 when ${p.v} = ${p.k} (because ${p.m} × ${p.k} = ${p.b}).`, `Past that, more is subtracted than ${p.b}.`, `So it is negative when ${p.answerText}.`];
}
