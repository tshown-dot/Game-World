// Golem Fort (Topic 4 boss): the Equation Golem, the stone tablet and the controls. The math and checks live in
// golem.js; zones, timer, lives, scoring and the report come from the shared game shell (shared/game/gameShell.js).
//
// Each zone is one part of the golem (feet, arms, shoulders, shield, core). Right answers knock stones off it;
// a part that is cleared stays broken. Answer kinds: num (type a number), choice, graph (number line), rule (shape boxes).
import {
  ZONES, genZone, genBackup, workedSolution, checkNum, checkChoice, checkGraph, checkRule, needs, fmt, run, ruleText, parseNumber,
} from './golem.js';
import { hubAudio } from '../../../../shared/audio.js';
import { createGame } from '../../../../shared/game/gameShell.js';

const SKILL_TIPS = {
  same_operation: 'To get the letter alone, use the OPPOSITE operation on both sides.',
  test_it: 'Check a solution by substituting it back into the equation.',
  one_side: 'Whatever you do to one side of an equation, do to the other side too.',
  wrong_number: 'Undo the number that is attached to the letter.',
  check_it: 'Substitute your answer back in to check it.',
  equal_or_not: '≤ and ≥ include the number itself; < and > do not.',
  direction: 'Read inequality words carefully: "at least" is ≥, "no more than" is ≤.',
  flipped_sign: 'Adding, subtracting or dividing by a positive number keeps the inequality sign the same.',
  boundary: 'The boundary of the graph is the number in the inequality.',
  open_closed: 'Closed circle for ≤ and ≥; open circle for < and >.',
  shade_direction: 'Greater than: shade right. Less than: shade left.',
  swapped_variables: 'The dependent variable changes BECAUSE of the independent one.',
  add_vs_times: 'Compare across each row: outputs can be a multiple of the inputs.',
  forgot_start: 'Two-step rules have a starting amount: undo it first.',
  some_rows: 'A rule must fit every row of the table.',
  swapped_numbers: 'The rate goes with the variable; the start amount stands alone.',
  one_step_only: 'Two-step equations need two undo steps: subtract, then divide.',
};

const shell = createGame({
  zones: ZONES, makeZone: genZone, makeBackup: genBackup, workedSolution, showProblem,
  seconds: [45, 55, 60, 55, 80],                       // seconds until the golem's fist lands, per part
  meterFloor: 8, wrongBump: 30, rightRelief: 25, pauseOnBanner: true,
  lifeLostText: (left) => (left > 0 ? 'THE GOLEM STRIKES!' : 'KNOCKED OUT!'),
  onLifeLost: () => anim('punch', 600),
  bossHitText: 'GOLEM DEFEATED!', winDelay: () => 1700,
  skillTips: SKILL_TIPS, perfectText: 'Not a scratch. Equation Valley is yours!',
  onKey, testName: '__golem',
});
const { G, UI, $, win, miss, showFeedback } = shell;
const SHAPES = ['times', 'plus', 'line'];
Object.assign(G, { hits: 0, lastZone: -1, answer: '', tried: [], graph: { b: null, circle: null, dir: null }, form: null, vals: { m: '', b: '' }, lights: null, done: false });

/* ================================================================== */
/* Drawing: the golem and the stone tablet                             */
/* ================================================================== */
const K = '#1d1433';
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round"`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const FONT = 'font-family="Nunito, system-ui, sans-serif" font-weight="900"';
const MONO = 'font-family="ui-monospace, \'Courier New\', monospace" font-weight="900"';
const text = (t, x, y, size, fill = K, anchor = 'middle', font = FONT) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${fill}" ${font}>${esc(t)}</text>`;
function wrap(t, x, y, n, size, fill = K) {
  const out = [];
  for (const w of String(t).split(' ')) { const last = out[out.length - 1]; if (last && `${last} ${w}`.length <= n) out[out.length - 1] = `${last} ${w}`; else out.push(w); }
  const top = y - ((out.length - 1) * (size + 4)) / 2;
  return out.map((l, i) => text(l, x, top + i * (size + 4), size, fill)).join('');
}
const STONE = '#9c8b7a', DARK = '#6b5a4a';
/** One golem part. state: 'broken' (cleared), 'target' (this zone) or 'whole'. */
function part(state, svg) {
  if (state === 'broken') return `<g class="broken" opacity="0.35" transform="translate(0 14)">${svg(DARK)}</g>`;
  return `<g class="${state === 'target' ? 'target' : ''}">${svg(STONE)}</g>`;
}
function golem() {
  const z = G.zone ?? 0;
  const st = (i) => (i < z ? 'broken' : i === z ? 'target' : 'whole');
  const cracks = Array.from({ length: Math.min(G.hits, 5) }, (_, i) => `<path d="M${170 + i * 18} ${260 + (i % 2) * 40} l10 14 l-8 10 l12 12" stroke="${K}" stroke-width="3" fill="none"/>`).join('');
  return `<g id="golem">
    <rect x="-300" y="430" width="1100" height="400" fill="#8a4a2a"/><path d="M-300 430 H800" stroke="${K}" stroke-width="3"/>
    <path d="M10 430 V150 L60 110 L110 150 V430 Z M310 430 V150 L360 110 L410 150 V430 Z" fill="#a9512b" ${O}/>
    ${part(st(0), (c) => `<rect x="130" y="400" width="60" height="40" rx="8" fill="${c}" ${O}/><rect x="230" y="400" width="60" height="40" rx="8" fill="${c}" ${O}/>`)}
    <rect x="145" y="330" width="40" height="76" fill="${DARK}" ${O}/><rect x="235" y="330" width="40" height="76" fill="${DARK}" ${O}/>
    <rect x="140" y="190" width="140" height="150" rx="14" fill="${STONE}" ${O}/>
    ${part(st(4), (c) => `<circle class="core" cx="210" cy="265" r="30" fill="${c === STONE ? '#ffd23f' : c}" ${O}/><path d="M210 245 V285 M190 265 H230" stroke="${K}" stroke-width="3"/>`)}
    ${cracks}
    ${part(st(2), (c) => `<rect x="96" y="180" width="56" height="44" rx="10" fill="${c}" ${O}/><rect x="268" y="180" width="56" height="44" rx="10" fill="${c}" ${O}/>`)}
    ${part(st(1), (c) => `<g class="arm-r"><rect x="284" y="222" width="38" height="120" rx="10" fill="${c}" ${O}/><rect x="278" y="336" width="50" height="40" rx="10" fill="${c}" ${O}/></g><rect x="98" y="222" width="38" height="120" rx="10" fill="${c}" ${O}/>`)}
    ${part(st(3), (c) => `<circle cx="104" cy="300" r="58" fill="${c === STONE ? '#c9b8ff' : c}" ${O}/><text x="104" y="312" text-anchor="middle" font-size="34" fill="${K}" ${MONO}>≤</text>`)}
    <rect x="170" y="120" width="80" height="72" rx="12" fill="${STONE}" ${O}/>
    <rect x="186" y="146" width="16" height="10" fill="${z >= 5 ? DARK : '#e5484d'}"/><rect x="218" y="146" width="16" height="10" fill="${z >= 5 ? DARK : '#e5484d'}"/>
    <path d="M192 172 H228" stroke="${K}" stroke-width="4"/>
    ${text(ZONES[Math.min(z, 4)].name.replace('The ', '').toUpperCase(), 210, 476, 14, '#fff4d6')}
  </g>`;
}
/** The stone tablet on the right: what the problem is about. */
function tablet() {
  const p = G.problem;
  let inner = '';
  if (p.kind === 'graph') inner = numberLine(p);
  else if (p.kind === 'rule' || p.type === 'dilemma1' || p.type === 'dilemma2') inner = table(p);
  else if (p.type === 'variables') inner = wrap('Which one changes BECAUSE of the other?', 602, 230, 22, 22, '#fff4d6');
  else if (p.eq) inner = text(p.eq, 602, 250, p.eq.length > 16 ? 26 : 34, '#ffd23f', 'middle', MONO);
  else inner = wrap(p.type === 'story' ? 'Write the equation, then solve it.' : 'Choose wisely.', 602, 250, 22, 22, '#fff4d6');
  return `<rect x="420" y="40" width="364" height="380" rx="18" fill="#3b3049" ${O}/>
    ${text(`LESSON ${p.lesson}`, 440, 70, 13, '#c9b8ff', 'start')}${inner}`;
}
function table(p) {
  const L = G.lights || [];
  const rows = p.rows.map((r, i) => {
    const fill = L[i] === 'ok' ? '#9be7b4' : L[i] === 'bad' ? '#ffadb3' : '#efe2c4';
    return `<rect x="470" y="${130 + i * 52}" width="264" height="42" rx="8" fill="${fill}" stroke="${K}" stroke-width="2"/>
      ${text(fmt(r.x), 540, 159 + i * 52, 22, K, 'middle', MONO)}${text('➜', 602, 159 + i * 52, 18, '#8f3f22')}${text(fmt(r.y), 665, 159 + i * 52, 22, K, 'middle', MONO)}`;
  }).join('');
  return `${text(p.X, 540, 115, 18, '#ffd23f', 'middle', MONO)}${text(p.Y, 665, 115, 18, '#ffd23f', 'middle', MONO)}${rows}
    ${G.done && p.rule ? text(ruleText(p.rule, p.X, p.Y), 602, 400, 24, '#9be7b4', 'middle', MONO) : ''}`;
}
const NL = { x0: 452, x1: 752, y: 260 };
const tickX = (p, v) => NL.x0 + ((v - p.lo) / (p.hi - p.lo)) * (NL.x1 - NL.x0);
function numberLine(p) {
  const g = G.graph;
  let ticks = '';
  for (let v = p.lo; v <= p.hi; v++) {
    ticks += `<g class="tick" data-tick="${v}" style="cursor:pointer"><rect x="${tickX(p, v) - 14}" y="${NL.y - 40}" width="28" height="90" fill="transparent"/>
      <path d="M${tickX(p, v)} ${NL.y - 10} V${NL.y + 10}" stroke="#fff4d6" stroke-width="3"/>${text(fmt(v), tickX(p, v), NL.y + 34, 15, '#fff4d6')}</g>`;
  }
  let mark = '';
  if (g.b !== null) {
    const x = tickX(p, g.b);
    if (g.dir) mark += `<path d="M${x} ${NL.y} H${g.dir === 'right' ? NL.x1 + 18 : NL.x0 - 18}" stroke="#ffd23f" stroke-width="9" stroke-linecap="round"/>
      <path d="M${g.dir === 'right' ? NL.x1 + 22 : NL.x0 - 22} ${NL.y} l${g.dir === 'right' ? -16 : 16} -12 v24 Z" fill="#ffd23f"/>`;
    mark += `<circle cx="${x}" cy="${NL.y}" r="12" fill="${g.circle === 'closed' ? '#ffd23f' : '#3b3049'}" stroke="#ffd23f" stroke-width="4"/>`;
    if (!g.circle) mark += `<circle cx="${x}" cy="${NL.y}" r="17" fill="none" stroke="#fff4d6" stroke-width="2" stroke-dasharray="4 4"/>`;
  }
  return `${text(p.answerText, 602, 150, 34, '#ffd23f', 'middle', MONO)}
    <path d="M${NL.x0 - 24} ${NL.y} H${NL.x1 + 24}" stroke="#fff4d6" stroke-width="3"/>${ticks}${mark}`;
}
function draw() {
  UI.scene.innerHTML = `<rect x="-300" y="-300" width="1400" height="1120" fill="#e58a4e"/>${golem()}${G.problem ? tablet() : ''}`;
  UI.scene.querySelectorAll('[data-tick]').forEach((t) => t.addEventListener('click', () => setBoundary(Number(t.dataset.tick))));
}
function anim(cls, ms) {
  const g = $('golem');
  if (!g) return;
  g.classList.remove(cls); void g.getBoundingClientRect(); g.classList.add(cls);
  setTimeout(() => g.classList.remove(cls), ms);
}

/* ================================================================== */
/* Problems and controls                                               */
/* ================================================================== */
const TAGS = { solution: 'FIND THE SOLUTION', balance: 'KEEP IT BALANCED', story: 'WRITE AND SOLVE', solve: 'SOLVE IT', rational: 'FRACTIONS AND DECIMALS', writeIneq: 'WRITE THE INEQUALITY', graph: 'GRAPH THE INEQUALITY', solveIneq: 'SOLVE THE INEQUALITY', variables: 'WHICH VARIABLE?', tableRule: 'CRACK THE TABLE', dilemma1: 'FINAL DILEMMA 1 OF 2', dilemma2: 'FINAL DILEMMA 2 OF 2' };
function showProblem(p, isBackup) {
  if (G.zone !== G.lastZone) { G.hits = 0; G.lastZone = G.zone; }
  Object.assign(G, { tried: [], graph: { b: null, circle: null, dir: null }, form: null, vals: { m: '', b: '' }, lights: null, done: false });
  UI.taskTag.textContent = `${TAGS[p.type]}${isBackup ? ' · BACKUP' : ''}`;
  UI.prompt.innerHTML = p.prompt;
  renderControls();
  draw();
}
const box = (k) => `<input id="r_${k}" class="rbox" value="${esc(G.vals[k])}" inputmode="decimal" maxlength="7" placeholder="?" autocomplete="off">`;
const shapeHtml = (form, live = false) => {
  const b = (k) => (live ? box(k) : '<span class="sq">□</span>');
  return { times: `y = ${b('m')}x`, plus: `y = x + ${b('b')}`, line: `y = ${b('m')}x + ${b('b')}` }[form];
};
function renderControls() {
  const p = G.problem;
  if (p.kind === 'num') {
    UI.controls.innerHTML = `<label class="rule-row">${esc(p.label)} = <input id="ans" class="rbox wide" inputmode="decimal" maxlength="9" placeholder="?" autocomplete="off"></label>
      <button type="button" id="checkBtn" class="apply px">STRIKE! (ENTER)</button>
      <div id="helpLine" class="help-line">Type a number. Fractions (5/4 or 1 1/4) and decimals are fine.</div>`;
    $('checkBtn').addEventListener('click', submitNum);
    return focusFirst();
  }
  if (p.kind === 'choice') {
    UI.controls.innerHTML = p.options.map((o, i) => `<button type="button" class="choice" data-choice="${i}" ${G.tried.includes(i) ? 'disabled' : ''}><b>${i + 1}</b><span class="${/[=<>≤≥]/.test(o.text) ? 'mono' : ''}">${esc(o.text)}</span></button>`).join('')
      + `<div class="help-line">Click an answer or press <kbd>1</kbd>–<kbd>${p.options.length}</kbd>.</div>`;
    UI.controls.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => choose(Number(b.dataset.choice))));
    return;
  }
  if (p.kind === 'graph') {
    const g = G.graph;
    UI.controls.innerHTML = `
      <div class="label px">1. TAP THE BOUNDARY ON THE NUMBER LINE (← →)</div>
      <div class="label px">2. CIRCLE</div>
      <div class="pair"><button type="button" class="${g.circle === 'open' ? 'on' : ''}" data-circle="open"><b>1</b>○ OPEN</button><button type="button" class="${g.circle === 'closed' ? 'on' : ''}" data-circle="closed"><b>2</b>● CLOSED</button></div>
      <div class="label px">3. SHADE</div>
      <div class="pair"><button type="button" class="${g.dir === 'left' ? 'on' : ''}" data-dir="left"><b>3</b>◀ LEFT</button><button type="button" class="${g.dir === 'right' ? 'on' : ''}" data-dir="right"><b>4</b>RIGHT ▶</button></div>
      <button type="button" id="checkBtn" class="apply px">STRIKE! (ENTER)</button>
      <div id="helpLine" class="help-line">Boundary: ${g.b === null ? 'not set yet' : fmt(g.b)}.</div>`;
    UI.controls.querySelectorAll('[data-circle]').forEach((b) => b.addEventListener('click', () => setGraph({ circle: b.dataset.circle })));
    UI.controls.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () => setGraph({ dir: b.dataset.dir })));
    $('checkBtn').addEventListener('click', submitGraph);
    return;
  }
  UI.controls.innerHTML = `
    <div class="label px">1. PICK THE RULE'S SHAPE (↑ ↓)</div>
    <div class="shapes">${SHAPES.map((f) => `<button type="button" class="shape ${G.form === f ? 'on' : ''}" data-shape="${f}">${shapeHtml(f)}</button>`).join('')}</div>
    <div class="label px">2. FILL IN THE NUMBERS</div>
    <div class="rule-row">${G.form ? shapeHtml(G.form, true) : '<span class="empty">pick a shape first</span>'}</div>
    <button type="button" id="checkBtn" class="apply px">STRIKE! (ENTER)</button>
    <div id="helpLine" class="help-line">The tablet tests your rule on every row.</div>`;
  UI.controls.querySelectorAll('[data-shape]').forEach((b) => b.addEventListener('click', () => pickShape(b.dataset.shape)));
  UI.controls.querySelectorAll('.rbox').forEach((el) => el.addEventListener('input', () => { G.vals[el.id.slice(2)] = el.value; }));
  $('checkBtn').addEventListener('click', submitRule);
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
  hubAudio.playTone(140, 'square', 0.18, 0.08);
  return win(res);
}
function strike(res, retry, delay = 1700) {
  anim('punch', 600);
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
function setBoundary(v) {
  const p = G.problem;
  if (G.locked || p.kind !== 'graph') return;
  G.graph.b = Math.max(p.lo, Math.min(p.hi, v));
  hubAudio.playSelect();
  renderControls(); draw();
}
function setGraph(change) {
  if (G.locked || G.problem.kind !== 'graph') return;
  Object.assign(G.graph, change);
  hubAudio.playSelect();
  renderControls(); draw();
}
function submitGraph() {
  const p = G.problem;
  if (G.locked || p.kind !== 'graph') return;
  const res = checkGraph(p, G.graph);
  if (res.nudge) return nudge(res.message);
  if (res.correct) return hit(res);
  strike(res, () => { renderControls(); draw(); });
}
function pickShape(f) {
  if (G.locked) return;
  G.form = f; G.lights = null;
  hubAudio.playSelect();
  renderControls(); draw();
}
function submitRule() {
  const p = G.problem;
  if (G.locked || p.kind !== 'rule') return;
  if (!G.form) return nudge('Pick the rule\'s shape first.');
  const guess = { form: G.form };
  for (const k of needs(G.form)) { const v = parseNumber(G.vals[k]); if (v !== null) guess[k] = v; }
  const res = checkRule(p, guess);
  if (res.nudge) return nudge(res.message);
  G.lights = res.rows.map((r) => (r ? 'ok' : 'bad'));
  if (res.correct) return hit(res);
  draw();
  strike(res, () => { G.lights = null; renderControls(); draw(); });
}
function nudge(t) {
  const h = $('helpLine');
  if (h) h.innerHTML = `<span class="warn">${esc(t)}</span>`;
  else showFeedback(true, t);
  hubAudio.playTone(220, 'square', 0.12, 0.05);
}

/* ================================================================== */
/* Keys and start-up                                                   */
/* ================================================================== */
function onKey(e) {
  const key = e.key, p = G.problem, n = Number(key);
  if (p.kind === 'num') { if (key === 'Enter') { e.preventDefault(); submitNum(); } return; }
  if (p.kind === 'choice') { if (n >= 1 && n <= p.options.length) choose(n - 1); return; }
  if (p.kind === 'graph') {
    if (key === 'ArrowLeft' || key === 'ArrowRight') { e.preventDefault(); const b = G.graph.b === null ? Math.round((p.lo + p.hi) / 2) : G.graph.b + (key === 'ArrowRight' ? 1 : -1); return setBoundary(b); }
    if (key === '1' || key === '2') return setGraph({ circle: key === '1' ? 'open' : 'closed' });
    if (key === '3' || key === '4') return setGraph({ dir: key === '3' ? 'left' : 'right' });
    if (key === 'Enter') { e.preventDefault(); submitGraph(); }
    return;
  }
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    e.preventDefault();
    const step = key === 'ArrowDown' ? 1 : -1, now = SHAPES.indexOf(G.form);
    return pickShape(SHAPES[now < 0 ? (step > 0 ? 0 : SHAPES.length - 1) : (now + step + SHAPES.length) % SHAPES.length]);
  }
  if (key === 'Enter') { e.preventDefault(); submitRule(); }
}

void run;   // run() is used by the tests; the screen reads rules through checkRule
draw();     // the golem waits behind the briefing
