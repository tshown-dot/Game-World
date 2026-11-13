// Trail Mapper (Lesson 4-10: Relate Tables, Graphs, and Equations): the screen and the controls.
// The math is in trail.js. The shared parts of an action game (briefing, top bar, canteens, hint card, report) are in
// shared/game/arcadeShell.js.
//
// The map (a first-quadrant graph) is the playfield. A zone is a list of ROUNDS (see trail.js):
//   stake  put stakes on the map for the logbook's rows, then the scout walks the real trail
//   drop   slide a pointer along an axis to read the map, then the scout walks to that point
//   rule   set the rule on two dials, then a second scout walks that rule over the map's trail
// All timing goes through update(), so the action stops cleanly whenever a banner, hint, help screen or mistake
// message is showing.
import { createArcade } from '../../../../shared/game/arcadeShell.js';
import {
  ZONES, DIALS, genZone, genDrop, run, fmt, pair, ruleText, snap, near, checkStakes, stakeAnswer, checkDrop, dropAnswer,
  ruleFromDials, dialsOf, checkRule, ruleAnswer,
} from './trail.js';

const BOSS = ZONES.length - 1;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Everything about the round being played.
const W = {
  rounds: [], ri: 0, round: null, phase: 'idle',    // phase: idle, stake, drop, rule, run, hold, gap
  stakes: [], cur: { x: 0, y: 0 },                  // stake: the student's stakes, and the keyboard cursor
  pv: 0,                                            // drop: where the pointer is on its axis
  mi: 1, b: 0,                                      // rule: the two dials (mi is a place in DIALS.m)
  shown: {},                                        // what the scout has shown so far: rows, guide, trail, ghost
  anim: null, tries: 0,
  gapLeft: 0, frozen: false, afterResume: null, speed: 1,
};

const HINTS = {
  swapped: 'A point is (across, up). The first number is always the one along the bottom.<span class="mono">(2, 6) : 2 across, then 6 up</span>',
  scale: 'Squares are not always worth 1. Read the numbers printed on the axis.<span class="mono">0, 5, 10, 15 : each square is 5</span>',
  times_plus: 'A number written next to a letter means TIMES.<span class="mono">3x : 3 times x</span><span class="mono">x + 3 : 3 more than x</span>',
  forgot_start: 'Some trails do not start at 0. Find where the trail is when x = 0: that is the number the rule adds.<span class="mono">y = 2x + 3 starts at 3</span>',
  off: 'Check one point at a time: put the x into the rule, work out y, then go x across and y up.',
  wrong_axis: 'To read a map, start on the axis you KNOW, go to the trail, then turn to the other axis.<span class="mono">x known: up, then across</span><span class="mono">y known: across, then down</span>',
  steep: 'How steep a trail is comes from the TIMES number: how much y goes up each time x goes up by 1.',
};
const TIPS = {
  swapped: 'In an ordered pair (x, y), x goes across and y goes up.',
  scale: 'Check the scale on each axis before plotting or reading a point.',
  times_plus: '3x means 3 times x; x + 3 means 3 more than x.',
  forgot_start: 'In y = 2x + 3, the 3 is the value of y when x is 0.',
  off: 'Substitute x into the equation to find y, then plot (x, y).',
  wrong_axis: 'To read a graph, start from the known value on its own axis.',
  steep: 'The number multiplying x tells how much y changes when x goes up by 1.',
};

const arcade = createArcade({
  zones: ZONES, startZone, stopZone, onKey, hints: HINTS, skillTips: TIPS, testName: '__trail',
  perfectText: 'Every trail mapped: no mistakes to sharpen!',
  lifeLostText: (left) => (left > 0 ? `A CANTEEN IS EMPTY! ${left} LEFT` : 'TRIP OVER'),
});
const { G, hubAudio } = arcade;
if (window.__trail) window.__trail.W = W;
const busy = () => W.frozen || arcade.paused();

/* ================================================================== */
/* Zones and rounds                                                    */
/* ================================================================== */
function startZone(z) {
  W.rounds = genZone(Math.random, z);
  startRound(0);
}
function stopZone() {
  Object.assign(W, { phase: 'idle', frozen: false, afterResume: null, anim: null });
  $('callout').classList.add('hidden');
}
function startRound(i) {
  const p = W.rounds[i];
  Object.assign(W, { ri: i, round: p, tries: 0, anim: null, frozen: false, afterResume: null, shown: {}, phase: p.type });
  if (G.zone === BOSS) arcade.setBossProgress((i / W.rounds.length) * 100);
  if (p.type === 'stake') { W.stakes = p.preset.map((q) => ({ ...q })); W.cur = { x: p.grid.xStep * 5, y: p.grid.yStep * 5 }; }
  if (p.type === 'drop') { const step = p.backward ? p.grid.xStep : p.grid.yStep, mid = step * 5; W.pv = near(mid, p.answer) ? step * 3 : mid; }   // never start on the answer
  if (p.type === 'rule') { W.mi = 1; W.b = 0; }      // the dials start at y = x
  showLine('');
  renderSign(true); renderSide(); renderCtl(); draw();
}
function rest(seconds) { W.phase = 'gap'; W.gapLeft = seconds; renderCtl(); }
function endRound() { rest(0.7); }
function nextRound() {
  if (W.ri + 1 < W.rounds.length) return startRound(W.ri + 1);
  W.phase = 'idle';
  if (G.zone === BOSS) arcade.setBossProgress(100);
  arcade.zoneCleared();
}
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
function showLine(text, off = false) { $('tline').textContent = text; $('tline').classList.toggle('off', off); }
/** A mistake. First time: try again. Second time: the answer is shown and the round moves on. */
function miss(res, { answer, retry, show = null }) {
  W.tries += 1; W.phase = 'hold';
  arcade.bad(res.key, 25);
  if (W.phase === 'idle') return;                    // that was the last canteen: the zone has stopped
  const moveOn = W.tries >= 2;
  if (moveOn && show) show();
  stopFor(res.message + (moveOn ? ` ${answer}` : ''), moveOn ? 'NEXT (ENTER)' : 'TRY AGAIN (ENTER)', moveOn ? endRound : retry);
  renderCtl();
}

/* ================================================================== */
/* The map                                                             */
/* ================================================================== */
const OX = 64, OY = 420, SQ = 40;                    // where (0, 0) is in the drawing, and the size of a square
const PX = (x) => OX + (x / W.round.grid.xStep) * SQ;
const PY = (y) => OY - (y / W.round.grid.yStep) * SQ;
/** The ends of a rule's trail on this map: from where it enters to where it leaves (or to `to`, for a buried trail). */
function trailEnds(rule, to = null) {
  const { grid } = W.round, pts = [];
  for (let k = 0; k <= 100; k++) { const x = (grid.xMax * k) / 100, y = run(rule, x); if (y >= -1e-6 && y <= grid.yMax + 1e-6 && (to === null || x <= to + 1e-6)) pts.push({ x, y }); }
  return pts.length ? [pts[0], pts[pts.length - 1]] : null;
}
const line = (a, b, cls) => `<line class="${cls}" x1="${PX(a.x)}" y1="${PY(a.y)}" x2="${PX(b.x)}" y2="${PY(b.y)}"/>`;
const flag = (q, cls) => `<g class="flag ${cls}" transform="translate(${PX(q.x)},${PY(q.y)})"><line y2="-24"/><path d="M0,-24 L17,-18 L0,-12 Z"/><circle r="4.5"/></g>`;
function draw() {
  const p = W.round, { grid } = p, S = W.shown, out = [];
  for (let k = 0; k <= 10; k++) {
    out.push(`<line class="gl" x1="${OX + k * SQ}" y1="${OY}" x2="${OX + k * SQ}" y2="${OY - 10 * SQ}"/><line class="gl" x1="${OX}" y1="${OY - k * SQ}" x2="${OX + 10 * SQ}" y2="${OY - k * SQ}"/>`);
    const xv = k * grid.xStep, yv = k * grid.yStep;
    const xKnown = p.type === 'drop' && !p.backward && near(xv, p.given), yKnown = p.type === 'drop' && p.backward && near(yv, p.given);
    out.push(`<text class="al ${xKnown ? 'known' : ''}" x="${OX + k * SQ}" y="${OY + 18}" text-anchor="middle">${fmt(xv)}</text><text class="al ${yKnown ? 'known' : ''}" x="${OX - 9}" y="${OY - k * SQ + 5}" text-anchor="end">${fmt(yv)}</text>`);
  }
  out.push(`<line class="ax" x1="${OX}" y1="${OY}" x2="${OX + 10 * SQ}" y2="${OY}"/><line class="ax" x1="${OX}" y1="${OY}" x2="${OX}" y2="${OY - 10 * SQ}"/>`);
  out.push(`<text class="an" x="${OX + 5 * SQ}" y="${OY + 42}" text-anchor="middle">${esc(p.X)} = ${esc(p.xName)}</text><text class="an" transform="translate(13,${OY - 5 * SQ}) rotate(-90)" text-anchor="middle">${esc(p.Y)} = ${esc(p.yName)}</text>`);
  // the map's own trail: drawn from the start for drop and rule rounds, and as far as the scout has walked for stakes
  const upTo = p.type === 'stake' ? (S.walked ?? -1) : p.rocks && !S.cleared ? p.seen : null;
  const ends = upTo === null || upTo >= 0 ? trailEnds(p.rule, upTo) : null;
  if (ends) out.push(line(ends[0], ends[1], 'trail'));
  if (p.type !== 'stake') for (const r of p.rows) if (!p.rocks || S.cleared || r.x <= p.seen) out.push(`<circle class="dot" cx="${PX(r.x)}" cy="${PY(r.y)}" r="5.5"/>`);
  if (p.rocks && !S.cleared) out.push(`<rect class="rocks" x="${PX(p.seen) + 8}" y="${OY - 10 * SQ}" width="${OX + 10 * SQ - PX(p.seen) - 8}" height="${10 * SQ}" rx="10"/><text class="rocktext" x="${(PX(p.seen) + 8 + OX + 10 * SQ) / 2}" y="${OY - 5 * SQ}" text-anchor="middle">ROCKSLIDE</text>`);
  if (S.ghost) { const g = trailEnds(S.ghost.rule, S.ghost.to); if (g) out.push(line(g[0], g[1], 'ghost')); }
  if (S.guide) { const a = p.ask; out.push(`<polyline class="guide" points="${p.backward ? `${OX},${PY(a.y)} ${PX(a.x)},${PY(a.y)} ${PX(a.x)},${OY}` : `${PX(a.x)},${OY} ${PX(a.x)},${PY(a.y)} ${OX},${PY(a.y)}`}"/><circle class="dot hit" cx="${PX(a.x)}" cy="${PY(a.y)}" r="7"/>`); }
  if (p.type === 'stake') {
    for (const q of p.fixed) out.push(flag(q, 'given'));
    for (const r of p.want) if (S.rows && S.rows[r.x] && !W.stakes.some((q) => near(q.x, r.x) && near(q.y, r.y))) out.push(`<circle class="spot" cx="${PX(r.x)}" cy="${PY(r.y)}" r="9"/>`);
    for (const q of W.stakes) { const on = p.want.some((r) => near(q.x, r.x) && near(q.y, r.y)); out.push(flag(q, S.judged ? (on ? 'lit' : 'bad') : '')); }
    if (W.phase === 'stake') out.push(`<circle class="cursor" cx="${PX(W.cur.x)}" cy="${PY(W.cur.y)}" r="13"/>`);
  }
  if (p.type === 'drop') {
    const tip = p.backward ? `${PX(W.pv)},${OY + 3} ${PX(W.pv) - 11},${OY + 24} ${PX(W.pv) + 11},${OY + 24}` : `${OX - 3},${PY(W.pv)} ${OX - 24},${PY(W.pv) - 11} ${OX - 24},${PY(W.pv) + 11}`;
    out.push(`<polygon class="pointer ${S.guide ? (near(W.pv, p.answer) ? 'lit' : 'bad') : ''}" points="${tip}"/>`);
  }
  if (S.scout) out.push(`<circle class="scout" cx="${PX(S.scout.x)}" cy="${PY(S.scout.y)}" r="9"/>`);
  if (S.runner) out.push(`<circle class="scout mine" cx="${PX(S.runner.x)}" cy="${PY(Math.min(grid.yMax, Math.max(0, S.runner.y)))}" r="8"/>`);
  $('map').innerHTML = out.join('');
}
/** A tap on the map, as numbers on the two axes (snapped to the nearest crossing). */
function mapPoint(e) {
  const box = $('map').getBoundingClientRect(), { grid } = W.round;
  const sx = ((e.clientX - box.left) / box.width) * 500, sy = ((e.clientY - box.top) / box.height) * 470;
  return snap(grid, ((sx - OX) / SQ) * grid.xStep, ((OY - sy) / SQ) * grid.yStep);
}
$('map').addEventListener('pointerdown', (e) => {
  if (busy()) return;
  const q = mapPoint(e);
  if (W.phase === 'stake') { W.cur = q; toggleStake(); }
  else if (W.phase === 'drop') setPointer(W.round.backward ? q.x : q.y);
});

/* ================================================================== */
/* The rule card, the logbook and the dials                            */
/* ================================================================== */
function renderSide() {
  const p = W.round, S = W.shown, mine = ruleFromDials(DIALS.m[W.mi], W.b);
  $('ruleHead').textContent = p.type === 'rule' ? 'YOUR RULE' : 'THE RULE';
  $('ruleText').textContent = p.type === 'rule' ? ruleText(mine, p.X, p.Y) : p.type === 'drop' ? 'read it from the map' : p.hidden ? `${p.Y} = ? ? ?` : ruleText(p.rule, p.X, p.Y);
  $('ruleText').classList.toggle('quiet', p.type === 'drop');
  $('ruleKey').textContent = `${p.X} = ${p.xName} · ${p.Y} = ${p.yName}`;
  $('logX').textContent = p.X; $('logY').textContent = p.Y;
  $('logMine').classList.toggle('hidden', !S.mine);
  let rows;
  if (p.type === 'stake') rows = p.rows.map((r) => [fmt(r.x), p.fixed.includes(r) || (S.rows && S.rows[r.x]) ? fmt(r.y) : '?']);
  else if (p.type === 'drop') rows = [p.backward ? [S.guide ? fmt(p.ask.x) : `? (you: ${fmt(W.pv)})`, fmt(p.ask.y)] : [fmt(p.ask.x), S.guide ? fmt(p.ask.y) : `? (you: ${fmt(W.pv)})`]];
  else rows = p.rows.map((r) => [fmt(r.x), fmt(r.y), S.mine && S.mine[r.x] !== undefined ? fmt(S.mine[r.x]) : '']);
  $('logRows').innerHTML = rows.map((c) => `<tr><td>${esc(c[0])}</td><td>${esc(c[1])}</td>${S.mine ? `<td class="${c[2] === '' ? '' : c[2] === c[1] ? 'yes' : 'no'}">${esc(c[2])}</td>` : ''}</tr>`).join('');
  $('dials').classList.toggle('hidden', p.type !== 'rule');
  $('dialM').textContent = `× ${fmt(DIALS.m[W.mi])}`; $('dialB').textContent = W.b < 0 ? `− ${fmt(-W.b)}` : `+ ${fmt(W.b)}`;
}
$('dials').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.blur(); turnDial(b.dataset.dial, Number(b.dataset.by)); });

/* ================================================================== */
/* Stake: stakes on the map, then the scout walks the trail            */
/* ================================================================== */
function moveCursor(dx, dy) {
  const { grid } = W.round;
  if (W.phase !== 'stake' || busy()) return;
  W.cur = snap(grid, W.cur.x + dx * grid.xStep, W.cur.y + dy * grid.yStep);
  draw();
}
function toggleStake() {
  const p = W.round, q = W.cur;
  if (W.phase !== 'stake' || busy()) return;
  if (p.fixed.some((f) => near(f.x, q.x) && near(f.y, q.y))) return;
  const at = W.stakes.findIndex((s) => near(s.x, q.x) && near(s.y, q.y));
  if (at >= 0) W.stakes.splice(at, 1);
  else if (W.stakes.length >= p.want.length) return showLine('All your stakes are on the map. Tap one to pick it up first.', true);
  else W.stakes.push({ x: q.x, y: q.y });
  hubAudio.playStep(); showLine(''); W.shown = {}; draw();
}
function goStake() {
  const p = W.round, res = checkStakes(p, W.stakes);
  if (res.nudge) return showLine(res.message, true);
  const stops = [...p.rows].sort((a, c) => a.x - c.x), from = Math.min(0, stops[0].x), to = stops[stops.length - 1].x;
  W.shown = { rows: {}, walked: from };
  walk({ from, to, seconds: 0.3 + 0.32 * stops.length, step: (x) => {
    W.shown.walked = x;
    for (const r of stops) if (r.x <= x + 1e-6 && !W.shown.rows[r.x]) { W.shown.rows[r.x] = true; hubAudio.playStep(); renderSide(); }
  } }, () => {
    W.shown.judged = true; W.shown.scout = null; draw();
    if (res.ok) { for (let k = 0; k < p.want.length; k++) arcade.good(10); hubAudio.playCoinClink(); showLine(res.message); return rest(1.3); }
    miss(res, { answer: stakeAnswer(p), retry: () => { W.phase = 'stake'; W.shown = {}; renderSide(); renderCtl(); draw(); },
      show: () => { W.stakes = p.want.map((r) => ({ x: r.x, y: r.y })); draw(); } });
  });
}
/** The scout walks the round's rule from x = from to x = to. step(x) is called as it goes. */
function walk({ from, to, seconds, step, rule = W.round.rule, mine = false }, done) {
  W.phase = 'run'; W.anim = { from, to, seconds, t: 0, step, rule, mine, done };
  hubAudio.playCartridgeLaunch(); renderCtl();
}
function updateRun(dt) {
  const A = W.anim;
  A.t += dt;
  const u = Math.min(1, A.t / A.seconds), x = A.from + (A.to - A.from) * u;
  W.shown[A.mine ? 'runner' : 'scout'] = { x, y: run(A.rule, x) };
  A.step(x);
  draw();
  if (u < 1) return;
  W.anim = null;
  A.done();
}

/* ================================================================== */
/* Drop: read the map with a pointer on an axis                        */
/* ================================================================== */
function setPointer(v) {
  const p = W.round, { grid } = p;
  if (W.phase !== 'drop' || busy()) return;
  const step = p.backward ? grid.xStep : grid.yStep, max = p.backward ? grid.xMax : grid.yMax;
  v = Math.min(max, Math.max(0, Math.round(v / step) * step));
  if (near(v, W.pv)) return;
  W.pv = v; hubAudio.playStep(); showLine(''); renderSide(); draw();
}
function goDrop() {
  const p = W.round, res = checkDrop(p, W.pv), ends = trailEnds(p.rule);
  W.shown = { cleared: true };
  walk({ from: ends[0].x, to: p.ask.x, seconds: 0.9, step: () => {} }, () => {
    W.shown.guide = true; renderSide(); draw();
    if (res.ok) { arcade.good(15); hubAudio.playCoinClink(); showLine(res.message); return rest(1.3); }
    W.phase = 'hold';
    arcade.bad(res.key, 25);
    if (W.phase === 'idle') return;
    // The scout has shown the answer, so there is no second try: another reading of the same kind comes next.
    stopFor(`${res.message} ${dropAnswer(p)}`, 'NEXT (ENTER)', () => {
      if (!p.backup) W.rounds.splice(W.ri + 1, 0, { ...genDrop(Math.random, undefined, { backward: p.backward }), backup: true });
      endRound();
    });
    renderCtl();
  });
}

/* ================================================================== */
/* Rule: set the dials, then race the map's trail                      */
/* ================================================================== */
function turnDial(which, by) {
  if (W.phase !== 'rule' || busy()) return;
  if (which === 'm') W.mi = Math.min(DIALS.m.length - 1, Math.max(0, W.mi + by));
  else W.b = Math.min(DIALS.b.hi, Math.max(DIALS.b.lo, W.b + by));
  hubAudio.playStep(); showLine(''); W.shown = {}; renderSide(); draw();
}
function goRule() {
  const p = W.round, res = checkRule(p, DIALS.m[W.mi], W.b), { grid } = p;
  W.shown = { ghost: { rule: res.mine, to: 0 }, mine: {} };
  walk({ from: 0, to: grid.xMax, seconds: 1.4, rule: res.mine, mine: true, step: (x) => {
    W.shown.ghost.to = x;
    for (const r of p.rows) if (r.x <= x + 1e-6 && W.shown.mine[r.x] === undefined) { W.shown.mine[r.x] = run(res.mine, r.x); hubAudio.playStep(); renderSide(); }
  } }, () => {
    W.shown.runner = null; draw();
    if (res.ok) { arcade.good(15); hubAudio.playCoinClink(); showLine(res.message); return rest(1.4); }
    miss(res, { answer: ruleAnswer(p), retry: () => { W.phase = 'rule'; W.shown = {}; renderSide(); renderCtl(); draw(); },
      show: () => { const d = dialsOf(p.rule); W.mi = DIALS.m.indexOf(d.m); W.b = d.b; W.shown = { ghost: { rule: p.rule, to: grid.xMax } }; renderSide(); draw(); } });
  });
}

/* ================================================================== */
/* The clock, keys, sign and the bottom bar                            */
/* ================================================================== */
function update(dt) {
  if (W.phase === 'idle' || busy()) return;
  if (W.phase === 'gap') { W.gapLeft -= dt; if (W.gapLeft <= 0) nextRound(); return; }
  if (W.phase === 'run') updateRun(dt);
}
const GO = { stake: goStake, drop: goDrop, rule: goRule };
function go() { if (!busy() && GO[W.phase]) GO[W.phase](); }
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
function onKey(e) {
  const k = e.key;
  if (k === 'Enter') { e.preventDefault(); if (W.frozen) resume(); else go(); return; }
  if (W.frozen) return;
  if (k === ' ' && W.phase === 'stake') { e.preventDefault(); toggleStake(); return; }
  const a = ARROWS[k];
  if (!a) return;
  e.preventDefault();
  const jump = e.shiftKey ? 5 : 1, { grid } = W.round;
  if (W.phase === 'stake') moveCursor(a[0] * jump, a[1] * jump);
  else if (W.phase === 'drop') { const d = W.round.backward ? a[0] * grid.xStep : a[1] * grid.yStep; if (d) setPointer(W.pv + d * jump); }
  else if (W.phase === 'rule') { if (a[0]) turnDial('m', a[0]); else turnDial('b', a[1] * jump); }
}
$('goBtn').addEventListener('click', (e) => { e.currentTarget.blur(); go(); });
$('resumeBtn').addEventListener('click', (e) => { e.currentTarget.blur(); resume(); });

function renderSign(isNew = false) {
  const p = W.round, at = `${W.ri + 1}/${W.rounds.length}`;
  let small = `TRAIL ${at} · RULE TO MAP`, text = 'PUT A STAKE ON THE MAP FOR EVERY ROW OF THE LOGBOOK';
  if (p.fix) { small = `TRAIL ${at} · CHECK THE MAP`; text = 'ONE STAKE IS OFF THE TRAIL. PICK IT UP AND MOVE IT'; }
  else if (p.hidden) { small = `TRAIL ${at} · THE RULE IS BURIED`; text = 'CARRY THE TRAIL ON FROM THE TWO GRAY STAKES'; }
  else if (p.type === 'drop') {
    small = `TRAIL ${at} · ${p.rocks ? 'THE REST IS BURIED' : 'READ THE MAP'}`;
    text = p.backward ? `THE TRAIL REACHES ${p.Y} = ${fmt(p.given)}. SLIDE THE POINTER TO THAT ${p.X}` : `WHEN ${p.X} = ${fmt(p.given)}, HOW HIGH IS THE TRAIL? SLIDE THE POINTER`;
  } else if (p.type === 'rule') { small = `TRAIL ${at} · MAP TO RULE`; text = 'SET THE RULE THAT MAKES THIS TRAIL'; }
  $('signSmall').textContent = small;
  $('signText').textContent = text;
  if (isNew) { const s = $('sign'); s.classList.remove('new'); void s.offsetWidth; s.classList.add('new'); }
}
function renderCtl() {
  const ph = W.phase;
  const label = { stake: 'SEND THE SCOUT (ENTER)', drop: 'SEND THE SCOUT (ENTER)', rule: 'RACE THE MAP (ENTER)' }[ph];
  $('goBtn').classList.toggle('hidden', !label);
  $('goBtn').textContent = label || '';
  $('tip').textContent = { stake: 'Tap a crossing to put a stake there (tap it again to pick it up). Arrows move, Space stakes.',
    drop: W.round && W.round.backward ? 'Tap the map, or ← → to slide the pointer.' : 'Tap the map, or ↑ ↓ to slide the pointer.',
    rule: '← → the TIMES dial · ↑ ↓ the PLUS dial' }[ph] || '';
  $('waveTag').textContent = W.rounds.length ? `ROUND ${W.ri + 1}/${W.rounds.length}` : '';
}

let last = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  update(dt * W.speed);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
