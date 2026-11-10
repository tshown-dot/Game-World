/**
 * Grid Sync: The LCM Substation - Problem Generator
 * Builds a fresh run each time, plus targeted follow-up problems after a miss.
 *
 * Pairs are built as a = g·m, b = g·n with gcd(m, n) = 1, so LCM = g·m·n by construction
 * (the tests re-check every answer with the Euclidean algorithm).
 */

import { gcd, lcm, lcmMany, gcdMany, getMultiples } from './lcmLogic.js?v=20261110lcm2';
import { CURRICULUM_SECTORS } from './curriculum.js?v=20261110lcm2';

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

let idCounter = 0;
const nextId = (mode) => `${mode}-${++idCounter}`;

// ------------------------------------------------------------------
// Numbers
// ------------------------------------------------------------------

/**
 * Two different numbers with a known LCM.
 * opts.shared   - must share a factor and neither divides the other (LCM < product, LCM > both)
 * opts.noDirect - neither number divides the other
 * opts.maxLcm / opts.maxNum - tighter limits
 */
export function makePair(rng, cfg, opts = {}) {
  const maxNum = opts.maxNum ?? cfg.maxNum;
  const maxLcm = opts.maxLcm ?? cfg.maxLcm;
  for (let attempt = 0; attempt < 400; attempt++) {
    let a;
    let b;
    if (!opts.shared && rng() < (cfg.coprimeChance || 0)) {
      const lo = maxNum > 12 ? 3 : 2; // later lines skip the trivial 2
      const hi = Math.min(maxNum, 12);
      a = lo + Math.floor(rng() * (hi - lo + 1));
      b = lo + Math.floor(rng() * (hi - lo + 1));
      if (gcd(a, b) !== 1) continue;
    } else {
      const g = pick(rng, cfg.gs);
      let m;
      let n;
      if (!opts.shared && !opts.noDirect && rng() < (cfg.directChance || 0)) {
        m = 1;
        n = pick(rng, [2, 3, 4]);
      } else {
        const ms = cfg.ms.filter((x) => x > 1);
        m = pick(rng, ms);
        n = pick(rng, ms);
      }
      if (gcd(m, n) !== 1) continue;
      a = g * m;
      b = g * n;
      if (opts.shared && g < 2) continue;
    }
    if (a === b || Math.min(a, b) < 2 || Math.max(a, b) > maxNum) continue;
    const L = lcm(a, b);
    if (L > maxLcm) continue;
    if ((opts.shared || opts.noDirect) && L === Math.max(a, b)) continue;
    if (opts.shared && L === a * b) continue;
    return shuffle(rng, [a, b]);
  }
  return opts.shared ? [4, 6] : [3, 4];
}

/**
 * Three different numbers whose LCM is bigger than all of them, where at least one PAIR
 * meets earlier than all three do (the tri-phase trap).
 */
export function makeTriple(rng, cfg) {
  const t = cfg.triple || { maxNum: 12, maxLcm: 72 };
  for (let attempt = 0; attempt < 600; attempt++) {
    const lo = t.minNum || 2;
    const nums = [0, 0, 0].map(() => lo + Math.floor(rng() * (t.maxNum - lo + 1)));
    if (new Set(nums).size < 3) continue;
    const L = lcmMany(nums);
    if (L > t.maxLcm || L === Math.max(...nums)) continue;
    const pairEarly = [[0, 1], [0, 2], [1, 2]].some(([i, j]) => lcm(nums[i], nums[j]) < L);
    if (!pairEarly) continue;
    if (nums.includes(2) && rng() < 0.6) continue; // 2 makes things too easy; allow it sometimes
    return nums;
  }
  return [4, 6, 9];
}

// ------------------------------------------------------------------
// Stories
// ------------------------------------------------------------------

const SYNC_STORIES = [
  {
    kind: 'bus', unit: 'min', icons: ['🚌', '🚎', '🚐'], lanes: ['Route A', 'Route B', 'Route C'],
    text: (n) => `Buses all leave the station at 8:00. ${n.map((x, i) => `Route ${'ABC'[i]} leaves every ${x} min`).join(', ')}. In how many minutes do they ALL leave together again?`,
  },
  {
    kind: 'beacon', unit: 's', icons: ['🚨', '🚨', '🚨'], lanes: ['Beacon A', 'Beacon B', 'Beacon C'],
    text: (n) => `The tower beacons just flashed together. ${n.map((x, i) => `Beacon ${'ABC'[i]} flashes every ${x} s`).join(', ')}. In how many seconds do they ALL flash together again?`,
  },
  {
    kind: 'drone', unit: 's', icons: ['🛸', '🚁', '🛰️'], lanes: ['Drone Bolt', 'Drone Spark', 'Drone Volt'],
    text: (n) => `Repair drones start a loop around the substation together. ${n.map((x, i) => `${['Bolt', 'Spark', 'Volt'][i]} finishes a loop every ${x} s`).join(', ')}. When are they ALL back at the start together?`,
  },
  {
    kind: 'delivery', unit: 'days', icons: ['🔩', '🧰', '🪛'], lanes: ['Bolts', 'Toolkits', 'Screwdrivers'],
    text: (n) => `Supplies all arrived today. ${n.map((x, i) => `${['Bolts', 'Toolkits', 'Screwdrivers'][i]} arrive every ${x} days`).join(', ')}. In how many days do they ALL arrive on the same day again?`,
  },
];

const SUPPLY_ITEMS = [
  { a: 'hot dogs', aIcon: '🌭', b: 'buns', bIcon: '🍞' },
  { a: 'plates', aIcon: '🍽️', b: 'cups', bIcon: '🥤' },
  { a: 'pencils', aIcon: '✏️', b: 'erasers', bIcon: '🧽' },
  { a: 'light bulbs', aIcon: '💡', b: 'lamp shades', bIcon: '🛋️' },
  { a: 'juice boxes', aIcon: '🧃', b: 'granola bars', bIcon: '🍫' },
  { a: 'fuses', aIcon: '🔌', b: 'fuse caps', bIcon: '🔘' },
];

const GCF_STORIES = [
  (a, b) => `You have ${a} red and ${b} blue balloons. You want identical bunches with nothing left over. What is the GREATEST number of bunches you can make?`,
  (a, b) => `Two cables are ${a} ft and ${b} ft long. Cut both into equal pieces, as long as possible, with nothing wasted. How long is each piece?`,
  (a, b) => `${a} sixth graders and ${b} fifth graders split into teams. Every team gets the same mix of both grades. What is the greatest number of teams?`,
  (a, b) => `A crew has ${a} bolts and ${b} washers to pack into identical kits with none left over. What is the most kits they can make?`,
];

const LCM_STORIES = [
  (a, b) => `Hot dogs come in packs of ${a}. Buns come in packs of ${b}. What is the LEAST number of hot dogs you can buy to have exactly one bun for each?`,
  (a, b) => `Two warning lights just blinked together. One blinks every ${a} seconds, the other every ${b} seconds. In how many seconds will they blink together again?`,
  (a, b) => `The cafeteria serves pizza every ${a} days and tacos every ${b} days. Both were served today. In how many days will both be served on the same day again?`,
  (a, b) => `A gear with ${a} teeth turns against a gear with ${b} teeth. Their marks line up now. How many teeth must pass before the marks line up again?`,
];

// ------------------------------------------------------------------
// Problem builders
// ------------------------------------------------------------------

function syncHint(nums) {
  const max = Math.max(...nums);
  const others = nums.filter((n) => n !== max);
  return `Count by the biggest number: ${getMultiples(max, max * 4).join(', ')}... Stop at the first one that ${others.join(' and ')} also divide${others.length > 1 ? '' : 's'} into.`;
}

export function makeSync(nums, rng, cfg = {}) {
  const story = rng() < (cfg.storyChance || 0) ? pick(rng, SYNC_STORIES) : null;
  const three = nums.length === 3;
  return {
    id: nextId(three ? 'sync3' : 'sync'),
    mode: three ? 'sync3' : 'sync',
    nums,
    answer: lcmMany(nums),
    story: story ? { kind: story.kind, unit: story.unit, icons: story.icons, lanes: story.lanes } : null,
    prompt: story
      ? story.text(nums)
      : `${three ? 'Three' : 'Two'} generators fire pulses that hop every ${nums.join(three ? ', ' : ' and ').replace(/, (\d+)$/, ', and $1')} blocks. Drop the breaker on the FIRST block where ${three ? 'ALL THREE' : 'BOTH'} land.`,
    hint: syncHint(nums),
  };
}

export function makeSupply(nums, rng) {
  const items = pick(rng, SUPPLY_ITEMS);
  const [a, b] = nums;
  return {
    id: nextId('supply'),
    mode: 'supply',
    nums,
    answer: lcm(a, b),
    items,
    prompt: `${cap(items.a)} come in packs of ${a}. ${cap(items.b)} come in packs of ${b}. What is the LEAST number of each you can buy to have the SAME number of both?`,
    hint: `Packs of ${Math.max(a, b)} give you ${getMultiples(Math.max(a, b), Math.max(a, b) * 4).join(', ')}... Which total can ALSO be made with packs of ${Math.min(a, b)}?`,
  };
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** Wrong answers that look right, most tempting first. */
export function lcmTraps(nums) {
  const L = lcmMany(nums);
  const P = nums.reduce((x, y) => x * y, 1);
  const G = gcdMany(nums);
  const max = Math.max(...nums);
  const min = Math.min(...nums);
  const out = [];
  const add = (v) => { if (v > 0 && v !== L && !out.includes(v)) out.push(v); };
  if (P !== L) add(P);
  if (G > 1) add(G);
  add(2 * L);
  if (L - max > max) add(L - max); // multiple of the biggest number only
  add(L + max);
  add(max);
  if (L - min > max) add(L - min);
  add(3 * L);
  return out;
}

export function makeScan(nums, rng, opts = {}) {
  const L = lcmMany(nums);
  const traps = lcmTraps(nums);
  let chosen = [traps[0], ...shuffle(rng, traps.slice(1, 5)).slice(0, 2)];
  const G = gcdMany(nums);
  if (opts.includeGcf && G > 1 && !chosen.includes(G)) chosen = [traps[0], G, chosen.find((x) => x !== traps[0] && x !== G)];
  return {
    id: nextId('scan'),
    mode: 'scan',
    nums,
    answer: L,
    choices: shuffle(rng, [L, ...chosen]),
    prompt: `Four breakers, one real one. Which is LCM(${nums.join(', ')})?`,
    hint: 'Throw out anything that isn\'t a multiple of EVERY number. Of what\'s left, the smallest wins.',
  };
}

export function makeTool(nums, rng, tool = null) {
  const [a, b] = nums;
  const which = tool || (rng() < 0.5 ? 'gcf' : 'lcm');
  const story = which === 'gcf' ? pick(rng, GCF_STORIES)(a, b) : pick(rng, LCM_STORIES)(Math.min(a, b), Math.max(a, b));
  return {
    id: nextId('tool'),
    mode: 'tool',
    nums,
    tool: which,
    answer: which === 'gcf' ? gcd(a, b) : lcm(a, b),
    prompt: story,
    hint: 'Splitting things into the MOST equal groups or the LARGEST equal pieces → GCF (answer ≤ the numbers). Things lining up AGAIN, or the FEWEST to match → LCM (answer ≥ the numbers).',
  };
}

/**
 * Missing Generator: Alpha hops every a; Alpha and Beta first collide at target. Which could Beta be?
 * Exactly one choice c has lcm(a, c) = target.
 */
export function makeReverse(rng, cfg) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const a = pick(rng, [3, 4, 5, 6, 8, 9, 10, 12]);
    const c = 2 + Math.floor(rng() * 15);
    if (c === a) continue;
    const L = lcm(a, c);
    if (L > Math.min(cfg.maxLcm, 72) || L === a || L === c) continue;
    const pool = [];
    for (let x = 2; x <= Math.min(L, 30); x++) {
      if (x === c || x === a || lcm(a, x) === L) continue;
      pool.push(x);
    }
    // Strongest traps: divisors of L (they DO land on L, but meet Alpha sooner), then numbers near c.
    const divisorTraps = shuffle(rng, pool.filter((x) => L % x === 0));
    const nearTraps = shuffle(rng, pool.filter((x) => L % x !== 0 && Math.abs(x - c) <= 4));
    const distractors = [...divisorTraps.slice(0, 2), ...nearTraps].filter((x, i, arr) => arr.indexOf(x) === i).slice(0, 3);
    if (distractors.length < 3) continue;
    return {
      id: nextId('reverse'),
      mode: 'reverse',
      nums: [a],
      target: L,
      answer: c,
      choices: shuffle(rng, [c, ...distractors]),
      prompt: `Generator Alpha pulses every ${a}. Its pulses first collide with Generator Beta's at block ${L}. Which could Beta be?`,
      hint: `For each choice, find where it FIRST meets ${a}. It has to be exactly ${L}: not sooner, not later.`,
    };
  }
  return { id: nextId('reverse'), mode: 'reverse', nums: [6], target: 24, answer: 8, choices: [4, 8, 12, 9], prompt: 'Generator Alpha pulses every 6. Its pulses first collide with Generator Beta\'s at block 24. Which could Beta be?', hint: 'For each choice, find where it FIRST meets 6. It has to be exactly 24.' };
}

/** One problem of the given mode using a sector's number settings. */
export function makeProblem(mode, rng, cfg, opts = {}) {
  switch (mode) {
    case 'sync3':
      return makeSync(makeTriple(rng, cfg), rng, cfg);
    case 'supply':
      return makeSupply(makePair(rng, cfg, { maxLcm: Math.min(cfg.maxLcm, 72), ...opts }), rng);
    case 'scan':
      return makeScan(makePair(rng, cfg, { noDirect: true, ...opts }), rng, opts);
    case 'tool': {
      const tool = opts.tool || (rng() < 0.5 ? 'gcf' : 'lcm');
      // GCF stories need numbers that share something; LCM stories stay small enough to count.
      const nums = tool === 'gcf'
        ? makePair(rng, { ...cfg, gs: cfg.gs.filter((g) => g > 1) }, { shared: true, maxNum: Math.max(cfg.maxNum, 30), maxLcm: 400 })
        : makePair(rng, cfg, { noDirect: true, maxLcm: Math.min(cfg.maxLcm, 72) });
      return makeTool(nums, rng, tool);
    }
    case 'reverse':
      return makeReverse(rng, cfg);
    case 'sync':
    default:
      return makeSync(makePair(rng, cfg, opts), rng, cfg);
  }
}

/** A full run: one problem list per sector. */
export function buildRun(seed = Date.now()) {
  const rng = createRng(seed);
  return CURRICULUM_SECTORS.map((s) => s.modes.map((m) => makeProblem(m, rng, s.numbers)));
}

/** One fresh sector (used for "retry this line"). */
export function buildSector(index, seed = Date.now()) {
  const rng = createRng(seed);
  const s = CURRICULUM_SECTORS[index];
  return s.modes.map((m) => makeProblem(m, rng, s.numbers));
}

/**
 * A follow-up aimed at the mistake that was just made. Always new numbers.
 */
export function makeFollowUp(problem, code, rng, cfg) {
  const mode = problem.mode;
  if (mode === 'tool') return makeProblem('tool', rng, cfg, { tool: problem.tool });
  if (mode === 'reverse' || mode === 'sync3') return makeProblem(mode, rng, cfg);
  if (code === 'PRODUCT' || code === 'COMMON_NOT_LEAST') {
    // Practice exactly the trap: numbers that share a factor, so the product overshoots.
    return makeProblem(mode === 'supply' ? 'supply' : 'sync', rng, cfg, { shared: true });
  }
  if (code === 'GCF_MIXUP') return makeProblem('scan', rng, cfg, { shared: true, includeGcf: true });
  return makeProblem(mode, rng, cfg, { noDirect: true });
}
