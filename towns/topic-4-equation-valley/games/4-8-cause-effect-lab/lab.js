// Cause and Effect Lab (Lesson 4-8: Understand Dependent and Independent Variables): the content and checks.
// No screen code here, so it can be tested with plain node (see test_cause_effect_lab_math.js).
//
// The lab machine has a CRANK (the independent variable: the student changes it) and a GAUGE (the dependent
// variable: it responds). Each experiment below says which is which, and gives five readings so the machine can
// really run: xs are the crank's stops, ys are what the gauge shows at each stop.
// Round types:
//   wire     two tags: which one goes on the crank?
//   belt     factor tags roll past one gauge: plug in each one that would move it
//   way      the machine is wired: will the gauge go up, go down or stay put?
//   spot     three machines: find the one wired backwards
//   build    a bank of tags: wire an experiment of your own
//   mystery  the gauge has no label: test cranks to find what moves it, then name the gauge
// The situations come from the kinds of problems in the textbook lesson; the numbers are made up so the gauge has
// something to show. Teacher: review the wording and the numbers.

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
const dirOf = (ys) => (ys[ys.length - 1] > ys[0] ? 'up' : ys[ys.length - 1] < ys[0] ? 'down' : 'same');
const times = (xs, k) => xs.map((x) => x * k);
const N5 = [1, 2, 3, 4, 5];
/** cause -> effect. Units: '$' goes in front, anything else after the number. */
const E = (cl, cname, cunit, el, ename, eunit, xs, ys, more = {}) => ({
  cause: { letter: cl, name: cname, unit: cunit }, effect: { letter: el, name: ename, unit: eunit }, xs, ys, dir: dirOf(ys), ...more,
});
export const PAIRS = [
  E('t', 'raffle tickets sold', 'tickets', 'm', 'money earned', '$', N5, times(N5, 2)),
  E('h', 'hours worked', 'hours', 'p', 'pay earned', '$', N5, times(N5, 9)),
  E('s', 'shelves in a bookcase', 'shelves', 'b', 'books it can hold', 'books', N5, times(N5, 12), { solo: true }),
  E('m', 'miles biked', 'miles', 'c', 'calories burned', 'calories', N5, times(N5, 40), { solo: true }),
  E('h', 'hours spent reading', 'hours', 'p', 'pages read', 'pages', N5, times(N5, 30)),
  E('m', 'minutes the hose runs', 'minutes', 'g', 'gallons of water in the pool', 'gallons', N5, times(N5, 8)),
  E('x', 'bushels harvested', 'bushels', 'y', 'peaches harvested', 'peaches', N5, times(N5, 50)),
  E('r', 'driving speed for a 300-mile trip', 'mph', 'h', 'hours spent driving', 'hours', [30, 50, 60, 75, 100], [10, 6, 5, 4, 3], { solo: true }),
  E('p', 'pages in a book', 'pages', 'w', 'weight of the book', 'ounces', [100, 200, 300, 400, 500], [6, 12, 18, 24, 30]),
  E('h', 'hamburgers sold', 'burgers', 's', 'dollars in sales', '$', N5, times(N5, 4)),
  E('b', 'loaves of bread you want to make', 'loaves', 'p', 'pounds of flour to buy', 'pounds', N5, times(N5, 2), { solo: true }),
  E('m', 'minutes the water is in the freezer', 'minutes', 't', 'temperature of the water', '°F', [0, 10, 20, 30, 40], [70, 62, 54, 46, 38], { solo: true }),
  E('n', 'incorrect answers on a test', 'wrong', 's', 'test score', 'points', [0, 1, 2, 3, 4], [100, 95, 90, 85, 80], { solo: true }),
  E('n', 'oranges in a bag', 'oranges', 'c', 'cost of the bag', '$', [2, 4, 6, 8, 10], N5),
  E('b', 'cups of batter', 'cups', 'p', 'pancakes made', 'pancakes', N5, times(N5, 4)),
  E('p', 'pounds of apples sold', 'pounds', 'm', 'money taken in', '$', N5, times(N5, 3)),
  E('p', 'pairs of pants bought', 'pairs', 'c', 'dollars spent', '$', N5, times(N5, 20)),
  E('d', 'distance to drive at 50 miles per hour', 'miles', 't', 'time the trip takes', 'hours', times(N5, 50), N5),
  E('L', 'loads of laundry washed', 'loads', 'g', 'gallons of water used', 'gallons', N5, times(N5, 15), { solo: true }),
  E('k', 'kids sharing a 12-slice pizza', 'kids', 's', 'slices each kid gets', 'slices', [1, 2, 3, 4, 6], [12, 6, 4, 3, 2], { solo: true }),
];
// Things that change nothing: the crank turns and the gauge stays where it is.
// solo: experiments that cannot be mixed up with each other, for the tag banks where the student builds or names one.
export const SOLO = PAIRS.filter((p) => p.solo);
const COLORS = ['red', 'blue', 'green', 'white', 'black'];
export const UNRELATED = [
  E('c', 'color of the bookcase', '', 'b', 'books it can hold', 'books', COLORS, [60, 60, 60, 60, 60]),
  E('r', 'radio station playing on the bus', '', 'h', 'hours the bus trip takes', 'hours', ['92.1', '95.5', '98.7', '101.3', '104.9'], [3, 3, 3, 3, 3]),
  E('d', 'day of the week you buy them', '', 'w', 'weight of a bag of apples', 'pounds', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], [5, 5, 5, 5, 5]),
  E('s', 'song playing by the pool', '', 'g', 'gallons in a full pool', 'gallons', ['song 1', 'song 2', 'song 3', 'song 4', 'song 5'], [9000, 9000, 9000, 9000, 9000]),
  E('c', 'color of the pancake plate', '', 'p', 'pancakes made from 3 cups of batter', 'pancakes', COLORS, [12, 12, 12, 12, 12]),
];
// Time can be either: the crank (independent) or the gauge (dependent).
export const TIME_PAIRS = [
  E('t', 'minutes the hose runs', 'minutes', 'g', 'gallons of water put out', 'gallons', N5, times(N5, 8), { time: 'cause' }),
  E('t', 'minutes in the freezer', 'minutes', 'w', 'temperature of the water', '°F', [0, 10, 20, 30, 40], [70, 62, 54, 46, 38], { time: 'cause' }),
  E('t', 'hours spent reading', 'hours', 'p', 'pages read', 'pages', N5, times(N5, 30), { time: 'cause' }),
  E('t', 'hours of dog walking', 'hours', 'm', 'money the dog walker earns', '$', N5, times(N5, 12), { time: 'cause' }),
  E('t', 'days since the seed was planted', 'days', 'h', 'height of the plant', 'cm', [0, 5, 10, 15, 20], [2, 4, 6, 8, 10], { time: 'cause' }),
  E('s', 'driving speed for a 100-mile trip', 'mph', 't', 'hours the drive takes', 'hours', [20, 25, 40, 50, 100], [5, 4, 2.5, 2, 1], { time: 'effect' }),
  E('n', 'hoses filling the pool', 'hoses', 't', 'hours to fill the pool', 'hours', [1, 2, 3, 4, 6], [12, 6, 4, 3, 2], { time: 'effect' }),
  E('p', 'pages in the book', 'pages', 't', 'hours to read the book', 'hours', times(N5, 50), N5, { time: 'effect' }),
  E('d', 'miles in the race', 'miles', 't', 'minutes to finish the race', 'minutes', [1, 2, 3, 5, 10], [8, 16, 24, 40, 80], { time: 'effect' }),
  E('d', 'dishes to wash', 'dishes', 't', 'minutes to wash the dishes', 'minutes', times(N5, 10), times(N5, 5), { time: 'effect' }),
];
// Factor hunts: what could change the gauge, and what could not.
export const HUNTS = [
  { effect: 'the weight of Max\'s parcel', yes: ['the size of the box', 'what is inside the box', 'the packing material', 'how many items are packed'], no: ['the color of the wrapping paper', 'the address on the label', 'the day it is mailed', 'the name of the sender'] },
  { effect: 'the cost of a salad', yes: ['the size of the salad', 'the ingredients', 'extra toppings', 'which restaurant makes it'], no: ['the color of the plate', 'the table number', 'the color of the server\'s shirt', 'how fast you eat it'] },
  { effect: 'a monthly electric bill', yes: ['hours the lights are on', 'how many devices are plugged in', 'air conditioner use', 'the price of electricity'], no: ['the color of the mailbox', 'the day the bill arrives', 'the name of the street', 'the paper the bill is printed on'] },
  { effect: 'how much a plant grows', yes: ['hours of sunlight', 'how much water it gets', 'the soil', 'the temperature'], no: ['the label on the pot', 'the day of the week', 'the owner\'s name', 'the brand of the watering can'] },
  { effect: 'the price of a basket of grapefruits', yes: ['how many grapefruits', 'the size of the grapefruits', 'the store', 'the time of year'], no: ['the cashier\'s name', 'which door you walk in', 'the color of the receipt', 'the music in the store'] },
  { effect: 'the days Julian takes to drive to Florida', yes: ['the distance', 'his driving speed', 'hours he drives each day', 'how many stops he makes'], no: ['the color of his car', 'the radio station', 'the name of his car', 'the brand of his sunglasses'] },
  { effect: 'the money the Williams family spends on meals', yes: ['how many meals they eat out', 'how many people are eating', 'the restaurants they choose', 'how many days the vacation lasts'], no: ['the color of their car', 'the songs they listen to', 'the floor of their hotel room', 'the weather back home'] },
];

/** "3 tickets", "$15", "54°F", "blue" */
export function fmt(value, unit) {
  if (typeof value === 'string' || !unit) return String(value);
  if (unit === '$') return `$${value}`;
  if (unit === '°F') return `${value}°F`;
  return `${value} ${unit}`;
}
/** Where the gauge sits (0 to 100) for reading i. A gauge that never changes sits in the middle. */
export function level(pair, i) {
  const lo = Math.min(...pair.ys), hi = Math.max(...pair.ys);
  return lo === hi ? 50 : Math.round(12 + (76 * (pair.ys[i] - lo)) / (hi - lo));
}
const depends = (pair) => `The ${pair.effect.name} will depend on the ${pair.cause.name}`;

/* ================================================================== */
/* Wire: two tags, one machine                                         */
/* ================================================================== */
export function genWire(rnd, pair = pick(rnd, PAIRS)) {
  return { id: nextId++, type: 'wire', pair, tags: shuffle(rnd, [{ ...pair.cause, role: 'cause' }, { ...pair.effect, role: 'effect' }]) };
}
/** crankTag: the tag the student put on the crank. */
export function checkWire(p, crankTag) {
  const { pair } = p;
  if (!crankTag) return { ok: false, nudge: true, key: 'incomplete', message: 'Tap the tag that goes on the CRANK.' };
  if (crankTag.role === 'cause') return { ok: true, key: 'correct', message: `${depends(pair)}. ${pair.cause.letter} is independent, ${pair.effect.letter} is dependent.` };
  if (pair.time === 'effect') return { ok: false, key: 'time_always_cause', message: `Time is not always the crank! You cannot turn the ${pair.effect.name} by hand: how long it takes will depend on the ${pair.cause.name}.` };
  return { ok: false, key: 'swapped', message: `Backwards! You cannot turn the ${pair.effect.name} by hand. It can only change BECAUSE the ${pair.cause.name} changed.` };
}

/* ================================================================== */
/* Belt: which factors would move this gauge?                          */
/* ================================================================== */
export function genBelt(rnd, hunt = pick(rnd, HUNTS)) {
  const nYes = pick(rnd, [3, 4]);
  const tags = shuffle(rnd, [...shuffle(rnd, hunt.yes).slice(0, nYes).map((name) => ({ name, affects: true })), ...shuffle(rnd, hunt.no).slice(0, 6 - nYes).map((name) => ({ name, affects: false }))]);
  return { id: nextId++, type: 'belt', effect: hunt.effect, tags };
}
/** Tag i went by. plugged: the student plugged it into the crank. quiet: nothing to score (a tag rightly left alone). */
export function checkBelt(p, i, plugged) {
  const tag = p.tags[i];
  if (plugged && tag.affects) return { ok: true, key: 'correct', message: `Yes: changing ${tag.name} would change ${p.effect}.` };
  if (!plugged && !tag.affects) return { ok: true, quiet: true, key: 'correct', message: '' };
  if (plugged) return { ok: false, key: 'unrelated_factor', message: `The gauge did not move. Changing ${tag.name} would not change ${p.effect}.` };
  return { ok: false, key: 'missed_factor', message: `That one mattered: changing ${tag.name} WOULD change ${p.effect}.` };
}
export const beltAnswer = (p) => `These change ${p.effect}: ${p.tags.filter((t) => t.affects).map((t) => t.name).join('; ')}. These do not: ${p.tags.filter((t) => !t.affects).map((t) => t.name).join('; ')}.`;

/* ================================================================== */
/* Which way? up, down or the same                                     */
/* ================================================================== */
/** dir: 'up' | 'down' | 'same' | null (any real experiment) */
export function genWay(rnd, dir = null, pair = null) {
  const pool = dir === 'same' ? UNRELATED : dir ? PAIRS.filter((p) => p.dir === dir) : PAIRS;
  return { id: nextId++, type: 'way', pair: pair || pick(rnd, pool) };
}
const SAY = { up: 'goes UP', down: 'goes DOWN', same: 'stays the SAME' };
export function checkWay(p, answer) {
  const { pair } = p, want = pair.dir;
  if (!answer) return { ok: false, nudge: true, key: 'incomplete', message: 'Choose first: will the gauge go up, go down or stay put?' };
  if (answer === want) return { ok: true, key: 'correct', message: want === 'same' ? `Changing the ${pair.cause.name} cannot change the ${pair.effect.name}.` : `Turn the ${pair.cause.name} up, and the gauge (${pair.effect.name}) ${SAY[want]}.` };
  if (want === 'same') return { ok: false, key: 'not_related', message: `The gauge never moved. Changing the ${pair.cause.name} cannot change the ${pair.effect.name}, so it is not a cause at all.` };
  if (want === 'down' && answer === 'up') return { ok: false, key: 'more_is_more', message: `More of a cause does not always mean more of the effect. Turn the ${pair.cause.name} up, and the gauge (${pair.effect.name}) goes DOWN.` };
  return { ok: false, key: 'direction', message: `Look at the lab notes: turn the ${pair.cause.name} up, and the gauge (${pair.effect.name}) ${SAY[want]}.` };
}

/* ================================================================== */
/* Spot the machine wired backwards                                    */
/* ================================================================== */
export function genSpot(rnd) {
  const pairs = [];
  for (const p of shuffle(rnd, PAIRS)) { if (pairs.length < 3 && !pairs.some((q) => q.effect.name === p.effect.name || q.cause.name === p.cause.name)) pairs.push(p); }
  const bad = Math.floor(rnd() * 3);
  return { id: nextId++, type: 'spot', bad, machines: pairs.map((pair, i) => ({ pair, backwards: i === bad, crank: i === bad ? pair.effect : pair.cause, gauge: i === bad ? pair.cause : pair.effect })) };
}
export function checkSpot(p, i) {
  const m = p.machines[i];
  if (m.backwards) return { ok: true, key: 'correct', message: `Found it. ${depends(m.pair)}, so the ${m.pair.cause.name} belongs on the crank.` };
  return { ok: false, key: 'fine_machine', message: `That machine runs fine: ${depends(m.pair).toLowerCase()}. Find the one where the crank is the thing that depends on the other.` };
}
export const spotAnswer = (p) => { const m = p.machines[p.bad]; return `Machine ${p.bad + 1} is backwards. ${depends(m.pair)}.`; };

/* ================================================================== */
/* Build your own experiment                                           */
/* ================================================================== */
export function genBuild(rnd) {
  const pairs = shuffle(rnd, SOLO).slice(0, 2);
  const decoys = shuffle(rnd, UNRELATED).slice(0, 2).map((u) => u.cause);
  return { id: nextId++, type: 'build', tags: shuffle(rnd, [...pairs.flatMap((p) => [p.cause, p.effect]), ...decoys]).map((t) => ({ name: t.name })) };
}
/** The experiments a bank of tags can make. */
export const buildable = (p) => PAIRS.filter((x) => p.tags.some((t) => t.name === x.cause.name) && p.tags.some((t) => t.name === x.effect.name));
/** Any real cause on the crank with its effect on the gauge counts. Returns the pair when it works. */
export function checkBuild(p, crankTag, gaugeTag) {
  if (!crankTag || !gaugeTag) return { ok: false, nudge: true, key: 'incomplete', message: 'Put one tag on the CRANK and one on the GAUGE.' };
  const pair = PAIRS.find((x) => x.cause.name === crankTag.name && x.effect.name === gaugeTag.name);
  if (pair) return { ok: true, key: 'correct', pair, message: `That is an experiment. ${depends(pair)}.` };
  const back = PAIRS.find((x) => x.cause.name === gaugeTag.name && x.effect.name === crankTag.name);
  if (back) return { ok: false, key: 'swapped', message: `Those two belong together, but backwards. ${depends(back)}.` };
  return { ok: false, key: 'not_related', message: `The gauge did not move. Changing the ${crankTag.name} does not change the ${gaugeTag.name}.` };
}
export const buildAnswer = (p) => { const x = buildable(p)[0]; return `One that works: CRANK ${x.cause.name}, GAUGE ${x.effect.name}.`; };

/* ================================================================== */
/* Mystery gauge: decide what to test                                  */
/* ================================================================== */
/** Three cranks and one gauge with no label. Only one crank moves it. tests: free test runs. */
export function genMystery(rnd) {
  const pairs = shuffle(rnd, SOLO).slice(0, 3);
  const real = Math.floor(rnd() * 3);
  return { id: nextId++, type: 'mystery', pairs, real, pair: pairs[real], tests: 2, options: shuffle(rnd, pairs.map((x) => x.effect.name)) };
}
/** Does turning crank i move the gauge? */
export const testCrank = (p, i) => i === p.real;
export function checkMystery(p, optionIndex) {
  const name = p.options[optionIndex], { pair } = p;
  if (name === pair.effect.name) return { ok: true, key: 'correct', message: `The gauge is the ${pair.effect.name}. ${depends(pair)}.` };
  const other = p.pairs.find((x) => x.effect.name === name);
  return { ok: false, key: 'wrong_gauge', message: `The ${name} would depend on the ${other.cause.name}, and that crank did nothing. Which crank DID move the gauge? What depends on it?` };
}
export const mysteryAnswer = (p) => `Only the ${p.pair.cause.name} moves the gauge, so the gauge is the ${p.pair.effect.name}.`;

/* ================================================================== */
/* Zones                                                               */
/* ================================================================== */
export const ZONES = [
  { name: 'Wire and Crank', blurb: 'Which tag goes on the crank? Then turn it' },
  { name: 'What Moves the Gauge?', blurb: 'Plug in every factor that would change it' },
  { name: 'Which Way?', blurb: 'Up, down or no change? Predict, then crank' },
  { name: 'Time, and the Miswired Machine', blurb: 'Time can be the crank OR the gauge' },
  { name: 'Runaway Experiment', blurb: 'Boss: a mystery gauge and a machine of your own' },
];
/** The rounds of a zone, in order. */
export function genZone(rnd, zone) {
  if (zone === 0) return shuffle(rnd, PAIRS).slice(0, 6).map((p) => genWire(rnd, p));
  if (zone === 1) return shuffle(rnd, HUNTS).slice(0, 3).map((h) => genBelt(rnd, h));
  if (zone === 2) return shuffle(rnd, ['up', 'up', 'down', 'down', 'same', null]).map((d) => genWay(rnd, d));
  if (zone === 3) {
    const t = (kind) => shuffle(rnd, TIME_PAIRS.filter((p) => p.time === kind)).slice(0, 2).map((p) => genWire(rnd, p));
    return [...shuffle(rnd, [...t('cause'), ...t('effect')]), genSpot(rnd), genSpot(rnd)];
  }
  return [genMystery(rnd), genBelt(rnd), genBuild(rnd), genSpot(rnd), genMystery(rnd), genBuild(rnd)];
}
