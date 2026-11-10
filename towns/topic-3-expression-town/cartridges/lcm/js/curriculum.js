/**
 * Grid Sync: The LCM Substation - Sectors (power lines of the substation)
 * Each run builds fresh problems from these settings (see generator.js).
 */

/** What each job type practices (labels + end-of-run skill breakdown). */
export const MODE_INFO = {
  sync: { label: 'Sync the Pulses', icon: '⚡', skill: 'Find the LCM of two numbers' },
  sync3: { label: 'Tri-Phase Sync', icon: '🔱', skill: 'Find the LCM of three numbers' },
  supply: { label: 'Supply Run', icon: '📦', skill: 'Fewest items so the packs match' },
  scan: { label: 'Spot the LCM', icon: '🔎', skill: 'Tell the LCM apart from common traps' },
  tool: { label: 'GCF or LCM?', icon: '🧭', skill: 'Choose GCF or LCM for a real problem' },
  reverse: { label: 'Missing Generator', icon: '❔', skill: 'Work backward from an LCM' },
};

/**
 * numbers:
 *   gs            - shared factors to build pairs from (a = g·m, b = g·n)
 *   ms            - multipliers (1 = one number divides the other)
 *   maxNum/maxLcm - size limits
 *   directChance  - chance one number is a multiple of the other
 *   coprimeChance - chance the pair shares no factor (LCM = product)
 *   storyChance   - chance a Sync job is a real-world timing story
 *   triple        - limits for three-number jobs
 */
export const CURRICULUM_SECTORS = [
  {
    id: 'sector-1',
    name: 'Line 1: Feeder Lines',
    badge: 'LINE-1',
    description: 'Small numbers. If one number divides into the other, the bigger one IS the LCM.',
    timeLimit: 45,
    overloadPerMiss: 25,
    modes: ['sync', 'sync', 'scan', 'supply', 'sync'],
    numbers: { gs: [2, 3, 4, 5], ms: [1, 2, 3, 4], maxNum: 12, maxLcm: 36, directChance: 0.45, coprimeChance: 0.15, storyChance: 0 },
  },
  {
    id: 'sector-2',
    name: 'Line 2: Transformer Yard',
    badge: 'LINE-2',
    description: 'Numbers that share a factor line up BEFORE their product. 4 × 6 = 24, but 4 and 6 first meet at 12.',
    timeLimit: 45,
    overloadPerMiss: 25,
    modes: ['sync', 'supply', 'scan', 'sync', 'supply'],
    numbers: { gs: [2, 3, 4, 5, 6], ms: [2, 3, 4, 5], maxNum: 20, maxLcm: 72, directChance: 0, coprimeChance: 0.1, storyChance: 0.4 },
  },
  {
    id: 'sector-3',
    name: 'Line 3: Town Schedules',
    badge: 'LINE-3',
    description: 'Buses, beacons and supply orders, plus the big question: does this job need the GCF or the LCM?',
    timeLimit: 50,
    overloadPerMiss: 25,
    modes: ['tool', 'sync', 'supply', 'tool', 'scan', 'tool'],
    numbers: { gs: [2, 3, 4, 5, 6], ms: [1, 2, 3, 4, 5], maxNum: 24, maxLcm: 90, directChance: 0.1, coprimeChance: 0.3, storyChance: 0.8 },
  },
  {
    id: 'sector-4',
    name: 'Line 4: Tri-Phase Core',
    badge: 'LINE-4',
    description: 'Three pulses at once. Two of them may meet early, but the breaker goes where ALL THREE land.',
    timeLimit: 50,
    overloadPerMiss: 25,
    modes: ['sync3', 'reverse', 'sync3', 'supply', 'sync3', 'reverse'],
    numbers: { gs: [2, 3, 4, 5, 6], ms: [2, 3, 4, 5], maxNum: 24, maxLcm: 96, directChance: 0, coprimeChance: 0.2, storyChance: 0.5, triple: { maxNum: 12, maxLcm: 72 } },
  },
  {
    id: 'sector-5',
    name: 'The Core: Dynamo Overlord',
    badge: 'BOSS',
    isBossSector: true,
    bossName: 'Dynamo Overlord',
    bossHp: 8,
    description: 'The Dynamo Overlord has hijacked the grid. Every correct answer knocks out one of its 8 power coils.',
    timeLimit: 45,
    overloadPerMiss: 25,
    modes: ['sync3', 'tool', 'sync', 'reverse', 'scan', 'sync3', 'supply', 'tool'],
    numbers: { gs: [2, 3, 4, 5, 6, 7], ms: [2, 3, 4, 5], maxNum: 30, maxLcm: 120, directChance: 0.05, coprimeChance: 0.2, storyChance: 0.6, triple: { minNum: 3, maxNum: 15, maxLcm: 90 } },
  },
];

/** Extra seconds for the longer job types. */
export const EXTRA_TIME = { sync3: 10, tool: 10, reverse: 5 };

/** Backup cells: each one resets the overload meter once. Out of cells at 100% = blackout. */
export const BACKUP_CELLS = 3;

/** Overload added when the timer runs out. */
export const TIMEOUT_OVERLOAD = 35;

/** Follow-up problems added per sector after misses. */
export const MAX_FOLLOWUPS_PER_SECTOR = 3;

export const MAX_COMBO = 5;

export const BOSS_TAUNTS = [
  '"Your town runs on MY schedule now."',
  '"A lucky sync. It won\'t happen twice."',
  '"My coils spin LEAST... I mean MOST... ugh!"',
  '"Stop lining up my pulses!"',
  '"Halfway? Impossible!"',
  '"My multiples... they\'re collapsing!"',
  '"One coil left. You won\'t find it!"',
  '"POWER... FAILING..."',
];
