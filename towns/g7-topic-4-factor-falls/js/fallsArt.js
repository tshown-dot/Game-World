// Factor Falls art: green cliffs, a tall waterfall and a river, with pines. Buildings get their own art as each
// game is built; until then every stop shows the shared "under construction" scaffold.
import { PALETTE, pine, rock, bush, cloud, constructionSvg } from '../../../shared/art.js';

const K = PALETTE.ink;
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

/** The big waterfall behind the boss stop, and the river it feeds. */
const RIVER = 'M700 250 C 640 380, 420 400, 430 560 S 620 700, 600 790';

export function terrainSvg() {
  let ledges = '';
  for (let i = 0; i < 6; i++) ledges += `<path d="M0 ${250 + i * 90} Q 340 ${236 + i * 90} 683 ${252 + i * 90} T 1366 ${246 + i * 90}" stroke="rgba(29,20,51,0.08)" stroke-width="8" fill="none"/>`;
  return `
    <rect width="1366" height="768" fill="#57b56a"/>
    ${ledges}
    <!-- cliffs along the top, with the falls in the middle -->
    <path d="M0 0 H1366 V170 Q1180 215 1000 180 Q860 150 790 190 L610 190 Q520 150 380 184 Q190 220 0 172 Z" fill="#7d8a99" ${O}/>
    <path d="M0 60 Q340 84 683 60 T1366 64 M0 120 Q340 140 683 118 T1366 124" stroke="#6b7786" stroke-width="5" fill="none"/>
    <rect x="640" y="0" width="120" height="250" fill="#9fdcff" ${O}/>
    <path class="river-flow" d="M664 6 V240 M700 6 V240 M736 6 V240" stroke="#ffffff" stroke-width="4" stroke-dasharray="12 16" fill="none"/>
    <!-- the river -->
    <path d="${RIVER}" fill="none" stroke="${K}" stroke-width="64" stroke-linecap="round"/>
    <path d="${RIVER}" fill="none" stroke="#3a8ef0" stroke-width="56" stroke-linecap="round"/>
    <path class="river-flow" d="${RIVER}" fill="none" stroke="#bfe2ff" stroke-width="3" stroke-dasharray="10 26" stroke-linecap="round"/>
    <ellipse cx="700" cy="250" rx="92" ry="22" fill="#e8f7ff" ${O}/>
    ${pine(60, 330, 1.1)}${pine(110, 300, 0.9, 0.2)}${pine(240, 290, 1)}${pine(1290, 250, 1.1, 0.1)}${pine(1320, 420, 0.9)}
    ${pine(80, 700, 1)}${pine(820, 720, 0.9, 0.3)}${pine(1260, 690, 1.1)}${pine(560, 330, 0.8)}
    ${rock(250, 640, 1.1)}${rock(1040, 420, 1)}${rock(830, 400, 0.9)}${bush(300, 690, 1)}${bush(1060, 690, 1, 0.2)}${bush(1300, 590, 0.9)}
    ${cloud(180, 60, 0.8, 100, 0)}${cloud(1040, 40, 0.7, 120, 40)}`;
}

const thunderFalls = `
  <ellipse cx="0" cy="-16" rx="60" ry="9" fill="rgba(0,0,0,0.2)"/>
  <path d="M-58 -18 L-44 -84 L44 -84 L58 -18 Z" fill="#6b7786" ${O}/>
  <rect x="-16" y="-84" width="32" height="66" fill="#9fdcff" ${O}/>
  <path class="river-flow" d="M-6 -80 V-22 M6 -80 V-22" stroke="#ffffff" stroke-width="3" stroke-dasharray="7 9"/>
  <path d="M-30 -96 L-22 -84 M0 -100 V-86 M30 -96 L22 -84" stroke="${PALETTE.gold}" stroke-width="4" stroke-linecap="round"/>`;

const rangerStation = `
  <ellipse cx="0" cy="-14" rx="46" ry="8" fill="rgba(0,0,0,0.2)"/>
  <rect x="-34" y="-58" width="60" height="44" fill="#a9703a" ${O}/>
  <path d="M-42 -58 L-4 -86 L34 -58 Z" fill="#7a3f22" ${O}/>
  <rect x="-12" y="-40" width="16" height="26" fill="#5b3a1d" ${O}/>
  <path d="M36 -14 V-104 M26 -90 H46 M29 -74 H43" stroke="${K}" stroke-width="3.5"/>
  <circle class="sway" cx="36" cy="-108" r="5" fill="#e5484d" ${O}/>`;

const twinBridges = `
  <ellipse cx="0" cy="-14" rx="50" ry="8" fill="rgba(0,0,0,0.2)"/>
  <path d="M-46 -22 Q0 -62 46 -22" fill="none" stroke="${K}" stroke-width="11"/><path d="M-46 -22 Q0 -62 46 -22" fill="none" stroke="#c98a4b" stroke-width="6"/>
  <path d="M-46 -46 Q0 -86 46 -46" fill="none" stroke="${K}" stroke-width="11"/><path d="M-46 -46 Q0 -86 46 -46" fill="none" stroke="#c98a4b" stroke-width="6"/>
  <rect x="-52" y="-56" width="10" height="42" fill="#8a5a2b" ${O}/><rect x="42" y="-56" width="10" height="42" fill="#8a5a2b" ${O}/>`;

const logFlume = `
  <ellipse cx="0" cy="-14" rx="50" ry="8" fill="rgba(0,0,0,0.2)"/>
  <path d="M-48 -70 L44 -30 L44 -16 L-48 -56 Z" fill="#3a8ef0" ${O}/>
  <path d="M-48 -76 L44 -36 M-48 -52 L44 -12" stroke="${K}" stroke-width="6"/><path d="M-48 -76 L44 -36 M-48 -52 L44 -12" stroke="#8a5a2b" stroke-width="3"/>
  <rect x="-40" y="-52" width="8" height="38" fill="#8a5a2b" ${O}/><rect x="28" y="-22" width="8" height="10" fill="#8a5a2b" ${O}/>
  <g class="sway"><rect x="-14" y="-58" width="30" height="12" rx="6" fill="#c98a4b" ${O} transform="rotate(23 0 -52)"/></g>`;

const sprayDeck = `
  <ellipse cx="0" cy="-14" rx="50" ry="8" fill="rgba(0,0,0,0.2)"/>
  <rect x="-44" y="-50" width="88" height="14" fill="#c98a4b" ${O}/>
  <path d="M-30 -50 V-36 M-10 -50 V-36 M10 -50 V-36 M30 -50 V-36" stroke="${K}" stroke-width="2"/>
  <rect x="-40" y="-36" width="8" height="24" fill="#8a5a2b" ${O}/><rect x="32" y="-36" width="8" height="24" fill="#8a5a2b" ${O}/>
  <path d="M-44 -50 V-72 H44 V-50 M-22 -72 V-50 M0 -72 V-50 M22 -72 V-50" fill="none" stroke="${K}" stroke-width="3"/>
  <g class="sway"><circle cx="-30" cy="-86" r="4" fill="#e8f7ff"/><circle cx="-12" cy="-94" r="3" fill="#e8f7ff"/><circle cx="16" cy="-88" r="4" fill="#e8f7ff"/></g>`;

export function buildingSvg(stage, state) {
  if (stage.isBoss) return thunderFalls + (state === 'wip' ? constructionSvg() : '');
  if (stage.building === 'ranger_station') return rangerStation;
  if (stage.building === 'twin_bridges') return twinBridges;
  if (stage.building === 'log_flume') return logFlume;
  if (stage.building === 'spray_deck') return sprayDeck;
  return constructionSvg();
}
