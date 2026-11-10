/**
 * Unit Test Suite: Lesson 3-4 Galactic Translator (Write Algebraic Expressions)
 *
 * Runs the game's own math code, pulled straight out of index.html, so the tests check
 * exactly what students play. The browser-only part of the script is skipped because
 * `window` is undefined here.
 *
 * Verifies:
 * 1. Tile parsing (implicit multiplication, parentheses, decimals, bad input)
 * 2. Equivalence: any order that means the same thing is accepted
 * 3. Every generated translation has a variable, and every trap really is wrong
 * 4. Mistake diagnosis (reversed order, wrong operation, missing parentheses, no variable)
 * 5. Parts Lab: term counts, unique numbers, and each tap target exists
 * 6. Reverse Transmission: exactly one option means the expression
 * 7. Hub hooks are present (ready, mute sync, exit, save & return)
 */

import { readFileSync } from 'fs';
import vm from 'vm';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const api = vm.runInNewContext(`${script}
;({ q, Q, N, V, G, B, add, sub, imul, dvd, evq, equiv, hasVar, parseTokens, diagnoseT,
    S1, S2, S3, S5, genTranslate, genParts, genReverse, SECTORS, wordsText, beamHTML })`, { console });

const {
  q, V, N, G, add, sub, imul, dvd, evq, equiv, hasVar, parseTokens, diagnoseT,
  S1, S2, S3, S5, genTranslate, genParts, genReverse, SECTORS, wordsText, beamHTML,
} = api;

let passed = 0;
let failed = 0;
function assert(condition, name) {
  if (condition) { console.log(`  ✓ ${name}`); passed++; }
  else { console.error(`  ✗ FAIL: ${name}`); failed++; }
}
/** Tap a string of tiles: digits/./letters are one key each, spaces are ignored. */
const tiles = (s) => [...s.replace(/\s+/g, '')].map((c) => (c === '-' ? '−' : c === '*' ? '×' : c === '/' ? '÷' : c));
const parse = (s) => parseTokens(tiles(s));
const at = (ast, x) => evq(ast, q(x));

console.log('\n--- TEST 1: Tile Parsing ---');
assert(at(parse('n+5'), 3).eq(q(8)), 'n + 5 at n = 3 is 8');
assert(at(parse('3n'), 4).eq(q(12)), '3n means 3 times n');
assert(at(parse('3(n+2)'), 4).eq(q(18)), '3(n + 2) multiplies the whole group');
assert(at(parse('3n+2'), 4).eq(q(14)), '3n + 2 multiplies only n');
assert(at(parse('n/2'), 5).eq(q(5, 2)), 'n ÷ 2 keeps exact fractions');
assert(at(parse('1.5n'), 4).eq(q(6)), 'Decimals parse: 1.5n at n = 4 is 6');
assert(at(parse('12-n'), 5).eq(q(7)), '12 − n parses with a unicode minus');
assert(parse('') === null, 'Empty input is rejected');
assert(parse('n+') === null, 'A dangling operator is rejected');
assert(parse('(n+3') === null, 'A missing ) is rejected');
assert(parse('3..2n') === null, 'A malformed decimal is rejected');

console.log('\n--- TEST 2: Equivalence ---');
assert(equiv(parse('n+5'), parse('5+n')), 'n + 5 matches 5 + n');
assert(equiv(parse('3n'), parse('n×3')), '3n matches n × 3');
assert(equiv(parse('2(n+3)'), parse('2n+6')), '2(n + 3) matches 2n + 6');
assert(!equiv(parse('n-6'), parse('6-n')), 'n − 6 does NOT match 6 − n');
assert(!equiv(parse('n/4'), parse('4/n')), 'n ÷ 4 does NOT match 4 ÷ n');
assert(!equiv(parse('3n+2'), parse('3(n+2)')), '3n + 2 does NOT match 3(n + 2)');

console.log('\n--- TEST 3: Generated Translations (3,000 per pool) ---');
for (const [name, pool] of [['Keyword Station', S1], ['Backwards Belt', S2], ['Double Signal', S3], ['Trading Post', S5]]) {
  let noVar = 0; let badTrap = 0; let emptyWords = 0;
  for (let i = 0; i < 3000; i++) {
    const p = genTranslate(pool);
    if (!hasVar(p.ast)) noVar++;
    if (!wordsText(p.words).trim()) emptyWords++;
    p.traps.forEach((t) => { if (equiv(t.ast, p.ast)) badTrap++; });
  }
  assert(noVar === 0, `${name}: every answer uses the variable`);
  assert(badTrap === 0, `${name}: every trap answer is actually different`);
  assert(emptyWords === 0, `${name}: every message has words`);
}

console.log('\n--- TEST 4: Mistake Diagnosis ---');
const P = { v: 'n', a: 6, b: 3, vi: '<i>n</i>', vp: '<i>n</i>' };
const mk = (tpl) => { const t = tpl(P); return { kind: 'translate', v: 'n', words: t.words, ast: t.ast, traps: t.traps || [] }; };
const lessThan = mk(S2[0]); // "6 less than n" -> n − 6
assert(equiv(lessThan.ast, parse('n-6')), '"6 less than n" is n − 6');
assert(diagnoseT(lessThan, parse('6-n')) === 'reversed', '6 − n is diagnosed as reversed order');
const sumOf = mk(S1[0]); // "the sum of n and 6"
assert(diagnoseT(sumOf, parse('n-6')) === 'wrongop', 'n − 6 for "the sum" is a wrong operation');
assert(diagnoseT(sumOf, parse('6+5')) === 'novar', 'Leaving out the variable is caught');
assert(diagnoseT(sumOf, parse('n+7')) === 'wrongnum', 'Using the wrong number is caught');
const timesSum = mk(S3[1]); // "3 times the sum of n and 6" -> 3(n + 6)
assert(equiv(timesSum.ast, parse('3(n+6)')), '"3 times the sum of n and 6" is 3(n + 6)');
assert(diagnoseT(timesSum, parse('3n+6')) === 'parens', '3n + 6 is diagnosed as missing parentheses');
const quot = mk(S2[6]); // "the quotient of 6 and n" -> 6 ÷ n
assert(diagnoseT(quot, parse('n/6')) === 'reversed', 'n ÷ 6 for "the quotient of 6 and n" is reversed');
assert(/TEST BEAM/.test(beamHTML(lessThan, parse('6-n'))), 'Test Beam finds a number that shows the difference');

console.log('\n--- TEST 5: Parts Lab (2,000 expressions) ---');
let partsOk = true; let distinctOk = true; let targetOk = true; let termAnswerOk = true;
for (let i = 0; i < 2000; i++) {
  const p = genParts();
  if (p.terms.length < 2 || p.terms.length > 5) partsOk = false;
  const shown = p.terms.filter((t) => !(t.v && t.c === 1)).map((t) => t.c);
  if (new Set(shown).size !== shown.length) distinctOk = false;
  const termsQ = p.qs.find((x) => x.type === 'terms');
  if (!termsQ || termsQ.answer !== String(p.terms.length) || !termsQ.choices.includes(termsQ.answer)) termAnswerOk = false;
  p.qs.forEach((qn) => {
    if (qn.choices) { if (!qn.choices.includes(qn.answer)) targetOk = false; return; }
    const { r, i: ti } = qn.target;
    if (r === 'var') { if (!p.terms.some((t) => t.v)) targetOk = false; return; }
    const t = p.terms[ti];
    if (!t || (r === 'const' && t.v) || (r === 'coef' && (!t.v || t.c === 1 || t.v !== qn.v))) targetOk = false;
  });
}
assert(partsOk, 'Every expression has 2 to 5 terms');
assert(distinctOk, 'Every written number is different, so "tap the 4" is never ambiguous');
assert(termAnswerOk, 'The term count question always has the right answer as a choice');
assert(targetOk, 'Every tap target and choice answer exists in the expression');

console.log('\n--- TEST 6: Reverse Transmission (1,000 rounds) ---');
let oneRight = true; let distinctMeanings = true; let fourOpts = true;
for (let i = 0; i < 1000; i++) {
  const p = genReverse();
  if (!p || p.options.length !== 4) { fourOpts = false; continue; }
  const right = p.options.filter((o) => equiv(o.ast, p.ast));
  if (right.length !== 1 || !right[0].correct) oneRight = false;
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
    if (equiv(p.options[a].ast, p.options[b].ast)) distinctMeanings = false;
  }
}
assert(fourOpts, 'Every round has 4 options');
assert(oneRight, 'Exactly one option means the expression, and it is the one marked correct');
assert(distinctMeanings, 'No two options mean the same thing');

console.log('\n--- TEST 7: Sectors & Hub Hooks ---');
assert(SECTORS.length === 6, '6 sectors');
assert(SECTORS.reduce((s, z) => s + z.n, 0) === 19, '19 transmissions in a full run');
assert(html.includes("toTown({type:'CARTRIDGE_READY'})"), 'Announces CARTRIDGE_READY to the hub');
assert(html.includes("d.type!=='HUB_INIT'") && html.includes('p.isMuted'), 'Follows the hub mute setting');
assert(html.includes("toTown({type:'CARTRIDGE_EXIT_REQUEST'})"), 'Has Return to Town');
assert(html.includes("type:'CARTRIDGE_COMPLETE'") && html.includes("lessonId:'G06_U03_L04'"), 'Save & Return reports Lesson 3-4');
assert(/IN_TOWN\?'<button class="btn" id="townDone">/.test(html), 'Save & Return only shows inside Expression Town');

console.log(`\n================================`);
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log(`================================`);
if (failed > 0) process.exit(1);
