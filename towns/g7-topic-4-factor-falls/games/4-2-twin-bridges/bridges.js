// Twin Bridges (Grade 7, Lesson 4-2: Generate Equivalent Expressions): the math.
// No screen code here, so it can be tested with plain node (see test_twin_bridges_math.js).
//
// Every expression here is linear, so it is stored as its text plus what it equals:  m·x + k
// (and n·y for the few with a second variable). Two expressions are equivalent exactly when m, k and n all match.
// Answer kinds:  test (evaluate both, then decide),  choice,  boxes (fill number boxes),  select (tap ALL the twins),  num.

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

export function fmt(v) {
  const x = r2(v);
  if (x < 0) return `−${fmt(-x)}`;
  return x.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
/** A typed number: "-16", "−16", "2.5", "5/2", "2 1/2". */
export function parseNumber(raw) {
  let t = String(raw ?? '').trim().replace(/,/g, '').replace(/^−/, '-');
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
const term = (c, v = '') => (v && near(Math.abs(c), 1) ? `${c < 0 ? '−' : ''}${v}` : `${fmt(c)}${v}`);
/** Terms joined with + and −:  sum([3,'x'], [−15,'']) -> "3x − 15". */
export function sum(...parts) {
  return parts.map(([c, v], i) => (i === 0 ? term(c, v) : `${c < 0 ? '−' : '+'} ${term(Math.abs(c), v)}`)).join(' ');
}
/** a(x + b) written with its signs: paren(−2, 'x', 8) -> "−2(x + 8)". */
export const paren = (a, v, b) => `${near(a, 1) ? '' : near(a, -1) ? '−' : fmt(a)}(${sum([1, v], [b, ''])})`;
/** An expression: its text and what it equals (m·x + k + n·y). */
const ex = (text, m, k, n = 0) => ({ text, m: r2(m), k: r2(k), n: r2(n) });
export const same = (A, B) => near(A.m, B.m) && near(A.k, B.k) && near(A.n || 0, B.n || 0);
export const valueOf = (E, x, y = 0) => r2(E.m * x + E.k + (E.n || 0) * y);
const nz = (rnd, lo, hi) => { let v = 0; while (v === 0) v = int(rnd, lo, hi); return v; };
const VARS = ['x', 'n', 't', 'g', 'd', 'w'];

const ok = (text) => ({ text, ok: true, key: 'correct' });
const no = (text, key, message) => ({ text, ok: false, key, message });
const choice = (rnd, extra, options) => ({ id: nextId++, kind: 'choice', ...extra, options: shuffle(rnd, options) });

/* ================================================================== */
/* Zone 1: test the bridges (evaluate both, then decide)               */
/* ================================================================== */
/** A pair of expressions and whether they are twins. `why` explains it either way. */
function pair(rnd, wantEq) {
  const v = pick(rnd, VARS);
  const form = pick(rnd, ['dist', 'dist', 'combine', 'commute']);
  if (form === 'dist') {
    const a = pick(rnd, [2, 3, 4, 5, -2, -3]), b = nz(rnd, -6, 8);
    const A = ex(paren(a, v, b), a, a * b);
    if (wantEq) return { v, A, B: ex(sum([a, v], [a * b, '']), a, a * b), why: `Distributive Property: ${fmt(a)} multiplies BOTH ${v} and ${fmt(b)}.`, key: 'first_term_only' };
    return { v, A, B: ex(sum([a, v], [b, '']), a, b), why: `${fmt(a)} must multiply BOTH terms: ${fmt(a)} × ${fmt(b)} = ${fmt(a * b)}, not ${fmt(b)}.`, key: 'first_term_only' };
  }
  if (form === 'combine') {
    const a = int(rnd, 2, 6), b = int(rnd, 2, 9), c = int(rnd, 2, 6);
    const A = ex(sum([a, v], [b, ''], [c, v]), a + c, b);
    if (wantEq) return { v, A, B: ex(sum([a + c, v], [b, '']), a + c, b), why: `Like terms: ${a}${v} + ${c}${v} = ${a + c}${v}. The ${b} stays separate.`, key: 'combine_unlike' };
    return { v, A, B: ex(term(a + b + c, v), a + b + c, 0), why: `${b} is not an ${v}-term, so it cannot be combined with ${a}${v} and ${c}${v}.`, key: 'combine_unlike' };
  }
  const a = int(rnd, 2, 9), b = int(rnd, 2, 6);
  if (wantEq) return { v, A: ex(sum([a, ''], [b, v]), b, a), B: ex(sum([b, v], [a, '']), b, a), why: 'Commutative Property: you can add in either order.', key: 'commute_subtraction' };
  return { v, A: ex(sum([1, v], [-a, '']), 1, -a), B: ex(sum([a, ''], [-1, v]), -1, a), why: `Subtraction is NOT commutative: ${v} − ${a} and ${a} − ${v} are opposites.`, key: 'commute_subtraction' };
}
/** A test value where the two expressions differ (or any small value when they are twins). */
function testValue(rnd, A, B) {
  for (;;) { const x = pick(rnd, [-3, -2, 2, 3, 4, 5]); if (same(A, B) || !near(valueOf(A, x), valueOf(B, x))) return x; }
}
export function genTest(rnd, { eq = rnd() < 0.5 } = {}) {
  const q = pair(rnd, eq), x0 = testValue(rnd, q.A, q.B);
  return { id: nextId++, kind: 'test', type: 'test', v: q.v, A: q.A, B: q.B, eq, x0, why: q.why, slipKey: q.key, va: valueOf(q.A, x0), vb: valueOf(q.B, x0),
    answerText: eq ? 'Equivalent' : 'Not equivalent',
    prompt: `Send <b class="mono">${q.v} = ${fmt(x0)}</b> across both bridges. What does each expression equal? Then decide: are they equivalent?` };
}
/** One matching test value is not proof: a pair that agrees at one value only. */
export function genLucky(rnd) {
  const v = pick(rnd, VARS), a = int(rnd, 2, 5), b = int(rnd, 2, 7);
  const A = ex(paren(a, v, b), a, a * b), B = ex(sum([a * b, v], [a * b, '']), a * b, a * b);     // equal only at 0
  const other = pick(rnd, [1, 2, 3]);
  return choice(rnd, { type: 'lucky', v, A, B, x0: 0, va: a * b, vb: a * b, answerText: 'Not proven',
    prompt: `Sam sent <b class="mono">${v} = 0</b> across. Both bridges gave <b>${a * b}</b>, so Sam says the expressions are equivalent. Is Sam right?` }, [
    ok(`No. Try ${v} = ${other}: you get ${valueOf(A, other)} and ${valueOf(B, other)}`),
    no('Yes. The same value means they are equivalent', 'one_test_value', `One matching value is not proof. Try ${v} = ${other}: ${A.text} = ${valueOf(A, other)} but ${B.text} = ${valueOf(B, other)}.`),
    no(`Yes. Both have ${a * b} in them`, 'one_test_value', `Sharing a number does not make expressions equivalent. Try ${v} = ${other}: ${valueOf(A, other)} and ${valueOf(B, other)}.`),
    no(`No. You can never test with 0`, 'zero_is_fine', `0 is a fine test value. The problem is that ONE value is not enough: ${v} = ${other} gives ${valueOf(A, other)} and ${valueOf(B, other)}.`),
  ]);
}

/* ================================================================== */
/* Zone 2: name the property                                           */
/* ================================================================== */
const PROPS = {
  C: 'Commutative Property (change the order)',
  A: 'Associative Property (change the grouping)',
  D: 'Distributive Property (multiply each term)',
};
const PROP_TIP = {
  C: 'The ORDER of the terms changed and nothing else: that is the Commutative Property.',
  A: 'The terms stayed in order; only the GROUPING (parentheses) moved: that is the Associative Property.',
  D: 'The number outside multiplied EACH term inside the parentheses: that is the Distributive Property.',
};
export function genProperty(rnd, which = pick(rnd, ['C', 'A', 'D'])) {
  const v = pick(rnd, VARS);
  let from, to;
  if (which === 'C') {
    if (rnd() < 0.5) { const a = int(rnd, 8, 20), b = int(rnd, 8, 20); from = `${a} + y + ${b} + z`; to = `${a} + ${b} + y + z`; }
    else { const a = nz(rnd, -6, 6), b = int(rnd, 2, 9); from = sum([a, v], [b, '']); to = sum([b, ''], [a, v]); }
  } else if (which === 'A') {
    const a = int(rnd, 2, 9), b = int(rnd, 2, 9);
    if (rnd() < 0.5) { from = `(${v} + ${a}) + ${b}`; to = `${v} + (${a} + ${b})`; } else { from = `${a}${v} + (${b}${v} + y)`; to = `(${a}${v} + ${b}${v}) + y`; }
  } else {
    const a = pick(rnd, [-2, -3, -5, 2, 4, 6]), b = nz(rnd, -8, 8);
    from = paren(a, v, b); to = sum([a, v], [a * b, '']);
  }
  return choice(rnd, { type: 'property', which, from, to, answerText: PROPS[which],
    prompt: `Bridge 1 says <b class="mono">${from}</b>. Bridge 2 says <b class="mono">${to}</b>. Which property makes them equivalent?` },
  ['C', 'A', 'D'].map((p) => (p === which ? ok(PROPS[p]) : no(PROPS[p], 'wrong_property', PROP_TIP[which]))));
}

/* ================================================================== */
/* Zone 3: build the twin (number boxes)                               */
/* ================================================================== */
const boxes = (extra) => ({ id: nextId++, kind: 'boxes', ...extra });
export function genBuild(rnd, form = pick(rnd, ['distNeg', 'factor', 'combine', 'assoc'])) {
  const v = pick(rnd, VARS);
  if (form === 'distNeg') {            // −3(7 + 5g) = □ + □g
    const a = pick(rnd, [-2, -3, -4, -5]), b = int(rnd, 2, 9), c = pick(rnd, [-5, -3, -2, 2, 3, 5]);
    return boxes({ type: 'build', form, v, a, b, c, show: `${fmt(a)}(${sum([b, ''], [c, v])})`, pattern: ['', { k: 'k' }, '+', { k: 'm' }, v], want: { k: a * b, m: a * c }, answerText: sum([a * b, ''], [a * c, v]),
      prompt: `Build the twin with the Distributive Property: <b class="mono">${fmt(a)}(${sum([b, ''], [c, v])})</b> = ? (Boxes can hold negative numbers.)` });
  }
  if (form === 'factor') {             // 4d − 12 = □(d − □)
    const a = int(rnd, 2, 9), b = int(rnd, 1, 9);
    return boxes({ type: 'build', form, v, a, b, show: sum([a, v], [-a * b, '']), pattern: ['', { k: 'g' }, `(${v} −`, { k: 'b' }, ')'], want: { g: a, b }, answerText: `${a}(${v} − ${b})`,
      prompt: `Build the twin by factoring: <b class="mono">${sum([a, v], [-a * b, ''])}</b> = ?` });
  }
  if (form === 'combine') {            // −5x + 2y + 3x = □x + 2y
    const a = pick(rnd, [-7, -6, -5, -4]), c = int(rnd, 2, 3), y = int(rnd, 2, 6);
    return boxes({ type: 'build', form, v, a, c, y, show: `${sum([a, v], [y, 'y'], [c, v])}`, pattern: ['', { k: 'm' }, `${v} + ${y}y`], want: { m: a + c }, answerText: sum([a + c, v], [y, 'y']),
      prompt: `Build the twin by reordering and combining like terms: <b class="mono">${sum([a, v], [y, 'y'], [c, v])}</b> = ?` });
  }
  if (form === 'frac') {               // 4x + ½ + 2x − 3 = □x − □   (boss)
    const a = int(rnd, 2, 5), c = int(rnd, 2, 4), d = int(rnd, 2, 5), h = pick(rnd, [[1, 2], [1, 4], [3, 4]]);
    const k = d - h[0] / h[1];
    return boxes({ type: 'build', form, v, a, c, d, h, show: `${a}${v} + ${h[0]}/${h[1]} + ${c}${v} − ${d}`, pattern: ['', { k: 'm' }, `${v} −`, { k: 'c' }], want: { m: a + c, c: k }, answerText: `${a + c}${v} − ${fmt(k)}`,
      prompt: `Build the twin: <b class="mono">${a}${v} + ${h[0]}/${h[1]} + ${c}${v} − ${d}</b> = ? (A decimal or a fraction is fine.)` });
  }
  const a = int(rnd, 2, 9), b = int(rnd, 2, 9);     // (w + 9) + 3 = w + □
  return boxes({ type: 'build', form: 'assoc', v, a, b, show: `(${v} + ${a}) + ${b}`, pattern: [`${v} +`, { k: 's' }], want: { s: a + b }, answerText: `${v} + ${a + b}`,
    prompt: `Build the twin with the Associative Property: <b class="mono">(${v} + ${a}) + ${b}</b> = ?` });
}
export function checkBoxes(p, vals) {
  const keys = p.pattern.filter((x) => typeof x === 'object').map((x) => x.k);
  const g = {};
  for (const k of keys) { g[k] = parseNumber(vals[k]); if (g[k] === null) return { correct: false, nudge: true, key: 'incomplete', message: 'Fill in every box (negative numbers are allowed).' }; }
  const w = p.want;
  if (keys.every((k) => near(g[k], w[k]))) return { correct: true, key: 'correct', message: `The bridges match: ${p.show} = ${p.answerText}.` };
  if (p.form === 'distNeg') {
    if (near(g.k, w.k) && near(g.m, p.c)) return { correct: false, key: 'first_term_only', message: `${fmt(p.a)} multiplies BOTH terms: ${fmt(p.a)} × ${fmt(p.c)}${p.v} = ${fmt(w.m)}${p.v}.` };
    if (near(Math.abs(g.k), Math.abs(w.k)) && near(Math.abs(g.m), Math.abs(w.m))) return { correct: false, key: 'sign_error', message: `Check the signs: ${fmt(p.a)} × ${fmt(p.b)} = ${fmt(w.k)} and ${fmt(p.a)} × ${fmt(p.c)} = ${fmt(w.m)}. A negative times a ${p.c < 0 ? 'negative is positive' : 'positive is negative'}.` };
    return { correct: false, key: 'check_it', message: `Multiply ${fmt(p.a)} by each term: ${fmt(p.a)} × ${fmt(p.b)} and ${fmt(p.a)} × ${fmt(p.c)}${p.v}.` };
  }
  if (p.form === 'factor') {
    if (near(g.g * g.b, p.a * p.b) && !near(g.g, p.a)) return { correct: false, key: 'factor_both_terms', message: `The number outside must divide BOTH terms. ${fmt(g.g)} × ${p.v} would give ${fmt(g.g)}${p.v}, not ${p.a}${p.v}.` };
    if (near(g.g, p.a) && near(g.b, p.a * p.b)) return { correct: false, key: 'forgot_to_divide', message: `Divide the ${p.a * p.b} by ${p.a} too: ${p.a * p.b} ÷ ${p.a} = ${p.b}.` };
    return { correct: false, key: 'check_it', message: `Check by distributing back: ${fmt(g.g)}(${p.v} − ${fmt(g.b)}) = ${fmt(g.g)}${p.v} − ${fmt(g.g * g.b)}.` };
  }
  if (p.form === 'combine') {
    if (near(g.m, Math.abs(p.a) + p.c)) return { correct: false, key: 'lost_negative', message: `${fmt(p.a)}${p.v} is negative: ${fmt(p.a)} + ${p.c} = ${fmt(w.m)}, not ${Math.abs(p.a) + p.c}.` };
    if (near(g.m, p.a + p.c + p.y)) return { correct: false, key: 'combine_unlike', message: `${p.y}y is not an ${p.v}-term. Only combine ${fmt(p.a)}${p.v} and ${p.c}${p.v}.` };
    return { correct: false, key: 'check_it', message: `Reorder so the ${p.v}-terms are together: ${fmt(p.a)}${p.v} + ${p.c}${p.v} = ${fmt(w.m)}${p.v}.` };
  }
  if (p.form === 'frac') {
    if (near(g.m, w.m) && near(g.c, p.d + p.h[0] / p.h[1])) return { correct: false, key: 'sign_error', message: `The numbers are +${p.h[0]}/${p.h[1]} and −${p.d}: together that is −${fmt(w.c)}, so the box is ${fmt(w.c)}.` };
    if (!near(g.m, w.m)) return { correct: false, key: 'combine_unlike', message: `Combine the ${p.v}-terms only: ${p.a}${p.v} + ${p.c}${p.v} = ${w.m}${p.v}.` };
    return { correct: false, key: 'check_it', message: `${p.h[0]}/${p.h[1]} − ${p.d} = −${fmt(w.c)}.` };
  }
  return { correct: false, key: 'check_it', message: `Only the grouping changes: ${p.a} + ${p.b} = ${w.s}.` };
}

/* ================================================================== */
/* Zone 4: find every twin (select all)                                */
/* ================================================================== */
export function genSelect(rnd, form = pick(rnd, ['dist', 'collect'])) {
  const v = pick(rnd, VARS);
  let target, cards;
  if (form === 'dist') {
    const a = pick(rnd, [-2, -3, -4, 2, 3, 5]), b = nz(rnd, -7, 7);
    target = ex(paren(a, v, b), a, a * b);
    cards = [
      { ...ex(sum([a, v], [a * b, '']), a, a * b) },
      { ...ex(sum([a * b, ''], [a, v]), a, a * b) },
      { ...ex(`(${sum([1, v], [b, ''])}) · ${a < 0 ? `(${fmt(a)})` : fmt(a)}`, a, a * b) },
      { ...ex(sum([a, v], [b, '']), a, b), key: 'first_term_only', message: `${fmt(a)} must multiply BOTH terms, so the number is ${fmt(a * b)}, not ${fmt(b)}.` },
      { ...ex(sum([a, v], [-a * b, '']), a, -a * b), key: 'sign_error', message: `Check the sign: ${fmt(a)} × ${fmt(b)} = ${fmt(a * b)}.` },
      { ...ex(term(a * b, v), a * b, 0), key: 'combine_unlike', message: `${fmt(a)} × ${fmt(b)} = ${fmt(a * b)} is a plain number; it does not attach to ${v}.` },
    ];
  } else {                             // t + 4 + 3 − 2t
    const a = int(rnd, 1, 4), b = int(rnd, 2, 9), c = int(rnd, 2, 9), d = a + int(rnd, 1, 4);
    target = ex(sum([a, v], [b, ''], [c, ''], [-d, v]), a - d, b + c);
    cards = [
      { ...ex(sum([a - d, v], [b + c, '']), a - d, b + c) },
      { ...ex(sum([b + c, ''], [a - d, v]), a - d, b + c) },
      { ...ex(sum([a, v], [-d, v], [b + c, '']), a - d, b + c) },
      { ...ex(sum([a + d, v], [b + c, '']), a + d, b + c), key: 'lost_negative', message: `The ${d}${v} is SUBTRACTED: ${a}${v} − ${d}${v} = ${fmt(a - d)}${v}. The sign travels with its term.` },
      { ...ex(term(a - d + b + c, v), a - d + b + c, 0), key: 'combine_unlike', message: `${b} and ${c} are plain numbers. They cannot be combined with the ${v}-terms.` },
      { ...ex(sum([d - a, v], [b + c, '']), d - a, b + c), key: 'sign_error', message: `${a}${v} − ${d}${v} is ${fmt(a - d)}${v}, not ${fmt(d - a)}${v}.` },
    ];
  }
  cards = shuffle(rnd, cards.filter((c, i) => !cards.slice(0, i).some((u) => u.text === c.text) && c.text !== target.text)).map((c) => ({ ...c, ok: same(c, target) }));
  return { id: nextId++, kind: 'select', type: 'select', form, v, target, cards, answerText: cards.filter((c) => c.ok).map((c) => c.text).join('  and  '),
    prompt: `Tap EVERY expression that is equivalent to <b class="mono">${target.text}</b>.` };
}
/** picked: a Set (or array) of card numbers. All-or-nothing, with a hint about what is wrong. */
export function checkSelect(p, picked) {
  const set = new Set(picked);
  if (!set.size) return { correct: false, nudge: true, key: 'incomplete', message: 'Tap at least one expression first.' };
  const wrong = p.cards.map((c, i) => ({ c, i })).filter(({ c, i }) => set.has(i) && !c.ok);
  const missed = p.cards.filter((c, i) => c.ok && !set.has(i)).length;
  if (!wrong.length && !missed) return { correct: true, key: 'correct', message: `Every twin found! They all equal ${sum([p.target.m, p.v], [p.target.k, ''])}.` };
  if (wrong.length) return { correct: false, key: wrong[0].c.key, wrong: wrong.map((w) => w.i), message: `${wrong[0].c.text} is not a twin. ${wrong[0].c.message}${missed ? ` (And ${missed} twin${missed > 1 ? 's are' : ' is'} still missing.)` : ''}` };
  return { correct: false, key: 'missed_twin', wrong: [], message: `All of those are twins, but ${missed} more ${missed > 1 ? 'are' : 'is'} hiding. Terms can be reordered: test a value if you are not sure.` };
}

/* ================================================================== */
/* Boss pieces                                                         */
/* ================================================================== */
/** Maria's error: −4n + 3 + 9n − 4 "= 4n". */
export function genMaria(rnd) {
  const a = int(rnd, 2, 5), b = int(rnd, 2, 6), c = a + int(rnd, 3, 6), d = int(rnd, 2, 6), v = 'n';
  const text = sum([-a, v], [b, ''], [c, v], [-d, '']);
  const hers = -a + b + c - d, right = sum([c - a, v], [b - d, '']);
  if (hers === 0 || b === d) return genMaria(rnd);
  return choice(rnd, { type: 'maria', v, show: text, answerText: right,
    prompt: `Maria says <b class="mono">${text}</b> is equivalent to <b class="mono">${term(hers, v)}</b>. What error did she most likely make?` }, [
    ok(`She combined the plain numbers with the ${v}-terms`),
    no('She forgot that −' + a + v + ' is negative', 'not_the_error', `If she had only lost that sign she would have ${a + c}${v} and some number left over. Add ALL four numbers: ${fmt(-a)} + ${b} + ${c} − ${d} = ${hers}. She combined unlike terms. It should be ${right}.`),
    no('She used the Distributive Property incorrectly', 'not_the_error', `There are no parentheses to distribute. ${fmt(-a)} + ${b} + ${c} − ${d} = ${hers}: she added the plain numbers to the ${v}-terms. It should be ${right}.`),
    no('No error: she is correct', 'combine_unlike', `Test ${v} = 2: the original gives ${(c - a) * 2 + b - d}, but hers gives ${hers * 2}. Only like terms combine: ${right}.`),
  ]);
}
/** Prove a pair is equivalent with a test value: both sides give the same number. */
export function genProve(rnd) {
  const v = pick(rnd, VARS), a = pick(rnd, [-2, -3, -4]), b = int(rnd, 2, 7), x0 = pick(rnd, [-2, 3, 4]);
  const A = ex(paren(a, v, b), a, a * b), B = ex(sum([a, v], [a * b, '']), a, a * b);
  const answer = valueOf(A, x0);
  return { id: nextId++, kind: 'num', type: 'prove', v, A, B, x0, answer, label: 'both bridges',
    prompt: `Prove the twins match: when <b class="mono">${v} = ${fmt(x0)}</b>, what do <b class="mono">${A.text}</b> and <b class="mono">${B.text}</b> BOTH equal?`,
    traps: [
      { v: r2(a * x0 + b), key: 'first_term_only', message: `${fmt(a)} multiplies the whole (${fmt(x0)} + ${b}) = ${fmt(x0 + b)}: ${fmt(a)} × ${fmt(x0 + b)} = ${fmt(answer)}.` },
      { v: -answer, key: 'sign_error', message: `Check the sign: ${fmt(a)} × ${fmt(x0 + b)} = ${fmt(answer)}.` },
      { v: r2(Math.abs(a) * x0 + Math.abs(a * b)), key: 'sign_error', message: `Keep the negatives: ${fmt(a)}(${fmt(x0)}) + (${fmt(a * b)}) = ${fmt(a * x0)} + (${fmt(a * b)}) = ${fmt(answer)}.` },
    ].filter((t, i, all) => !near(t.v, answer) && !all.slice(0, i).some((u) => near(u.v, t.v))) };
}

/* ================================================================== */
/* Zones, backups and the simple checks                                */
/* ================================================================== */
export const ZONES = [
  { name: 'Test the Bridges', blurb: 'Same value for every input?' },
  { name: 'Name the Property', blurb: 'Commutative, Associative, Distributive' },
  { name: 'Build the Twin', blurb: 'Fill the boxes, mind the signs' },
  { name: 'Find Every Twin', blurb: 'Select all that are equivalent' },
  { name: 'The Flood Crossing', blurb: 'Boss: find the error and prove it' },
];
export function genZone(rnd, zone) {
  if (zone === 0) return [genTest(rnd, { eq: true }), genTest(rnd, { eq: false }), ...shuffle(rnd, [genTest(rnd, { eq: false }), genTest(rnd, { eq: true })]), genLucky(rnd)];
  if (zone === 1) return shuffle(rnd, [genProperty(rnd, 'C'), genProperty(rnd, 'A'), genProperty(rnd, 'D'), genProperty(rnd, 'C'), genProperty(rnd, 'D')]);
  if (zone === 2) return [genBuild(rnd, 'assoc'), genBuild(rnd, 'distNeg'), genBuild(rnd, 'factor'), genBuild(rnd, 'combine'), genBuild(rnd, 'distNeg')];
  if (zone === 3) return [genSelect(rnd, 'dist'), genSelect(rnd, 'collect'), genSelect(rnd, 'dist'), genSelect(rnd, 'collect'), genSelect(rnd, 'dist')];
  return [genMaria(rnd), genBuild(rnd, 'frac'), genSelect(rnd, 'collect'), genBuild(rnd, 'distNeg'), genProve(rnd)];
}
export function genBackup(rnd, p) {
  if (p.type === 'test') return genTest(rnd, { eq: p.eq });
  if (p.type === 'lucky') return genLucky(rnd);
  if (p.type === 'property') return genProperty(rnd, p.which);
  if (p.type === 'build') return genBuild(rnd, p.form);
  if (p.type === 'select') return genSelect(rnd, p.form);
  if (p.type === 'maria') return genMaria(rnd);
  return genProve(rnd);
}
/** Test the bridges: the two typed values and the decision (true = "equivalent"). */
export function checkTest(p, rawA, rawB, saysEq) {
  const a = parseNumber(rawA), b = parseNumber(rawB);
  if (a === null || b === null) return { correct: false, nudge: true, key: 'incomplete', message: 'Type what each bridge equals first.' };
  if (!near(a, p.va)) return { correct: false, key: 'evaluation_slip', side: 'A', message: `Check bridge 1: ${p.A.text} with ${p.v} = ${fmt(p.x0)} is ${fmt(p.va)}.` };
  if (!near(b, p.vb)) return { correct: false, key: 'evaluation_slip', side: 'B', message: `Check bridge 2: ${p.B.text} with ${p.v} = ${fmt(p.x0)} is ${fmt(p.vb)}.` };
  if (saysEq === p.eq) return { correct: true, key: 'correct', message: p.eq ? `Both give ${fmt(p.va)}, and they always will. ${p.why}` : `${fmt(p.va)} is not ${fmt(p.vb)}: one different value proves they are NOT equivalent. ${p.why}` };
  if (p.eq) return { correct: false, key: 'same_values', message: `Both bridges gave ${fmt(p.va)}. ${p.why} They are equivalent.` };
  return { correct: false, key: p.slipKey, message: `The bridges gave ${fmt(p.va)} and ${fmt(p.vb)}. Different values mean NOT equivalent. ${p.why}` };
}
export function checkChoice(p, i) {
  const o = p.options[i];
  if (o.ok) return { correct: true, key: 'correct', message: p.type === 'property' ? `Yes: ${PROP_TIP[p.which]}` : p.type === 'maria' ? `Right. Only like terms combine: ${p.answerText}.` : 'Right! One matching value is not proof; one DIFFERENT value is.' };
  return { correct: false, key: o.key, message: o.message };
}
export function checkNum(p, raw) {
  const v = parseNumber(raw);
  if (v === null) return { correct: false, nudge: true, key: 'incomplete', message: 'Type a number (it can be negative).' };
  if (near(v, p.answer)) return { correct: true, key: 'correct', message: `Both bridges give ${fmt(p.answer)}. The twins hold!` };
  const trap = p.traps.find((t) => near(v, t.v));
  if (trap) return { correct: false, key: trap.key, message: trap.message };
  return { correct: false, key: 'evaluation_slip', message: `Substitute ${fmt(p.x0)} for ${p.v} in either expression, then follow the order of operations.` };
}

/* ================================================================== */
/* Worked solutions (after two misses)                                 */
/* ================================================================== */
export function workedSolution(p) {
  if (p.type === 'test') return [`${p.A.text} with ${p.v} = ${fmt(p.x0)}: ${fmt(p.va)}`, `${p.B.text} with ${p.v} = ${fmt(p.x0)}: ${fmt(p.vb)}`, p.why, `Answer: ${p.answerText}.`];
  if (p.type === 'lucky') return [`${p.v} = 0 gives ${p.va} on both.`, `${p.v} = 1 gives ${valueOf(p.A, 1)} and ${valueOf(p.B, 1)}.`, 'One different value proves they are NOT equivalent.'];
  if (p.type === 'property') return [`${p.from}  →  ${p.to}`, PROP_TIP[p.which]];
  if (p.type === 'build') return [p.show, p.form === 'distNeg' ? `${fmt(p.a)} × ${fmt(p.b)} = ${fmt(p.want.k)} and ${fmt(p.a)} × ${fmt(p.c)}${p.v} = ${fmt(p.want.m)}${p.v}` : p.form === 'factor' ? `Both terms divide by ${p.a}: ${p.a * p.b} ÷ ${p.a} = ${p.b}` : p.form === 'assoc' ? `Regroup: ${p.a} + ${p.b} = ${p.want.s}` : 'Put like terms together, then combine them.', `= ${p.answerText}`];
  if (p.type === 'select') return [`${p.target.text} simplifies to ${sum([p.target.m, p.v], [p.target.k, ''])}.`, `The twins: ${p.answerText}.`, 'The others change a sign, skip a term, or combine unlike terms.'];
  if (p.type === 'maria') return [`${p.v}-terms and plain numbers are not like terms.`, `Combine them separately: ${p.answerText}.`];
  return [`${p.A.text} with ${p.v} = ${fmt(p.x0)}: ${fmt(p.answer)}`, `${p.B.text} with ${p.v} = ${fmt(p.x0)}: ${fmt(p.answer)}`];
}
