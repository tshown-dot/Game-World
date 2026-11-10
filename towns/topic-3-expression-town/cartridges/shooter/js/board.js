/**
 * Term Popper - Hex bubble board (pure, no DOM; tested in Node)
 *
 * Rows alternate between `cols` and `cols - 1` cells (odd rows shifted right by one radius).
 * Inserting a row at the top flips `parity` so every existing bubble keeps its on-screen x.
 *
 * resolveShot() is the heart of the game:
 *   - The landed term joins every like term it is connected to (through like terms).
 *   - 2+ like terms  -> they COMBINE into one bubble (coefficients add) kept at the highest cell.
 *   - Sum is zero    -> the whole group POPS.
 *   - No like neighbor -> the term just sticks (a misfire if a like term was available somewhere).
 *   - Anything no longer hanging from the ceiling falls.
 */

import { isLike, sumCoefficients } from './terms.js?v=20261110pop1';

export const RADIUS = 28;
export const DIAMETER = RADIUS * 2;
export const ROW_HEIGHT = RADIUS * Math.sqrt(3);

export class Board {
  constructor({ cols = 14, rows = 13, top = 0, left = 8 } = {}) {
    this.cols = cols;
    this.rows = rows;
    this.top = top;
    this.left = left;
    this.parity = 0;
    this.cells = [];
    for (let r = 0; r < rows; r++) this.cells.push(new Array(cols).fill(null));
  }

  isShifted(r) {
    return (r + this.parity) % 2 === 1;
  }

  colsIn(r) {
    return this.isShifted(r) ? this.cols - 1 : this.cols;
  }

  inBounds(r, c) {
    return r >= 0 && r < this.rows && c >= 0 && c < this.colsIn(r);
  }

  get(r, c) {
    return this.inBounds(r, c) ? this.cells[r][c] : null;
  }

  set(r, c, t) {
    if (this.inBounds(r, c)) this.cells[r][c] = t ? { coef: t.coef, sig: t.sig } : null;
  }

  center(r, c) {
    const x = this.left + RADIUS + c * DIAMETER + (this.isShifted(r) ? RADIUS : 0);
    const y = this.top + RADIUS + r * ROW_HEIGHT;
    return { x, y };
  }

  neighbors(r, c) {
    const shifted = this.isShifted(r);
    const offs = shifted
      ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]]
      : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
    const out = [];
    for (const [dr, dc] of offs) {
      const nr = r + dr;
      const nc = c + dc;
      if (this.inBounds(nr, nc)) out.push({ r: nr, c: nc });
    }
    return out;
  }

  /** Every filled cell as { r, c, t }. */
  filled() {
    const out = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.colsIn(r); c++) {
        if (this.cells[r][c]) out.push({ r, c, t: this.cells[r][c] });
      }
    }
    return out;
  }

  count() {
    return this.filled().length;
  }

  /** Lowest bubble edge (in px), or the board top if empty. */
  lowestEdge() {
    let max = this.top;
    for (const { r, c } of this.filled()) max = Math.max(max, this.center(r, c).y + RADIUS);
    return max;
  }

  /** Connected cells holding like terms of (r, c), including (r, c). */
  likeCluster(r, c) {
    const start = this.get(r, c);
    if (!start) return [];
    const seen = new Set([`${r},${c}`]);
    const queue = [{ r, c }];
    const out = [];
    while (queue.length) {
      const cur = queue.shift();
      out.push(cur);
      for (const n of this.neighbors(cur.r, cur.c)) {
        const key = `${n.r},${n.c}`;
        if (seen.has(key)) continue;
        const t = this.get(n.r, n.c);
        if (t && isLike(t, start)) {
          seen.add(key);
          queue.push(n);
        }
      }
    }
    return out;
  }

  /** Groups of connected like terms: [{ sig, sum, cells }]. */
  groups() {
    const seen = new Set();
    const out = [];
    for (const { r, c, t } of this.filled()) {
      if (seen.has(`${r},${c}`)) continue;
      const cells = this.likeCluster(r, c);
      cells.forEach((p) => seen.add(`${p.r},${p.c}`));
      out.push({
        sig: t.sig,
        sum: sumCoefficients(cells.map((p) => this.get(p.r, p.c))),
        cells,
        lowestRow: Math.max(...cells.map((p) => p.r)),
        exposed: cells.some((p) => this.neighbors(p.r, p.c).some((n) => !this.get(n.r, n.c))),
      });
    }
    return out;
  }

  /** Remove bubbles not connected to row 0. Returns removed [{ r, c, t, x, y }]. */
  dropFloating() {
    const seen = new Set();
    const queue = [];
    for (let c = 0; c < this.colsIn(0); c++) {
      if (this.cells[0][c]) {
        seen.add(`0,${c}`);
        queue.push({ r: 0, c });
      }
    }
    while (queue.length) {
      const cur = queue.shift();
      for (const n of this.neighbors(cur.r, cur.c)) {
        const key = `${n.r},${n.c}`;
        if (!seen.has(key) && this.get(n.r, n.c)) {
          seen.add(key);
          queue.push(n);
        }
      }
    }
    const dropped = [];
    for (const { r, c, t } of this.filled()) {
      if (!seen.has(`${r},${c}`)) {
        dropped.push({ r, c, t, ...this.center(r, c) });
        this.cells[r][c] = null;
      }
    }
    return dropped;
  }

  /** Push everything down one row and fill the new top row with `terms` (array, may contain nulls). */
  pushRow(terms) {
    this.parity = 1 - this.parity;
    const next = [];
    for (let r = 0; r < this.rows; r++) next.push(new Array(this.colsIn(r)).fill(null));
    for (let c = 0; c < this.colsIn(0); c++) {
      const t = terms[c];
      next[0][c] = t ? { coef: t.coef, sig: t.sig } : null;
    }
    for (let r = 0; r < this.rows - 1; r++) {
      for (let c = 0; c < this.cells[r].length; c++) {
        if (this.cells[r][c] && c < next[r + 1].length) next[r + 1][c] = this.cells[r][c];
      }
    }
    this.cells = next;
  }

  /** First filled cell the bubble at (x, y) is touching, or null. */
  collision(x, y, slack = 6) {
    const limit = DIAMETER - slack;
    for (const { r, c } of this.filled()) {
      const p = this.center(r, c);
      const dx = x - p.x;
      const dy = y - p.y;
      if (dx * dx + dy * dy <= limit * limit) return { r, c };
    }
    return null;
  }

  /** Nearest empty cell where a bubble at (x, y) can attach (row 0 or next to a bubble). */
  snapCell(x, y) {
    let best = null;
    let bestD = Infinity;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.colsIn(r); c++) {
        if (this.cells[r][c]) continue;
        if (r !== 0 && !this.neighbors(r, c).some((n) => this.get(n.r, n.c))) continue;
        const p = this.center(r, c);
        const d = (x - p.x) ** 2 + (y - p.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { r, c };
        }
      }
    }
    return best;
  }

  /**
   * Place `shot` at (r, c) and resolve it.
   * Returns {
   *   kind: 'zero' | 'combine' | 'stick',
   *   misfire: boolean   (stuck even though a like term was on the board),
   *   cells: [{ r, c, t }] the like group that joined (shot included, shot last),
   *   total, keeper: { r, c } (combine only),
   *   unlikeNeighbor: term (stick only, for feedback),
   *   dropped: [{ r, c, t, x, y }]
   * }
   */
  resolveShot(r, c, shot) {
    const likeAvailable = this.filled().some(({ t }) => isLike(t, shot));
    this.set(r, c, shot);
    const cluster = this.likeCluster(r, c);

    if (cluster.length < 2) {
      const unlike = this.neighbors(r, c).map((n) => this.get(n.r, n.c)).find((t) => t);
      return {
        kind: 'stick',
        misfire: likeAvailable,
        cells: [{ r, c, t: { ...shot } }],
        total: shot.coef,
        unlikeNeighbor: unlike || null,
        dropped: this.dropFloating(),
      };
    }

    // Board terms in reading order, then the shot (so the equation reads "3x + 2x − 5x").
    const others = cluster
      .filter((p) => !(p.r === r && p.c === c))
      .sort((a, b) => a.r - b.r || a.c - b.c)
      .map((p) => ({ ...p, t: { ...this.get(p.r, p.c) } }));
    const cells = [...others, { r, c, t: { ...shot } }];
    const total = sumCoefficients(cells.map((p) => p.t));

    if (total === 0) {
      cells.forEach((p) => { this.cells[p.r][p.c] = null; });
      return { kind: 'zero', misfire: false, cells, total, dropped: this.dropFloating() };
    }

    // Keep the combined term at the highest cell (closest to the landing spot on ties).
    const landing = this.center(r, c);
    let keeper = cells[0];
    let keeperScore = Infinity;
    for (const p of cells) {
      const q = this.center(p.r, p.c);
      const score = p.r * 1e6 + (q.x - landing.x) ** 2 + (q.y - landing.y) ** 2;
      if (score < keeperScore) {
        keeperScore = score;
        keeper = p;
      }
    }
    cells.forEach((p) => { this.cells[p.r][p.c] = null; });
    this.cells[keeper.r][keeper.c] = { coef: total, sig: shot.sig };
    return {
      kind: 'combine',
      misfire: false,
      cells,
      total,
      keeper: { r: keeper.r, c: keeper.c },
      dropped: this.dropFloating(),
    };
  }
}
