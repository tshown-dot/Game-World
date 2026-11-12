// Factor Falls (Grade 7 Isles, Town 4): enVision 2.0 Grade 7 Topic 4, Generate Equivalent Expressions.
// Lesson titles come from docs/lessons.md. Building names are working names until each game is planned with the
// owner; a building shows "under construction" until its game is built (set built: true and give it a url).
import { startTown } from '../../../shared/town/townHub.js';
import { terrainSvg, buildingSvg } from './fallsArt.js';

const stage = (n, title, subtitle, coords, extra = {}) => ({
  id: `node_g7_4_${n}`, lessonCode: `4-${n}`, title, subtitle, coords, built: false, xpReward: 150, coinsReward: 50, ...extra,
});

export const STAGES = [
  stage(1, 'Ranger Station', 'Write and Evaluate Algebraic Expressions', { x: 150, y: 600 }, {
    built: true, building: 'ranger_station', url: './games/4-1-ranger-station/index.html',
    description: 'Radio calls come in about leaking tanks, rising rivers and supply orders. Build each expression on the station gauge from its start amount and rate, then read the gauge ahead by evaluating it, before the storm arrives.',
  }),
  stage(2, 'Twin Bridges', 'Generate Equivalent Expressions', { x: 330, y: 500 }),
  stage(3, 'Log Flume', 'Simplify Expressions', { x: 520, y: 600 }),
  stage(4, 'Spray Deck', 'Expand Expressions', { x: 720, y: 520 }),
  stage(5, 'Factor Mill', 'Factor Expressions', { x: 920, y: 600 }),
  stage(6, 'The Confluence', 'Add Expressions', { x: 1130, y: 520 }),
  stage(7, 'The Spillway', 'Subtract Expressions', { x: 1180, y: 330 }),
  stage(8, 'Lookout Tower', 'Analyze Equivalent Expressions', { x: 960, y: 290 }),
  {
    id: 'node_g7_4_boss', lessonCode: 'BOSS', title: 'Thunder Falls', subtitle: 'Grade 7 Topic 4 boss',
    coords: { x: 700, y: 300 }, built: false, isBoss: true, xpReward: 600, coinsReward: 250,
  },
];

export const CONFIG = {
  townId: 'g7_topic_4', label: 'g7-topic-4', number: 4, name: 'Factor Falls', topic: 'Grade 7 Topic 4: Generate Equivalent Expressions',
  signLabel: 'GRADE 7 · TOWN 4',
  superMapUrl: '../../index.html', stages: STAGES, terrainSvg, buildingSvg,
};

if (typeof document !== 'undefined') startTown(CONFIG);
