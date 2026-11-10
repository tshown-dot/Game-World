// Lesson 4-1 "Key Fitter": the math behind the locks and keys.
// enVision 2.0 Grade 6, Topic 4, Lesson 4-1: Understand Equations and Solutions (6.EE.B.5).
//
// No screen code here: lock generators, substituting a key into an equation, answer checking and
// misconception feedback. Every generator takes `rnd` (returns 0 to 1) so tests can repeat a run.
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
/* Master Key rounds (zone 4): one key value, four locks: which open? */
/* ------------------------------------------------------------------ */
export function genMasterKey(rnd) {
  const b = ri(rnd, 2, 9);
  const x = pick(rnd, VARS);
  const builders = [
    () => { const a = ri(rnd, 2, 30); return { kind: 'add', a, c: b + a }; },
    () => { const a = ri(rnd, 2, b - 1 > 1 ? b - 1 : 1); return b > 2 ? { kind: 'sub', a, c: b - a } : { kind: 'add', a: 5, c: b + 5 }; },
    () => { const k = ri(rnd, 2, 9); return { kind: 'mul', k, c: k * b }; },
    () => { const cc = ri(rnd, 2, 9); return { kind: 'divBy', a: b * cc, c: cc }; },
  ];
  const traps = [
    () => { const k = ri(rnd, 2, 9); return { kind: 'mul', k, c: Number(`${k}${b}`), trap: 'concatenation' }; },
    () => { const a = ri(rnd, 2, 20); return { kind: 'add', a, c: b + a + pick(rnd, [1, -1, 2]), trap: 'near_miss' }; },
    () => { const a = ri(rnd, 2, 9); return { kind: 'sub', a, c: b + a, trap: 'forward_op' }; },
    () => { const k = ri(rnd, 2, 9); return { kind: 'mul', k, c: k + b, trap: 'add_sub_instead' }; },
  ];
  const nTrue = ri(rnd, 1, 3);
  const locks = [];
  for (let i = 0; i < 4; i++) {
    const spec = i < nTrue ? pick(rnd, builders)() : pick(rnd, traps)();
    const lock = { ...spec, x, money: false, decimal: false, flip: rnd() < 0.2, id: id() };
    lock.opens = same(leftValue(lock, b), lock.c);
    if (spec.c <= 0 || (i < nTrue && !lock.opens) || (i >= nTrue && lock.opens)) { i--; continue; }
    locks.push(lock);
  }
  return { id: id(), type: 'master', value: b, x, locks: shuffle(rnd, locks) };
}

/* ------------------------------------------------------------------ */
/* Forge a lock (boss): build an equation that the given key opens    */
/* ------------------------------------------------------------------ */
export function genForge(rnd) {
  return { id: id(), type: 'forge', value: pick(rnd, [6, 8, 9, 10, 12, 15, 18, 20]), x: 'x' };
}
/** op is '+', '-', '×' or '÷'; a and c are numbers. The lock is  x op a = c. */
export function checkForge(problem, op, a, c) {
  const v = problem.value;
  if (a === null || c === null) return { correct: false, key: 'incomplete', message: 'Fill in both numbers to forge your lock.' };
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
/* A full run                                                          */
/* ------------------------------------------------------------------ */
export const ZONES = [
  { name: 'Front Door', blurb: 'Adding and subtracting locks' },
  { name: 'Gear Locks', blurb: 'Multiplying and dividing locks' },
  { name: 'Cash Vault', blurb: 'Decimals and money' },
  { name: 'Master Key', blurb: 'One key, four locks: which ones open?' },
  { name: 'The Locksmith', blurb: 'Boss: two-step locks, word problems, forge a lock' },
];

/** About 1 lock in 6 has no fitting key: 2 of the 12 key locks in zones 1-3, placed at random. */
export function genRun(rnd) {
  const noKeyAt = new Set(shuffle(rnd, [...Array(12).keys()]).slice(0, 2));
  let n = 0;
  const nk = () => noKeyAt.has(n++);
  const zone1 = ['add', 'sub', 'add', 'sub'].map((k) => genLock(rnd, k, { noKey: nk() }));
  const zone2 = shuffle(rnd, ['mul', 'divBy', 'divOf', 'mul']).map((k, i) => genLock(rnd, k, { decimal: k === 'mul' && i === 3, noKey: nk() }));
  const zone3 = ['add', 'subFrom', 'sub', 'subFrom'].map((k, i) => genLock(rnd, k, { money: i % 2 === 1, decimal: i % 2 === 0, noKey: nk() }));
  const zone4 = [genMasterKey(rnd), genMasterKey(rnd)];
  const zone5 = [genLock(rnd, 'two'), genWordLock(rnd), genForge(rnd), genLock(rnd, 'two'), genForge(rnd)];
  return [zone1, zone2, zone3, zone4, zone5].map((z) => z.map((p) => ({ type: p.type || 'lock', ...p })));
}

export function genZone(rnd, zone) { return genRun(rnd)[zone]; }

export function genBackup(rnd, problem) {
  if (problem.type === 'master') return { type: 'master', ...genMasterKey(rnd) };
  if (problem.type === 'forge') return { type: 'forge', ...genForge(rnd) };
  if (problem.story) return { type: 'lock', ...genWordLock(rnd) };
  return { type: 'lock', ...genLock(rnd, problem.kind, { money: problem.money, decimal: problem.decimal && !problem.money }) };
}

/* ------------------------------------------------------------------ */
/* Checking and feedback (wording for the teacher to review)          */
/* ------------------------------------------------------------------ */
function undoHint(lock) {
  const A = fmt(lock.a, lock.money);
  switch (lock.kind) {
    case 'add': return `${lock.x} + ${A} means ${A} was added, so ${lock.x} is ${A} less than ${fmt(lock.c, lock.money)}`;
    case 'sub': return `${lock.x} − ${A} means ${A} was taken away, so ${lock.x} is ${A} more than ${fmt(lock.c, lock.money)}`;
    case 'subFrom': return `${A} − ${lock.x} = ${fmt(lock.c, lock.money)} means ${lock.x} is how far ${fmt(lock.c, lock.money)} is from ${A}`;
    case 'mul': return `${lock.k}${lock.x} means ${lock.k} × ${lock.x}, so ${lock.x} is ${fmt(lock.c)} split into ${lock.k} equal groups`;
    case 'divBy': return `${A} ÷ ${lock.x} = ${fmt(lock.c)} means ${A} split into groups of ${lock.x} makes ${fmt(lock.c)} groups`;
    case 'divOf': return `${lock.x} ÷ ${lock.k} = ${fmt(lock.c)} means ${lock.x} split into ${lock.k} groups gives ${fmt(lock.c)} in each`;
    case 'two': return `work out ${lock.k} × ${lock.x} first, then add ${A}`;
    default: return '';
  }
}

/** The student picked a key value, or 'none' for NO KEY FITS. */
export function checkKey(lock, choice) {
  const x = lock.x;
  if (choice === 'none') {
    if (lock.noKey) return { correct: true, key: 'correct', message: `Right: none of these keys open ${lockText(lock)}. Every one fails when you substitute it.` };
    const s = substitute(lock, lock.solution);
    return { correct: false, key: 'missed_key', message: `One key does fit. Try ${fmt(lock.solution, lock.money)}: ${s.text}.` };
  }
  const v = r2(choice);
  const s = substitute(lock, v);
  if (s.equal) return { correct: true, key: 'correct', message: `Click! ${s.text}. ${fmt(v, lock.money)} is a solution.`, sub: s };
  const tag = (lock.keys.find((k) => same(k.value, v)) || {}).tag || 'near_miss';
  const tail = lock.noKey ? ' None of these keys fit. Look for NO KEY FITS.' : '';
  const msg = {
    forward_op: `Put ${fmt(v, lock.money)} in for ${x}: ${s.text}. That key did the operation forward. Think: ${undoHint(lock)}.`,
    answer_as_key: `${fmt(v, lock.money)} is already on the other side of the lock. The key replaces ${x}: ${s.text}.`,
    used_the_number: `${fmt(v, lock.money)} is the number already in the lock, not ${x}: ${s.text}.`,
    add_sub_instead: `Check the operation: ${s.text}. ${undoHint(lock)}.`,
    place_value: `Line up the decimal points and check: ${s.text}.`,
    near_miss: `Close, but ${s.text}. Both sides must be exactly equal.`,
    forgot_divide: `${s.text}. Remember ${lock.k}${x} means ${lock.k} × ${x}: ${undoHint(lock)}.`,
    wrong_order: `${s.text}. Multiply first, then add: ${undoHint(lock)}.`,
    ignored_part: `${s.text}. Don't forget the + ${fmt(lock.a, lock.money)}: ${undoHint(lock)}.`,
  }[tag] || `${s.text}. Both sides must be equal.`;
  return { correct: false, key: tag, message: msg + tail, sub: s };
}

/** Master Key: `marks` maps lock id -> true (opens) / false (stays shut). */
export function checkMaster(problem, marks) {
  const wrong = problem.locks.filter((l) => Boolean(marks[l.id]) !== l.opens);
  if (!wrong.length) return { correct: true, key: 'correct', message: `All right! The key ${problem.x} = ${problem.value} opens exactly the locks where both sides match.`, wrong: [] };
  const first = wrong[0];
  const s = substitute(first, problem.value);
  const key = first.trap === 'concatenation' && marks[first.id] ? 'concatenation' : marks[first.id] ? 'said_open' : 'said_shut';
  const message = key === 'concatenation'
    ? `${first.k}${first.x} means ${first.k} × ${first.x}, not the digits ${first.k} and ${problem.value} side by side: ${s.text}.`
    : key === 'said_open'
      ? `Check ${lockText(first)} with ${first.x} = ${problem.value}: ${s.text}. That lock stays shut.`
      : `Check ${lockText(first)} with ${first.x} = ${problem.value}: ${s.text}. That lock opens!`;
  return { correct: false, key, message: wrong.length > 1 ? `${message} (${wrong.length} locks need another look.)` : message, wrong: wrong.map((l) => l.id) };
}

/** Worked solution after two misses: substitute every key (or every lock). */
export function workedSolution(problem) {
  if (problem.type === 'master') {
    return problem.locks.map((l) => `${lockText(l)}: ${substitute(l, problem.value).text} → ${l.opens ? 'OPENS' : 'stays shut'}`);
  }
  if (problem.type === 'forge') {
    const v = problem.value;
    return [`One way: x + 5 = ${v + 5}. Check: ${v} + 5 = ${v + 5} ✓`, `Another way: 3x = ${3 * v}. Check: 3 × ${v} = ${3 * v} ✓`, 'Any lock works if both sides are equal when x is the key.'];
  }
  const lines = problem.keys.map((k) => `Key ${fmt(k.value, problem.money)}: ${substitute(problem, k.value).text}${same(leftValue(problem, k.value), problem.c) ? ' ✓' : ''}`);
  lines.push(problem.noKey ? 'No key makes both sides equal, so NO KEY FITS.' : `Only ${fmt(problem.solution, problem.money)} makes both sides equal.`);
  return lines;
}
