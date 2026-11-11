// The game shell: everything every lesson game does the same way, written once.
//
//   zones and zone banners · the timer meter and 3 lives · fail screen and fast retry · scoring and first-try counts
//   right/wrong feedback, worked solution and backup problem · the end report and "skills to sharpen"
//   Start / Practice / help / sound / EXIT · messages to the town · keyboard for the briefing, fail screen and report
//
// A game only describes what is special about it (see the settings below) and draws its own problems.
// Every game page must have the shared ids used here: app, scene, prompt, controls, feedback, taskTag, zonePips, zoneName,
// meterFill, meterBox, lives, score, briefing, zoneButtons, startBtn, practiceBtn, banner, fail, retryBtn, report,
// reportStars, reportStats, reportZones, reportSkills, townBtn, againBtn, helpBtn, soundBtn, exitBtn, practiceTag,
// bossBar, bossFill (see any game's index.html).
import { hubAudio } from '../audio.js';

/**
 * Settings (all optional except zones, makeZone, makeBackup, workedSolution, showProblem):
 *   zones            [{ name, blurb }]                      five zones; the last one is the boss
 *   makeZone         (rnd, zone) => problems               the problems for one zone
 *   makeBackup       (rnd, problem) => problem             a fresh one of the same kind, after two misses
 *   workedSolution   (problem) => [lines]                  shown after two misses
 *   showProblem      (problem, isBackup) => void           the game draws the problem and its controls
 *   seconds          [s, s, s, s, s]                       seconds for the meter to fill, per zone (0 = no timer)
 *   isTimed          (problem) => bool                     does the meter run for this problem? (default: yes)
 *   meterFloor       8                                     the meter starts each timed problem at least this full
 *   wrongBump        34                                    meter added by a wrong answer
 *   rightRelief      30                                    meter taken off by a right answer (timed problems only)
 *   lifeLostText     (livesLeft) => 'A CRATE SLIPPED!'      banner when the meter fills
 *   onLifeLost       (livesLeft) => void                   scene effect when a life is lost
 *   backupText       'TRY A BACKUP PROBLEM (ENTER)'
 *   bossHitText      'HIT!'
 *   winDelay         (problem) => 1600                     ms before the next problem after a right answer
 *   pauseOnBanner    false                                 also pause the meter while a banner shows
 *   skillTips        { mistakeKey: 'tip' }                 for the report
 *   perfectText      'No mistakes to sharpen.'
 *   bossDefeated     (G) => bool                           what counts as beating the boss (default: played the boss zone)
 *   onKeyFirst       (event) => bool                       game keys checked before the shared ones (return true if used)
 *   onKey            (event) => void                       game keys while a problem is in play and not locked
 *   lettersAreInput  () => bool                            true while the game uses letter keys (so H and M are not help/sound)
 *   onRetry          () => void                            just before a zone restarts after the fail screen
 *   onStart          () => void                            just before the first zone starts
 *   testName         '__mygame'                            with ?test in the address, window[testName] = { G }
 */
export function createGame(cfg) {
  const $ = (id) => document.getElementById(id);
  const UI = {
    app: $('app'), scene: $('scene'), prompt: $('prompt'), controls: $('controls'), feedback: $('feedback'), taskTag: $('taskTag'),
    zonePips: $('zonePips'), zoneName: $('zoneName'), meterFill: $('meterFill'), meterBox: $('meterBox'), lives: $('lives'), score: $('score'),
    briefing: $('briefing'), zoneButtons: $('zoneButtons'), banner: $('banner'), fail: $('fail'), report: $('report'),
    practiceTag: $('practiceTag'), bossBar: $('bossBar'), bossFill: $('bossFill'),
  };
  const set = {
    seconds: [40, 40, 40, 40, 40], isTimed: () => true, meterFloor: 8, wrongBump: 34, rightRelief: 30,
    lifeLostText: (left) => (left > 0 ? 'A LIFE LOST!' : 'LAST LIFE GONE!'), onLifeLost: () => {},
    backupText: 'TRY A BACKUP PROBLEM (ENTER)', bossHitText: 'HIT!', winDelay: () => 1600, pauseOnBanner: false,
    skillTips: {}, perfectText: 'No mistakes to sharpen. Excellent!',
    bossDefeated: (g) => g.startZone <= 4 && g.zoneStats[4]?.total > 0,
    onKeyFirst: () => false, onKey: () => {}, lettersAreInput: () => false, onRetry: () => {}, onStart: () => {},
    ...cfg,
  };
  const IN_TOWN = window.parent !== window;            // inside a town's building (iframe) or opened directly
  const BOSS = set.zones.length - 1;

  /** The shared state. A game may keep its own extra fields on G too. */
  const G = {
    rnd: Math.random, practice: false, startZone: 0, zone: 0, queue: [], problem: null, attempts: 0, locked: false, isBackup: false,
    lives: 3, meter: 0, score: 0, firstTry: 0, answered: 0, mistakes: {}, zoneStats: [], bossHits: 0, started: 0, result: null,
    ticker: null, last: 0,
  };

  /* ---------------- HUD ---------------- */
  function renderHud() {
    UI.zonePips.innerHTML = set.zones.map((_, i) => `<div class="zone-pip ${i < G.zone ? 'done' : i === G.zone ? 'now' : ''}"></div>`).join('');
    UI.zoneName.textContent = `${G.zone + 1}. ${set.zones[G.zone].name}`;
    UI.lives.innerHTML = [0, 1, 2].map((i) => `<div class="crate ${i >= G.lives ? 'lost' : ''}"></div>`).join('');
    UI.score.textContent = G.score;
    UI.meterFill.style.width = `${Math.round(Math.min(100, G.meter))}%`;
    UI.meterBox.style.visibility = G.practice ? 'hidden' : 'visible';
    UI.practiceTag.classList.toggle('hidden', !G.practice);
    UI.bossBar.classList.toggle('hidden', G.zone !== BOSS);
    UI.bossFill.style.width = `${Math.max(0, 100 - G.bossHits * 20)}%`;
  }
  const timedNow = () => Boolean(set.seconds[G.zone]) && Boolean(G.problem) && set.isTimed(G.problem);

  /* ---------------- zones and problems ---------------- */
  function startZone(z, quick = false) {
    G.zone = z;
    G.queue = set.makeZone(G.rnd, z);
    G.zoneStats[z] = G.zoneStats[z] || { right: 0, total: 0 };
    if (z === BOSS) G.bossHits = 0;
    showBanner(`ZONE ${z + 1}: ${set.zones[z].name.toUpperCase()}`, set.zones[z].blurb, nextProblem, quick ? 600 : 1600);
  }
  function nextProblem() {
    if (!G.queue.length) return zoneCleared();
    loadProblem(G.queue.shift(), false);
  }
  function loadProblem(p, isBackup) {
    Object.assign(G, { problem: p, attempts: 0, locked: false, isBackup });
    if (!G.practice && timedNow()) G.meter = Math.max(G.meter, set.meterFloor);
    UI.feedback.classList.add('hidden');
    set.showProblem(p, isBackup);
    renderHud();
  }
  function zoneCleared() {
    if (G.zone >= BOSS) return finish();
    hubAudio.playLevelUp();
    G.meter = 0;
    startZone(G.zone + 1);
  }

  /* ---------------- right and wrong ---------------- */
  function showFeedback(good, message, steps, buttonText, onButton) {
    UI.feedback.className = `feedback ${good ? 'good' : 'bad'}`;
    UI.feedback.innerHTML = `${message}${steps ? `<ol class="steps">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>` : ''}${buttonText ? `<button type="button" id="fbBtn" class="px">${buttonText}</button>` : ''}`;
    if (onButton) $('fbBtn').addEventListener('click', onButton);
  }
  /** A right answer: score, meter relief, sound, then the next problem. */
  function win(res) {
    const p = G.problem;
    G.locked = true;
    const first = G.attempts === 0 && !G.isBackup;
    G.answered += 1;
    G.zoneStats[G.zone].total += 1;
    if (first) { G.firstTry += 1; G.zoneStats[G.zone].right += 1; }
    G.score += first ? 100 : 50;
    if (!G.practice && timedNow()) G.meter = Math.max(0, G.meter - set.rightRelief);
    hubAudio.playCoinClink();
    if (G.zone === BOSS) { G.bossHits += 1; flash(set.bossHitText); }
    showFeedback(true, res.message);
    renderHud();
    setTimeout(() => { if (G.problem === p) nextProblem(); }, set.winDelay(p));
  }
  /**
   * A wrong answer: hint, shake, meter. After two misses: the worked solution and a backup problem.
   *   retry    redraw for the next try, called after `delay` ms (if the student is still on this problem)
   *   lock     keep the controls locked until then (default: the student may try again at once)
   *   oneShot  a one-decision problem: show the work straight away and move on with NEXT
   */
  function miss(res, { retry = null, delay = 1300, lock = false, oneShot = false, nextText = 'NEXT (ENTER)' } = {}) {
    const p = G.problem;
    G.attempts += 1;
    G.mistakes[res.key] = (G.mistakes[res.key] || 0) + 1;
    hubAudio.playLockRattle();
    UI.app.classList.remove('shake'); void UI.app.offsetWidth; UI.app.classList.add('shake');
    if (!G.practice) bumpMeter(set.wrongBump);
    if (oneShot) {
      G.locked = true;
      G.answered += 1; G.zoneStats[G.zone].total += 1;
      showFeedback(false, res.message, set.workedSolution(p), nextText, () => nextProblem());
    } else if (G.attempts >= 2) {
      G.locked = true;
      showFeedback(false, res.message, set.workedSolution(p), set.backupText, () => loadProblem(set.makeBackup(G.rnd, p), true));
    } else {
      showFeedback(false, `${res.message} Try again!`);
      if (lock) G.locked = true;
      setTimeout(() => {
        if (G.problem !== p || G.lives <= 0) return;
        if (lock) G.locked = false;
        else if (G.locked) return;
        if (retry) retry();
      }, delay);
    }
    renderHud();
  }
  const settle = (res, opts) => (res.correct ? win(res) : miss(res, opts));

  /* ---------------- the meter and lives ---------------- */
  function bumpMeter(amount) {
    G.meter += amount;
    if (G.meter >= 100) loseLife();
    renderHud();
  }
  function loseLife() {
    G.meter = 25;
    G.lives -= 1;
    hubAudio.playLockRattle();
    set.onLifeLost(G.lives);
    flash(set.lifeLostText(G.lives));
    if (G.lives <= 0) {
      G.locked = true;
      setTimeout(() => UI.fail.classList.remove('hidden'), 900);
    }
  }
  function tick(now) {
    const dt = Math.min(0.25, (now - G.last) / 1000);
    G.last = now;
    const secs = set.seconds[G.zone];
    const paused = G.locked || !UI.briefing.classList.contains('hidden') || (set.pauseOnBanner && !UI.banner.classList.contains('hidden'));
    if (!G.practice && G.lives > 0 && !paused && timedNow()) {
      G.meter += (100 / secs) * dt;
      if (G.meter >= 100) { loseLife(); renderHud(); }
      UI.meterFill.style.width = `${Math.round(Math.min(100, G.meter))}%`;
    }
    G.ticker = requestAnimationFrame(tick);
  }

  /* ---------------- banners ---------------- */
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

  /* ---------------- the report ---------------- */
  const stars = (ratio) => (ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : 1);
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
    $('reportZones').innerHTML = set.zones.map((z, i) => {
      const s = G.zoneStats[i];
      if (!s || !s.total) return `<div class="rz">${z.name}<div class="s">skipped</div></div>`;
      const k = stars(s.right / s.total);
      return `<div class="rz">${z.name}<div class="s">${'★'.repeat(k)}${'☆'.repeat(3 - k)}</div></div>`;
    }).join('');
    const top = [...new Set(Object.entries(G.mistakes).sort((a, b) => b[1] - a[1]).map(([k]) => set.skillTips[k]).filter(Boolean))].slice(0, 3);
    $('reportSkills').innerHTML = top.length ? `Skills to sharpen:<ul>${top.map((t) => `<li>${t}</li>`).join('')}</ul>` : set.perfectText;
    UI.report.classList.remove('hidden');
    G.result = { score: G.firstTry, total, accuracy: acc, stars: st, bossDefeated: set.bossDefeated(G), practiceMode: G.practice };
  }

  /* ---------------- start, retry, exit ---------------- */
  function begin(practice) {
    hubAudio.unlockAudio();
    Object.assign(G, { practice, lives: 3, meter: 0, score: 0, firstTry: 0, answered: 0, mistakes: {}, zoneStats: [], bossHits: 0, started: Date.now() });
    UI.briefing.classList.add('hidden'); UI.report.classList.add('hidden'); UI.fail.classList.add('hidden');
    G.last = performance.now();
    cancelAnimationFrame(G.ticker);
    G.ticker = requestAnimationFrame(tick);
    set.onStart();
    startZone(G.startZone);
  }
  function retryZone() {
    UI.fail.classList.add('hidden');
    Object.assign(G, { lives: 3, meter: 0, locked: false });
    G.zoneStats[G.zone] = { right: 0, total: 0 };
    set.onRetry();
    startZone(G.zone, true);                           // short banner: back in play in under 2 seconds
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
  const updateSoundIcon = () => { $('soundBtn').textContent = hubAudio.isMuted ? '🔇' : '🔊'; };

  /* ---------------- wiring ---------------- */
  UI.zoneButtons.innerHTML = set.zones.map((z, i) => `<button type="button" class="zone-btn ${i === 0 ? 'on' : ''}" data-zone="${i}">${i + 1}. ${z.name}</button>`).join('');
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
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'HUB_INIT' && typeof e.data.payload?.isMuted === 'boolean' && e.data.payload.isMuted !== hubAudio.isMuted) {
      hubAudio.toggleMute(); updateSoundIcon();
    }
  });
  if (IN_TOWN) window.parent.postMessage({ type: 'CARTRIDGE_READY' }, '*');

  window.addEventListener('keydown', (e) => {
    const key = e.key;
    const typing = (e.target && e.target.tagName === 'INPUT') || set.lettersAreInput();
    if (key === 'M' || (key === 'm' && !typing)) { $('soundBtn').click(); return; }
    if (key === 'H' || (key === 'h' && !typing)) { $('helpBtn').click(); return; }
    if (!UI.briefing.classList.contains('hidden')) { if (key === 'Enter') { e.preventDefault(); begin(false); } return; }
    if (!UI.fail.classList.contains('hidden')) { if (key === 'Enter') { e.preventDefault(); retryZone(); } return; }
    if (!UI.report.classList.contains('hidden') || !G.problem) return;
    if (set.onKeyFirst(e)) return;
    const fb = $('fbBtn');
    if (fb && key === 'Enter') { e.preventDefault(); fb.click(); return; }
    if (G.locked) return;
    set.onKey(e);
  });
  renderHud();
  if (set.testName && new URLSearchParams(location.search).has('test')) window[set.testName] = { G };

  return { G, UI, $, settle, win, miss, showFeedback, flash, nextProblem, loadProblem, renderHud, hubAudio };
}
