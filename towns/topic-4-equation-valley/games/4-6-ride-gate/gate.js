// Ride Gate (Lesson 4-6: Understand and Write Inequalities): the math.
// No screen code here, so it can be tested with plain node (see test_ride_gate_math.js).
//
// A gate rule is an inequality: { letter, sym, n } means "letter sym n", for example h ≥ 42.
// Riders carry a number: a 42-inch rider passes h ≥ 42 but not h > 42.
// Round types:
//   keep    the student IS the gate: read the sign, let each rider in or turn them away
//   write   the student PROGRAMS the gate: build the rule from tiles, then the gate runs it on a line of riders
//           mode: null    a sign in words
//                 other   the sign says who is NOT allowed; the gate needs who IS
//                 mirror  the display starts with the number: 42 ≤ h
//                 hidden  the words are worn off the sign: send test riders first (the student picks their numbers)
//                 calc    the edge has to be worked out first
//                 record  beat a lap time (a decimal, and "better" means less)
// Signs come from the kinds of situations in the textbook lesson. Teacher: review the wording.

export const SYMS = ['<', '≤', '>', '≥', '≠'];
export const SYM_WORD = { '<': 'less than', '≤': 'less than or equal to', '>': 'greater than', '≥': 'greater than or equal to', '≠': 'not equal to' };
const FLIP = { '<': '>', '>': '<', '≤': '≥', '≥': '≤', '≠': '≠' };          // the same rule written number-first
const OTHER_SIDE = { '<': '≥', '≥': '<', '>': '≤', '≤': '>' };               // everyone the rule leaves out
const STRICT_SWAP = { '<': '≤', '≤': '<', '>': '≥', '≥': '>' };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const r1 = (v) => Math.round(v * 10) / 10;
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

export const fmt = (v) => String(r1(v));
export const ruleText = (r) => `${r.letter} ${r.sym} ${fmt(r.n)}`;
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
/** What a rider's card says: "42 in", "$120", "ride 7". */
export function riderText(rule, v) {
  if (rule.unit === '$') return `$${fmt(v)}`;
  if (rule.unit === 'ride') return `ride ${fmt(v)}`;
  if (rule.unit === 'people' && near(v, 1)) return '1 person';
  return `${fmt(v)} ${rule.unit}`;
}

/* ================================================================== */
/* Signs: phrases that mean each symbol                                */
/* ================================================================== */
// Each sign says who gets THROUGH this gate. say: sentences for each symbol the sign can use.
const SIGNS = [
  { letter: 'h', what: 'height', unit: 'in', range: [36, 54], say: {
    '≥': [(n) => `YOU MUST BE AT LEAST ${n} INCHES TALL TO RIDE`, (n) => `RIDERS: NO LESS THAN ${n} INCHES TALL`, (n) => `MINIMUM HEIGHT: ${n} INCHES`],
    '>': [(n) => `RIDERS MUST BE TALLER THAN ${n} INCHES`, (n) => `OVER ${n} INCHES TALL ONLY`],
    '<': [(n) => `KIDDIE TRAIN: RIDERS SHORTER THAN ${n} INCHES ONLY`, (n) => `UNDER ${n} INCHES TALL ONLY`],
    '≤': [(n) => `TEACUPS: RIDERS ${n} INCHES TALL OR LESS`, (n) => `MAXIMUM HEIGHT: ${n} INCHES`] } },
  { letter: 'a', what: 'age', unit: 'yr', range: [6, 14], say: {
    '<': [(n) => `KIDS' POOL: YOUNGER THAN ${n} ONLY`, (n) => `UNDER ${n} YEARS OLD ONLY`],
    '≥': [(n) => `AGES ${n} AND UP`, (n) => `YOU MUST BE AT LEAST ${n} YEARS OLD`],
    '>': [(n) => `BUMPER BOATS: OLDER THAN ${n} ONLY`],
    '≤': [(n) => `AGES ${n} AND UNDER`, (n) => `NO OLDER THAN ${n}`] } },
  { letter: 'p', what: 'people in the group', unit: 'people', range: [4, 12], say: {
    '≤': [(n) => `UP TO ${n} PEOPLE PER CAR`, (n) => `NO MORE THAN ${n} PEOPLE PER CAR`, (n) => `AT MOST ${n} PEOPLE IN EACH CAR`],
    '<': [(n) => `FEWER THAN ${n} PEOPLE PER RAFT`],
    '≥': [(n) => `GROUP LANE: ${n} OR MORE PEOPLE`, (n) => `GROUP LANE: AT LEAST ${n} PEOPLE`],
    '>': [(n) => `BIG RAFT: MORE THAN ${n} PEOPLE`] } },
  { letter: 'w', what: 'weight', unit: 'lb', range: [200, 300], say: {
    '≤': [(n) => `SEAT LIMIT: AT MOST ${n} POUNDS`, (n) => `MAXIMUM LOAD: ${n} POUNDS`],
    '<': [(n) => `EACH SEAT HOLDS LESS THAN ${n} POUNDS`] } },
  { letter: 'r', what: 'ride number on the ticket', unit: 'ride', range: [3, 15], say: {
    '≠': [(n) => `RIDE ${n} IS CLOSED TODAY. EVERY OTHER TICKET IS GOOD`, (n) => `TICKETS FOR ANY RIDE EXCEPT RIDE ${n}`] } },
];
// Signs that say who is NOT allowed. They are filed under the rule for who IS allowed.
const NOT_SIGNS = [
  { letter: 'h', what: 'height', unit: 'in', range: [36, 54], say: {
    '≥': [(n) => `NO RIDERS UNDER ${n} INCHES TALL`], '≤': [(n) => `NO RIDERS OVER ${n} INCHES TALL`],
    '<': [(n) => `NO RIDERS ${n} INCHES OR TALLER`], '>': [(n) => `NO RIDERS ${n} INCHES OR SHORTER`] } },
  { letter: 'a', what: 'age', unit: 'yr', range: [6, 14], say: {
    '≥': [(n) => `NO CHILDREN UNDER ${n}`], '≤': [(n) => `NOT FOR ANYONE OVER ${n}`],
    '<': [(n) => `NO ONE ${n} OR OLDER`], '>': [(n) => `NO ONE ${n} OR YOUNGER`] } },
];
const UNIT_WORD = { in: 'INCHES', yr: 'YEARS', people: 'PEOPLE', lb: 'POUNDS' };

/** A sign and its rule. letters: only signs about these. */
export function genSignRule(rnd, sym = pick(rnd, ['<', '≤', '>', '≥', '<', '≤', '>', '≥', '≠']), letters = null, bank = SIGNS) {
  const s = pick(rnd, bank.filter((x) => x.say[sym] && (!letters || letters.includes(x.letter))));
  const n = int(rnd, s.range[0], s.range[1]);
  return { letter: s.letter, sym, n, what: s.what, unit: s.unit, sign: pick(rnd, s.say[sym])(n) };
}
/** Riders for a rule: always the edge itself and one either side of it, plus some further away. */
export function genRiders(rnd, rule, count = 6) {
  const step = Number.isInteger(rule.n) ? 1 : 0.1, n = rule.n;
  const far = () => int(rnd, 2, 7) * step;
  const vals = [n, n - step, n + step, n - far(), n + far(), pick(rnd, [n, n - 2 * step, n + 2 * step])];
  while (vals.length < count) vals.push(n + pick(rnd, [-1, 1]) * far());
  return shuffle(rnd, vals.slice(0, Math.max(3, count))).map((v) => r1(Math.max(step, v)));
}

/* ================================================================== */
/* Keep: the student is the gate                                       */
/* ================================================================== */
export function genKeep(rnd, sym) {
  const rule = genSignRule(rnd, sym);
  return { id: nextId++, type: 'keep', seconds: 5, riders: genRiders(rnd, rule, 6).map((v) => ({ rule, v })) };
}
/** Boss: the sign changes every three riders, and they walk faster. */
export function genRush(rnd) {
  const rules = shuffle(rnd, [genSignRule(rnd, pick(rnd, ['≥', '≤']), ['h', 'a']), genSignRule(rnd, pick(rnd, ['<', '>']), ['h', 'a', 'p']), genSignRule(rnd, '≠')]);
  return { id: nextId++, type: 'keep', rush: true, seconds: 3.5, riders: rules.flatMap((rule) => shuffle(rnd, [rule.n, rule.n + pick(rnd, [-1, 1]), rule.n + pick(rnd, [-1, 1]) * int(rnd, 2, 5)]).map((v) => ({ rule, v }))) };
}
/** A rider at the gate. letIn: what the student did. */
export function checkRider(rule, v, letIn) {
  const ok = passes(rule, v), who = riderText(rule, v), n = fmt(rule.n);
  if (letIn === ok) return { ok: true, key: 'correct', message: '' };
  if (near(v, rule.n)) {
    const inc = rule.sym === '≥' || rule.sym === '≤';
    return { ok: false, key: 'boundary_rider', message: `Exactly ${n}! ${rule.sym === '≠' ? `Everything EXCEPT ${n} gets in, so this one is turned away.` : inc ? `The sign includes ${n} itself, so this rider gets in.` : `The sign does NOT include ${n} itself, so this rider is turned away.`} (${ruleText(rule)})` };
  }
  return { ok: false, key: 'rider_wrong', message: `"${who}" should have been ${ok ? 'let IN' : 'turned AWAY'}. Read the sign as a rule: ${ruleText(rule)}. Is ${fmt(v)} ${rule.sym} ${n}? ${ok ? 'Yes.' : 'No.'}` };
}

/* ================================================================== */
/* Write: the student programs the gate                                */
/* ================================================================== */
const CALCS = [
  (rnd) => { const k = int(rnd, 4, 9), p = int(rnd, 3, 8); return { rule: { letter: 'c', sym: '≤', n: k * p, what: 'riders on one train', unit: 'riders' }, decoys: [k + p, p],
    sign: `EACH CAR HOLDS ${p} RIDERS. THE TRAIN HAS ${k} CARS. HOW MANY RIDERS, c, CAN BOARD ONE TRAIN?`, work: `${k} cars × ${p} riders = ${k * p}.` }; },
  (rnd) => { const k = int(rnd, 10, 20), p = int(rnd, 5, 9); return { rule: { letter: 'd', sym: '≥', n: k * p, what: 'dollars spent', unit: '$' }, decoys: [k + p, k],
    sign: `GROUP DISCOUNT: BUY AT LEAST ${k} TICKETS AT $${p} EACH. WHAT TOTAL, d, GETS THE DISCOUNT?`, work: `${k} tickets × $${p} = $${k * p}.` }; },
];
/** sym: which symbol the rule uses (ignored by calc and record). which: 0 or 1 picks the calc story. */
export function genWrite(rnd, sym, mode = null, which = null) {
  let rule, sign, tiles, work = '';
  if (mode === 'calc') { const c = (which === null ? pick(rnd, CALCS) : CALCS[which])(rnd); rule = c.rule; sign = c.sign; work = c.work; tiles = shuffle(rnd, [c.rule.n, ...c.decoys]); }
  else if (mode === 'record') {
    const n = int(rnd, 152, 248) / 10;
    rule = { letter: 's', sym: '<', n, what: 'lap time', unit: 'sec' }; sign = `TODAY'S FASTEST LAP: ${fmt(n)} SECONDS. PODIUM GATE: ONLY LAPS THAT BEAT IT`; tiles = [n];
  } else {
    const r = genSignRule(rnd, sym, mode === 'hidden' ? ['h', 'a', 'p', 'w'] : null, mode === 'other' ? NOT_SIGNS : SIGNS);
    rule = r; sign = mode === 'hidden' ? `▒▒▒▒▒▒ ${r.n} ${UNIT_WORD[r.unit]} ▒▒▒▒▒▒` : r.sign; tiles = [r.n];
  }
  const p = { id: nextId++, type: 'write', mode, rule, sign, work, riders: genRiders(rnd, rule, 6),
    tiles: [{ id: 'L', t: 'var', v: rule.letter }, ...tiles.map((v, i) => ({ id: `n${i}`, t: 'num', v }))] };
  if (mode === 'hidden') { const off = int(rnd, -3, 3); Object.assign(p, { tests: 3, range: { lo: Math.max(1, rule.n - 8 + off), hi: rule.n + 8 + off } }); }
  return p;
}
/** Hidden sign: does a test rider with this number get in? */
export const testRider = (p, v) => passes(p.rule, v);

/** Reads tiles [{t:'var', v:'h'}, {t:'sym', v:'≥'}, {t:'num', v:42}]. */
export function readTiles(tiles) {
  if (tiles.length !== 3 || tiles.some((t) => !t) || tiles[1].t !== 'sym' || tiles[0].t === 'sym' || tiles[2].t === 'sym') return null;
  return { left: tiles[0], sym: tiles[1].v, right: tiles[2] };
}
export const tilesText = (tiles) => tiles.map((t) => (t.t === 'num' ? fmt(t.v) : t.v)).join(' ');
/** The answer, for after two misses. */
export const answerText = (p) => (p.mode === 'mirror' ? `The rule, number first: ${flipped(p.rule)}.` : `The rule: ${ruleText(p.rule)} (or ${flipped(p.rule)}).`);

/**
 * The rule the student built. Returns { ok, key, message, student }.
 * student: the rule as written, letter first ({ letter, sym, n }), so the gate can run it. null when it cannot run.
 * The message says what went wrong without giving the answer away.
 */
export function checkWritten(p, tiles) {
  const r = p.rule, w = readTiles(tiles), n = fmt(r.n);
  const nudge = (message) => ({ ok: false, nudge: true, key: 'incomplete', message, student: null });
  if (!w) return nudge('A rule has three parts: the letter, a symbol and a number.');
  const letterFirst = w.left.t === 'var';
  if (w.left.t === w.right.t) return nudge(`A rule needs the letter ${r.letter} on one side and a number on the other.`);
  if (p.mode === 'mirror' && letterFirst) return nudge('This display starts with the NUMBER. Put the number first.');
  const num = letterFirst ? w.right.v : w.left.v, sym = letterFirst ? w.sym : FLIP[w.sym];
  if (!near(num, r.n)) return { ok: false, key: 'calc_first', student: null, message: `That number is not the edge of the rule. Work it out first: ${p.work}` };
  const student = { ...r, sym };
  if (sym === r.sym) return { ok: true, key: 'correct', student, message: `${tilesText(tiles)}: every rider is sorted the way the sign says.` };
  const no = (key, message) => ({ ok: false, key, message, student });
  if (!letterFirst && w.sym === r.sym) return no('flipped_order', 'With the number first, the symbol has to turn around: the small end still points at the smaller amount.');
  if (r.sym === '≠') return no('not_equal', `This sign shuts out just ONE value. Every other number gets in, above ${n} and below it.`);
  if (sym === '≠') return no('not_equal', 'This sign is about more or less, not about one value that is shut out.');
  if (sym === STRICT_SWAP[r.sym]) return no('boundary', p.mode === 'hidden' ? `Look at the rider who was exactly ${n}. Did the gate open?` : `Does exactly ${n} count? Read the sign again: that decides whether the symbol has the line under it.`);
  if (p.mode === 'other' && sym === OTHER_SIDE[r.sym]) return no('other_side', 'That is the rule for who the sign keeps OUT. The gate needs the rule for who gets IN.');
  if (p.mode === 'record') return no('direction', 'To BEAT a lap time you need FEWER seconds, not more.');
  return no('direction', `The symbol points the wrong way. Read your rule aloud: "${r.letter} is ${SYM_WORD[sym]} ${n}". Is that what the sign says?`);
}
/** Run a written rule on the round's riders. wrong: the first rider the gate got wrong (-1 if none). */
export function gateRun(p, student) {
  const rows = p.riders.map((v) => ({ v, opens: passes(student, v), should: passes(p.rule, v) }));
  return { rows, wrong: rows.findIndex((x) => x.opens !== x.should) };
}
/** What the student just watched go wrong. */
export const consequence = (p, row) => `Your gate ${row.opens ? 'LET IN' : 'TURNED AWAY'} the rider marked "${riderText(p.rule, row.v)}".`;

/* ================================================================== */
/* Zones                                                               */
/* ================================================================== */
export const ZONES = [
  { name: 'Gatekeeper', blurb: 'You are the gate: let riders in or turn them away' },
  { name: 'Program the Gate', blurb: 'Write the rule, then watch the gate use it' },
  { name: 'The Other Side', blurb: 'Who is NOT allowed? And the mirrored display' },
  { name: 'Hidden Sign', blurb: 'The words are worn off: send test riders' },
  { name: 'Opening Day', blurb: 'Boss: work out the edge, beat the record, then a fast gate' },
];
/** The rounds of a zone, in order. */
export function genZone(rnd, zone) {
  if (zone === 0) return shuffle(rnd, [pick(rnd, ['≥', '≤']), pick(rnd, ['<', '>']), '≠']).map((s) => genKeep(rnd, s));
  if (zone === 1) return shuffle(rnd, ['<', '≤', '>', '≥', '≠', pick(rnd, ['≥', '≤'])]).map((s) => genWrite(rnd, s));
  if (zone === 2) { const s = shuffle(rnd, ['<', '≤', '>', '≥']); return [genWrite(rnd, s[0], 'other'), genWrite(rnd, s[1], 'mirror'), genWrite(rnd, s[2], 'other'), genWrite(rnd, s[3], 'mirror'), genWrite(rnd, s[1], 'other'), genWrite(rnd, s[0], 'mirror')]; }
  if (zone === 3) return shuffle(rnd, ['<', '≤', '>', '≥']).map((s) => genWrite(rnd, s, 'hidden'));
  const c = int(rnd, 0, 1);
  return [genWrite(rnd, null, 'calc', c), genWrite(rnd, null, 'record'), genWrite(rnd, pick(rnd, ['<', '≤', '>', '≥']), 'hidden'), genWrite(rnd, null, 'calc', 1 - c), genRush(rnd)];
}
