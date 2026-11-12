// Spray Deck (Grade 7, Lesson 4-4): the deck (an area model), its sections and the controls. The math and checks live
// in deck.js; zones, timer, lives, scoring and the report come from the shared game shell.
//
// Problem kinds: deck (type each section's area, then maybe simplify), choice, select (tap every twin).
import {
  ZONES, genZone, genBackup, workedSolution, checkExpand, checkSimplify, checkChoice, checkSelect, termText, exprText, fmt,
} from './deck.js';
import { hubAudio } from '../../../../shared/audio.js';
import { createGame } from '../../../../shared/game/gameShell.js';

const SKILL_TIPS = {
  first_term_only: 'The number outside multiplies EVERY term inside the parentheses.',
  sign_error: 'Negative × positive is negative; negative × negative is positive.',
  dropped_subtraction: 'A subtracted term stays subtracted when you expand.',
  decimal_slip: 'Place the decimal point carefully when you multiply.',
  added_not_multiplied: 'Area is width times length: multiply, do not add.',
  expanded_tail: 'Only the terms INSIDE the parentheses are multiplied.',
  combine_unlike: 'After expanding, combine only like terms.',
  lost_negative: 'Each term keeps its own sign when you combine.',
  product_as_sum: 'A letter times a letter is written side by side: x · y = xy.',
  whole_not_part: 'In an area model, each term of the expanded form is one section.',
  missed_twin: 'An expanded form is equivalent even before it is simplified.',
  calc: 'Multiply the width by each section, one at a time.',
};

const shell = createGame({
  zones: ZONES, makeZone: genZone, makeBackup: genBackup, workedSolution, showProblem,
  seconds: [50, 75, 65, 55, 85],                       // seconds until the mist covers the deck, per zone
  meterFloor: 8, wrongBump: 28, rightRelief: 25, pauseOnBanner: true,
  lifeLostText: (left) => (left > 0 ? 'A PLANK SNAPPED!' : 'LOST IN THE MIST!'),
  bossHitText: 'DECK BUILT!', winDelay: () => 1700,
  skillTips: SKILL_TIPS, perfectText: 'No mistakes to sharpen. Master deck builder!',
  onKey, testName: '__deck',
});
const { G, UI, $, win, miss, showFeedback } = shell;
Object.assign(G, { phase: 'expand', vals: [], simple: {}, tried: [], picked: new Set(), done: false, bad: null });

/* ================================================================== */
/* Drawing: the deck                                                   */
/* ================================================================== */
const K = '#1d1433';
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round"`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const FONT = 'font-family="Nunito, system-ui, sans-serif" font-weight="900"';
const MONO = 'font-family="ui-monospace, \'Courier New\', monospace" font-weight="900"';
const text = (t, x, y, size, fill = K, anchor = 'middle', font = FONT) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${fill}" ${font}>${esc(t)}</text>`;

function backdrop() {
  return `<rect x="-300" y="-300" width="1400" height="1120" fill="#bfe9ff"/>
    <rect x="-300" y="-300" width="260" height="1120" fill="#7d8a99" ${O}/><rect x="-40" y="-300" width="70" height="1120" fill="#9fdcff"/>
    <path class="river-flow" d="M-20 -100 V800 M8 -60 V800" stroke="#fff" stroke-width="4" stroke-dasharray="12 18" fill="none"/>
    <rect x="-300" y="450" width="1400" height="400" fill="#57b56a"/><path d="M-300 450 H1100" stroke="${K}" stroke-width="3"/>`;
}
/** The deck: width `a` down the side, one section per term inside. shown[i]: the area written in section i ('' = empty). */
function deckSvg(p, shown, { built = [], bad = null } = {}) {
  const n = p.inside.length, cold = p.a < 0;
  const left = 150, top = 150, h = 190, gap = 8, wAll = p.tail ? 440 : 560, w = (wAll - gap * (n - 1)) / n;
  const plank = cold ? '#9fc4e8' : '#c98a4b', empty = '#fff4d6';
  const sections = p.inside.map((t, i) => {
    const x = left + i * (w + gap), done = built.includes(i);
    let planks = '';
    if (done) for (let y = top + 6; y < top + h - 6; y += 23) planks += `<rect x="${x + 5}" y="${y}" width="${w - 10}" height="19" rx="3" fill="${plank}" stroke="${K}" stroke-width="1.5"/>`;
    return `<g class="${done ? 'laid' : ''}">
      <rect x="${x}" y="${top}" width="${w}" height="${h}" rx="8" fill="${bad === i ? '#ffd9dc' : empty}" stroke="${bad === i ? '#e5484d' : K}" stroke-width="${bad === i ? 6 : 3}" ${done ? '' : 'stroke-dasharray="8 6"'}/>
      ${planks}
      ${text(`${t.c < 0 ? '−' : i ? '+' : ''} ${termText(Math.abs(t.c), t.v)}`.trim(), x + w / 2, top - 14, 22, K, 'middle', MONO)}
      <rect x="${x + w / 2 - 62}" y="${top + h / 2 - 24}" width="124" height="48" rx="10" fill="#fff" ${O}/>
      ${text(shown[i] ? `${shown[i]}${t.v}` : '?', x + w / 2, top + h / 2 + 9, 24, shown[i] ? K : '#a99a74', 'middle', MONO)}
    </g>`;
  }).join('');
  const tail = p.tail ? `<g><rect x="${left + wAll + 26}" y="${top + 40}" width="110" height="110" rx="10" fill="${bad === n ? '#ffd9dc' : '#efe2c4'}" stroke="${bad === n ? '#e5484d' : K}" stroke-width="3" stroke-dasharray="4 5"/>
      ${text('not on', left + wAll + 81, top + 64, 12, '#8f3f22')}${text('the deck', left + wAll + 81, top + 80, 12, '#8f3f22')}
      ${text(shown[n] || '?', left + wAll + 81, top + 122, 24, shown[n] ? K : '#a99a74', 'middle', MONO)}
      ${text(`${p.tail.c < 0 ? '−' : '+'} ${fmt(Math.abs(p.tail.c))}`, left + wAll + 81, top + 22, 22, K, 'middle', MONO)}</g>` : '';
  return `${text(p.show, 440, 70, p.show.length > 22 ? 24 : 32, K, 'middle', MONO)}
    <rect x="${left - 70}" y="${top + h / 2 - 28}" width="56" height="56" rx="10" fill="${cold ? '#3a8ef0' : '#ffd23f'}" ${O}/>
    ${text(p.aText, left - 42, top + h / 2 + 8, p.aText.length > 3 ? 15 : 22, cold ? '#fff' : K, 'middle', MONO)}
    ${text('width', left - 42, top + h / 2 + 46, 12, '#3b3049')}
    ${cold ? text('COLD DECK: a negative width flips every sign', 440, top + h + 32, 14, '#1f63c9') : ''}
    ${sections}${tail}`;
}
function draw() {
  const p = G.problem;
  let body;
  if (!p) body = deckSvg({ a: 5, aText: '5', inside: [{ c: 1, v: 'x' }, { c: 8, v: '' }], tail: null, show: '5(x + 8)' }, ['5', '40'], { built: [0, 1] });
  else if (p.kind === 'deck') {
    const shown = G.phase === 'expand' ? G.vals.map((v) => String(v || '').replace(/^-/, '−')) : [...p.expanded, ...(p.tail ? [p.tail] : [])].map((t) => fmt(t.c));
    const built = G.phase === 'expand' ? [] : p.inside.map((_, i) => i);
    body = deckSvg(p, shown, { built, bad: G.bad })
      + (G.phase !== 'expand' ? `<rect x="120" y="392" width="640" height="46" rx="12" fill="${G.done ? '#ffe680' : '#fff4d6'}" ${O}/>${text(G.done ? `= ${p.answerText}` : `= ${p.expandedText}`, 440, 423, 22, K, 'middle', MONO)}` : '');
  } else {
    const line2 = G.done ? `= ${p.answerText}` : p.type === 'gardener' ? 'the whole garden' : '= ?';
    body = `<rect x="150" y="150" width="580" height="170" rx="16" fill="#3b3049" ${O}/>${text(p.show, 440, 222, p.show.length > 22 ? 24 : 34, '#ffd23f', 'middle', MONO)}${text(line2, 440, 280, 22, G.done ? '#9be7b4' : '#c9b8ff', 'middle', MONO)}`;
    if (p.type === 'gardener') body += `<rect x="230" y="345" width="250" height="80" fill="#9be7b4" ${O}/><rect x="480" y="345" width="170" height="80" fill="${G.done ? '#ffd23f' : '#d9f7e3'}" ${O}/>
      ${text('x', 355, 340, 16)}${text(String(p.b), 565, 340, 16)}${text(String(p.a), 216, 392, 16)}${text('original', 355, 392, 14)}${text('extension', 565, 392, 14)}`;
  }
  UI.scene.innerHTML = backdrop() + body;
}

/* ================================================================== */
/* Problems and controls                                               */
/* ================================================================== */
const TAGS = { deck: 'BUILD THE DECK', varOut: 'LETTER PLANKS', gardener: "THE GARDENER'S ERROR", select: 'FIND EVERY TWIN' };
function showProblem(p, isBackup) {
  Object.assign(G, { phase: 'expand', vals: [], simple: {}, tried: [], picked: new Set(), done: false, bad: null });
  UI.taskTag.textContent = `${TAGS[p.type]}${isBackup ? ' · BACKUP' : ''}`;
  UI.prompt.innerHTML = p.prompt;
  renderControls();
  draw();
}
const focusFirst = () => { const el = [...UI.controls.querySelectorAll('input')].find((i) => !i.value) || UI.controls.querySelector('input'); if (el && UI.briefing.classList.contains('hidden')) el.focus({ preventScroll: true }); };
function renderControls() {
  const p = G.problem;
  if (p.kind === 'deck' && G.phase === 'expand') {
    const parts = [...p.inside, ...(p.tail ? [p.tail] : [])];
    UI.controls.innerHTML = `<div class="label px">AREA OF EACH SECTION = WIDTH × LENGTH</div>
      <div class="rule-row wrap">${parts.map((t, i) => `${i ? '<span>+</span>' : ''}<input id="s${i}" class="rbox" value="${esc(G.vals[i] || '')}" inputmode="decimal" maxlength="7" placeholder="?" autocomplete="off"><span>${esc(t.v)}</span>`).join('')}</div>
      <button type="button" id="checkBtn" class="apply px">LAY THE PLANKS (ENTER)</button>
      <div id="helpLine" class="help-line">A box can be negative: type -21 for − 21. <kbd>Tab</kbd> moves to the next box.</div>`;
    parts.forEach((_, i) => $(`s${i}`).addEventListener('input', (e) => { G.vals[i] = e.target.value; draw(); }));
    $('checkBtn').addEventListener('click', submitExpand);
    return focusFirst();
  }
  if (p.kind === 'deck') {
    UI.controls.innerHTML = `<div class="label px">NOW COMBINE LIKE TERMS</div>
      <div class="rule-row wrap">${p.simple.map((t, i) => `${i ? '<span>+</span>' : ''}<input id="m_${t.v || 'k'}" class="rbox" data-k="${t.v || 'k'}" value="${esc(G.simple[t.v || 'k'] || '')}" inputmode="decimal" maxlength="7" placeholder="?" autocomplete="off"><span>${esc(t.v)}</span>`).join('')}</div>
      <button type="button" id="checkBtn" class="apply px">SIMPLIFY (ENTER)</button>
      <div id="helpLine" class="help-line">Combine the like terms from the expanded form shown under the deck.</div>`;
    UI.controls.querySelectorAll('[data-k]').forEach((el) => el.addEventListener('input', () => { G.simple[el.dataset.k] = el.value; }));
    $('checkBtn').addEventListener('click', submitSimplify);
    return focusFirst();
  }
  if (p.kind === 'choice') {
    UI.controls.innerHTML = p.options.map((o, i) => `<button type="button" class="choice" data-choice="${i}" ${G.tried.includes(i) ? 'disabled' : ''}><b>${i + 1}</b><span class="mono">${esc(o.text)}</span></button>`).join('')
      + `<div class="help-line">Click an answer or press <kbd>1</kbd>–<kbd>${p.options.length}</kbd>.</div>`;
    UI.controls.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => choose(Number(b.dataset.choice))));
    return;
  }
  UI.controls.innerHTML = `<div class="label px">TAP EVERY TWIN, THEN CHECK</div>
    <div class="cards">${p.cards.map((c, i) => `<button type="button" class="tcard ${G.picked.has(i) ? 'on' : ''}" data-card="${i}"><b>${i + 1}</b>${esc(c.text)}</button>`).join('')}</div>
    <button type="button" id="checkBtn" class="apply px">CHECK (ENTER)</button>
    <div id="helpLine" class="help-line">Tap again to un-pick. Keys: <kbd>1</kbd>–<kbd>${p.cards.length}</kbd>, then <kbd>Enter</kbd>.</div>`;
  UI.controls.querySelectorAll('[data-card]').forEach((b) => b.addEventListener('click', () => toggle(Number(b.dataset.card))));
  $('checkBtn').addEventListener('click', submitSelect);
}

/* ================================================================== */
/* Answers                                                             */
/* ================================================================== */
function finish(res) { G.done = true; draw(); return win(res); }
function submitExpand() {
  const p = G.problem;
  if (G.locked || p.kind !== 'deck' || G.phase !== 'expand') return;
  const count = p.inside.length + (p.tail ? 1 : 0);
  const res = checkExpand(p, Array.from({ length: count }, (_, i) => G.vals[i] || ''));
  if (res.nudge) return nudge(res.message);
  if (!res.correct) {
    G.bad = res.section; draw();
    return miss(res, { lock: true, delay: 1900, retry: () => { G.bad = null; draw(); focusFirst(); } });
  }
  G.phase = 'simplify';
  if (res.done) return finish(res);
  hubAudio.playTone(660, 'triangle', 0.15, 0.08);          // planks laid; one more step
  renderControls(); draw();
  const h = $('helpLine'); if (h) h.textContent = res.message;
}
function submitSimplify() {
  const p = G.problem;
  if (G.locked || p.kind !== 'deck' || G.phase !== 'simplify') return;
  const res = checkSimplify(p, G.simple);
  if (res.nudge) return nudge(res.message);
  if (res.correct) return finish(res);
  miss(res, { lock: true, delay: 1900, retry: () => focusFirst() });
}
function choose(i) {
  const p = G.problem;
  if (G.locked || p.kind !== 'choice' || G.tried.includes(i)) return;
  const res = checkChoice(p, i);
  UI.controls.querySelector(`[data-choice="${i}"]`)?.classList.add(res.correct ? 'right' : 'wrong');
  if (res.correct) return finish(res);
  G.tried.push(i);
  miss(res, { lock: true, delay: 1800, retry: () => renderControls() });
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
function nudge(t) {
  const h = $('helpLine');
  if (h) h.innerHTML = `<span class="warn">${esc(t)}</span>`;
  else showFeedback(true, t);
  hubAudio.playTone(220, 'square', 0.12, 0.05);
}

function onKey(e) {
  const key = e.key, p = G.problem, n = Number(key);
  if (p.kind === 'deck') { if (key === 'Enter') { e.preventDefault(); if (G.phase === 'expand') submitExpand(); else submitSimplify(); } return; }
  if (p.kind === 'choice') { if (n >= 1 && n <= p.options.length) choose(n - 1); return; }
  if (n >= 1 && n <= p.cards.length) return toggle(n - 1);
  if (key === 'Enter') { e.preventDefault(); submitSelect(); }
}

void exprText;
draw();     // a sample deck waits behind the briefing
