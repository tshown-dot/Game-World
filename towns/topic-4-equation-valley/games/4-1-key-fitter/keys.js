// Lesson 4-1 "Key Fitter": the math behind the locks and keys.
// enVision 2.0 Grade 6, Topic 4, Lesson 4-1: Understand Equations and Solutions (6.EE.B.5).
//
// No screen code here: lock generators, substituting a key into an equation, answer checking and
// misconception feedback. Every generator takes `rnd` (returns 0 to 1) so tests can repeat a run.
//
// The game is an action game: the student HOLDS a key (a number) and locks (equations) roll past on a belt.
// They tap every lock the key opens. Later they choose keys themselves (a "ring"), forge a lock for a key,
// and work out a mystery lock from what their test keys make.
//
// A lock is an equation with one variable. Kinds:
//   add      x + a = c          sub      x − a = c          subFrom  a − x = c
//   mul      k·x = c            divBy    a ÷ x = c          divOf    x ÷ k = c
//   two      k·x + a = c   (boss)
// Each lock comes with 4 keys (values). Wrong keys come from real mistakes, so the hint can name the mistake.

export const VARS = ['x', 'n', 'd', 'm', 'g', 'y', 't', 'r', 'b', 'h', 'p', 'c'];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ri = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
const shuffle = (rnd, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const r2 = (v) => Math.round(v * 100) / 100;            // money and tenths stay exact
const same = (p, q) => Math.abs(p - q) < 1e-9;
let nextId = 1;
const id = () => `k${nextId++}`;

/** "4.3", "12", "$4.10" */
export function fmt(v, money = false) {
  if (money) return `$${r2(v).toFixed(2)}`;
  const t = r2(v);
  return Number.isInteger(t) ? String(t) : String(t);
}

/** Accepts "12", " 12 ", "12.5", "$4.10", "4.10". Returns null for blanks, negatives, or more than 2 decimals. */
export function parseNumber(raw) {
  const t = String(raw ?? '').trim().replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(t)) return null;
  return Number(t);
}

/* ------------------------------------------------------------------ */
/* Locks: text, evaluation, substitution                               */
/* ------------------------------------------------------------------ */
export function leftValue(lock, v) {
  const { kind, a, k } = lock;
  switch (kind) {
    case 'add': return r2(v + a);
    case 'sub': return r2(v - a);
    case 'subFrom': return r2(a - v);
    case 'mul': return r2(k * v);
    case 'divBy': return v === 0 ? NaN : r2(a / v);
    case 'divOf': return r2(v / k);
    case 'two': return r2(k * v + a);
    default: throw new Error(`unknown lock ${kind}`);
  }
}

function sideText(lock, v) {                    // v = null shows the letter
  const { kind, a, k, x, money } = lock;
  const val = v === null ? x : fmt(v, money);
  const A = fmt(a, money);
  switch (kind) {
    case 'add': return `${val} + ${A}`;
    case 'sub': return `${val} − ${A}`;
    case 'subFrom': return `${A} − ${val}`;
    case 'mul': return v === null ? `${k}${x}` : `${k} × ${val}`;
    case 'divBy': return `${A} ÷ ${val}`;
    case 'divOf': return `${val} ÷ ${k}`;
    case 'two': return v === null ? `${k}${x} + ${A}` : `${k} × ${val} + ${A}`;
    default: return '';
  }
}

/** The lock as students see it, e.g. "d + 9 = 35" or "4 = 36 ÷ m". */
export function lockText(lock) {
  const left = sideText(lock, null), right = fmt(lock.c, lock.money);
  return lock.flip ? `${right} = ${left}` : `${left} = ${right}`;
}

/** Put a key into the lock: "16 + 9 = 25 ≠ 35" or "6 × 4 + 5 = 29 = 29". */
export function substitute(lock, v) {
  const left = leftValue(lock, v);
  const equal = same(left, lock.c);
  const work = lock.kind === 'two'
    ? `${sideText(lock, v)} = ${fmt(r2(lock.k * v), lock.money)} + ${fmt(lock.a, lock.money)} = ${fmt(left, lock.money)}`
    : `${sideText(lock, v)} = ${Number.isNaN(left) ? '?' : fmt(left, lock.money)}`;
  const text = `${work} ${equal ? '=' : '≠'} ${fmt(lock.c, lock.money)}`;
  return { left, equal, text };
}

/* ------------------------------------------------------------------ */
/* Lock generators                                                     */
/* ------------------------------------------------------------------ */
const ok = (v) => Number.isFinite(v) && v > 0;
/** Keys look like the lock: whole numbers for whole-number locks, tenths for decimal locks, cents for money. */
const styleOk = (lock, v) => lock.money ? same(r2(v), v) : lock.decimal ? same(Math.round(v * 10) / 10, v) : Number.isInteger(v);

/** Builds the 4 keys: the solution (unless noKey) plus tagged wrong keys. */
function withKeys(rnd, lock, candidates, noKey) {
  const s = lock.solution;
  const pool = [];
  const seen = new Set([r2(s)]);
  for (const [value, tag] of candidates) {
    const v = r2(value);
    if (!ok(v) || !styleOk(lock, v) || seen.has(v) || same(leftValue(lock, v), lock.c)) continue;
    seen.add(v); pool.push({ value: v, tag });
  }
  const step = lock.money ? 0.5 : lock.decimal ? 1 : 1;
  for (const d of shuffle(rnd, [step, -step, 2 * step, -2 * step, 3 * step, 4 * step])) {
    const v = r2(s + d);
    if (ok(v) && styleOk(lock, v) && !seen.has(v) && !same(leftValue(lock, v), lock.c)) { seen.add(v); pool.push({ value: v, tag: 'near_miss' }); }
  }
  const wrong = pool.slice(0, noKey ? 4 : 3);
  const keys = noKey ? wrong : [{ value: r2(s), tag: 'correct' }, ...wrong];
  return { ...lock, id: id(), noKey, keys: shuffle(rnd, keys), answer: noKey ? 'none' : r2(s) };
}

export function genLock(rnd, kind, { money = false, decimal = false, noKey = false } = {}) {
  const x = pick(rnd, VARS);
  const flip = rnd() < 0.25;
  const unit = money ? 0.05 : decimal ? 0.1 : 1;
  const num = (lo, hi) => r2(ri(rnd, Math.round(lo / unit), Math.round(hi / unit)) * unit);
  let lock, cands;
  switch (kind) {
    case 'add': {
      const s = money ? num(1, 9) : decimal ? num(1, 12) : ri(rnd, 4, 40), a = money ? num(1, 9) : decimal ? num(1, 12) : ri(rnd, 3, 30);
      lock = { kind, x, a, c: r2(s + a), solution: s };
      cands = [[lock.c + a, 'forward_op'], [lock.c, 'answer_as_key'], [a, 'used_the_number']];
      break;
    }
    case 'sub': {
      const a = money ? num(1, 9) : decimal ? num(1, 12) : ri(rnd, 3, 25), cc = money ? num(1, 9) : decimal ? num(1, 12) : ri(rnd, 3, 30);
      lock = { kind, x, a, c: cc, solution: r2(cc + a) };
      cands = [[cc - a, 'forward_op'], [cc, 'answer_as_key'], [a, 'used_the_number']];
      break;
    }
    case 'subFrom': {
      const a = money ? num(5, 20) : decimal ? num(8, 20) : ri(rnd, 20, 60);
      const s = money ? num(1, a - 1) : decimal ? num(1, a - 2) : ri(rnd, 3, a - 3);
      lock = { kind, x, a, c: r2(a - s), solution: s };
      cands = [[a + lock.c, 'forward_op'], [lock.c, 'answer_as_key'], [s + 1, 'place_value'], [s - 1, 'place_value']];
      if (decimal || money) cands.splice(2, 0, [s + (money ? 0.1 : 1), 'place_value']);
      break;
    }
    case 'mul': {
      const k = ri(rnd, 2, 14);
      const s = decimal ? r2(ri(rnd, 2, 9) + 0.5) : ri(rnd, 2, 12);
      if (decimal && (k * s) % 1 !== 0) return genLock(rnd, kind, { money, decimal, noKey });
      lock = { kind, x, k, c: r2(k * s), solution: s };
      cands = [[lock.c * k, 'forward_op'], [lock.c, 'answer_as_key'], [lock.c - k, 'add_sub_instead']];
      break;
    }
    case 'divBy': {
      const s = ri(rnd, 2, 12), cc = ri(rnd, 2, 12);
      lock = { kind, x, a: s * cc, c: cc, solution: s };
      cands = [[lock.a * cc, 'forward_op'], [cc, 'answer_as_key'], [lock.a - cc, 'add_sub_instead']];
      break;
    }
    case 'divOf': {
      const k = ri(rnd, 2, 9), cc = ri(rnd, 2, 12);
      lock = { kind, x, k, c: cc, solution: k * cc };
      cands = [[cc % k === 0 ? cc / k : cc + k, cc % k === 0 ? 'forward_op' : 'add_sub_instead'], [cc, 'answer_as_key'], [cc + k, 'add_sub_instead']];
      break;
    }
    case 'two': {
      const k = ri(rnd, 2, 9), s = ri(rnd, 2, 10), a = ri(rnd, 2, 20);
      lock = { kind, x, k, a, c: k * s + a, solution: s };
      cands = [[(lock.c - a), 'forgot_divide'], [lock.c / k - a, 'wrong_order'], [(lock.c + a) / k, 'forward_op'], [lock.c / k, 'ignored_part']];
      break;
    }
    default: throw new Error(`unknown kind ${kind}`);
  }
  lock.money = money; lock.decimal = decimal || money || !Number.isInteger(lock.solution); lock.flip = flip;
  return withKeys(rnd, lock, cands, noKey);
}

/** A word problem lock (gift card style): price p so that spent + p = card. Always money. */
export function genWordLock(rnd) {
  const card = pick(rnd, [10, 15, 20, 25, 30]);
  const spent = r2(ri(rnd, 10, card * 10 - 20) / 10 + pick(rnd, [0, 0.25, 0.5]));
  if (spent >= card - 1) return genWordLock(rnd);
  const lock = genLock(rnd, 'add', { money: true });
  const s = r2(card - spent);
  const fixed = { ...lock, x: 'p', a: spent, c: card, solution: s, flip: false, money: true, decimal: true };
  const out = withKeys(rnd, fixed, [[card + spent, 'forward_op'], [card, 'answer_as_key'], [spent, 'used_the_number']], false);
  out.story = `A ${fmt(card, true)} gift card has ${fmt(spent, true)} used. Which app price p uses up the rest?`;
  return out;
}

/* ------------------------------------------------------------------ */
/* Forge a lock (boss): build an equation that the given key opens    */
/* ------------------------------------------------------------------ */
/** ops: the operations allowed (the second forge must use × or ÷). */
export function genForge(rnd, ops = null) {
  return { id: id(), type: 'forge', value: pick(rnd, [6, 8, 9, 10, 12, 15, 18, 20]), x: 'x', ops };
}
/** op is '+', '-', '×' or '÷'; a and c are numbers. The lock is  x op a = c. */
export function checkForge(problem, op, a, c) {
  const v = problem.value;
  if (a === null || c === null) return { correct: false, key: 'incomplete', message: 'Fill in both numbers to forge your lock.' };
  if (problem.ops && !problem.ops.includes(op)) return { correct: false, key: 'forge_op', message: `This lock has to use ${problem.ops.join(' or ')}.` };
  if ((op === '×' || op === '÷') && a === 0) return { correct: false, key: 'zero', message: 'Multiplying or dividing by 0 does not make a good lock. Pick another number.' };
  if ((op === '+' || op === '-') && a === 0) return { correct: false, key: 'zero', message: `x ${op === '+' ? '+' : '−'} 0 = x is too easy. Use a number other than 0.` };
  const kind = { '+': 'add', '-': 'sub', '×': 'mul', '÷': 'divOf' }[op];
  const lock = kind === 'mul' ? { kind, k: a, c, x: 'x' } : kind === 'divOf' ? { kind, k: a, c, x: 'x' } : { kind, a, c, x: 'x' };
  const left = leftValue(lock, v);
  const shown = `${sideText({ ...lock, money: false }, v)} = ${fmt(left)}`;
  if (same(left, c)) return { correct: true, key: 'correct', message: `It opens! ${shown}, so ${v} is a solution of ${lockText({ ...lock, money: false })}.`, lock };
  return { correct: false, key: 'forge_wrong', message: `Test your lock with the key ${v}: ${shown}, not ${fmt(c)}. Make the right side ${fmt(left)}.`, lock };
}

/* ------------------------------------------------------------------ */
/* Belts: one key, a line of locks. Which ones does the key open?      */
/* ------------------------------------------------------------------ */
/** A lock that the key b opens. Returns null when that kind cannot be made for this key. */
function openLock(rnd, b, kind, style) {
  const amount = () => (style === 'money' ? ri(rnd, 2, 30) * 0.25 : style === 'decimal' ? r2(ri(rnd, 11, 95) / 10) : ri(rnd, 2, 20));
  switch (kind) {
    case 'add': { const a = amount(); return { kind, a, c: r2(b + a) }; }
    case 'sub': { if (style !== 'whole') { const a = r2(b / 2 + (style === 'money' ? 0.25 : 0.1)); return a < b ? { kind, a, c: r2(b - a) } : null; } return b > 2 ? ((a) => ({ kind, a, c: b - a }))(ri(rnd, 1, b - 1)) : null; }
    case 'subFrom': { const a = r2(b + amount()); return { kind, a, c: r2(a - b) }; }
    case 'mul': { const k = style === 'whole' ? ri(rnd, 2, 9) : pick(rnd, [2, 4, 6, 10]); return { kind, k, c: r2(k * b) }; }
    case 'divBy': { const cc = ri(rnd, 2, 9); return Number.isInteger(b) ? { kind, a: b * cc, c: cc } : null; }
    case 'divOf': { const ks = [2, 3, 4, 5, 6].filter((k) => Number.isInteger(b) && b % k === 0 && b / k >= 2); return ks.length ? ((k) => ({ kind, k, c: b / k }))(pick(rnd, ks)) : null; }
    case 'two': { const k = ri(rnd, 2, 6), a = ri(rnd, 2, 15); return Number.isInteger(b) ? { kind, k, a, c: k * b + a } : null; }
    default: throw new Error(`unknown kind ${kind}`);
  }
}
/**
 * A lock the key b does NOT open, built from a real mistake:
 *   near_miss (one or two off)        wrong_op (the answer you get by doing the wrong operation)
 *   answer_as_key (b is the number on the other side)   used_the_number (b is the number already in the lock)
 *   concatenation (3x read as the digits 3 and b)       forgot_part (two-step: skipped the + or the ×)
 */
function trapLock(rnd, b, kind, style, trap) {
  const base = openLock(rnd, b, kind, style);
  if (!base) return null;
  const off = (style === 'money' ? 0.25 : style === 'decimal' ? 0.1 : 1) * pick(rnd, [1, -1, 2, -2]);
  const whole = style === 'whole', other = whole ? b + pick(rnd, [1, 2, 3, -1]) : r2(b + pick(rnd, [0.5, 1, 1.5]));
  let lock = null;
  if (trap === 'near_miss') lock = { ...base, c: r2(base.c + off) };
  if (trap === 'wrong_op') {
    if (kind === 'add') lock = { ...base, c: r2(b - base.a) };
    if (kind === 'sub') lock = { ...base, c: r2(b + base.a) };
    if (kind === 'subFrom') lock = { ...base, c: r2(base.a + b) };
    if (kind === 'mul') lock = { ...base, c: r2(base.k + b) };
    if (kind === 'divBy') lock = { ...base, c: base.a - b };
    if (kind === 'divOf') lock = { ...base, c: b * base.k };
  }
  if (trap === 'answer_as_key') {
    if (kind === 'add' || kind === 'sub') lock = { ...base, c: b };
    if (kind === 'subFrom') lock = { kind, a: r2(b + other), c: b };
    if (kind === 'mul') lock = { ...base, c: b };
    if (kind === 'divBy' && whole) lock = { kind, a: b * (other > 1 ? other : b + 1), c: b };
    if (kind === 'divOf') lock = { ...base, c: b };
  }
  if (trap === 'used_the_number') {
    if (kind === 'add') lock = { kind, a: b, c: r2(other + b) };
    if (kind === 'sub') lock = { kind, a: b, c: r2(other) };
    if (kind === 'subFrom' && b > 1) lock = { kind, a: b, c: whole ? ri(rnd, 1, b - 1) : r2(b / 2 - 0.5) };
    if (kind === 'mul' && whole) lock = { kind, k: b, c: b * other };
    if (kind === 'divOf' && whole) lock = { kind, k: b, c: ri(rnd, 2, 9) };
  }
  if (trap === 'concatenation' && kind === 'mul' && whole) lock = { ...base, c: Number(`${base.k}${b}`) };
  if (trap === 'forgot_part' && kind === 'two') lock = { ...base, c: pick(rnd, [base.k * b, base.k * (b + base.a), b + base.a]) };
  if (!lock || !(lock.c > 0) || !Number.isFinite(lock.c)) return null;
  if (lock.a !== undefined && !(lock.a > 0)) return null;
  const left = leftValue({ ...lock }, b);
  return same(left, lock.c) ? null : { ...lock, trap };
}
const TRAPS = {
  add: ['near_miss', 'wrong_op', 'answer_as_key', 'used_the_number'], sub: ['near_miss', 'wrong_op', 'answer_as_key', 'used_the_number'],
  subFrom: ['near_miss', 'wrong_op', 'answer_as_key', 'used_the_number'], mul: ['concatenation', 'wrong_op', 'near_miss', 'used_the_number', 'answer_as_key'],
  divBy: ['near_miss', 'wrong_op', 'answer_as_key'], divOf: ['wrong_op', 'near_miss', 'answer_as_key', 'used_the_number'], two: ['forgot_part', 'near_miss'],
};
/**
 * A belt: { value (the key), money, decimal, locks: [{ ...lock, opens, trap }] }.
 *   kinds   the lock kinds to use      opens   how many of the locks the key opens (0 is allowed: no lock opens)
 *   style   'whole', 'decimal' (4.5) or 'money' ($2.75)
 */
export function genBelt(rnd, { kinds, count = 6, opens = 2, style = 'whole' } = {}) {
  const value = style === 'money' ? ri(rnd, 6, 36) * 0.25 : style === 'decimal' ? ri(rnd, 2, 9) + 0.5 : ri(rnd, 3, 12);
  const flags = shuffle(rnd, Array.from({ length: count }, (_, i) => i < opens));
  const locks = [], texts = new Set();
  let trapAt = Math.floor(rnd() * 5);
  for (let i = 0, guard = 0; i < count && guard < 400; guard++) {
    const kind = pick(rnd, kinds);
    const spec = flags[i] ? openLock(rnd, value, kind, style) : trapLock(rnd, value, kind, style, TRAPS[kind][trapAt++ % TRAPS[kind].length]);
    if (!spec) continue;
    const lock = { ...spec, x: pick(rnd, VARS), money: style === 'money', decimal: style !== 'whole', flip: rnd() < 0.2, id: id() };
    lock.opens = same(leftValue(lock, value), lock.c);
    const text = lockText(lock);
    if (lock.opens !== flags[i] || texts.has(text) || text.length > 19) continue;
    texts.add(text); locks.push(lock); i++;
  }
  return { id: id(), type: 'belt', value, money: style === 'money', decimal: style !== 'whole', locks };
}
/**
 * What went wrong on the belt, or null when the student was right.
 *   tapped: they tried the key in this lock; otherwise they let it roll past.
 */
/** Every lock on a belt needs a decision. action: 'fit' (try the key), 'reject', or 'none' (it reached the OUT box undecided). null = right. */
export function checkLock(belt, lock, action) {
  const s = substitute(lock, belt.value), fits = s.text.replace(/ = \S+$/, ' ✓');      // "11 − 5 = 6 ✓" rather than "11 − 5 = 6 = 6"
  if (action === 'fit') return checkTap(belt, lock, true);
  if (action === 'reject') return lock.opens ? { key: 'missed_open', message: `Your key opened that one: ${fits}. Put the key in for ${lock.x} and work out the side before you reject a lock.` } : null;
  return { key: 'too_slow', message: lock.opens ? `Too slow. Your key opened that one: ${fits}.` : `Too slow. That one was a REJECT: ${s.text}.` };
}
export function checkTap(belt, lock, tapped) {
  if (tapped === lock.opens) return null;
  const v = fmt(belt.value, belt.money), s = substitute(lock, belt.value);
  if (!tapped) return { key: 'missed_open', message: `Your key opened that one: ${s.text}. Put the key in for ${lock.x} and work out the side.` };
  const message = {
    near_miss: `Close, but ${s.text}. Both sides must be exactly equal.`,
    wrong_op: `Check the operation in the lock: ${s.text}.`,
    answer_as_key: `${v} is already on the other side of the lock. The key goes in for ${lock.x}: ${s.text}.`,
    used_the_number: `${v} is a number already in the lock, but the key replaces ${lock.x}: ${s.text}.`,
    concatenation: `${lock.k}${lock.x} means ${lock.k} × ${lock.x}, not the digits ${lock.k} and ${v} side by side: ${s.text}.`,
    forgot_part: `Do every step: ${s.text}.`,
  }[lock.trap] || `${s.text}. Both sides must be equal.`;
  return { key: lock.trap || 'near_miss', message };
}

/* ------------------------------------------------------------------ */
/* Key ring: the student chooses a key for one lock                    */
/* ------------------------------------------------------------------ */
/**
 * A ring round: { lock, strip: { lo, hi, step }, tries, order, story? }.
 *   order 'open' = find the key that opens it     'jam' = cut a key that does NOT open it
 *   Test keys are free; the last try has to be right.
 */
export function genRing(rnd, kind, { order = 'open', tries = 3 } = {}) {
  const lock = genLock(rnd, kind);
  if (lock.solution > 150) return genRing(rnd, kind, { order, tries });
  const lo = Math.max(0, lock.solution - ri(rnd, 4, 15));
  return { id: id(), type: 'ring', lock, strip: { lo, hi: lo + 20, step: 1 }, tries, order };
}
/** A gift card story: spent + p = card. The strip is in half dollars. */
export function genStoryRing(rnd) {
  const card = pick(rnd, [10, 15, 20, 25]), spent = ri(rnd, 3, card * 2 - 4) / 2, s = card - spent;
  const lock = { kind: 'add', x: 'p', a: spent, c: card, solution: s, money: true, decimal: true, flip: false, id: id() };
  const lo = Math.max(0.5, s - ri(rnd, 2, 7) / 2 - 1);
  return { id: id(), type: 'ring', lock, strip: { lo, hi: lo + 10, step: 0.5 }, tries: 3, order: 'open', story: `A ${fmt(card, true)} gift card has ${fmt(spent, true)} used. Which price p uses up the rest?` };
}
/** A mystery lock: the student only sees what the lock needs. Each test key shows what that key makes. */
export function genMystery(rnd) {
  const kind = pick(rnd, ['add', 'mul']);
  const lock = kind === 'add'
    ? ((a, s) => ({ kind, a, c: s + a, solution: s }))(ri(rnd, 3, 15), ri(rnd, 3, 17))
    : ((k, s) => ({ kind, k, c: k * s, solution: s }))(ri(rnd, 2, 5), ri(rnd, 3, 12));
  return { id: id(), type: 'mystery', lock: { ...lock, x: 'x', money: false, decimal: false, flip: false, id: id() }, strip: { lo: 0, hi: 20, step: 1 }, tries: 4, order: 'open' };
}
/**
 * Try a key in a ring or mystery lock. Returns { ok, text, message }.
 *   text: what the key makes ("9 + 8 = 17 ≠ 15", or "key 5 makes 17" for a mystery lock).
 */
export function checkTry(round, v) {
  const { lock } = round, s = substitute(lock, v), val = fmt(v, lock.money), need = fmt(lock.c, lock.money);
  if (round.type === 'mystery') {
    const text = `Key ${val} makes ${fmt(s.left)}`;
    return { ok: s.equal, text, message: s.equal ? `${text}. That is what the lock needs!` : `${text}. The lock needs ${need}. What is the machine doing to your key?` };
  }
  if (round.order === 'jam') return { ok: !s.equal, text: s.text, message: s.equal ? `That key opens it: ${s.text}. Cut one that makes the two sides different.` : `${s.text}. It jams: ${val} is not a solution.` };
  return { ok: s.equal, text: s.text, message: s.equal ? `${s.text}. ${val} is the solution.` : `${s.text}. The ${lock.flip ? 'right' : 'left'} side came out too ${s.left > lock.c ? 'big' : 'small'}.` };
}

/* ------------------------------------------------------------------ */
/* Zones                                                               */
/* ------------------------------------------------------------------ */
export const ZONES = [
  { name: 'Front Door', blurb: 'Adding and subtracting locks' },
  { name: 'Gear Locks', blurb: 'Multiplying and dividing locks' },
  { name: 'Cash Vault', blurb: 'Decimal and money keys' },
  { name: 'Key Ring', blurb: 'Your turn: find the key yourself' },
  { name: 'The Locksmith', blurb: 'Boss: two steps, forge a lock, a mystery lock' },
];
/** The rounds of a zone, in order. Each is a belt, a ring, a forge or a mystery. */
export function genZone(rnd, zone) {
  if (zone === 0) return shuffle(rnd, [2, 3, 1]).map((opens) => genBelt(rnd, { kinds: ['add', 'sub', 'subFrom'], opens }));
  if (zone === 1) return shuffle(rnd, [3, 0, 2]).map((opens) => genBelt(rnd, { kinds: ['mul', 'divBy', 'divOf', 'mul'], opens }));
  if (zone === 2) return [genBelt(rnd, { kinds: ['add', 'sub', 'subFrom', 'mul'], opens: 2, style: 'decimal' }), ...shuffle(rnd, [0, 2]).map((opens) => genBelt(rnd, { kinds: ['add', 'sub', 'subFrom'], opens, style: 'money', count: 5 }))];
  if (zone === 3) return [genRing(rnd, 'add'), genRing(rnd, pick(rnd, ['sub', 'subFrom'])), genRing(rnd, 'mul'), genRing(rnd, 'divOf'), genRing(rnd, pick(rnd, ['add', 'mul']), { order: 'jam', tries: 1 })];
  return [genBelt(rnd, { kinds: ['two', 'two', 'mul', 'add'], opens: 2 }), genStoryRing(rnd), genForge(rnd), genForge(rnd, ['×', '÷']), genMystery(rnd), genMystery(rnd)];
}
