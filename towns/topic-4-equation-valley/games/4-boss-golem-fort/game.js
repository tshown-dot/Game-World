// Golem Fort (Topic 4 boss): the screen. The rules are in golem.js.
//
// The fort is a gauntlet of the valley's real machines. The golem has five parts; for each one the student picks a
// WEAPON, and that lesson's own game opens right here (in a frame) for one zone, in "fort mode" (see
// shared/game/arcadeShell.js). When it sends back how the zone went, the part breaks or the golem takes a heart.
// The fort's own briefing, hearts, report and town messages come from the same shared action shell the weapons use.
import { createArcade } from '../../../../shared/game/arcadeShell.js';
import { PARTS, ZONES, weaponUrl, strength, tally } from './golem.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const TEST = new URLSearchParams(location.search).has('test');

// phase: idle, choose (pick a weapon), weapon (a weapon game is open), break (a part is shattering)
const W = { phase: 'idle', part: 0, broken: 0, weapon: null, frame: null, used: [] };

const arcade = createArcade({
  zones: ZONES, startZone, stopZone, onKey, testName: '__fort',
  hints: { weapon_lost: 'That weapon broke twice. You can pick a different weapon for this part, or leave the fort and train in that building first. PRACTICE runs cost no hearts.' },
  skillTips: { weapon_lost: 'Revisit the building whose weapon broke, then come back to the fort.' },
  perfectText: 'No weapon broke: the golem never laid a fist on you!',
  lifeLostText: (left) => (left > 0 ? `THE GOLEM STRIKES! ${left} HEART${left === 1 ? '' : 'S'} LEFT` : 'THE GOLEM STANDS'),
});
const { G, hubAudio } = arcade;
if (window.__fort) window.__fort.W = W;

/* ================================================================== */
/* Parts and weapons                                                   */
/* ================================================================== */
function startZone(z) {
  closeWeapon();
  Object.assign(W, { phase: 'choose', part: z, broken: z });
  showLine('');
  render();
}
function stopZone() { closeWeapon(); W.phase = 'idle'; }
function showLine(text, off = false) { $('fline').textContent = text; $('fline').classList.toggle('off', off); }
function pick(i) {
  const w = PARTS[W.part].weapons[i];
  if (W.phase !== 'choose' || arcade.paused() || !w) return;
  hubAudio.playCartridgeLaunch();
  const frame = document.createElement('iframe');
  frame.id = 'weaponFrame'; frame.className = 'weapon-frame'; frame.title = `${w.name}: the weapon for ${PARTS[W.part].name}`;
  frame.src = weaponUrl(w, { practice: G.practice, test: TEST });
  frame.addEventListener('load', () => frame.focus());
  document.body.appendChild(frame);
  Object.assign(W, { phase: 'weapon', weapon: w, frame });
}
function closeWeapon() {
  if (W.frame) W.frame.remove();
  W.frame = null;
}
// The weapon game talks to the fort the same way a game talks to its town.
window.addEventListener('message', (e) => {
  if (!W.frame || e.source !== W.frame.contentWindow || !e.data) return;
  const { type, payload } = e.data;
  if (type === 'CARTRIDGE_READY') W.frame.contentWindow.postMessage({ type: 'HUB_INIT', payload: { isMuted: hubAudio.isMuted } }, '*');
  else if (type === 'CARTRIDGE_EXIT_REQUEST') { closeWeapon(); W.phase = 'choose'; showLine('You put the weapon down. Choose again.'); render(); }
  else if (type === 'FORT_WEAPON_DONE') setTimeout(() => weaponDone(payload), 1300);   // a moment for the weapon's own banner
});
function weaponDone(result) {
  if (W.phase !== 'weapon') return;
  const r = tally(result), w = W.weapon, stats = G.zoneStats[G.zone];
  closeWeapon();
  G.good += r.good; G.bad += r.bad; G.score += r.good * 10;            // every decision inside the weapon counts for the fort
  stats.right += r.good; stats.total += r.good + r.bad;
  if (r.won) {
    W.used.push(w.lesson); W.phase = 'break'; W.broken = W.part + 1;
    hubAudio.playLevelUp(); showLine(`${w.name} did it: ${PARTS[W.part].name.toUpperCase()} shattered!`);
    arcade.renderHud(); render(); shake();
    setTimeout(() => { if (W.phase === 'break') arcade.zoneCleared(); }, 1500);
    return;
  }
  W.phase = 'choose';
  showLine(`${w.name} broke before the zone was cleared. Choose a weapon and try again.`, true);
  arcade.bad('weapon_lost', 100);                                       // in a timed run this costs a heart
  if (W.phase === 'choose') render();
}
function shake() { const g = $('golemArt'); g.classList.remove('hit'); void g.getBoundingClientRect(); g.classList.add('hit'); }
function onKey(e) {
  if (/^[1-3]$/.test(e.key)) pick(Number(e.key) - 1);
}

/* ================================================================== */
/* Drawing: the golem and the weapon cards                             */
/* ================================================================== */
const K = '#1d1433', STONE = '#9c8b7a', DARK = '#6b5a4a';
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round"`;
/** One golem part. state: 'broken', 'target' (this part) or 'whole'. */
function part(state, svg) {
  if (state === 'broken') return `<g class="broken" opacity="0.35" transform="translate(0 14)">${svg(DARK)}</g>`;
  return `<g class="${state === 'target' ? 'target' : ''}">${svg(STONE)}</g>`;
}
function golem() {
  const st = (i) => (i < W.broken ? 'broken' : i === W.part && W.phase !== 'idle' ? 'target' : 'whole'), dead = W.broken >= PARTS.length;
  return `<rect x="-300" y="-300" width="1100" height="1120" fill="#e58a4e"/>
    <rect x="-300" y="430" width="1100" height="400" fill="#8a4a2a"/><path d="M-300 430 H800" stroke="${K}" stroke-width="3"/>
    <path d="M10 430 V150 L60 110 L110 150 V430 Z M310 430 V150 L360 110 L410 150 V430 Z" fill="#a9512b" ${O}/>
    ${part(st(0), (c) => `<rect x="130" y="400" width="60" height="40" rx="8" fill="${c}" ${O}/><rect x="230" y="400" width="60" height="40" rx="8" fill="${c}" ${O}/>`)}
    <rect x="145" y="330" width="40" height="76" fill="${DARK}" ${O}/><rect x="235" y="330" width="40" height="76" fill="${DARK}" ${O}/>
    <rect x="140" y="190" width="140" height="150" rx="14" fill="${STONE}" ${O}/>
    ${part(st(4), (c) => `<circle class="core" cx="210" cy="265" r="30" fill="${c === STONE ? '#ffd23f' : c}" ${O}/><path d="M210 245 V285 M190 265 H230" stroke="${K}" stroke-width="3"/>`)}
    ${part(st(2), (c) => `<rect x="96" y="180" width="56" height="44" rx="10" fill="${c}" ${O}/><rect x="268" y="180" width="56" height="44" rx="10" fill="${c}" ${O}/>`)}
    ${part(st(1), (c) => `<rect x="284" y="222" width="38" height="120" rx="10" fill="${c}" ${O}/><rect x="278" y="336" width="50" height="40" rx="10" fill="${c}" ${O}/><rect x="98" y="222" width="38" height="120" rx="10" fill="${c}" ${O}/>`)}
    ${part(st(3), (c) => `<circle cx="104" cy="300" r="58" fill="${c === STONE ? '#c9b8ff' : c}" ${O}/><text x="104" y="312" text-anchor="middle" font-size="34" fill="${K}" font-family="ui-monospace, monospace" font-weight="900">≤</text>`)}
    <rect x="170" y="120" width="80" height="72" rx="12" fill="${STONE}" ${O}/>
    <rect x="186" y="146" width="16" height="10" fill="${dead ? DARK : '#e5484d'}"/><rect x="218" y="146" width="16" height="10" fill="${dead ? DARK : '#e5484d'}"/>
    <path d="M192 172 H228" stroke="${K}" stroke-width="4"/>`;
}
function render() {
  const p = PARTS[W.part];
  $('golemArt').innerHTML = golem();
  $('strengthFill').style.width = `${strength(W.broken)}%`;
  $('signSmall').textContent = `PART ${W.part + 1}/${PARTS.length} · ${p.blurb.toUpperCase()}`;
  $('signText').textContent = W.phase === 'break' ? `${p.name.toUpperCase()} SHATTERED!` : `BREAK ${p.name.toUpperCase()}: CHOOSE YOUR WEAPON`;
  $('cards').innerHTML = W.phase !== 'choose' ? '' : p.weapons.map((w, i) => `<button type="button" class="wcard" data-weapon="${i}"><b>${i + 1}</b>
      <span class="px wlesson">LESSON ${esc(w.lesson)}</span><span class="wname">${esc(w.name)}</span><span class="wdoes">${esc(w.does)}</span></button>`).join('');
}
$('cards').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.blur(); pick(Number(b.dataset.weapon)); });

// Something to look at behind the briefing.
$('golemArt').innerHTML = golem();
$('strengthFill').style.width = '100%';
