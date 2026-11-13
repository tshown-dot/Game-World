// Trail Mapper (Lesson 4-10: Relate Tables, Graphs, and Equations): the math.
// No screen code here, so it can be tested with plain node (see test_trail_mapper_math.js).
//
// Every trail is one relationship shown three ways: a RULE (equation), a LOGBOOK (table) and a MAP (graph).
// A rule is { form, m, b }:   times y = m·x    plus y = x + b    line y = m·x + b    minus y = m·x − b
// The map is the first quadrant with 10 squares each way; each axis counts by its own step (1, 2, 5, 10 ...).
// Round types (the student sets something on the map, then a scout walks the true trail and shows what matches):
//   stake   put a stake on the map for each row of the logbook (fix: one stake is already wrong; hidden: no rule, two stakes given)
//   drop    read the map: slide a pointer along an axis to the value that goes with a given one (forward or backward)
//   rule    the map shows a trail: set the rule on two dials, and a second scout walks that rule over the map

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

/* ================================================================== */
/* Stake: a stake on the map for every row of the logbook             */
/* ================================================================== */
/**
 * n: rows to stake. zero: the first row is x = 0 (where the trail starts).
 * hidden: the rule is not shown and the first two rows are already staked (the student finds the pattern).
 */
export function genStake(rnd, kind = pick(rnd, ['times', 'plus']), { n = 3, zero = false, hidden = false } = {}) {
  for (let tries = 0; tries < 200; tries++) {
    const t = trail(rnd, kind, { n: hidden ? n + 2 : n });
    let rows = t.rows, { grid } = t;
    if (zero) { rows = [{ x: 0, y: run(t.rule, 0) }, ...rows.slice(1)]; grid = fitGrid([...rows, { x: 10, y: 0 }]); if (!grid || rows[0].y < 0) continue; }
    const fixed = hidden ? rows.slice(0, 2) : [];
    if (hidden && fixed[1].x - fixed[0].x > 3) continue;            // two stakes close enough to see the pattern
    return base({ ...t, rows, grid }, { type: 'stake', hidden, fixed, want: rows.slice(fixed.length), preset: [] });
  }
  throw new Error(`no stake round for ${kind}`);
}
const same = (p, q) => near(p.x, q.x) && near(p.y, q.y);
const onMap = (grid, p) => p.x >= 0 && p.y >= 0 && p.x <= grid.xMax && p.y <= grid.yMax && near(p.x / grid.xStep, Math.round(p.x / grid.xStep)) && near(p.y / grid.yStep, Math.round(p.y / grid.yStep));
/** What the rule would be if times and plus were mixed up: 3x read as x + 3, x + 4 read as 4x. */
const mixedUp = (rule, x) => (rule.form === 'times' ? x + rule.m : rule.form === 'plus' ? rule.b * x : null);
/** One stake is already on the map in the wrong place: find it and move it. */
export function genFix(rnd, kind = pick(rnd, ['times', 'plus'])) {
  for (let tries = 0; tries < 300; tries++) {
    const t = trail(rnd, kind, { n: 4 }), bad = int(rnd, 0, 3), r = t.rows[bad];
    const traps = shuffle(rnd, [
      { trap: 'swapped', pt: { x: r.y, y: r.x } },
      { trap: 'times_plus', pt: { x: r.x, y: mixedUp(t.rule, r.x) } },
      { trap: 'off', pt: { x: r.x, y: r.y + pick(rnd, [-1, 1]) * t.grid.yStep } },
    ]).filter((c) => c.pt.y !== null && onMap(t.grid, c.pt) && !t.rows.some((q) => same(q, c.pt)));
    if (!traps.length) continue;
    const preset = t.rows.map((q, i) => (i === bad ? traps[0].pt : { x: q.x, y: q.y }));
    return base(t, { type: 'stake', fix: true, hidden: false, fixed: [], want: t.rows, preset, bad, trap: traps[0].trap });
  }
  throw new Error(`no fix round for ${kind}`);
}
/**
 * The stakes the student has on the map (not counting the given ones). Returns
 * { ok, key, message, hits: [true/false for each wanted row], strays: [stakes that belong to no row] }.
 * The message says what went wrong without giving the answer away.
 */
export function checkStakes(p, pts) {
  const { rule, grid, X, Y } = p, hits = p.want.map((r) => pts.some((q) => same(q, r))), strays = pts.filter((q) => !p.want.some((r) => same(q, r)));
  if (hits.every(Boolean) && !strays.length) return { ok: true, key: 'correct', message: 'Every stake is on the trail.', hits, strays };
  if (pts.length < p.want.length && !strays.length) return { ok: false, nudge: true, key: 'incomplete', message: `Every row of the logbook needs a stake: ${p.want.length - pts.length} more.`, hits, strays };
  const r = p.want[hits.indexOf(false)] || p.want[0], no = (key, message) => ({ ok: false, key, message, hits, strays });
  if (strays.some((q) => q.x === r.y && q.y === r.x) && r.x !== r.y) return no('swapped', `The stake at ${pair(r.y, r.x)} is turned around. In ${pair(r.x, r.y)} the first number goes ACROSS (${X}) and the second goes UP (${Y}).`);
  const here = strays.find((q) => near(q.x, r.x));
  if (here) {
    if (grid.yStep !== 1 && near(here.y, r.y * grid.yStep)) return no('scale', `Read the numbers on the side of the map, do not count squares. Each square up is ${fmt(grid.yStep)}.`);
    if (!p.hidden && mixedUp(rule, r.x) !== null && near(here.y, mixedUp(rule, r.x))) return no('times_plus', rule.form === 'times' ? `${fmt(rule.m)}${X} means ${fmt(rule.m)} TIMES ${X}, not ${X} plus ${fmt(rule.m)}.` : `${X} + ${fmt(rule.b)} means ADD ${fmt(rule.b)}, not multiply by it.`);
    if (!p.hidden && (rule.form === 'line' || rule.form === 'minus') && near(here.y, rule.m * r.x)) return no('forgot_start', `That is only ${fmt(rule.m)} × ${fmt(r.x)}. The rule also ${rule.form === 'line' ? `adds ${fmt(rule.b)}` : `takes away ${fmt(rule.b)}`}.`);
    return no('off', p.hidden ? `The stake above ${X} = ${fmt(r.x)} is off the trail. Look at the two stakes you were given: what happens to ${Y} each time ${X} goes up by 1?`
      : `The stake above ${X} = ${fmt(r.x)} is off the trail. Put ${fmt(r.x)} into the rule again: ${ruleText(rule, `(${fmt(r.x)})`, Y)}.`);
  }
  if (grid.xStep !== 1 && strays.some((q) => near(q.x, r.x * grid.xStep))) return no('scale', `Read the numbers along the bottom of the map, do not count squares. Each square across is ${fmt(grid.xStep)}.`);
  return no('off', `There is no stake above ${X} = ${fmt(r.x)}. Each stake goes straight above its logbook ${X}.`);
}
export const stakeAnswer = (p) => `The trail goes through ${p.want.map((r) => pair(r.x, r.y)).join(', ')}.`;

/* ================================================================== */
/* Drop: read the map, forward or backward                             */
/* ================================================================== */
/** backward: the height is given and the student finds x. rocks: the drawn trail stops early, so it has to be extended. */
export function genDrop(rnd, kind = pick(rnd, ['times', 'plus']), { backward = false, rocks = false } = {}) {
  for (let tries = 0; tries < 300; tries++) {
    const t = trail(rnd, kind, { n: 3, extra: 1 }), ask = { x: t.others[0], y: run(t.rule, t.others[0]) };
    if (!onMap(t.grid, ask) || ask.x === ask.y) continue;
    const seen = rocks ? Math.min(...t.xs) + 2 : null;                // the trail can be seen as far as this x
    if (rocks && (ask.x <= seen || t.xs[1] > seen)) continue;
    return base(t, { type: 'drop', backward, rocks, seen, ask, given: backward ? ask.y : ask.x, answer: backward ? ask.x : ask.y });
  }
  throw new Error(`no drop round for ${kind}`);
}
/** x for a height on this trail (null when it is not on the map). */
const xFor = (rule, y) => { const { form, m = 1, b = 0 } = rule; return r2(form === 'times' ? y / m : form === 'plus' ? y - b : form === 'line' ? (y - b) / m : (y + b) / m); };
/** v: where the student put the pointer (on the y-axis going forward, on the x-axis going backward). */
export function checkDrop(p, v) {
  const { grid, X, Y, ask, backward } = p, want = p.answer, given = p.given;
  if (near(v, want)) return { ok: true, key: 'correct', message: backward ? `When ${Y} = ${fmt(ask.y)}, ${X} = ${fmt(ask.x)}: the point ${pair(ask.x, ask.y)}.` : `When ${X} = ${fmt(ask.x)}, ${Y} = ${fmt(ask.y)}: the point ${pair(ask.x, ask.y)}.` };
  const no = (key, message) => ({ ok: false, key, message });
  const other = backward ? run(p.rule, given) : xFor(p.rule, given);  // what you get by starting from the wrong axis
  if (near(v, given) || near(v, other)) return no('wrong_axis', backward ? `${fmt(given)} is a ${Y} value. Find ${fmt(given)} on the SIDE of the map, go ACROSS to the trail, then DOWN.` : `${fmt(given)} is an ${X} value. Find ${fmt(given)} along the BOTTOM of the map, go UP to the trail, then ACROSS.`);
  const step = backward ? grid.yStep : grid.xStep, counted = backward ? xFor(p.rule, given * step) : run(p.rule, given * step);
  if (step !== 1 && near(v, counted)) return no('scale', `Read the numbers on the map, do not count squares. Each square ${backward ? 'up' : 'across'} is ${fmt(step)}.`);
  return no('off', backward ? `Start at ${fmt(given)} on the side, go straight ACROSS to the trail, then straight DOWN.` : `Start at ${fmt(given)} along the bottom, go straight UP to the trail, then straight ACROSS.`);
}
export const dropAnswer = (p) => `The trail goes through ${pair(p.ask.x, p.ask.y)}.`;

/* ================================================================== */
/* Rule: write the rule for a trail on the map                         */
/* ================================================================== */
/** The dials: y = (times) x + (plus). A minus rule is a negative plus. */
export const DIALS = { m: [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], b: { lo: -10, hi: 10 } };
export function genRule(rnd, kind = pick(rnd, ['times', 'plus'])) {
  const t = trail(rnd, kind, { n: 3 });
  return base(t, { type: 'rule', kind });
}
/** The rule the dials show. */
export function ruleFromDials(m, b) {
  if (near(b, 0)) return { form: 'times', m, b: 0 };
  if (b < 0) return { form: 'minus', m, b: -b };
  return near(m, 1) ? { form: 'plus', m: 1, b } : { form: 'line', m, b };
}
/** A rule as dial settings. */
export const dialsOf = (rule) => ({ m: rule.form === 'plus' ? 1 : rule.m, b: rule.form === 'times' ? 0 : rule.form === 'minus' ? -rule.b : rule.b });
export function checkRule(p, m, b) {
  const want = dialsOf(p.rule), { X, Y } = p, mine = ruleFromDials(m, b);
  if (near(m, want.m) && near(b, want.b)) return { ok: true, key: 'correct', mine, message: `${ruleText(p.rule, X, Y)}: your trail and the map are the same trail.` };
  const no = (key, message) => ({ ok: false, key, mine, message });
  if ((p.rule.form === 'times' && near(m, 1) && near(b, want.m)) || (p.rule.form === 'plus' && near(b, 0) && near(m, want.b))) return no('times_plus', `Your trail splits from the map. Check a point: is ${Y} a number of TIMES ${X}, or ${X} PLUS a number?`);
  if (near(m, want.m)) return no('forgot_start', `Your trail climbs like the map's but sits ${b > want.b ? 'above' : 'below'} it. Where is the map's trail when ${X} = 0?`);
  if (near(b, want.b)) return no('steep', `Your trail starts in the right place but climbs too ${m > want.m ? 'fast' : 'slowly'}. How much does ${Y} go up when ${X} goes up by 1?`);
  return no('off', `Your trail splits from the map. Pick two points on the map: what happens to ${Y} when ${X} goes up by 1?`);
}
export const ruleAnswer = (p) => `The rule: ${ruleText(p.rule, p.X, p.Y)}.`;

/* ================================================================== */
/* Zones                                                               */
/* ================================================================== */
export const ZONES = [
  { name: 'Stake the Trail', blurb: 'Rule to map: a stake for every row of the logbook' },
  { name: 'Read the Map', blurb: 'Slide the pointer: forward, then backward' },
  { name: 'Map to Rule', blurb: 'Set the rule, then race the map\'s trail' },
  { name: 'Fix the Map', blurb: 'One stake is wrong. Find it and move it' },
  { name: 'Rockslide Pass', blurb: 'Boss: hidden rules, head starts and buried trails' },
];
/** The rounds of a zone, in order. */
export function genZone(rnd, zone) {
  if (zone === 0) return [genStake(rnd, 'times'), genStake(rnd, 'plus'), genStake(rnd, 'times', { zero: true }), genStake(rnd, pick(rnd, ['times', 'plus']), { n: 4 })];
  if (zone === 1) return [genDrop(rnd, 'times'), genDrop(rnd, 'plus'), genDrop(rnd), genDrop(rnd, 'times', { backward: true }), genDrop(rnd, 'plus', { backward: true }), genDrop(rnd, undefined, { backward: true })];
  if (zone === 2) return [genRule(rnd, 'times'), genRule(rnd, 'plus'), ...shuffle(rnd, [genRule(rnd, 'times'), genRule(rnd, 'plus')]), genRule(rnd, 'line')];
  if (zone === 3) return shuffle(rnd, ['times', 'plus', 'times', 'plus']).map((k) => genFix(rnd, k));
  return [genStake(rnd, 'line', { zero: true }), genStake(rnd, pick(rnd, ['times', 'plus']), { hidden: true }), genRule(rnd, pick(rnd, ['line', 'minus'])), genDrop(rnd, 'times', { backward: true, rocks: true }), genRule(rnd, 'puppy')];
}
