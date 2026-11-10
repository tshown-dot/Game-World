/**
 * Vault Breaker: The GCF Heist - Game Engine
 *
 * Run = 4 bank floors + the Vault Golem boss. Each floor is a randomized set of jobs:
 *   crack  - type the GCF of two numbers          (vault dials)
 *   crack3 - GCF of three numbers (boss only)     (vault dials)
 *   split  - most identical loot bags             (live bag preview)
 *   tile   - largest square floor tile            (live tile preview)
 *   factor - a + b = GCF(m + n)                   (three slots)
 *   scan   - pick the real GCF key out of traps   (4 choices)
 *
 * Stakes: per-job timer, heat meter (misses), 3 smoke bombs, combo x1-x5.
 * Practice mode: no timer, no heat, nothing reported to the hub.
 */

import {
  parseMathInput,
  getAllFactorsSorted,
  getGCF,
  diagnoseGCFAnswer,
  evaluateSplit,
  evaluateTile,
  evaluateFactorOut,
} from './factorLogic.js';
import { CURRICULUM_SECTORS, MODE_INFO, SMOKE_BOMBS, MAX_FOLLOWUPS_PER_SECTOR } from './curriculum.js';
import { buildRun, makeProblem, makeFollowUp, createRng } from './generator.js';
import { soundEngine } from './audio.js';

const MAX_COMBO = 5;
const TIMEOUT_HEAT = 35;
const BOSS_TAUNTS = [
  '"No one cracks my vault."',
  '"Lucky guess, thief."',
  '"My armor is GREATEST. Like my factors."',
  '"You will never find my weak point!"',
  '"Stop... dividing... me!"',
  '"Impossible! My plates!"',
  '"One more and I... crumble..."',
  '"NOOOO!"',
];

class HeistGame {
  constructor() {
    this.el = {};
    this.rng = createRng(Date.now());
    this.isPractice = false;
    this.started = false;
    this.modal = 'briefing'; // briefing | play | guide | sectorClear | debrief
    this.locked = false;
    this.particles = [];
  }

  // ------------------------------------------------------------------
  // Setup
  // ------------------------------------------------------------------
  init() {
    const ids = [
      'game-root', 'fx-canvas', 'heat-vignette', 'stamp',
      'sector-badge', 'sector-title', 'wave-pips', 'practice-badge',
      'stakes-timer', 'timer-display', 'timer-bar', 'stakes-heat', 'heat-bar', 'heat-display',
      'stakes-bombs', 'bombs-display', 'combo-box', 'combo-flame', 'combo-display', 'score-display',
      'audio-toggle-btn', 'audio-icon', 'briefing-btn', 'field-guide-btn',
      'mode-icon', 'mode-label', 'followup-tag', 'hint-btn', 'boss-panel', 'golem', 'boss-hp-text',
      'boss-hp-plates', 'boss-taunt', 'prompt-text', 'hint-strip', 'hint-text', 'stage-visual',
      'console-label', 'console-keys', 'number-panel', 'answer-display', 'factor-panel', 'factor-sum',
      'keypad', 'scan-panel', 'feedback', 'feedback-icon', 'feedback-title', 'feedback-text', 'fire-btn',
      'modal-briefing', 'briefing-close-btn', 'briefing-start-btn', 'briefing-start-label', 'briefing-practice-btn',
      'modal-sector-clear', 'sector-clear-title', 'sector-clear-stars', 'sector-clear-stats',
      'sector-clear-next', 'sector-clear-next-desc', 'sector-clear-continue-btn',
      'smoke-overlay', 'smoke-text',
      'modal-debrief', 'debrief-icon', 'debrief-title', 'debrief-subtitle', 'debrief-stars', 'debrief-score',
      'debrief-accuracy', 'debrief-combo', 'debrief-time', 'debrief-skills', 'debrief-mistakes',
      'debrief-retry-btn', 'debrief-restart-btn',
      'modal-field-guide', 'close-field-guide-btn',
    ];
    for (const id of ids) {
      this.el[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(id);
    }
    this.factorSlotEls = [...document.querySelectorAll('.factor-slot')];

    this.buildKeypad();
    this.bindEvents();
    this.initCanvas();
    this.resetRunState();
    this.loadSector(0);
    this.pauseForModal();
  }

  resetRunState() {
    this.run = buildRun(Date.now());
    this.sectorIndex = 0;
    this.score = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.heat = 0;
    this.bombs = SMOKE_BOMBS;
    this.firstTryCorrect = 0;
    this.completedProblems = 0;
    this.skills = {};
    this.mistakes = [];
    this.starsBySector = [];
    this.runStartedAt = Date.now();
  }

  buildKeypad() {
    const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '⌫', '0', 'C'];
    this.el.keypad.innerHTML = '';
    for (const k of keys) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'key-btn h-12 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 font-mono-math font-black text-xl text-slate-100 cursor-pointer';
      if (k === '⌫' || k === 'C') b.className += ' text-amber-300 text-base';
      b.textContent = k === 'C' ? 'Clear' : k;
      b.addEventListener('click', () => {
        if (k === '⌫') this.backspace();
        else if (k === 'C') this.clearInput();
        else this.typeDigit(k);
      });
      this.el.keypad.appendChild(b);
    }
  }

  bindEvents() {
    const el = this.el;
    el.briefingStartBtn.addEventListener('click', () => this.startFromBriefing(false));
    el.briefingPracticeBtn.addEventListener('click', () => this.startFromBriefing(true));
    el.briefingCloseBtn.addEventListener('click', () => this.closeBriefing());
    el.briefingBtn.addEventListener('click', () => this.openModal('briefing'));
    el.fieldGuideBtn.addEventListener('click', () => this.openModal('guide'));
    el.closeFieldGuideBtn.addEventListener('click', () => this.closeModal());
    el.audioToggleBtn.addEventListener('click', () => {
      const muted = soundEngine.toggleMuted();
      el.audioIcon.textContent = muted ? '🔇' : '🔊';
    });
    el.hintBtn.addEventListener('click', () => this.showHint());
    el.fireBtn.addEventListener('click', () => this.submit());
    el.sectorClearContinueBtn.addEventListener('click', () => this.continueAfterSector());
    el.debriefRetryBtn.addEventListener('click', () => this.retryFloor());
    el.debriefRestartBtn.addEventListener('click', () => this.newHeist());
    this.factorSlotEls.forEach((s, i) => s.addEventListener('click', () => this.setFactorSlot(i)));

    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'HUB_INIT' && typeof e.data.payload?.isMuted === 'boolean') {
        soundEngine.setMuted(e.data.payload.isMuted);
        el.audioIcon.textContent = e.data.payload.isMuted ? '🔇' : '🔊';
      }
    });
  }

  onKey(e) {
    const k = e.key;
    if (this.modal === 'briefing') {
      if (k === 'Enter') { e.preventDefault(); this.startFromBriefing(false); }
      else if (k.toLowerCase() === 'p') this.startFromBriefing(true);
      else if (k === 'Escape' && this.started) this.closeBriefing();
      return;
    }
    if (this.modal === 'guide') {
      if (k === 'Escape' || k === 'Enter') { e.preventDefault(); this.closeModal(); }
      return;
    }
    if (this.modal === 'sectorClear') {
      if (k === 'Enter' || k === ' ') { e.preventDefault(); this.continueAfterSector(); }
      return;
    }
    if (this.modal === 'debrief') {
      if (k === 'Enter') {
        e.preventDefault();
        if (this.el.debriefRetryBtn.classList.contains('hidden')) this.newHeist();
        else this.retryFloor();
      }
      return;
    }
    if (this.locked || !this.problem) return;

    const mode = this.problem.mode;
    if (k === ' ' && mode !== 'factor') { e.preventDefault(); return; } // don't re-click a focused button
    if (k.toLowerCase() === 'h') { this.showHint(); return; }
    if (mode === 'scan') {
      if (k >= '1' && k <= '4') this.pickScan(Number(k) - 1);
      return;
    }
    if (k >= '0' && k <= '9') this.typeDigit(k);
    else if (k === 'Backspace') this.backspace();
    else if (k === 'Escape' || k === 'Delete') this.clearInput();
    else if (k === 'Enter') { e.preventDefault(); this.submit(); }
    else if (mode === 'factor' && (k === 'Tab' || k === 'ArrowRight' || k === ' ' || k === '+' || k === '(')) {
      e.preventDefault();
      this.setFactorSlot(e.shiftKey && k === 'Tab' ? (this.activeSlot + 2) % 3 : (this.activeSlot + 1) % 3);
    } else if (mode === 'factor' && k === 'ArrowLeft') {
      this.setFactorSlot((this.activeSlot + 2) % 3);
    }
  }

  // ------------------------------------------------------------------
  // Modals & flow
  // ------------------------------------------------------------------
  startFromBriefing(practice) {
    soundEngine.playTumblerLock();
    const changingMode = !this.started || practice !== this.isPractice;
    this.setPracticeMode(practice);
    if (changingMode && this.started) {
      // Switching between practice and mission restarts cleanly.
      this.resetRunState();
      this.loadSector(0);
    }
    this.started = true;
    this.closeModal();
  }

  closeBriefing() {
    if (!this.started) return;
    this.closeModal();
  }

  setPracticeMode(practice) {
    this.isPractice = practice;
    const el = this.el;
    el.practiceBadge.classList.toggle('hidden', !practice);
    el.practiceBadge.classList.toggle('flex', practice);
    [el.stakesTimer, el.stakesHeat, el.stakesBombs].forEach((b) => b.classList.toggle('hidden', practice));
    el.briefingStartLabel.textContent = this.started && !practice ? '🔓 Resume the Heist (Enter)' : '🔓 Start the Heist (Enter)';
  }

  openModal(name) {
    soundEngine.playClick();
    this.modal = name;
    if (name === 'briefing') {
      this.el.briefingStartLabel.textContent = this.started && !this.isPractice ? '🔓 Resume the Heist (Enter)' : '🔓 Start the Heist (Enter)';
      this.el.modalBriefing.classList.remove('hidden');
    }
    if (name === 'guide') this.el.modalFieldGuide.classList.remove('hidden');
    this.pauseForModal();
  }

  closeModal() {
    this.el.modalBriefing.classList.add('hidden');
    this.el.modalFieldGuide.classList.add('hidden');
    this.modal = 'play';
    this.resumeTimer();
  }

  pauseForModal() {
    clearInterval(this.timerHandle);
    this.timerHandle = null;
  }

  // ------------------------------------------------------------------
  // Sectors & problems
  // ------------------------------------------------------------------
  get sector() {
    return CURRICULUM_SECTORS[this.sectorIndex];
  }

  loadSector(index) {
    this.sectorIndex = index;
    this.queue = [...this.run[index]];
    this.waveIndex = 0;
    this.sectorStats = { misses: 0, hints: 0, followups: 0 };
    this.heat = 0;
    const s = this.sector;
    this.el.sectorBadge.textContent = s.badge;
    this.el.sectorTitle.textContent = s.name;

    this.el.bossPanel.classList.toggle('hidden', !s.isBossSector);
    if (s.isBossSector) {
      this.bossHp = s.bossHp;
      this.renderBoss();
    }
    this.updateHud();
    this.loadProblem();
  }

  loadProblem() {
    this.problem = this.queue[this.waveIndex];
    this.problem.missed = this.problem.missed || false;
    this.hintUsed = false;
    this.locked = false;
    this.input = '';
    this.factorSlots = ['', '', ''];
    this.activeSlot = 0;
    this.timeRemaining = this.sector.timeLimit;

    const p = this.problem;
    const info = MODE_INFO[p.mode];
    this.el.modeIcon.textContent = info.icon;
    this.el.modeLabel.textContent = info.label;
    this.el.followupTag.classList.toggle('hidden', !p.isFollowUp);
    this.el.promptText.textContent = p.prompt;
    this.el.hintStrip.classList.add('hidden');
    this.el.fireBtn.disabled = false;

    // Console layout per mode
    const isScan = p.mode === 'scan';
    const isFactor = p.mode === 'factor';
    this.el.numberPanel.classList.toggle('hidden', isScan || isFactor);
    this.el.factorPanel.classList.toggle('hidden', !isFactor);
    this.el.factorPanel.classList.toggle('flex', isFactor);
    this.el.keypad.classList.toggle('hidden', isScan);
    this.el.scanPanel.classList.toggle('hidden', !isScan);
    this.el.fireBtn.classList.toggle('hidden', isScan);

    const consoleCopy = {
      crack: ['Dial in the GCF', 'Type digits · Enter = Crack'],
      crack3: ['Dial in the GCF', 'Type digits · Enter = Crack'],
      split: ['Number of bags', 'Type to preview · Enter = Pack'],
      tile: ['Tile side (ft)', 'Type to preview · Enter = Lay tiles'],
      factor: ['Fill all 3 boxes', 'Tab / → = next box · Enter = Crack'],
      scan: ['Pick a key', 'Press 1–4 or click'],
    }[p.mode];
    this.el.consoleLabel.textContent = consoleCopy[0];
    this.el.consoleKeys.textContent = consoleCopy[1];
    this.el.fireBtn.textContent = { split: '👜 Pack the Bags (Enter)', tile: '🟨 Lay the Tiles (Enter)' }[p.mode] || '🔓 Crack It (Enter)';

    if (isFactor) {
      this.el.factorSum.textContent = `${p.nums[0]} + ${p.nums[1]}`;
      this.setFactorSlot(0, true);
    }
    if (isScan) this.renderScanChoices();

    this.renderStage();
    this.updateInputDisplay();
    this.renderPips();
    this.setFeedback('info', p.isFollowUp ? 'Follow-up job' : 'New job', this.jobIntro(p));
    soundEngine.playLaserScan();

    this.updateTimerDisplay();
    if (this.modal === 'play') this.resumeTimer();
  }

  jobIntro(p) {
    if (p.isFollowUp) return 'Same kind of trap as the last one. Show you\'ve got it now.';
    if (p.isRetry) return 'Fresh numbers. Same kind of job.';
    return {
      crack: 'Find the biggest number that divides into BOTH dials.',
      crack3: 'One number has to divide into ALL THREE dials.',
      split: 'Type a number of bags to preview the split. Find the most bags with nothing left behind.',
      tile: 'Type a tile size to preview it on the floor. Find the biggest one that fits with no gaps.',
      factor: 'Number outside × each number inside must rebuild the sum.',
      scan: 'Some keys are traps. Only one is the GREATEST common factor.',
    }[p.mode];
  }

  // ------------------------------------------------------------------
  // Timer
  // ------------------------------------------------------------------
  resumeTimer() {
    clearInterval(this.timerHandle);
    this.timerHandle = null;
    if (this.isPractice || !this.started || this.modal !== 'play') return;
    this.timerHandle = setInterval(() => this.tick(), 1000);
  }

  tick() {
    if (this.locked || this.modal !== 'play') return;
    this.timeRemaining--;
    this.updateTimerDisplay();
    if (this.timeRemaining <= 5 && this.timeRemaining > 0) soundEngine.playClick();
    if (this.timeRemaining <= 0) this.onTimeout();
  }

  updateTimerDisplay() {
    const max = this.sector.timeLimit;
    const pct = Math.max(0, (this.timeRemaining / max) * 100);
    this.el.timerDisplay.textContent = `${Math.max(0, this.timeRemaining)}s`;
    this.el.timerBar.style.width = `${pct}%`;
    const color = pct < 25 ? 'bg-rose-500' : pct < 50 ? 'bg-amber-400' : 'bg-cyan-400';
    this.el.timerBar.className = `h-full ${color} rounded-full transition-all duration-300`;
    this.el.timerDisplay.classList.toggle('animate-urgent', pct < 25);
    this.el.timerDisplay.classList.toggle('text-rose-400', pct < 25);
  }

  onTimeout() {
    this.locked = true;
    clearInterval(this.timerHandle);
    const p = this.problem;
    soundEngine.playAlarmSiren();
    this.shake();
    this.recordMiss(p, null, '(time ran out)');
    this.recordCompleted(p, false);
    this.setFeedback('error', "Time's up!", `${this.answerText(p)} ${this.explain(p)}`);
    this.addHeat(TIMEOUT_HEAT, () => {
      // Swap in fresh numbers of the same job type so the answer can't just be copied.
      const fresh = makeProblem(p.mode, this.rng, this.sector.numbers);
      fresh.isRetry = true;
      this.queue[this.waveIndex] = fresh;
      setTimeout(() => this.loadProblem(), 2600);
    });
  }

  // ------------------------------------------------------------------
  // Input
  // ------------------------------------------------------------------
  typeDigit(d) {
    if (this.locked || !this.problem || this.problem.mode === 'scan') return;
    soundEngine.playTumblerClick();
    if (this.problem.mode === 'factor') {
      if (this.factorSlots[this.activeSlot].length >= 3) return;
      this.factorSlots[this.activeSlot] += d;
    } else {
      if (this.input.length >= 3) return;
      this.input = this.input === '0' ? d : this.input + d;
    }
    this.updateInputDisplay();
  }

  backspace() {
    if (this.locked || !this.problem) return;
    soundEngine.playClick();
    if (this.problem.mode === 'factor') {
      if (!this.factorSlots[this.activeSlot] && this.activeSlot > 0) this.setFactorSlot(this.activeSlot - 1);
      this.factorSlots[this.activeSlot] = this.factorSlots[this.activeSlot].slice(0, -1);
    } else {
      this.input = this.input.slice(0, -1);
    }
    this.updateInputDisplay();
  }

  clearInput() {
    if (this.locked || !this.problem) return;
    this.input = '';
    this.factorSlots = ['', '', ''];
    if (this.problem.mode === 'factor') this.setFactorSlot(0, true);
    this.updateInputDisplay();
  }

  setFactorSlot(i, silent = false) {
    if (!silent) soundEngine.playClick();
    this.activeSlot = i;
    this.factorSlotEls.forEach((s, idx) => s.classList.toggle('slot-active', idx === i));
  }

  updateInputDisplay() {
    const p = this.problem;
    if (!p) return;
    if (p.mode === 'factor') {
      this.factorSlotEls.forEach((s, i) => { s.textContent = this.factorSlots[i] || '_'; });
      const core = document.getElementById('gcf-core-value');
      if (core) {
        const [g, m, n] = this.factorSlots.map((v) => v || '?');
        core.textContent = `${g}(${m} + ${n})`;
      }
      return;
    }
    this.el.answerDisplay.textContent = this.input || '_';
    const core = document.getElementById('gcf-core-value');
    if (core) core.textContent = this.input || '?';
    if (p.mode === 'split') this.renderSplitPreview(this.input);
    if (p.mode === 'tile') this.renderTilePreview(this.input);
  }

  showHint() {
    if (this.locked || !this.problem || this.hintUsed) return;
    soundEngine.playClick();
    this.hintUsed = true;
    this.sectorStats.hints++;
    this.el.hintText.textContent = this.problem.hint;
    this.el.hintStrip.classList.remove('hidden');
  }

  // ------------------------------------------------------------------
  // Answer checking
  // ------------------------------------------------------------------
  submit() {
    if (this.locked || !this.problem || this.modal !== 'play') return;
    const p = this.problem;
    let result;

    if (p.mode === 'factor') {
      const [g, m, n] = this.factorSlots;
      if (!g || !m || !n) {
        this.setFactorSlot(this.factorSlots.findIndex((v) => !v));
        this.setFeedback('warn', 'Not done yet', 'Fill in all three boxes. Tab or → moves to the next one.');
        return;
      }
      const r = evaluateFactorOut(g, m, n, p.nums[0], p.nums[1]);
      result = { correct: r.isCorrect, code: r.code, message: r.message, given: `${g}(${m} + ${n})` };
    } else {
      if (!this.input) {
        this.setFeedback('warn', 'Nothing entered', 'Type a number first.');
        return;
      }
      const r = diagnoseGCFAnswer(this.input, p.nums);
      result = { correct: r.isCorrect, code: r.code, message: r.message, given: this.input, diag: r };
      if (!r.isCorrect) result.message = this.modeSpecificMiss(p, parseMathInput(this.input), r);
    }

    if (result.correct) this.onCorrect(p);
    else this.onMiss(p, result);
  }

  pickScan(i) {
    if (this.locked || !this.problem || this.problem.mode !== 'scan') return;
    const p = this.problem;
    const choice = p.choices[i];
    if (choice === undefined) return;
    const btn = this.el.scanPanel.children[i];
    if (btn?.disabled) return;
    const r = diagnoseGCFAnswer(choice, p.nums);
    if (r.isCorrect) {
      btn.className = 'key-btn h-24 rounded-2xl border-2 border-emerald-400 bg-emerald-900/60 glow-emerald flex flex-col items-center justify-center gap-1';
      this.onCorrect(p);
    } else {
      btn.disabled = true;
      btn.classList.add('opacity-30', 'line-through');
      this.onMiss(p, { correct: false, code: r.code, message: r.message, given: String(choice) });
    }
  }

  /** Re-words the generic diagnosis so it talks about bags or tiles. */
  modeSpecificMiss(p, n, diag) {
    if (p.mode === 'split') {
      const s = evaluateSplit(n, p.nums[0], p.nums[1]);
      if (diag.code === 'COMMON_NOT_GREATEST') {
        return `${n} bag${n === 1 ? '' : 's'} works, but each bag holds ${s.perBagA} ${p.loot.aIcon} + ${s.perBagB} ${p.loot.bIcon}. Those still share ${diag.leftover}, so every bag could split into ${diag.leftover} smaller identical bags. You can fill MORE bags.`;
      }
      if (n > Math.min(...p.nums)) return `With ${n} bags, some bags get no ${p.nums[0] < p.nums[1] ? p.loot.a : p.loot.b} at all, so they aren't identical. ${diag.message}`;
      return `${n} bag${n === 1 ? '' : 's'} leaves loot behind: ${s.leftoverA} ${p.loot.aIcon} and ${s.leftoverB} ${p.loot.bIcon} don't fit evenly. ${diag.message}`;
    }
    if (p.mode === 'tile') {
      const t = evaluateTile(n, p.nums[0], p.nums[1]);
      if (diag.code === 'COMMON_NOT_GREATEST') {
        const k = getGCF(t.cols, t.rows);
        return `${n} ft tiles fit with no cuts, but the grid is ${t.cols} × ${t.rows} and those share ${k}. Merge ${k} × ${k} blocks into one ${n * k} ft tile. Go bigger!`;
      }
      if (n > Math.min(...p.nums)) return `A ${n} ft tile is wider than the ${Math.min(...p.nums)} ft side of the floor. It can't fit.`;
      const gaps = [];
      if (t.leftoverW) gaps.push(`${t.leftoverW} ft gap along the ${p.nums[0]} ft side`);
      if (t.leftoverH) gaps.push(`${t.leftoverH} ft gap along the ${p.nums[1]} ft side`);
      return `${n} ft tiles leave a ${gaps.join(' and a ')}. ${diag.message}`;
    }
    return diag.message;
  }

  onCorrect(p) {
    this.locked = true;
    clearInterval(this.timerHandle);
    const firstTry = !p.missed;
    if (firstTry) {
      this.combo = Math.min(MAX_COMBO, this.combo + 1);
      this.maxCombo = Math.max(this.maxCombo, this.combo);
    }
    this.recordCompleted(p, firstTry);

    const timeBonus = this.isPractice ? 0 : Math.max(0, this.timeRemaining) * 5;
    const bossBonus = this.sector.isBossSector ? 150 : 0;
    const gained = 100 * this.combo + timeBonus + bossBonus;
    this.score += gained;

    this.renderSolved(p);
    this.updateHud();
    this.floatText(`+$${gained}`, this.el.fireBtn.classList.contains('hidden') ? this.el.scanPanel : this.el.fireBtn, '#fde047');
    this.burstAt(document.getElementById('gcf-core') || this.el.stageVisual, '#fbbf24', 34);
    this.stamp(this.sector.isBossSector ? 'SMASH!' : p.mode === 'split' ? 'PACKED!' : p.mode === 'tile' ? 'PERFECT FIT!' : 'CRACKED!');

    let title = firstTry ? 'Cracked!' : 'Got it!';
    if (this.combo >= 3 && firstTry) title += ` Combo x${this.combo}`;
    this.setFeedback('success', title, this.explain(p));

    if (this.sector.isBossSector) {
      this.bossHp--;
      soundEngine.playTorqueStrikeSuccess();
      this.el.golem.classList.remove('golem-hit', 'golem-slam');
      void this.el.golem.offsetWidth;
      this.el.golem.classList.add('golem-hit');
      this.shake();
      this.renderBoss();
    } else {
      soundEngine.playTumblerLock();
      setTimeout(() => soundEngine.playSquareLock(), 120);
    }

    setTimeout(() => this.nextWave(), 1700);
  }

  onMiss(p, result) {
    this.shake();
    if (result.code === 'COMMON_NOT_GREATEST' || result.code === 'NOT_GREATEST') soundEngine.playTorqueInsufficient();
    else soundEngine.playJamBuzz();

    const firstMiss = !p.missed;
    this.recordMiss(p, result.code, result.given);
    this.combo = Math.max(1, this.combo - 1);

    const titles = {
      COMMON_NOT_GREATEST: 'Common factor, not the GREATEST',
      NOT_GREATEST: 'Factored, but not by the GCF',
      LCM_MIXUP: 'That\'s a multiple',
      TOO_BIG: 'Too big',
      DIVIDES_SOME: 'Doesn\'t divide both',
      DIVIDES_NONE: 'Not a factor',
      WRONG_PRODUCT: 'Doesn\'t rebuild the sum',
    };
    this.setFeedback('error', titles[result.code] || 'Alarm tripped!', result.message);

    // Schedule a targeted follow-up the first time a diagnosed mistake shows up.
    if (firstMiss && !this.sector.isBossSector && !p.isFollowUp && this.sectorStats.followups < MAX_FOLLOWUPS_PER_SECTOR) {
      const fu = makeFollowUp(p, result.code, this.rng, this.sector.numbers);
      if (fu) {
        fu.isFollowUp = true;
        this.queue.splice(this.waveIndex + 1, 0, fu);
        this.sectorStats.followups++;
        this.renderPips();
      }
    }

    if (this.sector.isBossSector) {
      this.el.golem.classList.remove('golem-hit', 'golem-slam');
      void this.el.golem.offsetWidth;
      this.el.golem.classList.add('golem-slam');
      this.el.bossTaunt.textContent = '"HA! Wrong key, thief!"';
    }

    // Clear the input so the next try starts fresh (scan keeps its crossed-out keys).
    this.input = '';
    if (p.mode === 'factor') {
      this.factorSlots = ['', '', ''];
      this.setFactorSlot(0, true);
    }
    this.updateInputDisplay();
    this.renderMissVisual(p, result); // after clearing, so the wrong guess stays visible

    this.updateHud();
    this.addHeat(this.sector.heatPerMiss);
  }

  /** Heat goes up; at 100 a smoke bomb fires (or the run ends). `then` runs if the run continues. */
  addHeat(amount, then) {
    if (this.isPractice) { then?.(); return; }
    this.heat = Math.min(100, this.heat + amount);
    this.updateHud();
    if (this.heat < 100) { then?.(); return; }

    clearInterval(this.timerHandle);
    this.locked = true;
    soundEngine.playAlarmSiren();
    if (this.bombs > 0) {
      this.bombs--;
      setTimeout(() => {
        this.el.smokeText.textContent = `Heat cleared. ${this.bombs} smoke bomb${this.bombs === 1 ? '' : 's'} left.`;
        this.el.smokeOverlay.classList.remove('hidden');
        this.heat = 0;
        this.updateHud();
        setTimeout(() => {
          this.el.smokeOverlay.classList.add('hidden');
          if (then) { then(); return; }
          this.locked = false;
          this.timeRemaining = this.sector.timeLimit;
          this.updateTimerDisplay();
          this.resumeTimer();
        }, 1300);
      }, 700);
    } else {
      setTimeout(() => this.finishRun(false), 1100);
    }
  }

  recordMiss(p, code, given) {
    p.missed = true;
    this.sectorStats.misses++;
    if (this.mistakes.length < 12) {
      const q = {
        factor: `${p.nums[0]} + ${p.nums[1]}`,
        split: `${p.nums[0]} & ${p.nums[1]} loot, most bags`,
        tile: `${p.nums[0]} × ${p.nums[1]} floor, biggest tile`,
      }[p.mode] || `GCF(${p.nums.join(', ')})`;
      const right = p.mode === 'factor' ? `${p.answerParts[0]}(${p.answerParts[1]} + ${p.answerParts[2]})` : p.answer;
      this.mistakes.push(`${MODE_INFO[p.mode].icon} ${q}: you said ${given} → ${right}`);
    }
  }

  recordCompleted(p, firstTry) {
    if (p.counted) return;
    p.counted = true;
    const s = (this.skills[p.mode] ||= { right: 0, total: 0 });
    s.total++;
    this.completedProblems++;
    if (firstTry) {
      s.right++;
      this.firstTryCorrect++;
    }
  }

  answerText(p) {
    if (p.mode === 'factor') return `Answer: ${p.nums[0]} + ${p.nums[1]} = ${p.answerParts[0]}(${p.answerParts[1]} + ${p.answerParts[2]}).`;
    return `GCF(${p.nums.join(', ')}) = ${p.answer}.`;
  }

  explain(p) {
    const g = p.answer;
    const parts = p.nums.map((n) => `${n} = ${g} × ${n / g}`).join(', ');
    switch (p.mode) {
      case 'split':
        return `${g} bags, each with ${p.nums[0] / g} ${p.loot.aIcon} + ${p.nums[1] / g} ${p.loot.bIcon}. ${g === 1 ? `${p.nums[0]} and ${p.nums[1]} share no factor but 1.` : `GCF(${p.nums[0]}, ${p.nums[1]}) = ${g}.`}`;
      case 'tile':
        return `${g} ft tiles: ${p.nums[0] / g} across × ${p.nums[1] / g} down = ${(p.nums[0] / g) * (p.nums[1] / g)} tiles. GCF(${p.nums[0]}, ${p.nums[1]}) = ${g}.`;
      case 'factor':
        return `${p.nums[0]} + ${p.nums[1]} = ${g}(${p.answerParts[1]} + ${p.answerParts[2]}) because ${parts}.`;
      default:
        return g === 1 ? `${p.nums.join(' and ')} share no factor except 1. GCF = 1.` : `${parts}. Leftovers ${p.nums.map((n) => n / g).join(', ')} share only 1.`;
    }
  }

  nextWave() {
    if (this.sector.isBossSector && this.bossHp <= 0) {
      this.sectorCleared();
      return;
    }
    this.waveIndex++;
    if (this.waveIndex < this.queue.length) this.loadProblem();
    else this.sectorCleared();
  }

  sectorCleared() {
    clearInterval(this.timerHandle);
    const { misses, hints } = this.sectorStats;
    const stars = misses === 0 && hints === 0 ? 3 : misses <= 2 ? 2 : 1;
    this.starsBySector[this.sectorIndex] = Math.max(this.starsBySector[this.sectorIndex] || 0, stars);

    if (this.sector.isBossSector) {
      this.finishRun(true);
      return;
    }
    soundEngine.playVictoryFanfare();
    this.burstAt(this.el.stageVisual, '#10b981', 60);
    const next = CURRICULUM_SECTORS[this.sectorIndex + 1];
    this.el.sectorClearTitle.textContent = this.sector.name;
    this.el.sectorClearStars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    this.el.sectorClearStats.textContent = `${misses} miss${misses === 1 ? '' : 'es'} · ${hints} hint${hints === 1 ? '' : 's'} · 3★ = no misses, no hints`;
    this.el.sectorClearNext.textContent = next.name;
    this.el.sectorClearNextDesc.textContent = next.description;
    this.modal = 'sectorClear';
    this.el.modalSectorClear.classList.remove('hidden');
  }

  continueAfterSector() {
    soundEngine.playClick();
    this.el.modalSectorClear.classList.add('hidden');
    this.modal = 'play';
    this.loadSector(this.sectorIndex + 1);
  }

  retryFloor() {
    soundEngine.playClick();
    this.el.modalDebrief.classList.add('hidden');
    this.bombs = SMOKE_BOMBS;
    this.run[this.sectorIndex] = buildRun(Date.now())[this.sectorIndex];
    this.modal = 'play';
    this.loadSector(this.sectorIndex);
  }

  newHeist() {
    soundEngine.playClick();
    this.el.modalDebrief.classList.add('hidden');
    this.resetRunState();
    this.started = false;
    this.loadSector(0);
    this.openModal('briefing');
  }

  finishRun(victory) {
    clearInterval(this.timerHandle);
    this.locked = true;
    this.modal = 'debrief';
    const el = this.el;
    const secs = Math.round((Date.now() - this.runStartedAt) / 1000);

    el.debriefRetryBtn.classList.toggle('hidden', victory);
    el.debriefRestartBtn.classList.toggle('col-span-2', victory);
    el.debriefRestartBtn.textContent = victory ? '🏦 New Heist (Enter)' : 'New Heist';

    if (victory) {
      soundEngine.playVictoryFanfare();
      this.burstAt(el.stageVisual, '#fbbf24', 90);
      el.debriefIcon.textContent = this.isPractice ? '🧪' : '🏆';
      el.debriefTitle.textContent = this.isPractice ? 'Practice heist complete!' : 'The Vault is yours!';
      el.debriefSubtitle.textContent = this.isPractice
        ? "Nice work! Practice runs don't unlock anything. Run a real heist when you're ready."
        : 'The Vault Golem crumbled. All four floors cleaned out.';
      if (!this.isPractice) {
        try {
          window.parent.postMessage({
            type: 'CARTRIDGE_COMPLETE',
            payload: {
              lessonId: 'G06_U03_L02',
              // score = jobs solved on the first try; total = jobs played
              score: this.firstTryCorrect,
              total: this.completedProblems,
              bossDefeated: true,
            },
          }, '*');
        } catch (e) { /* not embedded */ }
      }
    } else {
      el.debriefIcon.textContent = '🚨';
      el.debriefTitle.textContent = 'Busted!';
      el.debriefSubtitle.textContent = `The heat maxed out on ${this.sector.name} with no smoke bombs left. Check the Guide, then retry this floor with 3 fresh bombs.`;
    }

    const starTotal = this.starsBySector.reduce((a, b) => a + (b || 0), 0);
    el.debriefStars.textContent = `★ ${starTotal} / ${CURRICULUM_SECTORS.length * 3} floor stars`;
    el.debriefScore.textContent = `$${this.score.toLocaleString()}`;
    el.debriefAccuracy.textContent = `${this.firstTryCorrect}/${this.completedProblems}`;
    el.debriefCombo.textContent = `x${this.maxCombo}`;
    el.debriefTime.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

    el.debriefSkills.innerHTML = Object.entries(this.skills).map(([mode, s]) => {
      const pct = Math.round((s.right / Math.max(1, s.total)) * 100);
      const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-500';
      return `<div><div class="flex justify-between"><span class="text-slate-300">${MODE_INFO[mode].icon} ${MODE_INFO[mode].label}</span><span class="font-mono-math font-bold text-slate-400">${s.right}/${s.total}</span></div>
        <div class="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5"><div class="h-full ${color}" style="width:${pct}%"></div></div></div>`;
    }).join('') || '<p class="text-slate-500">No jobs finished yet.</p>';
    el.debriefMistakes.innerHTML = this.mistakes.length
      ? this.mistakes.map((m) => `<p>${m}</p>`).join('')
      : '<p class="text-emerald-300">No mistakes. Clean heist!</p>';

    el.modalDebrief.classList.remove('hidden');
  }

  // ------------------------------------------------------------------
  // Rendering: HUD
  // ------------------------------------------------------------------
  updateHud() {
    const el = this.el;
    el.scoreDisplay.textContent = `$${this.score.toLocaleString()}`;
    el.comboDisplay.textContent = `x${this.combo}`;
    el.comboFlame.textContent = this.combo >= 4 ? '🔥' : '⚡';
    el.comboFlame.classList.toggle('combo-hot', this.combo >= 3);
    el.comboBox.classList.toggle('glow-amber', this.combo >= 4);

    el.heatBar.style.width = `${this.heat}%`;
    el.heatDisplay.textContent = `${this.heat}%`;
    const hc = this.heat >= 75 ? ['bg-rose-500', 'text-rose-400'] : this.heat >= 40 ? ['bg-amber-500', 'text-amber-300'] : ['bg-emerald-500', 'text-emerald-400'];
    el.heatBar.className = `h-full ${hc[0]} rounded-full transition-all duration-300`;
    el.heatDisplay.className = `text-xs w-9 font-mono-math font-bold ${hc[1]} ${this.heat >= 75 ? 'animate-urgent' : ''}`;
    el.heatVignette.style.opacity = this.isPractice || this.heat < 40 ? 0 : ((this.heat - 30) / 70) * 0.55;
    el.bombsDisplay.textContent = '💨'.repeat(this.bombs) + '▫️'.repeat(SMOKE_BOMBS - this.bombs);
  }

  renderPips() {
    this.el.wavePips.innerHTML = this.queue.map((p, i) => {
      let cls = 'bg-slate-800 border-slate-700';
      if (i < this.waveIndex) cls = p.missed ? 'bg-amber-500 border-amber-300' : 'bg-emerald-500 border-emerald-300';
      else if (i === this.waveIndex) cls = 'bg-amber-300 border-white animate-urgent';
      if (p.isFollowUp && i >= this.waveIndex) cls += ' ring-2 ring-indigo-400';
      return `<span title="${MODE_INFO[p.mode].label}" class="w-3 h-3 rounded-full border ${cls}"></span>`;
    }).join('');
  }

  renderBoss() {
    const max = this.sector.bossHp;
    this.el.bossHpPlates.innerHTML = Array.from({ length: max }, (_, i) =>
      `<span class="flex-1 h-3 rounded ${i < this.bossHp ? 'bg-gradient-to-b from-rose-400 to-rose-700 border border-rose-300' : 'bg-slate-800 border border-slate-700'}"></span>`
    ).join('');
    this.el.bossHpText.textContent = `${this.bossHp} / ${max} armor`;
    this.el.bossTaunt.textContent = BOSS_TAUNTS[Math.min(BOSS_TAUNTS.length - 1, max - this.bossHp)];
    this.el.golem.textContent = this.bossHp <= 0 ? '💥' : this.bossHp <= 2 ? '🪨' : '🗿';
  }

  setFeedback(type, title, text) {
    const styles = {
      info: ['🕶️', 'border-slate-700 bg-slate-900/70', 'text-slate-300'],
      warn: ['⚠️', 'border-amber-600/70 bg-amber-950/50', 'text-amber-300'],
      error: ['🚨', 'border-rose-500/70 bg-rose-950/60 glow-rose', 'text-rose-300'],
      success: ['✅', 'border-emerald-500/70 bg-emerald-950/60 glow-emerald', 'text-emerald-300'],
    }[type];
    this.el.feedbackIcon.textContent = styles[0];
    this.el.feedback.className = `flex-1 min-h-[72px] rounded-xl border p-3 overflow-hidden transition-all ${styles[1]}`;
    this.el.feedbackTitle.className = `text-xs font-black uppercase tracking-wider ${styles[2]}`;
    this.el.feedbackTitle.textContent = title;
    this.el.feedbackText.textContent = text;
  }

  // ------------------------------------------------------------------
  // Rendering: stage per mode
  // ------------------------------------------------------------------
  renderStage() {
    const p = this.problem;
    const v = this.el.stageVisual;
    if (p.mode === 'split') { v.innerHTML = this.splitHtml(p); this.renderSplitPreview(''); return; }
    if (p.mode === 'tile') { v.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center gap-2"><div id="tile-floor" class="pop-in"></div><p id="tile-caption" class="text-sm font-bold text-slate-300 text-center"></p></div>'; this.renderTilePreview(''); return; }
    v.innerHTML = this.dialsHtml(p);
  }

  dialsHtml(p) {
    const colors = ['cyan', 'amber', 'fuchsia'];
    const size = p.nums.length === 3 ? 'w-36 h-36' : 'w-44 h-44';
    const dial = (n, i) => `
      <div class="flex flex-col items-center gap-2 pop-in" style="animation-delay:${i * 80}ms">
        <div class="relative ${size}">
          <div class="dial-ring absolute inset-0 rounded-full border-[6px] border-dashed border-${colors[i]}-500/60"></div>
          <div class="absolute inset-3 rounded-full bg-gradient-to-b from-slate-800 to-slate-950 border-2 border-${colors[i]}-400/70 flex items-center justify-center shadow-2xl">
            <span class="font-mono-math font-black text-5xl text-${colors[i]}-200">${n}</span>
          </div>
        </div>
        <div class="dial-split h-6 font-mono-math font-bold text-sm text-${colors[i]}-300"></div>
      </div>`;
    const core = `
      <div id="gcf-core" class="flex flex-col items-center gap-1 px-4 py-3 rounded-2xl border-2 border-amber-500/60 bg-amber-950/30 min-w-[120px] pop-in">
        <span class="text-[10px] font-black uppercase tracking-widest text-amber-500">${p.mode === 'factor' ? 'Override' : 'GCF'}</span>
        <span id="gcf-core-value" class="font-mono-math font-black ${p.mode === 'factor' ? 'text-2xl' : 'text-4xl'} text-amber-200">?</span>
      </div>`;
    const parts = p.nums.map(dial);
    const middle = p.nums.length === 3
      ? `${parts[0]}${parts[1]}${parts[2]}</div><div class="flex justify-center mt-4">${core}`
      : `${parts[0]}${core}${parts[1]}`;
    return `<div class="w-full"><div class="flex items-center justify-center gap-6">${middle}</div></div>`;
  }

  splitHtml(p) {
    const icons = (n, icon) => `<span class="leading-none">${icon.repeat(n)}</span>`;
    return `
      <div class="w-full h-full flex flex-col gap-3">
        <div class="grid grid-cols-2 gap-3 shrink-0">
          <div class="rounded-xl border border-amber-700/50 bg-amber-950/20 p-2">
            <div class="text-[11px] font-black uppercase text-amber-300 mb-1">${p.nums[0]} ${p.loot.a}</div>
            <div class="text-[13px] tracking-tight break-all max-h-[84px] overflow-hidden">${icons(p.nums[0], p.loot.aIcon)}</div>
          </div>
          <div class="rounded-xl border border-cyan-700/50 bg-cyan-950/20 p-2">
            <div class="text-[11px] font-black uppercase text-cyan-300 mb-1">${p.nums[1]} ${p.loot.b}</div>
            <div class="text-[13px] tracking-tight break-all max-h-[84px] overflow-hidden">${icons(p.nums[1], p.loot.bIcon)}</div>
          </div>
        </div>
        <div id="bag-area" class="flex-1 min-h-0 rounded-xl border border-dashed border-slate-700 p-2 flex flex-col"></div>
      </div>`;
  }

  renderSplitPreview(raw, solved = false) {
    const area = document.getElementById('bag-area');
    if (!area) return;
    const p = this.problem;
    const n = parseMathInput(raw);
    if (isNaN(n) || n <= 0) {
      area.innerHTML = '<div class="flex-1 flex items-center justify-center text-sm text-slate-500 font-bold">👜 Type a number of bags to see how the loot splits</div>';
      return;
    }
    const s = evaluateSplit(n, p.nums[0], p.nums[1]);
    const shown = Math.min(n, 14);
    const bag = (i) => `
      <div class="bag-drop flex flex-col items-center justify-center rounded-xl border ${s.clean ? (solved ? 'border-emerald-400 bg-emerald-950/50' : 'border-amber-500/60 bg-slate-900') : 'border-slate-700 bg-slate-900'} px-2 py-1" style="animation-delay:${i * 30}ms">
        <span class="text-lg leading-none">👜</span>
        <span class="text-[11px] font-mono-math font-bold text-slate-200 whitespace-nowrap">${s.perBagA}${p.loot.aIcon} ${s.perBagB}${p.loot.bIcon}</span>
      </div>`;
    const status = s.clean
      ? solved
        ? `<span class="text-emerald-300">✓ ${n} identical bags, nothing left behind. That's the most possible.</span>`
        : `<span class="text-amber-300">✓ Clean split: ${n} identical bag${n === 1 ? '' : 's'}. Is it the MOST bags?</span>`
      : `<span class="text-rose-300">✗ Left behind: ${s.leftoverA} ${p.loot.aIcon} + ${s.leftoverB} ${p.loot.bIcon}${s.perBagA === 0 || s.perBagB === 0 ? ' (and some bags are missing loot)' : ''}</span>`;
    area.innerHTML = `
      <div class="text-xs font-bold mb-1.5">${status}</div>
      <div class="flex flex-wrap gap-1.5 content-start overflow-hidden">
        ${Array.from({ length: shown }, (_, i) => bag(i)).join('')}
        ${n > shown ? `<div class="flex items-center px-2 text-xs font-bold text-slate-400">+${n - shown} more</div>` : ''}
      </div>`;
  }

  renderTilePreview(raw, solved = false) {
    const box = document.getElementById('tile-floor');
    const cap = document.getElementById('tile-caption');
    if (!box) return;
    const p = this.problem;
    const [w, h] = p.nums;
    // Fit the floor to the stage, leaving room for labels and the caption.
    const stage = this.el.stageVisual;
    const W = Math.max(320, Math.min(680, stage.clientWidth - 80));
    const H = Math.max(180, Math.min(340, stage.clientHeight - 90));
    const scale = Math.min(W / w, H / h);
    const fw = w * scale;
    const fh = h * scale;
    const pad = 26;
    const n = parseMathInput(raw);
    const t = isNaN(n) || n <= 0 ? null : evaluateTile(n, w, h);

    let inner = `<rect x="${pad}" y="${pad}" width="${fw}" height="${fh}" fill="#1e293b" stroke="#64748b" stroke-width="2" rx="3"/>`;
    if (t && t.cols > 0 && t.rows > 0) {
      const ts = n * scale;
      const fill = solved ? '#065f46' : t.fits ? '#78350f' : '#334155';
      const stroke = solved ? '#34d399' : t.fits ? '#fbbf24' : '#94a3b8';
      inner += `
        <defs><pattern id="tilepat" x="${pad}" y="${pad}" width="${ts}" height="${ts}" patternUnits="userSpaceOnUse">
          <rect x="0.75" y="0.75" width="${Math.max(0, ts - 1.5)}" height="${Math.max(0, ts - 1.5)}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" rx="2"/>
        </pattern></defs>
        <rect x="${pad}" y="${pad}" width="${t.cols * ts}" height="${t.rows * ts}" fill="url(#tilepat)"/>`;
    }
    if (t && !t.fits) {
      const cw = t.cols * n * scale;
      const ch = t.rows * n * scale;
      if (t.leftoverW) inner += `<rect x="${pad + cw}" y="${pad}" width="${fw - cw}" height="${fh}" fill="#e11d48" fill-opacity="0.45" stroke="#fb7185" stroke-dasharray="4 3"/>`;
      if (t.leftoverH) inner += `<rect x="${pad}" y="${pad + ch}" width="${cw}" height="${fh - ch}" fill="#e11d48" fill-opacity="0.45" stroke="#fb7185" stroke-dasharray="4 3"/>`;
    }
    inner += `<text x="${pad + fw / 2}" y="${pad - 8}" text-anchor="middle" fill="#fbbf24" font-family="JetBrains Mono, monospace" font-weight="800" font-size="14">${w} ft</text>`;
    inner += `<text x="${pad - 8}" y="${pad + fh / 2}" text-anchor="middle" fill="#fbbf24" font-family="JetBrains Mono, monospace" font-weight="800" font-size="14" transform="rotate(-90 ${pad - 8} ${pad + fh / 2})">${h} ft</text>`;
    box.innerHTML = `<svg width="${fw + pad * 2}" height="${fh + pad + 8}" viewBox="0 0 ${fw + pad * 2} ${fh + pad + 8}">${inner}</svg>`;

    if (!cap) return;
    if (!t) cap.innerHTML = '<span class="text-slate-500">🟨 Type a tile size to lay it on the floor</span>';
    else if (t.cols === 0 || t.rows === 0) cap.innerHTML = `<span class="text-rose-300">✗ A ${n} ft tile is too big for this floor.</span>`;
    else if (t.fits) cap.innerHTML = solved
      ? `<span class="text-emerald-300">✓ ${n} ft tiles: ${t.cols} × ${t.rows} = ${t.cols * t.rows} tiles, zero cuts. Biggest possible!</span>`
      : `<span class="text-amber-300">✓ ${n} ft tiles fit: ${t.cols} × ${t.rows} = ${t.cols * t.rows} tiles. Is it the LARGEST?</span>`;
    else cap.innerHTML = `<span class="text-rose-300">✗ ${n} ft tiles leave a gap${t.leftoverW && t.leftoverH ? 's' : ''} (red) that would need cutting.</span>`;
  }

  renderScanChoices() {
    const p = this.problem;
    this.el.scanPanel.innerHTML = p.choices.map((c, i) => `
      <button type="button" data-i="${i}" class="scan-btn key-btn h-24 rounded-2xl border-2 border-amber-600/50 bg-slate-900 hover:bg-amber-950/40 flex flex-col items-center justify-center gap-1 cursor-pointer">
        <span class="text-[10px] font-black text-slate-500">[${i + 1}]</span>
        <span class="text-xl leading-none">🗝️</span>
        <span class="font-mono-math font-black text-3xl text-amber-200">${c}</span>
      </button>`).join('');
    [...this.el.scanPanel.children].forEach((b, i) => b.addEventListener('click', () => this.pickScan(i)));
  }

  renderSolved(p) {
    if (p.mode === 'split') { this.renderSplitPreview(String(p.answer), true); return; }
    if (p.mode === 'tile') { this.renderTilePreview(String(p.answer), true); return; }
    const core = document.getElementById('gcf-core');
    const val = document.getElementById('gcf-core-value');
    if (core && val) {
      core.className = 'flex flex-col items-center gap-1 px-4 py-3 rounded-2xl border-2 border-emerald-400 bg-emerald-950/50 min-w-[120px] glow-emerald pop-in';
      val.className = `font-mono-math font-black ${p.mode === 'factor' ? 'text-2xl' : 'text-4xl'} text-emerald-200`;
      val.textContent = p.mode === 'factor' ? `${p.answerParts[0]}(${p.answerParts[1]} + ${p.answerParts[2]})` : p.answer;
    }
    document.querySelectorAll('.dial-ring').forEach((r) => r.classList.add('fast'));
    document.querySelectorAll('.dial-split').forEach((d, i) => {
      d.textContent = `= ${p.answer} × ${p.nums[i] / p.answer}`;
      d.classList.add('pop-in');
    });
  }

  renderMissVisual(p, result) {
    if (p.mode === 'split') { this.renderSplitPreview(result.given); return; }
    if (p.mode === 'tile') { this.renderTilePreview(result.given); return; }
    const core = document.getElementById('gcf-core');
    if (!core) return;
    core.classList.remove('pop-in');
    core.classList.add('border-rose-500', 'glow-rose');
    setTimeout(() => core.classList.remove('border-rose-500', 'glow-rose'), 600);
    // Show how the wrong guess divides each dial (or doesn't).
    const n = parseInt(result.given, 10); // factor mode: the number outside the parentheses
    if (!isNaN(n) && n > 0) {
      document.querySelectorAll('.dial-split').forEach((d, i) => {
        const num = p.nums[i];
        d.textContent = num % n === 0 ? `÷ ${n} = ${num / n} ✓` : `÷ ${n} = ${Math.floor(num / n)} R${num % n} ✗`;
        d.className = `dial-split h-6 font-mono-math font-bold text-sm ${num % n === 0 ? 'text-emerald-300' : 'text-rose-400'}`;
      });
    }
  }

  // ------------------------------------------------------------------
  // Juice
  // ------------------------------------------------------------------
  shake() {
    const root = this.el.gameRoot;
    root.classList.remove('shake-active');
    void root.offsetWidth;
    root.classList.add('shake-active');
  }

  stamp(text) {
    const s = this.el.stamp;
    s.textContent = text;
    s.classList.remove('hidden', 'stamp-active');
    void s.offsetWidth;
    s.classList.add('stamp-active');
    clearTimeout(this.stampTimer);
    this.stampTimer = setTimeout(() => s.classList.add('hidden'), 1100);
  }

  floatText(text, anchor, color) {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'float-text font-mono-math font-black text-2xl';
    f.style.left = `${r.left + r.width / 2}px`;
    f.style.top = `${r.top - 10}px`;
    f.style.color = color;
    f.style.textShadow = '0 2px 8px rgba(0,0,0,0.8)';
    f.textContent = text;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1000);
  }

  initCanvas() {
    const c = this.el.fxCanvas;
    this.ctx = c.getContext('2d');
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const loop = () => {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, c.width, c.height);
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.16;
        p.alpha -= p.decay;
        if (p.alpha <= 0) this.particles.splice(i, 1);
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  burstAt(anchor, color, count) {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const palette = [color, '#fde047', '#ffffff'];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 7;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 2.5,
        size: 3 + Math.random() * 4,
        color: palette[i % 3],
        alpha: 1,
        decay: 0.015 + Math.random() * 0.02,
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const game = new HeistGame();
  game.init();
  // ?debug exposes the game object for automated play-testing only.
  if (new URLSearchParams(location.search).has('debug')) window.__heist = game;
});
