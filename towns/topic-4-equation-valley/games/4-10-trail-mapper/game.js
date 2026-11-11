// Trail Mapper (Lesson 4-10): the trail map, the logbook, the rule plaque and the controls. The math and checks live in
// trail.js; zones, timer, lives, scoring and the report come from the shared game shell (shared/game/gameShell.js).
//
// Problem types: plot (tap the map), read (read the map), meaning (what does a point mean?), rule (write the rule from
// the map), odd (rule, logbook or map: which is wrong?), offpoint (which marker is off the trail?), mary (ratio equation),
// goal (boss: "at least" goals).
import {
  ZONES, genZone, genBackup, workedSolution, ruleText, needs, fmt, run, parseNumber, snap, near, pair,
  checkPlot, checkRead, checkMeaning, checkRule, checkOdd, checkOffPoint, checkMary, checkGoal,
} from './trail.js';
import { hubAudio } from '../../../../shared/audio.js';
import { createGame } from '../../../../shared/game/gameShell.js';

const SKILL_TIPS = {
  swapped_point: 'Plot (x, y): go ACROSS to the input first, then UP to the output.',
  forgot_start: 'Some trails don\'t start at 0: use the whole rule, start amount included.',
  height_is_input: 'A point\'s height is its output, worked out with the rule.',
  calc: 'Count squares carefully: check how much each square is worth on each axis.',
  wrong_axis: 'Read the answer on the OTHER axis from the number you were given.',
  misread: 'Go along one axis to the trail, then across (or down) to the other axis.',
  swapped_pair: 'In an ordered pair, the input comes first and the output second.',
  pair_is_rate: 'A point is one matching pair of values, not the rate.',
  pair_is_sum: 'The two numbers in a point are a pair, not a sum.',
  add_vs_times: 'A trail through (0, 0) that climbs the same amount each step is a TIMES rule.',
  swapped: 'The rule gives the output from the input: y = …x.',
  plus_vs_minus: 'If the trail would be below 0 at x = 0, the rule subtracts.',
  some_points: 'A rule must go through EVERY point on the trail.',
  no_points: 'Read two points and find how much y grows for each 1 of x.',
  check_all_three: 'Test the same input in the rule, the logbook and the map.',
  check_each_point: 'Put each point\'s input into the rule and compare the output.',
  mary_multiply: 'Test a ratio equation with the numbers it should give.',
  ratio_backwards: 'Fewer outputs than inputs means divide, not multiply.',
  ratio_difference: 'A ratio is about multiplying or dividing, not a fixed difference.',
  rounded_down: '"At least" means round UP so the goal is really reached.',
  not_whole: 'You can\'t sell part of an item: use a whole number.',
  multiplied: 'To find how many, divide the goal by the price.',
  use_the_rule: 'Set the output to the goal and solve the rule.',
};

const shell = createGame({
  zones: ZONES, makeZone: genZone, makeBackup: genBackup, workedSolution, showProblem,
  seconds: [60, 50, 60, 50, 80],                      // seconds until the rockslide, per zone
  meterFloor: 8, wrongBump: 30, rightRelief: 25, pauseOnBanner: true,
  lifeLostText: (left) => (left > 0 ? 'A CANTEEN RAN DRY!' : 'LOST IN THE CANYON!'),
  bossHitText: 'PASS CLEARED!', winDelay: () => 1700,
  skillTips: SKILL_TIPS, perfectText: 'No mistakes to sharpen. Master trail mapper!',
  onKey, testName: '__trail',
});
const { G, UI, $, win, miss, showFeedback } = shell;
const SHAPES = ['times', 'plus', 'line', 'minus'];
Object.assign(G, { pts: [], cursor: { i: 0, j: 0 }, form: null, vals: { m: '', b: '' }, guess: null, done: false, bad: null, tried: [], chosen: null });

/* ================================================================== */
/* Drawing: the map, the logbook and the rule plaque                   */
/* ================================================================== */
const K = '#1d1433';
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round"`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const FONT = 'font-family="Nunito, system-ui, sans-serif" font-weight="900"';
const MONO = 'font-family="ui-monospace, \'Courier New\', monospace" font-weight="900"';
const MAP = { x0: 80, y0: 430, size: 40 };            // the origin on screen, and the size of one square
const sx = (g, x) => MAP.x0 + (x / g.xStep) * MAP.size;
const sy = (g, y) => MAP.y0 - (y / g.yStep) * MAP.size;

function text(t, x, y, size, fill = K, anchor = 'middle', font = FONT) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${fill}" ${font}>${esc(t)}</text>`;
}
function wrap(t, x, y, n, size, fill = K) {
  const out = [];
  for (const w of String(t).split(' ')) { const last = out[out.length - 1]; if (last && `${last} ${w}`.length <= n) out[out.length - 1] = `${last} ${w}`; else out.push(w); }
  return out.map((l, i) => text(l, x, y + i * (size + 3), size, fill)).join('');
}
/** The visible piece of a rule's line, clipped to the map. */
function trailPath(rule, g, attrs) {
  const y0 = run(rule, 0), s = run(rule, 1) - y0;
  let xa = 0, xb = g.xMax;
  if (s > 0) { xa = Math.max(0, -y0 / s); xb = Math.min(g.xMax, (g.yMax - y0) / s); }
  if (xb <= xa || y0 > g.yMax) return '';
  return `<path d="M${sx(g, xa)} ${sy(g, run(rule, xa))} L${sx(g, xb)} ${sy(g, run(rule, xb))}" ${attrs}/>`;
}
function mapSvg(p, g, { line = null, guess = null, markers = [], cursor = null }) {
  let grid = '';
  for (let i = 0; i <= 10; i++) {
    const a = MAP.x0 + i * MAP.size, b = MAP.y0 - i * MAP.size;
    grid += `<path d="M${a} ${MAP.y0} V${MAP.y0 - 400} M${MAP.x0} ${b} H${MAP.x0 + 400}" stroke="#c9b48a" stroke-width="${i === 0 ? 0 : 1.5}"/>`;
    grid += text(fmt(i * g.xStep), a, MAP.y0 + 20, 13, '#5b4a3a');
    if (i > 0) grid += text(fmt(i * g.yStep), MAP.x0 - 8, b + 5, 13, '#5b4a3a', 'end');
  }
  return `<rect x="${MAP.x0 - 60}" y="10" width="480" height="490" rx="14" fill="#f6e7c1" ${O}/>
    ${grid}
    <path d="M${MAP.x0} ${MAP.y0 - 404} V${MAP.y0} H${MAP.x0 + 404}" stroke="${K}" stroke-width="3" fill="none"/>
    ${text(`${p.xName} (${p.X}) ➜`, MAP.x0 + 200, MAP.y0 + 44, 15, '#8f3f22')}
    <g transform="translate(${MAP.x0 - 44} ${MAP.y0 - 200}) rotate(-90)">${text(`${p.yName} (${p.Y}) ➜`, 0, 0, 15, '#8f3f22')}</g>
    ${line ? trailPath(line, g, `class="trail" stroke="#8f3f22" stroke-width="6" stroke-dasharray="14 8" stroke-linecap="round" fill="none"`) : ''}
    ${guess ? trailPath(guess, g, `class="guess" stroke="#1f63c9" stroke-width="5" stroke-dasharray="6 8" stroke-linecap="round" fill="none"`) : ''}
    ${markers.map((m) => `<g class="${m.cls || ''}"><circle cx="${sx(g, m.x)}" cy="${sy(g, m.y)}" r="9" fill="${m.fill || '#e5484d'}" ${O}/>${m.label ? text(m.label, sx(g, m.x) + 14, sy(g, m.y) - 10, 15, K, 'start') : ''}</g>`).join('')}
    ${cursor ? `<circle class="cursor" cx="${sx(g, cursor.x)}" cy="${sy(g, cursor.y)}" r="14" fill="none" stroke="#1f63c9" stroke-width="4"/>` : ''}
    <g id="hover"></g>
    <rect id="mapHit" x="${MAP.x0 - 20}" y="${MAP.y0 - 420}" width="440" height="440" fill="transparent" style="cursor:${p.type === 'plot' ? 'crosshair' : 'default'}"/>`;
}
function plaque(t, { glow = false, mark = '' } = {}) {
  return `<rect x="520" y="14" width="268" height="58" rx="10" fill="${glow ? '#ffe680' : '#3b3049'}" ${O} class="${mark}"/>
    ${text('RULE', 534, 32, 11, glow ? '#8f3f22' : '#c9b8ff', 'start')}
    ${text(t, 654, 60, t.length > 16 ? 18 : 22, glow ? K : '#ffd23f', 'middle', MONO)}`;
}
function logbook(rows, { mark = '' } = {}) {
  const h = 38, top = 116;
  return `<rect x="520" y="84" width="268" height="${40 + rows.length * h}" rx="10" fill="#fff4d6" ${O} class="${mark}"/>
    ${text('LOGBOOK', 534, 102, 11, '#8f3f22', 'start')}
    ${rows.map((r, i) => `<g>
      <rect x="532" y="${top + i * h}" width="244" height="${h - 6}" rx="7" fill="${r.state === 'ok' ? '#9be7b4' : r.state === 'bad' ? '#ffadb3' : r.state === 'ask' ? '#fff3c4' : '#efe2c4'}" stroke="${K}" stroke-width="2"/>
      ${text(r.x, 594, top + i * h + 23, 19, K, 'middle', MONO)}${text('➜', 654, top + i * h + 23, 16, '#8f3f22')}${text(r.y, 714, top + i * h + 23, 19, r.you ? '#1f63c9' : K, 'middle', MONO)}
    </g>`).join('')}`;
}
function note(t, y = 360) {
  return `<rect x="520" y="${y}" width="268" height="${Math.min(500 - y, 120)}" rx="10" fill="#efe2c4" ${O}/>${wrap(t, 654, y + 28, 26, 15, '#5b4a3a')}`;
}
function sky() {
  return `<rect x="-300" y="-300" width="1400" height="1120" fill="#c4643a"/>
    <path d="M-300 520 L-300 300 L-120 220 L-60 520 Z M1100 520 V260 L900 200 L840 520 Z" fill="#9e4a2b"/>`;
}

/* ================================================================== */
/* Problems                                                            */
/* ================================================================== */
const TAGS = { plot: 'PLOT THE TRAIL', read: 'READ THE MAP', meaning: 'WHAT DOES THIS POINT MEAN?', rule: 'MAP TO RULE', odd: 'SPOT THE BAD MAP', offpoint: 'WHICH MARKER IS OFF?', mary: 'IS MARY RIGHT?', goal: 'REACH THE GOAL' };
function showProblem(p, isBackup) {
  Object.assign(G, { pts: [], cursor: { i: 1, j: 1 }, form: null, vals: { m: '', b: '' }, guess: null, done: false, bad: null, tried: [], chosen: null });
  UI.taskTag.textContent = `${p.type === 'read' && p.backward ? 'READ THE MAP BACKWARD' : TAGS[p.type]}${isBackup ? ' · BACKUP' : ''}`;
  renderPrompt();
  renderControls();
  draw();
}
const rt = (p) => ruleText(p.rule, p.X, p.Y);
function renderPrompt() {
  const p = G.problem;
  const say = {
    plot: () => `Rule: <b class="mono">${esc(rt(p))}</b>. Plot a point for every logbook input: go <b>across</b> to ${esc(p.X)}, then <b>up</b> to ${esc(p.Y)}.`,
    read: () => (p.backward ? `Use the map: when is <b>${esc(p.Y)} = ${fmt(p.ask.y)}</b>? Find ${esc(p.X)}.` : `Use the map: what is <b>${esc(p.Y)}</b> when <b>${esc(p.X)} = ${fmt(p.ask.x)}</b>?`),
    meaning: () => `What does the point <b>${pair(p.ask.x, p.ask.y)}</b> on this trail mean?`,
    rule: () => `Write the rule for the trail on the map. Input <b>${esc(p.X)}</b>: ${esc(p.xName)}. Output <b>${esc(p.Y)}</b>: ${esc(p.yName)}.`,
    odd: () => 'The rule, the logbook and the map should all show the <b>same</b> trail. One of them is wrong. Which one?',
    offpoint: () => `The rule is <b class="mono">${esc(rt(p))}</b>. One trail marker is in the wrong spot. Which?`,
    mary: () => `For every <b>${fmt(p.P)} ${esc(p.xName)}</b> there are <b>${fmt(p.q)} ${esc(p.yName)}</b>. Mary wrote <b class="mono">${fmt(p.P)}${esc(p.X)} × ${fmt(p.q)} = ${esc(p.Y)}</b>. Which equation is right?`,
    goal: () => `<span class="story">${esc(p.question)}</span>`,
  };
  UI.prompt.innerHTML = say[p.type]();
}
function draw({ glow = G.done } = {}) {
  const p = G.problem, g = p.grid;
  let left = '', right = '';
  const showLine = glow ? p.rule : null;
  if (p.type === 'plot') {
    const markers = G.pts.map((q) => ({ ...q, fill: G.bad && near(G.bad.x, q.x) && near(G.bad.y, q.y) ? '#e5484d' : glow ? '#2fbf71' : '#1f63c9' }));
    left = mapSvg(p, g, { line: showLine, markers, cursor: glow ? null : { x: G.cursor.i * g.xStep, y: G.cursor.j * g.yStep } });
    right = plaque(rt(p), { glow }) + logbook(p.rows.map((r) => { const q = G.pts.find((v) => near(v.x, r.x)); return { x: fmt(r.x), y: q ? fmt(q.y) : '?', you: !!q, state: glow ? 'ok' : q ? null : 'ask' }; }))
      + note('Tap a crossing on the map to plot. Tap a point again to remove it.', 300);
  } else if (p.type === 'read') {
    const markers = p.rows.map((r) => ({ ...r, fill: '#8f3f22' }));
    if (glow) markers.push({ ...p.ask, fill: '#2fbf71', label: pair(p.ask.x, p.ask.y) });
    left = mapSvg(p, g, { line: p.rule, markers });
    const ask = p.backward ? { x: glow ? fmt(p.ask.x) : '?', y: fmt(p.ask.y), state: glow ? 'ok' : 'ask' } : { x: fmt(p.ask.x), y: glow ? fmt(p.ask.y) : '?', state: glow ? 'ok' : 'ask' };
    right = plaque(glow ? rt(p) : '???', { glow }) + logbook([...p.rows.map((r) => ({ x: fmt(r.x), y: fmt(r.y) })), ask]) + note('Move the pointer over the map to see where you are.', 300);
  } else if (p.type === 'meaning') {
    left = mapSvg(p, g, { line: p.rule, markers: [{ ...p.ask, fill: '#ffd23f', label: pair(p.ask.x, p.ask.y) }] });
    right = plaque(rt(p), { glow }) + note(`Input ${p.X}: ${p.xName}. Output ${p.Y}: ${p.yName}.`, 100);
  } else if (p.type === 'rule') {
    left = mapSvg(p, g, { line: p.rule, guess: G.guess, markers: p.rows.map((r) => ({ ...r, fill: glow ? '#2fbf71' : '#8f3f22' })) });
    right = plaque(glow ? rt(p) : `${p.Y} = ???`, { glow }) + note(G.guess ? 'Blue dashes: YOUR rule. Does it follow the trail?' : 'Read the points. How much does the trail climb for each 1 across? Where would it be at 0?', 100);
  } else if (p.type === 'odd') {
    const pick = (w) => (G.chosen === w ? (w === p.odd ? 'pick-ok' : 'pick-bad') : '');
    left = mapSvg(p, g, { line: p.mapRule, markers: p.rows.map((r) => ({ x: r.x, y: run(p.mapRule, r.x), fill: '#8f3f22' })) });
    left = `<g class="${pick('map')}">${left}</g>`;
    right = `<g class="${pick('rule')}">${plaque(ruleText(p.plaqueRule, p.X, p.Y))}</g><g class="${pick('table')}">${logbook(p.table.map((r) => ({ x: fmt(r.x), y: fmt(r.y) })))}</g>`
      + note('Test one input in all three. Two agree; the odd one out is wrong.', 290);
  } else if (p.type === 'offpoint') {
    const L = 'ABCD';
    left = mapSvg(p, g, { line: glow ? p.rule : null, markers: p.pts.map((q, i) => ({ ...q, label: L[i], fill: glow && i === p.bad ? '#e5484d' : G.tried.includes(i) ? '#9be7b4' : '#ffd23f' })) });
    right = plaque(rt(p), { glow }) + note('Put each marker\'s input into the rule. Does the output match its height?', 100);
  } else if (p.type === 'mary') {
    left = `<rect x="20" y="10" width="480" height="490" rx="14" fill="#f6e7c1" ${O}/>
      ${text(`FOR EVERY ${fmt(p.P)}`, 260, 120, 26, '#8f3f22')}${wrap(p.xName.toUpperCase(), 260, 160, 22, 22)}
      ${text('THERE ARE', 260, 250, 22, '#8f3f22')}${text(fmt(p.q), 260, 310, 46, K, 'middle', MONO)}${wrap(p.yName.toUpperCase(), 260, 350, 22, 22)}`;
    right = plaque(glow ? p.options.find((o) => o.ok).text : `MARY: ${fmt(p.P)}${p.X} × ${fmt(p.q)} = ${p.Y}`, { glow })
      + logbook(p.rows.map((r) => ({ x: fmt(r.x), y: fmt(r.y) })));
  } else {
    const fill = glow ? 1 : 0.3;
    left = `<rect x="20" y="10" width="480" height="490" rx="14" fill="#f6e7c1" ${O}/>
      <rect x="200" y="60" width="120" height="380" rx="20" fill="#fff" ${O}/>
      <rect class="thermo" x="208" y="${68 + 364 * (1 - fill)}" width="104" height="${364 * fill}" rx="14" fill="#e5484d"/>
      <path d="M180 68 H340" stroke="${K}" stroke-width="5"/>${text(`GOAL: $${p.goal}`, 260, 50, 22, '#8f3f22')}
      ${text(`$${(p.cents / 100).toFixed(2)} each`, 260, 480, 20, K)}`;
    right = plaque(rt(p), { glow }) + logbook(p.rows.map((r) => ({ x: fmt(r.x), y: `$${r.y.toFixed(2)}` }))) + note('"At least" means they must reach the goal, maybe a little over.', 300);
  }
  UI.scene.innerHTML = sky() + left + right;
  const hit = $('mapHit');
  if (hit) {
    hit.addEventListener('pointerdown', (e) => { if (G.problem.type === 'plot') { e.preventDefault(); tapMap(e); } });
    hit.addEventListener('pointermove', hover);
    hit.addEventListener('pointerleave', () => { const h = $('hover'); if (h) h.innerHTML = ''; });
  }
}
/** Screen point → map values (snapped to a crossing). */
function mapPoint(e) {
  const g = G.problem.grid;
  const pt = UI.scene.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const v = pt.matrixTransform(UI.scene.getScreenCTM().inverse());
  return snap(g, ((v.x - MAP.x0) / MAP.size) * g.xStep, ((MAP.y0 - v.y) / MAP.size) * g.yStep);
}
function hover(e) {
  const p = G.problem, h = $('hover');
  if (!p || !p.grid || !h) return;
  const q = mapPoint(e), g = p.grid;
  h.innerHTML = `<path d="M${sx(g, q.x)} ${MAP.y0} V${sy(g, q.y)} H${MAP.x0}" stroke="#1f63c9" stroke-width="2" stroke-dasharray="4 4" fill="none"/>
    <circle cx="${sx(g, q.x)}" cy="${sy(g, q.y)}" r="5" fill="#1f63c9"/>
    <rect x="${sx(g, q.x) + 10}" y="${sy(g, q.y) - 34}" width="${16 + pair(q.x, q.y).length * 10}" height="26" rx="6" fill="#fff" stroke="#1f63c9" stroke-width="2"/>
    ${text(pair(q.x, q.y), sx(g, q.x) + 18, sy(g, q.y) - 15, 16, '#1f63c9', 'start', MONO)}`;
}

/* ================================================================== */
/* Controls                                                            */
/* ================================================================== */
const box = (k) => `<input id="r_${k}" class="rbox" value="${esc(G.vals[k])}" inputmode="decimal" maxlength="7" placeholder="?" autocomplete="off">`;
function shapeHtml(form, X, Y, live = false) {
  const b = (k) => (live ? box(k) : '<span class="sq">□</span>');
  return { times: `${Y} = ${b('m')}${X}`, plus: `${Y} = ${X} + ${b('b')}`, line: `${Y} = ${b('m')}${X} + ${b('b')}`, minus: `${Y} = ${b('m')}${X} − ${b('b')}` }[form];
}
function choices(list) {
  UI.controls.innerHTML = list.map((t, i) => `<button type="button" class="choice" data-choice="${i}" ${G.tried.includes(i) ? 'disabled' : ''}><b>${i + 1}</b>${t}</button>`).join('')
    + `<div class="help-line">Click an answer or press <kbd>1</kbd>–<kbd>${list.length}</kbd>.</div>`;
  UI.controls.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => choose(Number(b.dataset.choice))));
}
function renderControls() {
  const p = G.problem;
  if (p.type === 'plot') {
    UI.controls.innerHTML = `
      <div class="label px">YOUR POINTS</div>
      <div class="chips">${G.pts.length ? G.pts.map((q) => `<span class="chip">${pair(q.x, q.y)}</span>`).join('') : '<span class="empty">tap the map to plot</span>'}</div>
      <div class="row-btns"><button type="button" id="clearPts" class="px">CLEAR</button><button type="button" id="checkBtn" class="go px">CHECK THE TRAIL (ENTER)</button></div>
      <div id="helpLine" class="help-line">Tap a crossing, or move the blue ring with <kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> and press <kbd>space</kbd>.</div>`;
    $('clearPts').addEventListener('click', () => { if (!G.locked) { G.pts = []; G.bad = null; renderControls(); draw(); } });
    $('checkBtn').addEventListener('click', submitPlot);
    return;
  }
  if (p.type === 'rule') {
    UI.controls.innerHTML = `
      <div class="label px">1. PICK THE RULE'S SHAPE (↑ ↓)</div>
      <div class="shapes">${SHAPES.map((f) => `<button type="button" class="shape ${G.form === f ? 'on' : ''}" data-shape="${f}">${shapeHtml(f, esc(p.X), esc(p.Y))}</button>`).join('')}</div>
      <div class="label px">2. FILL IN THE NUMBERS</div>
      <div class="rule-row">${G.form ? shapeHtml(G.form, esc(p.X), esc(p.Y), true) : '<span class="empty">pick a shape first</span>'}</div>
      <button type="button" id="checkBtn" class="apply px">TEST THE RULE (ENTER)</button>
      <div id="helpLine" class="help-line">Your rule is drawn on the map in blue so you can compare.</div>`;
    UI.controls.querySelectorAll('[data-shape]').forEach((b) => b.addEventListener('click', () => pickShape(b.dataset.shape)));
    UI.controls.querySelectorAll('.rbox').forEach((el) => el.addEventListener('input', () => { G.vals[el.id.slice(2)] = el.value; }));
    $('checkBtn').addEventListener('click', submitRule);
    focusFirst();
    return;
  }
  if (p.type === 'read' || p.type === 'goal') {
    const who = p.type === 'goal' ? `${esc(p.X)} =` : `${esc(p.backward ? p.X : p.Y)} =`;
    UI.controls.innerHTML = `
      <div class="label px">${p.type === 'goal' ? 'HOW MANY?' : 'READ IT OFF THE MAP'}</div>
      <label class="rule-row">${who} <input id="ans" class="rbox wide" inputmode="decimal" maxlength="9" placeholder="?" autocomplete="off"></label>
      <button type="button" id="checkBtn" class="apply px">CHECK (ENTER)</button>
      <div id="helpLine" class="help-line">Type a number and press <kbd>Enter</kbd>.</div>`;
    $('checkBtn').addEventListener('click', submitNumber);
    focusFirst();
    return;
  }
  if (p.type === 'odd') {
    UI.controls.innerHTML = `<div class="trio">${[['rule', 'THE RULE'], ['table', 'THE LOGBOOK'], ['map', 'THE MAP']].map(([w, t], i) => `<button type="button" class="px" data-odd="${w}" ${G.tried.includes(w) ? 'disabled' : ''}><b>${i + 1}</b>${t}</button>`).join('')}</div>
      <div class="help-line">Click the one that's wrong, or press <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>.</div>`;
    UI.controls.querySelectorAll('[data-odd]').forEach((b) => b.addEventListener('click', () => chooseOdd(b.dataset.odd)));
    return;
  }
  if (p.type === 'offpoint') return choices(p.pts.map((q, i) => `Marker ${'ABCD'[i]}`));
  return choices(p.options.map((o) => (p.type === 'mary' ? `<span class="mono">${esc(o.text)}</span>` : esc(o.text))));
}
function focusFirst() {
  const el = [...UI.controls.querySelectorAll('input')].find((i) => !i.value) || UI.controls.querySelector('input');
  if (el && UI.briefing.classList.contains('hidden')) el.focus({ preventScroll: true });
}

/* ================================================================== */
/* Answers                                                             */
/* ================================================================== */
function togglePoint(q) {
  if (G.locked) return;
  G.bad = null;
  const same = G.pts.findIndex((v) => near(v.x, q.x) && near(v.y, q.y));
  if (same >= 0) { G.pts.splice(same, 1); hubAudio.playTone(330, 'triangle', 0.08, 0.05); }
  else {
    G.pts = G.pts.filter((v) => !near(v.x, q.x));         // one point per input: a new one replaces the old
    G.pts.push(q); G.pts.sort((a, b) => a.x - b.x);
    hubAudio.playTone(520 + G.pts.length * 80, 'triangle', 0.1, 0.07);
  }
  renderControls(); draw();
}
function tapMap(e) { if (!G.locked && !G.done) togglePoint(mapPoint(e)); }
function submitPlot() {
  const p = G.problem;
  if (G.locked || p.type !== 'plot') return;
  if (!G.pts.length) return nudge('Plot your points on the map first.');
  const res = checkPlot(p, G.pts);
  if (res.nudge) return nudge(res.message);
  if (res.correct) { G.done = true; draw(); return win(res); }
  G.bad = res.point || null; draw();
  miss(res, { lock: true, delay: 1800, retry: () => { G.bad = null; draw(); } });
}
function pickShape(f) {
  if (G.locked) return;
  G.form = f; G.guess = null;
  hubAudio.playSelect();
  renderControls(); draw();
}
function submitRule() {
  const p = G.problem;
  if (G.locked || p.type !== 'rule') return;
  if (!G.form) return nudge('Pick the rule\'s shape first.');
  const guess = { form: G.form };
  for (const k of needs(G.form)) { const v = parseNumber(G.vals[k]); if (v !== null) guess[k] = v; }
  const res = checkRule(p, guess);
  if (res.nudge) return nudge(res.message);
  G.guess = res.guess;
  if (res.correct) { G.done = true; draw(); return win(res); }
  draw();
  miss(res, { lock: true, delay: 1800, retry: () => { renderControls(); draw(); } });
}
function submitNumber() {
  const p = G.problem;
  if (G.locked || (p.type !== 'read' && p.type !== 'goal')) return;
  const raw = $('ans').value;
  const res = p.type === 'goal' ? checkGoal(p, raw) : checkRead(p, raw);
  if (res.nudge) return nudge(res.message);
  if (res.correct) { G.done = true; draw(); return win(res); }
  miss(res, { lock: true, delay: 1800, retry: () => { $('ans').value = ''; focusFirst(); } });
}
function choose(i) {
  const p = G.problem;
  if (G.locked || G.tried.includes(i)) return;
  const res = p.type === 'offpoint' ? checkOffPoint(p, i) : p.type === 'mary' ? checkMary(p, i) : checkMeaning(p, i);
  UI.controls.querySelector(`[data-choice="${i}"]`)?.classList.add(res.correct ? 'right' : 'wrong');
  if (res.correct) { G.done = true; draw(); return win(res); }
  G.tried.push(i);
  draw();
  miss(res, { lock: true, delay: 1600, retry: () => renderControls() });
}
function chooseOdd(w) {
  const p = G.problem;
  if (G.locked || p.type !== 'odd' || G.tried.includes(w)) return;
  G.chosen = w;
  const res = checkOdd(p, w);
  if (res.correct) { draw(); G.done = true; return win(res); }
  G.tried.push(w);
  draw();
  miss(res, { lock: true, delay: 1600, retry: () => { G.chosen = null; renderControls(); draw(); } });
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
  const key = e.key, p = G.problem;
  if (p.type === 'plot') {
    const move = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[key];
    if (move) { e.preventDefault(); G.cursor.i = Math.max(0, Math.min(10, G.cursor.i + move[0])); G.cursor.j = Math.max(0, Math.min(10, G.cursor.j + move[1])); return draw(); }
    if (key === ' ') { e.preventDefault(); return togglePoint({ x: G.cursor.i * p.grid.xStep, y: Math.round(G.cursor.j * p.grid.yStep * 100) / 100 }); }
    if (key === 'Enter') { e.preventDefault(); return submitPlot(); }
    return;
  }
  if (p.type === 'rule') {
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      e.preventDefault();
      const step = key === 'ArrowDown' ? 1 : -1;
      const now = SHAPES.indexOf(G.form);
      return pickShape(SHAPES[now < 0 ? (step > 0 ? 0 : SHAPES.length - 1) : (now + step + SHAPES.length) % SHAPES.length]);
    }
    if (key === 'Enter') { e.preventDefault(); return submitRule(); }
    return;
  }
  if (p.type === 'read' || p.type === 'goal') { if (key === 'Enter') { e.preventDefault(); submitNumber(); } return; }
  const n = Number(key);
  if (p.type === 'odd') { if (n >= 1 && n <= 3) chooseOdd(['rule', 'table', 'map'][n - 1]); return; }
  const count = p.type === 'offpoint' ? p.pts.length : p.options.length;
  if (n >= 1 && n <= count) choose(n - 1);
}

function init() {
  // a sample behind the briefing: d = 4t
  const g = { xStep: 1, yStep: 4, xMax: 10, yMax: 40 };
  const p = { X: 't', Y: 'd', xName: 'time (hours)', yName: 'distance (miles)', type: 'read' };
  UI.scene.innerHTML = sky() + mapSvg(p, g, { line: { form: 'times', m: 4 }, markers: [1, 2, 3].map((x) => ({ x, y: 4 * x, fill: '#8f3f22' })) })
    + plaque('d = 4t') + logbook([1, 2, 3].map((x) => ({ x: fmt(x), y: fmt(4 * x) })));
}

init();
