// Tests for Factor Mill (mill.js). Run with:
//   node towns/g7-topic-4-factor-falls/games/4-5-factor-mill/test_factor_mill_math.js
import assert from 'node:assert/strict';
import {
  seeded, fmt, parseNumber, near, gcd, gcdAll, termText, exprText, factoredText, ZONES, genZone, genBackup,
  genFactor, genSelect, genFully, genSusan, genFriend, genRyan, genKits,
  checkWheel, checkInside, checkSelect, checkChoice, checkNum, workedSolution,
} from './mill.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261117);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
/** Works out what an expression's TEXT equals, so answers can be checked against the text students see. */
function evalText(text, vals) {
  let js = text.replace(/−/g, '-');
  js = js.replace(/([a-z])([a-z])/g, '$1*$2').replace(/(\d|\))([a-z(])/g, '$1*$2').replace(/([a-z])\(/g, '$1*(');
  return Function(...Object.keys(vals), `return ${js};`)(...Object.values(vals));   // eslint-disable-line no-new-func
}
const V1 = { x: 2, y: -3, a: 5, n: 7, b: 4 }, V2 = { x: -1, y: 4, a: 2, n: -2, b: 3 };
const sameText = (a, b) => near(evalText(a, V1), evalText(b, V1)) && near(evalText(a, V2), evalText(b, V2));
const LEVELS = ['two', 'multi', 'negpos', 'negneg', 'three', 'partial', 'threeneg'];

test('helpers', () => {
  assert.equal(gcd(18, 24), 6); assert.equal(gcdAll([12, 18, 26]), 2); assert.equal(gcdAll([-6, 18, -12]), 6);
  assert.equal(factoredText(-2, [{ c: 1, v: 'x' }, { c: 3, v: '' }]), '−2(x + 3)');       // the textbook's −2x − 6
  assert.equal(factoredText(2, [{ c: -1, v: 'x' }, { c: -3, v: '' }]), '2(−x − 3)');
  for (const [raw, want] of [['-3', -3], ['−3', -3], ['+5', 5], ['12', 12]]) assert.equal(parseNumber(raw), want);
  assert.equal(parseNumber('x'), null); assert.equal(termText(-1, 'x'), '−x');
});

test(`every zone: ${RUNS} runs make clean problems whose answers equal the original`, () => {
  assert.equal(ZONES.length, 5);
  for (let i = 0; i < RUNS / 5; i++) {
    for (let z = 0; z < 5; z++) {
      const list = genZone(rnd, z);
      assert.ok(list.length >= 4); if (z === 4) assert.equal(list.length, 5);
      for (const p of list) {
        assert.ok(noJunk(p.prompt.replace(/<[^>]+>/g, '')), p.prompt);
        for (const line of workedSolution(p)) assert.ok(noJunk(line), `${p.type}: ${line}`);
        if (['factor', 'susan', 'friend', 'kits'].includes(p.type)) assert.ok(sameText(p.show, p.answerText), `${p.show} = ${p.answerText}`);
        if (p.options) { assert.equal(p.options.filter((o) => o.ok).length, 1); assert.equal(new Set(p.options.map((o) => o.text)).size, p.options.length); p.options.forEach((o, k) => { const r = checkChoice(p, k); assert.equal(r.correct, o.ok); assert.ok(noJunk(r.message)); }); }
      }
      const back = genBackup(rnd, list[0]);
      assert.equal(back.type, list[0].type); assert.notEqual(back.id, list[0].id);
    }
  }
});

test('the wheel: only the greatest common factor (with the right sign) is accepted', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genFactor(rnd, { level: LEVELS[i % LEVELS.length] });
    assert.equal(p.gcf, gcdAll(p.terms.map((t) => t.c)));
    assert.equal(p.factor, p.negative ? -p.gcf : p.gcf);
    assert.equal(gcdAll(p.inside.map((t) => t.c)), 1, 'nothing more can be pulled out');
    assert.equal(p.wheels.length, 4); assert.equal(new Set(p.wheels).size, 4);
    assert.ok(p.wheels.includes(p.factor) && !p.wheels.includes(1) && !p.wheels.includes(0));
    for (const w of p.wheels) {
      const res = checkWheel(p, w);
      assert.equal(res.correct, w === p.factor);
      const divides = p.terms.every((t) => t.c % w === 0);
      if (!res.correct) { assert.ok(noJunk(res.message)); assert.equal(res.key, !divides ? 'not_common' : (p.negative && w > 0) ? 'wrong_sign' : 'not_greatest'); }
    }
    if (p.level === 'multi') assert.ok(p.wheels.some((w) => checkWheel(p, w).key === 'not_greatest'), 'a smaller common factor is offered');
    if (p.level === 'partial') { assert.equal(p.gcf, 2); assert.ok(p.wheels.some((w) => checkWheel(p, w).key === 'not_common')); }
    if (p.negative) assert.ok(p.wheels.includes(p.gcf), 'the positive GCF is offered as a wrong-sign choice');
  }
});

test('what is left inside: divided terms, signs, and a distribute-back check', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genFactor(rnd, { level: LEVELS[i % LEVELS.length] });
    const good = p.inside.map((t) => String(t.c));
    assert.ok(checkInside(p, good).correct);
    assert.ok(checkInside(p, good.slice(1)).nudge && checkInside(p, good.map((v, k) => (k ? v : ''))).nudge);
    const lazy = [...good]; lazy[1] = String(p.terms[1].c);
    assert.equal(checkInside(p, lazy).key, 'forgot_to_divide');
    const flip = [...good]; flip[0] = String(-p.inside[0].c);
    const fr = checkInside(p, flip);
    assert.ok(fr.section === 0 && ['sign_error', 'forgot_to_divide'].includes(fr.key));
    if (p.negative) assert.ok(p.inside[0].c > 0 || p.level === 'threeneg', 'a negative factor leaves positive terms from negative ones');
    p.terms.forEach((t, k) => assert.equal(p.factor * p.inside[k].c, t.c));
  }
});

test('equivalent or not: cards are judged by distributing them back', () => {
  for (let i = 0; i < RUNS; i++) {
    const s = genSelect(rnd);
    const good = s.cards.map((c, k) => (c.ok ? k : -1)).filter((k) => k >= 0);
    assert.equal(good.length, 3); assert.equal(new Set(s.cards.map((c) => c.text)).size, 6);
    for (const c of s.cards) { assert.equal(c.ok, sameText(c.text, s.show), `${c.text} vs ${s.show}`); if (!c.ok) assert.ok(c.key && noJunk(c.message)); }
    assert.ok(checkSelect(s, good).correct);
    assert.equal(checkSelect(s, good.slice(1)).key, 'missed_twin');
    assert.equal(checkSelect(s, [...good, s.cards.findIndex((c) => !c.ok)]).wrong.length, 1);
    const f = genFully(rnd);
    for (const o of f.options) assert.ok(sameText(o.text, f.show), 'every option is equivalent; only one is fully factored');
    assert.ok(f.options.filter((o) => !o.ok).every((o) => o.key === 'not_greatest'));
  }
});

test('the boss: Susan, the friend, Ryan and the kits', () => {
  for (let i = 0; i < RUNS; i++) {
    const s = genSusan(rnd);
    assert.ok(!sameText(s.hers, s.show), "Susan's version is not equivalent");
    const f = genFriend(rnd);
    for (const o of f.options) assert.equal(sameText(o.text, f.show), o.ok || o.key === 'not_greatest', `${o.text} vs ${f.show}`);
    const r = genRyan(rnd);
    for (const o of r.options.filter((x) => !x.ok)) assert.ok(!sameText(o.text.replace(/^No: it is /, ''), r.show));
    const k = genKits(rnd);
    assert.equal(k.answer, gcdAll([k.A, k.B, k.C]));
    assert.ok(checkNum(k, String(k.answer)).correct && checkNum(k, '').nudge);
    for (const t of k.traps) assert.equal(checkNum(k, String(t.v)).key, t.key);
    assert.equal(checkNum(k, '2').key, k.answer === 2 ? 'correct' : 'not_greatest');
    assert.equal(checkNum(k, '7').key, 'not_common');
  }
});

console.log(`\n${passed} tests passed`);
