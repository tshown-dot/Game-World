// Lesson 4-2 "Counterweight": the math behind the balance scale.
// enVision 2.0 Grade 6, Topic 4, Lesson 4-2: Apply Properties of Equality (6.EE.A.4, 6.EE.B.7).
// No screen code here, so it can be tested with plain node (see test_counterweight_math.js).
//
// A pan of the scale is  a·x + b  (a = number of x-blocks, b = loose weight), plus `text` for display.
// x is the hidden weight of one x-block. The scale is level when both pans weigh the same.
// Round types:
//   match    the saboteur changes one pan (hits: one change, or two in a row); the student does the same to the other pan.
//            curtain: the change is hidden, and only the pan before and after can be seen.
//   solve    the student chooses one operation and the machine does it to BOTH pans; the goal is one x-block alone
//   inspect  a repaired scale is clamped shut: will it stay LEVEL or TIP when the clamp opens?

export const OPS = ['+', '-', '×', '÷'];
export const OP_WORD = { '+': 'add', '-': 'subtract', '×': 'multiply by', '÷': 'divide by' };
export const OP_SIGN = { '+': '+', '-': '−', '×': '×', '÷': '÷' };   // − is the real minus sign, for display
export const INVERSE = { '+': '-', '-': '+', '×': '÷', '÷': '×' };
export const PROPERTY = { '+': 'ADDITION PROPERTY OF EQUALITY', '-': 'SUBTRACTION PROPERTY OF EQUALITY', '×': 'MULTIPLICATION PROPERTY OF EQUALITY', '÷': 'DIVISION PROPERTY OF EQUALITY' };
/** How far the number dial turns. */
export const DIAL = { lo: 1, hi: 30 };

export function seeded(seed = 1) {               // mulberry32: repeatable random numbers for tests
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
const shuffle = (rnd, list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const near = (p, q) => Math.abs(p - q) < 1e-9;
const round = (v) => Math.round(v * 1000) / 1000;
let nextId = 1;

/* ------------------------------------------------------------------ */
/* Pans                                                                */
/* ------------------------------------------------------------------ */
function plainText(a, b) {
  const xs = near(a, 0) ? '' : near(a, 1) ? 'x' : a > 0 && a < 1 && Number.isInteger(round(1 / a)) ? `x ÷ ${round(1 / a)}` : `${round(a)}x`;
  if (!xs) return String(round(b));
  if (near(b, 0)) return xs;
  return b > 0 ? `${xs} + ${round(b)}` : `${xs} − ${round(-b)}`;
}
export function pan(a, b, text) { return { a, b, text: text ?? plainText(a, b) }; }
const needsGroup = (text) => /[+−-]/.test(text);
/** A pan after an operation on ALL of it. The text keeps what was done: (x + 2) × 3. */
export function applyOp(s, op, n) {
  switch (op) {
    case '+': return pan(s.a, s.b + n, `${s.text} + ${n}`);
    case '-': return pan(s.a, s.b - n, `${s.text} − ${n}`);
    case '×': return pan(s.a * n, s.b * n, needsGroup(s.text) ? `(${s.text}) × ${n}` : `${s.text} × ${n}`);
    case '÷': return pan(s.a / n, s.b / n, needsGroup(s.text) ? `(${s.text}) ÷ ${n}` : `${s.text} ÷ ${n}`);
    default: throw new Error(`unknown op ${op}`);
  }
}
export const weigh = (s, x) => s.a * x + s.b;
/** The pan written simply: "3x + 6" or "18". */
export const settled = (s) => plainText(round(s.a), round(s.b));
/** Which way the beam goes: -1 the left pan drops, 1 the right pan drops, 0 level. */
export const tilt = (left, right, x) => { const d = weigh(left, x) - weigh(right, x); return near(d, 0) ? 0 : d > 0 ? -1 : 1; };
export const stepText = (op, n) => `${OP_SIGN[op]} ${n}`;

/* ------------------------------------------------------------------ */
/* Match: do to the other pan what the saboteur did to this one        */
/* ------------------------------------------------------------------ */
/** Two pans that weigh the same. withX: one pan holds x-blocks. kind: which operations must work on both pans. */
function levelPans(rnd, { withX, times = false, divide = 0 }) {
  for (let tries = 0; tries < 300; tries++) {
    const x = ri(rnd, 2, 9);
    let left, right;
    if (!withX) { const p = ri(rnd, 2, 9), q = ri(rnd, 2, 9); left = pan(0, p + q, `${p} + ${q}`); right = pan(0, p + q); }
    else if (times || divide) { const a = divide ? divide * ri(rnd, 1, 2) : ri(rnd, 1, 3), b = divide ? divide * ri(rnd, 0, 3) : ri(rnd, 0, 5); left = pan(a, b); right = pan(0, a * x + b); }
    else { const a = ri(rnd, 1, 2), b = ri(rnd, 1, 9); left = pan(a, b); right = pan(0, a * x + b); }
    if (divide && !withX && (left.b % divide !== 0)) continue;
    if (weigh(left, x) > 60) continue;
    return rnd() < 0.5 ? { x, left, right } : { x, left: right, right: left };
  }
  throw new Error('no level pans');
}
function makeHit(rnd, op, pans) {
  if (op === '÷') { const ks = [2, 3, 4, 5].filter((k) => ['left', 'right'].every((s) => Number.isInteger(pans[s].a / k) && Number.isInteger(pans[s].b / k) && pans[s].b / k > 0)); return ks.length ? { op, n: pick(rnd, ks) } : null; }
  if (op === '×') return { op, n: ri(rnd, 2, 4) };
  if (op === '-') { const max = Math.min(pans.left.b, pans.right.b) - 1; return max >= 2 ? { op, n: ri(rnd, 2, Math.min(9, max)) } : null; }
  return { op, n: ri(rnd, 2, 9) };
}
/**
 * ops: the operations the saboteur may use, one for each change. withX: a pan has x-blocks. curtain: the change is hidden.
 * seconds: how long before the beam hits the ground.
 */
export function genMatch(rnd, { ops = [pick(rnd, ['+', '-'])], withX = false, curtain = false, seconds = 10 } = {}) {
  for (let tries = 0; tries < 400; tries++) {
    const divide = ops.includes('÷') ? pick(rnd, [2, 3, 4]) : 0;
    const pans = levelPans(rnd, { withX, times: ops.includes('×'), divide });
    if (divide && !withX) { const w = divide * ri(rnd, 2, 8); pans.left = pan(0, w); pans.right = pan(0, w, `${w / 2} + ${w / 2}`); if (!Number.isInteger(w / 2)) continue; }
    const side = pick(rnd, ['left', 'right']), hits = [];
    let cur = { left: pans.left, right: pans.right }, ok = true;
    for (const op of ops) { const h = makeHit(rnd, op, cur); if (!h) { ok = false; break; } hits.push(h); cur = { left: applyOp(cur.left, h.op, h.n), right: applyOp(cur.right, h.op, h.n) }; }
    if (!ok || weigh(cur.left, pans.x) > 99 || weigh(cur.left, pans.x) < 1) continue;
    if (hits.length === 2 && hits[0].op === hits[1].op) continue;
    return { id: nextId++, type: 'match', x: pans.x, left: pans.left, right: pans.right, side, other: side === 'left' ? 'right' : 'left', hits, curtain, seconds };
  }
  throw new Error(`no match round for ${ops.join(' ')}`);
}
/** The saboteur's pan after the first k changes. */
export function hitPan(p, k = p.hits.length) { let s = p[p.side]; for (const h of p.hits.slice(0, k)) s = applyOp(s, h.op, h.n); return s; }
/**
 * The student's change for step k (0 or 1), made to `mine`, their pan as it stands. Returns
 * { ok, key, message, pan (their pan after the change), property }.
 */
export function checkMatch(p, k, mine, op, n) {
  const hit = p.hits[k], target = weigh(hitPan(p, k + 1), p.x), after = applyOp(mine, op, n);
  if (near(weigh(after, p.x), target)) return { ok: true, key: 'correct', pan: after, property: PROPERTY[op], message: `${stepText(op, n)} on both pans: level again.` };
  const no = (key, message) => ({ ok: false, key, pan: after, message });
  const did = p.curtain ? 'The other pan was changed a different way.' : `The saboteur did ${stepText(hit.op, hit.n)}.`;
  if (op === INVERSE[hit.op] && n === hit.n) return no('undid', `${did} You did the OPPOSITE, so the gap got bigger. To stay level, do the SAME thing to both pans.`);
  if (op === hit.op) return no('amount', `Right operation, wrong amount. ${p.curtain ? 'Compare the pan before and after once more.' : `Look again at how much the saboteur used.`}`);
  if ((hit.op === '×' || hit.op === '÷') && (op === '+' || op === '-') && n === hit.n) return no('mixed_ops', `${stepText(hit.op, hit.n)} is not the same as ${stepText(op, n)}. ${hit.op === '×' ? 'Multiplying' : 'Dividing'} changes a pan by a different amount than ${op === '+' ? 'adding' : 'subtracting'}.`);
  return no('off', `${did} The pans still do not match: do the SAME thing to this pan.`);
}
export const matchAnswer = (p, k) => `Do ${stepText(p.hits[k].op, p.hits[k].n)} to this pan too.`;

/* ------------------------------------------------------------------ */
/* Solve: one operation on both pans, to get one x-block alone         */
/* ------------------------------------------------------------------ */
/** op: what the equation does to x (the student has to do the opposite). */
export function genSolve(rnd, op = pick(rnd, OPS)) {
  const x = op === '÷' ? 0 : ri(rnd, 2, 12), n = op === '×' || op === '÷' ? ri(rnd, 2, 6) : ri(rnd, 2, 12);
  let left, value;
  if (op === '+') { left = pan(1, n); value = x; }
  else if (op === '-') { value = n + ri(rnd, 1, 9); left = pan(1, -n); }   // more than is taken away, so no pan weighs less than nothing
  else if (op === '×') { left = pan(n, 0); value = x; }
  else { value = n * ri(rnd, 2, 9); left = pan(1 / n, 0); }
  const right = pan(0, weigh(left, value)), flip = rnd() < 0.3;
  return { id: nextId++, type: 'solve', x: value, op, n, left: flip ? right : left, right: flip ? left : right };
}
const alone = (s) => near(s.a, 1) && near(s.b, 0);
/** The student's operation, done to both pans. */
export function checkSolve(p, op, n) {
  const left = pan(applyOp(p.left, op, n).a, applyOp(p.left, op, n).b), right = pan(applyOp(p.right, op, n).a, applyOp(p.right, op, n).b);
  const pans = { left, right, text: `${settled(left)} = ${settled(right)}` };
  if ((alone(left) && near(right.a, 0)) || (alone(right) && near(left.a, 0))) return { ok: true, key: 'correct', ...pans, property: PROPERTY[op], message: `${pans.text}. The x-block is alone, and the scale never tipped.` };
  const no = (key, message) => ({ ok: false, key, ...pans, message: `Still level, but x is not alone: ${pans.text}. ${message}` });
  const sum = (o) => o === '+' || o === '-';
  if (op === p.op) return no('same_op', `That did MORE of what was already there. To clear ${stepText(p.op, p.n)}, do the opposite.`);
  if (op === INVERSE[p.op]) return no('amount', 'Right operation, wrong amount. Which number is with the x?');
  if (sum(op) !== sum(p.op)) return no('wrong_kind', sum(p.op) ? 'The number is added to or taken from x here, so multiplying and dividing will not clear it.' : 'The x is multiplied or divided here, so adding and subtracting will not clear it.');
  return no('off', 'What is being done to x? Do the opposite to both pans.');
}
export const solveAnswer = (p) => `${OP_WORD[INVERSE[p.op]][0].toUpperCase()}${OP_WORD[INVERSE[p.op]].slice(1)} ${p.n} on both pans: x = ${round(p.x)}.`;

/* ------------------------------------------------------------------ */
/* Inspect: will this repaired scale stay level?                       */
/* ------------------------------------------------------------------ */
const WHY = {
  same: (h) => `The same thing (${stepText(h.op, h.n)}) was done to both pans.`,
  one_side: (h) => `Only one pan got ${stepText(h.op, h.n)}. The other was left alone.`,
  amounts: (h, g) => `One pan got ${stepText(h.op, h.n)} and the other got ${stepText(g.op, g.n)}: not the same amount.`,
  mixed: (h, g) => `One pan got ${stepText(h.op, h.n)} and the other got ${stepText(g.op, g.n)}: not the same operation.`,
  partial: (h) => `${stepText(h.op, h.n)} was done to only PART of one pan. It has to be done to the whole pan.`,
};
/** kind: same (stays level), or one of the bad repairs: one_side, amounts, mixed, partial. */
export function genInspect(rnd, kind = pick(rnd, ['same', 'same', 'one_side', 'amounts', 'mixed', 'partial'])) {
  for (let tries = 0; tries < 400; tries++) {
    const withX = kind === 'partial' || rnd() < 0.5, op = kind === 'mixed' || kind === 'partial' ? '×' : pick(rnd, OPS);
    const base = levelPans(rnd, { withX, times: op === '×', divide: op === '÷' ? pick(rnd, [2, 3]) : 0 });
    if (!withX && op === '÷') continue;
    const h = makeHit(rnd, op, base); if (!h) continue;
    let left = applyOp(base.left, h.op, h.n), right, g = null;
    if (kind === 'same') right = applyOp(base.right, h.op, h.n);
    else if (kind === 'one_side') right = base.right;
    else if (kind === 'amounts') { g = { op: h.op, n: h.n + pick(rnd, [-1, 1, 2]) }; if (g.n < 2) continue; right = applyOp(base.right, g.op, g.n); }
    else if (kind === 'mixed') { g = { op: '+', n: h.n }; right = applyOp(base.right, g.op, g.n); }
    else {
      const xPan = base.left.a ? 'left' : 'right', s = base[xPan]; if (near(s.b, 0) || near(s.a, 0)) continue;
      const part = pan(s.a * h.n, s.b, `${plainText(s.a, 0)} × ${h.n} + ${s.b}`), whole = applyOp(base[xPan === 'left' ? 'right' : 'left'], h.op, h.n);
      left = xPan === 'left' ? part : whole; right = xPan === 'left' ? whole : part;
    }
    if (![left, right].every((s) => near(weigh(s, base.x), Math.round(weigh(s, base.x))))) continue;   // whole weights only
    const level = tilt(left, right, base.x) === 0;
    if (level !== (kind === 'same')) continue;
    if (weigh(left, base.x) > 99 || weigh(right, base.x) > 99 || weigh(left, base.x) < 0 || weigh(right, base.x) < 0) continue;
    return { id: nextId++, type: 'inspect', kind, x: base.x, before: `${base.left.text} = ${base.right.text}`, left, right, level, why: WHY[kind](h, g) };
  }
  throw new Error(`no inspect round for ${kind}`);
}
export function checkInspect(p, saysLevel) {
  if (saysLevel === p.level) return { ok: true, key: 'correct', message: p.why };
  return { ok: false, key: p.level ? 'doubted_same' : p.kind, message: p.level ? `It stayed level. ${p.why} That always keeps a scale level.` : `It tipped. ${p.why}` };
}

/* ------------------------------------------------------------------ */
/* Zones                                                               */
/* ------------------------------------------------------------------ */
export const ZONES = [
  { name: 'Steady Hands', blurb: 'The saboteur adds or subtracts: do the same to the other pan' },
  { name: 'Heavy Lifting', blurb: 'Now whole pans are multiplied and divided' },
  { name: 'Your Move', blurb: 'One operation on both pans: get the x-block alone' },
  { name: "Inspector's Line", blurb: 'Will each repaired scale stay level, or tip?' },
  { name: 'The Saboteur', blurb: 'Boss: two changes at once, and changes behind a curtain' },
];
/** The rounds of a zone, in order. */
export function genZone(rnd, zone) {
  if (zone === 0) return ['+', '-', '+', '-', '+', '-', '-', '+'].map((op, i) => genMatch(rnd, { ops: [op], withX: i >= 4, seconds: 10 }));
  if (zone === 1) return ['×', '÷', '×', '×', '÷', '×', '÷', '×'].map((op, i) => genMatch(rnd, { ops: [op], withX: i >= 3, seconds: 10 }));
  if (zone === 2) return shuffle(rnd, ['+', '-', '×', '÷', pick(rnd, ['+', '-']), pick(rnd, ['×', '÷'])]).map((op) => genSolve(rnd, op));
  if (zone === 3) return shuffle(rnd, ['same', 'same', 'same', 'same', 'one_side', 'amounts', 'mixed', 'mixed', 'partial', 'partial']).map((k) => genInspect(rnd, k));
  return [genMatch(rnd, { ops: ['+', '×'], seconds: 14 }), genMatch(rnd, { ops: ['×'], withX: true, curtain: true, seconds: 14 }), genMatch(rnd, { ops: ['×', '-'], withX: true, seconds: 14 }),
    genMatch(rnd, { ops: [pick(rnd, ['+', '-'])], withX: true, curtain: true, seconds: 14 }), genMatch(rnd, { ops: ['÷'], withX: true, curtain: true, seconds: 14 })];
}
