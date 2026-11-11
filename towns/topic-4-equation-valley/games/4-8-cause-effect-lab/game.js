// Cause and Effect Lab (Lesson 4-8): the experiment machine and its controls. The content and checks live in lab.js;
// zones, timer, lives, scoring and the report come from the shared game shell (shared/game/gameShell.js).
//
// Problem types: wire (put the cause on the DIAL and the effect on the METER), build (the same, from a bank of cards),
// hunt (tap every factor that could change the meter), dial (up, down or same?), time (cause or effect?), pick (critique).
import {
  ZONES, genZone, genBackup, checkWire, checkHunt, checkDial, checkTime, checkPick, checkBuild, workedSolution,
} from './lab.js';
import { hubAudio } from '../../../../shared/audio.js';
import { createGame } from '../../../../shared/game/gameShell.js';
import { dragOrTap, inside } from '../../../../shared/game/drag.js';

const SKILL_TIPS = {
  swapped: 'Ask: which one changes BECAUSE of the other? That one is dependent (the effect).',
  unrelated_factor: 'A factor only counts if changing it would change the effect.',
  missed_factor: 'Look for every factor that could change the effect.',
  more_is_more: 'More of a cause can mean LESS of the effect (faster speed, fewer hours).',
  direction: 'Imagine more of the cause, then ask what happens to the effect.',
  not_related: 'Some things don\'t affect each other at all.',
  time_always_cause: 'Time can be independent OR dependent: ask what depends on what.',
  either_one: 'Two amounts can change together, but only one is the cause.',
};

const shell = createGame({
  zones: ZONES, makeZone: genZone, makeBackup: genBackup, workedSolution, showProblem,
  seconds: [45, 55, 40, 45, 70],                       // power: seconds until the lab overloads, per zone
  meterFloor: 8, wrongBump: 30, rightRelief: 25, pauseOnBanner: true,
  lifeLostText: (left) => (left > 0 ? 'A FUSE BLEW!' : 'LAB SHUT DOWN!'),
  onLifeLost: () => $('sparks')?.classList.remove('hidden'),
  bossHitText: 'TAMED!', winDelay: () => 1700,
  skillTips: SKILL_TIPS, perfectText: 'No mistakes to sharpen. Head scientist material!',
  onKey, testName: '__lab',
});
const { G, UI, $, win, miss, showFeedback } = shell;
Object.assign(G, { slots: { dial: null, meter: null }, armed: null, picked: new Set(), tried: [] });

/* ================================================================== */
/* Drawing the machine                                                 */
/* ================================================================== */
const K = '#1d1433';
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round"`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Wraps text into lines of about `n` characters, as SVG tspans. */
function lines(text, x, y, n = 18, size = 16) {
  const words = String(text).split(' ');
  const out = [];
  for (const w of words) { const last = out[out.length - 1]; if (last && `${last} ${w}`.length <= n) out[out.length - 1] = `${last} ${w}`; else out.push(w); }
  const top = y - ((out.length - 1) * (size + 3)) / 2;
  return out.map((l, i) => `<text x="${x}" y="${top + i * (size + 3)}" text-anchor="middle" font-size="${size}" font-weight="900" fill="${K}" font-family="Nunito, system-ui, sans-serif">${esc(l)}</text>`).join('');
}
function lab() {
  return `<rect x="-300" y="-300" width="1400" height="1120" fill="#3c4a5e"/>
    <rect x="-300" y="430" width="1400" height="400" fill="#2a3242"/><path d="M-300 430 H1100" stroke="${K}" stroke-width="3"/>
    ${[400].map((x) => `<g transform="translate(${x} 380)"><rect x="-26" y="0" width="52" height="50" rx="6" fill="#8b90a3" ${O}/>
      <path d="M-14 0 V-46 H14 V0" fill="#9fe6ff" opacity="0.6" ${O}/><circle class="bubble" cx="0" cy="-10" r="5" fill="#fff"/></g>`).join('')}`;
}
/**
 * The machine: a DIAL on the left, a METER on the right, joined by a wire.
 *   dialText / meterText   what is on each slot (or '' for empty)
 *   turn   'up' | 'down' | 'same' | null — animates the knob and needle
 */
function drawMachine({ dialText = '', meterText = '', turn = null, title = 'EXPERIMENT', glowDial = false, glowMeter = false, wrong = false }) {
  const angle = turn === 'up' ? 55 : turn === 'down' ? -55 : 0;
  UI.scene.innerHTML = `${lab()}
    <rect x="40" y="60" width="720" height="70" rx="12" fill="#fff4d6" ${O}/>
    <text x="400" y="104" text-anchor="middle" font-size="20" font-weight="900" fill="#8f3f22" font-family="'Press Start 2P', monospace">${esc(title)}</text>
    <path d="M290 300 C350 240 450 360 510 300" fill="none" stroke="${wrong ? '#e5484d' : '#ffd23f'}" stroke-width="10"/>
    <g id="dialSlot" class="slot ${glowDial ? 'drop-target' : ''}" data-slot="dial">
      <rect class="slot-box" x="70" y="160" width="260" height="290" rx="18" fill="#8b90a3" ${O}/>
      <text x="200" y="190" text-anchor="middle" font-size="14" font-weight="900" fill="#fff" font-family="'Press Start 2P', monospace">DIAL</text>
      <text x="200" y="210" text-anchor="middle" font-size="12" font-weight="900" fill="#e3e7f5" font-family="Nunito, sans-serif">independent · cause</text>
      <circle cx="200" cy="300" r="62" fill="#6b6f80" ${O}/>
      <g class="knob" style="transform: rotate(${turn === 'up' ? 160 : turn === 'down' ? 160 : turn === 'same' ? 160 : 0}deg)"><circle cx="200" cy="300" r="44" fill="#ffd23f" ${O}/><path d="M200 300 V262" stroke="${K}" stroke-width="7" stroke-linecap="round"/></g>
      <rect x="86" y="372" width="228" height="66" rx="10" fill="#fff" ${O}/>
      ${dialText ? lines(dialText, 200, 408, 22, 15) : `<text x="200" y="412" text-anchor="middle" font-size="14" fill="#8a8a8a" font-weight="900" font-family="Nunito, sans-serif">drop the cause here</text>`}
    </g>
    <g id="meterSlot" class="slot ${glowMeter ? 'drop-target' : ''}" data-slot="meter">
      <rect class="slot-box" x="470" y="160" width="260" height="290" rx="18" fill="#8b90a3" ${O}/>
      <text x="600" y="190" text-anchor="middle" font-size="14" font-weight="900" fill="#fff" font-family="'Press Start 2P', monospace">METER</text>
      <text x="600" y="210" text-anchor="middle" font-size="12" font-weight="900" fill="#e3e7f5" font-family="Nunito, sans-serif">dependent · effect</text>
      <path d="M520 320 A80 80 0 0 1 680 320 Z" fill="#fff4d6" ${O}/>
      <path d="M535 318 A65 65 0 0 1 560 268" stroke="#e5484d" stroke-width="8" fill="none"/><path d="M640 268 A65 65 0 0 1 665 318" stroke="#2fbf71" stroke-width="8" fill="none"/>
      <g class="needle" style="transform: rotate(${angle}deg)"><path d="M600 318 V250" stroke="${K}" stroke-width="6" stroke-linecap="round"/></g>
      <circle cx="600" cy="318" r="10" fill="${K}"/>
      <rect x="486" y="372" width="228" height="66" rx="10" fill="#fff" ${O}/>
      ${meterText ? lines(meterText, 600, 408, 22, 15) : `<text x="600" y="412" text-anchor="middle" font-size="14" fill="#8a8a8a" font-weight="900" font-family="Nunito, sans-serif">drop the effect here</text>`}
    </g>
    <g id="sparks" class="${wrong ? '' : 'hidden'}">${[[380, 280], [420, 320]].map(([x, y], i) => `<circle class="spark" style="animation-delay:${i * 0.2}s" cx="${x}" cy="${y}" r="14" fill="#ffd23f"/>`).join('')}</g>`;
  UI.scene.querySelectorAll('[data-slot]').forEach((g) => g.addEventListener('click', () => clickSlot(g.dataset.slot)));
  // swing after the first paint so the knob and needle animate
  if (turn) {
    const knob = UI.scene.querySelector('.knob'), needle = UI.scene.querySelector('.needle');
    knob.style.transform = 'rotate(0deg)'; needle.style.transform = 'rotate(0deg)';
    void UI.scene.getBoundingClientRect();
    knob.style.transform = 'rotate(160deg)';
    needle.style.transform = `rotate(${turn === 'same' ? 0 : angle}deg)`;
    if (turn === 'same') needle.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(6deg)' }, { transform: 'rotate(-6deg)' }, { transform: 'rotate(0deg)' }], { duration: 700 });
  }
}
function strip(text) {
  const el = $('eqStrip');
  if (!el) return;
  if (!text) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML = `<div class="eq-line small">${text}</div>`;
}
const cardLabel = (c) => `${c.name}${c.letter ? ` (${c.letter})` : ''}`;

/* ================================================================== */
/* Problems                                                            */
/* ================================================================== */
const TAGS = { wire: 'WIRE THE EXPERIMENT', build: 'BUILD YOUR OWN EXPERIMENT', hunt: 'FACTOR HUNT', dial: 'TURN THE DIAL', time: 'IS TIME THE CAUSE OR THE EFFECT?', pick: 'IS THE FRIEND RIGHT?' };
function showProblem(p, isBackup) {
  Object.assign(G, { slots: { dial: null, meter: null }, armed: null, picked: new Set(), tried: [] });
  UI.taskTag.textContent = `${TAGS[p.type]}${isBackup ? ' · BACKUP' : ''}`;
  renderPrompt();
  renderControls();
  showState();
}
function renderPrompt() {
  const p = G.problem;
  const box = (t) => `<span style="display:block;font-size:15px;background:#fff;border:3px solid var(--ink);border-radius:10px;padding:7px 10px;margin-top:6px">${esc(t)}</span>`;
  const html = {
    wire: `${p.story ? box(p.story) : ''}Which variable is the <b>cause</b> (DIAL) and which is the <b>effect</b> (METER)?`,
    build: 'Design your own experiment: pick a <b>cause</b> for the DIAL and something it <b>changes</b> for the METER.',
    hunt: `The METER shows <b>${esc(p.effect)}</b>. Tap every factor that could change it.`,
    dial: 'Turn the DIAL up (more of the cause). What does the METER do?',
    time: `Is <b>time</b> the cause (independent) or the effect (dependent)?${box(p.situation?.text || '')}`,
    pick: box(p.ask || ''),
  }[p.type];
  UI.prompt.innerHTML = html;
}
function showState({ turn = null, wrong = false } = {}) {
  const p = G.problem;
  if (p.type === 'wire' || p.type === 'build') {
    drawMachine({ title: p.type === 'build' ? 'YOUR EXPERIMENT' : 'WIRE IT UP', dialText: G.slots.dial !== null ? cardLabel(p.cards[G.slots.dial]) : '', meterText: G.slots.meter !== null ? cardLabel(p.cards[G.slots.meter]) : '', turn, wrong });
    strip(G.armed !== null ? `<b>${esc(p.cards[G.armed].name)}</b>: tap the DIAL or the METER (or press ← / →).` : 'Ask: which one changes BECAUSE of the other?');
  } else if (p.type === 'hunt') {
    drawMachine({ title: 'FACTOR HUNT', dialText: 'which factors?', meterText: p.effect, turn, wrong });
    strip('Would changing it change the meter? Then it is an independent variable.');
  } else if (p.type === 'dial') {
    drawMachine({ title: 'MORE OF THE CAUSE…', dialText: p.pair.cause.name, meterText: p.pair.effect.name, turn, wrong });
    strip('');
  } else if (p.type === 'time') {
    drawMachine({ title: 'WHERE DOES TIME GO?', dialText: '?', meterText: '?', turn, wrong });
    strip('');
  } else {
    drawMachine({ title: 'LAB REVIEW', dialText: `${p.pair.cause.name} (${p.pair.cause.letter})`, meterText: `${p.pair.effect.name} (${p.pair.effect.letter})`, turn, wrong });
    strip('');
  }
}

/* ================================================================== */
/* Controls                                                            */
/* ================================================================== */
function renderControls() {
  const p = G.problem;
  if (p.type === 'wire' || p.type === 'build') {
    const placed = new Set([G.slots.dial, G.slots.meter]);
    UI.controls.innerHTML = `
      <div class="label px">VARIABLE CARDS · DRAG ONTO THE DIAL OR METER</div>
      <div class="cards">${p.cards.map((c, i) => `<button type="button" class="vcard ${G.armed === i ? 'armed' : ''}" data-card="${i}" ${placed.has(i) ? 'disabled' : ''}><b>${i + 1}</b>${esc(c.name)}${c.letter ? ` <span class="letter">${esc(c.letter)}</span>` : ''}</button>`).join('')}</div>
      <div class="row-btns" style="grid-template-columns:1fr 2fr"><button type="button" id="clearSlots" class="px">CLEAR</button><button type="button" id="checkBtn" class="go px">RUN IT (ENTER)</button></div>
      <div id="helpLine" class="help-line">Drag a card, or tap it then tap a slot. Keys: <kbd>1</kbd>–<kbd>${p.cards.length}</kbd> then <kbd>←</kbd> DIAL / <kbd>→</kbd> METER.</div>`;
    UI.controls.querySelectorAll('[data-card]').forEach((b) => b.addEventListener('pointerdown', (e) => {
      if (G.locked || b.disabled) return;
      const i = Number(b.dataset.card);
      dragOrTap(e, b, {
        targetAt: (x, y) => (inside($('dialSlot'), x, y) ? 'dial' : inside($('meterSlot'), x, y) ? 'meter' : null),
        glow: (t) => { $('dialSlot')?.classList.toggle('drop-target', t === 'dial'); $('meterSlot')?.classList.toggle('drop-target', t === 'meter'); },
        onDrop: (slot) => place(i, slot), onTap: () => arm(i), lift: true,
      });
    }));
    $('clearSlots').addEventListener('click', () => { if (!G.locked) { G.slots = { dial: null, meter: null }; G.armed = null; renderControls(); showState(); } });
    $('checkBtn').addEventListener('click', submitWire);
    return;
  }
  if (p.type === 'hunt') {
    UI.controls.innerHTML = `
      <div class="label px">FACTORS · TAP ALL THAT COULD CHANGE IT</div>
      <div class="cards">${p.cards.map((c, i) => `<button type="button" class="vcard ${G.picked.has(i) ? 'on' : ''}" data-hunt="${i}"><b>${i + 1}</b>${esc(c.name)}</button>`).join('')}</div>
      <button type="button" id="checkBtn" class="apply px">CHECK (ENTER)</button>
      <div id="helpLine" class="help-line">Tap again to un-pick. Keys: <kbd>1</kbd>–<kbd>6</kbd>, then <kbd>Enter</kbd>.</div>`;
    UI.controls.querySelectorAll('[data-hunt]').forEach((b) => b.addEventListener('click', () => toggle(Number(b.dataset.hunt))));
    $('checkBtn').addEventListener('click', submitHunt);
    return;
  }
  if (p.type === 'dial') {
    UI.controls.innerHTML = `<div class="pred"><button type="button" class="up px" data-pred="up">▲ GOES UP</button><button type="button" class="same px" data-pred="same">■ STAYS SAME</button><button type="button" class="down px" data-pred="down">▼ GOES DOWN</button></div>
      <div class="help-line">Keys: <kbd>↑</kbd> up · <kbd>space</kbd> same · <kbd>↓</kbd> down</div>`;
    UI.controls.querySelectorAll('[data-pred]').forEach((b) => b.addEventListener('click', () => answerDial(b.dataset.pred)));
    return;
  }
  if (p.type === 'time') {
    UI.controls.innerHTML = `<div class="stamps"><button type="button" class="stamp yes px" data-time="cause">◀ TIME IS THE CAUSE<br><small>independent</small></button><button type="button" class="stamp no px" data-time="effect">TIME IS THE EFFECT ▶<br><small>dependent</small></button></div>
      <div class="help-line">Ask: does time make something else change, or does something else decide how long it takes? Keys: <kbd>←</kbd> <kbd>→</kbd></div>`;
    UI.controls.querySelectorAll('[data-time]').forEach((b) => b.addEventListener('click', () => answerTime(b.dataset.time)));
    return;
  }
  UI.controls.innerHTML = p.options.map((o, i) => `<button type="button" class="choice" data-choice="${i}" ${G.tried.includes(i) ? 'disabled' : ''}><b>${i + 1}</b>${esc(o.text)}</button>`).join('');
  UI.controls.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => answerPick(Number(b.dataset.choice))));
}

/* ================================================================== */
/* Answers                                                             */
/* ================================================================== */
function arm(i) {
  if (G.locked) return;
  G.armed = G.armed === i ? null : i;
  hubAudio.playSelect();
  renderControls(); showState();
}
function place(i, slot) {
  if (G.locked) return;
  const other = slot === 'dial' ? 'meter' : 'dial';
  if (G.slots[other] === i) G.slots[other] = null;
  G.slots[slot] = i;
  G.armed = null;
  hubAudio.playTone(slot === 'dial' ? 440 : 660, 'triangle', 0.1, 0.07);
  renderControls(); showState();
}
function clickSlot(slot) {
  const p = G.problem;
  if (G.locked || !p || (p.type !== 'wire' && p.type !== 'build')) return;
  if (G.armed !== null) return place(G.armed, slot);
  if (G.slots[slot] !== null) { G.slots[slot] = null; renderControls(); showState(); }     // tap a filled slot to empty it
}
function submitWire() {
  const p = G.problem;
  if (G.locked || (p.type !== 'wire' && p.type !== 'build')) return;
  const d = G.slots.dial !== null ? p.cards[G.slots.dial] : null, m = G.slots.meter !== null ? p.cards[G.slots.meter] : null;
  const res = p.type === 'build' ? checkBuild(p, d, m) : checkWire(p, d, m);
  if (res.nudge) return nudge(res.message);
  if (res.correct) {
    const pair = p.type === 'build' ? null : p.pair;
    showState({ turn: pair ? pair.dir : 'up' });
    return win(res);
  }
  showState({ wrong: true });
  miss(res, { lock: true, delay: 1400, retry: () => { G.slots = { dial: null, meter: null }; renderControls(); showState(); } });
}
function toggle(i) {
  if (G.locked || G.problem.type !== 'hunt') return;
  if (G.picked.has(i)) G.picked.delete(i); else G.picked.add(i);
  hubAudio.playSelect();
  renderControls();
}
function submitHunt() {
  const p = G.problem;
  if (G.locked || p.type !== 'hunt') return;
  if (!G.picked.size) return nudge('Tap at least one factor first.');
  const res = checkHunt(p, G.picked);
  UI.controls.querySelectorAll('[data-hunt]').forEach((b) => { const i = Number(b.dataset.hunt); if (G.picked.has(i)) b.classList.add(p.cards[i].affects ? 'right' : 'wrong'); });
  if (res.correct) { showState({ turn: 'up' }); return win(res); }
  showState({ wrong: true });
  miss(res, { lock: true, delay: 1600, retry: () => renderControls() });
}
function answerDial(a) {
  const p = G.problem;
  if (G.locked || p.type !== 'dial') return;
  const res = checkDial(p, a);
  showState({ turn: res.correct ? a : p.pair.dir, wrong: !res.correct });
  if (res.correct) return win(res);
  miss(res, { lock: true, delay: 1600, retry: () => showState() });
}
function answerTime(a) {
  const p = G.problem;
  if (G.locked || p.type !== 'time') return;
  const res = checkTime(p, a);
  const s = p.situation;
  drawMachine({ title: 'WHERE DOES TIME GO?', dialText: s.time === 'cause' ? 'time (t)' : 'the other amount', meterText: s.time === 'cause' ? 'the other amount' : 'time (t)', turn: res.correct ? 'up' : null, wrong: !res.correct });
  if (res.correct) return win(res);
  miss(res, { lock: true, delay: 1600, retry: () => showState() });
}
function answerPick(i) {
  const p = G.problem;
  if (G.locked || G.tried.includes(i)) return;
  const res = checkPick(p, i);
  UI.controls.querySelector(`[data-choice="${i}"]`)?.classList.add(res.correct ? 'right' : 'wrong');
  if (res.correct) { showState({ turn: 'up' }); return win(res); }
  G.tried.push(i);
  miss(res, { lock: true, delay: 1400, retry: () => renderControls() });
}
function nudge(text) {
  const h = $('helpLine');
  if (h) h.innerHTML = `<span class="warn">${text}</span>`;
  else showFeedback(true, text);
  hubAudio.playTone(220, 'square', 0.12, 0.05);
}

/* ================================================================== */
/* Keys and start-up                                                   */
/* ================================================================== */
function onKey(e) {
  const key = e.key, p = G.problem;
  const n = Number(key);
  if (p.type === 'wire' || p.type === 'build') {
    if (n >= 1 && n <= p.cards.length) return arm(n - 1);
    if (key === 'ArrowLeft' && G.armed !== null) { e.preventDefault(); return place(G.armed, 'dial'); }
    if (key === 'ArrowRight' && G.armed !== null) { e.preventDefault(); return place(G.armed, 'meter'); }
    if (key === 'Enter') { e.preventDefault(); return submitWire(); }
    return;
  }
  if (p.type === 'hunt') {
    if (n >= 1 && n <= p.cards.length) return toggle(n - 1);
    if (key === 'Enter') { e.preventDefault(); return submitHunt(); }
    return;
  }
  if (p.type === 'dial') {
    if (key === 'ArrowUp' || key === '1') { e.preventDefault(); return answerDial('up'); }
    if (key === ' ' || key === '2') { e.preventDefault(); return answerDial('same'); }
    if (key === 'ArrowDown' || key === '3') { e.preventDefault(); return answerDial('down'); }
    return;
  }
  if (p.type === 'time') {
    if (key === 'ArrowLeft' || key === '1') { e.preventDefault(); return answerTime('cause'); }
    if (key === 'ArrowRight' || key === '2') { e.preventDefault(); return answerTime('effect'); }
    return;
  }
  if (n >= 1 && n <= p.options.length) answerPick(n - 1);
}

function init() {
  const stripEl = document.createElement('div');
  stripEl.id = 'eqStrip'; stripEl.className = 'eq-strip hidden';
  $('stage').appendChild(stripEl);
  drawMachine({ title: 'EXPERIMENT', dialText: 'raffle tickets sold (t)', meterText: 'money earned (m)' });   // a sample behind the briefing
}

init();
