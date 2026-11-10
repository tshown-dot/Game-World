/**
 * Charge Runner: Exponent Reactor - Game Engine (DOM, timers, canvas, flow)
 *   - Combo progression, real stakes (timer, core health, backup cores, meltdown)
 *   - Inline misconception feedback, no blocking pop-ups mid-wave
 *   - Boss climax in Sector 5, sector-cleared stars between sectors
 *   - Mission mode (timed, reports completion to the hub) and Practice mode (untimed, reports nothing)
 *
 * Math and diagnosis live in curriculum.js; problem generation in generator.js.
 */

import {
  CURRICULUM_SECTORS,
  calculatePower,
  diagnoseSubmission,
  diagnoseValue,
  diagnoseExpanded,
  diagnoseCompare,
  diagnoseCards,
  nextCombo,
  comboAfterMiss,
  sectorStars,
  prepareSteps,
  powerText,
  expandedText,
  problemTargetValue,
} from './curriculum.js';

import { generateRun, makeFollowUp, createRng } from './generator.js';
import { soundManager } from './audio.js';

const MAX_READOUT_DIGITS = 7;

const CARD_BASE_CLASS = 'z-10 bg-gray-950/90 border-2 px-6 py-2.5 rounded-2xl shadow-2xl backdrop-blur flex flex-col items-center justify-center transition-all duration-300 mb-1.5';
const CARD_CLASS = {
  idle: `${CARD_BASE_CLASS} border-cyan-500/60 glow-cyan`,
  match: `${CARD_BASE_CLASS} border-emerald-500 glow-emerald`,
  miss: `${CARD_BASE_CLASS} border-rose-500 glow-rose`,
};

const MODE_UI = {
  find: { label: 'Match the Surge: set the base and exponent', console: 'Set the Dials', fire: 'FIRE BEAM', panel: 'dial', keys: '← → base · ↑ ↓ exponent · Enter' },
  expanded: { label: 'Write it as a power', console: 'Set the Dials', fire: 'FIRE BEAM', panel: 'dial', keys: '← → base · ↑ ↓ exponent · Enter' },
  evaluate: { label: 'Calculate the Surge', console: 'Type the Value', fire: 'FIRE BEAM', panel: 'readout', keys: 'Type digits · Enter = Fire' },
  fix: { label: 'Fix the Trainee\'s Log', console: 'Type the Correct Value', fire: 'OVERRIDE LOG', panel: 'readout', keys: 'Type digits · Enter = Fire' },
  compare: { label: 'Which power is bigger?', console: 'Route the Beam', fire: '', panel: 'compare', keys: 'Keys 1 / 2 / 3' },
  cards: { label: 'Boss Charge Cards', console: 'Pick the Right Card', fire: '', panel: 'cards', keys: 'Keys 1 / 2 / 3' },
};

/** What each mode practices (for the end-of-run skill breakdown). */
const SKILL_OF_MODE = {
  find: 'Match a number with a power',
  evaluate: 'Calculate powers',
  fix: 'Calculate powers',
  expanded: 'Write repeated multiplication as a power',
  compare: 'Compare powers',
  cards: 'Compare powers',
};

/** Student-friendly names for each misconception the diagnosers detect. */
const MISTAKE_LABEL = {
  'multiplication-error': 'Multiplied base × exponent (4³ is not 12)',
  'addition-error': 'Added base + exponent',
  'swap-error': 'Swapped the base and exponent',
  'zero-error': 'Zero exponent rule (b⁰ = 1)',
  'one-base-error': 'Powers of 1 (1ⁿ = 1)',
  'power-of-ten': 'Counting zeros in powers of 10',
  'factor-count': 'Multiplied one factor too many or too few',
  'equivalent-form': 'Used a different base than the one repeated',
  'wrong-base': 'Used a different base than the one repeated',
  'compare-error': 'Compared without working out both powers',
  'over-exponentiation': 'Other calculation slips',
  'under-exponentiation': 'Other calculation slips',
  'off-target': 'Other calculation slips',
  timeout: 'Ran out of time',
};

/** HTML for a power like 2⁵ with styled base/exponent. */
function powerHTML(base, exponent, baseColor = 'text-cyan-300', expColor = 'text-amber-400', size = 'text-4xl', ids = {}) {
  const bId = ids.base ? ` id="${ids.base}"` : '';
  const eId = ids.exp ? ` id="${ids.exp}"` : '';
  const expSize = size === 'text-4xl' ? 'text-2xl -translate-y-3' : 'text-lg -translate-y-2';
  return `<span class="flex items-baseline"><span${bId} class="${size} font-black ${baseColor}">${base}</span><span${eId} class="${expSize} font-black ${expColor}">${exponent}</span></span>`;
}

class ExponentReactorGame {
  constructor() {
    // Sector & Wave State
    this.sectorIndex = 0;
    this.waveIndex = 0;
    this.problem = null;
    this.rng = createRng();
    this.run = generateRun(this.rng);       // run[sector] = array of problems
    this.followUpsThisSector = 0;
    this.sectorMisses = 0;
    this.sectorHints = 0;
    this.starsBySector = [];
    this.bossHitFlash = 0;
    this.isSectorClearOpen = false;
    this.isPractice = false;
    this.skillStats = {};     // skill -> { waves, firstTry }   (on-screen only, never saved or sent)
    this.mistakeCounts = {};  // label -> count

    // Input State
    this.base = 2;
    this.exponent = 3;
    this.readout = '';
    this.isDischarging = false;
    this.isBaseLocked = false;

    // Stakes & Metrics
    this.coreHealth = 100;
    this.maxLives = 3;
    this.lives = 3;
    this.score = 0;
    this.totalWattsMitigated = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.firstTryCorrect = 0;
    this.wavesCleared = 0;
    this.waveMisses = 0;
    this.hintsUsed = 0;
    this.hintUsedThisWave = false;

    // Timers
    this.shiftStartTime = Date.now();
    this.waveTimeRemaining = 30;
    this.waveTimerInterval = null;
    this.isPaused = false;
    this.isGameOver = false;
    this.hudClearTimeout = null;
    this.hudShowingError = false;

    this.hasStarted = false;

    // Canvas
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.coreRotation = 0;
    this.beamFiringProgress = 0;

    this.initDOM();
    this.initCanvas();
    this.bindEvents();
    this.startWave({ silent: true });
    this.animateCanvas();
  }

  $(id) {
    return document.getElementById(id);
  }

  initDOM() {
    const ids = [
      'sector-badge', 'sector-title', 'wave-counter', 'timer-display', 'timer-bar', 'health-bar', 'health-text',
      'lives-container', 'combo-multiplier-display', 'score-display', 'audio-toggle-btn', 'audio-icon', 'field-guide-btn',
      'threat-badge', 'hint-toggle-btn', 'hint-strip', 'hint-text', 'core-status-text', 'core-power-curve-text',
      'equation-display-card', 'equation-label', 'trainee-log', 'eq-left', 'eq-right', 'equation-operator',
      'discharge-result-container', 'discharge-evaluated-mw', 'discharge-unit', 'discharge-verdict-badge',
      'ribbon-summary', 'ribbon-nodes-container',
      'console-mode-label', 'console-keys-label', 'dial-panel', 'readout-panel', 'compare-panel', 'cards-panel', 'readout-display',
      'boss-hp-panel', 'boss-hp-segments', 'modal-sector-clear', 'sector-clear-title', 'sector-clear-stars',
      'sector-clear-stats', 'sector-clear-next', 'sector-clear-next-desc', 'sector-clear-continue-btn', 'debrief-stars',
      'briefing-practice-btn', 'briefing-start-label', 'practice-badge', 'stakes-timer', 'stakes-health', 'stakes-cores',
      'debrief-skills', 'debrief-mistakes',
      'compare-left-label', 'compare-right-label',
      'base-number-display', 'base-dec-btn', 'base-inc-btn', 'base-locked-badge', 'base-subtext',
      'exp-number-display', 'exp-dec-btn', 'exp-inc-btn', 'formula-base', 'formula-exp',
      'inline-diagnostic-hud', 'diagnostic-icon', 'diagnostic-title', 'diagnostic-message', 'diagnostic-formula',
      'discharge-btn', 'discharge-label',
      'modal-debrief', 'debrief-icon', 'debrief-title', 'debrief-subtitle', 'debrief-time', 'debrief-watts',
      'debrief-combo', 'debrief-accuracy', 'debrief-cores', 'debrief-hints', 'debrief-restart-btn',
      'modal-field-guide', 'close-field-guide-btn', 'modal-briefing', 'briefing-start-btn', 'briefing-btn',
    ];
    this.el = {};
    ids.forEach(id => {
      const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.el[key] = this.$(id);
    });
    this.basePresetBtns = document.querySelectorAll('.base-preset-btn');
    this.expPresetBtns = document.querySelectorAll('.exp-preset-btn');
    this.keypadBtns = document.querySelectorAll('.keypad-btn');
    this.compareBtns = document.querySelectorAll('.compare-btn');
    this.cardBtns = document.querySelectorAll('.card-btn');
    this.isBriefingOpen = true;

    this.updateAudioIcon();
    this.updateLivesDisplay();
  }

  updateLivesDisplay() {
    const c = this.el.livesContainer;
    if (!c) return;
    c.innerHTML = '';
    for (let i = 0; i < this.maxLives; i++) {
      const span = document.createElement('span');
      span.className = 'core-life-icon transition-all duration-300';
      span.textContent = i < this.lives ? '🔋' : '🪫';
      if (i >= this.lives) span.classList.add('opacity-40');
      c.appendChild(span);
    }
  }

  initCanvas() {
    this.canvas = this.$('reactor-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    const resize = () => {
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
    };
    window.addEventListener('resize', resize);
    resize();
    this.particles = [];
    for (let i = 0; i < 40; i++) {
      this.particles.push({
        x: Math.random() * (this.canvas.width || 600),
        y: Math.random() * (this.canvas.height || 260),
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        radius: Math.random() * 2.5 + 1,
        alpha: Math.random() * 0.7 + 0.3,
      });
    }
  }

  get inputLocked() {
    return !this.hasStarted || this.isPaused || this.isGameOver || this.isDischarging || this.isBriefingOpen;
  }

  bindEvents() {
    const { el } = this;
    el.baseDecBtn.addEventListener('click', () => { soundManager.playClick(); this.setBase(Math.max(1, this.base - 1)); });
    el.baseIncBtn.addEventListener('click', () => { soundManager.playClick(); this.setBase(Math.min(10, this.base + 1)); });
    this.basePresetBtns.forEach(btn => btn.addEventListener('click', e => {
      soundManager.playClick();
      this.setBase(parseInt(e.currentTarget.dataset.val, 10));
    }));
    el.expDecBtn.addEventListener('click', () => { soundManager.playClick(); this.setExponent(Math.max(0, this.exponent - 1)); });
    el.expIncBtn.addEventListener('click', () => { soundManager.playClick(); this.setExponent(Math.min(6, this.exponent + 1)); });
    this.expPresetBtns.forEach(btn => btn.addEventListener('click', e => {
      soundManager.playClick();
      this.setExponent(parseInt(e.currentTarget.dataset.val, 10));
    }));

    this.keypadBtns.forEach(btn => btn.addEventListener('click', e => {
      soundManager.playClick();
      this.pressKey(e.currentTarget.dataset.key);
    }));
    this.compareBtns.forEach(btn => btn.addEventListener('click', e => {
      this.handleDischarge(e.currentTarget.dataset.choice);
    }));
    this.cardBtns.forEach(btn => btn.addEventListener('click', e => {
      this.handleDischarge(parseInt(e.currentTarget.dataset.index, 10));
    }));
    el.sectorClearContinueBtn.addEventListener('click', () => this.continueAfterSectorClear());

    if (el.briefingStartBtn) el.briefingStartBtn.addEventListener('click', () => this.startGameFromBriefing(false));
    if (el.briefingPracticeBtn) el.briefingPracticeBtn.addEventListener('click', () => this.startGameFromBriefing(true));
    if (el.briefingBtn) el.briefingBtn.addEventListener('click', () => this.openBriefing());

    el.dischargeBtn.addEventListener('click', () => this.handleDischarge());

    window.addEventListener('keydown', e => this.handleKeydown(e));

    el.hintToggleBtn.addEventListener('click', () => {
      if (!this.hasStarted || this.isPaused || this.isGameOver || this.isBriefingOpen) return;
      soundManager.playClick();
      el.hintStrip.classList.toggle('hidden');
      if (!el.hintStrip.classList.contains('hidden') && !this.hintUsedThisWave) {
        this.hintUsedThisWave = true;
        this.hintsUsed++;
        this.sectorHints++;
      }
    });

    el.audioToggleBtn.addEventListener('click', () => {
      soundManager.toggleMuted();
      this.updateAudioIcon();
    });

    el.fieldGuideBtn.addEventListener('click', () => this.openFieldGuide());
    el.closeFieldGuideBtn.addEventListener('click', () => this.closeFieldGuide());

    el.debriefRestartBtn.addEventListener('click', () => {
      soundManager.playClick();
      el.modalDebrief.classList.add('hidden');
      this.resetFullStationShift();
    });
  }

  handleKeydown(e) {
    if (this.isFieldGuideOpen) {
      if (e.key === 'Escape' || e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.closeFieldGuide();
      }
      return;
    }
    if (!this.hasStarted) {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.startGameFromBriefing(false);
      }
      return;
    }
    if (this.isBriefingOpen) {
      if (e.code === 'Space' || e.code === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        this.closeBriefing();
      }
      return;
    }
    if (!this.el.modalDebrief.classList.contains('hidden')) return;
    if (this.isSectorClearOpen) {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.continueAfterSectorClear();
      }
      return;
    }
    if (this.isPaused || this.isGameOver || this.isBriefingOpen) return;

    const mode = this.problem ? this.problem.mode : 'find';

    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (MODE_UI[mode].panel === 'dial' || MODE_UI[mode].panel === 'readout') this.handleDischarge();
      return;
    }

    if (e.code === 'KeyH') {
      this.el.hintToggleBtn.click();
      return;
    }

    if (MODE_UI[mode].panel === 'dial') {
      const arrows = {
        ArrowLeft: () => this.setBase(Math.max(1, this.base - 1)),
        ArrowRight: () => this.setBase(Math.min(10, this.base + 1)),
        ArrowUp: () => this.setExponent(Math.min(6, this.exponent + 1)),
        ArrowDown: () => this.setExponent(Math.max(0, this.exponent - 1)),
      };
      if (arrows[e.key]) {
        e.preventDefault();
        if (!this.inputLocked) soundManager.playClick();
        arrows[e.key]();
        return;
      }
    }

    if (MODE_UI[mode].panel === 'readout') {
      if (/^[0-9]$/.test(e.key)) { this.pressKey(e.key); return; }
      if (e.key === 'Backspace') { e.preventDefault(); this.pressKey('back'); return; }
      if (e.key === 'Delete' || e.key === 'Escape') { this.pressKey('clear'); return; }
    }

    if (mode === 'compare') {
      const map = { Digit1: 'left', Numpad1: 'left', Digit2: 'equal', Numpad2: 'equal', Digit3: 'right', Numpad3: 'right' };
      if (map[e.code]) this.handleDischarge(map[e.code]);
    }
    if (mode === 'cards') {
      const map = { Digit1: 0, Numpad1: 0, Digit2: 1, Numpad2: 1, Digit3: 2, Numpad3: 2 };
      if (map[e.code] !== undefined) this.handleDischarge(map[e.code]);
    }
  }

  get isFieldGuideOpen() {
    return !this.el.modalFieldGuide.classList.contains('hidden');
  }

  openFieldGuide() {
    if (this.isFieldGuideOpen) return;
    soundManager.playClick();
    this.wasPausedBeforeGuide = this.isPaused;
    this.isPaused = true;
    this.el.modalFieldGuide.classList.remove('hidden');
  }

  closeFieldGuide() {
    if (!this.isFieldGuideOpen) return;
    // Restore the previous pause state (e.g. still paused if the sector-cleared screen is up).
    this.isPaused = this.wasPausedBeforeGuide || false;
    this.el.modalFieldGuide.classList.add('hidden');
  }

  updateAudioIcon() {
    this.el.audioIcon.textContent = soundManager.getMuted() ? '🔇' : '🔊';
  }

  // ==========================================
  // BRIEFING
  // ==========================================
  startGameFromBriefing(practice = false) {
    if (!this.hasStarted) {
      this.hasStarted = true;
      this.isBriefingOpen = false;
      this.setPracticeMode(practice);
      soundManager.playClick();
      soundManager.playSuccessChord();
      if (this.el.modalBriefing) this.el.modalBriefing.classList.add('hidden');
      this.shiftStartTime = Date.now();
      this.startWave();
    } else {
      this.closeBriefing();
    }
  }

  /** Practice mode: no timer, no core damage, no backup cores, and no completion message to the hub. */
  setPracticeMode(practice) {
    const { el } = this;
    this.isPractice = practice;
    el.practiceBadge.classList.toggle('hidden', !practice);
    el.practiceBadge.classList.toggle('flex', practice);
    [el.stakesTimer, el.stakesHealth, el.stakesCores].forEach(box => box.classList.toggle('hidden', practice));
  }

  openBriefing() {
    this.isBriefingOpen = true;
    soundManager.playClick();
    if (this.hasStarted) {
      this.el.briefingStartLabel.textContent = 'RESUME (Enter)';
      this.el.briefingPracticeBtn.classList.add('hidden');
      this.el.briefingStartBtn.classList.replace('col-span-2', 'col-span-3');
    }
    if (this.el.modalBriefing) this.el.modalBriefing.classList.remove('hidden');
  }

  /** Resets the briefing to its first-launch state (mode choice visible). */
  resetBriefingButtons() {
    this.el.briefingStartLabel.textContent = 'START MISSION (Enter)';
    this.el.briefingPracticeBtn.classList.remove('hidden');
    this.el.briefingStartBtn.classList.replace('col-span-3', 'col-span-2');
  }

  closeBriefing() {
    this.isBriefingOpen = false;
    soundManager.playClick();
    if (this.el.modalBriefing) this.el.modalBriefing.classList.add('hidden');
  }

  // ==========================================
  // SECTOR & WAVE LIFECYCLE
  // ==========================================
  currentSector() {
    return CURRICULUM_SECTORS[this.sectorIndex];
  }

  sectorProblems() {
    return this.run[this.sectorIndex];
  }

  totalWaves() {
    return this.run.reduce((n, list) => n + list.length, 0);
  }

  /**
   * After a first miss on a wave, schedule a follow-up problem aimed at that
   * misconception. It goes right after the current wave and replaces one later
   * regular problem (never the sector finale), so run length stays about the same.
   */
  scheduleFollowUp(diagnosis) {
    if (this.waveMisses !== 1 || this.followUpsThisSector >= 2) return;
    const current = this.problem;
    if (current.isFollowUp) return;
    const avoid = current.mode === 'compare' ? {} : { base: current.base ?? this.base, exponent: current.exponent ?? this.exponent };
    const followUp = makeFollowUp(diagnosis.type, this.rng, avoid);
    if (!followUp) return;

    const list = this.sectorProblems();
    const insertAt = this.waveIndex + 1;
    const removable = list.findIndex((p, i) => i > this.waveIndex && i < list.length - 1 && !p.isFollowUp);
    if (removable !== -1) list.splice(removable, 1);
    list.splice(insertAt, 0, followUp);
    this.followUpsThisSector++;
  }

  startWave({ silent = false } = {}) {
    const { el } = this;
    const sector = this.currentSector();
    const problems = this.sectorProblems();
    const problem = problems[this.waveIndex];
    this.problem = problem;

    el.sectorBadge.textContent = sector.badge;
    el.sectorTitle.textContent = sector.name;
    el.sectorTitle.title = sector.tagline;
    el.waveCounter.textContent = `${this.waveIndex + 1} / ${problems.length}`;

    el.hintText.textContent = problem.hint;
    el.hintStrip.classList.add('hidden');
    this.hintUsedThisWave = false;
    this.waveMisses = 0;

    this.setupModeUI(problem);
    this.resetEquationResult();
    this.updateBossHP();

    if (sector.isBossSector) {
      el.threatBadge.className = 'text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-950 border border-rose-600 text-rose-300 animate-pulse';
      el.threatBadge.textContent = 'SINGULARITY BOSS CORE';
      el.coreStatusText.textContent = 'WARNING: HIGH VOLTAGE SINGULARITY SURGE';
      el.coreStatusText.className = 'text-xs uppercase font-mono-math font-black tracking-widest text-rose-400';
    } else {
      el.threatBadge.className = 'text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-300';
      el.threatBadge.textContent = 'ACTIVE SURGE';
      el.coreStatusText.textContent = 'REACTOR MODULATOR READY';
      el.coreStatusText.className = 'text-xs uppercase font-mono-math font-black tracking-widest text-cyan-400';
    }
    if (problem.isFollowUp) {
      el.threatBadge.className = 'text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-950 border border-amber-500 text-amber-300';
      el.threatBadge.textContent = `🎯 Follow-up: ${problem.followUpSkill}`;
    }

    clearInterval(this.waveTimerInterval);
    this.waveTimeRemaining = sector.waveTimeLimit;
    this.updateTimerDisplay();
    if (silent || this.isPractice) return;

    this.waveTimerInterval = setInterval(() => {
      if (this.isPaused || this.isGameOver || this.isDischarging || this.isBriefingOpen) return;
      this.waveTimeRemaining--;
      this.updateTimerDisplay();
      if (this.waveTimeRemaining <= 5 && this.waveTimeRemaining > 0) soundManager.playAlarmTick();
      if (this.waveTimeRemaining <= 0) {
        clearInterval(this.waveTimerInterval);
        this.handleSurgeTimeout();
      }
    }, 1000);
  }

  /** Shows the right console panel and renders the equation card for the problem's mode. */
  setupModeUI(problem) {
    const { el } = this;
    const ui = MODE_UI[problem.mode];

    el.equationLabel.textContent = ui.label;
    el.consoleModeLabel.textContent = ui.console;
    el.consoleKeysLabel.textContent = ui.keys;
    el.dischargeLabel.textContent = ui.fire;
    el.dialPanel.classList.toggle('hidden', ui.panel !== 'dial');
    el.readoutPanel.classList.toggle('hidden', ui.panel !== 'readout');
    el.comparePanel.classList.toggle('hidden', ui.panel !== 'compare');
    el.cardsPanel.classList.toggle('hidden', ui.panel !== 'cards');
    el.dischargeBtn.classList.toggle('hidden', ui.panel === 'compare' || ui.panel === 'cards');
    el.traineeLog.classList.add('hidden');

    this.applyBaseLock(problem.mode === 'find' ? problem : null);

    if (ui.panel === 'readout') {
      this.readout = '';
      this.base = problem.base;
      this.exponent = problem.exponent;
      this.updateReadoutDisplay();
      el.eqLeft.innerHTML = powerHTML(problem.base, problem.exponent);
      el.eqRight.innerHTML = `<span id="eq-readout" class="text-4xl font-black text-emerald-300">?</span><span class="text-xs font-extrabold text-cyan-400 uppercase ml-1">MW</span>`;
      if (problem.mode === 'fix') {
        el.traineeLog.textContent = `⚠ Trainee's log says: ${powerText(problem.base, problem.exponent)} = ${problem.wrongValue.toLocaleString()} MW ✗`;
        el.traineeLog.classList.remove('hidden');
      }
    } else if (problem.mode === 'cards') {
      el.eqLeft.innerHTML = `<span class="text-4xl font-black text-white tracking-tight">${problem.targetMW.toLocaleString()}</span><span class="text-xs font-extrabold text-cyan-400 uppercase">MW</span>`;
      el.eqRight.innerHTML = '<span id="eq-card" class="text-4xl font-black text-rose-300">?</span>';
      problem.cards.forEach((c, i) => { this.$(`card-label-${i}`).textContent = powerText(c.base, c.exponent); });
      this.base = 2;
      this.exponent = 6;
    } else if (problem.mode === 'compare') {
      el.eqLeft.innerHTML = `<span class="text-[10px] font-sans font-black text-gray-500 mr-1">A</span>${powerHTML(problem.left.base, problem.left.exponent)}`;
      el.eqRight.innerHTML = `<span class="text-[10px] font-sans font-black text-gray-500 mr-1">B</span>${powerHTML(problem.right.base, problem.right.exponent, 'text-amber-300', 'text-cyan-300')}`;
      el.compareLeftLabel.textContent = powerText(problem.left.base, problem.left.exponent);
      el.compareRightLabel.textContent = powerText(problem.right.base, problem.right.exponent);
      this.base = Math.max(problem.left.base, problem.right.base);
      this.exponent = Math.max(problem.left.exponent, problem.right.exponent);
    } else {
      // Dial modes: find / expanded. Start from a neutral setting that is never the answer,
      // so the previous wave's answer doesn't linger on the dials.
      if (!this.isBaseLocked) this.base = 2;
      this.exponent = 2;
      const answer = problem.mode === 'find' ? problem.targetMW : calculatePower(problem.base, problem.exponent);
      if (calculatePower(this.base, this.exponent) === answer) this.exponent = this.isBaseLocked ? 1 : 3;
      if (problem.mode === 'find') {
        el.eqLeft.innerHTML = `<span class="text-4xl font-black text-white tracking-tight">${problem.targetMW.toLocaleString()}</span><span class="text-xs font-extrabold text-cyan-400 uppercase">MW</span>`;
      } else {
        const text = expandedText(problem.base, problem.exponent);
        const size = problem.exponent >= 5 ? 'text-lg' : problem.exponent >= 4 ? 'text-xl' : 'text-2xl';
        el.eqLeft.innerHTML = `<span class="${size} font-black text-white tracking-tight">${text}</span>`;
      }
      el.eqRight.innerHTML = powerHTML(this.base, this.exponent, 'text-cyan-300', 'text-amber-400', 'text-4xl', { base: 'deployed-base', exp: 'deployed-exp' });
      this.setBase(this.base, true);
      this.setExponent(this.exponent, true);
    }
    this.updateRibbon();
  }

  /** Big non-power-of-10 targets come with a given base (set by the generator) to keep the load reasonable. */
  applyBaseLock(findProblem) {
    const { el } = this;
    const locked = !!findProblem && findProblem.givenBase !== undefined;
    this.isBaseLocked = locked;
    if (locked) this.base = findProblem.givenBase;
    el.baseLockedBadge.classList.toggle('hidden', !locked);
    el.baseSubtext.textContent = locked ? 'GIVEN BASE' : 'Repeated Factor';
    el.baseSubtext.className = locked ? 'text-[10px] text-cyan-400 font-black tracking-wider' : 'text-[10px] text-gray-400 font-medium';
    [el.baseDecBtn, el.baseIncBtn, ...this.basePresetBtns].forEach(btn => {
      btn.disabled = locked;
      btn.classList.toggle('opacity-30', locked);
      btn.classList.toggle('cursor-not-allowed', locked);
      btn.classList.toggle('pointer-events-none', locked);
    });
  }

  resetEquationResult() {
    const { el } = this;
    el.dischargeResultContainer.classList.add('hidden');
    el.dischargeResultContainer.classList.remove('flex');
    el.equationOperator.textContent = this.problem && this.problem.mode === 'compare' ? '?' : '=';
    el.equationOperator.className = 'text-3xl font-black text-gray-400';
    el.equationDisplayCard.className = CARD_CLASS.idle;
  }

  updateTimerDisplay() {
    const { el } = this;
    const sector = this.currentSector();
    el.timerDisplay.textContent = `${this.waveTimeRemaining}s`;
    const pct = Math.max(0, (this.waveTimeRemaining / sector.waveTimeLimit) * 100);
    el.timerBar.style.width = `${pct}%`;
    if (this.waveTimeRemaining > 7) {
      el.timerBar.className = 'h-full bg-amber-400 rounded-full transition-all duration-300';
      el.timerDisplay.className = 'text-sm font-mono-math font-black text-amber-300';
    } else {
      el.timerBar.className = 'h-full bg-rose-500 rounded-full transition-all duration-300';
      el.timerDisplay.className = 'text-sm font-mono-math font-black text-rose-400 animate-urgent';
    }
  }

  handleSurgeTimeout() {
    clearInterval(this.waveTimerInterval);
    soundManager.playStallBuzzer(false);
    this.shake();
    this.setCombo(1);
    this.waveMisses++;
    this.sectorMisses++;
    this.recordMistake('timeout');

    if (this.lives > 0) {
      this.lives--;
      this.updateLivesDisplay();
      document.body.classList.add('glow-amber');
      setTimeout(() => document.body.classList.remove('glow-amber'), 600);
      const coresLeftStr = this.lives === 1 ? '1 backup core left' : `${this.lives} backup cores left`;
      this.showInlineDiagnostic(false, 'TIME UP! BACKUP CORE USED', 'The surge timer ran out. A backup core restarted this wave.', `Timer reset (${coresLeftStr})`);
      this.isDischarging = true;
      setTimeout(() => {
        this.coreHealth = 100;
        this.updateHealthBar();
        this.finishDischarge();
        this.startWave();
      }, 1800);
      return;
    }

    this.coreHealth = 0;
    this.updateHealthBar();
    this.isDischarging = true; // lock input until the debrief appears
    soundManager.playMeltdown();
    this.showInlineDiagnostic(false, 'TIME UP! NO BACKUP CORES LEFT', 'The surge breached the core and all backup cores are used.', 'Core meltdown');
    setTimeout(() => this.endGame(false), 1500);
  }

  // ==========================================
  // INPUTS: DIALS, KEYPAD, RIBBON
  // ==========================================
  setBase(val, force = false) {
    if (!force && (this.isBaseLocked || this.inputLocked)) return;
    if (!force) this.hideErrorDiagnostic();
    this.base = val;
    const { el } = this;
    el.baseNumberDisplay.textContent = val;
    const dep = this.$('deployed-base');
    if (dep) dep.textContent = val;
    el.formulaBase.textContent = val;
    this.basePresetBtns.forEach(btn => {
      const bVal = parseInt(btn.dataset.val, 10);
      btn.className = bVal === val
        ? 'base-preset-btn py-1 bg-cyan-950 border border-cyan-500/50 rounded font-mono-math font-bold text-xs text-cyan-300 font-black'
        : 'base-preset-btn py-1 bg-gray-950 hover:bg-cyan-950 border border-gray-800 rounded font-mono-math font-bold text-xs text-gray-300';
      if (this.isBaseLocked) btn.classList.add('opacity-30', 'cursor-not-allowed', 'pointer-events-none');
    });
    if (!force) {
      this.updateRibbon();
      this.resetEquationResult();
    }
  }

  setExponent(val, force = false) {
    if (!force && this.inputLocked) return;
    if (!force) this.hideErrorDiagnostic();
    this.exponent = val;
    const { el } = this;
    el.expNumberDisplay.textContent = val;
    const dep = this.$('deployed-exp');
    if (dep) dep.textContent = val;
    el.formulaExp.textContent = val;
    this.expPresetBtns.forEach(btn => {
      const eVal = parseInt(btn.dataset.val, 10);
      btn.className = eVal === val
        ? 'exp-preset-btn py-1 bg-amber-950 border border-amber-500/50 rounded font-mono-math font-bold text-xs text-amber-300 font-black'
        : 'exp-preset-btn py-1 bg-gray-950 hover:bg-amber-950 border border-gray-800 rounded font-mono-math font-bold text-xs text-gray-300';
    });
    if (!force) {
      this.updateRibbon();
      this.resetEquationResult();
    }
  }

  pressKey(key) {
    if (this.inputLocked) return;
    this.hideErrorDiagnostic();
    if (key === 'clear') this.readout = '';
    else if (key === 'back') this.readout = this.readout.slice(0, -1);
    else if (/^[0-9]$/.test(key) && this.readout.length < MAX_READOUT_DIGITS) {
      this.readout = this.readout === '0' ? key : this.readout + key;
    }
    this.updateReadoutDisplay();
    this.resetEquationResult();
  }

  updateReadoutDisplay() {
    const shown = this.readout === '' ? '_' : Number(this.readout).toLocaleString();
    this.el.readoutDisplay.textContent = shown;
    const eq = this.$('eq-readout');
    if (eq) eq.textContent = this.readout === '' ? '?' : Number(this.readout).toLocaleString();
  }

  /** Which power the ribbon expands (and the beam animates) for the current mode. */
  ribbonPower() {
    const p = this.problem;
    if (!p) return { base: this.base, exponent: this.exponent };
    if (p.mode === 'evaluate' || p.mode === 'fix') return { base: p.base, exponent: p.exponent };
    return { base: this.base, exponent: this.exponent };
  }

  updateRibbon({ reveal = false } = {}) {
    const { el } = this;
    const p = this.problem;
    el.ribbonNodesContainer.innerHTML = '';

    if (p && p.mode === 'compare') {
      el.ribbonSummary.textContent = `A: ${expandedText(p.left.base, p.left.exponent)}   |   B: ${expandedText(p.right.base, p.right.exponent)}`;
      el.corePowerCurveText.textContent = 'Work out both powers, then route the beam to the stronger line.';
      return;
    }
    if (p && p.mode === 'cards') {
      el.ribbonSummary.textContent = p.cards.map((c, i) => `[${i + 1}] ${powerText(c.base, c.exponent)}`).join('   ');
      el.corePowerCurveText.textContent = 'Watch out: base × exponent is NOT the value of a power.';
      return;
    }
    if (p && p.mode === 'expanded' && !reveal) {
      el.ribbonSummary.textContent = 'Hidden until you fire: count the factors in the signature!';
      el.corePowerCurveText.textContent = 'The repeated number is the base. How many times it repeats is the exponent.';
      return;
    }

    const { base, exponent } = this.ribbonPower();
    if (exponent === 0) {
      const pill = document.createElement('div');
      pill.className = 'px-3 py-1 bg-emerald-950/70 border border-emerald-500/60 rounded-xl text-emerald-300 font-mono-math text-xs font-bold flex items-center space-x-1.5';
      pill.innerHTML = `<span>⚡</span><span>Zero factors: base ${base} to the power 0</span>`;
      el.ribbonNodesContainer.appendChild(pill);
      el.ribbonSummary.textContent = `${base}⁰`;
      el.corePowerCurveText.textContent = 'Zero exponent rule: any non-zero base to the power 0.';
      return;
    }

    el.ribbonSummary.textContent = `${powerText(base, exponent)} = ${expandedText(base, exponent)}`;
    el.corePowerCurveText.textContent = `${base} used as a factor ${exponent} time${exponent === 1 ? '' : 's'}.`;

    prepareSteps(base, exponent).forEach((step, idx, steps) => {
      const cell = document.createElement('div');
      cell.id = `ribbon-node-${idx}`;
      cell.className = 'flex items-center space-x-1.5 bg-gray-900 border border-cyan-900/60 px-3 py-1 rounded-xl font-mono-math text-xs transition-all';
      cell.innerHTML = `
        <span class="text-[9px] text-gray-500 font-bold">#${idx + 1}</span>
        <span class="font-black text-cyan-300 text-sm">${step.factor}</span>
        <span class="ribbon-partial hidden text-[10px] font-black text-emerald-300">→ ${step.currentValue.toLocaleString()}</span>
      `;
      el.ribbonNodesContainer.appendChild(cell);
      if (idx < steps.length - 1) {
        const mul = document.createElement('span');
        mul.className = 'text-gray-600 font-black text-xs';
        mul.textContent = '×';
        el.ribbonNodesContainer.appendChild(mul);
      }
    });
  }

  // ==========================================
  // DISCHARGE & DIAGNOSIS
  // ==========================================
  diagnoseCurrent(choice) {
    const p = this.problem;
    switch (p.mode) {
      case 'find':
        return { ...diagnoseSubmission(this.base, this.exponent, p.targetMW), value: calculatePower(this.base, this.exponent) };
      case 'expanded':
        return { ...diagnoseExpanded(p, this.base, this.exponent), value: calculatePower(this.base, this.exponent) };
      case 'evaluate':
      case 'fix':
        return { ...diagnoseValue(p.base, p.exponent, this.readout === '' ? NaN : Number(this.readout)), value: Number(this.readout) };
      case 'compare':
        return diagnoseCompare(p, choice);
      case 'cards': {
        const card = p.cards[choice];
        return { ...diagnoseCards(p, choice), value: card ? calculatePower(card.base, card.exponent) : NaN, card };
      }
      default:
        return { correct: false, isTrap: false, type: 'unknown', explanation: '', correctFormula: '' };
    }
  }

  async handleDischarge(choice) {
    if (this.inputLocked) return;
    const p = this.problem;
    const isReadout = p.mode === 'evaluate' || p.mode === 'fix';

    if (isReadout && this.readout === '') {
      this.showInlineDiagnostic(false, 'NO READOUT', 'Type the value of the power on the keypad, then lock it in.', '', { penalty: false });
      return;
    }

    this.isDischarging = true;
    this.el.dischargeBtn.disabled = true;
    this.el.dischargeBtn.classList.add('opacity-50');
    this.compareBtns.forEach(b => { b.disabled = true; });
    this.cardBtns.forEach(b => { b.disabled = true; });

    const diagnosis = this.diagnoseCurrent(choice);

    // Beam + step tones. Running products are revealed for the student's own dial setting,
    // and for readout modes only when the answer is right (so a miss doesn't leak the answer).
    soundManager.playDischargeLaser();
    this.beamFiringProgress = 1.0;
    const { base, exponent } = this.ribbonPower();
    const steps = p.mode === 'compare' || p.mode === 'cards' ? [] : prepareSteps(base, exponent);
    const revealPartials = !isReadout || diagnosis.correct;
    if (p.mode === 'expanded') this.updateRibbon({ reveal: true });
    for (let i = 0; i < steps.length; i++) {
      soundManager.playStepTone(i, steps.length, base);
      const node = this.$(`ribbon-node-${i}`);
      if (node) {
        node.classList.add('border-cyan-400', 'bg-cyan-950', 'scale-105');
        if (revealPartials) {
          const partial = node.querySelector('.ribbon-partial');
          if (partial) partial.classList.remove('hidden');
        }
      }
      await new Promise(r => setTimeout(r, exponent > 4 ? 110 : 160));
      if (node) node.classList.remove('scale-105');
    }

    this.revealResult(diagnosis);

    if (diagnosis.correct) {
      this.handleMatchSuccess(problemTargetValue(p) ?? 0);
    } else {
      this.waveMisses++;
      this.sectorMisses++;
      this.recordMistake(diagnosis.type);
      this.scheduleFollowUp(diagnosis);
      soundManager.playStallBuzzer(diagnosis.isTrap);
      this.triggerCircuitBreach(
        diagnosis.isTrap ? 'EXPONENT TRAP!' : 'MISS',
        diagnosis.explanation,
        diagnosis.correctFormula
      );
    }
  }


  revealResult(diagnosis) {
    const { el } = this;
    const p = this.problem;
    el.dischargeResultContainer.classList.remove('hidden');
    el.dischargeResultContainer.classList.add('flex');
    el.equationDisplayCard.className = diagnosis.correct ? CARD_CLASS.match : CARD_CLASS.miss;
    el.equationOperator.className = `text-3xl font-black ${diagnosis.correct ? 'text-emerald-400' : 'text-rose-400'}`;

    const badge = (text, ok) => {
      el.dischargeVerdictBadge.textContent = text;
      el.dischargeVerdictBadge.className = ok
        ? 'ml-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-300'
        : 'ml-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-950 border border-rose-500 text-rose-300';
    };

    if (p.mode === 'cards') {
      const eqCard = this.$('eq-card');
      if (eqCard && diagnosis.card) eqCard.textContent = powerText(diagnosis.card.base, diagnosis.card.exponent);
      el.equationOperator.textContent = diagnosis.correct ? '=' : '≠';
      el.dischargeEvaluatedMw.textContent = diagnosis.correct ? p.targetMW.toLocaleString() : diagnosis.value > 9999999 ? 'HUGE' : diagnosis.value.toLocaleString();
      el.dischargeUnit.textContent = 'MW';
      badge(diagnosis.correct ? 'MATCH' : 'TRAP CARD', diagnosis.correct);
      return;
    }

    if (p.mode === 'compare') {
      const a = calculatePower(p.left.base, p.left.exponent);
      const b = calculatePower(p.right.base, p.right.exponent);
      el.equationOperator.textContent = a === b ? '=' : a > b ? '>' : '<';
      el.dischargeEvaluatedMw.textContent = `${a.toLocaleString()} vs ${b.toLocaleString()}`;
      el.dischargeUnit.textContent = 'MW';
      badge(diagnosis.correct ? 'ROUTED' : 'WRONG LINE', diagnosis.correct);
      return;
    }

    if (p.mode === 'evaluate' || p.mode === 'fix') {
      el.equationOperator.textContent = diagnosis.correct ? '=' : '≠';
      el.dischargeResultContainer.classList.add('hidden');
      el.dischargeResultContainer.classList.remove('flex');
      return;
    }

    // find / expanded: show what the student's dials evaluate to
    el.dischargeEvaluatedMw.textContent = diagnosis.value.toLocaleString();
    el.dischargeUnit.textContent = 'MW';
    el.equationOperator.textContent = diagnosis.correct ? '=' : '≠';
    if (p.mode === 'find') {
      badge(diagnosis.correct ? 'MATCH' : diagnosis.value > p.targetMW ? 'TOO HIGH' : 'TOO LOW', diagnosis.correct);
    } else {
      badge(diagnosis.correct ? 'MATCH' : 'MISMATCH', diagnosis.correct);
    }
  }

  /** Floating "+200" over the score badge. */
  popScore(points) {
    const anchor = this.el.scoreDisplay.parentElement;
    const pop = document.createElement('span');
    pop.className = 'score-pop';
    pop.textContent = `+${points}`;
    anchor.appendChild(pop);
    setTimeout(() => pop.remove(), 900);
  }

  recordMistake(type) {
    const label = MISTAKE_LABEL[type];
    if (label) this.mistakeCounts[label] = (this.mistakeCounts[label] || 0) + 1;
  }

  setCombo(value) {
    this.combo = value;
    const { el } = this;
    el.comboMultiplierDisplay.textContent = `x${this.combo}`;
    el.comboMultiplierDisplay.parentElement.className = this.combo > 1
      ? 'flex items-center space-x-1.5 bg-emerald-950/80 border border-emerald-500/80 px-2.5 py-1 rounded-xl glow-emerald'
      : 'flex items-center space-x-1.5 bg-indigo-950/70 border border-indigo-700/60 px-2.5 py-1 rounded-xl';
  }

  shake() {
    document.body.classList.add('shake-active');
    setTimeout(() => document.body.classList.remove('shake-active'), 450);
  }

  finishDischarge() {
    this.isDischarging = false;
    this.el.dischargeBtn.disabled = false;
    this.el.dischargeBtn.classList.remove('opacity-50');
    this.compareBtns.forEach(b => { b.disabled = false; });
    this.cardBtns.forEach(b => { b.disabled = false; });
  }

  handleMatchSuccess(targetMW) {
    soundManager.playSuccessChord();
    this.wavesCleared++;
    if (this.waveMisses === 0) this.firstTryCorrect++;
    const skill = SKILL_OF_MODE[this.problem.mode];
    const stat = this.skillStats[skill] || (this.skillStats[skill] = { waves: 0, firstTry: 0 });
    stat.waves++;
    if (this.waveMisses === 0) stat.firstTry++;

    this.setCombo(nextCombo(this.combo, this.hintUsedThisWave));
    this.maxCombo = Math.max(this.maxCombo, this.combo);

    const pointsEarned = (this.hintUsedThisWave ? 50 : 100) * this.combo;
    this.score += pointsEarned;
    this.totalWattsMitigated += targetMW;
    this.coreHealth = Math.min(100, this.coreHealth + 10);
    this.updateHealthBar();
    this.el.scoreDisplay.textContent = this.score.toLocaleString();
    this.popScore(pointsEarned);

    this.showInlineDiagnostic(
      true,
      'CORRECT! SURGE BLOCKED',
      this.waveMisses === 0 ? 'First try!' : 'You fixed it. Nice recovery!',
      `+${pointsEarned} pts (Combo x${this.combo})${this.hintUsedThisWave ? ' · hint used' : ''}`
    );
    document.body.classList.add('glow-emerald');
    setTimeout(() => document.body.classList.remove('glow-emerald'), 500);

    if (this.currentSector().isBossSector) {
      this.bossHitFlash = 1;
      this.updateBossHP(this.waveIndex + 1);
    }

    setTimeout(() => {
      this.waveIndex++;
      if (this.waveIndex >= this.sectorProblems().length) {
        this.completeSector();
        return;
      }
      this.finishDischarge();
      this.startWave();
    }, 900);
  }

  // ==========================================
  // SECTOR CLEARED / BOSS HP
  // ==========================================
  completeSector() {
    clearInterval(this.waveTimerInterval);
    const stars = sectorStars(this.sectorMisses, this.sectorHints);
    this.starsBySector[this.sectorIndex] = stars;
    const finished = this.currentSector();
    const misses = this.sectorMisses;
    const hints = this.sectorHints;

    this.waveIndex = 0;
    this.sectorIndex++;
    this.followUpsThisSector = 0;
    this.sectorMisses = 0;
    this.sectorHints = 0;

    if (this.sectorIndex >= CURRICULUM_SECTORS.length) {
      this.endGame(true);
      return;
    }

    const { el } = this;
    const next = this.currentSector();
    el.sectorClearTitle.textContent = finished.name;
    el.sectorClearStars.innerHTML = [1, 2, 3].map(i => `<span class="${i <= stars ? 'text-amber-300' : 'text-gray-700'}">★</span>`).join('');
    el.sectorClearStats.textContent = `${misses} miss${misses === 1 ? '' : 'es'} · ${hints} hint${hints === 1 ? '' : 's'}${stars < 3 ? ' · 3 stars = no misses, no hints' : ' · Perfect sector!'}`;
    el.sectorClearNext.textContent = next.name;
    el.sectorClearNextDesc.textContent = next.description;
    el.modalSectorClear.classList.remove('hidden');
    this.isSectorClearOpen = true;
    this.isPaused = true;
    soundManager.playVictoryFanfare();
  }

  continueAfterSectorClear() {
    if (!this.isSectorClearOpen) return;
    soundManager.playClick();
    this.isSectorClearOpen = false;
    this.isPaused = false;
    this.el.modalSectorClear.classList.add('hidden');
    this.finishDischarge();
    this.startWave();
  }

  /** Draws the boss health bar: one segment per boss wave; `cleared` segments are drained. */
  updateBossHP(cleared = this.waveIndex) {
    const { el } = this;
    const isBoss = !!this.currentSector().isBossSector;
    el.bossHpPanel.classList.toggle('hidden', !isBoss);
    if (!isBoss) return;
    const total = this.sectorProblems().length;
    el.bossHpSegments.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const seg = document.createElement('div');
      const alive = i >= cleared;
      seg.className = `w-9 h-2.5 rounded-sm transition-all duration-500 ${alive ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]' : 'bg-gray-800'}`;
      el.bossHpSegments.appendChild(seg);
    }
  }

  triggerCircuitBreach(title, explanation, formula) {
    this.setCombo(comboAfterMiss(this.combo));
    const damage = this.isPractice ? 0 : this.currentSector().isBossSector ? 25 : 20;
    this.coreHealth = Math.max(0, this.coreHealth - damage);
    this.updateHealthBar();
    this.shake();
    this.showInlineDiagnostic(false, title, explanation, formula);

    if (this.coreHealth <= 0) {
      clearInterval(this.waveTimerInterval);
      if (this.lives > 0) {
        this.lives--;
        this.updateLivesDisplay();
        soundManager.playStallBuzzer(true);
        document.body.classList.add('glow-amber');
        setTimeout(() => document.body.classList.remove('glow-amber'), 600);
        const coresLeftStr = this.lives === 1 ? '1 backup core left' : `${this.lives} backup cores left`;
        this.showInlineDiagnostic(false, `${title} · BACKUP CORE USED`, explanation, `${formula}  |  🔋 Health restored, retry this wave (${coresLeftStr})`);
        setTimeout(() => {
          this.coreHealth = 100;
          this.updateHealthBar();
          this.finishDischarge();
          this.startWave();
        }, 3500);
        return;
      }
      soundManager.playMeltdown();
      setTimeout(() => this.endGame(false), 3000);
      return;
    }

    setTimeout(() => this.finishDischarge(), 900);
  }

  showInlineDiagnostic(isSuccess, title, msg, formula, { penalty = true } = {}) {
    const { el } = this;
    clearTimeout(this.hudClearTimeout);
    el.inlineDiagnosticHud.classList.remove('hidden');
    if (isSuccess) {
      el.inlineDiagnosticHud.className = 'rounded-xl border border-emerald-500/60 bg-emerald-950/70 p-2.5 transition-all';
      el.diagnosticIcon.textContent = '✅';
      el.diagnosticTitle.className = 'text-xs font-black uppercase tracking-wider text-emerald-300';
      el.diagnosticMessage.className = 'text-xs leading-snug font-medium mt-0.5 text-emerald-200';
      el.diagnosticFormula.className = 'font-mono-math font-extrabold text-xs mt-1 text-emerald-300';
    } else {
      el.inlineDiagnosticHud.className = penalty
        ? 'rounded-xl border border-rose-500/70 bg-rose-950/80 p-2.5 transition-all glow-rose'
        : 'rounded-xl border border-amber-500/70 bg-amber-950/60 p-2.5 transition-all';
      el.diagnosticIcon.textContent = penalty ? '⚠️' : '⌨️';
      el.diagnosticTitle.className = `text-xs font-black uppercase tracking-wider ${penalty ? 'text-rose-300' : 'text-amber-300'}`;
      el.diagnosticMessage.className = 'text-xs leading-snug font-medium mt-0.5 text-rose-100';
      el.diagnosticFormula.className = 'font-mono-math font-extrabold text-xs mt-1 text-amber-300';
    }
    el.diagnosticTitle.textContent = title;
    el.diagnosticMessage.textContent = msg;
    el.diagnosticFormula.textContent = formula;
    el.diagnosticFormula.classList.toggle('hidden', !formula);

    // Success clears itself; errors stay until the student changes their answer.
    this.hudShowingError = !isSuccess;
    if (isSuccess) {
      this.hudClearTimeout = setTimeout(() => el.inlineDiagnosticHud.classList.add('hidden'), 1800);
    }
  }

  hideErrorDiagnostic() {
    if (this.hudShowingError && !this.isDischarging) {
      this.el.inlineDiagnosticHud.classList.add('hidden');
      this.hudShowingError = false;
    }
  }

  updateHealthBar() {
    const { el } = this;
    el.healthBar.style.width = `${this.coreHealth}%`;
    el.healthText.textContent = `${this.coreHealth}%`;
    if (this.coreHealth <= 25) {
      el.healthBar.className = 'h-full bg-rose-600 rounded-full transition-all duration-300 animate-pulse';
      el.healthText.className = 'text-xs font-mono-math font-bold text-rose-400';
    } else if (this.coreHealth <= 50) {
      el.healthBar.className = 'h-full bg-amber-500 rounded-full transition-all duration-300';
      el.healthText.className = 'text-xs font-mono-math font-bold text-amber-400';
    } else {
      el.healthBar.className = 'h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-300';
      el.healthText.className = 'text-xs font-mono-math font-bold text-cyan-300';
    }
  }

  // ==========================================
  // DEBRIEF
  // ==========================================
  endGame(isVictory) {
    const { el } = this;
    this.isGameOver = true;
    clearInterval(this.waveTimerInterval);

    const shiftSeconds = Math.round((Date.now() - this.shiftStartTime) / 1000);
    const mins = Math.floor(shiftSeconds / 60);
    const secs = shiftSeconds % 60;
    const timeStr = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
    const totalWaves = this.totalWaves();
    const firstTryPct = this.wavesCleared > 0 ? Math.round((this.firstTryCorrect / this.wavesCleared) * 100) : 0;

    if (isVictory && this.isPractice) {
      soundManager.playVictoryFanfare();
      el.debriefIcon.textContent = '🧪';
      el.debriefIcon.className = 'w-16 h-16 rounded-3xl bg-emerald-950 border-2 border-emerald-500/60 flex items-center justify-center text-3xl mb-3 glow-emerald';
      el.debriefTitle.textContent = 'PRACTICE RUN COMPLETE!';
      el.debriefSubtitle.textContent = "Nice work! Practice runs don't unlock the next area. Play Mission mode when you're ready.";
    } else if (isVictory) {
      soundManager.playVictoryFanfare();
      el.debriefIcon.textContent = '🏆';
      el.debriefIcon.className = 'w-16 h-16 rounded-3xl bg-cyan-950 border-2 border-cyan-500/60 flex items-center justify-center text-3xl mb-3 glow-cyan';
      el.debriefTitle.textContent = 'SECTOR GRID STABILIZED!';
      el.debriefSubtitle.textContent = 'All 5 sectors cleared. Singularity Boss Core subdued and grid secured!';
      try {
        // Mission mode only. Same payload shape as before: no new data is sent.
        window.parent.postMessage({
          type: 'CARTRIDGE_COMPLETE',
          payload: {
            lessonId: 'G06_U03_L01',
            // score = waves solved on the first try; total = waves in the run
            score: this.firstTryCorrect,
            total: totalWaves,
            bossDefeated: true,
          },
        }, '*');
      } catch (e) { /* not embedded */ }
    } else {
      el.debriefIcon.textContent = '⚠️';
      el.debriefIcon.className = 'w-16 h-16 rounded-3xl bg-rose-950 border-2 border-rose-500/60 flex items-center justify-center text-3xl mb-3 glow-rose';
      el.debriefTitle.textContent = 'REACTOR CORE MELTDOWN!';
      el.debriefSubtitle.textContent = 'Core integrity collapsed. Review the Field Guide and try again!';
    }

    const starTotal = this.starsBySector.reduce((a, b) => a + (b || 0), 0);
    el.debriefStars.textContent = isVictory ? `★ ${starTotal} / ${CURRICULUM_SECTORS.length * 3} sector stars` : '';
    el.debriefTime.textContent = timeStr;
    el.debriefWatts.textContent = `${this.totalWattsMitigated.toLocaleString()} MW`;
    el.debriefCombo.textContent = `x${this.maxCombo} Combo`;
    el.debriefAccuracy.textContent = `${firstTryPct}%`;
    el.debriefCores.textContent = this.isPractice ? '—' : `${this.lives} / ${this.maxLives}`;
    el.debriefHints.textContent = String(this.hintsUsed);
    this.renderSkillBreakdown();
    el.modalDebrief.classList.remove('hidden');
  }

  /** On-screen skill summary for the student/teacher. Not saved or sent anywhere. */
  renderSkillBreakdown() {
    const { el } = this;
    const skills = Object.entries(this.skillStats);
    el.debriefSkills.innerHTML = skills.length ? '' : '<div class="text-gray-500">No waves cleared yet.</div>';
    skills.forEach(([name, { waves, firstTry }]) => {
      const pct = Math.round((firstTry / waves) * 100);
      const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
      const row = document.createElement('div');
      row.innerHTML = `
        <div class="flex justify-between text-gray-300"><span>${name}</span><span class="font-mono-math font-black text-white">${firstTry}/${waves}</span></div>
        <div class="h-1.5 bg-gray-800 rounded-full overflow-hidden mt-0.5"><div class="h-full ${color}" style="width:${pct}%"></div></div>`;
      el.debriefSkills.appendChild(row);
    });
    const mistakes = Object.entries(this.mistakeCounts).sort((a, b) => b[1] - a[1]);
    el.debriefMistakes.innerHTML = mistakes.length
      ? mistakes.map(([label, n]) => `<div>• ${label} <span class="font-mono-math font-black text-rose-300">×${n}</span></div>`).join('')
      : '<div class="text-emerald-300">None. Clean run! 🎉</div>';
  }

  resetFullStationShift() {
    Object.assign(this, {
      sectorIndex: 0, waveIndex: 0, coreHealth: 100, lives: this.maxLives, score: 0, totalWattsMitigated: 0,
      maxCombo: 1, firstTryCorrect: 0, wavesCleared: 0, hintsUsed: 0,
      isGameOver: false, shiftStartTime: Date.now(), followUpsThisSector: 0,
      sectorMisses: 0, sectorHints: 0, starsBySector: [], skillStats: {}, mistakeCounts: {},
    });
    this.run = generateRun(this.rng); // fresh problems every replay
    this.updateLivesDisplay();
    this.setCombo(1);
    this.el.scoreDisplay.textContent = '0';
    this.updateHealthBar();
    this.finishDischarge();
    this.startWave({ silent: true });
    // Back to the briefing so the student can choose Mission or Practice again.
    this.hasStarted = false;
    this.isBriefingOpen = true;
    this.resetBriefingButtons();
    this.el.modalBriefing.classList.remove('hidden');
  }

  // ==========================================
  // CANVAS RENDERER
  // ==========================================
  animateCanvas() {
    requestAnimationFrame(() => this.animateCanvas());
    if (!this.ctx || !this.canvas) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    // Background gradient glow (orb centered at 38% height above the equation card)
    const cx = w * 0.5;
    const cy = h * 0.38;
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.5);
    grad.addColorStop(0, 'rgba(6, 182, 212, 0.12)');
    grad.addColorStop(0.5, 'rgba(6, 182, 212, 0.03)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Update & draw particles
    ctx.fillStyle = 'rgba(6, 182, 212, 0.6)';
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Core Plasma Rings
    this.coreRotation += 0.015;
    const baseRadius = 45 + Math.min(this.exponent * 6, 40);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.coreRotation);

    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Arc nodes
    for (let i = 0; i < Math.max(3, this.base); i++) {
      const angle = (i * Math.PI * 2) / Math.max(3, this.base);
      const nx = Math.cos(angle) * baseRadius;
      const ny = Math.sin(angle) * baseRadius;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Boss singularity ring (Sector 5): pulses rose, flashes white when hit
    if (this.sectorIndex < CURRICULUM_SECTORS.length && this.currentSector().isBossSector) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 250);
      ctx.save();
      ctx.strokeStyle = this.bossHitFlash > 0 ? `rgba(255,255,255,${this.bossHitFlash})` : `rgba(244, 63, 94, ${0.35 + pulse * 0.4})`;
      ctx.lineWidth = 3 + (this.bossHitFlash * 6);
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius + 22 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (this.bossHitFlash > 0) this.bossHitFlash = Math.max(0, this.bossHitFlash - 0.03);
    }

    // Inner Core Orb
    const orbGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22);
    orbGrad.addColorStop(0, '#ffffff');
    orbGrad.addColorStop(0.4, '#38bdf8');
    orbGrad.addColorStop(1, 'rgba(14, 165, 233, 0.1)');
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();

    // Laser Beam Surge Animation (when discharging)
    if (this.beamFiringProgress > 0) {
      const beamAlpha = this.beamFiringProgress;
      const beamWidth = 6 + this.exponent * 4;

      ctx.save();
      ctx.strokeStyle = `rgba(56, 189, 248, ${beamAlpha})`;
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 20;
      ctx.lineWidth = beamWidth;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(w - 20, cy);
      ctx.stroke();

      // Core bright center streak
      ctx.strokeStyle = `rgba(255, 255, 255, ${beamAlpha})`;
      ctx.lineWidth = Math.max(2, beamWidth * 0.35);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(w - 20, cy);
      ctx.stroke();
      ctx.restore();

      this.beamFiringProgress -= 0.05;
      if (this.beamFiringProgress < 0) this.beamFiringProgress = 0;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new ExponentReactorGame();
  // ?debug exposes the game object for automated play-testing only.
  if (new URLSearchParams(location.search).has('debug')) window.__reactor = game;
});
