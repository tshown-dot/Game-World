// Spray Deck (Grade 7, Lesson 4-4: Expand Expressions): the math.
// No screen code here, so it can be tested with plain node (see test_spray_deck_math.js).
//
// A deck is  a(inside) + tail:  `a` is the width (the factor outside), `inside` is a list of sections (terms
// { c, v }), and `tail` is an optional term that is NOT on the deck, like the − 6 in 7(7x − 3y) − 6.
// Expanding = the area of every section: a × each term. Some decks are then simplified (like terms combined).
// Answer kinds:  deck (type each section's area, then maybe simplify),  choice,  select (tap ALL the twins).

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
/** A typed number: "-21", "−21", "+7", "0.78", "1/2". */
export function parseNumber(raw) {
  let t = String(raw ?? '').trim().replace(/,/g, '').replace(/^−/, '-').replace(/^\+/, '');
  const frac = t.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (frac) { const d = Number(frac[2]); return d ? Number(frac[1]) / d : null; }
  t = t.replace(/\s/g, '');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
export const termText = (c, v = '') => (v && near(Math.abs(c), 1) ? `${c < 0 ? '−' : ''}${v}` : `${fmt(c)}${v}`);
export const exprText = (terms) => terms.map((t, i) => (i === 0 ? termText(t.c, t.v) : `${t.c < 0 ? '−' : '+'} ${termText(Math.abs(t.c), t.v)}`)).join(' ');
const T = (c, v = '') => ({ c: r2(c), v });
const total = (terms, v) => r2(terms.filter((t) => t.v === v).reduce((s, t) => s + t.c, 0));
/** Like terms combined; variables in order of first appearance, plain numbers last. */
export function simplify(terms) {
  const vars = [...new Set(terms.filter((t) => t.v).map((t) => t.v))];
  return [...vars, ''].map((v) => T(total(terms, v), v)).filter((t) => !near(t.c, 0));
}

/* ================================================================== */
/* Decks                                                               */
/* ================================================================== */
const VARS = ['x', 'y', 'n', 't', 'g'];
/** Builds a deck problem from its parts. needsSimplify: a second step that combines like terms. */
function deck({ a, aText = fmt(a), inside, tail = null, level, story = '', needsSimplify = false }) {
  const expanded = inside.map((t) => T(a * t.c, t.v));
  const all = tail ? [...expanded, tail] : expanded;
  const show = `${aText}(${exprText(inside)})${tail ? ` ${tail.c < 0 ? '−' : '+'} ${termText(Math.abs(tail.c), tail.v)}` : ''}`;
  const simple = simplify(all);
  return { id: nextId++, kind: 'deck', type: 'deck', level, a, aText, inside, tail, expanded, needsSimplify, simple, show, story,
    expandedText: exprText(all), answerText: exprText(needsSimplify ? simple : all),
    prompt: `${story}${story ? ' ' : ''}Expand <b class="mono">${show}</b>: find the area of each section${needsSimplify ? ', then simplify' : ''}.` };
}
export function genDeck(rnd, { level = 'int2' } = {}) {
  const v = pick(rnd, VARS);
  for (;;) {
    if (level === 'int2') {             // 4(x − 3), 8(6x − 4)
      const inside = shuffle(rnd, [T(pick(rnd, [1, 1, 2, 3, 6]), v), T(nz(rnd, -9, 9))]);
      return deck({ a: int(rnd, 2, 9), inside, level });
    }
    if (level === 'three') {            // 4(3 + 4x − 2): expand, then simplify
      const inside = shuffle(rnd, [T(nz(rnd, -9, 9)), T(nz(rnd, -6, 6), v), T(nz(rnd, -9, 9))]);
      const d = deck({ a: int(rnd, 2, 6), inside, level, needsSimplify: true });
      if (d.simple.length === 2) return d;
      continue;
    }
    if (level === 'neg') {              // −7(3y − 1)
      const inside = [T(nz(rnd, -5, 6), v), T(nz(rnd, -9, 9))];
      if (inside.every((t) => t.c > 0)) continue;                   // at least one minus inside: negative × negative
      return deck({ a: -int(rnd, 2, 9), inside: rnd() < 0.5 ? inside : inside.reverse(), level });
    }
    if (level === 'dec') {              // 3.6(t + 5), 0.4(−5 − 7y)
      const a = pick(rnd, [3.6, 0.4, 2.5, 1.5, 0.5, -2.5, -0.5, -1.5]);
      return deck({ a, inside: [T(nz(rnd, -8, 8), v), T(nz(rnd, -9, 9))], level });
    }
    if (level === 'dec3') {             // −2.5(−3 + 4n + 8)
      const a = pick(rnd, [-2.5, -0.5, -1.5, 0.4, 2.5]);
      const d = deck({ a, inside: [T(nz(rnd, -6, 6)), T(nz(rnd, -6, 6), v), T(nz(rnd, -8, 8))], level, needsSimplify: true });
      if (d.simple.length === 2) return d;
      continue;
    }
    if (level === 'tail') {             // 7(7x − 3y) − 6: the − 6 is NOT on the deck
      const a = pick(rnd, [3, 4, 5, 6, 7, -2, -3]);
      return deck({ a, inside: [T(int(rnd, 2, 7), 'x'), T(nz(rnd, -6, 6), 'y')], tail: T(nz(rnd, -9, 9)), level });
    }
    if (level === 'frac') {             // −1/2(6y − 4x)
      const [n, d] = pick(rnd, [[1, 2], [1, 4], [3, 4], [1, 3]]), neg = rnd() < 0.6;
      const k1 = d * int(rnd, 1, 4), k2 = d * nz(rnd, -4, 4);
      return deck({ a: (neg ? -1 : 1) * n / d, aText: `${neg ? '−' : ''}${n}/${d}`, inside: [T(k1, 'y'), T(k2, 'x')], level });
    }
    // 'bread': 6 loaves at 13% off:  6(b − 0.13b)  =  6b − 0.78b  =  5.22b
    const a = int(rnd, 3, 8), pct = pick(rnd, [0.13, 0.15, 0.2, 0.25, 0.3]);
    return deck({ a, inside: [T(1, 'b'), T(-pct, 'b')], level: 'bread', needsSimplify: true,
      story: `Bread is ${Math.round(pct * 100)}% off. You buy ${a} loaves, and b is the regular price of one loaf.` });
  }
}
/** The area typed for every section (and the tail, if there is one): raws = [text, ...] in order. */
export function checkExpand(p, raws) {
  const want = [...p.expanded, ...(p.tail ? [p.tail] : [])], src = [...p.inside, ...(p.tail ? [p.tail] : [])];
  const g = raws.map(parseNumber);
  if (g.length < want.length || g.some((v) => v === null)) return { correct: false, nudge: true, key: 'incomplete', message: 'Type an area in every section (areas here can be negative).' };
  const A = p.aText;
  for (let i = 0; i < want.length; i++) {
    if (near(g[i], want[i].c)) continue;
    const t = src[i], isTail = p.tail && i === want.length - 1;
    const work = `${A} × ${termText(t.c, t.v)} = ${termText(want[i].c, want[i].v)}`;
    if (isTail) {
      if (near(g[i], r2(p.a * t.c))) return { correct: false, key: 'expanded_tail', section: i, message: `${termText(t.c)} is OUTSIDE the parentheses, so it is not on the deck. Only the terms inside get multiplied by ${A}. It stays ${termText(t.c)}.` };
      return { correct: false, key: 'expanded_tail', section: i, message: `The term outside the parentheses does not change: it stays ${termText(t.c)}.` };
    }
    if (near(g[i], t.c)) return { correct: false, key: 'first_term_only', section: i, message: `That section was not multiplied. The width ${A} multiplies EVERY section: ${work}.` };
    if (near(g[i], -want[i].c)) {
      const both = p.a < 0 && t.c < 0;
      return { correct: false, key: p.a > 0 ? 'dropped_subtraction' : 'sign_error', section: i, message: p.a > 0 ? `Keep the sign of the term inside: ${work}.` : `Check the sign: ${work}. A negative times a ${both ? 'negative is POSITIVE' : 'positive is NEGATIVE'}.` };
    }
    if (near(g[i], want[i].c * 10) || near(g[i], want[i].c / 10)) return { correct: false, key: 'decimal_slip', section: i, message: `Check the decimal point: ${work}.` };
    if (near(g[i], r2(p.a + t.c))) return { correct: false, key: 'added_not_multiplied', section: i, message: `Area is width TIMES length, not plus: ${work}.` };
    return { correct: false, key: 'calc', section: i, message: `Section ${i + 1}: ${work}.` };
  }
  return { correct: true, key: 'correct', done: !p.needsSimplify, message: p.needsSimplify ? `Expanded: ${p.expandedText}. Now combine like terms.` : `Deck built: ${p.show} = ${p.answerText}.` };
}
/** The simplified form: raws = { variable or 'k': text } for each term of p.simple. */
export function checkSimplify(p, raws) {
  const g = {};
  for (const t of p.simple) { const k = t.v || 'k'; g[k] = parseNumber(raws[k]); if (g[k] === null) return { correct: false, nudge: true, key: 'incomplete', message: 'Fill in every box.' }; }
  if (p.simple.every((t) => near(g[t.v || 'k'], t.c))) return { correct: true, key: 'correct', done: true, message: `Simplified: ${p.show} = ${p.answerText}.` };
  const everything = r2(p.expanded.reduce((s, t) => s + t.c, 0));
  for (const t of p.simple) {
    const k = t.v || 'k', mine = p.expanded.filter((e) => e.v === t.v);
    if (near(g[k], t.c)) continue;
    const work = `${mine.map((e, i) => (i === 0 ? fmt(e.c) : `${e.c < 0 ? '−' : '+'} ${fmt(Math.abs(e.c))}`)).join(' ')} = ${fmt(t.c)}`;
    if (near(g[k], -t.c)) return { correct: false, key: 'sign_error', message: `Right size, wrong sign: ${work}.` };
    if (near(g[k], r2(mine.reduce((s, e) => s + Math.abs(e.c), 0)))) return { correct: false, key: 'lost_negative', message: `Keep each term's sign: ${work}.` };
    if (p.simple.length > 1 && near(g[k], everything)) return { correct: false, key: 'combine_unlike', message: `Only like terms combine. The ${t.v ? `${t.v}-terms` : 'plain numbers'}: ${work}.` };
    return { correct: false, key: 'calc', message: `Combine the ${t.v ? `${t.v}-terms` : 'plain numbers'}: ${work}.` };
  }
  return { correct: false, key: 'calc', message: `Combine like terms from ${p.expandedText}.` };
}

/* ================================================================== */
/* Choices                                                             */
/* ================================================================== */
const ok = (text) => ({ text, ok: true, key: 'correct' });
const no = (text, key, message) => ({ text, ok: false, key, message });
const choice = (rnd, extra, options) => ({ id: nextId++, kind: 'choice', ...extra, options: shuffle(rnd, options) });
/** A variable outside:  x(4 − 3.4y)  =  4x − 3.4xy */
export function genVarOut(rnd) {
  const [o, i] = pick(rnd, [['x', 'y'], ['y', 'x'], ['t', 'w']]);
  const d = nz(rnd, -6, 6), c = pick(rnd, [-3.4, -0.5, -1.2, -8, 3, 0.5, 2.5]);
  const show = `${o}(${exprText([T(d), T(c, i)])})`;
  const sign = c < 0 ? '−' : '+', C = fmt(Math.abs(c));
  return choice(rnd, { type: 'varOut', show, answerText: `${termText(d, o)} ${sign} ${C}${[o, i].sort().join('')}`,
    prompt: `Expand <b class="mono">${show}</b>.` }, [
    ok(`${termText(d, o)} ${sign} ${C}${[o, i].sort().join('')}`),
    no(`${termText(d, o)} ${sign} ${C}${i}`, 'first_term_only', `${o} multiplies BOTH terms. ${o} × ${termText(c, i)} = ${termText(c, [o, i].sort().join(''))}.`),
    no(`${fmt(d)} ${sign} ${C}${[o, i].sort().join('')}`, 'first_term_only', `${o} multiplies the ${fmt(d)} too: ${o} × ${fmt(d)} = ${termText(d, o)}.`),
    no(`${termText(d, o)} ${sign} ${C}${o} ${sign} ${i}`, 'product_as_sum', `${o} × ${C}${i} is a PRODUCT: write the letters side by side, ${C}${[o, i].sort().join('')}. It is not ${C}${o} and ${i} added.`),
  ]);
}
/** The gardener's error:  4(x + 7) is the whole garden. What is the area of just the extension? */
export function genGardener(rnd) {
  const a = int(rnd, 3, 8), b = int(rnd, 4, 9);
  return choice(rnd, { type: 'gardener', a, b, show: `${a}(x + ${b})`, answerText: `${a * b}`,
    prompt: `A garden is ${a} m wide and x m long. It is extended by ${b} m, so its area is <b class="mono">${a}(x + ${b})</b>. What is the area of JUST the extension?` }, [
    ok(`${a * b}`),
    no(`${a}x + ${a * b}`, 'whole_not_part', `${a}x + ${a * b} is the WHOLE garden. The extension is only the ${a} × ${b} section: ${a * b}.`),
    no(`${a}x`, 'whole_not_part', `${a}x is the ORIGINAL garden (${a} × x). The extension is the other section: ${a} × ${b} = ${a * b}.`),
    no(`${b}`, 'added_not_multiplied', `${b} is only the LENGTH of the extension. Its area is width × length: ${a} × ${b} = ${a * b}.`),
  ]);
}

/* ================================================================== */
/* Select every twin:  −2(4 − 2 + 8x)                                  */
/* ================================================================== */
export function genSelect(rnd) {
  const v = pick(rnd, VARS), a = pick(rnd, [-2, -3, -4, 2, 3, 5]), d1 = int(rnd, 2, 9), d2 = -int(rnd, 1, d1 - 1) || -1, c = int(rnd, 2, 8);
  const inside = [T(d1), T(d2), T(c, v)];
  const m = a * c, k = a * (d1 + d2);
  if (d1 + d2 === 0) return genSelect(rnd);
  const E = (terms, key, message) => ({ text: exprText(terms), m: total(terms, v), k: total(terms, ''), key, message });
  let cards = [
    E([T(m, v), T(k)]), E([T(k), T(m, v)]), E([T(a * d1), T(a * d2), T(m, v)]),
    E([T(a * d1 + d2), T(c, v)], 'first_term_only', `${fmt(a)} multiplies EVERY term inside, not just the first one.`),
    E([T(-m, v), T(k)], 'sign_error', `${fmt(a)} × ${c}${v} = ${fmt(m)}${v}. Check the sign.`),
    E([T(m, v), T(-k)], 'sign_error', `${fmt(a)} × (${d1} − ${-d2}) = ${fmt(a)} × ${d1 + d2} = ${fmt(k)}. Check the sign.`),
  ];
  cards = cards.filter((x, i) => !cards.slice(0, i).some((u) => u.text === x.text)).map((x) => ({ ...x, ok: near(x.m, m) && near(x.k, k) }));
  return { id: nextId++, kind: 'select', type: 'select', v, show: `${fmt(a)}(${exprText(inside)})`, cards: shuffle(rnd, cards), answerText: exprText([T(m, v), T(k)]),
    prompt: `Tap EVERY expression that is equivalent to <b class="mono">${fmt(a)}(${exprText(inside)})</b>.` };
}
export function checkSelect(p, picked) {
  const set = new Set(picked);
  if (!set.size) return { correct: false, nudge: true, key: 'incomplete', message: 'Tap at least one expression first.' };
  const wrong = p.cards.map((c, i) => ({ c, i })).filter(({ c, i }) => set.has(i) && !c.ok);
  const missed = p.cards.filter((c, i) => c.ok && !set.has(i)).length;
  if (!wrong.length && !missed) return { correct: true, key: 'correct', message: `Every twin found! They all equal ${p.answerText}.` };
  if (wrong.length) return { correct: false, key: wrong[0].c.key, wrong: wrong.map((w) => w.i), message: `${wrong[0].c.text} is not a twin. ${wrong[0].c.message}${missed ? ` (And ${missed} twin${missed > 1 ? 's are' : ' is'} still missing.)` : ''}` };
  return { correct: false, key: 'missed_twin', wrong: [], message: `All of those are twins, but ${missed} more ${missed > 1 ? 'are' : 'is'} hiding. An expanded form that is not simplified yet is still equivalent.` };
}
export function checkChoice(p, i) {
  const o = p.options[i];
  if (o.ok) return { correct: true, key: 'correct', message: p.type === 'gardener' ? `Right: the extension is the ${p.a} × ${p.b} section, ${p.a * p.b} square meters.` : `Right: ${p.show} = ${o.text}.` };
  return { correct: false, key: o.key, message: o.message };
}

/* ================================================================== */
/* Zones, backups, worked solutions                                    */
/* ================================================================== */
export const ZONES = [
  { name: 'Lay the Deck', blurb: 'Two sections, whole numbers' },
  { name: 'Three Sections', blurb: 'Expand, then simplify' },
  { name: 'Cold Decks', blurb: 'Negative and decimal widths' },
  { name: 'Letter Planks', blurb: 'A variable outside, a term left over' },
  { name: 'The Grand Deck', blurb: 'Boss: errors, sales and fractions' },
];
const many = (rnd, levels) => levels.map((level) => genDeck(rnd, { level }));
export function genZone(rnd, zone) {
  if (zone === 0) return many(rnd, ['int2', 'int2', 'int2', 'int2', 'int2']);
  if (zone === 1) return many(rnd, ['three', 'three', 'three', 'three']);
  if (zone === 2) return many(rnd, ['neg', 'neg', 'dec', 'dec', 'dec3']);
  if (zone === 3) return [genVarOut(rnd), genDeck(rnd, { level: 'tail' }), genVarOut(rnd), genDeck(rnd, { level: 'tail' }), genVarOut(rnd)];
  return [genGardener(rnd), genDeck(rnd, { level: 'bread' }), genDeck(rnd, { level: 'frac' }), genSelect(rnd), genDeck(rnd, { level: 'dec3' })];
}
export function genBackup(rnd, p) {
  if (p.type === 'deck') return genDeck(rnd, { level: p.level });
  if (p.type === 'varOut') return genVarOut(rnd);
  if (p.type === 'gardener') return genGardener(rnd);
  return genSelect(rnd);
}
export function workedSolution(p) {
  if (p.type === 'deck') {
    const lines = p.inside.map((t, i) => `${p.aText} × ${termText(t.c, t.v)} = ${termText(p.expanded[i].c, p.expanded[i].v)}`);
    if (p.tail) lines.push(`${termText(p.tail.c, p.tail.v)} is outside the parentheses: it stays the same.`);
    lines.push(`Expanded: ${p.expandedText}`);
    if (p.needsSimplify) lines.push(`Combine like terms: ${p.answerText}`);
    return lines;
  }
  if (p.type === 'varOut') return ['The letter outside multiplies each term inside.', 'Letter × letter: write them side by side (xy).', `= ${p.answerText}`];
  if (p.type === 'gardener') return [`${p.a}(x + ${p.b}) = ${p.a}x + ${p.a * p.b}`, `${p.a}x is the original garden; ${p.a * p.b} is the extension.`];
  return [`Expand: every term inside is multiplied.`, `Simplify: ${p.answerText}.`, 'Twins can be reordered or left un-simplified.'];
}
