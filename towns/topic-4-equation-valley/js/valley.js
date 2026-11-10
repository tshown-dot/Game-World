// Equation Valley (World 4): Grade 6 Topic 4, Represent and Solve Equations and Inequalities.
// Lesson titles come from docs/lessons.md. Game names are the approved genre plan; only built games can be entered.
import { startTown } from '../../../shared/town/townHub.js';
import { terrainSvg, buildingSvg } from './valleyArt.js';

const stage = (n, title, subtitle, coords, extra = {}) => ({
  id: `node_4_${n}`, lessonCode: `4-${n}`, title, subtitle, coords, built: false, xpReward: 150, coinsReward: 50, ...extra,
});

export const STAGES = [
  stage(1, 'Key Fitter', 'Understand Equations and Solutions', { x: 150, y: 555 }),
  stage(2, 'Counterweight', 'Apply Properties of Equality', { x: 360, y: 600 }, {
    built: true, building: 'scale_lift', url: './games/4-2-counterweight/index.html',
    description: 'The Saboteur keeps tipping the cargo lift over the canyon. Do the same thing to both sides of the equation to keep it level: add, subtract, multiply or divide. Then inspect repairs and beat the Saboteur.',
  }),
  stage(3, 'Undo Machine', 'Write and Solve Addition and Subtraction Equations', { x: 570, y: 555 }),
  stage(4, 'Gear Shift', 'Write and Solve Multiplication and Division Equations', { x: 780, y: 600 }),
  stage(5, 'Food Truck', 'Write and Solve Equations with Rational Numbers', { x: 990, y: 555 }),
  stage(6, 'Ride Gate', 'Understand and Write Inequalities', { x: 1200, y: 585 }),
  stage(7, 'Force Field', 'Solve Inequalities', { x: 1240, y: 400 }),
  stage(8, 'Cause and Effect Lab', 'Understand Dependent and Independent Variables', { x: 1030, y: 320 }),
  stage(9, 'Rune Machine', 'Use Patterns to Write and Solve Equations', { x: 800, y: 290 }),
  stage(10, 'Trail Mapper', 'Relate Tables, Graphs, and Equations', { x: 570, y: 320 }),
  {
    id: 'node_4_boss', lessonCode: 'BOSS', title: 'Golem Fort', subtitle: 'Topic 4 boss: The Equation Golem',
    coords: { x: 320, y: 300 }, built: false, isBoss: true, xpReward: 600, coinsReward: 250,
  },
];

export const CONFIG = {
  townId: 'topic_4', label: 'topic-4', number: 4, name: 'Equation Valley', topic: 'Topic 4: Equations & Inequalities',
  superMapUrl: '../../index.html', stages: STAGES, terrainSvg, buildingSvg,
};

if (typeof document !== 'undefined') startTown(CONFIG);
