// Shared town engine: the walkable town map, building briefings, launching games, the victory screen,
// My Progress, and the "town locked" screen. A town supplies its art and building list; see
// towns/topic-4-equation-valley/js/valley.js for an example.

import { progressStore } from '../progressStore.js';
import { hubAudio } from '../audio.js';
import { CartridgeHarness } from '../cartridgeHarness.js';
import { heroSvg, nameplateSvg, PALETTE } from '../art.js';
import { TownState } from './townState.js';
import { startStation, lockedToTown } from '../station.js';

const K = PALETTE.ink;
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${K}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const WALK_SPEED = 360;
const $ = (id) => document.getElementById(id);
const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

/**
 * config = {
 *   townId: 'topic_4', label: 'topic-4', number: 4, name: 'Equation Valley', topic: 'Topic 4: ...',
 *   superMapUrl: '../../index.html',
 *   stages: [{ id, lessonCode, title, subtitle, description, built, url, coords: {x, y}, building, xpReward, coinsReward, isBoss,
 *              via }],   via (optional): corner points on the road from the PREVIOUS stage to this one, e.g. [{x, y}]
 *   terrainSvg(): string,                       background art (1366 x 768)
 *   buildingSvg(stage, state): string,          a building, origin at the stage tile, drawn above it
 *   legacyIds (optional): { oldStageId: newStageId } for stages renamed since older saves
 * }
 */
export function startTown(config) {
  const station = startStation(config.townId);         // ?station: no sign-in, everything open (shared/station.js)
  const state = new TownState({ townId: config.townId, label: config.label, stages: config.stages, legacyIds: config.legacyIds });
  const ui = buildDom(config);
  const hub = { config, state, ui, current: 0, walking: false, raf: null, pendingWalk: null, station };
  if (lockedToTown(station, config.townId)) ui.worldMapBtn.classList.add('hidden');   // a town-only station stays here

  hub.harness = new CartridgeHarness({
    onComplete: (stage, payload) => onComplete(hub, stage, payload),
    onExit: () => render(hub),
  });
  wire(hub);
  signIn(hub);
  return hub;
}

/* ------------------------------------------------------------------ */
/* DOM                                                                 */
/* ------------------------------------------------------------------ */
function buildDom(c) {
  const root = document.getElementById('townApp');
  root.innerHTML = `
    <svg id="townMap" viewBox="0 0 1366 768" preserveAspectRatio="xMidYMid slice" aria-label="${c.name} map"></svg>
    <button type="button" id="worldMapBtn" class="town-sign" title="Back to the world map">
      <span class="px t1">WORLD ${c.number}</span><span class="px t2">${c.name.toUpperCase()}</span><span class="t3">◂ world map</span>
    </button>
    <div class="town-top">
      <span id="teacherBanner" class="hidden chip chip-purple px">TEACHER: ALL OPEN</span>
      <span id="hudCode" class="chip chip-ink px"></span>
      <button type="button" id="myStarsBtn" class="sys-btn px" title="My progress">MY STARS</button>
      <button type="button" id="soundBtn" class="sys-btn" title="Sound on or off">🔊</button>
      <button type="button" id="exitBtn" class="sys-btn sys-exit px" title="Sign out">EXIT</button>
    </div>
    <div class="town-panel">
      <button type="button" id="prevBtn" class="arrow-btn px" title="Previous building">◀</button>
      <div class="panel-badge px" id="panelCode"></div>
      <div class="panel-text">
        <div class="px panel-name" id="panelName"></div>
        <div class="panel-sub" id="panelSub"></div>
        <div class="panel-status" id="panelStatus"></div>
      </div>
      <div class="hud-stats"><span id="hudLevel"></span><span id="hudCoins"></span></div>
      <button type="button" id="nextBtn" class="arrow-btn px" title="Next building">▶</button>
      <button type="button" id="enterBtn" class="btn-chunky btn-red enter-btn"><span class="px">▶ ENTER</span></button>
    </div>
    <div id="toast" class="toast hidden px"></div>

    <div id="briefModal" class="hidden modal-scrim town-modal"><div class="card-cream brief-card pop-in">
      <div class="brief-top"><div><div id="briefCode" class="brief-code"></div><h2 id="briefTitle" class="px brief-title"></h2><div id="briefSub" class="brief-sub"></div></div>
        <button type="button" id="briefClose" class="x-btn">✕</button></div>
      <div id="briefDesc" class="brief-desc"></div><div id="briefStars" class="brief-stars"></div>
      <button type="button" id="briefGo" class="btn-chunky btn-red brief-go"><span class="px">▶ START (ENTER)</span></button>
    </div></div>

    <div id="victoryModal" class="hidden modal-scrim town-modal"><div class="card-cream victory-card pop-in">
      <div id="victoryTitle" class="px victory-title"></div><div id="victoryStars" class="victory-stars"></div>
      <div id="victoryScore" class="victory-line"></div><div id="victoryRewards" class="victory-line"></div>
      <div id="victoryLevel" class="victory-line hidden">LEVEL UP!</div>
      <div id="victoryOpen" class="victory-open hidden"></div>
      <button type="button" id="victoryBack" class="btn-chunky btn-red brief-go"><span class="px">▶ BACK TO TOWN (ENTER)</span></button>
    </div></div>

    <div id="progressModal" class="hidden modal-scrim town-modal"><div class="card-cream progress-card pop-in">
      <div class="progress-head"><div><div id="progressCode" class="progress-code"></div><h2 class="px progress-title">MY PROGRESS · ${c.name.toUpperCase()}</h2></div>
        <button type="button" id="progressClose" class="x-btn">✕</button></div>
      <div id="progressSummary" class="progress-summary"></div><div id="progressList" class="progress-list"></div><div id="progressSync" class="progress-sync"></div>
    </div></div>

    <div id="lockedModal" class="hidden modal-scrim town-modal"><div class="card-cream locked-card pop-in">
      <div class="px victory-title">${c.name.toUpperCase()} IS LOCKED</div><p id="lockedReason"></p>
      <button type="button" id="lockedBack" class="btn-chunky btn-red brief-go"><span class="px">◂ BACK TO THE WORLD MAP</span></button>
    </div></div>

    <div id="cartridgeHarnessModal" class="hidden">
      <div class="harness-bar"><span id="harnessLessonBadge" class="lesson px"></span><span id="harnessQuestTitle" class="title"></span>
        <button type="button" id="harnessRetreatBtn" class="back px">◀ BACK TO MAP</button></div>
      <iframe id="cartridgeIframe" title="Game" allow="autoplay; fullscreen"></iframe>
    </div>`;
  const ids = ['townMap', 'worldMapBtn', 'teacherBanner', 'hudCode', 'myStarsBtn', 'soundBtn', 'exitBtn', 'prevBtn', 'nextBtn', 'enterBtn',
    'panelCode', 'panelName', 'panelSub', 'panelStatus', 'hudLevel', 'hudCoins', 'toast', 'briefModal', 'briefCode', 'briefTitle', 'briefSub',
    'briefDesc', 'briefStars', 'briefGo', 'briefClose', 'victoryModal', 'victoryTitle', 'victoryStars', 'victoryScore', 'victoryRewards',
    'victoryLevel', 'victoryOpen', 'victoryBack', 'progressModal', 'progressCode', 'progressSummary', 'progressList', 'progressSync',
    'progressClose', 'lockedModal', 'lockedReason', 'lockedBack', 'cartridgeHarnessModal'];
  return Object.fromEntries(ids.map((id) => [id, $(id)]));
}

/* ------------------------------------------------------------------ */
/* Sign-in: reuse the code from the Super Map                          */
/* ------------------------------------------------------------------ */
async function signIn(hub) {
  const code = progressStore.getActiveCode();
  if (!code) { location.href = hub.config.superMapUrl; return; }
  // Coming from the Super Map, this device already has the code's copy: open at once, check the sheet behind it.
  const res = await hub.state.load(code, { fast: true, onFresh: (fresh) => {
    if (!fresh.ok && fresh.error === 'bad_code') { progressStore.clearActiveCode(); location.href = hub.config.superMapUrl; }
  } });
  if (!res.success) {
    progressStore.clearActiveCode();
    if (res.error === 'offline') {
      hub.ui.lockedReason.textContent = "Can't reach the server. Connect to the internet and try again.";
      hub.ui.lockedModal.classList.remove('hidden');
      return;
    }
    location.href = hub.config.superMapUrl;
    return;
  }
  hub.ui.hudCode.textContent = hub.state.code;
  hub.ui.teacherBanner.classList.toggle('hidden', !hub.state.fullAccess);
  if (hub.station) hub.ui.teacherBanner.textContent = 'STATION: ALL OPEN';
  if (res.townLocked) {
    hub.ui.lockedReason.textContent = `${res.reason}, or ask your teacher to open it.`;
    hub.ui.lockedModal.classList.remove('hidden');
  }
  const stages = hub.config.stages;
  const lastOpen = stages.map((s, i) => [s, i]).filter(([s]) => hub.state.stageState(s.id) === 'open' && !hub.state.isCleared(s.id));
  const anyOpen = stages.map((s, i) => [s, i]).filter(([s]) => hub.state.stageState(s.id) === 'open');
  hub.current = lastOpen.length ? lastOpen[0][1] : anyOpen.length ? anyOpen[anyOpen.length - 1][1] : 0;
  hub.heroPos = { ...stages[hub.current].coords };
  render(hub);
}

/* ------------------------------------------------------------------ */
/* Map                                                                 */
/* ------------------------------------------------------------------ */
/** The road from stage i to stage i + 1: its start, any corner points (the next stage's `via`), and its end. */
const roadPoints = (stages, i) => [stages[i].coords, ...(stages[i + 1].via || []), stages[i + 1].coords];
function roadSvg(stages, state) {
  let out = '';
  for (let i = 0; i < stages.length - 1; i++) {
    const lit = state.stageState(stages[i].id) === 'open' && state.stageState(stages[i + 1].id) === 'open';
    const d = roadPoints(stages, i).map((p, k) => `${k ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
    out += `<path d="${d}" stroke="${K}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="${d}" stroke="${lit ? PALETTE.road : PALETTE.roadLocked}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="${d}" stroke="${lit ? PALETTE.roadDot : PALETTE.roadLockedDot}" stroke-width="3" stroke-dasharray="2 13" stroke-linecap="round" fill="none"/>`;
  }
  return out;
}

function tileSvg(stage, st, cleared, stars) {
  const fill = st === 'open' ? (cleared ? PALETTE.gold : '#fff4d6') : st === 'wip' ? '#f3c77a' : '#c9c3b6';
  return `
    <ellipse cx="0" cy="7" rx="30" ry="8" fill="rgba(0,0,0,0.25)"/>
    <rect x="-28" y="-15" width="56" height="30" rx="9" fill="${fill}" ${O}/>
    <text y="5" text-anchor="middle" class="map-px" font-size="${stage.lessonCode.length > 3 ? 9 : 11}" fill="${K}">${stage.lessonCode}</text>
    ${st === 'locked' ? `<g transform="translate(26 -14)"><rect x="-8" y="-4" width="16" height="13" rx="2" fill="${PALETTE.gold}" ${O2}/><path d="M-5 -4 v-4 a5 5 0 0 1 10 0 v4" fill="none" ${O2}/></g>` : ''}
    ${cleared ? `<g transform="translate(0 30)">${[0, 1, 2].map((i) => `<path transform="translate(${(i - 1) * 15} 0) scale(0.7)" d="M0 -9 L2.6 -3 L9 -2.8 L4 1.4 L5.6 8 L0 4.4 L-5.6 8 L-4 1.4 L-9 -2.8 L-2.6 -3 Z" fill="${i < stars ? PALETTE.gold : '#d9c69c'}" ${O2}/>`).join('')}</g>` : ''}`;
}

function render(hub) {
  const { config, state, ui } = hub;
  const stages = config.stages;
  ui.townMap.innerHTML = `
    ${config.terrainSvg()}
    ${roadSvg(stages, state)}
    ${stages.map((s, i) => {
      const st = state.stageState(s.id);
      const rec = state.records[s.id];
      return `<g class="stage stage-${st}" data-idx="${i}" style="cursor:pointer" transform="translate(${s.coords.x} ${s.coords.y})">
        <g class="bldg">${config.buildingSvg(s, st)}</g>
        ${tileSvg(s, st, Boolean(rec && rec.cleared), (rec && rec.stars) || 0)}
        ${nameplateSvg(s.title, -112, i === hub.current)}
      </g>`;
    }).join('')}
    <g id="townHero" transform="translate(${hub.heroPos.x} ${hub.heroPos.y - 6})">${heroSvg()}</g>`;
  updatePanel(hub);
}

function updatePanel(hub) {
  const { state, ui } = hub;
  const s = hub.config.stages[hub.current];
  const st = state.stageState(s.id);
  const rec = state.records[s.id];
  ui.panelCode.textContent = s.lessonCode;
  ui.panelName.textContent = s.title;
  ui.panelSub.textContent = s.subtitle;
  ui.panelStatus.className = `panel-status ${st}`;
  ui.panelStatus.textContent = st === 'wip' ? 'Under construction · coming soon'
    : st === 'locked' ? 'Locked · clear the building before it to open'
    : rec && rec.cleared ? `Cleared ${starText(rec.stars)} · best ${rec.bestScore}/${rec.total} · press ENTER to play again`
    : 'Open! Press ENTER to go in.';
  ui.enterBtn.disabled = st !== 'open';
  ui.enterBtn.querySelector('span').textContent = st === 'open' ? '▶ ENTER' : st === 'wip' ? 'SOON' : 'LOCKED';
  ui.hudLevel.textContent = `LV.${state.level}`;
  ui.hudCoins.textContent = `🪙 ${state.coins}`;
  ui.townMap.querySelectorAll('.nameplate').forEach((el) => el.classList.remove('is-current'));
  ui.townMap.querySelector(`.stage[data-idx="${hub.current}"] .nameplate`)?.classList.add('is-current');
}

function toast(hub, msg) {
  hub.ui.toast.textContent = msg;
  hub.ui.toast.classList.remove('hidden');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => hub.ui.toast.classList.add('hidden'), 2400);
}

/* ------------------------------------------------------------------ */
/* Walking                                                             */
/* ------------------------------------------------------------------ */
function cancelWalk(hub) {
  if (hub.raf) cancelAnimationFrame(hub.raf);
  hub.raf = null; hub.walking = false;
  $('townHero')?.classList.remove('walking');
}

function walkTo(hub, target) {
  const stages = hub.config.stages;
  if (target < 0 || target >= stages.length || target === hub.current || hub.walking) return;
  const step = target > hub.current ? 1 : -1;
  const legs = [];
  // each leg is one straight piece of road; only the last piece of a road arrives at a stage (its index), corners get null
  for (let i = hub.current; i !== target; i += step) {
    const pts = step > 0 ? roadPoints(stages, i) : [...roadPoints(stages, i - 1)].reverse();
    for (let k = 0; k < pts.length - 1; k++) legs.push([pts[k], pts[k + 1], k === pts.length - 2 ? i + step : null]);
  }
  hub.walking = true;
  const hero = $('townHero');
  hero.classList.add('walking');
  const facing = hero.querySelector('.hero-facing');
  let leg = 0, t = 0, last = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const [a, b] = legs[leg];
    t += (WALK_SPEED * dt) / Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    if (t >= 1) {
      if (legs[leg][2] !== null) { hub.current = legs[leg][2]; hubAudio.playStep(); updatePanel(hub); }
      leg += 1; t = 0;
      if (leg >= legs.length) {
        hub.heroPos = { ...stages[hub.current].coords };
        hero.setAttribute('transform', `translate(${hub.heroPos.x} ${hub.heroPos.y - 6})`);
        cancelWalk(hub);
        return;
      }
    }
    const [p, q] = legs[leg];
    const x = p.x + (q.x - p.x) * t, y = p.y + (q.y - p.y) * t;
    if (facing) facing.style.transform = q.x < p.x ? 'scaleX(-1)' : '';
    hub.heroPos = { x, y };
    hero.setAttribute('transform', `translate(${x.toFixed(1)} ${(y - 6).toFixed(1)})`);
    hub.raf = requestAnimationFrame(tick);
  };
  hub.raf = requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------ */
/* Briefing, launching, victory                                        */
/* ------------------------------------------------------------------ */
function openBrief(hub) {
  if (hub.walking) return;
  const s = hub.config.stages[hub.current];
  const st = hub.state.stageState(s.id);
  if (st !== 'open') {
    hubAudio.playLockRattle();
    toast(hub, st === 'wip' ? `${s.title} is under construction. Coming soon!` : 'Locked! Clear the building before it first.');
    return;
  }
  const rec = hub.state.records[s.id];
  const ui = hub.ui;
  ui.briefCode.textContent = `Lesson ${s.lessonCode}`;
  ui.briefTitle.textContent = s.title.toUpperCase();
  ui.briefSub.textContent = s.subtitle;
  ui.briefDesc.textContent = s.description || '';
  ui.briefStars.textContent = rec && rec.cleared ? `Your best: ${starText(rec.stars)} (${rec.bestScore}/${rec.total})` : 'Not cleared yet';
  hubAudio.playQuestOpen();
  ui.briefModal.classList.remove('hidden');
}

function launch(hub) {
  const s = hub.config.stages[hub.current];
  hub.ui.briefModal.classList.add('hidden');
  hub.harness.launch({ ...s, cartridgeUrl: s.url, title: s.title, subtitle: s.subtitle, lessonCode: s.lessonCode });
}

function onComplete(hub, stage, payload) {
  hub.harness.close();
  const r = hub.state.completeStage(stage.id, payload || {});
  if (!r) { render(hub); return; }
  hubAudio.playLevelUp();
  const ui = hub.ui;
  ui.victoryTitle.textContent = `${stage.title.toUpperCase()} CLEARED!`;
  ui.victoryStars.textContent = starText(r.stars);
  ui.victoryScore.textContent = `Score: ${payload.score ?? 0} / ${payload.total ?? 0}${payload.practiceMode ? ' (practice)' : ''}`;
  ui.victoryRewards.textContent = `+${r.xpGained} XP · +${r.coinsGained} coins`;
  ui.victoryLevel.classList.toggle('hidden', !r.leveledUp);
  ui.victoryOpen.classList.toggle('hidden', !r.opened);
  if (r.opened) ui.victoryOpen.textContent = `Now open: ${r.opened.title} (Lesson ${r.opened.lessonCode})`;
  hub.pendingWalk = r.opened ? hub.config.stages.findIndex((s) => s.id === r.opened.id) : null;
  ui.victoryModal.classList.remove('hidden');
}

/* ------------------------------------------------------------------ */
/* My Progress                                                         */
/* ------------------------------------------------------------------ */
function openProgress(hub) {
  const { state, ui, config } = hub;
  const built = config.stages.filter((s) => s.built);
  const cleared = built.filter((s) => state.isCleared(s.id)).length;
  const stars = built.reduce((n, s) => n + ((state.records[s.id] && state.records[s.id].stars) || 0), 0);
  ui.progressCode.textContent = `Code ${state.code}`;
  ui.progressSummary.innerHTML = [['LEVEL', state.level], ['CLEARED', `${cleared}/${built.length}`], ['STARS', `${stars}/${built.length * 3}`], ['COINS', state.coins]]
    .map(([l, v]) => `<div class="progress-stat"><div class="px stat-label">${l}</div><div class="px stat-value">${v}</div></div>`).join('');
  ui.progressList.innerHTML = config.stages.map((s) => {
    const st = state.stageState(s.id), rec = state.records[s.id];
    const detail = st === 'wip' ? 'Coming soon' : st === 'locked' ? 'Locked' : rec && rec.cleared ? `Best ${rec.bestScore}/${rec.total}` : 'Not cleared yet';
    return `<div class="progress-row ${rec && rec.cleared ? 'done' : ''} ${st === 'wip' ? 'wip' : ''}">
      <div class="px row-code">${s.lessonCode}</div>
      <div class="row-main"><div class="px row-name">${s.title.toUpperCase()}</div><div class="row-detail">${detail}</div></div>
      <div class="row-stars">${st === 'wip' ? '' : starText((rec && rec.stars) || 0)}</div></div>`;
  }).join('');
  ui.progressSync.textContent = hub.station ? 'Station mode: stars last until this tab is closed. Nothing is saved.' : progressStore.pendingCount(state.code) === 0
    ? 'Saved. Your teacher can see your progress.'
    : 'Saved on this Chromebook. It will send to your teacher when the internet is back.';
  ui.progressModal.classList.remove('hidden');
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */
function wire(hub) {
  const { ui, config } = hub;
  const soundIcon = () => { ui.soundBtn.textContent = hubAudio.isMuted ? '🔇' : '🔊'; };
  soundIcon();
  const unlock = () => { hubAudio.unlockAudio(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  const toWorld = () => { hubAudio.playSelect(); document.getElementById('townApp').classList.add('leaving'); setTimeout(() => { location.href = `${config.superMapUrl}?from=${config.townId}`; }, 250); };
  ui.worldMapBtn.addEventListener('click', toWorld);
  ui.lockedBack.addEventListener('click', toWorld);
  ui.exitBtn.addEventListener('click', () => {
    hubAudio.playSelect(); cancelWalk(hub);
    if (lockedToTown(hub.station, config.townId)) { location.href = location.pathname; return; }   // town station: start the town again
    progressStore.clearActiveCode();                                                               // (does nothing in a world station)
    location.href = config.superMapUrl;
  });
  ui.soundBtn.addEventListener('click', () => { hubAudio.toggleMute(); soundIcon(); });
  ui.myStarsBtn.addEventListener('click', () => { hubAudio.playSelect(); openProgress(hub); });
  ui.progressClose.addEventListener('click', () => ui.progressModal.classList.add('hidden'));
  ui.prevBtn.addEventListener('click', () => walkTo(hub, hub.current - 1));
  ui.nextBtn.addEventListener('click', () => walkTo(hub, hub.current + 1));
  ui.enterBtn.addEventListener('click', () => openBrief(hub));
  ui.briefClose.addEventListener('click', () => ui.briefModal.classList.add('hidden'));
  ui.briefGo.addEventListener('click', () => launch(hub));
  ui.victoryBack.addEventListener('click', () => {
    hubAudio.playSelect();
    ui.victoryModal.classList.add('hidden');
    render(hub);
    if (hub.pendingWalk !== null && hub.pendingWalk >= 0) { const to = hub.pendingWalk; hub.pendingWalk = null; setTimeout(() => walkTo(hub, to), 250); }
  });
  ui.townMap.addEventListener('click', (e) => {
    const g = e.target.closest('[data-idx]');
    if (!g) return;
    const idx = Number(g.getAttribute('data-idx'));
    if (idx === hub.current) openBrief(hub); else walkTo(hub, idx);
  });
  window.addEventListener('online', () => { if (hub.state.code) progressStore.flushQueue(hub.state.code); });
  window.addEventListener('keydown', (e) => {
    if (!ui.cartridgeHarnessModal.classList.contains('hidden') || !ui.lockedModal.classList.contains('hidden')) return;
    const open = (m) => !ui[m].classList.contains('hidden');
    if (open('victoryModal')) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.victoryBack.click(); } return; }
    if (open('briefModal')) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); launch(hub); } else if (e.key === 'Escape') ui.briefClose.click();
      return;
    }
    if (open('progressModal')) { if (e.key === 'Escape') ui.progressClose.click(); return; }
    if (['ArrowRight', 'ArrowDown', 'd', 'D', 's', 'S'].includes(e.key)) { e.preventDefault(); walkTo(hub, hub.current + 1); }
    else if (['ArrowLeft', 'ArrowUp', 'a', 'A', 'w', 'W'].includes(e.key)) { e.preventDefault(); walkTo(hub, hub.current - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBrief(hub); }
  });
}
