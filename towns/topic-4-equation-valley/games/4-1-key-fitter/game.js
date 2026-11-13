// Key Fitter (Lesson 4-1: Understand Equations and Solutions): the screen and the controls.
// The math is in keys.js. The shared parts of an action game (briefing, top bar, chances, hint card, report)
// are in shared/game/arcadeShell.js.
//
// A zone is a list of ROUNDS:
//   belt     the student holds one key; locks roll past; tap every lock the key opens
//   ring     one lock stands still; the student slides a key along a number strip and tries it (test keys are free)
//   mystery  the same, but the lock hides its rule and only shows what each test key makes
//   forge    the student builds an equation that a given key opens
// All timing goes through update(), so the action stops cleanly whenever a banner, hint, help screen or mistake
// message is showing.
import { createArcade } from '../../../../shared/game/arcadeShell.js';
import { ZONES, genZone, lockText, substitute, checkLock, checkTry, checkForge, parseNumber, fmt, r2 } from './keys.js';

const NS = 'http://www.w3.org/2000/svg';
const BELT_Y = 330, EXIT_X = 150, SPEED = 100;   // the belt: where locks ride, where they leave, pixels a second
const EVERY = [5, 5, 5.5, 4, 4], PRACTICE_EVERY = 8;   // seconds between one lock and the next, zone by zone
const FIRST_X = 1236;                             // where the first lock waits until the belt is started
const RUSH = 8;                                   // how much faster the belt runs while no undecided lock is in view
const L = 110, WD = 1146, LINE_Y = 520, PICK_Y = 452, LOCK_Y = 290;   // the key strip and the big lock
const BOSS = ZONES.length - 1;
const $ = (id) => document.getElementById(id);
const scene = $('scene');
const near = (a, b) => Math.abs(a - b) < 1e-7;

// Everything about the round being played.
const W = {
  rounds: [], ri: 0, round: null, phase: 'idle',    // phase: idle, ready (a belt waiting to be started), belt, pick (ring or mystery), forge, gap
  items: [], beltMiss: 0,                           // belt: one item per lock { lock, n, x, state, el }
  pick: 0, pickEl: null, fly: null, tries: 0, marks: [],
  op: '+', gapLeft: 0, frozen: false, wrongEl: null, afterResume: null, speed: 1,
};

const HINTS = {
  missed_open: 'Before you reject a lock, put your key in for the letter and work out that side.<span class="mono">key 7 : n + 8 = 15 → 7 + 8 = 15 ✓</span>If both sides match, the key is a solution: KEY FITS.',
  too_slow: 'Every lock needs a decision before it reaches the OUT box: KEY FITS or REJECT. PRACTICE mode runs the belt slower.',
  near_miss: 'Close is not open. Both sides must be exactly equal.<span class="mono">key 7 : n + 8 = 16 → 15 ≠ 16</span>Work the side out all the way before you tap.',
  wrong_op: 'Read the operation in the lock, not the one you expect.<span class="mono">key 4 : 3n = 7 → 3 × 4 = 12, not 7</span>',
  answer_as_key: 'Seeing your number in the lock does not mean it fits. The key goes where the LETTER is.<span class="mono">key 7 : n + 3 = 7 → 7 + 3 = 10, not 7</span>',
  used_the_number: 'Seeing your number in the lock does not mean it fits. The key goes where the LETTER is.<span class="mono">key 7 : n + 7 = 12 → 7 + 7 = 14, not 12</span>',
  concatenation: 'A number next to a letter means MULTIPLY.<span class="mono">key 4 : 3n → 3 × 4 = 12, not 34</span>',
  forgot_part: 'A two-step lock needs both steps. Multiply first, then add.<span class="mono">key 4 : 3n + 5 → 3 × 4 + 5 = 17</span>',
  ring_miss: 'Use each test key as a clue. Did the side come out too big or too small? Move your key the other way.',
  mystery_miss: 'Compare two test keys. If the key goes up by 1 and the result goes up by 1, the lock ADDS. If it goes up by more, the lock MULTIPLIES.<span class="mono">key 0 makes 6 → the lock adds 6</span>',
  forge_wrong: 'Put the key into your own lock and work out the side. That result is what goes after the equals sign.<span class="mono">key 8 : x + 5 = ? → 8 + 5 = 13</span>',
};
const TIPS = {
  missed_open: 'A value is a solution when it makes both sides equal. Substitute before deciding.',
  too_slow: 'Decide each equation: substitute the value, then say whether it is a solution.',
  near_miss: 'Both sides must be exactly equal, not close.',
  wrong_op: 'Read the operation in the equation carefully before substituting.',
  answer_as_key: 'The value replaces the variable, even when the same number appears elsewhere in the equation.',
  used_the_number: 'The value replaces the variable, even when the same number appears elsewhere in the equation.',
  concatenation: '3n means 3 × n, not the digits side by side.',
  forgot_part: 'In a two-step expression, multiply first, then add.',
  ring_miss: 'Guess, check, and use the result to choose a better guess.',
  mystery_miss: 'Two test values are enough to see what an operation does.',
  forge_wrong: 'To write an equation with a given solution, substitute it and work out the other side.',
  jam_miss: 'A value that makes the two sides different is not a solution.',
};

const arcade = createArcade({
  zones: ZONES, startZone, stopZone, onKey, hints: HINTS, skillTips: TIPS, testName: '__keyfitter',
  perfectText: 'A clean break-in: no mistakes to sharpen!',
  lifeLostText: (left) => (left > 0 ? `A GUARD! ${left} CHANCE${left === 1 ? '' : 'S'} LEFT` : 'CAUGHT!'),
});
const { G, hubAudio } = arcade;
if (window.__keyfitter) window.__keyfitter.W = W;

/* ================================================================== */
/* Zones and rounds                                                    */
/* ================================================================== */
function startZone(z) {
  W.rounds = genZone(Math.random, z);
  startRound(0);
}
function stopZone() {
  Object.assign(W, { phase: 'idle', frozen: false, items: [], fly: null, pickEl: null, afterResume: null, wrongEl: null });
  $('callout').classList.add('hidden'); $('forge').classList.add('hidden');
}
function startRound(i) {
  const round = W.rounds[i];
  Object.assign(W, { ri: i, round, items: [], beltMiss: 0, fly: null, pickEl: null, tries: 0, marks: [], frozen: false, afterResume: null, wrongEl: null });
  if (G.zone === BOSS) arcade.setBossProgress((i / W.rounds.length) * 100);
  $('forge').classList.add('hidden');
  if (round.type === 'belt') {
    W.phase = 'ready';                               // nothing moves until the student starts the belt
    drawBelt();
    const gap = SPEED * (EVERY[G.zone] || 5);
    W.items = round.locks.map((lock, n) => ({ lock, n, x: FIRST_X + n * gap, state: 'roll', el: null }));
    for (const it of W.items) { it.el = beltLockEl(it); place(it); }
  } else if (round.type === 'forge') {
    W.phase = 'forge'; W.op = round.ops ? round.ops[0] : '+';
    drawForge();
    $('fa').value = ''; $('fc').value = ''; $('forgeNote').textContent = '';
    $('forge').classList.remove('hidden');
    $('fa').focus();
  } else {
    W.phase = 'pick';
    drawPickScene(); newPick();
  }
  renderSign(true); renderCtl();
}
function endRound(bonus) {
  if (bonus) { G.score += 20; arcade.renderHud(); arcade.flash(bonus); }
  W.phase = 'gap'; W.gapLeft = 0.9;
  renderCtl();
}
function nextRound() {
  if (W.ri + 1 < W.rounds.length) return startRound(W.ri + 1);
  W.phase = 'idle';
  if (G.zone === BOSS) arcade.setBossProgress(100);
  arcade.zoneCleared();
}

/* ================================================================== */
/* The action                                                          */
/* ================================================================== */
function update(dt) {
  if (W.phase === 'idle' || W.frozen || arcade.paused()) return;
  if (W.phase === 'gap') { W.gapLeft -= dt; if (W.gapLeft <= 0) nextRound(); return; }
  if (W.phase === 'belt') {
    // While no undecided lock is in view the belt hurries, so nobody waits at an empty belt.
    W.settle = Math.max(0, (W.settle || 0) - dt);     // a moment for a decided lock to leave before the next one hurries in
    const waiting = W.settle > 0 || W.items.some((it) => it.state === 'roll' && it.x <= FIRST_X);
    const speed = waiting ? SPEED * (G.practice ? (EVERY[G.zone] || 5) / PRACTICE_EVERY : 1) : SPEED * RUSH;
    const shift = waiting ? speed * dt : Math.min(speed * dt, frontX() - FIRST_X);
    markFront();
    for (const it of W.items) {
      if (it.state !== 'roll') continue;
      it.x -= shift;
      place(it);
      if (it.x <= EXIT_X) { judge(it, 'none'); if (W.phase !== 'belt' || W.frozen || arcade.paused()) return; }
    }
    if (W.items.every((it) => it.state === 'done')) endRound(W.beltMiss === 0 ? 'CLEAN BELT! +20' : null);
    return;
  }
  if (W.phase === 'pick' && W.fly) {
    W.fly.y = Math.max(LOCK_Y + 70, W.fly.y - 700 * dt);
    W.fly.el.setAttribute('transform', `translate(${W.fly.x} ${W.fly.y})`);
    if (W.fly.y <= LOCK_Y + 70) resolveTry();
  }
}
function startBelt() {
  if (W.phase !== 'ready' || W.frozen || arcade.paused()) return;
  W.phase = 'belt'; hubAudio.playCartridgeLaunch(); renderSign(); renderCtl();
}
/** The lock at the gate: the undecided lock nearest the OUT box, once it is fully on screen. */
const frontX = () => Math.min(...W.items.filter((it) => it.state === 'roll').map((it) => it.x), Infinity);
function frontLock() {
  const rolling = W.items.filter((it) => it.state === 'roll' && it.x <= 1366 - 122);
  return rolling.length ? rolling.reduce((a, b) => (b.x < a.x ? b : a)) : null;
}
function markFront() { const f = frontLock(); for (const it of W.items) if (it.el) it.el.classList.toggle('front', it === f); }
/** KEY FITS or REJECT, for the lock at the gate. */
function decide(action) {
  const it = frontLock();
  if (W.phase !== 'belt' || W.frozen || arcade.paused() || !it) return;
  judge(it, action);
}
/** The student decided a belt lock: 'fit' (tried the key), 'reject', or 'none' (it reached the OUT box undecided). */
function judge(it, action) {
  const tapped = action === 'fit';
  const belt = W.round, res = checkLock(belt, it.lock, action), s = substitute(it.lock, belt.value);
  it.state = 'done';
  const eq = it.el.querySelector('.eq');
  eq.textContent = s.equal ? s.text.replace(/ = \S+$/, ' ✓') : s.text;
  eq.classList.toggle('xlong', eq.textContent.length > 16); eq.classList.toggle('long', eq.textContent.length > 12 && eq.textContent.length <= 16);
  it.el.classList.remove('front');
  if (!res) {
    arcade.good(10); W.settle = 0.8;
    if (tapped) hubAudio.playCoinClink(); else hubAudio.playStep();
    it.el.classList.add(tapped ? 'open' : 'passed');
    const el = it.el; setTimeout(() => el.remove(), 950);
    return;
  }
  W.beltMiss += 1;
  it.el.classList.add('jam');
  arcade.bad(res.key, action === 'none' ? 15 : 25);
  if (W.phase === 'idle') return;                    // that was the last chance: the zone has stopped
  stopFor(res.message, it.el, 'CONTINUE (ENTER)', null);
}
/** A mistake stops the action and says what went wrong. */
function stopFor(message, el, button, then) {
  W.frozen = true; W.wrongEl = el; W.afterResume = then;
  $('calloutText').textContent = message;
  $('resumeBtn').textContent = button;
  $('callout').classList.remove('hidden');
}
function resume() {
  if (!W.frozen || arcade.paused()) return;
  W.frozen = false;
  $('callout').classList.add('hidden');
  if (W.wrongEl) W.wrongEl.remove();
  W.wrongEl = null;
  const then = W.afterResume;
  W.afterResume = null;
  if (then) then();
}
function tapLock(it) {
  if (W.phase !== 'belt' || W.frozen || arcade.paused() || !it || it.state !== 'roll' || it.x > 1366 - 122) return;   // only once the whole lock is on screen
  judge(it, 'fit');
}

/* ---- ring and mystery: the student chooses the key ---- */
const strip = () => W.round.strip;
const X = (v) => L + ((v - strip().lo) / (strip().hi - strip().lo)) * WD;
function snap(v) {
  const { lo, hi, step } = strip();
  return r2(lo + Math.round((Math.min(hi, Math.max(lo, v)) - lo) / step) * step);
}
const canPick = () => W.phase === 'pick' && W.pickEl && !W.fly && !W.frozen && !arcade.paused();
function newPick() {
  const { lo, hi, step } = strip(), sol = W.round.lock.solution;
  if (!W.tries) {                                    // a fresh lock: never start on the answer (or, for a jam, start ON it)
    const mid = snap((lo + hi) / 2);
    W.pick = W.round.order === 'jam' ? sol : near(mid, sol) ? snap(mid + 3 * step) : mid;
  }
  W.fly = null;
  const money = W.round.lock.money;
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'pick');
  g.innerHTML = `<line class="guide" x1="0" y1="26" x2="0" y2="${LINE_Y - PICK_Y}" stroke="#ffd166" stroke-width="2" stroke-dasharray="4 7" opacity="0.7"/>
    <circle cx="0" cy="-34" r="20" fill="#ffd166" stroke="#2b1b2e" stroke-width="4"/><circle cx="0" cy="-34" r="7" fill="#1c2230"/>
    <rect x="${money ? -44 : -34}" y="-18" width="${money ? 88 : 68}" height="40" rx="10" fill="#ffd166" stroke="#2b1b2e" stroke-width="4"/><text y="10"></text>`;
  $('gFront').appendChild(g);
  W.pickEl = g;
  drawPick();
}
function drawPick() {
  W.pickEl.querySelector('text').textContent = fmt(W.pick, W.round.lock.money);
  W.pickEl.setAttribute('transform', `translate(${X(W.pick)} ${PICK_Y})`);
}
function setPick(v) {
  if (!canPick()) return;
  v = snap(v);
  if (near(v, W.pick)) return;
  W.pick = v; hubAudio.playStep(); drawPick();
}
function tryPick() {
  if (!canPick()) return;
  W.pickEl.querySelector('.guide').remove();
  W.fly = { v: W.pick, x: X(W.pick), y: PICK_Y, el: W.pickEl };
  hubAudio.playCartridgeLaunch();
  renderCtl();
}
/** The student's key reached the lock. */
function resolveTry() {
  const round = W.round, v = W.fly.v, el = W.fly.el, res = checkTry(round, v), lock = round.lock;
  W.fly = null; W.pickEl = null;
  const made = round.order === 'jam' ? null : { v, text: fmt(substitute(lock, v).left, lock.money), ok: res.ok };
  if (made) { W.marks = W.marks.filter((m) => !near(m.v, v)).concat(made); drawMarks(); }
  const line = $('tryLine');
  line.textContent = res.text;
  if (res.ok) {
    arcade.good(15); hubAudio.playCoinClink();
    $('bigLock').classList.add(round.order === 'jam' ? 'jam' : 'open');
    el.remove();
    if (round.type === 'mystery') $('bigEq').textContent = lockText(lock);   // show what the lock was doing
    return endRound(null);
  }
  W.tries += 1;
  if (W.tries < round.tries) {                       // a free test key: it leaves a clue, no damage
    hubAudio.playSelect();
    el.remove();
    newPick(); renderSign(); renderCtl();
    return;
  }
  const s = substitute(lock, lock.solution);
  const key = round.type === 'mystery' ? 'mystery_miss' : round.order === 'jam' ? 'jam_miss' : 'ring_miss';
  arcade.bad(key, 25);
  if (W.phase === 'idle') return;
  const tail = round.order === 'jam' ? '' : ` The key was ${fmt(lock.solution, lock.money)}: ${lockText(lock)} → ${s.text.replace(/ = \S+$/, ' ✓')}`;
  stopFor(res.message + tail, el, 'NEXT LOCK (ENTER)', () => endRound(null));
}

/* ---- forge: build a lock the key opens ---- */
function setOp(op) {
  if (W.phase !== 'forge') return;
  W.op = op;
  for (const b of $('forgeOps').querySelectorAll('button')) b.classList.toggle('on', b.dataset.op === op);
}
function forge() {
  if (W.phase !== 'forge' || W.frozen || arcade.paused()) return;
  const res = checkForge(W.round, W.op, parseNumber($('fa').value), parseNumber($('fc').value));
  if (res.key === 'incomplete' || res.key === 'zero' || res.key === 'forge_op') { $('forgeNote').textContent = res.message; return; }   // a nudge, not a mistake
  if (res.correct) {
    arcade.good(20); hubAudio.playCoinClink();
    $('forgeNote').textContent = res.message;
    $('bigLock').classList.add('open');
    W.phase = 'gap'; W.gapLeft = 2.2; renderCtl();
    return;
  }
  W.tries += 1;
  $('forgeNote').textContent = '';
  arcade.bad('forge_wrong', 25);
  if (W.phase === 'idle') return;
  const v = W.round.value, moveOn = W.tries >= 2;
  stopFor(res.message + (moveOn ? ` One that works: x + 5 = ${v + 5}.` : ''), null, moveOn ? 'NEXT (ENTER)' : 'TRY AGAIN (ENTER)', moveOn ? () => endRound(null) : () => $('fc').focus());
}

/* ================================================================== */
/* Controls                                                            */
/* ================================================================== */
function onKey(e) {
  const k = e.key;
  if (k === 'Enter') { e.preventDefault(); if (W.frozen) resume(); else if (W.phase === 'ready') startBelt(); else if (W.phase === 'pick') tryPick(); else if (W.phase === 'forge') forge(); return; }
  if (W.frozen) return;
  if (W.phase === 'belt' && /^[1-9]$/.test(k)) tapLock(W.items[Number(k) - 1]);
  if (W.phase === 'belt' && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); decide(k === 'ArrowUp' ? 'fit' : 'reject'); }
  if (W.phase === 'pick' && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); setPick(W.pick + (k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 5 : 1) * strip().step); }
  if (W.phase === 'forge') {
    const op = { '+': '+', '-': '-', '*': '×', x: '×', X: '×', '/': '÷' }[k];
    if (op) { e.preventDefault(); setOp(op); }
  }
}
const press = (id, fn) => $(id).addEventListener('click', (e) => { e.currentTarget.blur(); fn(); });
press('stepL', () => setPick(W.pick - strip().step));
press('stepR', () => setPick(W.pick + strip().step));
press('goBtn', () => (W.phase === 'forge' ? forge() : tryPick()));
press('resumeBtn', resume);
press('beltStart', startBelt);
press('fitBtn', () => decide('fit'));
press('rejectBtn', () => decide('reject'));
for (const b of $('forgeOps').querySelectorAll('button')) b.addEventListener('click', () => { setOp(b.dataset.op); $('fa').focus(); });
for (const id of ['fa', 'fc']) $(id).addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^0-9.]/g, ''); });

// Slide the key anywhere along the strip.
let drag = false;
function scenePoint(e) {
  const r = scene.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * 1366, y: ((e.clientY - r.top) / r.height) * 698 };
}
const valueAt = (x) => strip().lo + ((x - L) / WD) * (strip().hi - strip().lo);
scene.addEventListener('pointerdown', (e) => {
  if (!canPick()) return;
  const pt = scenePoint(e);
  if (pt.y < PICK_Y - 70) return;
  drag = true; scene.setPointerCapture(e.pointerId);
  setPick(valueAt(pt.x));
});
scene.addEventListener('pointermove', (e) => { if (drag) setPick(valueAt(scenePoint(e).x)); });
scene.addEventListener('pointerup', () => { drag = false; });
scene.addEventListener('pointercancel', () => { drag = false; });

/* ================================================================== */
/* Drawing                                                             */
/* ================================================================== */
function wall() {
  let bricks = '';
  for (let y = 0; y < 640; y += 46) for (let x = (y / 46) % 2 ? -60 : 0; x < 1366; x += 120) bricks += `<rect x="${x}" y="${y}" width="118" height="44" fill="#252c3d" stroke="#1a202d" stroke-width="2"/>`;
  return `<rect width="1366" height="698" fill="#1c2230"/>${bricks}`;
}
function keyArt(value, money) {
  const text = fmt(value, money);
  return `<g transform="translate(683 540)"><text class="keylabel" y="-58">YOUR KEY</text>
    <rect x="-230" y="-12" width="150" height="24" fill="#e0a92e" stroke="#2b1b2e" stroke-width="4"/><path d="M-230 12 v22 h20 v-22 M-190 12 v16 h18 v-16" fill="#e0a92e" stroke="#2b1b2e" stroke-width="4"/>
    <rect x="-90" y="-44" width="260" height="88" rx="44" fill="#ffd166" stroke="#2b1b2e" stroke-width="5"/>
    <text class="keyval ${text.length > 5 ? 'long' : ''}" x="40" y="16">${text}</text></g>`;
}
function drawBelt() {
  let rollers = '';
  for (let x = 30; x < 1366; x += 70) rollers += `<circle cx="${x}" cy="${BELT_Y + 78}" r="12" fill="#5d6679" stroke="#1a202d" stroke-width="3"/>`;
  scene.innerHTML = `${wall()}
    <rect x="0" y="${BELT_Y + 56}" width="1366" height="44" fill="#39414f" stroke="#1a202d" stroke-width="4"/>${rollers}
    <g id="gLocks"></g>
    <rect x="0" y="${BELT_Y - 110}" width="${EXIT_X - 150 + 130}" height="220" fill="#12161f" stroke="#ffd166" stroke-width="4"/>
    <text x="65" y="${BELT_Y - 122}" class="keylabel">OUT</text>
    ${keyArt(W.round.value, W.round.money)}<g id="gFront"></g>`;
}
function beltLockEl(it) {
  const text = lockText(it.lock);
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'lock');
  g.innerHTML = `<g class="lock-in"><path class="shackle" d="M-34 -40 v-20 a34 34 0 0 1 68 0 v20"/><rect class="body" x="-116" y="-40" width="232" height="80" rx="14"/>
    <text class="eq ${text.length > 16 ? 'xlong' : text.length > 12 ? 'long' : ''}" y="9">${text}</text><circle cx="-116" cy="-40" r="14" fill="#2b1b2e" stroke="#fff" stroke-width="2"/><text class="num" x="-116" y="-35">${it.n + 1}</text></g>`;
  g.addEventListener('pointerdown', (e) => { e.stopPropagation(); tapLock(it); });
  $('gLocks').appendChild(g);
  return g;
}
const place = (it) => it.el.setAttribute('transform', `translate(${it.x} ${BELT_Y})`);

function bigLock(text) {
  return `<g id="bigLock" class="lock big" transform="translate(683 ${LOCK_Y})"><path class="shackle" d="M-70 -70 v-34 a70 70 0 0 1 140 0 v34"/><rect class="body" x="-300" y="-70" width="600" height="150" rx="22"/>
    <text id="bigEq" class="eq ${text.length > 16 ? 'long' : ''}" y="4">${text}</text><text id="tryLine" class="try" y="56"></text></g>`;
}
function drawPickScene() {
  const { lo, hi, step } = strip(), lock = W.round.lock, money = lock.money;
  let ticks = '';
  for (let i = 0; i <= Math.round((hi - lo) / step); i++) {
    const v = r2(lo + i * step), x = X(v), whole = near(v, Math.round(v));
    ticks += `<line x1="${x}" y1="${LINE_Y - (whole ? 13 : 8)}" x2="${x}" y2="${LINE_Y + (whole ? 13 : 8)}" stroke="#fff" stroke-width="${whole ? 3 : 2}"/>`;
    if (whole) ticks += `<text class="tick-label" x="${x}" y="${LINE_Y + 34}">${money ? '$' : ''}${v}</text>`;
  }
  const shown = W.round.type === 'mystery' ? `? ? ? = ${fmt(lock.c)}` : lockText(lock);
  scene.innerHTML = `${wall()}${bigLock(shown)}
    <line x1="${L - 40}" y1="${LINE_Y}" x2="${L + WD + 40}" y2="${LINE_Y}" stroke="#fff" stroke-width="4"/>${ticks}
    <text class="made" x="${L - 66}" y="${LINE_Y + 62}" style="fill:#c9d1e0">${W.round.order === 'jam' ? '' : 'makes'}</text>
    <g id="gMarks"></g><g id="gFront"></g>`;
}
/** Under the strip: what each test key made ("17" under the 9). */
function drawMarks() {
  $('gMarks').innerHTML = W.marks.map((m) => `<circle cx="${X(m.v)}" cy="${LINE_Y}" r="6" fill="${m.ok ? '#7dffa0' : '#ff9a9a'}"/><text class="made ${m.ok ? 'ok' : ''}" x="${X(m.v)}" y="${LINE_Y + 62}">${m.text}${m.ok ? '✓' : ''}</text>`).join('');
}
function drawForge() {
  scene.innerHTML = `${wall()}${bigLock('')}${keyArt(W.round.value, false)}<g id="gFront"></g>`;
  setOp(W.op);
}

function renderSign(isNew = false) {
  const r = W.round, n = W.rounds.length;
  let small = '', text = '', story = false;
  if (r.type === 'belt') { small = `BELT ${W.ri + 1}/${n} · KEY FITS OR REJECT`; text = W.phase === 'ready' ? 'LOOK AT YOUR KEY, THEN START THE BELT' : 'DOES YOUR KEY FIT? DECIDE EVERY LOCK'; }
  if (r.type === 'ring' || r.type === 'mystery') {
    const left = r.tries - W.tries, tests = left - 1;
    small = r.story || (r.type === 'mystery' ? 'MYSTERY LOCK: EACH TEST KEY SHOWS WHAT THE LOCK MAKES OF IT' : 'YOUR TURN: SLIDE A KEY ALONG THE STRIP AND TRY IT');
    story = Boolean(r.story);
    text = r.order === 'jam' ? 'CUT A KEY THAT DOES NOT OPEN IT' : tests > 0 ? `FIND THE KEY · ${tests} TEST KEY${tests === 1 ? '' : 'S'} LEFT` : 'FIND THE KEY · LAST TRY';
  }
  if (r.type === 'forge') { small = 'YOUR TURN: FORGE A LOCK'; text = `BUILD A LOCK THE KEY ${r.value} OPENS${r.ops ? `, USING ${r.ops.join(' OR ')}` : ''}`; }
  $('signSmall').classList.toggle('story', story);
  $('signSmall').textContent = small;
  $('signText').textContent = text;
  if (isNew) { const s = $('sign'); s.classList.remove('new'); void s.offsetWidth; s.classList.add('new'); }
}
function renderCtl() {
  const p = W.phase, pick = p === 'pick', forgeOn = p === 'forge';
  $('stepL').classList.toggle('hidden', !pick); $('stepR').classList.toggle('hidden', !pick);
  $('goBtn').classList.toggle('hidden', !(pick || forgeOn));
  $('goBtn').textContent = forgeOn ? 'FORGE IT (ENTER)' : W.fly ? 'TRYING...' : 'TRY THIS KEY (ENTER)';
  $('goBtn').disabled = pick && Boolean(W.fly);
  $('beltStart').classList.toggle('hidden', p !== 'ready');
  $('fitBtn').classList.toggle('hidden', p !== 'belt'); $('rejectBtn').classList.toggle('hidden', p !== 'belt');
  $('tip').textContent = p === 'ready' ? 'The locks wait until you start the belt.' : p === 'belt' ? 'Decide the glowing lock: ↑ key fits · ↓ reject. Tapping a lock tries your key in it.' : forgeOn ? 'Pick + − × ÷ and type two numbers.' : '';
  $('waveTag').textContent = W.rounds.length ? `${W.round.type === 'belt' ? 'BELT' : 'LOCK'} ${W.ri + 1}/${W.rounds.length}` : '';
}

/* ================================================================== */
/* The clock                                                           */
/* ================================================================== */
let last = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  update(dt * W.speed);
  requestAnimationFrame(frame);
}
// Something to look at behind the briefing.
W.round = { type: 'belt', value: 7, money: false, locks: [] };
W.rounds = [];
drawBelt(); renderSign(); renderCtl();
requestAnimationFrame(frame);
