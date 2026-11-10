/**
 * Grid Sync: The LCM Substation - Game Engine
 *
 * Run = 4 power lines + the Dynamo Overlord boss. Each line is a randomized set of jobs:
 *   sync    - pulses hop every a and b blocks; drop the breaker where they first collide (LCM)
 *   sync3   - same with three pulses (pairs may meet early: the trap)
 *   supply  - fewest items so packs of a and packs of b match (live pack preview)
 *   scan    - pick the LCM out of traps (product, GCF, 2 × LCM, multiple of one number)
 *   tool    - read a word problem, choose GCF or LCM, then solve it
 *   reverse - Alpha hops every a and they first collide at L: which could Beta be?
 *
 * Stakes: per-job timer, overload meter, 3 backup cells, combo x1-x5.
 * Every miss shows the full race/explanation, then moves on; a targeted follow-up is added.
 * Practice mode: no timer, no overload, nothing reported to the hub.
 */

import {
  getMultiples,
  diagnoseLCMAnswer,
  diagnoseGCFAnswer,
  evaluateSupply,
  evaluateReverse,
  buildRace,
} from './lcmLogic.js?v=20261110lcm2';
import {
  CURRICULUM_SECTORS,
  MODE_INFO,
  EXTRA_TIME,
  BACKUP_CELLS,
  TIMEOUT_OVERLOAD,
  MAX_FOLLOWUPS_PER_SECTOR,
  MAX_COMBO,
  BOSS_TAUNTS,
} from './curriculum.js?v=20261110lcm2';
import { createRng, buildRun, buildSector, makeProblem, makeFollowUp } from './generator.js?v=20261110lcm2';
import { soundEngine } from './audio.js?v=20261110lcm2';

const LESSON_ID = 'G06_U03_L02_LCM';
const LANE_COLORS = ['#22d3ee', '#fbbf24', '#e879f9'];
const LANE_NAMES = ['Alpha', 'Beta', 'Gamma'];
const NUMBER_MODES = ['sync', 'sync3', 'supply'];
const CHOICE_MODES = ['scan', 'reverse'];

const MISS_TITLES = {
  PRODUCT: 'Multiplied: too far!',
  COMMON_NOT_LEAST: 'Common, but not the LEAST',
  GCF_MIXUP: 'That\'s the GCF',
  TOO_SMALL: 'Too small',
  SOME: 'Not every pulse lands there',
  NONE: 'No pulse lands there',
  TOOL_MIXUP: 'Wrong tool',
  LCM_MIXUP: 'That\'s the LCM',
  COMMON_NOT_GREATEST: 'Common, but not the GREATEST',
  NOT_FACTOR: 'Doesn\'t divide both',
  MEETS_EARLY: 'They meet too soon',
  MEETS_LATE: 'They meet too late',
  TIMEOUT: 'Time\'s up! Surge hit',
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

class GridSyncGame {
  constructor() {
    this.el = {};
    this.rng = createRng(Date.now());
    this.isPractice = false;
    this.started = false;
    this.modal = 'briefing'; // briefing | play | guide | sectorClear | debrief
    this.locked = false; // no input at all (animations, overlays)
    this.phase = 'input'; // input | review (after a miss: Enter = next job)
    this.particles = [];
    this.trk = null;
    this.reported = false;
  }

  // ------------------------------------------------------------------
  // Setup
  // ------------------------------------------------------------------
  init() {
    const ids = [
      'game-root', 'fx-canvas', 'overload-vignette', 'stamp',
      'sector-badge', 'sector-title', 'wave-pips', 'practice-badge',
      'stakes-timer', 'timer-display', 'timer-bar', 'stakes-overload', 'overload-bar', 'overload-display',
      'stakes-cells', 'cells-display', 'combo-box', 'combo-flame', 'combo-display', 'score-display',
      'audio-toggle-btn', 'audio-icon', 'briefing-btn', 'field-guide-btn',
      'mode-icon', 'mode-label', 'followup-tag', 'hint-btn', 'boss-panel', 'boss-sprite', 'boss-hp-text',
      'boss-hp-coils', 'boss-taunt', 'prompt-text', 'hint-strip', 'hint-text', 'stage-visual',
      'console-label', 'console-keys', 'number-panel', 'answer-display', 'tool-panel', 'tool-gcf-btn', 'tool-lcm-btn',
      'keypad', 'choice-panel', 'feedback', 'feedback-icon', 'feedback-title', 'feedback-text', 'fire-btn',
      'modal-briefing', 'briefing-close-btn', 'briefing-start-btn', 'briefing-start-label', 'briefing-practice-btn',
      'modal-sector-clear', 'sector-clear-title', 'sector-clear-stars', 'sector-clear-stats',
      'sector-clear-next', 'sector-clear-next-desc', 'sector-clear-continue-btn',
      'cell-overlay', 'cell-text',
      'modal-debrief', 'debrief-icon', 'debrief-title', 'debrief-subtitle', 'debrief-stars', 'debrief-score',
      'debrief-accuracy', 'debrief-combo', 'debrief-time', 'debrief-skills', 'debrief-mistakes',
      'debrief-retry-btn', 'debrief-restart-btn',
      'modal-field-guide', 'close-field-guide-btn',
    ];
    for (const id of ids) {
      this.el[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(id);
    }
    this.el.audioIcon.textContent = soundEngine.getMuted() ? '🔇' : '🔊';

    this.buildKeypad();
    this.bindEvents();
    this.initCanvas();
    this.resetRunState();
    this.loadSector(0);
    this.pauseTimer();
  }

  resetRunState() {
    this.run = buildRun(Date.now());
    this.sectorIndex = 0;
    this.score = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.overload = 0;
    this.cells = BACKUP_CELLS;
    this.firstTryCorrect = 0;
    this.completedProblems = 0;
    this.skills = {};
    this.mistakes = [];
    this.starsBySector = [];
    this.runStartedAt = Date.now();
    this.reported = false;
  }

  buildKeypad() {
    const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '⌫', '0', 'C'];
    this.el.keypad.innerHTML = '';
    for (const k of keys) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'key-btn h-12 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 font-mono-math font-black text-xl text-slate-100 cursor-pointer';
      if (k === '⌫' || k === 'C') b.className += ' text-cyan-300 text-base';
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
    el.audioToggleBtn.addEventListener('click', () => this.toggleMute());
    el.hintBtn.addEventListener('click', () => this.showHint());
    el.fireBtn.addEventListener('click', () => (this.phase === 'review' ? this.continueAfterMiss() : this.submit()));
    el.toolGcfBtn.addEventListener('click', () => this.chooseTool('gcf'));
    el.toolLcmBtn.addEventListener('click', () => this.chooseTool('lcm'));
    el.sectorClearContinueBtn.addEventListener('click', () => this.continueAfterSector());
    el.debriefRetryBtn.addEventListener('click', () => this.retryLine());
    el.debriefRestartBtn.addEventListener('click', () => this.newShift());

    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'HUB_INIT' && typeof e.data.payload?.isMuted === 'boolean') {
        soundEngine.setMuted(e.data.payload.isMuted);
        el.audioIcon.textContent = e.data.payload.isMuted ? '🔇' : '🔊';
      }
    });
    // Tell the Expression Town hub we're loaded so it replies with HUB_INIT (mute setting)
    try { if (window.parent !== window) window.parent.postMessage({ type: 'CARTRIDGE_READY' }, '*'); } catch (e) { /* not embedded */ }
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (this.problem && this.phase === 'input' && !this.locked) this.renderStage();
      }, 150);
    });
  }

  toggleMute() {
    const muted = soundEngine.toggleMuted();
    this.el.audioIcon.textContent = muted ? '🔇' : '🔊';
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
        if (this.el.debriefRetryBtn.classList.contains('hidden')) this.newShift();
        else this.retryLine();
      }
      return;
    }
    if (k.toLowerCase() === 'm') { this.toggleMute(); return; }
    if (k === ' ' || k === 'Enter') e.preventDefault(); // never re-click a focused button
    if (this.locked || !this.problem) return;

    if (this.phase === 'review') {
      if (k === 'Enter' || k === ' ') this.continueAfterMiss();
      return;
    }
    const p = this.problem;
    if (k.toLowerCase() === 'h') { this.showHint(); return; }
    if (CHOICE_MODES.includes(p.mode)) {
      if (k >= '1' && k <= '4') this.pickChoice(Number(k) - 1);
      return;
    }
    if (p.mode === 'tool' && !this.toolChosen) {
      if (k.toLowerCase() === 'g') this.chooseTool('gcf');
      else if (k.toLowerCase() === 'l') this.chooseTool('lcm');
      return;
    }
    if (k >= '0' && k <= '9') this.typeDigit(k);
    else if (k === 'Backspace') this.backspace();
    else if (k === 'Escape' || k === 'Delete') this.clearInput();
    else if (k === 'Enter') this.submit();
  }

  // ------------------------------------------------------------------
  // Modals & flow
  // ------------------------------------------------------------------
  startFromBriefing(practice) {
    soundEngine.playChargeUp();
    const switching = this.started && practice !== this.isPractice;
    this.setPracticeMode(practice);
    if (switching) {
      // Switching between practice and the real shift restarts cleanly.
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
    [el.stakesTimer, el.stakesOverload, el.stakesCells].forEach((b) => b.classList.toggle('hidden', practice));
    this.updateHud();
  }

  openModal(name) {
    soundEngine.playClick();
    this.modal = name;
    if (name === 'briefing') {
      this.el.briefingStartLabel.textContent = this.started && !this.isPractice ? '⚡ Resume Shift (Enter)' : '⚡ Power Up (Enter)';
      this.el.modalBriefing.classList.remove('hidden');
    }
    if (name === 'guide') this.el.modalFieldGuide.classList.remove('hidden');
    this.pauseTimer();
  }

  closeModal() {
    this.el.modalBriefing.classList.add('hidden');
    this.el.modalFieldGuide.classList.add('hidden');
    this.modal = 'play';
    this.resumeTimer();
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
    this.overload = 0;
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

  timeLimitFor(p) {
    return this.sector.timeLimit + (EXTRA_TIME[p.mode] || 0);
  }

  loadProblem() {
    cancelAnimationFrame(this.raceRaf);
    clearTimeout(this.advanceTimer);
    const p = this.queue[this.waveIndex];
    this.problem = p;
    this.hintUsed = false;
    this.locked = false;
    this.phase = 'input';
    this.input = '';
    this.toolChosen = p.mode === 'tool' ? null : true;
    this.timeRemaining = this.timeLimitFor(p);

    const info = MODE_INFO[p.mode];
    this.el.modeIcon.textContent = info.icon;
    this.el.modeLabel.textContent = info.label;
    this.el.followupTag.classList.toggle('hidden', !p.isFollowUp);
    this.el.promptText.textContent = p.prompt;
    this.el.hintStrip.classList.add('hidden');
    this.el.hintBtn.disabled = false;
    this.el.hintBtn.classList.remove('opacity-40');

    this.layoutConsole();
    this.renderStage();
    this.updateInputDisplay();
    this.renderPips();
    this.setFeedback('info', p.isFollowUp ? 'Follow-up job' : 'New job', this.jobIntro(p));
    soundEngine.playTick();

    this.updateTimerDisplay();
    if (this.modal === 'play') this.resumeTimer();
  }

  /** Which console controls are visible for the current problem/step. */
  layoutConsole() {
    const p = this.problem;
    const el = this.el;
    const choosingTool = p.mode === 'tool' && !this.toolChosen;
    const isChoice = CHOICE_MODES.includes(p.mode);
    const typing = !isChoice && !choosingTool;

    el.numberPanel.classList.toggle('hidden', !typing);
    el.keypad.classList.toggle('hidden', !typing);
    el.toolPanel.classList.toggle('hidden', !choosingTool);
    el.choicePanel.classList.toggle('hidden', !isChoice);
    el.fireBtn.classList.toggle('hidden', !typing);
    el.fireBtn.disabled = false;
    this.setFireLabel();

    const copy = {
      sync: ['Breaker position', 'Type digits or click the track · Enter = Fire'],
      sync3: ['Breaker position', 'Type digits or click the track · Enter = Fire'],
      supply: ['How many of each?', 'Type to preview the packs · Enter = Buy'],
      scan: ['Pick the real breaker', 'Press 1–4 or click'],
      reverse: ['Pick Beta\'s speed', 'Press 1–4 or click'],
      tool: choosingTool ? ['Which tool fits?', 'Press G or L'] : [this.toolChosen === 'gcf' ? 'Your GCF' : 'Your LCM', 'Type digits · Enter = Fire'],
    }[p.mode];
    el.consoleLabel.textContent = copy[0];
    el.consoleKeys.textContent = copy[1];
    if (isChoice) this.renderChoices();
  }

  setFireLabel() {
    const p = this.problem;
    if (this.phase === 'review') {
      this.el.fireBtn.textContent = 'Next job ➜ (Enter)';
      return;
    }
    this.el.fireBtn.textContent = p.mode === 'supply' ? '🛒 Buy (Enter)' : '⚡ Fire (Enter)';
  }

  jobIntro(p) {
    if (p.isFollowUp) return 'Same kind of trap as the last one, with new numbers. Show you\'ve got it now.';
    return {
      sync: 'Pulses start at 0 and hop together. Where is the FIRST block both land on?',
      sync3: 'Watch out: two pulses can meet early. The breaker goes where ALL THREE land.',
      supply: 'Type a number to see the packs. You can\'t buy part of a pack, and you want the FEWEST.',
      scan: 'Some breakers are traps: the product, the GCF, a later match. Only one is the LEAST common multiple.',
      tool: 'Read carefully. Is this a GCF job or an LCM job?',
      reverse: 'Each choice for Beta collides with Alpha somewhere. Only one collides FIRST at the marked block.',
    }[p.mode];
  }

  // ------------------------------------------------------------------
  // Timer
  // ------------------------------------------------------------------
  pauseTimer() {
    clearInterval(this.timerHandle);
    this.timerHandle = null;
  }

  resumeTimer() {
    this.pauseTimer();
    if (this.isPractice || !this.started || this.modal !== 'play') return;
    this.timerHandle = setInterval(() => this.tick(), 1000);
  }

  tick() {
    if (this.locked || this.modal !== 'play' || this.phase !== 'input') return;
    this.timeRemaining--;
    this.updateTimerDisplay();
    if (this.timeRemaining <= 5 && this.timeRemaining > 0) soundEngine.playTick();
    if (this.timeRemaining <= 0) this.onTimeout();
  }

  updateTimerDisplay() {
    if (!this.problem) return;
    const max = this.timeLimitFor(this.problem);
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
    this.pauseTimer();
    const p = this.problem;
    soundEngine.playAlarm();
    const result = { code: 'TIMEOUT', given: '(time ran out)', message: `${this.answerText(p)} ${this.explain(p)}` };
    if (p.mode === 'sync' || p.mode === 'sync3') {
      this.runRace({ nums: p.nums, end: p.answer, breaker: null }, () => this.onMiss(p, result, TIMEOUT_OVERLOAD));
    } else if (p.mode === 'reverse') {
      this.setLaneLabel(1, `every ${p.answer}`);
      this.runRace({ nums: [p.nums[0], p.answer], end: p.target, breaker: null }, () => this.onMiss(p, result, TIMEOUT_OVERLOAD));
    } else {
      this.revealAnswer(p, null);
      this.onMiss(p, result, TIMEOUT_OVERLOAD);
    }
  }

  // ------------------------------------------------------------------
  // Input
  // ------------------------------------------------------------------
  canType() {
    const p = this.problem;
    return !this.locked && p && this.phase === 'input' && !CHOICE_MODES.includes(p.mode) && this.toolChosen;
  }

  typeDigit(d) {
    if (!this.canType()) return;
    if (this.input.length >= 3) return;
    soundEngine.playKey();
    this.input = this.input === '0' ? d : this.input + d;
    this.updateInputDisplay();
  }

  backspace() {
    if (!this.canType()) return;
    soundEngine.playClick();
    this.input = this.input.slice(0, -1);
    this.updateInputDisplay();
  }

  clearInput() {
    if (!this.canType()) return;
    this.input = '';
    this.updateInputDisplay();
  }

  setInput(value) {
    if (!this.canType()) return;
    soundEngine.playKey();
    this.input = String(value);
    this.updateInputDisplay();
  }

  updateInputDisplay() {
    const p = this.problem;
    if (!p) return;
    this.el.answerDisplay.textContent = this.input || '_';
    if (p.mode === 'sync' || p.mode === 'sync3') this.drawBreaker(this.input ? Number(this.input) : null);
    if (p.mode === 'supply') this.renderSupplyPreview(this.input);
    const core = document.getElementById('core-value');
    if (core && p.mode === 'tool' && this.toolChosen) core.textContent = this.input || '?';
  }

  showHint() {
    if (this.locked || !this.problem || this.hintUsed || this.phase !== 'input') return;
    soundEngine.playClick();
    this.hintUsed = true;
    this.sectorStats.hints++;
    this.el.hintText.textContent = this.problem.hint;
    this.el.hintStrip.classList.remove('hidden');
    this.el.hintBtn.disabled = true;
    this.el.hintBtn.classList.add('opacity-40');
    const p = this.problem;
    if ((p.mode === 'sync' || p.mode === 'sync3') && this.trk) {
      // Light up the landing spots of the biggest number only.
      const lane = p.nums.indexOf(Math.max(...p.nums));
      this.drawLaneDots(lane, true);
    }
  }

  // ------------------------------------------------------------------
  // Answer checking
  // ------------------------------------------------------------------
  submit() {
    if (!this.canType() || this.modal !== 'play') return;
    const p = this.problem;
    if (!this.input) {
      this.setFeedback('warn', 'Nothing entered', p.mode === 'supply' ? 'Type how many of each item to buy.' : 'Type a number first (or click the track).');
      return;
    }
    const given = this.input;
    this.locked = true;
    this.pauseTimer();

    if (p.mode === 'tool') {
      const r = p.tool === 'gcf' ? diagnoseGCFAnswer(given, p.nums) : diagnoseLCMAnswer(given, p.nums);
      if (r.isCorrect) { this.revealAnswer(p, null); this.onCorrect(p); }
      else { this.revealAnswer(p, Number(given)); this.onMiss(p, { code: r.code, given, message: r.message }); }
      return;
    }

    const r = diagnoseLCMAnswer(given, p.nums);
    const result = { code: r.code, given, message: r.message };
    if (p.mode === 'supply') {
      result.message = r.isCorrect ? r.message : this.supplyMissMessage(p, Number(given), r);
      this.renderSupplyPreview(given, r.isCorrect ? 'solved' : 'miss');
      if (r.isCorrect) this.onCorrect(p);
      else this.onMiss(p, result);
      return;
    }

    // sync / sync3: lock the breaker in and race the pulses to the first collision.
    soundEngine.playBreakerLock();
    const n = Number(given);
    this.runRace({ nums: p.nums, end: p.answer, breaker: n }, () => {
      if (r.isCorrect) this.onCorrect(p);
      else {
        if (n > p.answer) {
          result.message = `The pulses collided at ${p.answer} before they ever reached your breaker at ${n}. ${r.message}`;
        }
        this.onMiss(p, result);
      }
    });
  }

  chooseTool(tool) {
    const p = this.problem;
    if (this.locked || !p || p.mode !== 'tool' || this.toolChosen || this.phase !== 'input') return;
    soundEngine.playClick();
    if (tool === p.tool) {
      this.toolChosen = tool;
      this.layoutConsole();
      this.renderStage();
      this.updateInputDisplay();
      this.setFeedback('success', `${tool.toUpperCase()} it is`, `Right tool! Now find ${tool.toUpperCase()}(${p.nums.join(', ')}).`);
      return;
    }
    this.locked = true;
    this.pauseTimer();
    const why = p.tool === 'gcf'
      ? 'This job SPLITS things into the most equal groups (or the largest equal pieces). That\'s the GCF, and the answer can\'t be bigger than the numbers.'
      : 'This job asks when things line up AGAIN (or the fewest to match). That\'s the LCM, and the answer is at least as big as the numbers.';
    this.revealAnswer(p, null);
    this.onMiss(p, { code: 'TOOL_MIXUP', given: tool.toUpperCase(), message: `${why} ${this.answerText(p)}` });
  }

  pickChoice(i) {
    const p = this.problem;
    if (this.locked || !p || !CHOICE_MODES.includes(p.mode) || this.phase !== 'input') return;
    const choice = p.choices[i];
    if (choice === undefined) return;
    this.locked = true;
    this.pauseTimer();
    soundEngine.playClick();
    const buttons = [...this.el.choicePanel.children];

    const mark = () => {
      buttons.forEach((b, j) => {
        b.disabled = true;
        b.classList.remove('cursor-pointer', 'hover:bg-cyan-950/40');
        if (p.choices[j] === p.answer) b.className += ' !border-emerald-400 !bg-emerald-900/60 glow-emerald';
        else if (j === i) b.className += ' !border-rose-500 !bg-rose-950/60';
        else b.classList.add('opacity-40');
      });
    };

    if (p.mode === 'scan') {
      const r = diagnoseLCMAnswer(choice, p.nums);
      mark();
      this.revealAnswer(p, choice);
      if (r.isCorrect) this.onCorrect(p);
      else this.onMiss(p, { code: r.code, given: String(choice), message: r.message });
      return;
    }

    // reverse: race Alpha against the chosen Beta and see where they really meet.
    const a = p.nums[0];
    const r = evaluateReverse(choice, a, p.target);
    const end = Math.min(r.meet, this.trk ? this.trk.R : r.meet);
    this.setLaneLabel(1, `every ${choice}`);
    this.runRace({ nums: [a, choice], end, breaker: p.target }, () => {
      mark();
      if (r.isCorrect) { this.onCorrect(p); return; }
      const msg = r.code === 'MEETS_EARLY'
        ? `With Beta = ${choice}, LCM(${a}, ${choice}) = ${r.meet}, so the pulses collide at ${r.meet}, BEFORE ${p.target}. ${this.explain(p)}`
        : `With Beta = ${choice}, LCM(${a}, ${choice}) = ${r.meet}, so they don't meet until ${r.meet}, AFTER ${p.target}. ${this.explain(p)}`;
      this.onMiss(p, { code: r.code, given: String(choice), message: msg });
    });
  }

  supplyMissMessage(p, n, diag) {
    const [a, b] = p.nums;
    const s = evaluateSupply(n, a, b);
    const { items } = p;
    if (s.clean) {
      return `${n} works (${s.packsA} packs of ${items.a}, ${s.packsB} packs of ${items.b}), but it's not the FEWEST. ${p.answer} also works: ${p.answer / a} packs of ${a} and ${p.answer / b} packs of ${b}.`;
    }
    const bad = [];
    if (!s.cleanA) bad.push(`${n} ${items.a} would need ${s.packsA} packs + ${s.remA} more (part of a pack)`);
    if (!s.cleanB) bad.push(`${n} ${items.b} would need ${s.packsB} packs + ${s.remB} more (part of a pack)`);
    const tail = diag.code === 'GCF_MIXUP' ? ' That number is the GCF; buying needs a MULTIPLE.' : '';
    return `${bad.join('; ')}.${tail} The fewest is ${p.answer}: ${p.answer / a} packs of ${a} and ${p.answer / b} packs of ${b}.`;
  }

  onCorrect(p) {
    this.locked = true;
    this.pauseTimer();
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
    this.updateHud();

    soundEngine.playCatch();
    this.floatText(`+${gained} MW`, this.el.answerDisplay.offsetParent ? this.el.answerDisplay : this.el.choicePanel.offsetParent ? this.el.choicePanel : this.el.stageVisual, '#fde047');
    this.burstAt(document.getElementById('core-card') || this.el.stageVisual, '#22d3ee', 34);
    const stampText = this.sector.isBossSector ? 'COIL DOWN!' : { supply: 'STOCKED!', tool: 'NAILED IT!', scan: 'FOUND IT!', reverse: 'MATCHED!' }[p.mode] || 'SYNCED!';
    this.stamp(stampText);

    let title = firstTry ? 'Perfect sync!' : 'Got it!';
    if (this.combo >= 3 && firstTry) title += ` Combo x${this.combo}`;
    this.setFeedback('success', title, this.explain(p));

    if (this.sector.isBossSector) {
      this.bossHp--;
      setTimeout(() => soundEngine.playBossHit(), 150);
      this.animateBoss('boss-hit');
      this.shake();
      this.renderBoss();
    }
    this.advanceTimer = setTimeout(() => this.nextWave(), 1900);
  }

  onMiss(p, result, overloadAmount = this.sector.overloadPerMiss) {
    this.locked = true;
    this.pauseTimer();
    this.shake();
    soundEngine.playFault();

    this.recordMiss(p, result.code, result.given);
    this.recordCompleted(p, false);
    this.combo = 1;

    this.setFeedback('error', MISS_TITLES[result.code] || 'Short circuit!', result.message);

    // A targeted follow-up with new numbers (not in the boss fight: the boss just keeps coming).
    if (!this.sector.isBossSector && this.sectorStats.followups < MAX_FOLLOWUPS_PER_SECTOR) {
      const fu = makeFollowUp(p, result.code, this.rng, this.sector.numbers);
      if (fu) {
        fu.isFollowUp = true;
        this.queue.splice(this.waveIndex + 1, 0, fu);
        this.sectorStats.followups++;
      }
    }
    this.renderPips();

    if (this.sector.isBossSector) {
      this.animateBoss('boss-zap');
      this.el.bossTaunt.textContent = '"HA! Wrong frequency!"';
    }
    this.updateHud();

    this.phase = 'review';
    this.el.keypad.classList.add('hidden');
    this.el.toolPanel.classList.add('hidden');
    this.el.fireBtn.classList.remove('hidden');
    this.setFireLabel();
    this.addOverload(overloadAmount, () => { this.locked = false; });
  }

  continueAfterMiss() {
    if (this.phase !== 'review' || this.locked) return;
    soundEngine.playClick();
    this.nextWave();
  }

  /** Overload goes up; at 100 a backup cell fires (or it's a blackout). `then` runs if play continues. */
  addOverload(amount, then) {
    if (this.isPractice) { then?.(); return; }
    this.overload = Math.min(100, this.overload + amount);
    this.updateHud();
    if (this.overload < 100) { then?.(); return; }

    this.locked = true;
    if (this.cells > 0) {
      this.cells--;
      setTimeout(() => {
        soundEngine.playChargeUp();
        this.el.cellText.textContent = `Overload reset. ${plural(this.cells, 'backup cell')} left.`;
        this.el.cellOverlay.classList.remove('hidden');
        this.overload = 0;
        this.updateHud();
        setTimeout(() => {
          this.el.cellOverlay.classList.add('hidden');
          then?.();
        }, 1400);
      }, 900);
    } else {
      soundEngine.playPowerDown();
      setTimeout(() => this.finishRun(false), 1300);
    }
  }

  recordMiss(p, code, given) {
    p.missed = true;
    this.sectorStats.misses++;
    if (this.mistakes.length < 12) {
      const q = p.mode === 'supply' ? `packs of ${p.nums.join(' & ')}, fewest`
        : p.mode === 'tool' ? `${p.tool.toUpperCase()}(${p.nums.join(', ')}) word problem`
        : p.mode === 'reverse' ? `Alpha ${p.nums[0]}, meet at ${p.target}: Beta?`
        : `LCM(${p.nums.join(', ')})`;
      this.mistakes.push(`${MODE_INFO[p.mode].icon} ${q}: you said ${given} → ${p.answer}`);
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
    if (p.mode === 'tool') return `${p.tool.toUpperCase()}(${p.nums.join(', ')}) = ${p.answer}.`;
    if (p.mode === 'reverse') return `Beta = ${p.answer}.`;
    return `LCM(${p.nums.join(', ')}) = ${p.answer}.`;
  }

  explain(p) {
    const L = p.answer;
    const lcmWhy = (nums, target) => {
      const parts = nums.map((n) => `${n} × ${target / n}`).join(' = ');
      const max = Math.max(...nums);
      if (target === max) return `${target} = ${parts}. ${max} is already a multiple of ${nums.filter((n) => n !== max).join(' and ')}, so it's the LCM.`;
      return `${target} = ${parts}. No smaller number is a multiple of ${nums.length === 2 ? 'both' : 'all three'}.`;
    };
    switch (p.mode) {
      case 'supply': {
        const [a, b] = p.nums;
        return `Buy ${L} of each: ${L / a} packs of ${a} ${p.items.aIcon} and ${L / b} packs of ${b} ${p.items.bIcon}. LCM(${a}, ${b}) = ${L}.`;
      }
      case 'tool': {
        if (p.tool === 'gcf') {
          const g = L;
          return `${p.nums.map((n) => `${n} = ${g} × ${n / g}`).join(', ')}, and ${p.nums.map((n) => n / g).join(' and ')} share nothing but 1. GCF = ${g}.`;
        }
        return lcmWhy(p.nums, L);
      }
      case 'reverse': {
        const a = p.nums[0];
        return `LCM(${a}, ${p.answer}) = ${p.target}: ${a} × ${p.target / a} = ${p.answer} × ${p.target / p.answer} = ${p.target}.`;
      }
      default:
        return lcmWhy(p.nums, L);
    }
  }

  nextWave() {
    if (this.sector.isBossSector && this.bossHp <= 0) {
      this.sectorCleared();
      return;
    }
    this.waveIndex++;
    if (this.sector.isBossSector && this.waveIndex >= this.queue.length) {
      // The Overlord keeps coming until its coils are gone.
      const modes = this.sector.modes;
      this.queue.push(makeProblem(modes[Math.floor(this.rng() * modes.length)], this.rng, this.sector.numbers));
    }
    if (this.waveIndex < this.queue.length) this.loadProblem();
    else this.sectorCleared();
  }

  sectorCleared() {
    this.pauseTimer();
    this.locked = true;
    const { misses, hints } = this.sectorStats;
    const stars = misses === 0 && hints === 0 ? 3 : misses <= 2 ? 2 : 1;
    this.starsBySector[this.sectorIndex] = Math.max(this.starsBySector[this.sectorIndex] || 0, stars);

    if (this.sector.isBossSector) {
      this.finishRun(true);
      return;
    }
    soundEngine.playVictory();
    this.burstAt(this.el.stageVisual, '#10b981', 60);
    const next = CURRICULUM_SECTORS[this.sectorIndex + 1];
    this.el.sectorClearTitle.textContent = this.sector.name;
    this.el.sectorClearStars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    this.el.sectorClearStats.textContent = `${misses} ${misses === 1 ? 'miss' : 'misses'} · ${plural(hints, 'hint')} · 3★ = no misses, no hints`;
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

  retryLine() {
    soundEngine.playClick();
    this.el.modalDebrief.classList.add('hidden');
    this.cells = BACKUP_CELLS;
    this.run[this.sectorIndex] = buildSector(this.sectorIndex, Date.now());
    this.modal = 'play';
    this.loadSector(this.sectorIndex);
  }

  newShift() {
    soundEngine.playClick();
    this.el.modalDebrief.classList.add('hidden');
    this.resetRunState();
    this.started = false;
    this.loadSector(0);
    this.openModal('briefing');
  }

  finishRun(victory) {
    this.pauseTimer();
    cancelAnimationFrame(this.raceRaf);
    this.locked = true;
    this.modal = 'debrief';
    const el = this.el;
    const secs = Math.round((Date.now() - this.runStartedAt) / 1000);

    el.debriefRetryBtn.classList.toggle('hidden', victory);
    el.debriefRestartBtn.classList.toggle('col-span-2', victory);
    el.debriefRestartBtn.textContent = victory ? '🔋 New Shift (Enter)' : 'New Shift';

    if (victory) {
      soundEngine.playVictory();
      this.burstAt(el.stageVisual, '#22d3ee', 90);
      el.debriefIcon.textContent = this.isPractice ? '🧪' : '🏆';
      el.debriefTitle.textContent = this.isPractice ? 'Practice shift complete!' : 'The grid is back online!';
      el.debriefSubtitle.textContent = this.isPractice
        ? 'Nice work! Practice runs don\'t unlock anything. Start a real shift when you\'re ready.'
        : 'The Dynamo Overlord is powered down and every line is in sync.';
      if (!this.isPractice && !this.reported) {
        this.reported = true;
        try {
          window.parent.postMessage({
            type: 'CARTRIDGE_COMPLETE',
            payload: {
              lessonId: LESSON_ID,
              // score = jobs solved on the first try; total = jobs played
              score: this.firstTryCorrect,
              total: this.completedProblems,
              bossDefeated: true,
            },
          }, '*');
        } catch (e) { /* not embedded */ }
      }
    } else {
      el.debriefIcon.textContent = '🌑';
      el.debriefTitle.textContent = 'Blackout!';
      el.debriefSubtitle.textContent = `The grid overloaded on ${this.sector.name} with no backup cells left. Check the Guide, then retry this line with 3 fresh cells.`;
    }

    const starTotal = this.starsBySector.reduce((a, b) => a + (b || 0), 0);
    el.debriefStars.textContent = `★ ${starTotal} / ${CURRICULUM_SECTORS.length * 3} line stars`;
    el.debriefScore.textContent = `${this.score.toLocaleString()} MW`;
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
      : '<p class="text-emerald-300">No mistakes. Flawless shift!</p>';

    el.modalDebrief.classList.remove('hidden');
  }

  // ------------------------------------------------------------------
  // Rendering: HUD
  // ------------------------------------------------------------------
  updateHud() {
    const el = this.el;
    el.scoreDisplay.textContent = `${this.score.toLocaleString()} MW`;
    el.comboDisplay.textContent = `x${this.combo}`;
    el.comboFlame.textContent = this.combo >= 4 ? '🔥' : '⚡';
    el.comboFlame.classList.toggle('combo-hot', this.combo >= 3);
    el.comboBox.classList.toggle('glow-amber', this.combo >= 4);

    el.overloadBar.style.width = `${this.overload}%`;
    el.overloadDisplay.textContent = `${this.overload}%`;
    const c = this.overload >= 75 ? ['bg-rose-500', 'text-rose-400'] : this.overload >= 40 ? ['bg-amber-500', 'text-amber-300'] : ['bg-emerald-500', 'text-emerald-400'];
    el.overloadBar.className = `h-full ${c[0]} rounded-full transition-all duration-300`;
    el.overloadDisplay.className = `text-xs w-9 font-mono-math font-bold ${c[1]} ${this.overload >= 75 ? 'animate-urgent' : ''}`;
    el.overloadVignette.style.opacity = this.isPractice || this.overload < 40 ? 0 : ((this.overload - 30) / 70) * 0.55;
    el.cellsDisplay.textContent = '🔋'.repeat(this.cells) + '🪫'.repeat(BACKUP_CELLS - this.cells);
  }

  renderPips() {
    this.el.wavePips.innerHTML = this.queue.map((p, i) => {
      let cls = 'bg-slate-800 border-slate-700';
      if (i < this.waveIndex || (i === this.waveIndex && p.counted)) cls = p.missed ? 'bg-rose-500 border-rose-300' : 'bg-emerald-500 border-emerald-300';
      else if (i === this.waveIndex) cls = 'bg-cyan-300 border-white animate-urgent';
      if (p.isFollowUp && i >= this.waveIndex) cls += ' ring-2 ring-indigo-400';
      return `<span title="${MODE_INFO[p.mode].label}" class="w-3 h-3 rounded-full border ${cls}"></span>`;
    }).join('');
  }

  renderBoss() {
    const max = this.sector.bossHp;
    this.el.bossHpCoils.innerHTML = Array.from({ length: max }, (_, i) =>
      `<span class="flex-1 h-3 rounded ${i < this.bossHp ? 'bg-gradient-to-b from-fuchsia-400 to-fuchsia-700 border border-fuchsia-300' : 'bg-slate-800 border border-slate-700'}"></span>`
    ).join('');
    this.el.bossHpText.textContent = `${Math.max(0, this.bossHp)} / ${max} coils`;
    this.el.bossTaunt.textContent = BOSS_TAUNTS[Math.min(BOSS_TAUNTS.length - 1, max - this.bossHp)];
    this.el.bossSprite.textContent = this.bossHp <= 0 ? '💥' : this.bossHp <= 2 ? '🪫' : '🤖';
  }

  animateBoss(cls) {
    const s = this.el.bossSprite;
    s.classList.remove('boss-hit', 'boss-zap');
    void s.offsetWidth;
    s.classList.add(cls);
  }

  setFeedback(type, title, text) {
    const styles = {
      info: ['🔌', 'border-slate-700 bg-slate-900/70', 'text-slate-300'],
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
    this.trk = null;
    switch (p.mode) {
      case 'sync':
      case 'sync3':
        this.buildTrack({
          nums: p.nums,
          R: this.trackRange(p.answer, p.nums),
          story: p.story,
        });
        this.drawBreaker(this.input ? Number(this.input) : null);
        return;
      case 'reverse': {
        const R = this.trackRange(p.target, [p.nums[0]]);
        this.buildTrack({ nums: [p.nums[0], 0], R, hiddenLanes: [1], marker: p.target });
        this.drawLaneDots(0, false);
        return;
      }
      case 'supply':
        v.innerHTML = this.supplyHtml(p);
        this.renderSupplyPreview(this.input);
        return;
      default:
        v.innerHTML = this.cardsHtml(p);
    }
  }

  /** Track length: the answer sits somewhere in the middle-to-right, never at the very end. */
  trackRange(target, nums) {
    if (!rangeCache.has(this.problem)) {
      const approx = target * (1.35 + this.rng() * 0.55);
      const step = niceStep(approx);
      let R = Math.ceil(approx / step) * step;
      if (R - target < Math.max(...nums)) R += step;
      rangeCache.set(this.problem, R);
    }
    return rangeCache.get(this.problem);
  }

  /** Numbers as big cards + an LCM core (scan / tool). */
  cardsHtml(p) {
    const colors = ['cyan', 'amber', 'fuchsia'];
    const label = p.mode === 'tool' ? (this.toolChosen ? this.toolChosen.toUpperCase() : 'GCF or LCM?') : 'LCM';
    const card = (n, i) => `
      <div class="flex flex-col items-center gap-2 pop-in" style="animation-delay:${i * 80}ms">
        <div class="w-36 h-36 rounded-3xl bg-gradient-to-b from-slate-800 to-slate-950 border-2 border-${colors[i]}-400/70 flex flex-col items-center justify-center shadow-2xl">
          ${p.mode === 'tool' ? '' : `<span class="text-[10px] font-black uppercase tracking-widest text-${colors[i]}-400">${LANE_NAMES[i]}</span>`}
          <span class="font-mono-math font-black text-6xl text-${colors[i]}-200">${n}</span>
        </div>
      </div>`;
    return `
      <div class="w-full h-full flex flex-col items-center justify-center gap-4">
        <div class="flex items-center justify-center gap-6">
          ${p.nums.map(card).join('')}
          <div id="core-card" class="flex flex-col items-center gap-1 px-5 py-3 rounded-2xl border-2 border-cyan-500/60 bg-cyan-950/30 min-w-[130px] pop-in">
            <span class="text-[10px] font-black uppercase tracking-widest text-cyan-400">${label}</span>
            <span id="core-value" class="font-mono-math font-black text-4xl text-cyan-100">?</span>
          </div>
        </div>
        <div id="reveal-area" class="w-full"></div>
      </div>`;
  }

  /** After a scan/tool answer (or a timeout), lay out the lists so the answer is visible. */
  revealAnswer(p, wrongPick) {
    const core = document.getElementById('core-value');
    const card = document.getElementById('core-card');
    if (core) core.textContent = p.answer;
    if (card) card.className = 'flex flex-col items-center gap-1 px-5 py-3 rounded-2xl border-2 border-emerald-400 bg-emerald-950/50 min-w-[130px] glow-emerald';
    const area = document.getElementById('reveal-area');
    if (p.mode === 'supply') { this.renderSupplyPreview(String(p.answer), 'solved'); return; }
    if (!area) return;
    area.innerHTML = p.mode === 'tool' && p.tool === 'gcf' ? this.factorTableHtml(p.nums, p.answer) : this.multiplesTableHtml(p.nums, p.answer, wrongPick);
  }

  multiplesTableHtml(nums, L, wrongPick) {
    const extra = wrongPick && wrongPick > L && wrongPick <= 3 * L && nums.every((n) => wrongPick % n === 0) ? wrongPick : L;
    const colors = ['text-cyan-300', 'text-amber-300', 'text-fuchsia-300'];
    const row = (n, i) => {
      let list = getMultiples(n, extra);
      let cells = list.map((m) => {
        if (m === L) return `<span class="px-1.5 rounded bg-emerald-500 text-slate-950 font-black">${m}</span>`;
        if (m === wrongPick) return `<span class="px-1.5 rounded border border-rose-400 text-rose-300">${m}</span>`;
        if (nums.every((x) => m % x === 0)) return `<span class="text-slate-400">${m}</span>`;
        return `<span>${m}</span>`;
      });
      if (cells.length > 13) cells = [...cells.slice(0, 5), '<span class="text-slate-500">…</span>', ...cells.slice(-6)];
      return `<div class="flex items-center gap-2"><span class="w-14 shrink-0 text-right font-black ${colors[i]}">${n}:</span><div class="flex flex-wrap gap-1.5 text-slate-200">${cells.join('<span class="text-slate-600">,</span>')}</div></div>`;
    };
    return `<div class="pop-in mx-auto max-w-2xl bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-3 font-mono-math text-sm space-y-1.5">
      <div class="text-[10px] font-black uppercase tracking-widest text-slate-500 font-sans">Multiples: first match = LCM</div>
      ${nums.map(row).join('')}</div>`;
  }

  factorTableHtml(nums, G) {
    const factors = (n) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);
    const colors = ['text-cyan-300', 'text-amber-300'];
    const row = (n, i) => {
      const cells = factors(n).map((f) => {
        if (f === G) return `<span class="px-1.5 rounded bg-emerald-500 text-slate-950 font-black">${f}</span>`;
        if (nums.every((x) => x % f === 0)) return `<span class="text-amber-200">${f}</span>`;
        return `<span class="text-slate-400">${f}</span>`;
      });
      return `<div class="flex items-center gap-2"><span class="w-14 shrink-0 text-right font-black ${colors[i] || 'text-slate-300'}">${n}:</span><div class="flex flex-wrap gap-1.5">${cells.join('<span class="text-slate-600">,</span>')}</div></div>`;
    };
    return `<div class="pop-in mx-auto max-w-2xl bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-3 font-mono-math text-sm space-y-1.5">
      <div class="text-[10px] font-black uppercase tracking-widest text-slate-500 font-sans">Factors: biggest match = GCF</div>
      ${nums.map(row).join('')}</div>`;
  }

  renderChoices() {
    const p = this.problem;
    this.el.choicePanel.innerHTML = p.choices.map((c, i) => `
      <button type="button" class="key-btn h-24 rounded-2xl border-2 border-cyan-600/50 bg-slate-900 hover:bg-cyan-950/40 flex flex-col items-center justify-center gap-0.5 cursor-pointer">
        <span class="text-[10px] font-black text-slate-500">[${i + 1}]</span>
        <span class="text-[10px] font-black uppercase text-slate-400">${p.mode === 'reverse' ? 'Beta every' : 'Breaker'}</span>
        <span class="font-mono-math font-black text-3xl text-cyan-100">${c}</span>
      </button>`).join('');
    [...this.el.choicePanel.children].forEach((b, i) => b.addEventListener('click', () => this.pickChoice(i)));
  }

  // ---------------- Supply Run ----------------
  supplyHtml(p) {
    const [a, b] = p.nums;
    const row = (key, n, name, icon, color) => `
      <div class="rounded-2xl border border-${color}-700/50 bg-${color}-950/20 p-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-black uppercase text-${color}-300">${icon} ${name}</span>
          <span class="text-xs font-bold text-slate-400">packs of <b class="font-mono-math text-${color}-200 text-base">${n}</b></span>
        </div>
        <div id="supply-${key}" class="mt-2 min-h-[64px] flex flex-wrap gap-1.5 items-center"></div>
        <div id="supply-${key}-status" class="mt-1 text-xs font-bold font-mono-math"></div>
      </div>`;
    return `
      <div class="w-full h-full flex flex-col justify-center gap-3">
        ${row('a', a, p.items.a, p.items.aIcon, 'cyan')}
        ${row('b', b, p.items.b, p.items.bIcon, 'amber')}
        <div id="supply-summary" class="text-sm font-bold text-center"></div>
      </div>`;
  }

  renderSupplyPreview(raw, state = 'live') {
    const p = this.problem;
    const boxA = document.getElementById('supply-a');
    if (!boxA || p.mode !== 'supply') return;
    const [a, b] = p.nums;
    const s = evaluateSupply(raw, a, b);
    const summary = document.getElementById('supply-summary');
    const fill = (key, size, packs, rem, icon, color) => {
      const box = document.getElementById(`supply-${key}`);
      const status = document.getElementById(`supply-${key}-status`);
      if (!s.total) {
        box.innerHTML = '<span class="text-sm text-slate-500 font-bold">Type a number to stack the packs</span>';
        status.textContent = '';
        return;
      }
      const shown = Math.min(packs, 14);
      const ok = rem === 0;
      const packCls = state === 'solved' ? 'border-emerald-400 bg-emerald-950/60' : `border-${color}-500/60 bg-slate-900`;
      let html = Array.from({ length: shown }, (_, i) => `
        <div class="pop-in flex flex-col items-center justify-center w-12 h-14 rounded-lg border-2 ${packCls}" style="animation-delay:${i * 25}ms">
          <span class="text-base leading-none">${icon}</span><span class="text-[11px] font-mono-math font-black text-slate-200">${size}</span>
        </div>`).join('');
      if (packs > shown) html += `<span class="text-xs font-bold text-slate-400 px-1">+${packs - shown} more</span>`;
      if (!ok) html += `<div class="flex flex-col items-center justify-center w-12 h-14 rounded-lg border-2 border-dashed border-rose-500 bg-rose-950/40"><span class="text-[11px] font-mono-math font-black text-rose-300">+${rem}?</span></div>`;
      box.innerHTML = html;
      status.innerHTML = ok
        ? `<span class="text-emerald-300">${s.total} ÷ ${size} = ${plural(packs, 'pack')} ✓</span>`
        : `<span class="text-rose-300">${s.total} ÷ ${size} = ${packs} R ${rem} ✗ can't buy part of a pack</span>`;
    };
    fill('a', a, s.packsA, s.remA, p.items.aIcon, 'cyan');
    fill('b', b, s.packsB, s.remB, p.items.bIcon, 'amber');
    if (!summary) return;
    if (!s.total) summary.innerHTML = '';
    else if (state === 'solved') summary.innerHTML = `<span class="text-emerald-300">✓ ${s.total} of each, nothing extra. That's the fewest!</span>`;
    else if (state === 'miss') summary.innerHTML = '';
    else if (s.clean) summary.innerHTML = `<span class="text-cyan-300">Both match at ${s.total}. Is it the FEWEST?</span>`;
    else summary.innerHTML = '<span class="text-slate-400">Not a match yet.</span>';
  }

  // ---------------- Pulse track (SVG) ----------------
  buildTrack({ nums, R, story = null, hiddenLanes = [], marker = null }) {
    const v = this.el.stageVisual;
    const W = Math.max(560, v.clientWidth - 8);
    const n = nums.length;
    const H = Math.max(230, Math.min(v.clientHeight - 8, 90 + n * 120));
    const x0 = 158;
    const x1 = W - 26;
    const top = 44;
    const axisY = H - 34;
    const gap = (axisY - top) / n;
    const laneY = nums.map((_, i) => top + gap * (i + 0.72));
    const hopH = Math.min(gap * 0.5, 40);
    const pos = (val) => x0 + (Math.max(0, Math.min(val, R)) / R) * (x1 - x0);
    const unit = story?.unit || '';
    const step = niceStep(R);

    let svg = `<svg id="track-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="select-none" style="cursor: crosshair">`;
    svg += `<defs><filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    // Lanes
    nums.forEach((num, i) => {
      const y = laneY[i];
      const color = LANE_COLORS[i];
      const name = story ? `${story.icons[i]} ${story.lanes[i]}` : `⚡ ${LANE_NAMES[i]}`;
      const every = hiddenLanes.includes(i) ? 'every ?' : `every ${num}${unit ? ` ${unit}` : ''}`;
      svg += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${color}" stroke-opacity="0.25" stroke-width="3" stroke-linecap="round"/>`;
      svg += `<circle cx="${x0}" cy="${y}" r="7" fill="${color}"/>`;
      svg += `<text x="12" y="${y - 4}" fill="${color}" font-family="Inter, sans-serif" font-weight="900" font-size="13">${name}</text>`;
      svg += `<text id="lane-label-${i}" x="12" y="${y + 14}" fill="#cbd5e1" font-family="JetBrains Mono, monospace" font-weight="800" font-size="13">${every}</text>`;
    });
    // Axis
    svg += `<line x1="${x0}" y1="${axisY}" x2="${x1}" y2="${axisY}" stroke="#475569" stroke-width="2"/>`;
    const pxPerUnit = (x1 - x0) / R;
    if (pxPerUnit >= 7) {
      for (let t = 1; t <= R; t++) if (t % step !== 0) svg += `<line x1="${pos(t)}" y1="${axisY}" x2="${pos(t)}" y2="${axisY + 4}" stroke="#334155" stroke-width="1"/>`;
    }
    for (let t = 0; t <= R; t += step) {
      svg += `<line x1="${pos(t)}" y1="${top - 6}" x2="${pos(t)}" y2="${axisY + 7}" stroke="#1e293b" stroke-width="1"/>`;
      svg += `<line x1="${pos(t)}" y1="${axisY}" x2="${pos(t)}" y2="${axisY + 7}" stroke="#64748b" stroke-width="2"/>`;
      svg += `<text x="${pos(t)}" y="${axisY + 22}" fill="#94a3b8" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="700" font-size="12">${t}</text>`;
    }
    if (unit) svg += `<text x="${x1}" y="${axisY - 6}" fill="#64748b" text-anchor="end" font-family="Inter, sans-serif" font-weight="800" font-size="11">${unit}</text>`;
    if (marker !== null) {
      const x = pos(marker);
      svg += `<line x1="${x}" y1="${top - 14}" x2="${x}" y2="${axisY}" stroke="#e879f9" stroke-width="2.5" stroke-dasharray="6 4"/>`;
      svg += `<text x="${x}" y="${top - 20}" fill="#f0abfc" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="900" font-size="13">💥 first collision: ${marker}</text>`;
    }
    svg += '<g id="trk-arcs"></g><g id="trk-hint"></g><g id="trk-breaker"></g><g id="trk-hover"></g><g id="trk-fx"></g><g id="trk-orbs">';
    nums.forEach((_, i) => { svg += `<circle id="orb-${i}" cx="${x0}" cy="${laneY[i]}" r="7" fill="${LANE_COLORS[i]}" filter="url(#glow)" opacity="0"/>`; });
    svg += '</g></svg>';
    v.innerHTML = `<div class="w-full h-full flex items-center justify-center pop-in">${svg}</div>`;

    this.trk = { nums, R, x0, x1, top, axisY, laneY, hopH, pos, unit, svg: document.getElementById('track-svg') };
    const s = this.trk.svg;
    s.addEventListener('mousemove', (e) => this.onTrackHover(e));
    s.addEventListener('mouseleave', () => { const g = document.getElementById('trk-hover'); if (g) g.innerHTML = ''; });
    s.addEventListener('click', (e) => {
      const val = this.trackValueAt(e);
      if (val !== null && (this.problem.mode === 'sync' || this.problem.mode === 'sync3')) this.setInput(val);
    });
  }

  trackValueAt(e) {
    const t = this.trk;
    if (!t) return null;
    const r = t.svg.getBoundingClientRect();
    const x = e.clientX - r.left;
    if (x < t.x0 - 6 || x > t.x1 + 6) return null;
    return Math.max(1, Math.min(t.R, Math.round(((x - t.x0) / (t.x1 - t.x0)) * t.R)));
  }

  onTrackHover(e) {
    const g = document.getElementById('trk-hover');
    const p = this.problem;
    if (!g || !this.canType() || !(p.mode === 'sync' || p.mode === 'sync3')) { if (g) g.innerHTML = ''; return; }
    const val = this.trackValueAt(e);
    if (val === null) { g.innerHTML = ''; return; }
    const t = this.trk;
    const x = t.pos(val);
    g.innerHTML = `<line x1="${x}" y1="${t.top - 4}" x2="${x}" y2="${t.axisY}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3 3"/>
      <text x="${x}" y="${t.axisY - 6}" fill="#e2e8f0" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="800" font-size="12">${val}</text>`;
  }

  setLaneLabel(i, text) {
    const l = document.getElementById(`lane-label-${i}`);
    if (l) l.textContent = text;
  }

  drawBreaker(n) {
    const g = document.getElementById('trk-breaker');
    const t = this.trk;
    if (!g || !t) return;
    if (!n || n <= 0) { g.innerHTML = ''; return; }
    const off = n > t.R;
    const x = t.pos(n);
    g.innerHTML = `
      <rect x="${x - 3}" y="${t.top - 8}" width="6" height="${t.axisY - t.top + 8}" rx="3" fill="#f59e0b" fill-opacity="0.25"/>
      <line x1="${x}" y1="${t.top - 8}" x2="${x}" y2="${t.axisY}" stroke="#fbbf24" stroke-width="2.5" stroke-dasharray="${off ? '4 4' : '0'}"/>
      <text x="${Math.min(x, t.x1 - 10)}" y="${t.top - 16}" fill="#fde68a" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="900" font-size="14">🛡 ${n}${off ? ' →' : ''}</text>`;
  }

  /** Faint dots on every landing spot of one lane (hint, or the known lane in reverse jobs). */
  drawLaneDots(lane, faint) {
    const t = this.trk;
    const g = document.getElementById('trk-hint');
    if (!t || !g) return;
    const num = t.nums[lane];
    const y = t.laneY[lane];
    let html = '';
    for (let m = num; m <= t.R; m += num) {
      html += `<circle cx="${t.pos(m)}" cy="${y}" r="${faint ? 4 : 5}" fill="${LANE_COLORS[lane]}" fill-opacity="${faint ? 0.45 : 0.9}"/>`;
      if (faint) html += `<text x="${t.pos(m)}" y="${y + 20}" fill="${LANE_COLORS[lane]}" fill-opacity="0.8" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="800" font-size="10">${m}</text>`;
    }
    g.innerHTML += html;
  }

  /**
   * Animate pulses hopping from 0 until `end`. Partial meetings flash yellow; the full collision
   * at `end` (if every lane lands there) arcs green if the breaker sits there, red otherwise.
   */
  runRace({ nums, end, breaker }, onDone) {
    const t = this.trk;
    if (!t) { onDone(); return; }
    cancelAnimationFrame(this.raceRaf);
    this.locked = true;
    const arcs = document.getElementById('trk-arcs');
    const fx = document.getElementById('trk-fx');
    const hover = document.getElementById('trk-hover');
    if (hover) hover.innerHTML = '';
    arcs.innerHTML = '';
    fx.innerHTML = '';
    t.nums = nums;
    const orbs = nums.map((_, i) => document.getElementById(`orb-${i}`));
    orbs.forEach((o) => o && o.setAttribute('opacity', '1'));

    const events = buildRace(nums, end);
    let evIdx = 0;
    const lastK = nums.map(() => 0);
    const duration = Math.max(1100, Math.min(2600, 600 + (end / t.R) * 2000));
    const start = performance.now();
    let breakerChecked = breaker === null || breaker > end;

    const svgNS = 'http://www.w3.org/2000/svg';
    const add = (parent, tag, attrs) => {
      const node = document.createElementNS(svgNS, tag);
      for (const [k, val] of Object.entries(attrs)) node.setAttribute(k, val);
      parent.appendChild(node);
      return node;
    };

    const frame = (now) => {
      const prog = Math.min(1, (now - start) / duration);
      const v = end * prog;

      nums.forEach((a, i) => {
        const y = t.laneY[i];
        const k = Math.floor(v / a + 1e-9);
        for (let j = lastK[i] + 1; j <= k; j++) {
          const xa = t.pos((j - 1) * a);
          const xb = t.pos(j * a);
          const h = Math.min(t.hopH, Math.max(10, (xb - xa) * 0.6));
          add(arcs, 'path', { d: `M ${xa} ${y} Q ${(xa + xb) / 2} ${y - 2 * h} ${xb} ${y}`, fill: 'none', stroke: LANE_COLORS[i], 'stroke-width': 2, 'stroke-opacity': 0.75 });
          add(arcs, 'circle', { cx: xb, cy: y, r: 4.5, fill: LANE_COLORS[i] });
          soundEngine.playHop(i);
        }
        lastK[i] = Math.max(lastK[i], k);
        const base = k * a;
        const frac = base >= end ? 0 : (v - base) / a;
        const xs = t.pos(Math.min(end, base + frac * a));
        const xb = t.pos(Math.min(end, base + a));
        const h = Math.min(t.hopH, Math.max(10, (xb - t.pos(base)) * 0.6));
        orbs[i]?.setAttribute('cx', xs);
        orbs[i]?.setAttribute('cy', y - Math.sin(Math.PI * frac) * h);
      });

      // Meetings along the way
      while (evIdx < events.length && events[evIdx].at <= v + 1e-9) {
        const ev = events[evIdx++];
        if (ev.lanes.length >= 2 && ev.lanes.length < nums.length) {
          const x = t.pos(ev.at);
          const ys = ev.lanes.map((l) => t.laneY[l]);
          add(fx, 'line', { x1: x, y1: Math.min(...ys), x2: x, y2: Math.max(...ys), stroke: '#fde047', 'stroke-width': 3, 'stroke-dasharray': '4 3', class: 'bolt-flash' });
          add(fx, 'text', { x, y: Math.min(...ys) - 12, fill: '#fde047', 'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace', 'font-weight': 900, 'font-size': 11 }).textContent = `${ev.lanes.length}/${nums.length} at ${ev.at}`;
          soundEngine.playPartial();
        }
      }

      // Pulses reach the breaker before the collision: show who actually lands on it.
      if (!breakerChecked && v >= breaker) {
        breakerChecked = true;
        const x = t.pos(breaker);
        nums.forEach((a, i) => {
          const hit = breaker % a === 0;
          add(fx, 'text', { x: x + 12, y: t.laneY[i] + 5, fill: hit ? '#34d399' : '#fb7185', 'font-family': 'Inter, sans-serif', 'font-weight': 900, 'font-size': 15 }).textContent = hit ? '✓' : '✗';
        });
      }

      if (prog < 1) {
        this.raceRaf = requestAnimationFrame(frame);
        return;
      }

      // Final collision
      const full = nums.every((a) => end % a === 0);
      if (full) {
        const x = t.pos(end);
        const caught = breaker === end;
        const color = caught ? '#34d399' : '#f43f5e';
        add(fx, 'rect', { x: x - 5, y: t.top - 10, width: 10, height: t.axisY - t.top + 10, rx: 5, fill: color, 'fill-opacity': 0.35, class: 'bolt-flash' });
        add(fx, 'line', { x1: x, y1: t.top - 10, x2: x, y2: t.axisY, stroke: color, 'stroke-width': 4, filter: 'url(#glow)', class: 'bolt-flash' });
        nums.forEach((_, i) => add(fx, 'circle', { cx: x, cy: t.laneY[i], r: 4, fill: 'none', stroke: color, 'stroke-width': 3, class: 'ring-out' }));
        add(fx, 'text', { x: Math.min(x, t.x1 - 30), y: t.axisY - 8, fill: color, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace', 'font-weight': 900, 'font-size': 14 }).textContent = caught ? `🛡 CAUGHT @ ${end}` : `💥 SURGE @ ${end}`;
        soundEngine.playCollision();
        if (!caught) this.shake();
        const r = t.svg.getBoundingClientRect();
        this.burstAtPoint(r.left + x, r.top + t.laneY[0], caught ? '#34d399' : '#f43f5e', caught ? 30 : 40);
      } else {
        add(fx, 'text', { x: t.x1 - 4, y: t.top - 18, fill: '#fb7185', 'text-anchor': 'end', 'font-family': 'JetBrains Mono, monospace', 'font-weight': 900, 'font-size': 13 }).textContent = 'No collision on this stretch of track';
      }
      setTimeout(onDone, 450);
    };
    this.raceRaf = requestAnimationFrame(frame);
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
      if (this.particles.length || this.canvasDirty) {
        ctx.clearRect(0, 0, c.width, c.height);
        this.canvasDirty = this.particles.length > 0;
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
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  burstAt(anchor, color, count) {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    this.burstAtPoint(r.left + r.width / 2, r.top + r.height / 2, color, count);
  }

  burstAtPoint(x, y, color, count) {
    const palette = [color, '#fde047', '#ffffff'];
    this.canvasDirty = true;
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

/** Track length per problem, so re-rendering (resize) keeps the same scale. */
const rangeCache = new WeakMap();

/** Axis label spacing: about 6-12 labels, never a step that hints at the answer. */
function niceStep(R) {
  for (const s of [1, 2, 5, 10, 20, 25, 50, 100]) if (R / s <= 12) return s;
  return 100;
}

function boot() {
  if (window.lcmGame) return;
  window.lcmGame = new GridSyncGame();
  window.lcmGame.init();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
