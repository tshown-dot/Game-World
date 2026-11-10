/**
 * Demolition Crane - Math Engine & Generator Test Suite
 * Order of operations legality (including independent steps), diagnoses,
 * typed-answer formats ($15, 15, 15.00), generated buildings, and boss puzzles.
 */

import {
  parseExpressionToTokens,
  getLegalMoves,
  validateMove,
  applyOperation,
  evaluateExpression,
  evaluateTokens,
  parseNumberInput,
  normalizeMathInput,
  formatMathHtml,
  formatPlain,
  tokensToText,
} from './js/expressionParser.js';
import { ZONES, BOSS, FOLLOWUP_TEMPLATES, VIOLATION_SKILL } from './js/curriculum.js';
import {
  createRng,
  TEMPLATES,
  isGoodExpression,
  makeBuilding,
  makeCagePuzzle,
  makeSpotMistake,
  cagedExpression,
  buildRun,
  makeFollowUp,
} from './js/generator.js';

let passed = 0;
let total = 0;
function assert(cond, msg) {
  total++;
  if (cond) {
    passed++;
    console.log(`  [PASS] ${msg}`);
  } else {
    console.error(`  [FAIL] ${msg}`);
  }
}

let t0;
const legalOps = (expr) => {
  const t = parseExpressionToTokens(expr);
  return getLegalMoves(t).map((i) => t[i].value).join(' ');
};
const strike = (expr, nth) => {
  const t = parseExpressionToTokens(expr);
  const ops = t.filter((x) => x.type === 'operator' || x.type === 'fraction_bar');
  return validateMove(t, ops[nth].id);
};

console.log('====================================================');
console.log('🏗️ Demolition Crane: Order of Operations Verification');
console.log('====================================================\n');

console.log('--- 1. Typed answer formats ($15, 15, 15.00) ---');
for (const v of ['$15', '15', '15.00', '$15.00', '  $ 15  ', '15$', '1,5']) {
  const expected = v === '1,5' ? 15 : 15;
  assert(parseNumberInput(v) === expected, `"${v}" reads as ${expected}`);
}
assert(parseNumberInput('') === null && parseNumberInput('abc') === null && parseNumberInput('.') === null, 'Blank / junk input is rejected');
assert(parseNumberInput('2.5') === 2.5, '"2.5" reads as 2.5');
assert(normalizeMathInput('$1,200') === '1200', 'normalizeMathInput strips $ and commas');
assert(evaluateExpression('$15 + 4.00 * 3') === 27, '"$15 + 4.00 * 3" evaluates to 27');

console.log('\n--- 2. Which operations are legal right now ---');
assert(legalOps('15 + 4 × 3') === '×', '15 + 4 × 3: only × can go first');
assert(legalOps('28 - 12 ÷ 4 + 6') === '÷', '28 - 12 ÷ 4 + 6: only ÷');
assert(legalOps('40 ÷ 5 × 2') === '÷', '40 ÷ 5 × 2: left to right, ÷ first');
assert(legalOps('50 - 20 - 10 + 5') === '-', '50 - 20 - 10 + 5: only the first −');
assert(legalOps('3 × 4 + 5 × 6') === '×', '3 × 4 + 5 × 6: strict order, only the first ×');
assert(legalOps('(8 + 4) × (6 - 2)') === '+', '(8 + 4) × (6 - 2): strict order, left group first');
assert(legalOps('3^2 + 4^2') === '^', '3² + 4²: strict order, only the first power');
assert(legalOps('3^2 + 4 × 5') === '^', '3² + 4 × 5: exponent before the product');
assert(legalOps('(2 + 3) × [10 - (1 + 1)]') === '+', 'Deepest group wins even when it is to the right');
assert(legalOps('[4 × (8 - 6)] / (2^2 - 2)') === '-', 'Fraction: innermost first');
assert(legalOps('2 × 5^2') === '^', '2 × 5²: power before product');
assert(legalOps('(15 - 9)^2 ÷ 4') === '-', '(15 - 9)²: inside the group before the power');
assert(legalOps('2 × [18 - (4 + 2)^2 ÷ 6]') === '+', 'Nested: innermost ( ) first');
assert(legalOps('(3^2 + 7) / (5 - 1)') === '^', 'Fraction: the top is finished before the bottom; bar is not legal');
t0 = parseExpressionToTokens('[4 × (8 - 6)] / (2^2 - 2)');
t0 = applyOperation(t0, getLegalMoves(t0)[0]).tokens;
assert(getLegalMoves(t0).map((i) => t0[i].value).join(' ') === '×', 'Fraction: whole top before the bottom\'s exponent');
assert(legalOps('16 + 8 / 4') === '÷', 'A plain "/" without groups is ordinary division');

console.log('\n--- 3. Diagnoses for wrong strikes ---');
let v = strike('15 + 4 × 3', 0);
assert(!v.isLegal && v.violationType === 'MULT_DIV_FIRST', '+ in 15 + 4 × 3 → MULT_DIV_FIRST');
assert(v.wrongValue === 57, 'Forcing 15 + 4 first would give 57');
assert(/4 × 3 comes before 15 \+ 4/.test(v.message), `Message names both steps: "${v.message}"`);
v = strike('40 ÷ 5 × 2', 1);
assert(v.violationType === 'LEFT_TO_RIGHT' && v.wrongValue === 4, '× in 40 ÷ 5 × 2 → LEFT_TO_RIGHT, would give 4');
v = strike('20 - 5 + 3', 1);
assert(v.violationType === 'LEFT_TO_RIGHT' && v.wrongValue === 12, '+ in 20 - 5 + 3 → LEFT_TO_RIGHT, would give 12');
v = strike('2 × 5^2', 0);
assert(v.violationType === 'EXPONENT_FIRST' && v.wrongValue === 100, '× in 2 × 5² → EXPONENT_FIRST, would give 100');
v = strike('4 × (12 - 5) + 6', 0);
assert(v.violationType === 'GROUP_NOT_DONE' && v.wrongValue === null, '× next to an unfinished group → GROUP_NOT_DONE');
v = strike('(15 - 9)^2 ÷ 4', 1);
assert(v.violationType === 'GROUP_NOT_DONE' && /whole group/.test(v.message), 'Power on an unfinished group explains the exponent covers the group');
v = strike('(8 + 4) × (6 - 2)', 2);
assert(v.violationType === 'GROUP_ORDER' && /8 \+ 4 comes next/.test(v.message), `Right group first → GROUP_ORDER: "${v.message}"`);
v = strike('3 × 4 + 5 × 6', 2);
assert(v.violationType === 'LEFT_TO_RIGHT' && /3 × 4 comes first/.test(v.message), `Second × first → LEFT_TO_RIGHT: "${v.message}"`);
v = strike('3^2 + 4 × 5', 2);
assert(v.violationType === 'EXPONENT_FIRST', '× before 3² → EXPONENT_FIRST');
v = strike('(3^2 + 7) / (5 - 1)', 2);
assert(v.violationType === 'FRACTION_INCOMPLETE', 'Fraction bar too early → FRACTION_INCOMPLETE');
for (const type of Object.keys(VIOLATION_SKILL)) {
  assert(FOLLOWUP_TEMPLATES[type]?.every((t) => TEMPLATES[t]), `Follow-up templates exist for ${type}`);
}

console.log('\n--- 4. Executing steps ---');
let t = parseExpressionToTokens('4 × (12 - 5) + 6');
let res = applyOperation(t, getLegalMoves(t)[0]);
assert(res.result === 7 && res.dissolved, '12 - 5 = 7 and the ( ) dissolves');
assert(tokensToText(res.tokens) === '4 × 7 + 6', `Text after step: "${tokensToText(res.tokens)}"`);
t = parseExpressionToTokens('(4^2 + 3 × 8) / (2^3)');
const ev = evaluateTokens(t);
assert(ev.value === 5 && ev.steps.at(-1).isFractionBar, '(4² + 3 × 8) / (2³) = 5, finishing on the fraction bar');
assert(evaluateExpression('2 × [18 - (4 + 2)^2 ÷ 6]') === 24, '2 × [18 − (4 + 2)² ÷ 6] = 24');
assert(evaluateExpression('[10 + (6 - 2)^2] ÷ 2') === 13, '[10 + (6 − 2)²] ÷ 2 = 13');
assert(tokensToText(parseExpressionToTokens('(15 - 9)^2 ÷ 4')) === '(15 - 9)^2 ÷ 4', 'Text round-trips with a power on a group');

console.log('\n--- 5. Bad input is rejected with a readable message ---');
for (const bad of ['3 +', '(4 + 5', '4 + 5)', '3 4 + 1', 'abc', '', '(4 + 5]']) {
  let threw = false;
  try { parseExpressionToTokens(bad); } catch (e) { threw = typeof e.message === 'string' && e.message.length > 0; }
  assert(threw, `"${bad}" is rejected`);
}

console.log('\n--- 6. Display helpers ---');
assert(formatMathHtml('3^2 + 4').includes('<sup class="math-sup">2</sup>'), 'Carets become superscripts');
assert(formatMathHtml('9 - 4') === '9 − 4', 'Hyphen minus becomes a real minus sign');
assert(formatPlain('6^2 - 3') === '6² − 3', 'Plain text uses ² and −');

console.log('\n--- 7. Generated buildings (2,000 per template) ---');
const rng = createRng(12345);
for (const [id, tpl] of Object.entries(TEMPLATES)) {
  assert(isGoodExpression(tpl.fallback), `${id}: fallback "${tpl.fallback}" is valid`);
  let ok = true;
  let fallbacks = 0;
  for (let k = 0; k < 2000; k++) {
    const b = makeBuilding(rng, id);
    if (b.expr === tpl.fallback) fallbacks++;
    if (!isGoodExpression(b.expr) || !Number.isInteger(b.answer) || b.answer < 0) ok = false;
  }
  assert(ok, `${id}: every step is a whole number 0-400 and order matters`);
  assert(fallbacks < 100, `${id}: generator rarely needs its fallback (${fallbacks}/2000)`);
}
for (const z of ZONES) {
  assert(z.templates.length >= z.buildings && z.templates.every((tid) => TEMPLATES[tid]), `${z.title}: templates exist`);
}
assert(BOSS.towerTemplates.every((tid) => TEMPLATES[tid]), 'Boss tower templates exist');

console.log('\n--- 8. Runs and follow-ups ---');
const run = buildRun(createRng(7));
assert(run.zones.length === 4 && run.zones.every((z) => z.tasks.length === 3), 'A run has 4 zones of 3 buildings');
assert(run.zones.every((z) => new Set(z.tasks.map((b) => b.template)).size === 3), 'No template repeats inside a zone');
assert(run.boss.length === BOSS.sequence.length && run.boss.length === BOSS.hp, 'Boss has one attack per armor plate');
const runB = buildRun(createRng(8));
assert(run.zones[0].tasks[0].expr !== runB.zones[0].tasks[0].expr || run.zones[1].tasks[0].expr !== runB.zones[1].tasks[0].expr, 'Different seeds give different runs');
const fu = makeFollowUp(createRng(3), 'EXPONENT_FIRST', FOLLOWUP_TEMPLATES.EXPONENT_FIRST);
assert(fu.followUp && FOLLOWUP_TEMPLATES.EXPONENT_FIRST.includes(fu.template), 'Follow-up comes from the matching template pool');

console.log('\n--- 9. Boss: Cage Drop ---');
let cageOk = true;
let cageUnique = true;
for (let k = 0; k < 300; k++) {
  const p = makeCagePuzzle(rng);
  const base = evaluateExpression(cagedExpression(p.numbers, p.ops, -1, -1));
  if (base !== p.baseValue || p.target === p.baseValue) cageOk = false;
  for (const [i, j] of p.solutions) {
    if (evaluateExpression(cagedExpression(p.numbers, p.ops, i, j)) !== p.target) cageOk = false;
  }
  // Count every cage that hits the target: must be exactly the listed one.
  let hits = 0;
  for (let i = 0; i < p.numbers.length; i++) {
    for (let j = i + 1; j < p.numbers.length; j++) {
      if (i === 0 && j === p.numbers.length - 1) continue;
      if (evaluateExpression(cagedExpression(p.numbers, p.ops, i, j)) === p.target) hits++;
    }
  }
  if (hits !== 1) cageUnique = false;
}
assert(cageOk, 'Cage puzzles: solution hits the target, which differs from the uncaged value');
assert(cageUnique, 'Cage puzzles: exactly one cage hits the target');
assert(cagedExpression([4, 6, 2], ['×', '+'], 1, 2) === '4 × (6 + 2)', 'cagedExpression places the parentheses');

console.log('\n--- 10. Boss: Spot the Mistake ---');
let spotOk = true;
for (let k = 0; k < 200; k++) {
  const s = makeSpotMistake(rng);
  if (evaluateExpression(s.expr) !== s.correctValue) spotOk = false;
  if (Number(s.lines.at(-1)) !== s.wrongValue || s.wrongValue === s.correctValue) spotOk = false;
  if (s.wrongLine < 1 || s.wrongLine >= s.lines.length) spotOk = false;
  // Every line before the wrong one still has the correct value.
  for (let i = 0; i < s.wrongLine; i++) if (evaluateExpression(s.lines[i]) !== s.correctValue) spotOk = false;
  if (evaluateExpression(s.lines[s.wrongLine]) === s.correctValue) spotOk = false;
}
assert(spotOk, 'Spot puzzles: lines are right until the marked line, which changes the answer');

console.log('\n====================================================');
console.log(`Test Results: ${passed}/${total} assertions passed.`);
console.log('====================================================');
if (passed !== total) process.exit(1);
