// Trail Mapper (Lesson 4-10: Relate Tables, Graphs, and Equations): the math.
// No screen code here, so it can be tested with plain node (see test_trail_mapper_math.js).
//
// Every trail is one relationship shown three ways: a RULE (equation), a LOGBOOK (table) and a MAP (graph).
// A rule is { form, m, b }:   times y = m·x    plus y = x + b    line y = m·x + b    minus y = m·x − b
// The map is the first quadrant with 10 squares each way; each axis counts by its own step (1, 2, 5, 10 ...).

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
export const near = (a, b) => Math.abs(a - b) < EPS;

/** 1250 -> "1,250"; 2.5 -> "2.5"; 0.55 -> "0.55" */
export function fmt(v) {
  const x = r2(v);
  if (x < 0) return `−${fmt(-x)}`;
  return Number.isInteger(x) ? x.toLocaleString('en-US') : x.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
const money = (v) => `$${r2(v).toFixed(2)}`;
/** A typed number: "91", "$50", "1,250", "2.5", "-5". */
export function parseNumber(raw) {
  const t = String(raw ?? '').trim().replace(/^\$/, '').replace(/,/g, '').replace(/^−/, '-').replace(/\s/g, '');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export const FORMS = ['times', 'plus', 'line', 'minus'];
export const needs = (form) => ({ times: ['m'], plus: ['b'], line: ['m', 'b'], minus: ['m', 'b'] })[form];
export function run(rule, x) {
  const { form, m = 1, b = 0 } = rule;
  if (form === 'times') return r2(m * x);
  if (form === 'plus') return r2(x + b);
  if (form === 'line') return r2(m * x + b);
  return r2(m * x - b);
}
const coef = (m, X) => (near(m, 1) ? X : `${fmt(m)}${X}`);
export function ruleText(rule, X = 'x', Y = 'y') {
  const { form, m, b } = rule;
  if (form === 'times') return `${Y} = ${coef(m, X)}`;
  if (form === 'plus') return `${Y} = ${X} + ${fmt(b)}`;
  if (form === 'line') return `${Y} = ${coef(m, X)} + ${fmt(b)}`;
  return `${Y} = ${coef(m, X)} − ${fmt(b)}`;
}
/** The rule with a number put in: d = 4(3) = 12 */
export const plugIn = (rule, X, Y, x) => `${ruleText(rule, `(${fmt(x)})`, Y)} = ${fmt(run(rule, x))}`;
export const pair = (x, y) => `(${fmt(x)}, ${fmt(y)})`;

/* ================================================================== */
/* The map: pick axis steps so every point sits on a grid crossing     */
/* ================================================================== */
const X_STEPS = [1, 2, 5, 10];
const Y_STEPS = [0.5, 1, 2, 5, 10, 20, 25, 50];
const onStep = (v, s) => near(v / s, Math.round(v / s));
/** The smallest steps that put every point on a crossing inside 10 squares, or null. */
export function fitGrid(points) {
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  if (xs.some((v) => v < 0) || ys.some((v) => v < 0)) return null;
  const xStep = X_STEPS.find((s) => xs.every((v) => onStep(v, s)) && Math.max(...xs) <= 10 * s);
  const halves = ys.some((v) => !Number.isInteger(r2(v)));          // count by ½ only when a value needs it
  const yStep = Y_STEPS.find((s) => (halves || s >= 1) && ys.every((v) => onStep(v, s)) && Math.max(...ys) <= 10 * s);
  return xStep && yStep ? { xStep, yStep, xMax: 10 * xStep, yMax: 10 * yStep } : null;
}
/** A tap on the map snaps to the nearest crossing. */
export const snap = (grid, x, y) => ({
  x: r2(Math.min(grid.xMax, Math.max(0, Math.round(x / grid.xStep) * grid.xStep))),
  y: r2(Math.min(grid.yMax, Math.max(0, Math.round(y / grid.yStep) * grid.yStep))),
});

/* ================================================================== */
/* Trails (the kinds of situations in the lesson)                       */
/* ================================================================== */
const STORIES = {
  times: [
    { X: 't', Y: 'd', xName: 'time (hours)', yName: 'distance (miles)', unit: 'hour', make: (rnd) => ({ m: pick(rnd, [2, 3, 4, 5]) }) },
    { X: 'h', Y: 'n', xName: 'hours worked', yName: 'necklaces made', unit: 'hour', make: (rnd) => ({ m: pick(rnd, [2, 3]) }) },
    { X: 'p', Y: 'c', xName: 'trail passes', yName: 'cost ($)', unit: 'pass', make: (rnd) => ({ m: pick(rnd, [5, 10]) }) },
  ],
  plus: [
    { X: 'm', Y: 'n', xName: 'blocks Maria walks', yName: 'blocks Nancy walks', unit: 'block', make: (rnd) => ({ b: int(rnd, 2, 6) }) },
    { X: 'a', Y: 'b', xName: 'Ana\'s age', yName: 'Ben\'s age', unit: 'year', make: (rnd) => ({ b: int(rnd, 2, 5) }) },
  ],
  line: [
    { X: 't', Y: 'd', xName: 'time (hours)', yName: 'distance (miles)', unit: 'hour', start: 'the miles already hiked', make: (rnd) => { const m = pick(rnd, [2, 5]); return { m, b: m === 5 ? 5 : pick(rnd, [2, 4, 6]) }; } },
    { X: 'h', Y: 't', xName: 'hours', yName: 'temperature (°C)', unit: 'hour', start: 'the starting temperature', make: (rnd) => ({ m: 2, b: pick(rnd, [2, 4, 6]) }) },
  ],
  minus: [
    { X: 'd', Y: 'p', xName: 'decorations sold', yName: 'profit ($)', unit: 'decoration', start: 'the $5 of supplies', xMin: 3, make: () => ({ m: 2, b: 5 }) },
    { X: 'c', Y: 'p', xName: 'cups sold', yName: 'lemonade profit ($)', unit: 'cup', start: 'the cost of supplies', xMin: 2, make: () => ({ m: 5, b: 10 }) },
  ],
  puppy: [
    { X: 'w', Y: 'p', xName: 'weeks', yName: 'puppy weight (lb)', unit: 'week', start: 'the puppy\'s starting weight', make: () => ({ m: 0.5, b: 1 }) },
  ],
};
const FORM_OF = { times: 'times', plus: 'plus', line: 'line', minus: 'minus', puppy: 'line' };
/** A trail: story + rule + logbook inputs + a map that fits them (and any extra points). */
function trail(rnd, kind, { n = 3, extra = 0 } = {}) {
  for (let tries = 0; tries < 200; tries++) {
    const s = pick(rnd, STORIES[kind]);
    const rule = { form: FORM_OF[kind], m: 1, b: 0, ...s.make(rnd) };
    const lo = Math.max(1, s.xMin || 1);
    const pool = shuffle(rnd, Array.from({ length: 9 - lo }, (_, i) => lo + i)).slice(0, n + extra);
    const xs = pool.slice(0, n).sort((a, c) => a - c);
    const others = pool.slice(n);
    const pts = pool.map((x) => ({ x, y: run(rule, x) }));
    const grid = fitGrid([...pts, { x: 10, y: 0 }]);
    if (!grid || pts.some((p) => p.y < 0)) continue;
    return { s, rule, xs, others, grid, rows: xs.map((x) => ({ x, y: run(rule, x) })) };
  }
  throw new Error(`no trail fits for ${kind}`);
}
const base = (t, extra) => ({ id: nextId++, rule: t.rule, rows: t.rows, grid: t.grid, X: t.s.X, Y: t.s.Y, xName: t.s.xName, yName: t.s.yName, unit: t.s.unit, start: t.s.start, ...extra });

/** Zone 1 and the boss: the rule is given; plot a point for every logbook input. */
export function genPlot(rnd, { kind = pick(rnd, ['times', 'plus']) } = {}) {
  const t = trail(rnd, kind);
  return base(t, { type: 'plot', kind });
}
/** Zone 2 and the boss: read the map (forward: y for an x; backward: x for a y). */
export function genRead(rnd, { kind = pick(rnd, ['times', 'plus']), backward = false } = {}) {
  const t = trail(rnd, kind, { n: 2, extra: 1 });
  const x = t.others[0];
  const y = run(t.rule, x);
  return base(t, { type: 'read', kind, backward, ask: { x, y }, answer: backward ? x : y });
}
/** Zone 2: what does this point on the trail mean? */
export function genMeaning(rnd, { kind = pick(rnd, ['times', 'plus']) } = {}) {
  const t = trail(rnd, kind, { n: 2, extra: 1 });
  const x = t.others[0], y = run(t.rule, x);
  const xn = t.s.xName.replace(/ \(.*\)$/, ''), yn = t.s.yName.replace(/ \(.*\)$/, '');
  const options = shuffle(rnd, [
    { text: `When the ${xn} is ${fmt(x)}, the ${yn} is ${fmt(y)}.`, ok: true, key: 'correct' },
    { text: `When the ${xn} is ${fmt(y)}, the ${yn} is ${fmt(x)}.`, ok: false, key: 'swapped_pair' },
    { text: `The ${yn} goes up by ${fmt(y)} for every ${t.s.unit}.`, ok: false, key: 'pair_is_rate' },
    { text: `The ${xn} and the ${yn} add up to ${fmt(x + y)}.`, ok: false, key: 'pair_is_sum' },
  ]);
  return base(t, { type: 'meaning', kind, ask: { x, y }, options });
}
/** Zone 3 and the boss: the map shows a trail; write its rule. */
export function genRule(rnd, { kind = pick(rnd, ['times', 'plus', 'line', 'minus']) } = {}) {
  const t = trail(rnd, kind);
  return base(t, { type: 'rule', kind });
}
/** Zone 4: rule, logbook and map — one of them doesn't match the other two. */
export function genOdd(rnd) {
  const kind = pick(rnd, ['times', 'plus', 'line']);
  for (let tries = 0; tries < 200; tries++) {
    const t = trail(rnd, kind);
    const odd = pick(rnd, ['rule', 'table', 'map']);
    const r = t.rule;
    // a believable wrong version: the other shape through the first row, or a changed number
    const wrong = r.form === 'times' ? { form: 'plus', m: 1, b: t.rows[0].y - t.rows[0].x }
      : r.form === 'plus' ? { form: 'times', m: t.rows[0].y / t.rows[0].x, b: 0 }
        : { form: 'times', m: r.m, b: 0 };
    if (!Number.isInteger(wrong.m) || wrong.b < 0 || near(wrong.m, 1) && wrong.form === 'times') continue;
    const wrongRows = t.rows.map((row) => ({ x: row.x, y: run(wrong, row.x) }));
    if (wrongRows.every((w, i) => near(w.y, t.rows[i].y))) continue;
    let table = t.rows;
    if (odd === 'table') { const i = int(rnd, 1, 2); table = t.rows.map((row, k) => (k === i ? { x: row.x, y: r2(row.y + t.grid.yStep * pick(rnd, [1, 2])) } : row)); }
    const mapRule = odd === 'map' ? wrong : r;
    const grid = fitGrid([...table, ...t.rows.map((row) => ({ x: row.x, y: run(mapRule, row.x) })), { x: 10, y: 0 }]);
    if (!grid) continue;
    return base(t, { type: 'odd', kind, odd, grid, plaqueRule: odd === 'rule' ? wrong : r, table, mapRule });
  }
  throw new Error('no odd trail');
}
/** Zone 4: one marker is off the trail. Which one? */
export function genOffPoint(rnd) {
  const t = trail(rnd, pick(rnd, ['times', 'plus', 'line']), { n: 4 });
  const bad = int(rnd, 0, 3);
  const pts = t.rows.map((row, i) => (i === bad ? { x: row.x, y: r2(row.y + t.grid.yStep * pick(rnd, [-1, 1, 2])) } : row));
  if (pts[bad].y < 0 || pts[bad].y > t.grid.yMax) pts[bad].y = r2(t.rows[bad].y + t.grid.yStep);
  if (pts[bad].y > t.grid.yMax) pts[bad].y = r2(t.rows[bad].y - t.grid.yStep);
  return base(t, { type: 'offpoint', kind: 'off', pts, bad, rows: t.rows });
}
/** Zone 4: Mary's ratio equation ("for every 4 bananas, 2 apples": 4b × 2 = a). */
const RATIOS = [
  { X: 'b', Y: 'a', xName: 'bananas sold', yName: 'apples sold', k: 2, q: 2 },
  { X: 'b', Y: 'r', xName: 'blue beads', yName: 'red beads', k: 3, q: 2 },
  { X: 'm', Y: 'w', xName: 'miles hiked', yName: 'water bottles', k: 3, q: 1 },
];
export function genMary(rnd) {
  const s = pick(rnd, RATIOS);
  const k = s.k, q = pick(rnd, [1, 2]) * s.q, P = k * q;     // for every P of X there are q of Y, so Y = X ÷ k
  const rule = { form: 'times', m: 1 / k, b: 0 };
  const rows = [1, 2, 3].map((i) => ({ x: P * i, y: q * i }));
  const options = shuffle(rnd, [
    { text: `${s.Y} = ${s.X} ÷ ${k}`, ok: true, key: 'correct' },
    { text: `${P}${s.X} × ${q} = ${s.Y}`, ok: false, key: 'mary_multiply' },
    { text: `${s.Y} = ${k}${s.X}`, ok: false, key: 'ratio_backwards' },
    { text: `${s.Y} = ${s.X} − ${P - q}`, ok: false, key: 'ratio_difference' },
  ]);
  const grid = fitGrid([...rows, { x: 10, y: 0 }]);
  return { id: nextId++, type: 'mary', kind: 'mary', rule, rows, grid, options, P, q, k, X: s.X, Y: s.Y, xName: s.xName, yName: s.yName };
}
/** The boss: a goal problem. "How many pom poms to raise at least $50?" (round UP: 90 only makes $49.50). */
const GOALS = [
  { X: 'n', Y: 'r', xName: 'pom poms sold', yName: 'money raised ($)', what: 'pom poms', club: 'The booster club' },
  { X: 'c', Y: 'r', xName: 'cookies sold', yName: 'money raised ($)', what: 'cookies', club: 'The hiking club' },
  { X: 'k', Y: 'r', xName: 'key chains sold', yName: 'money raised ($)', what: 'key chains', club: 'The rock club' },
];
export function genGoal(rnd) {
  for (let tries = 0; tries < 200; tries++) {
    const s = pick(rnd, GOALS);
    const cents = pick(rnd, [55, 41, 35, 45, 65, 75, 40]), goal = pick(rnd, [20, 25, 30, 40, 50, 75]);
    const exact = (goal * 100) / cents, answer = Math.ceil(exact - 1e-9);
    if (Number.isInteger(exact) && rnd() < 0.7) continue;         // mostly goals that need rounding up
    const rule = { form: 'times', m: cents / 100, b: 0 };
    const rows = [10, 20, 30].map((x) => ({ x, y: run(rule, x) }));
    return { id: nextId++, type: 'goal', kind: 'goal', rule, rows, goal, answer, exact, cents, X: s.X, Y: s.Y, xName: s.xName, yName: s.yName,
      question: `${s.club} earns ${money(cents / 100)} for each of its ${s.what}. How many must they sell to raise at least $${goal}?` };
  }
  throw new Error('no goal');
}

export const ZONES = [
  { name: 'Plot the Trail', blurb: 'Rule to logbook to map' },
  { name: 'Read the Map', blurb: 'What does the graph say?' },
  { name: 'Map to Rule', blurb: 'Write the equation from the graph' },
  { name: 'Spot the Bad Map', blurb: 'Which one doesn\'t match?' },
  { name: 'Rockslide Pass', blurb: 'Boss: goals, starts and halves' },
];
export function genZone(rnd, zone) {
  if (zone === 0) return [genPlot(rnd, { kind: 'times' }), genPlot(rnd, { kind: 'plus' }), genPlot(rnd, { kind: 'times' }), genPlot(rnd, { kind: 'plus' }), genPlot(rnd, { kind: 'line' })];
  if (zone === 1) return shuffle(rnd, [genRead(rnd, { kind: 'times' }), genRead(rnd, { kind: 'plus' }), genRead(rnd, { kind: 'times', backward: true }), genMeaning(rnd), genMeaning(rnd)]);
  if (zone === 2) return [genRule(rnd, { kind: 'times' }), genRule(rnd, { kind: 'plus' }), genRule(rnd, { kind: 'times' }), genRule(rnd, { kind: 'line' }), genRule(rnd, { kind: 'minus' })];
  if (zone === 3) return shuffle(rnd, [genOdd(rnd), genOdd(rnd), genOffPoint(rnd), genMary(rnd), genOdd(rnd)]);
  return [genGoal(rnd), genPlot(rnd, { kind: 'puppy' }), genRule(rnd, { kind: 'line' }), genRead(rnd, { kind: 'line', backward: true }), genGoal(rnd)];
}
export function genBackup(rnd, p) {
  if (p.type === 'plot') return genPlot(rnd, { kind: p.kind });
  if (p.type === 'read') return genRead(rnd, { kind: p.kind, backward: p.backward });
  if (p.type === 'meaning') return genMeaning(rnd);
  if (p.type === 'rule') return genRule(rnd, { kind: p.kind });
  if (p.type === 'odd') return genOdd(rnd);
  if (p.type === 'offpoint') return genOffPoint(rnd);
  if (p.type === 'mary') return genMary(rnd);
  return genGoal(rnd);
}

/* ================================================================== */
/* Checking                                                            */
/* ================================================================== */
/** Plotted points: one for each logbook input. */
export function checkPlot(p, pts) {
  const r = p.rule;
  const swapped = pts.find((q) => p.rows.some((row) => !near(row.x, row.y) && near(q.x, row.y) && near(q.y, row.x)));
  if (swapped) return { correct: false, key: 'swapped_point', point: swapped, message: `You plotted ${pair(swapped.x, swapped.y)}: that's backwards. The input ${p.X} goes ACROSS first, then the output ${p.Y} goes UP: ${pair(swapped.y, swapped.x)}.` };
  const missing = p.rows.filter((row) => !pts.some((q) => near(q.x, row.x)));
  if (missing.length) return { correct: false, nudge: true, key: 'incomplete', message: `Plot a point for every logbook row. Still missing: ${p.X} = ${missing.map((m) => fmt(m.x)).join(', ')}.` };
  for (const row of p.rows) {
    const q = pts.find((v) => near(v.x, row.x));
    if (near(q.y, row.y)) continue;
    if ((r.form === 'line' || r.form === 'minus') && near(q.y, r.m * row.x)) {
      return { correct: false, key: 'forgot_start', point: q, message: `At ${p.X} = ${fmt(row.x)} you went up to ${fmt(q.y)}, which is only ${fmt(r.m)} × ${fmt(row.x)}. Don't forget the ${r.form === 'minus' ? '−' : '+'} ${fmt(r.b)}: ${plugIn(r, p.X, p.Y, row.x)}.` };
    }
    if (near(q.y, row.x)) return { correct: false, key: 'height_is_input', point: q, message: `The height of a point is the OUTPUT, not the input. ${plugIn(r, p.X, p.Y, row.x)}, so go up to ${fmt(row.y)}.` };
    return { correct: false, key: 'calc', point: q, message: `Check ${p.X} = ${fmt(row.x)}: ${plugIn(r, p.X, p.Y, row.x)}. Count the squares: each one up is ${fmt(p.grid.yStep)}.` };
  }
  const extra = pts.filter((q) => !p.rows.some((row) => near(row.x, q.x)));
  if (extra.length) return { correct: false, nudge: true, key: 'extra', message: `Only plot the logbook's inputs. Tap ${pair(extra[0].x, extra[0].y)} again to remove it.` };
  return { correct: true, key: 'correct', message: `On the trail! Every point fits ${ruleText(r, p.X, p.Y)}, so they line up.` };
}
/** Reading the map. */
export function checkRead(p, raw) {
  const v = parseNumber(raw);
  if (v === null) return { correct: false, nudge: true, key: 'incomplete', message: 'Type a number.' };
  const { x, y } = p.ask;
  if (near(v, p.answer)) return { correct: true, key: 'correct', message: `Yes! The point ${pair(x, y)} is on the trail: ${plugIn(p.rule, p.X, p.Y, x)}.` };
  if (near(v, p.backward ? y : x)) return { correct: false, key: 'wrong_axis', message: p.backward ? `${fmt(y)} is the ${p.Y} you were given. Find ${fmt(y)} on the UP axis, go across to the trail, then down to read ${p.X}.` : `${fmt(x)} is the ${p.X} you were given. Go across to ${fmt(x)}, UP to the trail, then read the height on the ${p.Y} axis.` };
  if (!p.backward && (p.rule.form === 'line' || p.rule.form === 'minus') && near(v, p.rule.m * x)) return { correct: false, key: 'forgot_start', message: `That's only ${fmt(p.rule.m)} × ${fmt(x)}. This trail doesn't start at 0: ${plugIn(p.rule, p.X, p.Y, x)}.` };
  return { correct: false, key: 'misread', message: p.backward ? `Find ${fmt(y)} on the ${p.Y} axis, go across to the trail, then straight down. Each square across is ${fmt(p.grid.xStep)}.` : `Go to ${fmt(x)} on the ${p.X} axis, up to the trail, then across. Each square up is ${fmt(p.grid.yStep)}.` };
}
const MEANING_MSG = {
  swapped_pair: (p) => `Backwards! In ${pair(p.ask.x, p.ask.y)} the FIRST number is the input (${p.xName}) and the second is the output (${p.yName}).`,
  pair_is_rate: (p) => `A point gives one pair of matching values, not how fast it grows. ${pair(p.ask.x, p.ask.y)} means: input ${fmt(p.ask.x)}, output ${fmt(p.ask.y)}.`,
  pair_is_sum: (p) => `The two numbers in a point aren't added. ${pair(p.ask.x, p.ask.y)} means: input ${fmt(p.ask.x)} goes with output ${fmt(p.ask.y)}.`,
};
export function checkMeaning(p, i) {
  const o = p.options[i];
  if (o.ok) return { correct: true, key: 'correct', message: `Right! ${pair(p.ask.x, p.ask.y)}: ${p.X} = ${fmt(p.ask.x)} goes with ${p.Y} = ${fmt(p.ask.y)}.` };
  return { correct: false, key: o.key, message: MEANING_MSG[o.key](p) };
}
/** Writing the rule from the map. The guess is { form, m, b }; it is checked on the plotted points and at 0. */
export function checkRule(p, guess) {
  if (!guess || !FORMS.includes(guess.form) || needs(guess.form).some((k) => typeof guess[k] !== 'number' || !Number.isFinite(guess[k]))) {
    return { correct: false, nudge: true, key: 'incomplete', message: 'Pick the rule\'s shape and fill in every box.' };
  }
  const g = { m: 1, b: 0, ...guess };
  const xs = [0, ...p.rows.map((r) => r.x)];
  const r = p.rule, got = ruleText(g, p.X, p.Y);
  if (xs.every((x) => near(run(g, x), run(r, x)))) return { correct: true, key: 'correct', guess: g, message: `The trail matches! ${got}.` };
  const r0 = p.rows[0], r1 = p.rows[1];
  const slope = (r1.y - r0.y) / (r1.x - r0.x);
  const res = (key, message) => ({ correct: false, key, guess: g, message });
  if (r.form === 'times' && g.form === 'plus' && near(g.b, slope)) return res('add_vs_times', `The trail climbs ${fmt(slope)} for each 1 across, but that means TIMES ${fmt(slope)}, not plus. Check ${pair(r0.x, r0.y)}: ${fmt(r0.y)} = ${fmt(slope)} × ${fmt(r0.x)}.`);
  if (r.form === 'times' && g.form === 'times' && near(g.m * r.m, 1) && !near(g.m, 1)) return res('swapped', `Upside down! The rule gives ${p.Y} from ${p.X}: ${p.Y} = □${p.X}.`);
  if ((r.form === 'line' || r.form === 'minus') && near(g.m, r.m) && (g.form === 'times' || near(g.b, 0))) return res('forgot_start', `Right steepness (${fmt(r.m)} each), but this trail doesn't go through (0, 0). At ${p.X} = 0 it is at ${fmt(run(r, 0))}.`);
  if (r.form === 'minus' && g.form === 'line' && near(g.m, r.m) && near(g.b, r.b)) return res('plus_vs_minus', `If you extend the trail back to ${p.X} = 0, it would be BELOW zero, so the rule subtracts ${fmt(r.b)}.`);
  const fits = p.rows.filter((row) => near(run(g, row.x), row.y)).length;
  if (fits > 0) return res('some_points', `${got} goes through ${fits} of the points, but not all of them. Your dashed trail shows where it goes off.`);
  return res('no_points', `${got} misses the points. Read two points from the map and see how much ${p.Y} grows for each 1 of ${p.X}.`);
}
export function checkOdd(p, which) {
  const name = { rule: 'the RULE', table: 'the LOGBOOK', map: 'the MAP' };
  const r = p.rule;
  const why = p.odd === 'table' ? `the logbook row ${pair(p.table.find((t, i) => !near(t.y, p.rows[i].y)).x, p.table.find((t, i) => !near(t.y, p.rows[i].y)).y)} doesn't fit ${ruleText(r, p.X, p.Y)}`
    : p.odd === 'rule' ? `${ruleText(p.plaqueRule, p.X, p.Y)} doesn't fit the logbook or the map (try ${p.X} = ${fmt(p.rows[1].x)})`
      : `the map's trail doesn't go through the logbook's points (try ${p.X} = ${fmt(p.rows[1].x)})`;
  if (which === p.odd) return { correct: true, key: 'correct', message: `Found it: ${why}. The other two agree.` };
  return { correct: false, key: 'check_all_three', message: `${name[which]} agrees with one of the others. Test the same input in all three: ${why}.` };
}
export function checkOffPoint(p, i) {
  const q = p.pts[p.bad], real = p.rows[p.bad];
  if (i === p.bad) return { correct: true, key: 'correct', message: `Yes! ${pair(q.x, q.y)} is off the trail: ${plugIn(p.rule, p.X, p.Y, real.x)}, not ${fmt(q.y)}.` };
  const w = p.pts[i];
  return { correct: false, key: 'check_each_point', message: `${pair(w.x, w.y)} is on the trail: ${plugIn(p.rule, p.X, p.Y, w.x)}. Put each point's input into the rule.` };
}
const MARY_MSG = {
  mary_multiply: (p) => `That's Mary's equation. Test it: ${fmt(p.P)} ${p.xName} should give ${fmt(p.q)} ${p.yName}, but ${fmt(p.P)} × ${fmt(p.P)} × ${fmt(p.q)} is far too many.`,
  ratio_backwards: (p) => `Backwards: there are FEWER ${p.yName} than ${p.xName}. ${fmt(p.P)} ${p.xName} → ${fmt(p.q)} ${p.yName}, so divide by ${fmt(p.k)}.`,
  ratio_difference: (p) => `That works for ${fmt(p.P)} → ${fmt(p.q)} only. Try ${fmt(2 * p.P)}: it should give ${fmt(2 * p.q)}.`,
};
export function checkMary(p, i) {
  const o = p.options[i];
  if (o.ok) return { correct: true, key: 'correct', message: `Right! ${o.text}: ${fmt(p.P)} → ${fmt(p.q)}, ${fmt(2 * p.P)} → ${fmt(2 * p.q)}, ${fmt(3 * p.P)} → ${fmt(3 * p.q)}.` };
  return { correct: false, key: o.key, message: MARY_MSG[o.key](p) };
}
export function checkGoal(p, raw) {
  const v = parseNumber(raw);
  if (v === null) return { correct: false, nudge: true, key: 'incomplete', message: 'Type a number.' };
  const rate = p.cents / 100;
  if (near(v, p.answer)) return { correct: true, key: 'correct', message: `Yes! ${fmt(p.answer)} × ${money(rate)} = ${money(p.answer * rate)}${Number.isInteger(p.exact) ? '' : `, and ${fmt(p.answer - 1)} would only make ${money((p.answer - 1) * rate)}`}.` };
  if (near(v, Math.floor(p.exact)) && !Number.isInteger(p.exact)) return { correct: false, key: 'rounded_down', message: `${fmt(v)} × ${money(rate)} = ${money(v * rate)}: not quite $${p.goal}! "At least" means round UP to ${fmt(v + 1)}.` };
  if (Math.abs(v - p.exact) < 0.01 && !Number.isInteger(v)) return { correct: false, key: 'not_whole', message: `You can't sell part of one. ${p.goal} ÷ ${fmt(rate)} ≈ ${fmt(p.exact)}, so they need a whole number: round up.` };
  if (near(v, p.goal * rate)) return { correct: false, key: 'multiplied', message: `That multiplied. Use the rule ${ruleText(p.rule, p.X, p.Y)} with ${p.Y} = ${p.goal}: divide ${p.goal} by ${fmt(rate)}.` };
  return { correct: false, key: 'use_the_rule', message: `Rule: ${ruleText(p.rule, p.X, p.Y)}. Set ${p.Y} = ${p.goal} and solve: ${p.goal} ÷ ${fmt(rate)}, then round up.` };
}

/* ================================================================== */
/* Worked solutions (after two misses)                                 */
/* ================================================================== */
export function workedSolution(p) {
  const r = p.rule, rt = ruleText(r, p.X, p.Y);
  if (p.type === 'plot') return [`Rule: ${rt}.`, ...p.rows.map((row) => `${plugIn(r, p.X, p.Y, row.x)} → plot ${pair(row.x, row.y)}`), `Across to ${p.X} first, then up to ${p.Y}.`];
  if (p.type === 'read') return [`The trail's rule is ${rt}.`, `${plugIn(r, p.X, p.Y, p.ask.x)}, so ${pair(p.ask.x, p.ask.y)} is on the trail.`, `Answer: ${p.backward ? p.X : p.Y} = ${fmt(p.answer)}.`];
  if (p.type === 'meaning') return [`In an ordered pair, input first, output second.`, `${pair(p.ask.x, p.ask.y)}: ${p.xName} = ${fmt(p.ask.x)}, ${p.yName} = ${fmt(p.ask.y)}.`];
  if (p.type === 'rule') {
    const [a, c] = p.rows;
    const lines = [`Read two points: ${pair(a.x, a.y)} and ${pair(c.x, c.y)}.`, `For each 1 across, ${p.Y} goes up ${fmt((c.y - a.y) / (c.x - a.x))}.`];
    lines.push(r.form === 'times' || r.form === 'plus' ? `Check ${pair(a.x, a.y)}: ${plugIn(r, p.X, p.Y, a.x)} ✓` : `At ${p.X} = 0 the trail would be at ${fmt(run(r, 0))}.`);
    lines.push(`Rule: ${rt}.`);
    return lines;
  }
  if (p.type === 'odd') return [`Test ${p.X} = ${fmt(p.rows[1].x)} in all three.`, `Rule ${ruleText(p.plaqueRule, p.X, p.Y)} gives ${fmt(run(p.plaqueRule, p.rows[1].x))}; logbook says ${fmt(p.table[1].y)}; map shows ${fmt(run(p.mapRule, p.rows[1].x))}.`, `The odd one out: the ${({ rule: 'rule', table: 'logbook', map: 'map' })[p.odd]}.`];
  if (p.type === 'offpoint') return p.pts.map((q, i) => `${pair(q.x, q.y)}: ${plugIn(r, p.X, p.Y, q.x)} ${i === p.bad ? '✗ off the trail' : '✓'}`);
  if (p.type === 'mary') return [`${fmt(p.P)} ${p.xName} go with ${fmt(p.q)} ${p.yName}: that's ${fmt(p.k)} times fewer.`, `So ${p.Y} = ${p.X} ÷ ${fmt(p.k)}.`, `Check: ${fmt(2 * p.P)} ÷ ${fmt(p.k)} = ${fmt(2 * p.q)} ✓`];
  return [`Rule: ${rt}. Set ${p.Y} = ${p.goal}.`, `${p.goal} = ${fmt(p.cents / 100)}${p.X}, so ${p.X} = ${p.goal} ÷ ${fmt(p.cents / 100)} ≈ ${fmt(p.exact)}.`, Number.isInteger(p.exact) ? `They need exactly ${fmt(p.answer)}.` : `Round UP: ${fmt(p.answer)} (${fmt(p.answer - 1)} makes only ${money((p.answer - 1) * p.cents / 100)}).`];
}
