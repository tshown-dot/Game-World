/**
 * Demolition Crane - Order of Operations Engine
 *
 * Expressions become a flat token list: number, operator (+ - × ÷ ^), ( ) [ ],
 * and an optional top-level fraction bar for "(top) / (bottom)" expressions.
 *
 * STRICT order: at every moment exactly one operation is the legal next step.
 *   1. Work in the innermost grouping symbols. If several groups are equally
 *      deep, finish the left-most one first (a fraction's top is a group, so it
 *      comes before the bottom).
 *   2. Inside that group: exponents, then × ÷, then + −, each left to right.
 *   3. The fraction bar is always the very last step.
 * So in (8 + 4) × (6 - 2) only 8 + 4 can go first, and in 3 × 4 + 5 × 6 only
 * the first × can.
 */

let idCounter = 1;
export function generateTokenId() {
  return `tok_${idCounter++}`;
}

const OP_CHARS = { '+': '+', '-': '-', '−': '-', '*': '×', '×': '×', 'x': '×', '/': '÷', '÷': '÷', '^': '^' };

/** Strips currency symbols, commas and spaces from a typed number: "$15", "15.00", "1,200". */
export function normalizeMathInput(raw) {
  if (typeof raw !== 'string') return String(raw);
  return raw.replace(/\$/g, '').replace(/,/g, '').replace(/\s+/g, '').trim();
}

/** Parses a typed answer. Returns a number, or null if it isn't one. */
export function parseNumberInput(raw) {
  const s = normalizeMathInput(String(raw ?? ''));
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  return Number(s);
}

/** Rounds away floating-point noise (0.1 + 0.2) without hiding real decimals. */
function clean(n) {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Finds a top-level "(top) / (bottom)" split. Only a slash that sits between a
 * closing and an opening grouping symbol, with both groups spanning the whole
 * side, counts as a fraction bar; any other "/" means plain division.
 */
function findFractionSlash(input) {
  let level = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '(' || ch === '[') level++;
    else if (ch === ')' || ch === ']') level--;
    else if (ch === '/' && level === 0) {
      const left = input.slice(0, i).trim();
      const right = input.slice(i + 1).trim();
      const wrapsWhole = (s) => {
        if (!/^[([]/.test(s) || !/[)\]]$/.test(s)) return false;
        let d = 0;
        for (let k = 0; k < s.length; k++) {
          if (s[k] === '(' || s[k] === '[') d++;
          else if (s[k] === ')' || s[k] === ']') d--;
          if (d === 0 && k < s.length - 1) return false;
        }
        return true;
      };
      return wrapsWhole(left) && wrapsWhole(right) ? i : -1;
    }
  }
  return -1;
}

/**
 * Parses an expression string into tokens.
 * Throws an Error with a student-readable message if the expression is malformed.
 */
export function parseExpressionToTokens(rawInput) {
  const input = String(rawInput || '').trim();
  const slash = findFractionSlash(input);
  const tokens = [];
  const stack = [];
  let tier = slash === -1 ? 'root' : 'numerator';
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch) || ch === '$' || ch === ',') {
      i++;
      continue;
    }
    if (i === slash) {
      tokens.push({ id: generateTokenId(), type: 'fraction_bar', value: '÷', depth: 0, tier: 'root' });
      tier = 'denominator';
      i++;
      continue;
    }
    if (ch === '(' || ch === '[') {
      stack.push(ch);
      tokens.push({
        id: generateTokenId(),
        type: ch === '(' ? 'open_paren' : 'open_bracket',
        value: ch,
        depth: stack.length,
        tier,
      });
      i++;
      continue;
    }
    if (ch === ')' || ch === ']') {
      const open = stack.pop();
      if ((ch === ')' && open !== '(') || (ch === ']' && open !== '[')) {
        throw new Error('The grouping symbols don\'t match up.');
      }
      tokens.push({
        id: generateTokenId(),
        type: ch === ')' ? 'close_paren' : 'close_bracket',
        value: ch,
        depth: stack.length + 1,
        tier,
      });
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      while (i < input.length && /[0-9.,]/.test(input[i])) {
        if (input[i] !== ',') numStr += input[i];
        i++;
      }
      const v = Number(numStr);
      if (!Number.isFinite(v)) throw new Error(`"${numStr}" isn't a number.`);
      tokens.push({ id: generateTokenId(), type: 'number', value: String(v), numericValue: v, depth: stack.length, tier });
      continue;
    }
    if (OP_CHARS[ch]) {
      tokens.push({ id: generateTokenId(), type: 'operator', value: OP_CHARS[ch], depth: stack.length, tier });
      i++;
      continue;
    }
    throw new Error(`"${ch}" isn't allowed. Use numbers, + − × ÷ ^ and ( ) [ ].`);
  }

  if (stack.length) throw new Error('A grouping symbol was never closed.');
  validateShape(tokens);
  return tokens;
}

/** Checks that numbers and operators alternate properly. */
function validateShape(tokens) {
  if (!tokens.length) throw new Error('Type an expression first.');
  let expectValue = true;
  for (const t of tokens) {
    if (t.type === 'number') {
      if (!expectValue) throw new Error('Two numbers are next to each other with no operation between them.');
      expectValue = false;
    } else if (t.type === 'open_paren' || t.type === 'open_bracket') {
      if (!expectValue) throw new Error('Put an operation sign before each ( or [.');
    } else if (t.type === 'close_paren' || t.type === 'close_bracket') {
      if (expectValue) throw new Error('A group is empty or ends with an operation sign.');
    } else {
      if (expectValue) throw new Error('An operation sign is missing a number.');
      expectValue = true;
    }
  }
  if (expectValue) throw new Error('The expression ends with an operation sign.');
}

/** Higher number = done first. */
export function getOperatorPrecedence(op) {
  if (op === '^') return 3;
  if (op === '×' || op === '÷') return 2;
  if (op === '+' || op === '-') return 1;
  return 0;
}

export function isOperatorToken(t) {
  return !!t && (t.type === 'operator' || t.type === 'fraction_bar');
}

/** Human-friendly operator symbol. */
export function displayOp(op) {
  return op === '-' ? '−' : op;
}

/** Index of the open ( or [ that directly encloses token i, or -1 for the top level. */
function groupStart(tokens, i) {
  let level = 0;
  for (let k = i - 1; k >= 0; k--) {
    const t = tokens[k];
    if (t.type === 'close_paren' || t.type === 'close_bracket') level++;
    else if (t.type === 'open_paren' || t.type === 'open_bracket') {
      if (level === 0) return k;
      level--;
    }
  }
  return -1;
}

/**
 * The one legal next operation under strict order, or -1 when the expression
 * is a single number.
 */
export function findStrictMove(tokens) {
  const ops = [];
  tokens.forEach((t, i) => {
    if (t.type === 'operator') ops.push(i);
  });
  if (!ops.length) {
    const bar = tokens.findIndex((t) => t.type === 'fraction_bar');
    return bar !== -1 && tokens.length === 3 ? bar : -1;
  }
  // 1. Deepest group; ties go to the left-most group.
  const maxDepth = Math.max(...ops.map((i) => tokens[i].depth));
  const deepest = ops.filter((i) => tokens[i].depth === maxDepth);
  const firstGroup = Math.min(...deepest.map((i) => groupStart(tokens, i)));
  const inGroup = deepest.filter((i) => groupStart(tokens, i) === firstGroup);
  // 2. Highest rank inside that group; ties go left to right.
  const topRank = Math.max(...inGroup.map((i) => getOperatorPrecedence(tokens[i].value)));
  return inGroup.find((i) => getOperatorPrecedence(tokens[i].value) === topRank);
}

/**
 * Explains whether the operation at `index` is the legal next step.
 * @returns {{ ready: boolean, reason?: string, blockerIndex?: number }}
 *   reason: 'GROUP_NOT_DONE' | 'GROUP_ORDER' | 'EXPONENT_FIRST' | 'MULT_DIV_FIRST'
 *           | 'LEFT_TO_RIGHT' | 'FRACTION_INCOMPLETE'
 *   blockerIndex: the operation that has to happen next.
 */
export function analyzeOperator(tokens, index) {
  const op = tokens[index];
  if (!isOperatorToken(op)) return { ready: false, reason: 'NOT_AN_OPERATOR' };
  const legal = findStrictMove(tokens);
  if (legal === index) return { ready: true };
  if (legal === -1) return { ready: false, reason: 'NOT_AN_OPERATOR' };
  const L = tokens[legal];
  const blockerIndex = legal;

  if (op.type === 'fraction_bar') return { ready: false, reason: 'FRACTION_INCOMPLETE', blockerIndex };

  const operandsReady = tokens[index - 1]?.type === 'number' && tokens[index + 1]?.type === 'number';
  if (!operandsReady || op.depth < L.depth) return { ready: false, reason: 'GROUP_NOT_DONE', blockerIndex };
  if (groupStart(tokens, index) !== groupStart(tokens, legal)) return { ready: false, reason: 'GROUP_ORDER', blockerIndex };

  const p = getOperatorPrecedence(op.value);
  const lp = getOperatorPrecedence(L.value);
  if (lp > p) return { ready: false, reason: lp === 3 ? 'EXPONENT_FIRST' : 'MULT_DIV_FIRST', blockerIndex };
  return { ready: false, reason: 'LEFT_TO_RIGHT', blockerIndex };
}

/** Every operation that can legally be done right now (indices into tokens). */
export function getLegalMoves(tokens) {
  const moves = [];
  tokens.forEach((t, i) => {
    if (isOperatorToken(t) && analyzeOperator(tokens, i).ready) moves.push(i);
  });
  return moves;
}

/** The left-most legal move (used for hints and auto-solving). */
export function getLegalNextMove(tokens) {
  const moves = getLegalMoves(tokens);
  if (!moves.length) return null;
  const idx = moves[0];
  return { legalTokenId: tokens[idx].id, legalIndex: idx, leftIndex: idx - 1, rightIndex: idx + 1 };
}

export function computeResult(a, op, b) {
  switch (op) {
    case '+': return clean(a + b);
    case '-': return clean(a - b);
    case '×': return clean(a * b);
    case '÷': return b === 0 ? NaN : clean(a / b);
    case '^': return clean(Math.pow(a, b));
    default: return NaN;
  }
}

/** Plain-language name for the step, e.g. "multiply". */
export function opVerb(op) {
  return { '+': 'add', '-': 'subtract', '×': 'multiply', '÷': 'divide', '^': 'evaluate the power' }[op] || 'divide';
}

/** "4 × 3", "6²", "(16) ÷ (4)" style text for one step. */
export function stepText(left, op, right) {
  if (op === '^') return `${left}^${right}`;
  return `${left} ${displayOp(op)} ${right}`;
}

/** Removes grouping symbols that now hold a single number: (12) -> 12. */
function dissolveCages(tokens) {
  let current = tokens;
  let dissolved = false;
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i + 2 < current.length; i++) {
      const [a, b, c] = [current[i], current[i + 1], current[i + 2]];
      const paren = a.type === 'open_paren' && c.type === 'close_paren';
      const bracket = a.type === 'open_bracket' && c.type === 'close_bracket';
      if ((paren || bracket) && b.type === 'number') {
        current = [...current.slice(0, i), { ...b, depth: Math.max(0, a.depth - 1) }, ...current.slice(i + 3)];
        changed = true;
        dissolved = true;
        break;
      }
    }
  }
  return { tokens: current, dissolved };
}

/**
 * Collapses "left op right" into one number. Works for any operator whose
 * operands are numbers (used both for legal moves and to show what a wrong
 * move would have produced).
 */
export function applyOperation(tokens, index) {
  const op = tokens[index];
  const left = tokens[index - 1];
  const right = tokens[index + 1];
  if (!isOperatorToken(op) || left?.type !== 'number' || right?.type !== 'number') {
    throw new Error('That operation is not ready.');
  }
  const result = computeResult(left.numericValue, op.value, right.numericValue);
  const newToken = {
    id: generateTokenId(),
    type: 'number',
    value: String(result),
    numericValue: result,
    depth: op.type === 'fraction_bar' ? 0 : op.depth,
    tier: op.type === 'fraction_bar' ? 'root' : op.tier,
  };
  const merged = [...tokens.slice(0, index - 1), newToken, ...tokens.slice(index + 2)];
  const { tokens: out, dissolved } = dissolveCages(merged);
  return {
    tokens: out,
    newTokenId: newToken.id,
    result,
    dissolved,
    step: {
      op: op.type === 'fraction_bar' ? '÷' : op.value,
      isFractionBar: op.type === 'fraction_bar',
      left: left.numericValue,
      right: right.numericValue,
      result,
      text: stepText(left.value, op.type === 'fraction_bar' ? '÷' : op.value, right.value),
    },
  };
}

/** Plays legal moves (left-most first) until one number is left. */
export function evaluateTokens(tokens) {
  let cur = tokens;
  const steps = [];
  let guard = 0;
  while (!(cur.length === 1 && cur[0].type === 'number')) {
    const move = getLegalNextMove(cur);
    if (!move || guard++ > 60) return { value: NaN, steps };
    const res = applyOperation(cur, move.legalIndex);
    steps.push({ ...res.step, before: tokensToText(cur), after: tokensToText(res.tokens) });
    cur = res.tokens;
  }
  return { value: cur[0].numericValue, steps };
}

export function evaluateExpression(raw) {
  return evaluateTokens(parseExpressionToTokens(raw)).value;
}

/** What value you'd end up with if you forced this (illegal) step, then finished correctly. */
export function valueIfForced(tokens, index) {
  const op = tokens[index];
  if (op?.type !== 'operator' || tokens[index - 1]?.type !== 'number' || tokens[index + 1]?.type !== 'number') return null;
  try {
    const { tokens: after } = applyOperation(tokens, index);
    const v = evaluateTokens(after).value;
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

const RULE_TITLES = {
  GROUP_NOT_DONE: 'Grouping symbols come first',
  EXPONENT_FIRST: 'Exponents come first',
  MULT_DIV_FIRST: '× and ÷ before + and −',
  GROUP_ORDER: 'Groups go left to right',
  LEFT_TO_RIGHT: 'Same rank? Go left to right',
  FRACTION_INCOMPLETE: 'Finish the top and bottom first',
};
export { RULE_TITLES };

/**
 * Checks a strike on an operator. For a wrong strike, returns a diagnosis
 * written for a 6th grader, naming the step that has to happen first.
 */
export function validateMove(tokens, targetedTokenId) {
  const index = tokens.findIndex((t) => t.id === targetedTokenId);
  if (index === -1 || !isOperatorToken(tokens[index])) {
    return { isLegal: false, violationType: 'NOT_AN_OPERATOR', ruleTitle: 'Pick an operation', message: 'Aim at an operation sign.' };
  }
  const analysis = analyzeOperator(tokens, index);
  const target = tokens[index];

  if (analysis.ready) {
    const left = tokens[index - 1];
    const right = tokens[index + 1];
    return {
      isLegal: true,
      index,
      leftTokenId: left.id,
      rightTokenId: right.id,
      evaluatedValue: computeResult(left.numericValue, target.type === 'fraction_bar' ? '÷' : target.value, right.numericValue),
    };
  }

  const type = analysis.reason;
  const sym = displayOp(target.value);
  const b = tokens[analysis.blockerIndex];
  const bText = b.type === 'fraction_bar'
    ? 'the fraction bar'
    : formatPlain(stepText(tokens[analysis.blockerIndex - 1].value, b.value, tokens[analysis.blockerIndex + 1].value));
  const tReady = tokens[index - 1]?.type === 'number' && tokens[index + 1]?.type === 'number';
  const tText = tReady ? formatPlain(stepText(tokens[index - 1].value, target.value, tokens[index + 1].value)) : `this ${sym}`;
  const blockerId = b.id;
  let message = '';

  if (type === 'FRACTION_INCOMPLETE') {
    message = `The fraction bar is the LAST step. Simplify the whole top, then the whole bottom. Next up: ${bText}.`;
  } else if (type === 'GROUP_NOT_DONE') {
    message = target.value === '^' && !tReady
      ? `The exponent belongs to the whole group in front of it. Finish inside the group first: ${bText} comes next.`
      : `Grouping symbols come first. Work inside the innermost ( ) or [ ] first: ${bText} comes next.`;
  } else if (type === 'GROUP_ORDER') {
    message = `Finish one group at a time, left to right. The group on the left goes first: ${bText} comes next.`;
  } else if (type === 'EXPONENT_FIRST') {
    message = `Exponents come before × ÷ + −. ${bText} comes before ${tText}.`;
  } else if (type === 'MULT_DIV_FIRST') {
    message = `Multiply and divide before you add and subtract. ${bText} comes before ${tText}.`;
  } else {
    message = `${displayOp(b.value)} and ${sym} have the same rank, so go left to right: ${bText} comes first.`;
    if (b.value === target.value) message = `Same rank, so go left to right: ${bText} comes first.`;
  }

  return {
    isLegal: false,
    index,
    violationType: type,
    ruleTitle: RULE_TITLES[type] || 'Not yet',
    message,
    blockerTokenId: blockerId,
    wrongValue: valueIfForced(tokens, index),
  };
}

/** "6^2" -> "6²" for plain-text messages. */
export function formatPlain(expr) {
  const sup = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  return String(expr)
    .replace(/\^(\d+)/g, (_, d) => d.split('').map((c) => sup[c]).join(''))
    .replace(/ - /g, ' − ')
    .replace(/\*/g, '×');
}

/** Turns caret exponents into superscripts and "-" into a real minus for HTML. */
export function formatMathHtml(expr) {
  if (expr === null || expr === undefined) return '';
  return String(expr)
    .replace(/\s*\^\s*\(?([0-9]+)\)?/g, '<sup class="math-sup">$1</sup>')
    .replace(/ - /g, ' − ')
    .replace(/ \/ /g, ' ÷ ');
}

/** Token list back to readable text: "4 × (12 - 5)^2". */
export function tokensToText(tokens) {
  let out = '';
  tokens.forEach((t, i) => {
    const prev = tokens[i - 1];
    if (t.type === 'close_paren' || t.type === 'close_bracket') {
      out += t.value;
    } else if (t.type === 'operator' && t.value === '^') {
      out += '^';
    } else if (prev && (prev.type === 'open_paren' || prev.type === 'open_bracket' || (prev.type === 'operator' && prev.value === '^'))) {
      out += t.value;
    } else {
      out += (out ? ' ' : '') + (t.type === 'fraction_bar' ? '/' : t.value);
    }
  });
  return out;
}
