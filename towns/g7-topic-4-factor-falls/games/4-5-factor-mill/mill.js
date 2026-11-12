// Factor Mill (Grade 7, Lesson 4-5: Factor Expressions): the math.
// No screen code here, so it can be tested with plain node (see test_factor_mill_math.js).
//
// Factoring runs the Distributive Property backward:  4x + 20  =  4(x + 5).
// A factor problem has `terms` ({ c, v } with whole-number coefficients), a `factor` to pull out (the GCF, or the
// negative GCF when the problem asks for a negative factor) and `inside` (each term divided by the factor).
// Answer kinds:  factor (pick the wheel, then type what is left),  select,  choice,  num.

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
export const near = (a, b) => Math.abs(a - b) < 1e-6;
export const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
export const gcdAll = (list) => list.reduce((g, n) => gcd(g, n), 0);

export const fmt = (v) => (v < 0 ? `−${Math.abs(v)}` : String(v));
/** A typed whole number: "-3", "−3", "+5", "12". */
export function parseNumber(raw) {
  const t = String(raw ?? '').trim().replace(/^−/, '-').replace(/^\+/, '').replace(/\s/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}
export const termText = (c, v = '') => (v && Math.abs(c) === 1 ? `${c < 0 ? '−' : ''}${v}` : `${fmt(c)}${v}`);
export const exprText = (terms) => terms.map((t, i) => (i === 0 ? termText(t.c, t.v) : `${t.c < 0 ? '−' : '+'} ${termText(Math.abs(t.c), t.v)}`)).join(' ');
export const factoredText = (f, inside) => `${fmt(f)}(${exprText(inside)})`;
const T = (c, v = '') => ({ c, v });
const divisors = (n) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);

/* ================================================================== */
/* Factor problems                                                     */
/* ================================================================== */
/**
 * levels:  two (16a + 10)   multi (18x + 24y: several common factors, find the greatest)
 *          negpos (−2x − 6 with the positive GCF)   negneg (the same, with a NEGATIVE factor)
 *          three (6x − 18 − 12y)   partial (12x + 18y + 26: 6 fits two terms, but the GCF is 2)   threeneg (boss)
 */
export function genFactor(rnd, { level = 'two' } = {}) {
  const v = pick(rnd, ['x', 'y', 'a', 'n']);
  for (;;) {
    let g, coefs, vars;
    if (level === 'two' || level === 'multi') {
      g = level === 'multi' ? pick(rnd, [4, 6, 8, 9, 10, 12]) : int(rnd, 2, 9);
      const p = int(rnd, 1, 8), q = int(rnd, 2, 9) * (rnd() < 0.4 ? -1 : 1);
      if (gcd(p, q) !== 1) continue;
      coefs = [g * p, g * q]; vars = level === 'multi' && rnd() < 0.5 ? ['x', 'y'] : [v, ''];
    } else if (level === 'negpos' || level === 'negneg') {
      g = int(rnd, 2, 7);
      const p = int(rnd, 1, 6), q = int(rnd, 2, 9);
      if (gcd(p, q) !== 1) continue;
      coefs = [-g * p, -g * q]; vars = [v, ''];
    } else if (level === 'partial') {
      g = 2; const h = pick(rnd, [3, 5]);
      const p = int(rnd, 1, 4), q = int(rnd, 1, 5), r = pick(rnd, [7, 11, 13, 1]);
      if (p === q || gcdAll([h * p, h * q, r]) !== 1 || r % h === 0) continue;
      coefs = [g * h * p, g * h * q, g * r]; vars = ['x', 'y', ''];
    } else {                             // three, threeneg
      g = int(rnd, 2, 6);
      const p = int(rnd, 1, 5), q = int(rnd, 1, 5), r = int(rnd, 1, 5);
      if (gcdAll([p, q, r]) !== 1 || new Set([p, q, r]).size < 2) continue;
      const s = level === 'threeneg' ? [-1, 1, -1] : [1, pick(rnd, [-1, 1]), -1];
      coefs = [g * p * s[0], g * q * s[1], g * r * s[2]]; vars = level === 'threeneg' ? ['x', '', 'y'] : ['x', '', 'y'];
    }
    const terms = coefs.map((c, i) => T(c, vars[i]));
    const G = gcdAll(coefs);
    const negative = level === 'negneg' || level === 'threeneg';
    const factor = negative ? -G : G;
    const inside = terms.map((t) => T(t.c / factor, t.v));
    // wheel choices: the GCF, a smaller common factor, a factor of only SOME terms, and a filler
    const abs = coefs.map(Math.abs);
    const small = divisors(G).filter((d) => d > 1 && d < G);
    const some = [...new Set(abs.flatMap(divisors))].filter((d) => d > 1 && !abs.every((c) => c % d === 0) && d <= 20);
    const pool = [G, ...(small.length ? [pick(rnd, small)] : []), ...shuffle(rnd, some).slice(0, 3)];
    let wheels = [...new Set(pool)].slice(0, 4);
    for (let extra = 2; wheels.length < 4 && extra < 30; extra++) if (!wheels.includes(extra) && extra !== 1) wheels.push(extra);
    if (negative) wheels = [...new Set([-G, G, ...wheels.slice(1).map((w) => -w)])].slice(0, 4);
    wheels.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
    const show = exprText(terms);
    return { id: nextId++, kind: 'factor', type: 'factor', level, terms, gcf: G, factor, negative, inside, wheels, show, answerText: factoredText(factor, inside),
      prompt: negative
        ? `Factor <b class="mono">${show}</b> using a <b>NEGATIVE</b> common factor (the greatest one).`
        : `Factor <b class="mono">${show}</b> using the greatest common factor (GCF).` };
  }
}
/** Step 1: which wheel (common factor)? */
export function checkWheel(p, w) {
  if (w === p.factor) return { correct: true, key: 'correct', message: `${fmt(w)} divides every term. Now divide each term by ${fmt(w)}.` };
  const bad = p.terms.find((t) => t.c % w !== 0);
  if (bad) return { correct: false, key: 'not_common', message: `${fmt(Math.abs(w))} does not divide ${termText(Math.abs(bad.c), bad.v)}. A common factor must divide EVERY term.` };
  if (p.negative && w > 0) return { correct: false, key: 'wrong_sign', message: `${w} is a common factor, but this time the mill needs a NEGATIVE one: ${fmt(p.factor)}.` };
  return { correct: false, key: 'not_greatest', message: `${fmt(w)} does divide every term, but a bigger wheel fits. Look for the GREATEST common factor of ${p.terms.map((t) => Math.abs(t.c)).join(', ')}.` };
}
/** Step 2: what is left inside the parentheses: raws = [text, ...], one per term. */
export function checkInside(p, raws) {
  const g = raws.map(parseNumber);
  if (g.length < p.terms.length || g.some((x) => x === null)) return { correct: false, nudge: true, key: 'incomplete', message: 'Fill in every box (a box can be negative).' };
  for (let i = 0; i < p.terms.length; i++) {
    const t = p.terms[i], want = p.inside[i].c;
    if (g[i] === want) continue;
    const work = `${termText(t.c, t.v)} ÷ ${fmt(p.factor)} = ${termText(want, t.v)}`;
    if (g[i] === t.c) return { correct: false, key: 'forgot_to_divide', section: i, message: `That term was not divided. EVERY term is divided by ${fmt(p.factor)}: ${work}.` };
    if (g[i] === -want) return { correct: false, key: 'sign_error', section: i, message: `Check the sign: ${work}.${p.factor < 0 ? ' Dividing by a negative flips the sign.' : ''}` };
    return { correct: false, key: 'calc', section: i, message: `${work}. Check by distributing back: ${fmt(p.factor)} × ${termText(want, t.v)} = ${termText(t.c, t.v)}.` };
  }
  return { correct: true, key: 'correct', message: `Factored: ${p.show} = ${p.answerText}. Distribute back to check!` };
}

/* ================================================================== */
/* Select all the twins of 12 + 30y, then "which one is fully factored?" */
/* ================================================================== */
function twinSet(rnd) {
  for (;;) {
    const g = pick(rnd, [6, 8, 10, 12]), p = int(rnd, 2, 5), q = int(rnd, 2, 7), v = pick(rnd, ['y', 'x', 'n']);
    if (gcd(p, q) !== 1) continue;
    const A = g * p, B = g * q, small = divisors(g).filter((d) => d > 1 && d < g);
    if (small.length < 2) continue;
    const [s1, s2] = shuffle(rnd, small);
    return { v, A, B, g, p, q, s1, s2, show: exprText([T(A), T(B, v)]) };
  }
}
export function genSelect(rnd) {
  const k = twinSet(rnd), { v, A, B, g, p, q, s1, s2 } = k;
  const F = (f, a, b, key, message) => ({ text: factoredText(f, [T(a), T(b, v)]), value: [f * a, f * b], key, message });
  let cards = [
    F(g, p, q), F(s1, A / s1, B / s1), F(s2, A / s2, B / s2),
    F(s1, A / s1, B, 'forgot_to_divide', `Distribute back: ${s1} × ${B}${v} = ${s1 * B}${v}, not ${B}${v}. Both terms must be divided by ${s1}.`),
    F(g, p + 1, q, 'calc', `Distribute back: ${g} × ${p + 1} = ${g * (p + 1)}, not ${A}.`),
    F(s2, A, B / s2, 'forgot_to_divide', `Distribute back: ${s2} × ${A} = ${s2 * A}, not ${A}. Both terms must be divided by ${s2}.`),
  ];
  cards = shuffle(rnd, cards.map((c) => ({ ...c, ok: c.value[0] === A && c.value[1] === B })));
  return { id: nextId++, kind: 'select', type: 'select', ...k, cards, answerText: cards.filter((c) => c.ok).map((c) => c.text).join(',  '),
    prompt: `Tap EVERY expression that is equivalent to <b class="mono">${k.show}</b>. (Distribute back to check each one.)` };
}
export function checkSelect(p, picked) {
  const set = new Set(picked);
  if (!set.size) return { correct: false, nudge: true, key: 'incomplete', message: 'Tap at least one expression first.' };
  const wrong = p.cards.map((c, i) => ({ c, i })).filter(({ c, i }) => set.has(i) && !c.ok);
  const missed = p.cards.filter((c, i) => c.ok && !set.has(i)).length;
  if (!wrong.length && !missed) return { correct: true, key: 'correct', message: `Every twin found! Any common factor gives an equivalent expression; the GCF gives the fully factored one.` };
  if (wrong.length) return { correct: false, key: wrong[0].c.key, wrong: wrong.map((w) => w.i), message: `${wrong[0].c.text} is not equivalent. ${wrong[0].c.message}${missed ? ` (And ${missed} more ${missed > 1 ? 'are' : 'is'} missing.)` : ''}` };
  return { correct: false, key: 'missed_twin', wrong: [], message: `All of those are equivalent, but ${missed} more ${missed > 1 ? 'are' : 'is'} hiding. A smaller common factor still gives an equivalent expression.` };
}
const ok = (text) => ({ text, ok: true, key: 'correct' });
const no = (text, key, message) => ({ text, ok: false, key, message });
const choice = (rnd, extra, options) => ({ id: nextId++, kind: 'choice', ...extra, options: shuffle(rnd, options) });
export function genFully(rnd) {
  const { v, A, B, g, p, q, s1, s2, show } = twinSet(rnd);
  const tip = `All three are equivalent, but only ${g} is the GREATEST common factor of ${A} and ${B}: inside ${factoredText(g, [T(p), T(q, v)])} nothing else can be pulled out.`;
  return choice(rnd, { type: 'fully', show, answerText: factoredText(g, [T(p), T(q, v)]), prompt: `All of these equal <b class="mono">${show}</b>. Which one is FULLY factored (uses the GCF)?` }, [
    ok(factoredText(g, [T(p), T(q, v)])),
    no(factoredText(s1, [T(A / s1), T(B / s1, v)]), 'not_greatest', `${A / s1} and ${B / s1} still share a factor of ${g / s1}. ${tip}`),
    no(factoredText(s2, [T(A / s2), T(B / s2, v)]), 'not_greatest', `${A / s2} and ${B / s2} still share a factor of ${g / s2}. ${tip}`),
  ]);
}

/* ================================================================== */
/* Boss pieces                                                         */
/* ================================================================== */
/** Susan's error: 12a − 15b + 6 factored as 3(4a + 5b + 3): a sign was lost. */
export function genSusan(rnd) {
  const g = pick(rnd, [3, 4, 5]), p = int(rnd, 2, 5), q = int(rnd, 2, 6), r = int(rnd, 2, 4);
  if (gcdAll([p, q, r]) !== 1) return genSusan(rnd);
  const show = exprText([T(g * p, 'a'), T(-g * q, 'b'), T(g * r)]);
  const hers = factoredText(g, [T(p, 'a'), T(q, 'b'), T(r)]), right = factoredText(g, [T(p, 'a'), T(-q, 'b'), T(r)]);
  return choice(rnd, { type: 'susan', show, hers, answerText: right, prompt: `Susan factored <b class="mono">${show}</b> as <b class="mono">${hers}</b>. What went wrong?` }, [
    ok(`A sign was lost: it should be − ${q}b inside`),
    no(`${g} is not a common factor`, 'not_the_error', `${g} does divide ${g * p}, ${g * q} and ${g * r}. Distribute hers back: ${g} × ${q}b = +${g * q}b, but the original has −${g * q}b. The sign was lost: ${right}.`),
    no(`She should have used a bigger factor`, 'not_the_error', `${g} IS the greatest common factor. Distribute hers back: you get +${g * q}b, not −${g * q}b. The sign was lost: ${right}.`),
    no('Nothing: she is correct', 'sign_error', `Distribute it back: ${g} × ${q}b = +${g * q}b, but the original has −${g * q}b. It should be ${right}.`),
  ]);
}
/** The friend's error: 15x − 20xy as 5x(3 − 4xy): the x was left inside. */
export function genFriend(rnd) {
  const g = pick(rnd, [2, 3, 4, 5]), p = int(rnd, 2, 5), q = int(rnd, 2, 6);
  if (gcd(p, q) !== 1) return genFriend(rnd);
  const show = `${g * p}x − ${g * q}xy`, right = `${g}x(${p} − ${q}y)`;
  return choice(rnd, { type: 'friend', show, answerText: right, prompt: `Factor <b class="mono">${show}</b> completely. (A friend wrote ${g}x(${p} − ${q}xy). Is that right?)` }, [
    ok(right),
    no(`${g}x(${p} − ${q}xy)`, 'variable_left_inside', `Distribute it back: ${g}x × ${q}xy = ${g * q}x²y, not ${g * q}xy. Once x is pulled out, it is no longer inside: ${right}.`),
    no(`${g}(${p}x − ${q}y)`, 'dropped_variable', `Distribute it back: ${g} × ${q}y = ${g * q}y, but the original has ${g * q}xy. The x went missing. It should be ${right}.`),
    no(`x(${g * p} − ${g * q}y)`, 'not_greatest', `That is equivalent, but ${g * p} and ${g * q} still share a factor of ${g}. Completely factored: ${right}.`),
  ]);
}
/** Ryan's claim: 3 + 5y cannot be factored using a GCF. He is right. */
export function genRyan(rnd) {
  const [a, b] = pick(rnd, [[3, 5], [4, 7], [2, 9], [5, 8], [7, 3]]);
  const show = `${a} + ${b}y`;
  return choice(rnd, { type: 'ryan', show, answerText: 'It cannot be factored', prompt: `Ryan says <b class="mono">${show}</b> cannot be factored using a GCF. Is he correct?` }, [
    ok(`Yes: the only common factor of ${a} and ${b} is 1`),
    no(`No: it is ${a}(1 + ${b}y)`, 'not_common', `Distribute back: ${a} × ${b}y = ${a * b}y, not ${b}y. ${a} does not divide ${b}.`),
    no(`No: it is y(${a} + ${b})`, 'not_common', `Distribute back: y × ${a} = ${a}y, but the original has a plain ${a}. y is not in both terms.`),
    no(`No: it is ${b}(${a} + y)`, 'not_common', `Distribute back: ${b} × ${a} = ${a * b}, not ${a}. ${b} does not divide ${a}.`),
  ]);
}
/** Sahil's supply kits: 36x + 12y + 24. The GCF is the greatest number of identical kits. */
export function genKits(rnd) {
  const g = pick(rnd, [4, 6, 8, 12]), p = int(rnd, 2, 4), q = 1, r = pick(rnd, [2, 3]);
  const [A, B, C] = [g * p, g * q, g * r];
  const small = divisors(g).filter((d) => d > 1 && d < g).pop();
  return { id: nextId++, kind: 'num', type: 'kits', show: `${A}x + ${B}y + ${C}`, A, B, C, answer: g, label: 'kits', answerText: `${g}(${p}x + ${q === 1 ? '' : q}y + ${r})`,
    prompt: `Sahil has ${A} packs of pencils, ${B} packs of crayons and ${C} erasers: <b class="mono">${A}x + ${B}y + ${C}</b> items. He puts every pack and eraser into identical kits. What is the GREATEST number of kits?`,
    traps: [
      { v: small, key: 'not_greatest', message: `${small} kits would work, but more are possible. Find the GREATEST common factor of ${A}, ${B} and ${C}.` },
      { v: gcd(A, C), key: 'not_common', message: `${gcd(A, C)} divides ${A} and ${C}, but not ${B}. Every type of item must split evenly.` },
      { v: A + B + C, key: 'calc', message: `That adds the numbers. The kits need a number that DIVIDES ${A}, ${B} and ${C}.` },
    ].filter((t, i, all) => t.v !== g && t.v > 0 && !all.slice(0, i).some((u) => u.v === t.v)) };
}
export function checkChoice(p, i) {
  const o = p.options[i];
  if (o.ok) return { correct: true, key: 'correct', message: p.type === 'ryan' ? `Right: with a GCF of 1 there is nothing to pull out of ${p.show}.` : `Right: ${p.answerText}. Distributing back gives ${p.show}.` };
  return { correct: false, key: o.key, message: o.message };
}
export function checkNum(p, raw) {
  const v = parseNumber(raw);
  if (v === null) return { correct: false, nudge: true, key: 'incomplete', message: 'Type a whole number.' };
  if (v === p.answer) return { correct: true, key: 'correct', message: `${p.answer} kits: ${p.show} = ${p.answerText}. What is inside the parentheses is one kit.` };
  const trap = p.traps.find((t) => t.v === v);
  if (trap) return { correct: false, key: trap.key, message: trap.message };
  const fits = [p.A, p.B, p.C].every((n) => n % v === 0) && v > 0;
  return { correct: false, key: fits ? 'not_greatest' : 'not_common', message: fits ? `${v} kits would work, but more are possible. Find the GREATEST common factor.` : `${v} does not divide all of ${p.A}, ${p.B} and ${p.C}.` };
}

/* ================================================================== */
/* Zones, backups, worked solutions                                    */
/* ================================================================== */
export const ZONES = [
  { name: 'Find the Wheel', blurb: 'Two terms: pull out the GCF' },
  { name: 'The Greatest Wheel', blurb: 'Several fit: which is greatest?' },
  { name: 'Negative Wheels', blurb: 'Two ways to factor' },
  { name: 'Three Sections', blurb: 'Three terms' },
  { name: 'The Great Wheel', blurb: 'Boss: find the errors' },
];
const many = (rnd, levels) => levels.map((level) => genFactor(rnd, { level }));
export function genZone(rnd, zone) {
  if (zone === 0) return many(rnd, ['two', 'two', 'two', 'two', 'two']);
  if (zone === 1) return [genFactor(rnd, { level: 'multi' }), genFactor(rnd, { level: 'multi' }), genSelect(rnd), genFully(rnd), genFactor(rnd, { level: 'multi' })];
  if (zone === 2) return many(rnd, ['negpos', 'negneg', 'negpos', 'negneg', 'negneg']);
  if (zone === 3) return many(rnd, ['three', 'partial', 'three', 'partial']);
  return [genSusan(rnd), genFriend(rnd), genRyan(rnd), genKits(rnd), genFactor(rnd, { level: 'threeneg' })];
}
export function genBackup(rnd, p) {
  if (p.type === 'factor') return genFactor(rnd, { level: p.level });
  return ({ select: genSelect, fully: genFully, susan: genSusan, friend: genFriend, ryan: genRyan, kits: genKits })[p.type](rnd);
}
export function workedSolution(p) {
  if (p.type === 'factor') return [`Greatest common factor of ${p.terms.map((t) => Math.abs(t.c)).join(', ')}: ${p.gcf}${p.negative ? ` (use ${fmt(p.factor)})` : ''}.`, ...p.terms.map((t, i) => `${termText(t.c, t.v)} ÷ ${fmt(p.factor)} = ${termText(p.inside[i].c, t.v)}`), `Factored: ${p.answerText}`];
  if (p.type === 'select') return [`Distribute each one back and compare with ${p.show}.`, `Equivalent: ${p.answerText}.`];
  if (p.type === 'kits') return [`Common factors of ${p.A}, ${p.B} and ${p.C}; the greatest is ${p.answer}.`, `${p.show} = ${p.answerText}`, `${p.answer} kits.`];
  if (p.type === 'ryan') return ['List the factors of each number.', 'The only one they share is 1, so nothing can be pulled out.'];
  return ['Check a factored expression by distributing back.', `Correct: ${p.answerText}`];
}
