// Force Field (Lesson 4-7: Solve Inequalities): the screen and the controls.
// The math is in field.js. The shared parts of an action game (briefing, top bar, lives, hint card, report)
// are in shared/game/arcadeShell.js.
//
// How a zone runs: it is a list of WAVES. In each wave the sign shows a rule, the student shades the landing
// zone on the number line, and pods (numbers) fall. A pod lands only if its number is inside the shaded zone.
// Solutions must land; everything else must be blocked. After the pods it is the student's turn: the sign gives
// an order ("land one that is not a whole number") and they drop a pod of their own on a number they choose.
// In the boss the rule is hidden, and the student chooses which numbers to test. All timing goes through update(), so the action
// stops cleanly whenever a banner, hint, help screen or mistake message is showing.
import { createArcade } from '../../../../shared/game/arcadeShell.js';
import { ZONES, genWaves, isSolution, inGraph, inBand, ruleGraph, sameGraph, classify, classifyZap, checkOrder, pickStep, fmt, r2, near } from './field.js';

const NS = 'http://www.w3.org/2000/svg';
const L = 90, WD = 1186;                 // the number line: left end and width, in scene units (the scene is 1366 x 698)
const TOP = 104, PICK_Y = 300, SHIELD_Y = 430, LINE_Y = 520;   // PICK_Y: where the student's own pod waits
const PACE = [{ speed: 66, gap: 1.3 }, { speed: 66, gap: 1.3 }, { speed: 80, gap: 1.1 }, { speed: 62, gap: 1.2 }, { speed: 74, gap: 1.2 }];
const BOSS = ZONES.length - 1;
const $ = (id) => document.getElementById(id);
const scene = $('scene');

// Everything about the wave being played.
const W = {
  waves: [], wi: 0, wave: null, phase: 'idle',      // phase: idle, probe (test a hidden rule), prep, run, orders (your turn), gap
  t: 0, prepLeft: 0, gapLeft: 0, pods: [], marks: [],
  graph: null, band: null, active: 'a',             // the student's shading (one edge, or two in the boss)
  frozen: false, speed: 1, podsDone: 0, podsTotal: 0,
  pick: 0, pickEl: null, drop: null,                // the student's own pod: its number, its drawing, and its fall
  oi: 0, orderMiss: 0, probesLeft: 0, afterResume: null,
};

const HINTS = {
  direction: 'Read the symbol like an arrow of sizes.<span class="mono">&lt; and ≤ : smaller values, shade LEFT<br>&gt; and ≥ : bigger values, shade RIGHT</span>Test one number from your shaded side in the rule. Is it true?',
  boundary: 'The edge of the landing zone sits on the number in the rule.<span class="mono">x ≤ 12 : the edge is at 12</span>Words work the same way: "at least 4" has its edge at 4.',
  solve_first: 'This rule is not solved yet. Undo what is done to the letter, on both sides, just like an equation.<span class="mono">x + 3 &gt; 8 → x &gt; 5</span>The edge goes on the solved number.',
  edge_included: 'Put the edge number itself into the rule.<span class="mono">12 ≤ 12 is TRUE</span>≤ and ≥ (and "at least", "at most", "no more than") include the edge: use a SOLID circle.',
  edge_excluded: 'Put the edge number itself into the rule.<span class="mono">12 &lt; 12 is FALSE</span>&lt; and &gt; (and "less than", "more than", "under") leave the edge out: use an OPEN circle.',
  band_range: 'A pod must make BOTH rules true.<span class="mono">t &gt; 3 AND t ≤ 9</span>Shade only where the two zones overlap: between the two edges.',
  zapped_solution: 'Before you zap, put the number into the rule.<span class="mono">Is it TRUE? Let it land.</span>Only zap numbers that make the rule false.',
  missed_nonsolution: 'Put each number into the rule as it falls.<span class="mono">Is it FALSE? Zap it.</span>Watch numbers right beside the edge, like 12.01.',
  check_value: 'Put the pod\'s number into the rule and check: true or false?',
  pick_solution: 'Your number has to make the rule TRUE to land.<span class="mono">x &gt; 8 : is YOUR number greater than 8?</span>Say the rule out loud with your number in place of the letter.',
  pick_nonsolution: 'To be blocked, your number has to make the rule FALSE.<span class="mono">x &gt; 8 : pick a number that is NOT greater than 8</span>',
  pick_nonwhole: 'An inequality has more solutions than you can count, and most are not whole numbers.<span class="mono">x &gt; 8 : 8.5 works, and so does 9.5</span>Slide your pod between two tick marks.',
  pick_whole: 'This order asks for a whole number: one that sits exactly on a labelled tick.',
  whole_edge: 'Start at the edge and step one whole number at a time.<span class="mono">x &gt; 8 : is 8 a solution? No. Is 9? Yes.</span>With ≥ or ≤ the edge itself may be the answer.',
};
const TIPS = {
  direction: 'Which way to shade: < and ≤ go left (smaller), > and ≥ go right (bigger).',
  boundary: 'The edge of the graph goes on the number in the rule.',
  solve_first: 'Solve the inequality first (undo on both sides), then graph it.',
  edge_included: '≤ and ≥ include the edge value: a solid circle.',
  edge_excluded: '< and > leave the edge value out: an open circle.',
  band_range: 'With two rules, only values that fit both are solutions.',
  zapped_solution: 'Test a value in the inequality before deciding it is not a solution.',
  missed_nonsolution: 'Values just past the edge (like 12.01) are easy to miss. Test them.',
  check_value: 'Test a value by putting it into the inequality.',
  pick_solution: 'A solution is any number that makes the inequality true.',
  pick_nonsolution: 'A number that makes the inequality false is not a solution.',
  pick_nonwhole: 'Solutions are not only whole numbers: 8.5 is a solution of x > 8.',
  pick_whole: 'Read the order carefully: a whole number sits on a labelled tick.',
  whole_edge: 'The smallest whole solution of x > 8 is 9, but of x ≥ 8 it is 8.',
};

const arcade = createArcade({
  zones: ZONES, startZone, stopZone, onKey, hints: HINTS, skillTips: TIPS, testName: '__field',
  perfectText: 'A perfect shield: no mistakes to sharpen!',
  lifeLostText: (left) => (left > 0 ? `A CORE BURNED OUT! ${left} LEFT` : 'THE SHIELD FELL'),
});
const { G, hubAudio } = arcade;
if (window.__field) window.__field.W = W;

/* ================================================================== */
/* Where things are on the line                                        */
/* ================================================================== */
const range = () => W.wave.rule.range;
const X = (v) => L + ((v - range().lo) / (range().hi - range().lo)) * WD;
function snap(v) {                                   // the nearest tick, kept on the line
  const { lo, hi, step } = range();
  return r2(lo + Math.round((Math.min(hi, Math.max(lo, v)) - lo) / step) * step);
}
const valueAt = (x) => snap(range().lo + ((x - L) / WD) * (range().hi - range().lo));
const isBand = () => W.wave && W.wave.mode === 'band';
const isZap = () => W.wave && W.wave.mode === 'zap';
const canEdit = () => W.wave && !isZap() && (W.phase === 'prep' || W.phase === 'run') && !arcade.paused();
// The student's own pod (their turn, or testing a hidden rule).
const picking = () => W.phase === 'orders' || W.phase === 'probe';
const canPick = () => picking() && W.pickEl && !W.drop && !W.frozen && !arcade.paused();
const stepOfPick = () => (W.phase === 'probe' ? range().step : pickStep(W.wave.rule));
function snapPick(v) {
  const { lo, hi } = range(), s = stepOfPick();
  return r2(lo + Math.round((Math.min(hi, Math.max(lo, v)) - lo) / s) * s);
}

/* ================================================================== */
/* Zones and waves                                                     */
/* ================================================================== */
function startZone(z) {
  W.waves = genWaves(Math.random, z);
  W.podsTotal = W.waves.reduce((sum, w) => sum + w.pods.length, 0);
  W.podsDone = 0;
  startWave(0, true);
}
function stopZone() {
  W.phase = 'idle'; W.frozen = false; W.pods = []; W.drop = null; W.pickEl = null; W.afterResume = null;
  $('callout').classList.add('hidden');
  const pods = $('gPods'); if (pods) pods.innerHTML = '';
}
function startWave(i, first = false) {
  const wave = W.waves[i];
  Object.assign(W, { wi: i, wave, t: 0, pods: [], marks: [], frozen: false, drop: null, pickEl: null, afterResume: null, oi: 0, orderMiss: 0, probesLeft: wave.probes || 0, phase: wave.mode === 'hidden' ? 'probe' : 'prep', prepLeft: wave.prep });
  const { lo, hi } = wave.rule.range;
  if (wave.mode === 'band') { W.band = { a: lo + 1, aClosed: true, b: hi - 1, bClosed: true }; W.active = 'a'; }
  else if (wave.mode !== 'zap') {
    // A new zone starts with nothing shaded. Later waves keep the old shading, so the student has to change it.
    const start = snap(lo + (hi - lo) * (wave.rule.n > (lo + hi) / 2 ? 0.25 : 0.75));
    const g = first || !W.graph ? { edge: start, dir: null, closed: true } : { ...W.graph, edge: snap(W.graph.edge) };
    if (g.dir && sameGraph(g, ruleGraph(wave.rule))) g.dir = null;
    W.graph = g;
  }
  drawBase(); drawGraph();
  if (wave.mode === 'hidden') newPick();             // the student tests numbers before shading
  renderSign(true); renderCtl();
}
function makePods(values, { gap, speed }) {
  W.t = 0;
  W.pods = values.map((v, i) => ({ v, i, spawnAt: 0.3 + i * gap, speed, y: TOP, state: 'wait', el: null }));
}
function launch() {
  if (W.phase !== 'prep' || arcade.paused() || W.frozen) return;
  W.phase = 'run';
  hubAudio.playCartridgeLaunch();
  makePods(W.wave.pods, PACE[G.zone]);
  renderCtl();
}
function perfectShield() {
  if (isZap()) return false;
  const rule = W.wave.rule;
  if (isBand()) { const b = rule.band, s = W.band; return near(s.a, b.a) && near(s.b, b.b) && s.aClosed === b.aClosed && s.bClosed === b.bClosed; }
  return Boolean(W.graph.dir) && sameGraph(W.graph, ruleGraph(rule));
}
function endWave() {
  if (perfectShield()) { G.score += 20; arcade.renderHud(); arcade.flash('EXACT GRAPH! +20'); }
  if (W.wave.orders.length) return startOrders();
  W.phase = 'gap'; W.gapLeft = 0.9;
  renderCtl();
}
/* ---- your turn: the student picks numbers of their own ---- */
function startOrders() {
  const rule = W.wave.rule;
  Object.assign(W, { phase: 'orders', oi: 0, orderMiss: 0, active: '' });
  if (isBand()) W.band = { ...rule.band }; else if (!isZap()) W.graph = ruleGraph(rule);   // the shield now shows the rule exactly
  drawGraph(); newPick(); renderSign(true); renderCtl();
}
function newPick() {
  const { lo, hi } = range(), order = W.phase === 'orders' ? W.wave.orders[W.oi] : null;
  const spots = [0.5, 0.25, 0.75, 0.1, 0.9].map((f) => snapPick(lo + (hi - lo) * f));
  W.pick = (order && spots.find((v) => !checkOrder(W.wave.rule, order, v).ok)) ?? spots[0];   // never start on a right answer
  W.drop = null;
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'pod pick');
  g.innerHTML = `<line class="guide" x1="0" y1="34" x2="0" y2="${LINE_Y - PICK_Y}" stroke="#9be7ff" stroke-width="2" stroke-dasharray="4 7" opacity="0.6"/><g class="pod-in"><path d="M-9 -19 L0 -34 L9 -19 Z" fill="#ff9f43" stroke="#2b1b2e" stroke-width="3"/><rect class="body" x="-36" y="-20" width="72" height="38" rx="14" fill="#9be7ff" stroke="#2b1b2e" stroke-width="3"/><text y="6"></text></g>`;
  $('gPods').appendChild(g);
  W.pickEl = g;
  drawPick();
}
function drawPick() {
  W.pickEl.querySelector('text').textContent = fmt(W.pick);
  W.pickEl.setAttribute('transform', `translate(${X(W.pick)} ${PICK_Y})`);
}
function setPick(v) {
  if (!canPick()) return;
  v = snapPick(v);
  if (near(v, W.pick)) return;
  W.pick = v; hubAudio.playStep(); drawPick();
}
function dropPick() {
  if (!canPick()) return;
  W.pickEl.querySelector('.guide').remove();
  W.drop = { v: W.pick, y: PICK_Y, el: W.pickEl };
  hubAudio.playCartridgeLaunch();
  renderCtl();
}
/** The student's pod reached the shield. */
function resolvePick() {
  const d = W.drop, rule = W.wave.rule, lands = isSolution(rule, d.v);
  W.drop = null; W.pickEl = null;
  if (W.phase === 'probe') {                         // a test of the hidden rule: it leaves a mark, no score
    W.marks.push({ v: d.v, ok: lands }); drawMarks();
    hubAudio.playSelect();
    finishPod(d, lands ? 'landed' : 'blocked');
    W.probesLeft -= 1;
    if (W.probesLeft > 0) newPick(); else { W.phase = 'prep'; W.prepLeft = W.wave.prep; drawGraph(); }
    renderSign(W.probesLeft === 0); renderCtl();
    return;
  }
  const order = W.wave.orders[W.oi], res = checkOrder(rule, order, d.v);
  if (res.ok) { arcade.good(15); hubAudio.playCoinClink(); finishPod(d, lands ? 'landed' : 'blocked'); return nextOrder(); }
  W.orderMiss += 1;
  d.el.classList.add('wrong');
  arcade.bad(res.key, 20);
  if (W.phase === 'idle') return;                    // that was the last core
  const moveOn = W.orderMiss >= 2;                   // two misses: show one that works and go on
  W.frozen = true; W.wrongPod = d; W.afterResume = moveOn ? nextOrder : newPick;
  $('calloutText').textContent = res.message + (moveOn ? ` One that works: ${fmt(order.example)}.` : '');
  $('resumeBtn').textContent = moveOn ? 'NEXT (ENTER)' : 'TRY AGAIN (ENTER)';
  $('callout').classList.remove('hidden');
}
function nextOrder() {
  W.oi += 1; W.orderMiss = 0;
  if (W.oi >= W.wave.orders.length) { W.phase = 'gap'; W.gapLeft = 0.8; renderCtl(); return; }
  newPick(); renderSign(true); renderCtl();
}
function afterWave() {
  if (W.wi + 1 < W.waves.length) return startWave(W.wi + 1);
  W.phase = 'idle';
  arcade.zoneCleared();
}

/* ================================================================== */
/* The action                                                          */
/* ================================================================== */
function update(dt) {
  if (W.phase === 'idle' || W.frozen || arcade.paused()) return;
  if (W.phase === 'prep') {
    if (!G.practice) { W.prepLeft -= dt; if (W.prepLeft <= 0) return launch(); }
    return renderCtl();
  }
  if (W.phase === 'gap') { W.gapLeft -= dt; if (W.gapLeft <= 0) afterWave(); return; }
  if (picking()) {
    if (W.drop) { W.drop.y = Math.min(SHIELD_Y, W.drop.y + 460 * dt); place(W.drop); if (W.drop.y >= SHIELD_Y) resolvePick(); }
    return;
  }
  W.t += dt;
  for (const p of W.pods) {
    if (p.state === 'wait' && W.t >= p.spawnAt) { p.state = 'fall'; p.el = podEl(p); }
    if (p.state !== 'fall') continue;
    p.y = Math.min(SHIELD_Y, p.y + p.speed * dt);
    place(p);
    if (p.y >= SHIELD_Y) { resolve(p); if (W.phase === 'idle' || W.frozen || arcade.paused()) return; }
  }
  if (W.pods.length && W.pods.every((p) => p.state === 'done')) {
    endWave();
  }
}
/** A pod reached the shield: does it land, and should it have? */
function resolve(p) {
  const rule = W.wave.rule, should = isSolution(rule, p.v);
  if (isZap()) {
    const res = classifyZap(rule, p.v, false);
    return res ? mistake(p, res) : right(p, 'landed');
  }
  const landed = isBand() ? inBand(W.band, p.v) : Boolean(W.graph.dir) && inGraph(W.graph, p.v);
  if (landed === should) return right(p, landed ? 'landed' : 'blocked');
  mistake(p, classify(rule, isBand() ? null : { ...W.graph, dir: W.graph.dir || 'none' }, p.v, landed));
}
function countPod() {
  W.podsDone += 1;
  if (G.zone === BOSS) arcade.setBossProgress((W.podsDone / W.podsTotal) * 100);
}
function right(p, how) {
  countPod();
  arcade.good(10);
  hubAudio.playCoinClink();
  finishPod(p, how);
}
function finishPod(p, how) {
  p.state = 'done';
  const el = p.el;
  el.classList.add(how);
  setTimeout(() => el.remove(), 650);
}
/** The pod that exposes a mistake stops the action and says what went wrong. The student fixes the graph, then carries on. */
function mistake(p, res) {
  p.state = 'done';
  p.el.classList.add('wrong');
  countPod();
  arcade.bad(res.key, 25);
  if (W.phase === 'idle') return;                    // that was the last core: the zone has stopped
  W.frozen = true; W.wrongPod = p;
  $('calloutText').textContent = res.message;
  $('resumeBtn').textContent = isZap() ? 'CONTINUE (ENTER)' : 'FIX THE GRAPH, THEN CONTINUE (ENTER)';
  $('callout').classList.remove('hidden');
}
function resume() {
  if (!W.frozen || arcade.paused()) return;
  W.frozen = false;
  $('callout').classList.add('hidden');
  if (W.wrongPod && W.wrongPod.el) W.wrongPod.el.remove();
  W.wrongPod = null;
  const then = W.afterResume;
  W.afterResume = null;
  if (then) then();
}
function zap(p) {
  if (!isZap() || W.phase !== 'run' || W.frozen || arcade.paused() || !p || p.state !== 'fall') return;
  const res = classifyZap(W.wave.rule, p.v, true);
  if (res) return mistake(p, res);
  right(p, 'zapped');
}

/* ================================================================== */
/* The student's controls                                              */
/* ================================================================== */
function changed() { hubAudio.playStep(); drawGraph(); renderCtl(); }
function setEdge(v) {
  if (!canEdit()) return;
  v = snap(v);
  if (isBand()) { if (near(W.band[W.active], v)) return; W.band[W.active] = v; } else { if (near(W.graph.edge, v)) return; W.graph.edge = v; }
  changed();
}
function moveEdge(steps) { if (canEdit()) setEdge((isBand() ? W.band[W.active] : W.graph.edge) + steps * range().step); }
function setDir(dir) { if (!canEdit() || isBand()) return; W.graph.dir = dir; changed(); }
const flip = () => setDir(W.graph && W.graph.dir === 'right' ? 'left' : 'right');
function toggleCircle() {
  if (!canEdit()) return;
  if (isBand()) W.band[`${W.active}Closed`] = !W.band[`${W.active}Closed`]; else W.graph.closed = !W.graph.closed;
  changed();
}
function switchEdge() { if (!canEdit() || !isBand()) return; W.active = W.active === 'a' ? 'b' : 'a'; changed(); }

function onKey(e) {
  const k = e.key;
  if (k === 'Enter') { e.preventDefault(); if (W.frozen) resume(); else if (picking()) dropPick(); else launch(); return; }
  if (picking()) {
    if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); setPick(W.pick + (k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 10 : 1) * stepOfPick()); }
    return;
  }
  if (isZap()) { if (/^[1-9]$/.test(k)) zap(W.pods[Number(k) - 1]); return; }
  if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); moveEdge((k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 10 : 1)); }
  else if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); flip(); }
  else if (k === ' ') { e.preventDefault(); toggleCircle(); }
  else if (k === 'Tab' && isBand()) { e.preventDefault(); switchEdge(); }
}
const press = (id, fn) => $(id).addEventListener('click', (e) => { e.currentTarget.blur(); fn(); });
press('leftBtn', () => setDir('left'));
press('rightBtn', () => setDir('right'));
press('stepL', () => (picking() ? setPick(W.pick - stepOfPick()) : moveEdge(-1)));
press('stepR', () => (picking() ? setPick(W.pick + stepOfPick()) : moveEdge(1)));
press('circleBtn', toggleCircle);
press('switchBtn', switchEdge);
press('goBtn', () => (picking() ? dropPick() : launch()));
press('resumeBtn', resume);

// Drag the edge along the line, tap the line to move the edge there, tap the edge circle to switch solid / open.
let drag = null;
function scenePoint(e) {
  const r = scene.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * 1366, y: ((e.clientY - r.top) / r.height) * 698 };
}
const pickAt = (x) => range().lo + ((x - L) / WD) * (range().hi - range().lo);
scene.addEventListener('pointerdown', (e) => {
  const pt = scenePoint(e);
  if (picking()) {                                   // slide your own pod anywhere along the line
    if (!canPick()) return;
    drag = { pick: true, moved: true };
    scene.setPointerCapture(e.pointerId);
    return setPick(pickAt(pt.x));
  }
  if (!canEdit()) return;
  if (pt.y < SHIELD_Y - 20 || pt.y > LINE_Y + 46) return;
  if (isBand()) { const want = Math.abs(pt.x - X(W.band.a)) <= Math.abs(pt.x - X(W.band.b)) ? 'a' : 'b'; if (want !== W.active) { W.active = want; changed(); } }
  const edgeX = X(isBand() ? W.band[W.active] : W.graph.edge);
  drag = { startX: pt.x, moved: false, onEdge: Math.abs(pt.x - edgeX) <= 20 && pt.y > LINE_Y - 30 };
  scene.setPointerCapture(e.pointerId);
  if (!drag.onEdge) { drag.moved = true; setEdge(valueAt(pt.x)); }
});
scene.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const pt = scenePoint(e);
  if (drag.pick) return setPick(pickAt(pt.x));
  if (drag.moved || Math.abs(pt.x - drag.startX) > 6) { drag.moved = true; setEdge(valueAt(pt.x)); }
});
const endDrag = () => { if (drag && !drag.moved && drag.onEdge) toggleCircle(); drag = null; };
scene.addEventListener('pointerup', endDrag);
scene.addEventListener('pointercancel', () => { drag = null; });

/* ================================================================== */
/* Drawing                                                             */
/* ================================================================== */
const STARS = [[60, 40], [180, 120], [300, 60], [420, 170], [520, 90], [1010, 60], [1120, 150], [1230, 80], [1320, 190], [760, 210], [640, 300], [90, 260], [1280, 320], [930, 280], [240, 330]];
const TOWERS = [[40, 70, 60], [120, 100, 44], [240, 60, 70], [320, 120, 50], [450, 80, 62], [540, 110, 40], [660, 70, 66], [750, 130, 46], [900, 90, 58], [1000, 60, 72], [1080, 120, 42], [1210, 80, 64], [1300, 60, 50]];
function drawBase() {
  const { lo, hi, step } = range();
  let ticks = '';
  const count = Math.round((hi - lo) / step);
  for (let i = 0; i <= count; i++) {
    const v = r2(lo + i * step), x = X(v), whole = near(v, Math.round(v)), half = near(v * 2, Math.round(v * 2));
    const len = whole ? 14 : half ? 10 : 6;
    ticks += `<line x1="${x}" y1="${LINE_Y - len}" x2="${x}" y2="${LINE_Y + len}" stroke="#fff" stroke-width="${whole ? 3 : 2}"/>`;
    if (whole) ticks += `<text class="tick-label" x="${x}" y="${LINE_Y + 34}">${fmt(v)}</text>`;
  }
  const x1 = L - 40, x2 = L + WD + 40;
  scene.innerHTML = `
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#171331"/><stop offset="1" stop-color="#3b2a6e"/></linearGradient></defs>
    <rect width="1366" height="698" fill="url(#sky)"/>
    ${STARS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#fff" opacity="0.7"/>`).join('')}
    ${TOWERS.map(([x, w, h]) => `<rect x="${x}" y="${632 - h}" width="${w}" height="${h}" fill="#241a44" stroke="#120d26" stroke-width="3"/><rect x="${x + 10}" y="${644 - h}" width="10" height="10" fill="#ffd166" opacity="0.8"/><rect x="${x + w - 22}" y="${660 - h}" width="10" height="10" fill="#ffd166" opacity="0.5"/>`).join('')}
    <g id="gGraph"></g>
    <line x1="${x1}" y1="${LINE_Y}" x2="${x2}" y2="${LINE_Y}" stroke="#fff" stroke-width="4"/>
    <path d="M${x1 - 14} ${LINE_Y} l14 -9 v18 Z M${x2 + 14} ${LINE_Y} l-14 -9 v18 Z" fill="#fff"/>
    ${ticks}
    <g id="gEdge"></g><g id="gMarks"></g><g id="gPods"></g>`;
}
function drawGraph() {
  const x1 = L - 40, x2 = L + WD + 40;
  let shield = [[x1, x2]], open = null, edges = [];
  if (isZap()) shield = [];
  else if (isBand()) {
    const b = W.band, xa = X(b.a), xb = X(b.b);
    if (b.a < b.b) { shield = [[x1, xa], [xb, x2]]; open = [xa, xb]; }
    edges = [{ x: xa, v: b.a, closed: b.aClosed, on: W.active === 'a' }, { x: xb, v: b.b, closed: b.bClosed, on: W.active === 'b' }];
  } else if (W.phase !== 'probe') {                   // while a hidden rule is being tested there is no graph yet
    const g = W.graph, xe = X(g.edge);
    if (g.dir === 'right') { shield = [[x1, xe]]; open = [xe, x2]; }
    if (g.dir === 'left') { shield = [[xe, x2]]; open = [x1, xe]; }
    edges = [{ x: xe, v: g.edge, closed: g.closed, on: false }];
  }
  let back = isZap() ? `<line x1="${x1}" y1="${SHIELD_Y}" x2="${x2}" y2="${SHIELD_Y}" stroke="#7df9ff" stroke-width="3" stroke-dasharray="6 14" opacity="0.35"/>` : '';
  for (const [a, b] of shield) back += `<rect x="${a}" y="${SHIELD_Y}" width="${b - a}" height="${LINE_Y - SHIELD_Y}" fill="#7df9ff" opacity="0.09"/><rect x="${a}" y="${SHIELD_Y - 6}" width="${b - a}" height="12" rx="6" fill="#7df9ff"/>`;
  let front = '';
  if (open) {
    const [a, b] = open;
    back += `<rect x="${a}" y="${SHIELD_Y - 6}" width="${b - a}" height="${LINE_Y - SHIELD_Y + 6}" fill="#54d678" opacity="0.25"/>`;
    front += `<line x1="${a}" y1="${LINE_Y}" x2="${b}" y2="${LINE_Y}" stroke="#54d678" stroke-width="11"/>`;
    if (!isBand()) front += W.graph.dir === 'right' ? `<path d="M${x2 + 16} ${LINE_Y} l-22 -14 v28 Z" fill="#54d678"/>` : `<path d="M${x1 - 16} ${LINE_Y} l22 -14 v28 Z" fill="#54d678"/>`;
  }
  for (const e of edges) {
    front += `<line x1="${e.x}" y1="${SHIELD_Y - 6}" x2="${e.x}" y2="${LINE_Y}" stroke="#fff" stroke-width="2" stroke-dasharray="5 6" opacity="0.7"/>`;
    if (e.on) front += `<circle cx="${e.x}" cy="${LINE_Y}" r="20" fill="none" stroke="#ffd166" stroke-width="4"/>`;
    front += `<circle cx="${e.x}" cy="${LINE_Y}" r="12" fill="${e.closed ? '#54d678' : '#241a44'}" stroke="${e.closed ? '#eafff0' : '#54d678'}" stroke-width="5"/>`;
    front += `<rect x="${e.x - 30}" y="${LINE_Y + 44}" width="60" height="26" rx="8" fill="#ffd166" stroke="#2b1b2e" stroke-width="3"/><text class="edge-tag" x="${e.x}" y="${LINE_Y + 63}">${fmt(e.v)}</text>`;
  }
  $('gGraph').innerHTML = back;
  $('gEdge').innerHTML = front;
}
/** Hidden rule: what the city did with each test number. ✓ landed, ✕ blocked. */
function drawMarks() {
  const sorted = [...W.marks].sort((a, b) => a.v - b.v);
  $('gMarks').innerHTML = sorted.map((m, i) => {
    const x = X(m.v), y = LINE_Y - 30 - (i % 3) * 19, color = m.ok ? '#7dffa0' : '#ff9a9a';
    return `<line x1="${x}" y1="${y + 5}" x2="${x}" y2="${LINE_Y - 8}" stroke="${color}" stroke-width="2"/><circle cx="${x}" cy="${LINE_Y}" r="5" fill="${color}"/><text class="mark-label" x="${x}" y="${y}" fill="${color}">${fmt(m.v)}${m.ok ? '✓' : '✕'}</text>`;
  }).join('');
}
function podEl(p) {
  const g = document.createElementNS(NS, 'g');
  const zapKey = isZap() ? `<circle cx="-36" cy="-20" r="11" fill="#2b1b2e" stroke="#fff" stroke-width="2"/><text class="key" x="-36" y="-16">${p.i + 1}</text>` : '';
  g.setAttribute('class', `pod${isZap() ? ' zappable' : ''}`);
  g.innerHTML = `<g class="pod-in"><path d="M-9 -19 L0 -34 L9 -19 Z" fill="#ff9f43" stroke="#2b1b2e" stroke-width="3"/><rect class="body" x="-36" y="-20" width="72" height="38" rx="14" fill="#ffd166" stroke="#2b1b2e" stroke-width="3"/><text y="6">${fmt(p.v)}</text>${zapKey}</g>`;
  if (isZap()) g.addEventListener('pointerdown', (e) => { e.stopPropagation(); zap(p); });
  $('gPods').appendChild(g);
  return g;
}
const place = (p) => p.el.setAttribute('transform', `translate(${X(p.v)} ${p.y})`);

function renderSign(isNew = false) {
  const { mode, rule } = W.wave;
  let small = 'ONLY SOLUTIONS MAY LAND', text = `LAND IF  ${rule.sign}`;
  if (rule.kind === 'words') text = `LAND IF ${rule.letter} IS ${rule.sign}`;
  if (rule.kind === 'story') { small = 'WHICH VALUES FIT? ONLY THOSE MAY LAND'; text = rule.sign; }
  if (mode === 'zap') small = 'SHIELD OFFLINE: ZAP EVERYTHING THAT IS NOT A SOLUTION';
  if (mode === 'band') small = 'TWO RULES AT ONCE: A POD MUST FIT BOTH';
  if (mode === 'hidden') {
    small = W.phase === 'probe' ? 'THE RULE IS HIDDEN: DROP PODS TO TEST NUMBERS  ✓ LANDS  ✕ BLOCKED' : 'THE RULE IS HIDDEN';
    text = W.phase === 'probe' ? `FIND THE RULE · ${W.probesLeft} TEST${W.probesLeft === 1 ? '' : 'S'} LEFT` : 'NOW SHADE THE SAME RULE';
  }
  const yourTurn = W.phase === 'orders';
  if (yourTurn) { small = `YOUR TURN ${W.oi + 1}/${W.wave.orders.length} · ${rule.kind === 'story' ? rule.sign : text.replace('LAND IF', 'RULE:')}`; text = W.wave.orders[W.oi].text; }
  $('signSmall').classList.toggle('rule', yourTurn);
  $('signSmall').textContent = small;
  $('signText').textContent = text;
  $('signText').classList.toggle('long', text.length > 30);
  if (isNew) { const s = $('sign'); s.classList.remove('new'); void s.offsetWidth; s.classList.add('new'); }
}
let ctlKey = '';
function renderCtl() {
  const zapMode = isZap(), band = isBand(), g = W.graph, closed = band ? W.band[`${W.active}Closed`] : g && g.closed;
  const pk = picking();
  const go = pk ? (W.drop ? 'FALLING...' : 'DROP YOUR POD (ENTER)') : W.phase === 'prep' ? (G.practice ? 'SEND THE PODS (ENTER)' : `PODS IN ${Math.max(1, Math.ceil(W.prepLeft))} · GO NOW (ENTER)`)
    : W.phase === 'run' ? 'PODS INCOMING' : 'CLEAR';
  const key = [W.wi, zapMode, band, W.active, closed, g && g.dir, go, W.phase].join('|');
  if (key === ctlKey) return;                        // nothing to redraw
  ctlKey = key;
  for (const id of ['leftBtn', 'rightBtn']) $(id).classList.toggle('hidden', zapMode || band || pk);
  for (const id of ['stepL', 'stepR']) $(id).classList.toggle('hidden', zapMode && !pk);
  $('circleBtn').classList.toggle('hidden', zapMode || pk);
  $('switchBtn').classList.toggle('hidden', !band || pk);
  $('zapTip').classList.toggle('hidden', !zapMode || pk);
  $('leftBtn').classList.toggle('on', !band && g && g.dir === 'left');
  $('rightBtn').classList.toggle('on', !band && g && g.dir === 'right');
  $('circleBtn').textContent = closed ? '● SOLID: the edge LANDS' : '○ OPEN: the edge is BLOCKED';
  $('goBtn').textContent = go;
  $('goBtn').disabled = !(W.phase === 'prep' || (pk && !W.drop));
  $('waveTag').textContent = W.waves.length ? `WAVE ${W.wi + 1}/${W.waves.length}` : '';
}

/* ================================================================== */
/* The clock                                                           */
/* ================================================================== */
let last = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  update(dt * W.speed);
  requestAnimationFrame(frame);
}
// Something to look at behind the briefing.
W.wave = { mode: 'graph', rule: { kind: 'plain', letter: 'x', sym: '≤', n: 12, sign: 'x ≤ 12', range: { lo: 2, hi: 22, step: 1 } }, pods: [], prep: 9 };
W.graph = { edge: 12, dir: 'left', closed: true };
drawBase(); drawGraph(); renderSign(); renderCtl();
requestAnimationFrame(frame);
