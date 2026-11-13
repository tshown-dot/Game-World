// Rune Machine (Lesson 4-9: Use Patterns to Write and Solve Equations): the math.
// No screen code here, so it can be tested with plain node (see test_rune_machine_math.js).
//
// The machine turns an input (the independent variable) into an output (the dependent variable) by a rule.
// A rule is { form, m, b }:
//   times  y = m·x          plus  y = x + b          line  y = m·x + b
//   down   y = b − m·x  (Ethan owes $60 and pays $5 a week: a = 60 − 5w)
// A machine has a story with its own letters: X (input) and Y (output).
//
// The game is an action game with four moves:
//   catch  the rule is carved on the machine; stones roll in and the student puts a basket where each output lands
//   dials  a table is on the wall; the student sets the rule on the machine's dials and the machine runs every row
//   back   the machine must make a target output; the student chooses the input
//   feed   the rule is hidden; the student chooses which inputs to test, then sets the dials

let nextId = 1;
const EPS = 1e-6;
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
const near = (a, b) => Math.abs(a - b) < EPS;

/** 1250 -> "1,250"; 36.6 -> "36.6"; −7 -> "−7" */
export function fmt(v) {
  const x = r2(v);
  if (x < 0) return `−${fmt(-x)}`;
  return Number.isInteger(x) ? x.toLocaleString('en-US') : x.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export const FORMS = ['times', 'plus', 'line', 'down'];
export function run(rule, x) {
  const { form, m = 1, b = 0 } = rule;
  if (form === 'times') return r2(m * x);
  if (form === 'plus') return r2(x + b);
  if (form === 'line') return r2(m * x + b);
  return r2(b - m * x);
}
const coef = (m, X) => (near(m, 1) ? X : `${fmt(m)}${X}`);
export function ruleText(rule, X = 'x', Y = 'y') {
  const { form, m, b } = rule;
  if (form === 'times') return `${Y} = ${coef(m, X)}`;
  if (form === 'plus') return b < 0 ? `${Y} = ${X} − ${fmt(-b)}` : `${Y} = ${X} + ${fmt(b)}`;
  if (form === 'line') return b < 0 ? `${Y} = ${coef(m, X)} − ${fmt(-b)}` : `${Y} = ${coef(m, X)} + ${fmt(b)}`;
  return `${Y} = ${fmt(b)} − ${coef(m, X)}`;
}
/** The rule with a number put in: c = 8(5) = 40 */
export function plugIn(rule, X, Y, x) { return `${ruleText(rule, `(${fmt(x)})`, Y)} = ${fmt(run(rule, x))}`; }
/** The rule shapes on the machine's dial (with boxes for the numbers). */
export const TEMPLATES = { times: 'Y = □X', plus: 'Y = X + □', line: 'Y = □X + □', down: 'Y = □ − □X' };
/** Which numbers a shape needs, in the order they appear. */
export const needs = (form) => ({ times: ['m'], plus: ['b'], line: ['m', 'b'], down: ['b', 'm'] })[form];
/** How far each dial turns. */
export const DIAL = { m: { lo: 1, hi: 12 }, b: { lo: 0, hi: 30 }, start: { lo: 0, hi: 80 } };

/* ================================================================== */
/* Machines (numbers kept small enough to fit a number line)           */
/* ================================================================== */
const NAMES = {
  times: [{ X: 'b', Y: 'c', xName: 'boxes', yName: 'candles' }, { X: 'k', Y: 'r', xName: 'rune keys', yName: 'runes lit' }, { X: 'p', Y: 'c', xName: 'packs', yName: 'cards' }],
  plus: [{ X: 't', Y: 'b', xName: "Talia's age", yName: "Brenda's age" }, { X: 'p', Y: 't', xName: 'price ($)', yName: 'total with shipping ($)' }, { X: 's', Y: 't', xName: 'stones in', yName: 'stones out' }],
  line: [{ X: 'r', Y: 'c', xName: 'rides', yName: 'cost ($)', start: 'the admission' }, { X: 't', Y: 'p', xName: 'toppings', yName: 'pizza cost ($)', start: 'the plain pizza' }],
  down: [{ X: 'w', Y: 'a', xName: 'weeks', yName: 'amount owed ($)', start: 'what was owed at first' }, { X: 'm', Y: 'g', xName: 'minutes', yName: 'gallons left', start: 'the full tank' }],
};
/** A machine: { rule, xmax (the biggest sensible input), X, Y, xName, yName, start? }. */
export function genMachine(rnd, form) {
  const names = pick(rnd, NAMES[form]);
  if (form === 'times') return { rule: { form, m: int(rnd, 2, 9), b: 0 }, xmax: 10, ...names };
  if (form === 'plus') return { rule: { form, m: 1, b: int(rnd, 3, 15) }, xmax: 20, ...names };
  if (form === 'line') return { rule: { form, m: int(rnd, 2, 4), b: int(rnd, 3, 12) }, xmax: 10, ...names };
  const m = int(rnd, 2, 5), k = int(rnd, 8, 12);
  return { rule: { form, m, b: m * k }, xmax: k, ...names };
}
const distinct = (rnd, lo, hi, n) => shuffle(rnd, Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)).slice(0, n);
function tableFor(rnd, rule, { skip = false, start = null } = {}) {
  let xs;
  if (skip) { const a = int(rnd, 1, 3); xs = [a, a + 1, a + 3, a + 4 + int(rnd, 0, 2)]; }
  else { const a = start !== null ? start : int(rnd, 1, 4); xs = [a, a + 1, a + 2, a + 3]; }
  return xs.map((x) => ({ x, y: run(rule, x) }));
}

/* ================================================================== */
/* Catch: where does each stone land?                                  */
/* ================================================================== */
/** inputs: the stones that roll in. line: the stretch of number line the outputs land on. far: big inputs. */
export function genCatch(rnd, form, { count = 5, far = false } = {}) {
  const mach = genMachine(rnd, form);
  if (far && form === 'times') mach.rule.m = Math.min(mach.rule.m, 4);
  const inputs = far ? shuffle(rnd, [20, 25, 30, 40, 50]).slice(0, count) : distinct(rnd, form === 'down' ? 0 : 1, mach.xmax, count);
  const max = Math.max(...inputs.map((x) => run(mach.rule, x)), form === 'down' ? mach.rule.b : 0);
  return { id: nextId++, type: 'catch', ...mach, inputs, far, line: { lo: 0, hi: Math.max(20, Math.ceil(max / 10) * 10) } };
}
/** The stone for input x landed. Was the basket there? Returns null when it was caught. */
export function checkCatch(p, x, basket) {
  const { rule, X, Y } = p, want = run(rule, x), { m, b } = rule;
  if (near(basket, want)) return null;
  const fact = `${plugIn(rule, X, Y, x)}. Your basket was at ${fmt(basket)}.`;
  const tip = (key, text) => ({ key, message: `${fact} ${text}` });
  if (rule.form === 'times' && near(basket, x + m)) return tip('add_vs_times', `${fmt(m)}${X} means ${fmt(m)} TIMES ${X}, not ${X} + ${fmt(m)}.`);
  if (rule.form === 'plus' && near(basket, x * b)) return tip('add_vs_times', `This machine ADDS ${fmt(b)}. It does not multiply.`);
  if (rule.form === 'line' && near(basket, m * (x + b))) return tip('order_of_ops', `Multiply first, then add: ${fmt(m)} × ${fmt(x)} = ${fmt(m * x)}, then + ${fmt(b)}.`);
  if ((rule.form === 'line' || rule.form === 'down') && near(basket, m * x)) return tip('forgot_start', `That is only ${fmt(m)} × ${fmt(x)}. Do not forget the ${rule.form === 'down' ? `start of ${fmt(b)}` : `+ ${fmt(b)}`}.`);
  if (rule.form === 'down' && near(basket, b + m * x)) return tip('wrong_direction', `This machine takes ${fmt(m)} AWAY each time, so the outputs go down.`);
  if (Math.abs(basket - want) <= 2) return tip('close', 'Close! Check the arithmetic.');
  return tip('calc', `Put ${fmt(x)} in for ${X} and work it out.`);
}

/* ================================================================== */
/* Dials: write the rule from a table                                  */
/* ================================================================== */
/**
 * forms: the shapes on offer. skip: the table's inputs skip numbers.
 * broken: the dials start on a rule that fits the first row only (the student has to fix it).
 */
export function genDials(rnd, form, { skip = false, forms = FORMS, broken = false } = {}) {
  const mach = genMachine(rnd, form);
  const rows = tableFor(rnd, mach.rule, { skip, start: form === 'down' ? 0 : null });
  const preset = broken ? { form: 'plus', m: 1, b: rows[0].y - rows[0].x } : null;
  return { id: nextId++, type: 'dials', ...mach, rows, forms, preset, broken, skip };
}
/** The student's rule: { form, m, b }. Every row is tested; rows[i] true/false comes back for the screen. */
export function checkRule(p, guess) {
  const g = { m: 1, b: 0, ...guess };
  const rows = p.rows.map((r) => near(run(g, r.x), r.y));
  const got = ruleText(g, p.X, p.Y);
  if (rows.every(Boolean)) return { correct: true, key: 'correct', rows, message: `The rune glows! ${got} works for every row.` };
  const fits = rows.filter(Boolean).length;
  const r0 = p.rows[0];
  const jumps = p.rows.slice(1).map((r, i) => ({ dx: r.x - p.rows[i].x, dy: r.y - p.rows[i].y }));
  const slope = jumps[0].dy / jumps[0].dx;
  const big = jumps.find((j) => !near(j.dx, 1));
  if (big && ((g.form !== 'plus' && near(g.m, Math.abs(big.dy))) || (g.form === 'plus' && near(g.b, big.dy)))) {
    return { correct: false, key: 'skipped_inputs', rows, message: `Careful: the inputs skip! Where ${p.X} jumps by ${fmt(big.dx)}, the output changes by ${fmt(Math.abs(big.dy))}. That's the change for ${fmt(big.dx)}, not for 1.` };
  }
  if (p.rule.form === 'times' && g.form === 'plus' && near(g.b, slope)) {
    return { correct: false, key: 'add_vs_times', rows, message: `The outputs go up by ${fmt(slope)} for each 1 more input, but that doesn't mean "add ${fmt(slope)}". Look across a row: ${fmt(r0.y)} is ${fmt(p.rule.m)} TIMES ${fmt(r0.x)}.` };
  }
  if (p.rule.form === 'down' && g.form === 'line' && near(g.m, p.rule.m)) {
    return { correct: false, key: 'wrong_direction', rows, message: `The outputs go DOWN as ${p.X} goes up, so the rule must take ${fmt(p.rule.m)} away each time: start amount − ${fmt(p.rule.m)}${p.X}.` };
  }
  if ((p.rule.form === 'line' || p.rule.form === 'down') && (g.form === 'times' || near(g.b || 0, 0)) && near(g.m, p.rule.m)) {
    return { correct: false, key: 'forgot_start', rows, message: `Right rate, ${fmt(p.rule.m)} each, but where does it start? At ${p.X} = 0 the output is ${fmt(p.rule.b)}${p.start ? ` (${p.start})` : ''}.` };
  }
  if (fits > 0) return { correct: false, key: 'some_rows', rows, message: `${got} fits ${fits} row${fits > 1 ? 's' : ''}, but not all of them. A rule must work for EVERY row.` };
  return { correct: false, key: 'no_rows', rows, message: `${got} doesn't fit the table. Compare each output with its input: is it added to, or multiplied?` };
}
/**
 * Run the student's rule through the machine: every row on the wall, then the machine's own hidden stones.
 * Returns checkRule's result plus  table (all the rows tested),  made (what the student's rule makes for each)
 * and  firstBad (the first row that disagrees, or -1).
 */
export function testRule(p, guess) {
  const g = { m: 1, b: 0, ...guess };
  const table = [...p.rows, ...(p.hidden || [])].sort((a, c) => a.x - c.x);
  const res = checkRule({ ...p, rows: table }, g);
  return { ...res, table, made: table.map((r) => run(g, r.x)), firstBad: res.rows.indexOf(false) };
}
export const answerRule = (p) => ruleText(p.rule, p.X, p.Y);

/* ================================================================== */
/* Back: which input makes the target?                                 */
/* ================================================================== */
/** zero: (shrinking rules) when does the amount reach 0? */
export function genBack(rnd, form, { zero = false } = {}) {
  const mach = genMachine(rnd, form);
  const answer = form === 'down' ? (zero ? mach.xmax : int(rnd, 2, mach.xmax - 1)) : int(rnd, 2, mach.xmax);
  return { id: nextId++, type: 'back', ...mach, answer, target: run(mach.rule, answer), strip: { lo: 0, hi: 20 } };
}
/** The student sent input x through. Returns null when it made the target. */
export function checkBack(p, x) {
  const { rule, X, Y, target } = p, { m, b } = rule;
  if (near(run(rule, x), target)) return null;
  const how = rule.form === 'times' ? `Undo the × ${fmt(m)}: what is ${fmt(target)} ÷ ${fmt(m)}?`
    : rule.form === 'plus' ? `Undo the + ${fmt(b)}: what is ${fmt(target)} − ${fmt(b)}?`
      : rule.form === 'line' ? `Undo it in reverse order: take away ${fmt(b)}, then divide by ${fmt(m)}.`
        : `How many ${fmt(m)}s must be taken from ${fmt(b)} to leave ${fmt(target)}?`;
  return { key: 'backward', message: `${plugIn(rule, X, Y, x)}, not ${fmt(target)}. ${how}` };
}

/* ================================================================== */
/* Feed: choose which inputs to test                                   */
/* ================================================================== */
/** stones: how many inputs the student may test. extra: two stones the machine adds itself when the rule is tested. */
export function genFeed(rnd, form, { stones = 4 } = {}) {
  const mach = genMachine(rnd, form), hi = form === 'down' ? mach.xmax : 10;
  return { id: nextId++, type: 'feed', ...mach, strip: { lo: 0, hi }, stones, extra: distinct(rnd, 1, hi, 2), forms: FORMS };
}
/** The table the student's stones made: one row per different input, in order. */
export function feedRows(p, xs) {
  return [...new Set(xs)].sort((a, c) => a - c).map((x) => ({ x, y: run(p.rule, x) }));
}
/** After feeding: the dials round for this machine. The machine's own stones stay hidden until the test. */
export function dialsFromFeed(p, xs) {
  const rows = feedRows(p, xs);
  const hidden = p.extra.filter((x) => !rows.some((r) => r.x === x)).map((x) => ({ x, y: run(p.rule, x) }));
  return { ...p, type: 'dials', fed: true, rows, hidden, preset: null, broken: false };
}

/* ================================================================== */
/* Zones                                                               */
/* ================================================================== */
export const ZONES = [
  { name: 'Catch It', blurb: 'Use the rule: where will each stone land?' },
  { name: 'Read the Table', blurb: 'Set the dials to match the pattern' },
  { name: 'Run It Backward', blurb: 'Pick the input, and read far ahead' },
  { name: 'Feed the Machine', blurb: 'A hidden rule: choose what to test' },
  { name: 'The Ancient Runes', blurb: 'Boss: two-step rules and rules that shrink' },
];
/** The rounds of a zone, in order. */
export function genZone(rnd, zone) {
  const two = ['times', 'plus'];
  if (zone === 0) return [genCatch(rnd, 'times'), genCatch(rnd, 'plus'), genCatch(rnd, 'times')];
  if (zone === 1) return [genDials(rnd, 'times', { forms: two }), genDials(rnd, 'plus', { forms: two }), genDials(rnd, 'times', { forms: two, skip: true }), genDials(rnd, 'plus', { forms: two, skip: true }), genDials(rnd, 'times', { forms: two, skip: true })];
  if (zone === 2) return [genBack(rnd, 'times'), genBack(rnd, 'plus'), genCatch(rnd, pick(rnd, two), { count: 3, far: true }), genBack(rnd, 'line'), genBack(rnd, 'times')];
  if (zone === 3) return [genFeed(rnd, 'times'), genFeed(rnd, 'plus'), genFeed(rnd, 'line')];
  return [genDials(rnd, 'line', { skip: true }), genCatch(rnd, 'line', { count: 4 }), genFeed(rnd, 'down'), genBack(rnd, 'down', { zero: true }), genDials(rnd, 'line', { broken: true })];
}
