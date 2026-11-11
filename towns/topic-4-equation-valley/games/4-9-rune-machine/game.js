// Rune Machine (Lesson 4-9): the ancient machine, its stone table and the controls. The math and checks live in rune.js;
// zones, timer, lives, scoring and the report come from the shared game shell (shared/game/gameShell.js).
//
// Problem types: crack (pick the rule's shape, type its numbers; the machine tests every row), fill (the rule is carved
// on the machine; fill the missing outputs), predict (read far ahead, or work backward), maya (where does her rule break?).
import {
  ZONES, genZone, genBackup, checkRule, checkFill, checkPredict, checkMaya, workedSolution, ruleText, needs, fmt, run, parseNumber,
} from './rune.js';
import { hubAudio } from '../../../../shared/audio.js';
import { createGame } from '../../../../shared/game/gameShell.js';

const SKILL_TIPS = {
  add_vs_times: 'Outputs going up by the same amount can mean MULTIPLY: compare across each row, not just down the column.',
  swapped: 'The rule gives the output (dependent) from the input (independent): y = …x.',
  skipped_inputs: 'When inputs skip, divide the output jump by the input jump to get the change for 1.',
  wrong_direction: 'If the outputs go down, the rule takes away: start − rate × input.',
  forgot_start: 'Two-step rules have a start amount: check what the output would be at 0.',
  some_rows: 'A rule must work for EVERY row, not just the first one.',
  no_rows: 'Compare each output with its input: added to, or multiplied?',
  order_of_ops: 'In y = 2x + 5, multiply first, then add.',
  calc: 'Put the input into the rule carefully, one step at a time.',
  forward_instead: 'Working backward means undoing the rule: divide instead of multiply, subtract instead of add.',
  scaled_with_start: 'You can\'t just scale up one row when the rule has a start amount. Use the rule.',
  use_the_rule: 'Find the rule first, then use it to read far down the table.',
  first_row_only: 'Test a rule on every row. One matching row proves nothing.',
};

const shell = createGame({
  zones: ZONES, makeZone: genZone, makeBackup: genBackup, workedSolution, showProblem,
  seconds: [60, 60, 55, 60, 80],                       // seconds until the runes fade, per zone
  meterFloor: 8, wrongBump: 30, rightRelief: 25, pauseOnBanner: true,
  lifeLostText: (left) => (left > 0 ? 'A TORCH WENT OUT!' : 'THE MACHINE SEALED!'),
  bossHitText: 'RUNE CRACKED!', winDelay: () => 1700,
  skillTips: SKILL_TIPS, perfectText: 'No mistakes to sharpen. A true rune master!',
  onKey, testName: '__rune',
});
const { G, UI, $, win, miss, showFeedback } = shell;
const SHAPES = ['times', 'plus', 'line', 'down'];
Object.assign(G, { form: null, vals: { m: '', b: '' }, lights: null, glow: false, tried: [] });

/* ================================================================== */
/* Drawing the machine                                                 */
/* ================================================================== */
const K = '#1d1433';
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round"`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const FONT = 'font-family="Nunito, system-ui, sans-serif" font-weight="900"';
const MONO = 'font-family="ui-monospace, \'Courier New\', monospace" font-weight="900"';

function lines(text, x, y, n, size, fill = K) {
  const out = [];
  for (const w of String(text).split(' ')) { const last = out[out.length - 1]; if (last && `${last} ${w}`.length <= n) out[out.length - 1] = `${last} ${w}`; else out.push(w); }
  const top = y - ((out.length - 1) * (size + 2)) / 2;
  return out.map((l, i) => `<text x="${x}" y="${top + i * (size + 2)}" text-anchor="middle" font-size="${size}" fill="${fill}" ${FONT}>${esc(l)}</text>`).join('');
}
function canyon() {
  return `<rect x="-300" y="-300" width="1400" height="1120" fill="#f2b671"/>
    <path d="M-300 120 L-40 60 L60 140 L120 40 L170 520 H-300 Z" fill="#c4643a" ${O}/>
    <path d="M1100 140 L840 50 L740 150 L680 60 L630 520 H1100 Z" fill="#c4643a" ${O}/>
    <path d="M-300 260 L20 230 L110 520 H-300 Z M1100 280 L780 240 L690 520 H1100 Z" fill="#9e4a2b"/>
    <rect x="-300" y="470" width="1400" height="400" fill="#8a4a2a"/><path d="M-300 470 H1100" stroke="${K}" stroke-width="3"/>`;
}
const RUNES = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ'];
/**
 * The machine: a stone slab with the rule plaque on top and the table carved below.
 *   plaque   text on the rule plaque ('???' while the rule is hidden)
 *   rows     [{ x, y, state: 'ok' | 'bad' | 'ask' | null, gap }]  (x or y may be '?' or a typed value)
 */
function drawMachine({ plaque = '???', rows = [], X = 'x', Y = 'y', xName = 'input', yName = 'output', glow = false }) {
  const top = 150, h = 44;
  const cell = (r, i) => {
    if (r.gap) return `<text x="400" y="${top + i * h + 30}" text-anchor="middle" font-size="26" fill="#5b4a3a" ${FONT}>⋮</text>`;
    const y0 = top + i * h;
    const fill = r.state === 'ok' ? '#9be7b4' : r.state === 'bad' ? '#ffadb3' : r.state === 'ask' ? '#fff3c4' : '#efe2c4';
    return `<g class="${r.state === 'ok' || r.state === 'bad' ? 'row-lit' : ''}">
      <rect x="226" y="${y0 + 4}" width="348" height="${h - 8}" rx="8" fill="${fill}" ${O}/>
      <text x="300" y="${y0 + 31}" text-anchor="middle" font-size="22" fill="${K}" ${MONO}>${esc(r.x)}</text>
      <text x="390" y="${y0 + 31}" text-anchor="middle" font-size="20" fill="#8f3f22" ${FONT}>➜</text>
      <text x="480" y="${y0 + 31}" text-anchor="middle" font-size="22" fill="${K}" ${MONO}>${esc(r.y)}</text>
      ${r.state === 'ok' ? `<text x="548" y="${y0 + 31}" font-size="20" fill="#1f8a4c" ${FONT}>✓</text>` : r.state === 'bad' ? `<text x="548" y="${y0 + 31}" font-size="20" fill="#d6283a" ${FONT}>✗</text>` : ''}
    </g>`;
  };
  UI.scene.innerHTML = `${canyon()}
    <rect x="180" y="20" width="440" height="${Math.max(top + rows.length * h + 18, 330)}" rx="20" fill="#8c7c6b" ${O}/>
    ${RUNES.map((r, i) => `<text class="rune ${glow ? 'lit' : ''}" style="animation-delay:${i * 0.08}s" x="${i < 4 ? 200 : 600}" y="${150 + (i % 4) * 70}" text-anchor="middle" font-size="22" fill="#5b4a3a" ${FONT}>${r}</text>`).join('')}
    <rect x="216" y="34" width="368" height="56" rx="10" fill="${glow ? '#ffe680' : '#3b3049'}" ${O}/>
    <text x="400" y="71" text-anchor="middle" font-size="${plaque.length > 22 ? 18 : 24}" fill="${glow ? K : '#ffd23f'}" ${MONO}>${esc(plaque)}</text>
    <rect x="226" y="98" width="170" height="48" rx="8" fill="#5b4a3a" ${O}/><rect x="404" y="98" width="170" height="48" rx="8" fill="#5b4a3a" ${O}/>
    ${lines(`IN: ${xName} (${X})`, 311, 124, 20, 13, '#fff4d6')}${lines(`OUT: ${yName} (${Y})`, 489, 124, 20, 13, '#fff4d6')}
    ${rows.map(cell).join('')}
    <g transform="translate(110 380)"><path d="M-40 0 L40 0 L28 60 L-28 60 Z" fill="#6b5a4a" ${O}/><text x="0" y="40" text-anchor="middle" font-size="14" fill="#fff4d6" ${FONT}>IN</text></g>
    <g transform="translate(690 380)"><path d="M-40 0 L40 0 L28 60 L-28 60 Z" fill="#6b5a4a" ${O}/><text x="0" y="40" text-anchor="middle" font-size="14" fill="#fff4d6" ${FONT}>OUT</text></g>`;
}
function strip(text) {
  const el = $('eqStrip');
  if (!el) return;
  if (!text) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML = `<div class="eq-line small">${text}</div>`;
}

/* ================================================================== */
/* Problems                                                            */
/* ================================================================== */
const TAGS = { crack: 'CRACK THE RUNE', fill: 'FEED THE MACHINE', predict: 'READ AHEAD', maya: 'IS MAYA RIGHT?' };
function showProblem(p, isBackup) {
  Object.assign(G, { form: null, vals: { m: '', b: '' }, lights: null, glow: false, tried: [] });
  const tag = p.type === 'predict' && p.backward ? 'WORK BACKWARD' : TAGS[p.type];
  UI.taskTag.textContent = `${tag}${isBackup ? ' · BACKUP' : ''}`;
  renderPrompt();
  renderControls();
  showState();
}
function renderPrompt() {
  const p = G.problem;
  UI.prompt.innerHTML = {
    crack: () => `Input: <b>${esc(p.xName)}</b>. Output: <b>${esc(p.yName)}</b>. Write its rule as an equation.${p.skip ? ' <b>Careful: the inputs skip!</b>' : ''}`,
    fill: () => `The rule is carved on the machine. Feed in each input and fill the missing outputs.`,
    predict: () => `<span class="story">${esc(p.question)}</span>`,
    maya: () => `Maya says: <b>"The rule is ${esc(ruleText(p.maya, 'd', 'h'))}. It works for the first row!"</b> Find the <b>first</b> row where her rule breaks.`,
  }[p.type]();
}
function tableRows() {
  const p = G.problem, L = G.lights || [];
  if (p.type === 'fill') {
    return p.rows.map((r, i) => {
      const k = p.blanks.indexOf(i);
      if (k < 0) return { x: fmt(r.x), y: fmt(r.y), state: L[i] || null };
      const typed = ($(`f${k}`)?.value || '').trim();
      return { x: fmt(r.x), y: typed || '?', state: L[i] || 'ask' };
    });
  }
  const rows = p.rows.map((r, i) => ({ x: fmt(r.x), y: fmt(r.y), state: L[i] || null }));
  if (p.type === 'predict') {
    const typed = ($('pv')?.value || '').trim() || '?';
    const out = run(p.rule, p.answer);
    rows.push({ gap: true });
    rows.push(p.backward ? { x: typed, y: fmt(out), state: L[4] || 'ask' } : { x: fmt(p.target), y: typed, state: L[4] || 'ask' });
  }
  return rows;
}
function showState() {
  const p = G.problem;
  const plaque = p.type === 'fill' || G.glow ? ruleText(p.rule, p.X, p.Y) : p.type === 'maya' ? `MAYA: ${ruleText(p.maya, 'd', 'h')}` : '???';
  drawMachine({ plaque, rows: tableRows(), X: p.X, Y: p.Y, xName: p.xName, yName: p.yName, glow: G.glow });
  if (p.type === 'crack') strip(G.form ? 'Fill the boxes, then TEST: the machine checks every row.' : 'Pick the rule\'s shape: is each output added to, or multiplied?');
  else if (p.type === 'fill') strip(`Rule: <b>${esc(ruleText(p.rule, p.X, p.Y))}</b> · put each input in for <b>${esc(p.X)}</b>`);
  else if (p.type === 'predict') strip(p.backward ? 'Find the rule, then UNDO it to get the input.' : 'Find the rule, then use it. Too far to count row by row!');
  else strip('Test her rule on every row.');
}

/* ================================================================== */
/* Controls                                                            */
/* ================================================================== */
const box = (k) => `<input id="r_${k}" class="rbox" value="${esc(G.vals[k])}" inputmode="decimal" maxlength="7" placeholder="?" autocomplete="off" aria-label="${k === 'm' ? 'rate' : 'number'}">`;
function shapeHtml(form, X, Y, live = false) {
  const b = (k) => (live ? box(k) : '<span class="sq">□</span>');
  return {
    times: `${Y} = ${b('m')}${X}`, plus: `${Y} = ${X} + ${b('b')}`, line: `${Y} = ${b('m')}${X} + ${b('b')}`, down: `${Y} = ${b('b')} − ${b('m')}${X}`,
  }[form];
}
function renderControls() {
  const p = G.problem;
  if (p.type === 'crack') {
    UI.controls.innerHTML = `
      <div class="label px">1. PICK THE RULE'S SHAPE (↑ ↓)</div>
      <div class="shapes">${SHAPES.map((f) => `<button type="button" class="shape ${G.form === f ? 'on' : ''}" data-shape="${f}">${shapeHtml(f, esc(p.X), esc(p.Y))}</button>`).join('')}</div>
      <div class="label px">2. FILL IN THE NUMBERS</div>
      <div class="rule-row">${G.form ? shapeHtml(G.form, esc(p.X), esc(p.Y), true) : '<span class="empty">pick a shape first</span>'}</div>
      <button type="button" id="checkBtn" class="apply px">TEST THE RULE (ENTER)</button>
      <div id="helpLine" class="help-line">Click a shape, type the numbers, press <kbd>Enter</kbd>. Decimals are fine.</div>`;
    UI.controls.querySelectorAll('[data-shape]').forEach((b) => b.addEventListener('click', () => pickShape(b.dataset.shape)));
    UI.controls.querySelectorAll('.rbox').forEach((el) => el.addEventListener('input', () => { G.vals[el.id.slice(2)] = el.value; }));
    $('checkBtn').addEventListener('click', submitRule);
    focusFirst();
    return;
  }
  if (p.type === 'fill') {
    UI.controls.innerHTML = `
      <div class="label px">MISSING OUTPUTS</div>
      <div class="fills">${p.blanks.map((i, k) => `<label class="rule-row">${esc(p.X)} = ${fmt(p.rows[i].x)} ➜ ${esc(p.Y)} = <input id="f${k}" class="rbox wide" inputmode="decimal" maxlength="8" placeholder="?" autocomplete="off"></label>`).join('')}</div>
      <button type="button" id="checkBtn" class="apply px">RUN THE MACHINE (ENTER)</button>
      <div id="helpLine" class="help-line">Type each output, then press <kbd>Enter</kbd>. <kbd>Tab</kbd> moves to the next box.</div>`;
    UI.controls.querySelectorAll('.rbox').forEach((el) => el.addEventListener('input', () => showState()));
    $('checkBtn').addEventListener('click', submitFill);
    focusFirst();
    return;
  }
  if (p.type === 'predict') {
    const ask = p.backward ? `${esc(p.X)} = ` : `${esc(p.Y)} = `;
    UI.controls.innerHTML = `
      <div class="label px">${p.backward ? 'WHICH INPUT?' : 'WHAT COMES OUT?'}</div>
      <label class="rule-row">${ask}<input id="pv" class="rbox wide" inputmode="decimal" maxlength="9" placeholder="?" autocomplete="off"></label>
      <button type="button" id="checkBtn" class="apply px">RUN THE MACHINE (ENTER)</button>
      <div id="helpLine" class="help-line">Type a number and press <kbd>Enter</kbd>. Money can be typed as 61.25 or $61.25.</div>`;
    $('pv').addEventListener('input', () => showState());
    $('checkBtn').addEventListener('click', submitPredict);
    focusFirst();
    return;
  }
  UI.controls.innerHTML = p.options.map((o, i) => `<button type="button" class="choice" data-choice="${i}" ${G.tried.includes(i) ? 'disabled' : ''}><b>${i + 1}</b>${esc(o.text)}</button>`).join('');
  UI.controls.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => answerMaya(Number(b.dataset.choice))));
}
function focusFirst() {
  const el = [...UI.controls.querySelectorAll('input')].find((i) => !i.value) || UI.controls.querySelector('input');
  if (el && UI.briefing.classList.contains('hidden')) el.focus({ preventScroll: true });
}

/* ================================================================== */
/* Answers                                                             */
/* ================================================================== */
function pickShape(f) {
  if (G.locked) return;
  G.form = f; G.lights = null;
  hubAudio.playSelect();
  renderControls(); showState();
}
function submitRule() {
  const p = G.problem;
  if (G.locked || p.type !== 'crack') return;
  if (!G.form) return nudge('Pick the rule\'s shape first.');
  const guess = { form: G.form };
  for (const k of needs(G.form)) { const v = parseNumber(G.vals[k]); if (v !== null) guess[k] = v; }
  const res = checkRule(p, guess);
  if (res.nudge) return nudge(res.message);
  G.lights = res.rows.map((ok) => (ok ? 'ok' : 'bad'));
  if (res.correct) { G.glow = true; showState(); return win(res); }
  showState();
  hubAudio.playTone(180, 'sawtooth', 0.15, 0.06);
  miss(res, { lock: true, delay: 1800, retry: () => { G.lights = null; renderControls(); showState(); } });
}
function submitFill() {
  const p = G.problem;
  if (G.locked || p.type !== 'fill') return;
  const raws = p.blanks.map((_, k) => $(`f${k}`).value);
  const res = checkFill(p, raws);
  if (res.nudge) return nudge(res.message);
  if (res.correct) { G.lights = p.rows.map(() => 'ok'); G.glow = true; showState(); return win(res); }
  G.lights = p.rows.map((_, i) => (i === res.row ? 'bad' : null));
  showState();
  miss(res, { lock: true, delay: 1800, retry: () => { G.lights = null; showState(); focusFirst(); } });
}
function submitPredict() {
  const p = G.problem;
  if (G.locked || p.type !== 'predict') return;
  const res = checkPredict(p, $('pv').value);
  if (res.nudge) return nudge(res.message);
  G.lights = res.correct ? ['ok', 'ok', 'ok', 'ok', 'ok'] : [null, null, null, null, 'bad'];
  if (res.correct) { G.glow = true; showState(); return win(res); }
  showState();
  miss(res, { lock: true, delay: 1800, retry: () => { G.lights = null; $('pv').value = ''; showState(); focusFirst(); } });
}
function answerMaya(i) {
  const p = G.problem;
  if (G.locked || G.tried.includes(i)) return;
  const res = checkMaya(p, i);
  UI.controls.querySelector(`[data-choice="${i}"]`)?.classList.add(res.correct ? 'right' : 'wrong');
  G.lights = p.rows.map((_, k) => (k === 0 ? 'ok' : 'bad'));
  if (res.correct) { G.glow = true; showState(); return win(res); }
  showState();
  G.tried.push(i);
  miss(res, { lock: true, delay: 1600, retry: () => { G.lights = null; renderControls(); showState(); } });
}
function nudge(text) {
  const h = $('helpLine');
  if (h) h.innerHTML = `<span class="warn">${text}</span>`;
  else showFeedback(true, text);
  hubAudio.playTone(220, 'square', 0.12, 0.05);
}

/* ================================================================== */
/* Keys and start-up                                                   */
/* ================================================================== */
function onKey(e) {
  const key = e.key, p = G.problem;
  if (p.type === 'maya') {
    const n = Number(key);
    if (n >= 1 && n <= p.options.length) answerMaya(n - 1);
    return;
  }
  if (p.type === 'crack' && (key === 'ArrowUp' || key === 'ArrowDown')) {
    e.preventDefault();
    const step = key === 'ArrowDown' ? 1 : -1;
    const now = SHAPES.indexOf(G.form);                         // -1 when no shape is picked yet
    const next = now < 0 ? (step > 0 ? 0 : SHAPES.length - 1) : (now + step + SHAPES.length) % SHAPES.length;
    return pickShape(SHAPES[next]);
  }
  if (key === 'Enter') {
    e.preventDefault();
    if (p.type === 'crack') return submitRule();
    if (p.type === 'fill') return submitFill();
    return submitPredict();
  }
}

function init() {
  const stripEl = document.createElement('div');
  stripEl.id = 'eqStrip'; stripEl.className = 'eq-strip hidden';
  $('stage').appendChild(stripEl);
  drawMachine({ plaque: 'c = 8b', rows: [1, 2, 3, 4].map((x) => ({ x: fmt(x), y: fmt(8 * x), state: null })), X: 'b', Y: 'c', xName: 'boxes', yName: 'candles' });   // a sample behind the briefing
}

init();
