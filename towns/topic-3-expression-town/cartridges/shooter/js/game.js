/**
 * Term Popper - Game Engine (Lesson 3-7: Combining Like Terms)
 *
 * Bubble shooter where the bubbles are terms:
 *   - A term that lands touching like terms COMBINES with them (coefficients add) into one bubble.
 *   - If the combined coefficient is 0 the whole group POPS, and anything left hanging falls.
 *   - Unlike terms just stick. Sticking while a like term was on the board is a MISFIRE.
 *
 * Stakes: a shot clock drops a new row of terms from the ceiling (misfires cost 3 shots);
 * a bubble crossing the red line ends the stage (instant retry).
 * Run = 3 stages (zero-pop goals) + the Term Colossus boss, who shape-shifts terms into look-alikes.
 */

import { RADIUS, ROW_HEIGHT, Board } from './board.js?v=20261110pop1';
import { makeRng, buildBoard, dropCeiling, nextShot } from './generator.js?v=20261110pop1';
import { STAGES, BOSS, LESSON_ID, MISFIRE_COST, DANGER_Y } from './curriculum.js?v=20261110pop1';
import { formatTerm, formatCombination, explainUnlike, lookAlike, kindName, formatSig } from './terms.js?v=20261110pop1';
import { soundEngine } from './audio.js?v=20261110pop1';

const W = 800;
const H = 600;
const TURRET = { x: 400, y: 552 };
const NEXT_POS = { x: 300, y: 566 };
const SHOT_SPEED = 980; // px per second
const MIN_ANGLE = (10 * Math.PI) / 180;
const MAX_ANGLE = (170 * Math.PI) / 180;
const ALL_STAGES = [...STAGES, BOSS];

const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------------------
// Bubble sprites (cached per label). No color-coding by kind of term: students must READ.
// Only the sign changes the rim (warm = negative) so cancelling is easy to plan.
// ---------------------------------------------------------------------------
const spriteCache = new Map();

function bubbleSprite(t) {
  const label = formatTerm(t);
  const neg = t.coef < 0;
  const key = label;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const pad = 6;
  const size = RADIUS * 2 + pad * 2;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const g = cv.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const R = RADIUS - 1;

  const body = g.createRadialGradient(cx - R * 0.35, cy - R * 0.45, R * 0.1, cx, cy, R);
  if (neg) {
    body.addColorStop(0, '#6b4a7a');
    body.addColorStop(0.55, '#3d2147');
    body.addColorStop(1, '#1d0e24');
  } else {
    body.addColorStop(0, '#5e5a9e');
    body.addColorStop(0.55, '#2f2a68');
    body.addColorStop(1, '#140f33');
  }
  g.fillStyle = body;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();

  g.lineWidth = 2.5;
  g.strokeStyle = neg ? '#fb7185' : '#a5b4fc';
  g.stroke();

  // gloss
  g.beginPath();
  g.ellipse(cx - R * 0.3, cy - R * 0.52, R * 0.42, R * 0.2, -0.5, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.fill();

  // label, shrunk to fit
  let fs = 19;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  do {
    g.font = `800 ${fs}px "JetBrains Mono", ui-monospace, monospace`;
    if (g.measureText(label).width <= R * 1.7) break;
    fs -= 1;
  } while (fs > 10);
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.strokeText(label, cx, cy + 1);
  g.fillStyle = '#ffffff';
  g.fillText(label, cx, cy + 1);

  spriteCache.set(key, cv);
  return cv;
}

function drawBubble(ctx, t, x, y, scale = 1, alpha = 1) {
  const sp = bubbleSprite(t);
  const s = sp.width * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(sp, x - s / 2, y - s / 2, s, s);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------
class Particle {
  constructor(x, y, color, speed = 1) {
    const a = Math.random() * Math.PI * 2;
    const v = (60 + Math.random() * 260) * speed;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(a) * v;
    this.vy = Math.sin(a) * v;
    this.r = 2 + Math.random() * 3.5;
    this.life = 0.5 + Math.random() * 0.5;
    this.max = this.life;
    this.color = color;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 420 * dt;
    this.vx *= 0.98;
    this.life -= dt;
  }

  draw(ctx) {
    ctx.globalAlpha = clamp(this.life / this.max, 0, 1);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Ring {
  constructor(x, y, maxR, color, life = 0.45) {
    Object.assign(this, { x, y, maxR, color, life, max: life });
  }

  update(dt) { this.life -= dt; }

  draw(ctx) {
    const k = 1 - this.life / this.max;
    ctx.globalAlpha = clamp(1 - k, 0, 1);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 4 * (1 - k) + 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 8 + k * this.maxR, 0, Math.PI * 2);
    ctx.stroke();
  }
}

class Popup {
  constructor(x, y, text, color = '#fff', size = 18, life = 1.1) {
    Object.assign(this, { x, y, text, color, size, life, max: life });
  }

  update(dt) {
    this.life -= dt;
    this.y -= 38 * dt;
  }

  draw(ctx) {
    const k = 1 - this.life / this.max;
    const scale = k < 0.15 ? 0.6 + (k / 0.15) * 0.4 : 1;
    ctx.globalAlpha = clamp(this.life / (this.max * 0.4), 0, 1);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);
    ctx.font = `900 ${this.size}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(10,4,24,0.85)';
    ctx.strokeText(this.text, 0, 0);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
  }
}

/** A bubble flying from one spot to another (combining), then optionally bursting. */
class Flyer {
  constructor(t, from, to, dur, burst) {
    Object.assign(this, { t, from, to, dur, burst, age: 0, done: false });
  }

  update(dt, game) {
    this.age += dt;
    if (this.age >= this.dur && !this.done) {
      this.done = true;
      if (this.burst) game.burst(this.to.x, this.to.y, '#fde047', 10);
    }
  }

  draw(ctx) {
    const k = clamp(this.age / this.dur, 0, 1);
    const e = k * k;
    const x = this.from.x + (this.to.x - this.from.x) * e;
    const y = this.from.y + (this.to.y - this.from.y) * e;
    drawBubble(ctx, this.t, x, y, 1 - 0.35 * e, 1 - 0.4 * e);
  }
}

/** A bubble that lost its support and falls off the screen. */
class Faller {
  constructor(t, x, y) {
    this.t = t;
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 120;
    this.vy = -80 - Math.random() * 80;
    this.spin = (Math.random() - 0.5) * 6;
    this.rot = 0;
    this.done = false;
  }

  update(dt) {
    this.vy += 1300 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.spin * dt;
    if (this.y > H + 40) this.done = true;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    drawBubble(ctx, this.t, 0, 0, 1, 0.9);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------
class TermPopper {
  constructor() {
    this.canvas = $('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.embedded = window.parent !== window;

    this.mode = 'briefing'; // briefing | play | stageClear | defeat | debrief | paused
    this.started = false;
    this.angle = Math.PI / 2;
    this.keys = { left: false, right: false };
    this.time = 0;
    this.fx = [];
    this.shake = 0;
    this.dropAnim = 0;
    this.boardVersion = 0;
    this.guideCache = null;

    this.bindUI();
    this.fit();
    this.newRun();
    this.startStage(0, true); // board shows behind the briefing
    this.mode = 'briefing';
    this.lastFrame = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  // ------------------------------------------------------------------ setup
  bindUI() {
    $('startBtn').addEventListener('click', () => this.closeBriefing());
    $('guideBtn').addEventListener('click', () => this.openGuide());
    $('muteBtn').addEventListener('click', () => this.toggleMute());
    $('continueBtn').addEventListener('click', () => this.continueAfterClear());
    $('retryBtn').addEventListener('click', () => this.retryStage());
    $('againBtn').addEventListener('click', () => { this.newRun(); this.startStage(0); });
    $('muteIcon').textContent = soundEngine.isMuted ? '🔇' : '🔊';
    // Drop focus after clicks so Space/Enter go to the game, not the last button pressed.
    document.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => b.blur()));

    if (this.embedded) {
      $('exitBtn').classList.remove('hidden');
      $('townBtn').classList.remove('hidden');
    }
    const exit = () => {
      try { window.parent.postMessage({ type: 'CARTRIDGE_EXIT_REQUEST' }, '*'); } catch (e) { /* not embedded */ }
    };
    $('exitBtn').addEventListener('click', exit);
    $('townBtn').addEventListener('click', exit);

    const c = this.canvas;
    c.addEventListener('mousemove', (e) => this.aimAt(e.clientX, e.clientY));
    c.addEventListener('mousedown', (e) => {
      if (e.button === 2) return;
      this.aimAt(e.clientX, e.clientY);
      if (this.hitsNext(e.clientX, e.clientY)) this.swap();
      else this.fire();
    });
    c.addEventListener('contextmenu', (e) => { e.preventDefault(); this.swap(); });
    c.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      this.touchOnNext = this.hitsNext(t.clientX, t.clientY);
      if (!this.touchOnNext) this.aimAt(t.clientX, t.clientY);
    }, { passive: false });
    c.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!this.touchOnNext) this.aimAt(t.clientX, t.clientY);
    }, { passive: false });
    c.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (this.touchOnNext) this.swap();
      else this.fire();
      this.touchOnNext = false;
    }, { passive: false });

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('resize', () => this.fit());
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'HUB_INIT' && typeof e.data.payload?.isMuted === 'boolean') {
        soundEngine.setMuted(e.data.payload.isMuted);
        $('muteIcon').textContent = e.data.payload.isMuted ? '🔇' : '🔊';
      }
    });
    // Tell the Expression Town hub we're loaded so it replies with HUB_INIT (mute setting)
    try { if (this.embedded) window.parent.postMessage({ type: 'CARTRIDGE_READY' }, '*'); } catch (e) { /* not embedded */ }
  }

  /** Largest 4:3 box that fits the play area. */
  fit() {
    const main = this.canvas.parentElement.parentElement;
    const wrap = $('stageWrap');
    const w = main.clientWidth;
    const h = main.clientHeight;
    const scale = Math.min(w / W, h / H);
    wrap.style.width = `${Math.floor(W * scale)}px`;
    wrap.style.height = `${Math.floor(H * scale)}px`;
  }

  onKey(e, down) {
    const k = e.key;
    if (k === 'ArrowLeft') { this.keys.left = down; e.preventDefault(); return; }
    if (k === 'ArrowRight') { this.keys.right = down; e.preventDefault(); return; }
    if (!down) return;
    const lower = k.toLowerCase();
    if (lower === 'm') { this.toggleMute(); return; }

    if (this.mode === 'briefing') {
      if (k === 'Enter' || (k === 'Escape' && this.started)) { e.preventDefault(); this.closeBriefing(); }
      return;
    }
    if (this.mode === 'stageClear') {
      if (k === 'Enter' || k === ' ') { e.preventDefault(); this.continueAfterClear(); }
      return;
    }
    if (this.mode === 'defeat') {
      if (k === 'Enter' || k === ' ') { e.preventDefault(); this.retryStage(); }
      return;
    }
    if (this.mode === 'debrief') {
      if (k === 'Enter') {
        e.preventDefault();
        if (this.embedded) $('townBtn').click();
        else { this.newRun(); this.startStage(0); }
      }
      return;
    }
    if (this.mode !== 'play') return;
    if (k === ' ' || k === 'ArrowUp') { e.preventDefault(); this.fire(); return; }
    if (lower === 's' || k === 'Shift' || k === 'ArrowDown') { e.preventDefault(); this.swap(); return; }
    if (lower === 'h' || k === '?') { this.openGuide(); }
  }

  toCanvas(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
  }

  aimAt(clientX, clientY) {
    const p = this.toCanvas(clientX, clientY);
    const dy = TURRET.y - p.y;
    const dx = p.x - TURRET.x;
    if (dy < 8) {
      this.angle = dx < 0 ? MAX_ANGLE : MIN_ANGLE;
      return;
    }
    this.angle = clamp(Math.atan2(dy, dx), MIN_ANGLE, MAX_ANGLE);
  }

  hitsNext(clientX, clientY) {
    const p = this.toCanvas(clientX, clientY);
    return Math.hypot(p.x - NEXT_POS.x, p.y - NEXT_POS.y) < RADIUS + 8;
  }

  toggleMute() {
    const muted = soundEngine.toggleMuted();
    $('muteIcon').textContent = muted ? '🔇' : '🔊';
  }

  // ------------------------------------------------------------------ flow
  newRun() {
    this.rng = makeRng(Date.now());
    this.stageIndex = 0;
    this.score = 0;
    this.totalShots = 0; // shots that had a like term available (stars + hub score)
    this.totalMisfires = 0;
    this.totalZeros = 0;
    this.stars = [];
    this.reported = false;
    this.hide('debrief');
    this.hide('defeat');
    this.hide('stageClear');
  }

  get stage() {
    return ALL_STAGES[this.stageIndex];
  }

  get isBoss() {
    return this.stage === BOSS;
  }

  startStage(index, quiet = false) {
    this.stageIndex = index;
    const st = this.stage;
    this.board = new Board({ top: st.top || 0 });
    buildBoard(this.board, st, this.rng);
    this.current = nextShot(this.board, st, this.rng);
    this.next = nextShot(this.board, st, this.rng);
    this.clock = st.clock;
    this.zeros = 0;
    this.combo = 0;
    this.stageShots = 0;
    this.stageMisfires = 0;
    this.misfireKinds = { constant: 0, exponent: 0, variable: 0 };
    this.bullet = null;
    this.fx = [];
    this.dropAnim = 0;
    this.dangerWarned = false;
    this.boss = this.isBoss ? { hp: BOSS.hp, hurt: 0, shift: 0, sinceShift: 0, intro: 1.4 } : null;
    this.mode = 'play';
    this.touchBoard();
    this.hide('defeat');
    this.hide('stageClear');
    this.hide('debrief');
    this.updateHUD();
    this.setTicker('🎯', this.isBoss ? 'The Term Colossus rises!' : st.short, `${st.blurb} ${st.tip}`);
    if (quiet) return;
    this.showBanner(st.name, st.blurb);
    if (this.isBoss) soundEngine.playBossRoar();
  }

  closeBriefing() {
    this.hide('briefing');
    soundEngine.playClick();
    if (!this.started) {
      this.started = true;
      this.mode = 'play';
      this.showBanner(this.stage.name, this.stage.blurb);
      return;
    }
    this.mode = this.pausedMode || 'play';
  }

  openGuide() {
    if (this.mode !== 'play') return;
    this.pausedMode = 'play';
    this.mode = 'briefing';
    $('startBtn').textContent = '▶ RESUME (Enter)';
    this.show('briefing');
  }

  retryStage() {
    if (this.mode !== 'defeat') return;
    soundEngine.playClick();
    this.startStage(this.stageIndex);
  }

  continueAfterClear() {
    if (this.mode !== 'stageClear') return;
    soundEngine.playClick();
    this.startStage(this.stageIndex + 1);
  }

  show(id) { $(id).classList.remove('hidden'); }

  hide(id) { $(id).classList.add('hidden'); }

  showBanner(title, text) {
    $('bannerTitle').textContent = title;
    $('bannerText').textContent = text;
    const b = $('banner');
    b.classList.remove('hidden');
    b.firstElementChild.classList.remove('pop-in');
    void b.offsetWidth;
    b.firstElementChild.classList.add('pop-in');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => b.classList.add('hidden'), 2000);
  }

  setTicker(icon, math, note) {
    $('tickerIcon').textContent = icon;
    const m = $('tickerMath');
    m.textContent = math;
    m.classList.remove('ticker-flash');
    void m.offsetWidth;
    m.classList.add('ticker-flash');
    $('tickerNote').textContent = note || '';
  }

  updateHUD() {
    const st = this.stage;
    $('hudStage').textContent = st.name;
    $('hudScore').textContent = this.score.toLocaleString();

    const mult = this.multiplier();
    const combo = $('hudCombo');
    combo.textContent = `x${mult}`;
    combo.className = `pill min-w-[54px] justify-center border ${mult > 1 ? 'bg-amber-500/20 text-amber-300 border-amber-400' : 'bg-[#241640] text-violet-300 border-[#4c3a75]'}`;

    const pips = $('hudGoalPips');
    if (this.isBoss) {
      $('hudGoalLabel').textContent = `Term Colossus ${Math.max(0, this.boss.hp)}/${BOSS.hp}`;
      pips.classList.add('hidden');
      $('hudBossBar').classList.remove('hidden');
      $('hudBossFill').style.width = `${(Math.max(0, this.boss.hp) / BOSS.hp) * 100}%`;
    } else {
      $('hudGoalLabel').textContent = `Zero-pops ${this.zeros}/${st.goal}`;
      pips.classList.remove('hidden');
      $('hudBossBar').classList.add('hidden');
      pips.innerHTML = '';
      for (let i = 0; i < st.goal; i++) {
        const d = document.createElement('div');
        d.className = `pip${i < this.zeros ? ' on' : ''}`;
        pips.appendChild(d);
      }
    }

    const clockPips = $('hudClockPips');
    clockPips.innerHTML = '';
    for (let i = 0; i < st.clock; i++) {
      const d = document.createElement('div');
      let cls = 'clock-pip';
      if (i >= this.clock) cls += ' off';
      else if (this.clock <= 2) cls += ' danger';
      else if (this.clock <= 4) cls += ' warn';
      d.className = cls;
      clockPips.appendChild(d);
    }
    const label = $('hudClockLabel');
    label.textContent = `Ceiling drops in ${this.clock}`;
    label.className = `text-[10px] uppercase font-bold tracking-wider ${this.clock <= 2 ? 'text-rose-400 urgent' : this.clock <= 4 ? 'text-amber-300' : 'text-emerald-300'}`;
  }

  multiplier() {
    return [1, 1, 1.5, 2, 2.5, 3][Math.min(this.combo, 5)];
  }

  touchBoard() {
    this.boardVersion++;
    this.guideCache = null;
  }

  // ------------------------------------------------------------------ shooting
  swap() {
    if (this.mode !== 'play' || this.bullet) return;
    [this.current, this.next] = [this.next, this.current];
    soundEngine.playSwap();
  }

  fire() {
    if (this.mode !== 'play' || this.bullet || !this.current) return;
    soundEngine.playShoot();
    const dx = Math.cos(this.angle);
    const dy = -Math.sin(this.angle);
    this.bullet = { t: this.current, x: TURRET.x, y: TURRET.y, dx, dy };
    this.recoil = 1;
    for (let i = 0; i < 6; i++) this.fx.push(new Particle(TURRET.x + dx * 40, TURRET.y + dy * 40, '#c4b5fd', 0.5));
    this.current = this.next;
    this.next = nextShot(this.board, this.stage, this.rng);
  }

  /**
   * Move a ball up to `dist` px. Returns 'ceiling' | 'hit' | null.
   * The aim guide uses the same function, so the guide is exactly where the shot goes.
   */
  advance(ball, dist, onBounce) {
    const bottom = this.board.lowestEdge() + RADIUS;
    let moved = 0;
    while (moved < dist) {
      const s = Math.min(4, dist - moved);
      ball.x += ball.dx * s;
      ball.y += ball.dy * s;
      moved += s;
      if (ball.x < RADIUS) {
        ball.x = 2 * RADIUS - ball.x;
        ball.dx = Math.abs(ball.dx);
        if (onBounce) onBounce(ball);
      } else if (ball.x > W - RADIUS) {
        ball.x = 2 * (W - RADIUS) - ball.x;
        ball.dx = -Math.abs(ball.dx);
        if (onBounce) onBounce(ball);
      }
      if (ball.y - RADIUS <= this.board.top) return 'ceiling';
      if (ball.y - RADIUS < bottom && this.board.collision(ball.x, ball.y)) return 'hit';
    }
    return null;
  }

  /** Aim guide path + the cell the shot would land in. Cached per angle/board. */
  guide() {
    const key = `${this.angle.toFixed(4)}|${this.boardVersion}`;
    if (this.guideCache && this.guideCache.key === key) return this.guideCache;
    const ball = { x: TURRET.x, y: TURRET.y, dx: Math.cos(this.angle), dy: -Math.sin(this.angle) };
    const points = [{ x: ball.x, y: ball.y }];
    const stop = this.advance(ball, 2400, (b) => points.push({ x: b.x, y: b.y }));
    points.push({ x: ball.x, y: ball.y });
    const cell = stop ? this.board.snapCell(ball.x, ball.y) : null;
    this.guideCache = { key, points, cell };
    return this.guideCache;
  }

  updateBullet(dt) {
    const b = this.bullet;
    const stop = this.advance(b, SHOT_SPEED * dt, () => soundEngine.playBounce());
    if (!stop) return;
    const cell = this.board.snapCell(b.x, b.y);
    this.bullet = null;
    if (!cell) {
      this.lose();
      return;
    }
    this.land(cell, b.t);
  }

  land(cell, shot) {
    const st = this.stage;
    const at = this.board.center(cell.r, cell.c);
    const res = this.board.resolveShot(cell.r, cell.c, shot);
    this.touchBoard();
    this.clock -= 1;

    const counted = res.kind !== 'stick' || res.misfire; // free placements don't count against you
    if (counted) {
      this.stageShots++;
      this.totalShots++;
    }

    if (res.kind === 'zero') this.onZero(res, at);
    else if (res.kind === 'combine') this.onCombine(res);
    else this.onStick(res, shot, at);

    if (res.dropped.length) this.onDropped(res.dropped);
    this.updateHUD();

    // Win checks first
    if (this.isBoss) {
      if (this.boss.hp <= 0) { this.winBoss(); return; }
    } else if (this.zeros >= st.goal || this.board.count() === 0) {
      this.clearStage();
      return;
    }
    if (this.board.count() === 0) {
      // Boss with an empty board: refill so the fight continues.
      dropCeiling(this.board, st, this.rng);
      this.touchBoard();
    }

    if (this.clock <= 0) this.ceilingDrop();
    if (this.isBoss && this.mode === 'play') {
      this.boss.sinceShift++;
      if (this.boss.sinceShift >= BOSS.shiftEvery) this.shapeShift();
    }
    this.checkDanger();
    this.updateHUD();
  }

  onZero(res, at) {
    this.combo++;
    this.zeros++;
    this.totalZeros++;
    const mult = this.multiplier();
    const pts = Math.round(100 * res.cells.length * mult);
    this.score += pts;
    soundEngine.playZero(res.cells.length, this.combo);
    this.shake = Math.min(14, 6 + res.cells.length * 2);
    res.cells.forEach((p) => {
      const from = this.board.center(p.r, p.c);
      this.fx.push(new Flyer(p.t, from, at, 0.16, false));
    });
    setTimeout(() => {
      this.burst(at.x, at.y, '#fde047', 26);
      this.burst(at.x, at.y, '#f0abfc', 14);
      this.fx.push(new Ring(at.x, at.y, 90, '#fde047'));
      this.fx.push(new Ring(at.x, at.y, 50, '#ffffff', 0.3));
    }, 160);
    this.fx.push(new Popup(at.x, at.y - 10, '0  POP!', '#fde047', 26));
    this.fx.push(new Popup(at.x, at.y + 22, `+${pts}`, '#86efac', 16));
    this.setTicker('💥', formatCombination(res.cells.map((p) => p.t)),
      'Opposites cancel: the coefficients add to 0, so the whole group is gone.');

    if (this.isBoss) {
      const dmg = 1 + (res.dropped.length >= 3 ? 1 : 0) + (res.cells.length >= 4 ? 1 : 0);
      this.boss.hp -= dmg;
      this.boss.hurt = 0.5;
      soundEngine.playBossHit();
      this.fx.push(new Popup(W / 2, 60, `-${dmg} HP`, '#fb7185', 24));
      this.shake = 16;
    }
  }

  onCombine(res) {
    this.combo++;
    const mult = this.multiplier();
    const pts = Math.round(25 * res.cells.length * mult);
    this.score += pts;
    soundEngine.playCombine(this.combo);
    const to = this.board.center(res.keeper.r, res.keeper.c);
    res.cells.forEach((p) => {
      if (p.r === res.keeper.r && p.c === res.keeper.c) return;
      this.fx.push(new Flyer(p.t, this.board.center(p.r, p.c), to, 0.18, true));
    });
    this.fx.push(new Ring(to.x, to.y, 46, '#a5b4fc'));
    const result = formatTerm({ coef: res.total, sig: res.cells[0].t.sig });
    this.fx.push(new Popup(to.x, to.y - 34, `= ${result}`, '#c7d2fe', 18));
    this.setTicker('➕', formatCombination(res.cells.map((p) => p.t)),
      `Like terms: add the coefficients, keep the ${res.cells[0].t.sig ? `variable part ${formatSig(res.cells[0].t.sig)}` : 'constant'}. Get it to 0 to pop it!`);
  }

  onStick(res, shot, at) {
    if (!res.misfire) {
      soundEngine.playStick();
      this.setTicker('📌', `${formatTerm(shot)} parked`,
        `No ${kindName(shot.sig)} on the board, so it had nothing to combine with. No penalty.`);
      return;
    }
    this.combo = 0;
    this.stageMisfires++;
    this.totalMisfires++;
    this.clock -= MISFIRE_COST - 1;
    soundEngine.playMisfire();
    this.shake = 7;
    this.fx.push(new Ring(at.x, at.y, 40, '#fb7185'));
    this.fx.push(new Popup(at.x, at.y - 30, `MISFIRE  −${MISFIRE_COST}`, '#fb7185', 18));
    const n = res.unlikeNeighbor;
    let why;
    if (n) {
      why = explainUnlike(shot, n);
      if (!shot.sig || !n.sig) this.misfireKinds.constant++;
      else if (shot.sig.split('^')[0] === n.sig.split('^')[0]) this.misfireKinds.exponent++;
      else this.misfireKinds.variable++;
    } else {
      why = `It didn't touch anything it could combine with.`;
    }
    this.setTicker('✗', `${formatTerm(shot)} stuck: unlike terms`,
      `${why} Look for other ${kindName(shot.sig)}.`);
  }

  onDropped(dropped) {
    const pts = Math.round(dropped.length * 60 * this.multiplier());
    this.score += pts;
    soundEngine.playDrop(dropped.length);
    dropped.forEach((d) => this.fx.push(new Faller(d.t, d.x, d.y)));
    const avgX = dropped.reduce((a, d) => a + d.x, 0) / dropped.length;
    const maxY = Math.max(...dropped.map((d) => d.y));
    this.fx.push(new Popup(avgX, maxY + 10, `${dropped.length} DROPPED  +${pts}`, '#7dd3fc', 16, 1.3));
  }

  ceilingDrop() {
    const st = this.stage;
    dropCeiling(this.board, st, this.rng);
    this.touchBoard();
    this.clock = st.clock;
    this.dropAnim = 1;
    this.shake = 10;
    if (this.isBoss) {
      soundEngine.playBossRoar();
      this.fx.push(new Popup(W / 2, BOSS.top + 30, 'STOMP!', '#fb7185', 26));
    } else {
      soundEngine.playCeiling();
      this.fx.push(new Popup(W / 2, 40, '▼ CEILING DROP ▼', '#fb7185', 22));
    }
  }

  shapeShift() {
    this.boss.sinceShift = 0;
    const cand = this.board.filled().filter(({ r, c }) =>
      this.board.neighbors(r, c).some((n) => !this.board.get(n.r, n.c)));
    // lowest (most reachable) bubbles first, shuffled within that
    cand.sort((a, b) => b.r - a.r + (this.rng() - 0.5) * 3);
    let changed = 0;
    for (const p of cand) {
      if (changed >= BOSS.shiftCount) break;
      const fake = lookAlike(p.t, BOSS.sigs, this.rng);
      if (!fake) continue;
      this.board.set(p.r, p.c, fake);
      const at = this.board.center(p.r, p.c);
      this.fx.push(new Ring(at.x, at.y, 44, '#e879f9', 0.6));
      this.fx.push(new Popup(at.x, at.y - 30, `${formatTerm(p.t)} → ${formatTerm(fake)}`, '#f0abfc', 15, 1.6));
      changed++;
    }
    if (!changed) return;
    this.touchBoard();
    this.boss.shift = 0.8;
    soundEngine.playBossShift();
    this.setTicker('🌀', 'The Colossus shape-shifted terms!',
      'Same numbers, different variables or exponents. Re-read the pink-ringed bubbles before you shoot.');
  }

  checkDanger() {
    if (this.mode !== 'play') return;
    const edge = this.board.lowestEdge();
    if (edge >= DANGER_Y) {
      this.lose();
      return;
    }
    const near = edge >= DANGER_Y - ROW_HEIGHT;
    if (near && !this.dangerWarned) soundEngine.playWarning();
    this.dangerWarned = near;
  }

  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) this.fx.push(new Particle(x, y, color));
  }

  starsFor(misfires) {
    return misfires === 0 ? 3 : misfires <= 2 ? 2 : 1;
  }

  clearStage() {
    this.mode = 'stageClear';
    const st = this.stage;
    const boardClear = this.board.count() === 0;
    if (boardClear) this.score += 1000;
    const stars = this.starsFor(this.stageMisfires);
    this.stars[this.stageIndex] = Math.max(this.stars[this.stageIndex] || 0, stars);
    soundEngine.playStageClear();
    this.board.filled().forEach(({ r, c, t }) => {
      const p = this.board.center(r, c);
      this.fx.push(new Faller(t, p.x, p.y));
    });
    this.board = new Board({ top: st.top || 0 });
    this.touchBoard();
    this.updateHUD();

    $('clearTitle').textContent = `${st.short} cleared!`;
    $('clearStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    $('clearStats').innerHTML = `${this.zeros} zero-pops · ${this.stageMisfires} misfire${this.stageMisfires === 1 ? '' : 's'}${boardClear ? ' · <b class="text-amber-300">BOARD CLEAR +1000</b>' : ''}`;
    const nextSt = ALL_STAGES[this.stageIndex + 1];
    $('clearTip').textContent = nextSt ? `Up next: ${nextSt.name}. ${nextSt.blurb}` : '';
    $('continueBtn').textContent = nextSt === BOSS ? '⚔️ Face the Term Colossus (Enter)' : 'Next Stage (Enter)';
    setTimeout(() => { if (this.mode === 'stageClear') this.show('stageClear'); }, 700);
  }

  lose() {
    if (this.mode !== 'play') return;
    this.mode = 'defeat';
    this.bullet = null;
    this.shake = 18;
    soundEngine.playDefeat();
    const k = this.misfireKinds;
    let why;
    if (this.stageMisfires === 0) {
      why = 'No misfires. Nice! The stack just grew too fast. Go for zero-pops: they wipe out a whole group and drop everything hanging under it.';
    } else if (k.exponent >= k.variable && k.exponent >= k.constant) {
      why = 'Most misfires mixed up exponents. x and x² use the same letter, but they are NOT like terms.';
    } else if (k.constant >= k.variable) {
      why = 'Most misfires mixed constants with variable terms. A number like 4 only combines with other numbers, never with 4x.';
    } else {
      why = 'Most misfires mixed different letters. x-terms only combine with x-terms, y-terms with y-terms.';
    }
    $('defeatWhy').textContent = why;
    setTimeout(() => this.show('defeat'), 650);
  }

  winBoss() {
    this.mode = 'debrief';
    this.stars[this.stageIndex] = Math.max(this.stars[this.stageIndex] || 0, this.starsFor(this.stageMisfires));
    soundEngine.playVictory();
    this.shake = 20;
    this.board.filled().forEach(({ r, c, t }) => {
      const p = this.board.center(r, c);
      this.fx.push(new Faller(t, p.x, p.y));
    });
    for (let i = 0; i < 6; i++) {
      setTimeout(() => this.burst(150 + Math.random() * 500, 30 + Math.random() * 60, ['#fde047', '#f0abfc', '#a5b4fc'][i % 3], 30), i * 140);
    }
    this.board = new Board({ top: BOSS.top });
    this.touchBoard();
    this.boss.dead = true;
    this.updateHUD();

    const box = $('debriefStages');
    box.innerHTML = '';
    ALL_STAGES.forEach((st, i) => {
      const s = this.stars[i] || 0;
      const d = document.createElement('div');
      d.className = 'card text-center';
      d.innerHTML = `<div class="text-[10px] font-bold text-violet-300 uppercase">${st.short}</div><div class="text-amber-300 text-lg">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</div>`;
      box.appendChild(d);
    });
    const good = this.totalShots - this.totalMisfires;
    $('debriefStats').innerHTML = `Score <b class="text-amber-300">${this.score.toLocaleString()}</b> · ${this.totalZeros} zero-pops · ${good}/${this.totalShots} shots on like terms`;

    if (!this.reported) {
      this.reported = true;
      try {
        window.parent.postMessage({
          type: 'CARTRIDGE_COMPLETE',
          payload: {
            lessonId: LESSON_ID,
            // score = shots that combined with like terms; total = shots that had a like term to hit
            score: good,
            total: Math.max(1, this.totalShots),
            bossDefeated: true,
          },
        }, '*');
      } catch (e) { /* not embedded */ }
    }
    setTimeout(() => this.show('debrief'), 1400);
  }

  // ------------------------------------------------------------------ loop
  frame(now) {
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.update(dt);
    this.draw();
    requestAnimationFrame((t) => this.frame(t));
  }

  update(dt) {
    this.time += dt;
    const paused = this.mode === 'briefing';
    if (!paused) {
      if (this.mode === 'play') {
        const turn = 1.5 * dt;
        if (this.keys.left) this.angle = clamp(this.angle + turn, MIN_ANGLE, MAX_ANGLE);
        if (this.keys.right) this.angle = clamp(this.angle - turn, MIN_ANGLE, MAX_ANGLE);
        if (this.bullet) this.updateBullet(dt);
      }
      for (const f of this.fx) f.update(dt, this);
      this.fx = this.fx.filter((f) => !(f.done || (f.life !== undefined && f.life <= 0)));
      if (this.fx.length > 500) this.fx.splice(0, this.fx.length - 500);
    }
    this.shake = Math.max(0, this.shake - dt * 40);
    this.recoil = Math.max(0, (this.recoil || 0) - dt * 6);
    this.dropAnim = Math.max(0, this.dropAnim - dt * 4);
    if (this.boss) {
      this.boss.hurt = Math.max(0, this.boss.hurt - dt);
      this.boss.shift = Math.max(0, this.boss.shift - dt);
      this.boss.intro = Math.max(0, this.boss.intro - dt);
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    this.drawBackground(ctx);
    if (this.boss) this.drawBoss(ctx);
    else this.drawCeiling(ctx);
    this.drawDanger(ctx);
    if (this.mode === 'play' && !this.bullet) this.drawGuide(ctx);
    this.drawBoard(ctx);
    for (const f of this.fx) {
      ctx.save();
      f.draw(ctx);
      ctx.restore();
    }
    if (this.bullet) drawBubble(ctx, this.bullet.t, this.bullet.x, this.bullet.y);
    this.drawLauncher(ctx);
    ctx.restore();
  }

  drawBackground(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a0f3a');
    g.addColorStop(1, '#0c0720');
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    // arcade floor grid
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    // marquee lights on the side rails
    for (let y = 30; y < H; y += 44) {
      const on = Math.floor(this.time * 3 + y / 44) % 2 === 0;
      ctx.fillStyle = on ? 'rgba(244,114,182,0.55)' : 'rgba(244,114,182,0.15)';
      ctx.beginPath();
      ctx.arc(3, y, 2.5, 0, Math.PI * 2);
      ctx.arc(W - 3, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawCeiling(ctx) {
    const y = this.board.top;
    const g = ctx.createLinearGradient(0, y - 10, 0, y + 4);
    g.addColorStop(0, '#4c3a75');
    g.addColorStop(1, '#241640');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 10, W, 12);
  }

  drawBoss(ctx) {
    const b = this.boss;
    const top = BOSS.top;
    const rise = b.intro > 0 ? (b.intro / 1.4) * top : 0;
    ctx.save();
    ctx.translate(0, -rise);
    if (b.dead) ctx.globalAlpha = 0.35;
    const hurt = b.hurt > 0;
    const jitter = hurt ? (Math.random() - 0.5) * 8 : 0;
    const cx = W / 2 + jitter;

    // shoulders / ceiling slab
    const slab = ctx.createLinearGradient(0, 0, 0, top);
    slab.addColorStop(0, '#3b1d5e');
    slab.addColorStop(1, '#22103a');
    ctx.fillStyle = slab;
    ctx.fillRect(0, 0, W, top);
    ctx.fillStyle = '#5b2d86';
    for (let x = 0; x < W; x += 50) ctx.fillRect(x + 4, top - 8, 42, 6);

    // head
    ctx.fillStyle = hurt ? '#f5d0fe' : '#6d3aa0';
    ctx.strokeStyle = '#1a0b2e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(cx - 150, 2, 300, top - 6, 18);
    ctx.fill();
    ctx.stroke();

    // cracks as HP drops
    const lost = 1 - Math.max(0, b.hp) / BOSS.hp;
    ctx.strokeStyle = 'rgba(26,11,46,0.8)';
    ctx.lineWidth = 2;
    if (lost > 0.3) { ctx.beginPath(); ctx.moveTo(cx - 120, 6); ctx.lineTo(cx - 100, 30); ctx.lineTo(cx - 112, 52); ctx.stroke(); }
    if (lost > 0.6) { ctx.beginPath(); ctx.moveTo(cx + 110, 8); ctx.lineTo(cx + 95, 26); ctx.lineTo(cx + 120, 46); ctx.stroke(); }
    if (lost > 0.8) { ctx.beginPath(); ctx.moveTo(cx - 10, 4); ctx.lineTo(cx + 6, 20); ctx.lineTo(cx - 4, 34); ctx.stroke(); }

    // eyes follow the shot / aim
    const target = this.bullet || { x: TURRET.x + Math.cos(this.angle) * 200, y: TURRET.y - Math.sin(this.angle) * 200 };
    const eyeColor = b.shift > 0 ? '#e879f9' : '#fde047';
    [-70, 70].forEach((ox) => {
      const ex = cx + ox;
      const ey = 30;
      ctx.fillStyle = '#1a0b2e';
      ctx.beginPath();
      ctx.ellipse(ex, ey, 26, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      const a = Math.atan2(target.y - ey, target.x - ex);
      ctx.fillStyle = eyeColor;
      ctx.shadowColor = eyeColor;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(ex + Math.cos(a) * 11, ey + Math.sin(a) * 6, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // brow
      ctx.strokeStyle = '#1a0b2e';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(ex - 28, ey - 20 + (ox < 0 ? -6 : 6));
      ctx.lineTo(ex + 28, ey - 20 + (ox < 0 ? 6 : -6));
      ctx.stroke();
    });
    // mouth with term-teeth
    ctx.fillStyle = '#1a0b2e';
    ctx.fillRect(cx - 40, 50, 80, 16);
    ctx.fillStyle = '#e9d5ff';
    for (let i = 0; i < 5; i++) ctx.fillRect(cx - 36 + i * 15, 50, 10, 7);
    ctx.font = '900 12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e9d5ff';
    ctx.fillText('TERM COLOSSUS', 14, 20);
    ctx.textAlign = 'right';
    ctx.fillText(`shape-shift in ${Math.max(0, BOSS.shiftEvery - b.sinceShift)}`, W - 14, 20);
    ctx.restore();
  }

  drawDanger(ctx) {
    const edge = this.board.lowestEdge();
    const near = this.mode === 'play' && edge >= DANGER_Y - ROW_HEIGHT;
    const pulse = near ? 0.55 + 0.45 * Math.sin(this.time * 12) : 0.6;
    const zone = ctx.createLinearGradient(0, DANGER_Y, 0, H);
    zone.addColorStop(0, `rgba(244,63,94,${near ? 0.22 * pulse : 0.08})`);
    zone.addColorStop(1, 'rgba(244,63,94,0)');
    ctx.fillStyle = zone;
    ctx.fillRect(0, DANGER_Y, W, H - DANGER_Y);
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -this.time * 30;
    ctx.strokeStyle = `rgba(244,63,94,${pulse})`;
    ctx.lineWidth = near ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(0, DANGER_Y);
    ctx.lineTo(W, DANGER_Y);
    ctx.stroke();
    ctx.restore();
    if (near) {
      ctx.font = '900 12px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = `rgba(251,113,133,${pulse})`;
      ctx.fillText('⚠ ONE ROW FROM THE LINE', W - 14, DANGER_Y - 8);
    }
  }

  drawGuide(ctx) {
    const g = this.guide();
    const pts = g.points;
    ctx.save();
    // dotted path
    let carry = (this.time * 60) % 18;
    ctx.fillStyle = 'rgba(233, 213, 255, 0.75)';
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      for (let d = carry; d < len; d += 18) {
        const k = d / len;
        const x = a.x + (b.x - a.x) * k;
        const y = a.y + (b.y - a.y) * k;
        if (Math.hypot(x - TURRET.x, y - TURRET.y) < 40) continue;
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      carry = (carry - len) % 18;
      if (carry < 0) carry += 18;
    }
    // ghost bubble where it will land
    if (g.cell) {
      const p = this.board.center(g.cell.r, g.cell.c);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(233, 213, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, RADIUS - 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBoard(ctx) {
    const off = -this.dropAnim * this.dropAnim * ROW_HEIGHT;
    for (const { r, c, t } of this.board.filled()) {
      const p = this.board.center(r, c);
      drawBubble(ctx, t, p.x, p.y + off);
    }
  }

  drawLauncher(ctx) {
    const { x, y } = TURRET;
    // base
    ctx.fillStyle = '#241640';
    ctx.strokeStyle = '#6d5a96';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y + 30, 58, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    // barrel
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 2 - this.angle);
    const kick = (this.recoil || 0) * 10;
    const g = ctx.createLinearGradient(-14, 0, 14, 0);
    g.addColorStop(0, '#6d28d9');
    g.addColorStop(0.5, '#c084fc');
    g.addColorStop(1, '#5b21b6');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#1a0b2e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-14, -62 + kick, 28, 44, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f472b6';
    ctx.fillRect(-16, -64 + kick, 32, 6);
    ctx.restore();

    if (this.current && !this.bullet && this.mode === 'play') drawBubble(ctx, this.current, x, y);
    else if (this.current && this.mode === 'play') drawBubble(ctx, this.current, x, y, 0.85, 0.5);

    // next
    if (this.next && (this.mode === 'play' || this.mode === 'briefing')) {
      ctx.font = '800 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#c4b5fd';
      ctx.fillText('NEXT · S to swap', NEXT_POS.x, NEXT_POS.y - 30);
      drawBubble(ctx, this.next, NEXT_POS.x, NEXT_POS.y, 0.8);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.termPopper = new TermPopper();
});
