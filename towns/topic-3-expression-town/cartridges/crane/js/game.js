/**
 * Demolition Crane - Game Controller (Lesson 3-3: Order of Operations)
 *
 * Run = 4 zones x 3 randomized buildings (+ follow-ups) and the Titan Demolisher boss.
 * Each step of a building is two moves:
 *   1. Aim the wrecking ball and strike an operation that can be done now.
 *   2. Type the value of that step (4 × 3 = ?). The blocks collapse into the answer.
 * Boss attacks add Cage Drop (place parentheses to hit a target) and
 * Spot the Mistake (find the out-of-order line in a worked solution).
 *
 * Stakes: per-building timer, crane integrity (0% = zone restarts), combo x1-x5.
 * Practice mode: no timer, no damage, nothing reported to the hub.
 */

import {
  parseExpressionToTokens,
  validateMove,
  applyOperation,
  getLegalMoves,
  evaluateTokens,
  evaluateExpression,
  parseNumberInput,
  formatMathHtml,
  formatPlain,
  tokensToText,
  displayOp,
  opVerb,
  isOperatorToken,
} from './expressionParser.js?v=20261109b';
import {
  ZONES,
  BOSS,
  DAMAGE,
  SKILLS,
  VIOLATION_SKILL,
  FOLLOWUP_TEMPLATES,
  MAX_FOLLOWUPS_PER_ZONE,
  MAX_COMBO,
  BOSS_TAUNTS,
} from './curriculum.js?v=20261109b';
import { createRng, buildRun, buildZoneTasks, buildBossTasks, makeFollowUp, cagedExpression } from './generator.js?v=20261109b';
import { soundEngine } from './audio.js?v=20261109b';

const LESSON_ID = 'G06_U03_L03';
const ALL_STAGES = [...ZONES, BOSS];

class DemolitionCraneGame {
  constructor() {
    this.el = {};
    this.particles = [];
    this.modal = 'briefing'; // briefing | play | zoneClear | breakdown | debrief | guide | sandbox
    this.phase = 'idle'; // aim | type | cage | spot | busy | idle
    this.isPractice = false;
    this.isSandbox = false;
    this.reported = false;
    this.craneX = 0;
    this.craneTargetX = 0;
  }

  // ------------------------------------------------------------------
  // Setup
  // ------------------------------------------------------------------
  init() {
    const ids = [
      'game-root', 'fx-canvas', 'stamp', 'zone-badge', 'zone-title', 'progress-pips', 'practice-badge',
      'stakes-timer', 'timer-display', 'timer-bar', 'stakes-integrity', 'integrity-bar', 'integrity-display',
      'combo-box', 'combo-display', 'score-display', 'audio-btn', 'audio-icon', 'briefing-btn', 'guide-btn',
      'task-icon', 'task-label', 'followup-tag', 'hint-btn', 'boss-panel', 'titan', 'boss-hp-text', 'boss-hp-plates',
      'boss-taunt', 'prompt-text', 'stage', 'trolley', 'trolley-light', 'cable', 'ball', 'beam', 'cage-panel',
      'spot-panel', 'log', 'console-label', 'answer-display', 'keypad', 'feedback', 'feedback-icon',
      'feedback-title', 'feedback-text', 'action-btn',
      'modal-briefing', 'briefing-close-btn', 'briefing-start-btn', 'briefing-practice-btn', 'briefing-sandbox-btn',
      'modal-zone-clear', 'zone-clear-title', 'zone-clear-stars', 'zone-clear-stats', 'zone-clear-next',
      'zone-clear-next-desc', 'zone-clear-btn',
      'modal-breakdown', 'breakdown-text',
      'modal-debrief', 'debrief-icon', 'debrief-title', 'debrief-subtitle', 'debrief-stars', 'debrief-score',
      'debrief-accuracy', 'debrief-combo', 'debrief-time', 'debrief-skills', 'debrief-mistakes', 'debrief-again-btn',
      'modal-guide', 'guide-close-btn',
      'modal-sandbox', 'sandbox-form', 'sandbox-input', 'sandbox-error', 'sandbox-close-btn', 'sandbox-result',
    ];
    for (const id of ids) {
      this.el[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(id);
    }
    this.ctx = this.el.fxCanvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this.positionCrane(true);
    });

    this.buildKeypad();
    this.bindEvents();
    this.updateAudioIcon();

    // Hub handshake: tell the hub we're ready; it replies with the mute setting.
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'HUB_INIT' && typeof e.data.payload?.isMuted === 'boolean') {
        soundEngine.setMuted(e.data.payload.isMuted);
        this.updateAudioIcon();
      }
    });
    try {
      window.parent.postMessage({ type: 'CARTRIDGE_READY' }, '*');
    } catch { /* not embedded */ }

    setInterval(() => this.tickTimer(), 1000);
    this.lastFrame = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    this.showModal('briefing');
  }

  resizeCanvas() {
    this.el.fxCanvas.width = window.innerWidth;
    this.el.fxCanvas.height = window.innerHeight;
  }

  buildKeypad() {
    const keys = ['7', '8', '9', '⌫', '4', '5', '6', '0', '1', '2', '3', '.'];
    this.el.keypad.innerHTML = keys
      .map((k) => `<button type="button" data-key="${k}" class="key-btn h-11 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-500 font-mono-math font-black text-lg text-slate-100 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">${k}</button>`)
      .join('');
    this.el.keypad.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => this.pressKey(b.dataset.key === '⌫' ? 'Backspace' : b.dataset.key)),
    );
  }

  // ------------------------------------------------------------------
  // Run flow
  // ------------------------------------------------------------------
  startRun(practice) {
    this.isPractice = practice;
    this.isSandbox = false;
    this.reported = false;
    this.rng = createRng(Date.now());
    this.run = buildRun(this.rng);
    this.score = 0;
    this.combo = 1;
    this.bestCombo = 1;
    this.firstTry = 0;
    this.totalTasks = 0;
    this.skillStats = {};
    this.mistakes = [];
    this.zoneStars = [];
    this.runStart = Date.now();
    this.hideAllModals();
    this.modal = 'play';
    soundEngine.playRadarPulse();
    this.startZone(0);
  }

  startSandbox(expr) {
    this.isPractice = true;
    this.isSandbox = true;
    this.score = this.score || 0;
    this.combo = 1;
    this.bestCombo = this.bestCombo || 1;
    this.skillStats = this.skillStats || {};
    this.mistakes = this.mistakes || [];
    this.stageIdx = 0;
    this.stage = { id: 0, code: 'SANDBOX', title: 'Build Your Own', timer: 0 };
    this.tasks = [{ kind: 'build', expr, answer: evaluateExpression(expr), template: 'custom' }];
    this.taskIdx = 0;
    this.integrity = 100;
    this.zoneMisses = 0;
    this.zoneHints = 0;
    this.followUpsUsed = 0;
    this.hideAllModals();
    this.modal = 'play';
    this.renderHud();
    this.loadTask();
  }

  get isBoss() {
    return this.stageIdx === ZONES.length;
  }

  startZone(idx) {
    this.stageIdx = idx;
    this.stage = ALL_STAGES[idx];
    this.tasks = this.isBoss ? [...this.run.boss] : [...this.run.zones[idx].tasks];
    this.taskIdx = 0;
    this.integrity = 100;
    this.zoneMisses = 0;
    this.zoneHints = 0;
    this.followUpsUsed = 0;
    this.bossHp = BOSS.hp;
    this.el.bossPanel.classList.toggle('hidden', !this.isBoss);
    if (this.isBoss) {
      soundEngine.playReactorWarning();
      this.el.bossTaunt.textContent = '"So, you think you know the order of operations?"';
      this.renderBossHp();
    }
    this.renderHud();
    this.loadTask();
  }

  loadTask() {
    const task = this.tasks[this.taskIdx];
    this.task = task;
    this.taskMissed = false;
    this.taskViolation = null;
    this.timeLeft = this.stage.timer;
    this.typed = '';
    this.pending = null;
    this.hintOn = false;
    this.logLines = [];
    this.el.followupTag.classList.toggle('hidden', !task.followUp);
    this.el.beam.classList.toggle('hidden', task.kind !== 'build');
    this.el.cagePanel.classList.toggle('hidden', task.kind !== 'cage');
    this.el.spotPanel.classList.toggle('hidden', task.kind !== 'spot');
    document.getElementById('crane-rig').classList.toggle('hidden', task.kind !== 'build');

    if (task.kind === 'build') {
      this.tokens = parseExpressionToTokens(task.expr);
      this.logLines.push({ text: task.expr });
      this.setTaskHeader('🏗️', this.isBoss ? 'Boss Tower' : this.isSandbox ? 'Your Building' : `Building ${this.buildingNumber()}`);
      this.el.promptText.innerHTML = 'Strike an operation you can do <b class="text-amber-300">right now</b>. Then type its value.';
      this.enterAim();
      this.setFeedback('idle', 'Ready', 'Aim with the mouse or ◄ ►, then click or press Space to drop the ball.');
    } else if (task.kind === 'cage') {
      this.setTaskHeader('🎯', 'Cage Drop');
      this.el.promptText.innerHTML = `Drop <b class="text-cyan-300">one pair of parentheses</b> so the tower equals <b class="text-rose-300 font-mono-math">${task.target}</b>.`;
      this.cage = { start: null, end: null, cursor: 0 };
      this.phase = 'cage';
      this.renderCage();
      this.setFeedback('idle', 'Cage Drop', `Without a cage it equals ${task.baseValue}. Click the first and last number to cage, then Lock (Enter).`);
    } else {
      this.setTaskHeader('🔍', 'Spot the Mistake');
      this.el.promptText.innerHTML = 'The Titan solved this tower <b class="text-rose-300">out of order</b>. Click the first line that is wrong.';
      this.phase = 'spot';
      this.renderSpot();
      this.setFeedback('idle', 'Spot the Mistake', 'Check each line against the line above it. Keys 1–6 pick a line.');
    }
    this.renderLog();
    this.renderConsole();
    this.renderHud();
  }

  buildingNumber() {
    const base = this.tasks.slice(0, this.taskIdx + 1).filter((t) => !t.followUp).length;
    return `${base}/${this.tasks.filter((t) => !t.followUp).length}`;
  }

  setTaskHeader(icon, label) {
    this.el.taskIcon.textContent = icon;
    this.el.taskLabel.textContent = label;
  }

  completeTask() {
    this.phase = 'busy';
    this.totalTasks++;
    if (!this.taskMissed) this.firstTry++;
    if (!this.isPractice) this.score += 100 + Math.max(0, this.timeLeft) * 2;

    // Follow-up building for the rule that was broken (zones only).
    if (this.taskViolation && !this.isBoss && !this.isSandbox && this.followUpsUsed < MAX_FOLLOWUPS_PER_ZONE) {
      this.followUpsUsed++;
      this.tasks.splice(this.taskIdx + 1, 0, makeFollowUp(this.rng, this.taskViolation, FOLLOWUP_TEMPLATES[this.taskViolation]));
    }

    let delay = 1300;
    if (this.isBoss) {
      this.bossHp--;
      this.hitTitan();
      delay = 1600;
    } else {
      this.stamp(this.isSandbox ? 'SOLVED!' : 'DEMOLISHED!');
      soundEngine.playVictory();
    }
    this.renderHud();

    setTimeout(() => {
      if (this.modal !== 'play') return;
      if (this.isSandbox) {
        this.openSandbox(`Solved! ${formatPlain(this.task.expr)} = ${this.task.answer}. Build another?`);
        return;
      }
      if (this.isBoss && this.bossHp <= 0) {
        this.finishZone();
        return;
      }
      this.taskIdx++;
      if (this.taskIdx >= this.tasks.length) this.finishZone();
      else this.loadTask();
    }, delay);
  }

  zoneStarCount() {
    if (this.zoneMisses === 0 && this.zoneHints === 0) return 3;
    if (this.zoneMisses <= 2) return 2;
    return 1;
  }

  finishZone() {
    const stars = this.zoneStarCount();
    this.zoneStars[this.stageIdx] = stars;
    if (this.isBoss) {
      this.endRun();
      return;
    }
    soundEngine.playVictory();
    this.burst(window.innerWidth / 2, window.innerHeight / 2, 'victory');
    this.el.zoneClearTitle.textContent = this.stage.title;
    this.el.zoneClearStars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    this.el.zoneClearStats.textContent = `${this.zoneMisses} miss${this.zoneMisses === 1 ? '' : 'es'} · ${this.zoneHints} hint${this.zoneHints === 1 ? '' : 's'}`;
    const next = ALL_STAGES[this.stageIdx + 1];
    this.el.zoneClearNext.textContent = next.title;
    this.el.zoneClearNextDesc.textContent = next.focus;
    this.showModal('zoneClear');
  }

  continueFromZoneClear() {
    this.hideAllModals();
    this.modal = 'play';
    this.startZone(this.stageIdx + 1);
  }

  /** Integrity hit 0: the zone restarts with fresh buildings (or the boss resets). */
  breakdown() {
    this.phase = 'busy';
    soundEngine.playCollapseAlarm();
    this.el.breakdownText.textContent = this.isBoss
      ? 'The Titan knocked your crane offline. The boss fight restarts with new attacks.'
      : `${this.stage.title} restarts with new buildings. Your score is safe.`;
    this.showModal('breakdown');
    setTimeout(() => {
      if (this.modal !== 'breakdown') return;
      this.hideAllModals();
      this.modal = 'play';
      if (this.isBoss) this.run.boss = buildBossTasks(this.rng);
      else this.run.zones[this.stageIdx].tasks = buildZoneTasks(this.rng, this.stage.id);
      this.startZone(this.stageIdx);
    }, 2000);
  }

  endRun() {
    this.phase = 'idle';
    soundEngine.playVictory();
    this.burst(window.innerWidth / 2, window.innerHeight / 3, 'victory');
    const totalStars = this.zoneStars.reduce((a, b) => a + (b || 0), 0);
    const maxStars = ALL_STAGES.length * 3;

    this.el.debriefIcon.textContent = this.isPractice ? '🧪' : '🏆';
    this.el.debriefTitle.textContent = this.isPractice ? 'Practice Run Complete' : 'Titan Demolished!';
    this.el.debriefSubtitle.textContent = this.isPractice
      ? 'Practice runs are not saved. Start a real run from the briefing when you\'re ready.'
      : 'All four zones cleared and the Titan is scrap metal. Progress saved to Expression Town.';
    this.el.debriefStars.textContent = `${'★'.repeat(totalStars)}${'☆'.repeat(maxStars - totalStars)}  ${totalStars}/${maxStars} stars`;
    this.el.debriefScore.textContent = this.score;
    this.el.debriefAccuracy.textContent = `${this.firstTry}/${this.totalTasks}`;
    this.el.debriefCombo.textContent = `x${this.bestCombo}`;
    const secs = Math.round((Date.now() - this.runStart) / 1000);
    this.el.debriefTime.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    this.renderSkills();
    this.el.debriefMistakes.innerHTML = this.mistakes.length
      ? this.mistakes.map((m) => `<p>${m}</p>`).join('')
      : '<p class="text-emerald-300">No mistakes. Perfect demolition!</p>';
    this.showModal('debrief');

    if (!this.isPractice && !this.reported) {
      this.reported = true;
      try {
        window.parent.postMessage({
          type: 'CARTRIDGE_COMPLETE',
          payload: {
            lessonId: LESSON_ID,
            // score = buildings/boss attacks finished with no misses; total = all of them
            score: this.firstTry,
            total: this.totalTasks,
            bossDefeated: true,
          },
        }, '*');
      } catch { /* not embedded */ }
    }
  }

  renderSkills() {
    const rows = Object.entries(SKILLS)
      .filter(([k]) => this.skillStats[k]?.total)
      .map(([k, info]) => {
        const s = this.skillStats[k];
        const pct = Math.round((s.right / s.total) * 100);
        const color = pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-400' : 'bg-rose-500';
        return `<div class="flex items-center gap-2"><span class="w-4">${info.icon}</span><span class="flex-1 text-slate-300">${info.label}</span>
          <div class="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden"><div class="h-full ${color}" style="width:${pct}%"></div></div>
          <span class="w-10 text-right font-mono-math text-slate-400">${s.right}/${s.total}</span></div>`;
      });
    this.el.debriefSkills.innerHTML = rows.join('') || '<p class="text-slate-500">No data yet.</p>';
  }

  recordSkill(skill, right) {
    if (!skill) return;
    const s = (this.skillStats[skill] ||= { right: 0, total: 0 });
    s.total++;
    if (right) s.right++;
  }

  addMistake(text) {
    if (this.mistakes.length < 10) this.mistakes.push(text);
  }

  // ------------------------------------------------------------------
  // Stakes: misses, damage, combo, timer
  // ------------------------------------------------------------------
  registerMiss(damage) {
    this.taskMissed = true;
    this.zoneMisses++;
    this.combo = Math.max(1, this.combo - 1);
    if (!this.isPractice) {
      this.integrity = Math.max(0, this.integrity - damage);
      this.floatText(`-${damage}%`, 'text-rose-400');
    }
    this.shake();
    this.renderHud();
    return !this.isPractice && this.integrity <= 0;
  }

  registerHit() {
    this.combo = Math.min(MAX_COMBO, this.combo + 1);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
  }

  tickTimer() {
    if (this.modal !== 'play' || this.isPractice || !this.stage?.timer) return;
    if (!['aim', 'type', 'cage', 'spot'].includes(this.phase)) return;
    this.timeLeft--;
    if (this.timeLeft <= 5 && this.timeLeft > 0) soundEngine.playTimerTick();
    if (this.timeLeft <= 0) {
      this.timeLeft = this.stage.timer;
      this.setFeedback('fault', 'Out of time!', `The demolition window closed. −${DAMAGE.timeout}% integrity, and the clock restarts.`);
      soundEngine.playFaultClank();
      this.addMistake(`⏱️ Ran out of time on ${formatPlain(this.task.expr || 'a boss attack')}`);
      if (this.registerMiss(DAMAGE.timeout)) {
        this.breakdown();
        return;
      }
    }
    this.renderTimer();
  }

  // ------------------------------------------------------------------
  // Building: aim, strike, type
  // ------------------------------------------------------------------
  enterAim() {
    this.phase = 'aim';
    this.pending = null;
    this.typed = '';
    const ops = this.operatorIds();
    if (!ops.includes(this.aimId)) this.aimId = ops[0] || null;
    this.renderBeam();
    this.renderConsole();
    requestAnimationFrame(() => this.positionCrane());
  }

  operatorIds() {
    return this.tokens.filter(isOperatorToken).map((t) => t.id);
  }

  aimAt(id) {
    if (this.phase !== 'aim' || this.aimId === id) return;
    this.aimId = id;
    this.refreshTokenClasses();
    this.positionCrane();
  }

  moveAim(dir) {
    const ops = this.operatorIds();
    if (!ops.length) return;
    const i = ops.indexOf(this.aimId);
    this.aimAt(ops[(i + dir + ops.length) % ops.length]);
  }

  strike(id = this.aimId) {
    if (this.phase !== 'aim' || !id) return;
    this.aimId = id;
    this.phase = 'busy';
    this.positionCrane();
    const targetEl = this.tokenEl(id);
    const validation = validateMove(this.tokens, id);
    const before = this.tokens;

    this.dropBall(targetEl, () => {
      const rect = targetEl?.getBoundingClientRect();
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

      if (validation.isLegal) {
        soundEngine.playDropCrunch();
        this.burst(x, y, 'demolition');
        this.recordSkill(this.classifyMove(before, validation.index), true);
        const op = before[validation.index];
        this.pending = {
          index: validation.index,
          opId: id,
          op: op.type === 'fraction_bar' ? '÷' : op.value,
          isFractionBar: op.type === 'fraction_bar',
          left: before[validation.index - 1],
          right: before[validation.index + 1],
          value: validation.evaluatedValue,
          misses: 0,
        };
        this.phase = 'type';
        this.typed = '';
        this.renderBeam();
        this.renderConsole();
        this.setFeedback('good', 'Good strike!', `Now work it out: what is ${this.pendingText()}? Type the answer and press Enter.`);
      } else {
        soundEngine.playFaultClank();
        this.burst(x, y, 'clank');
        this.recordSkill(VIOLATION_SKILL[validation.violationType], false);
        if (!this.taskViolation) this.taskViolation = validation.violationType;
        const correct = evaluateTokens(before).value;
        const consequence = validation.wrongValue !== null && validation.wrongValue !== undefined && validation.wrongValue !== correct
          ? ` Going that way would give ${validation.wrongValue} instead of ${correct}.`
          : '';
        this.setFeedback('fault', `Not yet! ${validation.ruleTitle}`, validation.message + consequence);
        this.addMistake(`🏗️ ${formatPlain(tokensToText(before))}: ${validation.ruleTitle.toLowerCase()}`);
        if (validation.blockerTokenId) this.flashToken(validation.blockerTokenId);
        const broke = this.registerMiss(DAMAGE.wrongOrder);
        this.phase = 'aim';
        if (broke) this.breakdown();
      }
    });
  }

  /** Which skill a correct strike demonstrates (null for a plain last step). */
  classifyMove(tokens, index) {
    const op = tokens[index];
    if (op.type === 'fraction_bar') return 'fraction';
    // Grouping skill = doing a step inside a group while something outside it waits.
    const outerDepth = Math.min(...tokens.filter((t) => t.type === 'operator').map((t) => t.depth));
    if (op.depth > outerDepth) return 'group';
    if (op.value === '^') return 'exp';
    const neighbors = [tokens[index - 2], tokens[index + 2]].filter((t) => t?.type === 'operator');
    if (!neighbors.length) return null;
    const rank = (v) => (v === '×' || v === '÷' ? 2 : v === '^' ? 3 : 1);
    if (neighbors.some((n) => rank(n.value) === rank(op.value))) return 'ltr';
    return 'muldiv';
  }

  pendingText() {
    const p = this.pending;
    if (!p) return '';
    if (p.op === '^') return formatPlain(`${p.left.value}^${p.right.value}`);
    return `${p.left.value} ${displayOp(p.op)} ${p.right.value}`;
  }

  pressKey(key) {
    if (this.modal !== 'play' || this.phase !== 'type') return;
    if (key === 'Backspace') {
      this.typed = this.typed.slice(0, -1);
    } else if (key === 'Enter') {
      this.submitValue();
      return;
    } else if (/^[0-9.]$/.test(key) && this.typed.length < 7) {
      if (key === '.' && this.typed.includes('.')) return;
      this.typed += key;
    } else {
      return;
    }
    soundEngine.playKeyClick();
    this.renderConsole();
  }

  submitValue() {
    const p = this.pending;
    const v = parseNumberInput(this.typed);
    if (!p || v === null) return;

    if (Math.abs(v - p.value) < 1e-9) {
      soundEngine.playCorrect();
      if (p.misses === 0) {
        this.recordSkill('arith', true);
        this.registerHit();
        if (!this.isPractice) {
          const pts = 50 * this.combo;
          this.score += pts;
          this.floatText(`+${pts}`, 'text-emerald-300');
        }
      }
      const res = applyOperation(this.tokens, p.index);
      this.tokens = res.tokens;
      this.logLines.push({ text: tokensToText(res.tokens), step: `${this.pendingText()} = ${p.value}` });
      this.renderLog();
      this.lastNewId = res.newTokenId;
      this.pending = null;
      this.typed = '';
      if (this.tokens.length === 1) {
        this.phase = 'busy';
        this.renderBeam();
        this.renderConsole();
        this.setFeedback('good', 'Building down!', `${formatPlain(this.task.expr)} = ${p.value}`);
        this.completeTask();
        return;
      }
      this.setFeedback('good', `${this.pendingTextFrom(p)} = ${p.value}`, res.dissolved ? 'Cage cleared! Pick the next operation.' : 'Pick the next operation.');
      this.enterAim();
      this.renderHud();
      return;
    }

    // Wrong value
    soundEngine.playFaultClank();
    p.misses++;
    if (p.misses === 1) this.recordSkill('arith', false);
    const a = p.left.numericValue;
    const b = p.right.numericValue;
    let msg;
    if (p.op === '^' && Math.abs(v - a * b) < 1e-9) {
      msg = `${formatPlain(`${a}^${b}`)} is not ${a} × ${b}. It means ${Array(b).fill(a).join(' × ')}.`;
    } else if (p.misses >= 2) {
      msg = `${this.pendingTextFrom(p)} = ${p.value}. Type ${p.value} to keep going.`;
    } else {
      msg = `${v} isn't right. Try to ${opVerb(p.op)} again: ${this.pendingTextFrom(p)}.`;
    }
    this.setFeedback('fault', 'Check your math', msg);
    this.addMistake(`🧮 ${this.pendingTextFrom(p)}: you typed ${v}, answer ${p.value}`);
    this.typed = '';
    this.renderConsole();
    if (this.registerMiss(DAMAGE.wrongMath)) this.breakdown();
  }

  pendingTextFrom(p) {
    if (p.op === '^') return formatPlain(`${p.left.value}^${p.right.value}`);
    return `${p.left.value} ${displayOp(p.op)} ${p.right.value}`;
  }

  useHint() {
    if (this.modal !== 'play') return;
    if (this.phase === 'aim') {
      if (!this.hintOn) this.zoneHints++;
      this.hintOn = true;
      soundEngine.playRadarPulse();
      this.refreshTokenClasses();
      const i = getLegalMoves(this.tokens)[0];
      const t = this.tokens[i];
      const name = t.type === 'fraction_bar'
        ? 'the fraction bar'
        : formatPlain(t.value === '^' ? `${this.tokens[i - 1].value}^${this.tokens[i + 1].value}` : `${this.tokens[i - 1].value} ${t.value} ${this.tokens[i + 1].value}`);
      this.setFeedback('hint', 'Radar', `The glowing block is next: ${name}. Hints cost the 3rd star.`);
    } else if (this.phase === 'type' && this.pending) {
      if (!this.hintOn) this.zoneHints++;
      this.hintOn = true;
      const p = this.pending;
      const a = p.left.numericValue;
      const b = p.right.numericValue;
      let tip = `Work out ${this.pendingTextFrom(p)}.`;
      if (p.op === '^') tip = `${formatPlain(`${a}^${b}`)} means ${Array(b).fill(a).join(' × ')}.`;
      else if (p.op === '÷') tip = `Think: what number times ${b} makes ${a}?`;
      else if (p.op === '-') tip = `Count up from ${b} to ${a}.`;
      this.setFeedback('hint', 'Hint', tip);
    } else if (this.phase === 'cage') {
      if (!this.hintOn) this.zoneHints++;
      this.hintOn = true;
      this.setFeedback('hint', 'Hint', `The target ${this.task.target} is ${this.task.target > this.task.baseValue ? 'bigger' : 'smaller'} than ${this.task.baseValue}. Which + or − would you need to happen first?`);
    } else if (this.phase === 'spot') {
      if (!this.hintOn) this.zoneHints++;
      this.hintOn = true;
      this.setFeedback('hint', 'Hint', 'For each line, ask: was the step from the line above the right one to do first?');
    }
  }

  // ------------------------------------------------------------------
  // Boss: Cage Drop
  // ------------------------------------------------------------------
  cageClick(k) {
    if (this.phase !== 'cage') return;
    const c = this.cage;
    c.cursor = k;
    if (c.start === null || c.end !== null) {
      c.start = k;
      c.end = null;
    } else if (k === c.start) {
      c.start = null;
    } else {
      c.end = Math.max(k, c.start);
      c.start = Math.min(k, c.start);
    }
    soundEngine.playKeyClick();
    this.renderCage();
    this.renderConsole();
  }

  lockCage() {
    if (this.phase !== 'cage') return;
    const { start, end } = this.cage;
    const t = this.task;
    if (start === null || end === null) {
      this.setFeedback('idle', 'Pick two numbers', 'Click the first number and the last number the cage should hold.');
      return;
    }
    if (start === 0 && end === t.numbers.length - 1) {
      this.setFeedback('fault', 'That cage holds everything', `Caging the whole tower changes nothing: it still equals ${t.baseValue}.`);
      return;
    }
    const expr = cagedExpression(t.numbers, t.ops, start, end);
    let value;
    try {
      value = evaluateExpression(expr);
    } catch {
      value = NaN;
    }
    if (value === t.target) {
      soundEngine.playDropCrunch();
      this.recordSkill('cage', !this.taskMissed);
      if (!this.taskMissed) this.registerHit();
      this.setFeedback('good', 'Cage locked!', `${formatPlain(expr)} = ${t.target}. The grouping made that step happen first.`);
      this.phase = 'busy';
      this.renderCage(true);
      this.completeTask();
      return;
    }
    soundEngine.playFaultClank();
    if (!this.taskMissed) this.recordSkill('cage', false);
    const shown = Number.isFinite(value) ? value : 'something that doesn\'t work';
    this.setFeedback('fault', 'Wrong output', `${formatPlain(expr)} = ${shown}, not ${t.target}. Try a different cage.`);
    this.addMistake(`🎯 Cage drop for ${t.target}: tried ${formatPlain(expr)} = ${shown}`);
    this.cage = { start: null, end: null, cursor: this.cage.cursor };
    this.renderCage();
    if (this.registerMiss(DAMAGE.bossWrong)) this.breakdown();
  }

  // ------------------------------------------------------------------
  // Boss: Spot the Mistake
  // ------------------------------------------------------------------
  pickSpotLine(lineIdx) {
    if (this.phase !== 'spot' || lineIdx < 1 || lineIdx >= this.task.lines.length) return;
    const t = this.task;
    if (lineIdx === t.wrongLine) {
      soundEngine.playDropCrunch();
      this.recordSkill('spot', !this.taskMissed);
      if (!this.taskMissed) this.registerHit();
      this.setFeedback('good', `Caught it! Line ${lineIdx}`, `${t.explanation} The right answer is ${t.correctValue}, not ${t.wrongValue}.`);
      this.phase = 'busy';
      this.renderSpot(lineIdx);
      this.completeTask();
      return;
    }
    soundEngine.playFaultClank();
    if (!this.taskMissed) this.recordSkill('spot', false);
    const msg = lineIdx < t.wrongLine
      ? `Line ${lineIdx} follows the rules. The mistake is further down.`
      : `Line ${lineIdx} is wrong, but only because of an earlier mistake. Look higher up.`;
    this.setFeedback('fault', 'Not that line', msg);
    this.addMistake(`🔍 Spot the mistake in ${formatPlain(t.expr)}: picked line ${lineIdx}`);
    this.renderSpot(null, lineIdx);
    if (this.registerMiss(DAMAGE.bossWrong)) this.breakdown();
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------
  renderHud() {
    const s = this.stage;
    if (!s) return;
    this.el.zoneBadge.textContent = s.code;
    this.el.zoneTitle.textContent = s.title;

    // Progress pips: one per zone + boss
    if (this.isSandbox) {
      this.el.progressPips.innerHTML = '';
    } else {
      this.el.progressPips.innerHTML = ALL_STAGES.map((z, i) => {
        const done = i < this.stageIdx;
        const cur = i === this.stageIdx;
        const label = i === ZONES.length ? '☠' : i + 1;
        const stars = this.zoneStars?.[i];
        const cls = done
          ? 'bg-emerald-500/90 border-emerald-300 text-slate-950'
          : cur ? 'bg-amber-400 border-amber-200 text-slate-950 animate-pulse' : 'bg-slate-900 border-slate-700 text-slate-500';
        return `<div title="${z.title}${stars ? ` · ${stars}★` : ''}" class="w-7 h-7 rounded-lg border-2 ${cls} flex items-center justify-center text-[11px] font-black font-mono-math">${label}</div>`;
      }).join('');
    }

    this.el.practiceBadge.classList.toggle('hidden', !this.isPractice);
    this.el.practiceBadge.classList.toggle('flex', this.isPractice);
    this.el.stakesTimer.classList.toggle('hidden', this.isPractice);
    this.el.stakesIntegrity.classList.toggle('hidden', this.isPractice);

    const integ = this.integrity ?? 100;
    this.el.integrityBar.style.width = `${integ}%`;
    this.el.integrityBar.className = `h-full rounded-full transition-all duration-300 ${integ > 60 ? 'bg-emerald-500' : integ > 25 ? 'bg-amber-400' : 'bg-rose-500 animate-pulse'}`;
    this.el.integrityDisplay.textContent = `${integ}%`;
    this.el.comboDisplay.textContent = `x${this.combo ?? 1}`;
    this.el.comboBox.classList.toggle('combo-hot', (this.combo ?? 1) >= 3);
    this.el.scoreDisplay.textContent = this.isPractice ? '—' : this.score ?? 0;
    this.renderTimer();
  }

  renderTimer() {
    if (!this.stage?.timer) return;
    const t = Math.max(0, this.timeLeft ?? this.stage.timer);
    this.el.timerDisplay.textContent = `${t}s`;
    this.el.timerBar.style.width = `${(t / this.stage.timer) * 100}%`;
    const urgent = t <= 10;
    this.el.timerBar.className = `h-full rounded-full transition-all duration-300 ${urgent ? 'bg-rose-500' : 'bg-amber-400'}`;
    this.el.timerDisplay.classList.toggle('text-rose-400', urgent);
    this.el.timerDisplay.classList.toggle('animate-urgent', urgent);
  }

  renderBossHp() {
    this.el.bossHpText.textContent = `${Math.max(0, this.bossHp)} / ${BOSS.hp} armor`;
    this.el.bossHpPlates.innerHTML = Array.from({ length: BOSS.hp }, (_, i) =>
      `<div class="flex-1 h-2.5 rounded-sm ${i < this.bossHp ? 'bg-rose-500' : 'bg-slate-800'}"></div>`,
    ).join('');
  }

  hitTitan() {
    soundEngine.playDropCrunch();
    soundEngine.playReactorWarning();
    this.renderBossHp();
    this.el.titan.classList.remove('titan-hit');
    void this.el.titan.offsetWidth;
    this.el.titan.classList.add('titan-hit');
    const r = this.el.titan.getBoundingClientRect();
    this.burst(r.left + r.width / 2, r.top + r.height / 2, 'demolition');
    this.el.bossTaunt.textContent = BOSS_TAUNTS[Math.min(BOSS_TAUNTS.length - 1, BOSS.hp - this.bossHp - 1)];
    if (!this.isPractice) {
      this.score += 300;
      this.floatText('+300 HIT!', 'text-rose-300');
    }
  }

  tokenEl(id) {
    return this.el.beam.querySelector(`[data-id="${id}"]`);
  }

  /** Draws the expression as crates, operation blocks, and nested cages. */
  renderBeam() {
    const beam = this.el.beam;
    beam.innerHTML = '';
    const tokens = this.tokens;
    const barIdx = tokens.findIndex((t) => t.type === 'fraction_bar');

    const buildRow = (from, to) => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-center gap-2 flex-wrap';
      const stack = [row];
      for (let i = from; i < to; i++) {
        const t = tokens[i];
        const parent = stack[stack.length - 1];
        if (t.type === 'open_paren' || t.type === 'open_bracket') {
          const cage = document.createElement('div');
          const bracket = t.type === 'open_bracket';
          cage.className = `cage flex items-center gap-2 rounded-2xl px-1.5 py-1.5 border-2 border-dashed ${bracket ? 'border-amber-500/70 bg-amber-950/20' : 'border-cyan-500/70 bg-cyan-950/20'}`;
          cage.appendChild(this.symbolEl(t.value, bracket));
          parent.appendChild(cage);
          stack.push(cage);
        } else if (t.type === 'close_paren' || t.type === 'close_bracket') {
          parent.appendChild(this.symbolEl(t.value, t.type === 'close_bracket'));
          stack.pop();
        } else if (t.type === 'number') {
          if (tokens[i - 1]?.type === 'operator' && tokens[i - 1].value === '^') continue; // drawn as the exponent
          parent.appendChild(this.numberEl(t));
        } else if (t.type === 'operator') {
          parent.appendChild(t.value === '^' ? this.powerEl(t, tokens[i + 1]) : this.opEl(t));
        }
      }
      return row;
    };

    const wrap = document.createElement('div');
    wrap.className = 'flex flex-col items-center gap-3';
    if (barIdx === -1) {
      wrap.appendChild(buildRow(0, tokens.length));
    } else {
      wrap.appendChild(buildRow(0, barIdx));
      const bar = this.opEl(tokens[barIdx], true);
      wrap.appendChild(bar);
      wrap.appendChild(buildRow(barIdx + 1, tokens.length));
    }
    beam.appendChild(wrap);

    if (this.lastNewId) {
      const fresh = this.tokenEl(this.lastNewId);
      if (fresh) fresh.classList.add('pop-in', 'fresh-crate');
      this.lastNewId = null;
    }
    this.refreshTokenClasses();
  }

  symbolEl(ch, bracket) {
    const s = document.createElement('span');
    s.className = `font-mono-math font-black text-4xl ${bracket ? 'text-amber-400' : 'text-cyan-400'}`;
    s.textContent = ch;
    return s;
  }

  numberEl(t) {
    const d = document.createElement('div');
    d.dataset.id = t.id;
    d.className = 'crate min-w-[4rem] text-center px-4 py-3 rounded-xl bg-gradient-to-b from-slate-700 to-slate-900 border-2 border-slate-500 font-mono-math font-black text-4xl text-slate-50 shadow-lg';
    d.textContent = t.value;
    return d;
  }

  opEl(t, isBar = false) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = t.id;
    b.dataset.op = '1';
    const rankColor = isBar
      ? 'from-orange-700 to-orange-950 border-orange-400 text-orange-100'
      : t.value === '×' || t.value === '÷'
        ? 'from-sky-700 to-sky-950 border-sky-400 text-sky-100'
        : 'from-amber-700 to-amber-950 border-amber-400 text-amber-100';
    b.className = isBar
      ? `op-block w-[26rem] max-w-full h-9 rounded-full bg-gradient-to-r ${rankColor} border-2 font-black text-sm tracking-[0.3em] uppercase cursor-pointer`
      : `op-block w-14 h-14 rounded-xl bg-gradient-to-b ${rankColor} border-2 font-mono-math font-black text-3xl cursor-pointer shadow-lg`;
    b.textContent = isBar ? '÷ fraction bar ÷' : displayOp(t.value);
    this.bindOp(b, t.id);
    return b;
  }

  /** The exponent itself is the clickable "power" operation. */
  powerEl(t, expToken) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = t.id;
    b.dataset.op = '1';
    if (expToken) b.dataset.exp = expToken.id;
    b.className = 'op-block self-start -ml-1.5 -mt-4 min-w-[2.6rem] h-10 px-1.5 rounded-lg bg-gradient-to-b from-fuchsia-600 to-purple-950 border-2 border-fuchsia-400 font-mono-math font-black text-2xl text-fuchsia-50 cursor-pointer shadow-lg';
    b.textContent = expToken ? expToken.value : '^';
    b.title = 'Exponent: click to evaluate the power';
    this.bindOp(b, t.id);
    return b;
  }

  bindOp(el, id) {
    el.addEventListener('mouseenter', () => this.aimAt(id));
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.phase === 'aim') this.strike(id);
    });
  }

  /** Aim ring, hint glow, and the highlighted step while typing. */
  refreshTokenClasses() {
    if (!this.tokens) return;
    const legal = new Set(this.hintOn && this.phase === 'aim' ? getLegalMoves(this.tokens).map((i) => this.tokens[i].id) : []);
    const active = new Set();
    if (this.pending) {
      active.add(this.pending.opId);
      active.add(this.pending.left.id);
      active.add(this.pending.right.id);
    }
    this.el.beam.querySelectorAll('[data-id]').forEach((node) => {
      const id = node.dataset.id;
      node.classList.toggle('aimed', this.phase === 'aim' && id === this.aimId);
      node.classList.toggle('radar', legal.has(id));
      node.classList.toggle('active-step', active.has(id) || Boolean(node.dataset.exp && active.has(node.dataset.exp)));
      node.classList.toggle('dimmed', this.phase === 'type' && !active.has(id) && !(node.dataset.exp && active.has(node.dataset.exp)));
    });
  }

  flashToken(id) {
    const node = this.tokenEl(id);
    if (!node) return;
    node.classList.remove('blocker-flash');
    void node.offsetWidth;
    node.classList.add('blocker-flash');
    setTimeout(() => node.classList.remove('blocker-flash'), 1600);
  }

  renderLog() {
    const lines = this.logLines || [];
    this.el.log.innerHTML = lines.map((l, i) => {
      const last = i === lines.length - 1;
      const width = Math.max(55, 100 - i * 9);
      return `<div class="mx-auto" style="width:${width}%">
        ${l.step ? `<div class="text-[10px] font-mono-math text-amber-300/90 text-center mb-0.5">↓ ${formatPlain(l.step)}</div>` : ''}
        <div class="rounded-lg px-2 py-1.5 text-center font-mono-math font-bold ${last ? 'bg-sky-900/60 border border-sky-400 text-sky-50 text-base' : 'bg-slate-950/70 border border-sky-900/60 text-sky-200/80 text-sm'}">${formatMathHtml(l.text)}</div>
      </div>`;
    }).join('');
    if (this.task?.kind !== 'build') {
      this.el.log.innerHTML = '<p class="text-xs text-sky-300/60 text-center mt-6">Boss attack: no step log for this one.</p>';
    }
    this.el.log.scrollTop = this.el.log.scrollHeight;
  }

  renderConsole() {
    const typing = this.phase === 'type' && this.pending;
    this.el.keypad.querySelectorAll('button').forEach((b) => (b.disabled = !typing));
    const ad = this.el.answerDisplay;
    if (typing) {
      this.el.consoleLabel.textContent = 'Type the value of this step';
      ad.innerHTML = `<span class="text-slate-400 text-2xl">${this.pendingText()} =</span> <span class="text-amber-200">${this.typed || '_'}</span>`;
      ad.classList.add('glow-amber');
      this.el.actionBtn.textContent = '✔ Check (Enter)';
      this.el.actionBtn.disabled = !this.typed;
    } else if (this.phase === 'cage' || (this.task?.kind === 'cage' && this.phase === 'busy')) {
      this.el.consoleLabel.textContent = 'Cage Drop';
      ad.innerHTML = `<span class="text-slate-400 text-xl">Target</span> <span class="text-rose-300">${this.task.target}</span>`;
      ad.classList.remove('glow-amber');
      this.el.actionBtn.textContent = '🔒 Lock Cage (Enter)';
      this.el.actionBtn.disabled = this.phase !== 'cage';
    } else if (this.phase === 'spot' || (this.task?.kind === 'spot' && this.phase === 'busy')) {
      this.el.consoleLabel.textContent = 'Spot the Mistake';
      ad.innerHTML = '<span class="text-slate-400 text-xl">Click the wrong line</span>';
      ad.classList.remove('glow-amber');
      this.el.actionBtn.textContent = 'Pick a line (1–6)';
      this.el.actionBtn.disabled = true;
    } else {
      this.el.consoleLabel.textContent = 'Wrecking Ball';
      ad.innerHTML = '<span class="text-slate-400 text-xl">Aim ◄ ► · Strike: Space</span>';
      ad.classList.remove('glow-amber');
      this.el.actionBtn.textContent = '💥 Drop the Ball (Space)';
      this.el.actionBtn.disabled = this.phase !== 'aim';
    }
  }

  renderCage(locked = false) {
    const t = this.task;
    const { start, end, cursor } = this.cage;
    const parts = [];
    t.numbers.forEach((n, k) => {
      if (k > 0) parts.push(`<span class="font-mono-math font-black text-3xl ${t.ops[k - 1] === '×' ? 'text-sky-300' : 'text-amber-300'}">${displayOp(t.ops[k - 1])}</span>`);
      if (k === start) parts.push(`<span class="font-mono-math font-black text-4xl text-cyan-300 ${locked ? '' : 'animate-pulse'}">(</span>`);
      const inCage = start !== null && k >= start && k <= (end ?? start);
      parts.push(`<button type="button" data-cage="${k}" class="cage-num px-4 py-2.5 rounded-xl border-2 font-mono-math font-black text-3xl cursor-pointer transition-all
        ${inCage ? 'bg-cyan-900/60 border-cyan-300 text-cyan-50' : 'bg-gradient-to-b from-slate-700 to-slate-900 border-slate-500 text-slate-50'}
        ${k === cursor && !locked ? 'ring-4 ring-amber-400/70' : ''}">${n}</button>`);
      if (k === end) parts.push(`<span class="font-mono-math font-black text-4xl text-cyan-300">)</span>`);
    });
    this.el.cagePanel.innerHTML = `
      <div class="flex flex-col items-center gap-5">
        <div class="flex items-center gap-2">${parts.join('')}</div>
        <div class="flex items-center gap-3 text-sm">
          <span class="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300">No cage = <b class="font-mono-math text-white">${t.baseValue}</b></span>
          <span class="px-3 py-1.5 rounded-xl bg-rose-950/60 border border-rose-600 text-rose-200">Target = <b class="font-mono-math text-white text-lg">${t.target}</b></span>
        </div>
        <p class="text-[11px] text-slate-500">Click the first and last number to cage · ◄ ► + Space also work · Backspace clears</p>
      </div>`;
    this.el.cagePanel.querySelectorAll('[data-cage]').forEach((b) =>
      b.addEventListener('click', () => this.cageClick(Number(b.dataset.cage))),
    );
  }

  renderSpot(correctLine = null, wrongPick = null) {
    const t = this.task;
    this.el.spotPanel.innerHTML = `
      <div class="w-full max-w-xl mx-auto space-y-2">
        ${t.lines.map((line, i) => {
          if (i === 0) {
            return `<div class="px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-700 font-mono-math font-black text-xl text-slate-100 flex items-center gap-3">
              <span class="text-[10px] font-sans font-black uppercase text-slate-500 w-14">Start</span>${formatMathHtml(line)}</div>`;
          }
          const state = correctLine === i
            ? 'border-emerald-400 bg-emerald-950/60 text-emerald-100'
            : wrongPick === i ? 'border-rose-500 bg-rose-950/50 text-rose-100' : 'border-slate-700 bg-slate-950 hover:border-amber-400 text-slate-100';
          return `<button type="button" data-line="${i}" class="w-full text-left px-4 py-2 rounded-xl border-2 ${state} font-mono-math font-black text-xl flex items-center gap-3 cursor-pointer transition-all">
            <span class="text-[10px] font-sans font-black uppercase text-amber-400 w-14">Line ${i}</span>= ${formatMathHtml(line)}</button>`;
        }).join('')}
      </div>`;
    this.el.spotPanel.querySelectorAll('[data-line]').forEach((b) =>
      b.addEventListener('click', () => this.pickSpotLine(Number(b.dataset.line))),
    );
  }

  setFeedback(kind, title, text) {
    const styles = {
      idle: ['📟', 'text-slate-300', 'border-slate-800'],
      good: ['✅', 'text-emerald-300', 'border-emerald-700/70'],
      fault: ['⚠️', 'text-rose-300', 'border-rose-700/70'],
      hint: ['📡', 'text-cyan-300', 'border-cyan-700/70'],
    }[kind];
    this.el.feedbackIcon.textContent = styles[0];
    this.el.feedbackTitle.textContent = title;
    this.el.feedbackTitle.className = `text-xs font-black uppercase tracking-wider ${styles[1]}`;
    this.el.feedback.className = `min-h-[84px] rounded-xl border bg-slate-900/70 p-3 overflow-hidden ${styles[2]}`;
    this.el.feedbackText.textContent = text;
  }

  // ------------------------------------------------------------------
  // Crane animation and juice
  // ------------------------------------------------------------------
  positionCrane(instant = false) {
    if (this.task?.kind !== 'build') return;
    const target = this.tokenEl(this.aimId);
    if (!target) return;
    const tr = target.getBoundingClientRect();
    const sr = this.el.stage.getBoundingClientRect();
    this.craneTargetX = tr.left + tr.width / 2 - sr.left;
    if (instant) this.craneX = this.craneTargetX;
    const legal = getLegalMoves(this.tokens).some((i) => this.tokens[i].id === this.aimId);
    // The light only shows readiness when the radar hint is on, so it isn't a free answer.
    this.el.trolleyLight.className = `w-2.5 h-2.5 rounded-full transition-all ${this.hintOn && legal ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400 shadow-[0_0_6px_#f59e0b]'}`;
  }

  dropBall(targetEl, onImpact) {
    soundEngine.playHydraulicDrop();
    const cable = this.el.cable;
    const ball = this.el.ball;
    const sr = this.el.stage.getBoundingClientRect();
    const rigBottom = this.el.ball.getBoundingClientRect().bottom - sr.top;
    const tr = targetEl ? targetEl.getBoundingClientRect() : null;
    const dist = tr ? Math.max(30, tr.top - sr.top - rigBottom + 4) : 120;
    const baseCable = 48;

    cable.style.transition = 'height 0.22s cubic-bezier(0.55, 0.055, 0.675, 0.19)';
    ball.style.transition = 'transform 0.22s cubic-bezier(0.55, 0.055, 0.675, 0.19)';
    cable.style.height = `${baseCable + dist}px`;
    ball.style.transform = `translateY(${dist}px)`;

    setTimeout(() => {
      onImpact();
      setTimeout(() => {
        cable.style.transition = 'height 0.35s cubic-bezier(0.215, 0.61, 0.355, 1)';
        ball.style.transition = 'transform 0.35s cubic-bezier(0.215, 0.61, 0.355, 1)';
        cable.style.height = `${baseCable}px`;
        ball.style.transform = 'translateY(0px)';
      }, 120);
    }, 230);
  }

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
    const r = this.el.stage.getBoundingClientRect();
    this.burst(r.left + r.width / 2, r.top + r.height / 2, 'victory');
    setTimeout(() => s.classList.add('hidden'), 1100);
  }

  floatText(text, cls) {
    const r = this.el.answerDisplay.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = `float-text font-black font-mono-math text-xl ${cls}`;
    f.style.left = `${r.left + r.width / 2}px`;
    f.style.top = `${r.top - 10}px`;
    f.textContent = text;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1000);
  }

  burst(x, y, type) {
    const colors = type === 'demolition'
      ? ['#f59e0b', '#fbbf24', '#f97316', '#ef4444', '#cbd5e1']
      : type === 'clank' ? ['#ef4444', '#dc2626', '#f87171', '#94a3b8'] : ['#10b981', '#34d399', '#f59e0b', '#38bdf8', '#a855f7'];
    const count = type === 'victory' ? 80 : type === 'demolition' ? 40 : 22;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = Math.random() * (type === 'victory' ? 10 : 7) + 2;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3,
        size: Math.random() * 4 + 2, color: colors[i % colors.length], alpha: 1, decay: Math.random() * 0.025 + 0.02,
      });
    }
  }

  loop(now) {
    const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;
    this.craneX += (this.craneTargetX - this.craneX) * Math.min(1, dt * 14);
    this.el.trolley.style.transform = `translateX(${this.craneX}px)`;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.el.fxCanvas.width, this.el.fxCanvas.height);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.28;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame((t) => this.loop(t));
  }

  // ------------------------------------------------------------------
  // Modals
  // ------------------------------------------------------------------
  showModal(name) {
    this.hideAllModals();
    this.modal = name;
    const map = {
      briefing: this.el.modalBriefing,
      zoneClear: this.el.modalZoneClear,
      breakdown: this.el.modalBreakdown,
      debrief: this.el.modalDebrief,
      guide: this.el.modalGuide,
      sandbox: this.el.modalSandbox,
    };
    map[name]?.classList.remove('hidden');
    // The briefing close button only makes sense mid-run.
    if (name === 'briefing') this.el.briefingCloseBtn.classList.toggle('hidden', !this.stage || this.phase === 'idle');
  }

  hideAllModals() {
    [this.el.modalBriefing, this.el.modalZoneClear, this.el.modalBreakdown, this.el.modalDebrief, this.el.modalGuide, this.el.modalSandbox]
      .forEach((m) => m.classList.add('hidden'));
  }

  /** Guide and briefing can be opened over a run and closed back into it. */
  openOverlay(name) {
    if (this.modal === 'play') {
      this.resumeTo = 'play';
      this.showModal(name);
    } else if (this.modal === 'briefing' && name === 'guide') {
      this.resumeTo = 'briefing';
      this.showModal('guide');
    }
  }

  closeOverlay() {
    const back = this.resumeTo || 'briefing';
    this.resumeTo = null;
    if (back === 'play') {
      this.hideAllModals();
      this.modal = 'play';
    } else {
      this.showModal(back);
    }
  }

  openSandbox(message = '') {
    this.phase = 'idle';
    this.stage = null;
    this.showModal('sandbox');
    this.el.sandboxResult.textContent = message;
    this.el.sandboxResult.classList.toggle('hidden', !message);
    this.el.sandboxError.textContent = '';
    this.el.sandboxInput.value = '';
    setTimeout(() => this.el.sandboxInput.focus(), 30);
  }

  submitSandbox() {
    const raw = this.el.sandboxInput.value.trim();
    try {
      const tokens = parseExpressionToTokens(raw);
      if (!tokens.some(isOperatorToken)) throw new Error('Add at least one operation.');
      const v = evaluateTokens(tokens).value;
      if (!Number.isFinite(v)) throw new Error('That expression divides by zero.');
      this.startSandbox(raw.replace(/\*/g, '×'));
    } catch (err) {
      this.el.sandboxError.textContent = err.message;
    }
  }

  updateAudioIcon() {
    this.el.audioIcon.textContent = soundEngine.getMuted() ? '🔇' : '🔊';
  }

  // ------------------------------------------------------------------
  // Input
  // ------------------------------------------------------------------
  bindEvents() {
    const el = this.el;
    el.briefingStartBtn.addEventListener('click', () => this.startRun(false));
    el.briefingPracticeBtn.addEventListener('click', () => this.startRun(true));
    el.briefingSandboxBtn.addEventListener('click', () => this.openSandbox());
    el.briefingCloseBtn.addEventListener('click', () => this.closeOverlay());
    el.briefingBtn.addEventListener('click', () => this.openOverlay('briefing'));
    el.guideBtn.addEventListener('click', () => this.openOverlay('guide'));
    el.guideCloseBtn.addEventListener('click', () => this.closeOverlay());
    el.zoneClearBtn.addEventListener('click', () => this.continueFromZoneClear());
    el.debriefAgainBtn.addEventListener('click', () => {
      this.stage = null;
      this.phase = 'idle';
      this.showModal('briefing');
    });
    el.hintBtn.addEventListener('click', () => this.useHint());
    el.audioBtn.addEventListener('click', () => {
      soundEngine.setMuted(!soundEngine.getMuted());
      this.updateAudioIcon();
    });
    el.actionBtn.addEventListener('click', () => {
      if (this.phase === 'aim') this.strike();
      else if (this.phase === 'type') this.submitValue();
      else if (this.phase === 'cage') this.lockCage();
    });
    el.sandboxForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitSandbox();
    });
    el.sandboxCloseBtn.addEventListener('click', () => {
      this.isSandbox = false;
      this.showModal('briefing');
    });
    document.querySelectorAll('.sandbox-chip').forEach((chip) =>
      chip.addEventListener('click', () => {
        el.sandboxInput.value += chip.dataset.insert;
        el.sandboxInput.focus();
      }),
    );

    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  onKey(e) {
    const k = e.key;
    if (this.modal === 'sandbox') {
      if (k === 'Escape') this.el.sandboxCloseBtn.click();
      return; // typing goes into the input
    }
    if (this.modal === 'briefing') {
      if (k === 'Enter') { e.preventDefault(); this.startRun(false); }
      else if (k === 'p' || k === 'P') this.startRun(true);
      else if (k === 'b' || k === 'B') this.openSandbox();
      else if (k === 'Escape' && this.resumeTo === 'play') this.closeOverlay();
      return;
    }
    if (this.modal === 'guide') {
      if (k === 'Escape' || k === 'Enter' || k === '?') { e.preventDefault(); this.closeOverlay(); }
      return;
    }
    if (this.modal === 'zoneClear') {
      if (k === 'Enter' || k === ' ') { e.preventDefault(); this.continueFromZoneClear(); }
      return;
    }
    if (this.modal === 'debrief') {
      if (k === 'Enter') { e.preventDefault(); this.el.debriefAgainBtn.click(); }
      return;
    }
    if (this.modal !== 'play') return;

    if (k === '?') { this.openOverlay('guide'); return; }
    if (k === 'h' || k === 'H') { this.useHint(); return; }

    if (this.phase === 'aim') {
      if (k === 'ArrowLeft') { e.preventDefault(); this.moveAim(-1); }
      else if (k === 'ArrowRight') { e.preventDefault(); this.moveAim(1); }
      else if (k === ' ' || k === 'Enter') { e.preventDefault(); this.strike(); }
    } else if (this.phase === 'type') {
      if (/^[0-9.]$/.test(k) || k === 'Backspace' || k === 'Enter') { e.preventDefault(); this.pressKey(k); }
    } else if (this.phase === 'cage') {
      const n = this.task.numbers.length;
      if (k === 'ArrowLeft') { e.preventDefault(); this.cage.cursor = (this.cage.cursor - 1 + n) % n; this.renderCage(); }
      else if (k === 'ArrowRight') { e.preventDefault(); this.cage.cursor = (this.cage.cursor + 1) % n; this.renderCage(); }
      else if (k === ' ') { e.preventDefault(); this.cageClick(this.cage.cursor); }
      else if (k === 'Backspace') { this.cage = { start: null, end: null, cursor: this.cage.cursor }; this.renderCage(); }
      else if (k === 'Enter') { e.preventDefault(); this.lockCage(); }
    } else if (this.phase === 'spot') {
      if (/^[1-9]$/.test(k)) this.pickSpotLine(Number(k));
    }
  }
}

function boot() {
  if (window.craneGame) return;
  window.craneGame = new DemolitionCraneGame();
  window.craneGame.init();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
