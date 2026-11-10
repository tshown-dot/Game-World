/**
 * Verification suite for Grid Sync: The LCM Substation
 * 1. Multi-format input parsing ($15, 15, 15.00, ...)
 * 2. GCD / LCM math
 * 3. Answer diagnosis (product, common-not-least, GCF mix-up, too small, some, none)
 * 4. Supply Run, race events, Missing Generator checks
 * 5. Sector configuration
 * 6. Generator: 500 seeded runs, every answer re-checked, every choice set has exactly one right answer
 */

import {
  parseMathInput,
  gcd,
  lcm,
  lcmMany,
  gcdMany,
  getMultiples,
  getCommonMultiples,
  diagnoseLCMAnswer,
  diagnoseGCFAnswer,
  evaluateSupply,
  buildRace,
  evaluateReverse,
} from './js/lcmLogic.js';
import { CURRICULUM_SECTORS, MODE_INFO, BACKUP_CELLS } from './js/curriculum.js';
import { createRng, buildRun, buildSector, makeProblem, makeFollowUp, makePair, makeTriple, lcmTraps } from './js/generator.js';

let total = 0;
let passed = 0;
const failures = [];
function assert(condition, message) {
  total++;
  if (condition) passed++;
  else failures.push(message);
}
function section(name) {
  console.log(`\n${name}`);
}

console.log('🧪 Grid Sync: The LCM Substation - verification suite');

// 1. Parsing
section('1. Multi-format input parsing');
assert(parseMathInput(15) === 15, 'numeric 15');
assert(parseMathInput('15') === 15, '"15"');
assert(parseMathInput('$15') === 15, '"$15"');
assert(parseMathInput('15.00') === 15, '"15.00"');
assert(parseMathInput(' $15.00 ') === 15, '" $15.00 "');
assert(parseMathInput('$1,000') === 1000, '"$1,000"');
assert(parseMathInput('72%') === 72, '"72%"');
assert(isNaN(parseMathInput('abc')), 'rejects "abc"');
assert(isNaN(parseMathInput('')), 'rejects empty');
assert(isNaN(parseMathInput(null)), 'rejects null');

// 2. Math
section('2. GCD / LCM');
assert(gcd(12, 18) === 6, 'gcd(12, 18) = 6');
assert(gcd(7, 8) === 1, 'gcd(7, 8) = 1');
assert(lcm(3, 6) === 6, 'lcm(3, 6) = 6 (direct multiple)');
assert(lcm(4, 6) === 12, 'lcm(4, 6) = 12 (shared factor)');
assert(lcm(6, 8) === 24, 'lcm(6, 8) = 24');
assert(lcm(4, 5) === 20, 'lcm(4, 5) = 20 (co-prime)');
assert(lcmMany([2, 3, 4]) === 12, 'lcm(2, 3, 4) = 12');
assert(lcmMany([4, 6, 9]) === 36, 'lcm(4, 6, 9) = 36');
assert(lcmMany([12, 18, 24]) === 72, 'lcm(12, 18, 24) = 72');
assert(gcdMany([12, 18, 24]) === 6, 'gcd(12, 18, 24) = 6');
assert(JSON.stringify(getMultiples(4, 20)) === '[4,8,12,16,20]', 'multiples of 4 to 20');
assert(JSON.stringify(getCommonMultiples([4, 6], 50)) === '[12,24,36,48]', 'common multiples of 4, 6 to 50');

// 3. Diagnosis
section('3. Answer diagnosis');
const d = (x, nums) => diagnoseLCMAnswer(x, nums);
assert(d(12, [4, 6]).isCorrect, '12 correct for 4, 6');
assert(d('$12.00', [4, 6]).isCorrect, '"$12.00" correct for 4, 6');
assert(d(24, [4, 6]).code === 'PRODUCT', '24 = 4 × 6 → PRODUCT');
assert(d(36, [4, 6]).code === 'COMMON_NOT_LEAST', '36 → COMMON_NOT_LEAST');
assert(d(36, [4, 6]).smaller === 12 || d(36, [4, 6]).smaller === 18, '36 → points at a smaller common multiple');
assert(d(48, [4, 6]).smaller === 24, '48 → 24 also works');
assert(d(2, [4, 6]).code === 'GCF_MIXUP', '2 → GCF_MIXUP');
assert(d(3, [4, 6]).code === 'TOO_SMALL', '3 → TOO_SMALL');
assert(d(16, [4, 6]).code === 'SOME', '16 → SOME (multiple of 4 only)');
assert(d(17, [4, 6]).code === 'NONE', '17 → NONE');
assert(d(0, [4, 6]).code === 'INVALID', '0 → INVALID');
assert(d('2.5', [4, 6]).code === 'INVALID', '2.5 → INVALID');
assert(d(20, [4, 5]).isCorrect, 'co-prime: 20 correct for 4, 5');
assert(d(12, [3, 4, 6]).isCorrect, 'triple: 12 correct for 3, 4, 6');
assert(d(72, [3, 4, 6]).code === 'PRODUCT', 'triple: 72 → PRODUCT');
assert(d(24, [3, 4, 6]).code === 'COMMON_NOT_LEAST', 'triple: 24 → COMMON_NOT_LEAST');
assert(d(18, [2, 3, 4]).code === 'SOME', 'triple: 18 → SOME (misses 4)');
assert(d(12, [4, 6]).message.includes('12'), 'correct message names the LCM');
assert(d(24, [4, 6]).message.includes('12'), 'miss message names the LCM');
assert(diagnoseGCFAnswer(6, [12, 18]).isCorrect, 'GCF(12, 18) = 6');
assert(diagnoseGCFAnswer(36, [12, 18]).code === 'LCM_MIXUP', 'GCF job: 36 → LCM_MIXUP');
assert(diagnoseGCFAnswer(3, [12, 18]).code === 'COMMON_NOT_GREATEST', 'GCF job: 3 → COMMON_NOT_GREATEST');
assert(diagnoseGCFAnswer(5, [12, 18]).code === 'NOT_FACTOR', 'GCF job: 5 → NOT_FACTOR');

// 4. Supply, race, reverse
section('4. Supply Run, race events, Missing Generator');
const s24 = evaluateSupply(24, 8, 12);
assert(s24.clean && s24.packsA === 3 && s24.packsB === 2, '24 with packs of 8 and 12: 3 and 2 packs, clean');
const s20 = evaluateSupply('20', 8, 12);
assert(!s20.clean && s20.remA === 4 && s20.remB === 8, '20: leftovers 4 and 8');
assert(evaluateSupply('abc', 8, 12).total === 0, 'supply rejects junk');

const race = buildRace([4, 6], 12);
assert(JSON.stringify(race.map((e) => e.at)) === '[4,6,8,12]', 'race 4 & 6 to 12 lands at 4, 6, 8, 12');
assert(race[race.length - 1].lanes.length === 2, 'both lanes land at 12');
const race3 = buildRace([2, 3, 4], 12);
assert(race3.find((e) => e.at === 6).lanes.length === 2, 'tri race: 2 of 3 meet at 6');
assert(race3.find((e) => e.at === 12).lanes.length === 3, 'tri race: all 3 meet at 12');

assert(evaluateReverse(8, 6, 24).isCorrect, 'reverse: 6 & 8 meet at 24');
assert(evaluateReverse(12, 6, 24).code === 'MEETS_EARLY', 'reverse: 6 & 12 meet early (12)');
assert(evaluateReverse(9, 6, 24).code === 'MEETS_EARLY', 'reverse: 6 & 9 meet early (18)');
assert(evaluateReverse(7, 6, 24).code === 'MEETS_LATE', 'reverse: 6 & 7 meet late (42)');

// 5. Sectors
section('5. Sector configuration');
assert(CURRICULUM_SECTORS.length === 5, '5 sectors (4 lines + boss)');
assert(CURRICULUM_SECTORS[4].isBossSector && CURRICULUM_SECTORS[4].bossHp === 8, 'boss sector with 8 coils');
assert(BACKUP_CELLS === 3, '3 backup cells');
for (const s of CURRICULUM_SECTORS) {
  assert(s.timeLimit >= 30, `${s.badge}: time limit ${s.timeLimit}s`);
  assert(s.modes.every((m) => MODE_INFO[m]), `${s.badge}: every mode is known`);
  assert(s.modes.length >= 5, `${s.badge}: at least 5 jobs`);
}
assert(CURRICULUM_SECTORS.slice(0, 4).every((s) => !s.modes.includes('sync3') || s.numbers.triple), 'sectors with tri-phase jobs define triple limits');

// 6. Generator
section('6. Generator (500 seeded runs)');
let checked = 0;
const bad = [];
const check = (cond, msg) => { if (!cond && bad.length < 10) bad.push(msg); };
const checkProblem = (p, cfg, where) => {
  checked++;
  const tag = `${where} ${p.mode} ${JSON.stringify(p.nums)}`;
  check(p.prompt && p.hint, `${tag}: has prompt and hint`);
  switch (p.mode) {
    case 'sync':
    case 'supply':
    case 'scan':
      check(p.nums.length === 2 && p.nums[0] !== p.nums[1], `${tag}: two different numbers`);
      check(p.answer === lcm(p.nums[0], p.nums[1]), `${tag}: answer is the LCM`);
      check(Math.min(...p.nums) >= 2, `${tag}: no 1s`);
      check(Math.max(...p.nums) <= cfg.maxNum, `${tag}: within maxNum`);
      check(p.answer <= cfg.maxLcm, `${tag}: LCM within maxLcm`);
      break;
    case 'sync3': {
      const t = cfg.triple;
      check(p.nums.length === 3 && new Set(p.nums).size === 3, `${tag}: three different numbers`);
      check(p.answer === lcmMany(p.nums), `${tag}: answer is the LCM`);
      check(p.answer > Math.max(...p.nums), `${tag}: LCM bigger than every number`);
      check(p.answer <= t.maxLcm, `${tag}: within triple maxLcm`);
      check(Math.min(...p.nums) >= (t.minNum || 2) && Math.max(...p.nums) <= t.maxNum, `${tag}: within triple number range`);
      check([[0, 1], [0, 2], [1, 2]].some(([i, j]) => lcm(p.nums[i], p.nums[j]) < p.answer), `${tag}: a pair meets early (trap)`);
      break;
    }
    case 'tool':
      check(p.tool === 'gcf' || p.tool === 'lcm', `${tag}: tool set`);
      check(p.answer === (p.tool === 'gcf' ? gcd(...p.nums) : lcm(...p.nums)), `${tag}: answer matches tool`);
      if (p.tool === 'gcf') check(p.answer > 1, `${tag}: GCF stories share a factor`);
      break;
    case 'reverse': {
      const a = p.nums[0];
      const right = p.choices.filter((c) => lcm(a, c) === p.target);
      check(right.length === 1 && right[0] === p.answer, `${tag}: exactly one Beta works`);
      check(new Set(p.choices).size === 4, `${tag}: 4 distinct choices`);
      check(p.target > a && p.target > p.answer, `${tag}: target bigger than both`);
      break;
    }
    default:
      check(false, `${tag}: unknown mode`);
  }
  if (p.mode === 'scan') {
    check(p.choices.length === 4 && new Set(p.choices).size === 4, `${tag}: 4 distinct choices`);
    check(p.choices.filter((c) => diagnoseLCMAnswer(c, p.nums).isCorrect).length === 1, `${tag}: exactly one correct choice`);
  }
};

for (let seed = 1; seed <= 500; seed++) {
  const run = buildRun(seed);
  check(run.length === CURRICULUM_SECTORS.length, `seed ${seed}: one list per sector`);
  run.forEach((list, i) => {
    const s = CURRICULUM_SECTORS[i];
    check(list.length === s.modes.length, `seed ${seed} ${s.badge}: job count`);
    list.forEach((p, j) => {
      check(p.mode === s.modes[j] || (s.modes[j] === 'sync3' && p.mode === 'sync3'), `seed ${seed} ${s.badge}: mode order`);
      checkProblem(p, s.numbers, `seed ${seed} ${s.badge}`);
    });
  });
}
const run7 = buildRun(7).flat();
assert(new Set(run7.map((p) => p.id)).size === run7.length, 'problem ids are unique within a run');
assert(bad.length === 0, `all ${checked} generated problems valid${bad.length ? `: ${bad.join(' | ')}` : ''}`);

// Follow-ups target the mistake
const rng = createRng(99);
const cfg2 = CURRICULUM_SECTORS[1].numbers;
let fuOk = true;
for (let i = 0; i < 200; i++) {
  const base = makeProblem('sync', rng, cfg2);
  const fu = makeFollowUp(base, 'PRODUCT', rng, cfg2);
  if (!(fu.mode === 'sync' && gcd(...fu.nums) > 1 && fu.answer < fu.nums[0] * fu.nums[1] && fu.answer > Math.max(...fu.nums))) fuOk = false;
}
assert(fuOk, 'PRODUCT follow-ups use numbers that share a factor (LCM < product)');
const gfu = makeFollowUp(makeProblem('sync', rng, cfg2), 'GCF_MIXUP', rng, cfg2);
assert(gfu.mode === 'scan' && gfu.choices.includes(gcd(...gfu.nums)), 'GCF_MIXUP follow-up is a scan that includes the GCF trap');
const tfu = makeFollowUp(makeProblem('tool', rng, CURRICULUM_SECTORS[2].numbers, { tool: 'gcf' }), 'TOOL_MIXUP', rng, CURRICULUM_SECTORS[2].numbers);
assert(tfu.mode === 'tool' && tfu.tool === 'gcf', 'TOOL_MIXUP follow-up repeats the same tool');
assert(buildSector(3, 5).length === CURRICULUM_SECTORS[3].modes.length, 'buildSector rebuilds one line');

// Traps
const traps = lcmTraps([4, 6]);
assert(traps[0] === 24 && traps.includes(2), 'traps for 4, 6 lead with the product and include the GCF');
assert(!traps.includes(12), 'traps never include the LCM');
assert(makePair(createRng(3), cfg2, { shared: true }).length === 2, 'makePair returns a pair');
assert(makeTriple(createRng(3), CURRICULUM_SECTORS[3].numbers).length === 3, 'makeTriple returns three numbers');

console.log(`\n========================================`);
console.log(`Results: ${passed}/${total} tests passed (${checked} generated problems checked)`);
console.log(`========================================`);
if (failures.length) {
  failures.forEach((f) => console.error(`  ✗ ${f}`));
  process.exit(1);
}
