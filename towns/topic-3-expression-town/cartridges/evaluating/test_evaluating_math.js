/**
 * Verification Test Suite for Lesson 3-5: Variable Vault (Evaluating Algebraic Expressions)
 * Validates math input parsing across multi-format values ($15, 15, 15.00),
 * substitution logic, PEMDAS evaluation, and curriculum structure.
 */

import assert from 'assert';
import {
  Q,
  q,
  dq,
  parseAnswer,
  add,
  sub,
  imul,
  pw,
  V,
  evalTree,
  VAULTS,
} from './js/evaluating_math.js';

console.log('====================================================');
console.log('🔐 Variable Vault (Lesson 3-5) Math Verification');
console.log('====================================================\n');

// 1. Verification Gate: Multiple Input Formats ($15, 15, 15.00)
console.log('--- 1. Verification Gate: Multiple Input Formats ($15, 15, 15.00) ---');
const expected15 = q(15);

assert(parseAnswer('15').eq(expected15), 'Parses "15" to 15');
assert(parseAnswer('$15').eq(expected15), 'Parses "$15" to 15');
assert(parseAnswer('15.00').eq(expected15), 'Parses "15.00" to 15');
assert(parseAnswer('$15.00').eq(expected15), 'Parses "$15.00" to 15');
assert(parseAnswer('  $ 15.50 ').eq(dq('15.5')), 'Parses "  $ 15.50 " to 15.5');
assert(parseAnswer('3/4').eq(q(3, 4)), 'Parses "3/4" to 3/4');
assert(parseAnswer('1 1/2').eq(q(3, 2)), 'Parses "1 1/2" to 3/2');
assert.strictEqual(parseAnswer('not-a-number'), null, 'Rejects invalid string');
console.log('  ✅ PASS: Math input parser normalizes currency, decimals, and fractions correctly\n');

// 2. Single-Variable Substitution
console.log('--- 2. Single-Variable Substitution ---');
// 4x + 7 when x = 5 -> 27
const expr1 = add(imul(4, V('x')), 7);
const res1 = evalTree(expr1, { x: q(5) });
assert(res1.eq(q(27)), '4(5) + 7 evaluates to 27');

// 5x - 3 when x = 4 -> 17
const expr2 = sub(imul(5, V('x')), 3);
const res2 = evalTree(expr2, { x: q(4) });
assert(res2.eq(q(17)), '5(4) - 3 evaluates to 17');
console.log('  ✅ PASS: Single-variable expressions evaluate accurately\n');

// 3. Multi-Variable Substitution
console.log('--- 3. Multi-Variable Substitution ---');
// 3x + 2y when x = 4, y = 6 -> 24
const expr3 = add(imul(3, V('x')), imul(2, V('y')));
const res3 = evalTree(expr3, { x: q(4), y: q(6) });
assert(res3.eq(q(24)), '3(4) + 2(6) evaluates to 24');

// xy - 5 when x = 7, y = 8 -> 51
const expr4 = sub(imul(V('x'), V('y')), 5);
const res4 = evalTree(expr4, { x: q(7), y: q(8) });
assert(res4.eq(q(51)), '(7)(8) - 5 evaluates to 51');
console.log('  ✅ PASS: Multi-variable expressions evaluate accurately\n');

// 4. Exponents & Order of Operations (PEMDAS)
console.log('--- 4. Exponents & Order of Operations (PEMDAS) ---');
// 2x^2 + 5 when x = 3 -> 2(9) + 5 = 23 (NOT (2*3)^2 = 36)
const expr5 = add(imul(2, pw(V('x'), 2)), 5);
const res5 = evalTree(expr5, { x: q(3) });
assert(res5.eq(q(23)), '2(3^2) + 5 evaluates to 23 with proper PEMDAS');

// n^3 + 12 when n = 4 -> 64 + 12 = 76
const expr6 = add(pw(V('n'), 3), 12);
const res6 = evalTree(expr6, { n: q(4) });
assert(res6.eq(q(76)), '4^3 + 12 evaluates to 76');
console.log('  ✅ PASS: Exponents obey strict PEMDAS order of operations\n');

// 5. Decimals and Fractions Substitution
console.log('--- 5. Decimals & Fractions Substitution ---');
// 2.5x + 1.25 when x = 3 -> 7.5 + 1.25 = 8.75
const expr7 = add(imul(dq('2.5'), V('x')), dq('1.25'));
const res7 = evalTree(expr7, { x: q(3) });
assert(res7.eq(dq('8.75')), '2.5(3) + 1.25 evaluates to 8.75');

// 3/4 x when x = 8 -> 6
const expr8 = imul(q(3, 4), V('x'));
const res8 = evalTree(expr8, { x: q(8) });
assert(res8.eq(q(6)), '(3/4)(8) evaluates to 6');
console.log('  ✅ PASS: Fractional and decimal substitutions evaluate accurately\n');

// 6. Real-World Formulas (Boss Phase)
console.log('--- 6. Real-World Formulas (Boss Phase) ---');
// Perimeter: 2l + 2w when l = 12, w = 5 -> 34
const pExpr = add(imul(2, V('l')), imul(2, V('w')));
assert(evalTree(pExpr, { l: q(12), w: q(5) }).eq(q(34)), 'Perimeter formula 2(12) + 2(5) = 34');

// Area of triangle: 1/2 b h when b = 10, h = 6 -> 30
const aExpr = imul(imul(q(1, 2), V('b')), V('h'));
assert(evalTree(aExpr, { b: q(10), h: q(6) }).eq(q(30)), 'Triangle area formula 1/2(10)(6) = 30');

// Volume of cube: s^3 when s = 5 -> 125
const vExpr = pw(V('s'), 3);
assert(evalTree(vExpr, { s: q(5) }).eq(q(125)), 'Cube volume formula 5^3 = 125');
console.log('  ✅ PASS: Geometric and word problem formulas evaluate accurately\n');

// 7. Curriculum Structure
console.log('--- 7. Curriculum Structure ---');
assert.strictEqual(VAULTS.length, 5, 'Variable Vault must configure 5 vault stages');
assert(VAULTS[0].skill.includes('One variable'), 'Vault 1 covers one variable');
assert(VAULTS[1].skill.includes('Two or more'), 'Vault 2 covers two variables');
assert(VAULTS[2].skill.includes('Exponents'), 'Vault 3 covers exponents');
assert(VAULTS[3].skill.includes('Decimals and fractions'), 'Vault 4 covers decimals & fractions');
assert(VAULTS[4].skill.includes('Formulas'), 'Vault 5 covers formulas & word problems');
console.log('  ✅ PASS: All 5 curriculum vaults verified\n');

console.log('========================================');
console.log('All Variable Vault Math Tests Passed! 🔐');
console.log('========================================\n');
