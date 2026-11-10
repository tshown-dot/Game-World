/**
 * Demolition Crane - Building Generator
 *
 * Each template draws random numbers, then the result is checked by the real
 * engine: every step must give a whole number from 0 to 400, and (when a wrong
 * order is possible) doing it in the wrong order must give a different answer,
 * so a lucky guess can't pass.
 */

import {
  parseExpressionToTokens,
  evaluateTokens,
  analyzeOperator,
  applyOperation,
  valueIfForced,
  validateMove,
  tokensToText,
  isOperatorToken,
} from './expressionParser.js?v=20261109b';
import { ZONES, BOSS } from './curriculum.js?v=20261109b';

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

const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export function shuffle(r, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const EASY_POWERS = [[2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [2, 3], [3, 3]];
const POWERS = [...EASY_POWERS, [7, 2], [8, 2], [9, 2], [10, 2], [4, 3], [5, 3], [2, 4], [2, 5], [3, 4]];
const pw = (r, easy = false) => {
  const [b, e] = pick(r, easy ? EASY_POWERS : POWERS);
  return `${b}^${e}`;
};
const pm = (r) => (r() < 0.5 ? '+' : '-');

/** Template id -> (rng) => expression string. Fallbacks are known-good. */
export const TEMPLATES = {
  // ---- Zone 1: × ÷ before + −, left to right ----
  addMul: { make: (r) => `${int(r, 2, 20)} + ${int(r, 2, 9)} × ${int(r, 2, 9)}`, fallback: '15 + 4 × 3' },
  mulSub: { make: (r) => `${int(r, 3, 9)} × ${int(r, 3, 9)} - ${int(r, 2, 15)}`, fallback: '6 × 7 - 12' },
  subDivAdd: {
    make: (r) => { const c = int(r, 2, 9); return `${int(r, 12, 40)} - ${c * int(r, 2, 9)} ÷ ${c} + ${int(r, 2, 15)}`; },
    fallback: '28 - 12 ÷ 4 + 6',
  },
  divMul: {
    make: (r) => { const c = int(r, 2, 9); return `${c * int(r, 2, 9)} ÷ ${c} × ${int(r, 2, 6)}`; },
    fallback: '40 ÷ 5 × 2',
  },
  subAdd: { make: (r) => `${int(r, 20, 60)} - ${int(r, 5, 19)} + ${int(r, 2, 15)}`, fallback: '50 - 20 + 5' },
  mulAddMul: { make: (r) => `${int(r, 2, 9)} × ${int(r, 2, 9)} + ${int(r, 2, 9)} × ${int(r, 2, 9)}`, fallback: '3 × 4 + 5 × 6' },
  addMulSub: { make: (r) => `${int(r, 2, 20)} + ${int(r, 2, 9)} × ${int(r, 2, 9)} - ${int(r, 2, 15)}`, fallback: '12 + 6 × 3 - 8' },

  // ---- Zone 2: exponents ----
  powAddMul: { make: (r) => `${pw(r)} + ${int(r, 2, 9)} × ${int(r, 2, 9)}`, fallback: '3^2 + 4 × 5' },
  mulPow: { make: (r) => `${int(r, 2, 6)} × ${pw(r, true)}`, fallback: '2 × 5^2' },
  subPowMul: { make: (r) => `${int(r, 40, 120)} - ${pw(r, true)} × ${int(r, 2, 5)}`, fallback: '60 - 2^3 × 5' },
  powSubPow: {
    make: (r) => { const a = pw(r); let b = pw(r); while (b === a) b = pw(r); return `${a} - ${b} + ${int(r, 2, 12)}`; },
    fallback: '5^2 - 4^2 + 2',
  },
  addMulPow: { make: (r) => `${int(r, 2, 20)} + ${int(r, 2, 4)} × ${pw(r, true)}`, fallback: '10 + 3 × 2^3' },
  powDivMul: { make: (r) => `${pw(r)} ÷ ${int(r, 2, 8)} × ${int(r, 2, 5)}`, fallback: '6^2 ÷ 4 × 3' },

  // ---- Zone 3: parentheses ----
  mulGroup: { make: (r) => `${int(r, 2, 9)} × (${int(r, 6, 20)} ${pm(r)} ${int(r, 2, 9)}) + ${int(r, 2, 12)}`, fallback: '4 × (12 - 5) + 6' },
  groupDivMul: { make: (r) => `(${int(r, 4, 30)} + ${int(r, 2, 20)}) ÷ ${int(r, 2, 9)} × ${int(r, 2, 6)}`, fallback: '(8 + 4) ÷ 3 × 5' },
  mulGroupPow: { make: (r) => `${int(r, 2, 6)} × (${pw(r, true)} ${pm(r)} ${int(r, 2, 9)})`, fallback: '3 × (2^3 + 4)' },
  groupPowAdd: {
    make: (r) => {
      const d = int(r, 2, 9);
      const b = int(r, 2, 15);
      return r() < 0.5 ? `(${b + d} - ${b})^2 + ${int(r, 2, 20)}` : `(${b + d} - ${b})^2 ÷ ${int(r, 2, 9)}`;
    },
    fallback: '(15 - 9)^2 ÷ 4',
  },
  groupTimesGroup: { make: (r) => `(${int(r, 2, 12)} + ${int(r, 2, 9)}) × (${int(r, 8, 20)} - ${int(r, 2, 7)})`, fallback: '(8 + 4) × (9 - 6)' },
  addMulGroup: { make: (r) => `${int(r, 2, 20)} + ${int(r, 2, 9)} × (${int(r, 8, 20)} - ${int(r, 2, 7)})`, fallback: '5 + 3 × (10 - 4)' },

  // ---- Zone 4: brackets and fraction bars ----
  nestedSub: { make: (r) => `${int(r, 2, 6)} × [${int(r, 20, 40)} - (${int(r, 2, 9)} + ${int(r, 2, 9)})]`, fallback: '2 × [25 - (4 + 6)]' },
  nestedPowDiv: {
    make: (r) => { const d = int(r, 2, 6); const c = int(r, 2, 10); return `[${int(r, 2, 30)} + (${c + d} - ${c})^2] ÷ ${int(r, 2, 6)}`; },
    fallback: '[10 + (6 - 2)^2] ÷ 2',
  },
  nestedMulAdd: { make: (r) => `${int(r, 40, 100)} - [${int(r, 2, 5)} × (${int(r, 2, 6)} + ${int(r, 2, 6)}) + ${int(r, 2, 12)}]`, fallback: '50 - [3 × (2 + 4) + 8]' },
  fracPowSub: { make: (r) => `(${pw(r)} + ${int(r, 2, 20)}) / (${int(r, 6, 15)} - ${int(r, 1, 5)})`, fallback: '(3^2 + 7) / (5 - 1)' },
  fracMulPow: { make: (r) => `(${int(r, 2, 9)} × ${int(r, 2, 9)} ${pm(r)} ${int(r, 2, 12)}) / (${pw(r, true)})`, fallback: '(4 × 6 - 8) / (2^2)' },
  fracNested: { make: (r) => `[${int(r, 2, 5)} × (${int(r, 8, 15)} - ${int(r, 2, 7)})] / (${pw(r, true)} - ${int(r, 1, 5)})`, fallback: '[2 × (10 - 2)] / (3^2 - 5)' },

  // ---- Boss towers: everything at once ----
  bossTowerA: { make: (r) => `${int(r, 2, 20)} + ${int(r, 2, 6)} × (${int(r, 6, 12)} - ${int(r, 2, 5)})^2 ÷ ${int(r, 2, 9)}`, fallback: '7 + 3 × (8 - 2)^2 ÷ 9' },
  bossTowerB: { make: (r) => `[${int(r, 30, 60)} - ${int(r, 2, 6)} × ${int(r, 2, 6)}] + ${pw(r, true)} ÷ ${int(r, 2, 4)}`, fallback: '[40 - 3 × 5] + 2^3 ÷ 4' },
  bossTowerC: { make: (r) => `(${pw(r)} + ${int(r, 2, 6)} × ${int(r, 2, 8)}) / (${int(r, 2, 9)} + ${int(r, 1, 6)})`, fallback: '(4^2 + 3 × 8) / (3 + 5)' },
  bossTowerD: { make: (r) => `${int(r, 2, 9)} × ${int(r, 2, 9)} - ${int(r, 12, 48)} ÷ ${int(r, 2, 6)} + ${pw(r, true)}`, fallback: '6 × 4 - 18 ÷ 3 + 2^3' },
};

const MAX_VALUE = 400;

/** Do all the steps (in a legal order) give whole numbers between 0 and MAX_VALUE? */
function stepsAreClean(tokens) {
  const { value, steps } = evaluateTokens(tokens);
  if (!Number.isInteger(value)) return false;
  return steps.every((s) => Number.isInteger(s.result) && s.result >= 0 && s.result <= MAX_VALUE);
}

/**
 * If some wrong-order move is possible right now, at least one must change the
 * answer. (Doing the right-hand group first never changes the value, so it
 * doesn't count as a trap here, though the game still marks it wrong.)
 */
function wrongOrderMatters(tokens, value) {
  let forceable = 0;
  let differs = 0;
  tokens.forEach((t, i) => {
    if (t.type !== 'operator') return;
    const a = analyzeOperator(tokens, i);
    if (a.ready || a.reason === 'GROUP_ORDER') return;
    const v = valueIfForced(tokens, i);
    if (v === null) return;
    forceable++;
    if (v !== value) differs++;
  });
  return forceable === 0 || differs > 0;
}

/** Checks a generated expression. Exported for tests. */
export function isGoodExpression(expr) {
  let tokens;
  try {
    tokens = parseExpressionToTokens(expr);
  } catch {
    return false;
  }
  if (tokens.filter(isOperatorToken).length < 2) return false;
  if (!stepsAreClean(tokens)) return false;
  return wrongOrderMatters(tokens, evaluateTokens(tokens).value);
}

/** Generates one building from a template. */
export function makeBuilding(rng, templateId, extra = {}) {
  const tpl = TEMPLATES[templateId];
  if (!tpl) throw new Error(`Unknown template ${templateId}`);
  let expr = tpl.fallback;
  for (let attempt = 0; attempt < 600; attempt++) {
    const candidate = tpl.make(rng);
    if (isGoodExpression(candidate)) {
      expr = candidate;
      break;
    }
  }
  return { kind: 'build', template: templateId, expr, answer: evaluateTokens(parseExpressionToTokens(expr)).value, ...extra };
}

// ------------------------------------------------------------------
// Boss: Cage Drop. Place one pair of parentheses to hit a target.
// ------------------------------------------------------------------

/** Builds the expression string with a cage around numbers i..j. */
export function cagedExpression(numbers, ops, i, j) {
  let s = '';
  numbers.forEach((n, k) => {
    if (k > 0) s += ` ${ops[k - 1]} `;
    if (k === i) s += '(';
    s += n;
    if (k === j) s += ')';
  });
  return s;
}

function cleanValue(expr) {
  try {
    const tokens = parseExpressionToTokens(expr);
    return stepsAreClean(tokens) ? evaluateTokens(tokens).value : null;
  } catch {
    return null;
  }
}

export function makeCagePuzzle(rng) {
  const shapes = [
    () => ({ numbers: [int(rng, 2, 9), int(rng, 2, 9), int(rng, 2, 9)], ops: [pick(rng, ['×', '+']), pick(rng, ['+', '-', '×'])] }),
    () => ({ numbers: [int(rng, 10, 30), int(rng, 2, 9), int(rng, 2, 9)], ops: ['-', pick(rng, ['+', '×'])] }),
    () => ({ numbers: [int(rng, 2, 9), int(rng, 2, 9), int(rng, 2, 9), int(rng, 2, 9)], ops: [pick(rng, ['+', '×']), pick(rng, ['×', '+']), pick(rng, ['+', '-'])] }),
  ];
  for (let attempt = 0; attempt < 400; attempt++) {
    const { numbers, ops } = pick(rng, shapes)();
    const base = cleanValue(cagedExpression(numbers, ops, -1, -1));
    if (base === null) continue;
    const byValue = new Map();
    for (let i = 0; i < numbers.length; i++) {
      for (let j = i + 1; j < numbers.length; j++) {
        if (i === 0 && j === numbers.length - 1) continue; // caging everything changes nothing
        const v = cleanValue(cagedExpression(numbers, ops, i, j));
        if (v === null || v === base) continue;
        if (!byValue.has(v)) byValue.set(v, []);
        byValue.get(v).push([i, j]);
      }
    }
    // Prefer a target that only one cage reaches.
    const unique = [...byValue.entries()].filter(([, sols]) => sols.length === 1);
    if (!unique.length) continue;
    const [target, solutions] = pick(rng, unique);
    return { kind: 'cage', numbers, ops, baseValue: base, target, solutions };
  }
  return { kind: 'cage', numbers: [4, 6, 2], ops: ['×', '+'], baseValue: 26, target: 32, solutions: [[1, 2]] };
}

// ------------------------------------------------------------------
// Boss: Spot the Mistake. A worked solution with one out-of-order step.
// ------------------------------------------------------------------

export function makeSpotMistake(rng) {
  const pool = ['addMulSub', 'powAddMul', 'subPowMul', 'mulGroupPow', 'addMulGroup', 'subDivAdd', 'nestedMulAdd', 'addMulPow'];
  for (let attempt = 0; attempt < 200; attempt++) {
    const building = makeBuilding(rng, pick(rng, pool));
    const tokens = parseExpressionToTokens(building.expr);
    const correct = building.answer;

    // Walk the correct path, collecting every point where a tempting wrong step exists.
    const candidates = [];
    let cur = tokens;
    for (let step = 0; step < 6 && cur.length > 1; step++) {
      cur.forEach((t, i) => {
        if (t.type !== 'operator' || analyzeOperator(cur, i).ready) return;
        const v = valueIfForced(cur, i);
        if (v !== null && v !== correct && Number.isInteger(v) && v >= 0 && v <= MAX_VALUE) {
          candidates.push({ step, tokens: cur, index: i, wrongValue: v });
        }
      });
      cur = applyOperation(cur, firstLegal(cur)).tokens;
    }
    if (!candidates.length) continue;
    const c = pick(rng, candidates);

    // Rebuild the shown solution: correct lines up to c.step, then the wrong step, then correct to the end.
    const lines = [building.expr];
    let walk = tokens;
    let clean = true;
    const advance = (index) => {
      const res = applyOperation(walk, index);
      if (!Number.isInteger(res.result) || res.result < 0 || res.result > MAX_VALUE) clean = false;
      walk = res.tokens;
      lines.push(tokensToText(walk));
    };
    for (let s = 0; s < c.step; s++) advance(firstLegal(walk));
    const diagnosis = validateMove(walk, walk[c.index].id);
    advance(c.index);
    const wrongLine = lines.length - 1;
    while (clean && walk.length > 1) advance(firstLegal(walk));
    if (!clean || lines.length > 7) continue; // whole numbers only, and keep it readable
    return {
      kind: 'spot',
      expr: building.expr,
      lines,
      wrongLine,
      correctValue: correct,
      wrongValue: c.wrongValue,
      ruleTitle: diagnosis.ruleTitle,
      explanation: diagnosis.message,
    };
  }
  return {
    kind: 'spot',
    expr: '15 + 4 × 3',
    lines: ['15 + 4 × 3', '19 × 3', '57'],
    wrongLine: 1,
    correctValue: 27,
    wrongValue: 57,
    ruleTitle: '× and ÷ before + and −',
    explanation: '4 × 3 goes before 15 + 4: multiply and divide before you add and subtract.',
  };
}

function firstLegal(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    if (isOperatorToken(tokens[i]) && analyzeOperator(tokens, i).ready) return i;
  }
  return -1;
}

// ------------------------------------------------------------------
// Runs and follow-ups
// ------------------------------------------------------------------

/** A full run: 4 zones of buildings, then the boss attack list. */
export function buildRun(rng) {
  const zones = ZONES.map((z) => ({
    zoneId: z.id,
    tasks: shuffle(rng, z.templates).slice(0, z.buildings).map((t) => makeBuilding(rng, t)),
  }));
  return { zones, boss: buildBossTasks(rng) };
}

export function buildZoneTasks(rng, zoneId) {
  const z = ZONES.find((zz) => zz.id === zoneId);
  return shuffle(rng, z.templates).slice(0, z.buildings).map((t) => makeBuilding(rng, t));
}

export function buildBossTasks(rng) {
  const towers = shuffle(rng, BOSS.towerTemplates);
  let towerIdx = 0;
  return BOSS.sequence.map((kind) => {
    if (kind === 'cage') return makeCagePuzzle(rng);
    if (kind === 'spot') return makeSpotMistake(rng);
    return makeBuilding(rng, towers[towerIdx++ % towers.length]);
  });
}

/** A fresh building aimed at the rule that was just broken. */
export function makeFollowUp(rng, violationType, templatePool) {
  const pool = templatePool && templatePool.length ? templatePool : ['addMul'];
  return makeBuilding(rng, pick(rng, pool), { followUp: true, followUpFor: violationType });
}
