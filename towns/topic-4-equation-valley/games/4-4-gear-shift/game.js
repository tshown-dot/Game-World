// Gear Shift (Lesson 4-4: Write and Solve Multiplication and Division Equations): the screen and the controls.
// The math is in gears.js. The number-line track is shared/game/track.js (also used by 4-3 Undo Machine). The shared
// parts of an action game (briefing, top bar, spare gears, hint card, report) are in shared/game/arcadeShell.js.
//
// A zone is a list of ROUNDS:
//   trip   an equation is one trip of the gear: turns × teeth per turn = flag. The student sets the missing part
//          (a dial, or the flag itself), rolls the gear, and watches it count its turns. A mystery trip gives a
//          free test turn first.
//   build  write the equation for a story from tiles; the next round rolls it
// All timing goes through update(), so the action stops cleanly whenever a banner, hint, help screen or mistake
// message is showing.
import { createArcade } from '../../../../shared/game/arcadeShell.js';
import { createTrack } from '../../../../shared/game/track.js';
import { ZONES, DIAL, genZone, eqText, tripOf, landOf, checkTrip, checkBuild } from './gears.js';

const BOSS = ZONES.length - 1;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const track = createTrack($('track'));

// Everything about the round being played.
const W = {
  rounds: [], ri: 0, round: null, phase: 'idle',    // phase: idle, set, run, hold, build, gap
  v: 0,                                             // the student's number: teeth per turn, turns, or where the flag is
  testsLeft: 0, tests: [], fuseLeft: 0, shownFuse: -1,
  anim: null, holdLeft: 0, tries: 0,
  slots: [null, null, null], op: null,              // build: which tile is in each space, and the operation
  gapLeft: 0, frozen: false, afterResume: null, speed: 1,
};
let gear = null, flag = null, pole = null;

const HINTS = {
  add_vs_times: 'A number next to a letter means MULTIPLY: equal turns, not one extra step.<span class="mono">4x = 36 : four turns of x teeth</span>Undo multiplying by dividing: 36 ÷ 4.',
  used_the_number: 'Read the equation as a trip.<span class="mono">4x = 36 : 4 turns, x teeth each, stops at 36</span>Which number is the turns, and which is the teeth?',
  one_turn: 'One turn is only the first step. Count every turn.<span class="mono">x ÷ 5 = 7 : five turns of 7, so x = 5 × 7</span>',
  did_not_undo: 'Dividing is undone by multiplying.<span class="mono">x ÷ 5 = 7 : x = 7 × 5</span>',
  forgot_start: 'The gear does not always start at 0.<span class="mono">3n + 5 = 26 : it starts at 5, so the turns cover 26 − 5 = 21</span>Then 21 ÷ 3.',
  off: 'Check it before you roll: multiply the turns by the teeth.<span class="mono">4 × 8 = 32 : is that the flag?</span>',
  story_order: 'Say your equation as a sentence. Does it tell the story?<span class="mono">groups × amount in each = total</span>',
};
const TIPS = {
  add_vs_times: '4x means 4 times x. Solve it by dividing both sides by 4.',
  used_the_number: 'In 4x = 36, x is the missing factor, not the 4.',
  one_turn: 'x ÷ 5 = 7 means x is 5 groups of 7.',
  did_not_undo: 'Solve x ÷ 5 = 7 by multiplying both sides by 5.',
  forgot_start: 'In 3n + 5 = 26, undo the + 5 first, then divide by 3.',
  off: 'Check a solution by multiplying back.',
  story_order: 'Equal groups: number of groups × amount in each = total.',
};

const arcade = createArcade({
  zones: ZONES, startZone, stopZone, onKey, hints: HINTS, skillTips: TIPS, testName: '__gears',
  perfectText: 'Every gear on the flag: no mistakes to sharpen!',
  lifeLostText: (left) => (left > 0 ? `A SPARE GEAR BROKE! ${left} LEFT` : 'GEARBOX JAMMED'),
});
const { G, hubAudio } = arcade;
if (window.__gears) window.__gears.W = W;
const busy = () => W.frozen || arcade.paused();

/* ================================================================== */
/* Zones and rounds                                                    */
/* ================================================================== */
function startZone(z) {
  W.rounds = genZone(Math.random, z);
  startRound(0);
}
function stopZone() {
  Object.assign(W, { phase: 'idle', frozen: false, afterResume: null, anim: null });
  $('callout').classList.add('hidden');
}
function startRound(i) {
  const round = W.rounds[i];
  Object.assign(W, { ri: i, round, tries: 0, anim: null, frozen: false, afterResume: null, slots: [null, null, null], op: null, tests: [] });
  if (G.zone === BOSS) arcade.setBossProgress((i / W.rounds.length) * 100);
  $('eqBox').classList.remove('ok'); showLine('');
  if (round.type === 'build') beginBuild(); else beginTrip();
  renderSign(true); renderCtl();
}
function rest(seconds) { W.phase = 'gap'; W.gapLeft = seconds; renderCtl(); }
function endRound() { rest(0.9); }
function nextRound() {
  if (W.ri + 1 < W.rounds.length) return startRound(W.ri + 1);
  W.phase = 'idle';
  if (G.zone === BOSS) arcade.setBossProgress(100);
  arcade.zoneCleared();
}
function stopFor(message, button, then) {
  W.frozen = true; W.afterResume = then;
  $('calloutText').textContent = message;
  $('resumeBtn').textContent = button;
  $('callout').classList.remove('hidden');
}
function resume() {
  if (!W.frozen || arcade.paused()) return;
  W.frozen = false;
  $('callout').classList.add('hidden');
  const then = W.afterResume;
  W.afterResume = null;
  if (then) then();
}
function showLine(text, off = false) { $('eqLine').textContent = text; $('eqLine').classList.toggle('off', off); }

/* ================================================================== */
/* A trip: set it up, roll, watch                                      */
/* ================================================================== */
/** The numbers the student may set for this round. */
const limits = (r) => (r.unknown === 'flag' ? r.axis : DIAL[r.unknown]);
function beginTrip() {
  const r = W.round, mid = Math.round((r.axis.lo + r.axis.hi) / 2);
  W.phase = 'set';
  W.v = r.unknown === 'flag' ? (mid === r.x ? mid + 3 : mid) : 1;   // never start on the answer
  W.testsLeft = r.tests || 0; W.fuseLeft = r.fuse; W.shownFuse = -1;
  $('story').textContent = r.story ? W.rounds[W.ri - 1].story : '';
  $('eq').textContent = eqText(r);
  $('eq').classList.remove('hidden'); $('slots').classList.add('hidden'); $('tiles').classList.add('hidden');
  $('track').classList.remove('hidden');
  $('track').classList.toggle('drag', r.unknown === 'flag');
  $('gearDial').classList.toggle('hidden', r.unknown === 'flag');
  track.draw(r.axis);
  track.layer.innerHTML = '<div class="triplab"></div><div class="flagpole"></div><div class="flagcloth"></div><div class="gear"></div><div class="tests"></div>';
  flag = track.layer.querySelector('.flagcloth'); pole = track.layer.querySelector('.flagpole'); gear = track.layer.querySelector('.gear');
  flag.classList.toggle('mine', r.unknown === 'flag');
  drawTrip();
}
function tripText(r) {
  const L = r.letter;
  if (r.kind === 'gear') return `${r.k} turns  ×  ${L} teeth each`;
  if (r.kind === 'flag') return `${r.k} turns  ×  ${r.c} teeth each`;
  if (r.kind === 'turns') return `${L} turns  ×  ${r.s} teeth each`;
  if (r.kind === 'offset') return `starts at ${r.b}, then ${r.k} turns  ×  ${L} teeth each`;
  return W.testsLeft > 0 ? 'a hidden gear: roll ONE test turn' : `the same gear makes ${r.n} turns`;
}
/** at: where the gear is drawn (while it rolls). Otherwise it sits at its start. */
function drawTrip(at = null) {
  const r = W.round, t = tripOf(r, W.v), pos = at === null ? t.start : at;
  gear.style.left = `${track.X(track.clamp(pos))}px`;
  gear.style.transform = `rotate(${Math.round(pos * 37)}deg)`;
  const fx = `${track.X(track.clamp(t.flag))}px`;
  pole.style.left = fx; flag.style.left = fx;
  flag.textContent = r.unknown === 'flag' ? `${r.letter} = ${W.v}` : t.flag;
  track.layer.querySelector('.triplab').textContent = tripText(r);
  $('dialLab').textContent = r.unknown === 'turns' ? 'TURNS' : 'TEETH PER TURN';
  $('dialVal').textContent = `${r.letter} = ${W.v}`;
  track.layer.querySelector('.tests').textContent = W.tests.join('     ');
}
const clearHops = () => { for (const h of track.layer.querySelectorAll('.hop')) h.remove(); };
function addHop(pos, n) {
  const h = document.createElement('div');
  h.className = 'hop'; h.style.left = `${track.X(track.clamp(pos))}px`; h.textContent = n;
  track.layer.appendChild(h);
}
const canSet = () => W.phase === 'set' && !busy();
function setV(v) {
  if (!canSet()) return;
  const { lo, hi } = limits(W.round);
  v = Math.round(Math.min(hi, Math.max(lo, v)));
  if (v === W.v) return;
  W.v = v; hubAudio.playStep(); drawTrip();
}
function roll() {
  if (!canSet()) return;
  const r = W.round, t = tripOf(r, W.v), turns = W.testsLeft > 0 ? 1 : t.turns;
  W.phase = 'run'; W.anim = { start: t.start, size: t.size, turns, i: 0, t: 0, each: Math.min(0.45, 3.2 / turns) };
  gear.classList.remove('bad', 'good'); clearHops();
  hubAudio.playCartridgeLaunch(); renderCtl();
}
function updateRun(dt) {
  const A = W.anim, r = W.round;
  A.t += dt;
  const u = Math.min(1, A.t / A.each), ease = u * u * (3 - 2 * u), from = A.start + A.i * A.size;
  drawTrip(from + A.size * ease);
  if (A.t < A.each + 0.12) return;                   // a beat at the end of each turn, so the turns can be counted
  A.i += 1; A.t = 0;
  addHop(A.start + A.i * A.size, A.i);
  hubAudio.playStep();
  if (A.i >= A.turns || A.start + A.i * A.size > r.axis.hi) landed();     // done, or it has rolled off the end of the track
}
function landed() {
  const r = W.round, A = W.anim;
  W.anim = null;
  if (W.testsLeft > 0) {                             // a free test turn: it leaves a note, no score
    W.testsLeft -= 1;
    W.tests.push(`1 turn → ${A.start + A.size}`);
    hubAudio.playSelect();
    drawTrip(A.start + A.size);
    W.phase = 'hold'; W.holdLeft = 1;
    renderSign(); return;
  }
  const res = checkTrip(r, W.v);
  showLine(res.message.split('. ')[0], !res.ok);
  if (res.ok) {
    arcade.good(15); hubAudio.playCoinClink();
    gear.classList.add('good'); flag.classList.add('ok'); $('eqBox').classList.add('ok');
    return rest(1.3);
  }
  W.tries += 1;
  gear.classList.add('bad');
  arcade.bad(res.key, 25);
  if (W.phase === 'idle') return;                    // that was the last spare gear: the zone has stopped
  const moveOn = W.tries >= 2;
  stopFor(res.message + (moveOn ? ` The answer: ${r.letter} = ${r.x}.` : ''), moveOn ? 'NEXT (ENTER)' : 'TRY AGAIN (ENTER)', moveOn ? endRound : backToSet);
}
function backToSet() {
  W.phase = 'set'; W.fuseLeft = W.round.fuse; W.shownFuse = -1;
  gear.classList.remove('bad'); clearHops();
  showLine(''); drawTrip(); renderCtl();
}

/* ================================================================== */
/* Write it: build the equation for a story                            */
/* ================================================================== */
const OP_TEXT = { '×': '×', '÷': '÷' };
function beginBuild() {
  const p = W.round;
  W.phase = 'build';
  $('story').textContent = p.story;
  $('eq').classList.add('hidden'); $('track').classList.add('hidden'); $('gearDial').classList.add('hidden');
  const slot = (k, cls = '') => `<button type="button" class="slot ${cls}" data-slot="${k}"></button>`;
  $('slots').innerHTML = `${slot(0)}${slot('op', 'op')}${slot(1)}<span>=</span>${slot(2)}`;
  $('tiles').innerHTML = `${p.tiles.map((t, i) => `<button type="button" class="tile" data-tile="${t.id}"><b>${i + 1}</b>${esc(t.text)}</button>`).join('')}
    <span class="opkeys">${Object.keys(OP_TEXT).map((op) => `<button type="button" data-op="${op}">${op}</button>`).join('')}</span>`;
  $('slots').classList.remove('hidden'); $('tiles').classList.remove('hidden');
  renderBuild();
}
$('tiles').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.blur(); if (b.dataset.tile) placeTile(b.dataset.tile); else setOp(b.dataset.op); });
$('slots').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.blur(); clearSlot(b.dataset.slot); });
const canBuild = () => W.phase === 'build' && !busy();
function renderBuild() {
  const p = W.round, text = (id) => (p.tiles.find((t) => t.id === id) || {}).text || '';
  W.slots.forEach((id, k) => { const el = $('slots').querySelector(`[data-slot="${k}"]`); el.textContent = text(id); el.classList.toggle('full', Boolean(id)); });
  const opEl = $('slots').querySelector('[data-slot="op"]'); opEl.textContent = W.op || ''; opEl.classList.toggle('full', Boolean(W.op));
  for (const b of $('tiles').querySelectorAll('[data-tile]')) b.classList.toggle('used', W.slots.includes(b.dataset.tile));
}
function placeTile(id) {
  if (!canBuild() || !id || W.slots.includes(id)) return;
  const k = W.slots.indexOf(null);
  if (k < 0) return;
  W.slots[k] = id; hubAudio.playStep(); renderBuild();
}
function setOp(op) { if (!canBuild() || !OP_TEXT[op]) return; W.op = op; hubAudio.playStep(); renderBuild(); }
function clearSlot(k) { if (!canBuild()) return; if (k === 'op') W.op = null; else W.slots[Number(k)] = null; renderBuild(); }
function clearLast() { if (!canBuild()) return; for (let k = 2; k >= 0; k--) if (W.slots[k]) { W.slots[k] = null; break; } renderBuild(); }
function sendEquation() {
  if (!canBuild()) return;
  const p = W.round, res = checkBuild(p, W.slots[0], W.op, W.slots[1], W.slots[2]);
  if (res.nudge) return showLine(res.message, true);
  if (res.correct) { arcade.good(15); hubAudio.playCoinClink(); showLine(res.message); $('eqBox').classList.add('ok'); return rest(1.4); }
  W.tries += 1;
  showLine('');
  arcade.bad(res.key, 25);
  if (W.phase === 'idle') return;
  const moveOn = W.tries >= 2;
  stopFor(res.message + (moveOn ? ` One way to write it: ${eqText(p.trip)}.` : ''), moveOn ? 'ROLL THE GEAR (ENTER)' : 'TRY AGAIN (ENTER)', moveOn ? endRound : () => { W.slots = [null, null, null]; W.op = null; renderBuild(); });
}

/* ================================================================== */
/* The clock, keys, sign and the bottom bar                            */
/* ================================================================== */
function update(dt) {
  if (W.phase === 'idle' || busy()) return;
  if (W.phase === 'gap') { W.gapLeft -= dt; if (W.gapLeft <= 0) nextRound(); return; }
  if (W.phase === 'hold') { W.holdLeft -= dt; if (W.holdLeft <= 0) { W.phase = 'set'; clearHops(); drawTrip(); renderCtl(); } return; }
  if (W.phase === 'run') return updateRun(dt);
  if (W.phase === 'set' && W.round.fuse && !G.practice && W.testsLeft === 0) {     // the gear rolls by itself when the fuse runs out
    W.fuseLeft -= dt;
    if (W.fuseLeft <= 0) return roll();
    if (Math.ceil(W.fuseLeft) !== W.shownFuse) renderCtl();
  }
}
function go() { if (W.phase === 'set') roll(); else if (W.phase === 'build') sendEquation(); }
function onKey(e) {
  const k = e.key;
  if (k === 'Enter') { e.preventDefault(); if (W.frozen) resume(); else go(); return; }
  if (W.frozen) return;
  if (W.phase === 'set' && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); setV(W.v + (k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? (W.round.unknown === 'flag' ? 10 : 5) : 1)); }
  if (W.phase === 'build') {
    const op = { '*': '×', x: '×', X: '×', '/': '÷' }[k];
    if (op) { e.preventDefault(); setOp(op); }
    else if (/^[1-3]$/.test(k)) placeTile((W.round.tiles[Number(k) - 1] || {}).id);
    else if (k === 'Backspace') { e.preventDefault(); clearLast(); }
  }
}
$('goBtn').addEventListener('click', (e) => { e.currentTarget.blur(); go(); });
$('resumeBtn').addEventListener('click', (e) => { e.currentTarget.blur(); resume(); });
$('dialDown').addEventListener('click', (e) => { e.currentTarget.blur(); setV(W.v - 1); });
$('dialUp').addEventListener('click', (e) => { e.currentTarget.blur(); setV(W.v + 1); });
// Drag the flag along the track (when the letter is where the gear stops).
let dragging = false;
const canDrag = () => canSet() && W.round.unknown === 'flag';
$('track').addEventListener('pointerdown', (e) => { if (!canDrag()) return; dragging = true; $('track').setPointerCapture(e.pointerId); setV(track.valueAt(e.clientX)); });
$('track').addEventListener('pointermove', (e) => { if (dragging && canDrag()) setV(track.valueAt(e.clientX)); });
$('track').addEventListener('pointerup', () => { dragging = false; });
$('track').addEventListener('pointercancel', () => { dragging = false; });

function renderSign(isNew = false) {
  const r = W.round, at = `${W.ri + 1}/${W.rounds.length}`;
  let small = `TRIP ${at} · TURNS × TEETH = FLAG`;
  let text = r.unknown === 'flag' ? 'PUT THE FLAG WHERE THE GEAR WILL STOP' : r.unknown === 'turns' ? 'SET THE TURNS SO THE GEAR STOPS ON THE FLAG' : 'PICK THE GEAR THAT STOPS ON THE FLAG';
  if (r.type === 'build') { small = `STORY ${at}`; text = 'WRITE THE EQUATION FOR THIS STORY'; }
  else if (r.kind === 'mystery') {
    small = W.testsLeft > 0 ? 'MYSTERY GEAR · 1 FREE TEST TURN' : 'MYSTERY GEAR · THIS ONE COUNTS';
    text = W.testsLeft > 0 ? 'ROLL ONE TURN: HOW BIG IS THE GEAR?' : `NOW PUT THE FLAG WHERE ${r.n} TURNS WILL STOP`;
  }
  $('signSmall').textContent = small;
  $('signText').textContent = text;
  if (isNew) { const s = $('sign'); s.classList.remove('new'); void s.offsetWidth; s.classList.add('new'); }
}
function renderCtl() {
  const p = W.phase, r = W.round || {};
  W.shownFuse = Math.ceil(W.fuseLeft);
  const fuse = p === 'set' && r.fuse && !G.practice && W.testsLeft === 0 ? ` · ${Math.max(1, W.shownFuse)}` : '';
  $('goBtn').classList.toggle('hidden', !(p === 'set' || p === 'build'));
  $('goBtn').textContent = p === 'build' ? 'CHECK THE EQUATION (ENTER)' : W.testsLeft > 0 ? 'ROLL A TEST TURN (ENTER)' : `ROLL THE GEAR (ENTER)${fuse}`;
  $('tip').textContent = p === 'build' ? 'Tap tiles to fill the spaces. Tap a space to empty it.'
    : p === 'set' ? (r.unknown === 'flag' ? '← → move the flag (Shift jumps 10), or drag it.' : '← → turn the dial (Shift jumps 5).') : '';
  $('waveTag').textContent = W.rounds.length ? `ROUND ${W.ri + 1}/${W.rounds.length}` : '';
}

let last = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  update(dt * W.speed);
  requestAnimationFrame(frame);
}
// Something to look at behind the briefing.
$('eq').textContent = '4x = 36';
track.draw({ lo: 0, hi: 40 });
requestAnimationFrame(frame);
