/**
 * Charge Runner: Exponent Reactor - Math & Diagnosis Engine
 * Pure functions only (no DOM), so everything here is unit-tested.
 *
 * Problem modes (all live inside the reactor loop, no pop-up quizzes):
 *   find     – target MW given; student sets base/exponent dials to match.
 *   evaluate – surge arrives as a power (b^e); student types its value in MW.
 *   fix      – a trainee logged a wrong value for b^e; student types the correct value.
 *   expanded – surge arrives as repeated multiplication (5 × 5 × 5); student sets dials.
 *   compare  – two power lines; student routes power to the stronger one (or "equal").
 *   cards    – (boss) pick the one card that makes the target; decoys are trap powers.
 *
 * Every diagnoser returns { correct, isTrap, type, explanation, correctFormula }.
 * On a miss, correctFormula never reveals the answer, so the retry still takes thinking.
 */
export const PROBLEM_MODES = ['find', 'evaluate', 'fix', 'expanded', 'compare', 'cards'];

/** Combo: climbs one level per clean hit (max x5); a hint holds it; a miss drops one level. */
export const MAX_COMBO = 5;
export function nextCombo(combo, hinted = false) {
  return hinted ? combo : Math.min(MAX_COMBO, combo + 1);
}
export function comboAfterMiss(combo) {
  return Math.max(1, combo - 1);
}

/** Sector stars: 3 = no misses & no hints, 2 = at most 2 misses, 1 = cleared. */
export function sectorStars(misses, hints) {
  if (misses === 0 && hints === 0) return 3;
  if (misses <= 2) return 2;
  return 1;
}

// Sector metadata. Problems are generated fresh each run by generator.js.
export const CURRICULUM_SECTORS = [
  {
    id: 'sector-1',
    name: 'Sector 1: The Basics',
    tagline: 'Squares & Cubes',
    badge: 'CORE-I',
    description: 'Master powers of small numbers. 2³ means 2 × 2 × 2 (8), not 2 × 3.',
    waveTimeLimit: 45,
  },
  {
    id: 'sector-2',
    name: 'Sector 2: Multiplication Trap',
    tagline: 'Trap Evasion Protocol',
    badge: 'CORE-II',
    description: 'Never multiply base × exponent! 4³ is 4 × 4 × 4 = 64, not 4 × 3 = 12.',
    waveTimeLimit: 40,
  },
  {
    id: 'sector-3',
    name: 'Sector 3: Powers of 10 Flux',
    tagline: 'Zero Trajectory',
    badge: 'CORE-III',
    description: '10ⁿ is a 1 followed by n zeros.',
    waveTimeLimit: 40,
  },
  {
    id: 'sector-4',
    name: 'Sector 4: Zero & One Anomalies',
    tagline: 'Quantum Identity',
    badge: 'CORE-IV',
    description: 'b⁰ = 1 for any non-zero base, b¹ = b, and 1 to any power is 1.',
    waveTimeLimit: 35,
  },
  {
    id: 'sector-5',
    name: 'Sector 5: Singularity Overcharge (BOSS)',
    tagline: 'Higher-Order Equivalence',
    badge: 'BOSS-CORE',
    description: 'BOSS PHASE: mixed challenges and equivalent powers!',
    waveTimeLimit: 30,
    isBossSector: true,
  },
];

/** Superscript digits for plain-text formulas (e.g. 2⁵). */
const SUPERSCRIPTS = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export function sup(n) {
  return String(n).split('').map(d => SUPERSCRIPTS[d] || d).join('');
}
export function powerText(base, exponent) {
  return `${base}${sup(exponent)}`;
}
export function expandedText(base, exponent) {
  if (exponent === 0) return `${base}⁰`;
  return Array(exponent).fill(base).join(' × ');
}

/** The value a problem is checked against (for value-based and dial-based modes). */
export function problemTargetValue(problem) {
  if (problem.mode === 'find') return problem.targetMW;
  if (problem.mode === 'compare') return null;
  return calculatePower(problem.base, problem.exponent);
}

/** Correct answer for a compare problem: 'left' | 'right' | 'equal'. */
export function compareAnswer(problem) {
  const a = calculatePower(problem.left.base, problem.left.exponent);
  const b = calculatePower(problem.right.base, problem.right.exponent);
  if (a === b) return 'equal';
  return a > b ? 'left' : 'right';
}

/** b^e for non-negative whole-number exponents. */
export function calculatePower(base, exponent) {
  if (exponent === 0) return 1;
  return Math.pow(base, exponent);
}

/**
 * Factor-by-factor steps for the ribbon animation: 2³ → [{factor 2, running 2}, {2, 4}, {2, 8}].
 * A zero exponent has a single identity step (value 1).
 */
export function prepareSteps(base, exponent) {
  if (exponent === 0) return [{ factor: 0, currentValue: 1 }];
  const steps = [];
  let acc = 1;
  for (let i = 0; i < exponent; i++) {
    acc *= base;
    steps.push({ factor: base, currentValue: acc });
  }
  return steps;
}

/**
 * Diagnoses dial settings for a find problem (student set base^exponent to match targetMW).
 */
export function diagnoseSubmission(base, exponent, targetMW) {
  const value = calculatePower(base, exponent);
  const p = powerText(base, exponent);
  const miss = (isTrap, type, explanation, correctFormula) => ({ correct: false, isTrap, type, explanation, correctFormula });

  if (value === targetMW) {
    return { correct: true, isTrap: false, type: 'exact-match', explanation: 'Correct!', correctFormula: `${p} = ${targetMW.toLocaleString()} MW` };
  }
  if (base * exponent === targetMW) {
    return miss(true, 'multiplication-error',
      `Exponent trap! ${p} means ${base} used as a factor ${exponent} times (${value.toLocaleString()} MW), not ${base} × ${exponent} (${targetMW.toLocaleString()} MW).`,
      `${p} = ${expandedText(base, exponent)} = ${value.toLocaleString()}`);
  }
  if (exponent === 0 && targetMW !== 1) {
    return miss(true, 'zero-error', `Zero exponent rule: any non-zero base to the power 0 equals 1, so ${p} = 1 MW.`, `${p} = 1`);
  }
  const targetZeros = powerOfTenExponent(targetMW);
  if (base === 10 && targetZeros !== null) {
    return miss(true, 'power-of-ten',
      `Count the zeros! ${p} has ${exponent} zero${exponent === 1 ? '' : 's'} (${value.toLocaleString()}). ${targetMW.toLocaleString()} has ${targetZeros} zero${targetZeros === 1 ? '' : 's'}.`,
      `${p} = ${value.toLocaleString()}`);
  }
  const over = value > targetMW;
  return miss(false, over ? 'over-exponentiation' : 'under-exponentiation',
    `${over ? 'Too much power' : 'Not enough power'}: ${p} = ${value.toLocaleString()} MW, but the surge is ${targetMW.toLocaleString()} MW. Try a ${over ? 'smaller' : 'bigger'} base or exponent.`,
    `${value.toLocaleString()} ≠ ${targetMW.toLocaleString()}`);
}

/**
 * Returns n if value === 10^n (n >= 1), otherwise null.
 */
export function powerOfTenExponent(value) {
  if (!Number.isInteger(value) || value < 10) return null;
  const str = String(value);
  return /^10+$/.test(str) ? str.length - 1 : null;
}

/**
 * Diagnoses a typed value for an evaluate / fix problem (student computes b^e).
 * Returns { correct, isTrap, type, explanation, correctFormula }.
 */
export function diagnoseValue(base, exponent, answer) {
  const correctValue = calculatePower(base, exponent);
  const p = powerText(base, exponent);
  // On a miss, show the expansion but NOT the value, so the retry still requires computing it.
  const shown = exponent === 0 ? `${p}: zero factors of ${base}` : `${p} = ${expandedText(base, exponent)}`;
  const result = (isTrap, type, explanation) => ({
    correct: false, isTrap, type, explanation, correctFormula: shown, correctValue,
  });

  if (!Number.isFinite(answer)) {
    return result(false, 'no-answer', 'Type a value on the keypad first.');
  }
  if (answer === correctValue) {
    return { correct: true, isTrap: false, type: 'exact-match', explanation: 'Correct!', correctFormula: shown, correctValue };
  }
  if (exponent === 0) {
    if (answer === 0) return result(true, 'zero-error', `Zero exponent rule: ${p} is 1, not 0. Any non-zero base to the power 0 equals 1.`);
    if (answer === base) return result(true, 'zero-error', `Zero exponent rule: ${p} is 1, not ${base}. Any non-zero base to the power 0 equals 1.`);
  }
  if (base === 1 && answer === exponent) {
    return result(true, 'one-base-error', `1 times itself is always 1, so ${p} = 1, not ${exponent}.`);
  }
  if (answer === base * exponent && base * exponent !== correctValue) {
    return result(true, 'multiplication-error', `Exponent trap! ${base} × ${exponent} = ${answer}, but ${p} means ${base} used as a factor ${exponent} time${exponent === 1 ? '' : 's'}.`);
  }
  if (answer === base + exponent && base + exponent !== correctValue) {
    return result(true, 'addition-error', `${p} is not ${base} + ${exponent}. It means ${base} used as a factor ${exponent} times.`);
  }
  if (exponent > 0 && answer === calculatePower(exponent, base) && exponent !== base) {
    return result(true, 'swap-error', `You found ${powerText(exponent, base)}. The big number is the base: ${p} means ${base} is the factor, ${exponent} times.`);
  }
  if (base === 10 && powerOfTenExponent(answer) !== null) {
    const z = powerOfTenExponent(answer);
    return result(true, 'power-of-ten', `Count the zeros! ${p} has ${exponent} zero${exponent === 1 ? '' : 's'}; you typed ${z}.`);
  }
  if (exponent >= 2 && (answer === calculatePower(base, exponent - 1) || answer === calculatePower(base, exponent + 1))) {
    const fewer = answer === calculatePower(base, exponent - 1);
    return result(false, 'factor-count', `Close! You multiplied one ${fewer ? 'too few' : 'too many'} times. ${p} has exactly ${exponent} factors of ${base}.`);
  }
  return result(false, 'off-target', `${p} is not ${answer.toLocaleString()}. Multiply it out one factor at a time.`);
}

/**
 * Diagnoses dial settings for an expanded-form problem (e.g. 5 × 5 × 5 → 5³).
 */
export function diagnoseExpanded(problem, base, exponent) {
  const target = powerText(problem.base, problem.exponent);
  const shown = `${expandedText(problem.base, problem.exponent)} = ${target}`;
  if (base === problem.base && exponent === problem.exponent) {
    return { correct: true, isTrap: false, type: 'exact-match', explanation: 'Correct!', correctFormula: shown };
  }
  if (base === problem.exponent && exponent === problem.base) {
    return { correct: false, isTrap: true, type: 'swap-error', explanation: `Base and exponent are swapped. The repeated factor (${problem.base}) is the base; how many times it appears (${problem.exponent}) is the exponent.`, correctFormula: shown };
  }
  if (calculatePower(base, exponent) === calculatePower(problem.base, problem.exponent)) {
    return { correct: false, isTrap: false, type: 'equivalent-form', explanation: `${powerText(base, exponent)} has the same value, but this signature repeats ${problem.base}. Use ${problem.base} as the base.`, correctFormula: shown };
  }
  if (base !== problem.base) {
    return { correct: false, isTrap: false, type: 'wrong-base', explanation: `The base is the number being repeated: ${problem.base}.`, correctFormula: shown };
  }
  return { correct: false, isTrap: false, type: 'factor-count', explanation: `Count the factors: ${problem.base} appears ${problem.exponent} time${problem.exponent === 1 ? '' : 's'}, so the exponent is ${problem.exponent}.`, correctFormula: shown };
}

/**
 * Diagnoses a compare choice ('left' | 'right' | 'equal').
 */
export function diagnoseCompare(problem, choice) {
  const { left, right } = problem;
  const a = calculatePower(left.base, left.exponent);
  const b = calculatePower(right.base, right.exponent);
  const answer = compareAnswer(problem);
  const sym = a === b ? '=' : a > b ? '>' : '<';
  const shown = `${powerText(left.base, left.exponent)} = ${a.toLocaleString()}  ${sym}  ${powerText(right.base, right.exponent)} = ${b.toLocaleString()}`;
  if (choice === answer) {
    return { correct: true, isTrap: false, type: 'exact-match', explanation: 'Correct!', correctFormula: shown };
  }
  const swapped = left.base === right.exponent && left.exponent === right.base;
  const sameProduct = left.base * left.exponent === right.base * right.exponent;
  if (choice === 'equal' && (swapped || sameProduct)) {
    return { correct: false, isTrap: true, type: 'multiplication-error', explanation: `Not equal! Base × exponent gives ${left.base * left.exponent} for both, but that's the trap. Exponents mean repeated multiplication.`, correctFormula: shown };
  }
  if (swapped) {
    return { correct: false, isTrap: true, type: 'swap-error', explanation: 'Swapping the base and exponent changes the value. Work out each power.', correctFormula: shown };
  }
  return { correct: false, isTrap: false, type: 'compare-error', explanation: 'Work out both powers before you route power.', correctFormula: shown };
}

/**
 * Diagnoses a charge-card pick in the boss "cards" mode.
 * Each card is { base, exponent, kind: 'correct' | 'swapped' | 'product-trap' | 'equivalent' }.
 */
export function diagnoseCards(problem, index) {
  const card = problem.cards[index];
  const target = problem.targetMW.toLocaleString();
  const right = problem.cards.filter(c => calculatePower(c.base, c.exponent) === problem.targetMW).map(c => powerText(c.base, c.exponent)).join(' or ');
  const shown = `${right} = ${target} MW`;
  if (!card) return { correct: false, isTrap: false, type: 'no-answer', explanation: 'Pick a card.', correctFormula: '' };
  const value = calculatePower(card.base, card.exponent);
  const p = powerText(card.base, card.exponent);
  if (value === problem.targetMW) return { correct: true, isTrap: false, type: 'exact-match', explanation: 'Correct!', correctFormula: shown };
  // On a miss, explain the card they picked (not which card is right) so the retry still takes thinking.
  const picked = `${p} = ${expandedText(card.base, card.exponent)} = ${value.toLocaleString()}`;
  if (card.base * card.exponent === problem.targetMW) {
    return { correct: false, isTrap: true, type: 'multiplication-error', explanation: `Trap card! ${card.base} × ${card.exponent} = ${target}, but ${p} means ${card.base} used as a factor ${card.exponent} times. That's way more than ${target}!`, correctFormula: picked };
  }
  return { correct: false, isTrap: true, type: 'swap-error', explanation: `${p} is not ${target}. Swapping the base and exponent changes the value.`, correctFormula: picked };
}
