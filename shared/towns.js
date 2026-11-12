// The towns of Game World, in order, and the rules for which ones a student can enter.
// Used by the Super Map. Plain data and plain functions, so it is easy to test with node.
//
// There are two regions on the Super Map: Grade 6 (8 towns) and the Grade 7 Isles (8 towns, for accelerated
// students). Every town has a `grade` and a `number` (1-8 inside its grade). The Grade 6 towns keep the ids they
// always had (topic_1 ... topic_8), so no saved progress ever moves. Grade 7 ids start with g7_.
// The ORDER of this list matters: a town's place in it is its place in the sheet's `open` flags
// (0-7 = Grade 6 towns 1-8, 8-15 = Grade 7 towns 1-8). Only ever add towns at the end.
//
// Unlock rules (owner decisions, see CLAUDE.md):
//  - A town that is not built yet shows "coming soon" and cannot be entered.
//  - The first built town is always open (for now that is Expression Town, Town 3).
//  - After that, a town opens when the student beats the boss of the previous BUILT town.
//    Towns that are not built yet are skipped in that chain.
//  - The teacher can open a town early by ticking its box in the sheet (for the student or the ALL row).
//  - A full_access code opens everything that is built.
//  - A town a student has already played never locks again, even if towns are added before it later.
//  - Grade 7 (owner decision): a Grade 7 town opens ONLY by a teacher tick or a full_access code, never from
//    Grade 6 progress and never by default. After that, beating a Grade 7 boss opens the next built Grade 7 town.

export const TOWNS = [
  {
    grade: 6, number: 1, id: 'topic_1', name: 'Decimal Docks', topic: 'Topic 1: Use Positive Rational Numbers',
    biome: 'harbor', built: false,
  },
  {
    grade: 6, number: 2, id: 'topic_2', name: 'Integer Highlands', topic: 'Topic 2: Integers and Rational Numbers',
    biome: 'highlands', built: false,
  },
  {
    grade: 6, number: 3, id: 'topic_3', name: 'Expression Town', topic: 'Topic 3: Numeric & Algebraic Expressions',
    biome: 'meadow', built: true,
    url: 'towns/topic-3-expression-town/index.html',
    stageCount: 9,
    bossId: 'node_apex', bossName: 'Expression Colossus Prime',
  },
  {
    grade: 6, number: 4, id: 'topic_4', name: 'Equation Valley', topic: 'Topic 4: Equations & Inequalities',
    biome: 'canyon', built: true,
    url: 'towns/topic-4-equation-valley/index.html',
    stageCount: 11,
    bossId: 'node_4_boss', bossName: 'The Equation Golem',
  },
  { grade: 6, number: 5, id: 'topic_5', name: 'Town 5', topic: 'To be decided', biome: 'swamp', built: false },
  { grade: 6, number: 6, id: 'topic_6', name: 'Town 6', topic: 'To be decided', biome: 'volcano', built: false },
  { grade: 6, number: 7, id: 'topic_7', name: 'Town 7', topic: 'To be decided', biome: 'tundra', built: false },
  { grade: 6, number: 8, id: 'topic_8', name: 'Town 8', topic: 'To be decided', biome: 'sky', built: false },

  // ---- Grade 7 Isles (enVision 2.0 Grade 7). Only Topic 4 is planned so far. ----
  { grade: 7, number: 1, id: 'g7_topic_1', name: 'Grade 7 Town 1', topic: 'To be decided', biome: 'tundra', built: false },
  { grade: 7, number: 2, id: 'g7_topic_2', name: 'Grade 7 Town 2', topic: 'To be decided', biome: 'volcano', built: false },
  { grade: 7, number: 3, id: 'g7_topic_3', name: 'Grade 7 Town 3', topic: 'To be decided', biome: 'swamp', built: false },
  {
    grade: 7, number: 4, id: 'g7_topic_4', name: 'Factor Falls', topic: 'Grade 7 Topic 4: Generate Equivalent Expressions',
    biome: 'falls', built: true,
    url: 'towns/g7-topic-4-factor-falls/index.html',
    stageCount: 9,
    bossId: 'node_g7_4_boss', bossName: 'Thunder Falls',
  },
  { grade: 7, number: 5, id: 'g7_topic_5', name: 'Grade 7 Town 5', topic: 'To be decided', biome: 'highlands', built: false },
  { grade: 7, number: 6, id: 'g7_topic_6', name: 'Grade 7 Town 6', topic: 'To be decided', biome: 'harbor', built: false },
  { grade: 7, number: 7, id: 'g7_topic_7', name: 'Grade 7 Town 7', topic: 'To be decided', biome: 'canyon', built: false },
  { grade: 7, number: 8, id: 'g7_topic_8', name: 'Grade 7 Town 8', topic: 'To be decided', biome: 'sky', built: false },
];

export const GRADES = [6, 7];
export const townsOf = (grade) => TOWNS.filter((t) => t.grade === grade);

/** Stages cleared, stars earned and whether the boss is beaten, from a town's saved slice. */
export function townSummary(town, progress) {
  const slice = (progress && progress.towns && progress.towns[town.id]) || {};
  const records = slice.nodeRecords || {};
  const cleared = Object.values(records).filter((r) => r && r.cleared);
  return {
    cleared: cleared.length,
    stars: cleared.reduce((sum, r) => sum + (r.stars || 0), 0),
    bossBeaten: Boolean(town.bossId && records[town.bossId] && records[town.bossId].cleared && !records[town.bossId].practiceOnly),   // a practice-only clear does not count
    played: cleared.length > 0,
  };
}

/**
 * Works out every town's state for one student.
 *   progress   the student's saved progress ({ towns: { topic_3: {...} } }) or null
 *   open       the teacher-sheet flags for this student, in TOWNS order (already merged with the ALL row).
 *              An older sheet script sends only the first 8; missing flags count as not ticked.
 *   fullAccess true for a teacher or preview code
 * Returns one entry per town: { town, state: 'open' | 'locked' | 'soon', reason, summary }
 */
export function townStates({ progress = null, open = [], fullAccess = false } = {}) {
  const firstBuilt = TOWNS.find((t) => t.grade === 6 && t.built);          // only Grade 6 has an always-open town
  return TOWNS.map((town, idx) => {
    const summary = townSummary(town, progress);
    if (!town.built) {
      return { town, state: 'soon', reason: 'Coming soon', summary };
    }
    const prevBuilt = TOWNS.slice(0, idx).reverse().find((t) => t.built && t.grade === town.grade);   // same grade only
    let state = 'locked';
    if (fullAccess) state = 'open';
    else if (open[idx] === true) state = 'open';
    else if (town === firstBuilt) state = 'open';
    else if (summary.played) state = 'open';
    else if (prevBuilt && townSummary(prevBuilt, progress).bossBeaten) state = 'open';
    const reason = state === 'open' ? 'Open'
      : prevBuilt ? `Beat the ${prevBuilt.name} boss to open`
        : town.grade === 6 ? 'Beat the previous town boss to open'
          : 'Ask your teacher to open this town';
    return { town, state, reason, summary };
  });
}
