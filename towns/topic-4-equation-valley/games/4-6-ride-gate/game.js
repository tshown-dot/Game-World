// Ride Gate (Lesson 4-6: Understand and Write Inequalities): the screen and the controls.
// The math is in gate.js. The shared parts of an action game (briefing, top bar, passes, hint card, report) are in
// shared/game/arcadeShell.js.
//
// Riders walk up to a gate carrying a number. A zone is a list of ROUNDS (see gate.js):
//   keep   the student is the gate: let each rider in or turn them away before they reach it
//   write  the student writes the rule from tiles and the gate runs exactly that rule on a line of riders
//          (a hidden sign starts with test riders whose numbers the student chooses)
// All timing goes through update(), so the action stops cleanly whenever a banner, hint, help screen or mistake
// message is showing.
import { createArcade } from '../../../../shared/game/arcadeShell.js';
import { ZONES, genZone, genKeep, ruleText, riderText, checkRider, checkWritten, gateRun, consequence, answerText, testRider, passes } from './gate.js';

const BOSS = ZONES.length - 1;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Everything about the round being played.
const W = {
  rounds: [], ri: 0, round: null, phase: 'idle',    // phase: idle, keep, test, build, run, hold, gap
  k: 0, kx: 0, kwait: 0, misses: 0, extraKeep: false, // keep: which rider, how far they have walked, a pause before the next
  slots: [null, null], sym: null,                   // build: the tile in each space, and the symbol
  tv: 0, testsLeft: 0, notes: [],                   // hidden sign: the test rider's number, tests left, what each test showed
  anim: null, tries: 0,
  gapLeft: 0, frozen: false, afterResume: null, speed: 1,
};

const HINTS = {
  boundary_rider: 'The rider exactly on the edge is the one to watch.<span class="mono">at least 42 : 42 gets in</span><span class="mono">taller than 42 : 42 does not</span>',
  rider_wrong: 'Turn the sign into a rule, then put the rider\'s number in.<span class="mono">h ≥ 42 : is 40 ≥ 42? No.</span>',
  too_slow: 'Find the edge number on the sign first. Then each rider is quick: above it, below it, or exactly on it?',
  boundary: 'The line under the symbol means "or equal to".<span class="mono">at least, at most, no more than : ≥ ≤</span><span class="mono">more than, under, taller than : &gt; &lt;</span>',
  direction: 'The symbol opens toward the bigger amount.<span class="mono">h &gt; 42 : h is the bigger one</span>',
  not_equal: '≠ means "not this one value". Everything else gets in.<span class="mono">r ≠ 7 : any ride but ride 7</span>',
  flipped_order: 'The same rule can start with the number, if the symbol turns around.<span class="mono">h ≥ 42 is the same as 42 ≤ h</span>',
  other_side: 'Who is kept out, and who gets in, are opposite sides of the same edge.<span class="mono">no one under 8 : a ≥ 8 gets in</span>',
  calc_first: 'Sometimes the edge is not printed on the sign. Work it out first, then write the rule.',
};
const TIPS = {
  boundary_rider: 'Check the boundary value itself: ≥ and ≤ include it, > and < do not.',
  rider_wrong: 'Test a value by substituting it into the inequality.',
  too_slow: 'Find the boundary number first, then compare.',
  boundary: '"At least" and "at most" include the number (≥, ≤). "More than" and "less than" do not (>, <).',
  direction: 'The inequality symbol opens toward the greater amount.',
  not_equal: '≠ means every value except one.',
  flipped_order: 'h ≥ 42 and 42 ≤ h are the same inequality.',
  other_side: 'The values a rule leaves out are on the other side of the boundary.',
  calc_first: 'Find the boundary number before writing the inequality.',
};

const arcade = createArcade({
  zones: ZONES, startZone, stopZone, onKey, hints: HINTS, skillTips: TIPS, testName: '__gate',
  perfectText: 'Every rider sorted: no mistakes to sharpen!',
  lifeLostText: (left) => (left > 0 ? `A PASS IS GONE! ${left} LEFT` : 'GATE CLOSED'),
});
const { G, hubAudio } = arcade;
if (window.__gate) window.__gate.W = W;
const busy = () => W.frozen || arcade.paused();

/* ================================================================== */
/* Zones and rounds                                                    */
/* ================================================================== */
function startZone(z) {
  W.rounds = genZone(Math.random, z);
  W.extraKeep = false;
  startRound(0);
}
function stopZone() {
  Object.assign(W, { phase: 'idle', frozen: false, afterResume: null, anim: null });
  $('callout').classList.add('hidden');
}
function startRound(i) {
  const round = W.rounds[i];
  Object.assign(W, { ri: i, round, tries: 0, anim: null, frozen: false, afterResume: null, slots: [null, null], sym: null, notes: [], misses: 0 });
  if (G.zone === BOSS) arcade.setBossProgress((i / W.rounds.length) * 100);
  showLine(''); clearLane();
  if (round.type === 'keep') beginKeep(); else beginWrite();
  renderSign(true); renderWork(); renderCtl();
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
function showLine(text, off = false) { $('gline').textContent = text; $('gline').classList.toggle('off', off); }

/* ================================================================== */
/* The lane: the ride's sign, the gate, its lamp and the riders        */
/* ================================================================== */
const GATE_X = 62;                                    // where a rider stops, as a percent of the lane's width
function showBoard(rule, text) {
  const b = $('board'), changed = $('boardText').textContent !== text;
  $('boardText').textContent = text;
  b.classList.toggle('long', text.length > 62);
  $('boardSmall').textContent = `${rule.letter} = ${rule.what}`;
  if (changed) { b.classList.remove('new'); void b.offsetWidth; b.classList.add('new'); }
}
function clearLane() { $('riders').innerHTML = ''; setGate(false); setLamp(''); }
function setGate(open) { $('gate').classList.toggle('open', open); }
function setLamp(kind) { const l = $('lamp'); l.className = 'lamp'; if (kind) { void l.offsetWidth; l.classList.add(kind); } }
function addRider(rule, v) {
  const el = document.createElement('div');
  el.className = 'rider'; el.innerHTML = `<i></i><span>${esc(riderText(rule, v))}</span>`;
  el.style.left = '3%';
  $('riders').appendChild(el);
  return el;
}
const walkTo = (el, x) => { el.style.left = `${3 + (GATE_X - 3) * x}%`; };
/** The gate acts on a rider. slot: where they end up standing (so a line of riders does not pile up). */
function sendThrough(el, opens, slot = 0) {
  setGate(opens);
  el.classList.add(opens ? 'in' : 'out');
  el.style.left = opens ? `${70 + slot * 6.4}%` : `${GATE_X - 9 - slot * 8}%`;
  hubAudio.playStep();
}

/* ================================================================== */
/* Keep: the student is the gate                                       */
/* ================================================================== */
let riderEl = null;
function beginKeep() {
  W.phase = 'keep'; W.k = 0;
  spawnRider();
}
function spawnRider() {
  const r = W.round.riders[W.k];
  clearLane();
  showBoard(r.rule, r.rule.sign);
  riderEl = addRider(r.rule, r.v);
  W.kx = 0; W.kwait = 0;
}
function updateKeep(dt) {
  if (W.kwait > 0) { W.kwait -= dt; if (W.kwait <= 0) nextRider(); return; }
  W.kx += dt / W.round.seconds;
  if (G.practice) W.kx = Math.min(W.kx, 0.999);       // practice: the rider waits at the gate
  walkTo(riderEl, Math.min(1, W.kx));
  if (W.kx < 1) return;
  const r = W.round.riders[W.k];                      // nobody decided: the rider is stuck at the gate
  W.misses += 1; setLamp('alarm'); W.kwait = 0.05;
  arcade.bad('too_slow', 15);
  if (W.phase === 'idle') return;
  stopFor(`Too slow! "${riderText(r.rule, r.v)}" reached the gate before you decided. (${passes(r.rule, r.v) ? 'They should get in' : 'They should be turned away'}: ${ruleText(r.rule)}.)`, 'CARRY ON (ENTER)', null);
}
function decideKeep(letIn) {
  if (W.phase !== 'keep' || busy() || W.kwait > 0) return;
  const r = W.round.riders[W.k], res = checkRider(r.rule, r.v, letIn);
  walkTo(riderEl, 1); sendThrough(riderEl, letIn);
  W.kwait = 0.5;
  if (res.ok) { arcade.good(10); setLamp('fine'); return; }
  W.misses += 1; setLamp('alarm'); W.kwait = 0.05;
  arcade.bad(res.key, 20);
  if (W.phase === 'idle') return;
  stopFor(res.message, 'CARRY ON (ENTER)', null);
}
function nextRider() {
  const p = W.round;
  W.k += 1;
  if (W.k < p.riders.length) { spawnRider(); renderSign(); return; }
  clearLane();
  if (W.misses < 2 || p.rush || W.extraKeep) return rest(0.5);
  W.phase = 'hold'; renderWork(); renderCtl();        // two misses at one sign: the rule, and one more gate (once a zone)
  const { rule } = p.riders[0];
  stopFor(`That sign as a rule: ${ruleText(rule)}. Try one more gate.`, 'NEXT (ENTER)', () => {
    W.extraKeep = true; W.rounds.splice(W.ri + 1, 0, genKeep(Math.random, rule.sym));
    endRound();
  });
}

/* ================================================================== */
/* Write: build the rule, then the gate runs it                        */
/* ================================================================== */
function beginWrite() {
  const p = W.round;
  showBoard(p.rule, p.sign);
  if (p.mode !== 'hidden') { W.phase = 'build'; return; }
  W.phase = 'test'; W.testsLeft = p.tests;
  const mid = Math.round((p.range.lo + p.range.hi) / 2);
  W.tv = Math.abs(mid - p.rule.n) < 2 ? p.rule.n + 4 : mid;   // never start on the edge
}
const tileOf = (id) => W.round.tiles.find((t) => t.id === id) || null;
const tileText = (t) => (t ? String(t.v) : '');
function renderWork() {
  const p = W.round, ph = W.phase;
  $('notes').innerHTML = W.notes.map((n) => `<span class="note ${n.opens ? 'yes' : 'no'}">${esc(riderText(p.rule, n.v))} ${n.opens ? '✓ got in' : '✗ turned away'}</span>`).join('');
  if (p.type === 'keep') {
    $('work').innerHTML = ph === 'keep' ? '<button type="button" class="kbtn in" data-keep="in">▲ LET IN</button><button type="button" class="kbtn out" data-keep="out">▼ TURN AWAY</button>' : '';
    return;
  }
  if (ph === 'test') {
    $('work').innerHTML = `<div class="tdial"><span class="px">TEST RIDER</span><button type="button" data-tv="-1" title="Lower (left arrow)">◀</button><span class="val" id="tvVal">${esc(riderText(p.rule, W.tv))}</span><button type="button" data-tv="1" title="Higher (right arrow)">▶</button></div>`;
    return;
  }
  const slot = (k) => `<button type="button" class="slot ${W.slots[k] ? 'full' : ''}" data-slot="${k}">${esc(tileText(tileOf(W.slots[k])))}</button>`;
  $('work').innerHTML = `<div class="rule-row">${slot(0)}<button type="button" class="slot op ${W.sym ? 'full' : ''}" data-slot="sym">${W.sym || ''}</button>${slot(1)}</div>
    <div class="tile-row">${p.tiles.map((t, i) => `<button type="button" class="tile ${W.slots.includes(t.id) ? 'used' : ''}" data-tile="${t.id}"><b>${i + 1}</b>${esc(tileText(t))}</button>`).join('')}
      <span class="symkeys">${['<', '≤', '>', '≥', '≠'].map((s) => `<button type="button" class="${W.sym === s ? 'on' : ''}" data-sym="${s}">${s}</button>`).join('')}</span></div>`;
}
$('work').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || busy()) return; b.blur();
  const d = b.dataset;
  if (d.keep) decideKeep(d.keep === 'in');
  else if (d.tv) setTV(W.tv + Number(d.tv));
  else if (d.tile) pickTile(d.tile);
  else if (d.sym) setSym(d.sym);
  else if (d.slot) clearSlot(d.slot);
});
const canBuild = () => W.phase === 'build' && !busy();
function pickTile(id) {
  if (!canBuild() || !tileOf(id) || W.slots.includes(id)) return;
  const k = W.slots.indexOf(null);
  if (k < 0) return;
  W.slots[k] = id; hubAudio.playStep(); showLine(''); renderWork();
}
function setSym(s) { if (!canBuild()) return; W.sym = s; hubAudio.playStep(); showLine(''); renderWork(); }
function clearSlot(k) { if (!canBuild()) return; if (k === 'sym') W.sym = null; else W.slots[Number(k)] = null; renderWork(); }
function clearLast() { if (!canBuild()) return; if (W.slots[1]) W.slots[1] = null; else if (W.sym) W.sym = null; else W.slots[0] = null; renderWork(); }
function resetBuild() { W.slots = [null, null]; W.sym = null; W.phase = 'build'; clearLane(); showLine(''); renderWork(); renderCtl(); }
/** A mistake the student can try again once. After the second miss the answer is given and the round moves on. */
function miss(res, message) {
  W.tries += 1; W.phase = 'hold';
  arcade.bad(res.key, 25);
  if (W.phase === 'idle') return;                    // that was the last pass: the zone has stopped
  const moveOn = W.tries >= 2;
  stopFor(message + (moveOn ? ` ${answerText(W.round)}` : ''), moveOn ? 'NEXT (ENTER)' : 'TRY AGAIN (ENTER)', moveOn ? endRound : resetBuild);
  renderCtl();
}
function goWrite() {
  if (!canBuild()) return;
  const p = W.round, res = checkWritten(p, [tileOf(W.slots[0]), W.sym ? { t: 'sym', v: W.sym } : null, tileOf(W.slots[1])]);
  if (res.nudge) return showLine(res.message, true);
  if (!res.student) return miss(res, res.message);   // the wrong number: there is no rule to run
  const { rows, wrong } = gateRun(p, res.student);
  runGate(rows, wrong, () => {
    if (res.ok) { arcade.good(15); hubAudio.playCoinClink(); showLine(res.message); return rest(1.3); }
    miss(res, `${wrong >= 0 ? `${consequence(p, rows[wrong])} ` : ''}${res.message}`);
  });
}
/** Riders walk up one at a time and the gate acts on each. It stops at the first rider it gets wrong. */
function runGate(rows, wrong, done, inspect = true) {
  clearLane();
  W.phase = 'run'; W.anim = { rows, wrong, i: 0, t: 0, el: null, acted: false, ins: 0, outs: 0, done, inspect };
  hubAudio.playCartridgeLaunch(); renderCtl();
}
function updateRun(dt) {
  const A = W.anim, p = W.round, row = A.rows[A.i];
  if (!A.el) { A.el = addRider(p.rule, row.v); A.t = 0; A.acted = false; }
  A.t += dt;
  if (!A.acted) walkTo(A.el, Math.min(1, A.t / 0.4));
  if (A.t >= 0.4 && !A.acted) {
    A.acted = true;
    sendThrough(A.el, row.opens, row.opens ? A.ins++ : A.outs++);
    if (A.i === A.wrong) { A.el.classList.add('wrong'); setLamp('alarm'); } else if (A.inspect) setLamp('fine');   // the lamp is the inspector: it stays dark for a test rider
  }
  if (A.t < 0.75) return;
  const last = A.i === A.wrong || A.i === A.rows.length - 1;
  A.i += 1; A.el = null;
  if (!last) return;
  W.anim = null;
  A.done();
}

/* ---- the hidden sign: test riders ---- */
function setTV(v) {
  const p = W.round;
  if (W.phase !== 'test' || busy()) return;
  v = Math.min(p.range.hi, Math.max(p.range.lo, Math.round(v)));
  if (v === W.tv) return;
  W.tv = v; hubAudio.playStep();
  $('tvVal').textContent = riderText(p.rule, v);
}
function sendTest() {
  const p = W.round, v = W.tv;
  if (W.phase !== 'test' || busy() || W.testsLeft <= 0) return;
  W.testsLeft -= 1;
  const opens = testRider(p, v);
  runGate([{ v, opens }], -1, () => {
    W.notes.push({ v, opens });
    hubAudio.playSelect();
    W.phase = W.testsLeft > 0 ? 'test' : 'build';
    renderWork(); renderSign(); renderCtl();
  }, false);
}
function toBuild() { if (W.phase !== 'test' || busy()) return; W.phase = 'build'; clearLane(); renderWork(); renderSign(); renderCtl(); }

/* ================================================================== */
/* The clock, keys, sign and the bottom bar                            */
/* ================================================================== */
function update(dt) {
  if (W.phase === 'idle' || busy()) return;
  if (W.phase === 'gap') { W.gapLeft -= dt; if (W.gapLeft <= 0) nextRound(); return; }
  if (W.phase === 'run') return updateRun(dt);
  if (W.phase === 'keep') updateKeep(dt);
}
function go() { if (W.phase === 'build') goWrite(); else if (W.phase === 'test') sendTest(); }
function onKey(e) {
  const k = e.key;
  if (k === 'Enter') { e.preventDefault(); if (W.frozen) resume(); else go(); return; }
  if (W.frozen) return;
  if (W.phase === 'keep' && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); decideKeep(k === 'ArrowUp'); }
  if (W.phase === 'test' && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); setTV(W.tv + (k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 5 : 1)); }
  if (W.phase === 'build') {
    if (/^[1-4]$/.test(k)) pickTile((W.round.tiles[Number(k) - 1] || {}).id);
    else if (k === '<' || k === ',') setSym(W.sym === '<' ? '≤' : '<');       // press again for "or equal to"
    else if (k === '>' || k === '.') setSym(W.sym === '>' ? '≥' : '>');
    else if (k === '=' || k === '!') setSym('≠');
    else if (k === 'Backspace') { e.preventDefault(); clearLast(); }
  }
}
$('goBtn').addEventListener('click', (e) => { e.currentTarget.blur(); go(); });
$('skipBtn').addEventListener('click', (e) => { e.currentTarget.blur(); toBuild(); });
$('resumeBtn').addEventListener('click', (e) => { e.currentTarget.blur(); resume(); });

function renderSign(isNew = false) {
  const p = W.round, at = `${W.ri + 1}/${W.rounds.length}`;
  let small = `GATE ${at}`, text = 'WRITE THE RULE FOR WHO GETS IN, THEN RUN THE GATE';
  if (p.type === 'keep') { small = `RIDER ${Math.min(W.k + 1, p.riders.length)}/${p.riders.length} · ${p.rush ? 'THE SIGN KEEPS CHANGING' : 'YOU ARE THE GATE'}`; text = 'READ THE SIGN: LET IN, OR TURN AWAY?'; }
  else if (p.mode === 'other') text = 'THE SIGN SAYS WHO IS KEPT OUT. WRITE THE RULE FOR WHO GETS IN';
  else if (p.mode === 'mirror') { small = `GATE ${at} · MIRRORED DISPLAY`; text = 'WRITE THE RULE WITH THE NUMBER FIRST'; }
  else if (p.mode === 'calc') text = 'WORK OUT THE EDGE, THEN WRITE THE RULE';
  else if (p.mode === 'record') text = 'WRITE THE RULE FOR LAPS THAT BEAT THE RECORD';
  else if (p.mode === 'hidden') {
    const testing = W.phase === 'test' || (W.phase === 'run' && W.slots[0] === null && !W.sym);
    small = testing ? `HIDDEN SIGN · ${W.testsLeft} TEST RIDER${W.testsLeft === 1 ? '' : 'S'} LEFT` : 'HIDDEN SIGN · THIS ONE COUNTS';
    text = testing ? 'THE WORDS ARE WORN OFF. CHOOSE A RIDER TO TEST' : 'NOW WRITE THE RULE THE GATE IS USING';
  }
  $('signSmall').textContent = small;
  $('signText').textContent = text;
  if (isNew) { const s = $('sign'); s.classList.remove('new'); void s.offsetWidth; s.classList.add('new'); }
}
function renderCtl() {
  const ph = W.phase;
  const label = { build: 'RUN THE GATE (ENTER)', test: 'SEND THIS RIDER (ENTER)' }[ph];
  $('goBtn').classList.toggle('hidden', !label);
  $('goBtn').textContent = label || '';
  $('skipBtn').classList.toggle('hidden', ph !== 'test');
  $('tip').textContent = { keep: '↑ let in · ↓ turn away', test: '← → change the test rider (Shift jumps 5).',
    build: 'Tap tiles and a symbol. Tap a space to empty it.' }[ph] || '';
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
$('boardText').textContent = 'YOU MUST BE AT LEAST 42 INCHES TALL TO RIDE';
requestAnimationFrame(frame);
