/**
 * Vault Breaker: The GCF Heist - Problem Generator
 * Builds a fresh run each time, and targeted follow-up problems after a miss.
 *
 * Every pair is built as a = g·m, b = g·n with gcd(m, n) = 1, so the GCF is
 * exactly g by construction (tests re-check it with the Euclidean algorithm).
 */

import { getGCF, getGCFMany, getLCM, getCommonFactors, getAllFactorsSorted } from './factorLogic.js';
import { CURRICULUM_SECTORS } from './curriculum.js';

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

// Co-prime pairs that look like they should share something (both composite, or consecutive).
const COPRIME_TRAPS = [
  [8, 15], [9, 16], [14, 25], [15, 22], [20, 21], [15, 16], [21, 32], [25, 36],
  [27, 40], [35, 48], [16, 45], [28, 45], [10, 21], [12, 35], [26, 27], [49, 50],
];

/**
 * Picks two numbers with a known GCF for a sector.
 * @returns {[number, number]} (random order)
 */
export function makePair(rng, cfg, opts = {}) {
  const max = opts.max ?? cfg.max;
  if (!opts.noCoprime && rng() < (cfg.coprimeChance || 0)) {
    const fits = COPRIME_TRAPS.filter(([x, y]) => Math.max(x, y) <= max);
    if (fits.length) return shuffle(rng, pick(rng, fits));
  }
  for (let attempt = 0; attempt < 200; attempt++) {
    const g = pick(rng, cfg.gcfs);
    let m;
    let n;
    if (!opts.noDirect && rng() < (cfg.directMultipleChance || 0)) {
      m = 1;
      n = pick(rng, [2, 3, 4, 5]);
    } else {
      m = pick(rng, cfg.multipliers.filter((x) => x > 1));
      n = pick(rng, cfg.multipliers.filter((x) => x > 1));
    }
    if (m === n || getGCF(m, n) !== 1) continue;
    const a = g * m;
    const b = g * n;
    if (Math.max(a, b) > max) continue;
    if (opts.maxProduct && m * n > opts.maxProduct) continue;
    return shuffle(rng, [a, b]);
  }
  return [12, 18];
}

/** Three numbers whose GCF is g, chosen so at least one pair shares MORE than g (the trap). */
export function makeTriple(rng, cfg) {
  const trios = [[2, 3, 4], [2, 3, 5], [3, 4, 6], [2, 5, 6], [4, 6, 9], [3, 4, 10], [2, 3, 8], [4, 5, 6], [6, 9, 10]];
  for (let attempt = 0; attempt < 200; attempt++) {
    const g = pick(rng, [2, 3, 4, 5, 6, 8, 12]);
    const trio = pick(rng, trios);
    const nums = trio.map((k) => g * k);
    if (Math.max(...nums) > cfg.max) continue;
    if (getGCFMany(nums) !== g) continue;
    return shuffle(rng, nums);
  }
  return [24, 36, 60];
}

let idCounter = 0;
const nextId = (mode) => `${mode}-${++idCounter}`;

function factorHint(a, b) {
  return `Factors of ${a}: ${getAllFactorsSorted(a).join(', ')}. Which of these also divide ${b}?`;
}

// ------------------------------------------------------------------
// Problem builders
// ------------------------------------------------------------------

export function makeCrack(nums) {
  const [a, b] = nums;
  return {
    id: nextId('crack'),
    mode: 'crack',
    nums: [a, b],
    answer: getGCF(a, b),
    prompt: `Dial in GCF(${a}, ${b})`,
    hint: factorHint(a, b),
  };
}

export function makeCrack3(nums) {
  return {
    id: nextId('crack3'),
    mode: 'crack3',
    nums,
    answer: getGCFMany(nums),
    prompt: `Triple lock: GCF(${nums.join(', ')})`,
    hint: `Find GCF(${nums[0]}, ${nums[1]}) first, then check which of ITS factors also divide ${nums[2]}.`,
  };
}

const LOOT = [
  { a: 'gold bars', aIcon: '🪙', b: 'diamonds', bIcon: '💎' },
  { a: 'cash stacks', aIcon: '💵', b: 'gold bars', bIcon: '🪙' },
  { a: 'rubies', aIcon: '🔴', b: 'watches', bIcon: '⌚' },
  { a: 'pearls', aIcon: '⚪', b: 'cash stacks', bIcon: '💵' },
];

export function makeSplit(nums, rng) {
  const [a, b] = nums;
  const loot = pick(rng, LOOT);
  return {
    id: nextId('split'),
    mode: 'split',
    nums: [a, b],
    loot,
    answer: getGCF(a, b),
    prompt: `${a} ${loot.a} + ${b} ${loot.b}. Every bag must be identical, nothing left behind. What's the MOST bags you can fill?`,
    hint: `The number of bags has to divide BOTH ${a} and ${b} evenly.`,
  };
}

export function makeTile(nums) {
  const [w, h] = [Math.max(...nums), Math.min(...nums)];
  return {
    id: nextId('tile'),
    mode: 'tile',
    nums: [w, h],
    answer: getGCF(w, h),
    prompt: `Cover a ${w} ft × ${h} ft vault floor with identical square tiles, no cutting. What's the LARGEST tile side length?`,
    hint: `The tile side must fit evenly into ${w} AND ${h}. Try typing a size to see how it fits.`,
  };
}

export function makeFactor(nums) {
  const [a, b] = nums;
  const g = getGCF(a, b);
  return {
    id: nextId('factor'),
    mode: 'factor',
    nums: [a, b],
    answer: g,
    answerParts: [g, a / g, b / g],
    prompt: `Rewrite ${a} + ${b} as GCF × (sum)`,
    hint: `First find GCF(${a}, ${b}). Then divide ${a} and ${b} by it to fill the parentheses.`,
  };
}

/**
 * Spot the Real Key: 4 choices, one is the GCF.
 * Decoys: a smaller common factor, the LCM or a factor of only one number, and 1 or the difference.
 */
export function makeScan(nums, rng) {
  const [a, b] = nums;
  const g = getGCF(a, b);
  const common = getCommonFactors(a, b).filter((f) => f !== g);
  const onlyOne = [...getAllFactorsSorted(a), ...getAllFactorsSorted(b)]
    .filter((f) => !(a % f === 0 && b % f === 0) && f > g && f < Math.max(a, b));
  const decoys = new Set();
  const add = (v) => {
    if (v > 0 && v !== g && decoys.size < 3) decoys.add(v);
  };
  if (common.length > 1) add(pick(rng, common.filter((f) => f > 1)) ?? 1); // common, not greatest
  if (onlyOne.length) add(pick(rng, onlyOne)); // divides only one number
  const lcm = getLCM(a, b);
  if (lcm <= 999) add(lcm); // a multiple, not a factor
  add(Math.abs(a - b));
  add(1);
  // Anything above the GCF can't be a common factor, so these are always safe fillers.
  for (let k = 2; decoys.size < 3; k++) add(g * k);
  const choices = shuffle(rng, [g, ...decoys]);
  return {
    id: nextId('scan'),
    mode: 'scan',
    nums: [a, b],
    answer: g,
    choices,
    prompt: `Only one key is GCF(${a}, ${b}). Which one?`,
    hint: `Cross out any key that doesn't divide both ${a} and ${b}. Of what's left, take the biggest.`,
  };
}

/** Builds one problem of `mode` using sector settings. */
export function makeProblem(mode, rng, cfg, opts = {}) {
  switch (mode) {
    case 'crack3':
      return makeCrack3(makeTriple(rng, cfg));
    case 'split':
      return makeSplit(makePair(rng, cfg, { max: Math.min(cfg.max, 60), noDirect: true, ...opts }), rng);
    case 'tile':
      // Keep the floor grid readable: at most 7 × 5 tiles at the GCF size.
      return makeTile(makePair(rng, cfg, { max: Math.min(cfg.max, 84), maxProduct: 35, noDirect: true, ...opts }));
    case 'factor':
      return makeFactor(makePair(rng, cfg, { noDirect: true, noCoprime: true, ...opts }));
    case 'scan':
      return makeScan(makePair(rng, cfg, opts), rng);
    case 'crack':
    default:
      return makeCrack(makePair(rng, cfg, opts));
  }
}

/** Builds the whole run: one list of problems per sector. No exact repeats within a run. */
export function buildRun(seed = Date.now()) {
  const rng = createRng(seed);
  const seen = new Set();
  return CURRICULUM_SECTORS.map((sector) => {
    const modes = sector.isBossSector ? sector.modes : shuffle(rng, sector.modes);
    return modes.map((mode) => {
      let p;
      for (let tries = 0; tries < 20; tries++) {
        p = makeProblem(mode, rng, sector.numbers);
        const key = `${p.mode}:${[...p.nums].sort((x, y) => x - y).join(',')}`;
        if (!seen.has(key)) {
          seen.add(key);
          break;
        }
      }
      return p;
    });
  });
}

/**
 * A follow-up problem aimed at the mistake just made.
 * Returns null when there's no useful targeted follow-up.
 */
export function makeFollowUp(problem, code, rng, cfg) {
  switch (code) {
    case 'COMMON_NOT_GREATEST':
    case 'NOT_GREATEST':
      // Same job type, numbers with a big GCF so "settling" for a small factor is tempting again.
      return makeProblem(problem.mode, rng, { ...cfg, gcfs: cfg.gcfs.filter((g) => g >= 6).length ? cfg.gcfs.filter((g) => g >= 6) : cfg.gcfs, coprimeChance: 0 });
    case 'LCM_MIXUP':
    case 'TOO_BIG':
      return makeScan(makePair(rng, cfg, { noCoprime: true }), rng);
    case 'DIVIDES_SOME':
    case 'DIVIDES_NONE':
    case 'WRONG_PRODUCT':
      return makeProblem(problem.mode === 'crack3' ? 'crack' : problem.mode, rng, cfg);
    default:
      return null;
  }
}
