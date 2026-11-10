/**
 * Verification Test Suite for Vault Breaker: GCF Tumbler (Tightened Core Pillars Edition)
 * Validates factor pairs, live common factor bridge, smart pin tile generation,
 * GCF distributive factoring breakdown, co-prime traps, boss dilemmas,
 * and multi-format input parsing ($15, 15, 15.00).
 */

import {
  parseMathInput,
  parseFactorPairString,
  getFactorPairs,
  getAllFactorsSorted,
  getCommonFactors,
  getDiscoveredFactors,
  getDiscoveredCommonFactors,
  generateCandidateTiles,
  getGCF,
  get3WayGCF,
  validateFactor,
  validateFactorPair,
  evaluateMasterKeySelection,
  getGCFMany,
  diagnoseGCFAnswer,
  evaluateSplit,
  evaluateTile,
  evaluateFactorOut,
} from './js/factorLogic.js';

import { CURRICULUM_SECTORS, MODE_INFO } from './js/curriculum.js';
import { buildRun, makeFollowUp, makeProblem, createRng } from './js/generator.js';

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

console.log('🧪 Starting Vault Breaker: GCF Heist Verification Suite...\n');

// 1. Multi-format math input parsing (Rule 3)
console.log('1. Testing Multi-Format Math Input Parsing ($15, 15, 15.00)');
assert(parseMathInput(15) === 15, 'Parses numeric 15');
assert(parseMathInput('15') === 15, 'Parses string "15"');
assert(parseMathInput('$15') === 15, 'Parses currency "$15"');
assert(parseMathInput('15.00') === 15, 'Parses decimal "15.00"');
assert(parseMathInput(' $15.00 ') === 15, 'Parses padded " $15.00 "');
assert(parseMathInput('$1,000') === 1000, 'Parses comma-separated "$1,000"');
assert(isNaN(parseMathInput('abc')), 'Rejects non-numeric string "abc"');
assert(isNaN(parseMathInput('')), 'Rejects empty string');

// Pair string parser
const pairParsed1 = parseFactorPairString('3 x 8');
assert(pairParsed1 && pairParsed1.a === 3 && pairParsed1.b === 8, 'Parses "3 x 8"');

const pairParsed2 = parseFactorPairString('$3.00 * $8.00');
assert(pairParsed2 && pairParsed2.a === 3 && pairParsed2.b === 8, 'Parses "$3.00 * $8.00"');

const pairParsed3 = parseFactorPairString('4, 4');
assert(pairParsed3 && pairParsed3.a === 4 && pairParsed3.b === 4, 'Parses comma-separated "4, 4"');

// 2. Factor Pairs and Rainbow Logic
console.log('\n2. Testing Factor Pair Generation & Rainbow Pairs');
const pairs4 = getFactorPairs(4);
assert(pairs4.length === 2, '4 has 2 factor pairs');
assert(pairs4[0].a === 1 && pairs4[0].b === 4, '4 pair 1: 1 × 4');
assert(pairs4[1].a === 2 && pairs4[1].b === 2 && pairs4[1].isSquare === true, '4 pair 2: 2 × 2 is a square factor');

const pairs16 = getFactorPairs(16);
assert(pairs16.length === 3, '16 has 3 factor pairs');
assert(pairs16.some(p => p.isSquare && p.a === 4 && p.b === 4), '16 identifies 4 × 4 as square factor');

const pairs24 = getFactorPairs(24);
assert(pairs24.length === 4, '24 has 4 factor pairs: 1x24, 2x12, 3x8, 4x6');

const pairs48 = getFactorPairs(48);
assert(pairs48.length === 5, '48 has 5 factor pairs: 1x48, 2x24, 3x16, 4x12, 6x8');

const pairs72 = getFactorPairs(72);
assert(pairs72.length === 6, '72 has 6 factor pairs: 1x72, 2x36, 3x24, 4x18, 6x12, 8x9');

// 3. Live Common Factor Bridge & Smart Pin Tile Matrix
console.log('\n3. Testing Live Common Factor Bridge & Smart Pin Tile Matrix');
const unlockedA = [{ a: 1, b: 12 }, { a: 3, b: 4 }];
const unlockedB = [{ a: 1, b: 16 }, { a: 4, b: 4 }];
const liveShared = getDiscoveredCommonFactors(unlockedA, unlockedB);
assert(
  JSON.stringify(liveShared) === JSON.stringify([1, 4]),
  'Live Common Factor Bridge detects [1, 4] when (1,12),(3,4) and (1,16),(4,4) are unlocked'
);

for (const [numA, numB] of [[4, 12], [12, 16], [18, 24], [30, 45], [15, 16], [48, 72]]) {
  const tiles = generateCandidateTiles(numA, numB);
  const allA = getAllFactorsSorted(numA);
  const allB = getAllFactorsSorted(numB);
  assert(
    allA.every(f => tiles.includes(f)) && allB.every(f => tiles.includes(f)),
    `Pin Tile Matrix for (${numA}, ${numB}) contains 100% of true factors (${tiles.length} tiles)`
  );
}

// 4. Common Factors and GCF Calculations
console.log('\n4. Testing Common Factors and GCF Calculations');
assert(getGCF(4, 12) === 4, 'GCF(4, 12) = 4 (Direct Multiple)');
assert(getGCF(6, 18) === 6, 'GCF(6, 18) = 6 (Direct Multiple)');
assert(getGCF(12, 16) === 4, 'GCF(12, 16) = 4');
assert(getGCF(18, 24) === 6, 'GCF(18, 24) = 6');
assert(getGCF(24, 36) === 12, 'GCF(24, 36) = 12');
assert(getGCF(30, 45) === 15, 'GCF(30, 45) = 15');
assert(getGCF(15, 16) === 1, 'GCF(15, 16) = 1 (Co-Prime consecutive numbers)');
assert(getGCF(20, 21) === 1, 'GCF(20, 21) = 1 (Co-Prime consecutive numbers)');
const common15_16 = getCommonFactors(15, 16);
assert(
  common15_16.length === 1 && common15_16[0] === 1,
  'Common factors of 15 & 16 is strictly [1]'
);
assert(getGCF(48, 72) === 24, 'GCF(48, 72) = 24 (Boss Dreadnought)');
assert(get3WayGCF(24, 36, 60) === 12, '3-Way GCF(24, 36, 60) = 12 (Boss 3-way dilemma)');

// 5. Explicit Factor Pair Input Validation (Both Numbers Entered)
console.log('\n5. Testing Explicit Factor Pair Input Validation (a × b = target)');
const validPair1 = validateFactorPair(24, 3, 8);
assert(validPair1.isValid && validPair1.pair.a === 3 && validPair1.pair.b === 8, '3 × 8 for 24 is valid');

const validPairInverted = validateFactorPair(24, 8, 3);
assert(validPairInverted.isValid && validPairInverted.pair.a === 3 && validPairInverted.pair.b === 8, '8 × 3 for 24 canonically aligns to 3 × 8');

const validSquare = validateFactorPair(16, '$4.00', '4');
assert(validSquare.isValid && validSquare.pair.isSquare === true, '"$4.00" × "4" for 16 is valid square pair');

const alreadyFoundPairs = [{ a: 3, b: 8 }];
const duplicatePair = validateFactorPair(24, 8, 3, alreadyFoundPairs);
assert(duplicatePair.isValid && duplicatePair.isAlreadyFound === true, 'Detects duplicate factor pair');

const mismatchPair = validateFactorPair(24, 3, 7);
assert(!mismatchPair.isValid && mismatchPair.diagnosticCode === 'PARTIAL_FACTOR_A', '3 × 7 for 24 diagnoses partial factor (3 is factor, but 24/3 = 8)');

const bothWrongPair = validateFactorPair(24, 5, 5);
assert(!bothWrongPair.isValid && bothWrongPair.product !== 24, '5 × 5 for 24 diagnoses product mismatch');

const valRemainder = validateFactor(24, 5);
assert(!valRemainder.isValid && valRemainder.remainder === 4, 'Legacy helper: non-factor 5 for 24 yields remainder 4');

// 6. Master Key Strike Torque & Distributive Property Breakdown
console.log('\n6. Testing Master Key Torque & GCF Distributive Breakdown');
// Target: 24 and 36, GCF = 12. Common factors: 1, 2, 3, 4, 6, 12
const strikeGCF = evaluateMasterKeySelection(12, 24, 36);
assert(strikeGCF.isGCF === true && strikeGCF.torqueRatio === 1.0, 'Selecting exact GCF (12) provides maximum torque');
assert(
  strikeGCF.distributiveBreakdown === '24 + 36 = 12(2 + 3)',
  'Returns Distributive Property factoring breakdown: "24 + 36 = 12(2 + 3)"'
);

const strikeCommonInsufficient = evaluateMasterKeySelection(6, 24, 36);
assert(
  strikeCommonInsufficient.isGCF === false &&
  strikeCommonInsufficient.isCommonFactor === true &&
  strikeCommonInsufficient.remainingGCF === 2,
  'Selecting 6 for (24, 36) diagnoses that remaining quotients (4 and 6) still share factor 2'
);

const strikeInvalid = evaluateMasterKeySelection(8, 24, 36);
assert(
  strikeInvalid.isGCF === false &&
  strikeInvalid.isCommonFactor === false,
  'Selecting non-common factor 8 diagnoses access denied'
);

// 7. Heist evaluators
console.log('\n7. Testing Heist Evaluators (diagnosis, split, tile, factor out)');
assert(getGCFMany([24, 36, 60]) === 12, 'getGCFMany(24, 36, 60) = 12');
assert(diagnoseGCFAnswer(6, [18, 24]).code === 'CORRECT', 'Diagnose: 6 is GCF(18, 24)');
assert(diagnoseGCFAnswer('$6.00', [18, 24]).code === 'CORRECT', 'Diagnose accepts "$6.00"');
const d3 = diagnoseGCFAnswer(3, [18, 24]);
assert(d3.code === 'COMMON_NOT_GREATEST' && d3.leftover === 2, 'Diagnose: 3 for (18, 24) is common, leftovers 6 and 8 still share 2');
assert(diagnoseGCFAnswer(72, [18, 24]).code === 'LCM_MIXUP', 'Diagnose: 72 for (18, 24) is the LCM mix-up');
assert(diagnoseGCFAnswer(20, [18, 24]).code === 'TOO_BIG', 'Diagnose: 20 for (18, 24) is too big');
assert(diagnoseGCFAnswer(9, [18, 24]).code === 'DIVIDES_SOME', 'Diagnose: 9 divides 18 but not 24');
assert(diagnoseGCFAnswer(5, [18, 24]).code === 'DIVIDES_NONE', 'Diagnose: 5 divides neither');
assert(diagnoseGCFAnswer(1, [15, 16]).code === 'CORRECT', 'Diagnose: co-prime (15, 16) GCF is 1');
assert(diagnoseGCFAnswer(6, [24, 36, 60]).code === 'COMMON_NOT_GREATEST', 'Diagnose: 6 for (24, 36, 60) is not greatest');
assert(diagnoseGCFAnswer('abc', [18, 24]).code === 'INVALID', 'Diagnose rejects "abc"');

const sp = evaluateSplit(6, 18, 24);
assert(sp.clean && sp.isMax && sp.perBagA === 3 && sp.perBagB === 4, 'Split 18 & 24 into 6 bags: 3 + 4 each, max');
const sp3 = evaluateSplit(3, 18, 24);
assert(sp3.clean && !sp3.isMax, 'Split into 3 bags is clean but not the max');
const sp5 = evaluateSplit(5, 18, 24);
assert(!sp5.clean && sp5.leftoverA === 3 && sp5.leftoverB === 4, 'Split into 5 bags leaves 3 and 4 behind');

const t12 = evaluateTile(12, 48, 36);
assert(t12.fits && t12.isLargest && t12.cols === 4 && t12.rows === 3, '12 ft tiles fit 48 × 36 as 4 × 3, largest');
const t6 = evaluateTile(6, 48, 36);
assert(t6.fits && !t6.isLargest, '6 ft tiles fit 48 × 36 but are not the largest');
const t10 = evaluateTile(10, 48, 36);
assert(!t10.fits && t10.leftoverW === 8 && t10.leftoverH === 6, '10 ft tiles leave 8 ft and 6 ft gaps');

assert(evaluateFactorOut(12, 2, 3, 24, 36).code === 'CORRECT', '24 + 36 = 12(2 + 3)');
assert(evaluateFactorOut('6', '4', '6', 24, 36).code === 'NOT_GREATEST', '24 + 36 = 6(4 + 6) is equal but not the GCF');
assert(evaluateFactorOut(12, 2, 4, 24, 36).code === 'WRONG_PRODUCT', '12(2 + 4) does not rebuild 24 + 36');
assert(evaluateFactorOut(12, '', 3, 24, 36).code === 'INCOMPLETE', 'Empty box is incomplete');

// 8. Sectors & generator
console.log('\n8. Testing Sectors & Randomized Run Generator (500 seeds)');
assert(CURRICULUM_SECTORS.length === 5, 'Five sectors: four floors + boss');
assert(CURRICULUM_SECTORS[4].isBossSector && CURRICULUM_SECTORS[4].bossHp === CURRICULUM_SECTORS[4].modes.length, 'Boss HP equals its job count');
for (const sector of CURRICULUM_SECTORS) {
  assert(sector.timeLimit >= 30 && sector.heatPerMiss > 0, `${sector.name}: timer ${sector.timeLimit}s, heat +${sector.heatPerMiss}%`);
  assert(sector.waves === sector.modes.length && sector.modes.every(m => MODE_INFO[m]), `${sector.name}: ${sector.waves} valid jobs`);
}

let genProblems = 0;
let genFailures = [];
let sawCoprime = false;
let sawDirect = false;
for (let seed = 1; seed <= 500; seed++) {
  const run = buildRun(seed);
  run.forEach((jobs, si) => {
    const sector = CURRICULUM_SECTORS[si];
    if (jobs.length !== sector.modes.length) genFailures.push(`seed ${seed} sector ${si} job count`);
    const keys = new Set();
    for (const p of jobs) {
      genProblems++;
      const g = getGCFMany(p.nums);
      if (g !== p.answer) genFailures.push(`seed ${seed}: ${p.mode} ${p.nums} answer ${p.answer} != ${g}`);
      if (Math.max(...p.nums) > sector.numbers.max) genFailures.push(`seed ${seed}: ${p.nums} over max`);
      if (p.nums.some(n => n < 2)) genFailures.push(`seed ${seed}: ${p.nums} has a number < 2`);
      if (Math.max(...p.nums) > 999) genFailures.push(`seed ${seed}: ${p.nums} won't fit the 3-digit keypad`);
      if (p.mode === 'factor') {
        const [gg, m, n] = p.answerParts;
        if (gg * m !== p.nums[0] || gg * n !== p.nums[1] || gg === 1) genFailures.push(`seed ${seed}: bad factor ${p.nums}`);
      }
      if (p.mode === 'scan') {
        if (p.choices.length !== 4 || new Set(p.choices).size !== 4) genFailures.push(`seed ${seed}: scan choices ${p.choices}`);
        if (p.choices.filter(c => c === p.answer).length !== 1) genFailures.push(`seed ${seed}: scan answer count`);
        if (p.choices.some(c => c > 999)) genFailures.push(`seed ${seed}: scan choice too big`);
      }
      if (p.mode === 'tile') {
        const [w, h] = p.nums;
        if (w < h) genFailures.push(`seed ${seed}: tile width < height`);
      }
      if (p.mode === 'split' && !p.loot) genFailures.push(`seed ${seed}: split missing loot`);
      if (p.mode === 'crack3' && p.nums.length !== 3) genFailures.push(`seed ${seed}: crack3 needs 3 numbers`);
      if (g === 1) sawCoprime = true;
      if (p.nums.length === 2 && Math.max(...p.nums) % Math.min(...p.nums) === 0) sawDirect = true;
      const key = `${p.mode}:${[...p.nums].sort((a, b) => a - b)}`;
      keys.add(key);
    }
  });
}
assert(genFailures.length === 0, `All ${genProblems} generated jobs valid${genFailures.length ? ': ' + genFailures.slice(0, 5).join(' | ') : ''}`);
assert(sawCoprime, 'Generator produces co-prime traps (GCF = 1)');
assert(sawDirect, 'Generator produces direct-multiple pairs');
assert(buildRun(42).flat().map(p => p.nums.join(',')).join('|') !== buildRun(43).flat().map(p => p.nums.join(',')).join('|'), 'Different seeds give different runs');
const runA = buildRun(7).flat().map(p => p.nums.join(',')).join('|');
const runB = buildRun(7).flat().map(p => p.nums.join(',')).join('|');
assert(runA === runB, 'Same seed gives the same run (reproducible)');

const rng = createRng(99);
const cfg3 = CURRICULUM_SECTORS[2].numbers;
const factorJob = makeProblem('factor', rng, cfg3);
const fuNG = makeFollowUp(factorJob, 'NOT_GREATEST', rng, cfg3);
assert(fuNG && fuNG.mode === 'factor' && fuNG.answer >= 6, 'NOT_GREATEST follow-up: another factor job with a big GCF');
const fuLcm = makeFollowUp(makeProblem('crack', rng, cfg3), 'LCM_MIXUP', rng, cfg3);
assert(fuLcm && fuLcm.mode === 'scan', 'LCM mix-up follow-up is a Spot-the-Key job');
assert(makeFollowUp(factorJob, 'INVALID', rng, cfg3) === null, 'No follow-up for invalid input');

console.log(`\n========================================`);
console.log(`Results: ${passedTests}/${totalTests} tests passed`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
