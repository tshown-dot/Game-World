/**
 * Unit Test Suite: Lesson 3-6 Drone Drop (Distributive Property)
 *
 * Runs the game's own math code, pulled straight out of index.html, so the tests check
 * exactly what students play. The browser-only part of the script is skipped because
 * `window` is undefined here.
 *
 * Verifies:
 * 1. Expression input parsing (spacing, unicode minus, implicit 1, invalid input)
 * 2. Every generated expansion is truly equivalent (checked by plugging in numbers)
 * 3. Reverse Route factoring always uses the GREATEST common factor
 * 4. Inspector cases are labeled correctly (equivalent or not, and where the bad package is)
 * 5. Mistake diagnosis for single deliveries and Express answers
 * 6. Hub hooks are present (ready, mute sync, exit, save & return)
 */

import { readFileSync } from 'fs';
import vm from 'vm';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const api = vm.runInNewContext(`${script}
;({ gcd, gcdAll, expand, toMap, mapEq, total, parseExpr, parseTerm, exprText,
    genNumbers, genOneVar, genLong, genFactor, genInspect, diagnoseTerm, checkExpress,
    ZONES, modeFor, T })`, { console });

const {
  gcdAll, expand, toMap, mapEq, total, parseExpr, parseTerm, exprText,
  genNumbers, genOneVar, genLong, genFactor, genInspect, diagnoseTerm, checkExpress,
  ZONES, modeFor, T,
} = api;

let passed = 0;
let failed = 0;
function assert(condition, name) {
  if (condition) { console.log(`  ✓ ${name}`); passed++; }
  else { console.error(`  ✗ FAIL: ${name}`); failed++; }
}

/** Evaluate a term list at the given variable values. */
function evalTerms(terms, vals) {
  return terms.reduce((s, t) => s + t.s * t.c * (t.v ? vals[t.v] : 1), 0);
}
function randomVals() {
  const vals = {};
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach((v) => { vals[v] = Math.floor(Math.random() * 21) - 10; });
  return vals;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const RUNS = 400;

console.log('--- TEST 1: Expression Input Parsing ---');
assert(same(parseExpr('6x+12'), [{ c: 6, v: 'x', s: 1 }, { c: 12, v: null, s: 1 }]), 'Parses "6x+12"');
assert(same(parseExpr('6x + 12'), parseExpr('6x+12')), 'Spaces are ignored ("6x + 12")');
assert(same(parseExpr(' 6 x+12 '), parseExpr('6x+12')), 'Stray spaces are ignored (" 6 x+12 ")');
assert(same(parseExpr('6x−12'), [{ c: 6, v: 'x', s: 1 }, { c: 12, v: null, s: -1 }]), 'Unicode minus "6x−12" reads as subtraction');
assert(same(parseExpr('x+4'), [{ c: 1, v: 'x', s: 1 }, { c: 4, v: null, s: 1 }]), 'A bare variable means 1x');
assert(same(parseExpr('-2y+8'), [{ c: 2, v: 'y', s: -1 }, { c: 8, v: null, s: 1 }]), 'Leading minus sign "-2y+8"');
assert(same(parseExpr('6a+4b-2').map(t => t.v), ['a', 'b', null]), 'Three terms, two variables "6a+4b-2"');
assert(parseExpr('') === null, 'Empty input is rejected');
assert(parseExpr('6x++2') === null, 'Double operator "6x++2" is rejected');
assert(parseExpr('6x12') === null, 'Missing operator "6x12" is rejected');
assert(parseExpr('6xy') === null, 'Two-letter term "6xy" is rejected');
assert(same(parseTerm('3x'), { c: 3, v: 'x' }) && same(parseTerm('12'), { c: 12, v: null }), 'parseTerm reads "3x" and "12"');

console.log('\n--- TEST 2: Expansions Are Truly Equivalent ---');
for (const [name, gen] of [['Number Town', genNumbers], ['Variable Village', genOneVar], ['Long Street', genLong]]) {
  let ok = true;
  for (let i = 0; i < RUNS && ok; i++) {
    const p = gen();
    const E = expand(p.a, p.terms);
    for (let k = 0; k < 3; k++) {
      const vals = randomVals();
      if (p.a * evalTerms(p.terms, vals) !== evalTerms(E, vals)) { ok = false; break; }
    }
  }
  assert(ok, `${name}: a(b + c) equals the expanded answer for random values (${RUNS} problems)`);
}
let mental = true;
for (let i = 0; i < RUNS; i++) {
  const p = genNumbers();
  if (total(expand(p.a, p.terms)) !== p.a * total(p.terms)) mental = false;
}
assert(mental, 'Number Town totals match the mental-math product');

console.log('\n--- TEST 3: Reverse Route Uses the GCF ---');
let gcfOk = true;
let gcfSize = true;
let gcfInner = true;
for (let i = 0; i < RUNS; i++) {
  const p = genFactor();
  const E = expand(p.a, p.terms);
  if (gcdAll(E.map(t => t.c)) !== p.a) gcfOk = false;
  if (E.some(t => t.c > 99)) gcfSize = false;
  if (gcdAll(p.terms.map(t => t.c)) !== 1) gcfInner = false;
}
assert(gcfOk, `The drone is always the GREATEST common factor of the packages (${RUNS} problems)`);
assert(gcfInner, 'What is left inside the parentheses has no common factor');
assert(gcfSize, 'Every package stays at 99 or below');

console.log('\n--- TEST 4: Inspector Cases Are Labeled Correctly ---');
let labelOk = true;
let badOk = true;
let equivOk = true;
const kinds = new Set();
for (let i = 0; i < RUNS; i++) {
  const p = genInspect();
  kinds.add(`${p.kind}:${p.err}`);
  // The claim "drone(houses) = answer" is equivalent only if it holds for every value
  let holds = true;
  for (let k = 0; k < 4; k++) {
    const vals = randomVals();
    if (p.a * evalTerms(p.terms, vals) !== evalTerms(p.answer, vals)) holds = false;
  }
  if (holds !== p.equiv) equivOk = false;
  if ((p.err === 'ok' || p.err === 'notgcf') !== p.equiv) labelOk = false;
  if (p.equiv !== (p.bad === null)) badOk = false;
}
assert(equivOk, `"Equivalent" flag matches a plug-in-numbers check (${RUNS} cases)`);
assert(labelOk, 'Only correct and not-the-GCF claims are marked equivalent');
assert(badOk, 'Every non-equivalent case marks exactly where the bad package or house is');
assert(['expand:ok', 'expand:missed', 'expand:added', 'factor:ok', 'factor:notgcf'].every(k => kinds.has(k)),
  'Inspector produces correct claims, missed houses, adding errors, and not-the-GCF claims');

console.log('\n--- TEST 5: Mistake Diagnosis ---');
const house = { c: 2, v: 'x' };
assert(diagnoseTerm(3, house, { c: 6, v: 'x' }) === 'ok', '3 · 2x = 6x is correct');
assert(diagnoseTerm(3, house, { c: 6, v: null }) === 'lostvar', '3 · 2x = 6 drops the variable');
assert(diagnoseTerm(3, house, { c: 2, v: 'x' }) === 'missed', '3 · 2x = 2x missed the delivery');
assert(diagnoseTerm(3, house, { c: 5, v: 'x' }) === 'added', '3 · 2x = 5x added instead of multiplied');
assert(diagnoseTerm(3, house, { c: 32, v: 'x' }) === 'concat', '3 · 2x = 32x glued the digits');
assert(diagnoseTerm(3, { c: 4, v: null }, { c: 12, v: 'x' }) === 'extravar', '3 · 4 = 12x adds a variable that is not there');

const p = { a: 3, terms: [T(1, 'x'), T(4)] };
const ex = s => checkExpress(p, parseExpr(s)).res;
assert(same(ex('3x+12'), ['ok', 'ok']), 'Express: 3(x + 4) = 3x + 12 is all correct');
assert(same(ex('12+3x'), ['ok', 'ok']), 'Express: term order does not matter (12 + 3x)');
assert(same(ex('3x+4'), ['ok', 'missed']), 'Express: 3x + 4 flags the missed house');
assert(same(ex('3x+7'), ['ok', 'added']), 'Express: 3x + 7 flags adding instead of multiplying');
assert(same(ex('3x-12'), ['ok', 'sign']), 'Express: 3x − 12 flags the sign flip');
assert(same(ex('3x'), ['ok', 'empty']), 'Express: a missing term is flagged empty');
assert(checkExpress(p, parseExpr('3x+12+2y')).extra === true, 'Express: an extra variable term is caught');
assert(mapEq(toMap(parseExpr('3x+12')), toMap(expand(3, p.terms))), 'Equivalent expressions compare as equal');
assert(exprText(expand(2, [T(3, 'a'), T(1, null, -1)])) === '6a − 2', 'Answers are written with a real minus: 2(3a − 1) = 6a − 2');

console.log('\n--- TEST 6: Zones and Hub Hooks ---');
assert(ZONES.length === 5 && ZONES.reduce((s, z) => s + z.routes, 0) === 17, '5 zones and 17 routes');
assert(modeFor(1, 0) === 'guided' && modeFor(1, 1) === 'express' && modeFor(3, 0) === 'factor' && modeFor(4, 0) === 'inspect',
  'Route modes: guided first, then Express, factor, and inspect');
assert(html.includes("toTown({type:'CARTRIDGE_READY'})"), 'Sends CARTRIDGE_READY to Expression Town');
assert(html.includes("d.type!=='HUB_INIT'"), 'Follows the hub mute setting (HUB_INIT)');
assert(html.includes("type:'CARTRIDGE_EXIT_REQUEST'"), 'Has a Return to Town button');
assert(html.includes("type:'CARTRIDGE_COMPLETE'") && html.includes("lessonId:'G06_U03_L06'"), 'Save & Return sends CARTRIDGE_COMPLETE for Lesson 3-6');
assert(!/fetch\(|XMLHttpRequest|https?:\/\/(?!www\.w3\.org)/.test(script), 'Game script makes no network calls');

console.log(`\nResults: ${passed}/${passed + failed} tests passed`);
if (failed > 0) process.exit(1);
