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
    description: 'Crack the bandit vault in the canyon wall. Every lock is an equation: test each key by putting it in for the letter, and find the one that makes both sides equal. Watch out: sometimes no key fits!',
  }),
  stage(2, 'Counterweight', 'Apply Properties of Equality', { x: 360, y: 600 }, {
    built: true, building: 'scale_lift', url: './games/4-2-counterweight/index.html',
    description: 'The Saboteur keeps tipping the cargo lift over the canyon. Do the same thing to both sides of the equation to keep it level: add, subtract, multiply or divide. Then inspect repairs and beat the Saboteur.',
  }),
  stage(3, 'Undo Machine', 'Write and Solve Addition and Subtraction Equations', { x: 570, y: 555 }, {
    built: true, building: 'undo_machine', url: './games/4-3-undo-machine/index.html',
    description: 'A canyon ore machine swallows a hidden crate, does one step and pushes out a number. Write the machine as an equation, then run it backward with the opposite step to find what went in. Finish by fixing the Jammed Machine.',
  }),
  stage(4, 'Gear Shift', 'Write and Solve Multiplication and Division Equations', { x: 780, y: 600 }, {
    built: true, building: 'gear_shift', url: './games/4-4-gear-shift/index.html',
    description: 'The canyon mine train runs on a gearbox. A hidden drive wheel turns, a gear multiplies or divides its speed, and the output spins. Write the gearbox as an equation, shift to the opposite gear, and work out the hidden speed. Then free the Stuck Gearbox.',
  }),
  stage(5, 'Food Truck', 'Write and Solve Equations with Rational Numbers', { x: 990, y: 555 }, {
    built: true, building: 'food_truck', url: './games/4-5-food-truck/index.html',
    description: 'Run the order window at the canyon taco truck. Every order is an equation with decimals or fractions. Drop the opposite block on the ticket, work out the answer, and keep the line moving through the Lunch Rush.',
  }),
  stage(6, 'Ride Gate', 'Understand and Write Inequalities', { x: 1200, y: 585 }, {
    built: true, building: 'ride_gate', url: './games/4-6-ride-gate/index.html',
    description: 'Opening day at the canyon roller coaster! Turn each ride sign into a gate rule (an inequality), let the right riders through, set the rule on a number line, and keep the crowd happy through Opening Day.',
  }),
  stage(7, 'Force Field', 'Solve Inequalities', { x: 1240, y: 400 }, {
    built: true, building: 'force_field', url: './games/4-7-force-field/index.html',
    description: 'Meteors are falling on the canyon outpost! Put the shield over every solution of an inequality, zap the meteors that are solutions, name your own solutions, and hold the Twin Fields.',
  }),
  stage(8, 'Cause and Effect Lab', 'Understand Dependent and Independent Variables', { x: 1030, y: 320 }, {
    built: true, building: 'cause_lab', url: './games/4-8-cause-effect-lab/index.html',
    description: 'Run experiments in the canyon science lab. Put the cause (independent variable) on the DIAL and the effect (dependent variable) on the METER, hunt for factors, predict what the meter does, and tame the Runaway Experiment.',
  }),
  stage(9, 'Rune Machine', 'Use Patterns to Write and Solve Equations', { x: 800, y: 290 }, {
    built: true, building: 'rune_machine', url: './games/4-9-rune-machine/index.html',
    description: 'An ancient machine changes inputs into outputs by a hidden rule. Crack the rule as an equation, fill its table, read far ahead, and crack the Ancient Runes.',
  }),
  stage(10, 'Trail Mapper', 'Relate Tables, Graphs, and Equations', { x: 570, y: 320 }, {
    built: true, building: 'trail_mapper', url: './games/4-10-trail-mapper/index.html',
    description: 'Map canyon trails three ways: a rule, a logbook and a map. Plot points, read the map, write rules from graphs, spot the bad map, and clear Rockslide Pass.',
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
