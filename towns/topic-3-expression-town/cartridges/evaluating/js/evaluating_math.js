/**
 * Variable Vault (enVision 2.0 Lesson 3-5: Evaluate Algebraic Expressions)
 * Mathematical Engine & Parser
 */

export function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a || 1;
}

export class Q {
  constructor(n, d = 1, dec = false) {
    if (d === 0) throw new Error('divide by zero');
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d);
    this.n = n / g;
    this.d = d / g;
    this.dec = dec;
  }
  add(o) { return new Q(this.n * o.d + o.n * this.d, this.d * o.d, this.dec || o.dec); }
  sub(o) { return new Q(this.n * o.d - o.n * this.d, this.d * o.d, this.dec || o.dec); }
  mul(o) { return new Q(this.n * o.n, this.d * o.d, this.dec || o.dec); }
  div(o) { return new Q(this.n * o.d, this.d * o.n, this.dec || o.dec); }
  pow(o) {
    let r = new Q(1, 1, this.dec);
    for (let i = 0; i < o.n; i++) r = r.mul(this);
    return r;
  }
  eq(o) { return this.n === o.n && this.d === o.d; }
  get whole() { return this.d === 1; }
  get num() { return this.n / this.d; }
}

export const q = (n, d = 1) => new Q(n, d);

export const dq = (s) => {
  s = String(s);
  const [i, f = ''] = s.split('.');
  return new Q(parseInt((i || '0') + f, 10), Math.pow(10, f.length), true);
};

export function terminating(d) {
  while (d % 2 === 0) d /= 2;
  while (d % 5 === 0) d /= 5;
  return d === 1;
}

export function decStr(x) {
  return String(parseFloat((x.n / x.d).toFixed(6)));
}

export function qText(x) {
  if (x.whole) return String(x.n);
  if (x.dec && terminating(x.d)) return decStr(x);
  const w = Math.floor(x.n / x.d), r = x.n - w * x.d;
  return w > 0 ? `${w} ${r}/${x.d}` : `${r}/${x.d}`;
}

export function parseAnswer(s) {
  if (s === null || s === undefined) return null;
  s = String(s).replace(/\$/g, '').replace(/,/g, '').trim().replace(/\s+/g, ' ');
  let m;
  if (/^\d+$/.test(s)) return q(parseInt(s, 10));
  if ((m = s.match(/^(\d*)\.(\d+)$/))) return dq((m[1] || '0') + '.' + m[2]);
  if ((m = s.match(/^(\d+)\.$/))) return q(parseInt(m[1], 10));
  if ((m = s.match(/^(\d+)\/(\d+)$/))) {
    const d = +m[2];
    return d ? q(+m[1], d) : null;
  }
  if ((m = s.match(/^(\d+) (\d+)\/(\d+)$/))) {
    const d = +m[3];
    return d ? q(+m[1] * d + +m[2], d) : null;
  }
  return null;
}

/* ---------------- Expression trees ---------------- */
export const wrapN = (x) => (typeof x === 'number' || x instanceof Q ? N(x) : x);
export const N = (v) => ({ t: 'num', v: v instanceof Q ? v : q(v) });
export const V = (name) => ({ t: 'var', name });
export const G = (x) => ({ t: 'grp', x });
export const B = (op, a, b, imp = false) => ({ t: 'bin', op, a: wrapN(a), b: wrapN(b), imp });
export const add = (a, b) => B('+', a, b);
export const sub = (a, b) => B('-', a, b);
export const imul = (a, b) => B('*', a, b, true);
export const dvd = (a, b) => B('/', a, b);
export const pw = (a, b) => B('^', a, b);

export const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };

export function apply(op, a, b) {
  switch (op) {
    case '+': return a.add(b);
    case '-': return a.sub(b);
    case '*': return a.mul(b);
    case '/': return a.div(b);
    case '^': return a.pow(b);
  }
}

export function subst(n, vals) {
  switch (n.t) {
    case 'var': return { t: 'num', v: vals[n.name], fromVar: n.name };
    case 'grp': return G(subst(n.x, vals));
    case 'bin': return { ...n, a: subst(n.a, vals), b: subst(n.b, vals) };
    default: return n;
  }
}

export function evalTree(n, vals) {
  const tree = subst(n, vals);
  function calc(node) {
    if (node.t === 'num') return node.v;
    if (node.t === 'grp') return calc(node.x);
    if (node.t === 'bin') {
      const a = calc(node.a);
      const b = calc(node.b);
      return apply(node.op, a, b);
    }
    throw new Error('Unknown node ' + node.t);
  }
  return calc(tree);
}

export const VAULTS = [
  { name: 'The Lobby Lockbox', skill: 'One variable', icon: '🗝️' },
  { name: 'Twin-Key Treasury', skill: 'Two or more variables', icon: '🔐' },
  { name: 'The Power Core', skill: 'Exponents & order of operations', icon: '⚡' },
  { name: 'The Fraction & Decimal Den', skill: 'Decimals and fractions', icon: '💠' },
  { name: 'The Grand Vault', skill: 'Formulas & word problems', icon: '👑' },
];
