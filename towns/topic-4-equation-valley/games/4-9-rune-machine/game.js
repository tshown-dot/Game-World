// Rune Machine (Lesson 4-9: Use Patterns to Write and Solve Equations): the screen and the controls.
// The math is in rune.js. The shared parts of an action game (briefing, top bar, torches, hint card, report)
// are in shared/game/arcadeShell.js.
//
// A zone is a list of ROUNDS. Each round is one of four moves:
//   catch  the rule is on the machine; stones roll in; the basket must be where each output lands
//   dials  a table is on the wall; set the rule on the dials; the machine runs every row
//   back   the machine must make a target; choose the input stone
//   feed   the rule is hidden; choose inputs to test, then it becomes a dials round
// All timing goes through update(), so the action stops cleanly whenever a banner, hint, help screen or mistake
// message is showing.
import { createArcade } from '../../../../shared/game/arcadeShell.js';
import { ZONES, genZone, run, ruleText, fmt, TEMPLATES, needs, DIAL, checkCatch, testRule, answerRule, checkBack, feedRows, dialsFromFeed } from './rune.js';

const BOSS = ZONES.length - 1;
const ROLL = [5, 5, 6.5, 5, 5.5], FLY = 0.75;      // seconds a stone takes to roll in (per zone), and to fly out
const $ = (id) => document.getElementById(id);
const play = $('play'), stone = $('stone'), nl = $('nl');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Everything about the round being played.
const W = {
  rounds: [], ri: 0, round: null, phase: 'idle',    // phase: idle, catch, dials, test, back, feed, fed, gap
  axis: null, val: 0, locked: false,                // the number line, and where the basket or the chosen stone is
  ci: 0, stage: 'roll', t: 0, misses: 0,            // catch: which stone, and where it is (roll, fly, wait)
  g: null, di: 0, test: null,                       // dials: the student's rule, the active dial, the running test
  fed: [], tries: 0,
  gapLeft: 0, frozen: false, afterResume: null, speed: 1,
};

const HINTS = {
  add_vs_times: 'A number right next to a letter means MULTIPLY.<span class="mono">c = 8b : 8 times b</span>A plus sign means add: b + 8.',
  forgot_start: 'A two-part rule has a rate AND a start.<span class="mono">c = 2r + 5 : 2 for each ride, plus 5 to get in</span>Work out the rate part, then add the start.',
  order_of_ops: 'Multiply first, then add.<span class="mono">2(4) + 5 = 8 + 5 = 13</span>',
  wrong_direction: 'When the outputs go DOWN, the rule takes away each time.<span class="mono">a = 60 − 5w</span>',
  close: 'So close. Slow down and check the arithmetic before the stone goes in.',
  calc: 'Put the stone\'s number in place of the letter, then work it out.<span class="mono">c = 8b, b = 5 : 8(5) = 40</span>',
  skipped_inputs: 'Check the INPUTS before you compare the outputs. If the inputs jump by 2, the outputs jump by two steps.<span class="mono">Look across a row instead: output ÷ input</span>',
  some_rows: 'A rule has to work for EVERY row, not just one. Test your rule on the second row before you run the machine.',
  no_rows: 'Look across each row. Is the output the input plus the same number every time? Or the input times the same number?',
  backward: 'To find the input, undo the rule.<span class="mono">c = 8b = 40 : b = 40 ÷ 8</span>For a two-step rule, undo the last step first.',
};
const TIPS = {
  add_vs_times: '8b means 8 times b; b + 8 means add 8.',
  forgot_start: 'A rule like y = 2x + 5 has a rate and a starting amount: use both.',
  order_of_ops: 'In y = 2x + 5, multiply first, then add.',
  wrong_direction: 'If the outputs go down as the inputs go up, the rule subtracts each time.',
  close: 'Check your arithmetic when using a rule.',
  calc: 'Substitute the input for the variable, then evaluate.',
  skipped_inputs: 'When a table skips inputs, compare across each row instead of down the column.',
  some_rows: 'A rule must fit every row of the table.',
  no_rows: 'Compare each output with its input to find the pattern.',
  backward: 'Work backward with the opposite operation to find an input.',
};

const arcade = createArcade({
  zones: ZONES, startZone, stopZone, onKey, hints: HINTS, skillTips: TIPS, testName: '__rune',
  perfectText: 'Every rune glowed: no mistakes to sharpen!',
  lifeLostText: (left) => (left > 0 ? `OVERHEATED! ${left} TORCH${left === 1 ? '' : 'ES'} LEFT` : 'MACHINE SEALED'),
});
const { G, hubAudio } = arcade;
if (window.__rune) window.__rune.W = W;
const busy = () => W.frozen || arcade.paused();

/* ================================================================== */
/* Zones and rounds                                                    */
/* ================================================================== */
function startZone(z) {
  W.rounds = genZone(Math.random, z);
  startRound(0);
}
function stopZone() {
  Object.assign(W, { phase: 'idle', frozen: false, afterResume: null, test: null });
  $('callout').classList.add('hidden');
  for (const id of ['stone', 'crate', 'tbl', 'nl']) $(id).classList.add('hidden');
}
function startRound(i) {
  const round = W.rounds[i];
  Object.assign(W, { ri: i, round, phase: round.type, tries: 0, misses: 0, fed: [], test: null, frozen: false, afterResume: null, locked: false });
  if (G.zone === BOSS) arcade.setBossProgress((i / W.rounds.length) * 100);
  for (const id of ['stone', 'crate', 'tbl', 'nl']) $(id).classList.add('hidden');
  $('mach').classList.remove('glow');
  ({ catch: beginCatch, dials: beginDials, back: beginBack, feed: beginFeed })[round.type]();
  renderSign(true); renderCtl();
}
function rest(seconds) { W.phase = 'gap'; W.gapLeft = seconds; renderCtl(); }
function endRound(bonus) {
  if (bonus) { G.score += 20; arcade.renderHud(); arcade.flash(bonus); }
  rest(0.9);
}
function nextRound() {
  if (W.ri + 1 < W.rounds.length) return startRound(W.ri + 1);
  W.phase = 'idle';
  if (G.zone === BOSS) arcade.setBossProgress(100);
  arcade.zoneCleared();
}
/** Stop the action and say what went wrong. */
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
function showMachine(text, dials = '') {
  const r = W.round;
  $('mRule').textContent = text;
  $('mNames').textContent = `${r.X} = ${r.xName}   ·   ${r.Y} = ${r.yName}`;
  $('mDials').innerHTML = dials;
}

/* ================================================================== */
/* The number line (the basket in a catch round, the chosen stone in the others) */
/* ================================================================== */
const L = 110;
const width = () => play.clientWidth - 2 * L;
const X = (v) => L + ((v - W.axis.lo) / (W.axis.hi - W.axis.lo)) * width();
function drawAxis(axis, kind, caption) {
  W.axis = axis;
  const span = axis.hi - axis.lo, every = span <= 60 ? 1 : span <= 100 ? 2 : 5, label = span <= 20 ? 1 : span <= 60 ? 5 : span <= 100 ? 10 : 20;
  let html = '<div class="bar"></div>';
  for (let v = axis.lo; v <= axis.hi; v += every) {
    html += `<div class="tick ${v % label ? 'small' : ''}" style="left:${X(v)}px"></div>`;
    if (v % label === 0) html += `<div class="tl" style="left:${X(v)}px">${v}</div>`;
  }
  nl.innerHTML = `${html}<div class="cap">${esc(caption)}</div><div id="mark" class="mark ${kind}"></div>`;
  nl.classList.remove('hidden');
  W.val = Math.round((axis.lo + axis.hi) / 2);
  drawMark();
}
function drawMark() {
  const mark = $('mark');
  if (!mark) return;
  mark.style.left = `${X(W.val)}px`;
  mark.textContent = fmt(W.val);
  mark.classList.toggle('locked', W.locked);
}
const canMove = () => !busy() && !W.locked && (W.phase === 'catch' || W.phase === 'back' || W.phase === 'feed');
function setVal(v) {
  if (!canMove()) return;
  v = Math.round(Math.min(W.axis.hi, Math.max(W.axis.lo, v)));
  if (v === W.val) return;
  W.val = v; hubAudio.playStep(); drawMark();
}
let dragging = false;
const valueAt = (e) => { const r = play.getBoundingClientRect(); return W.axis.lo + ((e.clientX - r.left - L) / width()) * (W.axis.hi - W.axis.lo); };
nl.addEventListener('pointerdown', (e) => { if (!canMove()) return; dragging = true; nl.setPointerCapture(e.pointerId); setVal(valueAt(e)); });
nl.addEventListener('pointermove', (e) => { if (dragging) setVal(valueAt(e)); });
nl.addEventListener('pointerup', () => { dragging = false; });
nl.addEventListener('pointercancel', () => { dragging = false; });

/* ================================================================== */
/* Catch: stones roll in, the basket waits where the output will land  */
/* ================================================================== */
const moveStone = (x, y) => { stone.style.transform = `translate(${x}px, ${y}px)`; };
function beginCatch() {
  const r = W.round;
  showMachine(ruleText(r.rule, r.X, r.Y));
  drawAxis(r.line, 'basket', `${r.yName} (${r.Y})`);
  W.ci = 0;
  nextStone();
}
function nextStone() {
  const r = W.round;
  Object.assign(W, { stage: 'roll', t: 0, locked: false });
  stone.className = 'stone';
  stone.textContent = `${r.X} = ${fmt(r.inputs[W.ci])}`;
  moveStone(-100, 182);
  drawMark(); renderSign();
}
function updateCatch(dt) {
  const r = W.round, cx = play.clientWidth / 2, x = r.inputs[W.ci], y = run(r.rule, x);
  W.t += dt;
  if (W.stage === 'roll') {
    const roll = ROLL[G.zone] * (G.practice ? 1.6 : 1), u = Math.min(1, W.t / roll);
    moveStone(-100 + u * (cx - 235 - 70 + 100), 182);
    if (u >= 1) {                                    // into the machine: the basket locks, the output is hidden until it lands
      Object.assign(W, { stage: 'fly', t: 0, locked: true });
      stone.className = 'stone out'; stone.textContent = '?';
      hubAudio.playCartridgeLaunch(); drawMark();
    }
    return;
  }
  if (W.stage === 'fly') {
    const u = Math.min(1, W.t / FLY);
    moveStone(cx - 44 + u * (X(y) - cx), 292 + u * (466 - 292) - 90 * Math.sin(Math.PI * u));
    if (u >= 1) land(x, y);
    return;
  }
  if (W.t >= 0.7) afterStone();
}
function land(x, y) {
  const res = checkCatch(W.round, x, W.val);
  stone.textContent = fmt(y);
  Object.assign(W, { stage: 'wait', t: 0 });
  if (!res) { arcade.good(10); hubAudio.playCoinClink(); stone.classList.add('caught'); return; }
  W.misses += 1;
  stone.classList.add('smash');
  arcade.bad(res.key, 25);
  if (W.phase === 'idle') return;                    // that was the last torch: the zone has stopped
  stopFor(res.message, 'CONTINUE (ENTER)', afterStone);
}
function afterStone() {
  if (W.phase !== 'catch') return;
  W.ci += 1;
  if (W.ci >= W.round.inputs.length) { stone.classList.add('hidden'); W.locked = false; return endRound(W.misses === 0 ? 'EVERY STONE CAUGHT! +20' : null); }
  nextStone();
}

/* ================================================================== */
/* Dials: set the rule, then the machine runs every row                */
/* ================================================================== */
const letters = (form, r) => TEMPLATES[form].replace('Y', r.Y).replace(/X/g, r.X);
const dialOf = (form, key) => (key === 'm' ? DIAL.m : form === 'down' ? DIAL.start : DIAL.b);
const dialName = (form, key) => (key === 'm' ? (form === 'down' ? 'TAKE AWAY EACH TIME' : 'MULTIPLY BY') : form === 'down' ? 'START AT' : 'ADD');
function beginDials() {
  const r = W.round;
  W.phase = 'dials';
  W.g = r.preset ? { m: 1, b: 0, ...r.preset } : { form: r.forms[0], m: 1, b: 0 };
  W.di = 0;
  drawDials(); drawTable();
}
function drawDials() {
  const r = W.round, g = W.g;
  const shapes = r.forms.map((f) => `<button type="button" data-form="${f}" class="${f === g.form ? 'on' : ''}">${esc(letters(f, r))}</button>`).join('');
  const dials = needs(g.form).map((key, i) => `<div class="dial ${i === W.di ? 'on' : ''}"><span class="lab">${dialName(g.form, key)}</span>
    <button type="button" data-dial="${i}" data-turn="-1">◀</button><span class="val" id="dial${i}">${fmt(g[key])}</span><button type="button" data-dial="${i}" data-turn="1">▶</button></div>`).join('');
  showMachine(ruleText(g, r.X, r.Y), `<div class="shapes">${shapes}</div>${dials}`);
}
/** rows: what to show. made: what the student's rule makes for each (filled in as the machine runs). */
function drawTable(rows = W.round.rows, made = null, upTo = -1, own = []) {
  const r = W.round;
  const body = rows.length ? rows.map((row, i) => {
    const cls = `${made && i <= upTo ? (made[i] === row.y ? 'ok' : 'bad') : ''} ${own.includes(row.x) ? 'own' : ''}`;
    return `<tr class="${cls}"><td>${fmt(row.x)}</td><td>${fmt(row.y)}</td>${made ? `<td class="made">${i <= upTo ? fmt(made[i]) : ''}</td>` : ''}</tr>`;
  }).join('') : '<tr><td colspan="2" class="empty">Drop stones in to fill the table.</td></tr>';
  $('tbl').innerHTML = `<table><tr><th>${esc(r.xName)}<br>${r.X}</th><th>${esc(r.yName)}<br>${r.Y}</th>${made ? '<th>your rule<br>makes</th>' : ''}</tr>${body}</table>`;
  $('tbl').classList.remove('hidden');
}
const canDial = () => W.phase === 'dials' && !busy();
function setForm(form) {
  if (!canDial() || !W.round.forms.includes(form) || form === W.g.form) return;
  W.g.form = form; W.di = 0;
  for (const key of ['m', 'b']) { const d = dialOf(form, key); W.g[key] = Math.min(d.hi, Math.max(needs(form).includes(key) ? d.lo : (key === 'm' ? 1 : 0), W.g[key])); }
  if (!needs(form).includes('m')) W.g.m = 1;
  if (!needs(form).includes('b')) W.g.b = 0;
  hubAudio.playStep(); drawDials();
}
function turn(i, delta) {
  if (!canDial()) return;
  const key = needs(W.g.form)[i];
  if (!key) return;
  const d = dialOf(W.g.form, key), v = Math.min(d.hi, Math.max(d.lo, W.g[key] + delta));
  W.di = i;
  if (v !== W.g[key]) { W.g[key] = v; hubAudio.playStep(); }
  drawDials();
}
$('mach').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  b.blur();
  if (b.dataset.form) setForm(b.dataset.form); else if (b.dataset.dial) turn(Number(b.dataset.dial), Number(b.dataset.turn));
});
function runMachine() {
  if (!canDial()) return;
  W.phase = 'test';
  W.test = { res: testRule(W.round, W.g), i: -1, t: 0.3 };
  hubAudio.playCartridgeLaunch();
  drawTestTable(); renderCtl();
}
const drawTestTable = () => drawTable(W.test.res.table, W.test.res.made, W.test.i, (W.round.hidden || []).map((h) => h.x));
function updateTest(dt) {
  const T = W.test, res = T.res;
  T.t += dt;
  if (T.t < 0.45) return;
  T.t = 0; T.i += 1;
  drawTestTable();
  const row = res.table[T.i], bad = T.i === res.firstBad;
  if (!bad && T.i < res.table.length - 1) return hubAudio.playSelect();
  if (!bad) {                                        // every row matched
    arcade.good(15); hubAudio.playCoinClink();
    $('mach').classList.add('glow');
    return rest(1.5);
  }
  W.tries += 1;
  arcade.bad(res.key, 25);
  if (W.phase === 'idle') return;
  const r = W.round, moveOn = W.tries >= 2;
  const message = `${r.X} = ${fmt(row.x)}: your rule makes ${fmt(res.made[T.i])}, but the machine makes ${fmt(row.y)}. ${res.message}${moveOn ? ` The rule: ${answerRule(r)}.` : ''}`;
  stopFor(message, moveOn ? 'NEXT (ENTER)' : 'TURN THE DIALS AGAIN (ENTER)', moveOn ? () => endRound(null) : () => { W.phase = 'dials'; W.test = null; drawTable(); renderCtl(); });
}

/* ================================================================== */
/* Back: choose the input that makes the target                        */
/* ================================================================== */
function showCrate(small, big, cls = '') {
  $('crate').className = `goalbox ${cls}`;
  $('crate').innerHTML = `<small>${esc(small)}</small>${esc(big)}`;
}
function beginBack() {
  const r = W.round;
  showMachine(ruleText(r.rule, r.X, r.Y));
  drawAxis(r.strip, 'pick', `choose ${r.xName} (${r.X})`);
  showCrate('THE MACHINE MUST MAKE', `${r.Y} = ${fmt(r.target)}`);
}
function sendBack() {
  if (W.phase !== 'back' || busy()) return;
  const r = W.round, x = W.val, res = checkBack(r, x);
  showCrate(`${r.X} = ${fmt(x)} MAKES`, `${r.Y} = ${fmt(run(r.rule, x))}`, res ? 'bad' : 'ok');
  if (!res) { arcade.good(15); hubAudio.playCoinClink(); return rest(1.4); }
  W.tries += 1;
  arcade.bad(res.key, 25);
  if (W.phase === 'idle') return;
  const moveOn = W.tries >= 2;
  stopFor(res.message + (moveOn ? ` It was ${r.X} = ${fmt(r.answer)}.` : ''), moveOn ? 'NEXT (ENTER)' : 'TRY AGAIN (ENTER)', moveOn ? () => endRound(null) : () => showCrate('THE MACHINE MUST MAKE', `${r.Y} = ${fmt(r.target)}`));
}

/* ================================================================== */
/* Feed: choose which inputs to test on a hidden rule                  */
/* ================================================================== */
function beginFeed() {
  const r = W.round;
  showMachine('? ? ?');
  drawAxis(r.strip, 'pick', `choose ${r.xName} (${r.X}) to test`);
  drawTable([]);
  showCrate('STONES LEFT', String(r.stones));
}
function dropStone() {
  if (W.phase !== 'feed' || busy()) return;
  const r = W.round, x = W.val;
  W.fed.push(x);
  hubAudio.playSelect();
  drawTable(feedRows(r, W.fed));
  const left = r.stones - W.fed.length;
  showCrate(`${r.X} = ${fmt(x)} MAKES`, `${r.Y} = ${fmt(run(r.rule, x))}`);
  renderSign();
  if (left > 0) return;
  W.phase = 'fed'; W.gapLeft = 1.1; renderCtl();    // a moment to read the last stone, then the dials
}
function feedToDials() {
  W.round = dialsFromFeed(W.round, W.fed);
  W.rounds[W.ri] = W.round;
  $('nl').classList.add('hidden'); $('crate').classList.add('hidden');
  beginDials();
  renderSign(true); renderCtl();
}

/* ================================================================== */
/* The clock, keys, sign and the bottom bar                            */
/* ================================================================== */
function update(dt) {
  if (W.phase === 'idle' || busy()) return;
  if (W.phase === 'gap') { W.gapLeft -= dt; if (W.gapLeft <= 0) nextRound(); return; }
  if (W.phase === 'fed') { W.gapLeft -= dt; if (W.gapLeft <= 0) feedToDials(); return; }
  if (W.phase === 'catch') return updateCatch(dt);
  if (W.phase === 'test') return updateTest(dt);
}
function go() { if (W.phase === 'dials') runMachine(); else if (W.phase === 'back') sendBack(); else if (W.phase === 'feed') dropStone(); }
function onKey(e) {
  const k = e.key;
  if (k === 'Enter') { e.preventDefault(); if (W.frozen) resume(); else go(); return; }
  if (W.frozen) return;
  const side = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0;
  if (W.phase === 'dials') {
    if (side) { e.preventDefault(); turn(W.di, side * (e.shiftKey ? 5 : 1)); }
    else if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); const f = W.round.forms, at = f.indexOf(W.g.form); setForm(f[(at + (k === 'ArrowDown' ? 1 : f.length - 1)) % f.length]); }
    else if (k === 'Tab') { e.preventDefault(); W.di = (W.di + 1) % needs(W.g.form).length; drawDials(); }
    return;
  }
  if (side) { e.preventDefault(); setVal(W.val + side * (e.shiftKey ? 10 : 1)); }
}
$('goBtn').addEventListener('click', (e) => { e.currentTarget.blur(); go(); });
$('resumeBtn').addEventListener('click', (e) => { e.currentTarget.blur(); resume(); });

function renderSign(isNew = false) {
  const r = W.round, at = `${W.ri + 1}/${W.rounds.length}`;
  let small = '', text = '';
  if (r.type === 'catch') { small = `STONE ${Math.min(W.ci + 1, r.inputs.length)}/${r.inputs.length} · ${r.far ? 'FAR AHEAD' : 'USE THE RULE'}`; text = 'PUT THE BASKET WHERE THE OUTPUT WILL LAND'; }
  if (r.type === 'dials') { small = r.fed ? 'NOW SET THE DIALS. THE MACHINE ADDS TWO STONES OF ITS OWN (★)' : r.broken ? `TABLE ${at} · THIS RULE ONLY FITS THE FIRST ROW` : `TABLE ${at} · A RULE MUST FIT EVERY ROW`; text = r.broken ? 'FIX THE RULE, THEN RUN THE MACHINE' : 'SET THE DIALS TO THE RULE IN THE TABLE'; }
  if (r.type === 'back') { small = `TARGET ${at} · RUN IT BACKWARD`; text = `WHICH ${r.X} MAKES ${r.Y} = ${fmt(r.target)}?`; }
  if (r.type === 'feed') { const left = r.stones - W.fed.length; small = `HIDDEN RULE ${at} · CHOOSE WHAT TO TEST`; text = `DROP STONES TO FIND THE RULE · ${left} LEFT`; }
  $('signSmall').textContent = small;
  $('signText').textContent = text;
  if (isNew) { const s = $('sign'); s.classList.remove('new'); void s.offsetWidth; s.classList.add('new'); }
}
function renderCtl() {
  const p = W.phase;
  $('goBtn').classList.toggle('hidden', !(p === 'dials' || p === 'back' || p === 'feed'));
  $('goBtn').textContent = p === 'dials' ? 'RUN THE MACHINE (ENTER)' : p === 'back' ? 'SEND IT THROUGH (ENTER)' : 'DROP THE STONE (ENTER)';
  $('tip').textContent = {
    catch: '← → move the basket (Shift jumps 10), or drag it. It locks when the stone goes in.',
    dials: '↑ ↓ rule shape · Tab next dial · ← → turn it',
    back: '← → choose the input, or drag it.',
    feed: '← → choose an input to test, or drag it.',
    test: 'The machine is running your rule on every row...',
  }[p] || '';
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
W.round = { X: 'b', Y: 'c', xName: 'boxes', yName: 'candles' };
showMachine('c = 8b');
requestAnimationFrame(frame);
