// Equation Valley art: a red-rock canyon with a river, mesas and cacti, plus one building per lesson.
import { PALETTE, rock, cloud } from '../../../shared/art.js';

const K = PALETTE.ink;
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${K}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;

const cactus = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-5" y="-34" width="10" height="34" rx="5" fill="#3fa53a" ${O2}/>
    <path d="M-5 -18 L-13 -18 L-13 -28 M5 -12 L12 -12 L12 -22" fill="none" stroke="${K}" stroke-width="8" stroke-linecap="round"/>
    <path d="M-5 -18 L-13 -18 L-13 -28 M5 -12 L12 -12 L12 -22" fill="none" stroke="#3fa53a" stroke-width="4" stroke-linecap="round"/>
  </g>`;
const mesa = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <path d="M-60 0 L-44 -56 L44 -56 L60 0 Z" fill="#c8673a" ${O}/>
    <path d="M-50 -24 L50 -24" stroke="#a9512b" stroke-width="5"/><path d="M-46 -42 L46 -42" stroke="#e08a52" stroke-width="4"/>
  </g>`;

export function terrainSvg() {
  let strata = '';
  for (let i = 0; i < 9; i++) strata += `<path d="M0 ${150 + i * 66} Q 340 ${135 + i * 66} 683 ${152 + i * 66} T 1366 ${148 + i * 66}" stroke="rgba(143,63,34,0.10)" stroke-width="10" fill="none"/>`;
  return `
    <rect width="1366" height="768" fill="#eeb06a"/>
    ${strata}
    <path d="M0 0 H1366 V120 Q1100 150 900 118 Q683 90 460 124 Q230 152 0 116 Z" fill="#d9874c" ${O}/>
    <path d="M0 90 Q240 120 460 96 Q683 66 900 92 Q1120 120 1366 90" fill="none" stroke="${K}" stroke-width="28" stroke-linecap="round"/>
    <path d="M0 90 Q240 120 460 96 Q683 66 900 92 Q1120 120 1366 90" fill="none" stroke="#3a8ef0" stroke-width="20" stroke-linecap="round"/>
    <path d="M40 92 Q240 118 460 94" fill="none" stroke="#9fd0ff" stroke-width="3" stroke-dasharray="14 22"/>
    ${mesa(70, 470, 0.9)}${mesa(1300, 520, 1.1)}${mesa(1230, 230, 0.8)}${mesa(150, 250, 0.7)}
    ${cactus(240, 470)}${cactus(1090, 470, 0.9)}${cactus(450, 395, 0.8)}${cactus(880, 400, 0.85)}${cactus(1320, 380, 0.8)}
    ${rock(615, 470, 1.2)}${rock(1000, 420, 1)}${rock(60, 610, 1.3)}${rock(1180, 640, 1.1)}${rock(700, 360, 0.9)}
    ${cloud(300, 40, 0.6, 120, 10)}${cloud(1000, 30, 0.7, 140, 60)}`;
}

/* Buildings: origin at the stage tile, drawn above it. */
const scaleLift = `
  <ellipse cx="0" cy="-16" rx="44" ry="8" fill="rgba(0,0,0,0.2)"/>
  <rect x="-24" y="-40" width="48" height="24" rx="3" fill="#c4935a" ${O}/>
  <rect x="-6" y="-92" width="12" height="54" fill="#8a5a2b" ${O}/>
  <g class="sway"><rect x="-46" y="-98" width="92" height="9" rx="4" fill="${PALETTE.gold}" ${O}/>
    <path d="M-40 -89 L-50 -68 L-30 -68 Z M40 -89 L30 -68 L50 -68 Z" fill="none" stroke="${K}" stroke-width="2"/>
    <path d="M-56 -68 Q-40 -58 -24 -68 Z M24 -68 Q40 -58 56 -68 Z" fill="${PALETTE.gold}" ${O2}/></g>
  <circle cx="0" cy="-94" r="6" fill="${PALETTE.red}" ${O2}/>
  <path d="M6 -40 L6 -26 M-6 -40 L-6 -26" stroke="#8a5a2b" stroke-width="3"/>`;

const keyVault = `
  <ellipse cx="0" cy="-16" rx="46" ry="8" fill="rgba(0,0,0,0.2)"/>
  <path d="M-46 -18 L-40 -86 Q0 -104 40 -86 L46 -18 Z" fill="#c8673a" ${O}/>
  <circle cx="0" cy="-52" r="26" fill="#8b90a3" ${O}/>
  <circle cx="0" cy="-52" r="17" fill="#6b6f80" ${O2}/>
  <circle cx="0" cy="-56" r="5" fill="${K}"/><rect x="-2.5" y="-56" width="5" height="11" fill="${K}"/>
  <g class="sway"><g transform="translate(30 -30)"><circle r="7" fill="${PALETTE.gold}" ${O2}/><rect x="-2" y="6" width="4" height="14" fill="${PALETTE.gold}" ${O2}/></g></g>`;

const construction = () => `
  <ellipse cx="0" cy="-16" rx="42" ry="7" fill="rgba(0,0,0,0.18)"/>
  <path d="M-34 -18 V-82 M34 -18 V-82 M-34 -82 H34 M-34 -50 H34 M-34 -82 L34 -50 M34 -82 L-34 -50" stroke="#8a5a2b" stroke-width="5" stroke-linecap="round"/>
  <path d="M-34 -18 V-82 M34 -18 V-82 M-34 -82 H34 M-34 -50 H34" stroke="${K}" stroke-width="1.5" fill="none"/>
  <g transform="translate(0 -30)"><rect x="-30" y="-8" width="60" height="14" rx="3" fill="${PALETTE.gold}" ${O2}/>
    <path d="M-22 -8 L-30 6 M-8 -8 L-16 6 M6 -8 L-2 6 M20 -8 L12 6" stroke="${K}" stroke-width="5"/></g>`;

const golemFort = `
  <ellipse cx="0" cy="-16" rx="60" ry="9" fill="rgba(0,0,0,0.2)"/>
  <path d="M-62 -18 L-48 -78 L48 -78 L62 -18 Z" fill="#a9512b" ${O}/>
  <path d="M-48 -78 v-12 h14 v12 M-7 -78 v-12 h14 v12 M34 -78 v-12 h14 v12" fill="#a9512b" ${O2}/>
  <rect x="-14" y="-50" width="28" height="32" rx="12" fill="#3b2a1d" ${O2}/>
  <circle cx="-26" cy="-58" r="5" fill="${PALETTE.gold}"/><circle cx="26" cy="-58" r="5" fill="${PALETTE.gold}"/>`;

export function buildingSvg(stage, state) {
  if (stage.isBoss) return golemFort + (state === 'wip' ? construction() : '');
  if (!stage.built) return construction();
  if (stage.building === 'scale_lift') return scaleLift;
  if (stage.building === 'key_vault') return keyVault;
  return construction();
}
