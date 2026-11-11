// Undo Machine (Lesson 4-3): screen, controls and game flow. The math lives in undo.js.
//
// Each problem moves through steps (G.phase):
//   write    build the equation from the story with tiles        (story, taken and multi problems)
//   combine  add the known parts first (143 + 295)               (multi only, typed)
//   undo     build the opposite block and drop it in the machine  (undo, story, multi)
//   typed    type the answer                                      (taken only: the letter is what was taken away)
//   sort     is this crate a match for the target?                (sorting chute)
import {
  ZONES, OP_SIGN, fmt, parseNumber, exprText, eqText, runForward, combined, tilesText, checkLine,
  genZone, genBackup, checkWritten, checkUndo, checkCombine, checkTaken, checkSort, workedSolution,
} from './undo.js';
import { hubAudio } from '../../../../shared/audio.js';
import { createGame } from '../../../../shared/game/gameShell.js';
import { dragOrTap, inside } from '../../../../shared/game/drag.js';

const SKILL_TIPS = {
  did_not_undo: 'Undo a step with its OPPOSITE: undo + with −, and − with +.',
  wrong_op: 'Match the story: "more" or "added" means +, "gave away" or "dropped" means −.',
  wrong_amount: 'Undo exactly the machine\'s step, the same amount.',
  used_total: 'Undo the step the machine does, not the total it puts out.',
  fewer_trap: '"5 fewer than p" means p − 5. Start with the letter.',
  order: 'Order matters in subtraction. Start with the amount you began with.',
  wrong_numbers: 'The total goes alone on one side of the equation.',
  combine_error: 'Combine the parts you know before you undo.',
  skipped_combine: 'Combine the parts you know before you undo.',
  added_both: 'When the letter is taken away, it is the GAP between the start and what is left.',
  copied_number: 'The answer is the missing amount, not a number from the story.',
  check_fails: 'Check your answer by putting it back in.',
  same_numbers: 'Same numbers does not mean the same solution. Solve each one.',
  number_shows: 'A number showing in an equation is not its solution. Solve it.',
  missed_match: 'Different numbers can still have the same solution.',
  sort_solve_first: 'Solve both equations before you compare them.',
};

const shell = createGame({
  zones: ZONES, makeZone: genZone, makeBackup: genBackup, workedSolution, showProblem,
  seconds: [40, 60, 45, 40, 70],                       // pressure: seconds until a boiler bursts, per zone
  meterFloor: 8, wrongBump: 30, rightRelief: 30, pauseOnBanner: true,
  lifeLostText: (left) => (left > 0 ? 'A BOILER BURST!' : 'LAST BOILER GONE!'),
  bossHitText: 'FIXED!', winDelay: (p) => (p.type === 'sort' ? 1100 : 1600),
  skillTips: SKILL_TIPS, perfectText: 'No mistakes to sharpen. That machine runs like new!',
  lettersAreInput: () => G.phase === 'write', onKey, testName: '__undo',
});
const { G, UI, $, win, miss, showFeedback } = shell;
Object.assign(G, { phase: null, work: null, rail: [], used: [], typed: '', sel: { op: null, amount: '', armed: false } });

/* ================================================================== */
/* Drawing the machine                                                 */
/* ================================================================== */
const K = '#1d1433';
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round"`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function backdrop() {
  return `
    <path d="M0 200 L70 170 L130 190 L190 160 L240 185 L240 520 L0 520 Z" fill="#d98a52" ${O}/>
    <path d="M800 190 L730 165 L680 185 L620 160 L560 190 L560 520 L800 520 Z" fill="#d98a52" ${O}/>
    <path d="M0 300 L240 292 M0 360 L245 356 M800 300 L560 292 M800 362 L556 356" stroke="#b5683a" stroke-width="5"/>
    <rect x="0" y="392" width="800" height="128" fill="#a9512b"/>
    <path d="M0 392 H800" stroke="${K}" stroke-width="3"/>
    <rect x="60" y="372" width="680" height="16" rx="8" fill="#4a3a52" ${O}/>
    ${[100, 180, 260, 340, 420, 500, 580, 660].map((x) => `<circle cx="${x}" cy="380" r="5" fill="#8b90a3" stroke="${K}" stroke-width="2"/>`).join('')}`;
}
function crate(x, text, { color = '#c4935a', textColor = K, cls = '', label = '' } = {}) {
  const w = Math.max(84, 26 + String(text).length * 17);
  return `<g transform="translate(${x} 300)"><g class="${cls}">
    <rect x="${-w / 2}" y="0" width="${w}" height="70" rx="6" fill="${color}" ${O}/>
    <path d="M${-w / 2 + 6} 8 H${w / 2 - 6} M${-w / 2 + 6} 62 H${w / 2 - 6}" stroke="rgba(0,0,0,0.25)" stroke-width="3"/>
    <text x="0" y="46" text-anchor="middle" font-size="30" font-weight="900" fill="${textColor}" font-family="ui-monospace, monospace">${esc(text)}</text></g>
    ${label ? `<text x="0" y="-12" text-anchor="middle" font-size="13" font-weight="900" fill="${K}" font-family="ui-monospace, monospace">${label}</text>` : ''}</g>`;
}
/**
 * The machine scene.
 *   label    what the machine does ("n + 7"), shown on its sign
 *   inBox    the crate on the left { text, color, cls }      outBox  the crate on the right
 *   slot     a block sitting in the undo slot ("− 7"), or null
 *   spin     gears turning: 'fwd' | 'back' | null
 */
function drawMachine({ label, inBox, outBox, slot = null, spin = null, steam = false, signColor = '#fff4d6' }) {
  const L = String(label);
  const fs = L.length > 16 ? 22 : L.length > 11 ? 28 : 34;
  UI.scene.innerHTML = `${backdrop()}
    ${inBox ? crate(130, inBox.text, inBox) : ''}
    ${outBox ? crate(670, outBox.text, outBox) : ''}
    <g id="machine">
      <path d="M200 330 H252 M548 330 H600" stroke="${K}" stroke-width="16"/><path d="M200 330 H252 M548 330 H600" stroke="#8b90a3" stroke-width="10"/>
      <path class="machine-body" d="M345 100 L455 100 L430 150 L370 150 Z" fill="#ffd23f" ${O}/>
      <text x="400" y="126" text-anchor="middle" font-size="12" font-weight="900" fill="${K}" font-family="'Press Start 2P', monospace">UNDO</text>
      <rect class="machine-body" x="250" y="150" width="300" height="220" rx="18" fill="#8b90a3" ${O}/>
      <rect x="268" y="170" width="264" height="80" rx="10" fill="${signColor}" ${O}/>
      <text x="400" y="${222 + (34 - fs) / 3}" text-anchor="middle" font-size="${fs}" font-weight="900" fill="${K}" font-family="ui-monospace, monospace">${esc(L)}</text>
      <g transform="translate(310 312)"><g class="${spin ? `spin ${spin === 'back' ? 'back' : ''}` : ''}"><circle r="30" fill="#6b6f80" ${O}/>
        ${[0, 45, 90, 135].map((a) => `<rect x="-5" y="-38" width="10" height="76" rx="3" fill="#6b6f80" ${O} transform="rotate(${a})"/>`).join('')}<circle r="12" fill="#ffd23f" ${O}/></g></g>
      <g transform="translate(490 312)"><g class="${spin ? `spin ${spin === 'back' ? '' : 'back'}` : ''}"><circle r="22" fill="#6b6f80" ${O}/>
        ${[0, 60, 120].map((a) => `<rect x="-4" y="-29" width="8" height="58" rx="3" fill="#6b6f80" ${O} transform="rotate(${a})"/>`).join('')}<circle r="9" fill="#ffd23f" ${O}/></g></g>
      <text x="400" y="352" text-anchor="middle" font-size="16" font-weight="900" fill="#fff" font-family="ui-monospace, monospace">${spin === 'back' ? '◀ ◀ BACKWARD' : spin === 'fwd' ? 'CHECK ▶ ▶' : ''}</text>
      ${slot ? `<g class="slot-drop"><rect x="352" y="64" width="96" height="40" rx="8" fill="#3a8ef0" ${O}/><text x="400" y="92" text-anchor="middle" font-size="22" font-weight="900" fill="#fff" font-family="ui-monospace, monospace">${esc(slot)}</text></g>` : ''}
      ${steam ? [520, 540].map((x, i) => `<circle class="steam" style="animation-delay:${i * 0.5}s" cx="${x}" cy="140" r="12" fill="#fff" opacity="0.8"/>`).join('') : ''}
    </g>
    <text x="130" y="398" text-anchor="middle" font-size="12" font-weight="900" fill="#fff" font-family="'Press Start 2P', monospace">IN</text>
    <text x="670" y="398" text-anchor="middle" font-size="12" font-weight="900" fill="#fff" font-family="'Press Start 2P', monospace">OUT</text>`;
}
const HIDDEN = (letter) => ({ text: letter, color: '#3a8ef0', textColor: '#fff' });

/** The machine as the current step stands, before the student acts. */
function showState() {
  const p = G.problem;
  if (G.phase === 'sort') return drawSort();
  const w = G.work;
  if (G.phase === 'write') {
    const built = G.rail.length ? tilesText(G.rail) : '? ? ?';
    drawMachine({ label: built, inBox: HIDDEN(w.letter), outBox: { text: '?' } });
    strip([`<span class="small">Read the story. Build its equation with the tiles.</span>`]);
    return;
  }
  drawMachine({ label: exprText(w), inBox: HIDDEN(w.letter), outBox: { text: fmt(w.c) }, steam: G.zone === 4 && G.phase !== 'undo' });
  const lines = [eqText(w)];
  if (p.type === 'multi' && G.phase === 'undo') lines.unshift(`<span class="small">${eqText(p.eq)}</span>`);
  strip(lines);
}

function strip(lines) {
  const el = $('eqStrip');
  if (!el) return;
  el.classList.remove('hidden');
  el.innerHTML = lines.map((l) => `<div class="eq-line ${l.startsWith('<span class="small">') ? 'small' : ''}">${l.replace(/^<span class="small">(.*)<\/span>$/, '$1')}</div>`).join('');
}

/* ---- the sorting chute ---- */
function drawSort(result = null) {
  const c = G.problem;
  const t = c.target;
  const text = eqText(c.eq);
  const w = Math.max(220, 40 + text.length * 17);
  const move = result === null ? 'chute-in' : result ? 'to-right' : 'to-left';
  UI.scene.innerHTML = `${backdrop()}
    <rect x="250" y="20" width="300" height="70" rx="12" fill="#fff4d6" ${O}/>
    <text x="400" y="46" text-anchor="middle" font-size="12" font-weight="900" fill="#8f3f22" font-family="'Press Start 2P', monospace">TARGET</text>
    <text x="400" y="78" text-anchor="middle" font-size="26" font-weight="900" fill="${K}" font-family="ui-monospace, monospace">${esc(eqText(t))}</text>
    <path d="M360 90 L360 230 M440 90 L440 230" stroke="${K}" stroke-width="4"/>
    <g transform="translate(190 410)"><path d="M-110 -40 L110 -40 L95 60 L-95 60 Z" fill="#e5484d" ${O}/><text x="0" y="16" text-anchor="middle" font-size="13" font-weight="900" fill="#fff" font-family="'Press Start 2P', monospace">◀ NOT A</text><text x="0" y="38" text-anchor="middle" font-size="13" font-weight="900" fill="#fff" font-family="'Press Start 2P', monospace">MATCH</text></g>
    <g transform="translate(610 410)"><path d="M-110 -40 L110 -40 L95 60 L-95 60 Z" fill="#2fbf71" ${O}/><text x="0" y="26" text-anchor="middle" font-size="14" font-weight="900" fill="#fff" font-family="'Press Start 2P', monospace">MATCH ▶</text></g>
    <g transform="translate(400 260)"><g class="${move}">
      <rect x="${-w / 2}" y="-36" width="${w}" height="72" rx="8" fill="#c4935a" ${O}/>
      <text x="0" y="12" text-anchor="middle" font-size="28" font-weight="900" fill="${K}" font-family="ui-monospace, monospace">${esc(text)}</text></g></g>`;
  strip([`<span class="small">Same solution as ${esc(eqText(t))}?</span>`]);
}

/* ================================================================== */
/* Problems                                                            */
/* ================================================================== */
const TAGS = {
  write: 'STEP 1 · WRITE THE EQUATION', combine: 'STEP 2 · COMBINE WHAT YOU KNOW', undo: 'RUN IT BACKWARD',
  typed: 'STEP 2 · FIND THE MISSING AMOUNT', sort: 'SORT THE CRATE',
};

/** The shell has set G.problem, G.attempts and G.isBackup; set up this game's own steps. */
function showProblem(p) {
  Object.assign(G, { rail: [], used: [], typed: '', work: p.eq });
  enterPhase(p.type === 'sort' ? 'sort' : p.type === 'undo' ? 'undo' : 'write');
}
function enterPhase(phase) {
  G.phase = phase;
  G.sel = { op: null, amount: '', armed: false };
  G.typed = '';
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
    case 'write': html = `Turn the story into a machine.${story}`; break;
    case 'combine': html = `Jammed! Two parts are known. Combine them first.<span class="eq">${eqText(p.eq)}</span>`; break;
    case 'typed': html = `${w.letter} is the amount TAKEN AWAY. What is ${w.letter}?<span class="eq">${eqText(w)}</span>`; break;
    case 'sort': html = `Does this crate have the <b>same solution</b> as the target?<span class="eq">Target: ${eqText(p.target)}</span>`; break;
    default: html = `${p.type === 'undo' ? 'The machine took in a hidden crate.' : 'Now run it backward.'} Build the opposite block and drop it in to find <b>${w.letter}</b>.<span class="eq">${eqText(w)}</span>`;
  }
  UI.prompt.innerHTML = html;
}

/* ================================================================== */
/* Controls                                                            */
/* ================================================================== */
function renderControls() {
  const p = G.problem;
  if (G.phase === 'sort') {
    UI.controls.innerHTML = `<div class="stamps"><button type="button" class="stamp no px" data-sort="0">◀ NOT A MATCH</button><button type="button" class="stamp yes px" data-sort="1">MATCH ▶</button></div>
      <div class="help-line">Solve the crate in your head, then sort it. Keys: <kbd>←</kbd> <kbd>→</kbd></div>`;
    UI.controls.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => answerSort(b.dataset.sort === '1')));
    return;
  }
  if (G.phase === 'write') {
    const nums = p.tiles.map((v, i) => `<button type="button" class="tile num" data-tile="num" data-i="${i}" ${G.used.includes(i) ? 'disabled' : ''}>${fmt(v)}<small>${i + 1}</small></button>`).join('');
    const varUsed = G.rail.some((t) => t.t === 'var');
    UI.controls.innerHTML = `
      <div class="label px">YOUR EQUATION</div>
      <div id="rail" class="rail ${G.rail.length ? 'filled' : ''}">${G.rail.length ? G.rail.map((t) => `<span class="tile chip ${t.t === 'num' ? 'num' : t.t === 'var' ? 'var' : t.t === 'eq' ? 'eqs' : ''}">${t.t === 'num' ? fmt(t.v) : t.t === 'var' ? t.v : t.t === 'eq' ? '=' : OP_SIGN[t.v]}</span>`).join('') : '<span class="empty">Drag or tap tiles to build it here</span>'}</div>
      <div class="label px">TILES</div>
      <div class="tiles">${nums}
        <button type="button" class="tile var" data-tile="var" ${varUsed ? 'disabled' : ''}>${p.eq.letter}</button>
        <button type="button" class="tile" data-tile="+">+</button><button type="button" class="tile" data-tile="-">−</button>
        <button type="button" class="tile eqs" data-tile="eq">=</button></div>
      <div class="row-btns"><button type="button" id="undoTile" class="px">⌫ BACK</button><button type="button" id="clearRail" class="px">CLEAR</button>
        <button type="button" id="buildBtn" class="go px">BUILD IT (ENTER)</button></div>
      <div id="helpLine" class="help-line">Keys: <kbd>1</kbd>–<kbd>${p.tiles.length}</kbd> numbers · <kbd>${p.eq.letter}</kbd> · <kbd>+</kbd> <kbd>−</kbd> <kbd>=</kbd></div>`;
    UI.controls.querySelectorAll('[data-tile]').forEach((b) => b.addEventListener('pointerdown', (e) => startDrag(e, 'tile')));
    $('undoTile').addEventListener('click', removeTile);
    $('clearRail').addEventListener('click', () => { if (!G.locked) { G.rail = []; G.used = []; renderControls(); showState(); } });
    $('buildBtn').addEventListener('click', submitWritten);
    return;
  }
  if (G.phase === 'combine' || G.phase === 'typed') {
    UI.controls.innerHTML = `
      <div class="label px">${G.phase === 'combine' ? `${fmt(p.eq.a)} + ${fmt(p.eq.b)} = ?` : `${G.work.letter} = ?`}</div>
      <div id="typed" class="typed">${G.typed || '?'}</div>
      <div class="pad six">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0, '.'].map((d) => `<button type="button" data-digit="${d}">${d}</button>`).join('')}<button type="button" data-digit="back">⌫</button></div>
      <button type="button" id="checkBtn" class="apply px">CHECK (ENTER)</button>`;
    UI.controls.querySelectorAll('[data-digit]').forEach((b) => b.addEventListener('click', () => typeKey(String(b.dataset.digit))));
    $('checkBtn').addEventListener('click', submitTyped);
    return;
  }
  // undo: build a block and drop it in the machine
  UI.controls.innerHTML = `
    <div class="label px">1. OPPOSITE STEP</div>
    <div class="op-row two">${['+', '-'].map((op) => `<button type="button" class="op-btn ${G.sel.op === op ? 'on' : ''}" data-op="${op}">${OP_SIGN[op]}<small>${op === '+' ? 'add' : 'subtract'}</small></button>`).join('')}</div>
    <div class="label px">2. HOW MUCH?</div>
    <div class="pad six">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0, '.'].map((d) => `<button type="button" data-digit="${d}">${d}</button>`).join('')}<button type="button" data-digit="back">⌫</button></div>
    <div class="label px">3. DRAG YOUR BLOCK INTO THE MACHINE</div>
    <div class="tray"><button type="button" id="block" class="block"></button></div>
    <div id="helpLine" class="help-line"></div>`;
  UI.controls.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => pickOp(b.dataset.op)));
  UI.controls.querySelectorAll('[data-digit]').forEach((b) => b.addEventListener('click', () => typeKey(String(b.dataset.digit))));
  $('block').addEventListener('pointerdown', (e) => startDrag(e, 'block'));
  refreshBlock();
}

/* ---- the undo block ---- */
const blockAmount = () => parseNumber(G.sel.amount);
const blockReady = () => G.sel.op && blockAmount() !== null && blockAmount() > 0;
function refreshBlock() {
  const b = $('block');
  if (!b) return;
  b.textContent = G.sel.op ? `${OP_SIGN[G.sel.op]} ${G.sel.amount || '?'}` : '? ?';
  b.className = `block ${blockReady() ? 'ready' : 'empty'} ${G.sel.armed ? 'armed' : ''}`;
  UI.controls.querySelectorAll('[data-op]').forEach((x) => x.classList.toggle('on', x.dataset.op === G.sel.op));
  $('helpLine').innerHTML = G.sel.armed ? '<b>Now tap the machine.</b>' : 'Drag it into the machine, or tap it then tap the machine. <kbd>Enter</kbd> drops it.';
}
function pickOp(op) {
  if (G.locked || G.phase !== 'undo') return;
  hubAudio.playSelect();
  G.sel.op = op; G.sel.armed = false;
  refreshBlock();
}
function typeKey(d) {
  if (G.locked) return;
  if (G.phase === 'undo') {
    if (d === 'back') { if (G.sel.amount) G.sel.amount = G.sel.amount.slice(0, -1); else G.sel.op = null; }
    else if (G.sel.amount.length < 6 && !(d === '.' && G.sel.amount.includes('.'))) G.sel.amount = (G.sel.amount + d).replace(/^0+(?=\d)/, '');
    G.sel.armed = false;
    return refreshBlock();
  }
  if (G.phase === 'combine' || G.phase === 'typed') {
    if (d === 'back') G.typed = G.typed.slice(0, -1);
    else if (G.typed.length < 7 && !(d === '.' && G.typed.includes('.'))) G.typed += d;
    $('typed').textContent = G.typed || '?';
  }
}
function nudge(text) {
  const h = $('helpLine');
  if (h) h.innerHTML = `<span class="warn">${text}</span>`;
  else showFeedback(true, text);
  hubAudio.playTone(220, 'square', 0.12, 0.05);
}

/* ---- dragging: tiles onto the rail, the block into the machine (mouse, touch and trackpad) ---- */
function startDrag(e, kind) {
  if (G.locked) return;
  const src = e.currentTarget;
  if (src.disabled) return;
  if (kind === 'block' && !blockReady()) return nudge(G.sel.op ? 'Type how much first.' : 'Build a block first: pick + or − and a number.');
  if (kind === 'tile') {                               // a tile goes on the end of the equation, dragged or tapped
    return dragOrTap(e, src, {
      targetAt: (x, y) => (inside($('rail'), x, y) ? 'rail' : null), glow: (t) => $('rail')?.classList.toggle('drop-target', Boolean(t)),
      onDrop: () => addTile(src), onTap: () => addTile(src), lift: false,
    });
  }
  dragOrTap(e, src, {
    targetAt: (x, y) => (inside(UI.scene, x, y) ? 'machine' : null), glow: (t) => $('machine')?.classList.toggle('drop-target', Boolean(t)),
    onDrop: dropBlock, scene: UI.scene,
    onTap: () => { G.sel.armed = !G.sel.armed; if (G.sel.armed) hubAudio.playSelect(); refreshBlock(); },
  });
}

/* ---- write it ---- */
function addTile(src) {
  if (G.locked || G.phase !== 'write') return;
  const kind = src.dataset.tile;
  if (G.rail.length >= 9) return nudge('That row is full. Use ⌫ BACK or CLEAR.');
  if (kind === 'num') {
    const i = Number(src.dataset.i);
    if (G.used.includes(i)) return;
    G.used.push(i);
    G.rail.push({ t: 'num', v: G.problem.tiles[i], i });
  } else if (kind === 'var') {
    if (G.rail.some((t) => t.t === 'var')) return;
    G.rail.push({ t: 'var', v: G.problem.eq.letter });
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
  if (G.locked || G.phase !== 'write') return;
  const p = G.problem;
  const res = checkWritten(p, G.rail);
  if (res.nudge) return nudge(res.message);
  if (!res.correct) {
    miss(res, { lock: true, delay: 1200, retry: () => { G.rail = []; G.used = []; renderControls(); showState(); } });
    return;
  }
  hubAudio.playCoinClink();
  showFeedback(true, res.message);
  G.locked = true;
  drawMachine({ label: exprText(p.eq), inBox: HIDDEN(p.eq.letter), outBox: { text: fmt(p.eq.c), cls: 'pop-in' } });
  strip([eqText(p.eq)]);
  setTimeout(() => {
    G.locked = false;
    UI.feedback.classList.add('hidden');
    enterPhase(p.type === 'multi' ? 'combine' : p.type === 'taken' ? 'typed' : 'undo');
  }, 1100);
}

/* ---- undo it ---- */
function dropBlock() {
  const p = G.problem, w = G.work;
  if (G.locked || G.phase !== 'undo') return;
  if (!blockReady()) return nudge(G.sel.op ? 'Type how much first.' : 'Build a block first: pick + or − and a number.');
  const op = G.sel.op, n = blockAmount();
  G.sel.armed = false;
  G.locked = true;
  const res = checkUndo(w, op, n);
  const blk = `${OP_SIGN[op]} ${fmt(n)}`;
  hubAudio.playTone(300, 'triangle', 0.15, 0.08);
  // 1. the block drops in and the machine runs backward
  drawMachine({ label: exprText(w), inBox: HIDDEN(w.letter), outBox: { text: fmt(w.c), cls: 'go-back' }, slot: blk, spin: 'back' });
  const both = w.flipped
    ? `${fmt(w.c)} <span class="you">${blk}</span> = ${esc(exprText(w))} <span class="you">${blk}</span>`
    : `${esc(exprText(w))} <span class="you">${blk}</span> = ${fmt(w.c)} <span class="you">${blk}</span>`;
  strip([eqText(w), both]);
  // 2. the hidden crate comes out with a value
  setTimeout(() => {
    if (G.problem !== p) return;
    drawMachine({ label: exprText(w), inBox: { text: fmt(res.value), color: '#3a8ef0', textColor: '#fff', cls: 'pop-in', label: `${w.letter} =` }, outBox: null, slot: blk });
    strip([both, `${w.letter} = ${fmt(res.value)}`]);
    hubAudio.playTone(520, 'triangle', 0.12, 0.08);
  }, 800);
  // 3. the check: put it back in and run forward
  setTimeout(() => {
    if (G.problem !== p) return;
    const ok = res.correct;
    drawMachine({ label: exprText(w), inBox: { text: fmt(res.value), color: '#3a8ef0', textColor: '#fff', cls: 'go-fwd' },
      outBox: { text: fmt(res.back), color: ok ? '#2fbf71' : '#e5484d', textColor: '#fff', cls: 'pop-in', label: ok ? '✓ CHECK' : `✗ NEEDS ${fmt(w.c)}` }, spin: 'fwd' });
    strip([`${w.letter} = ${fmt(res.value)}`, `<span class="${ok ? 'good' : 'bad'}">Check: ${esc(checkLine(w, res.value))}${ok ? ' ✓' : ' ✗'}</span>`]);
    G.locked = false;
    if (ok) win(res);
    else miss(res, { lock: true, delay: 1200, retry: () => enterPhase('undo') });
  }, 1700);
}

/* ---- typed answers ---- */
function submitTyped() {
  if (G.locked) return;
  const p = G.problem;
  if (G.phase === 'combine') {
    const res = checkCombine(p.eq, G.typed);
    if (res.nudge) return nudge(res.message);
    if (!res.correct) return miss(res, { lock: true, delay: 1200, retry: () => { G.typed = ''; renderControls(); showState(); } });
    hubAudio.playCoinClink();
    showFeedback(true, res.message);
    G.work = combined(p.eq);
    G.locked = true;
    drawMachine({ label: exprText(G.work), inBox: HIDDEN(G.work.letter), outBox: { text: fmt(G.work.c) }, spin: 'fwd', signColor: '#d9f7e3' });
    strip([`<span class="small">${eqText(p.eq)}</span>`, eqText(G.work)]);
    setTimeout(() => { G.locked = false; UI.feedback.classList.add('hidden'); enterPhase('undo'); }, 1300);
    return;
  }
  if (G.phase === 'typed') {
    const w = G.work;
    const res = checkTaken(w, G.typed);
    if (res.nudge) return nudge(res.message);
    const ok = res.correct;
    drawMachine({ label: exprText(w), inBox: { text: fmt(res.value), color: '#3a8ef0', textColor: '#fff', cls: 'go-fwd' },
      outBox: { text: fmt(runForward(w, res.value)), color: ok ? '#2fbf71' : '#e5484d', textColor: '#fff', cls: 'pop-in', label: ok ? '✓ CHECK' : `✗ NEEDS ${fmt(w.c)}` }, spin: 'fwd' });
    strip([`${w.letter} = ${fmt(res.value)}`, `<span class="${ok ? 'good' : 'bad'}">Check: ${esc(checkLine(w, res.value))}${ok ? ' ✓' : ' ✗'}</span>`]);
    if (ok) win(res); else miss(res, { lock: true, delay: 1200, retry: () => { G.typed = ''; renderControls(); showState(); } });
  }
}

/* ---- sorting ---- */
function answerSort(saysMatch) {
  if (G.locked || G.phase !== 'sort') return;
  const res = checkSort(G.problem, saysMatch);
  drawSort(saysMatch);
  if (res.correct) return win(res);
  miss(res, { oneShot: true, nextText: 'NEXT CRATE (ENTER)' });   // a sort is one decision: show the work, then the next crate
}

/* ================================================================== */
/* Keys and start-up                                                   */
/* ================================================================== */
/** Keys while a problem is in play (the shell handles Enter on buttons, help, sound and the briefing). */
function onKey(e) {
  const key = e.key;
  const p = G.problem;
  if (G.phase === 'sort') {
    if (key === 'ArrowLeft' || key === '1') { e.preventDefault(); answerSort(false); }
    if (key === 'ArrowRight' || key === '2') { e.preventDefault(); answerSort(true); }
    return;
  }
  if (G.phase === 'write') {
    const n = Number(key);
    const btn = (sel) => UI.controls.querySelector(sel);
    if (n >= 1 && n <= p.tiles.length) return addTile(btn(`[data-tile="num"][data-i="${n - 1}"]`));
    if (key.toLowerCase() === p.eq.letter) return addTile(btn('[data-tile="var"]'));
    if (key === '+') return addTile(btn('[data-tile="+"]'));
    if (key === '-') return addTile(btn('[data-tile="-"]'));
    if (key === '=') return addTile(btn('[data-tile="eq"]'));
    if (key === 'Backspace') { e.preventDefault(); return removeTile(); }
    if (key === 'Enter') { e.preventDefault(); return submitWritten(); }
    return;
  }
  if (G.phase === 'undo') {
    if (key === '+') return pickOp('+');
    if (key === '-') return pickOp('-');
    if (/^[0-9.]$/.test(key)) return typeKey(key);
    if (key === 'Backspace') { e.preventDefault(); return typeKey('back'); }
    if (key === 'Enter') { e.preventDefault(); return dropBlock(); }
    return;
  }
  if (/^[0-9.]$/.test(key)) return typeKey(key);
  if (key === 'Backspace') { e.preventDefault(); return typeKey('back'); }
  if (key === 'Enter') { e.preventDefault(); submitTyped(); }
}

function init() {
  const stripEl = document.createElement('div');
  stripEl.id = 'eqStrip'; stripEl.className = 'eq-strip hidden';
  $('stage').appendChild(stripEl);
  // tap the block, then tap the machine
  $('stage').addEventListener('click', (e) => { if (G.sel.armed && inside(UI.scene, e.clientX, e.clientY)) dropBlock(); });
  // A sample machine behind the briefing.
  drawMachine({ label: 'n + 7', inBox: HIDDEN('n'), outBox: { text: '25' } });
}

init();
