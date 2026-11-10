/**
 * Term Popper - Board + shot generator (pure, seeded; tested in Node)
 */

import { lookAlike } from './terms.js?v=20261110pop1';

/** Small seeded RNG (mulberry32) so runs can be reproduced in tests. */
export function makeRng(seed = Date.now()) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const randInt = (lo, hi, rng) => lo + Math.floor(rng() * (hi - lo + 1));

/** A random board term for a stage (never coefficient 0). */
export function randomTerm(stage, rng) {
  const sig = pick(stage.sigs, rng);
  let coef = randInt(1, stage.coefMax, rng);
  if (rng() < stage.negChance) coef = -coef;
  return { coef, sig };
}

/**
 * Fill every empty cell of row r with random terms,
 * keeping groups of touching like terms small (keeps the numbers small).
 */
export function fillRow(board, r, stage, rng) {
  for (let c = 0; c < board.colsIn(r); c++) {
    if (board.get(r, c)) continue;
    // Try every kind (random order) and keep the one that makes the smallest like group.
    const sigs = [...stage.sigs].sort(() => rng() - 0.5);
    let best = null;
    let bestSize = Infinity;
    for (const sig of sigs) {
      const t = { ...randomTerm(stage, rng), sig };
      board.set(r, c, t);
      const size = board.likeCluster(r, c).length;
      if (size < bestSize) {
        best = t;
        bestSize = size;
      }
      if (size <= 1 || (size <= 2 && rng() < 0.5)) break;
    }
    board.set(r, c, best);
  }
}

/** Fresh starting board. */
export function buildBoard(board, stage, rng) {
  for (let r = 0; r < stage.rows; r++) fillRow(board, r, stage, rng);
}

/** Push a new random row in at the top (ceiling drop). */
export function dropCeiling(board, stage, rng) {
  board.pushRow([]);
  fillRow(board, 0, stage, rng);
}

/**
 * Next term for the launcher. Mostly helpful (cancels or combines with a group the player
 * can reach), sometimes a decoy that only LOOKS like a nearby group.
 */
export function nextShot(board, stage, rng) {
  const groups = board.groups();
  if (!groups.length) return randomTerm(stage, rng);
  const reachable = groups.filter((g) => g.exposed);
  const pool = reachable.length ? reachable : groups;

  // Prefer lower groups: they're the ones the player can actually hit.
  const weights = pool.map((g) => 1 + g.lowestRow * 1.5);
  let roll = rng() * weights.reduce((a, b) => a + b, 0);
  let g = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) { g = pool[i]; break; }
  }

  if (rng() < stage.decoy) {
    const fake = lookAlike({ coef: -g.sum || randInt(1, stage.coefMax, rng), sig: g.sig }, stage.sigs, rng);
    if (fake) return fake;
    return randomTerm(stage, rng);
  }

  // A pair like 3x and −3x already sums to 0: any like term will combine with it.
  if (g.sum === 0) return { coef: randInt(1, stage.coefMax, rng), sig: g.sig };

  const mag = Math.abs(g.sum);
  const sign = Math.sign(g.sum);
  const r = rng();
  if (r < 0.62 || mag === 1) return { coef: -g.sum, sig: g.sig }; // exact cancel
  if (r < 0.85) return { coef: -sign * randInt(1, mag - 1, rng), sig: g.sig }; // partial
  return { coef: sign * randInt(1, 3, rng), sig: g.sig }; // grow (combine)
}
