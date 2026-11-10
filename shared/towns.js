// The 8 towns of Game World, in order, and the rules for which ones a student can enter.
// Used by the Super Map. Plain data and plain functions, so it is easy to test with node.
//
// Unlock rules (owner decisions, see CLAUDE.md):
//  - A town that is not built yet shows "coming soon" and cannot be entered.
//  - The first built town is always open (for now that is Expression Town, Town 3).
//  - After that, a town opens when the student beats the boss of the previous BUILT town.
//    Towns that are not built yet are skipped in that chain.
//  - The teacher can open a town early by ticking its box in the sheet (for the student or the ALL row).
//  - A full_access code opens everything that is built.
//  - A town a student has already played never locks again, even if towns are added before it later.

export const TOWNS = [
  {
    number: 1, id: 'topic_1', name: 'Decimal Docks', topic: 'Topic 1: Use Positive Rational Numbers',
    biome: 'harbor', built: false,
  },
  {
    number: 2, id: 'topic_2', name: 'Integer Highlands', topic: 'Topic 2: Integers and Rational Numbers',
    biome: 'highlands', built: false,
  },
  {
    number: 3, id: 'topic_3', name: 'Expression Town', topic: 'Topic 3: Numeric & Algebraic Expressions',
    biome: 'meadow', built: true,
    url: 'towns/topic-3-expression-town/index.html',
    stageCount: 9,
    bossId: 'node_apex', bossName: 'Expression Colossus Prime',
  },
  {
    number: 4, id: 'topic_4', name: 'Equation Valley', topic: 'Topic 4: Equations & Inequalities',
    biome: 'canyon', built: false,
  },
  { number: 5, id: 'topic_5', name: 'Town 5', topic: 'To be decided', biome: 'swamp', built: false },
  { number: 6, id: 'topic_6', name: 'Town 6', topic: 'To be decided', biome: 'volcano', built: false },
  { number: 7, id: 'topic_7', name: 'Town 7', topic: 'To be decided', biome: 'tundra', built: false },
  { number: 8, id: 'topic_8', name: 'Town 8', topic: 'To be decided', biome: 'sky', built: false },
];

/** Stages cleared, stars earned and whether the boss is beaten, from a town's saved slice. */
export function townSummary(town, progress) {
  const slice = (progress && progress.towns && progress.towns[town.id]) || {};
  const records = slice.nodeRecords || {};
  const cleared = Object.values(records).filter((r) => r && r.cleared);
  return {
    cleared: cleared.length,
    stars: cleared.reduce((sum, r) => sum + (r.stars || 0), 0),
    bossBeaten: Boolean(town.bossId && records[town.bossId] && records[town.bossId].cleared),
    played: cleared.length > 0,
  };
}

/**
 * Works out every town's state for one student.
 *   progress   the student's saved progress ({ towns: { topic_3: {...} } }) or null
 *   open       the 8 teacher-sheet flags for this student (already merged with the ALL row)
 *   fullAccess true for a teacher or preview code
 * Returns one entry per town: { town, state: 'open' | 'locked' | 'soon', reason, summary }
 */
export function townStates({ progress = null, open = [], fullAccess = false } = {}) {
  const firstBuilt = TOWNS.find((t) => t.built);
  return TOWNS.map((town, idx) => {
    const summary = townSummary(town, progress);
    if (!town.built) {
      return { town, state: 'soon', reason: 'Coming soon', summary };
    }
    const prevBuilt = TOWNS.slice(0, idx).reverse().find((t) => t.built);
    let state = 'locked';
    if (fullAccess) state = 'open';
    else if (open[idx] === true) state = 'open';
    else if (town === firstBuilt) state = 'open';
    else if (summary.played) state = 'open';
    else if (prevBuilt && townSummary(prevBuilt, progress).bossBeaten) state = 'open';
    const reason = state === 'open'
      ? 'Open'
      : `Beat the ${prevBuilt ? prevBuilt.name : 'previous town'} boss to open`;
    return { town, state, reason, summary };
  });
}
