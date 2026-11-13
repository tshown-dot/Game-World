// Counterweight (Lesson 4-2: Apply Properties of Equality): the screen and the controls.
// The math is in balance.js. The shared parts of an action game (briefing, top bar, chains, hint card, report) are in
// shared/game/arcadeShell.js.
//
// The balance scale is the playfield, and its beam really tips. A zone is a list of ROUNDS (see balance.js):
//   match    the saboteur changes one pan and the beam starts to tip: do the same thing to the other pan in time
//   solve    choose one operation; the machine does it to both pans; the goal is one x-block alone
//   inspect  a repaired scale is clamped: call it LEVEL or TIPS, then the clamp opens
// All timing goes through update(), so the action stops cleanly whenever a banner, hint, help screen or mistake
// message is showing.
import { createArcade } from '../../../../shared/game/arcadeShell.js';
import {
  ZONES, OPS, OP_SIGN, DIAL, genZone, applyOp, settled, tilt, stepText, hitPan, checkMatch, matchAnswer, checkSolve, solveAnswer, checkInspect,
} from './balance.js';

const BOSS = ZONES.length - 1;
const $ = (id) => document.getElementById(id);

// Everything about the round being played.
const W = {
  rounds: [], ri: 0, round: null, phase: 'idle',    // phase: idle, match, solve, inspect, run, hold, gap
  left: null, right: null,                          // the two pans as they stand
  step: 0, t: 0,                                    // match: which of the saboteur's changes is being matched, and seconds since it began
  op: null, n: 2, typed: '', typedAt: 0,            // the student's move: an operation and an amount
  angle: 0, lurch: 0,                               // the beam, in degrees (positive: the right pan is down)
  anim: null, tries: 0,
  gapLeft: 0, frozen: false, afterResume: null, speed: 1,
};

const HINTS = {
  undid: 'Matching is not undoing. If one pan gets + 6, the other pan needs + 6 too.<span class="mono">12 + 6 = 12 + 6</span>',
  amount: 'Same operation AND same amount.<span class="mono">× 3 on one pan : × 3 on the other</span>',
  mixed_ops: 'Times 2 and plus 2 are different changes.<span class="mono">12 × 2 = 24, but 12 + 2 = 14</span>',
  off: 'Read what was done to the first pan, then do exactly that to the second.',
  too_slow: 'Look at the burst on the pan first: the operation and the amount are both there.',
  same_op: 'To get x alone, UNDO what is with it, on both pans.<span class="mono">x + 5 = 9 : subtract 5 from both</span>',
  wrong_kind: 'Undo adding with subtracting, and multiplying with dividing.<span class="mono">3x = 12 : divide both by 3</span>',
  one_side: 'A change to only one pan always tips the scale.',
  amounts: 'Both pans need the same amount, not just the same operation.',
  mixed: 'Both pans need the same operation, not just the same number.<span class="mono">× 2 and + 2 are different</span>',
  partial: 'Multiplying a pan means multiplying EVERYTHING on it.<span class="mono">(x + 2) × 3 = 3x + 6, not 3x + 2</span>',
  doubted_same: 'The same operation with the same amount on both pans always keeps the scale level. That is the property of equality.',
};
const TIPS = {
  undid: 'To keep an equation true, do the SAME operation to both sides.',
  amount: 'Use the same amount on both sides of the equation.',
  mixed_ops: 'Multiplying by 2 and adding 2 are different operations.',
  off: 'Whatever is done to one side of an equation must be done to the other.',
  too_slow: 'Read the operation and the amount, then match them.',
  same_op: 'To isolate x, use the inverse operation on both sides.',
  wrong_kind: 'Addition and subtraction undo each other; so do multiplication and division.',
  one_side: 'Changing one side only makes the equation false.',
  amounts: 'Both sides need the same amount.',
  mixed: 'Both sides need the same operation.',
  partial: 'Multiply or divide every term on a side, not just one.',
  doubted_same: 'The properties of equality: the same operation on both sides keeps the equation true.',
};

const arcade = createArcade({
  zones: ZONES, startZone, stopZone, onKey, hints: HINTS, skillTips: TIPS, testName: '__scale',
  perfectText: 'Level every time: no mistakes to sharpen!',
  lifeLostText: (left) => (left > 0 ? `A CHAIN SNAPPED! ${left} LEFT` : 'THE SCALE FELL'),
});
const { G, hubAudio } = arcade;
if (window.__scale) window.__scale.W = W;
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
  const p = W.rounds[i];
  Object.assign(W, { ri: i, round: p, tries: 0, anim: null, frozen: false, afterResume: null, left: p.left, right: p.right, step: 0, t: 0, op: null, n: 2, typed: '', lurch: 0 });
  if (G.zone === BOSS) arcade.setBossProgress((i / W.rounds.length) * 100);
  showLine(''); setStamp(''); clearBursts();
  $('before').classList.toggle('hidden', p.type !== 'inspect');
  $('clamp').classList.toggle('hidden', p.type !== 'inspect');
  $('panL').classList.remove('mine'); $('panR').classList.remove('mine');
  if (p.type === 'match') beginMatch(); else if (p.type === 'solve') W.phase = 'solve'; else beginInspect();
  renderSign(true); renderPans(); renderWork(); renderCtl();
}
function rest(seconds) { W.phase = 'gap'; W.gapLeft = seconds; renderWork(); renderCtl(); }
function endRound() { rest(0.7); }
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
function showLine(text, off = false) { $('cline').textContent = text; $('cline').classList.toggle('off', off); }
/** A short wait inside a round (the saboteur winding up, pans settling). */
function pause(seconds, then) { W.phase = 'run'; W.anim = { left: seconds, then }; renderWork(); renderCtl(); }

/* ================================================================== */
/* The scale                                                           */
/* ================================================================== */
const MAX_TILT = 13, ARM = 300;                      // degrees when a pan is on the ground, and half the beam's length
function renderPans(wasL = '', wasR = '') {
  const set = (id, s, was) => { $(id).querySelector('.ptext').textContent = s.text; $(id).querySelector('.ptext').classList.toggle('long', s.text.length > 11); $(id).querySelector('.pwas').textContent = was; };
  set('panL', W.left, wasL); set('panR', W.right, wasR);
}
function drawBeam() {
  const drop = Math.sin((W.angle * Math.PI) / 180) * ARM;
  $('beam').style.transform = `rotate(${W.angle}deg)`;
  $('panL').style.transform = `translateY(${-drop}px)`; $('panR').style.transform = `translateY(${drop}px)`;
}
function burst(side, text) { const b = $(side === 'left' ? 'panL' : 'panR').querySelector('.burst'); b.textContent = text; b.classList.remove('hidden'); void b.offsetWidth; b.classList.add('pop'); }
function clearBursts() { for (const b of document.querySelectorAll('.burst')) { b.classList.add('hidden'); b.classList.remove('pop'); } }
function setStamp(text) { const s = $('stamp'); s.textContent = text; s.classList.remove('show'); if (text) { void s.offsetWidth; s.classList.add('show'); } }
/** Where the beam is heading: the heavier pan goes down. In a match round it tips slowly, as a timer. */
function beamGoal() {
  const p = W.round, dir = tilt(W.left, W.right, p.x);
  if (W.lurch) return W.lurch * MAX_TILT;
  if (W.phase === 'match') return dir * MAX_TILT * Math.min(1, W.t / p.seconds);
  if (W.phase === 'inspect' || (p.type === 'inspect' && !W.opened)) return 0;
  return dir * MAX_TILT;
}
function updateBeam(dt) {
  const goal = beamGoal(), move = 45 * dt;
  W.angle += Math.max(-move, Math.min(move, goal - W.angle));
  drawBeam();
}

/* ================================================================== */
/* The student's move: an operation and an amount                      */
/* ================================================================== */
const canMove = () => (W.phase === 'match' || W.phase === 'solve') && !busy();
function setOp(op) { if (!canMove() || !OPS.includes(op)) return; W.op = op; W.typed = ''; hubAudio.playStep(); showLine(''); renderWork(); }
function setN(n) { if (!canMove()) return; n = Math.min(DIAL.hi, Math.max(DIAL.lo, Math.round(n))); if (n === W.n) return; W.n = n; hubAudio.playStep(); showLine(''); renderWork(); }
/** Number keys: typing 1 then 2 quickly makes 12. */
function typeDigit(d) {
  const now = performance.now();
  W.typed = now - W.typedAt < 1200 && W.typed.length < 2 ? W.typed + d : d;
  W.typedAt = now;
  if (Number(W.typed) >= DIAL.lo) setN(Number(W.typed));
}
function renderWork() {
  const ph = W.phase;
  if (ph === 'inspect') { $('work').innerHTML = '<button type="button" class="kbtn lev" data-says="level">▲ STAYS LEVEL</button><button type="button" class="kbtn tip2" data-says="tips">▼ TIPS</button>'; return; }
  if (ph !== 'match' && ph !== 'solve') { $('work').innerHTML = ''; return; }
  $('work').innerHTML = `<div class="opkeys2">${OPS.map((o) => `<button type="button" class="${W.op === o ? 'on' : ''}" data-op="${o}">${OP_SIGN[o]}</button>`).join('')}</div>
    <div class="ndial"><button type="button" data-n="-1" title="Less (left arrow)">◀</button><span class="val" id="moveVal">${W.op ? stepText(W.op, W.n) : `? ${W.n}`}</span><button type="button" data-n="1" title="More (right arrow)">▶</button></div>`;
}
$('work').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || busy()) return; b.blur();
  const d = b.dataset;
  if (d.op) setOp(d.op); else if (d.n) setN(W.n + Number(d.n)); else if (d.says) decideInspect(d.says === 'level');
});
/** A mistake the student can try again once. After the second miss the answer is given and the round moves on. */
function miss(res, { answer, retry }) {
  W.tries += 1; W.phase = 'hold';
  arcade.bad(res.key, 25);
  if (W.phase === 'idle') return;                    // that was the last chain: the zone has stopped
  const moveOn = W.tries >= 2;
  stopFor(res.message + (moveOn ? ` ${answer}` : ''), moveOn ? 'NEXT (ENTER)' : 'TRY AGAIN (ENTER)', moveOn ? endRound : retry);
  renderWork(); renderCtl();
}

/* ================================================================== */
/* Match: the saboteur hits one pan                                    */
/* ================================================================== */
const PAN_ID = { left: 'panL', right: 'panR' };
function beginMatch() {
  const p = W.round;
  pause(0.8, () => {                                 // a beat with the scale level, then the saboteur strikes
    const hit = hitPan(p), was = p.curtain ? `was: ${p[p.side].text}` : '';
    W[p.side] = p.curtain ? { ...hit, text: settled(hit) } : hit;
    burst(p.side, p.curtain ? '? ? ?' : p.hits.map((h) => stepText(h.op, h.n)).join(' then '));
    $(PAN_ID[p.other]).classList.add('mine');
    renderPans(p.side === 'left' ? was : '', p.side === 'right' ? was : '');
    hubAudio.playLockRattle();
    W.phase = 'match'; W.t = 0; W.mine = p[p.other];
    renderSign(); renderWork(); renderCtl();
  });
}
function updateMatch(dt) {
  const p = W.round;
  W.t += dt;
  if (G.practice) W.t = Math.min(W.t, p.seconds * 0.45);   // practice: the beam leans and waits
  if (W.t < p.seconds) return;
  miss({ key: 'too_slow', message: 'Too slow: the pan hit the ground. Read the burst on the other pan, then match it.' }, { answer: matchAnswer(p, W.step), retry: retryMatch });
}
function retryMatch() {
  const p = W.round;
  W[p.other] = W.mine; W.lurch = 0; W.t = 0; W.phase = 'match';
  renderPans(...wasTexts()); showLine(''); renderWork(); renderCtl();
}
const wasTexts = () => { const p = W.round, was = p.curtain ? `was: ${p[p.side].text}` : ''; return [p.side === 'left' ? was : '', p.side === 'right' ? was : '']; };
function goMatch() {
  const p = W.round;
  if (!W.op) return showLine('Choose + − × or ÷ first.', true);
  const res = checkMatch(p, W.step, W.mine, W.op, W.n);
  W[p.other] = res.pan; renderPans(...wasTexts());
  if (!res.ok) { W.lurch = tilt(W.left, W.right, p.x) || (p.side === 'left' ? -1 : 1); return miss(res, { answer: matchAnswer(p, W.step), retry: retryMatch }); }
  arcade.good(10); hubAudio.playCoinClink(); setStamp(res.property);
  W.mine = res.pan; W.step += 1; W.t = 0; W.op = null; W.typed = '';
  if (W.step < p.hits.length) { showLine(`${res.message.replace(': level again.', '.')} One more change to match.`); return renderWork(); }
  showLine(res.message); clearBursts();
  rest(1.2);
}

/* ================================================================== */
/* Solve: one move, done to both pans                                  */
/* ================================================================== */
function goSolve() {
  const p = W.round;
  if (!W.op) return showLine('Choose + − × or ÷ first.', true);
  const res = checkSolve(p, W.op, W.n);
  W.left = applyOp(p.left, W.op, W.n); W.right = applyOp(p.right, W.op, W.n); renderPans();   // first show the move on both pans...
  hubAudio.playCartridgeLaunch();
  pause(0.7, () => {                                                                         // ...then what each pan comes to
    W.left = res.left; W.right = res.right; renderPans();
    if (res.ok) { arcade.good(15); hubAudio.playCoinClink(); setStamp(res.property); showLine(res.message); return rest(1.4); }
    miss(res, { answer: solveAnswer(p), retry: () => { W.left = p.left; W.right = p.right; W.phase = 'solve'; W.op = null; renderPans(); renderWork(); renderCtl(); } });
  });
}

/* ================================================================== */
/* Inspect: a clamped scale                                            */
/* ================================================================== */
const INSPECT_SECONDS = 9;
function beginInspect() {
  const p = W.round;
  W.phase = 'inspect'; W.t = 0; W.opened = false;
  $('before').textContent = `BEFORE THE REPAIR:  ${p.before}`;
  $('clamp').textContent = 'CLAMPED';
}
function updateInspect(dt) {
  if (G.practice) return;
  W.t += dt;
  const left = Math.ceil(INSPECT_SECONDS - W.t);
  $('clamp').textContent = left <= 5 ? `OPENS IN ${Math.max(1, left)}` : 'CLAMPED';
  if (W.t >= INSPECT_SECONDS) openClamp(null);
}
function decideInspect(saysLevel) { if (W.phase === 'inspect' && !busy()) openClamp(saysLevel); }
/** saysLevel: the student's call, or null when the clamp opened by itself. */
function openClamp(saysLevel) {
  const p = W.round, res = saysLevel === null ? { ok: false, key: 'too_slow', message: `Too slow: the clamp opened by itself. ${p.level ? 'It stayed level.' : 'It tipped.'} ${p.why}` } : checkInspect(p, saysLevel);
  W.opened = true;
  $('clamp').classList.add('hidden');
  hubAudio.playCartridgeLaunch();
  pause(0.7, () => {
    if (res.ok) { arcade.good(10); hubAudio.playCoinClink(); showLine(res.message); return rest(1.1); }
    W.phase = 'hold';
    arcade.bad(res.key, 20);
    if (W.phase === 'idle') return;
    stopFor(res.message, 'CARRY ON (ENTER)', endRound);   // the scale has shown the answer, so the line moves on
    renderWork(); renderCtl();
  });
}

/* ================================================================== */
/* The clock, keys, sign and the bottom bar                            */
/* ================================================================== */
function update(dt) {
  if (W.phase === 'idle' || arcade.paused()) return;
  updateBeam(dt);                                   // the beam keeps moving behind a mistake message, so the tip is seen
  if (W.frozen) return;
  if (W.phase === 'gap') { W.gapLeft -= dt; if (W.gapLeft <= 0) nextRound(); return; }
  if (W.phase === 'run') { W.anim.left -= dt; if (W.anim.left <= 0) { const { then } = W.anim; W.anim = null; then(); } return; }
  if (W.phase === 'match') updateMatch(dt);
  else if (W.phase === 'inspect') updateInspect(dt);
}
function go() { if (busy()) return; if (W.phase === 'match') goMatch(); else if (W.phase === 'solve') goSolve(); }
const OP_KEYS = { '+': '+', '-': '-', '*': '×', x: '×', X: '×', '/': '÷' };
function onKey(e) {
  const k = e.key;
  if (k === 'Enter') { e.preventDefault(); if (W.frozen) resume(); else go(); return; }
  if (W.frozen) return;
  if (W.phase === 'inspect') { if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); decideInspect(k === 'ArrowUp'); } return; }
  if (OP_KEYS[k]) { e.preventDefault(); setOp(OP_KEYS[k]); }
  else if (/^\d$/.test(k)) typeDigit(k);
  else if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); setN(W.n + (k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 5 : 1)); }
}
$('goBtn').addEventListener('click', (e) => { e.currentTarget.blur(); go(); });
$('resumeBtn').addEventListener('click', (e) => { e.currentTarget.blur(); resume(); });

function renderSign(isNew = false) {
  const p = W.round, at = `${W.ri + 1}/${W.rounds.length}`;
  let small = `SCALE ${at} · SAME THING, BOTH PANS`, text = 'THE SABOTEUR HIT ONE PAN. DO THE SAME TO THE OTHER';
  if (p.type === 'match' && p.curtain) { small = `SCALE ${at} · BEHIND THE CURTAIN`; text = 'WHAT WAS DONE TO THAT PAN? DO THE SAME TO THIS ONE'; }
  else if (p.type === 'match' && p.hits.length === 2) text = 'TWO CHANGES! MATCH THEM IN THE SAME ORDER';
  else if (p.type === 'solve') { small = `SCALE ${at} · YOUR MOVE`; text = 'GET THE x-BLOCK ALONE: ONE MOVE, DONE TO BOTH PANS'; }
  else if (p.type === 'inspect') { small = `SCALE ${at} · INSPECTION`; text = 'THE CLAMP IS ABOUT TO OPEN: LEVEL, OR WILL IT TIP?'; }
  $('signSmall').textContent = small;
  $('signText').textContent = text;
  if (isNew) { const s = $('sign'); s.classList.remove('new'); void s.offsetWidth; s.classList.add('new'); }
}
function renderCtl() {
  const ph = W.phase;
  const label = { match: 'DO IT TO THE OTHER PAN (ENTER)', solve: 'DO IT TO BOTH PANS (ENTER)' }[ph];
  $('goBtn').classList.toggle('hidden', !label);
  $('goBtn').textContent = label || '';
  $('tip').textContent = { match: '+ − × ÷ for the operation · number keys or ← → for the amount', solve: '+ − × ÷ for the operation · number keys or ← → for the amount',
    inspect: '↑ stays level · ↓ tips' }[ph] || '';
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
$('panL').querySelector('.ptext').textContent = 'x + 3'; $('panR').querySelector('.ptext').textContent = '9';
drawBeam();
requestAnimationFrame(frame);
