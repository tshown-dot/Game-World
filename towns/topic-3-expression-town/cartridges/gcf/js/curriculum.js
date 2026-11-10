/**
 * Vault Breaker: The GCF Heist - Sectors (floors of the Town Bank)
 * Each run builds fresh problems from these settings (see generator.js).
 */

/** What each job type practices (used for labels and the end-of-run skill breakdown). */
export const MODE_INFO = {
  crack: { label: 'Crack the Dial', icon: '🔐', skill: 'Find the GCF of two numbers' },
  crack3: { label: 'Triple Lock', icon: '🔒', skill: 'Find the GCF of three numbers' },
  split: { label: 'Split the Loot', icon: '💰', skill: 'Greatest number of identical groups' },
  tile: { label: 'Tile the Floor', icon: '🟨', skill: 'Largest square tile (GCF of length and width)' },
  factor: { label: 'Override Code', icon: '🧮', skill: 'Factor a sum with the GCF: a + b = GCF(m + n)' },
  scan: { label: 'Spot the Real Key', icon: '🗝️', skill: 'Tell the GCF apart from common traps' },
};

export const CURRICULUM_SECTORS = [
  {
    id: 'sector-1',
    name: 'Floor 1: The Lobby',
    badge: 'FLOOR-1',
    description: 'Small numbers. Watch for one number fitting evenly into the other: then the smaller one IS the GCF.',
    timeLimit: 40,
    heatPerMiss: 20,
    waves: 5,
    modes: ['crack', 'scan', 'split', 'crack', 'scan'],
    numbers: { gcfs: [2, 3, 4, 5, 6], multipliers: [1, 2, 3, 4, 5], max: 30, directMultipleChance: 0.4, coprimeChance: 0 },
  },
  {
    id: 'sector-2',
    name: 'Floor 2: Teller Cages',
    badge: 'FLOOR-2',
    description: 'Bigger loot, real-world jobs. Split the loot evenly and tile the cage floor with no cuts.',
    timeLimit: 45,
    heatPerMiss: 20,
    waves: 5,
    modes: ['split', 'tile', 'crack', 'split', 'tile'],
    numbers: { gcfs: [2, 3, 4, 5, 6, 8, 9, 10, 12], multipliers: [2, 3, 4, 5], max: 60, directMultipleChance: 0, coprimeChance: 0 },
  },
  {
    id: 'sector-3',
    name: 'Floor 3: Deposit Boxes',
    badge: 'FLOOR-3',
    description: 'Override codes: rewrite a sum as GCF × (sum). Odd GCFs like 5, 7, 9 and 15 show up here.',
    timeLimit: 45,
    heatPerMiss: 25,
    waves: 5,
    modes: ['factor', 'crack', 'factor', 'scan', 'factor'],
    numbers: { gcfs: [3, 5, 6, 7, 8, 9, 12, 15], multipliers: [2, 3, 4, 5, 7], max: 90, directMultipleChance: 0, coprimeChance: 0 },
  },
  {
    id: 'sector-4',
    name: 'Floor 4: Laser Hall',
    badge: 'FLOOR-4',
    description: 'Every job type, plus traps: some number pairs share NO factor except 1.',
    timeLimit: 40,
    heatPerMiss: 25,
    waves: 6,
    modes: ['crack', 'split', 'scan', 'tile', 'factor', 'crack'],
    numbers: { gcfs: [2, 3, 4, 6, 7, 8, 9, 10, 12, 14, 15], multipliers: [2, 3, 4, 5, 7], max: 100, directMultipleChance: 0.1, coprimeChance: 0.35 },
  },
  {
    id: 'sector-5',
    name: 'The Vault: Golem Showdown',
    badge: 'BOSS',
    isBossSector: true,
    bossName: 'The Vault Golem',
    bossHp: 8,
    description: 'The Vault Golem guards the gold. Every correct answer smashes one armor plate. Triple locks included!',
    timeLimit: 35,
    heatPerMiss: 25,
    waves: 8,
    modes: ['crack3', 'crack', 'split', 'factor', 'scan', 'tile', 'crack3', 'crack'],
    numbers: { gcfs: [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 24], multipliers: [2, 3, 4, 5, 7], max: 120, directMultipleChance: 0.05, coprimeChance: 0.1 },
  },
];

/** Smoke bombs: each one wipes the heat meter once. Run ends when heat maxes out with none left. */
export const SMOKE_BOMBS = 3;

/** Follow-up problems scheduled per sector after a diagnosed mistake. */
export const MAX_FOLLOWUPS_PER_SECTOR = 2;
