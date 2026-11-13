// Twin Bridges (Grade 7, Lesson 4-2: Generate Equivalent Expressions): the screen and the controls.
// The math is in bridges.js. The shared parts of an action game (briefing, top bar, ropes, hint card, report) are in
// shared/game/arcadeShell.js.
//
// The river is the playfield: a row of posts (values of the letter) and two bridges. Each bridge's plank at a post
// sits at the height its expression gives there, so twins lie on top of each other. A zone is a list of ROUNDS
// (see bridges.js): test, raft, build, chain. A hiker walks the posts to show what is true.
// All timing goes through update(), so the action stops cleanly whenever a banner, hint, help screen or mistake
// message is showing.
import { createArcade } from '../../../../shared/game/arcadeShell.js';
import {
  ZONES, POSTS, DIALS, genZone, genTest, genRaft, fmt, near, valueOf, plain, checkTest, checkRaft, checkBuild, buildAnswer,
  walkChain, checkSpan, chainAnswer,
} from './bridges.js';

const BOSS = ZONES.length - 1;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Everything about the round being played.
const W = {
  rounds: [], ri: 0, round: null, phase: 'idle',    // phase: idle, test, raft, build, span, run, hold, gap
  seen: [],                                         // the posts whose planks are showing
  testsLeft: 0,
  A: null, B: null,                                 // the two bridges on the river (B may be the student's own)
  m: 1, k: 0,                                       // build: the two dials
  raft: { i: 0, x: 0, misses: 0, wait: 0 }, extraRaft: false, extraTest: 0,
  walk: null, hiker: null, values: null, brokenFound: false,
  anim: null, tries: 0,
  gapLeft: 0, frozen: false, afterResume: null, speed: 1,
};

const HINTS = {
  one_test_value: 'One matching post is not proof. Two bridges can cross each other at a single post.<span class="mono">2(x + 2) and 3x + 3 agree at x = 1 only</span>Test a second, different post.',
  ignored_test: 'One post where the planks differ is enough to say NOT TWINS. Twins have to match at every post.',
  doubted_twins: 'If the planks match at two different posts, these bridges match everywhere.',
  first_term_only: 'The number outside multiplies EVERY term inside.<span class="mono">−3(x − 4) = −3x + 12</span>',
  sign_error: 'Carry the sign through each multiplication.<span class="mono">−3 × −4 = +12 and −3 × 4 = −12</span>',
  lost_negative: 'A minus sign belongs to the term after it, and travels with that term.<span class="mono">2x + 5 − 3x = 2x − 3x + 5</span>',
  combine_unlike: 'Only like terms combine: letter terms with letter terms, plain numbers with plain numbers.<span class="mono">2x + 3 is not 5x</span>',
  times_not_plus: 'Adding like terms adds the numbers in front: 2x + 3x = 5x. Multiplying comes from a number outside parentheses.',
  subtract_group: 'Subtracting a group subtracts everything in it.<span class="mono">7x − (2x + 5) = 7x − 2x − 5</span>',
  missed_twin: 'Twins can look different: the terms may be in another order or grouped another way. Check a post in your head.',
  number_part: 'Bridges that run side by side differ only in the number part.',
  x_part: 'Bridges that meet only at 0 differ in the part with the letter.',
  off: 'Do one piece at a time: first the part with the letter, then the plain number.',
  wrong_span: 'Walk a post and read the number under each line. The wrong step is where the number changes.',
};
const TIPS = {
  one_test_value: 'Equivalent expressions are equal for EVERY value, so one test value is not enough.',
  ignored_test: 'One value where two expressions differ proves they are not equivalent.',
  doubted_twins: 'Use the properties of operations to show two expressions are equivalent.',
  first_term_only: 'Distributive Property: multiply every term inside the parentheses.',
  sign_error: 'Watch the signs when you distribute a negative number.',
  lost_negative: 'Keep each sign with its term when you reorder.',
  combine_unlike: 'Combine like terms only.',
  times_not_plus: 'When combining like terms, add the coefficients.',
  subtract_group: 'Subtracting a group changes the sign of every term in it.',
  missed_twin: 'Reordering and regrouping terms gives an equivalent expression.',
  number_part: 'Check the constant term of your expression.',
  x_part: 'Check the coefficient of the variable.',
  off: 'Simplify one kind of term at a time.',
  wrong_span: 'Test a value in each line of the work to find the wrong step.',
};

const arcade = createArcade({
  zones: ZONES, startZone, stopZone, onKey, hints: HINTS, skillTips: TIPS, testName: '__bridges',
  perfectText: 'Every bridge matched: no mistakes to sharpen!',
  lifeLostText: (left) => (left > 0 ? `A ROPE SNAPPED! ${left} LEFT` : 'WASHED OUT'),
});
const { G, hubAudio } = arcade;
if (window.__bridges) window.__bridges.W = W;
const busy = () => W.frozen || arcade.paused();

/* ================================================================== */
/* Zones and rounds                                                    */
/* ================================================================== */
function startZone(z) {
  W.rounds = genZone(Math.random, z);
  W.extraRaft = false; W.extraTest = 0;
  startRound(0);
}
function stopZone() {
  Object.assign(W, { phase: 'idle', frozen: false, afterResume: null, anim: null });
  $('callout').classList.add('hidden');
}
function startRound(i) {
  const p = W.rounds[i];
  Object.assign(W, { ri: i, round: p, tries: 0, anim: null, frozen: false, afterResume: null, seen: [], hiker: null, values: null, brokenFound: false, m: 1, k: 0, walk: null, seenAll: false, peeked: [], walked: [] });
  if (G.zone === BOSS) arcade.setBossProgress((i / W.rounds.length) * 100);
  showLine(''); setStamp('');
  if (p.type === 'test') { W.phase = 'test'; W.A = p.A; W.B = p.B; W.testsLeft = p.tests; }
  else if (p.type === 'raft') { W.phase = 'raft'; W.A = p.target; W.B = null; W.seen = [...POSTS]; W.raft = { i: 0, x: RAFT_START, misses: 0, wait: 0 }; }
  else if (p.type === 'build') { W.phase = 'build'; W.A = p.A; W.B = null; W.testsLeft = p.tests || 0; }
  else { W.phase = 'span'; W.A = p.lines[0]; W.B = p.lines[p.lines.length - 1]; W.testsLeft = p.walks; }
  renderSign(true); renderExprs(); renderWork(); renderCtl(); draw();
}
function rest(seconds) { W.phase = 'gap'; W.gapLeft = seconds; renderWork(); renderCtl(); }
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
function showLine(text, off = false) { $('bline').textContent = text; $('bline').classList.toggle('off', off); }
function setStamp(text) { const s = $('stamp'); s.textContent = text || ''; s.classList.remove('show'); if (text) { void s.offsetWidth; s.classList.add('show'); } }
/** A mistake the student can try again once. After the second miss the answer is given and the round moves on. */
function miss(res, { answer, retry, show = null }) {
  W.tries += 1; W.phase = 'hold';
  arcade.bad(res.key, 25);
  if (W.phase === 'idle') return;                    // that was the last rope: the zone has stopped
  const moveOn = W.tries >= 2;
  if (moveOn && show) show();
  stopFor(res.message + (moveOn ? ` ${answer}` : ''), moveOn ? 'NEXT (ENTER)' : 'TRY AGAIN (ENTER)', moveOn ? endRound : retry);
  renderWork(); renderCtl();
}

/* ================================================================== */
/* The river: posts, planks, bridges and the hiker                     */
/* ================================================================== */
const PX = (x) => 90 + POSTS.indexOf(x) * 117;
/** The scale for heights, from every plank that could be shown this round. */
function scale() {
  const vals = [0];
  for (const E of [W.A, W.B]) if (E) for (const x of POSTS) vals.push(valueOf(E, x));
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  return (v) => 262 - ((v - lo) / span) * 228;
}
function draw() {
  const p = W.round, Y = scale(), out = [], hideA = p.type === 'build' && !W.seenAll, shown = (x) => W.seen.includes(x);
  out.push(`<rect class="water" x="0" y="${Y(0)}" width="1000" height="${300 - Y(0)}"/><line class="zero" x1="0" y1="${Y(0)}" x2="1000" y2="${Y(0)}"/><text class="zl" x="8" y="${Y(0) - 5}">0</text>`);
  for (const x of POSTS) out.push(`<g class="post ${shown(x) ? 'seen' : ''}" data-post="${x}"><rect x="${PX(x) - 52}" y="0" width="104" height="300" fill="transparent"/><line x1="${PX(x)}" y1="14" x2="${PX(x)}" y2="272"/><text class="pk" x="${PX(x) - 40}" y="16">${POSTS.indexOf(x) + 1}</text><text class="px2" x="${PX(x)}" y="294" text-anchor="middle">${esc(p.v)} = ${fmt(x)}</text></g>`);
  const deck = (E, cls, only) => { const pts = POSTS.filter((x) => shown(x) && (!only || only(x))); return pts.length > 1 ? `<polyline class="deck ${cls}" points="${pts.map((x) => `${PX(x)},${Y(valueOf(E, x))}`).join(' ')}"/>` : ''; };
  const aShown = (x) => !hideA || (p.hidden ? W.peeked.includes(x) : false) || W.walked.includes(x);
  if (W.A) out.push(deck(W.A, 'a', aShown));
  if (W.B) out.push(deck(W.B, 'b'));
  for (const x of POSTS) {
    if (!shown(x)) continue;
    const a = W.A && aShown(x) ? valueOf(W.A, x) : null, b = W.B ? valueOf(W.B, x) : null;
    if (a !== null && b !== null && near(a, b)) { out.push(`<line class="plank both" x1="${PX(x) - 26}" y1="${Y(a)}" x2="${PX(x) + 26}" y2="${Y(a)}"/><text class="pv both" x="${PX(x)}" y="${Y(a) - 9}" text-anchor="middle">${fmt(a)}</text>`); continue; }
    if (a !== null) out.push(`<line class="plank a" x1="${PX(x) - 26}" y1="${Y(a)}" x2="${PX(x) + 26}" y2="${Y(a)}"/><text class="pv a" x="${PX(x) - 30}" y="${Y(a) + 5}" text-anchor="end">${fmt(a)}</text>`);
    if (b !== null) out.push(`<line class="plank b" x1="${PX(x) - 26}" y1="${Y(b)}" x2="${PX(x) + 26}" y2="${Y(b)}"/><text class="pv b" x="${PX(x) + 30}" y="${Y(b) + 5}">${fmt(b)}</text>`);
  }
  if (W.hiker) out.push(`<circle class="hiker ${W.hiker.fell ? 'fell' : ''}" cx="${W.hiker.px + 21}" cy="${W.hiker.fell ? 266 : Y(W.hiker.v) - 14}" r="10"/>`);
  $('river').innerHTML = out.join('');
}
Object.assign(W, { seenAll: false, peeked: [], walked: [] });
$('river').addEventListener('pointerdown', (e) => { const g = e.target.closest('[data-post]'); if (g && !busy()) pickPost(Number(g.dataset.post)); });
/** The student chose a post: test it (test), peek at the hidden bridge (build), or walk the chain there (span). */
function pickPost(x) {
  const p = W.round;
  if (!POSTS.includes(x)) return;
  if (W.phase === 'test') {
    if (W.seen.includes(x)) return;
    if (W.testsLeft <= 0) return showLine('No tests left. Make the call: twins, or not?', true);
    W.testsLeft -= 1; W.seen.push(x); hubAudio.playStep();
    showLine(`${p.v} = ${fmt(x)}:   A = ${fmt(valueOf(p.A, x))}   B = ${fmt(valueOf(p.B, x))}`);
    renderSign(); draw();
  } else if (W.phase === 'build' && p.hidden) {
    if (W.peeked.includes(x)) return;
    if (W.testsLeft <= 0) return showLine('No more looks. Build the twin from the planks you can see.', true);
    W.testsLeft -= 1; W.peeked.push(x); W.seen.push(x); hubAudio.playStep();
    showLine(`${p.v} = ${fmt(x)}: the hidden bridge is at ${fmt(valueOf(p.A, x))}`);
    renderSign(); draw();
  } else if (W.phase === 'span' && !W.brokenFound) {
    if (W.testsLeft <= 0) return showLine('No walks left. Tap the step you think is wrong.', true);
    W.testsLeft -= 1; if (!W.seen.includes(x)) W.seen.push(x);
    const w = walkChain(p, x);
    W.values = { x, ...w }; hubAudio.playStep();
    showLine(w.falls < 0 ? `At ${p.v} = ${fmt(x)} every line gives ${fmt(w.values[0])}. A lucky post? Try another.` : `At ${p.v} = ${fmt(x)} the number changes going into line ${w.falls + 1}.`, w.falls >= 0);
    renderSign(); renderExprs(); draw();
  }
}

/* ================================================================== */
/* The hiker walks every post on bridge A (and B beside it)            */
/* ================================================================== */
function walkAll(done) {
  W.phase = 'run'; W.walked = []; W.seen = W.round.hidden ? [...W.peeked] : W.round.type === 'build' ? [] : W.seen;
  W.anim = { i: 0, t: 0, done, fell: false };
  hubAudio.playCartridgeLaunch(); renderWork(); renderCtl();
}
function updateRun(dt) {
  const A = W.anim;
  A.t += dt;
  if (A.t < 0.2) return;
  A.t = 0;
  if (A.fell) { W.seen = [...POSTS]; W.walked = [...POSTS]; W.seenAll = true; W.anim = null; draw(); return A.done(); }
  const x = POSTS[A.i], a = valueOf(W.A, x), split = W.B && !near(a, valueOf(W.B, x));
  if (!W.seen.includes(x)) W.seen.push(x);
  W.walked.push(x);
  W.hiker = { px: PX(x), v: a, fell: split };
  hubAudio.playStep(); draw();
  if (split) { A.fell = true; hubAudio.playLockRattle(); return; }
  A.i += 1;
  if (A.i >= POSTS.length) { W.anim = null; W.seenAll = true; A.done(); }
}

/* ================================================================== */
/* Test: call it                                                       */
/* ================================================================== */
function callTest(saysTwins) {
  const p = W.round;
  if (W.phase !== 'test' || busy()) return;
  const res = checkTest(p, W.seen, saysTwins);
  if (res.nudge) return showLine(res.message, true);
  walkAll(() => {
    if (res.ok) { arcade.good(15); hubAudio.playCoinClink(); showLine(res.message); return rest(1.4); }
    W.phase = 'hold';
    arcade.bad(res.key, 25);
    if (W.phase === 'idle') return;
    // The hiker has shown the answer, so there is no second try: another pair of the same kind comes next.
    stopFor(res.message, 'NEXT (ENTER)', () => {
      if (W.extraTest < 2) { W.extraTest += 1; W.rounds.splice(W.ri + 1, 0, genTest(Math.random, { eq: p.eq, lucky: p.lucky !== null })); }
      endRound();
    });
    renderWork(); renderCtl();
  });
}

/* ================================================================== */
/* Rafts: hook every twin                                              */
/* ================================================================== */
const RAFT_START = 0.1;
function updateRaft(dt) {
  const R = W.raft, p = W.round;
  if (R.wait > 0) { R.wait -= dt; if (R.wait <= 0) nextRaft(); return; }
  R.x += (dt * (1 - RAFT_START)) / p.seconds;
  if (G.practice) R.x = Math.min(R.x, 0.5);          // practice: the raft waits in the middle
  const el = $('raftTag'); if (el) el.style.left = `${R.x * 100}%`;
  if (R.x >= 1) decideRaft(false);
}
function decideRaft(hooked) {
  const p = W.round, R = W.raft;
  if (W.phase !== 'raft' || busy() || R.wait > 0) return;
  const res = checkRaft(p, R.i, hooked), el = $('raftTag');
  el.classList.add(hooked ? 'hooked' : 'gone');
  R.wait = res.quiet ? 0.3 : 0.9;
  if (hooked) { W.B = p.cards[R.i]; draw(); }        // the hooked raft is laid across the river: a twin lies on the bridge, a trap splits from it
  if (res.quiet) return hubAudio.playStep();
  if (res.ok) { arcade.good(10); hubAudio.playCoinClink(); setStamp(res.property); showLine(res.message); return; }
  R.misses += 1; showLine('');
  arcade.bad(res.key, 20);
  if (W.phase === 'idle') return;
  R.wait = 0.05;
  stopFor(res.message, 'CARRY ON (ENTER)', null);
}
function nextRaft() {
  const p = W.round, R = W.raft;
  W.B = null; R.i += 1; R.x = RAFT_START;
  if (R.i < p.cards.length) { renderWork(); renderSign(); draw(); return; }
  draw();
  if (R.misses < 2 || W.extraRaft) return rest(0.5);
  W.phase = 'hold'; renderWork(); renderCtl();        // two misses on one bridge: its twins are listed, and one more bridge comes (once a zone)
  stopFor(`The twins of ${p.target.text} were: ${p.cards.filter((c) => c.twin).map((c) => c.text).join('   and   ')}. Try one more bridge.`, 'NEXT (ENTER)', () => {
    W.extraRaft = true; W.rounds.splice(W.ri + 1, 0, genRaft(Math.random, p.form));
    endRound();
  });
}

/* ================================================================== */
/* Build: two dials, then the hiker                                    */
/* ================================================================== */
const canBuild = () => W.phase === 'build' && !busy();
function turn(which, by) {
  if (!canBuild()) return;
  const d = DIALS[which], v = Math.min(d.hi, Math.max(d.lo, W[which] + by));
  if (v === W[which]) return;
  W[which] = v; hubAudio.playStep(); showLine(''); renderExprs(); renderWork();
}
function goBuild() {
  const p = W.round;
  if (!canBuild()) return;
  const res = checkBuild(p, W.m, W.k);
  W.B = res.mine; W.seenAll = false;
  walkAll(() => {
    if (res.ok) { arcade.good(15); hubAudio.playCoinClink(); setStamp(res.property); showLine(res.message); return rest(1.5); }
    miss(res, { answer: p.type === 'chain' ? chainAnswer(p) : buildAnswer(p),
      retry: () => { W.phase = 'build'; W.B = null; W.hiker = null; W.seenAll = false; W.walked = []; W.seen = p.hidden ? [...W.peeked] : []; renderWork(); renderCtl(); draw(); },
      show: () => { W.m = p.A.m; W.k = p.A.k; W.B = { ...p.A, text: plain(p.A.m, p.A.k, p.v) }; W.hiker = null; renderExprs(); draw(); } });
  });
}

/* ================================================================== */
/* Chain: find the wrong step, then build the right last line          */
/* ================================================================== */
function pickSpan(i) {
  const p = W.round;
  if (W.phase !== 'span' || busy() || W.brokenFound || i < 1 || i >= p.lines.length) return;
  const res = checkSpan(p, i);
  const toRepair = () => { W.brokenFound = true; W.phase = 'build'; W.tries = 0; W.B = null; W.seen = []; W.walked = []; W.seenAll = false; W.values = null; renderSign(); renderExprs(); renderWork(); renderCtl(); draw(); };
  if (res.ok) { arcade.good(10); hubAudio.playCoinClink(); showLine(res.message); return toRepair(); }
  W.tries += 1; W.phase = 'hold';
  arcade.bad(res.key, 25);
  if (W.phase === 'idle') return;
  const moveOn = W.tries >= 2;
  stopFor(res.message + (moveOn ? ` ${chainAnswer(p)} Now build the right last line.` : ''), moveOn ? 'FIX IT (ENTER)' : 'TRY AGAIN (ENTER)', moveOn ? toRepair : () => { W.phase = 'span'; renderWork(); renderCtl(); });
  renderWork(); renderCtl();
}

/* ================================================================== */
/* The expressions above the river, and the controls below it          */
/* ================================================================== */
function renderExprs() {
  const p = W.round, card = (cls, label, text) => `<div class="ex ${cls}"><small class="px">${label}</small><span class="mono">${esc(text)}</span></div>`;
  if (p.type === 'test') $('exprs').innerHTML = card('a', 'BRIDGE A', p.A.text) + card('b', 'BRIDGE B', p.B.text);
  else if (p.type === 'raft') $('exprs').innerHTML = card('a wide', 'THE BRIDGE', p.target.text);
  else if (p.type === 'build') $('exprs').innerHTML = card('a', p.hidden ? 'THE HIDDEN BRIDGE' : 'BRIDGE A', p.A.text) + card('b', 'YOUR TWIN', plain(W.m, W.k, p.v));
  else {
    const val = (i) => (W.values ? `<em>${fmt(W.values.values[i])}</em>` : '<em></em>');
    $('exprs').innerHTML = p.lines.map((l, i) => `${i ? `<button type="button" class="step ${W.brokenFound && i === p.bad ? 'broken' : ''}" data-span="${i}"><b>${'ABC'[i - 1]}</b>=</button>` : ''}<div class="ex line ${W.brokenFound && i >= p.bad ? 'wrong' : ''}"><span class="mono">${esc(l.text)}</span>${val(i)}</div>`).join('')
      + (W.brokenFound ? `<div class="ex b fix"><small class="px">THE RIGHT LAST LINE</small><span class="mono">${esc(plain(W.m, W.k, p.v))}</span></div>` : '');
  }
}
$('exprs').addEventListener('click', (e) => { const b = e.target.closest('[data-span]'); if (!b) return; b.blur(); pickSpan(Number(b.dataset.span)); });
function renderWork() {
  const p = W.round, ph = W.phase;
  if (ph === 'test') $('work').innerHTML = '<button type="button" class="kbtn yes" data-call="twins">TWINS (T)</button><button type="button" class="kbtn no" data-call="not">NOT TWINS (N)</button>';
  else if (ph === 'raft') $('work').innerHTML = `<div class="stream"><button type="button" class="raft" id="raftTag" data-raft="1" style="left:${W.raft.x * 100}%">${esc(p.cards[W.raft.i].text)}</button></div>`;
  else if (ph === 'build') {
    const dial = (which, label, text) => `<div class="dial"><span class="px">${label}</span><button type="button" data-dial="${which}" data-by="-1">◀</button><span class="val">${esc(text)}</span><button type="button" data-dial="${which}" data-by="1">▶</button></div>`;
    $('work').innerHTML = dial('m', `${p.v.toUpperCase()}-PART`, `${fmt(W.m)}${p.v}`) + dial('k', 'NUMBER', W.k < 0 ? `− ${fmt(-W.k)}` : `+ ${fmt(W.k)}`);
  } else $('work').innerHTML = '';
}
$('work').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || busy()) return; b.blur();
  const d = b.dataset;
  if (d.call) callTest(d.call === 'twins'); else if (d.raft) decideRaft(true); else if (d.dial) turn(d.dial, Number(d.by));
});

/* ================================================================== */
/* The clock, keys, sign and the bottom bar                            */
/* ================================================================== */
function update(dt) {
  if (W.phase === 'idle' || busy()) return;
  if (W.phase === 'gap') { W.gapLeft -= dt; if (W.gapLeft <= 0) nextRound(); return; }
  if (W.phase === 'run') return updateRun(dt);
  if (W.phase === 'raft') updateRaft(dt);
}
function go() { if (busy()) return; if (W.phase === 'build') goBuild(); else if (W.phase === 'raft') decideRaft(true); }
function onKey(e) {
  const k = e.key;
  if (k === 'Enter') { e.preventDefault(); if (W.frozen) resume(); else go(); return; }
  if (W.frozen) return;
  if (/^[1-8]$/.test(k)) return pickPost(POSTS[Number(k) - 1]);
  if (W.phase === 'test' && /^[tTnN]$/.test(k)) return callTest(/[tT]/.test(k));
  if (W.phase === 'span' && /^[aAbBcC]$/.test(k)) return pickSpan('abc'.indexOf(k.toLowerCase()) + 1);
  if (W.phase === 'raft' && k === 'ArrowRight') { e.preventDefault(); return decideRaft(false); }
  if (W.phase === 'build' && k.startsWith('Arrow')) {
    e.preventDefault();
    const jump = e.shiftKey ? 5 : 1;
    if (k === 'ArrowLeft' || k === 'ArrowRight') turn('m', k === 'ArrowLeft' ? -1 : 1); else turn('k', (k === 'ArrowDown' ? -1 : 1) * jump);
  }
}
$('goBtn').addEventListener('click', (e) => { e.currentTarget.blur(); go(); });
$('passBtn').addEventListener('click', (e) => { e.currentTarget.blur(); decideRaft(false); });
$('resumeBtn').addEventListener('click', (e) => { e.currentTarget.blur(); resume(); });

function renderSign(isNew = false) {
  const p = W.round, at = `${W.ri + 1}/${W.rounds.length}`, left = (n, word) => `${n} ${word}${n === 1 ? '' : 'S'} LEFT`;
  let small = `BRIDGES ${at} · ${left(W.testsLeft, 'TEST')}`, text = 'TEST SOME POSTS, THEN CALL IT: TWINS, OR NOT?';
  if (p.type === 'test') { /* the wording above */ }
  else if (p.type === 'raft') { small = `RAFT ${Math.min(W.raft.i + 1, p.cards.length)}/${p.cards.length} · HOOK EVERY TWIN`; text = 'IS THIS RAFT A TWIN OF THE BRIDGE?'; }
  else if (p.type === 'build' && p.hidden) { small = `BRIDGES ${at} · ${left(W.testsLeft, 'LOOK')}`; text = 'THE BRIDGE IS HIDDEN. LOOK AT SOME POSTS, THEN BUILD ITS TWIN'; }
  else if (p.type === 'build') { small = `BRIDGES ${at} · BUILD THE TWIN`; text = 'SET THE DIALS SO YOUR BRIDGE MATCHES AT EVERY POST'; }
  else if (!W.brokenFound) { small = `BRIDGES ${at} · ${left(W.testsLeft, 'WALK')}`; text = 'ONE STEP IS WRONG. WALK A POST, THEN TAP THAT STEP'; }
  else { small = `BRIDGES ${at} · REPAIR`; text = 'NOW BUILD THE RIGHT LAST LINE'; }
  $('signSmall').textContent = small;
  $('signText').textContent = text;
  if (isNew) { const s = $('sign'); s.classList.remove('new'); void s.offsetWidth; s.classList.add('new'); }
}
function renderCtl() {
  const ph = W.phase;
  const label = { build: 'SEND THE HIKER (ENTER)', raft: 'HOOK IT (ENTER)' }[ph];
  $('goBtn').classList.toggle('hidden', !label);
  $('goBtn').textContent = label || '';
  $('passBtn').classList.toggle('hidden', ph !== 'raft');
  $('tip').textContent = { test: 'Tap a post (or press 1 to 8) to test it.', raft: 'Tap the raft to hook it.',
    build: W.round && W.round.hidden ? 'Tap a post to look · ← → the letter part · ↑ ↓ the number' : '← → the letter part · ↑ ↓ the number (Shift jumps 5)',
    span: 'Tap a post to walk it. Tap a step (A, B or C) to call it wrong.' }[ph] || '';
  $('waveTag').textContent = W.rounds.length ? `ROUND ${W.ri + 1}/${W.rounds.length}` : '';
}

let last = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  update(dt * W.speed);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
