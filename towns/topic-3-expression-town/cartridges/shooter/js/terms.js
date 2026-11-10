/**
 * Term Popper - Term math (pure, no DOM; tested in Node)
 *
 * A term is { coef, sig }:
 *   coef - integer coefficient (never 0 on the board)
 *   sig  - '' for constants, otherwise base + optional ^exponent: 'x', 'x^2', 'y', 'y^2', 'x^3'
 * Like terms <=> identical sig (same variable AND same exponent).
 */

const MINUS = '−'; // typographic minus for display
const SUPERSCRIPT = { 2: '²', 3: '³' };

/** Build a term object. */
export function term(coef, sig = '') {
  return { coef, sig };
}

/**
 * Signature of a raw term string, or null if it can't be read.
 * Constants (including "$15", "15", "15.00") give ''.
 */
export function getTermSignature(raw) {
  const t = parseTerm(raw);
  return t ? t.sig : null;
}

/** Parse "3x", "-x²", "x^2", "−4", "$15.00" ... into { coef, sig } (null if unreadable). */
export function parseTerm(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'object' && 'coef' in raw) return { coef: raw.coef, sig: raw.sig };
  let s = String(raw).trim()
    .replace(/[$€£,\s]/g, '')
    .replace(/[−–]/g, '-')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3');
  if (s === '') return null;
  const m = s.match(/^([+-]?)(\d+(?:\.\d+)?|\.\d+)?([a-zA-Z])?(?:\^(\d+))?$/);
  if (!m) return null;
  const [, sign, num, letter, exp] = m;
  if (!num && !letter) return null;
  if (exp && !letter) return null;
  let coef = num ? Number(num) : 1;
  if (sign === '-') coef = -coef;
  if (!letter) return { coef, sig: '' };
  const e = exp && exp !== '1' ? `^${Number(exp)}` : '';
  return { coef, sig: letter.toLowerCase() + e };
}

/** True when two terms (strings or objects) are like terms. */
export function doTermsMatch(a, b) {
  const ta = parseTerm(a);
  const tb = parseTerm(b);
  if (!ta || !tb) return false;
  return ta.sig === tb.sig;
}

export function isLike(a, b) {
  return a.sig === b.sig;
}

/** Variable part for display: 'x^2' -> 'x²', '' -> ''. */
export function formatSig(sig) {
  if (!sig) return '';
  const [base, exp] = sig.split('^');
  if (!exp) return base;
  return base + (SUPERSCRIPT[exp] || `^${exp}`);
}

/** Display a term: 3x, −x, x², −4. */
export function formatTerm(t) {
  const { coef, sig } = t;
  const v = formatSig(sig);
  const neg = coef < 0;
  const mag = Math.abs(coef);
  let body;
  if (!v) body = String(mag);
  else body = (mag === 1 ? '' : String(mag)) + v;
  return (neg ? MINUS : '') + body;
}

/**
 * Display a sum of terms in subtraction-friendly form:
 * [3x, 2x, -5x] -> "3x + 2x − 5x"
 */
export function formatSum(terms) {
  return terms.map((t, i) => {
    if (i === 0) return formatTerm(t);
    const op = t.coef < 0 ? ` ${MINUS} ` : ' + ';
    return op + formatTerm({ coef: Math.abs(t.coef), sig: t.sig });
  }).join('');
}

/** Sum of coefficients (assumes like terms). */
export function sumCoefficients(terms) {
  return terms.reduce((acc, t) => acc + t.coef, 0);
}

/** "3x + 2x − 5x = 0" */
export function formatCombination(terms) {
  const total = sumCoefficients(terms);
  const result = total === 0 ? '0' : formatTerm({ coef: total, sig: terms[0].sig });
  return `${formatSum(terms)} = ${result}`;
}

/** Friendly name of what a term "is": 'x-terms', 'x²-terms', 'constants'. */
export function kindName(sig) {
  return sig ? `${formatSig(sig)}-terms` : 'constants';
}

/**
 * Explain why two terms are NOT like terms (shown after a misfire).
 * Returns '' if they are like terms.
 */
export function explainUnlike(a, b) {
  if (a.sig === b.sig) return '';
  const A = formatTerm(a);
  const B = formatTerm(b);
  if (!a.sig || !b.sig) {
    const constant = !a.sig ? A : B;
    const variable = !a.sig ? B : A;
    return `${constant} is a constant and ${variable} has a variable, so they can't combine.`;
  }
  const [baseA, expA = '1'] = a.sig.split('^');
  const [baseB, expB = '1'] = b.sig.split('^');
  if (baseA === baseB && expA !== expB) {
    return `${A} and ${B} use the same letter but different exponents (${formatSig(a.sig)} ≠ ${formatSig(b.sig)}), so they can't combine.`;
  }
  return `${A} and ${B} have different variables (${formatSig(a.sig)} vs ${formatSig(b.sig)}), so they can't combine.`;
}

/**
 * Look-alike term used by the boss's "shape-shift" attack.
 * Same digits, different kind: 3x -> 3x², 2x² -> 2x, 4 -> 4x, y -> y².
 */
export function lookAlike(t, allowedSigs, rng = Math.random) {
  const options = [];
  const { sig } = t;
  if (sig === '') options.push('x', 'y');
  else {
    const [base, exp] = sig.split('^');
    if (!exp) options.push(`${base}^2`);
    else options.push(base);
    if (base === 'x') options.push('y' + (exp ? `^${exp}` : ''));
    if (!exp) options.push('');
  }
  const valid = options.filter((s) => s !== sig && (!allowedSigs || allowedSigs.includes(s)));
  if (!valid.length) return null;
  return { coef: t.coef, sig: valid[Math.floor(rng() * valid.length)] };
}
