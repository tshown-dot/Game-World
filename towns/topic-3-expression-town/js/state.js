/**
 * Expression Town (Topic 3) - Player State
 *
 * Manages player progression, unlocked stages, coins and leveling.
 * Students sign in with a teacher-issued code. Progress is saved through the shared store
 * (shared/progressStore.js): on this device right away, and to the teacher sheet in the background.
 */

import { progressStore, normalizeCode } from '../../../shared/progressStore.js';
import { REALM_NODES, getEffectivePrerequisite } from './nodes.js?v=w3map3';

/** This town's slice of the saved progress lives under this key. Other towns use their own keys. */
export const TOWN_ID = 'topic_3';

/** Old stage IDs found in saves, mapped to the stage they belong to now. */
export const LEGACY_NODE_IDS = { node_3_4: 'node_3_2_lcm' };

export class PlayerState {
  constructor(store = progressStore) {
    this.store = store;
    this.code = '';              // the student's anonymous code, e.g. K7M2QX
    this.townOpen = [];          // teacher-sheet flags: which towns are open for this student
    this.extra = {};             // other saved fields (other towns) are kept untouched
    this.level = 1;
    this.xp = 0;
    this.coins = 50;
    this.unlockedNodes = ['node_3_1'];
    this.nodeRecords = {}; // { [nodeId]: { stars: 3, bestScore: 10, total: 10, cleared: true } }
    this.isTeacherOverride = false;
    this.isFullAccess = false;
  }

  getXpForNextLevel() {
    return this.level * 100;
  }

  async loadPlayer(rawCode) {
    const code = normalizeCode(rawCode);
    if (!code) {
      return { success: false, error: 'Your code has 6 letters and numbers, like K7M2QX. Check your sticky note.' };
    }

    const res = await this.store.loadStudent(code);
    if (!res.ok) {
      return {
        success: false,
        error: res.error === 'bad_code'
          ? "That code isn't in the system. Check your sticky note or ask your teacher."
          : "Can't reach the server. Connect to the internet to sign in on this device the first time.",
      };
    }

    this.code = code;
    this.townOpen = res.open;
    this.isFullAccess = Boolean(res.fullAccess);        // a teacher or preview code: everything is open
    this.isTeacherOverride = this.isFullAccess;

    const saved = res.progress && typeof res.progress === 'object' ? res.progress : null;
    const town = (saved && saved.towns && saved.towns[TOWN_ID]) || {};
    this.extra = saved || {};
    this.level = saved && saved.level ? saved.level : 1;
    this.xp = saved && saved.xp ? saved.xp : 0;
    this.coins = saved && saved.coins !== undefined ? saved.coins : 50;
    this.unlockedNodes = Array.isArray(town.unlockedNodes) && town.unlockedNodes.length > 0
      ? town.unlockedNodes
      : ['node_3_1'];
    this.nodeRecords = town.nodeRecords || {};

    this.migrateLegacyNodeIds();
    this.backfillUnlocks();
    return { success: true };
  }

  /**
   * Renames stage IDs from older saves. The LCM game used to be Stage 3-4 ('node_3_4').
   * It is now the second half of Lesson 3-2 ('node_3_2_lcm'), and Lesson 3-4 is the
   * Signal Observatory ('node_3_4_expr'). Any 'node_3_4' in a save is the LCM stage.
   */
  migrateLegacyNodeIds() {
    let changed = false;
    Object.entries(LEGACY_NODE_IDS).forEach(([oldId, newId]) => {
      if (this.unlockedNodes.includes(oldId)) {
        this.unlockedNodes = this.unlockedNodes.filter((id) => id !== oldId);
        if (!this.unlockedNodes.includes(newId)) this.unlockedNodes.push(newId);
        changed = true;
      }
      if (this.nodeRecords[oldId]) {
        if (!this.nodeRecords[newId]) this.nodeRecords[newId] = this.nodeRecords[oldId];
        delete this.nodeRecords[oldId];
        changed = true;
      }
    });
    return changed;
  }

  /**
   * Opens stages that older saves are missing because the map changed after students passed by.
   * 1. A stage whose required stage is already cleared opens (while Lesson 3-6 was under
   *    construction, clearing 3-5 unlocked 3-7 and skipped 3-6).
   * 2. A stage that comes before an open stage opens too (the LCM stage moved in front of
   *    3-3, so a student with 3-3 open has passed the spot where LCM now sits).
   * The fix is kept in memory and is written on the player's next save.
   */
  backfillUnlocks() {
    let added = 0;
    const open = (id) => {
      if (!this.unlockedNodes.includes(id)) {
        this.unlockedNodes.push(id);
        added++;
      }
    };
    REALM_NODES.forEach((node) => {
      if (node.isWip || !node.requiredNodeId) return;
      if (this.nodeRecords[node.requiredNodeId]?.cleared) open(node.id);
    });
    for (let i = REALM_NODES.length - 1; i >= 0; i--) {
      const node = REALM_NODES[i];
      if (!node.requiredNodeId || !this.unlockedNodes.includes(node.id)) continue;
      const prereq = REALM_NODES.find((n) => n.id === node.requiredNodeId);
      if (prereq && !prereq.isWip) open(prereq.id);
    }
    return added;
  }

  /** Everything worth keeping, as plain data. Other towns' saved data is passed through untouched. */
  snapshot() {
    const towns = Object.assign({}, this.extra.towns || {});
    towns[TOWN_ID] = { unlockedNodes: this.unlockedNodes, nodeRecords: this.nodeRecords };
    return Object.assign({}, this.extra, {
      v: 1,
      level: this.level,
      xp: this.xp,
      coins: this.coins,
      towns,
    });
  }

  /** Saves right away on this device and queues the sheet copy. Does nothing until a student has signed in. */
  save() {
    if (!this.code) return Promise.resolve({ pending: 0 });
    return this.store.saveProgress(this.code, this.snapshot());
  }

  isNodeUnlocked(nodeId) {
    if (this.isTeacherOverride || this.isFullAccess) return true;
    const node = REALM_NODES.find(n => n.id === nodeId);
    if (!node || !node.requiredNodeId) return true;

    return this.unlockedNodes.includes(nodeId);
  }

  unlockNode(nodeId) {
    if (!this.unlockedNodes.includes(nodeId)) {
      this.unlockedNodes.push(nodeId);
      return true;
    }
    return false;
  }

  /**
   * Calculates 1 to 3 stars based on percentage score.
   */
  calculateStars(score, total) {
    if (!total || total <= 0) return 3;
    const ratio = score / total;
    if (ratio >= 0.9) return 3;
    if (ratio >= 0.7) return 2;
    return 1;
  }

  /**
   * Applies victory rewards and unlocks following node in the progression chain.
   */
  async processCartridgeCompletion(nodeId, payload = {}) {
    const node = REALM_NODES.find(n => n.id === nodeId);
    if (!node) return { leveledUp: false, nextUnlockedNode: null };

    const score = payload.score || 0;
    const total = payload.total || 10;
    const stars = this.calculateStars(score, total);

    // Update node record
    const prevRecord = this.nodeRecords[nodeId] || { bestScore: 0, stars: 0 };
    this.nodeRecords[nodeId] = {
      cleared: true,
      stars: Math.max(prevRecord.stars || 0, stars),
      bestScore: Math.max(prevRecord.bestScore || 0, score),
      total: total,
      lastPlayed: new Date().toISOString(),
    };

    // Calculate XP and Coins gained
    const xpGained = node.xpReward || 150;
    const coinsGained = node.coinsReward || 50;

    this.coins += coinsGained;
    let leveledUp = false;
    this.xp += xpGained;

    while (this.xp >= this.getXpForNextLevel()) {
      this.xp -= this.getXpForNextLevel();
      this.level += 1;
      leveledUp = true;
    }

    // Determine next node to unlock
    let nextUnlockedNode = null;
    const nodeIndex = REALM_NODES.findIndex(n => n.id === nodeId);
    if (nodeIndex >= 0 && nodeIndex < REALM_NODES.length - 1) {
      let nextNode = REALM_NODES[nodeIndex + 1];

      // If next node is WIP (e.g. Lesson 3-6), skip to the one after it
      if (nextNode.isWip && nodeIndex + 2 < REALM_NODES.length) {
        nextNode = REALM_NODES[nodeIndex + 2];
      }

      if (this.unlockNode(nextNode.id)) {
        nextUnlockedNode = nextNode;
      }
    }

    // Save and log the result. The device copy is written now; the sheet copy is sent in the background,
    // so the victory screen never waits on the network.
    void this.save();
    if (this.code) {
      void this.store.logResult(this.code, {
        town: 'topic-3',
        lesson: node.lessonCode,
        game: node.id,
        score,
        problems_attempted: total,
        problems_correct: score,
        accuracy: Math.round((score / Math.max(1, total)) * 100),
        boss_defeated: payload.bossDefeated === true,
        practice_mode: payload.practiceMode === true,
      });
    }

    return {
      leveledUp,
      newLevel: this.level,
      xpGained,
      coinsGained,
      stars,
      nextUnlockedNode,
    };
  }
}

export const playerState = new PlayerState();
