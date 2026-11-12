// Ranger Station (Grade 7, Lesson 4-1): the station's gauge, the number chips and the controls. The math and checks
// live in ranger.js; zones, timer, lives, scoring and the report come from the shared game shell.
//
// Problem kinds: build (drag number chips into the expression on the gauge), num (type a value), choice.
import { ZONES, genZone, genBackup, workedSolution, checkBuild, checkNum, checkChoice, fmt, valueAt } from './ranger.js';
import { hubAudio } from '../../../../shared/audio.js';
import { createGame } from '../../../../shared/game/gameShell.js';
import { dragOrTap, inside } from '../../../../shared/game/drag.js';

const SKILL_TIPS = {
  swapped_constant_rate: 'The start amount stands alone (constant). The amount for EACH one multiplies the variable (coefficient).',
  wrong_direction: 'Growing means add the rate; shrinking means subtract it.',
  lost_negative: 'Below zero or below the surface is a NEGATIVE number. Keep the sign.',
  forgot_constant: 'After multiplying, remember the starting amount.',
  added_first: 'Multiply before you add or subtract.',
  decimal_slip: 'Place the decimal point carefully when you multiply.',
  subtracted_backwards: 'Subtract in the order the expression is written.',
  swapped_prices: 'Each variable gets its own price as its coefficient.',
  used_amount: 'Amounts are what the variables stand for. Prices and rates are the numbers in the expression.',
  swapped_values: 'Substitute each value for its own letter.',
  one_term_only: 'Evaluate every term of the expression.',
  reversed_inequality: 'Test a value to see which way the inequality goes.',
  used_constant: 'Find where the expression equals 0, then decide which side is negative.',
  negative_input: 'Subtracting a negative makes a value bigger, not smaller.',
  check_it: 'Substitute, multiply first, then add or subtract.',
};

const shell = createGame({
  zones: ZONES, makeZone: genZone, makeBackup: genBackup, workedSolution, showProblem,
  seconds: [50, 50, 55, 65, 80],                       // seconds until the storm arrives, per zone
  meterFloor: 8, wrongBump: 30, rightRelief: 25, pauseOnBanner: true,
  lifeLostText: (left) => (left > 0 ? 'A FLARE IS GONE!' : 'THE STORM HIT!'),
  bossHitText: 'STORM TRACKED!', winDelay: () => 1700,
  skillTips: SKILL_TIPS, perfectText: 'No mistakes to sharpen. Chief ranger material!',
  onKey, testName: '__ranger',
});
const { G, UI, $, win, miss, showFeedback } = shell;
Object.assign(G, { slots: { a: null, b: null }, sign: null, armed: null, tried: [], done: false, tested: null });

/* ================================================================== */
/* Drawing: the station and its gauge                                  */
/* ================================================================== */
const K = '#1d1433';
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round"`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const FONT = 'font-family="Nunito, system-ui, sans-serif" font-weight="900"';
const MONO = 'font-family="ui-monospace, \'Courier New\', monospace" font-weight="900"';
const text = (t, x, y, size, fill = K, anchor = 'middle', font = FONT) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${fill}" ${font}>${esc(t)}</text>`;

function backdrop() {
  return `<rect x="-300" y="-300" width="1400" height="1120" fill="#9fd8ff"/>
    <path d="M-300 330 L-80 210 L80 320 L220 200 L420 330 L600 220 L800 320 L1100 240 V830 H-300 Z" fill="#6fae7f" ${O}/>
    <rect x="-300" y="440" width="1400" height="400" fill="#57b56a"/><path d="M-300 440 H1100" stroke="${K}" stroke-width="3"/>
    <g transform="translate(64 440)"><rect x="-44" y="-70" width="88" height="70" fill="#a9703a" ${O}/><path d="M-54 -70 L0 -112 L54 -70 Z" fill="#7a3f22" ${O}/>
      <rect x="-12" y="-36" width="24" height="36" fill="#5b3a1d" ${O}/><path d="M30 -112 V-190 M18 -170 H42 M22 -150 H38" stroke="${K}" stroke-width="4"/><circle class="blink" cx="30" cy="-194" r="6" fill="#e5484d" ${O}/></g>`;
}
/** A drop slot on the gauge: shows its chip, or a dashed box. */
function slot(id, x, w, value, label) {
  return `<g id="${id}" class="slot" data-slot="${id === 'slotA' ? 'a' : 'b'}" style="cursor:pointer">
    <rect class="slot-box" x="${x}" y="52" width="${w}" height="56" rx="10" fill="${value === null ? '#fff4d6' : '#ffd23f'}" stroke="${K}" stroke-width="3" ${value === null ? 'stroke-dasharray="7 6"' : ''}/>
    ${value === null ? text(label, x + w / 2, 86, 12, '#8a6d3b') : text(fmt(value), x + w / 2, 90, 26, K, 'middle', MONO)}</g>`;
}
function plaqueBuild(p) {
  const a = G.slots.a === null ? null : p.chips[G.slots.a], b = G.slots.b === null ? null : p.chips[G.slots.b];
  if (p.two) {
    return `${slot('slotA', 190, 130, a, 'price')}${text(p.X, 338, 92, 34, '#ffd23f', 'middle', MONO)}${text('+', 400, 92, 34, '#fff', 'middle', MONO)}
      ${slot('slotB', 440, 130, b, 'price')}${text(p.Y, 588, 92, 34, '#ffd23f', 'middle', MONO)}`;
  }
  return `${slot('slotA', 170, 150, a, 'start amount')}${text(G.sign || '±', 362, 92, 36, G.sign ? '#fff' : '#8f86b8', 'middle', MONO)}
    ${slot('slotB', 404, 130, b, 'rate')}${text(p.v, 556, 92, 34, '#ffd23f', 'middle', MONO)}`;
}
/**
 * Four bars on a chart card: the gauge's value at four values of the variable.
 * Negative values hang below the zero line. When the values are far from zero and close together (3,000, 2,996.5 ...),
 * the chart zooms in on them (dashed base line instead of zero), so the change is easy to see.
 */
function bars(values, labels, { title = '', bad = false, hide = [] } = {}) {
  const vmin = Math.min(...values), vmax = Math.max(...values), spread = vmax - vmin || 1;
  const zoom = (vmin > 0 || vmax < 0) && Math.min(Math.abs(vmin), Math.abs(vmax)) > 3 * spread;
  const lo = zoom ? vmin - spread * 0.6 : Math.min(0, vmin), hi = zoom ? vmax : Math.max(0, vmax), span = hi - lo || 1;
  const top = 214, bottom = 408, y = (v) => bottom - ((v - lo) / span) * (bottom - top);
  const base = zoom ? bottom : y(0);
  return `<rect x="226" y="146" width="428" height="318" rx="14" fill="#fff4d6" ${O}/>
    ${text(title, 440, 172, 14, '#8f3f22')}
    <path d="M250 ${base} H630" stroke="${K}" stroke-width="3" ${zoom ? 'stroke-dasharray="6 6"' : ''}/>
    ${values.map((v, i) => {
    const x = 264 + i * 92, yTop = Math.min(y(v), base), h = Math.max(Math.abs(y(v) - base), 2);
    return `<rect class="bar" x="${x}" y="${yTop}" width="60" height="${h}" fill="${hide.includes(i) ? '#e9dcc0' : bad ? '#e5484d' : '#3a8ef0'}" ${O}/>
      ${text(hide.includes(i) ? '?' : fmt(v), x + 30, v >= 0 || zoom ? yTop - 7 : yTop + h + 17, 15, K, 'middle', MONO)}
      ${text(labels[i], x + 30, 452, 13, '#3b3049')}`;
  }).join('')}`;
}
function draw() {
  const p = G.problem;
  let body = '';
  if (!p) body = `<rect x="150" y="34" width="580" height="92" rx="16" fill="#3b3049" ${O}/>${text('35 − 4m', 440, 94, 36, '#ffd23f', 'middle', MONO)}${bars([35, 31, 27, 23], ['m = 0', '1', '2', '3'], { title: 'water left (gal)' })}`;
  else {
    body = `<rect x="150" y="34" width="580" height="92" rx="16" fill="#3b3049" ${O}/>`;
    const labels = (v, ns) => ns.map((n, i) => (i === 0 ? `${v} = ${n}` : String(n)));
    if (p.kind === 'build') {
      body += plaqueBuild(p);
      if (!p.two && G.tested) body += bars([0, 1, 2, 3].map((n) => valueAt(G.tested.a, G.tested.sign, G.tested.b, n)), labels(p.v, [0, 1, 2, 3]), { title: `your gauge: ${p.what}`, bad: !G.done });
      else if (!p.two) body += `<rect x="226" y="220" width="428" height="90" rx="14" fill="#fff4d6" ${O}/>${text('Set the gauge, then TEST it:', 440, 258, 16)}${text('the bars will show what it does.', 440, 284, 16)}`;
      else body += `<rect x="210" y="190" width="460" height="150" rx="14" fill="#fff4d6" ${O}/>${text(`${p.X} = ${p.xName}`, 440, 240, 18)}${text(`${p.Y} = ${p.yName}`, 440, 280, 18)}${text('Prices go IN the expression.', 440, 316, 14, '#8f3f22')}`;
    } else {
      body += text(G.done && p.type !== 'whenNegative' ? `${p.expr} = ${fmt(p.answer)}` : p.expr, 440, 94, (p.expr.length > 16 ? 26 : 36), '#ffd23f', 'middle', MONO);
      if (p.type === 'evalStory') body += bars([0, 1, 2, p.n].map((n) => valueAt(p.start, p.sign, p.rate, n)), labels(p.v, [0, 1, 2, p.n]), { title: 'the gauge so far', hide: G.done ? [] : [3] });
      else if (p.type === 'whenNegative') body += bars([p.k - 1, p.k, p.k + 1, p.k + 2].map((n) => p.b - p.m * n), labels(p.v, [p.k - 1, p.k, p.k + 1, p.k + 2]), { title: G.done ? 'below the line is negative' : 'where does it cross zero?', hide: G.done ? [] : [0, 1, 2, 3] });
      else body += `<rect x="250" y="200" width="380" height="110" rx="14" fill="#fff4d6" ${O}/>${text('Substitute, multiply first,', 440, 246, 18)}${text('then add or subtract.', 440, 276, 18)}`;
    }
  }
  UI.scene.innerHTML = backdrop() + body;
  UI.scene.querySelectorAll('[data-slot]').forEach((g) => g.addEventListener('click', () => clickSlot(g.dataset.slot)));
}

/* ================================================================== */
/* Problems and controls                                               */
/* ================================================================== */
const TAGS = { build: 'SET THE GAUGE', evalStory: 'READ THE GAUGE', eval: 'EVALUATE', build2: 'BUILD THE ORDER', eval2: 'TOTAL IT UP', whenNegative: 'THINK IT THROUGH' };
function showProblem(p, isBackup) {
  Object.assign(G, { slots: { a: null, b: null }, sign: null, armed: null, tried: [], done: false, tested: null });
  UI.taskTag.textContent = `${TAGS[p.type]}${isBackup ? ' · BACKUP' : ''}`;
  UI.prompt.innerHTML = p.prompt;
  renderControls();
  draw();
}
function renderControls() {
  const p = G.problem;
  if (p.kind === 'build') {
    const placed = [G.slots.a, G.slots.b];
    UI.controls.innerHTML = `
      <div class="label px">NUMBER CHIPS · DRAG ONTO THE GAUGE</div>
      <div class="chips">${p.chips.map((c, i) => `<button type="button" class="chip-btn ${G.armed === i ? 'armed' : ''}" data-chip="${i}" ${placed.includes(i) ? 'disabled' : ''}><b>${i + 1}</b>${fmt(c)}</button>`).join('')}</div>
      ${p.two ? '' : `<div class="label px">GOING UP OR DOWN?</div>
      <div class="pair"><button type="button" class="${G.sign === '+' ? 'on' : ''}" data-sign="+">+ ADD</button><button type="button" class="${G.sign === '−' ? 'on' : ''}" data-sign="−">− SUBTRACT</button></div>`}
      <div class="row-btns"><button type="button" id="clearBtn" class="px">CLEAR</button><button type="button" id="checkBtn" class="go px">TEST THE GAUGE (ENTER)</button></div>
      <div id="helpLine" class="help-line">Drag a chip, or tap it then tap a box. Keys: <kbd>1</kbd>–<kbd>${p.chips.length}</kbd> then <kbd>←</kbd> / <kbd>→</kbd>${p.two ? '' : ', <kbd>+</kbd> <kbd>−</kbd>'}.</div>`;
    UI.controls.querySelectorAll('[data-chip]').forEach((b) => b.addEventListener('pointerdown', (e) => {
      if (G.locked || b.disabled) return;
      const i = Number(b.dataset.chip);
      dragOrTap(e, b, {
        targetAt: (x, y) => (inside($('slotA'), x, y) ? 'a' : inside($('slotB'), x, y) ? 'b' : null),
        glow: (t) => { $('slotA')?.classList.toggle('drop-target', t === 'a'); $('slotB')?.classList.toggle('drop-target', t === 'b'); },
        onDrop: (s) => place(i, s), onTap: () => arm(i), lift: true,
      });
    }));
    UI.controls.querySelectorAll('[data-sign]').forEach((b) => b.addEventListener('click', () => setSign(b.dataset.sign)));
    $('clearBtn').addEventListener('click', () => { if (!G.locked) { Object.assign(G, { slots: { a: null, b: null }, sign: null, armed: null, tested: null }); renderControls(); draw(); } });
    $('checkBtn').addEventListener('click', submitBuild);
    return;
  }
  if (p.kind === 'num') {
    UI.controls.innerHTML = `<label class="rule-row">${esc(p.label)} = <input id="ans" class="rbox wide" inputmode="decimal" maxlength="10" placeholder="?" autocomplete="off"></label>
      <button type="button" id="checkBtn" class="apply px">RADIO IT IN (ENTER)</button>
      <div id="helpLine" class="help-line">Type a number. Negatives (-3.3), decimals and $ are fine.</div>`;
    $('checkBtn').addEventListener('click', submitNum);
    const el = $('ans');
    if (UI.briefing.classList.contains('hidden')) el.focus({ preventScroll: true });
    return;
  }
  UI.controls.innerHTML = p.options.map((o, i) => `<button type="button" class="choice" data-choice="${i}" ${G.tried.includes(i) ? 'disabled' : ''}><b>${i + 1}</b><span class="mono">${esc(o.text)}</span></button>`).join('')
    + `<div class="help-line">Click an answer or press <kbd>1</kbd>–<kbd>${p.options.length}</kbd>.</div>`;
  UI.controls.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => choose(Number(b.dataset.choice))));
}

/* ================================================================== */
/* Answers                                                             */
/* ================================================================== */
function arm(i) {
  if (G.locked) return;
  G.armed = G.armed === i ? null : i;
  hubAudio.playSelect();
  renderControls();
}
function place(i, s) {
  if (G.locked) return;
  const other = s === 'a' ? 'b' : 'a';
  if (G.slots[other] === i) G.slots[other] = null;
  G.slots[s] = i; G.armed = null; G.tested = null;
  hubAudio.playTone(s === 'a' ? 440 : 620, 'triangle', 0.1, 0.07);
  renderControls(); draw();
}
function clickSlot(s) {
  const p = G.problem;
  if (G.locked || !p || p.kind !== 'build') return;
  if (G.armed !== null) return place(G.armed, s);
  if (G.slots[s] !== null) { G.slots[s] = null; G.tested = null; renderControls(); draw(); }     // tap a filled box to empty it
}
function setSign(sign) {
  if (G.locked || G.problem.kind !== 'build' || G.problem.two) return;
  G.sign = sign; G.tested = null;
  hubAudio.playSelect();
  renderControls(); draw();
}
function submitBuild() {
  const p = G.problem;
  if (G.locked || p.kind !== 'build') return;
  const guess = { a: G.slots.a === null ? null : p.chips[G.slots.a], b: G.slots.b === null ? null : p.chips[G.slots.b], sign: G.sign };
  const res = checkBuild(p, guess);
  if (res.nudge) return nudge(res.message);
  G.tested = guess;
  if (res.correct) { G.done = true; draw(); return win(res); }
  draw();
  miss(res, { lock: true, delay: 1900, retry: () => { G.tested = null; draw(); } });
}
function submitNum() {
  const p = G.problem;
  if (G.locked || p.kind !== 'num') return;
  const res = checkNum(p, $('ans').value);
  if (res.nudge) return nudge(res.message);
  if (res.correct) { G.done = true; draw(); return win(res); }
  miss(res, { lock: true, delay: 1800, retry: () => { $('ans').value = ''; $('ans').focus({ preventScroll: true }); } });
}
function choose(i) {
  const p = G.problem;
  if (G.locked || p.kind !== 'choice' || G.tried.includes(i)) return;
  const res = checkChoice(p, i);
  UI.controls.querySelector(`[data-choice="${i}"]`)?.classList.add(res.correct ? 'right' : 'wrong');
  if (res.correct) { G.done = true; draw(); return win(res); }
  G.tried.push(i);
  miss(res, { lock: true, delay: 1700, retry: () => renderControls() });
}
function nudge(t) {
  const h = $('helpLine');
  if (h) h.innerHTML = `<span class="warn">${esc(t)}</span>`;
  else showFeedback(true, t);
  hubAudio.playTone(220, 'square', 0.12, 0.05);
}

function onKey(e) {
  const key = e.key, p = G.problem, n = Number(key);
  if (p.kind === 'build') {
    if (n >= 1 && n <= p.chips.length) return arm(n - 1);
    if (key === 'ArrowLeft' && G.armed !== null) { e.preventDefault(); return place(G.armed, 'a'); }
    if (key === 'ArrowRight' && G.armed !== null) { e.preventDefault(); return place(G.armed, 'b'); }
    if (key === '+' || key === '=') return setSign('+');
    if (key === '-' || key === '_') return setSign('−');
    if (key === 'Enter') { e.preventDefault(); return submitBuild(); }
    return;
  }
  if (p.kind === 'num') { if (key === 'Enter') { e.preventDefault(); submitNum(); } return; }
  if (n >= 1 && n <= p.options.length) choose(n - 1);
}

draw();     // a sample gauge waits behind the briefing
