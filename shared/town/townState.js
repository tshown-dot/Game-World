// One student's progress inside one town, for every town built on the shared town engine.
//
// Buildings (stages) unlock in order. Stages that are not built yet are skipped:
//   - the first built stage is always open
//   - a later built stage opens when the previous BUILT stage is cleared
//   - a full_access (teacher/preview) code opens every built stage
// Only stage records are saved (cleared, stars, best score); what is open is worked out from them,
// so adding a new building later can never lock a student out of one they already reached.

import { progressStore, normalizeCode } from '../progressStore.js';
import { townStates, TOWNS } from '../towns.js';

export function calculateStars(score, total) {
  if (!total || total <= 0) return 3;
  const ratio = score / total;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.7) return 2;
  return 1;
}

export class TownState {
  /**
   * @param {object} opts
   *   townId    e.g. 'topic_4' (key in saved progress and in shared/towns.js)
   *   label     e.g. 'topic-4' (the town name written in the Results tab)
   *   stages    ordered list: { id, lessonCode, title, built, xpReward, coinsReward, isBoss }
   *   store     the progress store (tests pass a pretend one)
   */
  constructor({ townId, label, stages, store = progressStore }) {
    Object.assign(this, { townId, label, stages, store });
    this.code = '';
    this.extra = {};
    this.level = 1; this.xp = 0; this.coins = 50;
    this.records = {};
    this.townOpen = [];
    this.fullAccess = false;
  }

  /** Signs a code in and loads its progress. Resolves to { success, error?, townLocked?, reason? }. */
  async load(rawCode) {
    const code = normalizeCode(rawCode);
    if (!code) return { success: false, error: 'bad_shape' };
    const res = await this.store.loadStudent(code);
    if (!res.ok) return { success: false, error: res.error };
    this.code = code;
    this.townOpen = res.open || [];
    this.fullAccess = Boolean(res.fullAccess);
    const saved = res.progress && typeof res.progress === 'object' ? res.progress : null;
    this.extra = saved || {};
    this.level = (saved && saved.level) || 1;
    this.xp = (saved && saved.xp) || 0;
    this.coins = saved && saved.coins !== undefined ? saved.coins : 50;
    this.records = (saved && saved.towns && saved.towns[this.townId] && saved.towns[this.townId].nodeRecords) || {};
    const entry = townStates({ progress: saved, open: this.townOpen, fullAccess: this.fullAccess })
      .find((e) => e.town.id === this.townId);
    if (entry && entry.state !== 'open') return { success: true, townLocked: true, reason: entry.reason };
    return { success: true };
  }

  get town() { return TOWNS.find((t) => t.id === this.townId); }
  xpForNextLevel() { return this.level * 100; }
  isCleared(id) { return Boolean(this.records[id] && this.records[id].cleared); }

  /** 'open' | 'locked' | 'wip' */
  stageState(id) {
    const idx = this.stages.findIndex((s) => s.id === id);
    const stage = this.stages[idx];
    if (!stage) return 'locked';
    if (!stage.built) return 'wip';
    if (this.fullAccess) return 'open';
    const firstBuilt = this.stages.findIndex((s) => s.built);
    if (idx === firstBuilt) return 'open';
    if (this.isCleared(id)) return 'open';
    const prev = this.stages.slice(0, idx).reverse().find((s) => s.built);
    return prev && this.isCleared(prev.id) ? 'open' : 'locked';
  }

  snapshot() {
    const towns = Object.assign({}, this.extra.towns || {});
    towns[this.townId] = Object.assign({}, towns[this.townId] || {}, { nodeRecords: this.records });
    return Object.assign({}, this.extra, { v: 1, level: this.level, xp: this.xp, coins: this.coins, towns });
  }

  save() {
    if (!this.code) return Promise.resolve({ pending: 0 });
    this.extra = this.snapshot();
    return this.store.saveProgress(this.code, this.extra);
  }

  /** A game finished. Updates records, XP and coins, saves, logs the result, and says what opened. */
  completeStage(id, payload = {}) {
    const stage = this.stages.find((s) => s.id === id);
    if (!stage) return null;
    const openBefore = new Set(this.stages.filter((s) => this.stageState(s.id) === 'open').map((s) => s.id));
    const score = Number(payload.score) || 0;
    const total = Number(payload.total) || 10;
    const stars = Math.max(1, Math.min(3, Number(payload.stars) || calculateStars(score, total)));
    const prev = this.records[id] || {};
    this.records[id] = {
      cleared: true,
      stars: Math.max(prev.stars || 0, stars),
      bestScore: Math.max(prev.bestScore || 0, score),
      total,
      lastPlayed: new Date().toISOString(),
    };
    const xpGained = stage.xpReward || 150;
    const coinsGained = stage.coinsReward || 50;
    this.coins += coinsGained;
    this.xp += xpGained;
    let leveledUp = false;
    while (this.xp >= this.xpForNextLevel()) { this.xp -= this.xpForNextLevel(); this.level += 1; leveledUp = true; }
    const opened = this.stages.find((s) => !openBefore.has(s.id) && this.stageState(s.id) === 'open') || null;
    void this.save();
    if (this.code) {
      void this.store.logResult(this.code, {
        town: this.label,
        lesson: stage.lessonCode,
        game: stage.id,
        score,
        problems_attempted: total,
        problems_correct: score,
        accuracy: Math.round((score / Math.max(1, total)) * 100),
        boss_defeated: payload.bossDefeated === true,
        practice_mode: payload.practiceMode === true,
      });
    }
    return { stars, xpGained, coinsGained, leveledUp, newLevel: this.level, opened };
  }
}
