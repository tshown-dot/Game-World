/**
 * World 3 Overworld Controller - "Expression Town" (Topic 3)
 *
 * Features:
 * - One hand-drawn SVG world (see worldArt.js): island, river, roads, themed buildings
 * - Hero walks the actual road (around corners, across the bridge) between stages
 * - Keyboard (Arrows / WASD / Enter / Space), click-to-walk, and on-screen D-pad + A button
 * - Stage states: Open, Cleared (flag + star), Locked (grey + chained door), Under Construction (3-6)
 * - Status bar with P-meter XP, coins, and a badge card for every stage
 * - Multi-world selector ready for future topics
 */

import { REALM_NODES, getEffectivePrerequisite } from './nodes.js?v=w3map3';

/** The Super Map, relative to this town's page. */
const SUPER_MAP_URL = '../../index.html';
const TOWN_ID = 'topic_3';
import { playerState } from './state.js?v=w3map3';
import { hubAudio } from '../../../shared/audio.js';
import { progressStore } from '../../../shared/progressStore.js';
import { CartridgeHarness } from '../../../shared/cartridgeHarness.js';
import {
  MAP_W, MAP_H, PALETTE,
  worldDefs, terrainSvg, scenerySvg, cloudsSvg,
  routeBetween, roadsSvg, bridgeSvg, stageTileSvg,
  buildingArt, lockOverlay, clearedFlag, nameplateSvg,
  badgeIconSvg, heroSvg, cloud,
} from './worldArt.js?v=w3map3';

const BRIDGE_POS = { x: 580, y: 490 };
const PMETER_SEGMENTS = 8;
const WALK_SPEED = 430; // map px per second

const ICON_SOUND_ON = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M3 8h3l4-4v12l-4-4H3z" fill="#1d1433"/><path d="M13 7q2 3 0 6M15.5 5q4 5 0 10" fill="none" stroke="#1d1433" stroke-width="2.2" stroke-linecap="round"/></svg>';
const ICON_SOUND_OFF = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M3 8h3l4-4v12l-4-4H3z" fill="#1d1433"/><path d="M13 7l5 6M18 7l-5 6" fill="none" stroke="#e5484d" stroke-width="2.6" stroke-linecap="round"/></svg>';

function svgStar(filled, size = 22, extra = '') {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? 10 : 4.6;
    pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
  }
  return `<svg viewBox="-12 -12 24 24" width="${size}" height="${size}" ${extra} aria-hidden="true"><polygon points="${pts.join(' ')}" fill="${filled ? PALETTE.gold : '#d9c69c'}" stroke="${PALETTE.ink}" stroke-width="2" stroke-linejoin="round"/></svg>`;
}

class NumeriaHub {
  constructor() {
    this.selectedNode = null;
    this.harness = null;
    this.playerNodeIndex = 0; // Index in REALM_NODES where the hero is standing
    this.isWalking = false;
    this.facingLeft = false;
    this.toastTimeout = null;
    this.heroPos = { ...REALM_NODES[0].mapCoords };
    this.pendingWalkIdx = null;
    this.walkRaf = null;

    this.dom = {
      // Screens
      loginScreen: document.getElementById('loginScreen'),
      loginBackdrop: document.getElementById('loginBackdrop'),
      worldScreen: document.getElementById('worldScreen'),

      // Login elements
      loginForm: document.getElementById('loginForm'),
      codeInput: document.getElementById('codeInput'),
      loginBtn: document.getElementById('loginBtn'),
      loginError: document.getElementById('loginError'),

      // HUD
      hudPlayerCode: document.getElementById('hudPlayerCode'),
      myProgressBtn: document.getElementById('myProgressBtn'),
      progressModal: document.getElementById('progressModal'),
      closeProgressBtn: document.getElementById('closeProgressBtn'),
      progressCode: document.getElementById('progressCode'),
      progressSummary: document.getElementById('progressSummary'),
      progressList: document.getElementById('progressList'),
      progressSync: document.getElementById('progressSync'),
      hudPlayerLevel: document.getElementById('hudPlayerLevel'),
      hudXpCurrent: document.getElementById('hudXpCurrent'),
      hudXpNext: document.getElementById('hudXpNext'),
      pmeterSegs: document.getElementById('pmeterSegs'),
      pmeterP: document.getElementById('pmeterP'),
      hudCoins: document.getElementById('hudCoins'),
      badgeSlots: document.getElementById('badgeSlots'),
      soundToggleBtn: document.getElementById('soundToggleBtn'),
      soundIcon: document.getElementById('soundIcon'),
      fullscreenBtn: document.getElementById('fullscreenBtn'),
      switchUserBtn: document.getElementById('switchUserBtn'),
      teacherBanner: document.getElementById('teacherBanner'),
      worldSelectBtn: document.getElementById('worldSelectBtn'),

      // Map
      mapSvgContainer: document.getElementById('mapSvgContainer'),
      townToast: document.getElementById('townToast'),
      townToastText: document.getElementById('townToastText'),

      // Status bar
      currentBuildingBadge: document.getElementById('currentBuildingBadge'),
      currentBuildingTitle: document.getElementById('currentBuildingTitle'),
      currentBuildingStatus: document.getElementById('currentBuildingStatus'),
      dpadPrevBtn: document.getElementById('dpadPrevBtn'),
      dpadNextBtn: document.getElementById('dpadNextBtn'),
      enterDoorBtn: document.getElementById('enterDoorBtn'),

      // Stage briefing
      questModal: document.getElementById('questModal'),
      questArt: document.getElementById('questArt'),
      questRegion: document.getElementById('questRegion'),
      questTitle: document.getElementById('questTitle'),
      questSubtitle: document.getElementById('questSubtitle'),
      questStandard: document.getElementById('questStandard'),
      questDescription: document.getElementById('questDescription'),
      questBoss: document.getElementById('questBoss'),
      questXpReward: document.getElementById('questXpReward'),
      questCoinsReward: document.getElementById('questCoinsReward'),
      questStarsContainer: document.getElementById('questStarsContainer'),
      embarkQuestBtn: document.getElementById('embarkQuestBtn'),
      closeQuestBtn: document.getElementById('closeQuestBtn'),

      // Stage clear
      victoryModal: document.getElementById('victoryModal'),
      victoryBadgeCard: document.getElementById('victoryBadgeCard'),
      victoryTitle: document.getElementById('victoryTitle'),
      victoryStarsContainer: document.getElementById('victoryStarsContainer'),
      victoryScoreText: document.getElementById('victoryScoreText'),
      victoryXpText: document.getElementById('victoryXpText'),
      victoryCoinsText: document.getElementById('victoryCoinsText'),
      victoryLevelUpNotice: document.getElementById('victoryLevelUpNotice'),
      victoryNextUnlockNotice: document.getElementById('victoryNextUnlockNotice'),
      victoryNextUnlockName: document.getElementById('victoryNextUnlockName'),
      returnToMapBtn: document.getElementById('returnToMapBtn'),
    };
  }

  init() {
    this.updateSoundButtonVisuals();
    this.initHarness();
    this.bindEvents();
    this.renderLoginBackdrop();

    // Remember the last code on this device so students do not retype it every day.
    const lastCode = progressStore.getActiveCode();
    if (lastCode) {
      if (this.dom.codeInput) this.dom.codeInput.value = lastCode;
      this.loginWithCode(lastCode);
    }

    // Send any saves that were waiting for the network to come back.
    window.addEventListener('online', () => {
      if (playerState.code) progressStore.flushQueue(playerState.code).then(() => this.updateProgressSync());
    });
  }

  updateSoundButtonVisuals() {
    if (this.dom.soundIcon) {
      this.dom.soundIcon.innerHTML = hubAudio.isMuted ? ICON_SOUND_OFF : ICON_SOUND_ON;
    }
  }

  initHarness() {
    this.harness = new CartridgeHarness({
      onComplete: (node, payload) => this.handleCartridgeCompletion(node, payload),
      onExit: () => {
        this.renderMap();
        this.updateHUD();
      }
    });
  }

  bindEvents() {
    const unlockListener = () => {
      hubAudio.unlockAudio();
      window.removeEventListener('pointerdown', unlockListener);
      window.removeEventListener('keydown', unlockListener);
    };
    window.addEventListener('pointerdown', unlockListener);
    window.addEventListener('keydown', unlockListener);

    this.dom.soundToggleBtn?.addEventListener('click', () => {
      hubAudio.toggleMute();
      this.updateSoundButtonVisuals();
      if (!hubAudio.isMuted) hubAudio.playSelect();
    });

    this.dom.fullscreenBtn?.addEventListener('click', () => {
      hubAudio.playSelect();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    this.dom.worldSelectBtn?.addEventListener('click', () => {
      // Back to the Super Map, which puts the hero outside this town.
      hubAudio.playSelect();
      location.href = `${SUPER_MAP_URL}?from=${TOWN_ID}`;
    });

    // Sign out: forget the code on this device and return to the Super Map's sign-in.
    this.dom.switchUserBtn?.addEventListener('click', () => {
      hubAudio.playSelect();
      this.cancelWalk();
      progressStore.clearActiveCode();
      location.href = SUPER_MAP_URL;
    });

    // Code login form
    this.dom.loginForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = this.dom.codeInput ? this.dom.codeInput.value : '';
      this.loginWithCode(code);
    });

    // My Progress screen
    this.dom.myProgressBtn?.addEventListener('click', () => {
      hubAudio.playSelect();
      this.openProgressModal();
    });
    this.dom.closeProgressBtn?.addEventListener('click', () => {
      hubAudio.playSelect();
      this.dom.progressModal.classList.add('hidden');
    });

    // On-screen D-Pad & A button
    this.dom.dpadPrevBtn?.addEventListener('click', () => this.stepPlayer(-1));
    this.dom.dpadNextBtn?.addEventListener('click', () => this.stepPlayer(1));
    this.dom.enterDoorBtn?.addEventListener('click', () => {
      if (this.isWalking) return;
      const node = REALM_NODES[this.playerNodeIndex];
      if (node) this.tryEnterBuilding(node);
    });

    // Click a building or tile on the map to walk there (delegated: the SVG is re-rendered)
    this.dom.mapSvgContainer?.addEventListener('click', (e) => {
      const target = e.target.closest('[data-idx]');
      if (!target) return;
      const idx = Number(target.getAttribute('data-idx'));
      if (Number.isNaN(idx)) return;
      if (idx === this.playerNodeIndex && !this.isWalking) {
        this.tryEnterBuilding(REALM_NODES[idx]);
      } else {
        this.walkPlayerToIndex(idx, true);
      }
    });

    // Keyboard navigation on the overworld
    window.addEventListener('keydown', (e) => {
      if (!this.dom.loginScreen.classList.contains('hidden')) return;
      if (this.harness && this.harness.currentNode) return;

      if (!this.dom.victoryModal.classList.contains('hidden')) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.dom.returnToMapBtn.click();
        }
        return;
      }

      if (!this.dom.progressModal.classList.contains('hidden')) {
        if (e.key === 'Escape') this.dom.closeProgressBtn.click();
        return;
      }

      // Stage briefing open: Enter/Space starts the stage, Escape closes
      if (!this.dom.questModal.classList.contains('hidden')) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.dom.embarkQuestBtn.click();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.dom.closeQuestBtn.click();
        }
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.stepPlayer(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        this.stepPlayer(-1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (this.isWalking) return;
        const node = REALM_NODES[this.playerNodeIndex];
        if (node) this.tryEnterBuilding(node);
      }
    });

    // Stage briefing actions
    this.dom.closeQuestBtn?.addEventListener('click', () => {
      hubAudio.playSelect();
      this.dom.questModal.classList.add('hidden');
    });
    this.dom.embarkQuestBtn?.addEventListener('click', () => {
      if (!this.selectedNode) return;
      this.dom.questModal.classList.add('hidden');
      this.harness.launch(this.selectedNode);
    });

    // Stage clear: back to the map, then walk to the newly opened stage
    this.dom.returnToMapBtn?.addEventListener('click', () => {
      hubAudio.playSelect();
      this.dom.victoryModal.classList.add('hidden');
      this.renderMap();
      this.updateHUD();
      if (this.pendingWalkIdx !== null) {
        const idx = this.pendingWalkIdx;
        this.pendingWalkIdx = null;
        setTimeout(() => this.walkPlayerToIndex(idx), 250);
      }
    });
  }

  showLoginError(msg) {
    if (!this.dom.loginError) return;
    this.dom.loginError.textContent = msg;
    this.dom.loginError.classList.remove('hidden');
    setTimeout(() => this.dom.loginError.classList.add('hidden'), 4000);
  }

  showTownToast(msg) {
    if (!this.dom.townToast || !this.dom.townToastText) return;
    clearTimeout(this.toastTimeout);
    this.dom.townToastText.textContent = msg;
    // Restart the pop animation
    this.dom.townToast.classList.add('hidden');
    void this.dom.townToast.offsetWidth;
    this.dom.townToast.classList.remove('hidden');
    this.toastTimeout = setTimeout(() => this.dom.townToast.classList.add('hidden'), 3400);
  }

  async loginWithCode(rawCode) {
    if (this.loggingIn) return;
    this.loggingIn = true;
    const label = this.dom.loginBtn?.querySelector('span');
    if (this.dom.loginBtn) this.dom.loginBtn.disabled = true;
    if (label) label.textContent = 'SIGNING IN…';
    let result;
    try {
      // Coming from the Super Map, this device already has the code's copy: open at once, check the sheet behind it.
      result = await playerState.loadPlayer(rawCode, { fast: true, onFresh: (fresh) => {
        if (!fresh.ok && fresh.error === 'bad_code') { progressStore.clearActiveCode(); location.href = SUPER_MAP_URL; }
      } });
    } finally {
      this.loggingIn = false;
      if (this.dom.loginBtn) this.dom.loginBtn.disabled = false;
      if (label) label.textContent = '▶ PRESS START';
    }
    if (!result || !result.success) {
      hubAudio.playLockRattle();
      this.showLoginError(result?.error || 'That code did not work.');
      progressStore.clearActiveCode();
      return;
    }

    hubAudio.playSelect();
    progressStore.setActiveCode(playerState.code);

    this.dom.loginScreen.classList.add('hidden');
    this.dom.worldScreen.classList.remove('hidden');
    // Drop the title-screen map so its SVG pattern ids never shadow the live map's.
    if (this.dom.loginBackdrop) this.dom.loginBackdrop.innerHTML = '';

    this.setInitialPlayerPosition();
    this.updateHUD();
    this.renderMap();
  }

  setInitialPlayerPosition() {
    let bestIdx = 0;
    REALM_NODES.forEach((n, idx) => {
      if (!n.isWip && playerState.isNodeUnlocked(n.id)) bestIdx = idx;
    });
    this.cancelWalk();
    this.playerNodeIndex = bestIdx;
    this.heroPos = { ...REALM_NODES[bestIdx].mapCoords };
  }

  /* ---------------------------------------------------------------- */
  /* HUD / status bar                                                  */
  /* ---------------------------------------------------------------- */
  updateHUD() {
    if (this.dom.hudPlayerCode) this.dom.hudPlayerCode.textContent = playerState.code;
    if (this.dom.hudPlayerLevel) this.dom.hudPlayerLevel.textContent = `LV.${playerState.level}`;

    const xpNext = playerState.getXpForNextLevel();
    if (this.dom.hudXpCurrent) this.dom.hudXpCurrent.textContent = playerState.xp;
    if (this.dom.hudXpNext) this.dom.hudXpNext.textContent = xpNext;

    const pct = Math.min(1, Math.max(0, playerState.xp / Math.max(1, xpNext)));
    const lit = Math.floor(pct * PMETER_SEGMENTS);
    if (this.dom.pmeterSegs) {
      this.dom.pmeterSegs.innerHTML = Array.from({ length: PMETER_SEGMENTS }, (_, i) =>
        `<span class="pseg ${i < lit ? 'on' : ''}"></span>`).join('');
    }
    this.dom.pmeterP?.classList.toggle('on', lit >= PMETER_SEGMENTS - 1);

    if (this.dom.hudCoins) this.dom.hudCoins.textContent = playerState.coins.toLocaleString();

    this.dom.teacherBanner?.classList.toggle('hidden', !playerState.isTeacherOverride);

    this.renderBadgeSlots();
    this.updateBottomLocationBar();
  }

  renderBadgeSlots() {
    if (!this.dom.badgeSlots) return;
    this.dom.badgeSlots.innerHTML = REALM_NODES.map((node, idx) => {
      const cleared = Boolean(playerState.nodeRecords[node.id]?.cleared);
      const cls = node.isWip ? 'wip' : cleared ? 'earned' : '';
      const here = idx === this.playerNodeIndex ? 'is-here' : '';
      const code = node.id === 'node_apex' ? 'BOSS' : node.lessonCode;
      const title = `${node.badgeName}${cleared ? ' (earned)' : node.isWip ? ' (coming soon)' : ''}`;
      return `
        <div class="badge-slot ${cls} ${here}" title="${title}">
          ${cleared ? `<div class="-mt-2">${badgeIconSvg(node.buildingType, 26)}</div>` : ''}
          <span class="slot-code">${code}</span>
        </div>`;
    }).join('');
  }

  stageState(node) {
    if (node.isWip) return 'wip';
    if (!playerState.isNodeUnlocked(node.id)) return 'locked';
    if (playerState.nodeRecords[node.id]?.cleared) return 'cleared';
    return 'open';
  }

  updateBottomLocationBar() {
    const node = REALM_NODES[this.playerNodeIndex];
    if (!node) return;
    const state = this.stageState(node);

    if (this.dom.currentBuildingBadge) {
      this.dom.currentBuildingBadge.textContent = node.id === 'node_apex' ? 'BOSS' : node.lessonCode;
    }
    if (this.dom.currentBuildingTitle) {
      this.dom.currentBuildingTitle.textContent = `${node.title} · ${node.subtitle}`;
    }

    const btn = this.dom.enterDoorBtn;
    const status = this.dom.currentBuildingStatus;
    if (!btn || !status) return;
    btn.classList.remove('is-open', 'is-locked', 'is-wip');
    const label = btn.querySelector('.a-btn-label');

    if (state === 'wip') {
      status.innerHTML = `<span class="text-[#ffd23f]">Under construction. Keep walking to Stage 3-7!</span>`;
      btn.classList.add('is-wip');
      if (label) label.textContent = 'SOON';
    } else if (state === 'locked') {
      status.innerHTML = `<span class="text-[#ff9aa0]">Locked. Clear the stage before this one first.</span>`;
      btn.classList.add('is-locked');
      if (label) label.textContent = 'LOCKED';
    } else {
      const stars = playerState.nodeRecords[node.id]?.stars || 0;
      status.innerHTML = state === 'cleared'
        ? `<span class="text-[#7dffb0]">Cleared ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} · Press A, SPACE, or ENTER to play again</span>`
        : `<span class="text-[#7dffb0]">Door open! Press A, SPACE, or ENTER to go in</span>`;
      btn.classList.add('is-open');
      if (label) label.textContent = 'ENTER';
    }
  }

  /* ---------------------------------------------------------------- */
  /* Walking                                                           */
  /* ---------------------------------------------------------------- */
  stepPlayer(delta) {
    if (this.isWalking) return;
    const targetIdx = Math.max(0, Math.min(REALM_NODES.length - 1, this.playerNodeIndex + delta));
    if (targetIdx === this.playerNodeIndex) return;
    this.walkPlayerToIndex(targetIdx);
  }

  cancelWalk() {
    if (this.walkRaf) cancelAnimationFrame(this.walkRaf);
    this.walkRaf = null;
    this.isWalking = false;
    document.getElementById('heroSprite')?.classList.remove('walking');
  }

  /**
   * Walks the hero along the road, tile by tile, to the target stage.
   */
  walkPlayerToIndex(targetIdx, openOnArrival = false) {
    if (this.isWalking) return;
    if (targetIdx < 0 || targetIdx >= REALM_NODES.length) return;

    if (targetIdx === this.playerNodeIndex) {
      if (openOnArrival) this.tryEnterBuilding(REALM_NODES[targetIdx]);
      return;
    }

    // Build the polyline through every stage between here and there.
    const dir = targetIdx > this.playerNodeIndex ? 1 : -1;
    const points = [{ ...REALM_NODES[this.playerNodeIndex].mapCoords }];
    const arrivals = []; // { dist, idx } distance along the path where each stage tile is reached
    let i = this.playerNodeIndex;
    let total = 0;
    while (i !== targetIdx) {
      const route = routeBetween(REALM_NODES[i], REALM_NODES[i + dir]).slice(1);
      route.forEach((p) => {
        const prev = points[points.length - 1];
        total += Math.hypot(p.x - prev.x, p.y - prev.y);
        points.push(p);
      });
      i += dir;
      arrivals.push({ dist: total, idx: i });
    }

    const hero = document.getElementById('heroSprite');
    this.isWalking = true;
    hero?.classList.remove('hop');
    hero?.classList.add('walking');
    hubAudio.playStep();

    // Long trips go faster so no walk takes more than ~2.4s.
    const speed = Math.max(WALK_SPEED, total / 2.4);
    let travelled = 0;
    let last = performance.now();
    let nextArrival = 0;

    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      travelled = Math.min(total, travelled + speed * dt);

      // Locate position along the polyline
      let remain = travelled;
      let pos = points[points.length - 1];
      for (let k = 1; k < points.length; k++) {
        const a = points[k - 1];
        const b = points[k];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (remain <= len) {
          const t = len === 0 ? 1 : remain / len;
          pos = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
          if (b.x !== a.x) this.facingLeft = b.x < a.x;
          break;
        }
        remain -= len;
      }
      this.heroPos = pos;
      this.applyHeroTransform();

      while (nextArrival < arrivals.length && travelled >= arrivals[nextArrival].dist - 0.5) {
        this.playerNodeIndex = arrivals[nextArrival].idx;
        nextArrival++;
        if (nextArrival < arrivals.length) hubAudio.playStep();
        this.highlightActiveBuilding();
        this.updateBottomLocationBar();
        this.renderBadgeSlots();
      }

      if (travelled < total) {
        this.walkRaf = requestAnimationFrame(tick);
        return;
      }

      // Arrived
      this.walkRaf = null;
      this.isWalking = false;
      this.playerNodeIndex = targetIdx;
      this.heroPos = { ...REALM_NODES[targetIdx].mapCoords };
      this.applyHeroTransform();
      hero?.classList.remove('walking');
      void hero?.getBoundingClientRect();
      hero?.classList.add('hop');
      hubAudio.playNodeHover();
      this.highlightActiveBuilding();
      this.updateBottomLocationBar();
      this.renderBadgeSlots();

      if (openOnArrival) {
        setTimeout(() => this.tryEnterBuilding(REALM_NODES[targetIdx]), 220);
      }
    };

    this.walkRaf = requestAnimationFrame(tick);
  }

  applyHeroTransform() {
    const hero = document.getElementById('heroSprite');
    if (!hero) return;
    hero.setAttribute('transform', `translate(${this.heroPos.x.toFixed(1)} ${(this.heroPos.y + 4).toFixed(1)})`);
    hero.querySelector('.hero-facing')?.setAttribute('transform', this.facingLeft ? 'scale(-1 1)' : 'scale(1 1)');
  }

  highlightActiveBuilding() {
    const current = REALM_NODES[this.playerNodeIndex]?.id;
    this.dom.mapSvgContainer?.querySelectorAll('[data-node]').forEach((el) => {
      el.classList.toggle('is-current', el.getAttribute('data-node') === current);
    });
  }

  /* ---------------------------------------------------------------- */
  /* Map rendering                                                     */
  /* ---------------------------------------------------------------- */
  buildWorldSvg({ withHero = true, aspect = 'meet' } = {}) {
    const segments = [];
    for (let i = 0; i < REALM_NODES.length - 1; i++) {
      const next = REALM_NODES[i + 1];
      const open = Boolean(next.isWip) || playerState.isNodeUnlocked(next.id);
      segments.push({ points: routeBetween(REALM_NODES[i], next), open });
    }

    const stages = REALM_NODES.map((node, idx) => this.stageSvg(node, idx)).join('');

    return `
      <svg viewBox="0 0 ${MAP_W} ${MAP_H}" preserveAspectRatio="xMidYMid ${aspect}" xmlns="http://www.w3.org/2000/svg">
        ${worldDefs()}
        ${terrainSvg()}
        ${roadsSvg(segments, REALM_NODES[0].mapCoords)}
        ${bridgeSvg(BRIDGE_POS.x, BRIDGE_POS.y)}
        ${scenerySvg()}
        ${cloudsSvg()}
        ${stages}
        ${withHero ? `<g id="heroSprite" transform="translate(${this.heroPos.x} ${this.heroPos.y + 4})">${heroSvg()}</g>` : ''}
      </svg>`;
  }

  stageSvg(node, idx) {
    const state = this.stageState(node);
    const isCurrent = idx === this.playerNodeIndex;
    const art = buildingArt(node.buildingType);
    const { x, y } = node.mapCoords;

    return `
      <g class="map-stage" data-idx="${idx}" transform="translate(${x} ${y})">
        <title>${node.lessonCode === 'BOSS' ? 'Boss' : 'Stage ' + node.lessonCode}: ${node.title} (${node.subtitle})</title>
        <g class="bldg ${state === 'locked' ? 'bldg-locked' : ''}">
          ${art.svg}
          ${state === 'locked' ? lockOverlay(art.door) : ''}
        </g>
        <g data-node="${node.id}" class="nameplate ${isCurrent ? 'is-current' : ''}">
          ${nameplateSvg(node.title, art.top - 12, false)}
        </g>
      </g>
      <g data-idx="${idx}" class="map-stage">
        ${stageTileSvg(node, state, isCurrent)}
        ${state === 'cleared' ? `<g transform="translate(${x} ${y})">${clearedFlag()}</g>` : ''}
      </g>`;
  }

  renderMap() {
    if (!this.dom.mapSvgContainer) return;
    this.cancelWalk();
    this.heroPos = { ...REALM_NODES[this.playerNodeIndex].mapCoords };
    this.dom.mapSvgContainer.innerHTML = this.buildWorldSvg();
    this.applyHeroTransform();
    this.highlightActiveBuilding();
    this.updateBottomLocationBar();
  }

  renderLoginBackdrop() {
    if (!this.dom.loginBackdrop) return;
    this.dom.loginBackdrop.innerHTML = this.buildWorldSvg({ withHero: false, aspect: 'slice' });
  }

  /* ---------------------------------------------------------------- */
  /* Entering stages                                                   */
  /* ---------------------------------------------------------------- */
  tryEnterBuilding(node) {
    if (node.isWip) {
      hubAudio.playLockRattle();
      this.showTownToast(`${node.title} (Lesson 3-6: Distributive Property) is still being built. Walk on past to Stage 3-7!`);
      return;
    }

    if (!playerState.isNodeUnlocked(node.id)) {
      hubAudio.playLockRattle();
      const stageEl = this.dom.mapSvgContainer?.querySelector(`.map-stage[data-idx="${REALM_NODES.indexOf(node)}"] .bldg`);
      if (stageEl) {
        stageEl.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
          { duration: 260, iterations: 2 }
        );
      }
      const effectivePrereq = getEffectivePrerequisite(node.id);
      const prereqNode = REALM_NODES.find(n => n.id === effectivePrereq);
      const reqName = prereqNode ? `${prereqNode.title} (${prereqNode.lessonCode})` : 'the stage before this one';
      this.showTownToast(`Locked! Clear ${reqName} first to open this door.`);
      return;
    }

    hubAudio.playQuestOpen();
    this.openQuestModal(node);
  }

  /* ---------------------------------------------------------------- */
  /* My Progress: stars, badges and save status (screenshot-friendly)  */
  /* ---------------------------------------------------------------- */
  openProgressModal() {
    if (!this.dom.progressModal) return;
    const records = playerState.nodeRecords || {};
    const stages = REALM_NODES.filter((n) => !n.isWip);
    const cleared = stages.filter((n) => records[n.id]?.cleared).length;
    const stars = stages.reduce((sum, n) => sum + (records[n.id]?.stars || 0), 0);

    if (this.dom.progressCode) this.dom.progressCode.textContent = `Code ${playerState.code}`;
    if (this.dom.progressSummary) {
      this.dom.progressSummary.innerHTML = [
        ['LEVEL', playerState.level],
        ['STAGES', `${cleared}/${stages.length}`],
        ['STARS', `${stars}/${stages.length * 3}`],
        ['COINS', playerState.coins.toLocaleString()],
      ].map(([label, value]) => `
        <div class="progress-stat">
          <div class="px text-[8px] text-[#8a6d3b]">${label}</div>
          <div class="px text-[15px] text-[#1d1433] mt-1">${value}</div>
        </div>`).join('');
    }
    if (this.dom.progressList) {
      this.dom.progressList.innerHTML = stages.map((node) => {
        const rec = records[node.id];
        const done = Boolean(rec?.cleared);
        const code = node.id === 'node_apex' ? 'BOSS' : node.lessonCode;
        const best = done ? `Best ${rec.bestScore}/${rec.total}` : playerState.isNodeUnlocked(node.id) ? 'Not cleared yet' : 'Locked';
        return `
          <div class="progress-row ${done ? 'done' : ''}">
            <div class="progress-badge">${done ? badgeIconSvg(node.buildingType, 28) : `<span class="px text-[8px] text-[#8a6d3b]">${code}</span>`}</div>
            <div class="flex-1 min-w-0">
              <div class="px text-[9px] text-[#1d1433] truncate">${code} ${node.title.toUpperCase()}</div>
              <div class="text-[11px] font-bold text-[#5e4a26]">${best}</div>
            </div>
            <div class="flex gap-0.5">${[1, 2, 3].map((i) => svgStar(i <= (rec?.stars || 0), 20)).join('')}</div>
          </div>`;
      }).join('');
    }
    this.updateProgressSync();
    this.dom.progressModal.classList.remove('hidden');
  }

  updateProgressSync() {
    if (!this.dom.progressSync) return;
    const waiting = playerState.code ? progressStore.pendingCount(playerState.code) : 0;
    this.dom.progressSync.textContent = waiting === 0
      ? 'Saved. Your teacher can see your progress.'
      : 'Saved on this Chromebook. It will send to your teacher when the internet is back. Keep this page open.';
  }

  questArtSvg(node) {
    const art = buildingArt(node.buildingType);
    const top = art.top - 20;
    const vbH = 40 - top;
    return `
      <svg viewBox="-100 ${top} 200 ${vbH}" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">
        ${worldDefs()}
        <rect x="-200" y="${top - 400}" width="400" height="${vbH + 600}" fill="#8fd3ff"/>
        <rect x="-200" y="-60" width="400" height="20" fill="#b5e3ff"/>
        <circle cx="76" cy="${top + 34}" r="16" fill="${PALETTE.gold}" stroke="${PALETTE.ink}" stroke-width="3"/>
        ${cloud(-70, top + 40, 0.55, 0, 0).replace('class="cloud"', '')}
        <path d="M-200 -36 Q-140 -70 -80 -38 Q-20 -64 40 -36 Q110 -72 200 -36 V60 H-200 Z" fill="#3fa53a" stroke="${PALETTE.ink}" stroke-width="3"/>
        <rect x="-200" y="-24" width="400" height="80" fill="url(#grassTex)"/>
        <path d="M-200 -24 H200" stroke="${PALETTE.ink}" stroke-width="3"/>
        <rect x="-200" y="-6" width="400" height="20" fill="${PALETTE.road}" stroke="${PALETTE.ink}" stroke-width="3"/>
        <g>${art.svg}</g>
      </svg>`;
  }

  openQuestModal(node) {
    this.selectedNode = node;
    const record = playerState.nodeRecords[node.id];
    const stageLabel = node.lessonCode === 'BOSS' ? 'Boss Stage' : `Stage ${node.lessonCode}`;

    if (this.dom.questArt) {
      this.dom.questArt.style.background = '#8fd3ff';
      this.dom.questArt.style.borderRightColor = PALETTE.ink;
      this.dom.questArt.innerHTML = this.questArtSvg(node);
    }
    if (this.dom.questRegion) this.dom.questRegion.textContent = `${node.regionName} • ${stageLabel}`;
    if (this.dom.questTitle) this.dom.questTitle.textContent = node.title.toUpperCase();
    if (this.dom.questSubtitle) this.dom.questSubtitle.textContent = node.subtitle;
    if (this.dom.questStandard) this.dom.questStandard.textContent = node.standard;
    if (this.dom.questDescription) this.dom.questDescription.textContent = node.description;
    if (this.dom.questBoss) {
      this.dom.questBoss.textContent = node.bossName;
      this.dom.questBoss.title = node.bossName;
    }
    if (this.dom.questXpReward) this.dom.questXpReward.textContent = `+${node.xpReward} XP`;
    if (this.dom.questCoinsReward) this.dom.questCoinsReward.textContent = `+${node.coinsReward}`;

    if (this.dom.questStarsContainer) {
      const starCount = record ? (record.stars || 0) : 0;
      this.dom.questStarsContainer.innerHTML = `
        <span class="text-[11px] font-black uppercase text-[#8a6d3b] mr-1">Best</span>
        ${[1, 2, 3].map(i => svgStar(i <= starCount, 24)).join('')}`;
    }

    this.dom.questModal.classList.remove('hidden');
  }

  async handleCartridgeCompletion(node, payload) {
    this.harness.close();
    hubAudio.playLevelUp();

    const result = await playerState.processCartridgeCompletion(node.id, payload);

    if (this.dom.victoryBadgeCard) {
      this.dom.victoryBadgeCard.innerHTML = badgeIconSvg(node.buildingType, 58);
      this.dom.victoryBadgeCard.title = node.badgeName;
    }
    if (this.dom.victoryTitle) this.dom.victoryTitle.textContent = `${node.title.toUpperCase()} CLEARED!`;
    if (this.dom.victoryScoreText) {
      this.dom.victoryScoreText.textContent = `Score: ${payload.score || 10} / ${payload.total || 10}`;
    }
    if (this.dom.victoryXpText) this.dom.victoryXpText.textContent = `+${result.xpGained} XP`;
    if (this.dom.victoryCoinsText) this.dom.victoryCoinsText.textContent = `+${result.coinsGained}`;

    if (this.dom.victoryStarsContainer) {
      this.dom.victoryStarsContainer.innerHTML = [1, 2, 3]
        .map(i => `<span class="victory-star" style="animation-delay:${0.5 + i * 0.18}s">${svgStar(i <= result.stars, 44)}</span>`)
        .join('');
    }

    this.dom.victoryLevelUpNotice?.classList.toggle('hidden', !result.leveledUp);

    this.pendingWalkIdx = null;
    if (this.dom.victoryNextUnlockNotice && this.dom.victoryNextUnlockName) {
      if (result.nextUnlockedNode) {
        this.dom.victoryNextUnlockName.textContent = `${result.nextUnlockedNode.title} (Stage ${result.nextUnlockedNode.lessonCode})`;
        this.dom.victoryNextUnlockNotice.classList.remove('hidden');
        // Walk the hero to the newly opened stage once the player is back on the map.
        const nextIdx = REALM_NODES.findIndex(n => n.id === result.nextUnlockedNode.id);
        if (nextIdx >= 0) this.pendingWalkIdx = nextIdx;
      } else {
        this.dom.victoryNextUnlockNotice.classList.add('hidden');
      }
    }

    this.dom.victoryModal.classList.remove('hidden');
    this.updateHUD();
    this.renderMap();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const hub = new NumeriaHub();
  hub.init();
});
