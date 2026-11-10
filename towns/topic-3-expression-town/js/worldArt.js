/**
 * Expression Town - Overworld Art Kit
 *
 * Hand-built SVG art for the World 3 overworld: island terrain, river, roads,
 * stage tiles, themed buildings, scenery, and the player hero.
 * Everything is drawn in a fixed 1366 x 658 map space and scales as one image,
 * so it stays crisp on any screen and costs almost nothing on Chromebooks.
 *
 * Style rules: thick ink outlines, flat bold colors, one highlight tone,
 * chunky shapes, and small looping animations (bushes bob, smoke puffs,
 * water shimmers) for a classic 16-bit world-map feel.
 */

import {
  PALETTE, tree, pine, bush, palm, rock, flowers, fence, cottage, boat, cloud, nameplateSvg, heroSvg,
} from '../../../shared/art.js';

export {
  PALETTE, tree, pine, bush, palm, rock, flowers, fence, cottage, boat, cloud, nameplateSvg, heroSvg,
};

export const MAP_W = 1366;
export const MAP_H = 658;

const K = '#1d1433'; // ink outline
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${K}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;


/* ------------------------------------------------------------------ */
/* Shared <defs>: patterns, gradients                                  */
/* ------------------------------------------------------------------ */
export function worldDefs() {
  return `
  <defs>
    <pattern id="grassTex" width="36" height="30" patternUnits="userSpaceOnUse">
      <rect width="36" height="30" fill="${PALETTE.grass}"/>
      <path d="M6 10 l2 -4 l2 4" fill="none" stroke="${PALETTE.grassDark}" stroke-width="2" stroke-linecap="round"/>
      <path d="M24 24 l2 -4 l2 4" fill="none" stroke="${PALETTE.grassDark}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="20" cy="8" r="1.6" fill="${PALETTE.grassLight}"/>
      <circle cx="4" cy="24" r="1.6" fill="${PALETTE.grassLight}"/>
    </pattern>

    <pattern id="waterTex" width="48" height="28" patternUnits="userSpaceOnUse">
      <rect width="48" height="28" fill="${PALETTE.water}"/>
      <path d="M6 9 q4 -4 8 0 t8 0" fill="none" stroke="#a9d6ff" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M28 22 q4 -4 8 0 t8 0" fill="none" stroke="#7fbcff" stroke-width="2.5" stroke-linecap="round"/>
      <animateTransform attributeName="patternTransform" type="translate"
        values="0 0; 6 0; 0 0" dur="1.6s" calcMode="discrete" repeatCount="indefinite"/>
    </pattern>

    <pattern id="hazardTex" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="12" height="12" fill="${PALETTE.gold}"/>
      <rect width="6" height="12" fill="${K}"/>
    </pattern>

    <pattern id="brickTex" width="16" height="10" patternUnits="userSpaceOnUse">
      <rect width="16" height="10" fill="#9a93b0"/>
      <path d="M0 0.5 H16 M0 5.5 H16 M8 0.5 V5.5 M0 5.5 V10 M16 5.5 V10" stroke="#7a7392" stroke-width="1.2"/>
    </pattern>

    <pattern id="redBrickTex" width="14" height="8" patternUnits="userSpaceOnUse">
      <rect width="14" height="8" fill="#c8583f"/>
      <path d="M0 0.5 H14 M0 4.5 H14 M7 0.5 V4.5 M0 4.5 V8 M14 4.5 V8" stroke="#9c3f2c" stroke-width="1"/>
    </pattern>

    <radialGradient id="glowGrad">
      <stop offset="0%" stop-color="#fff7b0" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#ffd23f" stop-opacity="0"/>
    </radialGradient>
  </defs>`;
}

/* ------------------------------------------------------------------ */
/* Terrain                                                             */
/* ------------------------------------------------------------------ */
const ISLAND_PATH = `M 40 150
  C 38 70, 120 44, 230 52
  C 420 66, 520 34, 700 44
  C 900 54, 1050 30, 1200 46
  C 1300 56, 1346 104, 1340 210
  C 1334 330, 1350 450, 1330 540
  C 1312 606, 1220 612, 1100 598
  C 900 578, 700 618, 500 604
  C 320 590, 150 624, 70 580
  C 22 552, 30 452, 30 350
  C 30 262, 42 210, 40 150 Z`;

const RIVER_PATH = 'M 618 20 C 560 170, 650 330, 586 470 S 552 600, 578 660';

function islet(x, y, r, withPalm = true) {
  return `
    <g transform="translate(${x} ${y})">
      <ellipse cx="0" cy="0" rx="${r + 8}" ry="${(r + 8) * 0.55}" fill="${PALETTE.sand}" ${O}/>
      <ellipse cx="0" cy="-3" rx="${r}" ry="${r * 0.45}" fill="${PALETTE.grass}" stroke="${PALETTE.grassDark}" stroke-width="2"/>
      ${withPalm ? palm(4, -4, 0.8) : ''}
    </g>`;
}

export function terrainSvg() {
  return `
    <!-- Ocean -->
    <rect x="-200" y="-200" width="${MAP_W + 400}" height="${MAP_H + 400}" fill="url(#waterTex)"/>

    <!-- Little islets out at sea -->
    ${islet(250, 638, 22)}
    ${islet(1010, 640, 18)}
    ${islet(1200, 650, 12, false)}

    <!-- Main island: ink rim, beach, then grass -->
    <path d="${ISLAND_PATH}" fill="none" stroke="${K}" stroke-width="30" stroke-linejoin="round"/>
    <path d="${ISLAND_PATH}" fill="none" stroke="${PALETTE.sand}" stroke-width="24" stroke-linejoin="round"/>
    <path d="${ISLAND_PATH}" fill="url(#grassTex)" stroke="${PALETTE.grassDark}" stroke-width="3"/>

    <!-- River splitting the island -->
    <path d="${RIVER_PATH}" fill="none" stroke="${PALETTE.sand}" stroke-width="72" stroke-linecap="butt"/>
    <path d="${RIVER_PATH}" fill="none" stroke="${K}" stroke-width="58" stroke-linecap="butt"/>
    <path d="${RIVER_PATH}" fill="none" stroke="url(#waterTex)" stroke-width="52" stroke-linecap="butt"/>
    <path class="river-flow" d="${RIVER_PATH}" fill="none" stroke="#bfe2ff" stroke-width="3" stroke-dasharray="10 26" stroke-linecap="round" opacity="0.85"/>
  `;
}

/* ------------------------------------------------------------------ */
/* Scenery                                                             */
/* ------------------------------------------------------------------ */









export function fountain(x, y) {
  return `
    <g transform="translate(${x} ${y})">
      <ellipse cx="0" cy="0" rx="30" ry="12" fill="#bcb6cc" ${O}/>
      <ellipse cx="0" cy="-2" rx="23" ry="8" fill="#5aaeff" ${O2}/>
      <rect x="-4" y="-22" width="8" height="20" fill="#d9d4e6" ${O2}/>
      <ellipse cx="0" cy="-22" rx="11" ry="4" fill="#d9d4e6" ${O2}/>
      <g class="spout">
        <path d="M0 -24 Q-10 -38 -14 -10" fill="none" stroke="#bfe2ff" stroke-width="3" stroke-linecap="round"/>
        <path d="M0 -24 Q10 -38 14 -10" fill="none" stroke="#bfe2ff" stroke-width="3" stroke-linecap="round"/>
      </g>
    </g>`;
}

export function signpost(x, y, text) {
  const w = text.length * 8 + 14;
  return `
    <g transform="translate(${x} ${y})">
      <rect x="-3" y="-26" width="6" height="28" fill="#8a5a2b" ${O2}/>
      <rect x="${-w / 2}" y="-42" width="${w}" height="18" rx="3" fill="#f3c77a" ${O}/>
      <text x="0" y="-29.5" text-anchor="middle" class="map-px" font-size="8" fill="${K}">${text}</text>
    </g>`;
}


/** The fixed scenery layout. Coordinates are tuned to stay clear of roads, buildings, and labels. */
export function scenerySvg() {
  return `
    ${boat(780, 634)}

    <!-- West woods -->
    ${pine(62, 232, 1, 0)}${pine(96, 206, 1.15, 0.3)}${pine(78, 286, 0.9, 0.15)}
    ${cottage(122, 128, '#3a8ef0')}
    ${tree(150, 320, 0.9, 0.2)}
    ${flowers(300, 300)}

    <!-- Plaza between the Substation and the river -->
    ${fountain(512, 250)}
    ${cottage(520, 150, '#e5484d')}
    ${tree(540, 330, 0.85, 0.4)}
    ${flowers(470, 300)}

    <!-- East of river -->
    ${tree(652, 150, 0.9, 0.25)}
    ${pine(790, 140, 1, 0.1)}${pine(822, 168, 0.9, 0.35)}
    ${cottage(880, 236, '#8b46d8')}
    ${tree(930, 160, 0.85, 0.3)}
    ${flowers(812, 262)}
    ${rock(760, 290, 1)}

    <!-- Far east forest -->
    ${pine(1104, 160, 1.05, 0.2)}${pine(1140, 196, 0.95, 0)}${pine(1092, 236, 0.9, 0.4)}
    ${rock(1180, 330, 1.1)}

    <!-- Between the rows -->
    ${bush(300, 470, 1, 0)}${bush(320, 400, 0.95, 0.2)}
    ${tree(660, 444, 0.85, 0.15)}${bush(770, 466, 1, 0.35)}
    ${bush(948, 466, 1, 0.1)}${bush(1068, 462, 0.95, 0.3)}

    <!-- South meadow below the main road -->
    ${fence(92, 236, 548)}
    ${bush(290, 556, 1.05, 0.25)}${flowers(340, 548)}
    ${tree(410, 568, 0.9, 0.05)}
    ${fence(660, 780, 550)}
    ${rock(700, 572, 1)}${bush(830, 560, 1, 0.4)}
    ${tree(930, 566, 0.85, 0.2)}${flowers(980, 550)}
    ${fence(1060, 1210, 548)}
    ${bush(1250, 548, 1, 0.15)}${palm(1300, 560, 0.9)}

    ${signpost(58, 548, 'START')}
  `;
}

export function cloudsSvg() {
  return `
    ${cloud(160, 70, 0.9, 95, 10)}
    ${cloud(620, 40, 1.1, 120, 55)}
    ${cloud(1050, 92, 0.8, 105, 30)}
  `;
}

/* ------------------------------------------------------------------ */
/* Roads, bridge, stage tiles                                          */
/* ------------------------------------------------------------------ */

/**
 * Waypoints walked when going from node A to node B.
 * Going up: run along A's row, then climb the spur to B.
 * Going down: drop down A's spur first, then run along B's row.
 * This keeps roads out from behind every building.
 */
export function routeBetween(a, b) {
  const A = a.mapCoords;
  const B = b.mapCoords;
  if (A.y === B.y) return [{ ...A }, { ...B }];
  if (B.y < A.y) return [{ ...A }, { x: B.x, y: A.y }, { ...B }];
  return [{ ...A }, { x: A.x, y: B.y }, { ...B }];
}

function polyD(points) {
  return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
}

/** segments: [{ points, open }] */
export function roadsSvg(segments, startPoint) {
  const draw = (d, open) => `
    <path d="${d}" fill="none" stroke="${K}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${open ? PALETTE.road : PALETTE.roadLocked}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${open ? PALETTE.roadDot : PALETTE.roadLockedDot}" stroke-width="4.5" stroke-dasharray="0.1 13" stroke-linecap="round" stroke-linejoin="round"/>`;

  // Locked roads first so open roads always paint on top of shared spurs.
  const sorted = [...segments].sort((a, b) => Number(a.open) - Number(b.open));
  let out = '';
  if (startPoint) {
    out += draw(polyD([{ x: 58, y: startPoint.y }, startPoint]), true);
  }
  sorted.forEach((s) => { out += draw(polyD(s.points), s.open); });
  return out;
}

export function bridgeSvg(x, y) {
  let planks = '';
  for (let i = -36; i < 36; i += 9) {
    planks += `<rect x="${x + i}" y="${y - 16}" width="9" height="32" fill="#c98a4b" stroke="${K}" stroke-width="1.6"/>`;
  }
  return `
    <g>
      <rect x="${x - 40}" y="${y - 18}" width="80" height="36" rx="3" fill="${K}"/>
      ${planks}
      <rect x="${x - 42}" y="${y - 24}" width="84" height="6" rx="2" fill="#8a5a2b" ${O2}/>
      <rect x="${x - 42}" y="${y + 17}" width="84" height="6" rx="2" fill="#8a5a2b" ${O2}/>
      <rect x="${x - 44}" y="${y - 30}" width="8" height="58" rx="2" fill="#a96c35" ${O2}/>
      <rect x="${x + 36}" y="${y - 30}" width="8" height="58" rx="2" fill="#a96c35" ${O2}/>
    </g>`;
}

/** state: 'open' | 'cleared' | 'locked' | 'wip' */
export function stageTileSvg(node, state, isCurrent) {
  const { x, y } = node.mapCoords;
  const isBoss = node.id === 'node_apex';
  const w = isBoss ? 46 : 40;
  const h = 30;
  const fill = state === 'wip' ? 'url(#hazardTex)'
    : state === 'locked' ? '#8f8aa3'
    : state === 'cleared' ? '#2fbf71'
    : isBoss ? PALETTE.red : PALETTE.orange;
  const edge = state === 'locked' ? '#5e5a70' : state === 'cleared' ? '#1b8a4f' : isBoss ? '#a3262b' : '#c25e12';
  const label = isBoss ? '★' : node.lessonCode;

  let glyph;
  if (state === 'locked') {
    glyph = `
      <rect x="-6" y="-4" width="12" height="10" rx="2" fill="${PALETTE.gold}" ${O2}/>
      <path d="M-4 -4 V-8 Q0 -13 4 -8 V-4" fill="none" stroke="${K}" stroke-width="2.4"/>`;
  } else if (state === 'wip') {
    glyph = '';
  } else {
    glyph = `<text x="0" y="5" text-anchor="middle" class="map-px tile-num" font-size="${isBoss ? 13 : 10}" fill="#fff">${label}</text>`;
  }

  return `
    <g class="stage-tile ${isCurrent ? 'is-current' : ''}" transform="translate(${x} ${y})" data-node="${node.id}">
      <ellipse class="tile-glow" cx="0" cy="2" rx="${w * 0.9}" ry="${h * 0.8}" fill="url(#glowGrad)"/>
      <rect x="${-w / 2}" y="${-h / 2 + 5}" width="${w}" height="${h}" rx="7" fill="${edge}" ${O}/>
      <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="7" fill="${fill}" ${O}/>
      <rect x="${-w / 2 + 5}" y="${-h / 2 + 4}" width="${w - 18}" height="3" rx="1.5" fill="#ffffff" opacity="0.45"/>
      ${glyph}
    </g>`;
}

function starShape(cx, cy, r, fill = PALETTE.gold) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.48;
    pts.push(`${(cx + Math.cos(rad) * rr).toFixed(1)},${(cy + Math.sin(rad) * rr).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" ${O2}/>`;
}

/* ------------------------------------------------------------------ */
/* Buildings                                                           */
/* Local coordinates: origin = stage tile center. Buildings stand      */
/* just above (north of) their tile. Each returns { svg, door, top }.  */
/* ------------------------------------------------------------------ */
const shadow = (rx = 58) => `<ellipse cx="0" cy="-20" rx="${rx}" ry="9" fill="rgba(0,0,0,0.25)"/>`;

function door(x, y, w = 18, h = 22, fill = '#6b3f1c') {
  return `
    <rect x="${x - w / 2}" y="${y}" width="${w}" height="${h}" rx="3" fill="${fill}" ${O}/>
    <circle cx="${x + w / 2 - 5}" cy="${y + h / 2 + 1}" r="1.8" fill="${PALETTE.gold}"/>`;
}

const BUILDINGS = {
  power_plant() {
    return {
      top: -128,
      door: { x: 0, y: -42 },
      svg: `
        ${shadow(60)}
        <!-- smokestacks -->
        <rect x="-46" y="-116" width="17" height="70" fill="#eef0f6" ${O}/>
        <rect x="-46" y="-116" width="17" height="9" fill="${PALETTE.red}" ${O2}/>
        <rect x="-46" y="-96" width="17" height="8" fill="${PALETTE.red}" ${O2}/>
        <rect x="-24" y="-102" width="14" height="56" fill="#eef0f6" ${O}/>
        <rect x="-24" y="-102" width="14" height="8" fill="${PALETTE.red}" ${O2}/>
        <g class="smoke"><circle cx="-38" cy="-124" r="7" fill="#f2f2f8" ${O2}/></g>
        <g class="smoke" style="animation-delay:-1.1s"><circle cx="-17" cy="-110" r="6" fill="#f2f2f8" ${O2}/></g>
        <!-- turbine hall -->
        <path d="M-56 -72 L56 -72 L50 -86 L-50 -86 Z" fill="#26388a" ${O}/>
        <rect x="-50" y="-72" width="100" height="52" fill="#3f6fd8" ${O}/>
        <rect x="-50" y="-72" width="100" height="6" fill="#6a93ff"/>
        <rect x="-42" y="-62" width="11" height="11" rx="1" fill="#ffe680" ${O2}/>
        <rect x="31" y="-62" width="11" height="11" rx="1" fill="#ffe680" ${O2}/>
        <rect x="-42" y="-42" width="11" height="11" rx="1" fill="#ffe680" ${O2}/>
        <rect x="31" y="-42" width="11" height="11" rx="1" fill="#ffe680" ${O2}/>
        <!-- big bolt sign -->
        <circle cx="0" cy="-57" r="13" fill="${PALETTE.gold}" ${O}/>
        <path class="bolt-flash" d="M3 -68 L-6 -55 L0 -55 L-3 -46 L7 -59 L1 -59 Z" fill="${K}"/>
        ${door(0, -42, 18, 22, '#1f2a5c')}
        <!-- side generator -->
        <rect x="50" y="-48" width="14" height="28" rx="4" fill="#9aa4b8" ${O}/>
        <path d="M53 -40 H61 M53 -33 H61 M53 -26 H61" stroke="${K}" stroke-width="1.5"/>`,
    };
  },

  bank_vault() {
    return {
      top: -118,
      door: { x: 0, y: -56 },
      svg: `
        ${shadow(60)}
        <rect x="-56" y="-30" width="112" height="9" fill="#d8c79c" ${O}/>
        <rect x="-50" y="-37" width="100" height="8" fill="#e8d9b0" ${O}/>
        <rect x="-46" y="-84" width="92" height="48" fill="#f3e6c4" ${O}/>
        <!-- columns -->
        <rect x="-41" y="-80" width="10" height="44" fill="#fffaf0" ${O2}/>
        <rect x="-25" y="-80" width="10" height="44" fill="#fffaf0" ${O2}/>
        <rect x="15" y="-80" width="10" height="44" fill="#fffaf0" ${O2}/>
        <rect x="31" y="-80" width="10" height="44" fill="#fffaf0" ${O2}/>
        <!-- pediment -->
        <rect x="-54" y="-90" width="108" height="7" fill="#e0b23a" ${O}/>
        <path d="M-56 -90 L0 -116 L56 -90 Z" fill="${PALETTE.gold}" ${O}/>
        <circle cx="0" cy="-99" r="9" fill="#fff0a0" ${O2}/>
        <text x="0" y="-95" text-anchor="middle" class="map-px" font-size="9" fill="${K}">$</text>
        ${door(0, -60, 20, 24, '#7a4b1d')}
        <!-- coin sacks -->
        <path d="M-60 -22 Q-66 -34 -58 -38 L-52 -38 Q-44 -34 -50 -22 Z" fill="#c9a35a" ${O2}/>
        <text x="-55" y="-26" text-anchor="middle" class="map-px" font-size="6" fill="${K}">$</text>`,
    };
  },

  crane_yard() {
    return {
      top: -150,
      door: { x: -18, y: -48 },
      svg: `
        ${shadow(62)}
        <!-- crane mast (lattice) -->
        <rect x="22" y="-138" width="13" height="118" fill="${PALETTE.gold}" ${O}/>
        <path d="M22 -128 L35 -114 M35 -114 L22 -100 M22 -100 L35 -86 M35 -86 L22 -72 M22 -72 L35 -58 M35 -58 L22 -44 M22 -44 L35 -30"
          stroke="${K}" stroke-width="1.8" fill="none"/>
        <!-- jib -->
        <rect x="-46" y="-146" width="100" height="10" fill="${PALETTE.gold}" ${O}/>
        <path d="M-40 -146 L-34 -136 M-28 -146 L-22 -136 M-16 -146 L-10 -136 M-4 -146 L2 -136 M8 -146 L14 -136" stroke="${K}" stroke-width="1.6"/>
        <rect x="40" y="-140" width="16" height="12" fill="#6b6b80" ${O2}/>
        <rect x="18" y="-134" width="22" height="16" rx="2" fill="${PALETTE.red}" ${O}/>
        <rect x="22" y="-130" width="9" height="7" fill="#bfe8ff" stroke="${K}" stroke-width="1.5"/>
        <!-- wrecking ball -->
        <g class="wrecking" style="transform-origin:-36px -136px">
          <line x1="-36" y1="-136" x2="-36" y2="-98" stroke="${K}" stroke-width="2.5"/>
          <circle cx="-36" cy="-90" r="10" fill="#4a4a5e" ${O}/>
          <circle cx="-39" cy="-93" r="3" fill="#8a8aa0"/>
        </g>
        <!-- workshop shed -->
        <rect x="-50" y="-68" width="64" height="48" fill="${PALETTE.orange}" ${O}/>
        <path d="M-54 -68 L-40 -82 L-40 -68 L-26 -82 L-26 -68 L-12 -82 L-12 -68 L2 -82 L2 -68 L16 -68 Z" fill="#c2551a" ${O}/>
        <rect x="-50" y="-30" width="64" height="7" fill="url(#hazardTex)" ${O2}/>
        <rect x="-30" y="-56" width="24" height="26" fill="#5a5a6e" ${O}/>
        <path d="M-30 -50 H-6 M-30 -44 H-6 M-30 -38 H-6" stroke="#8c8ca2" stroke-width="2"/>
        <rect x="-46" y="-62" width="10" height="9" fill="#bfe8ff" ${O2}/>
        <!-- girders pile -->
        <rect x="40" y="-30" width="26" height="6" fill="${PALETTE.red}" ${O2}/>
        <rect x="44" y="-36" width="22" height="6" fill="${PALETTE.red}" ${O2}/>`,
    };
  },

  substation() {
    return {
      top: -122,
      door: { x: 0, y: -44 },
      svg: `
        ${shadow(60)}
        <!-- pylon -->
        <path d="M44 -20 L52 -112 L60 -20" fill="none" stroke="${K}" stroke-width="7" stroke-linejoin="round"/>
        <path d="M44 -20 L52 -112 L60 -20" fill="none" stroke="#b8c0d4" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M40 -96 H64 M42 -70 H62 M46 -44 L58 -70 M58 -44 L46 -70" stroke="${K}" stroke-width="2.5" fill="none"/>
        <!-- transformers on roof -->
        <rect x="-38" y="-102" width="22" height="26" rx="4" fill="#9aa4b8" ${O}/>
        <path d="M-34 -96 V-82 M-28 -96 V-82 M-22 -96 V-82" stroke="#6c7690" stroke-width="2"/>
        <circle cx="-31" cy="-108" r="3.5" fill="#fff" ${O2}/><circle cx="-23" cy="-108" r="3.5" fill="#fff" ${O2}/>
        <rect x="8" y="-104" width="26" height="28" rx="5" fill="#d1873a" ${O}/>
        <path d="M8 -98 H34 M8 -92 H34 M8 -86 H34 M8 -80 H34" stroke="#8a4f17" stroke-width="2"/>
        <path class="spark" d="M-20 -110 L-12 -116 L-6 -108 L2 -116 L6 -110" fill="none" stroke="#fff36b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- station -->
        <rect x="-48" y="-80" width="96" height="10" fill="#137565" ${O}/>
        <rect x="-44" y="-70" width="88" height="50" fill="${PALETTE.teal}" ${O}/>
        <rect x="-44" y="-70" width="88" height="5" fill="#4fe0c9"/>
        <!-- frequency panel -->
        <rect x="-38" y="-62" width="24" height="16" rx="2" fill="${K}"/>
        <path class="wave-scroll" d="M-36 -54 q3 -6 6 0 t6 0 t6 0" fill="none" stroke="#7dffb0" stroke-width="2"/>
        <rect x="14" y="-62" width="24" height="16" rx="2" fill="${K}"/>
        <path d="M16 -54 q2 -6 4 0 t4 0 t4 0 t4 0 t4 0" fill="none" stroke="#ffd23f" stroke-width="2"/>
        ${door(0, -44, 18, 24, '#0e4d43')}`,
    };
  },

  security_vault() {
    return {
      top: -126,
      door: { x: 0, y: -50 },
      svg: `
        ${shadow(60)}
        <path d="M-50 -20 L-50 -78 Q-50 -98 -30 -98 L30 -98 Q50 -98 50 -78 L50 -20 Z" fill="#4a3fb5" ${O}/>
        <path d="M-44 -78 Q-44 -92 -30 -92 L30 -92" fill="none" stroke="#7a6ff0" stroke-width="4" stroke-linecap="round"/>
        <circle cx="-42" cy="-30" r="2" fill="#a7a0ff"/><circle cx="42" cy="-30" r="2" fill="#a7a0ff"/>
        <circle cx="-42" cy="-60" r="2" fill="#a7a0ff"/><circle cx="42" cy="-60" r="2" fill="#a7a0ff"/>
        <!-- cipher banner -->
        <rect x="-32" y="-120" width="64" height="18" rx="3" fill="${K}" ${O2}/>
        <text x="0" y="-107" text-anchor="middle" class="map-px blink-text" font-size="8" fill="#5ef0ff">x=?</text>
        <rect x="-2" y="-102" width="4" height="5" fill="${K}"/>
        <!-- round vault door -->
        <circle cx="0" cy="-50" r="24" fill="#c3cadb" ${O}/>
        <circle cx="0" cy="-50" r="17" fill="#8e98b0" ${O2}/>
        <g class="vault-spin" style="transform-origin:0px -50px">
          <path d="M0 -64 V-36 M-14 -50 H14 M-10 -60 L10 -40 M10 -60 L-10 -40" stroke="${K}" stroke-width="2.5" stroke-linecap="round"/>
        </g>
        <circle cx="0" cy="-50" r="5" fill="${PALETTE.gold}" ${O2}/>
        <!-- keypad -->
        <rect x="30" y="-62" width="12" height="16" rx="2" fill="#222033" ${O2}/>
        <circle cx="36" cy="-57" r="1.5" fill="#7dffb0"/><circle cx="36" cy="-51" r="1.5" fill="#ff6b6b"/>`,
    };
  },

  forge_wip() {
    return {
      top: -128,
      door: { x: 0, y: -40 },
      svg: `
        ${shadow(60)}
        <rect x="-50" y="-30" width="100" height="10" fill="#a8a3b8" ${O}/>
        <!-- half-built brick wall -->
        <path d="M-42 -30 L-42 -60 L-20 -60 L-20 -68 L6 -68 L6 -56 L42 -56 L42 -30 Z" fill="url(#redBrickTex)" ${O}/>
        <!-- scaffolding -->
        <rect x="-48" y="-112" width="7" height="82" fill="#d39a5a" ${O2}/>
        <rect x="41" y="-112" width="7" height="82" fill="#d39a5a" ${O2}/>
        <rect x="-52" y="-114" width="104" height="7" fill="#d39a5a" ${O2}/>
        <rect x="-52" y="-84" width="104" height="6" fill="#d39a5a" ${O2}/>
        <path d="M-41 -107 L41 -84 M41 -107 L-41 -84" stroke="#a46a2f" stroke-width="3"/>
        <!-- coming soon sign -->
        <g class="sign-swing" style="transform-origin:0px -107px">
          <line x1="-14" y1="-107" x2="-14" y2="-100" stroke="${K}" stroke-width="2"/>
          <line x1="14" y1="-107" x2="14" y2="-100" stroke="${K}" stroke-width="2"/>
          <rect x="-28" y="-101" width="56" height="17" rx="3" fill="${PALETTE.gold}" ${O2}/>
          <text x="0" y="-89" text-anchor="middle" class="map-px" font-size="7" fill="${K}">SOON</text>
        </g>
        <!-- hammer tapping -->
        <g class="hammer" style="transform-origin:30px -60px">
          <rect x="28" y="-80" width="4" height="20" fill="#8a5a2b" stroke="${K}" stroke-width="1.5"/>
          <rect x="22" y="-86" width="16" height="8" rx="1" fill="#7a7a90" stroke="${K}" stroke-width="1.5"/>
        </g>
        <!-- barrier + cones -->
        <rect x="-36" y="-42" width="72" height="11" rx="2" fill="url(#hazardTex)" ${O2}/>
        <path d="M-62 -20 L-56 -38 L-50 -20 Z" fill="${PALETTE.orange}" ${O2}/>
        <path d="M-59 -28 H-53" stroke="#fff" stroke-width="2.5"/>
        <path d="M50 -20 L56 -38 L62 -20 Z" fill="${PALETTE.orange}" ${O2}/>
        <path d="M53 -28 H59" stroke="#fff" stroke-width="2.5"/>`,
    };
  },

  drone_depot() {
    return {
      top: -142,
      door: { x: -12, y: -46 },
      svg: `
        ${shadow(62)}
        <!-- windsock -->
        <line x1="50" y1="-20" x2="50" y2="-92" stroke="${K}" stroke-width="3"/>
        <g class="flag-wave"><path d="M51 -92 L74 -88 L74 -80 L51 -76 Z" fill="${PALETTE.orange}" ${O2}/>
        <path d="M59 -90.5 V-77.5 M67 -89 V-79" stroke="#fff" stroke-width="3"/></g>
        <!-- hangar with curved roof -->
        <path d="M-50 -20 L-50 -70 Q-50 -98 -10 -98 Q30 -98 30 -70 L30 -20 Z" fill="#2f80ed" ${O}/>
        <path d="M-42 -72 Q-42 -90 -10 -90 Q22 -90 22 -72" fill="none" stroke="#7fb6ff" stroke-width="4" stroke-linecap="round"/>
        <path d="M-30 -96 V-20 M-10 -98 V-20 M10 -96 V-20" stroke="#1f5fbf" stroke-width="2"/>
        <!-- big hangar door -->
        <rect x="-32" y="-62" width="40" height="42" rx="3" fill="#e8eef9" ${O}/>
        <path d="M-32 -52 H8 M-32 -42 H8 M-32 -32 H8" stroke="#a9b8d4" stroke-width="2"/>
        <rect x="-26" y="-60" width="10" height="7" fill="#bfe8ff" stroke="${K}" stroke-width="1.5"/>
        <!-- parcel stack -->
        <rect x="34" y="-36" width="18" height="16" fill="#d9a85e" ${O2}/>
        <rect x="36" y="-50" width="14" height="14" fill="#e9c27f" ${O2}/>
        <path d="M43 -36 V-20 M43 -50 V-36" stroke="#8a5a2b" stroke-width="2"/>
        <!-- rooftop helipad -->
        <ellipse cx="-10" cy="-100" rx="26" ry="6" fill="#ffd23f" ${O}/>
        <text x="-10" y="-97" text-anchor="middle" class="map-px" font-size="7" fill="${K}">H</text>
        <!-- hovering drone carrying a parcel -->
        <g class="drone-hover">
          <line x1="-10" y1="-120" x2="-10" y2="-112" stroke="${K}" stroke-width="2"/>
          <rect x="-16" y="-114" width="12" height="9" rx="1.5" fill="#d9a85e" ${O2}/>
          <rect x="-24" y="-130" width="28" height="10" rx="4" fill="${PALETTE.red}" ${O}/>
          <rect x="-14" y="-128" width="8" height="5" rx="2" fill="#bfe8ff"/>
          <path d="M-22 -130 V-135 M2 -130 V-135" stroke="${K}" stroke-width="2.5"/>
          <rect class="rotor" x="-32" y="-138" width="20" height="3.5" rx="1.75" fill="#ffffff" ${O2}/>
          <rect class="rotor" x="-8" y="-138" width="20" height="3.5" rx="1.75" fill="#ffffff" ${O2}/>
        </g>`,
    };
  },

  observatory() {
    return {
      top: -134,
      door: { x: -6, y: -44 },
      svg: `
        ${shadow(62)}
        <!-- radio dish on a mast, beaming signal rings -->
        <path d="M44 -20 L44 -66" stroke="${K}" stroke-width="7" stroke-linecap="round"/>
        <path d="M44 -20 L44 -66" stroke="#b8c0d4" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M30 -60 Q40 -92 70 -94 Q58 -70 30 -60 Z" fill="#eef0f6" ${O}/>
        <path d="M50 -77 L60 -86" stroke="${K}" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="61" cy="-87" r="3" fill="${PALETTE.red}" ${O2}/>
        <g class="signal-rings">
          <path d="M68 -100 Q74 -106 72 -114" fill="none" stroke="#7dffb0" stroke-width="3" stroke-linecap="round"/>
          <path d="M74 -96 Q84 -106 80 -120" fill="none" stroke="#7dffb0" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
        </g>
        <!-- main hall -->
        <rect x="-50" y="-66" width="80" height="46" fill="#5b3fc4" ${O}/>
        <rect x="-50" y="-66" width="80" height="5" fill="#8c74ff"/>
        <rect x="-42" y="-56" width="12" height="10" fill="#bfe8ff" stroke="${K}" stroke-width="1.5"/>
        <rect x="18" y="-56" width="10" height="10" fill="#bfe8ff" stroke="${K}" stroke-width="1.5"/>
        <!-- dome with an open slit and telescope -->
        <path d="M-42 -66 Q-42 -112 -6 -112 Q30 -112 30 -66 Z" fill="#d9dceb" ${O}/>
        <path d="M-34 -72 Q-32 -100 -14 -105" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
        <path d="M-12 -111 L-12 -66 M0 -111 L0 -66" stroke="${K}" stroke-width="2"/>
        <rect x="-12" y="-111" width="12" height="45" fill="#2a1f5c"/>
        <path d="M-6 -86 L18 -120" stroke="${K}" stroke-width="11" stroke-linecap="round"/>
        <path d="M-6 -86 L18 -120" stroke="${PALETTE.gold}" stroke-width="6" stroke-linecap="round"/>
        <!-- twinkling stars over the dome -->
        <path class="blink-text" d="M-34 -124 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z" fill="#fff36b" stroke="${K}" stroke-width="1"/>
        <path class="bulb-b" d="M30 -128 l1.5 3.5 l3.5 1.5 l-3.5 1.5 l-1.5 3.5 l-1.5 -3.5 l-3.5 -1.5 l3.5 -1.5 Z" fill="#ffffff" stroke="${K}" stroke-width="1"/>
        ${door(-6, -44, 18, 24, '#2a1f5c')}`,
    };
  },

  arcade() {
    let bulbs = '';
    for (let i = 0; i < 9; i++) {
      bulbs += `<circle class="${i % 2 ? 'bulb-a' : 'bulb-b'}" cx="${-48 + i * 12}" cy="-102" r="2.6" fill="#fff6a8" stroke="${K}" stroke-width="1.2"/>`;
    }
    let awning = '';
    for (let i = 0; i < 8; i++) {
      awning += `<path d="M${-48 + i * 12} -78 h12 v8 a6 6 0 0 1 -12 0 Z" fill="${i % 2 ? '#ffffff' : PALETTE.red}" stroke="${K}" stroke-width="1.8"/>`;
    }
    return {
      top: -136,
      door: { x: 0, y: -46 },
      svg: `
        ${shadow(60)}
        <!-- rooftop target -->
        <rect x="-2" y="-114" width="4" height="12" fill="${K}"/>
        <circle cx="0" cy="-122" r="14" fill="#ffffff" ${O}/>
        <circle cx="0" cy="-122" r="9" fill="${PALETTE.red}" stroke="${K}" stroke-width="1.5"/>
        <circle cx="0" cy="-122" r="4" fill="#ffffff" stroke="${K}" stroke-width="1.5"/>
        <!-- body -->
        <rect x="-50" y="-80" width="100" height="60" fill="${PALETTE.purple}" ${O}/>
        <rect x="-50" y="-80" width="100" height="5" fill="#b77bff"/>
        <!-- marquee -->
        <rect x="-54" y="-108" width="108" height="26" rx="5" fill="#ff4fa3" ${O}/>
        <text x="0" y="-90" text-anchor="middle" class="map-px" font-size="9" fill="#fff" stroke="${K}" stroke-width="2.5" paint-order="stroke">ARCADE</text>
        ${bulbs}
        ${awning}
        <!-- windows with little space critters -->
        <rect x="-44" y="-62" width="22" height="18" rx="2" fill="#24124f" ${O2}/>
        <path d="M-37 -56 h8 v2 h2 v4 h-12 v-4 h2 Z" fill="#7dffb0"/>
        <rect x="22" y="-62" width="22" height="18" rx="2" fill="#24124f" ${O2}/>
        <path d="M29 -56 h8 v2 h2 v4 h-12 v-4 h2 Z" fill="#ffd23f"/>
        ${door(0, -46, 22, 26, '#5ef0ff')}
        <path d="M0 -46 V-20" stroke="${K}" stroke-width="2"/>`,
    };
  },

  castle() {
    const crenels = (x, y, w, n) => {
      let s = '';
      const step = w / n;
      for (let i = 0; i < n; i += 2) s += `<rect x="${x + i * step}" y="${y - 7}" width="${step}" height="8" fill="url(#brickTex)" ${O2}/>`;
      return s;
    };
    return {
      top: -184,
      door: { x: 0, y: -60 },
      svg: `
        <ellipse cx="0" cy="-16" rx="78" ry="12" fill="rgba(0,0,0,0.28)"/>
        <!-- rocky hill -->
        <path d="M-78 -16 Q-74 -46 -46 -50 L46 -50 Q74 -46 78 -16 Z" fill="#7a6a8c" ${O}/>
        <path d="M-60 -30 L-50 -36 M30 -36 L42 -30 M-10 -24 L4 -28" stroke="#5a4c6a" stroke-width="3" stroke-linecap="round"/>
        <!-- side towers -->
        <rect x="-68" y="-132" width="28" height="86" fill="url(#brickTex)" ${O}/>
        <path d="M-73 -132 L-54 -168 L-35 -132 Z" fill="${PALETTE.red}" ${O}/>
        <rect x="40" y="-132" width="28" height="86" fill="url(#brickTex)" ${O}/>
        <path d="M35 -132 L54 -168 L73 -132 Z" fill="${PALETTE.red}" ${O}/>
        <path d="M-58 -112 v-6 a4 4 0 0 1 8 0 v6 Z" fill="#ffe680" class="window-flicker" ${O2}/>
        <path d="M50 -112 v-6 a4 4 0 0 1 8 0 v6 Z" fill="#ffe680" class="window-flicker" ${O2}/>
        <!-- keep -->
        <rect x="-40" y="-124" width="80" height="78" fill="url(#brickTex)" ${O}/>
        ${crenels(-40, -124, 80, 9)}
        <!-- center tower + flag -->
        <rect x="-15" y="-154" width="30" height="32" fill="url(#brickTex)" ${O}/>
        ${crenels(-15, -154, 30, 5)}
        <line x1="0" y1="-160" x2="0" y2="-186" stroke="${K}" stroke-width="3"/>
        <path class="flag-wave" d="M1 -186 L26 -180 L1 -172 Z" fill="#ff4fa3" ${O2}/>
        <!-- glaring eyes -->
        <rect x="-18" y="-104" width="36" height="14" rx="4" fill="${K}"/>
        <path class="eye-glow" d="M-14 -100 L-5 -97 L-14 -94 Z M14 -100 L5 -97 L14 -94 Z" fill="#ff5a5a"/>
        <!-- gate -->
        <path d="M-18 -46 L-18 -70 Q0 -88 18 -70 L18 -46 Z" fill="${K}" ${O}/>
        <path d="M-12 -46 V-74 M-4 -46 V-80 M4 -46 V-80 M12 -46 V-74 M-18 -62 H18" stroke="#6b6880" stroke-width="2"/>`,
    };
  },
};

export function buildingArt(type) {
  const fn = BUILDINGS[type] || BUILDINGS.power_plant;
  return fn();
}

export function lockOverlay(doorPos) {
  const { x, y } = doorPos;
  return `
    <g transform="translate(${x} ${y + 8})">
      <path d="M-14 -6 L14 10 M14 -6 L-14 10" stroke="#5e5a70" stroke-width="5" stroke-linecap="round"/>
      <path d="M-14 -6 L14 10 M14 -6 L-14 10" stroke="#b9b5c8" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="-8" y="-2" width="16" height="13" rx="2.5" fill="${PALETTE.gold}" ${O2}/>
      <path d="M-5 -2 V-7 Q0 -13 5 -7 V-2" fill="none" stroke="${K}" stroke-width="2.6"/>
      <rect x="-1.2" y="3" width="2.4" height="5" rx="1" fill="${K}"/>
    </g>`;
}

/** Victory flag planted beside a cleared stage tile (tile-local coords). */
export function clearedFlag() {
  return `
    <g transform="translate(26 4)">
      <line x1="0" y1="0" x2="0" y2="-40" stroke="${K}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="0" cy="-42" r="3" fill="${PALETTE.gold}" ${O2}/>
      <path class="flag-wave" d="M1 -39 L24 -32 L1 -24 Z" fill="#2fbf71" ${O2}/>
      ${starShape(9, -31.5, 4, '#ffffff')}
    </g>`;
}


/* ------------------------------------------------------------------ */
/* Badge icons (status-bar cards, briefing, victory)                   */
/* viewBox -16 -16 32 32                                               */
/* ------------------------------------------------------------------ */
const BADGES = {
  power_plant: `<circle r="13" fill="${PALETTE.gold}" ${O2}/><path d="M3 -10 L-6 2 L0 2 L-3 11 L7 -3 L1 -3 Z" fill="${K}"/>`,
  bank_vault: `<circle r="13" fill="#ffe680" ${O2}/><circle r="9" fill="none" stroke="#d1a21e" stroke-width="2"/><text y="5" text-anchor="middle" class="map-px" font-size="12" fill="${K}">$</text>`,
  crane_yard: `<path d="M-12 4 Q-12 -10 0 -11 Q12 -10 12 4 Z" fill="${PALETTE.gold}" ${O2}/><rect x="-14" y="3" width="28" height="5" rx="2" fill="${PALETTE.orange}" ${O2}/><rect x="-2" y="-11" width="4" height="9" fill="#ffffff" opacity="0.7"/>`,
  substation: `<rect x="-8" y="-11" width="16" height="23" rx="3" fill="${PALETTE.teal}" ${O2}/><rect x="-3" y="-14" width="6" height="4" fill="${K}"/><path d="M2 -7 L-3 1 L1 1 L-1 7 L4 -1 L0 -1 Z" fill="#fff36b"/>`,
  security_vault: `<circle cx="-4" cy="-3" r="7" fill="none" stroke="${K}" stroke-width="5"/><circle cx="-4" cy="-3" r="7" fill="none" stroke="${PALETTE.gold}" stroke-width="2.5"/><path d="M1 2 L11 12 M7 8 L10 5 M9 10 L12 7" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M1 2 L11 12 M7 8 L10 5 M9 10 L12 7" stroke="${PALETTE.gold}" stroke-width="2.4" stroke-linecap="round"/>`,
  forge_wip: `<rect x="-12" y="-4" width="24" height="10" rx="2" fill="url(#hazardTexMini)" ${O2}/><path d="M-8 6 V11 M8 6 V11" stroke="${K}" stroke-width="3"/>`,
  drone_depot: `<path d="M0 -2 Q-8 -12 -15 -6 Q-9 -3 -6 2 Z M0 -2 Q8 -12 15 -6 Q9 -3 6 2 Z" fill="#ffffff" ${O2}/><rect x="-6" y="-5" width="12" height="9" rx="3" fill="${PALETTE.red}" ${O2}/><rect x="-5" y="5" width="10" height="7" rx="1.5" fill="#d9a85e" ${O2}/>`,
  observatory: `<path d="M-12 8 Q-12 -10 0 -10 Q12 -10 12 8 Z" fill="#d9dceb" ${O2}/><rect x="-3" y="-10" width="6" height="18" fill="#2a1f5c"/><path d="M0 -1 L9 -13" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M0 -1 L9 -13" stroke="${PALETTE.gold}" stroke-width="2.5" stroke-linecap="round"/><rect x="-14" y="7" width="28" height="5" rx="2" fill="#5b3fc4" ${O2}/>`,
  arcade: `<circle r="13" fill="#fff" ${O2}/><circle r="8.5" fill="${PALETTE.red}" stroke="${K}" stroke-width="1.5"/><circle r="4" fill="#fff" stroke="${K}" stroke-width="1.5"/>`,
  castle: `<path d="M-12 8 L-12 -6 L-6 1 L0 -12 L6 1 L12 -6 L12 8 Z" fill="${PALETTE.gold}" ${O2}/><circle cx="0" cy="2" r="2.5" fill="${PALETTE.red}"/>`,
};

export function badgeIconSvg(type, size = 28) {
  return `<svg viewBox="-16 -16 32 32" width="${size}" height="${size}" aria-hidden="true">${worldDefsMini()}${BADGES[type] || BADGES.castle}</svg>`;
}

function worldDefsMini() {
  return `<defs><pattern id="hazardTexMini" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="${PALETTE.gold}"/><rect width="4" height="8" fill="${K}"/></pattern></defs>`;
}

/* ------------------------------------------------------------------ */
/* Hero sprite (origin at feet)                                        */
/* ------------------------------------------------------------------ */
