/**
 * Demolition Crane - Run Structure (enVision 2.0 Grade 6, Lesson 3-3)
 *
 * A run = 4 demolition zones (3 buildings each, plus up to 2 follow-ups after
 * an order mistake) and the Titan Demolisher boss. Every building is generated
 * fresh from the templates in generator.js, so no two runs are the same.
 */

export const ZONES = [
  {
    id: 1,
    code: 'ZONE-1',
    title: 'Zone 1: Ground Floor',
    focus: '× and ÷ before + and −. Same rank? Left to right.',
    buildings: 3,
    timer: 50,
    templates: ['addMul', 'mulSub', 'subDivAdd', 'divMul', 'subAdd', 'mulAddMul', 'addMulSub'],
  },
  {
    id: 2,
    code: 'ZONE-2',
    title: 'Zone 2: Power Plant',
    focus: 'Exponents before × ÷ + −.',
    buildings: 3,
    timer: 55,
    templates: ['powAddMul', 'mulPow', 'subPowMul', 'powSubPow', 'addMulPow', 'powDivMul'],
  },
  {
    id: 3,
    code: 'ZONE-3',
    title: 'Zone 3: Cage Yard',
    focus: 'Parentheses first, even before exponents.',
    buildings: 3,
    timer: 60,
    templates: ['mulGroup', 'groupDivMul', 'mulGroupPow', 'groupPowAdd', 'groupTimesGroup', 'addMulGroup'],
  },
  {
    id: 4,
    code: 'ZONE-4',
    title: 'Zone 4: Deep Core',
    focus: 'Brackets [ ] and fraction bars: innermost first.',
    buildings: 3,
    timer: 70,
    templates: ['nestedSub', 'nestedPowDiv', 'nestedMulAdd', 'fracPowSub', 'fracMulPow', 'fracNested'],
  },
];

export const BOSS = {
  id: 5,
  code: 'BOSS',
  title: 'Boss: The Titan Demolisher',
  focus: 'Long towers, cage drops, and spotting mistakes.',
  hp: 6,
  timer: 60,
  // Order of boss attacks; long towers use the templates below.
  sequence: ['cage', 'tower', 'spot', 'cage', 'spot', 'tower'],
  towerTemplates: ['bossTowerA', 'bossTowerB', 'bossTowerC', 'bossTowerD'],
};

export const MAX_FOLLOWUPS_PER_ZONE = 2;
export const MAX_COMBO = 5;

/** Integrity damage (out of 100). At 0 the crane breaks down and the zone restarts. */
export const DAMAGE = {
  wrongOrder: 25,
  wrongMath: 10,
  timeout: 20,
  bossWrong: 25,
};

/**
 * Skills shown on the debrief. Order mistakes are tagged with the rule that
 * was broken; correct strikes are tagged with the rule they demonstrated.
 */
export const SKILLS = {
  muldiv: { label: '× ÷ before + −', icon: '✖️' },
  ltr: { label: 'Left to right', icon: '➡️' },
  exp: { label: 'Exponents first', icon: '⚡' },
  group: { label: 'Grouping first', icon: '🔒' },
  fraction: { label: 'Fraction bars', icon: '➗' },
  arith: { label: 'Step arithmetic', icon: '🧮' },
  cage: { label: 'Cage drop (boss)', icon: '🎯' },
  spot: { label: 'Spot the mistake (boss)', icon: '🔍' },
};

/** Which skill a wrong strike shows a gap in. */
export const VIOLATION_SKILL = {
  MULT_DIV_FIRST: 'muldiv',
  LEFT_TO_RIGHT: 'ltr',
  EXPONENT_FIRST: 'exp',
  GROUP_NOT_DONE: 'group',
  GROUP_ORDER: 'group',
  FRACTION_INCOMPLETE: 'fraction',
};

/** Follow-up building to queue after each kind of order mistake. */
export const FOLLOWUP_TEMPLATES = {
  MULT_DIV_FIRST: ['addMul', 'mulAddMul', 'subDivAdd'],
  LEFT_TO_RIGHT: ['divMul', 'subAdd', 'powDivMul'],
  EXPONENT_FIRST: ['mulPow', 'addMulPow', 'subPowMul'],
  GROUP_NOT_DONE: ['mulGroup', 'groupPowAdd', 'mulGroupPow'],
  GROUP_ORDER: ['groupTimesGroup', 'fracPowSub', 'fracNested'],
  FRACTION_INCOMPLETE: ['fracPowSub', 'fracMulPow'],
};

export const BOSS_TAUNTS = [
  '"Your crane is a toy."',
  '"Lucky swing."',
  '"I was built out of order... and I LIKE it."',
  '"Stop following the rules!"',
  '"My bolts... are loosening..."',
  '"Impossible! Demolished by PEMDAS!"',
];
