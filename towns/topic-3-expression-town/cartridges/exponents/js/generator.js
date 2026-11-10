/**
 * Charge Runner: Exponent Reactor - Problem Generator
 * Builds a fresh, randomized set of problems for each run, and targeted
 * follow-up problems when a student hits a specific misconception.
 *
 * Every generated problem stays inside the controls:
 *   dials: base 1-10, exponent 0-6 · keypad: up to 7 digits.
 */

import { calculatePower, powerText, expandedText, powerOfTenExponent } from './curriculum.js';

export const DIAL_MAX_BASE = 10;
export const DIAL_MAX_EXPONENT = 6;

/** Small seeded PRNG (mulberry32) so runs are reproducible in tests. */
export function createRng(seed = Date.now()) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
function shuffle(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const P = (base, exponent) => ({ base, exponent });

/** Every (base, exponent) pair on the dials that makes `target`, excluding trivial b¹ for targets > 10. */
export function dialSolutions(target) {
  const out = [];
  for (let b = 1; b <= DIAL_MAX_BASE; b++) {
    for (let e = 0; e <= DIAL_MAX_EXPONENT; e++) {
      if (calculatePower(b, e) === target) out.push({ base: b, exponent: e });
    }
  }
  return out;
}

// ------------------------------------------------------------------
// Pools (whole-number exponents only)
// ------------------------------------------------------------------
const POOLS = {
  basics: [P(2, 2), P(3, 2), P(4, 2), P(5, 2), P(6, 2), P(7, 2), P(8, 2), P(9, 2), P(2, 3), P(3, 3), P(4, 3), P(5, 3), P(2, 4)],
  // Powers where base × exponent (or base + exponent) is a tempting wrong answer
  trap: [P(4, 3), P(2, 5), P(5, 3), P(3, 4), P(2, 6), P(6, 3), P(3, 3), P(2, 4), P(7, 2), P(6, 2), P(8, 2)],
  // Pairs whose base and exponent are swapped (the classic compare trap)
  swapPairs: [[P(2, 5), P(5, 2)], [P(3, 4), P(4, 3)], [P(2, 6), P(6, 2)], [P(2, 3), P(3, 2)], [P(3, 5), P(5, 3)], [P(2, 4), P(4, 2)]],
  tens: [2, 3, 4, 5, 6].map(e => P(10, e)),
  equalPairs: [[P(2, 6), P(4, 3)], [P(2, 6), P(8, 2)], [P(4, 3), P(8, 2)], [P(3, 4), P(9, 2)], [P(2, 4), P(4, 2)], [P(2, 2), P(4, 1)]],
  equivTargets: [64, 81, 16],
  lockedBig: [P(3, 5), P(4, 4), P(8, 3), P(6, 3), P(7, 3), P(5, 4), P(9, 3), P(3, 6)],
  bossEval: [P(2, 6), P(4, 4), P(3, 5), P(9, 2), P(7, 3), P(5, 4)],
};

// ------------------------------------------------------------------
// Problem builders
// ------------------------------------------------------------------
let idCounter = 0;
const nextId = mode => `${mode}-${++idCounter}`;

export function makeFind({ base, exponent }, opts = {}) {
  const target = calculatePower(base, exponent);
  const zeros = powerOfTenExponent(target);
  const lockBase = opts.lockBase ?? (target > 200 && zeros === null);
  const solutions = dialSolutions(target);
  // Generating pair first (it's the intended answer; a locked base uses it).
  solutions.sort((a, b) => (a.base === base && a.exponent === exponent ? -1 : b.base === base && b.exponent === exponent ? 1 : 0));
  let hint;
  if (lockBase) hint = `Base is locked to ${base}. Multiply ${base} by itself until you reach ${target.toLocaleString()}.`;
  else if (zeros !== null) hint = `Count the zeros in ${target.toLocaleString()}.`;
  else if (target === 1) hint = 'Use the zero exponent rule (b⁰ = 1), or 1 to any power.';
  else if (opts.equivalent) hint = `There is more than one answer! Try base 2, then a bigger base.`;
  else hint = `Which number, used as a factor over and over, makes ${target.toLocaleString()}? Try small bases first.`;
  return {
    id: nextId('find'),
    mode: 'find',
    targetMW: target,
    ...(lockBase ? { givenBase: base } : {}),
    validSolutions: solutions,
    hint,
  };
}

function evalHint(base, exponent) {
  if (exponent === 0) return 'Any non-zero base to the power 0 is 1.';
  if (base === 1) return '1 × 1 × 1 ... is still 1.';
  if (base === 10) return `A 1 followed by ${exponent} zero${exponent === 1 ? '' : 's'}.`;
  if (exponent === 1) return `${powerText(base, 1)} means ${base} used as a factor once.`;
  return `${expandedText(base, exponent)}. Multiply one factor at a time.`;
}

export function makeEvaluate({ base, exponent }) {
  return { id: nextId('evaluate'), mode: 'evaluate', base, exponent, hint: evalHint(base, exponent) };
}

export function makeFix({ base, exponent }, wrongValue) {
  const correct = calculatePower(base, exponent);
  let wrong = wrongValue;
  if (wrong === undefined) {
    if (exponent === 0) wrong = 0;
    else if (base === 1) wrong = exponent;
    else wrong = base * exponent;
  }
  if (wrong === correct) wrong = base + exponent;
  const why = exponent === 0 ? `${powerText(base, 0)} is not ${wrong}.` : `The trainee did ${base} × ${exponent}.`;
  return {
    id: nextId('fix'),
    mode: 'fix',
    base,
    exponent,
    wrongValue: wrong,
    hint: `${why} ${evalHint(base, exponent)}`,
  };
}

export function makeExpanded({ base, exponent }) {
  return {
    id: nextId('expanded'),
    mode: 'expanded',
    base,
    exponent,
    hint: `What number repeats? Count how many times it appears.`,
  };
}

export function makeCompare(left, right) {
  return {
    id: nextId('compare'),
    mode: 'compare',
    left,
    right,
    hint: `Work out each one: ${left.exponent === 0 ? powerText(left.base, 0) : expandedText(left.base, left.exponent)} and ${right.exponent === 0 ? powerText(right.base, 0) : expandedText(right.base, right.exponent)}.`,
  };
}

/**
 * Boss "charge cards": one correct power for the target, one swapped decoy,
 * and one product-trap decoy (a power whose base × exponent equals the target).
 */
export const CARD_TARGETS = [P(2, 6), P(3, 4), P(5, 3), P(2, 5), P(6, 3), P(4, 3)];
export function makeCards({ base, exponent }, rng) {
  const target = calculatePower(base, exponent);
  const swapped = P(exponent, base);
  // product trap: d^(target/d), preferring exponent 2 or 3
  let trap = null;
  for (const e of [2, 3, 4, 5, 6]) {
    if (target % e === 0 && calculatePower(target / e, e) !== target) { trap = P(target / e, e); break; }
  }
  const cards = shuffle(rng, [
    { ...P(base, exponent), kind: 'correct' },
    { ...swapped, kind: 'swapped' },
    { ...trap, kind: 'product-trap' },
  ]);
  return {
    id: nextId('cards'),
    mode: 'cards',
    targetMW: target,
    cards,
    hint: `Only one card makes exactly ${target} MW. Don't multiply base × exponent!`,
  };
}

// ------------------------------------------------------------------
// Sector plans: each sector mixes modes; order is shuffled per run.
// ------------------------------------------------------------------
const SECTOR_PLANS = [
  // Sector 1: Basics (squares & cubes)
  rng => {
    const pool = shuffle(rng, POOLS.basics);
    // Find targets must be > 10 so b¹ isn't a free answer.
    const findable = pool.filter(p => calculatePower(p.base, p.exponent) > 10);
    // Track values (not pairs) so 2⁴ and 4² never both appear in one sector.
    const used = new Set();
    const take = list => {
      const p = list.find(x => !used.has(calculatePower(x.base, x.exponent)));
      used.add(calculatePower(p.base, p.exponent));
      return p;
    };
    const first = makeFind(take(findable)); // always open with the familiar mode
    const rest = shuffle(rng, [
      makeEvaluate(take(pool)),
      makeExpanded(take(pool)),
      makeFind(take(findable)),
      makeEvaluate(take(pool)),
    ]);
    return [first, ...rest];
  },
  // Sector 2: Multiplication trap
  rng => {
    const pool = shuffle(rng, POOLS.trap);
    const pair = shuffle(rng, pick(rng, POOLS.swapPairs));
    return shuffle(rng, [
      makeEvaluate(pool[0]),
      makeEvaluate(pool[1]),
      makeFix(pool[2]),
      makeCompare(pair[0], pair[1]),
      makeFind(pool.slice(3).find(p => calculatePower(p.base, p.exponent) > 10)),
    ]);
  },
  // Sector 3: Powers of 10
  rng => {
    const tens = shuffle(rng, POOLS.tens);
    return shuffle(rng, [
      makeFind(tens[0]),
      makeEvaluate(tens[1]),
      makeExpanded(tens[2]),
      makeFix(tens[3]),
      makeFind(tens[4]),
    ]);
  },
  // Sector 4: Zero & one
  rng => {
    const bases = shuffle(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const oneExp = pick(rng, [2, 3, 4, 5, 6]);
    const identityCompare = rng() < 0.5
      ? makeCompare(P(bases[3], 1), P(1, bases[3] <= 6 ? bases[3] : 6))
      : makeCompare(P(bases[3], 0), P(1, oneExp));
    const prime = pick(rng, [2, 3, 5, 7]);
    const findOne = rng() < 0.5 ? makeFind(P(bases[4], 0)) : makeFind(P(prime, 1), { lockBase: false });
    if (findOne.targetMW !== 1) findOne.hint = `${findOne.targetMW} can't be made by multiplying a smaller number by itself. What exponent keeps the base the same?`;
    return shuffle(rng, [
      makeEvaluate(P(bases[0], 0)),
      makeFix(P(bases[1], 0), rng() < 0.5 ? 0 : bases[1]),
      makeEvaluate(P(1, oneExp)),
      identityCompare,
      findOne,
    ]);
  },
  // Sector 5: Boss
  rng => {
    const locked = shuffle(rng, POOLS.lockedBig);
    const evals = shuffle(rng, POOLS.bossEval).filter(p => !(p.base === locked[0].base && p.exponent === locked[0].exponent));
    const eq = shuffle(rng, pick(rng, POOLS.equalPairs.slice(0, 5)));
    const target = pick(rng, POOLS.equivTargets);
    const equivSol = dialSolutions(target).find(s => s.base > 1 && s.exponent > 1);
    const valueTask = rng() < 0.5 ? makeFix(evals[0]) : makeEvaluate(evals[0]);
    return [
      makeFind(equivSol, { equivalent: true }),
      ...shuffle(rng, [
        makeCards(pick(rng, CARD_TARGETS), rng),
        makeCompare(eq[0], eq[1]),
        valueTask,
      ]),
      makeFind(locked[0], { lockBase: true }), // finale: biggest surge
    ];
  },
];

/** Builds the full run: an array of 5 sectors × 5 problems. */
export function generateRun(rng = createRng()) {
  return SECTOR_PLANS.map(plan => plan(rng));
}

// ------------------------------------------------------------------
// Adaptive follow-ups
// ------------------------------------------------------------------
const FOLLOW_UP_LABEL = {
  'multiplication-error': 'Repeated multiplication',
  'addition-error': 'Repeated multiplication',
  'swap-error': 'Base vs. exponent',
  'zero-error': 'Zero exponent rule',
  'one-base-error': 'Powers of 1',
  'power-of-ten': 'Powers of 10',
  'factor-count': 'Counting factors',
  'equivalent-form': 'Writing powers',
  'wrong-base': 'Writing powers',
  'compare-error': 'Comparing powers',
};

/**
 * Returns a follow-up problem aimed at the misconception `type`, or null if
 * the miss type doesn't map to a specific skill. `avoid` is the problem just missed.
 */
export function makeFollowUp(type, rng, avoid = {}) {
  const notSame = p => !(p.base === avoid.base && p.exponent === avoid.exponent);
  let problem = null;
  switch (type) {
    case 'multiplication-error':
    case 'addition-error': {
      if (rng() < 0.5) {
        const pair = shuffle(rng, pick(rng, POOLS.swapPairs));
        problem = makeCompare(pair[0], pair[1]);
      } else {
        problem = makeEvaluate(pick(rng, POOLS.trap.filter(notSame)));
      }
      break;
    }
    case 'swap-error': {
      const pair = shuffle(rng, pick(rng, POOLS.swapPairs.filter(([a]) => !(a.base === 2 && a.exponent === 4))));
      problem = makeCompare(pair[0], pair[1]);
      break;
    }
    case 'zero-error':
      problem = makeEvaluate(P(pick(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10].filter(b => b !== avoid.base)), 0));
      break;
    case 'one-base-error':
      problem = makeEvaluate(P(1, pick(rng, [2, 3, 4, 5, 6].filter(e => e !== avoid.exponent))));
      break;
    case 'power-of-ten':
      problem = makeEvaluate(pick(rng, POOLS.tens.filter(notSame)));
      break;
    case 'factor-count':
    case 'equivalent-form':
    case 'wrong-base':
      problem = makeExpanded(pick(rng, POOLS.basics.filter(notSame)));
      break;
    case 'compare-error': {
      const pair = shuffle(rng, pick(rng, [...POOLS.swapPairs, ...POOLS.equalPairs.slice(0, 5)]));
      problem = makeCompare(pair[0], pair[1]);
      break;
    }
    default:
      return null;
  }
  return { ...problem, isFollowUp: true, followUpSkill: FOLLOW_UP_LABEL[type] };
}
