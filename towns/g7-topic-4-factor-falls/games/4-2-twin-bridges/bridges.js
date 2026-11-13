// Twin Bridges (Grade 7, Lesson 4-2: Generate Equivalent Expressions): the math.
// No screen code here, so it can be tested with plain node (see test_twin_bridges_math.js).
//
// Every expression here is linear in one letter, so it is stored as its text plus what it equals:  m·x + k.
// Two expressions are equivalent (twins) exactly when m and k both match.
// The picture: a row of POSTS, one for each x value. Each expression is a bridge whose plank at a post sits at the
// height the expression gives there. Twins lie on top of each other at every post.
// Round types:
//   test    two bridges: test posts of your choice, then call TWINS or NOT TWINS (some pairs agree at one lucky post)
//   raft    one bridge on the sign; expressions float past: hook every twin, let the rest go by
//   build   one bridge is given: build its twin on two dials (the x-part and the number part)
//           hidden: the bridge has no text, only its planks at the posts the student chooses to look at
//   chain   a worked simplification, line by line: one step is wrong. Find it, then build the right last line.

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

/* ================================================================== */
/* Pairs of bridges                                                    */
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
/** The x values with a post. */
export const POSTS = [-3, -2, -1, 0, 1, 2, 3, 4];
/** The dials for building a twin:  (x-part) x + (number part). */
export const DIALS = { m: { lo: -15, hi: 15 }, k: { lo: -60, hi: 60 } };
export const PROPS = { C: 'COMMUTATIVE PROPERTY', A: 'ASSOCIATIVE PROPERTY', D: 'DISTRIBUTIVE PROPERTY', L: 'COMBINING LIKE TERMS' };
/** m·x + k written simply: "−3x + 12". */
export const plain = (m, k, v = 'x') => (near(m, 0) ? fmt(k) : near(k, 0) ? sum([m, v]) : sum([m, v], [k, '']));
/** The posts where two expressions give the same height. */
export const agreeAt = (A, B) => POSTS.filter((x) => near(valueOf(A, x), valueOf(B, x)));

/* ================================================================== */
/* Test: are these two bridges twins?                                  */
/* ================================================================== */
/** A pair that agrees at exactly one post (x = lucky) and nowhere else. */
function luckyPair(rnd) {
  const v = pick(rnd, VARS), a = pick(rnd, [2, 3, 4, 5]), b = nz(rnd, -5, 6), lucky = pick(rnd, [0, 0, 1, 2, -1]);
  const A = ex(paren(a, v, b), a, a * b);
  for (const m2 of shuffle(rnd, [a * b, a + 1, a - 1, 1, -a, 2 * a]).filter((m) => m !== a && m !== 0)) {
    const k2 = a * lucky + a * b - m2 * lucky, B = ex(plain(m2, k2, v), m2, k2);
    if (Math.abs(k2) <= 40 && agreeAt(A, B).length === 1) return { v, A, B, lucky, key: 'one_test_value', why: `They agree only at ${v} = ${fmt(lucky)}. ${paren(a, v, b)} is ${plain(a, a * b, v)}.` };
  }
  return luckyPair(rnd);
}
/** eq: twins. lucky: not twins, but they agree at one post. */
export function genTest(rnd, { eq = rnd() < 0.5, lucky = false } = {}) {
  const q = lucky ? luckyPair(rnd) : pair(rnd, eq);
  return { id: nextId++, type: 'test', v: q.v, A: q.A, B: q.B, eq: lucky ? false : eq, lucky: lucky ? q.lucky : null, why: q.why, slipKey: q.key, tests: 3 };
}
/** tested: the posts the student looked at. saysTwins: their call. */
export function checkTest(p, tested, saysTwins) {
  if (!tested.length) return { ok: false, nudge: true, key: 'incomplete', message: 'Test at least one post before you decide.' };
  if (saysTwins === p.eq) return { ok: true, key: 'correct', message: p.eq ? `Twins at every post. ${p.why}` : `Not twins. ${p.why}` };
  if (!saysTwins) return { ok: false, key: 'doubted_twins', message: `They ARE twins: the planks match at every post. ${p.why}` };
  const sawSplit = tested.some((x) => !near(valueOf(p.A, x), valueOf(p.B, x)));
  if (sawSplit) return { ok: false, key: 'ignored_test', message: `Not twins. One of your own tests showed two different heights, and one post that splits is enough. ${p.why}` };
  return { ok: false, key: 'one_test_value', message: `Not twins. They matched where you looked (${p.v} = ${tested.map(fmt).join(', ')}) but split everywhere else. Matching at one post is not proof: test a second, different post.` };
}

/* ================================================================== */
/* Rafts: hook every twin of the bridge on the sign                    */
/* ================================================================== */
export function genRaft(rnd, form = pick(rnd, ['dist', 'collect', 'assoc'])) {
  const v = pick(rnd, VARS);
  let target, cards;
  if (form === 'dist') {
    const a = pick(rnd, [-2, -3, -4, 2, 3, 5]), b = nz(rnd, -7, 7);
    target = ex(paren(a, v, b), a, a * b);
    cards = [
      { ...ex(sum([a, v], [a * b, '']), a, a * b), prop: 'D' },
      { ...ex(sum([a * b, ''], [a, v]), a, a * b), prop: 'C' },
      { ...ex(`(${sum([1, v], [b, ''])}) · ${a < 0 ? `(${fmt(a)})` : fmt(a)}`, a, a * b), prop: 'C' },
      { ...ex(sum([a, v], [b, '']), a, b), key: 'first_term_only', message: `${fmt(a)} must multiply BOTH terms, so the number is ${fmt(a * b)}, not ${fmt(b)}.` },
      { ...ex(sum([a, v], [-a * b, '']), a, -a * b), key: 'sign_error', message: `Check the sign: ${fmt(a)} × ${fmt(b)} = ${fmt(a * b)}.` },
      { ...ex(term(a * b, v), a * b, 0), key: 'combine_unlike', message: `${fmt(a)} × ${fmt(b)} = ${fmt(a * b)} is a plain number; it does not attach to ${v}.` },
    ];
  } else if (form === 'collect') {     // t + 4 + 3 − 2t
    const a = int(rnd, 1, 4), b = int(rnd, 2, 9), c = int(rnd, 2, 9), d = a + int(rnd, 1, 4);
    target = ex(sum([a, v], [b, ''], [c, ''], [-d, v]), a - d, b + c);
    cards = [
      { ...ex(sum([a - d, v], [b + c, '']), a - d, b + c), prop: 'L' },
      { ...ex(sum([b + c, ''], [a - d, v]), a - d, b + c), prop: 'L' },
      { ...ex(sum([a, v], [-d, v], [b + c, '']), a - d, b + c), prop: 'C' },
      { ...ex(sum([a + d, v], [b + c, '']), a + d, b + c), key: 'lost_negative', message: `The ${d}${v} is SUBTRACTED: ${a}${v} − ${d}${v} = ${fmt(a - d)}${v}. The sign travels with its term.` },
      { ...ex(term(a - d + b + c, v), a - d + b + c, 0), key: 'combine_unlike', message: `${b} and ${c} are plain numbers. They cannot be combined with the ${v}-terms.` },
      { ...ex(sum([d - a, v], [b + c, '']), d - a, b + c), key: 'sign_error', message: `${a}${v} − ${d}${v} is ${fmt(a - d)}${v}, not ${fmt(d - a)}${v}.` },
    ];
  } else {                             // (2x + 5) + 3x
    const a = int(rnd, 2, 5), b = int(rnd, 2, 9), c = int(rnd, 2, 6);
    target = ex(`(${sum([a, v], [b, ''])}) + ${c}${v}`, a + c, b);
    cards = [
      { ...ex(`${a}${v} + (${b} + ${c}${v})`, a + c, b), prop: 'A' },
      { ...ex(`(${a}${v} + ${c}${v}) + ${b}`, a + c, b), prop: 'C' },
      { ...ex(sum([a + c, v], [b, '']), a + c, b), prop: 'L' },
      { ...ex(term(a + b + c, v), a + b + c, 0), key: 'combine_unlike', message: `${b} is a plain number. It cannot be combined with ${a}${v} and ${c}${v}.` },
      { ...ex(sum([a, v], [b + c, '']), a, b + c), key: 'combine_unlike', message: `${c}${v} is an ${v}-term: it joins ${a}${v}, not the ${b}.` },
      { ...ex(sum([a * c, v], [b, '']), a * c, b), key: 'times_not_plus', message: `${a}${v} + ${c}${v} is ${a + c}${v}. The terms are added, not multiplied.` },
    ];
  }
  cards = shuffle(rnd, cards.filter((c, i) => !cards.slice(0, i).some((u) => u.text === c.text) && c.text !== target.text)).map((c) => ({ ...c, twin: same(c, target) }));
  if (cards.some((c) => c.twin !== Boolean(c.prop))) return genRaft(rnd, form);   // a trap that happens to equal the target: draw again
  return { id: nextId++, type: 'raft', form, v, target, cards, seconds: 8 };
}
/** Raft i went by. hooked: the student hooked it onto the bridge. quiet: nothing to score (a trap rightly let go). */
export function checkRaft(p, i, hooked) {
  const c = p.cards[i], x = POSTS.find((v) => !near(valueOf(c, v), valueOf(p.target, v)));
  if (hooked && c.twin) return { ok: true, key: 'correct', property: PROPS[c.prop], message: `${c.text} is a twin.` };
  if (!hooked && !c.twin) return { ok: true, quiet: true, key: 'correct', message: '' };
  if (hooked) return { ok: false, key: c.key, at: x, message: `${c.text} is not a twin: at ${p.v} = ${fmt(x)} the bridge is ${fmt(valueOf(p.target, x))} but this is ${fmt(valueOf(c, x))}. ${c.message}` };
  return { ok: false, key: 'missed_twin', message: `${c.text} was a twin: it equals ${plain(p.target.m, p.target.k, p.v)} too. Terms can be reordered and regrouped.` };
}

/* ================================================================== */
/* Build: the twin on two dials                                        */
/* ================================================================== */
/** form: assoc, distNeg, dist, combine, sub (subtract a whole group), dec, frac (a decimal or fraction outside), hidden. */
export function genBuild(rnd, form = pick(rnd, ['distNeg', 'dist', 'combine'])) {
  const v = pick(rnd, VARS);
  // A trap that happens to give the right answer (2 + 2 = 2 × 2) is not a trap.
  const make = (text, m, k, more) => ({ id: nextId++, type: 'build', form, v, A: ex(text, m, k), ...more, traps: more.traps.filter((tr) => !(near(tr.m, m) && near(tr.k, k))) });
  if (form === 'assoc') { const a = int(rnd, 2, 9), b = int(rnd, 2, 9); return make(`(${v} + ${a}) + ${b}`, 1, a + b, { prop: 'A', traps: [] }); }
  if (form === 'distNeg') {            // −3(x − 4)
    const a = pick(rnd, [-2, -3, -4, -5]), b = nz(rnd, -6, 6);
    return make(paren(a, v, b), a, a * b, { prop: 'D', traps: [
      { m: a, k: b, key: 'first_term_only', message: `${fmt(a)} multiplies BOTH terms inside, not only the ${v}.` },
      { m: a, k: -a * b, key: 'sign_error', message: `Check the sign of the number part: what is ${fmt(a)} × ${fmt(b)}?` },
      { m: -a, k: a * b, key: 'sign_error', message: `Check the sign of the ${v}-part: the ${fmt(a)} outside is negative.` }] });
  }
  if (form === 'dist') {               // 4(2x − 3)
    const a = int(rnd, 2, 5), c = int(rnd, 2, 3), b = nz(rnd, -6, 6);
    return make(`${a}(${sum([c, v], [b, ''])})`, a * c, a * b, { prop: 'D', traps: [
      { m: a * c, k: b, key: 'first_term_only', message: `${a} multiplies BOTH terms inside, not only the ${c}${v}.` },
      { m: c, k: a * b, key: 'first_term_only', message: `${a} multiplies the ${c}${v} as well.` },
      { m: a + c, k: a * b, key: 'times_not_plus', message: `${a} TIMES ${c}${v}, not ${a} plus ${c}.` }] });
  }
  if (form === 'combine') {            // −5x + 8 + 3x − 2
    const a = pick(rnd, [-7, -6, -5, -4, 4, 5]), c = int(rnd, 2, 3), b = int(rnd, 4, 9), d = int(rnd, 1, 6);
    return make(sum([a, v], [b, ''], [c, v], [-d, '']), a + c, b - d, { prop: 'L', traps: [
      { m: Math.abs(a) + c, k: b - d, key: 'lost_negative', message: `Keep the sign with its term: ${fmt(a)}${v} + ${c}${v}.` },
      { m: a + c, k: b + d, key: 'lost_negative', message: `The ${d} is SUBTRACTED: ${b} − ${d}.` },
      { m: a + c + b - d, k: 0, key: 'combine_unlike', message: `Plain numbers cannot be combined with ${v}-terms.` }].filter((tr) => a < 0 || tr.m !== Math.abs(a) + c || tr.k !== b - d) });
  }
  if (form === 'sub') {                // 7x − (2x + 5)
    const a = int(rnd, 5, 9), c = int(rnd, 2, 4), d = nz(rnd, -6, 6);
    return make(`${a}${v} − (${sum([c, v], [d, ''])})`, a - c, -d, { prop: 'D', traps: [
      { m: a - c, k: d, key: 'subtract_group', message: `The minus sign is for the WHOLE group: subtracting (${sum([c, v], [d, ''])}) changes the sign of the ${fmt(d)} too.` },
      { m: a + c, k: -d, key: 'subtract_group', message: `The ${c}${v} inside the group is subtracted.` }] });
  }
  if (form === 'dec') {                // 0.5(4x − 6)
    const [a, c] = pick(rnd, [[0.5, 4], [0.5, 6], [1.5, 2], [2.5, 2], [0.25, 8]]), b = pick(rnd, [-8, -4, 4, 8]);
    return make(`${fmt(a)}(${sum([c, v], [b, ''])})`, a * c, a * b, { prop: 'D', traps: [
      { m: a * c, k: b, key: 'first_term_only', message: `${fmt(a)} multiplies BOTH terms inside.` },
      { m: c, k: a * b, key: 'first_term_only', message: `${fmt(a)} multiplies the ${c}${v} as well.` }] });
  }
  if (form === 'frac') {               // 2/3(9x − 6)
    const [n, d, c] = pick(rnd, [[1, 2, 6], [2, 3, 9], [3, 4, 8], [1, 3, 6], [2, 5, 10]]), b = d * nz(rnd, -3, 3);
    return make(`${n}/${d}(${sum([c, v], [b, ''])})`, (n * c) / d, (n * b) / d, { prop: 'D', traps: [
      { m: (n * c) / d, k: b, key: 'first_term_only', message: `${n}/${d} multiplies BOTH terms inside.` },
      { m: c, k: (n * b) / d, key: 'first_term_only', message: `${n}/${d} multiplies the ${c}${v} as well.` }] });
  }
  const m = nz(rnd, -4, 5), k = nz(rnd, -8, 9);      // hidden: only its planks can be seen
  return make('? ? ?', m, k, { hidden: true, tests: 3, prop: null, traps: [] });
}
/** The twin the student built:  m·x + k. */
export function checkBuild(p, m, k) {
  const A = p.A, mine = ex(plain(m, k, p.v), m, k), base = { mine, agree: agreeAt(A, mine) };
  if (same(A, mine)) return { ok: true, key: 'correct', ...base, property: p.prop ? PROPS[p.prop] : null, message: `${p.hidden ? 'The hidden bridge is' : `${A.text} =`} ${mine.text}: twins at every post.` };
  const no = (key, message) => ({ ok: false, key, ...base, message });
  const trap = p.traps.find((t) => near(t.m, m) && near(t.k, k));
  if (trap) return no(trap.key, trap.message);
  if (near(m, A.m)) return no('number_part', `Your bridge runs beside the other one and never meets it, always ${fmt(Math.abs(k - A.k))} ${k > A.k ? 'too high' : 'too low'}. The ${p.v}-part is right: check the number part.`);
  if (near(k, A.k)) return no('x_part', `Your bridge meets the other one only at ${p.v} = 0. The number part is right: check the ${p.v}-part.`);
  return no('off', p.hidden ? `Look at the plank at ${p.v} = 0: that is the number part. Then see how much the planks rise from one post to the next.` : 'Your bridge splits from the other one. Work out the number part and the part with the letter one at a time.');
}
export const buildAnswer = (p) => `${p.hidden ? 'The hidden bridge was' : `${p.A.text} =`} ${plain(p.A.m, p.A.k, p.v)}.`;

/* ================================================================== */
/* Chain: a worked simplification with one wrong step                  */
/* ================================================================== */
/** lines[0] is the start; each line should be a twin of the one before. bad: the first line that is not. */
export function genChain(rnd, slip = pick(rnd, ['distribute', 'reorder', 'combine'])) {
  const v = pick(rnd, VARS), a = pick(rnd, [-2, -3, 2, 3, 4]), b = nz(rnd, -5, 5), c = int(rnd, 2, 5), d = int(rnd, 1, 6);
  const right = { m: a + c, k: a * b - d };
  const line = (text, m, k) => ex(text, m, k);
  const L0 = line(`${paren(a, v, b)} + ${c}${v} − ${d}`, right.m, right.k);
  let kb = a * b, mc = c, kd = -d, key, why;             // the pieces as the (possibly wrong) work carries them
  if (slip === 'distribute') { kb = b; key = 'first_term_only'; why = `${fmt(a)} multiplies BOTH terms: ${fmt(a)} × ${fmt(b)} = ${fmt(a * b)}, not ${fmt(b)}.`; }
  const L1 = line(sum([a, v], [kb, ''], [mc, v], [kd, '']), a + mc, kb + kd);
  if (slip === 'reorder') { kd = d; key = 'lost_negative'; why = `The ${d} was subtracted. Its minus sign has to travel with it when the terms are reordered.`; }
  const L2 = line(sum([a, v], [mc, v], [kb, ''], [kd, '']), a + mc, kb + kd);
  let L3 = line(plain(a + mc, kb + kd, v), a + mc, kb + kd);
  if (slip === 'combine') { L3 = line(term(a + mc + kb + kd, v), a + mc + kb + kd, 0); key = 'combine_unlike'; why = `Plain numbers cannot be combined with ${v}-terms: ${fmt(a)}${v} + ${c}${v} is ${fmt(a + c)}${v}, and ${fmt(a * b)} − ${d} is ${fmt(a * b - d)}.`; }
  const lines = [L0, L1, L2, L3], bad = lines.findIndex((l, i) => i > 0 && !same(l, lines[i - 1]));
  if (bad < 0 || near(right.m, 0) || lines.some((l) => l.text.length > 22) || same(lines[3], L0)) return genChain(rnd, slip);
  return { id: nextId++, type: 'chain', v, lines, bad, slip, key, why, A: L0, walks: 3, traps: [{ m: lines[3].m, k: lines[3].k, key, message: `That is the same as the wrong last line. ${why}` }], prop: 'L' };
}
/** What each line of the chain gives at a post, and the first line where the value changes (-1: it never does there). */
export function walkChain(p, x) {
  const values = p.lines.map((l) => valueOf(l, x)), falls = values.findIndex((val, i) => i > 0 && !near(val, values[i - 1]));
  return { values, falls };
}
/** The student tapped the step into line i as the wrong one. */
export function checkSpan(p, i) {
  if (i === p.bad) return { ok: true, key: 'correct', message: `That is the wrong step. ${p.why} Now build the right last line.` };
  return { ok: false, key: 'wrong_span', message: 'That step is fine: the two lines it joins are twins. Walk a post and watch where the number changes.' };
}
export const chainAnswer = (p) => `The wrong step is the one into line ${p.bad + 1}. ${p.why}`;

/* ================================================================== */
/* Zones                                                               */
/* ================================================================== */
export const ZONES = [
  { name: 'Test the Bridges', blurb: 'Choose posts to test, then call it: twins or not?' },
  { name: 'Rafts on the River', blurb: 'Hook every twin as it floats past' },
  { name: 'Build the Twin', blurb: 'Set the dials, then send the hiker' },
  { name: 'The Broken Span', blurb: 'One step is wrong: find it and fix it' },
  { name: 'The Flood Crossing', blurb: 'Boss: decimals, fractions, groups and a hidden bridge' },
];
/** The rounds of a zone, in order. */
export function genZone(rnd, zone) {
  if (zone === 0) return [genTest(rnd, { eq: true }), genTest(rnd, { eq: false }), genTest(rnd, { lucky: true }), ...shuffle(rnd, [genTest(rnd, { eq: true }), genTest(rnd, { lucky: true }), genTest(rnd, { eq: false })])];
  if (zone === 1) return shuffle(rnd, ['dist', 'collect', 'assoc']).map((f) => genRaft(rnd, f));
  if (zone === 2) return [genBuild(rnd, 'assoc'), genBuild(rnd, 'dist'), genBuild(rnd, 'distNeg'), genBuild(rnd, 'combine'), genBuild(rnd, 'distNeg'), genBuild(rnd, 'combine')];
  if (zone === 3) return shuffle(rnd, ['distribute', 'reorder', 'combine']).map((s) => genChain(rnd, s));
  return [genBuild(rnd, 'sub'), genBuild(rnd, pick(rnd, ['dec', 'frac'])), genBuild(rnd, 'hidden'), genChain(rnd), genBuild(rnd, 'sub')];
}
