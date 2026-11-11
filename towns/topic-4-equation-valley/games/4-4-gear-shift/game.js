// Gear Shift (Lesson 4-4): the gearbox screen and controls. The math lives in gears.js;
// zones, timer, lives, scoring and the report come from the shared game shell (shared/game/gameShell.js).
//
// Each problem moves through steps (G.phase):
//   writeX / writeD   build a × equation, then a ÷ equation, from the story with tiles   (Two Ways)
//   write             build one equation from the story                                  (boss: half off)
//   combine           ½ × base first                                                     (boss: triangle)
//   gear              build the opposite gear and drop it in the gearbox
//   calc              work out the answer yourself (big numbers and the boss)
//   pick              choose an equation or a property                                   (Right Gear)
import {
  ZONES, SIGN, fmt, parseNumber, apply, exprText, eqText, runForward, afterStep, checkLine, tilesText,
  genZone, genBackup, checkWritten, checkGear, checkCalc, checkHalf, checkPick, workedSolution,
} from './gears.js';
import { hubAudio } from '../../../../shared/audio.js';
import { createGame } from '../../../../shared/game/gameShell.js';
import { dragOrTap, inside } from '../../../../shared/game/drag.js';

const SKILL_TIPS = {
  did_not_undo: 'Shift to the OPPOSITE gear: undo × with ÷, and ÷ with ×.',
  add_sub_with_coefficient: '4n means 4 TIMES n. Undo times with divide.',
  used_total: 'Shift by the gear in the box, not by the output number.',
  wrong_amount: 'Undo exactly the gear in the box, the same number.',
  wrong_op: 'Match the gear: × undoes ÷, ÷ undoes ×, − undoes +.',
  twostep_order: 'In a two-step equation, undo the + or − first, then the × or ÷.',
  multiplied_instead: 'Read the gear: ÷ means divide.',
  divided_instead: 'Read the gear: × means multiply.',
  flipped_division: 'In division, the bigger total comes first: 52 ÷ 4, not 4 ÷ 52.',
  place_value: 'Estimate first, so the answer has the right number of digits.',
  arith: 'Check your multiplying and dividing with the opposite operation.',
  wrong_relationship: 'The letter is how many in EACH group. Groups × each = total.',
  multiplied_both: 'Multiplying the two story numbers makes something far too big.',
  check_fails: 'Say the story in words, then write it as an equation.',
  half_trap: 'Half of t is t ÷ 2, not t × 2.',
  combine_error: '½ × 8 means half of 8.',
  wrong_property: 'Undo × with the Division Property, and ÷ with the Multiplication Property.',
};

const shell = createGame({
  zones: ZONES, makeZone: genZone, makeBackup: genBackup, workedSolution, showProblem,
  seconds: [40, 70, 60, 35, 80],                       // strain: seconds until a spare gear breaks, per zone
  meterFloor: 8, wrongBump: 30, rightRelief: 30, pauseOnBanner: true,
  lifeLostText: (left) => (left > 0 ? 'A GEAR BROKE!' : 'LAST SPARE GEAR GONE!'),
  onLifeLost: () => { const s = $('sparks'); if (s) s.classList.remove('hidden'); },
  bossHitText: 'UNSTUCK!', winDelay: (p) => (p.type === 'pick' ? 1200 : 1600),
  skillTips: SKILL_TIPS, perfectText: 'No mistakes to sharpen. Smooth shifting!',
  lettersAreInput: () => G.phase && G.phase.startsWith('write'), onKey, testName: '__gears',
});
const { G, UI, $, win, miss, showFeedback } = shell;
Object.assign(G, { phase: null, work: null, rail: [], used: [], typed: '', written: [], pending: null, sel: { op: null, amount: '', armed: false } });

/* ================================================================== */
/* Drawing the gearbox                                                 */
/* ================================================================== */
const K = '#1d1433';
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round"`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** A gear: teeth around a circle. */
function gear(cx, cy, r, teeth, fill, cls = '') {
  const pts = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a = (Math.PI * i) / teeth;
    const rr = i % 2 ? r : r + 9;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `<g class="${cls}"><polygon points="${pts.join(' ')}" fill="${fill}" ${O}/><circle cx="${cx}" cy="${cy}" r="${r * 0.32}" fill="#ffd23f" ${O}/></g>`;
}
function backdrop() {
  return `
    <path d="M0 210 L80 175 L150 195 L220 165 L250 190 L250 520 L0 520 Z" fill="#d98a52" ${O}/>
    <path d="M800 200 L720 170 L660 190 L600 165 L550 195 L550 520 L800 520 Z" fill="#d98a52" ${O}/>
    <rect x="0" y="420" width="800" height="100" fill="#a9512b"/><path d="M0 420 H800" stroke="${K}" stroke-width="3"/>
    <path d="M30 470 H770" stroke="#6b4425" stroke-width="10"/><path d="M30 470 H770" stroke="${K}" stroke-width="2" stroke-dasharray="4 26"/>`;
}
/** A wheel with a label in the middle (the drive wheel on the left, the output on the right). */
function wheel(cx, text, { color = '#c4935a', textColor = K, spin = '', label = '', pop = false } = {}) {
  const t = String(text);
  return `<g>${gear(cx, 300, 62, 14, color, spin ? `turn ${spin}` : '')}
    <circle cx="${cx}" cy="300" r="44" fill="#fff4d6" ${O}/>
    <text class="${pop ? 'pop-in' : ''}" x="${cx}" y="${310 + (t.length > 5 ? -2 : 0)}" text-anchor="middle" font-size="${t.length > 5 ? 20 : t.length > 3 ? 26 : 32}" font-weight="900" fill="${textColor}" font-family="ui-monospace, monospace">${esc(t)}</text>
    ${label ? `<text x="${cx}" y="215" text-anchor="middle" font-size="14" font-weight="900" fill="${K}" font-family="ui-monospace, monospace">${esc(label)}</text>` : ''}</g>`;
}
/**
 * The gearbox scene.
 *   label   the sign on the box ("4n", "t ÷ 3", "? ? ?")
 *   inText / outText  the drive wheel and the output wheel; inColor/outColor; inLabel/outLabel above them
 *   slot    a gear token sitting on top ("÷ 4"), or null
 *   spin    'fwd' | 'back' | null      ratio  how much faster the output turns (for the look only)
 */
function drawGearbox({ label, inText, outText, inColor = '#3a8ef0', inTextColor = '#fff', outColor = '#c4935a', inLabel = 'DRIVE', outLabel = 'OUTPUT',
  slot = null, spin = null, ratio = 'up', pop = '', signColor = '#fff4d6' }) {
  const L = String(label);
  const fs = L.length > 16 ? 22 : L.length > 10 ? 28 : 34;
  const sp = (fast) => (spin ? `${fast ? 'fast' : 'slow'} ${spin === 'back' ? 'back' : ''}` : 'idle');
  const fastOut = ratio === 'up';
  UI.scene.innerHTML = `${backdrop()}
    ${wheel(110, inText, { color: inColor === '#3a8ef0' ? '#7b8bb0' : inColor, textColor: inColor === '#3a8ef0' ? '#1f63c9' : inTextColor, spin: sp(!fastOut), label: inLabel, pop: pop === 'in' })}
    ${wheel(690, outText, { color: outColor, spin: sp(fastOut), label: outLabel, pop: pop === 'out' })}
    <g id="gearbox">
      <path d="M172 300 H262 M538 300 H628" stroke="${K}" stroke-width="16"/><path d="M172 300 H262 M538 300 H628" stroke="#8b90a3" stroke-width="10"/>
      <rect class="box-body" x="255" y="150" width="290" height="240" rx="18" fill="#8b90a3" ${O}/>
      <path class="box-body" d="M350 104 L450 104 L430 150 L370 150 Z" fill="#ffd23f" ${O}/>
      <text x="400" y="132" text-anchor="middle" font-size="12" font-weight="900" fill="${K}" font-family="'Press Start 2P', monospace">SHIFT</text>
      <rect x="272" y="166" width="256" height="70" rx="10" fill="${signColor}" ${O}/>
      <text x="400" y="${212 + (34 - fs) / 3}" text-anchor="middle" font-size="${fs}" font-weight="900" fill="${K}" font-family="ui-monospace, monospace">${esc(L)}</text>
      ${gear(350, 315, 44, 12, '#6b6f80', `turn ${sp(!fastOut)}`)}
      ${gear(440, 322, 26, 8, '#6b6f80', `turn ${sp(fastOut)} back`)}
      <text x="400" y="382" text-anchor="middle" font-size="15" font-weight="900" fill="#fff" font-family="ui-monospace, monospace">${spin === 'back' ? '◀ ◀ REVERSE' : spin === 'fwd' ? 'CHECK ▶ ▶' : ''}</text>
      ${slot ? `<g class="slot-drop">${gear(400, 80, 26, 10, '#7b8bb0')}<rect x="356" y="64" width="88" height="32" rx="8" fill="#3a8ef0" ${O}/><text x="400" y="88" text-anchor="middle" font-size="20" font-weight="900" fill="#fff" font-family="ui-monospace, monospace">${esc(slot)}</text></g>` : ''}
    </g>
    <g id="sparks" class="hidden"><circle class="sparks" cx="560" cy="160" r="16" fill="#ffd23f"/><circle class="sparks" cx="240" cy="170" r="12" fill="#ff7a8a" style="animation-delay:0.3s"/></g>`;
}
const ratioOf = (eq) => (eq.kind === 'div' ? 'down' : 'up');

/** The gearbox as the current step stands, before the student acts. */
function showState() {
  const p = G.problem, w = G.work;
  if (G.phase === 'pick') {
    drawGearbox({ label: p.ask === 'property' ? eqText(p.eq) : '? = ?', inText: p.eq.letter, outText: p.ask === 'property' ? fmt(p.eq.c) : fmt(p.eq.c), ratio: ratioOf(p.eq) });
    strip([p.ask === 'property' ? 'Which property undoes this gear?' : '<span class="small">Which equation says what the story says?</span>']);
    return;
  }
  if (G.phase.startsWith('write')) {
    drawGearbox({ label: G.rail.length ? tilesText(G.rail, p.eq.letter) : '? ? ?', inText: p.eq.letter, outText: '?', ratio: ratioOf(p.eq) });
    strip([...G.written.map((t) => `<span class="good">${esc(t)} ✓</span>`), G.written.length ? '' : '<span class="small">Read the story. Build the equation with the tiles.</span>'].filter(Boolean));
    return;
  }
  if (G.phase === 'calc') {
    const { op, n } = G.pending;
    drawGearbox({ label: exprText(w), inText: '?', outText: fmt(w.c), slot: `${SIGN[op]} ${fmt(n)}`, ratio: ratioOf(w), inLabel: `${w.kind === 'twostep' ? `${fmt(w.k)}${w.letter}` : w.letter} =` });
    strip([eqText(w), `${fmt(w.c)} <span class="you">${SIGN[op]} ${fmt(n)}</span> = ?`]);
    return;
  }
  drawGearbox({ label: exprText(w), inText: w.letter, outText: fmt(w.c), ratio: ratioOf(w), signColor: G.phase === 'combine' ? '#ffe3cc' : '#fff4d6' });
  const from = w !== p.eq ? [`<span class="small">from ${eqText(p.eq)}</span>`] : [];   // second step of a two-step or the triangle
  strip(G.phase === 'combine' ? [eqText(w), `<span class="small">½ × ${fmt(w.m)} = ?</span>`] : [...from, eqText(w)]);
}
function strip(lines) {
  const el = $('eqStrip');
  if (!el) return;
  el.classList.remove('hidden');
  el.innerHTML = lines.map((l) => {
    const small = l.startsWith('<span class="small">');
    return `<div class="eq-line ${small ? 'small' : ''}">${small ? l.replace(/^<span class="small">(.*)<\/span>$/, '$1') : l}</div>`;
  }).join('');
}

/* ================================================================== */
/* Problems and steps                                                  */
/* ================================================================== */
const TAGS = {
  writeX: 'STEP 1 · A × EQUATION', writeD: 'STEP 2 · A ÷ EQUATION', write: 'STEP 1 · WRITE THE EQUATION', combine: 'STEP 1 · COMBINE',
  gear: 'SHIFT GEARS', calc: 'WORK IT OUT', pick: 'PICK THE RIGHT ONE',
};
/** The shell has set G.problem, G.attempts and G.isBackup; set up this game's own steps. */
function showProblem(p) {
  Object.assign(G, { rail: [], used: [], typed: '', written: [], work: p.eq, pending: null });
  const first = { twoways: 'writeX', write: 'write', half: 'combine', pick: 'pick' }[p.type] || 'gear';
  enterPhase(first);
}
function enterPhase(phase) {
  G.phase = phase;
  G.sel = { op: null, amount: '', armed: false };
  G.typed = '';
  if (phase.startsWith('write')) { G.rail = []; G.used = []; }
  UI.taskTag.textContent = `${TAGS[phase]}${G.isBackup ? ' · BACKUP' : ''}`;
  renderPrompt();
  renderControls();
  showState();
}

function renderPrompt() {
  const p = G.problem, w = G.work;
  const story = p.story ? `<span class="story">${esc(p.story)}</span>` : '';
  let html;
  switch (G.phase) {
    case 'writeX': html = `Write a <b>multiplication</b> equation for the story.${story}`; break;
    case 'writeD': html = `Now write a <b>division</b> equation for the same story.${story}`; break;
    case 'write': html = `Turn the story into an equation.${story}`; break;
    case 'combine': html = `Stuck! Combine first: what is ½ × ${fmt(w.m)}?${story}`; break;
    case 'calc': html = `Gear set: <b>${SIGN[G.pending.op]} ${fmt(G.pending.n)}</b>. Now work it out yourself.<span class="eq">${eqText(w)}</span>`; break;
    case 'pick': html = p.ask === 'property' ? `Which property of equality would you use to solve this?<span class="eq">${eqText(p.eq)}</span>` : `Which equation fits the story?${story}`; break;
    default: html = `${p.type === 'gear' && !p.calc ? 'A hidden drive wheel turns the gearbox.' : 'Shift gears.'} Build the opposite gear and drop it in to find <b>${w.letter}</b>.<span class="eq">${eqText(w)}</span>`;
  }
  UI.prompt.innerHTML = html;
}

/* ================================================================== */
/* Controls                                                            */
/* ================================================================== */
function renderControls() {
  const p = G.problem;
  if (G.phase === 'pick') {
    UI.controls.innerHTML = p.options.map((o, i) => `<button type="button" class="choice" data-choice="${i}"><b>${i + 1}</b>${esc(o.text)}</button>`).join('');
    UI.controls.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => answerPick(Number(b.dataset.choice))));
    return;
  }
  if (G.phase.startsWith('write')) {
    const nums = p.tiles.map((v, i) => `<button type="button" class="tile num" data-tile="num" data-i="${i}" ${G.used.includes(i) ? 'disabled' : ''}>${fmt(v)}<small>${i + 1}</small></button>`).join('');
    const varUsed = G.rail.some((t) => t.t === 'var');
    const chip = (t) => `<span class="tile chip ${t.t === 'num' ? 'num' : t.t === 'var' ? 'var' : t.t === 'eq' ? 'eqs' : ''}">${t.t === 'num' ? fmt(t.v) : t.t === 'var' ? p.eq.letter : t.t === 'eq' ? '=' : SIGN[t.v]}</span>`;
    UI.controls.innerHTML = `
      ${G.written.map((t) => `<div class="done-eq">✓ ${esc(t)}</div>`).join('')}
      <div class="label px">${G.phase === 'writeX' ? 'YOUR × EQUATION' : G.phase === 'writeD' ? 'YOUR ÷ EQUATION' : 'YOUR EQUATION'}</div>
      <div id="rail" class="rail ${G.rail.length ? 'filled' : ''}">${G.rail.length ? G.rail.map(chip).join('') : '<span class="empty">Drag or tap tiles to build it here</span>'}</div>
      <div class="tiles">${nums}
        <button type="button" class="tile var" data-tile="var" ${varUsed ? 'disabled' : ''}>${p.eq.letter}</button>
        <button type="button" class="tile" data-tile="×">×</button><button type="button" class="tile" data-tile="÷">÷</button>
        <button type="button" class="tile eqs" data-tile="eq">=</button></div>
      <div class="row-btns"><button type="button" id="undoTile" class="px">⌫ BACK</button><button type="button" id="clearRail" class="px">CLEAR</button>
        <button type="button" id="buildBtn" class="go px">BUILD IT (ENTER)</button></div>
      <div id="helpLine" class="help-line">Keys: <kbd>1</kbd>–<kbd>${p.tiles.length}</kbd> numbers · <kbd>${p.eq.letter}</kbd> · <kbd>*</kbd> × · <kbd>/</kbd> ÷ · <kbd>=</kbd></div>`;
    UI.controls.querySelectorAll('[data-tile]').forEach((b) => b.addEventListener('pointerdown', (e) => startDrag(e, 'tile')));
    $('undoTile').addEventListener('click', removeTile);
    $('clearRail').addEventListener('click', () => { if (!G.locked) { G.rail = []; G.used = []; renderControls(); showState(); } });
    $('buildBtn').addEventListener('click', submitWritten);
    return;
  }
  if (G.phase === 'combine' || G.phase === 'calc') {
    const sum = G.phase === 'combine' ? `½ × ${fmt(G.work.m)} = ?` : `${fmt(G.work.c)} ${SIGN[G.pending.op]} ${fmt(G.pending.n)} = ?`;
    UI.controls.innerHTML = `
      <div class="sum">${sum}</div>
      <div id="typed" class="typed">${G.typed || '?'}</div>
      <div class="pad six">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0, ','].map((d) => `<button type="button" data-digit="${d}">${d}</button>`).join('')}<button type="button" data-digit="back">⌫</button></div>
      <button type="button" id="checkBtn" class="apply px">CHECK (ENTER)</button>
      <div id="helpLine" class="help-line">Use scrap paper if you need it. Commas are optional: 2,392 or 2392.</div>`;
    UI.controls.querySelectorAll('[data-digit]').forEach((b) => b.addEventListener('click', () => typeKey(String(b.dataset.digit))));
    $('checkBtn').addEventListener('click', submitTyped);
    return;
  }
  // gear: build a gear token and drop it in the gearbox
  UI.controls.innerHTML = `
    <div class="label px">1. WHICH GEAR?</div>
    <div class="op-row">${['×', '÷', '+', '-'].map((op) => `<button type="button" class="op-btn ${G.sel.op === op ? 'on' : ''}" data-op="${op}">${SIGN[op]}</button>`).join('')}</div>
    <div class="label px">2. HOW MUCH?</div>
    <div class="pad six">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => `<button type="button" data-digit="${d}">${d}</button>`).join('')}<button type="button" data-digit="back" style="grid-column: span 2">⌫</button></div>
    <div class="label px">3. DRAG THE GEAR INTO THE GEARBOX</div>
    <div class="tray"><button type="button" id="block" class="block gear"></button></div>
    <div id="helpLine" class="help-line"></div>`;
  UI.controls.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => pickOp(b.dataset.op)));
  UI.controls.querySelectorAll('[data-digit]').forEach((b) => b.addEventListener('click', () => typeKey(String(b.dataset.digit))));
  $('block').addEventListener('pointerdown', (e) => startDrag(e, 'block'));
  refreshBlock();
}

/* ---- the gear token ---- */
const gearAmount = () => parseNumber(G.sel.amount);
const gearReady = () => G.sel.op && gearAmount() !== null && gearAmount() > 0;
function refreshBlock() {
  const b = $('block');
  if (!b) return;
  b.textContent = G.sel.op ? `${SIGN[G.sel.op]} ${G.sel.amount ? fmt(Number(G.sel.amount)) : '?'}` : '? ?';
  b.className = `block gear ${gearReady() ? 'ready' : 'empty'} ${G.sel.armed ? 'armed' : ''}`;
  UI.controls.querySelectorAll('[data-op]').forEach((x) => x.classList.toggle('on', x.dataset.op === G.sel.op));
  $('helpLine').innerHTML = G.sel.armed ? '<b>Now tap the gearbox.</b>' : 'Drag it into the gearbox, or tap it then tap the gearbox. <kbd>Enter</kbd> drops it.';
}
function pickOp(op) {
  if (G.locked || G.phase !== 'gear') return;
  hubAudio.playSelect();
  G.sel.op = op; G.sel.armed = false;
  refreshBlock();
}
function typeKey(d) {
  if (G.locked) return;
  if (G.phase === 'gear') {
    if (d === 'back') { if (G.sel.amount) G.sel.amount = G.sel.amount.slice(0, -1); else G.sel.op = null; }
    else if (/^\d$/.test(d) && G.sel.amount.length < 5) G.sel.amount = (G.sel.amount + d).replace(/^0+(?=\d)/, '');
    G.sel.armed = false;
    return refreshBlock();
  }
  if (G.phase === 'combine' || G.phase === 'calc') {
    if (d === 'back') G.typed = G.typed.slice(0, -1);
    else if (G.typed.replace(/,/g, '').length < 7 && /^[\d,.]$/.test(d)) G.typed += d;
    $('typed').textContent = G.typed || '?';
  }
}
function nudge(text) {
  const h = $('helpLine');
  if (h) h.innerHTML = `<span class="warn">${text}</span>`;
  else showFeedback(true, text);
  hubAudio.playTone(220, 'square', 0.12, 0.05);
}

/* ---- dragging: tiles onto the rail, the gear into the gearbox ---- */
function startDrag(e, kind) {
  if (G.locked) return;
  const src = e.currentTarget;
  if (src.disabled) return;
  if (kind === 'block' && !gearReady()) return nudge(G.sel.op ? 'Type how much first.' : 'Build a gear first: pick ×, ÷, + or − and a number.');
  if (kind === 'tile') {
    return dragOrTap(e, src, {
      targetAt: (x, y) => (inside($('rail'), x, y) ? 'rail' : null), glow: (t) => $('rail')?.classList.toggle('drop-target', Boolean(t)),
      onDrop: () => addTile(src), onTap: () => addTile(src), lift: false,
    });
  }
  dragOrTap(e, src, {
    targetAt: (x, y) => (inside(UI.scene, x, y) ? 'gearbox' : null), glow: (t) => $('gearbox')?.classList.toggle('drop-target', Boolean(t)),
    onDrop: dropGear, scene: UI.scene,
    onTap: () => { G.sel.armed = !G.sel.armed; if (G.sel.armed) hubAudio.playSelect(); refreshBlock(); },
  });
}

/* ================================================================== */
/* Answers                                                             */
/* ================================================================== */
function addTile(src) {
  if (G.locked || !G.phase.startsWith('write') || !src) return;
  const kind = src.dataset.tile;
  if (G.rail.length >= 7) return nudge('That row is full. Use ⌫ BACK or CLEAR.');
  if (kind === 'num') {
    const i = Number(src.dataset.i);
    if (G.used.includes(i)) return;
    G.used.push(i);
    G.rail.push({ t: 'num', v: G.problem.tiles[i], i });
  } else if (kind === 'var') {
    if (G.rail.some((t) => t.t === 'var')) return;
    G.rail.push({ t: 'var' });
  } else if (kind === 'eq') G.rail.push({ t: 'eq' });
  else G.rail.push({ t: 'op', v: kind });
  hubAudio.playTone(440 + G.rail.length * 30, 'triangle', 0.08, 0.06);
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
  if (G.locked || !G.phase.startsWith('write')) return;
  const p = G.problem;
  const need = G.phase === 'writeX' ? '×' : G.phase === 'writeD' ? '÷' : null;
  const res = checkWritten(p, G.rail, need);
  if (res.nudge) return nudge(res.message);
  if (!res.correct) return miss(res, { lock: true, delay: 1200, retry: () => { G.rail = []; G.used = []; renderControls(); showState(); } });
  hubAudio.playCoinClink();
  showFeedback(true, res.message);
  G.written.push(tilesText(G.rail, p.eq.letter));
  G.locked = true;
  showState();
  setTimeout(() => {
    if (G.problem !== p) return;
    G.locked = false;
    UI.feedback.classList.add('hidden');
    enterPhase(G.phase === 'writeX' ? 'writeD' : 'gear');
  }, 1100);
}

/** The gear lands in the gearbox. */
function dropGear() {
  const p = G.problem, w = G.work;
  if (G.locked || G.phase !== 'gear') return;
  if (!gearReady()) return nudge(G.sel.op ? 'Type how much first.' : 'Build a gear first: pick ×, ÷, + or − and a number.');
  const op = G.sel.op, n = gearAmount();
  G.sel.armed = false;
  G.locked = true;
  const res = checkGear(w, op, n);
  const tok = `${SIGN[op]} ${fmt(n)}`;
  hubAudio.playTone(300, 'triangle', 0.15, 0.08);
  drawGearbox({ label: exprText(w), inText: w.letter, outText: fmt(w.c), slot: tok, spin: 'back', ratio: ratioOf(w) });
  const both = w.flipped
    ? `${fmt(w.c)} <span class="you">${tok}</span> = ${esc(exprText(w))} <span class="you">${tok}</span>`
    : `${esc(exprText(w))} <span class="you">${tok}</span> = ${fmt(w.c)} <span class="you">${tok}</span>`;
  strip([eqText(w), both]);
  // Right gear on a "work it out" problem: the student does the arithmetic next.
  if (res.correct && (p.calc || w.kind === 'twostep')) {
    setTimeout(() => {
      if (G.problem !== p) return;
      G.locked = false;
      G.pending = { op, n };
      hubAudio.playCoinClink();
      enterPhase('calc');
    }, 800);
    return;
  }
  setTimeout(() => {                                   // the drive wheel shows what comes out
    if (G.problem !== p) return;
    drawGearbox({ label: exprText(w), inText: fmt(res.value), inColor: '#fff', inTextColor: '#1f63c9', inLabel: `${w.letter} =`, outText: '', slot: tok, ratio: ratioOf(w), pop: 'in' });
    strip([both, `${w.letter} = ${fmt(res.value)}`]);
    hubAudio.playTone(520, 'triangle', 0.12, 0.08);
  }, 800);
  setTimeout(() => {                                   // the check: run it forward
    if (G.problem !== p) return;
    G.locked = false;
    finishCheck(w, res.value, res);
  }, 1700);
}

/** Runs the gearbox forward with value v and settles the problem. */
function finishCheck(w, v, res) {
  const out = runForward(w, v);
  const ok = res.correct;
  drawGearbox({ label: exprText(w), inText: fmt(v), inColor: '#fff', inTextColor: '#1f63c9', inLabel: `${w.letter} =`, outText: fmt(out),
    outColor: ok ? '#2fbf71' : '#e5484d', outLabel: ok ? '✓ CHECK' : `✗ NEEDS ${fmt(w.c)}`, spin: 'fwd', ratio: ratioOf(w), pop: 'out' });
  const full = G.problem.eq;
  strip([`${full.letter} = ${fmt(v)}`, `<span class="${ok ? 'good' : 'bad'}">Check: ${esc(checkLine(ok ? full : w, ok ? full.x : v))}${ok ? ' ✓' : ' ✗'}</span>`]);
  if (ok) win({ ...res, message: `${full.letter} = ${fmt(full.x)}. Check: ${checkLine(full, full.x)} ✓` });
  else miss(res, { lock: true, delay: 1200, retry: () => enterPhase('gear') });
}

function submitTyped() {
  if (G.locked) return;
  const p = G.problem, w = G.work;
  if (G.phase === 'combine') {
    const res = checkHalf(w, G.typed);
    if (res.nudge) return nudge(res.message);
    if (!res.correct) return miss(res, { lock: true, delay: 1200, retry: () => { G.typed = ''; renderControls(); } });
    hubAudio.playCoinClink();
    showFeedback(true, res.message);
    G.work = afterStep(w);
    G.locked = true;
    drawGearbox({ label: exprText(G.work), inText: G.work.letter, outText: fmt(G.work.c), spin: 'fwd', signColor: '#d9f7e3' });
    strip([`<span class="small">${eqText(w)}</span>`, eqText(G.work)]);
    setTimeout(() => { if (G.problem !== p) return; G.locked = false; UI.feedback.classList.add('hidden'); enterPhase('gear'); }, 1300);
    return;
  }
  if (G.phase === 'calc') {
    const { op, n } = G.pending;
    const res = checkCalc(w.c, op, n, G.typed);
    if (res.nudge) return nudge(res.message);
    if (!res.correct) return miss(res, { lock: true, delay: 1200, retry: () => { G.typed = ''; renderControls(); showState(); } });
    const v = apply(w.c, op, n);
    if (w.kind === 'twostep') {                        // step 1 of 2 done: now k·x = what is left
      hubAudio.playCoinClink();
      showFeedback(true, `${res.message} Now ${fmt(w.k)}${w.letter} = ${fmt(v)}.`);
      G.work = afterStep(w, v);
      G.locked = true;
      drawGearbox({ label: exprText(G.work), inText: G.work.letter, outText: fmt(G.work.c), spin: 'fwd', signColor: '#d9f7e3' });
      strip([`<span class="small">${eqText(w)}</span>`, eqText(G.work)]);
      setTimeout(() => { if (G.problem !== p) return; G.locked = false; UI.feedback.classList.add('hidden'); enterPhase('gear'); }, 1300);
      return;
    }
    finishCheck(w, v, { ...res, correct: true });
  }
}

function answerPick(i) {
  if (G.locked || G.phase !== 'pick') return;
  const res = checkPick(G.problem, i);
  UI.controls.querySelector(`[data-choice="${i}"]`)?.classList.add(res.correct ? 'right' : 'wrong');
  if (res.correct) return win(res);
  miss(res, { oneShot: true, nextText: 'NEXT (ENTER)' });  // one quick decision: show the work, then the next one
}

/* ================================================================== */
/* Keys and start-up                                                   */
/* ================================================================== */
/** Keys while a problem is in play (the shell handles Enter on buttons, help, sound and the briefing). */
function onKey(e) {
  const key = e.key;
  const p = G.problem;
  if (G.phase === 'pick') {
    const n = Number(key);
    if (n >= 1 && n <= p.options.length) answerPick(n - 1);
    return;
  }
  if (G.phase.startsWith('write')) {
    const n = Number(key);
    const btn = (sel) => UI.controls.querySelector(sel);
    if (n >= 1 && n <= p.tiles.length) return addTile(btn(`[data-tile="num"][data-i="${n - 1}"]`));
    if (key.toLowerCase() === p.eq.letter) return addTile(btn('[data-tile="var"]'));
    if (key === '*' || key === 'x' || key === 'X') return addTile(btn('[data-tile="×"]'));
    if (key === '/') { e.preventDefault(); return addTile(btn('[data-tile="÷"]')); }
    if (key === '=') return addTile(btn('[data-tile="eq"]'));
    if (key === 'Backspace') { e.preventDefault(); return removeTile(); }
    if (key === 'Enter') { e.preventDefault(); return submitWritten(); }
    return;
  }
  if (G.phase === 'gear') {
    if (key === '*' || key === 'x' || key === 'X') return pickOp('×');
    if (key === '/') { e.preventDefault(); return pickOp('÷'); }
    if (key === '+') return pickOp('+');
    if (key === '-') return pickOp('-');
    if (/^[0-9]$/.test(key)) return typeKey(key);
    if (key === 'Backspace') { e.preventDefault(); return typeKey('back'); }
    if (key === 'Enter') { e.preventDefault(); return dropGear(); }
    return;
  }
  if (/^[0-9,.]$/.test(key)) return typeKey(key);
  if (key === 'Backspace') { e.preventDefault(); return typeKey('back'); }
  if (key === 'Enter') { e.preventDefault(); submitTyped(); }
}

function init() {
  const stripEl = document.createElement('div');
  stripEl.id = 'eqStrip'; stripEl.className = 'eq-strip hidden';
  $('stage').appendChild(stripEl);
  // tap the gear, then tap the gearbox
  $('stage').addEventListener('click', (e) => { if (G.sel.armed && inside(UI.scene, e.clientX, e.clientY)) dropGear(); });
  // A sample gearbox behind the briefing.
  drawGearbox({ label: '4n', inText: 'n', outText: '52' });
}

init();
