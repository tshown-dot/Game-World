// Food Truck (Lesson 4-5): the truck screen and controls. The math lives in truck.js;
// zones, timer, lives, scoring and the report come from the shared game shell (shared/game/gameShell.js).
//
// Each ticket moves through steps (G.phase):
//   option    pick the equation that fits the story, Johnny's mistake, or the value that works
//   predict   will the answer be bigger or smaller than the number it equals?   (Batch Math)
//   block     build the opposite block and drop it on the ticket
//   calc      work out the answer yourself (any equal form: 2.25, 2 1/4, 9/4)
import {
  ZONES, SIGN, show, parseAnswer, value, exprText, eqText, checkLine,
  genZone, genBackup, checkBlock, checkCalc, checkPredict, checkOption, workedSolution,
} from './truck.js';
import { hubAudio } from '../../../../shared/audio.js';
import { createGame } from '../../../../shared/game/gameShell.js';
import { dragOrTap, inside } from '../../../../shared/game/drag.js';

const SKILL_TIPS = {
  did_not_undo: 'Undo each step with its opposite: + with −, × with ÷.',
  not_reciprocal: 'To undo × 2/3, multiply by the reciprocal, 3/2 (or divide by 2/3).',
  used_total: 'Undo the step done to the letter, not the total.',
  wrong_amount: 'Undo exactly the amount on the ticket.',
  wrong_op: 'Match the opposite: + with −, × with ÷.',
  place_value: 'Estimate first so the decimal point lands in the right place.',
  added_instead: 'Read your block: − means subtract, + means add.',
  decimal_align: 'Line up the decimal points before you add or subtract.',
  mixed_borrow: 'If the fraction you subtract is bigger, borrow 1 whole first.',
  add_denominators: 'Never add the bottoms: find a common denominator.',
  common_denominator: 'Rename fractions with a common denominator before adding or subtracting.',
  fraction_times: 'Multiply tops and bottoms; to divide, multiply by the reciprocal.',
  decimal_times: 'Count decimal places when you multiply or divide decimals.',
  mult_makes_bigger: 'Multiplying by a number less than 1 makes it SMALLER.',
  multiplied_by_coef: 'Check a choice by putting it back in the equation.',
  copied_number: 'Check a choice by putting it back in the equation.',
  off_a_bit: 'Line up the decimal points carefully.',
  critique_subtract: 'An equation is a balance: do the same thing to BOTH sides.',
  critique_fine: 'An equation is a balance: do the same thing to BOTH sides.',
  critique_multiply: 'An equation is a balance: do the same thing to BOTH sides.',
  story_equation: 'Read the story slowly: which amount is missing, and what happens to it?',
};

const shell = createGame({
  zones: ZONES, makeZone: genZone, makeBackup: genBackup, workedSolution, showProblem,
  seconds: [55, 55, 60, 60, 80],                       // the line: seconds until a customer walks out, per zone
  meterFloor: 8, wrongBump: 30, rightRelief: 30, pauseOnBanner: true,
  lifeLostText: (left) => (left > 0 ? 'A CUSTOMER WALKED OUT!' : 'TRUCK CLOSED!'),
  bossHitText: 'SERVED!', winDelay: () => 1500,
  skillTips: SKILL_TIPS, perfectText: 'No mistakes to sharpen. Five-star service!',
  onKey, testName: '__truck',
});
const { G, UI, $, win, miss, showFeedback } = shell;
Object.assign(G, { phase: null, typed: '', pending: null, tried: [], sel: { op: null, amount: '', armed: false } });

/* ================================================================== */
/* Drawing the truck                                                   */
/* ================================================================== */
const K = '#1d1433';
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round"`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const s = (q) => show(q, G.problem?.eq.style || 'fraction');

function customer(x, i) {
  const shirt = ['#e5484d', '#3a8ef0', '#7b4bff', '#2fbf71', '#ff9f43'][i % 5];
  return `<g transform="translate(${x} 0)">
    <ellipse cx="0" cy="452" rx="20" ry="5" fill="rgba(0,0,0,0.2)"/>
    <rect x="-15" y="398" width="30" height="52" rx="10" fill="${shirt}" ${O}/>
    <circle cx="0" cy="384" r="15" fill="#ffd3a8" ${O}/><circle cx="-5" cy="382" r="2.5" fill="${K}"/><circle cx="5" cy="382" r="2.5" fill="${K}"/></g>`;
}
const queueSize = () => 1 + Math.min(4, Math.floor((G.meter || 0) / 22));
function queue() {
  const n = queueSize();
  return Array.from({ length: n }, (_, i) => customer(640 + i * 38, i)).join('');
}
/**
 * The truck scene.
 *   label   the order ticket (the equation)
 *   plate   what is on the serving plate ('?' or an answer); plateColor
 *   slip    a block on the ticket ("× 3/2"), or null
 *   stamp   'ok' | 'bad' | null; stampText
 */
function drawTruck({ label, plate = '?', plateColor = '#fff4d6', slip = null, stamp = null, stampText = '', pop = false }) {
  const L = String(label);
  const fs = L.length > 20 ? 21 : L.length > 15 ? 25 : L.length > 11 ? 29 : 34;
  UI.scene.innerHTML = `
    <rect x="0" y="456" width="800" height="64" fill="#a9512b"/><path d="M0 456 H800" stroke="${K}" stroke-width="3"/>
    <path d="M0 230 L70 205 L120 222 L170 200 L200 215 L200 456 L0 456 Z" fill="#d98a52" ${O}/>
    <g>
      <rect x="40" y="150" width="520" height="270" rx="26" fill="#2bb5a5" ${O}/>
      <rect x="40" y="150" width="520" height="40" rx="20" fill="#ffd23f" ${O}/>
      <text x="300" y="178" text-anchor="middle" font-size="16" font-weight="900" fill="${K}" font-family="'Press Start 2P', monospace">CANYON TACOS</text>
      <circle cx="130" cy="430" r="34" fill="#3c2645" ${O}/><circle cx="130" cy="430" r="12" fill="#8b90a3" ${O}/>
      <circle cx="470" cy="430" r="34" fill="#3c2645" ${O}/><circle cx="470" cy="430" r="12" fill="#8b90a3" ${O}/>
      <rect x="70" y="205" width="460" height="150" rx="10" fill="#1d1433"/>
      <path d="M70 205 L530 205 L515 228 L85 228 Z" fill="#e5484d" ${O}/>
      ${[0, 1, 2, 3, 4].map((i) => `<path d="M${85 + i * 92} 228 h46 l-6 14 h-34 Z" fill="#fff" opacity="0.8"/>`).join('')}
      <rect x="66" y="355" width="468" height="16" rx="5" fill="#c4935a" ${O}/>
      ${[540, 560].map((x, i) => `<circle class="steam" style="animation-delay:${i * 0.6}s" cx="${x}" cy="130" r="11" fill="#fff" opacity="0.8"/>`).join('')}
      <rect x="520" y="120" width="26" height="32" fill="#8b90a3" ${O}/>
    </g>
    <g id="ticket">
      <rect class="ticket-card" x="110" y="248" width="300" height="88" rx="8" fill="#fffbea" ${O}/>
      <text x="126" y="270" font-size="10" font-weight="900" fill="#8f3f22" font-family="'Press Start 2P', monospace">ORDER</text>
      <text x="260" y="${312 + (34 - fs) / 3}" text-anchor="middle" font-size="${fs}" font-weight="900" fill="${K}" font-family="ui-monospace, monospace">${esc(L)}</text>
      ${slip ? `<g class="slip-drop"><rect x="300" y="232" width="104" height="36" rx="6" fill="#2fbf71" ${O}/><text x="352" y="257" text-anchor="middle" font-size="19" font-weight="900" fill="#fff" font-family="ui-monospace, monospace">${esc(slip)}</text></g>` : ''}
      ${stamp ? `<g class="stamp-in"><rect x="250" y="300" width="170" height="40" rx="6" fill="none" stroke="${stamp === 'ok' ? '#1f8a4c' : '#d6283a'}" stroke-width="5" transform="rotate(-8 335 320)"/>
        <text x="335" y="328" text-anchor="middle" font-size="17" font-weight="900" fill="${stamp === 'ok' ? '#1f8a4c' : '#d6283a'}" font-family="'Press Start 2P', monospace" transform="rotate(-8 335 320)">${esc(stampText)}</text></g>` : ''}
    </g>
    <g transform="translate(470 330)">
      <ellipse cx="0" cy="22" rx="52" ry="12" fill="#fff" ${O}/>
      <rect x="-46" y="-26" width="92" height="44" rx="10" fill="${plateColor}" ${O}/>
      <text class="${pop ? 'pop-in' : ''}" x="0" y="${String(plate).length > 6 ? 4 : 8}" text-anchor="middle" font-size="${String(plate).length > 6 ? 16 : 22}" font-weight="900" fill="${K}" font-family="ui-monospace, monospace">${esc(plate)}</text>
    </g>
    <g id="queue">${queue()}</g>`;
}
// The line of customers grows with the meter. Redraw only when someone joins or leaves, so nothing flickers.
setInterval(() => {
  const q = $('queue');
  if (!q || !G.problem) return;
  const n = String(queueSize());
  if (q.dataset.n !== n) { q.dataset.n = n; q.innerHTML = queue(); }
}, 600);

function strip(lines) {
  const el = $('eqStrip');
  if (!el) return;
  el.classList.remove('hidden');
  el.innerHTML = lines.map((l) => {
    const small = l.startsWith('<span class="small">');
    return `<div class="eq-line ${small ? 'small' : ''}">${small ? l.replace(/^<span class="small">(.*)<\/span>$/, '$1') : l}</div>`;
  }).join('');
}

/** The truck as the current step stands, before the student acts. */
function showState() {
  const p = G.problem, eq = p.eq;
  if (G.phase === 'option' && p.type === 'story') {
    drawTruck({ label: '? ? ?' });
    strip(['<span class="small">Which equation fits the order?</span>']);
    return;
  }
  if (G.phase === 'calc') {
    const { op, n } = G.pending;
    drawTruck({ label: eqText(eq), slip: `${SIGN[op]} ${s(n)}` });
    strip([eqText(eq), `${s(eq.c)} <span class="you">${SIGN[op]} ${s(n)}</span> = ?`]);
    return;
  }
  drawTruck({ label: eqText(eq) });
  strip([eqText(eq)]);
}

/* ================================================================== */
/* Problems and steps                                                  */
/* ================================================================== */
const TAGS = { option: 'PICK ONE', predict: 'PREDICT', block: 'UNDO IT', calc: 'WORK IT OUT' };
function showProblem(p) {
  Object.assign(G, { typed: '', pending: null, tried: [] });
  enterPhase(p.type === 'solve' ? 'block' : p.type === 'predict' ? 'predict' : 'option');
}
function enterPhase(phase) {
  G.phase = phase;
  G.sel = { op: null, amount: '', armed: false };
  G.typed = '';
  G.tried = [];
  const p = G.problem;
  const tag = phase === 'option' ? { story: 'WHICH EQUATION?', critique: 'FIND THE MISTAKE', choose: 'WHICH VALUE WORKS?' }[p.type] : TAGS[phase];
  UI.taskTag.textContent = `${tag}${G.isBackup ? ' · BACKUP' : ''}`;
  renderPrompt();
  renderControls();
  showState();
}
function renderPrompt() {
  const p = G.problem, eq = p.eq;
  const story = p.story ? `<span class="story">${esc(p.story)}</span>` : '';
  let html;
  if (G.phase === 'option') {
    html = p.type === 'story' ? `A new order! Which equation fits it?${story}`
      : p.type === 'critique' ? `Johnny's in the kitchen.${story}`
        : `Which value makes this true? Check by putting it in.<span class="eq">${eqText(eq)}</span>`;
  } else if (G.phase === 'predict') {
    html = `Before you solve: will <b>${eq.letter}</b> be <b>bigger</b> or <b>smaller</b> than ${s(eq.c)}?${story}<span class="eq">${eqText(eq)}</span>`;
  } else if (G.phase === 'calc') {
    html = `Block set: <b>${SIGN[G.pending.op]} ${s(G.pending.n)}</b>. Now work it out. Any equal form is fine.<span class="eq">${eqText(eq)}</span>`;
  } else {
    html = `${p.story ? 'Now solve the order.' : 'A new order!'} Drag the opposite block onto the ticket to find <b>${eq.letter}</b>.<span class="eq">${eqText(eq)}</span>`;
  }
  UI.prompt.innerHTML = html;
}

/* ================================================================== */
/* Controls                                                            */
/* ================================================================== */
const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, '.', '/', '␣', '⌫'];
const keypad = () => `<div class="pad keys">${KEYS.map((d) => `<button type="button" data-key="${d}">${d}</button>`).join('')}</div>`;

function renderControls() {
  const p = G.problem;
  if (G.phase === 'option') {
    UI.controls.innerHTML = p.options.map((o, i) => `<button type="button" class="choice" data-choice="${i}" ${G.tried.includes(i) ? 'disabled' : ''}><b>${i + 1}</b>${esc(o.text)}</button>`).join('');
    UI.controls.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => answerOption(Number(b.dataset.choice))));
    return;
  }
  if (G.phase === 'predict') {
    UI.controls.innerHTML = `<div class="stamps"><button type="button" class="stamp no px" data-predict="0">◀ SMALLER</button><button type="button" class="stamp yes px" data-predict="1">BIGGER ▶</button></div>
      <div class="help-line">Think: is ${G.problem.eq.letter} being multiplied or divided by more than 1, or less than 1? Keys: <kbd>←</kbd> <kbd>→</kbd></div>`;
    UI.controls.querySelectorAll('[data-predict]').forEach((b) => b.addEventListener('click', () => answerPredict(b.dataset.predict === '1')));
    return;
  }
  if (G.phase === 'calc') {
    UI.controls.innerHTML = `
      <div class="sum">${esc(s(p.eq.c))} ${SIGN[G.pending.op]} ${esc(s(G.pending.n))} = ?</div>
      <div id="typed" class="typed">${esc(G.typed) || '?'}</div>
      ${keypad()}
      <button type="button" id="checkBtn" class="apply px">CHECK (ENTER)</button>
      <div id="helpLine" class="help-line">Type 2.25, 2 1/4 (use ␣ for the space) or 9/4. Scrap paper is fine.</div>`;
    UI.controls.querySelectorAll('[data-key]').forEach((b) => b.addEventListener('click', () => typeKey(String(b.dataset.key))));
    $('checkBtn').addEventListener('click', submitCalc);
    return;
  }
  // block: build the opposite block and drop it on the ticket
  UI.controls.innerHTML = `
    <div class="label px">1. OPPOSITE STEP</div>
    <div class="op-row">${['+', '-', '×', '÷'].map((op) => `<button type="button" class="op-btn ${G.sel.op === op ? 'on' : ''}" data-op="${op}">${SIGN[op]}</button>`).join('')}</div>
    <div class="label px">2. HOW MUCH? (DECIMALS OR FRACTIONS)</div>
    ${keypad()}
    <div class="label px">3. DRAG IT ONTO THE TICKET</div>
    <div class="tray"><button type="button" id="block" class="block slip"></button></div>
    <div id="helpLine" class="help-line"></div>`;
  UI.controls.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => pickOp(b.dataset.op)));
  UI.controls.querySelectorAll('[data-key]').forEach((b) => b.addEventListener('click', () => typeKey(String(b.dataset.key))));
  $('block').addEventListener('pointerdown', startDrag);
  refreshBlock();
}

/* ---- the block ---- */
const blockAmount = () => parseAnswer(G.sel.amount);
const blockReady = () => G.sel.op && blockAmount() && value(blockAmount()) > 0;
function refreshBlock() {
  const b = $('block');
  if (!b) return;
  b.textContent = G.sel.op ? `${SIGN[G.sel.op]} ${G.sel.amount || '?'}` : '? ?';
  b.className = `block slip ${blockReady() ? 'ready' : 'empty'} ${G.sel.armed ? 'armed' : ''}`;
  UI.controls.querySelectorAll('[data-op]').forEach((x) => x.classList.toggle('on', x.dataset.op === G.sel.op));
  $('helpLine').innerHTML = G.sel.armed ? '<b>Now tap the ticket.</b>' : 'Drag it onto the ticket, or tap it then tap the ticket. <kbd>Enter</kbd> drops it.';
}
function pickOp(op) {
  if (G.locked || G.phase !== 'block') return;
  hubAudio.playSelect();
  G.sel.op = op; G.sel.armed = false;
  refreshBlock();
}
/** One key of the keypad: digits, '.', '/', a space for mixed numbers, or back. */
function edit(text, d) {
  if (d === '⌫' || d === 'back') return text.slice(0, -1);
  if (text.length >= 9) return text;
  if (d === '␣' || d === ' ') return /\d$/.test(text) && !text.includes(' ') && !text.includes('/') && !text.includes('.') ? `${text} ` : text;
  if (d === '/') return /\d$/.test(text) && !text.includes('/') && !text.includes('.') ? `${text}/` : text;
  if (d === '.') return text.includes('.') || text.includes('/') || text.includes(' ') ? text : `${text || '0'}.`;
  return /^\d$/.test(d) ? text + d : text;
}
function typeKey(d) {
  if (G.locked) return;
  if (G.phase === 'block') {
    if ((d === '⌫' || d === 'back') && !G.sel.amount) G.sel.op = null;
    else G.sel.amount = edit(G.sel.amount, d);
    G.sel.armed = false;
    return refreshBlock();
  }
  if (G.phase === 'calc') {
    G.typed = edit(G.typed, d);
    $('typed').textContent = G.typed || '?';
  }
}
function nudge(text) {
  const h = $('helpLine');
  if (h) h.innerHTML = `<span class="warn">${text}</span>`;
  else showFeedback(true, text);
  hubAudio.playTone(220, 'square', 0.12, 0.05);
}
function startDrag(e) {
  if (G.locked) return;
  if (!blockReady()) return nudge(G.sel.op ? 'Type the amount: 5.43, 2/3 or 1 5/8.' : 'Build a block first: pick + − × ÷ and an amount.');
  dragOrTap(e, e.currentTarget, {
    targetAt: (x, y) => (inside(UI.scene, x, y) ? 'ticket' : null), glow: (t) => $('ticket')?.classList.toggle('drop-target', Boolean(t)),
    onDrop: dropBlock, scene: UI.scene,
    onTap: () => { G.sel.armed = !G.sel.armed; if (G.sel.armed) hubAudio.playSelect(); refreshBlock(); },
  });
}

/* ================================================================== */
/* Answers                                                             */
/* ================================================================== */
function answerOption(i) {
  if (G.locked || G.phase !== 'option' || G.tried.includes(i)) return;
  const p = G.problem;
  const res = checkOption(p, i);
  UI.controls.querySelector(`[data-choice="${i}"]`)?.classList.add(res.correct ? 'right' : 'wrong');
  if (!res.correct) {
    G.tried.push(i);
    if (p.type === 'choose') drawTruck({ label: eqText(p.eq), plate: p.options[i].text.split('= ')[1], plateColor: '#ffd9dc', stamp: 'bad', stampText: 'NOPE' });
    return miss(res, { lock: true, delay: 1200, retry: () => { renderControls(); showState(); } });
  }
  if (p.type === 'choose') {                           // that's the whole ticket
    drawTruck({ label: eqText(p.eq), plate: p.options[i].text.split('= ')[1], plateColor: '#d9f7e3', stamp: 'ok', stampText: 'PAID ✓', pop: true });
    strip([eqText(p.eq), `<span class="good">Check: ${esc(checkLine(p.eq, p.options[i].v))} ✓</span>`]);
    return win(res);
  }
  hubAudio.playCoinClink();
  showFeedback(true, res.message);
  G.locked = true;
  setTimeout(() => { if (G.problem !== p) return; G.locked = false; UI.feedback.classList.add('hidden'); enterPhase('block'); }, 1200);
}
function answerPredict(saysBigger) {
  if (G.locked || G.phase !== 'predict') return;
  const p = G.problem;
  const res = checkPredict(p.eq, saysBigger);
  if (!res.correct) return miss(res, { lock: true, delay: 1600, retry: () => enterPhase('block') });   // explained; carry on to solving
  hubAudio.playCoinClink();
  showFeedback(true, res.message);
  G.locked = true;
  setTimeout(() => { if (G.problem !== p) return; G.locked = false; UI.feedback.classList.add('hidden'); enterPhase('block'); }, 1600);
}

function dropBlock() {
  const p = G.problem, eq = p.eq;
  if (G.locked || G.phase !== 'block') return;
  if (!blockReady()) return nudge(G.sel.op ? 'Type the amount: 5.43, 2/3 or 1 5/8.' : 'Build a block first: pick + − × ÷ and an amount.');
  const op = G.sel.op, n = blockAmount();
  G.sel.armed = false;
  G.locked = true;
  const res = checkBlock(eq, op, n);
  const tok = `${SIGN[op]} ${s(n)}`;
  hubAudio.playTone(300, 'triangle', 0.15, 0.08);
  drawTruck({ label: eqText(eq), slip: tok });
  const both = eq.flipped
    ? `${esc(s(eq.c))} <span class="you">${tok}</span> = ${esc(exprText(eq))} <span class="you">${tok}</span>`
    : `${esc(exprText(eq))} <span class="you">${tok}</span> = ${esc(s(eq.c))} <span class="you">${tok}</span>`;
  strip([eqText(eq), both]);
  setTimeout(() => {
    if (G.problem !== p) return;
    G.locked = false;
    if (res.correct) { G.pending = { op, n }; hubAudio.playCoinClink(); return enterPhase('calc'); }
    drawTruck({ label: eqText(eq), slip: tok, stamp: 'bad', stampText: 'WRONG BLOCK' });
    miss(res, { lock: true, delay: 1200, retry: () => enterPhase('block') });
  }, 700);
}

function submitCalc() {
  if (G.locked || G.phase !== 'calc') return;
  const p = G.problem, eq = p.eq;
  const { op, n } = G.pending;
  const res = checkCalc(eq, op, n, G.typed);
  if (res.nudge) return nudge(res.message);
  const v = res.value;
  const ok = res.correct;
  drawTruck({ label: eqText(eq), plate: s(v), plateColor: ok ? '#d9f7e3' : '#ffd9dc', stamp: ok ? 'ok' : 'bad', stampText: ok ? 'PAID ✓' : `≠ ${s(eq.c)}`, pop: true });
  strip([`${eq.letter} = ${esc(s(v))}`, `<span class="${ok ? 'good' : 'bad'}">Check: ${esc(checkLine(eq, v))}${ok ? ' ✓' : ' ✗'}</span>`]);
  if (ok) return win({ ...res, message: `${eq.letter} = ${s(eq.x)}. Check: ${checkLine(eq, eq.x)} ✓` });
  miss(res, { lock: true, delay: 1300, retry: () => { G.typed = ''; renderControls(); showState(); } });
}

/* ================================================================== */
/* Keys and start-up                                                   */
/* ================================================================== */
function onKey(e) {
  const key = e.key;
  if (G.phase === 'option') {
    const n = Number(key);
    if (n >= 1 && n <= G.problem.options.length) answerOption(n - 1);
    return;
  }
  if (G.phase === 'predict') {
    if (key === 'ArrowLeft' || key === '1') { e.preventDefault(); answerPredict(false); }
    if (key === 'ArrowRight' || key === '2') { e.preventDefault(); answerPredict(true); }
    return;
  }
  if (G.phase === 'block') {
    if (!G.sel.op || !G.sel.amount) {                  // before an amount: these keys pick the block
      if (key === '+') return pickOp('+');
      if (key === '-') return pickOp('-');
      if (key === '*' || key === 'x' || key === 'X') return pickOp('×');
      if (key === '/' && !G.sel.op) { e.preventDefault(); return pickOp('÷'); }
    }
    if (/^[0-9./ ]$/.test(key)) { e.preventDefault(); return typeKey(key); }
    if (key === 'Backspace') { e.preventDefault(); return typeKey('back'); }
    if (key === 'Enter') { e.preventDefault(); return dropBlock(); }
    return;
  }
  if (G.phase === 'calc') {
    if (/^[0-9./ ]$/.test(key)) { e.preventDefault(); return typeKey(key); }
    if (key === 'Backspace') { e.preventDefault(); return typeKey('back'); }
    if (key === 'Enter') { e.preventDefault(); submitCalc(); }
  }
}

function init() {
  const stripEl = document.createElement('div');
  stripEl.id = 'eqStrip'; stripEl.className = 'eq-strip hidden';
  $('stage').appendChild(stripEl);
  // tap the block, then tap the ticket
  $('stage').addEventListener('click', (e) => { if (G.sel.armed && inside(UI.scene, e.clientX, e.clientY)) dropBlock(); });
  drawTruck({ label: 'm + 5.43 = 9.28' });             // a sample order behind the briefing
}

init();
