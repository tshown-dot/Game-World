// Tests for Spray Deck (deck.js). Run with:
//   node towns/g7-topic-4-factor-falls/games/4-4-spray-deck/test_spray_deck_math.js
import assert from 'node:assert/strict';
import {
  seeded, fmt, parseNumber, near, r2, termText, exprText, simplify, ZONES, genZone, genBackup,
  genDeck, genVarOut, genGardener, genSelect, checkExpand, checkSimplify, checkChoice, checkSelect, workedSolution,
} from './deck.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const RUNS = 2000;
const rnd = seeded(20261116);
const noJunk = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
/** Works out what an expression's TEXT equals, so answers can be checked against the text students see. */
function evalText(text, vals) {
  let js = text.replace(/−/g, '-').replace(/(\d+)\/(\d+)/g, '($1/$2)');
  js = js.replace(/([a-z])([a-z])/g, '$1*$2').replace(/(\d|\))([a-z(])/g, '$1*$2').replace(/([a-z])\(/g, '$1*(');
  return Function(...Object.keys(vals), `return ${js};`)(...Object.values(vals));   // eslint-disable-line no-new-func
}
const V1 = { x: 2, y: -3, n: 5, t: 1.5, g: -2, b: 4, w: 3 }, V2 = { x: -1, y: 4, n: 2, t: -2, g: 3, b: 2.5, w: -5 };
const sameText = (a, b) => near(evalText(a, V1), evalText(b, V1)) && near(evalText(a, V2), evalText(b, V2));
const LEVELS = ['int2', 'three', 'neg', 'dec', 'dec3', 'tail', 'frac', 'bread'];
const right = (p) => [...p.expanded, ...(p.tail ? [p.tail] : [])].map((t) => String(t.c));
const simple = (p) => Object.fromEntries(p.simple.map((t) => [t.v || 'k', String(t.c)]));

test('writing and simplifying', () => {
  assert.equal(exprText([{ c: -21, v: 'y' }, { c: 7, v: '' }]), '−21y + 7');     // the textbook's −7(3y − 1)
  assert.equal(exprText(simplify([{ c: 12, v: '' }, { c: 16, v: 'x' }, { c: -8, v: '' }])), '16x + 4');   // 4(3 + 4x − 2)
  for (const [raw, want] of [['-21', -21], ['−21', -21], ['+7', 7], ['0.78', 0.78], ['1/2', 0.5]]) assert.ok(near(parseNumber(raw), want), raw);
  assert.equal(termText(-1, 'x'), '−x'); assert.equal(fmt(-0.78), '−0.78');
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
        if (p.type !== 'gardener') assert.ok(sameText(p.show, p.answerText), `${p.show} = ${p.answerText}`);
        if (z < 2 && p.type === 'deck') assert.ok(Number.isInteger(p.a) && p.a > 0, 'whole positive widths before Cold Decks');
      }
      const back = genBackup(rnd, list[0]);
      assert.equal(back.type, list[0].type); assert.notEqual(back.id, list[0].id);
    }
  }
});

test('expanding: every section is checked, slips are named', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genDeck(rnd, { level: LEVELS[i % LEVELS.length] });
    assert.ok(sameText(p.show, p.expandedText), `${p.show} = ${p.expandedText}`);
    const good = right(p);
    const res = checkExpand(p, good);
    assert.ok(res.correct && res.done === !p.needsSimplify);
    assert.ok(checkExpand(p, good.slice(0, -1)).nudge && checkExpand(p, good.map((v, k) => (k ? v : ''))).nudge);
    // the last inside section left un-multiplied
    const last = p.inside.length - 1, lazy = [...good]; lazy[last] = String(p.inside[last].c);
    if (!near(p.inside[last].c, p.expanded[last].c)) assert.equal(checkExpand(p, lazy).key, 'first_term_only');
    const flip = [...good]; flip[0] = String(-p.expanded[0].c);
    const fr = checkExpand(p, flip);
    assert.ok(!fr.correct && fr.section === 0 && ['sign_error', 'dropped_subtraction', 'first_term_only'].includes(fr.key), fr.key);
    if (p.a < 0 && !near(-p.expanded[0].c, p.inside[0].c)) assert.equal(fr.key, 'sign_error');
    if (p.tail) { const t = [...good]; t[t.length - 1] = String(r2(p.a * p.tail.c)); assert.equal(checkExpand(p, t).key, 'expanded_tail'); }
    assert.ok(noJunk(checkExpand(p, good.map((v) => String(Number(v) + 77))).message));
  }
  const book = genDeck(seeded(1), { level: 'neg' });
  assert.ok(book.a < 0);
});

test('simplifying after expanding', () => {
  for (let i = 0; i < RUNS; i++) {
    const p = genDeck(rnd, { level: ['three', 'dec3', 'bread'][i % 3] });
    assert.ok(p.needsSimplify);
    assert.ok(checkSimplify(p, simple(p)).correct);
    assert.ok(checkSimplify(p, {}).nudge);
    const k = p.simple[0].v || 'k';
    assert.ok(['sign_error', 'lost_negative'].includes(checkSimplify(p, { ...simple(p), [k]: String(-p.simple[0].c) }).key));
    if (p.level !== 'bread') {
      const everything = r2(p.expanded.reduce((s, t) => s + t.c, 0));
      // adding every number together is caught (it can land on the same number as a sign slip, so either name is fine)
      if (!p.simple.some((t) => near(t.c, everything))) assert.ok(['combine_unlike', 'sign_error', 'lost_negative'].includes(checkSimplify(p, { ...simple(p), [k]: String(everything) }).key));
    }
  }
  const bread = genDeck(seeded(4), { level: 'bread' });
  assert.equal(bread.simple.length, 1); assert.equal(bread.simple[0].v, 'b');
  assert.ok(near(bread.simple[0].c, bread.a * (1 + bread.inside[1].c)), 'loaves × (1 − discount)');
});

test('choices and select-all', () => {
  for (let i = 0; i < RUNS; i++) {
    const v = genVarOut(rnd);
    assert.equal(new Set(v.options.map((o) => o.text)).size, 4);
    v.options.forEach((o, k) => { assert.equal(sameText(o.text, v.show), o.ok, `${o.text} vs ${v.show}`); assert.equal(checkChoice(v, k).correct, o.ok); });
    assert.ok(v.options.some((o) => o.key === 'product_as_sum'));
    const g = genGardener(rnd);
    assert.equal(g.options.filter((o) => o.ok).length, 1); assert.equal(g.options.find((o) => o.ok).text, String(g.a * g.b));
    const s = genSelect(rnd);
    const good = s.cards.map((c, k) => (c.ok ? k : -1)).filter((k) => k >= 0);
    assert.ok(good.length >= 2 && good.length < s.cards.length);
    for (const c of s.cards) assert.equal(c.ok, sameText(c.text, s.show), `${c.text} vs ${s.show}`);
    assert.ok(checkSelect(s, good).correct);
    assert.equal(checkSelect(s, good.slice(1)).key, 'missed_twin');
    const bad = s.cards.findIndex((c) => !c.ok);
    assert.equal(checkSelect(s, [...good, bad]).key, s.cards[bad].key);
  }
});

console.log(`\n${passed} tests passed`);
