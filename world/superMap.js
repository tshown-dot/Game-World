// Super Map: sign in once, see all 8 towns, walk between them and enter an open town.

import { progressStore } from '../shared/progressStore.js';
import { TOWNS, townStates } from '../shared/towns.js';
import { hubAudio } from '../shared/audio.js';
import { drawLand, townsSvg, roadSvg, roadCurve, cloudsLayer, heroSvg, TOWN_POINTS, BIOMES, MAP_W, MAP_H } from './superMapArt.js';

const $ = (id) => document.getElementById(id);
const WALK_SPEED = 380;   // map px per second

const ui = {
  login: $('loginScreen'), loginForm: $('loginForm'), codeInput: $('codeInput'), loginBtn: $('loginBtn'), loginError: $('loginError'),
  world: $('worldScreen'), land: $('landCanvas'), map: $('mapSvg'), loginLand: $('loginLandCanvas'),
  code: $('hudCode'), teacher: $('teacherBanner'), stars: $('myStarsBtn'), sound: $('soundBtn'), exit: $('exitBtn'),
  panelNum: $('panelNumber'), panelName: $('panelName'), panelTopic: $('panelTopic'), panelStatus: $('panelStatus'),
  enter: $('enterBtn'), prev: $('prevBtn'), next: $('nextBtn'), toast: $('toast'),
  modal: $('progressModal'), closeModal: $('closeProgressBtn'), progCode: $('progressCode'), progSummary: $('progressSummary'),
  progList: $('progressList'), progSync: $('progressSync'),
};

const game = { code: null, progress: null, open: [], fullAccess: false, entries: [], current: 3, walking: false, raf: null, heroPos: null };

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
  ui.loginBtn.disabled = true;
  let res;
  try { res = await progressStore.loadStudent(code); } finally { ui.loginBtn.disabled = false; }
  if (!res.ok) {
    hubAudio.playLockRattle();
    progressStore.clearActiveCode();
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

function signOut() {
  hubAudio.playSelect();
  cancelWalk();
  progressStore.clearActiveCode();
  Object.assign(game, { code: null, progress: null, open: [], fullAccess: false });
  ui.world.classList.add('hidden');
  ui.modal.classList.add('hidden');
  ui.login.classList.remove('hidden');
  ui.codeInput.value = '';
  ui.codeInput.focus();
}

/* ---------------- world ---------------- */

function stateMap() {
  return Object.fromEntries(game.entries.map((e) => [e.town.number, e.state]));
}

function buildWorld() {
  game.entries = townStates({ progress: game.progress, open: game.open, fullAccess: game.fullAccess });
  const fromId = new URLSearchParams(location.search).get('from');
  const fromTown = TOWNS.find((t) => t.id === fromId);
  const lastOpen = [...game.entries].reverse().find((e) => e.state === 'open');
  game.current = fromTown ? fromTown.number : (lastOpen ? lastOpen.town.number : 3);
  game.heroPos = { ...TOWN_POINTS[game.current] };
  drawLand(ui.land, TOWNS, stateMap());
  render();
  ui.code.textContent = game.code;
  ui.teacher.classList.toggle('hidden', !game.fullAccess);
}

function render() {
  ui.map.innerHTML = `
    ${roadSvg(TOWNS, stateMap())}
    ${townsSvg(game.entries, game.current)}
    <g id="hero" transform="translate(${game.heroPos.x} ${game.heroPos.y})">${heroSvg()}</g>
    <g pointer-events="none">${cloudsLayer()}</g>`;
  updatePanel();
}

function entryFor(n) { return game.entries.find((e) => e.town.number === n); }

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
  if (target < 1 || target > TOWNS.length || target === game.current || game.walking) return;
  const step = target > game.current ? 1 : -1;
  const legs = [];
  for (let n = game.current; n !== target; n += step) legs.push([TOWN_POINTS[n], TOWN_POINTS[n + step], n + step]);
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
        game.heroPos = { ...TOWN_POINTS[game.current] };
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
  const built = game.entries.filter((e) => e.town.built);
  const totalStars = game.entries.reduce((s, e) => s + e.summary.stars, 0);
  const bosses = game.entries.filter((e) => e.summary.bossBeaten).length;
  ui.progCode.textContent = `Code ${game.code}`;
  ui.progSummary.innerHTML = [
    ['LEVEL', p.level || 1], ['TOWNS BEATEN', `${bosses}/${built.length}`], ['STARS', totalStars], ['COINS', (p.coins ?? 50).toLocaleString()],
  ].map(([l, v]) => `<div class="progress-stat"><div class="px stat-label">${l}</div><div class="px stat-value">${v}</div></div>`).join('');
  ui.progList.innerHTML = game.entries.map(({ town, state, summary }) => {
    const name = town.name;
    const detail = !town.built ? 'Coming soon'
      : state === 'locked' ? 'Locked'
      : summary.played ? `${summary.cleared}/${town.stageCount} stages${summary.bossBeaten ? ' · boss beaten' : ''}`
      : 'Not started';
    return `<div class="progress-row ${summary.bossBeaten ? 'done' : ''} ${town.built ? '' : 'soon'}">
      <div class="town-num px">${town.number}</div>
      <div class="row-main"><div class="px row-name">${name.toUpperCase()}</div><div class="row-detail">${detail}</div></div>
      <div class="px row-stars">★ ${summary.stars}</div>
    </div>`;
  }).join('');
  const waiting = progressStore.pendingCount(game.code);
  ui.progSync.textContent = waiting === 0
    ? 'Saved. Your teacher can see your progress.'
    : 'Saved on this Chromebook. It will send to your teacher when the internet is back.';
  ui.modal.classList.remove('hidden');
}

/* ---------------- wiring ---------------- */

function updateSoundIcon() { ui.sound.textContent = hubAudio.isMuted ? '🔇' : '🔊'; }

function init() {
  // Title-screen backdrop: the world, all greyed out until sign-in.
  drawLand(ui.loginLand, TOWNS, Object.fromEntries(TOWNS.map((t) => [t.number, 'soon'])));
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
  });
  window.addEventListener('online', () => { if (game.code) progressStore.flushQueue(game.code); });

  const remembered = progressStore.getActiveCode();
  if (remembered) {
    ui.codeInput.value = remembered;
    signIn(remembered);
  } else {
    ui.codeInput.focus();
  }
}

init();
export { MAP_W, MAP_H };
