// Shared art for Game World: small pixel-style props used by the Super Map and every town.
// Every function returns an SVG string. Origin is at the base of the prop unless noted.

const K = '#1d1433'; // ink outline
const O = `stroke="${K}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${K}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;

export const PALETTE = {
  ink: K,
  grass: '#5cc84f',
  grassDark: '#3fa53a',
  grassLight: '#86e06a',
  sand: '#f6dc8f',
  water: '#3a8ef0',
  waterDark: '#2a6fd0',
  road: '#f3dca4',
  roadDot: '#c99a52',
  roadLocked: '#c9c3b6',
  roadLockedDot: '#9b958b',
  gold: '#ffd23f',
  orange: '#ff8a2b',
  red: '#e5484d',
  teal: '#19b3a6',
  purple: '#8b46d8',
  cream: '#fff4d6',
};

export function tree(x, y, s = 1, delay = 0) {
  return `
    <g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="0" cy="2" rx="16" ry="5" fill="rgba(0,0,0,0.22)"/>
      <rect x="-4" y="-16" width="8" height="18" rx="2" fill="#8a5a2b" ${O2}/>
      <g class="sway" style="animation-delay:${delay}s">
        <circle cx="0" cy="-30" r="19" fill="#2f9a43" ${O}/>
        <circle cx="-6" cy="-36" r="8" fill="#56c25a"/>
        <circle cx="7" cy="-27" r="3" fill="#56c25a"/>
      </g>
    </g>`;
}

export function pine(x, y, s = 1, delay = 0) {
  return `
    <g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="0" cy="2" rx="13" ry="4" fill="rgba(0,0,0,0.22)"/>
      <rect x="-3" y="-10" width="6" height="12" fill="#8a5a2b" ${O2}/>
      <g class="sway" style="animation-delay:${delay}s">
        <path d="M0 -50 L16 -22 L9 -22 L19 -8 L-19 -8 L-9 -22 L-16 -22 Z" fill="#1f8a4c" ${O}/>
        <path d="M0 -44 L-7 -30" stroke="#4cc36e" stroke-width="3" stroke-linecap="round"/>
      </g>
    </g>`;
}

export function bush(x, y, s = 1, delay = 0) {
  return `
    <g transform="translate(${x} ${y}) scale(${s})">
      <g class="bob" style="animation-delay:${delay}s">
        <path d="M-18 0 Q-22 -12 -11 -14 Q-8 -24 2 -20 Q12 -26 16 -14 Q24 -10 18 0 Z" fill="#3fb34a" ${O}/>
        <circle cx="-7" cy="-14" r="3" fill="#7fe07a"/>
        <circle cx="6" cy="-17" r="2.5" fill="#7fe07a"/>
      </g>
    </g>`;
}

export function palm(x, y, s = 1) {
  return `
    <g transform="translate(${x} ${y}) scale(${s})">
      <path d="M0 0 Q4 -18 -2 -36" fill="none" stroke="${K}" stroke-width="8" stroke-linecap="round"/>
      <path d="M0 0 Q4 -18 -2 -36" fill="none" stroke="#b07a3e" stroke-width="4.5" stroke-linecap="round"/>
      <g class="sway">
        <path d="M-2 -36 Q-18 -46 -28 -32 Q-16 -38 -2 -36 Z" fill="#2fae4f" ${O2}/>
        <path d="M-2 -36 Q14 -48 26 -34 Q12 -40 -2 -36 Z" fill="#2fae4f" ${O2}/>
        <path d="M-2 -36 Q-6 -54 6 -56 Q0 -46 -2 -36 Z" fill="#43c25f" ${O2}/>
      </g>
    </g>`;
}

export function rock(x, y, s = 1) {
  return `
    <g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-12 0 L-9 -9 L-1 -13 L9 -10 L13 0 Z" fill="#a7a2b8" ${O2}/>
      <path d="M-6 -8 L-1 -10" stroke="#d6d2e2" stroke-width="2" stroke-linecap="round"/>
    </g>`;
}

export function flowers(x, y) {
  const f = (dx, dy, c) => `
    <circle cx="${x + dx}" cy="${y + dy}" r="3.5" fill="${c}" stroke="${K}" stroke-width="1.5"/>
    <circle cx="${x + dx}" cy="${y + dy}" r="1.2" fill="#fff7b0"/>`;
  return f(0, 0, '#ff5d8f') + f(10, 4, '#ffffff') + f(-8, 6, '#ffd23f') + f(4, 10, '#ff5d8f');
}

export function fence(x1, x2, y) {
  let posts = '';
  for (let x = x1; x <= x2; x += 18) {
    posts += `<rect x="${x - 3}" y="${y - 16}" width="6" height="18" rx="1.5" fill="#e9c27f" ${O2}/>`;
  }
  return `
    <g>
      <rect x="${x1}" y="${y - 12}" width="${x2 - x1}" height="4" fill="#d9a85e" ${O2}/>
      <rect x="${x1}" y="${y - 5}" width="${x2 - x1}" height="4" fill="#d9a85e" ${O2}/>
      ${posts}
    </g>`;
}

export function cottage(x, y, roof = '#e5484d', wall = '#fff1cf') {
  return `
    <g transform="translate(${x} ${y})">
      <ellipse cx="0" cy="2" rx="24" ry="5" fill="rgba(0,0,0,0.22)"/>
      <rect x="10" y="-44" width="7" height="14" fill="#9a93b0" ${O2}/>
      <rect x="-18" y="-26" width="36" height="27" fill="${wall}" ${O}/>
      <path d="M-24 -24 L0 -46 L24 -24 Z" fill="${roof}" ${O}/>
      <rect x="-5" y="-14" width="10" height="15" rx="1" fill="#8a5a2b" ${O2}/>
      <rect x="-14" y="-20" width="7" height="7" fill="#7fd3ff" ${O2}/>
      <rect x="8" y="-20" width="7" height="7" fill="#7fd3ff" ${O2}/>
    </g>`;
}

export function boat(x, y) {
  return `
    <g transform="translate(${x} ${y})"><g class="bob-slow">
      <path d="M-26 -6 L26 -6 L18 6 L-18 6 Z" fill="#c4763a" ${O}/>
      <path d="M0 -6 L0 -40" stroke="${K}" stroke-width="3"/>
      <path d="M2 -38 L22 -12 L2 -12 Z" fill="#ffffff" ${O2}/>
      <path d="M-2 -34 L-16 -12 L-2 -12 Z" fill="#ffd23f" ${O2}/>
    </g></g>`;
}

export function cloud(x, y, s = 1, dur = 80, delay = 0) {
  return `
    <g class="cloud" style="animation-duration:${dur}s; animation-delay:-${delay}s">
      <g transform="translate(${x} ${y}) scale(${s})">
        <path d="M-40 10 Q-52 10 -50 -2 Q-48 -14 -34 -12 Q-30 -30 -10 -28 Q4 -42 22 -30 Q40 -32 42 -14 Q56 -10 50 4 Q48 12 36 10 Z"
          fill="#ffffff" ${O} opacity="0.96"/>
        <path d="M-30 2 Q-10 8 20 4" fill="none" stroke="#dde9ff" stroke-width="3" stroke-linecap="round"/>
      </g>
    </g>`;
}

export function nameplateSvg(text, y, isCurrent) {
  const w = text.length * 8 + 18;
  return `
    <g class="nameplate ${isCurrent ? 'is-current' : ''}" transform="translate(0 ${y})">
      <rect class="plate-bg" x="${-w / 2}" y="-11" width="${w}" height="19" rx="4" fill="${PALETTE.cream}" ${O}/>
      <text x="0" y="3" text-anchor="middle" class="map-px" font-size="8" fill="${K}">${text.toUpperCase()}</text>
    </g>`;
}

export function heroSvg() {
  return `
    <ellipse cx="0" cy="0" rx="13" ry="4.5" fill="rgba(0,0,0,0.3)"/>
    <g class="hero-marker"><path d="M-7 -78 L7 -78 L0 -69 Z" fill="${PALETTE.gold}" ${O2}/></g>
    <g class="hero-bob">
      <g class="hero-facing">
        <!-- legs -->
        <g class="leg-a"><rect x="-8" y="-13" width="7" height="12" rx="2" fill="#2b2f6b" ${O2}/><rect x="-10" y="-4" width="10" height="5" rx="2" fill="#7a3d1a" ${O2}/></g>
        <g class="leg-b"><rect x="1" y="-13" width="7" height="12" rx="2" fill="#2b2f6b" ${O2}/><rect x="1" y="-4" width="10" height="5" rx="2" fill="#7a3d1a" ${O2}/></g>
        <!-- backpack -->
        <rect x="-17" y="-32" width="9" height="17" rx="3" fill="${PALETTE.orange}" ${O2}/>
        <rect x="-16" y="-24" width="7" height="3" fill="#c25e12"/>
        <!-- hoodie body -->
        <rect x="-11" y="-31" width="22" height="20" rx="7" fill="${PALETTE.teal}" ${O}/>
        <rect x="-3" y="-25" width="10" height="7" rx="2" fill="#12857b"/>
        <!-- scarf -->
        <rect x="-10" y="-34" width="21" height="6" rx="3" fill="${PALETTE.gold}" ${O2}/>
        <!-- head -->
        <circle cx="1" cy="-45" r="12" fill="#ffd3a8" ${O}/>
        <!-- beanie -->
        <path d="M-11 -47 Q-11 -60 1 -60 Q13 -60 13 -47 Z" fill="#7b4bff" ${O}/>
        <rect x="-12" y="-50" width="26" height="5" rx="2.5" fill="#a888ff" ${O2}/>
        <circle cx="1" cy="-61" r="3.5" fill="#ffffff" ${O2}/>
        <!-- face (looking right) -->
        <rect x="4" y="-44" width="3" height="5" rx="1.5" fill="${K}"/>
        <rect x="9" y="-44" width="3" height="5" rx="1.5" fill="${K}"/>
        <circle cx="3" cy="-37" r="2" fill="#ff9a8a" opacity="0.8"/>
        <!-- pencil sword -->
        <g class="hero-pencil">
          <rect x="11" y="-30" width="5" height="18" rx="1" fill="${PALETTE.gold}" ${O2} transform="rotate(-25 13 -21)"/>
        </g>
      </g>
    </g>`;
}
