// Log Flume (Grade 7, Lesson 4-3: Simplify Expressions): the math.
// No screen code here, so it can be tested with plain node (see test_log_flume_math.js).
//
// An expression is a list of terms: { c: coefficient (with its sign), v: variable letter, or '' for a plain number }.
// Simplifying = sorting the terms into channels (one per variable, one for plain numbers) and adding up each channel.
// Answer kinds:  sort (sort every log, then type each channel's total),  boxes,  select (tap ALL the twins),  test.

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
const nz = (rnd, lo, hi) => { let v = 0; while (v === 0) v = int(rnd, lo, hi); return v; };

export function fmt(v) {
  const x = r2(v);
  if (x < 0) return `−${fmt(-x)}`;
  return x.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
/** A typed number: "-3", "−3", "2.5", "5/6", "7 1/2". */
export function parseNumber(raw) {
  let t = String(raw ?? '').trim().replace(/,/g, '').replace(/^−/, '-').replace(/^\+/, '');
  const mixed = t.match(/^(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) { const d = Number(mixed[4]); if (!d) return null; const v = Number(mixed[2]) + Number(mixed[3]) / d; return mixed[1] ? -v : v; }
  const frac = t.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (frac) { const d = Number(frac[2]); return d ? Number(frac[1]) / d : null; }
  t = t.replace(/\s/g, '');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/* ---- writing expressions ---- */
/** One term: (3, 'x') -> "3x", (−1, 'x') -> "−x", (−15, '') -> "−15". */
export const termText = (c, v = '') => (v && near(Math.abs(c), 1) ? `${c < 0 ? '−' : ''}${v}` : `${fmt(c)}${v}`);
/** A log's label keeps its sign: "+3c", "−4c", "+7". */
export const logText = (t) => (t.c < 0 ? termText(t.c, t.v) : `+${termText(t.c, t.v)}`);
/** Terms joined with + and −: "−2c + 3c − 5". */
export const exprText = (terms) => terms.map((t, i) => (i === 0 ? termText(t.c, t.v) : `${t.c < 0 ? '−' : '+'} ${termText(Math.abs(t.c), t.v)}`)).join(' ');
/** The channels of an expression: its variables in order of first appearance, then '' (plain numbers) if there are any. */
export function channelsOf(terms) {
  const vars = [...new Set(terms.filter((t) => t.v).map((t) => t.v))];
  return terms.some((t) => !t.v) ? [...vars, ''] : vars;
}
export const totalOf = (terms, ch) => r2(terms.filter((t) => t.v === ch).reduce((s, t) => s + t.c, 0));
/** The simplified expression: each channel's total, variables first. */
export const simplified = (terms) => exprText(channelsOf(terms).map((ch) => ({ c: totalOf(terms, ch), v: ch })).filter((t) => !near(t.c, 0)));
export const channelName = (ch) => (ch ? `${ch}-terms` : 'plain numbers');

/* ================================================================== */
/* Sorting problems                                                    */
/* ================================================================== */
const LETTERS = [['c'], ['f'], ['n'], ['y'], ['a', 'b'], ['b', 'k'], ['h', 'd'], ['x', 'y'], ['n', 'p']];
const dec = (rnd) => pick(rnd, [0.5, 0.9, 1.5, 2.5, 2.8, 3.2, 4.5, 5.1, 6.45, 3.25]) * (rnd() < 0.5 ? -1 : 1);
/**
 * vars: 1 or 2 variables.  decimal: decimal coefficients.  lone: with 2 variables, the second has only ONE term
 * (like −9k in the book: it has no partner, so it stays as it is).
 */
export function genSort(rnd, { vars = 1, decimal = false, lone = false } = {}) {
  for (;;) {
    const letters = pick(rnd, LETTERS.filter((l) => l.length === vars));
    const co = () => (decimal && rnd() < 0.7 ? dec(rnd) : nz(rnd, -9, 9));
    const num = () => (decimal && rnd() < 0.4 ? r2(nz(rnd, -12, 12) + pick(rnd, [0.2, 0.5, 0.25])) : nz(rnd, -12, 12));
    let terms = [];
    letters.forEach((v, i) => { const count = vars === 1 ? 3 : (lone && i === 1 ? 1 : 2); for (let k = 0; k < count; k++) terms.push({ c: co(), v }); });
    terms.push({ c: num(), v: '' }, { c: num(), v: '' });
    terms = shuffle(rnd, terms);
    const chans = channelsOf(terms);
    if (chans.some((ch) => near(totalOf(terms, ch), 0))) continue;                 // no channel adds up to nothing
    if (!terms.some((t) => t.c < 0) || terms.every((t) => t.c < 0)) continue;       // a mix of + and − logs
    if (terms[0].v === '' && vars === 1 && rnd() < 0.6) continue;                   // usually starts with a variable term
    return { id: nextId++, kind: 'sort', type: 'sort', vars, decimal, lone, terms, channels: chans, show: exprText(terms), answerText: simplified(terms),
      prompt: `Simplify <b class="mono">${exprText(terms)}</b>. Sort every log into its channel, then add up each channel.` };
  }
}
/** One log into one channel. */
export function checkSortMove(p, i, ch) {
  const t = p.terms[i];
  if (t.v === ch) return { correct: true, key: 'correct' };
  const log = logText(t);
  if (!t.v) return { correct: false, key: 'number_in_variable', message: `${log} is a plain number: it has no ${ch}, so it is not a like term for the ${ch}-terms.` };
  if (!ch) return { correct: false, key: 'variable_in_numbers', message: `${log} has the variable ${t.v}, so it cannot be combined with plain numbers.` };
  return { correct: false, key: 'mixed_variables', message: `${log} is a ${t.v}-term. ${t.v} and ${ch} are different variables, so these are NOT like terms.` };
}
/** The total typed for each channel: raws = { channel: text }. */
export function checkTotals(p, raws) {
  const vals = {};
  for (const ch of p.channels) { vals[ch] = parseNumber(raws[ch]); if (vals[ch] === null) return { correct: false, nudge: true, key: 'incomplete', message: 'Type a total for every channel (a total can be negative).' }; }
  for (const ch of p.channels) {
    const mine = p.terms.filter((t) => t.v === ch), want = totalOf(p.terms, ch), g = vals[ch];
    if (near(g, want)) continue;
    const work = `${mine.map((t, i) => (i === 0 ? fmt(t.c) : `${t.c < 0 ? '−' : '+'} ${fmt(Math.abs(t.c))}`)).join(' ')} = ${fmt(want)}`;
    const abs = r2(mine.reduce((s, t) => s + Math.abs(t.c), 0));
    let key = 'calc', message = `Add up the ${channelName(ch)}: ${work}.`;
    if (near(g, -want)) { key = 'sign_error'; message = `Right size, wrong sign. ${work}. Think of a number line.`; }
    else if (near(g, abs) && mine.some((t) => t.c < 0)) { key = 'lost_negative'; message = `Some of those logs are NEGATIVE. The sign travels with its term: ${work}.`; }
    else if (mine.some((t) => Number.isInteger(t.c) && near(g, r2(want - t.c + t.c / 10)))) { key = 'decimal_slip'; message = `Line up the decimal points: a whole number like 3 is 3.0, not 0.3. ${work}.`; }
    else if (mine.length === 1) { key = 'lone_term'; message = `${logText(mine[0])} has no partner, so its channel just holds ${fmt(want)}.`; }
    return { correct: false, key, channel: ch, message };
  }
  return { correct: true, key: 'correct', message: `Simplified: ${p.answerText}.` };
}

/* ================================================================== */
/* Quick simplify: number boxes                                        */
/* ================================================================== */
const boxes = (extra) => ({ id: nextId++, kind: 'boxes', ...extra });
/** □v + □ (or □a + □b + □). A box can be negative, like the book's 15x + (−7.5). */
export function genQuick(rnd, { vars = 1, decimal = false } = {}) {
  const s = genSort(rnd, { vars, decimal });
  const pattern = [];
  s.channels.forEach((ch, i) => { if (i > 0) pattern.push('+'); pattern.push({ k: ch || 'k' }); if (ch) pattern.push(ch); });
  const want = Object.fromEntries(s.channels.map((ch) => [ch || 'k', totalOf(s.terms, ch)]));
  return boxes({ type: 'quick', form: 'quick', vars, decimal, terms: s.terms, channels: s.channels, show: s.show, pattern, want, answerText: s.answerText,
    prompt: `Simplify <b class="mono">${s.show}</b>. (A box can hold a negative number.)` });
}
/** Boss: fractions.  1/2 x − 3 + 1/3 x − 4.5  =  □x + □ */
export function genFraction(rnd) {
  const v = pick(rnd, ['x', 'z', 'n']);
  const [[n1, d1], [n2, d2]] = pick(rnd, [[[1, 2], [1, 3]], [[1, 2], [1, 4]], [[2, 3], [1, 6]], [[3, 4], [1, 8]], [[1, 3], [1, 6]]]);
  const a = -int(rnd, 2, 6), b = -pick(rnd, [1.5, 2.5, 4.5, 3]);
  const m = n1 / d1 + n2 / d2, k = a + b;
  const D = d1 * d2 / gcd(d1, d2), N = Math.round(m * D), g = gcd(N, D);
  return boxes({ type: 'fraction', form: 'fraction', v, show: `${n1}/${d1}${v} − ${fmt(-a)} + ${n2}/${d2}${v} − ${fmt(-b)}`, pattern: ['', { k: 'm' }, `${v} +`, { k: 'k' }], want: { m, k }, mText: `${N / g}/${D / g}`,
    n1, d1, n2, d2, a, b, answerText: `${N / g}/${D / g}${v} + (${fmt(k)})`,
    prompt: `Simplify <b class="mono">${n1}/${d1}${v} − ${fmt(-a)} + ${n2}/${d2}${v} − ${fmt(-b)}</b>. Type the ${v}-coefficient as a fraction, like 5/6.` });
}
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
/** Boss: the garden. A rectangle with sides (ax + b) and (cx + d): its perimeter is □x + □. */
export function genPerimeter(rnd) {
  const a = int(rnd, 2, 5), b = pick(rnd, [1.5, 2, 3, 4.5]), c = int(rnd, 1, 4), d = -pick(rnd, [0.5, 1, 1.5, 2]);
  const s1 = exprText([{ c: a, v: 'x' }, { c: b, v: '' }]), s2 = exprText([{ c: c, v: 'x' }, { c: d, v: '' }]);
  return boxes({ type: 'perimeter', form: 'perimeter', v: 'x', s1, s2, a, b, c, d, show: `2(${s1}) + 2(${s2})`, pattern: ['', { k: 'm' }, 'x +', { k: 'k' }], want: { m: 2 * (a + c), k: r2(2 * (b + d)) },
    answerText: exprText([{ c: 2 * (a + c), v: 'x' }, { c: r2(2 * (b + d)), v: '' }]),
    prompt: `A garden is a rectangle with sides <b class="mono">${s1}</b> and <b class="mono">${s2}</b>. Write its perimeter in simplest form.` });
}
export function checkBoxes(p, raws) {
  const keys = p.pattern.filter((x) => typeof x === 'object').map((x) => x.k);
  const g = {};
  for (const k of keys) { g[k] = parseNumber(raws[k]); if (g[k] === null) return { correct: false, nudge: true, key: 'incomplete', message: 'Fill in every box (negative numbers and fractions are allowed).' }; }
  const w = p.want;
  if (keys.every((k) => near(g[k], w[k]))) return { correct: true, key: 'correct', message: `Simplified: ${p.answerText}.` };
  if (p.form === 'fraction') {
    if (!near(g.m, w.m) && Math.abs(g.m - w.m) < 0.01) return { correct: false, key: 'use_a_fraction', message: `${fmt(g.m)} is rounded. Thirds and sixths do not end as decimals, so write the exact fraction: ${p.mText}.` };
    if (!near(g.m, w.m) && near(g.m, (p.n1 + p.n2) / (p.d1 + p.d2))) return { correct: false, key: 'fraction_addition', message: `Do not add the tops and the bottoms. Use a common denominator: ${p.n1}/${p.d1} + ${p.n2}/${p.d2} = ${p.mText}.` };
    if (!near(g.m, w.m)) return { correct: false, key: 'calc', message: `Add the ${p.v}-coefficients with a common denominator: ${p.n1}/${p.d1} + ${p.n2}/${p.d2} = ${p.mText}.` };
    if (near(g.k, -w.k)) return { correct: false, key: 'lost_negative', message: `Both numbers are subtracted: ${fmt(p.a)} + (${fmt(p.b)}) = ${fmt(w.k)}.` };
    return { correct: false, key: 'calc', message: `The plain numbers: ${fmt(p.a)} + (${fmt(p.b)}) = ${fmt(w.k)}.` };
  }
  if (p.form === 'perimeter') {
    if (near(g.m, p.a + p.c) && near(g.k, r2(p.b + p.d))) return { correct: false, key: 'half_perimeter', message: `That is one length plus one width. A rectangle has TWO of each: double it to ${p.answerText}.` };
    if (near(g.m, w.m) && near(g.k, r2(2 * (p.b - p.d)))) return { correct: false, key: 'lost_negative', message: `The second side has ${fmt(p.d)}: 2 × ${fmt(p.b)} + 2 × (${fmt(p.d)}) = ${fmt(w.k)}.` };
    return { correct: false, key: 'calc', message: `Perimeter = 2(${p.s1}) + 2(${p.s2}). x-terms: ${2 * p.a}x + ${2 * p.c}x. Numbers: ${fmt(2 * p.b)} + (${fmt(2 * p.d)}).` };
  }
  // quick simplify: reuse the channel checks
  const res = checkTotals(p, Object.fromEntries(p.channels.map((ch) => [ch, raws[ch || 'k']])));
  const all = r2(p.terms.reduce((s, t) => s + t.c, 0));
  if (!res.correct && p.channels.some((ch) => ch && near(g[ch], all))) return { correct: false, key: 'combine_unlike', message: `That adds every number together. Only like terms combine: ${p.channels.map(channelName).join(', ')} stay separate.` };
  return res;
}

/* ================================================================== */
/* Select all the twins                                                */
/* ================================================================== */
export function genSelect(rnd) {
  const s = genSort(rnd, { vars: 2, decimal: true });
  const [x, y] = s.channels, m = totalOf(s.terms, x), n = totalOf(s.terms, y), k = totalOf(s.terms, '');
  const E = (terms, key, message) => ({ text: exprText(terms), m: totalOf(terms, x), n: totalOf(terms, y), k: totalOf(terms, ''), key, message });
  const T = (c, v) => ({ c, v });
  const absSum = (ch) => r2(s.terms.filter((t) => t.v === ch).reduce((a, t) => a + Math.abs(t.c), 0));
  let cards = [
    E([T(m, x), T(n, y), T(k, '')]),
    E([T(k, ''), T(n, y), T(m, x)]),
    E([T(n, y), T(k, ''), T(m, x)]),
    E([T(-m, x), T(n, y), T(k, '')], 'sign_error', `The ${x}-terms add up to ${fmt(m)}${x}, not ${fmt(-m)}${x}.`),
    E([T(m, x), T(n, y), T(absSum(''), '')], 'lost_negative', `The plain numbers keep their signs: together they make ${fmt(k)}.`),
    E([T(r2(m + n), x), T(k, '')], 'combine_unlike', `${x}-terms and ${y}-terms are not like terms, so they cannot be combined.`),
  ];
  cards = cards.filter((c, i) => !cards.slice(0, i).some((u) => u.text === c.text)).map((c) => ({ ...c, ok: near(c.m, m) && near(c.n, n) && near(c.k, k) }));
  if (cards.filter((c) => c.ok).length < 2 || cards.every((c) => c.ok)) return genSelect(rnd);
  return { id: nextId++, kind: 'select', type: 'select', terms: s.terms, channels: s.channels, show: s.show, cards: shuffle(rnd, cards), answerText: s.answerText,
    prompt: `Tap EVERY expression that is equivalent to <b class="mono">${s.show}</b>.` };
}
export function checkSelect(p, picked) {
  const set = new Set(picked);
  if (!set.size) return { correct: false, nudge: true, key: 'incomplete', message: 'Tap at least one expression first.' };
  const wrong = p.cards.map((c, i) => ({ c, i })).filter(({ c, i }) => set.has(i) && !c.ok);
  const missed = p.cards.filter((c, i) => c.ok && !set.has(i)).length;
  if (!wrong.length && !missed) return { correct: true, key: 'correct', message: `Every twin found! They all simplify to ${p.answerText}.` };
  if (wrong.length) return { correct: false, key: wrong[0].c.key, wrong: wrong.map((w) => w.i), message: `${wrong[0].c.text} is not a twin. ${wrong[0].c.message}${missed ? ` (And ${missed} twin${missed > 1 ? 's are' : ' is'} still missing.)` : ''}` };
  return { correct: false, key: 'missed_twin', wrong: [], message: `All of those are twins, but ${missed} more ${missed > 1 ? 'are' : 'is'} hiding. The terms can come in any order.` };
}

/* ================================================================== */
/* Boss: is 11t − 4t the same as 4t − 11t? Test a value and decide.    */
/* ================================================================== */
export function genOrderTest(rnd, { eq = rnd() < 0.4 } = {}) {
  const v = pick(rnd, ['t', 'n', 'x']), a = int(rnd, 7, 12), b = int(rnd, 2, 5), x0 = pick(rnd, [2, 3]);
  const A = `${a}${v} − ${b}${v}`, B = eq ? `−${b}${v} + ${a}${v}` : `${b}${v} − ${a}${v}`;
  const va = (a - b) * x0, vb = eq ? va : (b - a) * x0;
  return { id: nextId++, kind: 'test', type: 'orderTest', v, A, B, eq, x0, va, vb, answerText: eq ? 'Equivalent' : 'Not equivalent',
    why: eq ? `The minus sign travelled WITH ${b}${v}, so only the order changed: both equal ${a - b}${v}.` : `Subtraction cannot be reordered: ${A} = ${a - b}${v}, but ${B} = ${fmt(b - a)}${v}.`,
    prompt: `Is <b class="mono">${A}</b> equivalent to <b class="mono">${B}</b>? Test <b class="mono">${v} = ${x0}</b> in both, then decide.` };
}
export function checkTest(p, rawA, rawB, saysEq) {
  const a = parseNumber(rawA), b = parseNumber(rawB);
  if (a === null || b === null) return { correct: false, nudge: true, key: 'incomplete', message: 'Type what each expression equals first.' };
  if (!near(a, p.va)) return { correct: false, key: 'evaluation_slip', message: `Check the first one: ${p.A} with ${p.v} = ${p.x0} is ${fmt(p.va)}.` };
  if (!near(b, p.vb)) return { correct: false, key: near(b, -p.vb) ? 'sign_error' : 'evaluation_slip', message: `Check the second one: ${p.B} with ${p.v} = ${p.x0} is ${fmt(p.vb)}.` };
  if (saysEq === p.eq) return { correct: true, key: 'correct', message: `${fmt(p.va)} and ${fmt(p.vb)}. ${p.why}` };
  return { correct: false, key: p.eq ? 'same_values' : 'commute_subtraction', message: `You found ${fmt(p.va)} and ${fmt(p.vb)}. ${p.why}` };
}

/* ================================================================== */
/* Zones, backups, worked solutions                                    */
/* ================================================================== */
export const ZONES = [
  { name: 'Sort the Logs', blurb: 'Like terms, one variable' },
  { name: 'Two Letters', blurb: 'Two variables and a loner' },
  { name: 'Decimal Logs', blurb: 'Decimal coefficients' },
  { name: 'Quick Simplify', blurb: 'No sorting: boxes and twins' },
  { name: 'The Log Jam', blurb: 'Boss: fractions, a garden, a proof' },
];
export function genZone(rnd, zone) {
  if (zone === 0) return [0, 1, 2, 3].map(() => genSort(rnd, { vars: 1 }));
  if (zone === 1) return [genSort(rnd, { vars: 2 }), genSort(rnd, { vars: 2 }), genSort(rnd, { vars: 2, lone: true }), genSort(rnd, { vars: 2 })];
  if (zone === 2) return [genSort(rnd, { vars: 1, decimal: true }), genSort(rnd, { vars: 1, decimal: true }), genSort(rnd, { vars: 2, decimal: true }), genQuick(rnd, { vars: 1, decimal: true })];
  if (zone === 3) return [genQuick(rnd, { vars: 1 }), genQuick(rnd, { vars: 2 }), genSelect(rnd), genQuick(rnd, { vars: 1, decimal: true }), genSelect(rnd)];
  return [genSort(rnd, { vars: 2, decimal: true }), genFraction(rnd), genPerimeter(rnd), genSelect(rnd), genOrderTest(rnd)];
}
export function genBackup(rnd, p) {
  if (p.type === 'sort') return genSort(rnd, { vars: p.vars, decimal: p.decimal, lone: p.lone });
  if (p.type === 'quick') return genQuick(rnd, { vars: p.vars, decimal: p.decimal });
  if (p.type === 'fraction') return genFraction(rnd);
  if (p.type === 'perimeter') return genPerimeter(rnd);
  if (p.type === 'select') return genSelect(rnd);
  return genOrderTest(rnd, { eq: p.eq });
}
export function workedSolution(p) {
  if (p.type === 'sort' || p.type === 'quick' || p.type === 'select') {
    return [...p.channels.map((ch) => { const mine = p.terms.filter((t) => t.v === ch); return `${channelName(ch)}: ${exprText(mine)}${mine.length > 1 ? ` = ${termText(totalOf(p.terms, ch), ch)}` : ' (no partner)'}`; }), `Simplified: ${p.answerText}`];
  }
  if (p.type === 'fraction') return [`${p.v}-terms: ${p.n1}/${p.d1} + ${p.n2}/${p.d2} = ${p.mText}`, `Plain numbers: ${fmt(p.a)} + (${fmt(p.b)}) = ${fmt(p.want.k)}`, `Simplified: ${p.answerText}`];
  if (p.type === 'perimeter') return [`Perimeter = 2(${p.s1}) + 2(${p.s2})`, `x-terms: ${2 * p.a}x + ${2 * p.c}x = ${p.want.m}x`, `Numbers: ${fmt(2 * p.b)} + (${fmt(2 * p.d)}) = ${fmt(p.want.k)}`, `= ${p.answerText}`];
  return [`${p.A} with ${p.v} = ${p.x0}: ${fmt(p.va)}`, `${p.B} with ${p.v} = ${p.x0}: ${fmt(p.vb)}`, p.why];
}
