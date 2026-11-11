// Key Fitter (Lesson 4-1): screen, controls and game flow. The math lives in keys.js.
import {
  ZONES, genRun, genBackup, fmt, lockText, substitute, parseNumber, checkKey, checkMaster, checkForge, workedSolution,
} from './keys.js';
import { hubAudio } from '../../../../shared/audio.js';
import { createGame } from '../../../../shared/game/gameShell.js';

let run = null;                                       // this play's problems, all five zones

const SKILL_TIPS = {
  forward_op: 'Undo the operation in the lock: + becomes −, × becomes ÷.',
  answer_as_key: 'The key replaces the letter, not the number on the other side.',
  used_the_number: 'The key replaces the letter, not the number already in the lock.',
  add_sub_instead: 'Read the operation carefully: 4x means 4 × x.',
  place_value: 'Line up decimal points when you check a decimal key.',
  near_miss: 'Check every key: both sides must be exactly equal.',
  forgot_divide: 'In 6n + 5, multiply 6 × n first, then add 5.',
  wrong_order: 'Multiply before you add.',
  ignored_part: 'Use every part of the lock when you check.',
  missed_key: 'Test each key before deciding no key fits.',
  concatenation: '5n means 5 × n, not 5 next to n.',
  said_open: 'A lock only opens when both sides are equal.',
  said_shut: 'Work out both sides: some locks do open!',
  forge_wrong: 'Test your own lock: put the key in and check both sides.',
};

const shell = createGame({
  // One run is built at Start (and fresh on a retry), so its 2 "no key fits" locks really are spread over zones 1-3.
  zones: ZONES, makeZone: (rnd, z) => (run ||= genRun(rnd))[z], makeBackup: genBackup, workedSolution, showProblem,
  onStart: () => { run = null; }, onRetry: () => { run = null; },
  seconds: [40, 40, 45, 0, 50],                        // alarm: seconds until a guard comes (0 = no timer in that zone)
  meterFloor: 8, wrongBump: 34, rightRelief: 30, winDelay: () => 1600,
  lifeLostText: (left) => (left > 0 ? 'A GUARD SPOTTED YOU!' : 'CAUGHT!'),
  onLifeLost: () => {
    const fx = UI.scene.querySelector('#fx');
    if (fx) fx.innerHTML = `<g class="guard"><g transform="translate(720 440)"><rect x="-18" y="-60" width="36" height="60" rx="8" fill="#2f3a6b" ${O}/><circle cx="0" cy="-74" r="15" fill="#ffd3a8" ${O}/><rect x="-16" y="-92" width="32" height="10" fill="#2f3a6b" ${O}/><circle cx="20" cy="-40" r="9" fill="#ffd23f" ${O}/></g></g>`;
  },
  backupText: 'TRY A BACKUP LOCK (ENTER)', skillTips: SKILL_TIPS, perfectText: 'No mistakes to sharpen. Master safecracker!',
  bossDefeated: () => true, onKey, testName: '__keyfitter',
});
const { G, UI, $, showFeedback } = shell;
Object.assign(G, { tried: new Set(), marks: {}, forge: { op: '+', a: '', c: '', field: 'a' } });
const K = '#1d1433';
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round"`;
const KEY_X = [160, 320, 480, 640];

/* ================================================================== */
/* Scene                                                               */
/* ================================================================== */
function wall() {
  return `
    <rect width="800" height="520" fill="#b85f35"/>
    <path d="M0 70 Q200 60 400 76 T800 66 M0 150 Q220 140 420 156 T800 146 M0 380 Q220 370 420 386 T800 376" stroke="rgba(0,0,0,0.12)" stroke-width="9" fill="none"/>
    <rect y="440" width="800" height="80" fill="#8f3f22"/>
    <path d="M0 440 H800" stroke="${K}" stroke-width="3"/>`;
}

function vaultDoor(text, readout, readoutColor) {
  return `
    <circle cx="400" cy="185" r="172" fill="#6b6f80" ${O}/>
    <g class="door" id="door">
      <circle cx="400" cy="185" r="160" fill="#8b90a3" ${O}/>
      ${[0, 60, 120, 180, 240, 300].map((a) => `<circle cx="${400 + 140 * Math.cos(a * Math.PI / 180)}" cy="${185 + 140 * Math.sin(a * Math.PI / 180)}" r="7" fill="#5a5e70" ${O}/>`).join('')}
      <rect x="215" y="112" width="370" height="78" rx="12" fill="#fff4d6" ${O}/>
      <text x="400" y="164" text-anchor="middle" font-size="${text.length > 18 ? 28 : 36}" font-weight="900" font-family="ui-monospace, 'Courier New', monospace" fill="${K}">${text}</text>
      <rect x="240" y="204" width="320" height="44" rx="8" fill="#1d1433" ${O}/>
      <text x="400" y="232" text-anchor="middle" font-size="${readout.length > 30 ? 13 : 16}" font-weight="900" font-family="ui-monospace, monospace" fill="${readoutColor}">${readout}</text>
      <circle cx="400" cy="290" r="18" fill="#3b3f4f" ${O}/><rect x="395" y="290" width="10" height="22" fill="#1d1433"/>
    </g>`;
}

function keySvg(i, value, money, tried, showNumber = true) {
  const label = fmt(value, money);
  return `<g class="key-g" data-key="${i}" id="key${i}" transform="translate(${KEY_X[i]} 425)" opacity="${tried ? 0.35 : 1}">
    <path d="M0 -60 L0 -36" stroke="#8a6d3b" stroke-width="3"/>
    <rect x="-6" y="-36" width="12" height="70" rx="3" fill="#ffd23f" ${O}/>
    <path d="M6 18 h12 v8 h-12 M6 28 h8 v6 h-8" fill="#ffd23f" ${O}/>
    <circle class="key-bow" cx="0" cy="-58" r="${label.length > 4 ? 34 : 28}" fill="#ffd23f" ${O}/>
    <text x="0" y="-52" text-anchor="middle" font-size="${label.length > 5 ? 14 : 18}" font-weight="900" fill="${K}">${label}</text>
    ${showNumber ? `<text x="0" y="56" text-anchor="middle" font-size="11" font-weight="900" fill="#fff4d6">${i + 1}</text>` : ''}
  </g>`;
}

function locksmithSvg() {
  return `<g transform="translate(72 430)">
    <ellipse cx="0" cy="8" rx="30" ry="7" fill="rgba(0,0,0,0.25)"/>
    <rect x="-20" y="-50" width="40" height="52" rx="10" fill="#4a2f6b" ${O}/>
    <circle cx="0" cy="-66" r="17" fill="#ffd3a8" ${O}/>
    <rect x="-18" y="-82" width="36" height="10" rx="4" fill="#1d1433"/>
    <circle cx="-6" cy="-67" r="5" fill="none" stroke="${K}" stroke-width="2"/><circle cx="6" cy="-67" r="5" fill="none" stroke="${K}" stroke-width="2"/>
    <path d="M18 -30 L34 -44" stroke="${K}" stroke-width="6" stroke-linecap="round"/><circle cx="36" cy="-48" r="7" fill="#ffd23f" ${O}/>
  </g>`;
}

function drawLock(readout = 'Pick a key to test', color = '#ffd23f') {
  const p = G.problem;
  UI.scene.innerHTML = `${wall()}${vaultDoor(lockText(p), readout, color)}
    <circle cx="400" cy="372" r="18" fill="none" stroke="#8a6d3b" stroke-width="6"/>
    ${p.keys.map((k, i) => keySvg(i, k.value, p.money, G.tried.has(i))).join('')}
    ${G.zone === 4 ? locksmithSvg() : ''}
    <g id="fx"></g>`;
  UI.scene.querySelectorAll('[data-key]').forEach((g) => g.addEventListener('click', () => tryKey(Number(g.dataset.key))));
}

function padlock(x, y, l, state) {
  const shackle = state === 'open' ? 'M-16 -10 V-30 a16 16 0 0 1 32 0 V-22' : 'M-16 -10 V-28 a16 16 0 0 1 32 0 V-10';
  const ring = state === 'right' ? '#2fbf71' : state === 'wrong' ? '#e5484d' : null;
  return `<g transform="translate(${x} ${y})">
    ${ring ? `<rect x="-118" y="-48" width="236" height="104" rx="14" fill="none" stroke="${ring}" stroke-width="6"/>` : ''}
    <path d="${shackle}" fill="none" stroke="${K}" stroke-width="9"/><path d="${shackle}" fill="none" stroke="#c9c3b6" stroke-width="5"/>
    <rect x="-110" y="-10" width="220" height="56" rx="10" fill="${state === 'open' ? '#d9f7e3' : '#fff4d6'}" ${O}/>
    <text x="0" y="26" text-anchor="middle" font-size="20" font-weight="900" font-family="ui-monospace, monospace" fill="${K}">${lockText(l)}</text>
  </g>`;
}

function drawMaster(reveal = null) {
  const p = G.problem;
  const spots = [[220, 170], [580, 170], [220, 330], [580, 330]];
  UI.scene.innerHTML = `${wall()}
    <g transform="translate(400 455)"><circle cx="-70" cy="0" r="30" fill="#ffd23f" ${O}/><rect x="-40" y="-8" width="120" height="16" rx="4" fill="#ffd23f" ${O}/>
      <text x="-70" y="7" text-anchor="middle" font-size="16" font-weight="900" fill="${K}">${p.x}=${p.value}</text></g>
    ${p.locks.map((l, i) => padlock(spots[i][0], spots[i][1], l, reveal ? (reveal.includes(l.id) ? 'wrong' : 'right') : (G.marks[l.id] ? 'open' : 'shut'))).join('')}`;
}

function drawForge(result = null) {
  const p = G.problem;
  const f = G.forge;
  const text = `x ${f.op === '-' ? '−' : f.op} ${f.a || '?'} = ${f.c || '?'}`;
  UI.scene.innerHTML = `${wall()}${vaultDoor(text, result ? result.text : `Forge a lock that key ${p.value} opens`, result ? (result.ok ? '#2fbf71' : '#ff7a8a') : '#ffd23f')}
    ${keySvg(0, p.value, false, false, false).replace('translate(160 425)', 'translate(400 410)').replace('data-key="0"', '')}
    ${G.zone === 4 ? locksmithSvg() : ''}`;
}

/* ================================================================== */
/* Problems                                                            */
/* ================================================================== */
/** The shell has set G.problem, G.attempts and G.isBackup; reset this game's own state and draw. */
function showProblem() {
  Object.assign(G, { tried: new Set(), marks: {}, forge: { op: '+', a: '', c: '', field: 'a' } });
  render();
}

function render() {
  const p = G.problem;
  const tag = p.type === 'master' ? 'MASTER KEY' : p.type === 'forge' ? 'FORGE A LOCK' : p.story ? 'WORD LOCK' : 'WHICH KEY FITS?';
  UI.taskTag.textContent = `${tag}${G.isBackup ? ' · BACKUP' : ''}`;
  if (p.type === 'lock') {
    UI.prompt.innerHTML = `${p.story ? `${p.story} ` : ''}Which key makes this equation true?<span class="eq">${lockText(p)}</span>`;
    UI.controls.innerHTML = `
      <div class="key-grid">${p.keys.map((k, i) => `<button type="button" class="key-btn ${G.tried.has(i) ? 'tried' : ''}" data-kb="${i}" ${G.tried.has(i) ? 'disabled' : ''}><small>${i + 1}</small>🔑 ${fmt(k.value, p.money)}</button>`).join('')}</div>
      <button type="button" id="noneBtn" class="none-btn px" ${G.tried.has('none') ? 'disabled' : ''}>🚫 NO KEY FITS (N)</button>`;
    UI.controls.querySelectorAll('[data-kb]').forEach((b) => b.addEventListener('click', () => tryKey(Number(b.dataset.kb))));
    $('noneBtn').addEventListener('click', () => tryKey('none'));
    drawLock();
  } else if (p.type === 'master') {
    UI.prompt.innerHTML = `The master key is <b>${p.x} = ${p.value}</b>. Which locks does it open? Mark each one, then press CHECK.`;
    UI.controls.innerHTML = `<div class="lock-rows">${p.locks.map((l, i) => `<div class="lock-row" data-row="${l.id}"><span class="eqt">${i + 1}. ${lockText(l)}</span>
      <button type="button" class="tog px ${G.marks[l.id] ? 'on' : ''}" data-tog="${l.id}">${G.marks[l.id] ? '🔓 OPENS' : '🔒 STAYS SHUT'}</button></div>`).join('')}</div>
      <button type="button" id="checkBtn" class="apply px">CHECK (ENTER)</button>`;
    UI.controls.querySelectorAll('[data-tog]').forEach((b) => b.addEventListener('click', () => toggleMark(b.dataset.tog)));
    $('checkBtn').addEventListener('click', submitMaster);
    drawMaster();
  } else {
    UI.prompt.innerHTML = `Forge a lock that the key <b>x = ${p.value}</b> opens. Build an equation that is true when x is ${p.value}.`;
    const f = G.forge;
    UI.controls.innerHTML = `
      <div class="label px">1. PICK AN OPERATION</div>
      <div class="op-row">${['+', '-', '×', '÷'].map((op) => `<button type="button" class="op-btn ${f.op === op ? 'on' : ''}" data-fop="${op}">${op === '-' ? '−' : op}</button>`).join('')}</div>
      <div class="label px">2. FILL IN THE NUMBERS</div>
      <div class="forge-row">x <span class="forge-op">${f.op === '-' ? '−' : f.op}</span>
        <input id="fa" class="${f.field === 'a' ? 'focus' : ''}" value="${f.a}" inputmode="decimal" maxlength="6" placeholder="?" autocomplete="off"> =
        <input id="fc" class="${f.field === 'c' ? 'focus' : ''}" value="${f.c}" inputmode="decimal" maxlength="7" placeholder="?" autocomplete="off"></div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => `<button type="button" data-fd="${d}">${d}</button>`).join('')}</div>
      <button type="button" id="forgeBtn" class="apply px">FORGE AND TEST (ENTER)</button>`;
    UI.controls.querySelectorAll('[data-fop]').forEach((b) => b.addEventListener('click', () => { G.forge.op = b.dataset.fop; hubAudio.playSelect(); render(); }));
    UI.controls.querySelectorAll('[data-fd]').forEach((b) => b.addEventListener('click', () => forgeType(String(b.dataset.fd))));
    for (const fld of ['a', 'c']) {
      const el = $(`f${fld}`);
      el.addEventListener('focus', () => { G.forge.field = fld; ['fa', 'fc'].forEach((i) => $(i).classList.toggle('focus', i === `f${fld}`)); });
      el.addEventListener('input', () => { G.forge[fld] = el.value.replace(/[^\d.]/g, '').slice(0, 6); el.value = G.forge[fld]; drawForge(); });
    }
    $('forgeBtn').addEventListener('click', submitForge);
    drawForge();
  }
}

/* ================================================================== */
/* Answers                                                             */
/* ================================================================== */
function tryKey(i) {
  const p = G.problem;
  if (G.locked || p.type !== 'lock' || G.tried.has(i)) return;
  const res = checkKey(p, i === 'none' ? 'none' : p.keys[i].value);
  hubAudio.playSelect();
  if (i !== 'none') {                                          // slide the key into the keyhole
    const g = $(`key${i}`);
    if (g) { g.classList.add('inserted'); g.setAttribute('transform', 'translate(400 335) rotate(0)'); }
  }
  G.locked = true;
  setTimeout(() => {
    const sub = res.sub ? res.sub.text : res.correct ? 'NO KEY FITS ✓' : 'One key DOES fit';
    const readout = UI.scene.querySelector('#door text:last-of-type');
    if (readout) { readout.textContent = sub; readout.setAttribute('fill', res.correct ? '#2fbf71' : '#ff7a8a'); }
    if (res.correct) {
      $('door')?.classList.add('open');
    } else {
      $('door')?.classList.add('rattle');
      G.tried.add(i);
    }
    G.locked = false;
    settle(res, () => drawLock(sub, '#ff7a8a'));
  }, 480);
}

function toggleMark(lockId) {
  if (G.locked) return;
  hubAudio.playSelect();
  G.marks[lockId] = !G.marks[lockId];
  render();
}
function submitMaster() {
  if (G.locked) return;
  const res = checkMaster(G.problem, G.marks);
  drawMaster(res.wrong.length ? res.wrong : []);
  if (!res.correct) res.wrong.forEach((id) => UI.controls.querySelector(`[data-row="${id}"]`)?.classList.add('wrong'));
  settle(res, () => drawMaster());
}

function forgeType(d) {
  if (G.locked) return;
  const f = G.forge;
  f[f.field] = (f[f.field] + d).slice(0, 6);
  $(`f${f.field}`).value = f[f.field];
  drawForge();
}
function submitForge() {
  if (G.locked) return;
  const f = G.forge;
  const res = checkForge(G.problem, f.op, parseNumber(f.a), parseNumber(f.c));
  if (res.key === 'incomplete') { showFeedback(false, res.message); return; }
  const shown = res.lock ? substitute(res.lock, G.problem.value).text : 'Try another number';
  drawForge({ text: res.correct ? `${shown} ✓ Lock forged!` : shown, ok: res.correct });
  settle(res, () => drawForge());
}

/** Right or wrong: the shell scores it. After a first miss, the lock (or the game's own redraw) is shown again. */
function settle(res, redraw) {
  const p = G.problem;
  shell.settle(res, { delay: 1300, retry: () => { if (p.type === 'lock') render(); else redraw(); } });
}

/* ================================================================== */
/* Keys and start-up                                                   */
/* ================================================================== */
/** Keys while a problem is in play (the shell handles Enter on buttons, help, sound and the briefing). */
function onKey(e) {
  const key = e.key;
  const inInput = e.target && (e.target.id === 'fa' || e.target.id === 'fc');
  const p = G.problem;
  const n = Number(key);
  if (p.type === 'lock') {
    if (n >= 1 && n <= 4) return tryKey(n - 1);
    if (key === 'n' || key === 'N' || key === '0') return tryKey('none');
  } else if (p.type === 'master') {
    if (n >= 1 && n <= 4) return toggleMark(p.locks[n - 1].id);
    if (key === 'Enter') { e.preventDefault(); return submitMaster(); }
  } else if (p.type === 'forge') {
    if (key === 'Enter') { e.preventDefault(); return submitForge(); }
    if (inInput) return;
    if (key === '+') { G.forge.op = '+'; return render(); }
    if (key === '-') { G.forge.op = '-'; return render(); }
    if (key === '*' || key === 'x') { G.forge.op = '×'; return render(); }
    if (key === '/') { e.preventDefault(); G.forge.op = '÷'; return render(); }
    if (/^[0-9.]$/.test(key)) return forgeType(key);
    if (key === 'Tab') { e.preventDefault(); G.forge.field = G.forge.field === 'a' ? 'c' : 'a'; return render(); }
    if (key === 'Backspace') { const f = G.forge; f[f.field] = f[f.field].slice(0, -1); return render(); }
  }
}

function init() {
  // A sample lock behind the briefing.
  G.problem = { type: 'lock', kind: 'add', x: 'd', a: 9, c: 35, money: false, keys: [16, 22, 26, 36].map((value) => ({ value })) };
  drawLock('d + 9 = 35: which key?');
  G.problem = null;
}

init();
