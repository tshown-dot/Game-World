// Cause and Effect Lab (Lesson 4-8: Understand Dependent and Independent Variables): the content and checks.
// No screen code here, so it can be tested with plain node (see test_cause_effect_lab_math.js).
//
// An experiment machine has a DIAL (the cause: the independent variable) and a METER (the effect: the dependent
// variable). Each pair below says which is which, and which way the effect moves when the cause goes up.
// Pairs come from the kinds of situations in the textbook lesson. Teacher: review the wording.

let nextId = 1;
export function seeded(seed = 1) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];
const shuffle = (rnd, list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

/* ================================================================== */
/* The experiments                                                     */
/* ================================================================== */
// cause -> effect, and dir: what the effect does when the cause goes UP ('up' | 'down')
const v = (letter, name) => ({ letter, name });
export const PAIRS = [
  { cause: v('t', 'raffle tickets sold'), effect: v('m', 'money earned'), dir: 'up' },
  { cause: v('h', 'hours worked'), effect: v('m', 'money earned'), dir: 'up' },
  { cause: v('s', 'shelves in a bookcase'), effect: v('b', 'books it can hold'), dir: 'up' },
  { cause: v('m', 'miles biked'), effect: v('c', 'calories burned'), dir: 'up' },
  { cause: v('h', 'hours spent reading'), effect: v('p', 'pages read'), dir: 'up' },
  { cause: v('m', 'minutes the hose runs'), effect: v('g', 'gallons of water'), dir: 'up' },
  { cause: v('x', 'bushels harvested'), effect: v('y', 'peaches harvested'), dir: 'up' },
  { cause: v('r', 'driving speed for a 300-mile trip'), effect: v('h', 'hours spent driving'), dir: 'down' },
  { cause: v('p', 'pages in a book'), effect: v('w', 'weight of the book'), dir: 'up' },
  { cause: v('h', 'hamburgers sold'), effect: v('s', 'dollars in sales'), dir: 'up' },
  { cause: v('b', 'loaves of bread you want to make'), effect: v('p', 'pounds of flour to buy'), dir: 'up' },
  { cause: v('m', 'minutes the water is in the freezer'), effect: v('t', 'temperature of the water'), dir: 'down' },
  { cause: v('n', 'incorrect answers on a test'), effect: v('s', 'test score'), dir: 'down' },
  { cause: v('n', 'oranges in a bag'), effect: v('c', 'cost of the bag'), dir: 'up' },
  { cause: v('b', 'cups of batter'), effect: v('p', 'pancakes made'), dir: 'up' },
  { cause: v('p', 'pounds of apples sold'), effect: v('m', 'money taken in'), dir: 'up' },
  { cause: v('p', 'pairs of pants bought'), effect: v('c', 'dollars spent'), dir: 'up' },
  { cause: v('d', 'distance to drive at 50 miles per hour'), effect: v('t', 'time the trip takes'), dir: 'up' },
  { cause: v('L', 'loads of laundry washed'), effect: v('g', 'gallons of water used'), dir: 'up' },
  { cause: v('k', 'kids sharing a 12-slice pizza'), effect: v('s', 'slices each kid gets'), dir: 'down' },
];
// Things that change nothing in these experiments: for "stays the same" dials and the build-your-own decoys.
export const UNRELATED = [
  { cause: v('c', 'color of the bookcase'), effect: v('b', 'books it can hold') },
  { cause: v('n', 'name of the bus driver'), effect: v('h', 'hours the trip takes') },
  { cause: v('d', 'day of the week you buy them'), effect: v('w', 'weight of a bag of apples') },
  { cause: v('s', 'song playing on the radio'), effect: v('g', 'gallons in a full pool') },
  { cause: v('c', 'color of the pancake plate'), effect: v('p', 'pancakes made') },
];

// Factor hunts: what could change the effect, and what could not.
export const HUNTS = [
  { effect: 'the weight of Max\'s parcel', yes: ['the size of the box', 'what is inside the box', 'the packing material', 'how many items are packed'], no: ['the color of the wrapping paper', 'the address on the label', 'the day it is mailed', 'the name of the sender'] },
  { effect: 'the cost of a salad', yes: ['the size of the salad', 'the ingredients', 'extra toppings', 'which restaurant makes it'], no: ['the color of the plate', 'the table number', 'the color of the server\'s shirt', 'how fast you eat it'] },
  { effect: 'a monthly electric bill', yes: ['hours the lights are on', 'how many devices are plugged in', 'air conditioner use', 'the price of electricity'], no: ['the color of the mailbox', 'the day the bill arrives', 'the name of the street', 'the paper the bill is printed on'] },
  { effect: 'how much a plant grows', yes: ['hours of sunlight', 'how much water it gets', 'the soil', 'the temperature'], no: ['the label on the pot', 'the day of the week', 'the owner\'s name', 'the brand of the watering can'] },
  { effect: 'the price of a basket of grapefruits', yes: ['how many grapefruits', 'the size of the grapefruits', 'the store', 'the time of year'], no: ['the cashier\'s name', 'which door you walk in', 'the color of the receipt', 'the music in the store'] },
  { effect: 'the days Julian takes to drive to Florida', yes: ['the distance', 'his driving speed', 'hours he drives each day', 'how many stops he makes'], no: ['the color of his car', 'the radio station', 'the name of his car', 'the brand of his sunglasses'] },
  { effect: 'the money the Williams family spends on meals', yes: ['how many meals they eat out', 'how many people are eating', 'the restaurants they choose', 'how many days the vacation lasts'], no: ['the color of their car', 'the songs they listen to', 'the floor of their hotel room', 'the weather back home'] },
];

// Time can be either: the cause (independent) or the effect (dependent).
export const TIME_SITUATIONS = [
  { text: 'The gallons of water, g, a hose puts out after running for t minutes.', time: 'cause' },
  { text: 'The temperature of water after t minutes in the freezer.', time: 'cause' },
  { text: 'The pages you read in t hours.', time: 'cause' },
  { text: 'The money a dog walker earns for t hours of walking.', time: 'cause' },
  { text: 'The height of a plant after t days.', time: 'cause' },
  { text: 'The time t it takes to drive 100 miles, depending on your speed.', time: 'effect' },
  { text: 'The time t it takes to fill a pool, depending on how many hoses you use.', time: 'effect' },
  { text: 'The time t it takes to read a book, depending on how many pages it has.', time: 'effect' },
  { text: 'The time t a runner needs to finish a race, depending on the race\'s length.', time: 'effect' },
  { text: 'The time t to wash the dishes, depending on how many dishes there are.', time: 'effect' },
];

/* ================================================================== */
/* Problems                                                            */
/* ================================================================== */
const card = (x, role) => ({ ...x, role });
/** Zone 1: wire an experiment. Two cards: one for the DIAL, one for the METER. */
export function genWire(rnd, pair = pick(rnd, PAIRS)) {
  return { id: nextId++, type: 'wire', pair, cards: shuffle(rnd, [card(pair.cause, 'cause'), card(pair.effect, 'effect')]) };
}
/** Zone 2: tap every factor that could change the effect. */
export function genHunt(rnd) {
  const h = pick(rnd, HUNTS);
  const nYes = pick(rnd, [3, 4]);
  const cards = shuffle(rnd, [...shuffle(rnd, h.yes).slice(0, nYes).map((name) => ({ name, affects: true })), ...shuffle(rnd, h.no).slice(0, 6 - nYes).map((name) => ({ name, affects: false }))]);
  return { id: nextId++, type: 'hunt', effect: h.effect, cards };
}
/** Zone 3: turn the dial up. Does the meter go up, down, or stay the same? */
export function genDial(rnd, { same = rnd() < 0.2, down = null } = {}) {
  if (same) { const u = pick(rnd, UNRELATED); return { id: nextId++, type: 'dial', pair: { ...u, dir: 'same' } }; }
  const pool = down === null ? PAIRS : PAIRS.filter((p) => (p.dir === 'down') === down);
  return { id: nextId++, type: 'dial', pair: pick(rnd, pool) };
}
/** Zone 4: is time the cause or the effect here? */
export function genTime(rnd) {
  return { id: nextId++, type: 'time', situation: pick(rnd, TIME_SITUATIONS) };
}
/** Zone 4: the pants critique, with any pair. */
export function genCritique(rnd, pair = pick(rnd, PAIRS.filter((p) => p.dir === 'up'))) {
  const C = pair.cause, E = pair.effect;
  const options = shuffle(rnd, [
    { text: `No: the ${E.name} depends on the ${C.name}, so ${C.letter} is independent`, ok: true },
    { text: 'Yes: either one could be the independent variable', trap: 'either_one' },
    { text: `No: the ${C.name} depends on the ${E.name}, so ${E.letter} is independent`, trap: 'swapped' },
    { text: 'Neither: they are not related', trap: 'unrelated' },
  ]);
  return { id: nextId++, type: 'pick', pair, options,
    ask: `${C.letter} is the ${C.name} and ${E.letter} is the ${E.name}. A friend says: "${E.letter} goes up when ${C.letter} goes up, and ${C.letter} goes up when ${E.letter} goes up, so either one could be the independent variable." Is the friend right?` };
}
/** Boss: build your own experiment from a bank of cards. Any sensible cause-and-effect pair counts. */
export function genBuild(rnd) {
  const pairs = shuffle(rnd, PAIRS).slice(0, 2);
  const decoys = shuffle(rnd, UNRELATED).filter((u) => !pairs.some((p) => p.cause.name === u.cause.name || p.effect.name === u.cause.name)).slice(0, 2).map((u) => u.cause);
  const names = new Set();
  const cards = shuffle(rnd, [...pairs.flatMap((p) => [p.cause, p.effect]), ...decoys]).filter((c) => !names.has(c.name) && names.add(c.name))
    .map((c) => ({ name: c.name }));                       // names only: letters could clash between experiments
  return { id: nextId++, type: 'build', cards };
}
/** Boss: Jonas's washing machines (loads -> gallons). */
export function genJonas(rnd) {
  const per = pick(rnd, [13, 15, 20, 27, 40]);
  const pair = PAIRS.find((p) => p.cause.letter === 'L');
  return { ...genWire(rnd, pair), story: `Jonas tracks his washing machine: it uses ${per} gallons of water for each load of laundry. Wire his experiment.` };
}

export const ZONES = [
  { name: 'Wire It', blurb: 'Cause on the DIAL, effect on the METER' },
  { name: 'Factor Hunt', blurb: 'What could change the meter? Tap them all' },
  { name: 'Turn the Dial', blurb: 'Up, down, or no change?' },
  { name: 'Lab Review', blurb: 'Is time the cause or the effect? Is the friend right?' },
  { name: 'Runaway Experiment', blurb: 'Boss: wire, predict, and build your own' },
];
export function genZone(rnd, zone) {
  if (zone === 0) return shuffle(rnd, PAIRS).slice(0, 6).map((p) => genWire(rnd, p));
  if (zone === 1) {
    const hunts = shuffle(rnd, HUNTS).slice(0, 3);
    return hunts.map((h) => { let p; do { p = genHunt(rnd); } while (p.effect !== h.effect); return p; });
  }
  if (zone === 2) return shuffle(rnd, [genDial(rnd, { same: false, down: false }), genDial(rnd, { same: false, down: true }), genDial(rnd, { same: false, down: true }), genDial(rnd, { same: true }), genDial(rnd, { same: false })]);
  if (zone === 3) return shuffle(rnd, [genTime(rnd), genTime(rnd), genTime(rnd), genCritique(rnd), genCritique(rnd)]);
  return [genJonas(rnd), genDial(rnd, { same: false, down: true }), genHunt(rnd), genCritique(rnd), genBuild(rnd)];
}
export function genBackup(rnd, p) {
  if (p.type === 'wire') return genWire(rnd);
  if (p.type === 'hunt') return genHunt(rnd);
  if (p.type === 'dial') return genDial(rnd, { same: p.pair.dir === 'same', down: p.pair.dir === 'down' });
  if (p.type === 'time') return genTime(rnd);
  if (p.type === 'pick') return genCritique(rnd);
  return genBuild(rnd);
}

/* ================================================================== */
/* Checking                                                            */
/* ================================================================== */
const depends = (pair) => `The ${pair.effect.name} (${pair.effect.letter}) depends on the ${pair.cause.name} (${pair.cause.letter})`;
/** Wire: which card is on the DIAL and which on the METER. */
export function checkWire(p, dialCard, meterCard) {
  if (!dialCard || !meterCard) return { correct: false, nudge: true, key: 'incomplete', message: 'Put one card on the DIAL and one on the METER.' };
  if (dialCard.role === 'cause') return { correct: true, key: 'correct', message: `Wired! ${depends(p.pair)}. ${p.pair.cause.letter} is independent (cause); ${p.pair.effect.letter} is dependent (effect).` };
  return { correct: false, key: 'swapped', message: `Backwards! Ask: which one changes BECAUSE of the other? ${depends(p.pair)}, so the ${p.pair.cause.name} goes on the DIAL.` };
}
/** Factor hunt: the cards the student tapped. */
export function checkHunt(p, selected) {
  const missed = p.cards.filter((c, i) => c.affects && !selected.has(i));
  const extra = p.cards.filter((c, i) => !c.affects && selected.has(i));
  if (!missed.length && !extra.length) return { correct: true, key: 'correct', message: `Yes! Those are independent variables that could change ${p.effect}.` };
  if (extra.length) return { correct: false, key: 'unrelated_factor', message: `Could "${extra[0].name}" really change ${p.effect}? No: changing it leaves the meter the same.` };
  return { correct: false, key: 'missed_factor', message: `You missed one: changing "${missed[0].name}" WOULD change ${p.effect}.` };
}
/** Turn the dial up: 'up' | 'down' | 'same'. */
export function checkDial(p, answer) {
  const { pair } = p;
  const want = pair.dir;
  const say = { up: 'goes UP', down: 'goes DOWN', same: 'stays the SAME' };
  if (answer === want) {
    return { correct: true, key: 'correct', message: want === 'same' ? `Right: the ${pair.cause.name} doesn't affect the ${pair.effect.name}, so the meter stays the same.` : `Right: more ${pair.cause.name} means the ${pair.effect.name} ${say[want].toLowerCase()}.` };
  }
  if (want === 'same') return { correct: false, key: 'not_related', message: `Does the ${pair.cause.name} really change the ${pair.effect.name}? It doesn't: the meter stays the same.` };
  if (want === 'down' && answer === 'up') return { correct: false, key: 'more_is_more', message: `More of a cause doesn't always mean more of the effect! More ${pair.cause.name} means the ${pair.effect.name} goes DOWN.` };
  return { correct: false, key: 'direction', message: `Think it through: more ${pair.cause.name} means the ${pair.effect.name} ${say[want]}.` };
}
/** Time: 'cause' | 'effect'. */
export function checkTime(p, answer) {
  const s = p.situation;
  if (answer === s.time) return { correct: true, key: 'correct', message: s.time === 'cause' ? 'Right: here time is the independent variable (cause). The other amount depends on how much time passes.' : 'Right: here time is the dependent variable (effect). How long it takes depends on something else.' };
  return { correct: false, key: 'time_always_cause', message: s.time === 'cause' ? 'Here the other amount changes because more time passes, so time is the independent variable (cause).' : 'Time isn\'t always the cause! Here how long it takes depends on something else, so time is the dependent variable (effect).' };
}
export function checkPick(p, i) {
  const o = p.options[i];
  if (o.ok) return { correct: true, key: 'correct', message: `Right! ${depends(p.pair)}. The amounts change together, but only one causes the other.` };
  const why = { either_one: 'They change together, but only one CAUSES the other.', swapped: 'That has it backwards.', unrelated: 'They are related: one changes when the other does.' }[o.trap];
  return { correct: false, key: o.trap === 'either_one' ? 'either_one' : 'swapped', message: `${why} ${depends(p.pair)}, so ${p.pair.cause.letter} is the independent variable.` };
}
/** Build your own: is (dial -> meter) one of the real experiments? */
export function checkBuild(p, dialCard, meterCard) {
  if (!dialCard || !meterCard) return { correct: false, nudge: true, key: 'incomplete', message: 'Put one card on the DIAL and one on the METER.' };
  const match = PAIRS.find((x) => x.cause.name === dialCard.name && x.effect.name === meterCard.name);
  if (match) return { correct: true, key: 'correct', message: `Great experiment! ${depends(match)}.` };
  const backwards = PAIRS.find((x) => x.cause.name === meterCard.name && x.effect.name === dialCard.name);
  if (backwards) return { correct: false, key: 'swapped', message: `Those two are related, but backwards: ${depends(backwards)}. Swap them.` };
  return { correct: false, key: 'not_related', message: `Does the ${dialCard.name} really change the ${meterCard.name}? Pick two that cause and effect each other.` };
}
/** The pairs a build bank can make (for hints and tests). */
export const buildablePairs = (p) => PAIRS.filter((x) => p.cards.some((c) => c.name === x.cause.name) && p.cards.some((c) => c.name === x.effect.name));

/* ================================================================== */
/* Worked solutions (after two misses)                                 */
/* ================================================================== */
export function workedSolution(p) {
  if (p.type === 'wire') return ['Ask: which one changes BECAUSE of the other?', `${depends(p.pair)}.`, `DIAL (independent, cause): ${p.pair.cause.name}. METER (dependent, effect): ${p.pair.effect.name}.`];
  if (p.type === 'hunt') return [`Ask of each card: if this changed, would ${p.effect} change?`, `Yes: ${p.cards.filter((c) => c.affects).map((c) => c.name).join('; ')}.`, `No: ${p.cards.filter((c) => !c.affects).map((c) => c.name).join('; ')}.`];
  if (p.type === 'dial') {
    const pr = p.pair;
    return pr.dir === 'same' ? [`The ${pr.cause.name} has nothing to do with the ${pr.effect.name}.`, 'So turning the dial leaves the meter the same.']
      : [`Imagine MORE ${pr.cause.name}.`, `Then the ${pr.effect.name} ${pr.dir === 'up' ? 'goes up' : 'goes down'}.`, pr.dir === 'down' ? 'More of a cause can mean LESS of the effect.' : 'More of the cause, more of the effect.'];
  }
  if (p.type === 'time') return [p.situation.text, p.situation.time === 'cause' ? 'Time passing makes the other amount change: time is independent (cause).' : 'Something else decides how long it takes: time is dependent (effect).'];
  if (p.type === 'pick') return ['Two amounts can change together, but only one causes the other.', `${depends(p.pair)}.`, `So ${p.pair.cause.letter} is independent and ${p.pair.effect.letter} is dependent.`];
  const ex = buildablePairs(p);
  return ['Choose a cause for the DIAL and something it changes for the METER.', ...ex.map((x) => `Works: DIAL ${x.cause.name} → METER ${x.effect.name}.`)];
}
