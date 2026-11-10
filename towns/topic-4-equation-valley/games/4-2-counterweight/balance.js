// Lesson 4-2 "Counterweight": the math behind the balance scale.
// enVision 2.0 Grade 6, Topic 4, Lesson 4-2: Apply Properties of Equality (6.EE.A.4, 6.EE.B.7).
//
// No screen code here: problem generators, answer checking and misconception feedback.
// Every function takes a random-number function `rnd` (returns 0 to 1) so tests can repeat a run exactly.
//
// A side of the scale is  a·x + b  (a = number of x-blocks, b = weight), plus `text` for display.
// The equation is balanced when both sides weigh the same for the hidden value of x.

export const OPS = ['+', '-', '×', '÷'];
export const OP_WORD = { '+': 'add', '-': 'subtract', '×': 'multiply by', '÷': 'divide by' };
export const OP_SIGN = { '+': '+', '-': '−', '×': '×', '÷': '÷' };   // − is the real minus sign, for display
const INVERSE = { '+': '-', '-': '+', '×': '÷', '÷': '×' };

export const PROPERTIES = [
  'Addition Property of Equality',
  'Subtraction Property of Equality',
  'Multiplication Property of Equality',
  'Division Property of Equality',
];
const PROPERTY_FOR = { '+': PROPERTIES[0], '-': PROPERTIES[1], '×': PROPERTIES[2], '÷': PROPERTIES[3] };

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */
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
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const ri = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
const near = (p, q) => Math.abs(p - q) < 1e-9;
const NAMES = ['Ava', 'Leo', 'Maya', 'Omar', 'Zoe', 'Eli', 'Nia', 'Sam', 'Ruby', 'Theo'];

/* ------------------------------------------------------------------ */
/* Sides and equations                                                 */
/* ------------------------------------------------------------------ */
export function side(a, b, text) {
  return { a, b, text: text ?? defaultText(a, b) };
}
function defaultText(a, b) {
  const xs = a === 0 ? '' : a === 1 ? 'x' : `${a}x`;
  if (!xs) return String(b);
  if (b === 0) return xs;
  return b > 0 ? `${xs} + ${b}` : `${xs} − ${-b}`;
}
const needsGroup = (text) => /[+−-]/.test(text);

export function applyOp(s, op, n) {
  switch (op) {
    case '+': return side(s.a, s.b + n, `${s.text} + ${n}`);
    case '-': return side(s.a, s.b - n, `${s.text} − ${n}`);
    case '×': return side(s.a * n, s.b * n, needsGroup(s.text) ? `(${s.text}) × ${n}` : `${s.text} × ${n}`);
    case '÷': return side(s.a / n, s.b / n, needsGroup(s.text) ? `(${s.text}) ÷ ${n}` : `${s.text} ÷ ${n}`);
    default: throw new Error(`unknown op ${op}`);
  }
}
export const weigh = (s, x) => s.a * (x ?? 0) + s.b;
export const isBalanced = (eq) => near(weigh(eq.left, eq.x), weigh(eq.right, eq.x));
export const eqText = (eq) => `${eq.left.text} = ${eq.right.text}`;
/** The value each side "settles" to, for the scale display, e.g. "4x + 6" or "16". */
export const settled = (s) => defaultText(round(s.a), round(s.b));
const round = (v) => Math.round(v * 1000) / 1000;

/** True when two equations have exactly the same solutions (both are linear in x). */
export function sameSolutions(e1, e2) {
  const sol = (e) => {
    const a = e.left.a - e.right.a, b = e.right.b - e.left.b;
    if (near(a, 0)) return near(b, 0) ? 'all' : 'none';
    return round(b / a);
  };
  return sol(e1) === sol(e2);
}

/** Whole-number amounts only: "4", " 04 ", "+4" are fine. Returns null if not usable for that operation. */
export function parseAmount(raw, op) {
  const t = String(raw ?? '').trim().replace(/^\+/, '');
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  if (n > 99) return null;
  if ((op === '×' || op === '÷') && n === 0) return null;   // never multiply or divide by zero
  if ((op === '+' || op === '-') && n === 0) return null;   // adding zero changes nothing
  return n;
}

/* ------------------------------------------------------------------ */
/* Generators                                                          */
/* ------------------------------------------------------------------ */
let nextId = 1;
const id = () => `p${nextId++}`;

/** Zone 1 and 2: the Saboteur changes one side; the student must apply the same change to the other side. */
export function genRebalance(rnd, { ops = ['+', '-'], variable = false } = {}) {
  for (;;) {
    let start, x = null;
    if (variable) {                                   // e.g. 25 + d = 36, or 4x = 36
      x = ri(rnd, 2, 12);
      if (rnd() < 0.5) { const b = ri(rnd, 3, 30); start = { left: side(1, b), right: side(0, x + b), x }; }
      else { const a = ri(rnd, 2, 9); start = { left: side(a, 0), right: side(0, a * x), x }; }
    } else if (rnd() < 0.6) {                         // e.g. 7 + 5 = 12
      const p = ri(rnd, 2, 20), q = ri(rnd, 2, 20);
      start = { left: side(0, p + q, `${p} + ${q}`), right: side(0, p + q), x };
    } else {                                          // e.g. 4 × 6 = 24
      const p = ri(rnd, 2, 9), q = ri(rnd, 2, 9);
      start = { left: side(0, p * q, `${p} × ${q}`), right: side(0, p * q), x };
    }
    const op = pick(rnd, ops);
    const sabSide = variable ? 'left' : (rnd() < 0.5 ? 'left' : 'right');
    const target = start[sabSide];
    let n;
    if (op === '+') n = ri(rnd, 2, 9);
    else if (op === '-') n = variable && target.a === 1 ? target.b : ri(rnd, 2, Math.min(9, weigh(target, x) - 1));
    else if (op === '×') n = ri(rnd, 2, 5);
    else {
      const divisors = [2, 3, 4, 5, 6, 9].filter((d) => variable ? (target.a % d === 0 && target.b % d === 0) : weigh(target, x) % d === 0);
      if (variable && target.a > 1 && target.b === 0) divisors.push(target.a);
      if (!divisors.length) continue;
      n = pick(rnd, divisors);
    }
    if (!(n >= 1) || (op === '-' && !variable && weigh(target, x) - n < 1)) continue;
    const after = { ...start, [sabSide]: applyOp(target, op, n) };
    if (isBalanced(after)) continue;
    return {
      id: id(), type: 'rebalance', start, sabotage: { side: sabSide, op, n }, after,
      fixSide: sabSide === 'left' ? 'right' : 'left',
      prompt: `The Saboteur ${{ '+': `added ${n} to the ${sabSide} side`, '-': `took ${n} away from the ${sabSide} side`,
        '×': `multiplied the ${sabSide} side by ${n}`, '÷': `divided the ${sabSide} side by ${n}` }[op]}. Fix the ${sabSide === 'left' ? 'right' : 'left'} side so the scale balances.`,
    };
  }
}

/** Zone 3: get one x-block alone by doing the same thing to both sides. */
export function genIsolate(rnd) {
  const kind = pick(rnd, ['times', 'plus', 'minus']);
  const x = ri(rnd, kind === 'minus' ? 3 : 2, 12);       // x − b = right side must stay positive
  let left;
  if (kind === 'times') left = side(ri(rnd, 2, 9), 0);
  else if (kind === 'plus') left = side(1, ri(rnd, 3, 25));
  else left = side(1, -ri(rnd, 2, x - 1));
  const start = { left, right: side(0, weigh(left, x)), x };
  const answer = kind === 'times' ? { op: '÷', n: left.a } : kind === 'plus' ? { op: '-', n: left.b } : { op: '+', n: -left.b };
  return {
    id: id(), type: 'isolate', kind, start, answer,
    prompt: 'Get one x-block alone on the left. Whatever you do happens to BOTH sides.',
  };
}

/** One or two per run: name the property used. */
export function genProperty(rnd) {
  const x = ri(rnd, 2, 9), a = ri(rnd, 2, 9);
  const start = { left: side(a, 0, `${a}y`), right: side(0, a * x), x };
  const op = pick(rnd, OPS);
  const n = op === '÷' ? a : op === '-' ? ri(rnd, 2, Math.min(9, a * x - 1)) : ri(rnd, 2, 9);
  const after = { left: applyOp(start.left, op, n), right: applyOp(start.right, op, n), x };
  return {
    id: id(), type: 'property', start, after, op, n, answer: PROPERTY_FOR[op], choices: PROPERTIES.slice(),
    prompt: `If ${eqText(start)}, then ${eqText(after)}. Which property was used?`,
  };
}

/** Zone 4: is this "repair" still the same equation? If not, what went wrong? */
export const MISTAKES = {
  different_amount: 'Different amounts on each side',
  different_op: 'Different operations on each side',
  one_side: 'Only one side was changed',
  part_of_side: 'Only part of a side was changed',
};
export function genInspect(rnd, forceKind) {
  const kind = forceKind || pick(rnd, ['same', 'same', 'different_amount', 'different_op', 'one_side', 'part_of_side']);
  const p = ri(rnd, 2, 15), q = ri(rnd, 2, 15);
  const start = { left: side(0, p + q, `${p} + ${q}`), right: side(0, p + q), x: null };
  const op = pick(rnd, kind === 'part_of_side' ? ['×'] : kind === 'different_amount' ? ['+', '×'] : ['+', '-', '×']);
  const n = op === '×' ? ri(rnd, 2, 5) : Math.min(ri(rnd, 2, 9), p + q - 1);   // keep every weight positive
  let left = applyOp(start.left, op, n), right = applyOp(start.right, op, n);
  if (kind === 'different_amount') { const m = n + ri(rnd, 1, 3); right = applyOp(start.right, op, m); }
  if (kind === 'different_op') right = applyOp(start.right, INVERSE[op], n);
  if (kind === 'one_side') right = start.right;
  if (kind === 'part_of_side') left = side(0, p + q * n, `${p} + ${q} × ${n}`);   // only q was multiplied
  const after = { left, right, x: null };
  const equivalent = isBalanced(after);
  return {
    id: id(), type: 'inspect', kind, start, after, equivalent,
    mistake: equivalent ? null : kind,
    prompt: `Original: ${eqText(start)}.  Repair: ${eqText(after)}.  Is the repair still balanced?`,
  };
}

/** Boss: three kinds of harder problems. */
export function genBoss(rnd, kind) {
  kind = kind || pick(rnd, ['partial', 'chain', 'critique']);
  if (kind === 'partial') {                          // 12b = 24 -> what one step gives 4b?
    const j = ri(rnd, 2, 5), q = ri(rnd, 2, 4), x = ri(rnd, 2, 9);
    const k = j * q;
    const start = { left: side(k, 0, `${k}b`), right: side(0, k * x), x };
    return {
      id: id(), type: 'partial', start, targetA: j, answer: { op: '÷', n: q },
      prompt: `Start with ${eqText(start)}. What ONE step, done to both sides, leaves ${j}b on the left?`,
    };
  }
  if (kind === 'chain') {                            // two moves on the left; copy both onto the right, in order
    const p = ri(rnd, 2, 12), q = ri(rnd, 2, 12);
    const start = { left: side(0, p + q, `${p} + ${q}`), right: side(0, p + q), x: null };
    const first = { op: pick(rnd, ['+', '-']), n: ri(rnd, 2, 6) };
    const second = { op: '×', n: ri(rnd, 2, 4) };
    if (first.op === '-' && first.n >= p + q) first.n = 1;
    const left = applyOp(applyOp(start.left, first.op, first.n), second.op, second.n);
    return {
      id: id(), type: 'chain', start, moves: [first, second], after: { ...start, left },
      prompt: `The Saboteur did TWO things to the left side: ${OP_WORD[first.op]} ${first.n}, then ${OP_WORD[second.op]} ${second.n}. Do the same two things to the right side.`,
    };
  }
  const who = pick(rnd, NAMES);                      // critique a classmate (Tomas / Bobbie style)
  const mistake = pick(rnd, ['different_amount', 'one_side', 'same']);
  const a = pick(rnd, [6, 12, 18]);
  const x = ri(rnd, 2, 6);
  const start = { left: side(a, 0, `${a}m`), right: side(0, a * x), x };
  let after;
  if (mistake === 'different_amount') after = { left: applyOp(start.left, '÷', 2), right: applyOp(start.right, '÷', 3), x };
  else if (mistake === 'one_side') after = { left: applyOp(start.left, '÷', 2), right: start.right, x };
  else after = { left: applyOp(start.left, '÷', 2), right: applyOp(start.right, '÷', 2), x };
  return {
    id: id(), type: 'critique', who, start, after, equivalent: sameSolutions(start, after),
    mistake: mistake === 'same' ? null : mistake,
    prompt: `${who} changed ${eqText(start)} into ${eqText(after)}. Is ${who} right?`,
  };
}

/** A full run: 5 zones. Zone 4 always shows each kind of mistake at least once over the run. */
export const ZONES = [
  { name: 'Steady Hands', blurb: 'Add or subtract to rebalance' },
  { name: 'Heavy Lifting', blurb: 'Multiply or divide a whole side' },
  { name: 'Block Puzzles', blurb: 'Get one x-block alone' },
  { name: "Inspector's Desk", blurb: 'Spot the broken repairs' },
  { name: 'The Saboteur', blurb: 'Boss: two steps, partial steps, and critiques' },
];
export function genZone(rnd, zone) {
  switch (zone) {
    case 0: return [genRebalance(rnd), genRebalance(rnd), genProperty(rnd), genRebalance(rnd)];
    case 1: return [genRebalance(rnd, { ops: ['×', '÷'] }), genRebalance(rnd, { ops: ['×', '÷'] }), genRebalance(rnd, { ops: ['×', '÷'] })];
    case 2: return [genIsolate(rnd), genIsolate(rnd), genRebalance(rnd, { ops: ['-', '÷'], variable: true }), genProperty(rnd)];
    case 3: {
      const kinds = ['same', 'part_of_side', 'one_side', 'different_amount'].sort(() => rnd() - 0.5);
      return kinds.map((k) => genInspect(rnd, k));
    }
    default: return ['partial', 'chain', 'critique', 'partial', 'chain'].map((k) => genBoss(rnd, k));
  }
}
/** A backup problem of the same type, for after two misses. */
export function genBackup(rnd, problem) {
  switch (problem.type) {
    case 'rebalance': return genRebalance(rnd, { ops: [problem.sabotage.op], variable: problem.start.x !== null });
    case 'isolate': return genIsolate(rnd);
    case 'property': return genProperty(rnd);
    case 'inspect': return genInspect(rnd, problem.kind);
    case 'critique': return genBoss(rnd, 'critique');
    default: return genBoss(rnd, problem.type);
  }
}

/* ------------------------------------------------------------------ */
/* Checking answers and explaining mistakes                            */
/* (The wording below is for the teacher to review.)                   */
/* ------------------------------------------------------------------ */
const show = (op, n) => `${OP_SIGN[op]} ${n}`;
/** "7 was subtracted from both sides", "both sides were divided by 4" */
export function stepPhrase(op, n) {
  return { '+': `${n} was added to both sides`, '-': `${n} was subtracted from both sides`,
    '×': `both sides were multiplied by ${n}`, '÷': `both sides were divided by ${n}` }[op];
}

/** Rebalance: the student applies `op n` to the side that was NOT sabotaged. */
export function checkRebalance(problem, op, n) {
  const { sabotage, after, fixSide } = problem;
  const fixed = { ...after, [fixSide]: applyOp(after[fixSide], op, n) };
  const correct = isBalanced(fixed);
  const sameMove = op === sabotage.op && n === sabotage.n;
  let key, message;
  if (correct && sameMove) {
    key = 'correct';
    message = `Balanced! The ${sabotage.side} side got ${show(sabotage.op, sabotage.n)}, so the ${fixSide} side got ${show(op, n)} too.`;
  } else if (correct) {
    key = 'correct_other_way';
    message = `That balances this time. The property says do the SAME thing to both sides: ${show(sabotage.op, sabotage.n)}. That always works.`;
  } else if (op === sabotage.op) {
    key = 'different_amount';
    message = `Right operation, wrong amount. The ${sabotage.side} side got ${show(sabotage.op, sabotage.n)}, so the ${fixSide} side needs exactly ${show(sabotage.op, sabotage.n)}.`;
  } else if (op === INVERSE[sabotage.op] && n === sabotage.n) {
    key = 'opposite_op';
    message = `That undoes it on the wrong side. The ${sabotage.side} side got ${show(sabotage.op, sabotage.n)}. Give the ${fixSide} side the same thing, ${show(sabotage.op, sabotage.n)}, so both sides change together.`;
  } else {
    key = 'different_op';
    message = `Both sides need the same operation. The ${sabotage.side} side got ${show(sabotage.op, sabotage.n)}. Do ${show(sabotage.op, sabotage.n)} to the ${fixSide} side.`;
  }
  return { correct, key, message, result: fixed };
}

/** Isolate: the student applies `op n` to BOTH sides; correct when one x-block is alone on the left. */
export function checkIsolate(problem, op, n) {
  const { start, kind, answer } = problem;
  const result = { left: applyOp(start.left, op, n), right: applyOp(start.right, op, n), x: start.x };
  const correct = near(result.left.a, 1) && near(result.left.b, 0);
  const coef = start.left.a, k = Math.abs(start.left.b);
  let key = 'correct', message = `x is alone: x = ${round(weigh(result.right, null))}. You used the ${PROPERTY_FOR[op]}.`;
  if (!correct) {
    if (kind === 'times') {
      if (op === '×') { key = 'multiplied_instead'; message = `${coef}x means ${coef} groups of x. Multiplying makes MORE x-blocks. Divide both sides by ${coef} to split them into one x.`; }
      else if (op === '÷') { key = 'wrong_divisor'; message = `Divide by the number of x-blocks. There are ${coef}, so divide both sides by ${coef}.`; }
      else { key = 'add_sub_with_coefficient'; message = `${coef}x is ${coef} times x, not ${coef} plus x. Undo times with divide: divide both sides by ${coef}.`; }
    } else if (kind === 'plus') {
      if (op === '+') { key = 'added_instead'; message = `Adding makes the left side heavier. x has ${k} added to it, so subtract ${k} from both sides.`; }
      else if (op === '-') { key = 'wrong_amount'; message = `Subtract exactly what is with x: ${k}. Subtract ${k} from both sides.`; }
      else { key = 'mult_with_sum'; message = `x + ${k} has ${k} ADDED. Undo adding with subtracting: subtract ${k} from both sides.`; }
    } else {
      if (op === '-') { key = 'subtracted_instead'; message = `x already has ${k} taken away. Add ${k} to both sides to bring it back.`; }
      else if (op === '+') { key = 'wrong_amount'; message = `Add exactly what was taken away: ${k}. Add ${k} to both sides.`; }
      else { key = 'mult_with_sum'; message = `x − ${k} has ${k} SUBTRACTED. Undo subtracting with adding: add ${k} to both sides.`; }
    }
  }
  return { correct, key, message, result, answer };
}

export function checkProperty(problem, choice) {
  const correct = choice === problem.answer;
  const message = correct
    ? `Yes! ${cap(stepPhrase(problem.op, problem.n))}: the ${problem.answer}.`
    : `Look at the step: ${stepPhrase(problem.op, problem.n)}. That is the ${problem.answer}.`;
  return { correct, key: correct ? 'correct' : 'wrong_property', message };
}

/** Inspector and critiques: first stamp equivalent or not, then (if not) name the mistake. */
export function checkStamp(problem, saysEquivalent) {
  const correct = saysEquivalent === problem.equivalent;
  let message;
  if (correct) message = problem.equivalent ? 'Correct: the same thing happened to both sides, so it stays balanced.' : 'Correct: this repair is NOT balanced. Now, what went wrong?';
  else message = problem.equivalent
    ? `Check again: both sides got the same change, so it is still balanced.`
    : `Check again: work out each side. The two sides are not equal anymore.`;
  return { correct, key: correct ? 'correct' : 'wrong_stamp', message };
}
export function checkMistake(problem, mistakeKey) {
  const correct = mistakeKey === problem.mistake;
  const explain = {
    different_amount: 'One side got a different amount than the other.',
    different_op: 'The two sides got different operations.',
    one_side: 'Only one side was changed. Both sides must get the same change.',
    part_of_side: 'Only part of the side was multiplied. The WHOLE side must be multiplied, so it needs parentheses.',
  };
  return {
    correct, key: correct ? 'correct' : 'wrong_mistake',
    message: correct ? explain[problem.mistake] : `Not quite. ${explain[problem.mistake]}`,
  };
}

/** Partial: one step that leaves `targetA` b-blocks on the left. */
export function checkPartial(problem, op, n) {
  const { start, targetA, answer } = problem;
  const result = { left: applyOp(start.left, op, n), right: applyOp(start.right, op, n), x: start.x };
  const correct = near(result.left.a, targetA) && near(result.left.b, 0);
  let message = `Yes: ${eqText(start)} becomes ${settled(result.left).replace('x', 'b')} = ${round(result.right.b)}.`;
  let key = 'correct';
  if (!correct) {
    if (op === '÷' && near(result.left.a, 1)) { key = 'went_too_far'; message = `That leaves 1b. You want ${targetA}b, so divide by less: ${start.left.a} ÷ ${answer.n} = ${targetA}.`; }
    else if (op === '÷') { key = 'wrong_divisor'; message = `${start.left.a}b ÷ ${n} = ${settled(result.left).replace('x', 'b')}. Find the number that turns ${start.left.a} into ${targetA}: ${start.left.a} ÷ ${answer.n} = ${targetA}.`; }
    else { key = 'wrong_op'; message = `To go from ${start.left.a}b down to ${targetA}b, divide both sides. ${start.left.a} ÷ ${answer.n} = ${targetA}.`; }
  }
  return { correct, key, message, result };
}

/** Chain: the student gives two moves for the right side, in order. */
export function checkChain(problem, moves) {
  let right = problem.start.right;
  for (const m of moves) right = applyOp(right, m.op, m.n);
  const fixed = { ...problem.after, right };
  const correct = isBalanced(fixed);
  const [f, s] = problem.moves;
  let key = 'correct', message = `Balanced! Same two steps, same order: ${show(f.op, f.n)}, then ${show(s.op, s.n)}.`;
  if (!correct) {
    const swapped = moves.length === 2 && moves[0].op === s.op && moves[0].n === s.n && moves[1].op === f.op && moves[1].n === f.n;
    if (swapped) { key = 'order'; message = `Right steps, wrong order. The left got ${show(f.op, f.n)} FIRST, then ${show(s.op, s.n)}. Order matters.`; }
    else { key = 'different_steps'; message = `Copy the left side's steps exactly: ${show(f.op, f.n)}, then ${show(s.op, s.n)}.`; }
  }
  return { correct, key, message, result: fixed };
}

/** The full worked solution, shown after two misses. Returns lines of text. */
export function workedSolution(problem) {
  switch (problem.type) {
    case 'rebalance': {
      const { sabotage: s, fixSide } = problem;
      const fixed = { ...problem.after, [fixSide]: applyOp(problem.after[fixSide], s.op, s.n) };
      return [`Start: ${eqText(problem.start)}`, `The ${s.side} side got ${show(s.op, s.n)}.`,
        `Do the same to the ${fixSide} side: ${show(s.op, s.n)}.`, `Now: ${eqText(fixed)}, and both sides weigh ${round(weigh(fixed.left, fixed.x))}.`];
    }
    case 'isolate': {
      const { op, n } = problem.answer;
      const r = checkIsolate(problem, op, n).result;
      return [`Start: ${eqText(problem.start)}`, `${cap(stepPhrase(op, n))}: ${eqText(r)}`,
        `So x = ${round(weigh(r.right, null))}.`];
    }
    case 'property': return [`In this step, ${stepPhrase(problem.op, problem.n)}.`, `That is the ${problem.answer}.`];
    case 'critique':
      return problem.equivalent
        ? [`Both sides were divided by the same number, 2.`, `${problem.who} is right: ${eqText(problem.after)} is balanced.`]
        : [`Both sides must get the SAME step.`, `${MISTAKES[problem.mistake]}, so ${problem.who}'s equation is not balanced anymore.`];
    case 'inspect': {
      const l = round(weigh(problem.after.left, problem.after.x)), r = round(weigh(problem.after.right, problem.after.x));
      return [`Work out each side: left = ${l}, right = ${r}.`,
        problem.equivalent ? 'They are equal, so it is still balanced.' : `They are not equal. ${MISTAKES[problem.mistake]}.`];
    }
    case 'partial': {
      const r = checkPartial(problem, '÷', problem.answer.n).result;
      return [`${problem.start.left.a} ÷ ${problem.answer.n} = ${problem.targetA}, so divide both sides by ${problem.answer.n}.`, `${eqText(problem.start)} becomes ${problem.targetA}b = ${round(r.right.b)}.`];
    }
    case 'chain': {
      const [f, s] = problem.moves;
      const r = checkChain(problem, problem.moves).result;
      return [`The left got ${show(f.op, f.n)}, then ${show(s.op, s.n)}.`, `Give the right the same steps in the same order.`, `Now: ${eqText(r)}.`];
    }
    default: return [];
  }
}
