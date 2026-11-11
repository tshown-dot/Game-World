// Expression Town (Topic 3) on the shared town engine (shared/town/). This file only supplies the building list
// and the art; walking, briefings, saving, My Progress and the victory screen all come from the shared engine.
//
// The buildings and their games come from nodes.js; the art comes from worldArt.js. That art was drawn for a
// 1366 x 658 map, so everything is moved down by DY to sit in the middle of the shared 1366 x 768 map.
import { startTown } from '../../../shared/town/townHub.js';
import { REALM_NODES } from './nodes.js';
import { LEGACY_NODE_IDS } from './legacy.js';
import { worldDefs, terrainSvg as islandSvg, scenerySvg, cloudsSvg, bridgeSvg, buildingArt, lockOverlay } from './worldArt.js';

const DY = 55;
const BRIDGE = { x: 580, y: 490 };          // the roads cross the river here (old map coordinates)
const at = (p) => ({ x: p.x, y: p.y + DY });

/** Roads run across, then up or down (like the old map), so the road from 3-3 to 3-4 goes over the bridge. */
function via(prev, node) {
  const A = prev.mapCoords, B = node.mapCoords;
  if (A.y === B.y) return [];
  return [at(B.y < A.y ? { x: B.x, y: A.y } : { x: A.x, y: B.y })];
}

export const STAGES = REALM_NODES.map((n, i) => ({
  id: n.id, lessonCode: n.lessonCode, title: n.title, subtitle: n.subtitle, description: n.description,
  built: !n.isWip, url: n.cartridgeUrl, building: n.buildingType, coords: at(n.mapCoords),
  via: i > 0 ? via(REALM_NODES[i - 1], n) : [],
  xpReward: n.xpReward, coinsReward: n.coinsReward, isBoss: n.id === 'node_apex',
}));

function terrainSvg() {
  return `<rect width="1366" height="768" fill="#3a8ef0"/>${worldDefs()}
    <g transform="translate(0 ${DY})">${islandSvg()}${bridgeSvg(BRIDGE.x, BRIDGE.y)}${scenerySvg()}${cloudsSvg()}</g>`;
}
function buildingSvg(stage, state) {
  const art = buildingArt(stage.building);
  return art.svg + (state === 'locked' ? lockOverlay(art.door) : '');
}

export const CONFIG = {
  townId: 'topic_3', label: 'topic-3', number: 3, name: 'Expression Town', topic: 'Topic 3: Numeric & Algebraic Expressions',
  superMapUrl: '../../index.html', stages: STAGES, terrainSvg, buildingSvg, legacyIds: LEGACY_NODE_IDS,
};

if (typeof document !== 'undefined') startTown(CONFIG);
