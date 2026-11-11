// Ride Gate (Lesson 4-6): the gate screen and controls. The math lives in gate.js;
// zones, timer, lives, scoring and the report come from the shared game shell (shared/game/gameShell.js).
//
// Problem types: write (build a rule with tiles), rider (let in or turn away), line (build a number line),
// readline (pick the rule a number line shows) and pick (who is right?).
import {
  ZONES, SYMS, fmt, ruleText, passes, genZone, genBackup, tilesText, checkWritten, checkRider, checkLine, checkPick, workedSolution,
} from './gate.js';
import { hubAudio } from '../../../../shared/audio.js';
import { createGame } from '../../../../shared/game/gameShell.js';
import { dragOrTap, inside } from '../../../../shared/game/drag.js';

const SKILL_TIPS = {
  boundary: '"At least" and "at most" include the number (≥, ≤); "more than" and "less than" do not (>, <).',
  direction: 'Read the rule aloud: "h is greater than or equal to 42". The open side of the symbol faces the bigger value.',
  flipped_order: 'With the number first, turn the symbol around: h ≥ 42 is 42 ≤ h.',
  not_equal: '"Is not" means ≠: every value except that one.',
  wrong_number: 'The number on the sign is the boundary.',
  other_side: 'The values a rule leaves out are on the other side, and the boundary flips (≥ becomes <).',
  calc_first: 'When a sign needs math, work out the boundary first.',
  boundary_rider: 'A rider exactly on the boundary: check whether the symbol includes it.',
  rider_wrong: 'Put the rider\'s value into the rule and ask: true or false?',
  line_number: 'The post (circle) goes on the boundary number.',
  line_circle: 'Closed circle ● for ≤ and ≥; open circle ○ for < and >.',
  line_direction: 'Greater points right, less points left.',
  who_is_right: 'A rule can be written either way round if the symbol turns too.',
};

const shell = createGame({
  zones: ZONES, makeZone: genZone, makeBackup: genBackup, workedSolution, showProblem,
  seconds: [50, 35, 55, 60, 70],                       // patience: seconds until the crowd gets angry, per zone
  meterFloor: 8, wrongBump: 30, rightRelief: 25, pauseOnBanner: true,
  lifeLostText: (left) => (left > 0 ? 'THE CROWD IS ANGRY!' : 'RIDE SHUT DOWN!'),
  bossHitText: 'OPEN!', winDelay: (p) => (p.type === 'rider' ? 1100 : 1500),
  skillTips: SKILL_TIPS, perfectText: 'No mistakes to sharpen. Gatekeeper of the year!',
  lettersAreInput: () => G.problem?.type === 'write', onKey, testName: '__gate',
});
const { G, UI, $, win, miss, showFeedback } = shell;
Object.assign(G, { rail: [], used: [], line: { at: 0, closed: false, dir: null }, tried: [] });

/* ================================================================== */
/* Drawing                                                             */
/* ================================================================== */
const K = '#1d1433';
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round"`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const UNIT = { h: 'in', a: 'yrs', r: '', p: 'people', w: 'lb', s: 'mph', t: 'min' };

function backdrop() {
  return `
    <path d="M0 470 H800 V520 H0 Z" fill="#a9512b"/><path d="M0 470 H800" stroke="${K}" stroke-width="3"/>
    <g opacity="0.85"><path d="M380 300 Q470 60 560 300 Q620 140 700 300" fill="none" stroke="#e5484d" stroke-width="10"/>
      <path d="M380 300 Q470 60 560 300 Q620 140 700 300" fill="none" stroke="${K}" stroke-width="3" stroke-dasharray="2 14"/>
      ${[400, 450, 500, 590, 640, 690].map((x) => `<path d="M${x} 300 V470" stroke="#8a5a2b" stroke-width="6"/>`).join('')}</g>`;
}
/** The sign board above the gate, with the rule plate under it. */
function signBoard(sign, plate, plateColor = '#fff4d6') {
  const words = String(sign).split(' ');
  const lines = [];
  for (const w of words) { const last = lines[lines.length - 1]; if (last && (`${last} ${w}`).length <= 26) lines[lines.length - 1] = `${last} ${w}`; else lines.push(w); }
  return `<g>
    <path d="M70 240 V470 M330 240 V470" stroke="#8a5a2b" stroke-width="10"/>
    <rect x="40" y="30" width="320" height="${46 + lines.length * 24}" rx="10" fill="#ffd23f" ${O}/>
    ${lines.map((l, i) => `<text x="200" y="${64 + i * 24}" text-anchor="middle" font-size="15" font-weight="900" fill="${K}" font-family="'Press Start 2P', monospace">${esc(l)}</text>`).join('')}
    <rect x="90" y="${100 + lines.length * 24}" width="220" height="54" rx="10" fill="${plateColor}" ${O}/>
    <text x="200" y="${137 + lines.length * 24}" text-anchor="middle" font-size="30" font-weight="900" fill="${K}" font-family="ui-monospace, monospace">${esc(plate)}</text>
  </g>`;
}
function rider(r, v, cls) {
  const label = r.letter === 'r' ? `RIDE ${fmt(v)}` : `${fmt(v)} ${UNIT[r.letter] || ''}`;
  const tall = r.letter === 'h' ? Math.max(70, Math.min(140, v * 2.2)) : 100;
  const shirt = ['#3a8ef0', '#7b4bff', '#2fbf71', '#ff9f43'][Math.round(v) % 4];
  return `<g class="${cls}"><g transform="translate(470 470)">
    <ellipse cx="0" cy="0" rx="24" ry="6" fill="rgba(0,0,0,0.2)"/>
    <rect x="-17" y="${-tall + 18}" width="34" height="${tall - 18}" rx="12" fill="${shirt}" ${O}/>
    <circle cx="0" cy="${-tall}" r="18" fill="#ffd3a8" ${O}/><circle cx="-6" cy="${-tall - 2}" r="3" fill="${K}"/><circle cx="6" cy="${-tall - 2}" r="3" fill="${K}"/>
    <g transform="translate(0 ${-tall - 52})"><rect x="-56" y="-18" width="112" height="34" rx="8" fill="#fff" ${O}/>
      <text x="0" y="6" text-anchor="middle" font-size="18" font-weight="900" fill="${K}" font-family="ui-monospace, monospace">${esc(label)}</text></g>
  </g></g>`;
}
function gateBar(open) {
  return `<g transform="translate(330 380)"><rect x="-12" y="-10" width="24" height="90" rx="5" fill="#6b6f80" ${O}/>
    <g class="bar-up ${open ? 'open' : ''}"><rect x="0" y="-8" width="120" height="16" rx="6" fill="#e5484d" ${O}/>
    <path d="M24 -8 l12 16 M56 -8 l12 16 M88 -8 l12 16" stroke="#fff" stroke-width="5"/></g></g>`;
}
function drawGate({ sign, plate, plateColor, rider: rv = null, riderClass = 'walk-up', open = false }) {
  const p = G.problem;
  UI.scene.innerHTML = `${backdrop()}${signBoard(sign, plate, plateColor)}${gateBar(open)}${rv !== null ? rider(p.rule, rv, riderClass) : ''}`;
}
/** The number line: ticks from lo to hi, a post at `at`, an open or closed circle, an arrow. */
function drawLine({ rule, at, closed, dir, interactive = false }) {
  const lo = Math.round(rule.n) - 6, hi = Math.round(rule.n) + 6;
  const X = (v) => 80 + ((v - lo) / (hi - lo)) * 640;
  const y = 330;
  let ticks = '';
  for (let v = lo; v <= hi; v++) {
    ticks += `<g ${interactive ? `class="tick-hit" data-tick="${v}"` : ''}><rect x="${X(v) - 24}" y="${y - 40}" width="48" height="90" fill="transparent"/>
      <path d="M${X(v)} ${y - 10} V${y + 10}" stroke="${K}" stroke-width="3"/>
      <text x="${X(v)}" y="${y + 36}" text-anchor="middle" font-size="16" font-weight="900" fill="${K}" font-family="ui-monospace, monospace">${v}</text></g>`;
  }
  const arrow = dir ? `<path d="M${X(at)} ${y} H${dir === 'right' ? 760 : 40}" stroke="#3a8ef0" stroke-width="10" stroke-linecap="round"/>
    <path d="${dir === 'right' ? `M760 ${y} l-22 -14 v28 Z` : `M40 ${y} l22 -14 v28 Z`}" fill="#3a8ef0" ${O}/>` : '';
  const post = at !== null ? `<circle class="pop-in" cx="${X(at)}" cy="${y}" r="15" fill="${closed ? '#3a8ef0' : '#fff'}" stroke="#1f63c9" stroke-width="5"/>` : '';
  UI.scene.innerHTML = `${backdrop()}
    <rect x="30" y="${y - 70}" width="740" height="140" rx="14" fill="#fff4d6" ${O}/>
    <path d="M40 ${y} H760" stroke="${K}" stroke-width="4"/>
    ${arrow}${ticks}${post}`;
  if (interactive) UI.scene.querySelectorAll('[data-tick]').forEach((t) => t.addEventListener('click', () => setPost(Number(t.dataset.tick))));
}
function strip(lines) {
  const el = $('eqStrip');
  if (!el) return;
  el.classList.remove('hidden');
  el.innerHTML = lines.map((l) => `<div class="eq-line ${l.small ? 'small' : ''}">${l.html ?? esc(l)}</div>`).join('');
}

/* ================================================================== */
/* Problems                                                            */
/* ================================================================== */
const TAGS = { write: 'WRITE THE GATE RULE', rider: 'LET IN OR TURN AWAY?', line: 'BUILD THE NUMBER LINE', readline: 'READ THE NUMBER LINE', pick: 'WHO IS RIGHT?' };
function showProblem(p, isBackup) {
  Object.assign(G, { rail: [], used: [], tried: [], line: { at: Math.round(p.rule.n) - 3, closed: false, dir: null } });
  const tag = p.type === 'write' ? (p.other ? 'THE OTHER SIDE' : p.two ? 'TWO LETTERS' : p.calc ? 'WORK OUT THE RULE' : TAGS.write) : TAGS[p.type];
  UI.taskTag.textContent = `${tag}${isBackup ? ' · BACKUP' : ''}`;
  renderPrompt();
  renderControls();
  showState();
}
function renderPrompt() {
  const p = G.problem, r = p.rule;
  let html;
  if (p.type === 'write') html = p.other || p.two || p.calc || !r.sign
    ? `<span class="story" style="display:block;font-size:15px;background:#fff;border:3px solid var(--ink);border-radius:10px;padding:7px 10px">${esc(p.ask)}</span>`
    : `${esc(p.ask)} Build it with the tiles.`;
  else if (p.type === 'rider') html = `A rider walks up. The rule is <b>${esc(ruleText(r))}</b>. Let them in, or turn them away?`;
  else if (p.type === 'line') html = `Build the number line for the gate rule.<span class="eq">${esc(ruleText(r))}</span>`;
  else if (p.type === 'readline') html = 'Which rule does this number line show?';
  else html = `<span style="display:block;font-size:15px;background:#fff;border:3px solid var(--ink);border-radius:10px;padding:7px 10px">${esc(p.ask)}</span>`;
  UI.prompt.innerHTML = html;
}
function showState() {
  const p = G.problem, r = p.rule;
  if (p.type === 'write') {
    const sign = p.calc || p.two || (p.ask && !r.sign) ? '' : (p.shown || r).sign;
    drawGate({ sign: sign || 'WHAT IS THE RULE?', plate: G.rail.length ? tilesText(G.rail) : '? ? ?' });
    strip([{ html: G.rail.length ? esc(tilesText(G.rail)) : 'Build the rule with the tiles.', small: !G.rail.length }]);
  } else if (p.type === 'rider') {
    drawGate({ sign: r.sign, plate: ruleText(r), rider: p.v });
    strip([`${ruleText(r)}`, { html: `${fmt(p.v)} ${r.sym} ${fmt(r.n)} ?`, small: true }]);
  } else if (p.type === 'line') {
    drawLine({ rule: r, at: G.line.at, closed: G.line.closed, dir: G.line.dir, interactive: true });
    strip([ruleText(r), { html: 'Tap a number for the post, then choose the circle and the arrow.', small: true }]);
  } else if (p.type === 'readline') {
    drawLine({ rule: r, at: r.n, closed: r.sym === '≥' || r.sym === '≤', dir: r.sym === '>' || r.sym === '≥' ? 'right' : 'left' });
    strip([{ html: 'Open or closed circle? Which way is the arrow?', small: true }]);
  } else {
    drawGate({ sign: r.sign, plate: '?' });
    strip([`Elias: ${p.elias}`, `Nina: ${p.nina}`]);
  }
}

/* ================================================================== */
/* Controls                                                            */
/* ================================================================== */
function renderControls() {
  const p = G.problem;
  if (p.type === 'rider') {
    UI.controls.innerHTML = `<div class="stamps rider-btns"><button type="button" class="stamp no px" data-let="0">◀ TURN AWAY</button><button type="button" class="stamp yes px" data-let="1">LET IN ▶</button></div>
      <div class="help-line">Put the rider's value into the rule: true or false? Keys: <kbd>←</kbd> <kbd>→</kbd></div>`;
    UI.controls.querySelectorAll('[data-let]').forEach((b) => b.addEventListener('click', () => answerRider(b.dataset.let === '1')));
    return;
  }
  if (p.type === 'readline' || p.type === 'pick') {
    UI.controls.innerHTML = p.options.map((o, i) => `<button type="button" class="choice" data-choice="${i}" ${G.tried.includes(i) ? 'disabled' : ''}><b>${i + 1}</b>${esc(o.text)}</button>`).join('');
    UI.controls.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => answerPick(Number(b.dataset.choice))));
    return;
  }
  if (p.type === 'line') {
    const L = G.line;
    UI.controls.innerHTML = `
      <div class="label px">1. MOVE THE POST (OR TAP A NUMBER)</div>
      <div class="line-btns"><button type="button" data-move="-1" class="px">◁ LEFT</button><div class="sum">${fmt(L.at)}</div><button type="button" data-move="1" class="px">RIGHT ▷</button></div>
      <div class="label px">2. THE CIRCLE</div>
      <div class="line-btns" style="grid-template-columns:1fr 1fr"><button type="button" data-closed="0" class="px ${!L.closed ? 'on' : ''}">○ OPEN</button><button type="button" data-closed="1" class="px ${L.closed ? 'on' : ''}">● CLOSED</button></div>
      <div class="label px">3. THE ARROW</div>
      <div class="line-btns" style="grid-template-columns:1fr 1fr"><button type="button" data-dir="left" class="px ${L.dir === 'left' ? 'on' : ''}">◀ LESS</button><button type="button" data-dir="right" class="px ${L.dir === 'right' ? 'on' : ''}">GREATER ▶</button></div>
      <button type="button" id="checkBtn" class="apply px">CHECK (ENTER)</button>
      <div class="help-line">Keys: <kbd>←</kbd> <kbd>→</kbd> move · <kbd>space</kbd> circle · <kbd>&lt;</kbd> <kbd>&gt;</kbd> arrow</div>`;
    UI.controls.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => setPost(G.line.at + Number(b.dataset.move))));
    UI.controls.querySelectorAll('[data-closed]').forEach((b) => b.addEventListener('click', () => setLine({ closed: b.dataset.closed === '1' })));
    UI.controls.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () => setLine({ dir: b.dataset.dir })));
    $('checkBtn').addEventListener('click', submitLine);
    return;
  }
  // write: tiles
  const letters = p.two ? [p.rule.letter, p.rule.other] : [p.rule.letter];
  const chip = (t) => `<span class="tile chip ${t.t === 'num' ? 'num' : t.t === 'var' ? 'var' : 'eqs'}">${esc(t.t === 'num' ? fmt(t.v) : t.v)}</span>`;
  UI.controls.innerHTML = `
    <div class="label px">YOUR GATE RULE</div>
    <div id="rail" class="rail ${G.rail.length ? 'filled' : ''}">${G.rail.length ? G.rail.map(chip).join('') : '<span class="empty">Drag or tap tiles to build it here</span>'}</div>
    <div class="tiles">
      ${letters.map((L) => `<button type="button" class="tile var" data-tile="var" data-v="${L}" ${G.rail.some((t) => t.v === L && t.t === 'var') ? 'disabled' : ''}>${L}</button>`).join('')}
      ${p.tiles.map((v, i) => `<button type="button" class="tile num" data-tile="num" data-i="${i}" ${G.used.includes(i) ? 'disabled' : ''}>${fmt(v)}<small>${7 + i}</small></button>`).join('')}
    </div>
    <div class="tiles">${SYMS.map((s, i) => `<button type="button" class="tile eqs" data-tile="sym" data-v="${s}">${esc(s)}<small>${i + 1}</small></button>`).join('')}</div>
    <div class="row-btns"><button type="button" id="undoTile" class="px">⌫ BACK</button><button type="button" id="clearRail" class="px">CLEAR</button>
      <button type="button" id="buildBtn" class="go px">BUILD IT (ENTER)</button></div>
    <div id="helpLine" class="help-line">Keys: ${letters.map((L) => `<kbd>${L}</kbd>`).join(' ')} · <kbd>1</kbd>–<kbd>5</kbd> symbols · ${p.tiles.map((_, i) => `<kbd>${7 + i}</kbd>`).join(' ')} numbers</div>`;
  UI.controls.querySelectorAll('[data-tile]').forEach((b) => b.addEventListener('pointerdown', (e) => {
    if (G.locked || b.disabled) return;
    dragOrTap(e, b, {
      targetAt: (x, y) => (inside($('rail'), x, y) ? 'rail' : null), glow: (t) => $('rail')?.classList.toggle('drop-target', Boolean(t)),
      onDrop: () => addTile(b), onTap: () => addTile(b), lift: false,
    });
  }));
  $('undoTile').addEventListener('click', removeTile);
  $('clearRail').addEventListener('click', () => { if (!G.locked) { G.rail = []; G.used = []; renderControls(); showState(); } });
  $('buildBtn').addEventListener('click', submitWritten);
}
function nudge(text) {
  const h = $('helpLine');
  if (h) h.innerHTML = `<span class="warn">${text}</span>`;
  else showFeedback(true, text);
  hubAudio.playTone(220, 'square', 0.12, 0.05);
}

/* ================================================================== */
/* Answers                                                             */
/* ================================================================== */
function addTile(src) {
  if (G.locked || G.problem.type !== 'write' || !src || src.disabled) return;
  if (G.rail.length >= 3) return nudge('A rule has three parts. Use ⌫ BACK or CLEAR to change it.');
  const kind = src.dataset.tile;
  if (kind === 'num') { const i = Number(src.dataset.i); G.used.push(i); G.rail.push({ t: 'num', v: G.problem.tiles[i], i }); }
  else G.rail.push({ t: kind, v: src.dataset.v });
  hubAudio.playTone(440 + G.rail.length * 40, 'triangle', 0.08, 0.06);
  renderControls();
  showState();
}
function removeTile() {
  if (G.locked || !G.rail.length) return;
  const t = G.rail.pop();
  if (t.t === 'num') G.used = G.used.filter((i) => i !== t.i);
  renderControls();
  showState();
}
function submitWritten() {
  if (G.locked || G.problem.type !== 'write') return;
  const p = G.problem;
  const res = checkWritten(p, G.rail);
  if (res.nudge) return nudge(res.message);
  const built = tilesText(G.rail);
  if (res.correct) {
    drawGate({ sign: (p.shown || p.rule).sign || 'RULE SET!', plate: built, plateColor: '#d9f7e3', open: true });
    strip([{ html: `<span class="good">${esc(built)} ✓</span>` }]);
    return win(res);
  }
  drawGate({ sign: (p.shown || p.rule).sign || 'WHAT IS THE RULE?', plate: built, plateColor: '#ffd9dc' });
  miss(res, { lock: true, delay: 1300, retry: () => { G.rail = []; G.used = []; renderControls(); showState(); } });
}
function answerRider(letIn) {
  const p = G.problem;
  if (G.locked || p.type !== 'rider') return;
  const res = checkRider(p, letIn);
  const really = passes(p.rule, p.v);
  drawGate({ sign: p.rule.sign, plate: ruleText(p.rule), plateColor: res.correct ? '#d9f7e3' : '#ffd9dc', rider: p.v, riderClass: letIn ? 'go-in' : 'go-away', open: letIn });
  strip([ruleText(p.rule), { html: `<span class="${res.correct ? 'good' : 'bad'}">${fmt(p.v)} ${p.rule.sym} ${fmt(p.rule.n)} is ${really ? 'TRUE' : 'FALSE'}</span>` }]);
  if (res.correct) return win(res);
  miss(res, { oneShot: true, nextText: 'NEXT RIDER (ENTER)' });   // one quick decision: explain, then the next rider
}
function setPost(v) {
  if (G.locked || G.problem.type !== 'line') return;
  const n = Math.round(G.problem.rule.n);
  G.line.at = Math.max(n - 6, Math.min(n + 6, v));
  hubAudio.playTone(500, 'triangle', 0.06, 0.05);
  renderControls(); showState();
}
function setLine(change) {
  if (G.locked || G.problem.type !== 'line') return;
  Object.assign(G.line, change);
  hubAudio.playSelect();
  renderControls(); showState();
}
function submitLine() {
  if (G.locked || G.problem.type !== 'line') return;
  if (!G.line.dir) return nudge('Choose which way the arrow points: LESS or GREATER.');
  const res = checkLine(G.problem.rule, G.line);
  strip([ruleText(G.problem.rule), { html: `<span class="${res.correct ? 'good' : 'bad'}">${res.correct ? 'Gate set ✓' : 'Not quite ✗'}</span>` }]);
  if (res.correct) return win(res);
  miss(res, { lock: true, delay: 1300, retry: () => { renderControls(); showState(); } });
}
function answerPick(i) {
  const p = G.problem;
  if (G.locked || G.tried.includes(i)) return;
  const res = checkPick(p, i);
  UI.controls.querySelector(`[data-choice="${i}"]`)?.classList.add(res.correct ? 'right' : 'wrong');
  if (res.correct) return win(res);
  G.tried.push(i);
  miss(res, { lock: true, delay: 1300, retry: () => renderControls() });
}

/* ================================================================== */
/* Keys and start-up                                                   */
/* ================================================================== */
function onKey(e) {
  const key = e.key, p = G.problem;
  if (p.type === 'rider') {
    if (key === 'ArrowLeft' || key === '1') { e.preventDefault(); answerRider(false); }
    if (key === 'ArrowRight' || key === '2') { e.preventDefault(); answerRider(true); }
    return;
  }
  if (p.type === 'readline' || p.type === 'pick') {
    const n = Number(key);
    if (n >= 1 && n <= p.options.length) answerPick(n - 1);
    return;
  }
  if (p.type === 'line') {
    if (key === 'ArrowLeft') { e.preventDefault(); return setPost(G.line.at - 1); }
    if (key === 'ArrowRight') { e.preventDefault(); return setPost(G.line.at + 1); }
    if (key === ' ') { e.preventDefault(); return setLine({ closed: !G.line.closed }); }
    if (key === '<' || key === ',') return setLine({ dir: 'left' });
    if (key === '>' || key === '.') return setLine({ dir: 'right' });
    if (key === 'Enter') { e.preventDefault(); return submitLine(); }
    return;
  }
  const btn = (sel) => UI.controls.querySelector(sel);
  const n = Number(key);
  if (n >= 1 && n <= 5) return addTile(btn(`[data-tile="sym"][data-v="${SYMS[n - 1]}"]`));
  if (n >= 7 && n < 7 + p.tiles.length) return addTile(btn(`[data-tile="num"][data-i="${n - 7}"]`));
  if (key === '<' || key === '>') return addTile(btn(`[data-tile="sym"][data-v="${key}"]`));
  if (/^[a-z]$/i.test(key)) return addTile(btn(`[data-tile="var"][data-v="${key.toLowerCase()}"]`));
  if (key === 'Backspace') { e.preventDefault(); return removeTile(); }
  if (key === 'Enter') { e.preventDefault(); return submitWritten(); }
}

function init() {
  const stripEl = document.createElement('div');
  stripEl.id = 'eqStrip'; stripEl.className = 'eq-strip hidden';
  $('stage').appendChild(stripEl);
  G.problem = { rule: { letter: 'h', sym: '≥', n: 42 } };
  drawGate({ sign: 'YOU MUST BE AT LEAST 42 INCHES TALL TO RIDE', plate: 'h ≥ 42', rider: 44 });   // a sample gate behind the briefing
  G.problem = null;
}

init();
