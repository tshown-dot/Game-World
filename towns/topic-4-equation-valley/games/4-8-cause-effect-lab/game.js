// Cause and Effect Lab (Lesson 4-8: Understand Dependent and Independent Variables): the screen and the controls.
// The content and checks are in lab.js. The shared parts of an action game (briefing, top bar, fuses, hint card,
// report) are in shared/game/arcadeShell.js.
//
// The machine has a CRANK (independent: the student changes it) and a GAUGE (dependent: it responds). The student
// wires it and cranks it. Wired right, the gauge follows and the lab notes fill in; wired wrong, the crank spins
// and the gauge stays dead. A zone is a list of ROUNDS (see lab.js): wire, belt, way, spot, build, mystery.
// All timing goes through update(), so the action stops cleanly whenever a banner, hint, help screen or mistake
// message is showing.
import { createArcade } from '../../../../shared/game/arcadeShell.js';
import {
  ZONES, HUNTS, genZone, fmt, level, checkWire, genBelt, checkBelt, beltAnswer, genWay, checkWay, checkSpot, spotAnswer,
  checkBuild, buildAnswer, testCrank, checkMystery, mysteryAnswer,
} from './lab.js';

const BOSS = ZONES.length - 1;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Everything about the round being played.
const W = {
  rounds: [], ri: 0, round: null, phase: 'idle',    // phase: idle, wire, belt, way, spot, build, test, name, run, hold, gap
  crank: null, gauge: null,                         // wire and build: which tag is on the crank and on the gauge
  way: null,                                        // which way: up, down or same
  belt: { i: 0, x: 0, misses: 0, wait: 0 },         // belt: which tag is rolling, how far along, and a pause before the next
  testsLeft: 0, tested: {},                         // mystery: free tests left, and what each crank did
  anim: null, turn: 0, tries: 0, extraBelt: false,
  gapLeft: 0, frozen: false, afterResume: null, speed: 1,
};

const HINTS = {
  swapped: 'Ask: which one changes BECAUSE of the other?<span class="mono">tickets sold → money earned</span>You can sell more tickets. You cannot just "turn up" the money.',
  time_always_cause: 'Time is not always the crank.<span class="mono">speed → hours the drive takes</span>If the question is HOW LONG something takes, time is the gauge.',
  unrelated_factor: 'Test each tag in your head: if ONLY this changed, would the gauge change?<span class="mono">color of the plate → cost of a salad? No.</span>',
  missed_factor: 'One gauge can have many cranks.<span class="mono">size, toppings, restaurant → cost of a salad</span>Plug in every one that would change it.',
  more_is_more: 'More of the cause can mean LESS of the effect.<span class="mono">more kids sharing → fewer slices each</span>',
  direction: 'Picture two readings before you crank.<span class="mono">1 hour → 30 pages, 2 hours → 60 pages</span>Did the gauge go up or down?',
  not_related: 'Some things do not affect each other at all. Then there is no cause and no effect: the gauge stays put.',
  fine_machine: 'Read each machine as a sentence.<span class="mono">The GAUGE depends on the CRANK.</span>The backwards machine makes a sentence that is not true.',
  wrong_gauge: 'Use your test results. One crank moved the gauge.<span class="mono">What depends on THAT crank?</span>',
};
const TIPS = {
  swapped: 'The dependent variable changes BECAUSE the independent variable changes.',
  time_always_cause: 'Time can be independent or dependent: ask what depends on what.',
  unrelated_factor: 'A factor only counts if changing it would change the result.',
  missed_factor: 'One dependent variable can depend on several independent variables.',
  more_is_more: 'When the independent variable goes up, the dependent variable can go down.',
  direction: 'Use two rows of a table to see which way the dependent variable moves.',
  not_related: 'Some quantities do not affect each other at all.',
  fine_machine: 'Say it as a sentence: the dependent variable depends on the independent variable.',
  wrong_gauge: 'To name the dependent variable, ask what changes because of the independent one.',
};

const arcade = createArcade({
  zones: ZONES, startZone, stopZone, onKey, hints: HINTS, skillTips: TIPS, testName: '__lab',
  perfectText: 'No mistakes to sharpen. Head scientist material!',
  lifeLostText: (left) => (left > 0 ? `A FUSE BLEW! ${left} LEFT` : 'LAB SHUT DOWN'),
});
const { G, hubAudio } = arcade;
if (window.__lab) window.__lab.W = W;
const busy = () => W.frozen || arcade.paused();

/* ================================================================== */
/* Zones and rounds                                                    */
/* ================================================================== */
function startZone(z) {
  W.rounds = genZone(Math.random, z);
  W.extraBelt = false;
  startRound(0);
}
function stopZone() {
  Object.assign(W, { phase: 'idle', frozen: false, afterResume: null, anim: null });
  $('callout').classList.add('hidden');
}
const BEGIN = { wire: beginWire, belt: beginBelt, way: beginWay, spot: beginSpot, build: beginBuild, mystery: beginMystery };
function startRound(i) {
  const round = W.rounds[i];
  Object.assign(W, { ri: i, round, tries: 0, anim: null, frozen: false, afterResume: null, crank: null, gauge: null, way: null, tested: {} });
  if (G.zone === BOSS) arcade.setBossProgress((i / W.rounds.length) * 100);
  $('machine').classList.toggle('hidden', round.type === 'spot');
  $('spots').classList.toggle('hidden', round.type !== 'spot');
  $('ways').classList.add('hidden');
  $('bench').innerHTML = '';
  showLine(''); clearMachine();
  BEGIN[round.type](round);
  renderSign(true); renderCtl();
}
function rest(seconds) { W.phase = 'gap'; W.gapLeft = seconds; renderCtl(); }
function endRound() { rest(0.7); }
function nextRound() {
  if (W.ri + 1 < W.rounds.length) return startRound(W.ri + 1);
  W.phase = 'idle';
  if (G.zone === BOSS) arcade.setBossProgress(100);
  arcade.zoneCleared();
}
function stopFor(message, button, then) {
  W.frozen = true; W.afterResume = then;
  $('calloutText').textContent = message;
  $('resumeBtn').textContent = button;
  $('callout').classList.remove('hidden');
}
function resume() {
  if (!W.frozen || arcade.paused()) return;
  W.frozen = false;
  $('callout').classList.add('hidden');
  const then = W.afterResume;
  W.afterResume = null;
  if (then) then();
}
function showLine(text, off = false) { $('benchLine').textContent = text; $('benchLine').classList.toggle('off', off); }
/** A mistake the student can try again once. After the second miss the answer is given and the round moves on. */
function miss(res, { answer, retry, show = endRound }) {
  W.tries += 1;
  W.phase = 'hold';
  arcade.bad(res.key, 25);
  if (W.phase === 'idle') return;                    // that was the last fuse: the zone has stopped
  const moveOn = W.tries >= 2;
  stopFor(res.message + (moveOn ? ` ${answer}` : ''), moveOn ? 'NEXT (ENTER)' : 'TRY AGAIN (ENTER)', moveOn ? show : retry);
  renderCtl();
}

/* ================================================================== */
/* The machine: sockets, crank, gauge and the lab notes                */
/* ================================================================== */
function clearMachine() {
  $('crankRead').textContent = ''; $('gaugeRead').textContent = ''; $('logRows').innerHTML = '';
  $('gaugeFill').style.height = '0%';
  $('machine').classList.remove('dead', 'live');
  $('gaugeBox').classList.remove('twitch');
}
function setSocks(crank, gauge, heads = ['', '']) {
  $('crankSock').textContent = crank || ''; $('crankSock').classList.toggle('full', Boolean(crank));
  $('gaugeSock').textContent = gauge || ''; $('gaugeSock').classList.toggle('full', Boolean(gauge));
  $('logC').textContent = heads[0]; $('logE').textContent = heads[1];
}
/** Show reading i of an experiment on the crank, the gauge and the notes. units: false hides the gauge's unit (mystery). */
function showReading(pair, i, units = true) {
  const x = fmt(pair.xs[i], pair.cause.unit), y = units ? fmt(pair.ys[i], pair.effect.unit) : String(pair.ys[i]);
  $('crankRead').textContent = x; $('gaugeRead').textContent = y;
  $('gaugeFill').style.height = `${level(pair, i)}%`;
  $('logRows').insertAdjacentHTML('beforeend', `<tr><td>${esc(x)}</td><td>${esc(y)}</td></tr>`);
}
function spin() { W.turn += 72; $('wheel').style.transform = `rotate(${W.turn}deg)`; hubAudio.playStep(); }
/** Crank the machine. moves: the gauge follows (from reading `from`); otherwise the crank spins and the gauge stays dead. */
function run({ pair = null, moves, from = 0, units = true }, then) {
  W.phase = 'run';
  W.anim = { pair, moves, i: from, t: 0, units, spins: 0, then };
  $('machine').classList.remove('dead'); $('machine').classList.toggle('live', moves);
  hubAudio.playCartridgeLaunch(); renderCtl();
}
function updateRun(dt) {
  const A = W.anim;
  A.t += dt;
  if (A.t < 0.34) return;
  A.t = 0; spin();
  if (A.moves) { showReading(A.pair, A.i, A.units); A.i += 1; if (A.i < A.pair.xs.length) return; }
  else { A.spins += 1; $('machine').classList.add('dead'); if (A.spins < 3) return; }
  W.anim = null;
  A.then();
}

/* ================================================================== */
/* Tags on the bench                                                   */
/* ================================================================== */
function renderTags() {
  const p = W.round;
  $('bench').innerHTML = p.tags.map((t, i) => `<button type="button" class="tag ${i === W.crank || i === W.gauge ? 'used' : ''}" data-tag="${i}"><b>${i + 1}</b>${esc(t.name)}</button>`).join('');
}
$('bench').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || busy()) return; b.blur();
  if (b.dataset.tag) pickTag(Number(b.dataset.tag));
  else if (b.dataset.test) testIt(Number(b.dataset.test));
  else if (b.dataset.opt) pickOpt(Number(b.dataset.opt));
  else if (b.dataset.belt) decide(true);
});
function pickTag(i) {
  const p = W.round;
  if (busy() || !p.tags || !p.tags[i]) return;
  if (W.phase === 'wire') { W.crank = i; setSocks(p.tags[i].name, p.tags[1 - i].name); }
  else if (W.phase === 'build') {
    if (i === W.crank || i === W.gauge) return;
    if (W.crank === null) W.crank = i; else if (W.gauge === null) W.gauge = i; else return;
    setSocks(W.crank === null ? '' : p.tags[W.crank].name, W.gauge === null ? '' : p.tags[W.gauge].name);
  } else return;
  hubAudio.playStep(); showLine(''); renderTags();
}
function clearSock(which) {
  if (busy() || W.phase !== 'build') return;
  W[which] = null;
  const p = W.round;
  setSocks(W.crank === null ? '' : p.tags[W.crank].name, W.gauge === null ? '' : p.tags[W.gauge].name);
  renderTags();
}
$('crankSock').addEventListener('click', (e) => { e.currentTarget.blur(); clearSock('crank'); });
$('gaugeSock').addEventListener('click', (e) => { e.currentTarget.blur(); clearSock('gauge'); });

/* ================================================================== */
/* Wire: which tag goes on the crank?                                  */
/* ================================================================== */
function beginWire() {
  W.phase = 'wire';
  setSocks('', '');
  renderTags();
}
function goWire() {
  const p = W.round, res = checkWire(p, W.crank === null ? null : p.tags[W.crank]), { pair } = p;
  if (res.nudge) return showLine(res.message, true);
  clearMachine();
  if (res.ok) {
    setSocks(pair.cause.name, pair.effect.name, [pair.cause.letter, pair.effect.letter]);
    return run({ pair, moves: true }, () => { arcade.good(15); hubAudio.playCoinClink(); showLine(res.message); rest(1.2); });
  }
  run({ moves: false }, () => miss(res, {
    answer: 'Watch it wired the right way.',
    retry: () => { W.crank = null; clearMachine(); beginWire(); renderCtl(); },
    show: () => {
      W.crank = p.tags.findIndex((t) => t.role === 'cause'); renderTags(); clearMachine();
      setSocks(pair.cause.name, pair.effect.name, [pair.cause.letter, pair.effect.letter]);
      run({ pair, moves: true }, () => rest(1));
    },
  }));
}

/* ================================================================== */
/* Belt: plug in each factor that would move the gauge                 */
/* ================================================================== */
const BELT_START = 0.12, BELT_SECONDS = 6;
function beginBelt(p) {
  W.phase = 'belt';
  W.belt = { i: 0, x: BELT_START, misses: 0, wait: 0 };
  setSocks('', p.effect);
  $('gaugeFill').style.height = '50%';
  drawBeltTag();
}
function drawBeltTag() {
  const p = W.round, t = p.tags[W.belt.i];
  $('bench').innerHTML = `<div class="belt"><button type="button" class="tag rolling" id="beltTag" data-belt="1">${esc(t.name)}</button></div>`;
  moveBeltTag();
}
function moveBeltTag() { const el = $('beltTag'); if (el) el.style.left = `${W.belt.x * 100}%`; }
function updateBelt(dt) {
  const B = W.belt;
  if (B.wait > 0) { B.wait -= dt; if (B.wait <= 0) nextTag(); return; }
  B.x += (dt * (1 - BELT_START)) / BELT_SECONDS;
  if (G.practice) B.x = Math.min(B.x, 0.5);         // practice: the tag waits in the middle
  moveBeltTag();
  if (B.x >= 1) decide(false);
}
/** The tag was plugged into the crank, or it went by. */
function decide(plugged) {
  const p = W.round, B = W.belt;
  if (W.phase !== 'belt' || busy() || B.wait > 0) return;
  const res = checkBelt(p, B.i, plugged), el = $('beltTag');
  el.classList.add(plugged ? 'plugged' : 'gone');
  if (plugged) setSocks(p.tags[B.i].name, p.effect);
  B.wait = res.quiet ? 0.3 : 0.75;
  if (res.quiet) return hubAudio.playStep();
  if (res.ok) {
    arcade.good(10); hubAudio.playCoinClink(); showLine(res.message);
    const box = $('gaugeBox'); box.classList.remove('twitch'); void box.offsetWidth; box.classList.add('twitch');
    return;
  }
  B.misses += 1; showLine('');
  if (plugged) $('machine').classList.add('dead');
  arcade.bad(res.key, 20);
  if (W.phase === 'idle') return;
  B.wait = 0.05;
  stopFor(res.message, 'CARRY ON (ENTER)', null);
}
function nextTag() {
  const p = W.round, B = W.belt;
  $('machine').classList.remove('dead');
  setSocks('', p.effect);
  B.i += 1; B.x = BELT_START;
  if (B.i < p.tags.length) { drawBeltTag(); renderSign(); return; }
  $('bench').innerHTML = '';
  if (B.misses < 2) return rest(0.5);
  W.phase = 'hold'; renderCtl();                      // two misses: the whole answer, and one more hunt (once a zone)
  const more = !W.extraBelt;
  stopFor(beltAnswer(p) + (more ? ' Try one more.' : ''), 'NEXT (ENTER)', () => {
    if (more) { W.extraBelt = true; const other = HUNTS.filter((h) => !W.rounds.some((r) => r.effect === h.effect)); W.rounds.splice(W.ri + 1, 0, genBelt(Math.random, other[Math.floor(Math.random() * other.length)])); }
    endRound();
  });
}

/* ================================================================== */
/* Which way? predict, then crank                                      */
/* ================================================================== */
function beginWay(p) {
  const { pair } = p;
  W.phase = 'way';
  setSocks(pair.cause.name, pair.effect.name, [pair.cause.letter, pair.effect.letter]);
  showReading(pair, 0);
  $('ways').classList.remove('hidden');
  renderWays();
}
function renderWays() { for (const b of $('ways').querySelectorAll('button')) b.classList.toggle('on', b.dataset.way === W.way); }
function setWay(w) { if (W.phase !== 'way' || busy()) return; W.way = w; hubAudio.playStep(); showLine(''); renderWays(); }
$('ways').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.blur(); setWay(b.dataset.way); });
function goWay() {
  const p = W.round, res = checkWay(p, W.way);
  if (res.nudge) return showLine(res.message, true);
  run({ pair: p.pair, moves: true, from: 1 }, () => {
    if (res.ok) { arcade.good(15); hubAudio.playCoinClink(); showLine(res.message); return rest(1.2); }
    W.phase = 'hold';
    arcade.bad(res.key, 25);
    if (W.phase === 'idle') return;
    // The machine has shown the answer, so there is no second try: another machine of the same kind comes next.
    stopFor(res.message, 'NEXT (ENTER)', () => {
      if (!p.backup) W.rounds.splice(W.ri + 1, 0, { ...genWay(Math.random, p.pair.dir), backup: true });
      endRound();
    });
    renderCtl();
  });
}

/* ================================================================== */
/* Spot the machine wired backwards                                    */
/* ================================================================== */
function beginSpot(p) {
  W.phase = 'spot';
  $('spots').innerHTML = p.machines.map((m, i) => `<button type="button" class="spot" data-spot="${i}"><b>${i + 1}</b>
    <span class="s-part"><small class="px">CRANK</small>${esc(m.crank.name)}</span><span class="s-arrow">→</span><span class="s-part"><small class="px">GAUGE</small>${esc(m.gauge.name)}</span>
    <span class="s-out"></span></button>`).join('');
}
$('spots').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.blur(); pickSpot(Number(b.dataset.spot)); });
/** Crank machine i so the student sees what it does. */
function showSpot(i) {
  const m = W.round.machines[i], el = $('spots').querySelector(`[data-spot="${i}"]`), { pair } = m;
  el.classList.add(m.backwards ? 'sparks' : 'runs');
  el.querySelector('.s-out').textContent = m.backwards ? '⚡ the crank spins, the gauge is dead'
    : [0, 1, 2].map((k) => `${fmt(pair.xs[k], pair.cause.unit)} → ${fmt(pair.ys[k], pair.effect.unit)}`).join('  ·  ');
}
function pickSpot(i) {
  const p = W.round;
  if (W.phase !== 'spot' || busy() || !p.machines[i]) return;
  const res = checkSpot(p, i);
  showSpot(i);
  if (res.ok) { arcade.good(15); hubAudio.playCoinClink(); showLine(res.message); return rest(1.5); }
  miss(res, { answer: spotAnswer(p), retry: () => { W.phase = 'spot'; renderCtl(); }, show: () => { showSpot(p.bad); rest(1.2); } });
}

/* ================================================================== */
/* Build your own experiment                                           */
/* ================================================================== */
function beginBuild() {
  W.phase = 'build';
  setSocks('', '');
  renderTags();
}
function goBuild() {
  const p = W.round, res = checkBuild(p, W.crank === null ? null : p.tags[W.crank], W.gauge === null ? null : p.tags[W.gauge]);
  if (res.nudge) return showLine(res.message, true);
  if (res.ok) {                                       // a real experiment: now predict which way it goes, then crank it
    arcade.good(15); hubAudio.playCoinClink(); showLine(res.message);
    W.rounds.splice(W.ri + 1, 0, { ...genWay(Math.random, null, res.pair), backup: true, follow: true });
    return rest(1.1);
  }
  clearMachine();
  run({ moves: false }, () => miss(res, { answer: buildAnswer(p), retry: () => { W.crank = null; W.gauge = null; clearMachine(); beginBuild(); renderCtl(); } }));
}

/* ================================================================== */
/* Mystery gauge: test cranks, then name the gauge                     */
/* ================================================================== */
function beginMystery(p) {
  W.phase = 'test';
  W.testsLeft = p.tests;
  setSocks('', '? ? ?');
  renderMystery();
}
function renderMystery() {
  const p = W.round, naming = W.phase === 'name' || W.phase === 'hold' || W.phase === 'gap';
  const note = { moved: 'the gauge MOVED', nothing: 'nothing happened' };
  $('bench').innerHTML = `<div class="m-row">${p.pairs.map((x, i) => `<button type="button" class="tag test ${W.tested[i] || ''}" data-test="${i}" ${W.tested[i] || W.testsLeft <= 0 || naming ? 'disabled' : ''}>
      ${naming ? '' : `<b>${i + 1}</b>`}<small class="px">CRANK</small>${esc(x.cause.name)}<em>${W.tested[i] ? note[W.tested[i]] : W.testsLeft > 0 && !naming ? 'tap to test' : 'not tested'}</em></button>`).join('')}</div>
    ${naming ? `<div class="m-row">${p.options.map((name, i) => `<button type="button" class="tag opt" data-opt="${i}"><b>${i + 1}</b><small class="px">GAUGE?</small>${esc(name)}</button>`).join('')}</div>` : ''}`;
}
function testIt(i) {
  const p = W.round;
  if (W.phase !== 'test' || busy() || !p.pairs[i] || W.tested[i] || W.testsLeft <= 0) return;
  W.testsLeft -= 1;
  const moves = testCrank(p, i), pair = p.pairs[i];
  clearMachine();
  setSocks(pair.cause.name, '? ? ?', [pair.cause.letter, '?']);
  run({ pair, moves, units: false }, () => {
    W.tested[i] = moves ? 'moved' : 'nothing';
    hubAudio.playSelect();
    W.phase = W.testsLeft > 0 ? 'test' : 'name';
    renderMystery(); renderSign(); renderCtl();
  });
}
function toNaming() { if (W.phase !== 'test' || busy()) return; W.phase = 'name'; renderMystery(); renderSign(); renderCtl(); }
function pickOpt(i) {
  const p = W.round;
  if (W.phase !== 'name' || busy() || !p.options[i]) return;
  const res = checkMystery(p, i);
  if (res.ok) {
    arcade.good(20); hubAudio.playCoinClink(); showLine(res.message);
    setSocks(p.pair.cause.name, p.pair.effect.name, [p.pair.cause.letter, p.pair.effect.letter]);
    return rest(1.5);
  }
  miss(res, { answer: mysteryAnswer(p), retry: () => { W.phase = 'name'; renderCtl(); } });
}

/* ================================================================== */
/* The clock, keys, sign and the bottom bar                            */
/* ================================================================== */
function update(dt) {
  if (W.phase === 'idle' || busy()) return;
  if (W.phase === 'gap') { W.gapLeft -= dt; if (W.gapLeft <= 0) nextRound(); return; }
  if (W.phase === 'run') return updateRun(dt);
  if (W.phase === 'belt') updateBelt(dt);
}
const GO = { wire: goWire, build: goBuild, way: goWay, belt: () => decide(true), test: toNaming };
function go() { if (!busy() && GO[W.phase]) GO[W.phase](); }
function onKey(e) {
  const k = e.key;
  if (k === 'Enter') { e.preventDefault(); if (W.frozen) resume(); else go(); return; }
  if (W.frozen) return;
  if (/^[1-6]$/.test(k)) {
    const i = Number(k) - 1;
    if (W.phase === 'wire' || W.phase === 'build') pickTag(i);
    else if (W.phase === 'spot') pickSpot(i);
    else if (W.phase === 'test') testIt(i);
    else if (W.phase === 'name') pickOpt(i);
    return;
  }
  if (W.phase === 'way' && ['ArrowUp', 'ArrowDown', 'ArrowRight'].includes(k)) { e.preventDefault(); setWay({ ArrowUp: 'up', ArrowDown: 'down', ArrowRight: 'same' }[k]); }
  if (W.phase === 'belt' && k === 'ArrowRight') { e.preventDefault(); decide(false); }
  if (W.phase === 'build' && k === 'Backspace') { e.preventDefault(); clearSock(W.gauge !== null ? 'gauge' : 'crank'); }
}
$('goBtn').addEventListener('click', (e) => { e.currentTarget.blur(); go(); });
$('passBtn').addEventListener('click', (e) => { e.currentTarget.blur(); decide(false); });
$('resumeBtn').addEventListener('click', (e) => { e.currentTarget.blur(); resume(); });

function renderSign(isNew = false) {
  const r = W.round, at = `${W.ri + 1}/${W.rounds.length}`;
  let small = `MACHINE ${at} · THE GAUGE DEPENDS ON THE CRANK`, text = 'WHICH ONE DO YOU CHANGE? PUT IT ON THE CRANK';
  if (r.type === 'belt') { small = `TAG ${Math.min(W.belt.i + 1, r.tags.length)}/${r.tags.length} · PLUG IN WHAT WOULD CHANGE IT`; text = `WHAT COULD CHANGE ${r.effect.toUpperCase()}?`; }
  else if (r.type === 'way') { small = r.follow ? 'YOUR MACHINE · NOW PREDICT' : `MACHINE ${at} · PREDICT, THEN CRANK`; text = 'TURN THE CRANK UP: WHICH WAY WILL THE GAUGE GO?'; }
  else if (r.type === 'spot') { small = `INSPECTION ${at}`; text = 'ONE MACHINE IS WIRED BACKWARDS. TAP IT'; }
  else if (r.type === 'build') { small = `YOUR MACHINE ${at}`; text = 'BUILD AN EXPERIMENT: A CRANK TAG, THEN A GAUGE TAG'; }
  else if (r.type === 'mystery') {
    const naming = W.phase !== 'test' && W.phase !== 'run';
    small = naming ? 'MYSTERY GAUGE · THIS ONE COUNTS' : `MYSTERY GAUGE · ${W.testsLeft} FREE TEST${W.testsLeft === 1 ? '' : 'S'}`;
    text = naming ? 'NAME THE GAUGE: WHAT DEPENDS ON THAT CRANK?' : 'WHICH CRANK MOVES THE GAUGE? CHOOSE ONE TO TEST';
  }
  $('signSmall').textContent = small;
  $('signText').textContent = text;
  if (isNew) { const s = $('sign'); s.classList.remove('new'); void s.offsetWidth; s.classList.add('new'); }
}
function renderCtl() {
  const p = W.phase;
  const label = { wire: 'CRANK IT (ENTER)', build: 'CRANK IT (ENTER)', way: 'CRANK IT (ENTER)', belt: 'PLUG IT IN (ENTER)', test: 'I KNOW THE GAUGE (ENTER)' }[p];
  $('goBtn').classList.toggle('hidden', !label);
  $('goBtn').textContent = label || '';
  $('passBtn').classList.toggle('hidden', p !== 'belt');
  $('tip').textContent = { wire: 'Tap a tag (or press 1 or 2) to put it on the crank.', build: 'Tap two tags. Tap a socket to empty it.',
    way: '↑ up · ↓ down · → stays the same', belt: 'Tap the tag to plug it in.', spot: 'Tap a machine (or press 1, 2 or 3).',
    test: 'Tap a crank to test it (or press 1, 2 or 3).', name: 'Tap the name of the gauge (or press 1, 2 or 3).' }[p] || '';
  $('waveTag').textContent = W.rounds.length ? `ROUND ${W.ri + 1}/${W.rounds.length}` : '';
}

let last = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  update(dt * W.speed);
  requestAnimationFrame(frame);
}
// Something to look at behind the briefing.
setSocks('raffle tickets sold', 'money earned', ['t', 'm']);
$('gaugeFill').style.height = '50%';
requestAnimationFrame(frame);
