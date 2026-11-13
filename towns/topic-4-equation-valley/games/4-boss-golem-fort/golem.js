// Golem Fort (Topic 4 boss): the fort's rules.
// No screen code here, so it can be tested with plain node (see test_golem_fort_math.js).
//
// The golem has five parts. To break a part the student picks a WEAPON: the real game from one of that part's lessons,
// played for one zone (its boss zone) in "fort mode" (see shared/game/arcadeShell.js). The weapon game sends back
// { won, good, bad, lives, practiceMode }, and the fort adds it up here.

/** One weapon: the lesson, the game's name and folder, and one line on what the student does with it. */
const weapon = (lesson, name, folder, does) => ({ lesson, name, folder, does });
export const PARTS = [
  { name: 'The Feet', blurb: 'Solutions and balance', weapons: [
    weapon('4-1', 'Key Fitter', '4-1-key-fitter', 'Find the value that opens the lock'),
    weapon('4-2', 'Counterweight', '4-2-counterweight', 'Do the same thing to both pans'),
  ] },
  { name: 'The Arms', blurb: 'Write and solve equations', weapons: [
    weapon('4-3', 'Undo Machine', '4-3-undo-machine', 'Add and subtract along the track'),
    weapon('4-4', 'Gear Shift', '4-4-gear-shift', 'Multiply and divide in equal turns'),
  ] },
  { name: 'The Shoulders', blurb: 'Fractions and decimals', weapons: [
    weapon('4-5', 'Food Truck', '4-5-food-truck', 'Unwind tickets with fractions and decimals'),
  ] },
  { name: 'The Shield', blurb: 'Inequalities', weapons: [
    weapon('4-6', 'Ride Gate', '4-6-ride-gate', 'Write the rule the gate uses'),
    weapon('4-7', 'Force Field', '4-7-force-field', 'Shade the graph and test it'),
  ] },
  { name: 'The Core', blurb: 'Variables, tables and graphs', weapons: [
    weapon('4-8', 'Cause and Effect Lab', '4-8-cause-effect-lab', 'Find what depends on what'),
    weapon('4-9', 'Rune Machine', '4-9-rune-machine', 'Find the rule behind the table'),
    weapon('4-10', 'Trail Mapper', '4-10-trail-mapper', 'Match the rule, the table and the graph'),
  ] },
];
export const ZONES = PARTS.map((p) => ({ name: p.name, blurb: p.blurb }));
/** Every weapon game has five zones; the fort uses the last one (its boss zone). */
export const WEAPON_ZONE = 4;

/** The address of a weapon game, from the fort's own folder. */
export function weaponUrl(w, { practice = false, test = false } = {}) {
  return `../${w.folder}/index.html?fort=${WEAPON_ZONE}${practice ? '&practice=1' : ''}${test ? '&test' : ''}`;
}
/** How strong the golem still is (100 to 0) with this many parts broken. */
export const strength = (broken) => Math.max(0, 100 - Math.round((100 * broken) / PARTS.length));
/** What came back from a weapon game, made safe to add up: whole numbers, never negative, never absurd. */
export function tally(result) {
  const count = (v) => (Number.isFinite(v) ? Math.min(60, Math.max(0, Math.round(v))) : 0);
  const r = result && typeof result === 'object' ? result : {};
  return { won: r.won === true, good: count(r.good), bad: count(r.bad) };
}
