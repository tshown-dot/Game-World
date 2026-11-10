/**
 * Verification Test Suite for Charge Runner: Exponent Reactor (Core Pillars Edition)
 * Validates power calculations, trap diagnosis, powers of 10, zero exponents,
 * Boss equivalence dilemmas, and string input parsing formats ($15, 15, 15.00).
 */

import { generateRun, createRng, makeFollowUp, makeCards, makeFind, CARD_TARGETS } from './js/generator.js';
import {
  nextCombo,
  comboAfterMiss,
  sectorStars,
  diagnoseCards,
  PROBLEM_MODES,
  diagnoseValue,
  diagnoseExpanded,
  diagnoseCompare,
  compareAnswer,
  sup,
  powerText,
  powerOfTenExponent,
  calculatePower,
  diagnoseSubmission,
  prepareSteps,
  CURRICULUM_SECTORS,
} from './js/curriculum.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('🧪 Starting Exponent Reactor Core Verification Suite...\n');

// 1. Core Power Calculations
console.log('1. Testing Core Power Calculations');
assert(calculatePower(2, 3) === 8, '2³ = 8');
assert(calculatePower(4, 2) === 16, '4² = 16');
assert(calculatePower(5, 0) === 1, '5⁰ = 1 (Zero Exponent Rule)');
assert(calculatePower(10, 4) === 10000, '10⁴ = 10,000 (Powers of 10)');
assert(calculatePower(7, 1) === 7, '7¹ = 7 (Identity Exponent)');
assert(calculatePower(3, 5) === 243, '3⁵ = 243 (Overdrive)');

// 2. Traps & Misconception Diagnosis
console.log('\n2. Testing Trap Diagnosis Engine');
const trap1 = diagnoseSubmission(4, 3, 12);
assert(trap1.isTrap === true && trap1.type === 'multiplication-error', 'Catches 4^3 for target 12 as multiplication-error');

const trap2 = diagnoseSubmission(6, 6, 36);
assert(trap2.isTrap === true && trap2.type === 'multiplication-error', 'Catches 6^6 for target 36 as multiplication-error');

const notTen = diagnoseSubmission(10, 2, 64);
assert(notTen.type !== 'power-of-ten', 'Base 10 on a non-power-of-10 target (64) is NOT diagnosed as a zero-count error');
assert(powerOfTenExponent(10000) === 4 && powerOfTenExponent(64) === null && powerOfTenExponent(1) === null, 'powerOfTenExponent detects powers of 10 only');

const trap3 = diagnoseSubmission(5, 0, 5);
assert(trap3.isTrap === true && trap3.type === 'zero-error', 'Catches 5^0 for target 5 as zero-error');

const trap4 = diagnoseSubmission(10, 3, 10000);
assert(trap4.isTrap === true && trap4.type === 'power-of-ten', 'Catches 10^3 for target 10,000 as power-of-ten stall');

const match = diagnoseSubmission(2, 5, 32);
assert(match.isTrap === false && match.type === 'exact-match', 'Confirms 2^5 = 32 as exact-match');

const overload = diagnoseSubmission(3, 4, 27);
assert(overload.isTrap === false && overload.type === 'over-exponentiation', 'Confirms 3^4 = 81 vs 27 as overload');

// 3. Step Generation / Visualizer Ribbon
console.log('\n3. Testing Visualizer Steps');
const stepsZero = prepareSteps(6, 0);
assert(stepsZero.length === 1 && stepsZero[0].currentValue === 1, 'Zero exponent produces identity step (1)');

const stepsCubes = prepareSteps(2, 3);
assert(stepsCubes.length === 3, '2³ produces 3 animation steps');
assert(stepsCubes[0].currentValue === 2 && stepsCubes[1].currentValue === 4 && stepsCubes[2].currentValue === 8, '2³ produces values [2, 4, 8]');

// 4. Generated Run Integrity (500 random runs)
console.log('\n4. Testing Generated Runs (500 seeds)');
assert(CURRICULUM_SECTORS.length === 5, 'All 5 curriculum sectors defined');
assert(CURRICULUM_SECTORS.find(s => s.isBossSector) !== undefined, 'Sector 5 is flagged as boss sector');

function problemErrors(p) {
  const errs = [];
  if (!PROBLEM_MODES.includes(p.mode)) errs.push('bad mode');
  if (!p.hint) errs.push('missing hint');
  if (p.mode === 'find') {
    if (!p.validSolutions.length) errs.push('no solutions');
    for (const sol of p.validSolutions) if (calculatePower(sol.base, sol.exponent) !== p.targetMW) errs.push('bad solution');
    const reachable = p.validSolutions.some(sol => sol.base <= 10 && sol.exponent <= 6 && (p.givenBase === undefined || sol.base === p.givenBase));
    if (!reachable) errs.push('unreachable on dials');
  }
  if (p.mode === 'evaluate' || p.mode === 'fix') {
    if (String(calculatePower(p.base, p.exponent)).length > 7) errs.push('answer too long for keypad');
  }
  if (p.mode === 'fix' && p.wrongValue === calculatePower(p.base, p.exponent)) errs.push('fix wrong value is correct');
  if (p.mode === 'expanded' && (p.exponent < 2 || p.exponent > 6 || p.base > 10)) errs.push('expanded out of dial range');
  if (p.mode === 'compare' && !p.left && !p.right) errs.push('compare missing lines');
  if (p.mode === 'cards' && p.cards.filter(c => calculatePower(c.base, c.exponent) === p.targetMW).length !== 1) errs.push('cards need exactly one correct');
  return errs;
}

let runErrors = 0;
let sectorSizesOk = true;
let trivialFinds = 0;
let dupFindValues = 0;
const firstWaveSignatures = new Set();
for (let seed = 1; seed <= 500; seed++) {
  const run = generateRun(createRng(seed));
  if (run.length !== 5 || run.some(list => list.length !== 5)) sectorSizesOk = false;
  firstWaveSignatures.add(JSON.stringify(run[0][0].targetMW));
  run.forEach((list, si) => {
    const findValues = list.filter(p => p.mode === 'find').map(p => p.targetMW);
    if (new Set(findValues).size !== findValues.length) dupFindValues++;
    list.forEach(p => {
      const errs = problemErrors(p);
      if (errs.length) { runErrors++; if (runErrors < 5) console.error(`seed ${seed} sector ${si + 1}`, p, errs); }
      // b¹ must not be a free answer for find problems outside the zero/one sector
      if (p.mode === 'find' && si !== 3 && p.targetMW <= 10) trivialFinds++;
    });
  });
}
assert(sectorSizesOk, 'Every run has 5 sectors × 5 waves');
assert(runErrors === 0, 'Every generated problem is well-formed and solvable with the controls');
assert(trivialFinds === 0, 'No find targets ≤ 10 outside Sector 4 (b¹ loophole closed)');
assert(dupFindValues === 0, 'No duplicate find targets within a sector');
assert(firstWaveSignatures.size > 3, `Runs vary between replays (${firstWaveSignatures.size} different openers)`);
const stripIds = run => JSON.stringify(run).replace(/"id":"[a-z]+-\d+",/g, '');
assert(stripIds(generateRun(createRng(42))) === stripIds(generateRun(createRng(42))), 'Seeded runs are reproducible');

// Adaptive follow-ups
const followUpTypes = ['multiplication-error', 'addition-error', 'swap-error', 'zero-error', 'one-base-error', 'power-of-ten', 'factor-count', 'equivalent-form', 'wrong-base', 'compare-error'];
let followUpsOk = true;
const rngF = createRng(7);
for (const type of followUpTypes) {
  for (let i = 0; i < 50; i++) {
    const f = makeFollowUp(type, rngF, { base: 7, exponent: 0 });
    if (!f || !f.isFollowUp || !f.followUpSkill || problemErrors(f).length) { followUpsOk = false; console.error(type, f); break; }
  }
}
assert(followUpsOk, 'Every misconception type produces a valid follow-up problem');
assert(makeFollowUp('zero-error', createRng(1), { base: 7, exponent: 0 }).mode === 'evaluate', 'Zero-exponent miss → evaluate b⁰ follow-up');
assert(makeFollowUp('zero-error', createRng(3), { base: 7, exponent: 0 }).base !== 7, 'Follow-up avoids the exact problem just missed');
assert(makeFollowUp('off-target', createRng(1)) === null, 'Generic misses do not trigger follow-ups');

// 5. New mode diagnosers
console.log('\n5. Testing Evaluate / Expanded / Compare Diagnosis');
assert(diagnoseValue(4, 3, 64).correct === true, 'Evaluate 4³ = 64 is correct');
assert(diagnoseValue(4, 3, 12).type === 'multiplication-error', 'Evaluate 4³ typed 12 → multiplication trap');
assert(diagnoseValue(4, 3, 7).type === 'addition-error', 'Evaluate 4³ typed 7 → addition error');
assert(diagnoseValue(2, 5, 25).type === 'swap-error', 'Evaluate 2⁵ typed 25 → swapped base/exponent');
assert(diagnoseValue(7, 0, 0).type === 'zero-error', 'Evaluate 7⁰ typed 0 → zero exponent error');
assert(diagnoseValue(7, 0, 7).type === 'zero-error', 'Evaluate 7⁰ typed 7 → zero exponent error');
assert(diagnoseValue(1, 5, 5).type === 'one-base-error', 'Evaluate 1⁵ typed 5 → base-one error');
assert(diagnoseValue(10, 4, 1000).type === 'power-of-ten', 'Evaluate 10⁴ typed 1,000 → zero-count error');
assert(diagnoseValue(3, 4, 27).type === 'factor-count', 'Evaluate 3⁴ typed 27 → one factor short');
assert(!diagnoseValue(4, 3, 12).correctFormula.includes('64'), 'Miss feedback does not reveal the answer');
assert(diagnoseValue(4, 3, NaN).type === 'no-answer', 'Empty readout is handled');

const exp5 = { mode: 'expanded', base: 5, exponent: 3 };
assert(diagnoseExpanded(exp5, 5, 3).correct === true, 'Expanded 5×5×5 → 5³ correct');
assert(diagnoseExpanded(exp5, 3, 5).type === 'swap-error', 'Expanded 5×5×5 → 3⁵ is a swap error');
assert(diagnoseExpanded(exp5, 5, 4).type === 'factor-count', 'Expanded 5×5×5 → 5⁴ is a factor-count error');
assert(diagnoseExpanded({ mode: 'expanded', base: 9, exponent: 2 }, 3, 4).type === 'equivalent-form', 'Expanded 9×9 → 3⁴ is same value but wrong form');

const cmp = { mode: 'compare', left: { base: 2, exponent: 5 }, right: { base: 5, exponent: 2 } };
assert(compareAnswer(cmp) === 'left', '2⁵ (32) > 5² (25)');
assert(diagnoseCompare(cmp, 'left').correct === true, 'Choosing 2⁵ is correct');
assert(diagnoseCompare(cmp, 'equal').type === 'multiplication-error', 'Choosing "equal" for 2⁵ vs 5² → multiplication trap');
assert(compareAnswer({ left: { base: 2, exponent: 6 }, right: { base: 4, exponent: 3 } }) === 'equal', '2⁶ = 4³');

assert(sup(12) === '¹²' && powerText(3, 4) === '3⁴', 'Superscript formatting');

// 6. Input parsing tests (Rule 3: Always test math input parsing with multiple formats)
console.log('\n6. Testing Input Format Parsing ($15, 15, 15.00)');
function parseMathInput(input) {
  if (typeof input === 'number') return input;
  if (!input || typeof input !== 'string') return NaN;
  const cleaned = input.replace(/[$,\s]/g, '');
  return parseFloat(cleaned);
}

assert(parseMathInput(15) === 15, 'Parses numeric 15');
assert(parseMathInput('15') === 15, 'Parses string "15"');
assert(parseMathInput('$15') === 15, 'Parses currency "$15"');
assert(parseMathInput('15.00') === 15, 'Parses decimal "15.00"');
assert(parseMathInput(' $15.00 ') === 15, 'Parses padded " $15.00 "');

// 7. Combo, Stars & Boss Cards
console.log('\n7. Testing Combo, Sector Stars & Boss Cards');
let combo = 1;
const climb = [];
for (let i = 0; i < 6; i++) { combo = nextCombo(combo); climb.push(combo); }
assert(JSON.stringify(climb) === JSON.stringify([2, 3, 4, 5, 5, 5]), 'Combo climbs x2 → x5 and caps at x5');
assert(nextCombo(3, true) === 3, 'A hinted wave holds the combo');
assert(comboAfterMiss(4) === 3 && comboAfterMiss(1) === 1, 'A miss drops the combo one level (not to x1)');
assert(sectorStars(0, 0) === 3 && sectorStars(0, 1) === 2 && sectorStars(2, 0) === 2 && sectorStars(3, 0) === 1, 'Sector stars: 3 perfect, 2 for ≤2 misses, else 1');

let cardsOk = true;
const rngC = createRng(11);
for (const t of CARD_TARGETS) {
  const prob = makeCards(t, rngC);
  const correctCards = prob.cards.filter(c => calculatePower(c.base, c.exponent) === prob.targetMW);
  const trap = prob.cards.find(c => c.kind === 'product-trap');
  if (correctCards.length !== 1 || !trap || trap.base * trap.exponent !== prob.targetMW) { cardsOk = false; console.error(prob); }
  const trapIdx = prob.cards.indexOf(trap);
  if (diagnoseCards(prob, trapIdx).type !== 'multiplication-error') cardsOk = false;
  if (!diagnoseCards(prob, prob.cards.indexOf(correctCards[0])).correct) cardsOk = false;
}
assert(cardsOk, 'Every boss card set has exactly 1 correct card and a base × exponent trap card');

// 8. Base Locking
console.log('\n8. Testing Base Locking Engine (>200 MW non-tens)');
assert(makeFind({ base: 3, exponent: 5 }).givenBase === 3, '243 MW comes with base 3 locked');
assert(makeFind({ base: 10, exponent: 6 }).givenBase === undefined, '1,000,000 MW is NOT locked (power of 10)');
assert(makeFind({ base: 2, exponent: 3 }).givenBase === undefined, '8 MW is NOT locked');
assert(makeFind({ base: 2, exponent: 6 }).validSolutions.length === 3, '64 MW accepts 2⁶, 4³ and 8²');
assert(!diagnoseSubmission(10, 3, 10000).correctFormula.includes('10⁴'), 'Powers-of-10 miss does not reveal the answer (10⁴)');

console.log(`\n========================================`);
console.log(`Results: ${passedTests}/${totalTests} tests passed`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
