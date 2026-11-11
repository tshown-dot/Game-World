// Golem Fort (Topic 4 boss: The Equation Golem): the math. A review of lessons 4-1 to 4-10.
// No screen code here, so it can be tested with plain node (see test_golem_fort_math.js).
//
// Every problem uses one of four answer kinds, so the boss has one simple set of controls:
//   num     type a number (fractions like 5/4 or 1 1/4 and decimals are fine)
//   choice  pick one answer; each wrong answer carries its own explanation
//   graph   build an inequality graph: boundary point, open or closed circle, shade left or right
//   rule    pick a rule shape and fill its boxes (y = □x, y = x + □, y = □x + □)

let nextId = 1;
const EPS = 1e-9;
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
export const near = (a, b) => Math.abs(a - b) < 1e-6;
const r4 = (v) => Math.round(v * 10000) / 10000;

/** 1250 -> "1,250"; 4.75 -> "4.75"; −3 -> "−3" */
export function fmt(v) {
  const x = Math.round(v * 100) / 100;
  if (x < 0) return `−${fmt(-x)}`;
  return Number.isInteger(x) ? x.toLocaleString('en-US') : x.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
/** A typed number: "23", "$15", "15.00", "4.75", "5/4", "1 1/4", "-3". */
export function parseNumber(raw) {
  let t = String(raw ?? '').trim().replace(/^\$/, '').replace(/,/g, '').replace(/^−/, '-');
  const mixed = t.match(/^(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) { const d = Number(mixed[4]); if (!d) return null; const v = Number(mixed[2]) + Number(mixed[3]) / d; return mixed[1] ? -v : v; }
  const frac = t.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (frac) { const d = Number(frac[2]); return d ? Number(frac[1]) / d : null; }
  t = t.replace(/\s/g, '');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/* ================================================================== */
/* Building blocks                                                     */
/* ================================================================== */
const VARS = ['x', 'n', 'm', 'p', 'k', 'w', 'y'];
const ok = (text) => ({ text, ok: true, key: 'correct' });
const no = (text, key, message) => ({ text, ok: false, key, message });
const choice = (rnd, extra, options) => ({ id: nextId++, kind: 'choice', ...extra, options: shuffle(rnd, options) });
/** A typed-answer problem. Traps that match the answer or an earlier trap are dropped, so each wrong value has one message. */
const num = (extra) => {
  const traps = (extra.traps || []).filter((t, i, all) => !near(t.v, extra.answer) && !all.slice(0, i).some((u) => near(u.v, t.v)));
  return { id: nextId++, kind: 'num', ...extra, traps };
};
/** A one-step equation, solved: { op, a, b, v (variable), text, answer }. */
function oneStep(rnd, op = pick(rnd, ['+', '−', '×', '÷'])) {
  const v = pick(rnd, VARS);
  if (op === '+') { const x = int(rnd, 3, 40), a = int(rnd, 2, 30); return { op, v, a, b: x + a, answer: x, text: `${v} + ${a} = ${x + a}` }; }
  if (op === '−') { const x = int(rnd, 12, 60), a = int(rnd, 2, 11); return { op, v, a, b: x - a, answer: x, text: `${v} − ${a} = ${x - a}` }; }
  if (op === '×') { const x = int(rnd, 2, 12), a = int(rnd, 2, 9); return { op, v, a, b: x * a, answer: x, text: `${a}${v} = ${x * a}` }; }
  const x = int(rnd, 2, 9) * int(rnd, 2, 6), a = pick(rnd, [2, 3, 4, 5, 6].filter((d) => x % d === 0)) || 2;
  return { op, v, a, b: x / a, answer: x, text: `${v} ÷ ${a} = ${x / a}` };
}
/** The answer you get by using the SAME operation instead of the inverse one. */
const sameOp = (e) => ({ '+': e.b + e.a, '−': e.b - e.a, '×': e.b * e.a, '÷': e.b / e.a })[e.op];
const inverse = { '+': 'subtract', '−': 'add', '×': 'divide by', '÷': 'multiply by' };

/* ================================================================== */
/* Zone 1, the Feet: 4-1 solutions and 4-2 properties of equality     */
/* ================================================================== */
export function genSolution(rnd) {
  const e = oneStep(rnd);
  const wrong = sameOp(e);
  const opts = [ok(`${e.v} = ${fmt(e.answer)}`), no(`${e.v} = ${fmt(wrong)}`, 'same_operation', `Substitute it: ${e.text.replace(e.v, `(${fmt(wrong)})`)}? No. Undo the ${e.op === '+' ? 'adding' : e.op === '−' ? 'subtracting' : e.op === '×' ? 'multiplying' : 'dividing'}: ${inverse[e.op]} ${e.a}.`)];
  for (const d of [e.answer + 1, e.answer - 1, e.b]) if (d > 0 && !opts.some((o) => o.text === `${e.v} = ${fmt(d)}`)) opts.push(no(`${e.v} = ${fmt(d)}`, 'test_it', `Test it by substituting: put ${fmt(d)} in for ${e.v}. Do both sides match?`));
  return choice(rnd, { type: 'solution', lesson: '4-1', eq: e.text, prompt: `Which value of ${e.v} is a solution of <b class="mono">${e.text}</b>?`, answerText: `${e.v} = ${fmt(e.answer)}`, solve: e }, opts.slice(0, 4));
}
export function genBalance(rnd) {
  const e = oneStep(rnd, pick(rnd, ['+', '×']));
  const step = e.op === '+' ? `subtract ${e.a} from both sides` : `divide both sides by ${e.a}`;
  return choice(rnd, { type: 'balance', lesson: '4-2', eq: e.text, prompt: `Which step keeps <b class="mono">${e.text}</b> balanced AND gets ${e.v} alone?`, answerText: `${step[0].toUpperCase()}${step.slice(1)}`, solve: e }, [
    ok(`${step[0].toUpperCase()}${step.slice(1)}`),
    no(e.op === '+' ? `Subtract ${e.a} from the left side only` : `Divide the left side only by ${e.a}`, 'one_side', 'Whatever you do to one side, you must do to the OTHER side too, or the scale tips.'),
    no(e.op === '+' ? `Add ${e.a} to both sides` : `Multiply both sides by ${e.a}`, 'same_operation', `That keeps it balanced, but ${e.v} isn't alone. Use the OPPOSITE operation: ${step}.`),
    no(e.op === '+' ? `Subtract ${e.b} from both sides` : `Divide both sides by ${e.b}`, 'wrong_number', `Undo what is done TO ${e.v}: the ${e.a}.`),
  ]);
}

/* ================================================================== */
/* Zone 2, the Arms: 4-3 and 4-4, write and solve from a story        */
/* ================================================================== */
const STORIES = [
  { op: '−', make: (rnd) => { const a = int(rnd, 5, 15), left = int(rnd, 8, 30); return { a, b: left, answer: left + a, story: `Kai had some stickers, gave away ${a}, and has ${left} left. How many did Kai have at first?`, eq: `s − ${a} = ${left}` }; } },
  { op: '+', make: (rnd) => { const a = int(rnd, 6, 25), total = a + int(rnd, 5, 30); return { a, b: total, answer: total - a, story: `A hiking trail is ${total} miles. Ana has hiked ${a} miles. How many miles are left?`, eq: `${a} + m = ${total}` }; } },
  { op: '×', make: (rnd) => { const a = int(rnd, 3, 8), each = int(rnd, 4, 12); return { a, b: a * each, answer: each, story: `${a * each} rocks are packed into ${a} equal bags. How many rocks are in each bag?`, eq: `${a}r = ${a * each}` }; } },
  { op: '÷', make: (rnd) => { const a = int(rnd, 3, 6), each = int(rnd, 4, 12); return { a, b: each, answer: a * each, story: `Some gems are shared equally by ${a} miners. Each miner gets ${each}. How many gems were there?`, eq: `g ÷ ${a} = ${each}` }; } },
];
export function genStory(rnd, op = pick(rnd, ['+', '−', '×', '÷'])) {
  const s = STORIES.find((t) => t.op === op);
  const d = s.make(rnd);
  const wrong = ({ '+': d.b + d.a, '−': d.b - d.a, '×': d.b * d.a, '÷': d.b / d.a })[op];
  return num({ type: 'story', lesson: op === '+' || op === '−' ? '4-3' : '4-4', op, prompt: d.story, eq: d.eq, answer: d.answer, label: 'answer',
    traps: [{ v: wrong, key: 'same_operation', message: `Write it first: ${d.eq}. To get the letter alone, use the OPPOSITE operation: ${inverse[op]} ${d.a}.` }] });
}
export function genSolveEq(rnd) {
  const e = oneStep(rnd);
  return num({ type: 'solve', lesson: e.op === '+' || e.op === '−' ? '4-3' : '4-4', op: e.op, prompt: `Solve <b class="mono">${e.text}</b>.`, eq: e.text, answer: e.answer, label: e.v,
    traps: [{ v: sameOp(e), key: 'same_operation', message: `Check: put ${fmt(sameOp(e))} back in and it doesn't work. Undo with the opposite: ${inverse[e.op]} ${e.a}.` }] });
}

/* ================================================================== */
/* Zone 3, the Shoulders: 4-5 rational numbers                         */
/* ================================================================== */
const FRACS = [[1, 2], [1, 4], [3, 4], [2, 3], [1, 3], [3, 5]];
export function genRational(rnd, form = pick(rnd, ['dec+', 'dec×', 'frac×', 'frac+', 'dec−'])) {
  const v = pick(rnd, VARS);
  if (form === 'dec+') {
    const x = int(rnd, 4, 40) / 4, a = int(rnd, 3, 30) / 4, b = r4(x + a);
    return num({ type: 'rational', lesson: '4-5', form, prompt: `Solve <b class="mono">${v} + ${fmt(a)} = ${fmt(b)}</b>.`, eq: `${v} + ${fmt(a)} = ${fmt(b)}`, answer: x, label: v,
      traps: [{ v: b + a, key: 'same_operation', message: `Subtract ${fmt(a)} from both sides (don't add): ${fmt(b)} − ${fmt(a)} = ${fmt(x)}.` }] });
  }
  if (form === 'dec−') {
    const x = int(rnd, 20, 80) / 4, a = int(rnd, 2, 15) / 4, b = r4(x - a);
    return num({ type: 'rational', lesson: '4-5', form, prompt: `Solve <b class="mono">${v} − ${fmt(a)} = ${fmt(b)}</b>.`, eq: `${v} − ${fmt(a)} = ${fmt(b)}`, answer: x, label: v,
      traps: [{ v: b - a, key: 'same_operation', message: `Add ${fmt(a)} to both sides to undo the subtraction: ${fmt(b)} + ${fmt(a)} = ${fmt(x)}.` }] });
  }
  if (form === 'dec×') {
    const a = pick(rnd, [0.4, 0.5, 0.2, 2.5, 1.5, 0.25]), x = a === 1.5 ? int(rnd, 1, 8) * 2 : a === 0.25 ? int(rnd, 2, 12) : int(rnd, 2, 16) * (a === 0.4 ? 5 : a === 2.5 ? 2 : 1), b = r4(a * x);
    return num({ type: 'rational', lesson: '4-5', form, prompt: `Solve <b class="mono">${fmt(a)}${v} = ${fmt(b)}</b>.`, eq: `${fmt(a)}${v} = ${fmt(b)}`, answer: x, label: v,
      traps: [{ v: r4(a * b), key: 'same_operation', message: `${v} is MULTIPLIED by ${fmt(a)}, so divide both sides by ${fmt(a)}: ${fmt(b)} ÷ ${fmt(a)} = ${fmt(x)}.` }] });
  }
  if (form === 'frac×') {
    const [n, d] = pick(rnd, FRACS.filter(([p]) => p > 0)), x = d * int(rnd, 2, 9), b = (n * x) / d;
    return num({ type: 'rational', lesson: '4-5', form, prompt: `Solve <b class="mono">${n}/${d} ${v} = ${fmt(b)}</b>.`, eq: `${n}/${d} ${v} = ${fmt(b)}`, answer: x, label: v,
      traps: [{ v: (b * n) / d, key: 'same_operation', message: `Multiplying by ${n}/${d} makes it smaller still. Divide by ${n}/${d}, which is the same as multiplying by ${d}/${n}: ${fmt(b)} × ${d}/${n} = ${fmt(x)}.` }] });
  }
  const [n, d] = pick(rnd, [[1, 2], [1, 4], [3, 4], [2, 5], [3, 5]]), w = int(rnd, 1, 4);   // no thirds: the answer must be exact as a decimal too
  const b = w + 1, x = b - n / d;                            // v + n/d = b, answer is a fraction like 1 1/4
  return num({ type: 'rational', lesson: '4-5', form, prompt: `Solve <b class="mono">${v} + ${n}/${d} = ${b}</b>. (A fraction or a decimal is fine.)`, eq: `${v} + ${n}/${d} = ${b}`, answer: x, label: v,
    traps: [{ v: b + n / d, key: 'same_operation', message: `Subtract ${n}/${d} from both sides: ${b} − ${n}/${d} = ${fracText(x)}.` }] });
}
/** 1.25 -> "1 1/4" (for answers built from the fractions above) */
export function fracText(v) {
  for (const d of [2, 3, 4, 5, 6, 12, 15, 20]) {
    const top = Math.round(v * d);
    if (near(top / d, v)) { const w = Math.floor(top / d), r = top - w * d; return r === 0 ? `${w}` : w ? `${w} ${r}/${d}` : `${r}/${d}`; }
  }
  return fmt(v);
}

/* ================================================================== */
/* Zone 4, the Shield: 4-6 write inequalities, 4-7 solve and graph     */
/* ================================================================== */
const SIGN_STORIES = [
  { sign: '≥', make: (b) => `You must be at least ${b} years old to ride the canyon zipline.`, v: 'a' },
  { sign: '>', make: (b) => `The golem is taller than ${b} feet.`, v: 'h' },
  { sign: '≤', make: (b) => `The bridge holds no more than ${b} hikers at a time.`, v: 'h' },
  { sign: '<', make: (b) => `There are fewer than ${b} gems left in the cave.`, v: 'g' },
];
const SIGN_TIPS = {
  '≥': '"At least" means that number OR MORE: ≥ (the number itself counts).',
  '>': '"More than / taller than" means bigger, not equal: >.',
  '≤': '"No more than / at most" means that number OR LESS: ≤.',
  '<': '"Fewer than / less than" means smaller, not equal: <.',
};
const bigger = (sg) => sg === '>' || sg === '≥';
export function genWriteIneq(rnd) {
  const s = pick(rnd, SIGN_STORIES), b = int(rnd, 6, 60);
  const opts = ['≥', '>', '≤', '<'].map((sg) => (sg === s.sign ? ok(`${s.v} ${sg} ${b}`)
    : no(`${s.v} ${sg} ${b}`, bigger(sg) === bigger(s.sign) ? 'equal_or_not' : 'direction', SIGN_TIPS[s.sign])));
  return choice(rnd, { type: 'writeIneq', lesson: '4-6', prompt: `${s.make(b)} Which inequality fits?`, answerText: `${s.v} ${s.sign} ${b}`, sign: s.sign, b, v: s.v }, opts);
}
/** Graph an inequality: v (sign) b. closed for ≤ ≥, shade right for > ≥. */
export function genGraph(rnd, { sign = pick(rnd, ['<', '>', '≤', '≥']), b = int(rnd, -3, 12) } = {}) {
  const v = pick(rnd, VARS);
  return { id: nextId++, kind: 'graph', type: 'graph', lesson: '4-6', sign, b, v, lo: b - 5, hi: b + 5, prompt: `Build the graph of <b class="mono">${v} ${sign} ${fmt(b)}</b> on the number line.`, answerText: `${v} ${sign} ${fmt(b)}` };
}
export function genSolveIneq(rnd) {
  const e = oneStep(rnd, pick(rnd, ['+', '×']));
  const sign = pick(rnd, ['<', '>', '≤', '≥']);
  const t = e.text.replace('=', sign);
  const opts = [
    ok(`${e.v} ${sign} ${fmt(e.answer)}`),
    no(`${e.v} ${sign} ${fmt(sameOp(e))}`, 'same_operation', `Solve it like an equation: ${inverse[e.op]} ${e.a} on both sides. The sign stays ${sign}.`),
    no(`${e.v} ${({ '<': '>', '>': '<', '≤': '≥', '≥': '≤' })[sign]} ${fmt(e.answer)}`, 'flipped_sign', `Adding, subtracting or dividing by a POSITIVE number doesn't flip the sign. Keep ${sign}.`),
    no(`${e.v} ${({ '<': '≤', '>': '≥', '≤': '<', '≥': '>' })[sign]} ${fmt(e.answer)}`, 'equal_or_not', `Keep the same sign, ${sign}. ${sign === '<' || sign === '>' ? `${fmt(e.answer)} itself is NOT a solution.` : `${fmt(e.answer)} itself IS a solution.`}`),
  ];
  return choice(rnd, { type: 'solveIneq', lesson: '4-7', prompt: `Solve <b class="mono">${t}</b>.`, eq: t, answerText: `${e.v} ${sign} ${fmt(e.answer)}`, solve: e, sign }, opts);
}
export function checkGraph(p, g) {
  if (!g || g.b === null || g.b === undefined || !g.circle || !g.dir) return { correct: false, nudge: true, key: 'incomplete', message: 'Set all three: the boundary point, the circle, and the direction to shade.' };
  const closed = p.sign === '≤' || p.sign === '≥', right = p.sign === '>' || p.sign === '≥';
  if (!near(g.b, p.b)) return { correct: false, key: 'boundary', message: `The boundary is the number in the inequality: ${fmt(p.b)}.` };
  if ((g.circle === 'closed') !== closed) return { correct: false, key: 'open_closed', message: closed ? `${p.sign} includes ${fmt(p.b)} itself, so use a CLOSED (filled) circle.` : `${p.sign} does NOT include ${fmt(p.b)}, so use an OPEN (empty) circle.` };
  if ((g.dir === 'right') !== right) return { correct: false, key: 'shade_direction', message: right ? `${p.v} ${p.sign} ${fmt(p.b)} means BIGGER numbers: shade to the right.` : `${p.v} ${p.sign} ${fmt(p.b)} means SMALLER numbers: shade to the left.` };
  return { correct: true, key: 'correct', message: `Shield cracked! ${closed ? 'Closed' : 'Open'} circle at ${fmt(p.b)}, shaded ${right ? 'right' : 'left'}.` };
}

/* ================================================================== */
/* Zone 5, the Core: 4-8 variables, 4-9 patterns, 4-10 tables/graphs   */
/* ================================================================== */
const PAIRS = [
  ['hours studied', 'test score'], ['number of tickets sold', 'money raised'], ['miles driven', 'gas used'],
  ['minutes in the oven', 'temperature of the bread'], ['number of rides', 'total cost'], ['weeks of practice', 'free throws made'],
];
export function genVariables(rnd) {
  const [cause, effect] = pick(rnd, PAIRS);
  const askDep = rnd() < 0.5;
  return choice(rnd, { type: 'variables', lesson: '4-8', prompt: `<b>${cause[0].toUpperCase()}${cause.slice(1)}</b> and <b>${effect}</b>: which is the <b>${askDep ? 'dependent' : 'independent'}</b> variable?`, answerText: askDep ? effect : cause }, [
    askDep ? ok(effect) : ok(cause),
    askDep ? no(cause, 'swapped_variables', `The dependent variable is the one that CHANGES BECAUSE of the other: ${effect} depends on ${cause}.`)
      : no(effect, 'swapped_variables', `The independent variable is the CAUSE: ${cause} changes ${effect}, not the other way.`),
  ]);
}
export const run = (r, x) => r4(r.form === 'times' ? r.m * x : r.form === 'plus' ? x + r.b : r.m * x + r.b);
export function ruleText(r, X = 'x', Y = 'y') {
  const c = r.m === 1 ? X : `${fmt(r.m)}${X}`;
  if (r.form === 'times') return `${Y} = ${c}`;
  if (r.form === 'plus') return `${Y} = ${X} + ${fmt(r.b)}`;
  return `${Y} = ${c} + ${fmt(r.b)}`;
}
export const FORMS = ['times', 'plus', 'line'];
export const needs = (form) => ({ times: ['m'], plus: ['b'], line: ['m', 'b'] })[form];
export function genTableRule(rnd, form = pick(rnd, ['times', 'plus'])) {
  const rule = form === 'times' ? { form, m: int(rnd, 3, 9), b: 0 } : form === 'plus' ? { form, m: 1, b: int(rnd, 3, 15) } : { form, m: int(rnd, 2, 5), b: int(rnd, 3, 12) };
  const a = int(rnd, 1, 3);
  const rows = [a, a + 1, a + 2, a + 3].map((x) => ({ x, y: run(rule, x) }));
  return { id: nextId++, kind: 'rule', type: 'tableRule', lesson: form === 'line' ? '4-10' : '4-9', rule, rows, X: 'x', Y: 'y', prompt: 'Write the rule that turns every <b>x</b> in the table into its <b>y</b>.', answerText: ruleText(rule) };
}
export function checkRule(p, guess) {
  if (!guess || !FORMS.includes(guess.form) || needs(guess.form).some((k) => typeof guess[k] !== 'number' || !Number.isFinite(guess[k]))) return { correct: false, nudge: true, key: 'incomplete', message: 'Pick a rule shape and fill every box.' };
  const g = { m: 1, b: 0, ...guess };
  const rows = p.rows.map((r) => near(run(g, r.x), r.y));
  if (rows.every(Boolean) && near(run(g, 0), run(p.rule, 0))) return { correct: true, key: 'correct', rows, message: `Every row fits ${ruleText(g, p.X, p.Y)}!` };
  const step = p.rows[1].y - p.rows[0].y;
  if (p.rule.form === 'times' && g.form === 'plus' && near(g.b, step)) return { correct: false, key: 'add_vs_times', rows, message: `The outputs go up by ${fmt(step)}, but compare ACROSS a row: ${fmt(p.rows[0].y)} = ${fmt(p.rule.m)} × ${fmt(p.rows[0].x)}. It's times, not plus.` };
  if (p.rule.form === 'line' && near(g.m, p.rule.m) && (g.form === 'times' || near(g.b, 0))) return { correct: false, key: 'forgot_start', rows, message: `Right rate (${fmt(p.rule.m)} each), but ${fmt(p.rows[0].y)} isn't ${fmt(p.rule.m)} × ${fmt(p.rows[0].x)}. What gets added on?` };
  return { correct: false, key: 'some_rows', rows, message: `${ruleText(g, p.X, p.Y)} doesn't fit every row. A rule must work for ALL of them.` };
}
/** The Core dilemma, part 1: which equation matches the story and the table? Part 2 uses it to solve. */
const DILEMMAS = [
  { X: 'r', Y: 'c', what: 'rides', make: (rnd) => ({ m: int(rnd, 2, 4), b: int(rnd, 5, 12) }), story: (r) => `The canyon fair costs $${r.b} to get in, plus $${r.m} for each ride.`, ask: (y) => `Mia spent $${y} at the fair. How many rides did she go on?` },
  { X: 'w', Y: 's', what: 'weeks', make: (rnd) => ({ m: int(rnd, 5, 10), b: int(rnd, 10, 40) }), story: (r) => `Leo has $${r.b} saved and adds $${r.m} every week.`, ask: (y) => `After how many weeks will Leo have $${y}?` },
];
export function genDilemma(rnd) {
  const d = pick(rnd, DILEMMAS), r = { form: 'line', ...d.make(rnd) };
  if (r.b === r.m) r.b += 1;                                  // keep every option different
  const rows = [1, 2, 3].map((x) => ({ x, y: run(r, x) }));
  const n = int(rnd, 5, 12), target = run(r, n);
  const part1 = choice(rnd, { type: 'dilemma1', lesson: '4-10', prompt: `${d.story(r)} Which equation gives the total <b>${d.Y}</b> for <b>${d.X}</b> ${d.what}?`, rows, X: d.X, Y: d.Y, rule: r, answerText: ruleText(r, d.X, d.Y) }, [
    ok(ruleText(r, d.X, d.Y)),
    no(`${d.Y} = ${r.b}${d.X} + ${r.m}`, 'swapped_numbers', `Check the table: ${d.X} = 1 gives ${fmt(rows[0].y)}. The ${r.m} is per ${d.what.slice(0, -1)}, so it goes WITH ${d.X}.`),
    no(`${d.Y} = ${r.m}${d.X}`, 'forgot_start', `That leaves out the starting $${r.b}. Check ${d.X} = 1: it should be ${fmt(rows[0].y)}.`),
    no(`${d.Y} = ${d.X} + ${r.m + r.b}`, 'add_vs_times', `That only works for 1 ${d.what.slice(0, -1)}. Check ${d.X} = 2: it should be ${fmt(rows[1].y)}.`),
  ]);
  const part2 = num({ type: 'dilemma2', lesson: '4-10', prompt: `${d.ask(target)} Use <b class="mono">${ruleText(r, d.X, d.Y)}</b>.`, eq: ruleText(r, d.X, d.Y), answer: n, label: d.X, rows, X: d.X, Y: d.Y, rule: r,
    traps: [
      { v: target / r.m, key: 'forgot_start', message: `First take away the start: ${target} − ${r.b} = ${target - r.b}. THEN divide by ${r.m}.` },
      { v: (target + r.b) / r.m, key: 'same_operation', message: `Undo the + ${r.b} by SUBTRACTING it: ${target} − ${r.b} = ${target - r.b}, then ÷ ${r.m}.` },
      { v: target - r.b, key: 'one_step_only', message: `Almost! ${target - r.b} is what the ${d.what} cost. Divide by $${r.m} each to find how many.` },
    ] });
  return [part1, part2];
}

/* ================================================================== */
/* Zones, backups and checks                                           */
/* ================================================================== */
export const ZONES = [
  { name: 'The Feet', blurb: '4-1, 4-2: solutions and balance' },
  { name: 'The Arms', blurb: '4-3, 4-4: write and solve' },
  { name: 'The Shoulders', blurb: '4-5: fractions and decimals' },
  { name: 'The Shield', blurb: '4-6, 4-7: inequalities' },
  { name: 'The Core', blurb: 'Boss: 4-8 to 4-10 and a dilemma' },
];
export function genZone(rnd, zone) {
  if (zone === 0) return shuffle(rnd, [genSolution(rnd), genSolution(rnd), genSolution(rnd), genBalance(rnd), genBalance(rnd)]);
  if (zone === 1) return shuffle(rnd, [genStory(rnd, '−'), genStory(rnd, '+'), genStory(rnd, '×'), genStory(rnd, '÷'), genSolveEq(rnd)]);
  if (zone === 2) return shuffle(rnd, ['dec+', 'dec−', 'dec×', 'frac×', 'frac+'].map((f) => genRational(rnd, f)));
  if (zone === 3) return [genWriteIneq(rnd), genWriteIneq(rnd), genGraph(rnd), genSolveIneq(rnd), genGraph(rnd)];
  return [genVariables(rnd), genTableRule(rnd, pick(rnd, ['times', 'plus'])), genTableRule(rnd, 'line'), ...genDilemma(rnd)];
}
export function genBackup(rnd, p) {
  const t = p.type;
  if (t === 'solution') return genSolution(rnd);
  if (t === 'balance') return genBalance(rnd);
  if (t === 'story') return genStory(rnd, p.op);
  if (t === 'solve') return genSolveEq(rnd);
  if (t === 'rational') return genRational(rnd, p.form);
  if (t === 'writeIneq') return genWriteIneq(rnd);
  if (t === 'graph') return genGraph(rnd);
  if (t === 'solveIneq') return genSolveIneq(rnd);
  if (t === 'variables') return genVariables(rnd);
  if (t === 'tableRule') return genTableRule(rnd, p.rule.form);
  const [a, b] = genDilemma(rnd);
  return t === 'dilemma1' ? a : b;
}
export function checkNum(p, raw) {
  const v = parseNumber(raw);
  if (v === null) return { correct: false, nudge: true, key: 'incomplete', message: 'Type a number (fractions like 5/4 are fine).' };
  if (near(v, p.answer)) return { correct: true, key: 'correct', message: `Smash! ${p.label} = ${p.type === 'rational' && !Number.isInteger(p.answer) ? fracText(p.answer) : fmt(p.answer)}.` };
  const trap = p.traps.find((t) => near(v, t.v));
  if (trap) return { correct: false, key: trap.key, message: trap.message };
  return { correct: false, key: 'check_it', message: `Check by substituting ${fmt(v)} back into ${p.eq}: do both sides match?` };
}
export function checkChoice(p, i) {
  const o = p.options[i];
  if (o.ok) return { correct: true, key: 'correct', message: `Smash! ${o.text}.` };
  return { correct: false, key: o.key, message: o.message };
}

/* ================================================================== */
/* Worked solutions (after two misses)                                 */
/* ================================================================== */
export function workedSolution(p) {
  const t = p.type;
  if (t === 'solution' || t === 'solveIneq') { const e = p.solve; return [`${p.eq}: ${e.v} has ${e.op === '+' ? `${e.a} added` : e.op === '−' ? `${e.a} subtracted` : e.op === '×' ? `been multiplied by ${e.a}` : `been divided by ${e.a}`}.`, `Undo it: ${inverse[e.op]} ${e.a} on both sides.`, `Answer: ${p.answerText}.`]; }
  if (t === 'balance') return [`Do the same thing to BOTH sides.`, `Use the opposite of what is done to ${p.solve.v}.`, `${p.answerText}.`];
  if (t === 'writeIneq') return [SIGN_TIPS[p.sign], `Answer: ${p.answerText}.`];
  if (t === 'graph') {
    const closed = p.sign === '≤' || p.sign === '≥', right = p.sign === '>' || p.sign === '≥';
    return [`Boundary: ${fmt(p.b)}.`, `${p.sign} ${closed ? 'includes' : 'does not include'} ${fmt(p.b)}: ${closed ? 'closed' : 'open'} circle.`, `${right ? 'Bigger' : 'Smaller'} numbers: shade ${right ? 'right' : 'left'}.`];
  }
  if (t === 'variables') return [`Ask: which one changes BECAUSE of the other?`, `Answer: ${p.answerText}.`];
  if (t === 'tableRule') return [`Compare each x with its y: ${p.rows.slice(0, 2).map((r) => `${fmt(r.x)} → ${fmt(r.y)}`).join(', ')}.`, `Rule: ${p.answerText}.`, `Check: ${p.rows[2].x} → ${fmt(run(p.rule, p.rows[2].x))} ✓`];
  if (t === 'dilemma1') return [`Start amount: $${p.rule.b}. Each ${p.X === 'r' ? 'ride' : 'week'}: $${p.rule.m}.`, `So ${p.answerText}.`, `Check ${p.X} = 1: ${fmt(run(p.rule, 1))} ✓`];
  if (t === 'dilemma2') { const r = p.rule, y = run(r, p.answer); return [`${y} = ${r.m}${p.X} + ${r.b}`, `Subtract ${r.b}: ${y - r.b} = ${r.m}${p.X}`, `Divide by ${r.m}: ${p.X} = ${fmt(p.answer)}`]; }
  return [`Equation: ${p.eq}.`, `Use the opposite operation on both sides.`, `${p.label} = ${p.type === 'rational' ? fracText(p.answer) : fmt(p.answer)}`];
}
