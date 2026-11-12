// Super Map: sign in once, see the 8 towns of a grade, walk between them and enter an open town.
// There are two maps: Grade 6, and the Grade 7 Isles for students whose teacher has opened a Grade 7 town.
// The sail sign (top left) switches between them; it only shows for students who can enter a Grade 7 town.

import { progressStore } from '../shared/progressStore.js';
import { TOWNS, townStates, townsOf } from '../shared/towns.js';
import { hubAudio } from '../shared/audio.js';
import { startStation } from '../shared/station.js';
import { drawLand, townsSvg, roadSvg, roadCurve, cloudsLayer, heroSvg, pointOf, BIOMES, MAP_W, MAP_H } from './superMapArt.js';

const $ = (id) => document.getElementById(id);
const WALK_SPEED = 380;   // map px per second

const ui = {
  login: $('loginScreen'), loginForm: $('loginForm'), codeInput: $('codeInput'), loginBtn: $('loginBtn'), loginError: $('loginError'),
  world: $('worldScreen'), land: $('landCanvas'), map: $('mapSvg'), loginLand: $('loginLandCanvas'),
  code: $('hudCode'), teacher: $('teacherBanner'), stars: $('myStarsBtn'), sound: $('soundBtn'), exit: $('exitBtn'),
  panelNum: $('panelNumber'), panelName: $('panelName'), panelTopic: $('panelTopic'), panelStatus: $('panelStatus'),
  enter: $('enterBtn'), prev: $('prevBtn'), next: $('nextBtn'), toast: $('toast'),
  modal: $('progressModal'), closeModal: $('closeProgressBtn'), progCode: $('progressCode'), progSummary: $('progressSummary'),
  progList: $('progressList'), progSync: $('progressSync'), sail: $('sailBtn'), signTop: $('signTop'),
};

// Station Mode (?station): no sign-in, everything open, nothing saved to the sheet. See shared/station.js.
const station = startStation('world');
if (station && station.scope !== 'world') {          // a town-only station tab: send it back to its town
  const town = TOWNS.find((t) => t.id === station.scope);
  if (town && town.url) location.replace(town.url);
}

const game = { code: null, progress: null, open: [], fullAccess: false, entries: [], grade: 6, current: 3, walking: false, raf: null, heroPos: null };
const GRADE_KEY = 'gw_map_grade';                      // which map this Chromebook was last on

/** The towns (and their states) of the map on screen. Town numbers 1-8 are only unique inside one grade. */
const shown = () => game.entries.filter((e) => e.town.grade === game.grade);
const shownTowns = () => townsOf(game.grade);
const pt = (n) => pointOf(shownTowns()[n - 1]);
/** True when this student can enter at least one Grade 7 town (teacher tick, full access, or already played). */
const canSail = () => game.entries.some((e) => e.town.grade === 7 && e.state === 'open');

/* ---------------- sign in ---------------- */

function showLoginError(msg) {
  ui.loginError.textContent = msg;
  ui.loginError.classList.remove('hidden');
  clearTimeout(showLoginError.t);
  showLoginError.t = setTimeout(() => ui.loginError.classList.add('hidden'), 4500);
}

async function signIn(raw) {
  const code = progressStore.normalizeCode(raw);
  if (!code) {
    showLoginError('Your code has 6 letters and numbers, like K7M2QX. Check your sticky note.');
    return;
  }
  setSigningIn(true);
  let res;
  // A code this Chromebook already knows opens at once from the device copy; the sheet is checked behind it.
  try { res = await progressStore.loadStudent(code, { fast: true, onFresh: (fresh) => applyFresh(code, fresh) }); } finally { setSigningIn(false); }
  if (!res.ok) {
    hubAudio.playLockRattle();
    progressStore.clearActiveCode();
    ui.world.classList.add('hidden');
    ui.login.classList.remove('hidden');
    showLoginError(res.error === 'bad_code'
      ? "That code isn't in the system. Check your sticky note or ask your teacher."
      : "Can't reach the server. Connect to the internet to sign in on this device the first time.");
    return;
  }
  hubAudio.playSelect();
  progressStore.setActiveCode(code);
  Object.assign(game, { code, progress: res.progress, open: res.open || [], fullAccess: res.fullAccess });
  ui.login.classList.add('hidden');
  ui.world.classList.remove('hidden');
  buildWorld();
}

/** The button says "SIGNING IN…" while the sheet is being asked (first sign-in on a device can take a few seconds). */
function setSigningIn(on) {
  ui.loginBtn.disabled = on;
  ui.codeInput.readOnly = on;
  ui.loginBtn.querySelector('span').textContent = on ? 'SIGNING IN…' : '▶ PRESS START';
}

/** The sheet answered in the background: pick up teacher ticks, or sign out if the code was removed. */
function applyFresh(code, fresh) {
  if (game.code !== code) return;
  if (!fresh.ok) {
    if (fresh.error === 'bad_code') { signOut(); showLoginError("That code isn't in the system any more. Ask your teacher."); }
    return;                                              // offline: keep playing from the device copy
  }
  const before = JSON.stringify([game.open, game.fullAccess, game.progress && game.progress.savedAt]);
  Object.assign(game, { progress: fresh.progress, open: fresh.open || [], fullAccess: fresh.fullAccess });
  if (JSON.stringify([game.open, game.fullAccess, game.progress && game.progress.savedAt]) !== before) refreshWorld();
}
function refreshWorld() {
  if (!game.code) return;
  if (game.walking) { setTimeout(refreshWorld, 300); return; }
  game.entries = townStates({ progress: game.progress, open: game.open, fullAccess: game.fullAccess });
  if (game.grade === 7 && !canSail()) { setGrade(6); return; }       // the teacher un-ticked Grade 7
  drawLand(ui.land, shownTowns(), stateMap());
  render();
  ui.teacher.classList.toggle('hidden', !game.fullAccess);
}

function signOut() {
  hubAudio.playSelect();
  if (station) { location.href = 'index.html'; return; }   // a station has no sign-in: EXIT just starts the map again
  cancelWalk();
  progressStore.clearActiveCode();
  localStorage.removeItem(GRADE_KEY);
  Object.assign(game, { code: null, progress: null, open: [], fullAccess: false, grade: 6 });
  ui.world.classList.add('hidden');
  ui.modal.classList.add('hidden');
  ui.login.classList.remove('hidden');
  ui.codeInput.value = '';
  ui.codeInput.focus();
}

/* ---------------- world ---------------- */

function stateMap() {
  return Object.fromEntries(shown().map((e) => [e.town.number, e.state]));
}

function buildWorld() {
  game.entries = townStates({ progress: game.progress, open: game.open, fullAccess: game.fullAccess });
  const fromId = new URLSearchParams(location.search).get('from');
  const fromTown = TOWNS.find((t) => t.id === fromId);
  // Which map: the one the student just came from, else the one this Chromebook was last on, else Grade 6.
  const wanted = fromTown ? fromTown.grade : Number(localStorage.getItem(GRADE_KEY)) || 6;
  game.grade = wanted === 7 && canSail() ? 7 : 6;
  placeHero(fromTown && fromTown.grade === game.grade ? fromTown.number : null);
  drawMap();
  ui.code.textContent = game.code;
  ui.teacher.classList.toggle('hidden', !game.fullAccess);
  if (station) ui.teacher.textContent = 'STATION: ALL OPEN';
}

/** Puts the hero at a town on the map on screen: the given one, else the furthest open town. */
function placeHero(number) {
  const lastOpen = [...shown()].reverse().find((e) => e.state === 'open');
  game.current = number || (lastOpen ? lastOpen.town.number : game.grade === 6 ? 3 : 4);
  game.heroPos = { ...pt(game.current) };
}
function drawMap() {
  drawLand(ui.land, shownTowns(), stateMap());
  render();
}
/** Sails to the other map (only offered when a Grade 7 town is open for this student). */
function setGrade(grade) {
  if (game.walking || grade === game.grade || (grade === 7 && !canSail())) return;
  game.grade = grade;
  localStorage.setItem(GRADE_KEY, String(grade));
  history.replaceState(null, '', location.pathname);      // forget "?from=<town>", so a reload stays on this map
  hubAudio.playCartridgeLaunch();
  placeHero(null);
  drawMap();
}

function render() {
  ui.sail.classList.toggle('hidden', !canSail());
  ui.sail.querySelector('span').textContent = game.grade === 6 ? '⛵ SAIL TO THE GRADE 7 ISLES' : '⛵ SAIL BACK TO GRADE 6';
  ui.signTop.textContent = game.grade === 6 ? '6TH GRADE MATH' : '7TH GRADE MATH';
  ui.map.innerHTML = `
    ${roadSvg(shownTowns(), stateMap())}
    ${townsSvg(shown(), game.current)}
    <g id="hero" transform="translate(${game.heroPos.x} ${game.heroPos.y})">${heroSvg()}</g>
    <g pointer-events="none">${cloudsLayer()}</g>`;
  updatePanel();
}

function entryFor(n) { return shown().find((e) => e.town.number === n); }

function updatePanel() {
  const e = entryFor(game.current);
  if (!e) return;
  const { town, state, reason, summary } = e;
  ui.panelNum.textContent = town.number;
  ui.panelName.textContent = town.name;
  ui.panelTopic.textContent = town.topic === 'To be decided' ? `${BIOMES[town.biome].label} · topic to be decided` : town.topic;
  if (state === 'open') {
    ui.panelStatus.textContent = summary.played
      ? `${summary.cleared}/${town.stageCount} stages · ${summary.stars} stars${summary.bossBeaten ? ' · boss beaten!' : ''}`
      : 'Open! Press ENTER or A to go in.';
  } else {
    ui.panelStatus.textContent = reason;
  }
  ui.panelStatus.className = `panel-status ${state}`;
  ui.enter.disabled = state !== 'open';
  ui.enter.querySelector('span').textContent = state === 'open' ? '▶ ENTER TOWN' : state === 'locked' ? 'LOCKED' : 'COMING SOON';
  ui.map.querySelectorAll('.nameplate').forEach((el) => el.classList.remove('is-current'));
  ui.map.querySelector(`.town-hit[data-town="${game.current}"] .nameplate`)?.classList.add('is-current');
}

function toast(msg) {
  ui.toast.textContent = msg;
  ui.toast.classList.remove('hidden');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => ui.toast.classList.add('hidden'), 2600);
}

function enterTown() {
  if (game.walking) return;
  const e = entryFor(game.current);
  if (!e) return;
  if (e.state !== 'open') {
    hubAudio.playLockRattle();
    toast(e.state === 'soon' ? `${e.town.name} is coming soon!` : e.reason);
    return;
  }
  hubAudio.playCartridgeLaunch();
  ui.world.classList.add('leaving');
  setTimeout(() => { location.href = e.town.url; }, 350);
}

/* ---------------- walking ---------------- */

function cancelWalk() {
  if (game.raf) cancelAnimationFrame(game.raf);
  game.raf = null;
  game.walking = false;
  $('hero')?.classList.remove('walking');
}

function walkTo(target) {
  if (target < 1 || target > shownTowns().length || target === game.current || game.walking) return;
  const step = target > game.current ? 1 : -1;
  const legs = [];
  for (let n = game.current; n !== target; n += step) legs.push([pt(n), pt(n + step), n + step]);
  game.walking = true;
  const hero = $('hero');
  hero.classList.add('walking');
  const facing = hero.querySelector('.hero-facing');
  let leg = 0, t = 0, last = performance.now();
  const curve = () => roadCurve(legs[leg][0], legs[leg][1]);
  let along = curve();
  const length = () => Math.hypot(legs[leg][1].x - legs[leg][0].x, legs[leg][1].y - legs[leg][0].y) * 1.05;
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += (WALK_SPEED * dt) / length();
    if (t >= 1) {
      game.current = legs[leg][2];
      hubAudio.playStep();
      leg += 1; t = 0;
      if (leg >= legs.length) {
        game.heroPos = { ...pt(game.current) };
        hero.setAttribute('transform', `translate(${game.heroPos.x} ${game.heroPos.y})`);
        cancelWalk();
        updatePanel();
        return;
      }
      along = curve();
      updatePanel();
    }
    const p = along(t);
    if (facing) facing.style.transform = legs[leg][1].x < legs[leg][0].x ? 'scaleX(-1)' : '';
    game.heroPos = p;
    hero.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    game.raf = requestAnimationFrame(tick);
  };
  game.raf = requestAnimationFrame(tick);
}

/* ---------------- My Progress ---------------- */

function openProgress() {
  const p = game.progress || {};
  // Grade 6 towns for everyone; the Grade 7 Isles are listed only for students who can sail there.
  const listed = game.entries.filter((e) => e.town.grade === 6 || canSail());
  const built = listed.filter((e) => e.town.built);
  const totalStars = listed.reduce((s, e) => s + e.summary.stars, 0);
  const bosses = listed.filter((e) => e.summary.bossBeaten).length;
  ui.progCode.textContent = `Code ${game.code}`;
  ui.progSummary.innerHTML = [
    ['LEVEL', p.level || 1], ['TOWNS BEATEN', `${bosses}/${built.length}`], ['STARS', totalStars], ['COINS', (p.coins ?? 50).toLocaleString()],
  ].map(([l, v]) => `<div class="progress-stat"><div class="px stat-label">${l}</div><div class="px stat-value">${v}</div></div>`).join('');
  ui.progList.innerHTML = listed.map(({ town, state, summary }) => {
    const name = town.name;
    const heading = town.grade === 7 && town.number === 1 ? '<div class="px progress-grade">GRADE 7 ISLES</div>' : '';
    const detail = !town.built ? 'Coming soon'
      : state === 'locked' ? 'Locked'
      : summary.played ? `${summary.cleared}/${town.stageCount} stages${summary.bossBeaten ? ' · boss beaten' : ''}`
      : 'Not started';
    return `${heading}<div class="progress-row ${summary.bossBeaten ? 'done' : ''} ${town.built ? '' : 'soon'}">
      <div class="town-num px">${town.number}</div>
      <div class="row-main"><div class="px row-name">${name.toUpperCase()}</div><div class="row-detail">${detail}</div></div>
      <div class="px row-stars">★ ${summary.stars}</div>
    </div>`;
  }).join('');
  const waiting = progressStore.pendingCount(game.code);
  ui.progSync.textContent = station ? 'Station mode: stars last until this tab is closed. Nothing is saved.' : waiting === 0
    ? 'Saved. Your teacher can see your progress.'
    : 'Saved on this Chromebook. It will send to your teacher when the internet is back.';
  ui.modal.classList.remove('hidden');
}

/* ---------------- wiring ---------------- */

function updateSoundIcon() { ui.sound.textContent = hubAudio.isMuted ? '🔇' : '🔊'; }

function init() {
  // Title-screen backdrop: the world, all greyed out until sign-in.
  drawLand(ui.loginLand, townsOf(6), Object.fromEntries(townsOf(6).map((t) => [t.number, 'soon'])));
  updateSoundIcon();

  const unlock = () => { hubAudio.unlockAudio(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  ui.loginForm.addEventListener('submit', (e) => { e.preventDefault(); signIn(ui.codeInput.value); });
  ui.exit.addEventListener('click', signOut);
  ui.sound.addEventListener('click', () => { hubAudio.toggleMute(); updateSoundIcon(); if (!hubAudio.isMuted) hubAudio.playSelect(); });
  ui.stars.addEventListener('click', () => { hubAudio.playSelect(); openProgress(); });
  ui.closeModal.addEventListener('click', () => { hubAudio.playSelect(); ui.modal.classList.add('hidden'); });
  ui.enter.addEventListener('click', enterTown);
  ui.sail.addEventListener('click', () => setGrade(game.grade === 6 ? 7 : 6));
  ui.prev.addEventListener('click', () => walkTo(game.current - 1));
  ui.next.addEventListener('click', () => walkTo(game.current + 1));
  ui.map.addEventListener('click', (e) => {
    const hit = e.target.closest('[data-town]');
    if (!hit) return;
    const n = Number(hit.getAttribute('data-town'));
    if (n === game.current) enterTown(); else walkTo(n);
  });
  window.addEventListener('keydown', (e) => {
    if (!ui.login.classList.contains('hidden')) return;
    if (!ui.modal.classList.contains('hidden')) { if (e.key === 'Escape') ui.closeModal.click(); return; }
    if (['ArrowRight', 'ArrowDown', 'd', 'D', 's', 'S'].includes(e.key)) { e.preventDefault(); walkTo(game.current + 1); }
    else if (['ArrowLeft', 'ArrowUp', 'a', 'A', 'w', 'W'].includes(e.key)) { e.preventDefault(); walkTo(game.current - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enterTown(); }
    else if (e.key === 'g' || e.key === 'G') setGrade(game.grade === 6 ? 7 : 6);
  });
  window.addEventListener('online', () => { if (game.code) progressStore.flushQueue(game.code); });

  const remembered = progressStore.getActiveCode();
  if (remembered) {
    ui.codeInput.value = remembered;
    if (progressStore.hasDeviceCopy(remembered)) {    // coming back from a town: go straight to the map
      ui.login.classList.add('hidden');
      ui.world.classList.remove('hidden');
    }
    signIn(remembered);
  } else {
    ui.codeInput.focus();
  }
}

init();
export { MAP_W, MAP_H };
