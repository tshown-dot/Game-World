// Ride Gate (Lesson 4-6: Understand and Write Inequalities): the math.
// No screen code here, so it can be tested with plain node (see test_ride_gate_math.js).
//
// A gate rule is an inequality: { letter, sym, n } means "letter sym n", for example h ≥ 42.
// A two-letter rule has `other` instead of n: m > g.
// Riders are values: a 42-inch rider passes h ≥ 42 but not h > 42.

export const SYMS = ['<', '≤', '>', '≥', '≠'];
export const SYM_WORD = { '<': 'less than', '≤': 'less than or equal to', '>': 'greater than', '≥': 'greater than or equal to', '≠': 'not equal to' };
const FLIP = { '<': '>', '>': '<', '≤': '≥', '≥': '≤', '≠': '≠' };          // the same rule written number-first
const OTHER_SIDE = { '<': '≥', '≥': '<', '>': '≤', '≤': '>' };               // everyone the rule leaves out
const near = (a, b) => Math.abs(a - b) < 1e-9;
let nextId = 1;

/** Repeatable random numbers for tests (mulberry32). */
export function seeded(seed = 1) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];
const shuffle = (rnd, list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

/** 42 -> "42", 19.7 -> "19.7", money 7.5 -> "$7.50". */
export function fmt(v, money = false) {
  if (money) return `$${Number.isInteger(v) ? v : v.toFixed(2)}`;
  return String(Math.round(v * 100) / 100);
}
export const ruleText = (r) => (r.other ? `${r.letter} ${r.sym} ${r.other}` : `${r.letter} ${r.sym} ${fmt(r.n)}`);
export const flipped = (r) => `${fmt(r.n)} ${FLIP[r.sym]} ${r.letter}`;
export const complement = (r) => ({ ...r, sym: OTHER_SIDE[r.sym] });
/** Does value v pass the rule? */
export function passes(r, v) {
  if (r.sym === '<') return v < r.n && !near(v, r.n);
  if (r.sym === '≤') return v < r.n || near(v, r.n);
  if (r.sym === '>') return v > r.n && !near(v, r.n);
  if (r.sym === '≥') return v > r.n || near(v, r.n);
  return !near(v, r.n);
}

/* ================================================================== */
/* Signs: phrases that mean each symbol (from the textbook lesson)     */
/* ================================================================== */
// Each sign: the letter, what it measures, the unit, a number range, and sentences for each symbol it can use.
const SIGNS = [
  { letter: 'h', what: 'height', unit: 'inches', range: [36, 54], say: {
    '≥': [(n) => `YOU MUST BE AT LEAST ${n} INCHES TALL TO RIDE`, (n) => `RIDERS: NO LESS THAN ${n} INCHES TALL`],
    '>': [(n) => `RIDERS MUST BE TALLER THAN ${n} INCHES`],
    '<': [(n) => `KIDDIE TRAIN: RIDERS SHORTER THAN ${n} INCHES ONLY`],
    '≤': [(n) => `TEACUPS: RIDERS ${n} INCHES TALL OR LESS`] } },
  { letter: 'a', what: 'age', unit: 'years', range: [6, 14], say: {
    '<': [(n) => `CHILDREN UNDER ${n} MUST RIDE WITH AN ADULT`, (n) => `RIDERS YOUNGER THAN ${n} NEED AN ADULT`],
    '≥': [(n) => `RIDERS ${n} AND OLDER MAY RIDE ALONE`],
    '>': [(n) => `BUMPER BOATS: OLDER THAN ${n} ONLY`] } },
  { letter: 'p', what: 'people in a car', unit: 'people', range: [4, 12], say: {
    '≤': [(n) => `UP TO ${n} PEOPLE PER CAR`, (n) => `NO MORE THAN ${n} RIDERS PER CAR`, (n) => `AT MOST ${n} PEOPLE IN EACH CAR`] } },
  { letter: 'w', what: 'weight in a seat', unit: 'pounds', range: [200, 300], say: {
    '≤': [(n) => `SEAT LIMIT: AT MOST ${n} POUNDS`],
    '<': [(n) => `EACH SEAT HOLDS LESS THAN ${n} POUNDS`] } },
  { letter: 's', what: 'speed', unit: 'miles per hour', range: [15, 40], say: {
    '<': [(n) => `GO-KARTS MUST STAY BELOW ${n} MPH`],
    '≥': [(n) => `THE COASTER MUST REACH AT LEAST ${n} MPH TO FINISH THE LOOP`],
    '>': [(n) => `THE LAUNCH IS FASTER THAN ${n} MPH`] } },
  { letter: 't', what: 'wait time', unit: 'minutes', range: [10, 45], say: {
    '>': [(n) => `FAST PASS FOR WAITS LONGER THAN ${n} MINUTES`],
    '≥': [(n) => `THE SHOW LASTS AT LEAST ${n} MINUTES`] } },
  { letter: 'r', what: 'ride number', unit: '', range: [3, 15], say: {
    '≠': [(n) => `RIDE ${n} IS CLOSED TODAY`, (n) => `TODAY'S RIDE IS NOT RIDE ${n}`] } },
];
const signWith = (rnd, sym, letters = null) => pick(rnd, SIGNS.filter((s) => s.say[sym] && (!letters || letters.includes(s.letter))));

/** A sign and its rule. */
export function genSignRule(rnd, sym = pick(rnd, ['<', '≤', '>', '≥', '<', '≤', '>', '≥', '≠']), letters = null) {
  const s = signWith(rnd, sym, letters);
  const n = int(rnd, s.range[0], s.range[1]);
  return { letter: s.letter, sym, n, what: s.what, unit: s.unit, sign: pick(rnd, s.say[sym])(n) };
}

/* ================================================================== */
/* Problems                                                            */
/* ================================================================== */
/** Zone 1: read the sign, write the rule. */
export function genSign(rnd, sym) {
  const r = genSignRule(rnd, sym);
  return { id: nextId++, type: 'write', rule: r, ask: `Write the gate rule for the ${r.what}, ${r.letter}.`, tiles: [r.n] };
}
/** Zone 2: one rider at the gate. Boundary riders come often. */
const RIDER_SIGNS = ['h', 'a', 'r'];                  // signs about the rider: height, age, ticket
export function genRider(rnd, rule = genSignRule(rnd, undefined, RIDER_SIGNS)) {
  const n = rule.n;
  const v = pick(rnd, [n, n, n - 1, n + 1, n - int(rnd, 2, 8), n + int(rnd, 2, 8)]);
  return { id: nextId++, type: 'rider', rule, v: Math.max(1, v) };
}
/** Zone 3: build the number line for a rule (no ≠ here). */
export function genLine(rnd) {
  return { id: nextId++, type: 'line', rule: genSignRule(rnd, pick(rnd, ['<', '≤', '>', '≥'])) };
}
/** Zone 3: read a number line, pick its rule. */
export function genReadLine(rnd) {
  const rule = genSignRule(rnd, pick(rnd, ['<', '≤', '>', '≥']));
  const strictSwap = { '<': '≤', '≤': '<', '>': '≥', '≥': '>' }[rule.sym];
  const opts = [
    { rule, ok: true, trap: null },
    { rule: { ...rule, sym: strictSwap }, trap: 'boundary' },
    { rule: { ...rule, sym: FLIP[rule.sym] }, trap: 'direction' },
    { rule: { ...rule, sym: FLIP[strictSwap] }, trap: 'both' },
  ];
  return { id: nextId++, type: 'readline', rule, options: shuffle(rnd, opts).map((o) => ({ ...o, text: ruleText(o.rule) })) };
}
/** Zone 4: the people the sign leaves out. */
export function genOtherSide(rnd) {
  const r = genSignRule(rnd, pick(rnd, ['<', '≤', '>', '≥']));
  return { id: nextId++, type: 'write', other: true, rule: complement(r), shown: r,
    ask: `The sign says: "${r.sign}". Write the rule for the ${r.what} values the sign does NOT include.`, tiles: [r.n] };
}
/** Zone 4: two letters. Mia is taller than Gage: m > g. */
const PAIRS = [
  { a: 'm', b: 'g', text: (A, B, w) => `Mia is ${w} than Gage. Use m for Mia's height and g for Gage's height.`, words: { '>': 'taller', '<': 'shorter' } },
  { a: 'j', b: 'k', text: (A, B, w) => `Jo's coaster car is ${w} than Kai's. Use j for Jo's speed and k for Kai's speed.`, words: { '>': 'faster', '<': 'slower' } },
  { a: 'f', b: 'e', text: (A, B, w) => `Fern waited ${w} than Eli. Use f for Fern's wait and e for Eli's wait.`, words: { '>': 'longer', '<': 'less time' } },
];
export function genTwoLetters(rnd) {
  const pr = pick(rnd, PAIRS), sym = pick(rnd, ['>', '<']);
  const rule = { letter: pr.a, sym, other: pr.b };
  return { id: nextId++, type: 'write', two: true, rule, ask: pr.text(pr.a, pr.b, pr.words[sym]), tiles: [] };
}
/** Zone 4: Elias wrote h ≥ 42 and Nina wrote 42 ≤ h. Who is right? */
export function genWhoIsRight(rnd) {
  const rule = genSignRule(rnd, pick(rnd, ['<', '≤', '>', '≥']));
  const mode = pick(rnd, ['both', 'both', 'elias', 'nina']);
  const elias = mode === 'nina' ? `${rule.letter} ${FLIP[rule.sym]} ${fmt(rule.n)}` : ruleText(rule);
  const nina = mode === 'elias' ? `${fmt(rule.n)} ${rule.sym} ${rule.letter}` : flipped(rule);
  const answer = { both: 0, elias: 1, nina: 2 }[mode];
  const options = ['Both are right', 'Only Elias', 'Only Nina', 'Neither'].map((text, i) => ({ text, ok: i === answer, trap: i === answer ? null : 'who_is_right' }));
  return { id: nextId++, type: 'pick', rule, ask: `The sign says: "${rule.sign}". Elias wrote ${elias}. Nina wrote ${nina}. Who is right?`, elias, nina, mode, options };
}
/** Boss: a sign that needs a calculation first (Taryn: at least 15 rolls at $8 -> d ≥ 120). */
const CALC_SIGNS = [
  (rnd) => { const k = int(rnd, 10, 20), p = int(rnd, 5, 9); return { rule: { letter: 'd', sym: '≥', n: k * p }, decoys: [k + p, k],
    ask: `Taryn sold at least ${k} rolls of gift wrap at $${p} each. Write a rule for the money, d, she earned.` }; },
  (rnd) => { const k = int(rnd, 4, 9), p = int(rnd, 3, 8); return { rule: { letter: 'c', sym: '≤', n: k * p }, decoys: [k + p, p],
    ask: `Each coaster car holds ${p} riders, and the train has ${k} cars. Write a rule for the number of riders, c, on one train.` }; },
];
export function genCalc(rnd) {
  const c = pick(rnd, CALC_SIGNS)(rnd);
  return { id: nextId++, type: 'write', calc: true, rule: c.rule, ask: c.ask, tiles: shuffle(rnd, [c.rule.n, ...c.decoys]) };
}
/** Boss: beat the record (s > 19.7) and the airplane's NOT-allowed passengers (p > 134). */
export function genRecord(rnd) {
  const n = int(rnd, 152, 248) / 10;
  return { id: nextId++, type: 'write', rule: { letter: 's', sym: '>', n }, tiles: [n],
    ask: `The canyon's record snowfall in one day is ${fmt(n)} inches. Write a rule for a snowfall, s, that would BEAT the record.` };
}
export function genNotAllowed(rnd) {
  const n = int(rnd, 110, 180);
  return { id: nextId++, type: 'write', other: true, rule: { letter: 'p', sym: '>', n }, shown: { letter: 'p', sym: '≤', n }, tiles: [n],
    ask: `The sky ride can carry no more than ${n} passengers a trip. Write a rule for the numbers of passengers, p, that are NOT allowed.` };
}

export const ZONES = [
  { name: 'Read the Sign', blurb: 'Turn each sign into a gate rule' },
  { name: 'Gatekeeper', blurb: 'Let riders in or turn them away: watch the boundary!' },
  { name: 'Number Line', blurb: 'Build and read rules on a number line' },
  { name: 'The Other Side', blurb: 'Who is left out? Two letters? Who is right?' },
  { name: 'Opening Day', blurb: 'Boss: calculate the rule, beat the record, then a fast gate' },
];
export function genZone(rnd, zone) {
  if (zone === 0) return shuffle(rnd, ['<', '≤', '>', '≥', '≠', pick(rnd, ['≥', '≤'])].map((s) => genSign(rnd, s)));
  if (zone === 1) {
    const a = genSignRule(rnd, pick(rnd, ['≥', '≤']), RIDER_SIGNS), b = genSignRule(rnd, pick(rnd, ['<', '>']), RIDER_SIGNS), c = genSignRule(rnd, '≠', RIDER_SIGNS);
    return [a, a, a, a, b, b, b, b, c, c].map((r) => genRider(rnd, r));
  }
  if (zone === 2) return shuffle(rnd, [genLine(rnd), genLine(rnd), genLine(rnd), genReadLine(rnd), genReadLine(rnd)]);
  if (zone === 3) return shuffle(rnd, [genOtherSide(rnd), genOtherSide(rnd), genTwoLetters(rnd), genTwoLetters(rnd), genWhoIsRight(rnd)]);
  const gate = genSignRule(rnd, pick(rnd, ['≥', '>']), RIDER_SIGNS);
  return [genCalc(rnd), genRecord(rnd), genNotAllowed(rnd), genRider(rnd, gate), { ...genRider(rnd, gate), v: gate.n }];
}
export function genBackup(rnd, p) {
  if (p.type === 'rider') return genRider(rnd);
  if (p.type === 'line') return genLine(rnd);
  if (p.type === 'readline') return genReadLine(rnd);
  if (p.type === 'pick') return genWhoIsRight(rnd);
  if (p.two) return genTwoLetters(rnd);
  if (p.calc) return genCalc(rnd);
  if (p.other) return p.rule.letter === 'p' && p.rule.n > 100 ? genNotAllowed(rnd) : genOtherSide(rnd);
  if (p.rule.letter === 's' && !Number.isInteger(p.rule.n)) return genRecord(rnd);
  return genSign(rnd, p.rule.sym);
}

/* ================================================================== */
/* Checking                                                            */
/* ================================================================== */
/** Reads tiles [{t:'var', v:'h'}, {t:'sym', v:'≥'}, {t:'num', v:42}] (or two letters). */
export function readTiles(tiles) {
  if (tiles.length !== 3 || tiles[1].t !== 'sym' || tiles[0].t === 'sym' || tiles[2].t === 'sym') return null;
  return { left: tiles[0], sym: tiles[1].v, right: tiles[2] };
}
const tokText = (t) => (t.t === 'num' ? fmt(t.v) : t.v);
export const tilesText = (tiles) => tiles.map((t) => (t.t === 'sym' ? t.v : tokText(t))).join(' ');

/** Did the student write this rule (either way round)? */
export function checkWritten(p, tiles) {
  const r = p.rule;
  const w = readTiles(tiles);
  const want = `${ruleText(r)}`;
  if (!w) return { correct: false, nudge: true, key: 'incomplete', message: `A rule has three parts: ${r.other ? 'a letter, a symbol and a letter' : 'the letter, a symbol and a number'}.` };
  // Put it in letter-first form: "42 ≤ h" becomes "h ≥ 42".
  let L, sym, R;
  if (w.left.t === 'var' && w.left.v === r.letter) { L = w.left; sym = w.sym; R = w.right; }
  else if (w.right.t === 'var' && w.right.v === r.letter) { L = w.right; sym = FLIP[w.sym]; R = w.left; }
  else return { correct: false, nudge: true, key: 'incomplete', message: `Use the letter ${r.letter} in your rule.` };
  const rightThing = r.other ? R.t === 'var' && R.v === r.other : R.t === 'num' && near(R.v, r.n);
  if (!rightThing) {
    if (p.calc) return { correct: false, key: 'calc_first', message: `Work out the boundary first: ${p.ask.match(/\d+/g).slice(0, 2).join(' × ')} = ${fmt(r.n)}.` };
    return { correct: false, key: 'wrong_number', message: `Check the number in the rule: it should be ${r.other ? r.other : fmt(r.n)}.` };
  }
  if (sym === r.sym) return { correct: true, key: 'correct', message: `Yes! ${tilesText(tiles)}${w.left.t !== 'var' || w.left.v !== r.letter ? ` is the same rule as ${want}` : ''}.` };
  const numberFirst = !(w.left.t === 'var' && w.left.v === r.letter);
  const bound = r.other ? r.other : fmt(r.n);
  if (numberFirst && w.sym === r.sym) {
    return { correct: false, key: 'flipped_order', message: `Careful: with the ${r.other ? 'other letter' : 'number'} first, the symbol turns around. "${want}" is the same as ${r.other ? `${r.other} ${FLIP[r.sym]} ${r.letter}` : flipped(r)}.` };
  }
  if (r.sym === '≠' || sym === '≠') return { correct: false, key: 'not_equal', message: `"${r.sym === '≠' ? 'Is not' : 'This sign'}" ${r.sym === '≠' ? `means every value except ${bound}: ${want}.` : `is about more or less, not just "not equal": ${want}.`}` };
  const strictSwap = { '<': '≤', '≤': '<', '>': '≥', '≥': '>' }[r.sym];
  if (sym === strictSwap) {
    const inc = r.sym === '≥' || r.sym === '≤';
    return { correct: false, key: 'boundary', message: `So close! Does ${bound} itself count? ${inc ? `Yes, so use ${r.sym} (with the line under it)` : `No, so use ${r.sym} (no line under it)`}: ${want}.` };
  }
  if (p.other) return { correct: false, key: 'other_side', message: `That's the sign's own rule. The ones it leaves out are on the other side, and the boundary flips too: ${want}.` };
  return { correct: false, key: 'direction', message: `The symbol points the wrong way. Read it as "${r.letter} is ${SYM_WORD[r.sym]} ${bound}": ${want}.` };
}

/** A rider at the gate. */
export function checkRider(p, letIn) {
  const ok = passes(p.rule, p.v);
  const v = fmt(p.v), n = fmt(p.rule.n), L = p.rule.letter;
  const sub = `${v} ${p.rule.sym} ${n}`;
  if (letIn === ok) return { correct: true, key: 'correct', message: `${ok ? 'In!' : 'Turned away.'} ${sub} is ${ok ? 'true' : 'false'}.` };
  if (near(p.v, p.rule.n)) {
    const inc = p.rule.sym === '≥' || p.rule.sym === '≤';
    return { correct: false, key: 'boundary_rider', message: `Exactly ${n}! ${p.rule.sym === '≠' ? `"${L} ≠ ${n}" leaves out exactly ${n}.` : inc ? `${p.rule.sym} includes ${n}, so this rider gets in.` : `${p.rule.sym} does NOT include ${n}, so this rider is turned away.`}` };
  }
  return { correct: false, key: 'rider_wrong', message: `Put the rider in the rule: ${sub} is ${ok ? 'TRUE, so let them in' : 'FALSE, so turn them away'}.` };
}

/** The number line the student built: { at, closed, dir: 'left'|'right' }. */
export function checkLine(rule, { at, closed, dir }) {
  const wantClosed = rule.sym === '≥' || rule.sym === '≤';
  const wantDir = rule.sym === '>' || rule.sym === '≥' ? 'right' : 'left';
  const n = fmt(rule.n);
  if (!near(at, rule.n)) return { correct: false, key: 'line_number', message: `The post goes at the boundary, ${n}.` };
  if (closed !== wantClosed) return { correct: false, key: 'line_circle', message: `${wantClosed ? `${rule.sym} includes ${n}, so fill the circle in (closed ●).` : `${rule.sym} does not include ${n}, so leave the circle open (○).`}` };
  if (dir !== wantDir) return { correct: false, key: 'line_direction', message: `${rule.letter} ${rule.sym} ${n} means values ${wantDir === 'right' ? 'GREATER' : 'LESS'} than ${n}, so the arrow points ${wantDir}.` };
  return { correct: true, key: 'correct', message: `Yes! ${wantClosed ? 'Closed' : 'Open'} circle at ${n}, arrow to the ${wantDir}: ${ruleText(rule)}.` };
}

/** Picks: read a number line, or who is right. */
export function checkPick(p, i) {
  const o = p.options[i], right = p.options.find((x) => x.ok);
  if (p.type === 'readline') {
    if (o.ok) return { correct: true, key: 'correct', message: `Yes! ${lineWords(p.rule)}: ${right.text}.` };
    return { correct: false, key: o.trap === 'boundary' ? 'line_circle' : 'line_direction', message: `Look again: ${lineWords(p.rule)}, so it's ${right.text}.` };
  }
  const why = p.mode === 'both' ? `${p.elias} and ${p.nina} say the same thing: the symbol turns around when the number goes first.`
    : p.mode === 'elias' ? `${p.elias} is right. ${p.nina} has the number first but did not turn the symbol around.`
      : `${p.nina} is right. ${p.elias} points the wrong way.`;
  if (o.ok) return { correct: true, key: 'correct', message: `Yes! ${why}` };
  return { correct: false, key: 'who_is_right', message: `Not quite. ${why} So: ${right.text}.` };
}
const lineWords = (r) => `${r.sym === '≥' || r.sym === '≤' ? 'a closed circle' : 'an open circle'} at ${fmt(r.n)} with the arrow pointing ${r.sym === '>' || r.sym === '≥' ? 'right' : 'left'}`;

/* ================================================================== */
/* Worked solutions (after two misses)                                 */
/* ================================================================== */
export function workedSolution(p) {
  const r = p.rule;
  if (p.type === 'rider') return [`The rule: ${ruleText(r)}.`, `Put the rider in: ${fmt(p.v)} ${r.sym} ${fmt(r.n)}?`, `That is ${passes(r, p.v) ? 'TRUE: let them in' : 'FALSE: turn them away'}.`];
  if (p.type === 'line' || p.type === 'readline') return [`${ruleText(r)}: is ${fmt(r.n)} included? ${r.sym === '≥' || r.sym === '≤' ? 'Yes: closed circle ●' : 'No: open circle ○'}.`, `Which way? ${r.sym === '>' || r.sym === '≥' ? 'Greater: arrow to the right' : 'Less: arrow to the left'}.`, `So: ${lineWords(r)}.`];
  if (p.type === 'pick') return [`"${r.sign}" means ${ruleText(r)}.`, `With the number first it is ${flipped(r)} (the symbol turns around).`, `Elias wrote ${p.elias}; Nina wrote ${p.nina}. ${checkPick(p, p.options.findIndex((o) => o.ok)).message.replace(/^Yes! /, '')}`];
  const lines = [];
  if (p.calc) lines.push(`Boundary first: ${p.ask.match(/\d+/g).slice(0, 2).join(' × ')} = ${fmt(r.n)}.`);
  if (p.other) lines.push(`The sign's own rule is ${ruleText(p.shown)}. Everyone else is on the other side.`);
  if (p.two) lines.push(`${r.letter} is ${SYM_WORD[r.sym]} ${r.other}.`);
  else lines.push(`Does ${fmt(r.n)} itself count? ${r.sym === '≥' || r.sym === '≤' ? 'Yes' : 'No'}. Which way? ${r.sym === '≠' ? 'Every value but that one' : r.sym === '>' || r.sym === '≥' ? 'Greater' : 'Less'}.`);
  lines.push(`Rule: ${ruleText(r)}${r.other ? ` (or ${r.other} ${FLIP[r.sym]} ${r.letter})` : ` (or ${flipped(r)})`}`);
  return lines;
}
