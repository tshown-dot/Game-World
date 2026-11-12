// Force Field (Lesson 4-7: Solve Inequalities): the math.
// No screen code here, so it can be tested with plain node (see test_force_field_math.js).
//
// Pods fall toward a number line. A RULE says which values may land, for example { sym: '≤', n: 12 }.
// The student's GRAPH is the landing zone they shade: { edge, dir: 'left' | 'right', closed } (closed = the edge
// value itself may land). A pod lands exactly when its value is inside the graph, so a graph that matches the
// rule's solutions lets every solution land and blocks everything else.
// In the boss, a BAND is two rules at once: { a, aClosed, b, bClosed } lets a..b land.
// After the pods, it is the student's turn: an ORDER asks them to pick a number of their own ("land one that is not a
// whole number"). In the boss the rule is hidden and the student picks which numbers to test.

export const SYMS = ['<', '≤', '>', '≥'];
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
export const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
export const near = (a, b) => Math.abs(a - b) < EPS + 1e-7;
export const fmt = (v) => String(r2(v));

/* ================================================================== */
/* Rules and graphs                                                    */
/* ================================================================== */
export function isSolution(rule, v) {
  if (rule.band) return inBand(rule.band, v);
  if (near(v, rule.n)) return rule.sym === '≤' || rule.sym === '≥';
  return rule.sym === '<' || rule.sym === '≤' ? v < rule.n : v > rule.n;
}
/** Does a value fall inside the student's shaded landing zone? */
export function inGraph(g, v) {
  if (near(v, g.edge)) return Boolean(g.closed);
  return g.dir === 'right' ? v > g.edge : v < g.edge;
}
export function inBand(b, v) {
  if (near(v, b.a)) return Boolean(b.aClosed) && b.a <= b.b;
  if (near(v, b.b)) return Boolean(b.bClosed) && b.a <= b.b;
  return v > b.a && v < b.b;
}
/** The graph that matches a rule exactly. */
export const ruleGraph = (rule) => ({ edge: rule.n, dir: rule.sym === '>' || rule.sym === '≥' ? 'right' : 'left', closed: rule.sym === '≤' || rule.sym === '≥' });
export const sameGraph = (g, h) => near(g.edge, h.edge) && g.dir === h.dir && Boolean(g.closed) === Boolean(h.closed);
export const ruleText = (rule) => (rule.band ? `${fmt(rule.band.a)} ${rule.band.aClosed ? '≤' : '<'} ${rule.letter} ${rule.band.bClosed ? '≤' : '<'} ${fmt(rule.band.b)}` : `${rule.letter} ${rule.sym} ${fmt(rule.n)}`);
/** "12 ≤ 12 is true" */
export function explain(rule, v) {
  if (rule.band) return `${fmt(v)} is ${isSolution(rule, v) ? '' : 'NOT '}between ${fmt(rule.band.a)} and ${fmt(rule.band.b)}${near(v, rule.band.a) || near(v, rule.band.b) ? ' (check the edge)' : ''}`;
  return `${fmt(v)} ${rule.sym} ${fmt(rule.n)} is ${isSolution(rule, v) ? 'TRUE' : 'FALSE'}`;
}

/* ---- making rules ---- */
const LETTERS = ['x', 'n', 't', 'p', 'w', 'h'];
const WORDS = [
  ['≥', 'at least'], ['≤', 'at most'], ['≤', 'no more than'], ['≥', 'no less than'],
  ['<', 'less than'], ['<', 'fewer than'], ['>', 'more than'], ['>', 'greater than'],
];
const STORIES = [
  { sym: '≤', n: [20, 25, 30], sign: (n) => `GIFT CARD $${n}: LAND IF THE PRICE IS AT MOST $${n}`, letter: 'p' },
  { sym: '≥', n: [42, 48, 54], sign: (n) => `RIDE: YOU MUST BE AT LEAST ${n} INCHES TALL`, letter: 'h' },
  { sym: '≤', n: [8, 12, 15], sign: (n) => `ELEVATOR: NO MORE THAN ${n} PEOPLE`, letter: 'n' },
  { sym: '<', n: [13, 16, 18], sign: (n) => `KIDS' TRAIL: ONLY HIKERS UNDER ${n} YEARS OLD`, letter: 't' },
  { sym: '>', n: [32, 40, 50], sign: (n) => `FREEZER ALARM: SOUNDS WHEN IT IS WARMER THAN ${n}°F`, letter: 't' },
];
/** The stretch of number line shown for a boundary: 20 wide in steps of 1, or 10 wide in steps of 0.1. */
function rangeFor(n, decimal) {
  if (decimal) { const lo = Math.max(0, Math.floor(n) - 5); return { lo, hi: lo + 10, step: 0.1 }; }
  const lo = Math.max(0, Math.round(n) - 10);
  return { lo, hi: lo + 20, step: 1 };
}
/**
 * kinds:  plain (x ≤ 12)   decimal (x > 7.5)   words ("at least 4")   story (gift card)
 *         solve (x + 3 > 8: work out the boundary first)
 */
export function genRule(rnd, { kind = 'plain' } = {}) {
  const letter = pick(rnd, LETTERS);
  if (kind === 'story') {
    const s = pick(rnd, STORIES), n = pick(rnd, s.n);
    return { kind, letter: s.letter, sym: s.sym, n, sign: s.sign(n), range: rangeFor(n, false) };
  }
  if (kind === 'solve') {
    const sym = pick(rnd, SYMS), form = pick(rnd, ['plus', 'minus', 'times']);
    if (form === 'plus') { const a = int(rnd, 2, 9), n = int(rnd, 3, 14); return { kind, letter, sym, n, form, a, b: n + a, sign: `${letter} + ${a} ${sym} ${n + a}`, steps: `Subtract ${a} from both sides: ${letter} ${sym} ${n}`, range: rangeFor(n, false) }; }
    if (form === 'minus') { const a = int(rnd, 2, 9), n = int(rnd, 6, 16); return { kind, letter, sym, n, form, a, b: n - a, sign: `${letter} − ${a} ${sym} ${n - a}`, steps: `Add ${a} to both sides: ${letter} ${sym} ${n}`, range: rangeFor(n, false) }; }
    const a = int(rnd, 2, 6), n = int(rnd, 3, 12);
    return { kind, letter, sym, n, form, a, b: n * a, sign: `${a}${letter} ${sym} ${n * a}`, steps: `Divide both sides by ${a}: ${letter} ${sym} ${n}`, range: rangeFor(n, false) };
  }
  const sym = pick(rnd, SYMS);
  if (kind === 'decimal') { const n = r2(int(rnd, 2, 14) + pick(rnd, [0.5, 0.2, 0.4, 0.6, 0.8, 0.5])); return { kind, letter, sym, n, sign: `${letter} ${sym} ${fmt(n)}`, range: rangeFor(n, true) }; }
  if (kind === 'words') {
    const [s, phrase] = pick(rnd, WORDS), decimal = rnd() < 0.4, n = decimal ? r2(int(rnd, 3, 12) + 0.5) : int(rnd, 4, 16);
    return { kind, letter, sym: s, n, sign: `${phrase.toUpperCase()} ${fmt(n)}`, range: rangeFor(n, decimal) };
  }
  const n = int(rnd, 4, 16);
  return { kind, letter, sym, n, sign: `${letter} ${sym} ${n}`, range: rangeFor(n, false) };
}
/** Two rules at once: only the overlap may land. */
export function genBandRule(rnd) {
  const letter = pick(rnd, ['t', 'x', 'n']), a = int(rnd, 3, 8), b = a + int(rnd, 4, 9), aClosed = rnd() < 0.5, bClosed = rnd() < 0.5;
  return { kind: 'band', letter, band: { a, aClosed, b, bClosed }, sign: `${letter} ${aClosed ? '≥' : '>'} ${a}  AND  ${letter} ${bClosed ? '≤' : '<'} ${b}`, range: { lo: 0, hi: 20, step: 1 } };
}

/* ================================================================== */
/* Pods                                                                */
/* ================================================================== */
/**
 * Values for one wave: the boundary itself, values right beside it, and a spread of others. A mix of both kinds.
 * grid: only values on the tick marks (hidden-rule waves, where the clues are on the tick marks too).
 */
export function genPods(rnd, rule, count, grid = false) {
  const { lo, hi, step } = rule.range;
  const edges = rule.band ? [rule.band.a, rule.band.b] : [rule.n];
  const inRange = (v) => v >= lo && v <= hi;
  const out = [];
  const add = (v) => { v = r2(v); if (inRange(v) && !out.some((x) => near(x, v))) out.push(v); };
  edges.forEach((e) => add(e));                                             // the boundary: open or closed?
  const tiny = grid ? step : step === 1 ? pick(rnd, [0.01, 0.1, 0.5]) : 0.01;
  add(pick(rnd, edges) + tiny * pick(rnd, [-1, 1]));                         // just beside it: 11.99 or 12.01
  add(pick(rnd, edges) + step * pick(rnd, [-1, 1]) * (step === 1 ? 1 : int(rnd, 1, 3)));
  for (let guard = 0; out.length < count && guard < 200; guard++) add(lo + Math.round(rnd() * ((hi - lo) / step)) * step + (rnd() < 0.25 && step === 1 && !grid ? 0.5 : 0));
  let pods = shuffle(rnd, out.slice(0, Math.max(count, edges.length)));
  // make sure both kinds are present
  const sol = pods.filter((v) => isSolution(rule, v)).length;
  if (sol === 0 || sol === pods.length) {
    const want = sol === 0;
    for (let guard = 0; guard < 200; guard++) { const v = r2(lo + Math.round(rnd() * ((hi - lo) / step)) * step); if (isSolution(rule, v) === want && !pods.some((x) => near(x, v))) { pods[pods.length - 1] = v; break; } }
  }
  return pods;
}
/** Hidden-rule waves: values the city handles by itself first, chosen so the rule can be worked out. */
export function genClues(rnd, rule) {
  const { lo, hi, step } = rule.range, n = rule.n;
  const far = (side) => r2(Math.min(hi, Math.max(lo, n + side * step * int(rnd, 3, 6))));
  return shuffle(rnd, [...new Set([far(-1), far(1), r2(n - step), r2(n + step), n, far(-1), far(1)].filter((v) => v >= lo && v <= hi))]);
}

/* ================================================================== */
/* Naming a mistake                                                    */
/* ================================================================== */
/**
 * The student's graph treated value v differently from the rule. Why?
 *   landed: what the student's graph did with it.   Returns { key, message }.
 */
export function classify(rule, graph, v, landed) {
  const should = isSolution(rule, v), val = fmt(v), verdict = `${val} should ${should ? 'LAND' : 'be BLOCKED'}: ${explain(rule, v)}.`;
  if (rule.band) {
    const b = rule.band, onEdge = near(v, b.a) || near(v, b.b);
    if (onEdge) { const closed = near(v, b.a) ? b.aClosed : b.bClosed; return { key: closed ? 'edge_included' : 'edge_excluded', message: `${verdict} That edge ${closed ? 'IS' : 'is NOT'} a solution: use ${closed ? 'a CLOSED' : 'an OPEN'} circle there.` }; }
    return { key: 'band_range', message: `${verdict} Only values that fit BOTH rules land: from ${fmt(b.a)} to ${fmt(b.b)}.` };
  }
  const want = ruleGraph(rule);
  if (graph.dir !== want.dir) return { key: 'direction', message: `${verdict} ${rule.sym} means ${want.dir === 'right' ? 'BIGGER' : 'SMALLER'} values: shade to the ${want.dir.toUpperCase()}.` };
  if (!near(graph.edge, rule.n)) {
    const how = rule.kind === 'solve' ? ` Solve first. ${rule.steps}.` : '';
    return { key: rule.kind === 'solve' ? 'solve_first' : 'boundary', message: `${verdict} The boundary is ${fmt(rule.n)}, not ${fmt(graph.edge)}.${how}` };
  }
  if (near(v, rule.n)) return { key: want.closed ? 'edge_included' : 'edge_excluded', message: `${verdict} So the edge itself ${want.closed ? 'IS' : 'is NOT'} a solution: use ${want.closed ? 'a CLOSED' : 'an OPEN'} circle.` };
  return { key: 'check_value', message: verdict };
}
/** Shield offline: the student zaps pods by hand. zapped = they shot it; otherwise it reached the line. */
export function classifyZap(rule, v, zapped) {
  const should = isSolution(rule, v);
  if (zapped && should) return { key: 'zapped_solution', message: `${fmt(v)} was a solution: ${explain(rule, v)}. Let solutions land.` };
  if (!zapped && !should) return { key: 'missed_nonsolution', message: `${fmt(v)} is NOT a solution: ${explain(rule, v)}. Zap it before it lands.` };
  return null;
}

/* ================================================================== */
/* Your turn: the student picks a number                               */
/* ================================================================== */
const isWhole = (v) => near(v, Math.round(v));
const goesUp = (rule) => rule.sym === '>' || rule.sym === '≥';
/** The smallest whole number that is a solution (for > and ≥), or the largest (for < and ≤). */
export function wholeEdge(rule) {
  const up = goesUp(rule);
  let w = up ? Math.ceil(rule.n - 1e-7) : Math.floor(rule.n + 1e-7);
  if (!isSolution(rule, w)) w += up ? 1 : -1;
  return w;
}
/** The student can drop a pod on these spots: halves on a whole-number line, tenths on a decimal line. */
export const pickStep = (rule) => (rule.range.step === 1 ? 0.5 : 0.1);
const bandParts = (rule) => [`${rule.letter} ${rule.band.aClosed ? '≥' : '>'} ${fmt(rule.band.a)}`, `${rule.letter} ${rule.band.bClosed ? '≤' : '<'} ${fmt(rule.band.b)}`];
/**
 * An order: { type, text, example }. example is one number that fills it.
 *   land (any solution)   block (any non-solution)   nonwhole (a solution that is not a whole number)
 *   whole_edge (the smallest or largest whole-number solution)
 *   both / first_only / second_only (two rules at once)
 */
export function makeOrder(rule, type) {
  if (rule.band) {
    const b = rule.band, [first, second] = bandParts(rule);
    if (type === 'first_only') return { type, text: `SEND ONE THAT FITS ${first} BUT NOT ${second}`, example: b.b + 1 };
    if (type === 'second_only') return { type, text: `SEND ONE THAT FITS ${second} BUT NOT ${first}`, example: b.a - 1 };
    return { type: 'both', text: 'LAND ONE THAT FITS BOTH RULES', example: Math.floor((b.a + b.b) / 2) };
  }
  const up = goesUp(rule), edge = wholeEdge(rule);
  if (type === 'block') return { type, text: 'SEND ONE THAT GETS BLOCKED', example: edge + (up ? -2 : 2) };
  if (type === 'nonwhole') return { type, text: 'LAND ONE THAT IS NOT A WHOLE NUMBER', example: r2(edge + (up ? 0.5 : -0.5)) };
  if (type === 'whole_edge') return { type, text: `LAND THE ${up ? 'SMALLEST' : 'LARGEST'} WHOLE NUMBER THAT WORKS`, example: edge };
  return { type: 'land', text: 'LAND A POD OF YOUR OWN', example: edge + (up ? 1 : -1) };
}
/** Did the student's number fill the order? Returns { ok, key, message }. */
export function checkOrder(rule, order, v) {
  const sol = isSolution(rule, v), val = fmt(v), why = `${explain(rule, v)}.`;
  const no = (key, message) => ({ ok: false, key, message });
  if (rule.band) {
    const b = rule.band, [first, second] = bandParts(rule);
    const fitsA = near(v, b.a) ? b.aClosed : v > b.a, fitsB = near(v, b.b) ? b.bClosed : v < b.b;
    const tell = `${val}: ${first} is ${fitsA ? 'TRUE' : 'FALSE'}, ${second} is ${fitsB ? 'TRUE' : 'FALSE'}.`;
    if (order.type === 'both') return fitsA && fitsB ? { ok: true } : no('band_range', `${tell} Both must be true.`);
    const want = order.type === 'first_only' ? fitsA && !fitsB : fitsB && !fitsA;
    return want ? { ok: true } : no('band_range', `${tell} You need ${order.type === 'first_only' ? 'the first TRUE and the second FALSE' : 'the second TRUE and the first FALSE'}.`);
  }
  if (order.type === 'block') return sol ? no('pick_nonsolution', `${val} lands: ${why} Pick a number that makes the rule FALSE.`) : { ok: true };
  if (!sol) return no('pick_solution', `${val} is blocked: ${why}${near(v, rule.n) ? ' The edge itself is not a solution here.' : ''}`);
  if (order.type === 'nonwhole' && isWhole(v)) return no('pick_nonwhole', `${val} lands, but it is a whole number. The numbers in between are solutions too.`);
  if (order.type === 'whole_edge') {
    const edge = wholeEdge(rule);
    if (!isWhole(v)) return no('pick_whole', `${val} lands, but it is not a whole number.`);
    if (!near(v, edge)) return no('whole_edge', `${val} lands, but ${edge} is ${goesUp(rule) ? 'smaller' : 'larger'} and lands too: ${explain(rule, edge)}.`);
  }
  return { ok: true };
}

/* ================================================================== */
/* Zones and waves                                                     */
/* ================================================================== */
export const ZONES = [
  { name: 'Raise the Shield', blurb: 'Shade where pods may land' },
  { name: 'Edge Cases', blurb: 'Decimals, words and the edge itself' },
  { name: 'Shifting Rules', blurb: 'New rules, fast. Some need solving' },
  { name: 'Shield Offline', blurb: 'Zap what is NOT a solution' },
  { name: 'The Storm Front', blurb: 'Boss: find a hidden rule, then two at once' },
];
/**
 * A wave: { mode, rule, pods, prep, orders, probes? }.
 *   mode    graph (shade the zone)   zap (no shield)   hidden (find the rule by testing numbers)   band (two edges)
 *   prep    seconds to set the graph before the first pod falls
 *   orders  the student's turn after the pods: numbers of their own to pick
 *   probes  hidden waves: how many numbers the student may test before shading
 */
export function genWaves(rnd, zone) {
  const wave = (mode, rule, count, prep, types = [], probes = 0) => ({
    mode, rule, pods: genPods(rnd, rule, count, mode === 'hidden'), prep, orders: types.map((type) => makeOrder(rule, type)), ...(probes ? { probes } : {}),
  });
  if (zone === 0) return [0, 1, 2].map(() => wave('graph', genRule(rnd, { kind: 'plain' }), 5, 9, ['land', 'block']));
  if (zone === 1) return shuffle(rnd, ['decimal', 'words', 'story']).map((kind) => wave('graph', genRule(rnd, { kind }), 5, 9, kind === 'story' ? ['block', 'whole_edge'] : ['nonwhole', 'whole_edge']));
  if (zone === 2) return ['plain', 'solve', 'words', 'solve', 'solve'].map((kind, i) => wave('graph', genRule(rnd, { kind }), 5, 6, [['nonwhole', 'whole_edge', 'block', 'whole_edge', 'nonwhole'][i]]));
  if (zone === 3) return [wave('zap', genRule(rnd, { kind: 'plain' }), 7, 3, ['land', 'whole_edge']), wave('zap', genRule(rnd, { kind: pick(rnd, ['decimal', 'solve']) }), 7, 3, ['nonwhole', 'block'])];
  return [
    wave('hidden', genRule(rnd, { kind: 'plain' }), 5, 5, [], 6), wave('hidden', genRule(rnd, { kind: 'plain' }), 5, 5, [], 5),
    wave('band', genBandRule(rnd), 6, 9, ['both', 'first_only']), wave('band', genBandRule(rnd), 6, 7, ['both', 'second_only']),
  ];
}
