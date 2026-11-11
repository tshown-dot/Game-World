// Force Field (Lesson 4-7: Solve Inequalities — represent ALL the solutions): the math.
// No screen code here, so it can be tested with plain node (see test_force_field_math.js).
//
// A field rule is { letter, sym, n } ("x > 5"), or with a number in front of the letter { coef: 3 } ("3y < 25").
// Its solutions are every value that makes it true: on the number line, everything under the shield.

export const SYMS = ['<', '≤', '>', '≥'];
const FLIP = { '<': '>', '>': '<', '≤': '≥', '≥': '≤' };
const EPS = 1e-9;
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
const r2 = (v) => Math.round(v * 100) / 100;

/** 7.01 -> "7.01"; 1500 -> "1,500"; money -> "$12.75" */
export function fmt(v, money = false) {
  const x = r2(v);
  if (money) return `$${x.toFixed(Number.isInteger(x) ? 0 : 2)}`;
  return Number.isInteger(x) ? x.toLocaleString('en-US') : String(x);
}
export const ruleText = (r) => `${r.coef ? r.coef : ''}${r.letter} ${r.sym} ${fmt(r.n)}`;
export const inclusive = (r) => r.sym === '≥' || r.sym === '≤';
export const goesRight = (r) => r.sym === '>' || r.sym === '≥';
/** Is v a solution? */
export function passes(r, v) {
  const left = (r.coef || 1) * v, d = left - r.n;
  if (r.sym === '<') return d < -EPS;
  if (r.sym === '≤') return d <= EPS;
  if (r.sym === '>') return d > EPS;
  return d >= -EPS;
}
export const passesAll = (rules, v) => rules.every((r) => passes(r, v));

/** A typed value: "7.01", "$12.75", "2 1/2", "5/2", "1,505". Returns a number or null. */
export function parseValue(raw) {
  const t = String(raw ?? '').trim().replace(/^\$/, '').replace(/,/g, '').replace(/\s+/g, ' ');
  let m;
  if ((m = t.match(/^(\d+) (\d+)\/(\d+)$/))) return Number(m[3]) ? Number(m[1]) + Number(m[2]) / Number(m[3]) : null;
  if ((m = t.match(/^(\d+)\/(\d+)$/))) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : null;
  if (/^(\d+\.?\d*|\.\d+)$/.test(t)) return Number(t);
  return null;
}

/* ================================================================== */
/* Number lines                                                        */
/* ================================================================== */
/** The line to draw for a rule: whole-number ticks around n (never below 0), or tenths from a whole number to the next (ends labeled only). */
export function lineFor(r) {
  const b = r.coef ? r.n / r.coef : r.n;
  if (Number.isInteger(r2(b))) { const lo = Math.max(0, r2(b) - 6); return { lo, hi: lo + 12, step: 1, labelEvery: true }; }
  const lo = Math.floor(b);
  return { lo, hi: lo + 1, step: 0.1, labelEvery: false };
}
export const ticks = (line) => Array.from({ length: Math.round((line.hi - line.lo) / line.step) + 1 }, (_, i) => r2(line.lo + i * line.step));

/** The field the student built: { at, closed, dir }. */
export function checkGraph(r, { at, closed, dir }) {
  const line = lineFor(r), n = r.n;
  if (Math.abs(at - n) > EPS) {
    if (line.step < 1) return { correct: false, key: 'tenths', message: `Count the tenths from ${fmt(line.lo)}: ${fmt(n)} is ${Math.round((n - line.lo) * 10)} small steps past ${fmt(line.lo)}.` };
    return { correct: false, key: 'graph_number', message: `The edge of the field goes at the boundary, ${fmt(n)}.` };
  }
  if (closed !== inclusive(r)) return { correct: false, key: 'graph_circle', message: inclusive(r) ? `${r.sym} includes ${fmt(n)}, so the circle is closed (●).` : `${r.sym} does not include ${fmt(n)}, so the circle is open (○): ${fmt(n)} itself is NOT a solution.` };
  if (dir !== (goesRight(r) ? 'right' : 'left')) return { correct: false, key: 'graph_direction', message: `${ruleText(r)}: the solutions are ${goesRight(r) ? 'GREATER' : 'LESS'} than ${fmt(n)}, so shade to the ${goesRight(r) ? 'right' : 'left'}.` };
  return { correct: true, key: 'correct', message: `Shield up! ${inclusive(r) ? 'Closed' : 'Open'} circle at ${fmt(n)}, shaded ${goesRight(r) ? 'right' : 'left'}: every value there is a solution.` };
}

/* ================================================================== */
/* Generators                                                          */
/* ================================================================== */
const LETTERS = ['x', 'y', 't', 'w', 'r', 'm', 'g', 'h'];
export function genRule(rnd, { decimal = false, sym = pick(rnd, SYMS) } = {}) {
  const n = decimal ? r2(int(rnd, 1, 9) + int(rnd, 1, 9) / 10) : int(rnd, 3, 30);
  return { letter: pick(rnd, LETTERS), sym, n };
}
/** Zone 1: put the shield on the line (some on tenths lines). */
export const genGraph = (rnd, opts = {}) => ({ id: nextId++, type: 'graph', rule: genRule(rnd, opts) });

/** Meteor values around a rule's boundary: the boundary itself, a hair either side, a step either side, and farther away. */
function valuesFor(rnd, r, count = 5) {
  const b = r.coef ? r.n / r.coef : r.n;
  const step = Number.isInteger(r2(b)) && !r.coef ? 1 : 0.5;
  const pool = r.coef
    ? [Math.floor(b) - 1, Math.floor(b), Math.floor(b) + 0.5, Math.ceil(b), Math.ceil(b) + 0.5, Math.ceil(b) + 1]
    : [b, b, r2(b + 0.01), r2(b - 0.01), r2(b + step), r2(b - step), r2(b + int(rnd, 2, 6) * step), r2(b - int(rnd, 2, 6) * step)];
  for (let tries = 0; tries < 50; tries++) {
    const vals = [...new Set(shuffle(rnd, pool))].filter((v) => v > 0).slice(0, count);
    const yes = vals.filter((v) => passes(r, v)).length;
    if (vals.length === count && yes > 0 && yes < count) return vals;
  }
  return [b - 3, b - 1, b, b + 1, b + 3].filter((v) => v > 0);
}
/** Zone 2: a meteor shower. Zap every solution before it lands. */
export function genMeteors(rnd, { coef = false } = {}) {
  let rule;
  if (coef) { const c = pick(rnd, [2, 3, 4, 5]), n = c * int(rnd, 4, 12) + int(rnd, 1, c - 1); rule = { letter: pick(rnd, LETTERS), coef: c, sym: pick(rnd, SYMS), n }; }
  else rule = genRule(rnd, { decimal: rnd() < 0.3 });
  return { id: nextId++, type: 'meteor', rules: [rule], values: valuesFor(rnd, rule) };
}
/** Zone 3: name three solutions (sometimes whole numbers only). */
export function genName3(rnd, { whole = rnd() < 0.3 } = {}) {
  const r = genRule(rnd, { decimal: !whole && rnd() < 0.4 });
  return { id: nextId++, type: 'name3', rule: r, whole };
}
/** Zone 4: a shield is up; write its rule. */
export function genRead(rnd) {
  const r = genRule(rnd, { decimal: rnd() < 0.4 });
  return { id: nextId++, type: 'read', rule: r, tiles: [r.n] };
}
/** Zone 4: how many solutions? */
export function genCount(rnd) {
  const r = genRule(rnd);
  const options = shuffle(rnd, [
    { text: 'Infinitely many', ok: true },
    { text: '1', trap: 'one_solution' },
    { text: '2', trap: 'one_solution' },
    { text: fmt(r.n), trap: 'one_solution' },
  ]);
  return { id: nextId++, type: 'pick', ask: 'count', rule: r, options };
}
/** Boss: x > a and x < a on one line. Which value is in neither field? */
export function genNeither(rnd) {
  const a = int(rnd, 3, 20), L = pick(rnd, LETTERS);
  const rules = [{ letter: L, sym: '>', n: a }, { letter: L, sym: '<', n: a }];
  const options = shuffle(rnd, [
    { text: `${L} = ${a}`, ok: true },
    { text: `${L} = ${a + 1}`, trap: 'neither' },
    { text: `${L} = ${a - 1}`, trap: 'neither' },
    { text: 'Every number is in one of them', trap: 'neither' },
  ]);
  return { id: nextId++, type: 'pick', ask: 'neither', rules, rule: rules[0], options };
}
/** Boss: Death Valley — two fields at once; zap the temperatures in BOTH. */
export function genOverlap(rnd) {
  const lo = int(rnd, 10, 20), hi = int(rnd, 120, 134), L = 't';
  const rules = [{ letter: L, sym: '≥', n: lo }, { letter: L, sym: '≤', n: hi }];
  const values = shuffle(rnd, [lo, hi, lo - int(rnd, 1, 5), hi + int(rnd, 1, 5), int(rnd, lo + 10, hi - 10)]);
  return { id: nextId++, type: 'meteor', rules, values, story: `Death Valley's lowest recorded temperature is ${lo}°F and its highest is ${hi}°F. Zap every temperature that could have been recorded.` };
}
/** Boss: Francine's gift card is enough for ANY app shown: v ≥ the most expensive. */
export function genGiftCard(rnd) {
  const prices = [...new Set(Array.from({ length: 4 }, () => r2(int(rnd, 99, 1299) / 100)))];
  while (prices.length < 4) prices.push(r2(int(rnd, 99, 1299) / 100 + prices.length));
  const max = Math.max(...prices);
  return { id: nextId++, type: 'read', gift: true, rule: { letter: 'v', sym: '≥', n: max }, tiles: prices,
    story: `Francine's gift card, worth v dollars, is enough to buy ANY one of these apps: ${prices.map((p) => fmt(p, true)).join(', ')}. Write a rule for v.` };
}
/** Boss: the freight elevator (w ≤ 1,500). */
export function genElevator(rnd) {
  const n = pick(rnd, [1000, 1200, 1500, 2000]);
  const rule = { letter: 'w', sym: '≤', n };
  return { id: nextId++, type: 'meteor', rules: [rule], values: shuffle(rnd, [n, n + 5, n + 100, n - 0.5, n - int(rnd, 50, 400)]),
    story: `The law says a freight elevator can carry w ≤ ${fmt(n)} pounds. Zap every load that is allowed.` };
}

export const ZONES = [
  { name: 'Shield Up', blurb: 'Graph the solutions: circle, then shade' },
  { name: 'Meteor Shower', blurb: 'Zap every solution before it lands' },
  { name: 'Name Three', blurb: 'Any three solutions: there are lots!' },
  { name: 'Read the Field', blurb: 'Write the rule. How many solutions?' },
  { name: 'Twin Fields', blurb: 'Boss: two fields, gift cards and elevators' },
];
export function genZone(rnd, zone) {
  if (zone === 0) return shuffle(rnd, [genGraph(rnd), genGraph(rnd), genGraph(rnd, { decimal: true }), genGraph(rnd), genGraph(rnd, { decimal: true })]);
  if (zone === 1) return shuffle(rnd, [genMeteors(rnd), genMeteors(rnd), genMeteors(rnd, { coef: true }), genMeteors(rnd)]);
  if (zone === 2) return [genName3(rnd, { whole: false }), genName3(rnd, { whole: true }), genName3(rnd, { whole: false }), genName3(rnd)];
  if (zone === 3) return shuffle(rnd, [genRead(rnd), genRead(rnd), genRead(rnd), genCount(rnd), genCount(rnd)]);
  return [genOverlap(rnd), genNeither(rnd), genGiftCard(rnd), genElevator(rnd), genName3(rnd, { whole: false })];
}
export function genBackup(rnd, p) {
  if (p.type === 'graph') return genGraph(rnd, { decimal: !Number.isInteger(p.rule.n) });
  if (p.type === 'name3') return genName3(rnd, { whole: p.whole });
  if (p.type === 'read') return p.gift ? genGiftCard(rnd) : genRead(rnd);
  if (p.type === 'pick') return p.ask === 'neither' ? genNeither(rnd) : genCount(rnd);
  if (p.rules.length === 2) return genOverlap(rnd);
  if (p.story) return genElevator(rnd);
  return genMeteors(rnd, { coef: Boolean(p.rules[0].coef) });
}

/* ================================================================== */
/* Checking                                                            */
/* ================================================================== */
/** A finished meteor shower: which meteors did the student zap? */
export function checkShower(p, zapped) {
  const errors = p.values.map((v, i) => ({ v, i, good: passesAll(p.rules, v), zapped: zapped.has(i) })).filter((m) => m.good !== m.zapped);
  if (!errors.length) return { correct: true, key: 'correct', message: 'Every solution zapped, every other meteor let go!' };
  const e = errors[0], r = p.rules.find((x) => !passes(x, e.v)) || p.rules[0];
  const b = r.coef ? r.n / r.coef : r.n;
  const sub = r.coef ? `${r.coef} × ${fmt(e.v)} = ${fmt(r.coef * e.v)}, and ${fmt(r.coef * e.v)} ${r.sym} ${fmt(r.n)}` : `${fmt(e.v)} ${r.sym} ${fmt(r.n)}`;
  const verdict = passes(r, e.v) ? 'TRUE' : 'FALSE';
  let key, message;
  if (r.coef) { key = 'substitute'; message = `Put ${fmt(e.v)} in for ${r.letter}: ${sub} is ${verdict}.`; }
  else if (Math.abs(e.v - r.n) < EPS) { key = 'boundary_meteor'; message = `${fmt(e.v)} is the boundary. ${inclusive(r) ? `${r.sym} includes it, so it IS a solution.` : `${r.sym} leaves it out, so it is NOT a solution.`}`; }
  else if (Math.abs(e.v - b) < 0.1) { key = 'decimal_near'; message = `${fmt(e.v)} is very close to ${fmt(r.n)}, but ${sub} is ${verdict}. Even a hundredth counts!`; }
  else if (p.rules.length === 2) { key = 'both_fields'; message = `A solution must be in BOTH fields: ${p.rules.map(ruleText).join(' and ')}. ${fmt(e.v)} ${passesAll(p.rules, e.v) ? 'is' : 'is not'}.`; }
  else { key = e.good ? 'missed_solution' : 'zapped_wrong'; message = `Check it: ${sub} is ${verdict}.`; }
  return { correct: false, key, message: `${errors.length} meteor${errors.length > 1 ? 's' : ''} wrong. ${message}`, errors };
}

/** Three different solutions, typed. */
export function checkName3(p, raws) {
  const r = p.rule;
  const vals = raws.map(parseValue);
  if (vals.some((v) => v === null)) return { correct: false, nudge: true, key: 'not_a_number', message: 'Type a number in each box, like 12, 7.5 or 2 1/2.' };
  if (new Set(vals.map((v) => Math.round(v * 1e6))).size < 3) return { correct: false, nudge: true, key: 'not_different', message: 'Use three DIFFERENT solutions.' };
  for (const v of vals) {
    if (!passes(r, v)) {
      if (Math.abs(v - r.n) < EPS) return { correct: false, key: 'boundary', message: `${fmt(v)} is the boundary, and ${r.sym} leaves it out. Try values just past it.`, value: v };
      return { correct: false, key: 'wrong_side', message: `${fmt(v)} ${r.sym} ${fmt(r.n)} is false. The solutions are ${goesRight(r) ? 'greater' : 'less'} than ${fmt(r.n)}.`, value: v };
    }
    if (p.whole && Math.abs(v - Math.round(v)) > EPS) return { correct: false, key: 'not_whole', message: `Whole numbers only this time: ${fmt(v)} is not a whole number.`, value: v };
  }
  return { correct: true, key: 'correct', message: 'All three work! And there are infinitely many more.' };
}

/** Writing the rule for a field (or Francine's card). Letter first or number first. */
export function readTiles(tiles) {
  if (tiles.length !== 3 || tiles[1].t !== 'sym' || tiles[0].t === 'sym' || tiles[2].t === 'sym') return null;
  return tiles;
}
export const tilesText = (tiles) => tiles.map((t) => (t.t === 'num' ? fmt(t.v) : t.v)).join(' ');
export function checkWritten(p, tiles) {
  const r = p.rule;
  if (!readTiles(tiles)) return { correct: false, nudge: true, key: 'incomplete', message: 'A rule has three parts: the letter, a symbol and a number.' };
  let sym, num;
  if (tiles[0].t === 'var') { sym = tiles[1].v; num = tiles[2]; }
  else if (tiles[2].t === 'var') { sym = FLIP[tiles[1].v]; num = tiles[0]; }
  else return { correct: false, nudge: true, key: 'incomplete', message: `Use the letter ${r.letter}.` };
  if (num.t !== 'num' || Math.abs(num.v - r.n) > EPS) {
    if (p.gift) return { correct: false, key: 'not_max', message: `To buy ANY of the apps, the card needs at least the price of the most expensive one, ${fmt(r.n, true)}.` };
    return { correct: false, key: 'graph_number', message: `The edge of the field is at ${fmt(r.n)}.` };
  }
  const want = ruleText(r);
  if (sym === r.sym) return { correct: true, key: 'correct', message: `Yes! ${tilesText(tiles)}${tiles[0].t !== 'var' ? ` is the same as ${want}` : ''}.` };
  if (tiles[0].t !== 'var' && tiles[1].v === r.sym) return { correct: false, key: 'flipped_order', message: `With the number first, turn the symbol around: ${want} is ${fmt(r.n)} ${FLIP[r.sym]} ${r.letter}.` };
  const strictSwap = { '<': '≤', '≤': '<', '>': '≥', '≥': '>' }[r.sym];
  if (sym === strictSwap) {
    return { correct: false, key: 'graph_circle', message: p.gift ? `Exactly ${fmt(r.n, true)} is enough, so use ≥.` : `Look at the circle: ${inclusive(r) ? `closed ●, so ${fmt(r.n)} is included (${r.sym})` : `open ○, so ${fmt(r.n)} is not included (${r.sym})`}.` };
  }
  return { correct: false, key: 'graph_direction', message: p.gift ? `The card's value must be at LEAST the price: v ≥ ${fmt(r.n)}.` : `The shield covers values ${goesRight(r) ? 'GREATER' : 'LESS'} than ${fmt(r.n)}, so the symbol is ${r.sym}.` };
}
export function checkPick(p, i) {
  const o = p.options[i], right = p.options.find((x) => x.ok);
  if (p.ask === 'count') {
    if (o.ok) return { correct: true, key: 'correct', message: `Yes! ${ruleText(p.rule)} has infinitely many solutions: whole numbers, decimals, fractions…` };
    const r = p.rule, d = goesRight(r) ? 1 : -1;
    return { correct: false, key: 'one_solution', message: `An inequality is not like an equation: ${ruleText(r)} has infinitely many solutions (think of ${fmt(r.n + d)}, ${fmt(r.n + d * 0.5)}, ${fmt(r.n + d * 0.01)}…).` };
  }
  const a = p.rules[0].n;
  if (o.ok) return { correct: true, key: 'correct', message: `Yes! ${p.rules.map(ruleText).join(' and ')} both leave out ${a} itself (open circles).` };
  return { correct: false, key: 'neither', message: `Both circles are open, so ${a} is in NEITHER field. Every other number is in one of them. The answer: ${right.text}.` };
}

/* ================================================================== */
/* Worked solutions (after two misses)                                 */
/* ================================================================== */
export function workedSolution(p) {
  if (p.type === 'graph' || p.type === 'read') {
    const r = p.rule, line = lineFor(r);
    const lines = [];
    if (p.gift) lines.push(`The most expensive app is ${fmt(r.n, true)}; the card must be at least that.`);
    if (line.step < 1 && p.type === 'graph') lines.push(`Each small step is 0.1, so ${fmt(r.n)} is ${Math.round((r.n - line.lo) * 10)} steps past ${fmt(line.lo)}.`);
    lines.push(`${fmt(r.n)} itself: ${inclusive(r) ? 'included, closed circle ●' : 'not included, open circle ○'}.`);
    lines.push(`Solutions are ${goesRight(r) ? 'greater: shade right' : 'less: shade left'}. Rule: ${ruleText(r)}.`);
    return lines;
  }
  if (p.type === 'name3') {
    const r = p.rule, n = r.n;
    const ex = goesRight(r) ? (p.whole ? [n + 1, n + 2, n + 10] : [n + 1, r2(n + 0.5), n + 10])
      : (p.whole ? [n - 1, n - 2, 0] : [r2(n - 0.5), r2(n / 2), r2(n / 4)]);
    return [`${ruleText(r)}: solutions are ${goesRight(r) ? 'greater' : 'less'} than ${fmt(n)}${inclusive(r) ? ` (and ${fmt(n)} itself)` : ` (not ${fmt(n)} itself)`}.`,
      `For example: ${ex.map((v) => fmt(v)).join('; ')}.`, 'Check each one by putting it in the rule. There are infinitely many more.'];
  }
  if (p.type === 'pick') {
    if (p.ask === 'count') return [`${ruleText(p.rule)} is true for every value ${goesRight(p.rule) ? 'past' : 'below'} ${fmt(p.rule.n)}, including decimals.`, 'You can never list them all: infinitely many.'];
    return [`${ruleText(p.rules[0])} and ${ruleText(p.rules[1])} both have open circles at ${p.rules[0].n}.`, `So ${p.rules[0].n} is the only value in neither field.`];
  }
  return [`Rule${p.rules.length > 1 ? 's' : ''}: ${p.rules.map(ruleText).join(' and ')}.`, ...p.values.map((v) => `${fmt(v)}: ${passesAll(p.rules, v) ? 'solution, zap it' : 'not a solution'}`)];
}
