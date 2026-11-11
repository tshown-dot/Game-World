// Counterweight (Lesson 4-2): screen, controls and game flow. The math lives in balance.js.
import {
  ZONES, PROPERTIES, MISTAKES, OP_SIGN, genZone, genBackup, weigh, isBalanced, eqText, settled, parseAmount, applyOp,
  checkRebalance, checkIsolate, checkProperty, checkStamp, checkMistake, checkPartial, checkChain, workedSolution,
} from './balance.js';
import { hubAudio } from '../../../../shared/audio.js';

const $ = (id) => document.getElementById(id);
const UI = {
  app: $('app'), scene: $('scene'), prompt: $('prompt'), controls: $('controls'), feedback: $('feedback'), taskTag: $('taskTag'),
  zonePips: $('zonePips'), zoneName: $('zoneName'), meterFill: $('meterFill'), meterBox: $('meterBox'), crates: $('crates'), score: $('score'),
  briefing: $('briefing'), zoneButtons: $('zoneButtons'), banner: $('banner'), fail: $('fail'), report: $('report'),
  practiceTag: $('practiceTag'), bossBar: $('bossBar'), bossFill: $('bossFill'),
};
const IN_TOWN = window.parent !== window;              // inside a town's building (iframe) or opened directly
const SECONDS_TO_TIP = [32, 32, 30, 0, 36];            // tilt meter: seconds until a crate slips (0 = no timer in that zone)
const TIMED = new Set(['rebalance', 'chain']);         // the scale is tipping during these problems

const G = {
  rnd: Math.random, practice: false, startZone: 0, zone: 0, queue: [], problem: null, attempts: 0, locked: false,
  crates: 3, tilt: 0, score: 0, firstTry: 0, answered: 0, mistakes: {}, zoneStats: [], bossHits: 0, started: 0,
  sel: { op: null, amount: '', moves: [], stamped: null }, ticker: null, last: 0,
  theta: 0, intro: false, introTimers: [],
};

/* ================================================================== */
/* Drawing the canyon and the scale                                    */
/* ================================================================== */
const K = '#1d1433';
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round"`;

function backdrop() {
  return `
    <defs>
      <linearGradient id="gorge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9512b"/><stop offset="1" stop-color="#5a2a1a"/></linearGradient>
    </defs>
    <path d="M0 230 L60 200 L120 215 L170 190 L230 210 L240 520 L0 520 Z" fill="#d98a52" ${O}/>
    <path d="M800 220 L740 195 L690 210 L640 188 L570 212 L560 520 L800 520 Z" fill="#d98a52" ${O}/>
    <path d="M230 210 L300 520 L500 520 L570 212 Z" fill="url(#gorge)"/>
    <path d="M330 520 Q400 470 470 520" fill="#3a8ef0" ${O}/>
    <path d="M0 300 L240 290 M0 370 L250 365 M800 300 L565 292 M800 380 L555 372" stroke="#b5683a" stroke-width="5"/>
    <g opacity="0.55"><path d="M90 200 L105 150 L160 150 L175 200 Z M610 205 L622 165 L668 165 L680 205 Z" fill="#c8673a" ${O}/></g>
    <rect x="384" y="150" width="32" height="330" fill="#8a5a2b" ${O}/>
    <path d="M360 480 L440 480 L430 455 L370 455 Z" fill="#6b4425" ${O}/>`;
}

function blocksSvg(s, letter, hidden) {
  if (hidden) return `<text x="0" y="-18" text-anchor="middle" font-size="34" font-weight="900" fill="${K}">?</text>`;
  const a = Math.round(s.a * 1000) / 1000, b = Math.round(s.b * 1000) / 1000;
  let out = '', x = -78;
  if (a > 0 && Number.isInteger(a) && a <= 6) {
    for (let i = 0; i < a; i++) {
      out += `<g transform="translate(${x + i * 27} -34)"><rect width="25" height="30" rx="4" fill="#3a8ef0" ${O}/><text x="12.5" y="21" text-anchor="middle" font-size="15" font-weight="900" fill="#fff">${letter}</text></g>`;
    }
    x += a * 27 + 4;
  } else if (a !== 0) {
    out += `<g transform="translate(${x} -34)"><rect width="62" height="30" rx="4" fill="#3a8ef0" ${O}/><text x="31" y="21" text-anchor="middle" font-size="14" font-weight="900" fill="#fff">${a}${letter}</text></g>`;
    x += 66;
  }
  if (b > 0) {
    const w = Math.min(90, 34 + String(b).length * 9);
    out += `<g transform="translate(${Math.min(x, 78 - w)} -40)"><path d="M6 0 H${w - 6} L${w} 36 H0 Z" fill="#6b6f80" ${O}/><text x="${w / 2}" y="25" text-anchor="middle" font-size="16" font-weight="900" fill="#fff">${b}</text></g>`;
  } else if (b < 0) {                                  // taken away: a balloon lifting that much
    out += `<g transform="translate(${Math.min(x + 16, 60)} -70)"><path d="M0 34 L0 60" stroke="${K}" stroke-width="2"/><ellipse cx="0" cy="16" rx="18" ry="20" fill="#ff7a8a" ${O}/><text x="0" y="22" text-anchor="middle" font-size="13" font-weight="900" fill="#fff">−${-b}</text></g>`;
  }
  return out;
}

function letterOf(eq) {
  const m = `${eq.left.text} ${eq.right.text}`.match(/[a-z]/);
  return m ? m[0] : 'x';
}

const endsAt = (theta) => {
  const rad = (theta * Math.PI) / 180;
  return [{ x: 400 - 270 * Math.cos(rad), y: 150 - 270 * Math.sin(rad) }, { x: 400 + 270 * Math.cos(rad), y: 150 + 270 * Math.sin(rad) }];
};

/**
 * Draws the scale for an equation, swinging smoothly from the last angle.
 *   hidden     beam stays level and pans show "?" (Inspector questions)
 *   chips      weight tags that drop onto (or lift off) a pan: [{ side: 'left'|'right', op, n, who: 'sab'|'you' }]
 *   saboteur   { side, bubble } to show the Saboteur by that pan (always shown in the boss zone)
 */
function drawScale(eq, { hidden = false, chips = [], saboteur = null } = {}) {
  const L = weigh(eq.left, eq.x), R = weigh(eq.right, eq.x);
  const big = Math.max(Math.abs(L), Math.abs(R), 1);
  const theta = hidden ? 0 : Math.max(-16, Math.min(16, ((R - L) / big) * 22));
  const from = endsAt(G.theta), to = endsAt(theta);
  const letter = letterOf(eq);
  const pan = (id, end, s, label) => `
    <g class="pan-group" id="${id}" style="transform: translate(${end.x}px, ${end.y}px)">
      <path d="M0 0 L-80 82 M0 0 L80 82" stroke="${K}" stroke-width="2.5"/>
      <g transform="translate(0 82)">${blocksSvg(s, letter, hidden)}
        <path d="M-92 0 L92 0 L76 16 L-76 16 Z" fill="#ffd23f" ${O}/></g>
      <g transform="translate(0 124)"><rect x="-108" y="-17" width="216" height="32" rx="6" fill="#fff4d6" ${O}/>
        <text x="0" y="5" text-anchor="middle" font-size="${label.length > 20 ? 12 : 15}" font-weight="900" font-family="ui-monospace, monospace" fill="${K}">${label}</text></g>
    </g>`;
  const balanced = isBalanced(eq);
  const level = hidden ? '#9b958b' : balanced ? '#2fbf71' : '#e5484d';
  const sign = hidden ? '' : `<g transform="translate(400 74)"><rect x="-74" y="-16" width="148" height="28" rx="7" fill="${balanced ? '#2fbf71' : '#e5484d'}" ${O}/>
    <text x="0" y="4" text-anchor="middle" font-size="12" font-weight="900" fill="#fff" font-family="ui-monospace, monospace">${balanced ? 'BALANCED ✓' : 'NOT BALANCED'}</text></g>`;
  const chipSvg = chips.map((c) => {
    const e = to[c.side === 'left' ? 0 : 1];
    const lift = c.op === '-' || c.op === '÷';
    return `<g transform="translate(${e.x} ${e.y + 30})"><g class="${lift ? 'chip-lift' : 'chip-drop'}">
      <rect x="-36" y="-18" width="72" height="32" rx="8" fill="${c.who === 'sab' ? '#e5484d' : '#3a8ef0'}" ${O}/>
      <text x="0" y="5" text-anchor="middle" font-size="17" font-weight="900" fill="#fff" font-family="ui-monospace, monospace">${OP_SIGN[c.op]} ${c.n}</text></g></g>`;
  }).join('');
  const sab = saboteur || (G.zone === 4 ? { side: 'right' } : null);
  UI.scene.innerHTML = `${backdrop()}
    <g class="beam-group" id="beam" style="transform: rotate(${G.theta}deg)">
      <rect x="120" y="140" width="560" height="20" rx="8" fill="#c4935a" ${O}/>
      <path d="M150 150 H650" stroke="#8a5a2b" stroke-width="3" stroke-dasharray="10 14"/>
    </g>
    <circle cx="400" cy="150" r="16" fill="#ffd23f" ${O}/>
    <path d="M400 108 L388 128 L412 128 Z" fill="${level}" ${O}/>
    ${sign}
    ${pan('panL', from[0], eq.left, eq.left.text)}${pan('panR', from[1], eq.right, eq.right.text)}
    ${cratesSvg()}
    ${sab ? saboteurSvg(sab.side, sab.bubble) : ''}
    ${chipSvg}`;
  void UI.scene.getBoundingClientRect();                       // let the old angle paint, then swing
  $('beam').style.transform = `rotate(${theta}deg)`;
  $('panL').style.transform = `translate(${to[0].x}px, ${to[0].y}px)`;
  $('panR').style.transform = `translate(${to[1].x}px, ${to[1].y}px)`;
  if (Math.abs(theta - G.theta) > 0.5) hubAudio.playTone(theta === 0 ? 520 : 140, 'triangle', 0.25, 0.08);
  G.theta = theta;
}

function cratesSvg() {
  let out = '<g transform="translate(400 160)"><path d="M0 0 V70" stroke="#1d1433" stroke-width="3"/>';
  out += `<rect x="-44" y="70" width="88" height="10" rx="3" fill="#8a5a2b" ${O}/>`;
  for (let i = 0; i < 3; i++) {
    const lost = i >= G.crates;
    out += `<g class="${lost ? 'gone' : ''}" ${lost ? 'opacity="0"' : ''} transform="translate(${-40 + i * 28} 44)"><rect width="24" height="24" rx="3" fill="#c4935a" ${O}/><path d="M4 4 L20 20 M20 4 L4 20" stroke="#8a5a2b" stroke-width="2"/></g>`;
  }
  return `${out}</g>`;
}

function saboteurSvg(side = 'right', bubble = '') {
  const x = side === 'left' ? 62 : 738;
  const face = side === 'left' ? -1 : 1;
  return `<g transform="translate(${x} 452)" class="saboteur">
    <ellipse cx="0" cy="40" rx="30" ry="8" fill="rgba(0,0,0,0.25)"/>
    <g transform="scale(${face} 1)">
      <rect x="-20" y="-6" width="40" height="44" rx="10" fill="#4a2f6b" ${O}/>
      <circle cx="0" cy="-18" r="17" fill="#ffd3a8" ${O}/>
      <rect x="-17" y="-26" width="34" height="9" rx="4" fill="${K}"/>
      <circle cx="-7" cy="-21" r="4" fill="#ffd23f"/><circle cx="7" cy="-21" r="4" fill="#ffd23f"/>
      <path d="M-20 8 L-34 -4" stroke="${K}" stroke-width="6" stroke-linecap="round"/>
      <path d="M-36 -8 L-30 -16 L-26 -6 Z" fill="#e5484d" ${O}/>
    </g>
    ${bubble ? `<g transform="translate(${side === 'left' ? 30 : -30} -70)" class="bubble"><rect x="${side === 'left' ? 0 : -96}" y="-22" width="96" height="36" rx="10" fill="#fff" ${O}/>
      <text x="${side === 'left' ? 48 : -48}" y="3" text-anchor="middle" font-size="17" font-weight="900" fill="#e5484d" font-family="ui-monospace, monospace">${bubble}</text></g>` : ''}
  </g>`;
}

/* ================================================================== */
/* The equation strip: the math, step by step, under the scale         */
/* ================================================================== */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** A side after a move, with the move highlighted: "7 + 5 [+ 4]" or "[(]7 + 5[) × 3]". */
function moveHtml(html, plain, op, n, who) {
  const span = (s) => `<span class="${who}">${s}</span>`;
  if (op === '+' || op === '-') return `${html}${span(` ${OP_SIGN[op]} ${n}`)}`;
  return /[+−-]/.test(plain) ? `${span('(')}${html}${span(`) ${OP_SIGN[op]} ${n}`)}` : `${html}${span(` ${OP_SIGN[op]} ${n}`)}`;
}
function valueLine(eq) {
  const ok = isBalanced(eq);
  return `<span class="${ok ? 'good' : 'bad'}">${settled(eq.left)} ${ok ? '=' : '≠'} ${settled(eq.right)}${ok ? '  ✓' : ''}</span>`;
}
function strip(leftHtml, rightHtml, eq) {
  const el = $('eqStrip');
  if (!el) return;
  el.classList.remove('hidden');
  el.innerHTML = `<div class="eq-line">${leftHtml} = ${rightHtml}</div><div class="eq-value">${valueLine(eq)}</div>`;
}
function hideStrip() { $('eqStrip')?.classList.add('hidden'); }
function chainHtml(plain, moves, who) {
  let html = esc(plain), text = plain;
  for (const m of moves) { html = moveHtml(html, text, m.op, m.n, who); text = applyOp({ a: 0, b: 0, text }, m.op, m.n).text; }
  return html;
}

/** The scale and strip as the problem stands (before the student's move). */
function showProblemState() {
  const p = G.problem;
  const hidden = p.type === 'inspect' || p.type === 'critique';
  if (p.type === 'rebalance') {
    const s = p.sabotage;
    drawScale(p.after, { saboteur: { side: s.side } });
    const sabHtml = moveHtml(esc(p.start[s.side].text), p.start[s.side].text, s.op, s.n, 'sab');
    const other = esc(p.start[p.fixSide].text);
    strip(s.side === 'left' ? sabHtml : other, s.side === 'left' ? other : sabHtml, p.after);
  } else if (p.type === 'chain') {
    drawScale(p.after, { saboteur: { side: 'left' } });
    strip(chainHtml(p.start.left.text, p.moves, 'sab'), esc(p.start.right.text), p.after);
  } else {
    drawScale(sceneEq(), { hidden });
    if (p.type === 'isolate' || p.type === 'partial') strip(esc(p.start.left.text), esc(p.start.right.text), p.start);
    else hideStrip();
  }
}

/** The story: balanced, then the Saboteur strikes (twice for the boss), then it tips. Enter or a click skips. */
function runIntro(p) {
  G.intro = true; G.locked = true;
  const moves = p.type === 'chain' ? p.moves.map((m) => ({ side: 'left', ...m })) : [{ ...p.sabotage }];
  const later = (ms, fn) => G.introTimers.push(setTimeout(fn, ms));
  G.theta = 0;
  drawScale(p.start, { saboteur: { side: moves[0].side, bubble: 'Heh heh…' } });
  strip(esc(p.start.left.text), esc(p.start.right.text), p.start);
  let eq = p.start;
  const html = { left: esc(p.start.left.text), right: esc(p.start.right.text) };
  const plain = { left: p.start.left.text, right: p.start.right.text };
  moves.forEach((m, i) => later(1300 + i * 1300, () => {
    eq = { ...eq, [m.side]: applyOp(eq[m.side], m.op, m.n) };
    html[m.side] = moveHtml(html[m.side], plain[m.side], m.op, m.n, 'sab');
    plain[m.side] = eq[m.side].text;
    drawScale(eq, { saboteur: { side: m.side, bubble: `${OP_SIGN[m.op]} ${m.n}!` }, chips: [{ side: m.side, op: m.op, n: m.n, who: 'sab' }] });
    strip(html.left, html.right, eq);
  }));
  later(1300 + moves.length * 1300 + 500, endIntro);
}
function endIntro() {
  if (!G.intro) return;
  G.introTimers.forEach(clearTimeout); G.introTimers = [];
  G.intro = false; G.locked = false;
  showProblemState();
  refreshApply();
}

/* ================================================================== */
/* HUD                                                                 */
/* ================================================================== */
function renderHud() {
  UI.zonePips.innerHTML = ZONES.map((_, i) => `<div class="zone-pip ${i < G.zone ? 'done' : i === G.zone ? 'now' : ''}"></div>`).join('');
  UI.zoneName.textContent = `${G.zone + 1}. ${ZONES[G.zone].name}`;
  UI.crates.innerHTML = [0, 1, 2].map((i) => `<div class="crate ${i >= G.crates ? 'lost' : ''}"></div>`).join('');
  UI.score.textContent = G.score;
  UI.meterFill.style.width = `${Math.round(G.tilt)}%`;
  UI.meterBox.style.visibility = G.practice ? 'hidden' : 'visible';
  UI.practiceTag.classList.toggle('hidden', !G.practice);
  UI.bossBar.classList.toggle('hidden', G.zone !== 4);
  UI.bossFill.style.width = `${Math.max(0, 100 - G.bossHits * 20)}%`;
}

/* ================================================================== */
/* Problems                                                            */
/* ================================================================== */
const TAGS = {
  rebalance: 'REBALANCE THE SCALE', isolate: 'FREE ONE X-BLOCK', property: 'NAME THE PROPERTY', inspect: 'INSPECT THE REPAIR',
  critique: 'CHECK THEIR WORK', partial: 'ONE CLEVER STEP', chain: 'COPY BOTH MOVES',
};

function startZone(z, quick = false) {
  G.zone = z;
  G.queue = genZone(G.rnd, z);
  G.zoneStats[z] = G.zoneStats[z] || { right: 0, total: 0 };
  if (z === 4) G.bossHits = 0;
  showBanner(`ZONE ${z + 1}: ${ZONES[z].name.toUpperCase()}`, ZONES[z].blurb, () => nextProblem(), quick ? 600 : 1600);
}

function nextProblem() {
  if (!G.queue.length) return zoneCleared();
  loadProblem(G.queue.shift(), false);
}

function loadProblem(p, isBackup) {
  Object.assign(G, { problem: p, attempts: 0, locked: false, isBackup });
  G.sel = { op: null, amount: '', moves: [], stamped: null };
  G.tilt = TIMED.has(p.type) && !G.practice ? Math.max(G.tilt, 10) : G.tilt;
  UI.feedback.classList.add('hidden');
  UI.taskTag.textContent = `${TAGS[p.type]}${isBackup ? ' · BACKUP' : ''}`;
  renderPrompt();
  renderControls();
  G.introTimers.forEach(clearTimeout); G.introTimers = []; G.intro = false;
  if ((p.type === 'rebalance' || p.type === 'chain') && !G.skipNextIntro) runIntro(p);
  else { G.theta = 0; showProblemState(); }
  G.skipNextIntro = false;                              // a retry starts straight at the tipped scale
  renderHud();
}

/** What the scale shows before the student answers. */
function sceneEq() {
  const p = G.problem;
  if (p.type === 'rebalance' || p.type === 'chain' || p.type === 'inspect' || p.type === 'critique' || p.type === 'property') return p.after;
  return p.start;
}

function renderPrompt() {
  const p = G.problem;
  const eq = (e) => `<span class="eq">${eqText(e)}</span>`;
  let html;
  switch (p.type) {
    case 'rebalance': html = `<span class="story">Before: ${eqText(p.start)} ✓ balanced</span>${p.prompt}${eq(p.after)}`; break;
    case 'isolate': html = `${p.prompt}${eq(p.start)}`; break;
    case 'property': html = `If <span class="eq">${eqText(p.start)}</span>then<span class="eq">${eqText(p.after)}</span>Which property was used?`; break;
    case 'inspect': html = `A repair crew changed the scale. Is it still balanced?<span class="eq">Before: ${eqText(p.start)}</span><span class="eq">After: ${eqText(p.after)}</span>`; break;
    case 'critique': html = `${p.who} changed <span class="eq">${eqText(p.start)}</span>into<span class="eq">${eqText(p.after)}</span>Is ${p.who} right?`; break;
    case 'partial': html = `Start with<span class="eq">${eqText(p.start)}</span>What ONE step, done to both sides, leaves <b>${p.targetA}b</b> on the left?`; break;
    case 'chain': html = `<span class="story">Before: ${eqText(p.start)} ✓ balanced</span>${p.prompt}<span class="eq">${eqText(p.after)}</span>`; break;
    default: html = p.prompt;
  }
  UI.prompt.innerHTML = html;
}

function renderControls() {
  const p = G.problem;
  if (p.type === 'property') {
    UI.controls.innerHTML = PROPERTIES.map((name, i) => `<button type="button" class="choice" data-choice="${i}"><b>${i + 1}</b>${name}</button>`).join('');
    UI.controls.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => answerProperty(Number(b.dataset.choice))));
    return;
  }
  if (p.type === 'inspect' || p.type === 'critique') {
    if (G.sel.stamped === null) {
      const yes = p.type === 'critique' ? `${p.who.toUpperCase()} IS RIGHT` : 'STILL BALANCED';
      const no = p.type === 'critique' ? `${p.who.toUpperCase()} IS WRONG` : 'NOT BALANCED';
      UI.controls.innerHTML = `<div class="stamps"><button type="button" class="stamp yes px" data-stamp="1">1 · ${yes}</button><button type="button" class="stamp no px" data-stamp="0">2 · ${no}</button></div>`;
      UI.controls.querySelectorAll('[data-stamp]').forEach((b) => b.addEventListener('click', () => answerStamp(b.dataset.stamp === '1')));
    } else {
      const keys = Object.keys(MISTAKES);
      UI.controls.innerHTML = `<div class="label px">WHAT WENT WRONG?</div>${keys.map((k, i) => `<button type="button" class="choice" data-mistake="${k}"><b>${i + 1}</b>${MISTAKES[k]}</button>`).join('')}`;
      UI.controls.querySelectorAll('[data-mistake]').forEach((b) => b.addEventListener('click', () => answerMistake(b.dataset.mistake)));
    }
    return;
  }
  // Operation + amount problems
  const target = p.type === 'rebalance' ? `${p.fixSide.toUpperCase()} SIDE` : p.type === 'chain' ? 'RIGHT SIDE' : 'BOTH SIDES';
  const movesRow = p.type === 'chain'
    ? `<div class="label px">YOUR TWO MOVES (IN ORDER)</div><div class="moves">${[0, 1].map((i) => `<div class="move-slot ${G.sel.moves[i] ? 'filled' : ''}">${G.sel.moves[i] ? `${OP_SIGN[G.sel.moves[i].op]} ${G.sel.moves[i].n}` : `move ${i + 1}`}</div>`).join('')}</div>`
    : '';
  UI.controls.innerHTML = `
    <div class="label px">1. PICK AN OPERATION</div>
    <div class="op-row">${['+', '-', '×', '÷'].map((op, i) => `<button type="button" class="op-btn ${G.sel.op === op ? 'on' : ''}" data-op="${op}">${OP_SIGN[op]}<small>${i + 1}</small></button>`).join('')}</div>
    <div class="label px">2. HOW MUCH?</div>
    <div class="amount-row"><input id="amount" class="amount" inputmode="numeric" maxlength="2" value="${G.sel.amount}" placeholder="?" autocomplete="off"></div>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => `<button type="button" data-digit="${d}">${d}</button>`).join('')}</div>
    ${movesRow}
    <button type="button" id="applyBtn" class="apply px">${p.type === 'chain' ? (G.sel.moves.length === 0 ? 'ADD MOVE 1' : 'ADD MOVE 2 + APPLY') : `APPLY TO ${target}`} (ENTER)</button>`;
  UI.controls.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => pickOp(b.dataset.op)));
  UI.controls.querySelectorAll('[data-digit]').forEach((b) => b.addEventListener('click', () => typeDigit(String(b.dataset.digit))));
  const input = $('amount');
  input.addEventListener('input', () => { G.sel.amount = input.value.replace(/\D/g, '').slice(0, 2); input.value = G.sel.amount; refreshApply(); });
  $('applyBtn').addEventListener('click', submitMove);
  refreshApply();
}

function refreshApply() {
  const btn = $('applyBtn');
  if (btn) btn.disabled = G.locked || G.intro || !G.sel.op || parseAmount(G.sel.amount, G.sel.op) === null;
}
function pickOp(op) {
  if (G.locked) return;
  hubAudio.playSelect();
  G.sel.op = op;
  UI.controls.querySelectorAll('[data-op]').forEach((b) => b.classList.toggle('on', b.dataset.op === op));
  refreshApply();
}
function typeDigit(d) {
  if (G.locked) return;
  G.sel.amount = (G.sel.amount + d).replace(/^0+(?=\d)/, '').slice(0, 2);
  const input = $('amount');
  if (input) input.value = G.sel.amount;
  refreshApply();
}

/* ================================================================== */
/* Answers                                                             */
/* ================================================================== */
function submitMove() {
  const p = G.problem;
  if (G.locked || !G.sel.op) return;
  const n = parseAmount(G.sel.amount, G.sel.op);
  if (n === null) return;
  const op = G.sel.op;
  if (p.type === 'chain' && G.sel.moves.length === 0) {
    G.sel.moves.push({ op, n });
    G.sel.op = null; G.sel.amount = '';
    hubAudio.playSelect();
    renderControls();
    const partial = { ...p.after, right: applyOp(p.start.right, op, n) };
    drawScale(partial, { saboteur: { side: 'left' }, chips: [{ side: 'right', op, n, who: 'you' }] });
    strip(chainHtml(p.start.left.text, p.moves, 'sab'), chainHtml(p.start.right.text, [{ op, n }], 'you'), partial);
    return;
  }
  let res;
  if (p.type === 'rebalance') res = checkRebalance(p, op, n);
  else if (p.type === 'isolate') res = checkIsolate(p, op, n);
  else if (p.type === 'partial') res = checkPartial(p, op, n);
  else res = checkChain(p, [...G.sel.moves, { op, n }]);
  if (res.result) showMove(p, op, n, res.result);
  settle(res);
}

/** Animates the student's move on the scale and shows it in blue in the equation strip. */
function showMove(p, op, n, result) {
  if (p.type === 'rebalance') {
    const s = p.sabotage;
    drawScale(result, { saboteur: { side: s.side }, chips: [{ side: p.fixSide, op, n, who: 'you' }] });
    const sabHtml = moveHtml(esc(p.start[s.side].text), p.start[s.side].text, s.op, s.n, 'sab');
    const youHtml = moveHtml(esc(p.after[p.fixSide].text), p.after[p.fixSide].text, op, n, 'you');
    strip(s.side === 'left' ? sabHtml : youHtml, s.side === 'left' ? youHtml : sabHtml, result);
  } else if (p.type === 'chain') {
    drawScale(result, { saboteur: { side: 'left' }, chips: [{ side: 'right', op, n, who: 'you' }] });
    strip(chainHtml(p.start.left.text, p.moves, 'sab'), chainHtml(p.start.right.text, [...G.sel.moves, { op, n }], 'you'), result);
  } else {
    drawScale(result, { chips: [{ side: 'left', op, n, who: 'you' }, { side: 'right', op, n, who: 'you' }] });
    strip(moveHtml(esc(p.start.left.text), p.start.left.text, op, n, 'you'), moveHtml(esc(p.start.right.text), p.start.right.text, op, n, 'you'), result);
  }
}

function answerProperty(i) {
  if (G.locked) return;
  const res = checkProperty(G.problem, PROPERTIES[i]);
  UI.controls.querySelectorAll('[data-choice]').forEach((b) => {
    if (Number(b.dataset.choice) === i) b.classList.add(res.correct ? 'right' : 'wrong');
  });
  settle(res);
}

function answerStamp(says) {
  if (G.locked) return;
  const p = G.problem;
  const res = checkStamp(p, says);
  drawScale(p.after);                                   // reveal the real tilt
  strip(esc(p.after.left.text), esc(p.after.right.text), p.after);
  if (res.correct && !p.equivalent) {                   // right stamp; now name the mistake
    hubAudio.playCoinClink();
    G.sel.stamped = true;
    showFeedback(true, res.message);
    renderControls();
    return;
  }
  settle(res);
}
function answerMistake(key) {
  if (G.locked) return;
  settle(checkMistake(G.problem, key));
}

function settle(res) {
  const p = G.problem;
  if (res.correct) {
    G.locked = true;
    const first = G.attempts === 0 && !G.isBackup;
    G.answered += 1;
    G.zoneStats[G.zone].total += 1;
    if (first) { G.firstTry += 1; G.zoneStats[G.zone].right += 1; }
    G.score += first ? 100 : 50;
    if (!G.practice && TIMED.has(p.type)) G.tilt = Math.max(0, G.tilt - 35);
    hubAudio.playCoinClink();
    if (G.zone === 4) { G.bossHits += 1; flash('HIT!'); }
    showFeedback(true, res.message);
    renderHud();
    setTimeout(() => nextProblem(), 1500);
    return;
  }
  G.attempts += 1;
  G.mistakes[res.key] = (G.mistakes[res.key] || 0) + 1;
  hubAudio.playLockRattle();
  UI.app.classList.remove('shake'); void UI.app.offsetWidth; UI.app.classList.add('shake');
  if (!G.practice) bumpTilt(34);
  if (G.attempts >= 2) {
    G.locked = true;
    showFeedback(false, res.message, workedSolution(p), 'TRY A BACKUP PROBLEM (ENTER)', () => loadProblem(genBackup(G.rnd, p), true));
  } else {
    showFeedback(false, `${res.message} Try again!`);
    if (p.type === 'chain') { G.sel.moves = []; }
    G.sel.op = null; G.sel.amount = ''; G.sel.stamped = null;
    renderControls();
    setTimeout(() => { if (!G.locked && G.problem === p) showProblemState(); }, 1400);
  }
  renderHud();
}

function showFeedback(good, message, steps, buttonText, onButton) {
  UI.feedback.className = `feedback ${good ? 'good' : 'bad'}`;
  UI.feedback.innerHTML = `${message}${steps ? `<ol class="steps">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>` : ''}${buttonText ? `<button type="button" id="fbBtn" class="px">${buttonText}</button>` : ''}`;
  if (onButton) $('fbBtn').addEventListener('click', onButton);
}

/* ================================================================== */
/* Tilt meter and crates                                               */
/* ================================================================== */
function bumpTilt(amount) {
  G.tilt += amount;
  if (G.tilt >= 100) loseCrate();
  renderHud();
}
function loseCrate() {
  G.tilt = 25;
  G.crates -= 1;
  hubAudio.playLockRattle();
  const gone = UI.scene.querySelectorAll('g[transform^="translate(400 160)"] > g')[G.crates];
  if (gone) gone.classList.add('fall');
  flash(G.crates > 0 ? 'A CRATE SLIPPED!' : 'LAST CRATE GONE!');
  if (G.crates <= 0) {
    G.locked = true;
    setTimeout(() => { UI.fail.classList.remove('hidden'); }, 900);
  }
}
function tick(now) {
  const dt = Math.min(0.25, (now - G.last) / 1000);
  G.last = now;
  const secs = SECONDS_TO_TIP[G.zone];
  if (!G.practice && secs && G.problem && TIMED.has(G.problem.type) && !G.locked && UI.briefing.classList.contains('hidden') && G.crates > 0) {
    G.tilt += (100 / secs) * dt;
    if (G.tilt >= 100) loseCrate();
    UI.meterFill.style.width = `${Math.round(Math.min(100, G.tilt))}%`;
  }
  G.ticker = requestAnimationFrame(tick);
}

/* ================================================================== */
/* Zones, banners, report                                              */
/* ================================================================== */
function flash(text) {
  UI.banner.innerHTML = text;
  UI.banner.classList.remove('hidden');
  clearTimeout(flash.t);
  flash.t = setTimeout(() => UI.banner.classList.add('hidden'), 900);
}
function showBanner(title, sub, then, ms = 1600) {
  UI.banner.innerHTML = `${title}<small>${sub}</small>`;
  UI.banner.classList.remove('hidden');
  hubAudio.playQuestOpen();
  clearTimeout(flash.t);
  setTimeout(() => { UI.banner.classList.add('hidden'); then(); }, ms);
}
function zoneCleared() {
  if (G.zone >= ZONES.length - 1) return finish();
  hubAudio.playLevelUp();
  G.tilt = 0;
  startZone(G.zone + 1);
}

function stars(ratio) { return ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : 1; }

const SKILL_TIPS = {
  different_amount: 'Use the SAME amount on both sides.',
  opposite_op: 'Give the other side the same change, not the opposite one.',
  different_op: 'Use the same operation on both sides.',
  multiplied_instead: 'To free x from 4x, divide (not multiply).',
  wrong_divisor: 'Divide by the number of x-blocks.',
  add_sub_with_coefficient: '4x means 4 times x. Undo times with divide.',
  added_instead: 'To undo + 5, subtract 5 from both sides.',
  subtracted_instead: 'To undo − 5, add 5 to both sides.',
  wrong_amount: 'Undo exactly the amount that is with x.',
  wrong_property: 'Match the step to its property: add, subtract, multiply or divide.',
  wrong_stamp: 'Work out both sides before you stamp.',
  wrong_mistake: 'Look closely at what changed on each side.',
  went_too_far: 'Divide by just enough to get the blocks you need.',
  order: 'When copying two steps, keep them in the same order.',
  different_steps: 'Copy the other side’s steps exactly.',
  wrong_op: 'Think about which operation makes the number smaller.',
  mult_with_sum: 'Undo adding with subtracting, and subtracting with adding.',
};

function finish() {
  cancelAnimationFrame(G.ticker);
  hubAudio.playLevelUp();
  const total = Math.max(1, G.answered);
  const acc = Math.round((G.firstTry / total) * 100);
  const st = stars(G.firstTry / total);
  const mins = Math.max(1, Math.round((Date.now() - G.started) / 60000));
  $('reportStars').textContent = '★'.repeat(st) + '☆'.repeat(3 - st);
  $('reportStats').innerHTML = [['SCORE', G.score], ['FIRST TRY', `${G.firstTry}/${total}`], ['ACCURACY', `${acc}%`], ['TIME', `${mins} min`]]
    .map(([l, v]) => `<div class="stat"><div class="px">${l}</div><div>${v}</div></div>`).join('');
  $('reportZones').innerHTML = ZONES.map((z, i) => {
    const s = G.zoneStats[i];
    if (!s || !s.total) return `<div class="rz">${z.name}<div class="s">skipped</div></div>`;
    const k = stars(s.right / s.total);
    return `<div class="rz">${z.name}<div class="s">${'★'.repeat(k)}${'☆'.repeat(3 - k)}</div></div>`;
  }).join('');
  const top = Object.entries(G.mistakes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => SKILL_TIPS[k]).filter(Boolean);
  $('reportSkills').innerHTML = top.length ? `Skills to sharpen:<ul>${top.map((t) => `<li>${t}</li>`).join('')}</ul>` : 'No mistakes to sharpen. Excellent balancing!';
  UI.report.classList.remove('hidden');
  G.result = {
    score: G.firstTry, total, accuracy: acc, stars: st, bossDefeated: G.startZone <= 4 && G.zoneStats[4]?.total > 0,
    practiceMode: G.practice,
  };
}

/* ================================================================== */
/* Start, retry, exit, keyboard                                        */
/* ================================================================== */
function begin(practice) {
  hubAudio.unlockAudio();
  Object.assign(G, { practice, crates: 3, tilt: 0, score: 0, firstTry: 0, answered: 0, mistakes: {}, zoneStats: [], bossHits: 0, started: Date.now() });
  UI.briefing.classList.add('hidden');
  UI.report.classList.add('hidden');
  UI.fail.classList.add('hidden');
  G.last = performance.now();
  cancelAnimationFrame(G.ticker);
  G.ticker = requestAnimationFrame(tick);
  startZone(G.startZone);
}
function retryZone() {
  UI.fail.classList.add('hidden');
  Object.assign(G, { crates: 3, tilt: 0, locked: false });
  G.zoneStats[G.zone] = { right: 0, total: 0 };
  G.skipNextIntro = true;
  startZone(G.zone, true);                              // short banner: back in play in under 2 seconds
}
function exitToTown() {
  hubAudio.playSelect();
  if (IN_TOWN) window.parent.postMessage({ type: 'CARTRIDGE_EXIT_REQUEST' }, '*');
  else location.href = '../../../../index.html';
}
function backToTown() {
  if (IN_TOWN && G.result) window.parent.postMessage({ type: 'CARTRIDGE_COMPLETE', payload: G.result }, '*');
  else exitToTown();
}

function updateSoundIcon() { $('soundBtn').textContent = hubAudio.isMuted ? '🔇' : '🔊'; }

function init() {
  UI.zoneButtons.innerHTML = ZONES.map((z, i) => `<button type="button" class="zone-btn ${i === 0 ? 'on' : ''}" data-zone="${i}">${i + 1}. ${z.name}</button>`).join('');
  UI.zoneButtons.querySelectorAll('[data-zone]').forEach((b) => b.addEventListener('click', () => {
    G.startZone = Number(b.dataset.zone);
    UI.zoneButtons.querySelectorAll('[data-zone]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('startBtn').addEventListener('click', () => begin(false));
  $('practiceBtn').addEventListener('click', () => begin(true));
  $('retryBtn').addEventListener('click', retryZone);
  $('againBtn').addEventListener('click', () => { UI.report.classList.add('hidden'); UI.briefing.classList.remove('hidden'); });
  $('townBtn').addEventListener('click', backToTown);
  $('exitBtn').addEventListener('click', exitToTown);
  $('helpBtn').addEventListener('click', () => { hubAudio.playSelect(); UI.briefing.classList.toggle('hidden'); });
  $('soundBtn').addEventListener('click', () => { hubAudio.toggleMute(); updateSoundIcon(); });
  updateSoundIcon();
  const stripEl = document.createElement('div');
  stripEl.id = 'eqStrip'; stripEl.className = 'eq-strip hidden';
  $('stage').appendChild(stripEl);
  $('stage').addEventListener('click', () => { if (G.intro) endIntro(); });

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'HUB_INIT' && typeof e.data.payload?.isMuted === 'boolean' && e.data.payload.isMuted !== hubAudio.isMuted) {
      hubAudio.toggleMute(); updateSoundIcon();
    }
  });
  if (IN_TOWN) window.parent.postMessage({ type: 'CARTRIDGE_READY' }, '*');

  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.id === 'amount' && /^[0-9]$/.test(e.key)) return;   // the box handles its own typing
    const key = e.key;
    if (key === 'm' || key === 'M') { $('soundBtn').click(); return; }
    if (key === 'h' || key === 'H') { $('helpBtn').click(); return; }
    if (!UI.briefing.classList.contains('hidden')) { if (key === 'Enter') { e.preventDefault(); begin(false); } return; }
    if (!UI.fail.classList.contains('hidden')) { if (key === 'Enter') { e.preventDefault(); retryZone(); } return; }
    if (!UI.report.classList.contains('hidden') || !G.problem) return;
    if (G.intro && (key === 'Enter' || key === ' ')) { e.preventDefault(); endIntro(); return; }
    const fb = $('fbBtn');
    if (fb && key === 'Enter') { e.preventDefault(); fb.click(); return; }
    if (G.locked) return;
    const p = G.problem;
    const n = Number(key);
    if (p.type === 'property' && n >= 1 && n <= 4) return answerProperty(n - 1);
    if ((p.type === 'inspect' || p.type === 'critique') && G.sel.stamped === null && (n === 1 || n === 2)) return answerStamp(n === 1);
    if ((p.type === 'inspect' || p.type === 'critique') && G.sel.stamped && n >= 1 && n <= 4) return answerMistake(Object.keys(MISTAKES)[n - 1]);
    if (['rebalance', 'isolate', 'partial', 'chain'].includes(p.type)) {
      if (key >= '1' && key <= '4' && !G.sel.op) { e.preventDefault(); return pickOp(['+', '-', '×', '÷'][n - 1]); }
      if (key === '+') return pickOp('+');
      if (key === '-') return pickOp('-');
      if (key === '*' || key === 'x') return pickOp('×');
      if (key === '/') { e.preventDefault(); return pickOp('÷'); }
      if (/^[0-9]$/.test(key)) return typeDigit(key);
      if (key === 'Backspace') { G.sel.amount = G.sel.amount.slice(0, -1); const i = $('amount'); if (i) i.value = G.sel.amount; refreshApply(); return; }
      if (key === 'Enter') { e.preventDefault(); return submitMove(); }
    }
  });

  // Show a sample scale behind the briefing.
  G.problem = null;
  drawScale({ left: { a: 0, b: 12, text: '7 + 5' }, right: { a: 0, b: 12, text: '12' }, x: null });
  renderHud();
}

init();

// For automated browser tests only (index.html?test): lets a test read the current problem.
if (new URLSearchParams(location.search).has('test')) window.__counterweight = { G };
