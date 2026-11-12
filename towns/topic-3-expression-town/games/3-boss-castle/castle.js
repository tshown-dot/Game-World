// Boss Castle (Topic 3 boss: the Expression Colossus): the math. A review of lessons 3-1 to 3-7.
// No screen code here, so it can be tested with plain node (see test_boss_castle_math.js).
//
// Every problem uses one of three answer kinds, so the boss has one simple set of controls:
//   num     type a number
//   choice  pick one answer; each wrong answer carries its own explanation
//   boxes   fill number boxes in a pattern, e.g. 6(□x + □) or □^□

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
const int = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];
const shuffle = (rnd, list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
export const near = (a, b) => Math.abs(a - b) < 1e-6;
export const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
export const lcm = (a, b) => (a / gcd(a, b)) * b;
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶' };
export const pow = (b, e) => `${b}${String(e).split('').map((d) => SUP[d]).join('')}`;

export function fmt(v) {
  const x = Math.round(v * 100) / 100;
  if (x < 0) return `−${fmt(-x)}`;
  return Number.isInteger(x) ? x.toLocaleString('en-US') : String(x);
}
/** A typed number: "64", "1,024", "64.0", "$15", "-3". */
export function parseNumber(raw) {
  const t = String(raw ?? '').trim().replace(/^\$/, '').replace(/,/g, '').replace(/^−/, '-').replace(/\s/g, '');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const ok = (text) => ({ text, ok: true, key: 'correct' });
const no = (text, key, message) => ({ text, ok: false, key, message });
/** Options with the same text are dropped (the first one wins), so a choice never shows a duplicate. */
const choice = (rnd, extra, options) => ({ id: nextId++, kind: 'choice', ...extra, options: shuffle(rnd, options.filter((o, i) => !options.slice(0, i).some((u) => u.text === o.text))) });
const num = (extra) => {
  const traps = (extra.traps || []).filter((t, i, all) => !near(t.v, extra.answer) && !all.slice(0, i).some((u) => near(u.v, t.v)));
  return { id: nextId++, kind: 'num', ...extra, traps };
};
const boxes = (extra) => ({ id: nextId++, kind: 'boxes', ...extra });

/* ================================================================== */
/* Zone 1, the Gate: 3-1 exponents                                     */
/* ================================================================== */
export function genPower(rnd, { small = false } = {}) {
  let b, e;
  if (small) { b = int(rnd, 2, 12); e = pick(rnd, [0, 1]); }
  else { do { b = int(rnd, 2, 9); e = int(rnd, 2, 4); } while (b ** e > 10000 || b * e === b ** e); }
  const answer = b ** e;
  const traps = [];                                            // the most specific message comes first
  if (e === 0) traps.push({ v: 0, key: 'zero_exponent', message: `Any nonzero number to the power 0 is 1, so ${pow(b, 0)} = 1.` });
  if (e === 1) traps.push({ v: 1, key: 'one_exponent', message: `A power of 1 is just the base: ${pow(b, 1)} = ${b}.` });
  traps.push({ v: b * e, key: 'base_times_exponent', message: `${pow(b, e)} is NOT ${b} × ${e}. It means ${b} multiplied by itself ${e} time${e === 1 ? '' : 's'}${e > 1 ? `: ${Array(e).fill(b).join(' × ')}` : ''}.` });
  traps.push({ v: e ** b, key: 'swapped', message: `That's ${pow(e, b)}. The big number is the base (${b}); the small raised number is the exponent.` });
  return num({ type: 'power', lesson: '3-1', b, e, show: pow(b, e), prompt: `Evaluate <b class="mono">${pow(b, e)}</b>.`, answer, label: 'value', traps });
}
export function genWritePower(rnd) {
  const b = int(rnd, 2, 9), e = int(rnd, 3, 6);
  const long = Array(e).fill(b).join(' × ');
  return boxes({ type: 'writePower', lesson: '3-1', show: long, prompt: `Write <b class="mono">${long}</b> as a power.`, pattern: ['', { k: 'b' }, '^', { k: 'e' }], want: { b, e }, answerText: pow(b, e) });
}

/* ================================================================== */
/* Zone 2, the Treasury: 3-2 GCF and LCM                               */
/* ================================================================== */
const GCF_STORIES = [
  (a, b) => `${a} pencils and ${b} erasers are packed into identical gift bags with nothing left over. What is the GREATEST number of bags?`,
  (a, b) => `A banner is ${a} inches by ${b} inches. It is cut into the largest equal squares with no scraps. How long is each side?`,
  (a, b) => `${a} boys and ${b} girls split into teams. Every team has the same mix of boys and girls. What is the GREATEST number of teams?`,
];
const LCM_STORIES = [
  (a, b) => `Hot dogs come in packs of ${a} and buns in packs of ${b}. What is the FEWEST hot dogs you can buy to have the same number of each?`,
  (a, b) => `One bus leaves every ${a} minutes and another every ${b} minutes. They just left together. In how many minutes do they leave together again?`,
  (a, b) => `One light blinks every ${a} seconds and another every ${b} seconds. After how many seconds do they first blink together again?`,
];
function gcfPair(rnd) {
  for (;;) { const g = int(rnd, 2, 9), p = int(rnd, 2, 6), q = int(rnd, 2, 7); if (p !== q && gcd(p, q) === 1) return [g * p, g * q]; }
}
function lcmPair(rnd) {
  for (;;) { const a = int(rnd, 3, 12), b = int(rnd, 4, 15); if (a !== b && gcd(a, b) > 1 && lcm(a, b) !== a * b && a % b && b % a) return [a, b]; }
}
export function genGcfOrLcm(rnd) {
  const isG = rnd() < 0.5;
  const [a, b] = isG ? gcfPair(rnd) : lcmPair(rnd);
  const story = (isG ? pick(rnd, GCF_STORIES) : pick(rnd, LCM_STORIES))(a, b);
  return choice(rnd, { type: 'gcfOrLcm', lesson: '3-2', show: 'GCF or LCM?', prompt: `${story} <b>Which do you need?</b>`, answerText: isG ? 'GCF' : 'LCM', isG }, [
    isG ? ok('GCF (greatest common factor)') : ok('LCM (least common multiple)'),
    isG ? no('LCM (least common multiple)', 'gcf_vs_lcm', 'Splitting things into equal groups with nothing left over is a job for FACTORS: the greatest common factor.')
      : no('GCF (greatest common factor)', 'gcf_vs_lcm', '"Together again" or "the same number of each" means counting UP in multiples: the least common multiple.'),
  ]);
}
export function genGcf(rnd) {
  const [a, b] = gcfPair(rnd), g = gcd(a, b);
  const small = [2, 3, 5].find((d) => d < g && g % d === 0);
  return num({ type: 'gcf', lesson: '3-2', show: `${a} and ${b}`, say: `The GCF of ${a} and ${b} is ${g}`, prompt: pick(rnd, GCF_STORIES)(a, b), answer: g, label: 'answer', a, b,
    traps: [
      { v: lcm(a, b), key: 'gcf_vs_lcm', message: `That's a common MULTIPLE. Equal groups with nothing left over needs the greatest common FACTOR of ${a} and ${b}.` },
      ...(small ? [{ v: small, key: 'not_greatest', message: `${small} works, but it isn't the GREATEST common factor. Look for a bigger number that divides both ${a} and ${b}.` }] : []),
      { v: a * b, key: 'gcf_vs_lcm', message: `Multiplying gives a common multiple, not a factor. Find the largest number that divides both ${a} and ${b}.` },
    ] });
}
export function genLcm(rnd) {
  const [a, b] = lcmPair(rnd), m = lcm(a, b);
  return num({ type: 'lcm', lesson: '3-2', show: `${a} and ${b}`, say: `The LCM of ${a} and ${b} is ${m}`, prompt: pick(rnd, LCM_STORIES)(a, b), answer: m, label: 'answer', a, b,
    traps: [
      { v: a * b, key: 'not_least', message: `${a * b} is a common multiple, but not the LEAST one. List multiples of ${Math.max(a, b)} until one is also a multiple of ${Math.min(a, b)}.` },
      { v: gcd(a, b), key: 'gcf_vs_lcm', message: `That's the greatest common FACTOR. "Together again" means a common MULTIPLE of ${a} and ${b}.` },
    ] });
}

/* ================================================================== */
/* Zone 3, the Clock Tower: 3-3 order of operations                    */
/* ================================================================== */
export function genOrder(rnd, form = pick(rnd, ['addMul', 'subAdd', 'paren', 'mulPow', 'divMul'])) {
  let show, answer, traps;
  if (form === 'addMul') {
    const a = int(rnd, 2, 20), b = int(rnd, 2, 9), c = int(rnd, 2, 9);
    show = `${a} + ${b} × ${c}`; answer = a + b * c;
    traps = [{ v: (a + b) * c, key: 'left_to_right', message: `Multiply BEFORE you add: ${b} × ${c} = ${b * c}, then ${a} + ${b * c} = ${answer}.` }];
  } else if (form === 'subAdd') {
    const a = int(rnd, 20, 50), b = int(rnd, 3, 12), c = int(rnd, 2, 12);
    show = `${a} − ${b} + ${c}`; answer = a - b + c;
    traps = [{ v: a - (b + c), key: 'add_before_subtract', message: `Adding and subtracting go LEFT TO RIGHT: ${a} − ${b} = ${a - b} first, then + ${c} = ${answer}.` }];
  } else if (form === 'paren') {
    const c = int(rnd, 2, 4), k = int(rnd, 2, 4), s = c * k, a = int(rnd, 1, s - 1), b = s - a;    // (a + b)² ÷ c
    show = `(${a} + ${b})² ÷ ${c}`; answer = (s * s) / c;
    traps = [{ v: a + (b * b) / c, key: 'parentheses_first', message: `Parentheses first: ${a} + ${b} = ${s}. Then the exponent: ${s}² = ${s * s}. Then ÷ ${c} = ${fmt(answer)}.` },
      { v: (s * 2) / c, key: 'power_is_times_two', message: `${s}² means ${s} × ${s}, not ${s} × 2.` }];
  } else if (form === 'mulPow') {
    const a = int(rnd, 2, 5), b = int(rnd, 2, 6), c = int(rnd, 1, Math.min(9, a * b * b - 1));   // never below 0
    show = `${a} × ${b}² − ${c}`; answer = a * b * b - c;
    traps = [{ v: (a * b) ** 2 - c, key: 'exponent_first', message: `The exponent goes with ${b} only: ${b}² = ${b * b}, then × ${a} = ${a * b * b}, then − ${c} = ${answer}.` }];
  } else {
    const c = int(rnd, 2, 6), d = int(rnd, 2, 5), b = c * int(rnd, 2, 6), a = int(rnd, 5, 30);   // a + b ÷ c × d
    show = `${a} + ${b} ÷ ${c} × ${d}`; answer = a + (b / c) * d;
    traps = [{ v: a + b / (c * d), key: 'mul_before_div', message: `Multiply and divide LEFT TO RIGHT: ${b} ÷ ${c} = ${b / c} first, then × ${d} = ${(b / c) * d}, then add ${a}.` },
      { v: ((a + b) / c) * d, key: 'left_to_right', message: `Divide and multiply before you add: ${b} ÷ ${c} × ${d} = ${(b / c) * d}, then ${a} + ${(b / c) * d} = ${answer}.` }];
  }
  return num({ type: 'order', lesson: '3-3', form, show, prompt: `Evaluate <b class="mono">${show}</b>.`, answer, label: 'value', traps });
}

/* ================================================================== */
/* Zone 4, the Library: 3-4 write and 3-5 evaluate algebraic expressions */
/* ================================================================== */
export function genWriteExpr(rnd) {
  const k = int(rnd, 2, 9), m = int(rnd, 2, 6);
  const forms = [
    () => [`${k} less than a number n`, ok(`n − ${k}`), no(`${k} − n`, 'less_than_backwards', `"${k} less than n" starts with n and takes ${k} away: n − ${k}.`), no(`${k}n`, 'operation_word', '"Less than" means subtract.'), no(`n + ${k}`, 'operation_word', '"Less than" means subtract.')],
    () => [`the product of ${k} and a number n`, ok(`${k}n`), no(`n + ${k}`, 'operation_word', '"Product" means multiply: ' + `${k}n.`), no(`${k} − n`, 'operation_word', '"Product" means multiply.'), no(`n ÷ ${k}`, 'operation_word', '"Product" means multiply.')],
    () => [`a number n divided by ${k}`, ok(`n ÷ ${k}`), no(`${k} ÷ n`, 'divide_backwards', `The number n is being divided, so it comes first: n ÷ ${k}.`), no(`${k}n`, 'operation_word', '"Divided by" means divide.'), no(`n − ${k}`, 'operation_word', '"Divided by" means divide.')],
    () => [`${k} more than ${m} times a number n`, ok(`${m}n + ${k}`), no(`${m}(n + ${k})`, 'parentheses_extra', `Only n is multiplied by ${m}; the ${k} is added after: ${m}n + ${k}.`), no(`${k}n + ${m}`, 'swapped_numbers', `${m} times n is ${m}n. Then add ${k}.`), no(`${m} + ${k}n`, 'swapped_numbers', `${m} TIMES n is ${m}n.`)],
  ];
  const [words, ...opts] = pick(rnd, forms)();
  return choice(rnd, { type: 'writeExpr', lesson: '3-4', show: 'n = ?', prompt: `Which expression means <b>${words}</b>?`, answerText: opts[0].text }, opts);
}
export function genEvaluate(rnd, form = pick(rnd, ['coefPow', 'paren', 'two'])) {
  const x = int(rnd, 2, 6);
  if (form === 'coefPow') {
    const a = int(rnd, 2, 5);
    return num({ type: 'evaluate', lesson: '3-5', form, show: `${a}x²`, prompt: `Evaluate <b class="mono">${a}x²</b> when x = ${x}.`, answer: a * x * x, label: 'value',
      traps: [{ v: (a * x) ** 2, key: 'power_first', message: `Only x is squared: ${x}² = ${x * x}, then × ${a} = ${a * x * x}.` }, { v: a * x * 2, key: 'power_is_times_two', message: `x² means ${x} × ${x}, not ${x} × 2.` }] });
  }
  if (form === 'paren') {
    const a = int(rnd, 2, 6), c = int(rnd, 2, 9);
    return num({ type: 'evaluate', lesson: '3-5', form, show: `${a}(x + ${c})`, prompt: `Evaluate <b class="mono">${a}(x + ${c})</b> when x = ${x}.`, answer: a * (x + c), label: 'value',
      traps: [{ v: a * x + c, key: 'distribute_all', message: `${a} multiplies BOTH x and ${c}: ${a}(${x} + ${c}) = ${a} × ${x + c} = ${a * (x + c)}.` }] });
  }
  const y = int(rnd, 2, 9), a = int(rnd, 2, 5);
  return num({ type: 'evaluate', lesson: '3-5', form, show: `${a}x + y²`, prompt: `Evaluate <b class="mono">${a}x + y²</b> when x = ${x} and y = ${y}.`, answer: a * x + y * y, label: 'value',
    traps: [{ v: a * x + 2 * y, key: 'power_is_times_two', message: `y² means ${y} × ${y} = ${y * y}, not ${y} × 2.` }, { v: (a * x + y) ** 2, key: 'power_first', message: `Only y is squared. ${a} × ${x} = ${a * x}, ${y}² = ${y * y}, then add.` }] });
}

/* ================================================================== */
/* Zone 5, the Throne: 3-6 equivalent expressions, 3-7 simplify        */
/* ================================================================== */
export function genDistribute(rnd) {
  const a = int(rnd, 2, 7), b = int(rnd, 2, 6), c = int(rnd, 1, 9);
  return boxes({ type: 'distribute', lesson: '3-6', show: `${a}(${b}x + ${c})`, prompt: `Use the Distributive Property: <b class="mono">${a}(${b}x + ${c})</b> = ?`, pattern: ['', { k: 'm' }, 'x +', { k: 'c' }], want: { m: a * b, c: a * c }, a, b, c, answerText: `${a * b}x + ${a * c}` });
}
export function genFactor(rnd) {
  let g, p, q;
  do { g = int(rnd, 2, 9); p = int(rnd, 2, 6); q = int(rnd, 1, 9); } while (gcd(p, q) !== 1 || p === q);
  return boxes({ type: 'factor', lesson: '3-6', show: `${g * p}x + ${g * q}`, prompt: `Factor out the GREATEST common factor: <b class="mono">${g * p}x + ${g * q}</b> = ?`, pattern: ['', { k: 'g' }, '(', { k: 'p' }, 'x +', { k: 'q' }, ')'], want: { g, p, q }, answerText: `${g}(${p}x + ${q})` });
}
export function genCombine(rnd) {
  const a = int(rnd, 2, 9), b = int(rnd, 1, 9), c = int(rnd, 2, 9), d = int(rnd, 1, 9);
  return boxes({ type: 'combine', lesson: '3-7', show: `${a}x + ${b} + ${c}x + ${d}`, prompt: `Combine like terms: <b class="mono">${a}x + ${b} + ${c}x + ${d}</b> = ?`, pattern: ['', { k: 'm' }, 'x +', { k: 'c' }], want: { m: a + c, c: b + d }, a, b, cc: c, d, answerText: `${a + c}x + ${b + d}` });
}
/** The final dilemma: which expression is equivalent? Then prove it by evaluating both for one x. */
export function genDilemma(rnd) {
  const a = int(rnd, 2, 5), b = int(rnd, 2, 5), c = int(rnd, 1, 9), e = int(rnd, 1, 6);    // a(bx + c) + ex
  const m = a * b + e, k = a * c;
  const start = `${a}(${b}x + ${c}) + ${e === 1 ? '' : e}x`;
  const part1 = choice(rnd, { type: 'dilemma1', lesson: '3-7', show: start, prompt: `Which expression is equivalent to <b class="mono">${start}</b>?`, answerText: `${m}x + ${k}` }, [
    ok(`${m}x + ${k}`),
    no(`${m}x + ${c}`, 'distribute_all', `Multiply ${a} by BOTH terms in the parentheses: ${a} × ${c} = ${k}.`),
    no(`${a * b}x + ${k}`, 'forgot_term', `Don't forget the + ${e === 1 ? '' : e}x at the end: ${a * b}x + ${e}x = ${m}x.`),
    no(`${m + k}x`, 'combine_unlike', `${m}x and ${k} are NOT like terms, so they can't be added together.`),
  ]);
  const x = int(rnd, 2, 6), val = m * x + k;
  const part2 = num({ type: 'dilemma2', lesson: '3-6', show: `${start}  =  ${m}x + ${k}`, prompt: `Prove they are equivalent: evaluate <b class="mono">${start}</b> when x = ${x}. (${m}x + ${k} should give the same value.)`, answer: val, label: 'value',
    traps: [{ v: a * b * x + c + e * x, key: 'distribute_all', message: `${a} multiplies both ${b}x and ${c}: ${a}(${b * x} + ${c}) = ${a * (b * x + c)}, then + ${e * x} = ${val}.` },
      { v: a * (b * x + c), key: 'forgot_term', message: `That's ${a}(${b}x + ${c}) only. Add the ${e}x too: + ${e * x} = ${val}.` }] });
  return [part1, part2];
}

/* ================================================================== */
/* Zones, backups and checks                                           */
/* ================================================================== */
export const ZONES = [
  { name: 'The Gate', blurb: '3-1: exponents' },
  { name: 'The Treasury', blurb: '3-2: GCF and LCM' },
  { name: 'The Clock Tower', blurb: '3-3: order of operations' },
  { name: 'The Library', blurb: '3-4, 3-5: algebraic expressions' },
  { name: 'The Throne', blurb: 'Boss: 3-6, 3-7 and a dilemma' },
];
export function genZone(rnd, zone) {
  if (zone === 0) return shuffle(rnd, [genPower(rnd), genPower(rnd), genPower(rnd, { small: true }), genWritePower(rnd), genWritePower(rnd)]);
  if (zone === 1) return [genGcfOrLcm(rnd), ...shuffle(rnd, [genGcf(rnd), genGcf(rnd), genLcm(rnd), genLcm(rnd)])];
  if (zone === 2) return shuffle(rnd, ['addMul', 'subAdd', 'paren', 'mulPow', 'divMul'].map((f) => genOrder(rnd, f)));
  if (zone === 3) return shuffle(rnd, [genWriteExpr(rnd), genWriteExpr(rnd), genEvaluate(rnd, 'coefPow'), genEvaluate(rnd, 'paren'), genEvaluate(rnd, 'two')]);
  return [genDistribute(rnd), genFactor(rnd), genCombine(rnd), ...genDilemma(rnd)];
}
export function genBackup(rnd, p) {
  const t = p.type;
  if (t === 'power') return genPower(rnd, { small: p.e <= 1 });
  if (t === 'writePower') return genWritePower(rnd);
  if (t === 'gcfOrLcm') return genGcfOrLcm(rnd);
  if (t === 'gcf') return genGcf(rnd);
  if (t === 'lcm') return genLcm(rnd);
  if (t === 'order') return genOrder(rnd, p.form);
  if (t === 'writeExpr') return genWriteExpr(rnd);
  if (t === 'evaluate') return genEvaluate(rnd, p.form);
  if (t === 'distribute') return genDistribute(rnd);
  if (t === 'factor') return genFactor(rnd);
  if (t === 'combine') return genCombine(rnd);
  const [a, b] = genDilemma(rnd);
  return t === 'dilemma1' ? a : b;
}
export function checkNum(p, raw) {
  const v = parseNumber(raw);
  if (v === null) return { correct: false, nudge: true, key: 'incomplete', message: 'Type a number.' };
  if (near(v, p.answer)) return { correct: true, key: 'correct', message: `Crack! ${p.say || `${p.show.split('  =  ')[0]} = ${fmt(p.answer)}`}.` };
  const trap = p.traps.find((t) => near(v, t.v));
  if (trap) return { correct: false, key: trap.key, message: trap.message };
  return { correct: false, key: 'check_it', message: 'Not quite. Work it one step at a time: parentheses, exponents, multiply and divide, then add and subtract.' };
}
export function checkChoice(p, i) {
  const o = p.options[i];
  if (o.ok) return { correct: true, key: 'correct', message: `Crack! ${o.text}.` };
  return { correct: false, key: o.key, message: o.message };
}
/** Number boxes. vals = { key: typed text }. */
export function checkBoxes(p, vals) {
  const keys = p.pattern.filter((x) => typeof x === 'object').map((x) => x.k);
  const v = {};
  for (const k of keys) { v[k] = parseNumber(vals[k]); if (v[k] === null) return { correct: false, nudge: true, key: 'incomplete', message: 'Fill in every box.' }; }
  const w = p.want;
  if (keys.every((k) => near(v[k], w[k]))) return { correct: true, key: 'correct', message: `Crack! ${p.answerText}.` };
  if (p.type === 'writePower') {
    if (near(v.b, w.e) && near(v.e, w.b)) return { correct: false, key: 'swapped', message: `Backwards: the repeated number (${w.b}) is the BASE, and how many times it appears (${w.e}) is the exponent.` };
    if (near(v.b, w.b)) return { correct: false, key: 'count_factors', message: `Right base. Now count how many ${w.b}s are multiplied: ${w.e}.` };
    return { correct: false, key: 'base_exponent', message: `The base is the number being multiplied (${w.b}); the exponent counts how many times.` };
  }
  if (p.type === 'distribute') {
    if (near(v.m, w.m) && near(v.c, p.c)) return { correct: false, key: 'distribute_all', message: `Multiply ${p.a} by BOTH terms: ${p.a} × ${p.c} = ${w.c}, not ${p.c}.` };
    if (near(v.m, p.b) && near(v.c, w.c)) return { correct: false, key: 'distribute_all', message: `Multiply ${p.a} by ${p.b}x too: ${p.a} × ${p.b}x = ${w.m}x.` };
    return { correct: false, key: 'check_it', message: `${p.a}(${p.b}x + ${p.c}) = ${p.a} × ${p.b}x + ${p.a} × ${p.c}.` };
  }
  if (p.type === 'factor') {
    const backTo = (g, a, b) => near(g * a, w.g * w.p) && near(g * b, w.g * w.q);
    if (backTo(v.g, v.p, v.q)) return { correct: false, key: 'not_greatest', message: `That's equivalent, but ${fmt(v.g)} isn't the GREATEST common factor of ${w.g * w.p} and ${w.g * w.q}. Look for a bigger one.` };
    return { correct: false, key: 'check_it', message: `Check by distributing back: ${fmt(v.g)}(${fmt(v.p)}x + ${fmt(v.q)}) = ${fmt(v.g * v.p)}x + ${fmt(v.g * v.q)}, not ${p.show}.` };
  }
  // combine like terms
  if (near(v.m, w.m + w.c) || near(v.c, w.m + w.c)) return { correct: false, key: 'combine_unlike', message: `x-terms and plain numbers are NOT like terms. Add ${p.a}x + ${p.cc}x, and separately ${p.b} + ${p.d}.` };
  if (near(v.m, w.m)) return { correct: false, key: 'add_constants', message: `Right x-term. Now add the plain numbers: ${p.b} + ${p.d} = ${w.c}.` };
  return { correct: false, key: 'add_coefficients', message: `Add the numbers in front of x: ${p.a} + ${p.cc} = ${w.m}.` };
}

/* ================================================================== */
/* Worked solutions (after two misses)                                 */
/* ================================================================== */
export function workedSolution(p) {
  const t = p.type;
  if (t === 'power') return [`${p.show}: base ${p.b}, exponent ${p.e}.`, p.e === 0 ? 'Any nonzero number to the power 0 is 1.' : p.e === 1 ? 'A power of 1 is just the base.' : `${Array(p.e).fill(p.b).join(' × ')}`, `= ${fmt(p.answer)}`];
  if (t === 'writePower') return [`The repeated number is the base: ${p.want.b}.`, `It appears ${p.want.e} times: the exponent is ${p.want.e}.`, `= ${p.answerText}`];
  if (t === 'gcfOrLcm') return ['Equal groups, nothing left over, the largest size: GCF.', 'Repeating events lining up again, the smallest amount: LCM.', `Here: ${p.answerText}.`];
  if (t === 'gcf') { const common = Array.from({ length: Math.min(p.a, p.b) }, (_, i) => i + 1).filter((d) => p.a % d === 0 && p.b % d === 0); return [`Factors that ${p.a} and ${p.b} share: ${common.join(', ')}.`, `The greatest one: ${p.answer}.`]; }
  if (t === 'lcm') return [`List multiples of ${Math.max(p.a, p.b)}: ${[1, 2, 3, 4].map((i) => Math.max(p.a, p.b) * i).join(', ')}, …`, `The first that ${Math.min(p.a, p.b)} also divides: ${p.answer}.`];
  if (t === 'order' || t === 'evaluate' || t === 'dilemma2') return ['Parentheses, then exponents.', 'Then multiply and divide, left to right.', 'Then add and subtract, left to right.', `${p.show.split('  =  ')[0]} = ${fmt(p.answer)}`];
  if (t === 'writeExpr') return ['"Less than" and "more than" mean subtract and add, and the order matters.', '"Product" means multiply; "divided by" puts the first number first.', `Answer: ${p.answerText}.`];
  if (t === 'distribute') return [`Multiply ${p.a} by each term inside.`, `${p.a} × ${p.b}x = ${p.want.m}x and ${p.a} × ${p.c} = ${p.want.c}.`, `= ${p.answerText}`];
  if (t === 'factor') return [`GCF of ${p.want.g * p.want.p} and ${p.want.g * p.want.q} is ${p.want.g}.`, `${p.want.g * p.want.p}x ÷ ${p.want.g} = ${p.want.p}x and ${p.want.g * p.want.q} ÷ ${p.want.g} = ${p.want.q}.`, `= ${p.answerText}`];
  if (t === 'combine') return [`x-terms: ${p.a}x + ${p.cc}x = ${p.want.m}x.`, `Numbers: ${p.b} + ${p.d} = ${p.want.c}.`, `= ${p.answerText}`];
  return ['Distribute first, then combine the x-terms.', `= ${p.answerText}`];
}
