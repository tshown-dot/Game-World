// Undo Machine (Lesson 4-3: Write and Solve Addition and Subtraction Equations): the screen and the controls.
// The math is in undo.js. The number-line track is shared/game/track.js. The shared parts of an action game
// (briefing, top bar, boilers, hint card, report) are in shared/game/arcadeShell.js.
//
// A zone is a list of ROUNDS:
//   run    an equation is one run of the cart: the student sets the start (or the push), launches, and watches
//          whether the cart stops on the flag. A mystery run gives free test carts first.
//   build  write the equation for a story from tiles; the next round runs it
// All timing goes through update(), so the action stops cleanly whenever a banner, hint, help screen or mistake
// message is showing.
import { createArcade } from '../../../../shared/game/arcadeShell.js';
import { createTrack } from '../../../../shared/game/track.js';
import { ZONES, genZone, eqText, startOf, pushesOf, landOf, checkRun, checkBuild } from './undo.js';

const BOSS = ZONES.length - 1;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const track = createTrack($('track'));

// Everything about the round being played.
const W = {
  rounds: [], ri: 0, round: null, phase: 'idle',    // phase: idle, set, run, hold, build, gap
  v: 0,                                             // the student's number: where the cart starts, or how far it is pushed
  testsLeft: 0, tests: [], fuseLeft: 0, shownFuse: -1,
  anim: null, holdLeft: 0, tries: 0,
  slots: [null, null, null], op: null,              // build: which tile is in each space, and the operation
  gapLeft: 0, frozen: false, afterResume: null, speed: 1,
};
let cart = null, pushLab = null, flag = null;

const HINTS = {
  did_not_undo: 'Work BACKWARD from the flag.<span class="mono">x + 7 = 23 : the cart ends at 23 after +7, so it starts at 23 − 7</span>Adding is undone by subtracting, and subtracting by adding.',
  started_on_flag: 'The flag is the END of the run. The machine still pushes the cart, so it has to start somewhere else.<span class="mono">start + push = flag</span>',
  used_the_number: 'Read the equation as a run.<span class="mono">x + 7 = 23 : start at x, pushed 7, stops at 23</span>The 7 is the push. The letter is where the cart starts.',
  used_total: 'The push is how FAR the cart travels, not where it stops.<span class="mono">9 + x = 23 : from 9 to 23 is 23 − 9</span>',
  off: 'Check it before you launch: put your number into the equation and work out the side.<span class="mono">x + 7 = 23 : is your number plus 7 exactly 23?</span>',
  combine: 'Two pushes in a row make one bigger push.<span class="mono">x + 3 + 4 = 20 : pushed 7 in all, so x = 20 − 7</span>',
  mystery: 'One test cart is enough: where did it start, and where did it stop?<span class="mono">from 12 to 19 : the machine adds 7</span>Then work backward from the flag.',
  story_order: 'Say your equation as a sentence. Does it tell the story?<span class="mono">start, then what changed, equals what you end with</span>',
};
const TIPS = {
  did_not_undo: 'Solve x + 7 = 23 by subtracting 7; solve x − 5 = 12 by adding 5.',
  started_on_flag: 'In start + change = total, the total is not the starting amount.',
  used_the_number: 'The number added to the variable is the change, not the variable\'s value.',
  used_total: 'In 9 + x = 23, x is the difference between 9 and 23.',
  off: 'Check a solution by substituting it back into the equation.',
  combine: 'Combine the numbers first: x + 3 + 4 is x + 7.',
  mystery: 'Compare an input and its output to find what was added or taken away.',
  story_order: 'Write the story in order: start, change, result.',
};

const arcade = createArcade({
  zones: ZONES, startZone, stopZone, onKey, hints: HINTS, skillTips: TIPS, testName: '__undo',
  perfectText: 'Every cart on the flag: no mistakes to sharpen!',
  lifeLostText: (left) => (left > 0 ? `A BOILER BURST! ${left} LEFT` : 'MACHINE DOWN'),
});
const { G, hubAudio } = arcade;
if (window.__undo) window.__undo.W = W;
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
  if (round.type === 'build') beginBuild(); else beginRun();
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
/* A run: set it up, launch, watch                                     */
/* ================================================================== */
function beginRun() {
  const r = W.round, { lo, hi } = r.axis, mid = Math.round((lo + hi) / 2);
  W.phase = 'set';
  W.v = r.unknown === 'push' ? 1 : mid === r.x ? mid + 3 : mid;      // never start on the answer
  W.testsLeft = r.tests || 0; W.fuseLeft = r.fuse; W.shownFuse = -1;
  $('story').textContent = r.story ? W.rounds[W.ri - 1].story : '';
  $('eq').textContent = eqText(r);
  $('eq').classList.remove('hidden'); $('slots').classList.add('hidden'); $('tiles').classList.add('hidden');
  $('track').classList.remove('hidden');
  $('pushDial').classList.toggle('hidden', r.unknown !== 'push');
  track.draw(r.axis);
  track.layer.innerHTML = '<div class="flagpole"></div><div class="flagcloth"></div><div class="pushlab"></div><div class="ghost hidden"></div><div class="cart"></div><div class="tests"></div>';
  flag = track.layer.querySelector('.flagcloth'); cart = track.layer.querySelector('.cart'); pushLab = track.layer.querySelector('.pushlab');
  track.layer.querySelector('.flagpole').style.left = `${track.X(r.c)}px`;
  flag.style.left = `${track.X(r.c)}px`; flag.textContent = r.c;
  cart.classList.toggle('fixed', r.unknown === 'push');
  drawCart();
}
function pushText(r) {
  if (r.kind === 'start_plus') return `+ ${r.a} ▶`;
  if (r.kind === 'start_minus') return `◀ − ${r.a}`;
  if (r.kind === 'two') return `+ ${r.a}, then + ${r.b} ▶`;
  if (r.kind === 'push_plus') return `+ ${r.letter} ▶`;
  if (r.kind === 'push_minus') return `◀ − ${r.letter}`;
  return '? ?';
}
/** at: where the cart is drawn (while it runs). Otherwise it sits at its start. */
function drawCart(at = null) {
  const r = W.round, pos = at === null ? startOf(r, W.v) : at;
  cart.style.left = `${track.X(track.clamp(pos))}px`;
  cart.textContent = at !== null ? Math.round(at) : r.unknown === 'start' ? `${r.letter} = ${W.v}` : r.s;
  pushLab.style.left = cart.style.left; pushLab.textContent = pushText(r);
  $('dialLab').textContent = `PUSH ${r.kind === 'push_minus' ? 'BACK' : 'FORWARD'}`;
  $('dialVal').textContent = `${r.letter} = ${W.v}`;
  track.layer.querySelector('.tests').textContent = W.tests.join('     ');
}
const canSet = () => W.phase === 'set' && !busy();
function setV(v) {
  if (!canSet()) return;
  const { lo, hi } = W.round.axis;
  v = Math.round(Math.min(hi, Math.max(lo, v)));
  if (v === W.v) return;
  W.v = v; hubAudio.playStep(); drawCart();
}
function launch() {
  if (!canSet()) return;
  const r = W.round, pts = [startOf(r, W.v)];
  for (const p of pushesOf(r, W.v)) pts.push(pts[pts.length - 1] + p);
  W.phase = 'run'; W.anim = { pts, i: 0, t: 0 };
  const ghost = track.layer.querySelector('.ghost');            // a mark where the cart started, so the whole run can be seen
  ghost.style.left = `${track.X(track.clamp(pts[0]))}px`; ghost.textContent = pts[0]; ghost.classList.remove('hidden');
  cart.classList.remove('bad', 'good');
  hubAudio.playCartridgeLaunch(); renderCtl();
}
function updateRun(dt) {
  const A = W.anim;
  A.t += dt;
  const u = Math.min(1, A.t / 0.9), ease = u * u * (3 - 2 * u), from = A.pts[A.i], to = A.pts[A.i + 1];
  drawCart(from + (to - from) * ease);
  if (A.t < 1.1) return;                             // a short stop at the end of each push
  A.i += 1; A.t = 0;
  if (A.i >= A.pts.length - 1) landed();
}
function landed() {
  const r = W.round, land = landOf(r, W.v);
  W.anim = null;
  if (W.testsLeft > 0) {                             // a free test cart: it leaves a note, no score
    W.testsLeft -= 1;
    W.tests.push(`${W.v} → ${land}`);
    hubAudio.playSelect();
    drawCart(land);
    W.phase = 'hold'; W.holdLeft = 0.8;
    renderSign(); return;
  }
  const res = checkRun(r, W.v);
  showLine(res.message.split('. ')[0], !res.ok);
  if (res.ok) {
    arcade.good(15); hubAudio.playCoinClink();
    cart.classList.add('good'); flag.classList.add('ok'); $('eqBox').classList.add('ok');
    return rest(1.3);
  }
  W.tries += 1;
  cart.classList.add('bad');
  arcade.bad(res.key, 25);
  if (W.phase === 'idle') return;                    // that was the last boiler: the zone has stopped
  const moveOn = W.tries >= 2;
  stopFor(res.message + (moveOn ? ` The answer: ${r.letter} = ${r.x}.` : ''), moveOn ? 'NEXT (ENTER)' : 'TRY AGAIN (ENTER)', moveOn ? endRound : backToSet);
}
function backToSet() {
  W.phase = 'set'; W.fuseLeft = W.round.fuse; W.shownFuse = -1;
  cart.classList.remove('bad');
  track.layer.querySelector('.ghost').classList.add('hidden');
  showLine(''); drawCart(); renderCtl();
}

/* ================================================================== */
/* Write it: build the equation for a story                            */
/* ================================================================== */
const OP_TEXT = { '+': '+', '-': '−' };
function beginBuild() {
  const p = W.round;
  W.phase = 'build';
  $('story').textContent = p.story;
  $('eq').classList.add('hidden'); $('track').classList.add('hidden'); $('pushDial').classList.add('hidden');
  const slot = (k, cls = '') => `<button type="button" class="slot ${cls}" data-slot="${k}"></button>`;
  $('slots').innerHTML = `${slot(0)}${slot('op', 'op')}${slot(1)}<span>=</span>${slot(2)}`;
  $('tiles').innerHTML = `${p.tiles.map((t, i) => `<button type="button" class="tile" data-tile="${t.id}"><b>${i + 1}</b>${esc(t.text)}</button>`).join('')}
    <span class="opkeys">${Object.entries(OP_TEXT).map(([op, text]) => `<button type="button" data-op="${op}">${text}</button>`).join('')}</span>`;
  $('slots').classList.remove('hidden'); $('tiles').classList.remove('hidden');
  renderBuild();
}
$('tiles').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.blur(); if (b.dataset.tile) placeTile(b.dataset.tile); else setOp(b.dataset.op); });
$('slots').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.blur(); clearSlot(b.dataset.slot); });
const canBuild = () => W.phase === 'build' && !busy();
function renderBuild() {
  const p = W.round, text = (id) => (p.tiles.find((t) => t.id === id) || {}).text || '';
  W.slots.forEach((id, k) => { const el = $('slots').querySelector(`[data-slot="${k}"]`); el.textContent = text(id); el.classList.toggle('full', Boolean(id)); });
  const opEl = $('slots').querySelector('[data-slot="op"]'); opEl.textContent = W.op ? OP_TEXT[W.op] : ''; opEl.classList.toggle('full', Boolean(W.op));
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
  stopFor(res.message + (moveOn ? ` One way to write it: ${eqText(p.run)}.` : ''), moveOn ? 'RUN THE CART (ENTER)' : 'TRY AGAIN (ENTER)', moveOn ? endRound : () => { W.slots = [null, null, null]; W.op = null; renderBuild(); });
}

/* ================================================================== */
/* The clock, keys, sign and the bottom bar                            */
/* ================================================================== */
function update(dt) {
  if (W.phase === 'idle' || busy()) return;
  if (W.phase === 'gap') { W.gapLeft -= dt; if (W.gapLeft <= 0) nextRound(); return; }
  if (W.phase === 'hold') { W.holdLeft -= dt; if (W.holdLeft <= 0) { W.phase = 'set'; track.layer.querySelector('.ghost').classList.add('hidden'); drawCart(); renderCtl(); } return; }
  if (W.phase === 'run') return updateRun(dt);
  if (W.phase === 'set' && W.round.fuse && !G.practice && W.testsLeft === 0) {     // the machine fires by itself when the fuse runs out
    W.fuseLeft -= dt;
    if (W.fuseLeft <= 0) return launch();
    if (Math.ceil(W.fuseLeft) !== W.shownFuse) renderCtl();
  }
}
function go() { if (W.phase === 'set') launch(); else if (W.phase === 'build') sendEquation(); }
function onKey(e) {
  const k = e.key;
  if (k === 'Enter') { e.preventDefault(); if (W.frozen) resume(); else go(); return; }
  if (W.frozen) return;
  if (W.phase === 'set' && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); setV(W.v + (k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 10 : 1)); }
  if (W.phase === 'build') {
    if (k === '+' || k === '-') { e.preventDefault(); setOp(k); }
    else if (/^[1-3]$/.test(k)) placeTile((W.round.tiles[Number(k) - 1] || {}).id);
    else if (k === 'Backspace') { e.preventDefault(); clearLast(); }
  }
}
$('goBtn').addEventListener('click', (e) => { e.currentTarget.blur(); go(); });
$('resumeBtn').addEventListener('click', (e) => { e.currentTarget.blur(); resume(); });
$('dialDown').addEventListener('click', (e) => { e.currentTarget.blur(); setV(W.v - 1); });
$('dialUp').addEventListener('click', (e) => { e.currentTarget.blur(); setV(W.v + 1); });
// Drag the cart along the track (when the letter is where it starts).
let dragging = false;
const canDrag = () => canSet() && W.round.unknown === 'start';
$('track').addEventListener('pointerdown', (e) => { if (!canDrag()) return; dragging = true; $('track').setPointerCapture(e.pointerId); setV(track.valueAt(e.clientX)); });
$('track').addEventListener('pointermove', (e) => { if (dragging && canDrag()) setV(track.valueAt(e.clientX)); });
$('track').addEventListener('pointerup', () => { dragging = false; });
$('track').addEventListener('pointercancel', () => { dragging = false; });

function renderSign(isNew = false) {
  const r = W.round, at = `${W.ri + 1}/${W.rounds.length}`;
  let small = `CART ${at} · START + PUSH = FLAG`, text = r.unknown === 'push' ? 'SET THE PUSH SO THE CART STOPS ON THE FLAG' : 'PLACE THE CART SO IT STOPS ON THE FLAG';
  if (r.type === 'build') { small = `STORY ${at}`; text = 'WRITE THE EQUATION FOR THIS STORY'; }
  else if (r.kind === 'mystery') {
    small = W.testsLeft > 0 ? `MYSTERY MACHINE · ${W.testsLeft} TEST CART${W.testsLeft === 1 ? '' : 'S'} LEFT` : 'MYSTERY MACHINE · THIS ONE COUNTS';
    text = W.testsLeft > 0 ? 'SEND A TEST CART: WHAT DOES THE MACHINE DO?' : 'NOW PLACE THE CART TO STOP ON THE FLAG';
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
  $('goBtn').textContent = p === 'build' ? 'CHECK THE EQUATION (ENTER)' : W.testsLeft > 0 ? 'SEND A TEST CART (ENTER)' : `LAUNCH (ENTER)${fuse}`;
  $('tip').textContent = p === 'build' ? 'Tap tiles to fill the spaces. Tap a space to empty it.'
    : p === 'set' ? (r.unknown === 'push' ? '← → change the push (Shift jumps 10).' : '← → move the cart (Shift jumps 10), or drag it.') : '';
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
$('eq').textContent = 'x + 7 = 23';
track.draw({ lo: 0, hi: 30 });
requestAnimationFrame(frame);
