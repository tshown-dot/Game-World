// Log Flume (Grade 7, Lesson 4-3): the flume, the channels and the controls. The math and checks live in flume.js;
// zones, timer, lives, scoring and the report come from the shared game shell.
//
// Problem kinds: sort (send every log to its channel, then type each channel's total), boxes, select (tap every
// twin), test (evaluate two expressions, then decide).
import {
  ZONES, genZone, genBackup, workedSolution, checkSortMove, checkTotals, checkBoxes, checkSelect, checkTest,
  logText, exprText, termText, totalOf, channelName, fmt,
} from './flume.js';
import { hubAudio } from '../../../../shared/audio.js';
import { createGame } from '../../../../shared/game/gameShell.js';
import { dragOrTap, inside } from '../../../../shared/game/drag.js';

const SKILL_TIPS = {
  number_in_variable: 'A plain number is not a like term for a variable term.',
  variable_in_numbers: 'A term with a variable cannot be combined with plain numbers.',
  mixed_variables: 'Like terms have the SAME variable: 4a and 2b are not like terms.',
  lost_negative: 'The sign in front of a term travels with it.',
  sign_error: 'When adding negatives, picture a number line.',
  decimal_slip: 'Line up decimal points: 3 is 3.0.',
  lone_term: 'A term with no like term stays just as it is.',
  combine_unlike: 'Only like terms combine.',
  use_a_fraction: 'Some fractions never end as decimals: keep them as fractions.',
  fraction_addition: 'Add fractions with a common denominator.',
  half_perimeter: 'A rectangle\'s perimeter has two lengths and two widths.',
  missed_twin: 'Terms can be written in any order and still be equivalent.',
  commute_subtraction: 'Subtraction cannot be reordered unless the sign travels with its term.',
  same_values: 'Moving a term WITH its sign keeps an expression equivalent.',
  evaluation_slip: 'Substitute carefully, then work it out.',
  calc: 'Add each channel one log at a time.',
};

const shell = createGame({
  zones: ZONES, makeZone: genZone, makeBackup: genBackup, workedSolution, showProblem,
  seconds: [75, 85, 90, 65, 95],                       // seconds until the flume backs up, per zone
  meterFloor: 8, wrongBump: 26, rightRelief: 25, pauseOnBanner: true,
  lifeLostText: (left) => (left > 0 ? 'LOG JAM!' : 'THE FLUME IS BLOCKED!'),
  bossHitText: 'JAM CLEARED!', winDelay: () => 1700,
  skillTips: SKILL_TIPS, perfectText: 'No mistakes to sharpen. Master log sorter!',
  onKey, testName: '__flume',
});
const { G, UI, $, win, miss, showFeedback } = shell;
Object.assign(G, { next: 0, bins: {}, phase: 'sort', vals: {}, picked: new Set(), done: false, jam: null, badChannel: null });

/* ================================================================== */
/* Drawing: the flume (logs waiting) and the channels                  */
/* ================================================================== */
const K = '#1d1433';
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round"`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const FONT = 'font-family="Nunito, system-ui, sans-serif" font-weight="900"';
const MONO = 'font-family="ui-monospace, \'Courier New\', monospace" font-weight="900"';
const text = (t, x, y, size, fill = K, anchor = 'middle', font = FONT) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${fill}" ${font}>${esc(t)}</text>`;
const CH_COLORS = ['#3a8ef0', '#7b4bff', '#2fbf71'];
/** A log: brown for positive terms, dark for negative ones, with its signed label. */
function log(t, x, y, w = 96, big = false) {
  const h = big ? 44 : 30;
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${t.c < 0 ? '#7a4a2a' : '#c98a4b'}" ${O}/>
    <ellipse cx="${x + w - 8}" cy="${y + h / 2}" rx="6" ry="${h / 2 - 4}" fill="#e8c08a" stroke="${K}" stroke-width="2"/>
    ${text(logText(t), x + w / 2 - 4, y + h / 2 + (big ? 8 : 6), big ? 22 : 16, '#fff', 'middle', MONO)}</g>`;
}
function backdrop() {
  return `<rect x="-300" y="-300" width="1400" height="1120" fill="#57b56a"/>
    <path d="M40 -300 V830 H250 V-300 Z" fill="#3a8ef0" ${O}/>
    <path class="river-flow" d="M110 -100 V800 M180 -60 V800" stroke="#bfe2ff" stroke-width="4" stroke-dasharray="12 22" fill="none"/>
    ${text('THE FLUME', 145, 40, 13, '#fff')}`;
}
function sortScene(p) {
  const waiting = p.terms.map((t, i) => ({ t, i })).filter(({ i }) => i >= G.next);
  const queue = waiting.map(({ t }, k) => (k === 0 ? `<g class="front">${log(t, 76, 400, 140, true)}</g>` : log(t, 96, 400 - k * 48 - 12)));
  const chH = Math.min(140, Math.floor(430 / p.channels.length) - 12);
  const chans = p.channels.map((ch, k) => {
    const y = 60 + k * (chH + 12), mine = (G.bins[ch] || []).map((i) => p.terms[i]);
    const total = G.done || (G.phase === 'total' && false);
    return `<g id="ch${k}" class="channel ${G.badChannel === ch ? 'jammed' : ''}" data-ch="${k}" style="cursor:pointer">
      <rect class="ch-box" x="300" y="${y}" width="470" height="${chH}" rx="14" fill="#eaf4ff" stroke="${CH_COLORS[k]}" stroke-width="5"/>
      <rect x="300" y="${y}" width="150" height="26" rx="10" fill="${CH_COLORS[k]}"/>
      ${text(`${k + 1}  ${channelName(ch).toUpperCase()}`, 375, y + 18, 12, '#fff')}
      ${mine.map((t, j) => log(t, 316 + (j % 4) * 110, y + 36 + Math.floor(j / 4) * 36, 100)).join('')}
      ${total ? text(`= ${termText(totalOf(p.terms, ch), ch)}`, 752, y + chH - 14, 22, '#1f6b3e', 'end', MONO) : ''}
    </g>`;
  }).join('');
  return `${queue.reverse().join('')}${chans}
    ${G.done ? `<rect x="300" y="452" width="470" height="50" rx="12" fill="#ffe680" ${O}/>${text(p.answerText, 535, 485, p.answerText.length > 22 ? 18 : 24, K, 'middle', MONO)}` : ''}`;
}
function plaqueScene(lines, glow) {
  return `<rect x="290" y="150" width="480" height="${70 + lines.length * 60}" rx="16" fill="#3b3049" stroke="${glow ? '#2fbf71' : K}" stroke-width="${glow ? 6 : 3}"/>
    ${lines.map(([label, t], i) => `${text(label, 310, 186 + i * 62, 11, '#c9b8ff', 'start')}${text(t, 530, 216 + i * 62, t.length > 30 ? 15 : t.length > 22 ? 19 : 25, '#ffd23f', 'middle', MONO)}`).join('')}`;
}
function draw() {
  const p = G.problem;
  let body;
  if (!p) body = sortScene({ terms: [{ c: -2, v: 'c' }, { c: 3, v: 'c' }, { c: -5, v: '' }, { c: -4, v: 'c' }, { c: 7, v: '' }], channels: ['c', ''], answerText: '' });
  else if (p.kind === 'sort') body = sortScene(p);
  else if (p.kind === 'test') body = plaqueScene([['FIRST', p.A], ['SECOND', p.B], ['TEST VALUE', `${p.v} = ${p.x0}`]], G.done);
  else if (p.type === 'perimeter') body = `<rect x="330" y="170" width="380" height="200" fill="#9be7b4" ${O}/>${text(p.s1, 520, 160, 22, K, 'middle', MONO)}${text(p.s2, 722, 276, 22, K, 'start', MONO)}${text('GARDEN', 520, 280, 20, '#1f6b3e')}
      ${G.done ? `<rect x="330" y="400" width="380" height="50" rx="12" fill="#ffe680" ${O}/>${text(p.answerText, 520, 433, 22, K, 'middle', MONO)}` : ''}`;
  else body = plaqueScene([['SIMPLIFY', p.show], ...(G.done ? [['SIMPLEST FORM', p.answerText]] : [])], G.done);
  UI.scene.innerHTML = backdrop() + body;
  UI.scene.querySelectorAll('[data-ch]').forEach((g) => g.addEventListener('click', () => send(Number(g.dataset.ch))));
}

/* ================================================================== */
/* Problems and controls                                               */
/* ================================================================== */
const TAGS = { sort: 'SORT THE LOGS', quick: 'QUICK SIMPLIFY', fraction: 'FRACTION LOGS', perimeter: 'THE GARDEN', select: 'FIND EVERY TWIN', orderTest: 'DOES ORDER MATTER?' };
function showProblem(p, isBackup) {
  Object.assign(G, { next: 0, bins: {}, phase: 'sort', vals: {}, picked: new Set(), done: false, jam: null, badChannel: null });
  UI.taskTag.textContent = `${TAGS[p.type]}${isBackup ? ' · BACKUP' : ''}`;
  UI.prompt.innerHTML = p.prompt;
  renderControls();
  draw();
}
const focusFirst = () => { const el = [...UI.controls.querySelectorAll('input')].find((i) => !i.value) || UI.controls.querySelector('input'); if (el && UI.briefing.classList.contains('hidden')) el.focus({ preventScroll: true }); };
function renderControls() {
  const p = G.problem;
  if (p.kind === 'sort' && G.phase === 'sort') {
    const t = p.terms[G.next];
    UI.controls.innerHTML = `
      <div class="label px">THIS LOG (${G.next + 1} OF ${p.terms.length}) · DRAG IT TO ITS CHANNEL</div>
      <button type="button" id="logBtn" class="log-btn ${t.c < 0 ? 'neg' : ''}">${esc(logText(t))}</button>
      <div class="label px">OR PICK THE CHANNEL</div>
      <div class="chan-btns">${p.channels.map((ch, k) => `<button type="button" data-send="${k}" style="border-color:${CH_COLORS[k]}"><b>${k + 1}</b>${esc(channelName(ch))}</button>`).join('')}</div>
      <div id="helpLine" class="help-line">Like terms go together. Keys: <kbd>1</kbd>–<kbd>${p.channels.length}</kbd>.</div>`;
    $('logBtn').addEventListener('pointerdown', (e) => {
      if (G.locked) return;
      dragOrTap(e, $('logBtn'), {
        targetAt: (x, y) => { const k = p.channels.findIndex((_, i) => inside($(`ch${i}`), x, y)); return k >= 0 ? k + 1 : null; },
        glow: (k) => p.channels.forEach((_, i) => $(`ch${i}`)?.classList.toggle('drop-target', k === i + 1)),
        onDrop: (k) => send(k - 1), onTap: () => nudge('Drag the log onto a channel, or press its number.'), lift: true,
      });
    });
    UI.controls.querySelectorAll('[data-send]').forEach((b) => b.addEventListener('click', () => send(Number(b.dataset.send))));
    return;
  }
  if (p.kind === 'sort') {
    UI.controls.innerHTML = `<div class="label px">ADD UP EACH CHANNEL (TOTALS CAN BE NEGATIVE)</div>
      ${p.channels.map((ch, k) => `<label class="total-row" style="border-color:${CH_COLORS[k]}"><span class="work">${esc(exprText(p.terms.filter((t) => t.v === ch)))} =</span><input id="t${k}" class="rbox" value="${esc(G.vals[ch] || '')}" inputmode="decimal" maxlength="7" placeholder="?" autocomplete="off"><span>${esc(ch)}</span></label>`).join('')}
      <button type="button" id="checkBtn" class="apply px">SIMPLIFY (ENTER)</button>
      <div id="helpLine" class="help-line">Type each total, like -3 or 2. <kbd>Tab</kbd> moves to the next box.</div>`;
    p.channels.forEach((ch, k) => $(`t${k}`).addEventListener('input', (e) => { G.vals[ch] = e.target.value; }));
    $('checkBtn').addEventListener('click', submitTotals);
    return focusFirst();
  }
  if (p.kind === 'boxes') {
    const row = p.pattern.map((piece) => (typeof piece === 'object'
      ? `<input id="b_${piece.k}" class="rbox" data-box="${piece.k}" value="${esc(G.vals[piece.k] || '')}" inputmode="decimal" maxlength="7" placeholder="?" autocomplete="off">`
      : `<span>${esc(piece)}</span>`)).join('');
    UI.controls.innerHTML = `<div class="label px">FILL THE BOXES (TAB MOVES TO THE NEXT)</div>
      <div class="rule-row">${row}</div>
      <button type="button" id="checkBtn" class="apply px">SIMPLIFY (ENTER)</button>
      <div id="helpLine" class="help-line">A box can hold a negative number (-7.5) or a fraction (5/6).</div>`;
    UI.controls.querySelectorAll('[data-box]').forEach((el) => el.addEventListener('input', () => { G.vals[el.dataset.box] = el.value; }));
    $('checkBtn').addEventListener('click', submitBoxes);
    return focusFirst();
  }
  if (p.kind === 'select') {
    UI.controls.innerHTML = `<div class="label px">TAP EVERY TWIN, THEN CHECK</div>
      <div class="cards">${p.cards.map((c, i) => `<button type="button" class="tcard ${G.picked.has(i) ? 'on' : ''}" data-card="${i}"><b>${i + 1}</b>${esc(c.text)}</button>`).join('')}</div>
      <button type="button" id="checkBtn" class="apply px">CHECK (ENTER)</button>
      <div id="helpLine" class="help-line">Tap again to un-pick. Keys: <kbd>1</kbd>–<kbd>${p.cards.length}</kbd>, then <kbd>Enter</kbd>.</div>`;
    UI.controls.querySelectorAll('[data-card]').forEach((b) => b.addEventListener('click', () => toggle(Number(b.dataset.card))));
    $('checkBtn').addEventListener('click', submitSelect);
    return;
  }
  UI.controls.innerHTML = `
    <div class="label px">1. WHAT DOES EACH ONE EQUAL WHEN ${esc(p.v)} = ${p.x0}?</div>
    <label class="total-row"><span class="work">${esc(p.A)} =</span><input id="va" class="rbox" value="${esc(G.vals.a || '')}" inputmode="decimal" maxlength="7" placeholder="?" autocomplete="off"></label>
    <label class="total-row"><span class="work">${esc(p.B)} =</span><input id="vb" class="rbox" value="${esc(G.vals.b || '')}" inputmode="decimal" maxlength="7" placeholder="?" autocomplete="off"></label>
    <div class="label px">2. ARE THEY EQUIVALENT?</div>
    <div class="pair"><button type="button" class="yes" data-eq="1"><b>Y</b>EQUIVALENT</button><button type="button" class="nope" data-eq="0"><b>N</b>NOT EQUIVALENT</button></div>
    <div id="helpLine" class="help-line">Type both values (negatives are fine), then press <kbd>Y</kbd> or <kbd>N</kbd>.</div>`;
  ['a', 'b'].forEach((k) => $(`v${k}`).addEventListener('input', (e) => { G.vals[k] = e.target.value; }));
  UI.controls.querySelectorAll('[data-eq]').forEach((b) => b.addEventListener('click', () => submitTest(b.dataset.eq === '1')));
  focusFirst();
}

/* ================================================================== */
/* Answers                                                             */
/* ================================================================== */
function finish(res) { G.done = true; draw(); return win(res); }
/** Send the front log to channel number k. */
function send(k) {
  const p = G.problem;
  if (G.locked || !p || p.kind !== 'sort' || G.phase !== 'sort' || k < 0 || k >= p.channels.length) return;
  const ch = p.channels[k], res = checkSortMove(p, G.next, ch);
  if (!res.correct) {
    G.badChannel = ch; draw();
    return miss(res, { lock: true, delay: 1700, retry: () => { G.badChannel = null; draw(); } });
  }
  (G.bins[ch] = G.bins[ch] || []).push(G.next);
  G.next += 1;
  hubAudio.playTone(420 + k * 120, 'triangle', 0.1, 0.07);
  if (G.next >= p.terms.length) G.phase = 'total';
  renderControls(); draw();
}
function submitTotals() {
  const p = G.problem;
  if (G.locked || p.kind !== 'sort' || G.phase !== 'total') return;
  const res = checkTotals(p, G.vals);
  if (res.nudge) return nudge(res.message);
  if (res.correct) return finish(res);
  G.badChannel = res.channel; draw();
  miss(res, { lock: true, delay: 1900, retry: () => { G.badChannel = null; draw(); focusFirst(); } });
}
function submitBoxes() {
  const p = G.problem;
  if (G.locked || p.kind !== 'boxes') return;
  UI.controls.querySelectorAll('[data-box]').forEach((el) => { G.vals[el.dataset.box] = el.value; });
  const res = checkBoxes(p, G.vals);
  if (res.nudge) return nudge(res.message);
  if (res.correct) return finish(res);
  miss(res, { lock: true, delay: 1900, retry: () => focusFirst() });
}
function toggle(i) {
  if (G.locked || G.problem.kind !== 'select') return;
  if (G.picked.has(i)) G.picked.delete(i); else G.picked.add(i);
  hubAudio.playSelect();
  renderControls();
}
function submitSelect() {
  const p = G.problem;
  if (G.locked || p.kind !== 'select') return;
  const res = checkSelect(p, G.picked);
  if (res.nudge) return nudge(res.message);
  if (res.correct) return finish(res);
  (res.wrong || []).forEach((i) => UI.controls.querySelector(`[data-card="${i}"]`)?.classList.add('wrong'));
  miss(res, { lock: true, delay: 2000, retry: () => { (res.wrong || []).forEach((i) => G.picked.delete(i)); renderControls(); } });
}
function submitTest(saysEq) {
  const p = G.problem;
  if (G.locked || p.kind !== 'test') return;
  const res = checkTest(p, $('va').value, $('vb').value, saysEq);
  if (res.nudge) return nudge(res.message);
  if (res.correct) return finish(res);
  miss(res, { lock: true, delay: 1900, retry: () => focusFirst() });
}
function nudge(t) {
  const h = $('helpLine');
  if (h) h.innerHTML = `<span class="warn">${esc(t)}</span>`;
  else showFeedback(true, t);
  hubAudio.playTone(220, 'square', 0.12, 0.05);
}

function onKey(e) {
  const key = e.key, p = G.problem, n = Number(key);
  if (p.kind === 'sort' && G.phase === 'sort') { if (n >= 1 && n <= p.channels.length) send(n - 1); return; }
  if (p.kind === 'sort') { if (key === 'Enter') { e.preventDefault(); submitTotals(); } return; }
  if (p.kind === 'boxes') { if (key === 'Enter') { e.preventDefault(); submitBoxes(); } return; }
  if (p.kind === 'select') { if (n >= 1 && n <= p.cards.length) return toggle(n - 1); if (key === 'Enter') { e.preventDefault(); submitSelect(); } return; }
  if (key === 'y' || key === 'Y') { e.preventDefault(); return submitTest(true); }
  if (key === 'n' || key === 'N') { e.preventDefault(); return submitTest(false); }
  if (key === 'Enter') { e.preventDefault(); nudge('Press Y for equivalent or N for not equivalent.'); }
}

draw();     // a sample flume waits behind the briefing
