// Food Truck (Lesson 4-5: Write and Solve Equations with Rational Numbers): the screen and the controls.
// The math is in truck.js. The shared parts of an action game (briefing, top bar, chances, hint card, report)
// are in shared/game/arcadeShell.js.
//
// A zone is a list of ROUNDS. Each round is one of five moves:
//   sort      tickets roll along the rail; call each one MORE or LESS before it rolls away
//   tool      a ticket sits on the counter; pick the tool that gets the letter alone and watch it unwind
//   ring      punch the exact answer into the register
//   build     write the ticket from the customer's words, with tiles
//   critique  the new cook's ticket has one wrong line: tap it
// All timing goes through update(), so the action stops cleanly whenever a banner, hint, help screen or mistake
// message is showing.
import { createArcade } from '../../../../shared/game/arcadeShell.js';
import { ZONES, genZone, eqText, show, moreOrLess, checkEstimate, unwind, checkRing, checkBuild, checkSlip, undoStep } from './truck.js';

const GAP = 320, SPEED = 95, EXIT_X = 34, TICKET_W = 290;   // the rail: spacing, pixels a second, where tickets leave
const BOSS = ZONES.length - 1;
const $ = (id) => document.getElementById(id);
const play = $('play');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Everything about the round being played.
const W = {
  rounds: [], ri: 0, round: null, phase: 'idle',    // phase: idle, sort, tool, ring, build, critique, gap
  items: [], railMiss: 0,                           // sort: one item per ticket { p, n, x, state, el }
  tries: 0, slots: [null, null, null], op: null,    // build: which tile is in each space, and the operation
  gapLeft: 0, frozen: false, wrongEl: null, afterResume: null, speed: 1,
};

const HINTS = {
  mult_makes_bigger: 'Multiplying does not always make a number bigger.<span class="mono">0.5x = 6 : half of x is 6, so x is 12</span>Times less than 1 shrinks. Divide by less than 1 grows.',
  add_sub_direction: 'Think about what happened to the letter.<span class="mono">x + 2.5 = 6 : something was added, so x is less than 6</span>',
  too_slow: 'You do not need the exact answer on the rail. Ask one thing: did the letter get bigger or smaller on its way to the number?',
  did_not_undo: 'To get the letter alone, do the OPPOSITE of what the ticket does.<span class="mono">+ undoes −      × undoes ÷</span>',
  wrong_op: 'To get the letter alone, do the OPPOSITE of what the ticket does.<span class="mono">+ undoes −      × undoes ÷</span>',
  used_total: 'Undo the number that is WITH the letter, not the number on the other side.<span class="mono">p + 2.75 = 6 : undo the 2.75</span>',
  not_reciprocal: 'To undo × by a fraction, multiply by its RECIPROCAL: flip it.<span class="mono">2/3 × 3/2 = 1, and 1x is just x</span>Dividing by 2/3 is the same move.',
  decimal_align: 'Line up the decimal points before you add or subtract.<span class="mono">6.00 − 2.75</span>',
  place_value: 'Estimate first, so you know where the decimal point belongs.<span class="mono">40.14 ÷ 1.8 is about 40 ÷ 2 = 20</span>',
  common_denominator: 'Rename both fractions with the same bottom number before you add or subtract.<span class="mono">1/2 + 1/4 = 2/4 + 1/4</span>',
  story_op: 'Parts and a total, or an amount taken away: + or −.<span class="mono">Equal groups (5 the same): × or ÷</span>',
  story_order: 'Say your ticket as a sentence. Does it say what the customer said?<span class="mono">part + part = total</span>',
};
const TIPS = {
  mult_makes_bigger: 'Multiplying by less than 1 makes a number smaller; dividing by less than 1 makes it bigger.',
  add_sub_direction: 'If something was added to reach the total, the unknown is less than the total.',
  too_slow: 'Estimate first: is the unknown more or less than the number it equals?',
  did_not_undo: 'Solve by doing the opposite operation to both sides.',
  wrong_op: 'Solve by doing the opposite operation to both sides.',
  used_total: 'Undo the number that is with the variable, not the number on the other side.',
  wrong_amount: 'Undo with the same number the equation uses.',
  not_reciprocal: 'To undo multiplying by a fraction, multiply by its reciprocal.',
  decimal_align: 'Line up decimal points when adding and subtracting decimals.',
  decimal_times: 'Check decimal answers by multiplying back.',
  place_value: 'Estimate to place the decimal point.',
  added_instead: 'Check your answer by putting it back into the equation.',
  common_denominator: 'Use a common denominator to add or subtract fractions.',
  add_denominators: 'Use a common denominator: never add the bottom numbers.',
  mixed_borrow: 'Borrow 1 whole (or use improper fractions) when the fraction part is too small to subtract.',
  fraction_times: 'To divide by a fraction, multiply by its reciprocal.',
  story_op: 'Parts and a total use + or −; equal groups use × or ÷.',
  story_order: 'Read the equation back as a sentence to see if it matches the story.',
  critique: 'Whatever you do to one side of an equation, do to the other, and check the arithmetic.',
};

const arcade = createArcade({
  zones: ZONES, startZone, stopZone, onKey, hints: HINTS, skillTips: TIPS, testName: '__truck',
  perfectText: 'A perfect shift: no mistakes to sharpen!',
  lifeLostText: (left) => (left > 0 ? `A CUSTOMER WALKED OUT! ${left} CHANCE${left === 1 ? '' : 'S'} LEFT` : 'TRUCK CLOSED'),
});
const { G, hubAudio } = arcade;
if (window.__truck) window.__truck.W = W;
const busy = () => W.frozen || arcade.paused();
const stageW = () => play.clientWidth;

/* ================================================================== */
/* Zones and rounds                                                    */
/* ================================================================== */
function startZone(z) {
  W.rounds = genZone(Math.random, z);
  startRound(0);
}
function stopZone() {
  Object.assign(W, { phase: 'idle', frozen: false, items: [], afterResume: null, wrongEl: null });
  $('callout').classList.add('hidden');
  play.innerHTML = '';
}
function startRound(i) {
  const round = W.rounds[i];
  Object.assign(W, { ri: i, round, phase: round.type, items: [], railMiss: 0, tries: 0, slots: [null, null, null], op: null, frozen: false, afterResume: null, wrongEl: null });
  if (G.zone === BOSS) arcade.setBossProgress((i / W.rounds.length) * 100);
  ({ sort: drawRail, tool: drawTool, ring: drawRing, build: drawBuild, critique: drawCook })[round.type]();
  renderSign(true); renderCtl();
}
function rest(seconds) { W.phase = 'gap'; W.gapLeft = seconds; renderCtl(); }
function endRound(bonus) {
  if (bonus) { G.score += 20; arcade.renderHud(); arcade.flash(bonus); }
  rest(0.9);
}
function nextRound() {
  if (W.ri + 1 < W.rounds.length) return startRound(W.ri + 1);
  W.phase = 'idle';
  if (G.zone === BOSS) arcade.setBossProgress(100);
  arcade.zoneCleared();
}
/** Stop the action and say what went wrong (or, in green, what the student found). */
function stopFor(message, button, then, el = null, good = false) {
  W.frozen = true; W.wrongEl = el; W.afterResume = then;
  $('calloutText').textContent = message;
  $('resumeBtn').textContent = button;
  $('callout').classList.toggle('good', good);
  $('callout').classList.remove('hidden');
}
function resume() {
  if (!W.frozen || arcade.paused()) return;
  W.frozen = false;
  $('callout').classList.add('hidden');
  if (W.wrongEl) W.wrongEl.remove();
  W.wrongEl = null;
  const then = W.afterResume;
  W.afterResume = null;
  if (then) then();
}
function update(dt) {
  if (W.phase === 'idle' || busy()) return;
  if (W.phase === 'gap') { W.gapLeft -= dt; if (W.gapLeft <= 0) nextRound(); return; }
  if (W.phase !== 'sort') return;
  const speed = SPEED * (G.practice ? 0.6 : 1);
  for (const it of W.items) {
    if (it.state !== 'roll') continue;
    it.x -= speed * dt;
    place(it);
    if (it.x <= EXIT_X) { call(it, null); if (W.phase !== 'sort' || busy()) return; }
  }
  const lead = front();
  for (const it of W.items) if (it.state === 'roll') it.el.classList.toggle('front', it === lead);
  if (W.items.every((it) => it.state === 'done')) endRound(W.railMiss === 0 ? 'EVERY CALL RIGHT! +20' : null);
}

/* ================================================================== */
/* Zone 1: more or less? Tickets on the rail                           */
/* ================================================================== */
function drawRail() {
  play.innerHTML = '<div class="rail"></div><div class="out"></div>';
  W.items = W.round.tickets.map((p, n) => ({ p, n, x: stageW() + 30 + n * GAP, state: 'roll', el: null }));
  for (const it of W.items) {
    const eq = it.p.eq, el = document.createElement('div');
    el.className = 'tk';
    el.innerHTML = `<div class="tk-eq">${esc(eqText(eq))}</div><div class="tk-q">Is ${eq.letter} more or less than ${esc(show(eq.c, eq.style))}?</div>
      <div class="tk-btns"><button type="button" data-say="more">▲ MORE</button><button type="button" data-say="less">▼ LESS</button></div>`;
    for (const b of el.querySelectorAll('[data-say]')) b.addEventListener('click', () => call(it, b.dataset.say));
    play.appendChild(el);
    it.el = el; place(it);
  }
}
const place = (it) => { it.el.style.transform = `translateX(${it.x}px)`; };
const onRail = (it) => it.state === 'roll' && it.x <= stageW() - TICKET_W;   // the whole ticket is on screen
const front = () => W.items.find(onRail) || null;
/** says: 'more', 'less', or null when the ticket rolled out uncalled. */
function call(it, says) {
  if (W.phase !== 'sort' || busy() || !it || it.state !== 'roll' || (says && !onRail(it))) return;
  const eq = it.p.eq, res = checkEstimate(eq, says);
  it.state = 'done';
  it.el.classList.remove('front');
  it.el.querySelector('.tk-btns').outerHTML = `<div class="tk-ans">${eq.letter} = ${esc(show(eq.x, eq.style))}: ${moreOrLess(eq).toUpperCase()}</div>`;
  if (!res) {
    arcade.good(10); hubAudio.playCoinClink();
    it.el.classList.add('ok');
    const el = it.el; setTimeout(() => el.remove(), 950);
    return;
  }
  W.railMiss += 1;
  it.el.classList.add('bad');
  arcade.bad(res.key, says ? 25 : 15);
  if (W.phase === 'idle') return;                    // that was the last chance: the zone has stopped
  stopFor(res.message, 'CONTINUE (ENTER)', null, it.el);
}

/* ================================================================== */
/* Zones 2 and 3: which undo? Tools on the counter                     */
/* ================================================================== */
function ticketHtml(eq, story, inner = '') {
  return `<div class="big" id="big">${story ? `<div class="b-story">${esc(story)}</div>` : ''}<div class="b-eq" id="bEq">${esc(eqText(eq))}</div>${inner}<div class="b-lines" id="bLines"></div></div>`;
}
function showLines(lines, off = false) {
  $('bLines').innerHTML = lines.map((l) => `<div>${esc(l)}</div>`).join('');
  $('bLines').classList.toggle('off', off);
}
function drawTool() {
  const r = W.round;
  play.innerHTML = `${ticketHtml(r.eq)}<div class="tools">${r.tools.map((t, i) => `<button type="button" class="chip" data-tool="${i}"><b>${i + 1}</b>${esc(t.text)}</button>`).join('')}</div>`;
  for (const b of play.querySelectorAll('[data-tool]')) b.addEventListener('click', () => { b.blur(); pickTool(Number(b.dataset.tool)); });
}
function pickTool(i) {
  const chip = play.querySelector(`[data-tool="${i}"]`);
  if (W.phase !== 'tool' || busy() || !chip || chip.disabled) return;
  const eq = W.round.eq, tool = W.round.tools[i], res = unwind(eq, tool.op, tool.n);
  showLines(res.lines, !res.correct);
  if (res.correct) {
    arcade.good(10); hubAudio.playCoinClink();
    $('big').classList.add('done');
    return rest(2.2);
  }
  W.tries += 1;
  arcade.bad(res.key, 25);
  if (W.phase === 'idle') return;
  if (W.tries >= 2) {                                // two misses: show the undo and move on
    return stopFor(res.message, 'SEE THE UNDO (ENTER)', () => { const s = undoStep(eq); showLines(unwind(eq, s.op, s.n).lines); $('big').classList.add('done'); rest(3); });
  }
  stopFor(res.message, 'TRY ANOTHER TOOL (ENTER)', () => { chip.disabled = true; showLines([]); });
}

/* ================================================================== */
/* Zone 4: ring it up                                                  */
/* ================================================================== */
function drawRing() {
  const r = W.round;
  const pad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.', '/'].map((k) => `<button type="button" data-k="${k}">${k}</button>`).join('')
    + '<button type="button" class="wide" data-k=" ">SPACE</button><button type="button" class="wide" data-k="back">⌫</button>';
  play.innerHTML = `${ticketHtml(r.eq, r.story)}<div class="register"><div class="reg-row"><span>${r.eq.letter} =</span>
    <input id="reg" inputmode="decimal" autocomplete="off" maxlength="9" aria-label="the value of ${r.eq.letter}"></div><div class="pad">${pad}</div></div><div class="note" id="note"></div>`;
  const reg = $('reg');
  reg.addEventListener('input', () => { reg.value = reg.value.replace(/[^0-9./ $]/g, ''); });
  for (const b of play.querySelectorAll('[data-k]')) b.addEventListener('click', () => { reg.value = b.dataset.k === 'back' ? reg.value.slice(0, -1) : (reg.value + b.dataset.k).slice(0, 9); reg.focus(); });
  reg.focus();
}
function ringUp() {
  if (W.phase !== 'ring' || busy()) return;
  const eq = W.round.eq, reg = $('reg'), res = checkRing(eq, reg.value);
  if (res.nudge) { $('note').textContent = res.message; return; }
  $('note').textContent = '';
  if (res.correct) {
    arcade.good(15); hubAudio.playCoinClink();
    showLines([`${eq.letter} = ${show(eq.x, eq.style)}`, res.message]);
    $('big').classList.add('done'); reg.blur();
    return rest(1.9);
  }
  W.tries += 1;
  arcade.bad(res.key, 25);
  if (W.phase === 'idle') return;
  const moveOn = W.tries >= 2;
  stopFor(res.message + (moveOn ? ` The answer: ${eq.letter} = ${show(eq.x, eq.style)}.` : ''), moveOn ? 'NEXT TICKET (ENTER)' : 'TRY AGAIN (ENTER)', moveOn ? () => endRound(null) : () => { reg.focus(); reg.select(); });
}

/* ================================================================== */
/* Boss: build the ticket from the order                               */
/* ================================================================== */
const OP_TEXT = { '+': '+', '-': '−', '×': '×', '÷': '÷' };
function drawBuild() {
  const r = W.round;
  const slot = (k, cls = '') => `<button type="button" class="slot ${cls}" data-slot="${k}"></button>`;
  play.innerHTML = `<div class="big" id="big"><div class="b-story">${esc(r.story)}</div><div class="slots">${slot(0)}${slot('op', 'op')}${slot(1)}<span>=</span>${slot(2)}</div><div class="b-lines" id="bLines"></div></div>
    <div class="tiles">${r.tiles.map((t, i) => `<button type="button" class="tile" data-tile="${t.id}"><b>${i + 1}</b>${esc(t.text)}</button>`).join('')}
    <span class="ops">${Object.entries(OP_TEXT).map(([op, text]) => `<button type="button" data-op="${op}">${text}</button>`).join('')}</span></div><div class="note" id="note"></div>`;
  for (const b of play.querySelectorAll('[data-tile]')) b.addEventListener('click', () => { b.blur(); placeTile(b.dataset.tile); });
  for (const b of play.querySelectorAll('[data-op]')) b.addEventListener('click', () => { b.blur(); setOp(b.dataset.op); });
  for (const b of play.querySelectorAll('[data-slot]')) b.addEventListener('click', () => { b.blur(); clearSlot(b.dataset.slot); });
  renderBuild();
}
const canBuild = () => W.phase === 'build' && !busy();
function renderBuild() {
  const r = W.round, text = (id) => (r.tiles.find((t) => t.id === id) || {}).text || '';
  W.slots.forEach((id, k) => { const el = play.querySelector(`[data-slot="${k}"]`); el.textContent = text(id); el.classList.toggle('full', Boolean(id)); });
  const opEl = play.querySelector('[data-slot="op"]'); opEl.textContent = W.op ? OP_TEXT[W.op] : ''; opEl.classList.toggle('full', Boolean(W.op));
  for (const b of play.querySelectorAll('[data-tile]')) b.classList.toggle('used', W.slots.includes(b.dataset.tile));
}
function placeTile(id) {
  if (!canBuild() || !id || W.slots.includes(id)) return;
  const k = W.slots.indexOf(null);
  if (k < 0) return;
  W.slots[k] = id; hubAudio.playStep(); renderBuild();
}
function setOp(op) { if (!canBuild()) return; W.op = op; hubAudio.playStep(); renderBuild(); }
function clearSlot(k) { if (!canBuild()) return; if (k === 'op') W.op = null; else W.slots[Number(k)] = null; renderBuild(); }
function clearLast() { if (!canBuild()) return; for (let k = 2; k >= 0; k--) if (W.slots[k]) { W.slots[k] = null; break; } renderBuild(); }
function sendTicket() {
  if (!canBuild()) return;
  const p = W.round, res = checkBuild(p, W.slots[0], W.op, W.slots[1], W.slots[2]);
  if (res.nudge) { $('note').textContent = res.message; return; }
  $('note').textContent = '';
  if (res.correct) {
    arcade.good(15); hubAudio.playCoinClink();
    showLines([res.message, 'Now ring it up.']); $('big').classList.add('done');
    return rest(1.5);
  }
  W.tries += 1;
  arcade.bad(res.key, 25);
  if (W.phase === 'idle') return;
  const moveOn = W.tries >= 2;
  stopFor(res.message + (moveOn ? ` One way to write it: ${eqText(p.eq)}.` : ''), moveOn ? 'RING IT UP (ENTER)' : 'TRY AGAIN (ENTER)', moveOn ? () => endRound(null) : () => { W.slots = [null, null, null]; W.op = null; renderBuild(); });
}

/* ================================================================== */
/* Boss: the new cook's slip                                           */
/* ================================================================== */
function drawCook() {
  const r = W.round;
  play.innerHTML = `<div class="big" id="big"><div class="b-story">The new cook worked this ticket:</div><div class="b-eq">${esc(r.lines[0])}</div>
    ${[1, 2].map((i) => `<button type="button" class="cook-line" data-line="${i}"><b>${i}</b>${esc(r.lines[i])}</button>`).join('')}<div class="b-lines" id="bLines"></div></div>`;
  for (const b of play.querySelectorAll('[data-line]')) b.addEventListener('click', () => { b.blur(); tapLine(Number(b.dataset.line)); });
}
function tapLine(i) {
  if (W.phase !== 'critique' || busy() || (i !== 1 && i !== 2)) return;
  const p = W.round, res = checkSlip(p, i);
  play.querySelector(`[data-line="${p.wrong}"]`).classList.add('wrong');
  if (res.correct) { arcade.good(15); hubAudio.playCoinClink(); return stopFor(res.message, 'NEXT (ENTER)', () => endRound(null), null, true); }
  arcade.bad(res.key, 25);
  if (W.phase === 'idle') return;
  stopFor(res.message, 'NEXT (ENTER)', () => endRound(null));
}

/* ================================================================== */
/* Keys, sign and the bottom bar                                       */
/* ================================================================== */
function onKey(e) {
  const k = e.key;
  if (k === 'Enter') { e.preventDefault(); if (W.frozen) resume(); else if (W.phase === 'ring') ringUp(); else if (W.phase === 'build') sendTicket(); return; }
  if (W.frozen) return;
  if (W.phase === 'sort' && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); call(front(), k === 'ArrowUp' ? 'more' : 'less'); }
  if (W.phase === 'tool' && /^[1-4]$/.test(k)) pickTool(Number(k) - 1);
  if (W.phase === 'critique' && /^[12]$/.test(k)) tapLine(Number(k));
  if (W.phase === 'build') {
    const op = { '+': '+', '-': '-', '*': '×', x: '×', X: '×', '/': '÷' }[k];
    if (op) { e.preventDefault(); setOp(op); }
    else if (/^[1-3]$/.test(k)) placeTile((W.round.tiles[Number(k) - 1] || {}).id);
    else if (k === 'Backspace') { e.preventDefault(); clearLast(); }
  }
}
$('goBtn').addEventListener('click', (e) => { e.currentTarget.blur(); if (W.phase === 'ring') ringUp(); else sendTicket(); });
$('resumeBtn').addEventListener('click', (e) => { e.currentTarget.blur(); resume(); });

function renderSign(isNew = false) {
  const r = W.round, n = W.rounds.length, at = `${W.ri + 1}/${n}`;
  const [small, text] = {
    sort: [`RAIL ${at} · CALL EACH TICKET BEFORE IT ROLLS OUT`, 'IS THE LETTER MORE OR LESS THAN THE NUMBER?'],
    tool: [`TICKET ${at} · DO THE SAME TO BOTH SIDES`, 'PICK THE TOOL THAT GETS THE LETTER ALONE'],
    ring: [`TICKET ${at} · 2.25, 2 1/4 AND 9/4 ALL COUNT`, 'RING IT UP: WHAT IS THE LETTER WORTH?'],
    build: [`ORDER ${at} · LISTEN TO THE CUSTOMER`, 'WRITE THE TICKET FOR THIS ORDER'],
    critique: [`TICKET ${at} · ONE LINE IS WRONG`, "TAP THE NEW COOK'S MISTAKE"],
  }[r.type];
  $('signSmall').textContent = small;
  $('signText').textContent = text;
  if (isNew) { const s = $('sign'); s.classList.remove('new'); void s.offsetWidth; s.classList.add('new'); }
}
function renderCtl() {
  const p = W.phase;
  $('goBtn').classList.toggle('hidden', !(p === 'ring' || p === 'build'));
  $('goBtn').textContent = p === 'ring' ? 'RING IT UP (ENTER)' : 'SEND THE TICKET (ENTER)';
  $('tip').textContent = {
    sort: 'Press ↑ MORE or ↓ LESS for the glowing ticket, or tap a ticket\'s buttons.',
    tool: 'Tap a tool, or press its number.',
    build: 'Tap tiles to fill the ticket. Tap a space to empty it.',
    critique: 'Tap the line with the mistake, or press 1 or 2.',
  }[p] || '';
  $('waveTag').textContent = W.rounds.length ? `${W.round.type === 'sort' ? 'RAIL' : 'TICKET'} ${W.ri + 1}/${W.rounds.length}` : '';
}

/* ================================================================== */
/* The clock                                                           */
/* ================================================================== */
let last = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  update(dt * W.speed);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
