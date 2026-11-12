// Twin Bridges (Grade 7, Lesson 4-2): the river, the two bridges and the controls. The math and checks live in
// bridges.js; zones, timer, lives, scoring and the report come from the shared game shell.
//
// Problem kinds: test (evaluate both bridges, then decide), choice, boxes (fill number boxes), select (tap every
// twin), num (type one value).
import { ZONES, genZone, genBackup, workedSolution, checkTest, checkChoice, checkBoxes, checkSelect, checkNum, fmt } from './bridges.js';
import { hubAudio } from '../../../../shared/audio.js';
import { createGame } from '../../../../shared/game/gameShell.js';

const SKILL_TIPS = {
  first_term_only: 'The number outside the parentheses multiplies EVERY term inside.',
  sign_error: 'Watch the signs: negative × positive is negative, negative × negative is positive.',
  combine_unlike: 'Only like terms combine: variable terms together, plain numbers together.',
  commute_subtraction: 'You can reorder addition, but not subtraction: x − 3 is not 3 − x.',
  lost_negative: 'A minus sign travels with the term right after it.',
  one_test_value: 'One matching value is not proof. One different value proves NOT equivalent.',
  zero_is_fine: 'Any value can be a test value, but one test is never enough to prove equivalence.',
  same_values: 'Equivalent expressions give the same value for every input.',
  evaluation_slip: 'Substitute carefully and follow the order of operations.',
  wrong_property: 'Commutative: order. Associative: grouping. Distributive: multiply each term.',
  factor_both_terms: 'A common factor must divide every term.',
  forgot_to_divide: 'When you factor, divide EVERY term by the common factor.',
  missed_twin: 'Equivalent expressions can look different: reordered terms are still twins.',
  not_the_error: 'Find the error by redoing the work one step at a time.',
  check_it: 'Check an equivalent expression by testing a value in both.',
};

const shell = createGame({
  zones: ZONES, makeZone: genZone, makeBackup: genBackup, workedSolution, showProblem,
  seconds: [70, 40, 60, 60, 80],                       // seconds until the river floods, per zone
  meterFloor: 8, wrongBump: 30, rightRelief: 25, pauseOnBanner: true,
  lifeLostText: (left) => (left > 0 ? 'A ROPE SNAPPED!' : 'THE BRIDGES WASHED OUT!'),
  bossHitText: 'CROSSED!', winDelay: () => 1700,
  skillTips: SKILL_TIPS, perfectText: 'No mistakes to sharpen. Master bridge builder!',
  onKey, testName: '__bridges',
});
const { G, UI, $, win, miss, showFeedback } = shell;
Object.assign(G, { tried: [], picked: new Set(), vals: {}, done: false, crack: null, shown: null });

/* ================================================================== */
/* Drawing: the river and the two bridges                              */
/* ================================================================== */
const K = '#1d1433';
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round"`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const FONT = 'font-family="Nunito, system-ui, sans-serif" font-weight="900"';
const MONO = 'font-family="ui-monospace, \'Courier New\', monospace" font-weight="900"';
const text = (t, x, y, size, fill = K, anchor = 'middle', font = FONT) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${fill}" ${font}>${esc(t)}</text>`;
const fit = (t) => (t.length > 26 ? 17 : t.length > 18 ? 22 : 28);

/** One bridge: planks across the river with its expression on a sign. state: null | 'ok' | 'bad'. value: shown on the far bank. */
function bridge(y, label, expr, state, value) {
  let planks = '';
  for (let x = 150; x < 650; x += 22) planks += `<rect x="${x}" y="${y - 16}" width="20" height="32" fill="${state === 'bad' && x > 380 && x < 430 ? 'none' : '#c98a4b'}" stroke="${state === 'bad' && x > 380 && x < 430 ? 'none' : K}" stroke-width="1.6"/>`;
  return `<g class="${state === 'bad' ? 'cracked' : state === 'ok' ? 'solid' : ''}">
    <rect x="146" y="${y - 24}" width="508" height="6" rx="2" fill="#8a5a2b" ${O}/><rect x="146" y="${y + 18}" width="508" height="6" rx="2" fill="#8a5a2b" ${O}/>
    ${planks}
    <rect x="200" y="${y - 78}" width="400" height="46" rx="10" fill="#3b3049" stroke="${state === 'ok' ? '#2fbf71' : state === 'bad' ? '#e5484d' : K}" stroke-width="${state ? 5 : 3}"/>
    ${text(label, 214, y - 62, 10, '#c9b8ff', 'start')}
    ${text(expr, 400, y - 46, fit(expr), '#ffd23f', 'middle', MONO)}
    ${value !== null && value !== undefined ? `<g><circle cx="716" cy="${y}" r="30" fill="${state === 'bad' ? '#ffadb3' : '#9be7b4'}" ${O}/>${text(value, 716, y + 7, String(value).length > 4 ? 15 : 20, K, 'middle', MONO)}</g>` : ''}
  </g>`;
}
function draw() {
  const p = G.problem;
  const scene = `<rect x="-300" y="-300" width="1400" height="1120" fill="#57b56a"/>
    <path d="M330 -300 C 300 100, 520 300, 440 830 L 560 830 C 640 300, 420 100, 470 -300 Z" fill="#3a8ef0" ${O}/>
    <path class="river-flow" d="M400 -100 C 380 150, 560 320, 500 800" fill="none" stroke="#bfe2ff" stroke-width="4" stroke-dasharray="12 22"/>`;
  let a = ['BRIDGE 1', '3(x − 5)', null, null], b = ['BRIDGE 2', '3x − 15', null, null], chip = 'x = 4';
  if (p) {
    const s = G.shown || {};
    if (p.type === 'test' || p.type === 'lucky') {
      a = ['BRIDGE 1', p.A.text, s.a || null, s.va ?? (p.type === 'lucky' ? fmt(p.va) : null)];
      b = ['BRIDGE 2', p.B.text, s.b || null, s.vb ?? (p.type === 'lucky' ? fmt(p.vb) : null)];
      chip = `${p.v} = ${fmt(p.x0)}`;
    } else if (p.type === 'property') { a = ['BRIDGE 1', p.from, G.done ? 'ok' : null, null]; b = ['BRIDGE 2', p.to, G.done ? 'ok' : null, null]; chip = ''; }
    else if (p.type === 'build') { a = ['BRIDGE 1', p.show, G.done ? 'ok' : null, null]; b = ['BRIDGE 2: YOUR TWIN', G.done ? p.answerText : '?', G.done ? 'ok' : G.crack ? 'bad' : null, null]; chip = ''; }
    else if (p.type === 'select') { a = ['THE TARGET', p.target.text, G.done ? 'ok' : null, null]; b = ['ITS TWINS', G.done ? `${p.cards.filter((c) => c.ok).length} twins found` : `${G.picked.size} picked`, G.done ? 'ok' : G.crack ? 'bad' : null, null]; chip = ''; }
    else if (p.type === 'maria') { a = ['THE EXPRESSION', p.show, null, null]; b = [G.done ? 'CORRECT TWIN' : "MARIA'S TWIN", G.done ? p.answerText : p.prompt.match(/equivalent to <b class="mono">([^<]+)</)[1], G.done ? 'ok' : 'bad', null]; chip = ''; }
    else { a = ['BRIDGE 1', p.A.text, G.done ? 'ok' : null, G.done ? fmt(p.answer) : null]; b = ['BRIDGE 2', p.B.text, G.done ? 'ok' : null, G.done ? fmt(p.answer) : null]; chip = `${p.v} = ${fmt(p.x0)}`; }
  }
  UI.scene.innerHTML = `${scene}${bridge(190, ...a)}${bridge(400, ...b)}
    ${chip ? `<g class="hiker"><circle cx="84" cy="296" r="34" fill="#ffd23f" ${O}/>${text(chip, 84, 302, chip.length > 6 ? 13 : 16, K, 'middle', MONO)}${text('test value', 84, 350, 12, '#1d1433')}</g>` : ''}`;
}

/* ================================================================== */
/* Problems and controls                                               */
/* ================================================================== */
const TAGS = { test: 'TEST THE BRIDGES', lucky: 'IS ONE TEST ENOUGH?', property: 'NAME THE PROPERTY', build: 'BUILD THE TWIN', select: 'FIND EVERY TWIN', maria: 'FIND THE ERROR', prove: 'PROVE IT' };
function showProblem(p, isBackup) {
  Object.assign(G, { tried: [], picked: new Set(), vals: {}, done: false, crack: null, shown: null });
  UI.taskTag.textContent = `${TAGS[p.type]}${isBackup ? ' · BACKUP' : ''}`;
  UI.prompt.innerHTML = p.prompt;
  renderControls();
  draw();
}
const focusFirst = () => { const el = [...UI.controls.querySelectorAll('input')].find((i) => !i.value) || UI.controls.querySelector('input'); if (el && UI.briefing.classList.contains('hidden')) el.focus({ preventScroll: true }); };
function renderControls() {
  const p = G.problem;
  if (p.kind === 'test') {
    UI.controls.innerHTML = `
      <div class="label px">1. WHAT DOES EACH BRIDGE EQUAL WHEN ${esc(p.v)} = ${fmt(p.x0)}?</div>
      <label class="rule-row small"><span>Bridge 1 =</span><input id="va" class="rbox" value="${esc(G.vals.a || '')}" inputmode="decimal" maxlength="7" placeholder="?" autocomplete="off"></label>
      <label class="rule-row small"><span>Bridge 2 =</span><input id="vb" class="rbox" value="${esc(G.vals.b || '')}" inputmode="decimal" maxlength="7" placeholder="?" autocomplete="off"></label>
      <div class="label px">2. ARE THEY EQUIVALENT?</div>
      <div class="pair"><button type="button" class="yes" data-eq="1"><b>Y</b>EQUIVALENT</button><button type="button" class="nope" data-eq="0"><b>N</b>NOT EQUIVALENT</button></div>
      <div id="helpLine" class="help-line">Type both values (negatives are fine), then press <kbd>Y</kbd> or <kbd>N</kbd>.</div>`;
    ['a', 'b'].forEach((k) => $(`v${k}`).addEventListener('input', (e) => { G.vals[k] = e.target.value; }));
    UI.controls.querySelectorAll('[data-eq]').forEach((b) => b.addEventListener('click', () => submitTest(b.dataset.eq === '1')));
    return focusFirst();
  }
  if (p.kind === 'choice') {
    UI.controls.innerHTML = p.options.map((o, i) => `<button type="button" class="choice" data-choice="${i}" ${G.tried.includes(i) ? 'disabled' : ''}><b>${i + 1}</b>${esc(o.text)}</button>`).join('')
      + `<div class="help-line">Click an answer or press <kbd>1</kbd>–<kbd>${p.options.length}</kbd>.</div>`;
    UI.controls.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => choose(Number(b.dataset.choice))));
    return;
  }
  if (p.kind === 'boxes') {
    const row = p.pattern.map((piece) => (typeof piece === 'object'
      ? `<input id="b_${piece.k}" class="rbox" data-box="${piece.k}" value="${esc(G.vals[piece.k] || '')}" inputmode="decimal" maxlength="6" placeholder="?" autocomplete="off">`
      : `<span>${esc(piece)}</span>`)).join('');
    UI.controls.innerHTML = `<div class="label px">FILL THE BOXES (TAB MOVES TO THE NEXT)</div>
      <div class="rule-row">${row}</div>
      <button type="button" id="checkBtn" class="apply px">BUILD IT (ENTER)</button>
      <div id="helpLine" class="help-line">A box can hold a negative number, like -16.</div>`;
    UI.controls.querySelectorAll('[data-box]').forEach((el) => el.addEventListener('input', () => { G.vals[el.dataset.box] = el.value; }));
    $('checkBtn').addEventListener('click', submitBoxes);
    return focusFirst();
  }
  if (p.kind === 'select') {
    UI.controls.innerHTML = `<div class="label px">TAP EVERY TWIN, THEN CHECK</div>
      <div class="cards">${p.cards.map((c, i) => `<button type="button" class="tcard ${G.picked.has(i) ? 'on' : ''}" data-card="${i}"><b>${i + 1}</b>${esc(c.text)}</button>`).join('')}</div>
      <button type="button" id="checkBtn" class="apply px">CHECK (ENTER)</button>
      <div id="helpLine" class="help-line">Tap again to un-pick. Keys: <kbd>1</kbd>–<kbd>${p.cards.length}</kbd>, then <kbd>Enter</kbd>.</div>`;
    UI.controls.querySelectorAll('[data-card]').forEach((b) => b.addEventListener('click', () => toggle(Number(b.dataset.card))));
    $('checkBtn').addEventListener('click', submitSelect);
    return;
  }
  UI.controls.innerHTML = `<label class="rule-row">${esc(p.label)} = <input id="ans" class="rbox" inputmode="decimal" maxlength="8" placeholder="?" autocomplete="off"></label>
    <button type="button" id="checkBtn" class="apply px">CROSS (ENTER)</button>
    <div id="helpLine" class="help-line">Type the value both expressions give. It can be negative.</div>`;
  $('checkBtn').addEventListener('click', submitNum);
  focusFirst();
}

/* ================================================================== */
/* Answers                                                             */
/* ================================================================== */
function finish(res) { G.done = true; draw(); return win(res); }
function submitTest(saysEq) {
  const p = G.problem;
  if (G.locked || p.kind !== 'test') return;
  const res = checkTest(p, $('va').value, $('vb').value, saysEq);
  if (res.nudge) return nudge(res.message);
  if (res.key === 'evaluation_slip') {
    G.shown = res.side === 'A' ? { a: 'bad' } : { b: 'bad' }; draw();
    return miss(res, { lock: true, delay: 1800, retry: () => { G.shown = null; draw(); focusFirst(); } });
  }
  // both values are right: show them on the far bank; a broken pair cracks bridge 2
  G.shown = { va: fmt(p.va), vb: fmt(p.vb), a: 'ok', b: p.eq ? 'ok' : 'bad' };
  if (res.correct) return finish(res);
  draw();
  miss(res, { lock: true, delay: 1900, retry: () => { G.shown = null; draw(); } });
}
function choose(i) {
  const p = G.problem;
  if (G.locked || p.kind !== 'choice' || G.tried.includes(i)) return;
  const res = checkChoice(p, i);
  UI.controls.querySelector(`[data-choice="${i}"]`)?.classList.add(res.correct ? 'right' : 'wrong');
  if (res.correct) return finish(res);
  G.tried.push(i);
  miss(res, { lock: true, delay: 1700, retry: () => renderControls() });
}
function submitBoxes() {
  const p = G.problem;
  if (G.locked || p.kind !== 'boxes') return;
  UI.controls.querySelectorAll('[data-box]').forEach((el) => { G.vals[el.dataset.box] = el.value; });
  const res = checkBoxes(p, G.vals);
  if (res.nudge) return nudge(res.message);
  if (res.correct) return finish(res);
  G.crack = true; draw();
  miss(res, { lock: true, delay: 1800, retry: () => { G.crack = null; draw(); focusFirst(); } });
}
function toggle(i) {
  if (G.locked || G.problem.kind !== 'select') return;
  if (G.picked.has(i)) G.picked.delete(i); else G.picked.add(i);
  hubAudio.playSelect();
  renderControls(); draw();
}
function submitSelect() {
  const p = G.problem;
  if (G.locked || p.kind !== 'select') return;
  const res = checkSelect(p, G.picked);
  if (res.nudge) return nudge(res.message);
  if (res.correct) return finish(res);
  (res.wrong || []).forEach((i) => UI.controls.querySelector(`[data-card="${i}"]`)?.classList.add('wrong'));
  G.crack = true; draw();
  miss(res, { lock: true, delay: 2000, retry: () => { (res.wrong || []).forEach((i) => G.picked.delete(i)); G.crack = null; renderControls(); draw(); } });
}
function submitNum() {
  const p = G.problem;
  if (G.locked || p.kind !== 'num') return;
  const res = checkNum(p, $('ans').value);
  if (res.nudge) return nudge(res.message);
  if (res.correct) return finish(res);
  miss(res, { lock: true, delay: 1800, retry: () => { $('ans').value = ''; focusFirst(); } });
}
function nudge(t) {
  const h = $('helpLine');
  if (h) h.innerHTML = `<span class="warn">${esc(t)}</span>`;
  else showFeedback(true, t);
  hubAudio.playTone(220, 'square', 0.12, 0.05);
}

function onKey(e) {
  const key = e.key, p = G.problem, n = Number(key);
  if (p.kind === 'test') {
    if (key === 'y' || key === 'Y') { e.preventDefault(); return submitTest(true); }
    if (key === 'n' || key === 'N') { e.preventDefault(); return submitTest(false); }
    if (key === 'Enter') { e.preventDefault(); nudge('Press Y for equivalent or N for not equivalent.'); }
    return;
  }
  if (p.kind === 'choice') { if (n >= 1 && n <= p.options.length) choose(n - 1); return; }
  if (p.kind === 'select') { if (n >= 1 && n <= p.cards.length) return toggle(n - 1); if (key === 'Enter') { e.preventDefault(); submitSelect(); } return; }
  if (key === 'Enter') { e.preventDefault(); if (p.kind === 'boxes') submitBoxes(); else submitNum(); }
}

draw();     // two sample bridges wait behind the briefing
