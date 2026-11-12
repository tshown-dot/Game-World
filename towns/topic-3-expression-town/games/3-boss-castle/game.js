// Boss Castle (Topic 3 boss): the Expression Colossus, the castle, the stone tablet and the controls. The math and
// checks live in castle.js; zones, timer, lives, scoring and the report come from the shared game shell.
//
// Each zone is one part of the castle (gate, treasury, clock tower, library, throne). Right answers knock stones off;
// a part that is cleared stays broken. Answer kinds: num (type a number), choice, boxes (fill number boxes).
import { ZONES, genZone, genBackup, workedSolution, checkNum, checkChoice, checkBoxes } from './castle.js';
import { hubAudio } from '../../../../shared/audio.js';
import { createGame } from '../../../../shared/game/gameShell.js';

const SKILL_TIPS = {
  base_times_exponent: '4³ means 4 × 4 × 4, not 4 × 3.',
  zero_exponent: 'Any nonzero number to the power 0 is 1.',
  one_exponent: 'A number to the power 1 is just the number.',
  swapped: 'The base is the repeated number; the exponent counts how many times.',
  count_factors: 'Count every factor when you write a power.',
  base_exponent: 'Base = the number multiplied; exponent = how many times.',
  gcf_vs_lcm: 'Equal groups with nothing left over: GCF. Lining up again: LCM.',
  not_greatest: 'Check for a BIGGER common factor before you stop.',
  not_least: 'Multiplying two numbers gives a common multiple, but often not the least one.',
  left_to_right: 'Multiply and divide before you add and subtract.',
  add_before_subtract: 'Add and subtract from left to right.',
  mul_before_div: 'Multiply and divide from left to right.',
  parentheses_first: 'Work inside parentheses first, then exponents.',
  exponent_first: 'An exponent only belongs to the number right before it.',
  power_is_times_two: 'x² means x × x, not x × 2.',
  power_first: 'In 3x², only x is squared.',
  less_than_backwards: '"5 less than n" is n − 5: start with n.',
  divide_backwards: '"n divided by 3" is n ÷ 3: n comes first.',
  operation_word: 'Match the word to the operation: product, sum, difference, quotient.',
  parentheses_extra: 'Only use parentheses when the words group something together.',
  swapped_numbers: 'Read carefully which number multiplies the variable.',
  distribute_all: 'The number outside the parentheses multiplies EVERY term inside.',
  forgot_term: 'Bring every term along when you simplify.',
  combine_unlike: 'Only like terms combine: x-terms with x-terms, numbers with numbers.',
  add_constants: 'After the x-terms, add the plain numbers too.',
  add_coefficients: 'Add the numbers in front of x.',
  check_it: 'Check your answer by working it the other way.',
};

const shell = createGame({
  zones: ZONES, makeZone: genZone, makeBackup: genBackup, workedSolution, showProblem,
  seconds: [45, 60, 50, 55, 80],                       // seconds until the Colossus's hammer lands, per part
  meterFloor: 8, wrongBump: 30, rightRelief: 25, pauseOnBanner: true,
  lifeLostText: (left) => (left > 0 ? 'THE HAMMER FALLS!' : 'KNOCKED OUT!'),
  onLifeLost: () => anim('slam', 600),
  bossHitText: 'COLOSSUS DEFEATED!', winDelay: () => 1700,
  skillTips: SKILL_TIPS, perfectText: 'Not a scratch. Expression Town is yours!',
  onKey, testName: '__castle',
});
const { G, UI, $, win, miss, showFeedback } = shell;
Object.assign(G, { hits: 0, lastZone: -1, tried: [], vals: {}, done: false });

/* ================================================================== */
/* Drawing: the castle, the Colossus and the stone tablet              */
/* ================================================================== */
const K = '#1d1433';
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round"`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const FONT = 'font-family="Nunito, system-ui, sans-serif" font-weight="900"';
const MONO = 'font-family="ui-monospace, \'Courier New\', monospace" font-weight="900"';
const text = (t, x, y, size, fill = K, anchor = 'middle', font = FONT) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${fill}" ${font}>${esc(t)}</text>`;
const STONE = '#8f8aa3', DARK = '#5e5a70';
function part(state, svg) {
  if (state === 'broken') return `<g class="broken" opacity="0.35" transform="translate(0 14)">${svg(DARK)}</g>`;
  return `<g class="${state === 'target' ? 'target' : ''}">${svg(STONE)}</g>`;
}
const crenels = (x, w, y, c) => Array.from({ length: Math.floor(w / 24) }, (_, i) => `<rect x="${x + i * 24}" y="${y - 14}" width="14" height="16" fill="${c}" ${O}/>`).join('');
function castle() {
  const z = G.zone ?? 0;
  const st = (i) => (i < z ? 'broken' : i === z ? 'target' : 'whole');
  const cracks = Array.from({ length: Math.min(G.hits, 5) }, (_, i) => `<path d="M${180 + i * 14} ${232 + (i % 2) * 22} l8 10 l-6 8 l10 10" stroke="${K}" stroke-width="3" fill="none"/>`).join('');
  return `<g id="castle">
    <rect x="-300" y="430" width="1100" height="400" fill="#4fae4a"/><path d="M-300 430 H800" stroke="${K}" stroke-width="3"/>
    ${part(st(2), (c) => `<rect x="300" y="110" width="80" height="320" fill="${c}" ${O}/>${crenels(300, 80, 110, c)}<circle cx="340" cy="170" r="24" fill="#fff4d6" ${O}/><path d="M340 170 V154 M340 170 H352" stroke="${K}" stroke-width="3"/>`)}
    ${part(st(1), (c) => `<rect x="20" y="160" width="80" height="270" fill="${c}" ${O}/>${crenels(20, 80, 160, c)}${text('$', 60, 230, 34, '#ffd23f')}`)}
    ${part(st(3), (c) => `<rect x="96" y="250" width="208" height="180" fill="${c}" ${O}/>${crenels(96, 208, 250, c)}<rect x="120" y="290" width="22" height="34" rx="11" fill="${K}"/><rect x="258" y="290" width="22" height="34" rx="11" fill="${K}"/>`)}
    ${part(st(0), (c) => `<path d="M160 430 V360 A40 40 0 0 1 240 360 V430 Z" fill="${c === STONE ? '#8a5a2b' : c}" ${O}/><path d="M172 430 V366 M188 430 V356 M204 430 V352 M220 430 V356 M228 430 V366" stroke="${K}" stroke-width="3"/>`)}
    <g id="colossus">
      <rect x="160" y="160" width="80" height="96" rx="12" fill="${STONE}" ${O}/>
      <rect x="172" y="120" width="56" height="46" rx="10" fill="${STONE}" ${O}/>
      <rect x="182" y="136" width="12" height="8" fill="${z >= 5 ? DARK : '#e5484d'}"/><rect x="206" y="136" width="12" height="8" fill="${z >= 5 ? DARK : '#e5484d'}"/>
      ${part(st(4), (c) => `<rect x="182" y="184" width="36" height="36" rx="6" fill="${c === STONE ? '#ffd23f' : c}" ${O}/>${text('x²', 200, 209, 18, K, 'middle', MONO)}`)}
      <g class="hammer"><rect x="240" y="150" width="10" height="90" fill="#8a5a2b" ${O}/><rect x="226" y="126" width="38" height="30" rx="4" fill="${DARK}" ${O}/></g>
      ${cracks}
    </g>
    ${text(ZONES[Math.min(z, 4)].name.replace('The ', '').toUpperCase(), 200, 470, 14, '#fff4d6')}
  </g>`;
}
function tablet() {
  const p = G.problem;
  const t = p.show;
  return `<rect x="420" y="40" width="364" height="380" rx="18" fill="#3b3049" ${O}/>
    ${text(`LESSON ${p.lesson}`, 440, 70, 13, '#c9b8ff', 'start')}
    ${text(t, 602, 240, t.length > 22 ? 18 : t.length > 14 ? 24 : 34, '#ffd23f', 'middle', MONO)}
    ${G.done && p.answerText ? text(p.answerText, 602, 320, 26, '#9be7b4', 'middle', MONO) : ''}`;
}
function draw() {
  UI.scene.innerHTML = `<rect x="-300" y="-300" width="1400" height="1120" fill="#8fd3ff"/>${castle()}${G.problem ? tablet() : ''}`;
}
function anim(cls, ms) {
  const g = $('castle');
  if (!g) return;
  g.classList.remove(cls); void g.getBoundingClientRect(); g.classList.add(cls);
  setTimeout(() => g.classList.remove(cls), ms);
}

/* ================================================================== */
/* Problems and controls                                               */
/* ================================================================== */
const TAGS = { power: 'EVALUATE THE POWER', writePower: 'WRITE IT AS A POWER', gcfOrLcm: 'GCF OR LCM?', gcf: 'FIND THE GCF', lcm: 'FIND THE LCM', order: 'ORDER OF OPERATIONS', writeExpr: 'WORDS TO EXPRESSION', evaluate: 'EVALUATE IT', distribute: 'DISTRIBUTE', factor: 'FACTOR OUT THE GCF', combine: 'COMBINE LIKE TERMS', dilemma1: 'FINAL DILEMMA 1 OF 2', dilemma2: 'FINAL DILEMMA 2 OF 2' };
function showProblem(p, isBackup) {
  if (G.zone !== G.lastZone) { G.hits = 0; G.lastZone = G.zone; }
  Object.assign(G, { tried: [], vals: {}, done: false });
  UI.taskTag.textContent = `${TAGS[p.type]}${isBackup ? ' · BACKUP' : ''}`;
  UI.prompt.innerHTML = p.prompt;
  renderControls();
  draw();
}
function renderControls() {
  const p = G.problem;
  if (p.kind === 'num') {
    UI.controls.innerHTML = `<label class="rule-row">${esc(p.label)} = <input id="ans" class="rbox wide" inputmode="decimal" maxlength="9" placeholder="?" autocomplete="off"></label>
      <button type="button" id="checkBtn" class="apply px">STRIKE! (ENTER)</button>
      <div id="helpLine" class="help-line">Type a number and press <kbd>Enter</kbd>.</div>`;
    $('checkBtn').addEventListener('click', submitNum);
    return focusFirst();
  }
  if (p.kind === 'choice') {
    UI.controls.innerHTML = p.options.map((o, i) => `<button type="button" class="choice" data-choice="${i}" ${G.tried.includes(i) ? 'disabled' : ''}><b>${i + 1}</b><span class="${/[−+÷=]|\dn/.test(o.text) ? 'mono' : ''}">${esc(o.text)}</span></button>`).join('')
      + `<div class="help-line">Click an answer or press <kbd>1</kbd>–<kbd>${p.options.length}</kbd>.</div>`;
    UI.controls.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => choose(Number(b.dataset.choice))));
    return;
  }
  const row = p.pattern.map((piece) => (typeof piece === 'object'
    ? `<input id="b_${piece.k}" class="rbox${p.type === 'writePower' && piece.k === 'e' ? ' sup' : ''}" data-box="${piece.k}" value="${esc(G.vals[piece.k] || '')}" inputmode="numeric" maxlength="4" placeholder="?" autocomplete="off">`
    : piece === '^' ? '' : `<span>${esc(piece)}</span>`)).join('');
  UI.controls.innerHTML = `<div class="label px">FILL THE BOXES (TAB MOVES TO THE NEXT)</div>
    <div class="rule-row">${row}</div>
    <button type="button" id="checkBtn" class="apply px">STRIKE! (ENTER)</button>
    <div id="helpLine" class="help-line">Type a number in each box, then press <kbd>Enter</kbd>.</div>`;
  UI.controls.querySelectorAll('[data-box]').forEach((el) => el.addEventListener('input', () => { G.vals[el.dataset.box] = el.value; }));
  $('checkBtn').addEventListener('click', submitBoxes);
  focusFirst();
}
function focusFirst() {
  const el = [...UI.controls.querySelectorAll('input')].find((i) => !i.value) || UI.controls.querySelector('input');
  if (el && UI.briefing.classList.contains('hidden')) el.focus({ preventScroll: true });
}

/* ================================================================== */
/* Answers                                                             */
/* ================================================================== */
function hit(res) {
  G.hits += 1; G.done = true;
  draw(); anim('hit', 500);
  hubAudio.playTone(150, 'square', 0.18, 0.08);
  return win(res);
}
function strike(res, retry, delay = 1700) {
  anim('slam', 600);
  miss(res, { lock: true, delay, retry });
}
function submitNum() {
  const p = G.problem;
  if (G.locked || p.kind !== 'num') return;
  const res = checkNum(p, $('ans').value);
  if (res.nudge) return nudge(res.message);
  if (res.correct) return hit(res);
  strike(res, () => { $('ans').value = ''; focusFirst(); });
}
function choose(i) {
  const p = G.problem;
  if (G.locked || p.kind !== 'choice' || G.tried.includes(i)) return;
  const res = checkChoice(p, i);
  UI.controls.querySelector(`[data-choice="${i}"]`)?.classList.add(res.correct ? 'right' : 'wrong');
  if (res.correct) return hit(res);
  G.tried.push(i);
  strike(res, () => renderControls(), 1500);
}
function submitBoxes() {
  const p = G.problem;
  if (G.locked || p.kind !== 'boxes') return;
  UI.controls.querySelectorAll('[data-box]').forEach((el) => { G.vals[el.dataset.box] = el.value; });
  const res = checkBoxes(p, G.vals);
  if (res.nudge) return nudge(res.message);
  if (res.correct) return hit(res);
  strike(res, () => { renderControls(); });
}
function nudge(t) {
  const h = $('helpLine');
  if (h) h.innerHTML = `<span class="warn">${esc(t)}</span>`;
  else showFeedback(true, t);
  hubAudio.playTone(220, 'square', 0.12, 0.05);
}

function onKey(e) {
  const key = e.key, p = G.problem;
  if (p.kind === 'choice') { const n = Number(key); if (n >= 1 && n <= p.options.length) choose(n - 1); return; }
  if (key === 'Enter') { e.preventDefault(); if (p.kind === 'num') submitNum(); else submitBoxes(); }
}

draw();     // the castle waits behind the briefing
