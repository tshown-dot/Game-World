// Super Map art: the pixel-tile continent (drawn on a canvas) and the landmarks, road and town tiles (SVG).
// The small props (trees, clouds, hero, nameplates) are borrowed from Expression Town's art so the whole
// world shares one look. They will move to shared/ once a second town needs them too.

import {
  PALETTE, tree, pine, bush, palm, rock, flowers, cottage, boat, cloud, nameplateSvg, heroSvg,
} from '../towns/topic-3-expression-town/js/worldArt.js';

export { heroSvg };

export const MAP_W = 1366;
export const MAP_H = 768;
const K = PALETTE.ink;
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${K}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;

/** Where each town sits on the Super Map (the town tile; the landmark is drawn just above). */
export const TOWN_POINTS = {
  1: { x: 210, y: 540 },
  2: { x: 450, y: 592 },
  3: { x: 700, y: 520 },
  4: { x: 962, y: 588 },
  5: { x: 1180, y: 452 },
  6: { x: 1040, y: 258 },
  7: { x: 700, y: 240 },
  8: { x: 352, y: 250 },
};

export const BIOMES = {
  harbor:    { label: 'Harbor coast',     tiles: ['#f2d58a', '#ead07f'] },
  highlands: { label: 'Rocky highlands',  tiles: ['#8fb86b', '#86ad63'] },
  meadow:    { label: 'Green meadow',     tiles: ['#5cc84f', '#55bf49'] },
  canyon:    { label: 'Red rock canyon',  tiles: ['#e8a15c', '#df9752'] },
  swamp:     { label: 'Misty swamp',      tiles: ['#5f9e83', '#58967b'] },
  volcano:   { label: 'Volcano fields',   tiles: ['#7b6168', '#735a61'] },
  tundra:    { label: 'Frozen tundra',    tiles: ['#e3f0ff', '#d8e8fb'] },
  sky:       { label: 'Cloud kingdom',    tiles: ['#c4b2ff', '#bba8fb'] },
};

/* ------------------------------------------------------------------ */
/* Land: pixel tiles on a canvas                                       */
/* ------------------------------------------------------------------ */
const TILE = 16;

// Deterministic "random" so the map looks the same every visit.
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function isLand(x, y) {
  const cx = 690, cy = 386, rx = 640, ry = 300;
  const dx = (x - cx) / rx, dy = (y - cy) / ry;
  const angle = Math.atan2(dy, dx);
  const wobble = 1 + 0.05 * Math.sin(3 * angle + 1) + 0.035 * Math.sin(7 * angle + 2) + 0.02 * Math.sin(13 * angle);
  return Math.pow(Math.abs(dx), 3.2) + Math.pow(Math.abs(dy), 3.2) < Math.pow(wobble, 3.2);
}

/** Which town's region a map point belongs to (nearest town, with wavy borders). */
export function regionAt(x, y, towns) {
  let best = null, bestD = Infinity;
  for (const t of towns) {
    const p = TOWN_POINTS[t.number];
    const noise = Math.sin(x * 0.035 + t.number * 1.7) * 22 + Math.cos(y * 0.04 - t.number) * 22
      + Math.sin((x + y) * 0.06 + t.number) * 12;
    const d = Math.hypot(x - p.x, y - (p.y - 40)) + noise;
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgb([r, g, b]) { return `rgb(${r | 0},${g | 0},${b | 0})`; }
function greyed(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  return [r + (l - r) * amount, g + (l - g) * amount, b + (l - b) * amount].map((v) => v * (1 - amount * 0.12));
}

/** Paints ocean, coast and the 8 biome regions. States: { [townNumber]: 'open' | 'locked' | 'soon' } */
export function drawLand(canvas, towns, states) {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = MAP_W * dpr;
  canvas.height = MAP_H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = false;

  const cols = Math.ceil(MAP_W / TILE), rows = Math.ceil(MAP_H / TILE);
  const regionGrid = [];
  for (let r = 0; r < rows; r++) {
    regionGrid.push([]);
    for (let c = 0; c < cols; c++) {
      const x = c * TILE + TILE / 2, y = r * TILE + TILE / 2;
      regionGrid[r].push(isLand(x, y) ? regionAt(x, y, towns) : null);
    }
  }
  const landAt = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols && regionGrid[r][c];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * TILE, y = r * TILE;
      const region = regionGrid[r][c];
      const n = hash(c, r);
      let color;
      if (!region) {
        const nearLand = landAt(r - 1, c) || landAt(r + 1, c) || landAt(r, c - 1) || landAt(r, c + 1);
        color = nearLand ? [120, 190, 255] : n < 0.06 ? [86, 165, 248] : [58, 142, 240];
      } else {
        const coast = !landAt(r - 1, c) || !landAt(r + 1, c) || !landAt(r, c - 1) || !landAt(r, c + 1);
        const biome = BIOMES[region.biome];
        const base = coast && region.biome !== 'sky' && region.biome !== 'tundra' ? '#f6dc8f' : biome.tiles[n < 0.5 ? 0 : 1];
        const state = states[region.number];
        color = state === 'open' ? hexToRgb(base) : greyed(base, state === 'soon' ? 0.45 : 0.35);
      }
      ctx.fillStyle = rgb(color);
      ctx.fillRect(x, y, TILE, TILE);
      if (region && n > 0.82) {                         // little texture specks
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x + 4, y + 5, 4, 4);
      }
    }
  }
  // Region borders: a dark line where two regions meet.
  ctx.fillStyle = 'rgba(29,20,51,0.45)';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = regionGrid[r][c];
      if (!a) continue;
      const right = landAt(r, c + 1), down = landAt(r + 1, c);
      if (right && right !== a) ctx.fillRect((c + 1) * TILE - 2, r * TILE, 3, TILE);
      if (down && down !== a) ctx.fillRect(c * TILE, (r + 1) * TILE - 2, TILE, 3);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */
const mountain = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <path d="M-34 0 L-6 -52 L4 -40 L12 -50 L36 0 Z" fill="#8d8aa3" ${O}/>
    <path d="M-12 -40 L-6 -52 L0 -44 L4 -40 L-2 -36 Z" fill="#ffffff" ${O2}/>
    <path d="M8 -44 L12 -50 L17 -40 Z" fill="#ffffff" ${O2}/>
  </g>`;
const mesa = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <path d="M-34 0 L-24 -38 L24 -38 L34 0 Z" fill="#c8673a" ${O}/>
    <path d="M-28 -18 L28 -18" stroke="#a9512b" stroke-width="4"/>
    <path d="M-25 -30 L25 -30" stroke="#e08a52" stroke-width="3"/>
  </g>`;
const cactus = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-5" y="-34" width="10" height="34" rx="5" fill="#3fa53a" ${O2}/>
    <path d="M-5 -18 L-13 -18 L-13 -28" fill="none" stroke="${K}" stroke-width="8" stroke-linecap="round"/>
    <path d="M-5 -18 L-13 -18 L-13 -28" fill="none" stroke="#3fa53a" stroke-width="4" stroke-linecap="round"/>
    <path d="M5 -12 L12 -12 L12 -22" fill="none" stroke="${K}" stroke-width="8" stroke-linecap="round"/>
    <path d="M5 -12 L12 -12 L12 -22" fill="none" stroke="#3fa53a" stroke-width="4" stroke-linecap="round"/>
  </g>`;
const mushroom = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-4" y="-12" width="8" height="12" rx="2" fill="#fff4d6" ${O2}/>
    <path d="M-13 -11 Q-13 -26 0 -26 Q13 -26 13 -11 Z" fill="#e5484d" ${O2}/>
    <circle cx="-5" cy="-18" r="2.5" fill="#fff"/><circle cx="5" cy="-20" r="2" fill="#fff"/>
  </g>`;
const pond = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <ellipse rx="30" ry="12" fill="#3f8f8a" ${O2}/>
    <ellipse cx="-10" cy="-2" rx="7" ry="3" fill="#7fd36a" ${O2}/>
    <ellipse cx="9" cy="3" rx="6" ry="2.5" fill="#7fd36a" ${O2}/>
  </g>`;
const lava = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <ellipse rx="26" ry="10" fill="#ff8a2b" ${O2}/>
    <ellipse cx="-6" cy="-1" rx="10" ry="4" fill="#ffd23f" class="lava-glow"/>
  </g>`;
const crystal = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <path d="M0 -30 L9 -12 L0 0 L-9 -12 Z" fill="#9fdcff" ${O2}/>
    <path d="M0 -30 L0 0" stroke="#ffffff" stroke-width="2"/>
  </g>`;
const snowPine = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-3" y="-10" width="6" height="12" fill="#8a5a2b" ${O2}/>
    <path d="M0 -50 L16 -22 L9 -22 L19 -8 L-19 -8 L-9 -22 L-16 -22 Z" fill="#2f7f63" ${O}/>
    <path d="M0 -50 L8 -36 L-8 -36 Z M-12 -22 L12 -22 L9 -18 L-9 -18 Z" fill="#ffffff"/>
  </g>`;
const star = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})" class="twinkle">
    <path d="M0 -10 L3 -3 L10 0 L3 3 L0 10 L-3 3 L-10 0 L-3 -3 Z" fill="#fff36b" ${O2}/>
  </g>`;
const puff = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <path d="M-26 6 Q-32 -4 -20 -8 Q-16 -20 -2 -16 Q8 -24 18 -12 Q30 -10 26 4 Z" fill="#ffffff" ${O2}/>
  </g>`;
const pier = (x, y) => `
  <g transform="translate(${x} ${y})">
    <rect x="0" y="-6" width="56" height="10" fill="#c4935a" ${O2}/>
    <rect x="10" y="4" width="5" height="10" fill="#8a5a2b" ${O2}/><rect x="40" y="4" width="5" height="10" fill="#8a5a2b" ${O2}/>
  </g>`;

/* ------------------------------------------------------------------ */
/* Landmarks (origin at the town tile; drawn above it)                 */
/* ------------------------------------------------------------------ */
const LANDMARKS = {
  harbor: `
    <rect x="-14" y="-86" width="28" height="62" fill="#ffffff" ${O}/>
    <rect x="-14" y="-70" width="28" height="12" fill="#e5484d"/><rect x="-14" y="-46" width="28" height="12" fill="#e5484d"/>
    <rect x="-14" y="-86" width="28" height="62" fill="none" ${O}/>
    <rect x="-18" y="-98" width="36" height="14" rx="3" fill="#ffd23f" ${O} class="beacon"/>
    <path d="M-20 -98 L0 -114 L20 -98 Z" fill="#e5484d" ${O}/>`,
  highlands: `
    <path d="M-46 -24 L-16 -96 L0 -76 L14 -100 L48 -24 Z" fill="#7d7a95" ${O}/>
    <path d="M-24 -78 L-16 -96 L-8 -84 Z M8 -88 L14 -100 L22 -84 Z" fill="#fff" ${O2}/>
    <rect x="-16" y="-62" width="32" height="38" fill="#c9c3b6" ${O}/>
    <path d="M-16 -62 v-8 h8 v8 M-4 -62 v-8 h8 v8 M8 -62 v-8 h8 v8" fill="#c9c3b6" ${O2}/>
    <rect x="-6" y="-42" width="12" height="18" rx="5" fill="#5a3d24" ${O2}/>`,
  meadow: `
    <rect x="-30" y="-58" width="60" height="34" fill="#fff1cf" ${O}/>
    <path d="M-36 -56 L0 -80 L36 -56 Z" fill="#e5484d" ${O}/>
    <rect x="-10" y="-112" width="20" height="40" fill="#fff1cf" ${O}/>
    <path d="M-14 -110 L0 -126 L14 -110 Z" fill="#7b4bff" ${O}/>
    <circle cx="0" cy="-94" r="7" fill="#ffffff" ${O2}/><path d="M0 -94 v-4 M0 -94 h3" stroke="${K}" stroke-width="2"/>
    <rect x="-6" y="-40" width="12" height="16" fill="#8a5a2b" ${O2}/>
    <rect x="-24" y="-48" width="9" height="9" fill="#7fd3ff" ${O2}/><rect x="15" y="-48" width="9" height="9" fill="#7fd3ff" ${O2}/>`,
  canyon: `
    <rect x="-4" y="-92" width="8" height="68" fill="#8a5a2b" ${O}/>
    <rect x="-24" y="-30" width="48" height="8" rx="3" fill="#c4935a" ${O}/>
    <g class="scale-tip">
      <rect x="-50" y="-96" width="100" height="7" rx="3" fill="#ffd23f" ${O}/>
      <path d="M-44 -89 L-56 -66 L-32 -66 Z M44 -89 L32 -66 L56 -66 Z" fill="none" stroke="${K}" stroke-width="2"/>
      <path d="M-60 -66 Q-44 -54 -28 -66 Z" fill="#ffd23f" ${O2}/>
      <path d="M28 -66 Q44 -54 60 -66 Z" fill="#ffd23f" ${O2}/>
      <text x="-44" y="-70" text-anchor="middle" class="map-px" font-size="9" fill="${K}">x</text>
      <text x="44" y="-70" text-anchor="middle" class="map-px" font-size="9" fill="${K}">7</text>
    </g>
    <circle cx="0" cy="-94" r="6" fill="#e5484d" ${O2}/>`,
  swamp: `
    <path d="M-28 -24 v-14 M28 -24 v-14 M-10 -24 v-14 M10 -24 v-14" stroke="${K}" stroke-width="5"/>
    <path d="M-28 -24 v-14 M28 -24 v-14 M-10 -24 v-14 M10 -24 v-14" stroke="#8a5a2b" stroke-width="2.5"/>
    <rect x="-34" y="-42" width="68" height="8" fill="#a8774a" ${O}/>
    <rect x="-22" y="-74" width="44" height="32" fill="#7a5638" ${O}/>
    <path d="M-30 -72 L0 -100 L30 -72 Z" fill="#5f9e83" ${O}/>
    <rect x="-6" y="-62" width="12" height="20" fill="#3b2a1d" ${O2}/>`,
  volcano: `
    <path d="M-56 -24 L-14 -96 L14 -96 L56 -24 Z" fill="#5a4248" ${O}/>
    <path d="M-14 -96 L14 -96 L8 -84 L0 -90 L-8 -82 Z" fill="#ff8a2b" ${O2}/>
    <path d="M-4 -86 L-10 -60 L-2 -64 L-6 -40" fill="none" stroke="#ff8a2b" stroke-width="4" stroke-linecap="round"/>
    <g class="volcano-smoke"><circle cx="-4" cy="-110" r="9" fill="#cfc6d6" ${O2}/><circle cx="8" cy="-124" r="7" fill="#cfc6d6" ${O2}/></g>`,
  tundra: `
    <rect x="-34" y="-62" width="20" height="38" fill="#cfeaff" ${O}/>
    <rect x="14" y="-62" width="20" height="38" fill="#cfeaff" ${O}/>
    <rect x="-14" y="-82" width="28" height="58" fill="#e8f6ff" ${O}/>
    <path d="M-38 -60 L-24 -78 L-10 -60 Z M10 -60 L24 -78 L38 -60 Z M-18 -80 L0 -104 L18 -80 Z" fill="#9fdcff" ${O}/>
    <path d="M-8 -24 v-16 a8 8 0 0 1 16 0 v16" fill="#5aaeff" ${O2}/>`,
  sky: `
    <path d="M-50 -26 Q-60 -40 -40 -44 Q-30 -58 -10 -50 Q6 -62 24 -50 Q46 -54 50 -38 Q62 -30 48 -22 Z" fill="#ffffff" ${O}/>
    <rect x="-24" y="-82" width="48" height="36" fill="#a989ff" ${O}/>
    <rect x="-34" y="-96" width="16" height="52" fill="#8b6bf0" ${O}/><rect x="18" y="-96" width="16" height="52" fill="#8b6bf0" ${O}/>
    <path d="M-38 -94 L-26 -112 L-14 -94 Z M14 -94 L26 -112 L38 -94 Z M-20 -80 L0 -104 L20 -80 Z" fill="#ffd23f" ${O}/>
    <rect x="-6" y="-66" width="12" height="20" rx="6" fill="#4a2f9e" ${O2}/>`,
};

/* Scatter props for each biome, as [prop, dx, dy, scale] around the town tile. Tuned to stay off the road. */
const PROPS = {
  harbor:    [[palm, -78, -18, 1], [palm, 70, -54, 0.9], [rock, -44, 30, 1], [flowers, 46, 12], [pier, -150, 28], [boat, -172, 46]],
  highlands: [[mountain, -86, -40, 1], [mountain, 92, -20, 0.8], [pine, -54, 14, 0.9], [pine, 64, 26, 1], [rock, 30, 34, 1.1]],
  meadow:    [[tree, -82, -10, 1], [tree, 88, -40, 0.9], [bush, -46, 30, 1], [cottage, 72, 24], [flowers, -110, 34], [flowers, 34, 40]],
  canyon:    [[mesa, -92, -28, 1], [mesa, 96, -60, 0.8], [cactus, -50, 26, 1], [cactus, 66, 30, 0.85], [rock, 110, 18, 1]],
  swamp:     [[pond, -84, -6, 1], [pond, 50, 40, 0.8], [mushroom, 72, -18, 1], [mushroom, -44, 34, 0.8], [bush, -100, 40, 0.9]],
  volcano:   [[lava, -88, 0, 1], [lava, 84, -30, 0.8], [rock, -46, 30, 1.2], [rock, 56, 22, 1], [rock, 100, 30, 0.8]],
  tundra:    [[snowPine, -80, -14, 1], [snowPine, 84, -34, 0.9], [crystal, -40, 30, 1], [crystal, 52, 28, 0.8], [snowPine, 120, 8, 0.8]],
  sky:       [[puff, -92, -30, 1], [puff, 96, -50, 0.9], [star, -50, -110, 1], [star, 70, -100, 0.8], [star, 110, 10, 0.9]],
};

/* ------------------------------------------------------------------ */
/* Road, town tiles, nameplates                                        */
/* ------------------------------------------------------------------ */
export function roadSvg(towns, states) {
  let out = '';
  for (let i = 0; i < towns.length - 1; i++) {
    const a = TOWN_POINTS[towns[i].number], b = TOWN_POINTS[towns[i + 1].number];
    const lit = states[towns[i + 1].number] === 'open' && states[towns[i].number] === 'open';
    const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.12, my = (a.y + b.y) / 2 - (b.x - a.x) * 0.12;
    const d = `M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`;
    out += `<path d="${d}" fill="none" stroke="${K}" stroke-width="20" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="${lit ? PALETTE.road : PALETTE.roadLocked}" stroke-width="14" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="${lit ? PALETTE.roadDot : PALETTE.roadLockedDot}" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round"/>`;
  }
  return out;
}

/** The midpoint control used by the road curve, so the hero can walk the same curve. */
export function roadCurve(a, b) {
  const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.12, my = (a.y + b.y) / 2 - (b.x - a.x) * 0.12;
  return (t) => ({
    x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x,
    y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * b.y,
  });
}

function townTile(number, state, cleared) {
  const fill = state === 'open' ? (cleared ? PALETTE.gold : '#fff4d6') : '#c9c3b6';
  const label = state === 'soon' ? '?' : String(number);
  return `
    <ellipse cx="0" cy="6" rx="24" ry="7" fill="rgba(0,0,0,0.25)"/>
    <circle r="20" fill="${fill}" ${O}/>
    <text y="5" text-anchor="middle" class="map-px" font-size="13" fill="${K}">${label}</text>
    ${state === 'locked' ? `<g transform="translate(16 -14)"><rect x="-8" y="-4" width="16" height="13" rx="2" fill="${PALETTE.gold}" ${O2}/><path d="M-5 -4 v-4 a5 5 0 0 1 10 0 v4" fill="none" ${O2}/></g>` : ''}
    ${cleared ? `<g transform="translate(17 -15)"><path d="M0 -9 L2.6 -3 L9 -2.8 L4 1.4 L5.6 8 L0 4.4 L-5.6 8 L-4 1.4 L-9 -2.8 L-2.6 -3 Z" fill="${PALETTE.gold}" ${O2}/></g>` : ''}`;
}

/** Everything drawn on top of the land: props, landmarks, town tiles and nameplates. */
export function townsSvg(entries, currentNumber) {
  return entries.map(({ town, state, summary }) => {
    const p = TOWN_POINTS[town.number];
    const props = (PROPS[town.biome] || []).map(([fn, dx, dy, s]) => fn(p.x + dx, p.y + dy, s)).join('');
    const plate = town.name;
    return `
      <g class="region region-${state}" data-town="${town.number}">
        ${props}
        <g transform="translate(${p.x} ${p.y})" class="town-hit" data-town="${town.number}" style="cursor:pointer">
          <g class="landmark">${LANDMARKS[town.biome] || ''}</g>
          ${townTile(town.number, state, summary.bossBeaten)}
          <g transform="translate(0 0)">${nameplateSvg(plate, town.biome === 'meadow' ? -140 : -126, town.number === currentNumber)}</g>
          ${state === 'soon' ? `<g transform="translate(0 40)"><rect x="-46" y="-10" width="92" height="17" rx="4" fill="#1d1433"/><text y="3" text-anchor="middle" class="map-px" font-size="7" fill="#ffd23f">COMING SOON</text></g>` : ''}
        </g>
      </g>`;
  }).join('');
}

export function cloudsLayer() {
  return cloud(200, 120, 0.8, 90, 10) + cloud(700, 90, 0.7, 110, 50) + cloud(1100, 150, 0.9, 100, 80) + cloud(400, 680, 0.6, 120, 30);
}
