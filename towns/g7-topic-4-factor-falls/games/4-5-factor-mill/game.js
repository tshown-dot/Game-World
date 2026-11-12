// Factor Mill (Grade 7, Lesson 4-5): the mill wheel, the deck run backward and the controls. The math and checks
// live in mill.js; zones, timer, lives, scoring and the report come from the shared game shell.
//
// Problem kinds: factor (pick the wheel = common factor, then type what is left inside), select, choice, num.
import {
  ZONES, genZone, genBackup, workedSolution, checkWheel, checkInside, checkSelect, checkChoice, checkNum, termText, fmt,
} from './mill.js';
import { hubAudio } from '../../../../shared/audio.js';
import { createGame } from '../../../../shared/game/gameShell.js';

const SKILL_TIPS = {
  not_greatest: 'A common factor works, but the GREATEST common factor factors it completely.',
  not_common: 'A common factor must divide EVERY term.',
  wrong_sign: 'An expression can be factored with a positive or a negative common factor.',
  forgot_to_divide: 'When you factor, divide EVERY term by the common factor.',
  sign_error: 'Dividing by a negative flips the sign of each term.',
  variable_left_inside: 'A variable that is factored out no longer appears inside.',
  dropped_variable: 'Every part of each term must be accounted for: distribute back to check.',
  missed_twin: 'Any common factor gives an equivalent expression.',
  not_the_error: 'Distribute a factored expression back to find where it differs.',
  calc: 'Check factoring by distributing back.',
};

const shell = createGame({
  zones: ZONES, makeZone: genZone, makeBackup: genBackup, workedSolution, showProblem,
  seconds: [50, 55, 55, 70, 75],                       // seconds until the millstone wears out, per zone
  meterFloor: 8, wrongBump: 28, rightRelief: 25, pauseOnBanner: true,
  lifeLostText: (left) => (left > 0 ? 'A GEAR SLIPPED!' : 'THE MILL STOPPED!'),
  bossHitText: 'WHEEL TURNING!', winDelay: () => 1700,
  skillTips: SKILL_TIPS, perfectText: 'No mistakes to sharpen. Master miller!',
  onKey, testName: '__mill',
});
const { G, UI, $, win, miss, showFeedback } = shell;
Object.assign(G, { phase: 'wheel', wheel: null, vals: [], tried: [], picked: new Set(), done: false, bad: null, badWheel: null });

/* ================================================================== */
/* Drawing: the mill wheel and the deck, run backward                  */
/* ================================================================== */
const K = '#1d1433';
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round"`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const FONT = 'font-family="Nunito, system-ui, sans-serif" font-weight="900"';
const MONO = 'font-family="ui-monospace, \'Courier New\', monospace" font-weight="900"';
const text = (t, x, y, size, fill = K, anchor = 'middle', font = FONT) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${fill}" ${font}>${esc(t)}</text>`;

function backdrop() {
  return `<rect x="-300" y="-300" width="1400" height="1120" fill="#cfeaff"/>
    <rect x="-300" y="450" width="1400" height="400" fill="#3a8ef0"/><path d="M-300 450 H1100" stroke="${K}" stroke-width="3"/>
    <path class="river-flow" d="M-300 480 H1100 M-300 505 H1100" stroke="#bfe2ff" stroke-width="4" stroke-dasharray="14 20" fill="none"/>`;
}
/** The mill wheel shows the factor being pulled out ('?' until one is chosen). */
function wheel(label, spinning, bad) {
  let spokes = '';
  for (let i = 0; i < 8; i++) spokes += `<path d="M0 0 L${Math.cos(i * Math.PI / 4) * 62} ${Math.sin(i * Math.PI / 4) * 62}" stroke="${K}" stroke-width="4"/><rect x="-10" y="-74" width="20" height="16" fill="#8a5a2b" ${O} transform="rotate(${i * 45})"/>`;
  return `<g transform="translate(96 250)"><g class="${spinning ? 'spin' : ''}"><circle r="62" fill="#c98a4b" ${O}/>${spokes}</g>
    <circle r="34" fill="${bad ? '#ffadb3' : '#ffd23f'}" ${O}/>${text(label, 0, 9, label.length > 2 ? 20 : 26, K, 'middle', MONO)}${text('common factor', 0, 104, 12, '#3b3049')}</g>`;
}
/** Sections: each term's area on its planks, with the length (what is left) written above once it is known. */
function deck(p, lengths, { bad = null, solid = false } = {}) {
  const n = p.terms.length, left = 200, top = 170, h = 170, gap = 8, w = (560 - gap * (n - 1)) / n;
  return p.terms.map((t, i) => {
    const x = left + i * (w + gap);
    let planks = '';
    for (let y = top + 6; y < top + h - 6; y += 23) planks += `<rect x="${x + 5}" y="${y}" width="${w - 10}" height="19" rx="3" fill="#c98a4b" stroke="${K}" stroke-width="1.5" opacity="0.55"/>`;
    return `<g><rect x="${x}" y="${top}" width="${w}" height="${h}" rx="8" fill="#fff4d6" stroke="${bad === i ? '#e5484d' : solid ? '#2fbf71' : K}" stroke-width="${bad === i || solid ? 6 : 3}"/>${planks}
      <rect x="${x + w / 2 - 60}" y="${top + h / 2 - 22}" width="120" height="44" rx="10" fill="#fff" ${O}/>
      ${text(`${t.c < 0 ? '−' : i ? '+' : ''}${i || t.c < 0 ? ' ' : ''}${termText(Math.abs(t.c), t.v)}`, x + w / 2, top + h / 2 + 8, 22, K, 'middle', MONO)}
      <rect x="${x + w / 2 - 54}" y="${top - 52}" width="108" height="40" rx="8" fill="${lengths[i] ? '#ffe680' : '#efe2c4'}" stroke="${K}" stroke-width="2" stroke-dasharray="${lengths[i] ? '0' : '5 5'}"/>
      ${text(lengths[i] ? `${lengths[i]}${t.v}` : '?', x + w / 2, top - 25, 20, lengths[i] ? K : '#a99a74', 'middle', MONO)}</g>`;
  }).join('');
}
function draw() {
  const p = G.problem;
  let body;
  if (!p) {
    body = text('4x + 20  =  4(x + 5)', 440, 80, 30, K, 'middle', MONO) + wheel('4', true) + deck({ terms: [{ c: 4, v: 'x' }, { c: 20, v: '' }] }, ['1', '5'], { solid: true });
  } else if (p.kind === 'factor') {
    const lengths = G.done ? p.inside.map((t) => fmt(t.c)) : G.phase === 'inside' ? G.vals.map((v) => String(v || '').replace(/^-/, '−')) : [];
    const title = G.done ? `${p.show}  =  ${p.answerText}` : G.phase === 'inside' ? `${p.show}  =  ${fmt(G.wheel)}( ? )` : p.show;
    body = text(title, 440, 80, title.length > 30 ? 20 : title.length > 22 ? 24 : 30, K, 'middle', MONO)
      + wheel(G.wheel === null ? '?' : fmt(G.wheel), G.phase === 'inside' || G.done, G.badWheel !== null)
      + deck(p, lengths, { bad: G.bad, solid: G.done })
      + text(G.phase === 'wheel' ? 'These are the AREAS. What is the greatest width that fits every section?' : 'Width × length = area. What LENGTH is left for each section?', 480, 386, 14, '#3b3049');
  } else {
    const line2 = G.done ? p.answerText : p.type === 'susan' ? p.hers : p.type === 'kits' ? 'identical kits' : '= ?';
    body = wheel(G.done && p.type === 'kits' ? String(p.answer) : '?', G.done)
      + `<rect x="200" y="150" width="560" height="170" rx="16" fill="#3b3049" ${O}/>${text(p.show, 480, 222, p.show.length > 20 ? 26 : 34, '#ffd23f', 'middle', MONO)}${text(line2, 480, 282, line2.length > 30 ? 16 : 22, G.done ? '#9be7b4' : '#c9b8ff', 'middle', MONO)}`;
  }
  UI.scene.innerHTML = backdrop() + body;
}

/* ================================================================== */
/* Problems and controls                                               */
/* ================================================================== */
const TAGS = { factor: 'FACTOR IT', select: 'FIND EVERY EQUIVALENT', fully: 'FULLY FACTORED?', susan: "SUSAN'S ERROR", friend: "THE FRIEND'S ERROR", ryan: "RYAN'S CLAIM", kits: 'SUPPLY KITS' };
function showProblem(p, isBackup) {
  Object.assign(G, { phase: 'wheel', wheel: null, vals: [], tried: [], picked: new Set(), done: false, bad: null, badWheel: null });
  UI.taskTag.textContent = `${TAGS[p.type]}${isBackup ? ' · BACKUP' : ''}`;
  UI.prompt.innerHTML = p.prompt;
  renderControls();
  draw();
}
const focusFirst = () => { const el = [...UI.controls.querySelectorAll('input')].find((i) => !i.value) || UI.controls.querySelector('input'); if (el && UI.briefing.classList.contains('hidden')) el.focus({ preventScroll: true }); };
function renderControls() {
  const p = G.problem;
  if (p.kind === 'factor' && G.phase === 'wheel') {
    UI.controls.innerHTML = `<div class="label px">1. SET THE WHEEL: THE ${p.negative ? 'NEGATIVE ' : ''}COMMON FACTOR</div>
      <div class="wheels">${p.wheels.map((w, i) => `<button type="button" class="wheel-btn" data-wheel="${i}" ${G.tried.includes(i) ? 'disabled' : ''}><b>${i + 1}</b>${fmt(w)}</button>`).join('')}</div>
      <div id="helpLine" class="help-line">Which one divides EVERY term, and is the greatest? Keys: <kbd>1</kbd>–<kbd>4</kbd>.</div>`;
    UI.controls.querySelectorAll('[data-wheel]').forEach((b) => b.addEventListener('click', () => pickWheel(Number(b.dataset.wheel))));
    return;
  }
  if (p.kind === 'factor') {
    UI.controls.innerHTML = `<div class="label px">2. WHAT IS LEFT INSIDE? DIVIDE EACH TERM BY ${fmt(p.factor)}</div>
      <div class="rule-row wrap"><span>${fmt(p.factor)}(</span>${p.terms.map((t, i) => `${i ? '<span>+</span>' : ''}<input id="s${i}" class="rbox" value="${esc(G.vals[i] || '')}" inputmode="numeric" maxlength="5" placeholder="?" autocomplete="off"><span>${esc(t.v)}</span>`).join('')}<span>)</span></div>
      <button type="button" id="checkBtn" class="apply px">TURN THE WHEEL (ENTER)</button>
      <div id="helpLine" class="help-line">A box can be negative: type -3 for − 3. <kbd>Tab</kbd> moves to the next box.</div>`;
    p.terms.forEach((_, i) => $(`s${i}`).addEventListener('input', (e) => { G.vals[i] = e.target.value; draw(); }));
    $('checkBtn').addEventListener('click', submitInside);
    return focusFirst();
  }
  if (p.kind === 'choice') {
    UI.controls.innerHTML = p.options.map((o, i) => `<button type="button" class="choice" data-choice="${i}" ${G.tried.includes(i) ? 'disabled' : ''}><b>${i + 1}</b><span class="${/\(/.test(o.text) && !/:/.test(o.text) ? 'mono' : ''}">${esc(o.text)}</span></button>`).join('')
      + `<div class="help-line">Click an answer or press <kbd>1</kbd>–<kbd>${p.options.length}</kbd>.</div>`;
    UI.controls.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => choose(Number(b.dataset.choice))));
    return;
  }
  if (p.kind === 'select') {
    UI.controls.innerHTML = `<div class="label px">TAP EVERY EQUIVALENT ONE, THEN CHECK</div>
      <div class="cards">${p.cards.map((c, i) => `<button type="button" class="tcard ${G.picked.has(i) ? 'on' : ''}" data-card="${i}"><b>${i + 1}</b>${esc(c.text)}</button>`).join('')}</div>
      <button type="button" id="checkBtn" class="apply px">CHECK (ENTER)</button>
      <div id="helpLine" class="help-line">Tap again to un-pick. Keys: <kbd>1</kbd>–<kbd>${p.cards.length}</kbd>, then <kbd>Enter</kbd>.</div>`;
    UI.controls.querySelectorAll('[data-card]').forEach((b) => b.addEventListener('click', () => toggle(Number(b.dataset.card))));
    $('checkBtn').addEventListener('click', submitSelect);
    return;
  }
  UI.controls.innerHTML = `<label class="rule-row">${esc(p.label)} = <input id="ans" class="rbox" inputmode="numeric" maxlength="4" placeholder="?" autocomplete="off"></label>
    <button type="button" id="checkBtn" class="apply px">PACK THE KITS (ENTER)</button>
    <div id="helpLine" class="help-line">Type a whole number and press <kbd>Enter</kbd>.</div>`;
  $('checkBtn').addEventListener('click', submitNum);
  focusFirst();
}

/* ================================================================== */
/* Answers                                                             */
/* ================================================================== */
function finish(res) { G.done = true; draw(); return win(res); }
function pickWheel(i) {
  const p = G.problem;
  if (G.locked || p.kind !== 'factor' || G.phase !== 'wheel' || G.tried.includes(i)) return;
  const w = p.wheels[i], res = checkWheel(p, w);
  G.wheel = w;
  if (!res.correct) {
    G.badWheel = i; G.tried.push(i); draw();
    return miss(res, { lock: true, delay: 1800, retry: () => { G.wheel = null; G.badWheel = null; renderControls(); draw(); } });
  }
  G.phase = 'inside'; G.tried = [];
  hubAudio.playTone(560, 'triangle', 0.14, 0.08);
  renderControls(); draw();
}
function submitInside() {
  const p = G.problem;
  if (G.locked || p.kind !== 'factor' || G.phase !== 'inside') return;
  const res = checkInside(p, p.terms.map((_, i) => G.vals[i] || ''));
  if (res.nudge) return nudge(res.message);
  if (res.correct) return finish(res);
  G.bad = res.section; draw();
  miss(res, { lock: true, delay: 1900, retry: () => { G.bad = null; draw(); focusFirst(); } });
}
function choose(i) {
  const p = G.problem;
  if (G.locked || p.kind !== 'choice' || G.tried.includes(i)) return;
  const res = checkChoice(p, i);
  UI.controls.querySelector(`[data-choice="${i}"]`)?.classList.add(res.correct ? 'right' : 'wrong');
  if (res.correct) return finish(res);
  G.tried.push(i);
  miss(res, { lock: true, delay: 1900, retry: () => renderControls() });
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
function submitNum() {
  const p = G.problem;
  if (G.locked || p.kind !== 'num') return;
  const res = checkNum(p, $('ans').value);
  if (res.nudge) return nudge(res.message);
  if (res.correct) return finish(res);
  miss(res, { lock: true, delay: 1800, retry: () => { $('ans').value = ''; focusFirst(); } });
}
function nudge(t) {
  const h = $('helpLine');
  if (h) h.innerHTML = `<span class="warn">${esc(t)}</span>`;
  else showFeedback(true, t);
  hubAudio.playTone(220, 'square', 0.12, 0.05);
}

function onKey(e) {
  const key = e.key, p = G.problem, n = Number(key);
  if (p.kind === 'factor' && G.phase === 'wheel') { if (n >= 1 && n <= p.wheels.length) pickWheel(n - 1); return; }
  if (p.kind === 'factor') { if (key === 'Enter') { e.preventDefault(); submitInside(); } return; }
  if (p.kind === 'choice') { if (n >= 1 && n <= p.options.length) choose(n - 1); return; }
  if (p.kind === 'select') { if (n >= 1 && n <= p.cards.length) return toggle(n - 1); if (key === 'Enter') { e.preventDefault(); submitSelect(); } return; }
  if (key === 'Enter') { e.preventDefault(); submitNum(); }
}

draw();     // a sample mill waits behind the briefing
