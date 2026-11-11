// Rune Machine (Lesson 4-9: Use Patterns to Write and Solve Equations): the math.
// No screen code here, so it can be tested with plain node (see test_rune_machine_math.js).
//
// The machine turns an input (the independent variable) into an output (the dependent variable) by a hidden rule.
// A rule is { form, m, b }:
//   times  y = m·x          plus  y = x + b          line  y = m·x + b (b may be negative: y = 2x − 7)
//   down   y = b − m·x  (Ethan owes $75 and pays $5 a week: a = 75 − 5w)
// A problem has a story with its own letters: X (input) and Y (output).

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

/** 1250 -> "1,250"; 36.6 -> "36.6"; 61.25 -> "61.25"; −7 -> "−7" */
export function fmt(v) {
  const x = r2(v);
  if (x < 0) return `−${fmt(-x)}`;
  return Number.isInteger(x) ? x.toLocaleString('en-US') : x.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
/** A typed number: "1,250", "$61.25", "36.6", "-7" (negatives allowed for table outputs like 2x − 7). */
export function parseNumber(raw) {
  const t = String(raw ?? '').trim().replace(/^\$/, '').replace(/,/g, '').replace(/^−/, '-').replace(/\s/g, '');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
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
/** The shape templates the student picks from (with boxes for the numbers). */
export const TEMPLATES = { times: 'Y = □X', plus: 'Y = X + □', line: 'Y = □X + □', down: 'Y = □ − □X' };
export const needs = (form) => ({ times: ['m'], plus: ['b'], line: ['m', 'b'], down: ['b', 'm'] })[form];

/* ================================================================== */
/* Stories (from the kinds of tables in the textbook lesson)           */
/* ================================================================== */
const STORIES = {
  times: [
    { X: 'b', Y: 'c', xName: 'boxes', yName: 'candles', make: (rnd) => ({ m: int(rnd, 6, 12) }), ask: (x) => `How many candles are in ${fmt(x)} boxes?` },
    { X: 'n', Y: 'c', xName: 'tickets', yName: 'cost ($)', make: (rnd) => ({ m: int(rnd, 12, 30) }), ask: (x) => `How much do ${fmt(x)} water park tickets cost?` },
    { X: 'w', Y: 'p', xName: 'weeks', yName: 'pages read', make: (rnd) => ({ m: int(rnd, 20, 60) }), ask: (x) => `How many pages after ${fmt(x)} weeks?` },
    { X: 'k', Y: 'r', xName: 'rune keys', yName: 'runes lit', make: (rnd) => ({ m: int(rnd, 3, 9) }), ask: (x) => `How many runes light up with ${fmt(x)} keys?` },
  ],
  plus: [
    { X: 't', Y: 'b', xName: 'Talia\'s age', yName: 'Brenda\'s age', make: (rnd) => ({ b: int(rnd, 2, 9) }), ask: (x) => `How old is Brenda when Talia is ${fmt(x)}?` },
    { X: 'p', Y: 't', xName: 'price ($)', yName: 'total with shipping ($)', make: (rnd) => ({ b: int(rnd, 4, 9) }), ask: (x) => `What is the total for a $${fmt(x)} item?` },
    { X: 's', Y: 't', xName: 'stones put in', yName: 'stones out', make: (rnd) => ({ b: int(rnd, 3, 15) }), ask: (x) => `How many stones come out when ${fmt(x)} go in?` },
  ],
  line: [
    { X: 'r', Y: 'c', xName: 'rides', yName: 'cost ($)', make: (rnd) => ({ m: int(rnd, 2, 4), b: int(rnd, 5, 12) }), ask: (x) => `What does Andrea pay at the fair for ${fmt(x)} rides?`, start: 'the admission' },
    { X: 't', Y: 'p', xName: 'toppings', yName: 'pizza cost ($)', make: (rnd) => ({ m: int(rnd, 2, 3), b: int(rnd, 8, 14) }), ask: (x) => `How much is a pizza with ${fmt(x)} toppings?`, start: 'the plain pizza' },
  ],
  down: [
    { X: 'w', Y: 'a', xName: 'weeks', yName: 'amount owed ($)', make: (rnd) => { const m = pick(rnd, [5, 10, 15]); return { m, b: m * int(rnd, 10, 18) }; }, ask: (x) => `How much will Ethan owe after ${fmt(x)} weeks?`, start: 'what he owed at first' },
    { X: 'm', Y: 'g', xName: 'minutes', yName: 'gallons left', make: (rnd) => { const m = pick(rnd, [4, 6, 8]); return { m, b: m * int(rnd, 12, 20) }; }, ask: (x) => `How many gallons are left after ${fmt(x)} minutes?`, start: 'the full tank' },
  ],
  decimal: [
    { X: 's', Y: 'y', xName: 'seconds', yName: 'yards', make: () => ({ m: 12.2 }), ask: (x) => `How far does the cyclist ride in ${fmt(x)} seconds?` },
    { X: 't', Y: 'c', xName: 'movie tickets', yName: 'cost ($)', make: (rnd) => ({ m: pick(rnd, [8.75, 9.25, 7.5]) }), ask: (x) => `What do ${fmt(x)} movie tickets cost?` },
  ],
};
function story(rnd, kind) {
  const s = pick(rnd, STORIES[kind]);
  const rule = { form: kind === 'decimal' ? 'times' : kind, m: 1, b: 0, ...s.make(rnd) };
  return { s, rule };
}
function tableFor(rnd, rule, { skip = false, start = null } = {}) {
  let xs;
  if (skip) { const a = int(rnd, 1, 3); xs = [a, a + 1, a + 3, a + 4 + int(rnd, 0, 2)]; }
  else { const a = start !== null ? start : int(rnd, 1, 4); xs = [a, a + 1, a + 2, a + 3]; }
  if (rule.form === 'down') xs = xs.filter((x) => run(rule, x) >= 0);
  return xs.map((x) => ({ x, y: run(rule, x) }));
}
const base = (p, s) => ({ ...p, X: s.X, Y: s.Y, xName: s.xName, yName: s.yName, start: s.start });

/** Zones 1, 4 and the boss: crack the rule from a table. */
export function genCrack(rnd, { kind = rnd() < 0.5 ? 'times' : 'plus', skip = false } = {}) {
  const { s, rule } = story(rnd, kind);
  const rows = tableFor(rnd, rule, { skip, start: kind === 'down' ? 0 : null });
  return base({ id: nextId++, type: 'crack', rule, rows, skip, kind }, s);
}
/** Zone 2: the rule is carved on the machine; fill in the missing outputs. */
export function genFill(rnd, { kind = pick(rnd, ['times', 'plus', 'line', 'line', 'down']) } = {}) {
  let rule, s;
  if (kind === 'line' && rnd() < 0.4) { rule = { form: 'line', m: int(rnd, 2, 3), b: -int(rnd, 1, 7) }; s = { X: 'x', Y: 'y', xName: 'x', yName: 'y' }; }   // y = 2x − 7
  else ({ s, rule } = story(rnd, kind));
  const rows = tableFor(rnd, rule, { start: kind === 'down' ? 0 : null });
  const blanks = shuffle(rnd, rows.map((_, i) => i)).slice(0, 2).sort((a, c) => a - c);
  return base({ id: nextId++, type: 'fill', rule, rows, blanks, kind }, s);
}
/** Zone 3 and the boss: read far ahead, or work backward to an input. */
export function genPredict(rnd, { kind = rnd() < 0.5 ? 'times' : 'plus', backward = false } = {}) {
  const { s, rule } = story(rnd, kind);
  const rows = tableFor(rnd, rule, { start: kind === 'down' ? 0 : null });
  let x, question;
  if (backward) {
    x = kind === 'down' ? rule.b / rule.m : rows[rows.length - 1].x + int(rnd, 3, 8);
    question = kind === 'down' ? `After how many ${s.xName} will the amount reach 0?` : `For which input does the machine put out ${fmt(run(rule, x))} ${s.yName}?`;
  } else {
    x = rows[rows.length - 1].x + int(rnd, 4, 9);
    if (kind === 'down') x = Math.min(x, Math.floor(rule.b / rule.m));
    question = s.ask(x);
  }
  return base({ id: nextId++, type: 'predict', rule, rows, backward, target: x, answer: backward ? x : run(rule, x), question, kind }, s);
}
/** Zone 4: Maya's rule fits the first row only. Which row breaks it? */
export function genMaya(rnd) {
  const m = int(rnd, 2, 4), x0 = int(rnd, 1, 3), b0 = int(rnd, 5, 20);
  const rule = { form: 'line', m, b: b0 };
  const rows = [0, 1, 2, 3].map((i) => ({ x: x0 + i, y: run(rule, x0 + i) }));
  const maya = { form: 'plus', b: rows[0].y - rows[0].x };              // fits row 1 only
  const options = [
    ...rows.slice(1).map((r, i) => ({ text: `Row ${i + 2}: ${fmt(r.x)} → ${fmt(r.y)}`, row: i + 1, ok: i === 0 })),
    { text: 'None: Maya is right', row: -1, ok: false },
  ];
  return { id: nextId++, type: 'maya', rule, maya, rows, options, X: 'd', Y: 'h', xName: 'days', yName: 'plant height (cm)' };
}

export const ZONES = [
  { name: 'Crack the Rune', blurb: 'Find the rule from the table' },
  { name: 'Feed the Machine', blurb: 'Use the rule to fill the table' },
  { name: 'Read Ahead', blurb: 'Predict far ahead, or work backward' },
  { name: 'Tricky Tables', blurb: 'Skipped inputs, and is Maya right?' },
  { name: 'The Ancient Runes', blurb: 'Boss: two-step rules and decimals' },
];
export function genZone(rnd, zone) {
  if (zone === 0) return shuffle(rnd, [genCrack(rnd, { kind: 'times' }), genCrack(rnd, { kind: 'times' }), genCrack(rnd, { kind: 'plus' }), genCrack(rnd, { kind: 'plus' }), genCrack(rnd)]);
  if (zone === 1) return shuffle(rnd, [genFill(rnd, { kind: 'times' }), genFill(rnd, { kind: 'plus' }), genFill(rnd, { kind: 'line' }), genFill(rnd, { kind: 'line' }), genFill(rnd, { kind: 'down' })]);
  if (zone === 2) return shuffle(rnd, [genPredict(rnd, { kind: 'times' }), genPredict(rnd, { kind: 'plus' }), genPredict(rnd, { kind: 'times', backward: true }), genPredict(rnd, { kind: 'plus', backward: true }), genPredict(rnd, { kind: 'down', backward: true })]);
  if (zone === 3) return shuffle(rnd, [genCrack(rnd, { kind: 'times', skip: true }), genCrack(rnd, { kind: 'times', skip: true }), genCrack(rnd, { kind: 'plus', skip: true }), genMaya(rnd), genMaya(rnd)]);
  return [genCrack(rnd, { kind: 'line', skip: true }), genCrack(rnd, { kind: 'down', skip: true }), genCrack(rnd, { kind: 'decimal', skip: true }), genPredict(rnd, { kind: 'decimal' }), genPredict(rnd, { kind: 'line' })];
}
export function genBackup(rnd, p) {
  if (p.type === 'maya') return genMaya(rnd);
  if (p.type === 'fill') return genFill(rnd, { kind: p.kind });
  if (p.type === 'predict') return genPredict(rnd, { kind: p.kind, backward: p.backward });
  return genCrack(rnd, { kind: p.kind, skip: p.skip });
}

/* ================================================================== */
/* Checking                                                            */
/* ================================================================== */
/** The student's rule: { form, m, b }. Every row is tested; rows[i] true/false comes back for the screen. */
export function checkRule(p, guess) {
  if (!guess || !FORMS.includes(guess.form) || needs(guess.form).some((k) => typeof guess[k] !== 'number' || !Number.isFinite(guess[k]))) {
    return { correct: false, nudge: true, key: 'incomplete', message: 'Pick a rule shape and fill in every box.' };
  }
  const g = { m: 1, b: 0, ...guess };
  const rows = p.rows.map((r) => near(run(g, r.x), r.y));
  const want = ruleText(p.rule, p.X, p.Y), got = ruleText(g, p.X, p.Y);
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
  if (p.rule.form === 'times' && g.form === 'times' && near(g.m * p.rule.m, 1) && !near(g.m, 1)) {
    return { correct: false, key: 'swapped', rows, message: `That's backwards: it gets ${p.X} from ${p.Y}. The output ${p.Y} is the bigger number: ${p.Y} = ${fmt(p.rule.m)}${p.X}.` };
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
export const answerRule = (p) => ruleText(p.rule, p.X, p.Y);

/** Fill the table: typed values for the blank rows. */
export function checkFill(p, raws) {
  const vals = raws.map(parseNumber);
  if (vals.some((v) => v === null)) return { correct: false, nudge: true, key: 'incomplete', message: 'Type a number in each empty box.' };
  const rule = p.rule, rt = ruleText(rule, p.X, p.Y);
  for (let k = 0; k < p.blanks.length; k++) {
    const x = p.rows[p.blanks[k]].x, want = run(rule, x), v = vals[k];
    if (near(v, want)) continue;
    let key = 'calc', message = `Put ${fmt(x)} in for ${p.X}: ${plugIn(rule, p.X, p.Y, x)}.`;
    if (rule.form === 'line' && near(v, rule.m * (x + rule.b))) { key = 'order_of_ops'; message = `Multiply first, then ${rule.b < 0 ? 'subtract' : 'add'}: ${fmt(rule.m)} × ${fmt(x)} = ${fmt(rule.m * x)}, then ${rule.b < 0 ? '−' : '+'} ${fmt(Math.abs(rule.b))} = ${fmt(want)}.`; }
    else if ((rule.form === 'line' || rule.form === 'down') && near(v, rule.m * x)) { key = 'forgot_start'; message = `That's only ${fmt(rule.m)} × ${fmt(x)}. Don't forget the ${rule.form === 'down' ? 'starting amount' : `${rule.b < 0 ? '−' : '+'} ${fmt(Math.abs(rule.b))}`}: ${fmt(want)}.`; }
    return { correct: false, key, message, row: p.blanks[k] };
  }
  return { correct: true, key: 'correct', message: `Table complete! Every row follows ${rt}.` };
}

/** Predict: far ahead or backward. */
export function checkPredict(p, raw) {
  const v = parseNumber(raw);
  if (v === null) return { correct: false, nudge: true, key: 'incomplete', message: 'Type a number.' };
  const rt = ruleText(p.rule, p.X, p.Y);
  if (near(v, p.answer)) return { correct: true, key: 'correct', message: p.backward ? `Yes! ${p.X} = ${fmt(v)}. Check: ${plugIn(p.rule, p.X, p.Y, v)}.` : `Yes! ${plugIn(p.rule, p.X, p.Y, p.target)}.` };
  if (p.backward && near(v, run(p.rule, run(p.rule, p.answer))) && !near(run(p.rule, p.answer), p.answer)) {
    return { correct: false, key: 'forward_instead', message: `That ran the machine forward. Work backward: which input ${p.X} gives ${fmt(run(p.rule, p.answer))}? Undo the rule.` };
  }
  const r0 = p.rows[0];
  if (!p.backward && (p.rule.form === 'line' || p.rule.form === 'down') && r0.x !== 0 && near(v, (r0.y / r0.x) * p.target)) {
    return { correct: false, key: 'scaled_with_start', message: `Scaling one row up doesn't work when there's a starting amount. Use the rule: ${rt}, so the answer is ${fmt(run(p.rule, p.target))}.` };
  }
  return { correct: false, key: 'use_the_rule', message: `Find the rule first (${p.Y} from ${p.X}), then ${p.backward ? 'undo it' : `put in ${fmt(p.target)}`}. Check your answer against the table's pattern.` };
}
/** Maya: which row breaks her rule? */
export function checkMaya(p, i) {
  const o = p.options[i];
  const mayaText = ruleText(p.maya, 'd', 'h');
  if (o.ok) return { correct: true, key: 'correct', message: `Right! ${mayaText} fits row 1 only. Row 2: ${fmt(p.rows[1].x)} + ${fmt(p.maya.b)} = ${fmt(p.rows[1].x + p.maya.b)}, not ${fmt(p.rows[1].y)}. The real rule is ${ruleText(p.rule, 'd', 'h')}.` };
  if (o.row === -1) return { correct: false, key: 'first_row_only', message: `Test EVERY row! Row 2: ${fmt(p.rows[1].x)} + ${fmt(p.maya.b)} = ${fmt(p.rows[1].x + p.maya.b)}, not ${fmt(p.rows[1].y)}. A rule must fit them all.` };
  return { correct: false, key: 'first_row_only', message: `It breaks even earlier. Row 2: ${fmt(p.rows[1].x)} + ${fmt(p.maya.b)} = ${fmt(p.rows[1].x + p.maya.b)}, not ${fmt(p.rows[1].y)}.` };
}

/* ================================================================== */
/* Worked solutions (after two misses)                                 */
/* ================================================================== */
export function workedSolution(p) {
  const rt = ruleText(p.rule, p.X, p.Y), r = p.rule, r0 = p.rows[0];
  const sub = (x) => plugIn(r, p.X, p.Y, x);
  if (p.type === 'maya') return [`Maya's rule ${ruleText(p.maya, 'd', 'h')} fits row 1: ${fmt(r0.x)} + ${fmt(p.maya.b)} = ${fmt(r0.y)}.`, `Row 2 breaks it: ${fmt(p.rows[1].x)} + ${fmt(p.maya.b)} = ${fmt(p.rows[1].x + p.maya.b)}, not ${fmt(p.rows[1].y)}.`, `The rule that fits every row: ${rt}.`];
  const how = r.form === 'times' ? `Each output is ${fmt(r.m)} times its input (${fmt(r0.y)} = ${fmt(r.m)} × ${fmt(r0.x)}).`
    : r.form === 'plus' ? `Each output is ${fmt(r.b)} more than its input (${fmt(r0.y)} = ${fmt(r0.x)} + ${fmt(r.b)}).`
      : r.form === 'line' ? `Each 1 more input adds ${fmt(r.m)}; at 0 the output would be ${fmt(r.b)}.`
        : `It starts at ${fmt(r.b)} and goes down ${fmt(r.m)} for each 1 more input.`;
  const lines = [how, `Rule: ${rt}.`];
  if (p.type === 'crack') lines.push(`Check row 2: ${sub(p.rows[1].x)} ✓`);
  if (p.type === 'fill') lines.push(...p.blanks.map((i) => `${sub(p.rows[i].x)}`));
  if (p.type === 'predict') lines.push(p.backward ? `Work backward: ${p.X} = ${fmt(p.answer)}, because ${sub(p.answer)}.` : sub(p.target));
  return lines;
}
