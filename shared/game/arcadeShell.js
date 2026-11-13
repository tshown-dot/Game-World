// Arcade shell: the shared parts of an ACTION game, where the student plays continuously instead of answering
// one question at a time. (Question-and-answer games use gameShell.js; this one has no prompt or answer panel.)
//
// It runs: the briefing (start, practice, pick a zone), the top bar (zones, damage meter, 3 lives, score),
// zone banners, the hint card after repeated mistakes, the fail screen with a fast retry, the report, and the
// messages to the town. The game itself runs the action and tells the shell what happened:
//
//   const arcade = createArcade({
//     zones: [{ name, blurb }],               the last zone is the boss
//     startZone(zoneIndex)                    begin the action for a zone (called after the zone banner)
//     stopZone()                              stop the action (lives ran out, or the student left)
//     skillTips: { mistakeKey: 'tip' }        shown in the report under "Skills to sharpen"
//     hints: { mistakeKey: '<html>' }         a hint card, shown when the same mistake happens twice in a zone
//     perfectText, lifeLostText(livesLeft), failAfter (ms), onKey(event), testName
//   });
//   arcade.good(points)        the student got one right
//   arcade.bad(key, damage)    a mistake of kind `key`; damage fills the meter (100 = a life). Returns true if a hint card opened.
//   arcade.zoneCleared()       the zone's action is finished: go to the next zone, or the report
//   arcade.paused()            true while a banner, hint, briefing, fail screen or report covers the action
//   arcade.flash(text)         a short banner
//
// FORT MODE: the Golem Fort (a town boss) uses these games as its weapons. Opened with ?fort=<zone> (and &practice=1),
// a game plays only that zone: no zone choice, no report. When the zone is cleared, or the lives run out, it sends
// { type: 'FORT_WEAPON_DONE', payload: { won, good, bad, lives, practiceMode } } to the page that opened it.
//
// The page needs the same ids as the other games (see towns/topic-4-equation-valley/games/4-7-force-field/index.html):
// app, zonePips, zoneName, meterBox, meterFill, lives, score, practiceTag, bossBar, bossFill, briefing, zoneButtons,
// startBtn, practiceBtn, helpBtn, soundBtn, exitBtn, banner, hint, hintText, hintBtn, fail, retryBtn, report,
// reportStars, reportStats, reportZones, reportSkills, townBtn, againBtn.
import { hubAudio } from '../audio.js';

export function createArcade(cfg) {
  const $ = (id) => document.getElementById(id);
  const set = {
    skillTips: {}, hints: {}, perfectText: 'No mistakes to sharpen!', lifeLostText: (left) => (left > 0 ? 'A LIFE LOST!' : 'GAME OVER'),
    stopZone: () => {}, onKey: () => {}, testName: null, ...cfg,
  };
  const IN_TOWN = window.parent !== window;            // inside a town's building (iframe) or opened directly
  const BOSS = set.zones.length - 1;
  const QUERY = new URLSearchParams(location.search);
  const FORT = QUERY.has('fort') ? Math.min(BOSS, Math.max(0, Number(QUERY.get('fort')) || 0)) : null;   // fort mode: the one zone to play
  const START_PRACTICE = FORT !== null && QUERY.get('practice') === '1';
  const UI = {
    app: $('app'), zonePips: $('zonePips'), zoneName: $('zoneName'), meterBox: $('meterBox'), meterFill: $('meterFill'), lives: $('lives'), score: $('score'),
    practiceTag: $('practiceTag'), bossBar: $('bossBar'), bossFill: $('bossFill'), briefing: $('briefing'), zoneButtons: $('zoneButtons'),
    banner: $('banner'), hint: $('hint'), hintText: $('hintText'), fail: $('fail'), report: $('report'),
  };
  const G = {
    rnd: Math.random, practice: false, startZone: 0, zone: 0, lives: 3, meter: 0, score: 0, good: 0, bad: 0,
    mistakes: {}, zoneMistakes: {}, hinted: {}, zoneStats: [], bossProgress: 0, started: 0, result: null, playing: false,
  };

  function renderHud() {
    UI.zonePips.innerHTML = set.zones.map((_, i) => `<div class="zone-pip ${i < G.zone ? 'done' : i === G.zone ? 'now' : ''}"></div>`).join('');
    UI.zoneName.textContent = `${G.zone + 1}. ${set.zones[G.zone].name}`;
    UI.lives.innerHTML = [0, 1, 2].map((i) => `<div class="crate ${i >= G.lives ? 'lost' : ''}"></div>`).join('');
    UI.score.textContent = G.score;
    UI.meterFill.style.width = `${Math.round(Math.min(100, G.meter))}%`;
    UI.meterBox.style.visibility = G.practice ? 'hidden' : 'visible';
    UI.practiceTag.classList.toggle('hidden', !G.practice);
    UI.bossBar.classList.toggle('hidden', G.zone !== BOSS);
    UI.bossFill.style.width = `${Math.max(0, 100 - G.bossProgress)}%`;
  }
  const visible = (el) => !el.classList.contains('hidden');
  const paused = () => !G.playing || visible(UI.briefing) || visible(UI.banner) || visible(UI.hint) || visible(UI.fail) || visible(UI.report);

  /* ---------------- banners ---------------- */
  function flash(text) {
    UI.banner.innerHTML = text;
    UI.banner.classList.remove('hidden');
    clearTimeout(flash.t);
    flash.t = setTimeout(() => UI.banner.classList.add('hidden'), 900);
  }
  function showBanner(title, sub, then, ms) {
    UI.banner.innerHTML = `${title}<small>${sub}</small>`;
    UI.banner.classList.remove('hidden');
    hubAudio.playQuestOpen();
    clearTimeout(flash.t);
    flash.t = setTimeout(() => { UI.banner.classList.add('hidden'); then(); }, ms);
  }

  /* ---------------- zones ---------------- */
  function startZone(z, quick = false) {
    Object.assign(G, { zone: z, meter: 0, zoneMistakes: {}, hinted: {}, playing: true });
    G.zoneStats[z] = { right: 0, total: 0 };
    if (z === BOSS) G.bossProgress = 0;
    renderHud();
    showBanner(`ZONE ${z + 1}: ${set.zones[z].name.toUpperCase()}`, set.zones[z].blurb, () => set.startZone(z), quick ? 600 : 1500);
  }
  function zoneCleared() {
    if (FORT !== null) return fortDone(true);
    if (G.zone >= BOSS) return finish();
    hubAudio.playLevelUp();
    startZone(G.zone + 1);
  }

  /* ---------------- right, wrong, damage, lives ---------------- */
  function good(points = 10) {
    G.good += 1; G.score += points;
    G.zoneStats[G.zone].right += 1; G.zoneStats[G.zone].total += 1;
    if (!G.practice) G.meter = Math.max(0, G.meter - 3);
    renderHud();
  }
  /** A mistake. Returns true when it opened a hint card (the game should hold its action until arcade.paused() is false). */
  function bad(key, damage = 25) {
    G.bad += 1;
    G.zoneStats[G.zone].total += 1;
    G.mistakes[key] = (G.mistakes[key] || 0) + 1;
    G.zoneMistakes[key] = (G.zoneMistakes[key] || 0) + 1;
    hubAudio.playLockRattle();
    UI.app.classList.remove('shake'); void UI.app.offsetWidth; UI.app.classList.add('shake');
    if (!G.practice) {
      G.meter += damage;
      if (G.meter >= 100) loseLife();
    }
    renderHud();
    if (G.lives > 0 && G.zoneMistakes[key] >= 2 && !G.hinted[key] && set.hints[key]) {
      G.hinted[key] = true;
      UI.hintText.innerHTML = set.hints[key];
      UI.hint.classList.remove('hidden');
      return true;
    }
    return false;
  }
  function loseLife() {
    G.meter = 0;
    G.lives -= 1;
    flash(set.lifeLostText(G.lives));
    if (G.lives <= 0) {
      G.playing = false;
      set.stopZone();
      if (FORT !== null) setTimeout(() => fortDone(false), 900);
      else setTimeout(() => UI.fail.classList.remove('hidden'), 900);
    }
  }
  function setBossProgress(percent) { G.bossProgress = percent; renderHud(); }
  /** Fort mode: this weapon's one zone is over. Tell the fort how it went. */
  function fortDone(won) {
    if (G.result) return;
    G.playing = false;
    set.stopZone();
    G.result = { won, good: G.good, bad: G.bad, lives: G.lives, practiceMode: G.practice };
    clearTimeout(flash.t);
    UI.banner.innerHTML = won ? 'WEAPON CHARGED!<small>back to the golem</small>' : 'WEAPON BROKEN<small>back to the golem</small>';
    UI.banner.classList.remove('hidden');
    if (won) hubAudio.playLevelUp();
    window.parent.postMessage({ type: 'FORT_WEAPON_DONE', payload: G.result }, '*');
  }

  /* ---------------- the report ---------------- */
  const stars = (ratio) => (ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : 1);
  function finish() {
    G.playing = false;
    set.stopZone();
    hubAudio.playLevelUp();
    const total = Math.max(1, G.good + G.bad);
    const acc = Math.round((G.good / total) * 100);
    const st = stars(G.good / total);
    const mins = Math.max(1, Math.round((Date.now() - G.started) / 60000));
    $('reportStars').textContent = '★'.repeat(st) + '☆'.repeat(3 - st);
    $('reportStats').innerHTML = [['SCORE', G.score], ['RIGHT', `${G.good}/${total}`], ['ACCURACY', `${acc}%`], ['TIME', `${mins} min`]]
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
    G.result = { score: G.good, total, accuracy: acc, stars: st, bossDefeated: true, practiceMode: G.practice };
  }

  /* ---------------- start, retry, exit ---------------- */
  function begin(practice) {
    hubAudio.unlockAudio();
    set.stopZone();
    Object.assign(G, { practice, lives: 3, meter: 0, score: 0, good: 0, bad: 0, mistakes: {}, zoneStats: [], started: Date.now(), result: null });
    UI.briefing.classList.add('hidden'); UI.report.classList.add('hidden'); UI.fail.classList.add('hidden'); UI.hint.classList.add('hidden');
    startZone(G.startZone);
  }
  function retryZone() {
    UI.fail.classList.add('hidden');
    G.lives = 3;
    startZone(G.zone, true);                           // short banner: back in play in under 2 seconds
  }
  function exitToTown() {
    hubAudio.playSelect();
    G.playing = false;
    set.stopZone();
    if (IN_TOWN) window.parent.postMessage({ type: 'CARTRIDGE_EXIT_REQUEST' }, '*');
    else location.href = '../../../../index.html';
  }
  function backToTown() {
    if (IN_TOWN && G.result) window.parent.postMessage({ type: 'CARTRIDGE_COMPLETE', payload: G.result }, '*');
    else exitToTown();
  }
  const updateSoundIcon = () => { $('soundBtn').textContent = hubAudio.isMuted ? '🔇' : '🔊'; };
  const closeHint = () => { hubAudio.playSelect(); UI.hint.classList.add('hidden'); };

  /* ---------------- wiring ---------------- */
  UI.zoneButtons.innerHTML = set.zones.map((z, i) => `<button type="button" class="zone-btn ${i === 0 ? 'on' : ''}" data-zone="${i}">${i + 1}. ${z.name}</button>`).join('');
  UI.zoneButtons.querySelectorAll('[data-zone]').forEach((b) => b.addEventListener('click', () => {
    G.startZone = Number(b.dataset.zone);
    UI.zoneButtons.querySelectorAll('[data-zone]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('startBtn').addEventListener('click', () => begin(START_PRACTICE));
  $('practiceBtn').addEventListener('click', () => begin(true));
  $('retryBtn').addEventListener('click', retryZone);
  $('hintBtn').addEventListener('click', closeHint);
  $('againBtn').addEventListener('click', () => { UI.report.classList.add('hidden'); UI.briefing.classList.remove('hidden'); });
  $('townBtn').addEventListener('click', backToTown);
  $('exitBtn').addEventListener('click', exitToTown);
  $('helpBtn').addEventListener('click', () => { hubAudio.playSelect(); UI.briefing.classList.toggle('hidden'); });   // help pauses the action
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
    if (key === 'm' || key === 'M') { $('soundBtn').click(); return; }
    if (key === 'h' || key === 'H') { $('helpBtn').click(); return; }
    if (visible(UI.briefing)) { if (key === 'Enter') { e.preventDefault(); if (G.playing) $('helpBtn').click(); else begin(START_PRACTICE); } return; }
    if (visible(UI.fail)) { if (key === 'Enter') { e.preventDefault(); retryZone(); } return; }
    if (visible(UI.hint)) { if (key === 'Enter' || key === ' ') { e.preventDefault(); closeHint(); } return; }
    if (visible(UI.report) || !G.playing) return;
    set.onKey(e);
  });
  if (FORT !== null) {                                  // one zone only: no zone choice and no practice button (the fort decides)
    G.startZone = FORT; G.zone = FORT;
    UI.zoneButtons.parentElement.classList.add('hidden');
    $('practiceBtn').classList.add('hidden');
  }
  renderHud();
  if (set.testName && QUERY.has('test')) { window[set.testName] = { G }; if (FORT !== null) window.__weapon = { G, finish: fortDone }; }

  return { G, UI, $, good, bad, zoneCleared, paused, flash, renderHud, setBossProgress, hubAudio };
}
