// One student's progress inside one town, for every town built on the shared town engine.
//
// Buildings (stages) unlock in order. Stages that are not built yet are skipped:
//   - the first built stage is always open
//   - a later built stage opens when the previous BUILT stage is cleared
//   - a full_access (teacher/preview) code opens every built stage
//   - a stage stays open once the student has reached it or any LATER stage (cleared it, or an older save
//     lists it in the town's unlockedNodes), so moving or adding buildings never locks anyone out
// Only stage records are saved (cleared, stars, best score); what is open is worked out from them.
// Expression Town's older saves also carry `unlockedNodes`; they are read and passed through untouched.

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
   *   legacyIds optional { oldStageId: newStageId } for stages renamed since older saves were written
   */
  constructor({ townId, label, stages, store = progressStore, legacyIds = {} }) {
    Object.assign(this, { townId, label, stages, store, legacyIds });
    this.savedOpens = [];
    this.code = '';
    this.extra = {};
    this.level = 1; this.xp = 0; this.coins = 50;
    this.records = {};
    this.townOpen = [];
    this.fullAccess = false;
  }

  /** Signs a code in and loads its progress. Resolves to { success, error?, townLocked?, reason? }. */
  async load(rawCode, options = {}) {
    const code = normalizeCode(rawCode);
    if (!code) return { success: false, error: 'bad_shape' };
    const res = await this.store.loadStudent(code, options);   // options: { fast, onFresh } (see progressStore)
    if (!res.ok) return { success: false, error: res.error };
    this.code = code;
    this.townOpen = res.open || [];
    this.fullAccess = Boolean(res.fullAccess);
    const saved = res.progress && typeof res.progress === 'object' ? res.progress : null;
    this.extra = saved || {};
    this.level = (saved && saved.level) || 1;
    this.xp = (saved && saved.xp) || 0;
    this.coins = saved && saved.coins !== undefined ? saved.coins : 50;
    const slice = (saved && saved.towns && saved.towns[this.townId]) || {};
    this.records = { ...(slice.nodeRecords || {}) };
    this.savedOpens = Array.isArray(slice.unlockedNodes) ? [...slice.unlockedNodes] : [];
    this.renameLegacy();
    const entry = townStates({ progress: saved, open: this.townOpen, fullAccess: this.fullAccess })
      .find((e) => e.town.id === this.townId);
    if (entry && entry.state !== 'open') return { success: true, townLocked: true, reason: entry.reason };
    return { success: true };
  }

  /** Old stage ids in a save are moved to their new id (a record already under the new id wins). */
  renameLegacy() {
    for (const [oldId, newId] of Object.entries(this.legacyIds)) {
      if (this.records[oldId]) { if (!this.records[newId]) this.records[newId] = this.records[oldId]; delete this.records[oldId]; }
      if (this.savedOpens.includes(oldId)) this.savedOpens = [...new Set(this.savedOpens.map((id) => (id === oldId ? newId : id)))];
    }
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
    // reached already: this stage or a later one is cleared, or an older save lists it as open
    if (this.stages.slice(idx).some((s) => this.isCleared(s.id) || this.savedOpens.includes(s.id))) return 'open';
    const prev = this.stages.slice(0, idx).reverse().find((s) => s.built);
    return prev && this.isCleared(prev.id) ? 'open' : 'locked';
  }

  snapshot() {
    const towns = Object.assign({}, this.extra.towns || {});
    const slice = Object.assign({}, towns[this.townId] || {}, { nodeRecords: this.records });
    if (this.savedOpens.length) slice.unlockedNodes = this.savedOpens;      // old saves keep their list (renamed ids)
    towns[this.townId] = slice;
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
    // Owner decision: a town boss is only DEFEATED by a timed run. A practice-only clear keeps its star but is
    // marked practiceOnly, so it does not open the next town (see townSummary in shared/towns.js).
    if (stage.isBoss) {
      const practice = payload.practiceMode === true;
      const practiceOnly = prev.cleared ? Boolean(prev.practiceOnly) && practice : practice;
      if (practiceOnly) this.records[id].practiceOnly = true;
    }
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
