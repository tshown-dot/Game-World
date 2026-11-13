// Equation Valley (World 4): Grade 6 Topic 4, Represent and Solve Equations and Inequalities.
// Lesson titles come from docs/lessons.md. Game names are the approved genre plan; only built games can be entered.
import { startTown } from '../../../shared/town/townHub.js';
import { terrainSvg, buildingSvg } from './valleyArt.js';

const stage = (n, title, subtitle, coords, extra = {}) => ({
  id: `node_4_${n}`, lessonCode: `4-${n}`, title, subtitle, coords, built: false, xpReward: 150, coinsReward: 50, ...extra,
});

export const STAGES = [
  stage(1, 'Key Fitter', 'Understand Equations and Solutions', { x: 150, y: 555 }, {
    built: true, building: 'key_vault', url: './games/4-1-key-fitter/index.html',
    description: 'You hold a key, and every lock is an equation. Tap each lock your key opens as they roll past, then choose the keys yourself, forge a lock of your own and crack the Locksmith\'s mystery lock.',
  }),
  stage(2, 'Counterweight', 'Apply Properties of Equality', { x: 360, y: 600 }, {
    built: true, building: 'scale_lift', url: './games/4-2-counterweight/index.html',
    description: 'The Saboteur keeps tipping the cargo lift over the canyon. Do the same thing to both sides of the equation to keep it level: add, subtract, multiply or divide. Then inspect repairs and beat the Saboteur.',
  }),
  stage(3, 'Undo Machine', 'Write and Solve Addition and Subtraction Equations', { x: 570, y: 555 }, {
    built: true, building: 'undo_machine', url: './games/4-3-undo-machine/index.html',
    description: 'The canyon ore machine pushes a cart along a numbered track, and it has to stop exactly on the flag. Work backward from the flag to set where the cart starts or how far it is pushed, write the equation for a story, and crack the Jammed Machine.',
  }),
  stage(4, 'Gear Shift', 'Write and Solve Multiplication and Division Equations', { x: 780, y: 600 }, {
    built: true, building: 'gear_shift', url: './games/4-4-gear-shift/index.html',
    description: 'A gear rolls along a toothed track in equal turns, and it has to stop exactly on the flag. Choose the teeth per turn, the number of turns, or where the flag goes, write the equation for a story, and free the Stuck Gearbox.',
  }),
  stage(5, 'Food Truck', 'Write and Solve Equations with Rational Numbers', { x: 990, y: 555 }, {
    built: true, building: 'food_truck', url: './games/4-5-food-truck/index.html',
    description: 'Run the order window at the canyon taco truck. Every ticket is an equation with decimals or fractions. Call each one more or less as it rolls by, pick the tool that undoes it, ring up the exact answer, and write the tickets yourself in the Lunch Rush.',
  }),
  stage(6, 'Ride Gate', 'Understand and Write Inequalities', { x: 1200, y: 585 }, {
    built: true, building: 'ride_gate', url: './games/4-6-ride-gate/index.html',
    description: 'Riders walk up to the gate, each carrying a number. First you are the gate: read the sign and let them in or turn them away. Then write the sign as an inequality and watch the gate do exactly what you wrote. Find the rule behind a worn-off sign, and get through Opening Day.',
  }),
  stage(7, 'Force Field', 'Solve Inequalities', { x: 1240, y: 400 }, {
    built: true, building: 'force_field', url: './games/4-7-force-field/index.html',
    description: 'Pods are falling on the canyon city, and only solutions may land! Read the rule, shade the landing zone on the number line (which side? solid or open edge?), then watch every pod test your graph and land pods of your own. Hold off the Storm Front.',
  }),
  stage(8, 'Cause and Effect Lab', 'Understand Dependent and Independent Variables', { x: 1030, y: 320 }, {
    built: true, building: 'cause_lab', url: './games/4-8-cause-effect-lab/index.html',
    description: 'The lab machine has a crank you turn and a gauge that responds. Put the right variable on the crank and watch the gauge follow, plug in every factor that would move it, predict which way it goes, and name a mystery gauge by choosing what to test.',
  }),
  stage(9, 'Rune Machine', 'Use Patterns to Write and Solve Equations', { x: 800, y: 290 }, {
    built: true, building: 'rune_machine', url: './games/4-9-rune-machine/index.html',
    description: 'An ancient machine changes each stone by a rule. Catch what flies out, set its dials to match a table, run it backward, and feed it stones of your own to crack the hidden rules of the Ancient Runes.',
  }),
  stage(10, 'Trail Mapper', 'Relate Tables, Graphs, and Equations', { x: 570, y: 320 }, {
    built: true, building: 'trail_mapper', url: './games/4-10-trail-mapper/index.html',
    description: 'Every trail has a rule, a logbook and a map that all say the same thing. Stake the trail on the map, read the map with a pointer, set the rule that makes a trail, and fix a map with a stake out of place. Each time a scout walks the real trail to show what matches. Then cross Rockslide Pass.',
  }),
  {
    id: 'node_4_boss', lessonCode: 'BOSS', title: 'Golem Fort', subtitle: 'Topic 4 boss: The Equation Golem',
    coords: { x: 320, y: 300 }, built: true, isBoss: true, xpReward: 600, coinsReward: 250,
    building: 'golem_fort', url: './games/4-boss-golem-fort/index.html',
    description: 'The Equation Golem guards the end of the valley. Break its feet, arms, shoulders and shield with everything from Topic 4, then shatter its core. Only a timed run defeats it.',
  },
];

export const CONFIG = {
  townId: 'topic_4', label: 'topic-4', number: 4, name: 'Equation Valley', topic: 'Topic 4: Equations & Inequalities',
  superMapUrl: '../../index.html', stages: STAGES, terrainSvg, buildingSvg,
};

if (typeof document !== 'undefined') startTown(CONFIG);
