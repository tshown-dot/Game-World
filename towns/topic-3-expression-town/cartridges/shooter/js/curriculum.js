/**
 * Term Popper - Stage setup
 *
 * sigs      - kinds of terms that appear ('' = constants)
 * coefMax   - largest board coefficient
 * negChance - chance a board term is negative
 * rows      - starting rows
 * goal      - zero-pops needed to clear the stage
 * clock     - shots before the ceiling drops (misfires cost MISFIRE_COST)
 * decoy     - chance a shot is a look-alike / random term instead of a helpful one
 */

export const LESSON_ID = 'G06_U03_L07';
export const MISFIRE_COST = 3;
export const DANGER_Y = 478;

export const STAGES = [
  {
    id: 'alley',
    name: 'Stage 1 · Warm-Up Alley',
    short: 'Warm-Up Alley',
    blurb: 'x-terms, y-terms, and plain numbers. Combine x with x, y with y, numbers with numbers.',
    tip: 'Shoot −3x into a 3x to make 0 and pop it!',
    sigs: ['x', 'y', ''],
    coefMax: 4,
    negChance: 0,
    rows: 3,
    goal: 4,
    clock: 8,
    decoy: 0.1,
  },
  {
    id: 'letters',
    name: 'Stage 2 · Letter Jam',
    short: 'Letter Jam',
    blurb: 'z joins in, and some board terms are already negative. Only same-letter terms combine.',
    tip: '4x and 4z never combine, even though the numbers match.',
    sigs: ['x', 'y', 'z', ''],
    coefMax: 6,
    negChance: 0.1,
    rows: 4,
    goal: 5,
    clock: 8,
    decoy: 0.18,
  },
  {
    id: 'powers',
    name: 'Stage 3 · Power Trap',
    short: 'Power Trap',
    blurb: 'x² shows up. x and x² use the same letter but are NOT like terms.',
    tip: 'Check the exponent: 3x and 3x² can\'t combine.',
    sigs: ['x', 'x^2', 'y', ''],
    coefMax: 6,
    negChance: 0.15,
    rows: 4,
    goal: 6,
    clock: 7,
    decoy: 0.22,
  },
];

export const BOSS = {
  id: 'boss',
  name: 'Boss · Term Colossus',
  short: 'Term Colossus',
  blurb: 'The Colossus shape-shifts its terms into look-alikes. Read every exponent!',
  tip: 'Each zero-pop hits the Colossus. Bigger drops hit harder.',
  sigs: ['x', 'x^2', 'y', 'y^2', ''],
  coefMax: 6,
  negChance: 0.15,
  rows: 4,
  hp: 8,
  clock: 7,
  decoy: 0.22,
  shiftEvery: 5, // shots between shape-shift attacks
  shiftCount: 2, // bubbles changed per attack
  top: 76, // the Colossus takes the top of the screen
};
