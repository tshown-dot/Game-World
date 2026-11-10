/**
 * Grid Sync: The LCM Substation - Math Logic
 * Pure functions only (no DOM), so the test suite can run them in Node.
 */

/**
 * Parses user input in several formats: 15, "15", "$15", "15.00", " $15.00 ", "$1,000", "72%".
 * Returns NaN if the input is not a finite number.
 */
export function parseMathInput(val) {
  if (val === null || val === undefined) return NaN;
  if (typeof val === 'number') return isFinite(val) ? val : NaN;
  if (typeof val !== 'string') return NaN;
  const cleaned = val.trim().replace(/^\$/, '').replace(/,/g, '').replace(/%$/, '').trim();
  if (cleaned.length === 0) return NaN;
  const parsed = Number(cleaned);
  return isFinite(parsed) ? parsed : NaN;
}

/** Greatest common divisor (Euclidean algorithm). */
export function gcd(a, b) {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

/** Least common multiple of two whole numbers. */
export function lcm(a, b) {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  if (a === 0 || b === 0) return 0;
  return (a / gcd(a, b)) * b;
}

export function lcmMany(nums) {
  if (!nums || nums.length === 0) return 0;
  return nums.reduce((acc, n) => lcm(acc, n));
}

export function gcdMany(nums) {
  if (!nums || nums.length === 0) return 0;
  return nums.reduce((acc, n) => gcd(acc, n));
}

/** Positive multiples of n up to max (inclusive). */
export function getMultiples(n, max = 100) {
  if (!(n > 0)) return [];
  const out = [];
  for (let m = n; m <= max; m += n) out.push(m);
  return out;
}

/** Common multiples of every number in nums, up to max. */
export function getCommonMultiples(nums, max = 100) {
  const base = lcmMany(nums);
  if (base === 0 || base > max) return [];
  return getMultiples(base, max);
}

export function isCommonMultiple(n, nums) {
  return n > 0 && nums.every((x) => n % x === 0);
}

/** Smallest prime factor of n (n >= 2). */
function smallestPrime(n) {
  for (let p = 2; p * p <= n; p++) if (n % p === 0) return p;
  return n;
}

/**
 * Diagnoses an LCM answer. Codes:
 *   CORRECT, INVALID,
 *   PRODUCT          - multiplied the numbers, but they share a factor (product > LCM)
 *   COMMON_NOT_LEAST - a common multiple, but not the least one
 *   GCF_MIXUP        - gave the GCF instead
 *   TOO_SMALL        - smaller than the biggest number (can't be a multiple of it)
 *   SOME             - a multiple of some numbers but not all
 *   NONE             - a multiple of none of them
 * Messages explain the mistake and name the right answer (a miss always moves on to fresh numbers).
 */
export function diagnoseLCMAnswer(rawAnswer, nums) {
  const answer = parseMathInput(rawAnswer);
  const target = lcmMany(nums);
  const list = nums.join(', ');
  const max = Math.max(...nums);

  if (isNaN(answer) || answer <= 0 || !Number.isInteger(answer)) {
    return { code: 'INVALID', isCorrect: false, lcm: target, message: 'Enter a positive whole number.' };
  }
  if (answer === target) {
    return { code: 'CORRECT', isCorrect: true, lcm: target, message: `LCM(${list}) = ${target}` };
  }

  const hits = nums.filter((n) => answer % n === 0);
  const misses = nums.filter((n) => answer % n !== 0);

  if (misses.length === 0) {
    const product = nums.reduce((a, b) => a * b, 1);
    const k = answer / target;
    const smaller = answer / smallestPrime(k); // still a common multiple, and smaller than the answer
    if (answer === product) {
      const g = nums.length === 2 ? gcd(nums[0], nums[1]) : null;
      return {
        code: 'PRODUCT', isCorrect: false, lcm: target, smaller,
        message: g
          ? `${nums.join(' × ')} = ${answer} is A common multiple, but ${nums[0]} and ${nums[1]} share a factor of ${g}, so they line up sooner. ${smaller === target ? '' : `Even ${smaller} works. `}The LEAST is ${target}.`
          : `Multiplying gives A common multiple, but these numbers share factors, so they line up sooner. The LEAST is ${target}.`,
      };
    }
    return {
      code: 'COMMON_NOT_LEAST', isCorrect: false, lcm: target, smaller,
      message: `${answer} works for ${nums.length === 2 ? 'both' : 'all of them'}, but it isn't the FIRST time they meet. ${smaller} also works (${answer} ÷ ${answer / smaller}). The least is ${target}.`,
    };
  }

  const g = gcdMany(nums);
  if (answer === g) {
    return {
      code: 'GCF_MIXUP', isCorrect: false, lcm: target,
      message: `${answer} is the GCF (biggest number that divides INTO them). The LCM is a multiple, so it's at least ${max}. LCM(${list}) = ${target}.`,
    };
  }

  if (answer < max) {
    return {
      code: 'TOO_SMALL', isCorrect: false, lcm: target,
      message: `${answer} is smaller than ${max}, so it can't be a multiple of ${max}. Multiples only get bigger: ${getMultiples(max, max * 3).join(', ')}... LCM(${list}) = ${target}.`,
    };
  }

  const m = misses[0];
  if (hits.length > 0) {
    const h = hits[hits.length - 1];
    return {
      code: 'SOME', isCorrect: false, lcm: target,
      message: `${answer} = ${h} × ${answer / h}, so it's a multiple of ${hits.join(' and ')}. But ${answer} ÷ ${m} = ${Math.floor(answer / m)} R ${answer % m}, so ${m} never lands there. LCM(${list}) = ${target}.`,
    };
  }
  return {
    code: 'NONE', isCorrect: false, lcm: target,
    message: `${answer} isn't a multiple of any of ${list} (${answer} ÷ ${m} = ${Math.floor(answer / m)} R ${answer % m}). LCM(${list}) = ${target}.`,
  };
}

/** Diagnoses a GCF answer (used by the "GCF or LCM?" jobs). */
export function diagnoseGCFAnswer(rawAnswer, nums) {
  const answer = parseMathInput(rawAnswer);
  const target = gcdMany(nums);
  const list = nums.join(', ');
  if (isNaN(answer) || answer <= 0 || !Number.isInteger(answer)) {
    return { code: 'INVALID', isCorrect: false, gcf: target, message: 'Enter a positive whole number.' };
  }
  if (answer === target) return { code: 'CORRECT', isCorrect: true, gcf: target, message: `GCF(${list}) = ${target}` };
  if (answer === lcmMany(nums)) {
    return { code: 'LCM_MIXUP', isCorrect: false, gcf: target, message: `${answer} is the LCM. This job needs the biggest number that divides INTO ${list}: GCF = ${target}.` };
  }
  if (nums.every((n) => n % answer === 0)) {
    return { code: 'COMMON_NOT_GREATEST', isCorrect: false, gcf: target, message: `${answer} divides both, but ${target} is bigger and also divides both. GCF(${list}) = ${target}.` };
  }
  return { code: 'NOT_FACTOR', isCorrect: false, gcf: target, message: `${answer} doesn't divide evenly into both ${list}. GCF(${list}) = ${target}.` };
}

/**
 * Supply Run: buying `total` of each item when item A comes in packs of a and item B in packs of b.
 */
export function evaluateSupply(rawTotal, a, b) {
  const total = parseMathInput(rawTotal);
  if (isNaN(total) || total <= 0 || !Number.isInteger(total)) {
    return { total: 0, packsA: 0, packsB: 0, remA: 0, remB: 0, cleanA: false, cleanB: false, clean: false };
  }
  const remA = total % a;
  const remB = total % b;
  return {
    total,
    packsA: Math.floor(total / a),
    packsB: Math.floor(total / b),
    remA,
    remB,
    cleanA: remA === 0,
    cleanB: remB === 0,
    clean: remA === 0 && remB === 0,
  };
}

/**
 * Landing events for pulses that hop every nums[i] from 0, in order, up to `end`.
 * Each event: { at, lanes: [lane indexes that land there] }.
 */
export function buildRace(nums, end) {
  const events = new Map();
  nums.forEach((n, lane) => {
    for (let m = n; m <= end; m += n) {
      if (!events.has(m)) events.set(m, []);
      events.get(m).push(lane);
    }
  });
  return [...events.entries()].sort((x, y) => x[0] - y[0]).map(([at, lanes]) => ({ at, lanes }));
}

/** Where pulses first land together (all lanes). */
export function firstCollision(nums) {
  return lcmMany(nums);
}

/**
 * "Missing generator" check: does Beta = choice make the first collision with Alpha = a land on target?
 */
export function evaluateReverse(choice, a, target) {
  const meet = lcm(a, choice);
  if (meet === target) return { isCorrect: true, meet, code: 'CORRECT' };
  return { isCorrect: false, meet, code: meet < target ? 'MEETS_EARLY' : 'MEETS_LATE' };
}
