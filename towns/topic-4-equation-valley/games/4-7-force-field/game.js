// Force Field (Lesson 4-7): the shield screen and controls. The math lives in field.js;
// zones, timer, lives, scoring and the report come from the shared game shell (shared/game/gameShell.js).
//
// Problem types: graph (put the shield on the number line), meteor (zap every solution before it lands),
// name3 (type three solutions), read (write the rule a shield shows, or Francine's card) and pick.
import {
  ZONES, SYMS, fmt, ruleText, inclusive, goesRight, passesAll, lineFor, ticks, genZone, genBackup,
  checkGraph, checkShower, checkName3, checkWritten, checkPick, tilesText, workedSolution,
} from './field.js';
import { hubAudio } from '../../../../shared/audio.js';
import { createGame } from '../../../../shared/game/gameShell.js';
import { dragOrTap, inside } from '../../../../shared/game/drag.js';

const SKILL_TIPS = {
  tenths: 'On a tenths line, count the small steps: each one is 0.1.',
  graph_number: 'The edge of the shield goes on the boundary number.',
  graph_circle: 'Closed circle ● for ≤ and ≥ (the number counts); open ○ for < and > (it does not).',
  graph_direction: 'Greater than: shade right. Less than: shade left.',
  boundary_meteor: 'The boundary itself is a solution only for ≤ and ≥.',
  decimal_near: 'Every value past the boundary counts, even 7.01 for x > 7.',
  substitute: 'For 3y < 25, multiply 3 × the value first, then compare.',
  both_fields: 'With two fields, a solution must be inside BOTH.',
  missed_solution: 'Put each value into the rule: true means zap it.',
  zapped_wrong: 'Put each value into the rule: false means let it go.',
  boundary: 'For < and >, the boundary number is NOT a solution.',
  wrong_side: 'Check which way the solutions go: greater or less.',
  not_whole: 'Read the question: sometimes only whole numbers count.',
  flipped_order: 'With the number first, turn the symbol around.',
  not_max: 'To buy ANY item, you need at least the price of the most expensive one.',
  one_solution: 'Inequalities have infinitely many solutions.',
  neither: 'Two open circles at the same number leave that one number out.',
};

const FALL_MS = 9000, FALL_PRACTICE_MS = 14000;
const shell = createGame({
  zones: ZONES, makeZone: genZone, makeBackup: genBackup, workedSolution, showProblem,
  seconds: [55, 70, 60, 55, 80],                       // power drain: seconds until a blackout, per zone
  isTimed: (p) => p.type !== 'meteor',                 // the meteors are their own clock
  meterFloor: 8, wrongBump: 30, rightRelief: 25, pauseOnBanner: true,
  lifeLostText: (left) => (left > 0 ? 'BLACKOUT!' : 'OUTPOST DARK!'),
  bossHitText: 'HELD!', winDelay: (p) => (p.type === 'pick' ? 1300 : 1600),
  skillTips: SKILL_TIPS, perfectText: 'No mistakes to sharpen. Shields at 100%!',
  lettersAreInput: () => G.problem?.type === 'read', onKey, testName: '__field',
});
const { G, UI, $, win, miss, showFeedback } = shell;
Object.assign(G, { rail: [], used: [], tried: [], line: { at: 0, closed: false, dir: null }, shower: null });

/* ================================================================== */
/* Drawing                                                             */
/* ================================================================== */
const K = '#1d1433';
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round"`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const LINE_Y = 410;

function sky() {
  let stars = '';
  for (let i = 0; i < 40; i++) stars += `<circle cx="${(i * 197) % 800}" cy="${(i * 89) % 300}" r="${i % 3 ? 1.5 : 2.5}" fill="#fff" opacity="0.7"/>`;
  return `<rect x="-300" y="-300" width="1400" height="1120" fill="#2a1f4a"/>${stars}
    <path d="M0 470 L120 440 L260 462 L400 430 L540 458 L680 436 L800 456 V520 H0 Z" fill="#6b3a2a" ${O}/>`;
}
const X = (line, v) => 80 + ((v - line.lo) / (line.hi - line.lo)) * 640;
/** A number line with fields drawn on it. fields: [{ at, closed, dir, color }] */
function numberLine(line, fields = [], { interactive = false, showAllLabels = line.labelEvery } = {}) {
  const ts = ticks(line);
  let out = `<rect x="30" y="${LINE_Y - 60}" width="740" height="112" rx="14" fill="#fff4d6" opacity="0.95" ${O}/>`;
  for (const f of fields) {
    if (f.dir) {
      const x0 = X(line, f.at), x1 = f.dir === 'right' ? 760 : 40;
      out += `<rect class="shimmer" x="${Math.min(x0, x1)}" y="${LINE_Y - 22}" width="${Math.abs(x1 - x0)}" height="44" fill="${f.color || '#3ad0f0'}"/>`;
      out += `<path d="${f.dir === 'right' ? `M760 ${LINE_Y} l-20 -14 v28 Z` : `M40 ${LINE_Y} l20 -14 v28 Z`}" fill="${f.color || '#3a8ef0'}" ${O}/>`;
    }
  }
  out += `<path d="M40 ${LINE_Y} H760" stroke="${K}" stroke-width="4"/>`;
  ts.forEach((v, i) => {
    const x = X(line, v), big = showAllLabels || i === 0 || i === ts.length - 1;
    out += `<g ${interactive ? `class="tick-hit" data-tick="${v}"` : ''}><rect x="${x - (line.step < 1 ? 26 : 24)}" y="${LINE_Y - 40}" width="${line.step < 1 ? 52 : 48}" height="86" fill="transparent"/>
      <path d="M${x} ${LINE_Y - (big ? 12 : 8)} V${LINE_Y + (big ? 12 : 8)}" stroke="${K}" stroke-width="3"/>
      ${big ? `<text x="${x}" y="${LINE_Y + 36}" text-anchor="middle" font-size="16" font-weight="900" fill="${K}" font-family="ui-monospace, monospace">${fmt(v)}</text>` : ''}</g>`;
  });
  for (const f of fields) {
    if (f.at === null || f.at === undefined) continue;
    out += `<circle cx="${X(line, f.at)}" cy="${LINE_Y}" r="13" fill="${f.closed ? '#1f63c9' : '#fff'}" stroke="#1f63c9" stroke-width="5"/>`;
  }
  return out;
}
function outpost(label) {
  return `<g transform="translate(400 300)"><path d="M-120 40 A120 120 0 0 1 120 40 Z" fill="#3ad0f0" opacity="0.25"/>
    <rect x="-46" y="0" width="92" height="40" rx="6" fill="#8b90a3" ${O}/><path d="M-30 0 A30 30 0 0 1 30 0" fill="#c4935a" ${O}/>
    ${label ? `<rect x="-140" y="-150" width="280" height="54" rx="10" fill="#fff4d6" ${O}/><text x="0" y="-113" text-anchor="middle" font-size="28" font-weight="900" fill="${K}" font-family="ui-monospace, monospace">${esc(label)}</text>` : ''}</g>`;
}
function strip(lines) {
  const el = $('eqStrip');
  if (!el) return;
  if (!lines.length) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML = lines.map((l) => `<div class="eq-line ${l.small ? 'small' : ''}">${l.html ?? esc(l)}</div>`).join('');
}
const fieldOf = (r) => ({ at: r.n / (r.coef || 1), closed: inclusive(r), dir: goesRight(r) ? 'right' : 'left' });

/* ================================================================== */
/* Problems                                                            */
/* ================================================================== */
const TAGS = { graph: 'SHIELD UP: GRAPH IT', meteor: 'ZAP THE SOLUTIONS', name3: 'NAME THREE SOLUTIONS', read: 'READ THE FIELD', pick: 'THINK IT THROUGH' };
function showProblem(p, isBackup) {
  stopShower();
  G.shower = null;
  const r = p.rule || p.rules[0];
  Object.assign(G, { rail: [], used: [], tried: [], line: { at: lineFor(r).lo + (lineFor(r).step < 1 ? 0.5 : 3), closed: false, dir: null } });
  G.line.at = Math.round(G.line.at * 10) / 10;
  UI.taskTag.textContent = `${p.gift ? 'GIFT CARD' : TAGS[p.type]}${isBackup ? ' · BACKUP' : ''}`;
  renderPrompt();
  renderControls();
  showState();
  if (p.type === 'meteor') startShower();
}
function renderPrompt() {
  const p = G.problem;
  const box = (t) => `<span style="display:block;font-size:15px;background:#fff;border:3px solid var(--ink);border-radius:10px;padding:7px 10px;margin-top:6px">${esc(t)}</span>`;
  let html;
  if (p.type === 'graph') html = `Put the shield on the number line: every solution must be covered.<span class="eq">${esc(ruleText(p.rule))}</span>`;
  else if (p.type === 'meteor') html = `${p.story ? box(p.story) : `Zap every meteor that is a <b>solution</b>.`}<span class="eq">${esc(p.rules.map(ruleText).join('  and  '))}</span>`;
  else if (p.type === 'name3') html = `Type <b>three different solutions</b>${p.whole ? ' — <b>whole numbers only</b>' : ' (decimals and fractions are fine)'}.<span class="eq">${esc(ruleText(p.rule))}</span>`;
  else if (p.type === 'read') html = p.gift ? box(p.story) : 'This shield is up. Write the rule it shows.';
  else html = p.ask === 'count' ? `How many solutions does this inequality have?<span class="eq">${esc(ruleText(p.rule))}</span>` : `Two fields share one line. Which value is in <b>neither</b> field?<span class="eq">${esc(p.rules.map(ruleText).join('  and  '))}</span>`;
  UI.prompt.innerHTML = html;
}
function showState() {
  const p = G.problem;
  if (p.type === 'graph') {
    const line = lineFor(p.rule);
    UI.scene.innerHTML = `${sky()}${outpost(ruleText(p.rule))}${numberLine(line, [{ ...G.line, color: '#3ad0f0' }], { interactive: true })}`;
    UI.scene.querySelectorAll('[data-tick]').forEach((t) => t.addEventListener('click', () => setPost(Number(t.dataset.tick))));
    strip(line.step < 1 ? [{ html: `Small steps are tenths (0.1). Tap where ${fmt(p.rule.n)} goes.`, small: true }] : []);
  } else if (p.type === 'meteor') {
    drawShower();
  } else if (p.type === 'name3') {
    const line = lineFor(p.rule);
    UI.scene.innerHTML = `${sky()}${outpost(ruleText(p.rule))}${numberLine(line, [fieldOf(p.rule)])}`;
    strip([{ html: p.whole ? 'Whole numbers only: 0, 1, 2, 3 …' : 'Any solution works: whole numbers, decimals, fractions.', small: true }]);
  } else if (p.type === 'read') {
    const line = lineFor(p.rule);
    UI.scene.innerHTML = `${sky()}${outpost(G.rail.length ? tilesText(G.rail) : '? ? ?')}${p.gift ? '' : numberLine(line, [fieldOf(p.rule)])}`;
    strip(p.gift ? [{ html: p.tiles.map((v) => fmt(v, true)).join('   '), small: false }] : []);
  } else {
    const rules = p.rules || [p.rule];
    const line = lineFor(rules[0]);
    UI.scene.innerHTML = `${sky()}${outpost('')}${numberLine(line, rules.map((r, i) => ({ ...fieldOf(r), color: i ? '#ff9f43' : '#3ad0f0' })))}`;
    strip([]);
  }
}

/* ================================================================== */
/* The meteor shower                                                   */
/* ================================================================== */
function startShower() {
  const p = G.problem;
  stopShower();
  const order = p.values.map((v, i) => i);
  G.shower = { zapped: new Set(), landed: new Set(), t: 0, last: performance.now(), raf: null, done: false, p, lanes: order };
  const fall = G.practice ? FALL_PRACTICE_MS : FALL_MS;
  const step = (now) => {
    const s = G.shower;
    if (!s || s.p !== G.problem || s.done) return;
    const dt = Math.min(100, now - s.last); s.last = now;
    const paused = !UI.briefing.classList.contains('hidden') || !UI.banner.classList.contains('hidden');
    if (!paused) s.t += dt;
    p.values.forEach((v, i) => {
      if (s.zapped.has(i) || s.landed.has(i)) return;
      const prog = (s.t - i * 900) / fall;
      const g = $(`m${i}`);
      if (g) g.setAttribute('transform', `translate(${laneX(i)} ${-40 + Math.max(0, prog) * (LINE_Y - 80)})`);
      if (prog >= 1) { s.landed.add(i); if (g) g.classList.add('boom'); hubAudio.playTone(120, 'sawtooth', 0.15, 0.05); }
    });
    if (s.zapped.size + s.landed.size === p.values.length) return endShower();
    s.raf = requestAnimationFrame(step);
  };
  G.shower.raf = requestAnimationFrame(step);
}
function stopShower() { if (G.shower) { cancelAnimationFrame(G.shower.raf); G.shower.done = true; } }
const laneX = (i) => 140 + i * 130;
function drawShower() {
  const p = G.problem, s = G.shower;
  const line = lineFor(p.rules[0].coef ? { ...p.rules[0], n: p.rules[0].n } : p.rules[0]);
  const fields = p.rules.map((r, i) => ({ ...fieldOf(r), color: i ? '#ff9f43' : '#3ad0f0' }));
  const wide = p.rules.length === 2 || p.story;                 // big ranges: show just the rule plates, no line
  const meteors = p.values.map((v, i) => {
    const gone = s && (s.zapped.has(i) || s.landed.has(i));
    return `<g id="m${i}" class="meteor ${gone ? 'boom' : ''}" data-m="${i}" transform="translate(${laneX(i)} -60)">
      <path d="M-14 -40 L0 -10 L14 -40" stroke="#ff9f43" stroke-width="6" opacity="0.7"/>
      <circle r="36" fill="#8f3f22" ${O}/><circle r="30" fill="#c4935a"/>
      <text y="7" text-anchor="middle" font-size="${fmt(v).length > 5 ? 15 : 19}" font-weight="900" fill="#fff" font-family="ui-monospace, monospace">${esc(fmt(v))}</text>
      <text y="-44" text-anchor="middle" font-size="12" font-weight="900" fill="#ffd23f" font-family="'Press Start 2P', monospace">${i + 1}</text></g>`;
  }).join('');
  UI.scene.innerHTML = `${sky()}${wide ? `<g transform="translate(400 ${LINE_Y - 10})"><rect x="-250" y="-34" width="500" height="64" rx="12" fill="#3ad0f0" opacity="0.35" class="shimmer"/>
      <text x="0" y="10" text-anchor="middle" font-size="26" font-weight="900" fill="#fff" font-family="ui-monospace, monospace">${esc(p.rules.map(ruleText).join('  and  '))}</text></g>`
    : numberLine(line, fields)}${meteors}`;
  UI.scene.querySelectorAll('[data-m]').forEach((g) => g.addEventListener('pointerdown', (e) => { e.preventDefault(); zap(Number(g.dataset.m)); }));
  strip([]);
}
function zap(i) {
  const s = G.shower, p = G.problem;
  if (!s || s.done || G.locked || p.type !== 'meteor' || s.zapped.has(i) || s.landed.has(i)) return;
  s.zapped.add(i);
  $(`m${i}`)?.classList.add('boom');
  hubAudio.playTone(passesAll(p.rules, p.values[i]) ? 880 : 300, 'square', 0.1, 0.06);
  if (s.zapped.size + s.landed.size === p.values.length) endShower();
}
function endShower() {
  const s = G.shower, p = G.problem;
  if (!s || s.done) return;
  s.done = true;
  const res = checkShower(p, s.zapped);
  const marks = p.values.map((v, i) => `<span class="${passesAll(p.rules, v) === s.zapped.has(i) ? 'good' : 'bad'}">${esc(fmt(v))}${passesAll(p.rules, v) ? '✓' : '✗'}</span>`).join('  ');
  strip([{ html: marks }]);
  if (res.correct) return win(res);
  miss(res, { lock: true, delay: 1800, retry: () => { stopShower(); G.shower = null; showState(); startShower(); } });   // the same shower again
}

/* ================================================================== */
/* Controls                                                            */
/* ================================================================== */
function renderControls() {
  const p = G.problem;
  if (p.type === 'meteor') {
    UI.controls.innerHTML = `<div class="zap-help">Tap a meteor (or press its number, <kbd>1</kbd>–<kbd>5</kbd>) to zap it.</div>
      <div class="help-line">Zap only the solutions. Let the others hit the ground: they burn up harmlessly.${G.practice ? ' (Practice: the meteors fall slower.)' : ''}</div>`;
    return;
  }
  if (p.type === 'pick') {
    UI.controls.innerHTML = p.options.map((o, i) => `<button type="button" class="choice" data-choice="${i}" ${G.tried.includes(i) ? 'disabled' : ''}><b>${i + 1}</b>${esc(o.text)}</button>`).join('');
    UI.controls.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => answerPick(Number(b.dataset.choice))));
    return;
  }
  if (p.type === 'name3') {
    UI.controls.innerHTML = `
      <div class="label px">THREE DIFFERENT SOLUTIONS</div>
      <div class="name3">${[1, 2, 3].map((i) => `<input id="v${i}" inputmode="decimal" autocomplete="off" maxlength="9" placeholder="?">`).join('')}</div>
      <button type="button" id="checkBtn" class="apply px">CHECK (ENTER)</button>
      <div id="helpLine" class="help-line">Use <kbd>Tab</kbd> to move between boxes. Mixed numbers like 2 1/2 are fine.</div>`;
    $('checkBtn').addEventListener('click', submitName3);
    setTimeout(() => $('v1')?.focus(), 50);
    return;
  }
  if (p.type === 'graph') {
    const L = G.line;
    UI.controls.innerHTML = `
      <div class="label px">1. THE EDGE (TAP THE LINE OR MOVE IT)</div>
      <div class="line-btns"><button type="button" data-move="-1" class="px">◁ LEFT</button><div></div><button type="button" data-move="1" class="px">RIGHT ▷</button></div>
      <div class="label px">2. THE CIRCLE</div>
      <div class="line-btns" style="grid-template-columns:1fr 1fr"><button type="button" data-closed="0" class="px ${!L.closed ? 'on' : ''}">○ OPEN</button><button type="button" data-closed="1" class="px ${L.closed ? 'on' : ''}">● CLOSED</button></div>
      <div class="label px">3. SHADE THE SOLUTIONS</div>
      <div class="line-btns" style="grid-template-columns:1fr 1fr"><button type="button" data-dir="left" class="px ${L.dir === 'left' ? 'on' : ''}">◀ LESS</button><button type="button" data-dir="right" class="px ${L.dir === 'right' ? 'on' : ''}">GREATER ▶</button></div>
      <button type="button" id="checkBtn" class="apply px">SHIELD UP (ENTER)</button>
      <div id="helpLine" class="help-line">Keys: <kbd>←</kbd> <kbd>→</kbd> move · <kbd>space</kbd> circle · <kbd>&lt;</kbd> <kbd>&gt;</kbd> shade</div>`;
    UI.controls.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => movePost(Number(b.dataset.move))));
    UI.controls.querySelectorAll('[data-closed]').forEach((b) => b.addEventListener('click', () => setLine({ closed: b.dataset.closed === '1' })));
    UI.controls.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () => setLine({ dir: b.dataset.dir })));
    $('checkBtn').addEventListener('click', submitGraph);
    return;
  }
  // read: tiles
  const chip = (t) => `<span class="tile chip ${t.t === 'num' ? 'num' : t.t === 'var' ? 'var' : 'eqs'}">${esc(t.t === 'num' ? fmt(t.v) : t.v)}</span>`;
  UI.controls.innerHTML = `
    <div class="label px">THE RULE</div>
    <div id="rail" class="rail ${G.rail.length ? 'filled' : ''}">${G.rail.length ? G.rail.map(chip).join('') : '<span class="empty">Drag or tap tiles to build it here</span>'}</div>
    <div class="tiles">
      <button type="button" class="tile var" data-tile="var" data-v="${p.rule.letter}" ${G.rail.some((t) => t.t === 'var') ? 'disabled' : ''}>${p.rule.letter}</button>
      ${p.tiles.map((v, i) => `<button type="button" class="tile num" data-tile="num" data-i="${i}" ${G.used.includes(i) ? 'disabled' : ''}>${esc(p.gift ? fmt(v, true) : fmt(v))}<small>${6 + i}</small></button>`).join('')}
    </div>
    <div class="tiles">${SYMS.map((sy, i) => `<button type="button" class="tile eqs" data-tile="sym" data-v="${sy}">${esc(sy)}<small>${i + 1}</small></button>`).join('')}</div>
    <div class="row-btns"><button type="button" id="undoTile" class="px">⌫ BACK</button><button type="button" id="clearRail" class="px">CLEAR</button>
      <button type="button" id="buildBtn" class="go px">BUILD IT (ENTER)</button></div>
    <div id="helpLine" class="help-line">Keys: <kbd>${p.rule.letter}</kbd> · <kbd>1</kbd>–<kbd>4</kbd> symbols · ${p.tiles.map((_, i) => `<kbd>${6 + i}</kbd>`).join(' ')} numbers</div>`;
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
function setPost(v) {
  if (G.locked || G.problem.type !== 'graph') return;
  G.line.at = v;
  hubAudio.playTone(500, 'triangle', 0.06, 0.05);
  renderControls(); showState();
}
function movePost(d) {
  if (G.problem.type !== 'graph') return;
  const line = lineFor(G.problem.rule);
  setPost(Math.max(line.lo, Math.min(line.hi, Math.round((G.line.at + d * line.step) * 10) / 10)));
}
function setLine(change) {
  if (G.locked || G.problem.type !== 'graph') return;
  Object.assign(G.line, change);
  hubAudio.playSelect();
  renderControls(); showState();
}
function submitGraph() {
  if (G.locked || G.problem.type !== 'graph') return;
  if (!G.line.dir) return nudge('Choose which way to shade: LESS or GREATER.');
  const res = checkGraph(G.problem.rule, G.line);
  strip([{ html: res.correct ? `<span class="good">Shield up at ${fmt(G.problem.rule.n)} ✓</span>` : `<span class="bad">Shield failed ✗</span>` }]);
  if (res.correct) return win(res);
  miss(res, { lock: true, delay: 1300, retry: () => { renderControls(); showState(); } });
}
function submitName3() {
  const p = G.problem;
  if (G.locked || p.type !== 'name3') return;
  const raws = [1, 2, 3].map((i) => $(`v${i}`).value);
  const res = checkName3(p, raws);
  if (res.nudge) return nudge(res.message);
  if (res.correct) {
    strip([{ html: `<span class="good">${raws.map(esc).join(' ✓  ')} ✓</span>` }]);
    return win(res);
  }
  [1, 2, 3].forEach((i) => $(`v${i}`).classList.toggle('bad', Math.abs((parseFloat($(`v${i}`).value.replace(/,/g, '')) || NaN) - res.value) < 1e-9));
  miss(res, { lock: true, delay: 1300, retry: () => { [1, 2, 3].forEach((i) => $(`v${i}`)?.classList.remove('bad')); $('v1')?.focus(); } });
}
function addTile(src) {
  if (G.locked || G.problem.type !== 'read' || !src || src.disabled) return;
  if (G.rail.length >= 3) return nudge('A rule has three parts. Use ⌫ BACK or CLEAR to change it.');
  const kind = src.dataset.tile;
  if (kind === 'num') { const i = Number(src.dataset.i); G.used.push(i); G.rail.push({ t: 'num', v: G.problem.tiles[i], i }); }
  else G.rail.push({ t: kind, v: src.dataset.v });
  hubAudio.playTone(440 + G.rail.length * 40, 'triangle', 0.08, 0.06);
  renderControls(); showState();
}
function removeTile() {
  if (G.locked || !G.rail.length) return;
  const t = G.rail.pop();
  if (t.t === 'num') G.used = G.used.filter((i) => i !== t.i);
  renderControls(); showState();
}
function submitWritten() {
  if (G.locked || G.problem.type !== 'read') return;
  const res = checkWritten(G.problem, G.rail);
  if (res.nudge) return nudge(res.message);
  strip([{ html: `<span class="${res.correct ? 'good' : 'bad'}">${esc(tilesText(G.rail))} ${res.correct ? '✓' : '✗'}</span>` }]);
  if (res.correct) return win(res);
  miss(res, { lock: true, delay: 1300, retry: () => { G.rail = []; G.used = []; renderControls(); showState(); } });
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
  if (p.type === 'meteor') { const n = Number(key); if (n >= 1 && n <= p.values.length) zap(n - 1); return; }
  if (p.type === 'pick') { const n = Number(key); if (n >= 1 && n <= p.options.length) answerPick(n - 1); return; }
  if (p.type === 'name3') { if (key === 'Enter') { e.preventDefault(); submitName3(); } return; }
  if (p.type === 'graph') {
    if (key === 'ArrowLeft') { e.preventDefault(); return movePost(-1); }
    if (key === 'ArrowRight') { e.preventDefault(); return movePost(1); }
    if (key === ' ') { e.preventDefault(); return setLine({ closed: !G.line.closed }); }
    if (key === '<' || key === ',') return setLine({ dir: 'left' });
    if (key === '>' || key === '.') return setLine({ dir: 'right' });
    if (key === 'Enter') { e.preventDefault(); return submitGraph(); }
    return;
  }
  const btn = (sel) => UI.controls.querySelector(sel);
  const n = Number(key);
  if (n >= 1 && n <= 4) return addTile(btn(`[data-tile="sym"][data-v="${SYMS[n - 1]}"]`));
  if (n >= 6 && n < 6 + p.tiles.length) return addTile(btn(`[data-tile="num"][data-i="${n - 6}"]`));
  if (key === '<' || key === '>') return addTile(btn(`[data-tile="sym"][data-v="${key}"]`));
  if (key.toLowerCase() === p.rule.letter) return addTile(btn('[data-tile="var"]'));
  if (key === 'Backspace') { e.preventDefault(); return removeTile(); }
  if (key === 'Enter') { e.preventDefault(); return submitWritten(); }
}

function init() {
  const stripEl = document.createElement('div');
  stripEl.id = 'eqStrip'; stripEl.className = 'eq-strip hidden';
  $('stage').appendChild(stripEl);
  const demo = { letter: 'x', sym: '>', n: 5 };              // a sample shield behind the briefing
  UI.scene.innerHTML = `${sky()}${outpost('x > 5')}${numberLine(lineFor(demo), [fieldOf(demo)])}`;
}

init();
