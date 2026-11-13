// Tests for the Golem Fort's rules (golem.js). Run with:  node towns/topic-4-equation-valley/games/4-boss-golem-fort/test_golem_fort_math.js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PARTS, ZONES, WEAPON_ZONE, weaponUrl, strength, tally } from './golem.js';

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS', name); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const weapons = PARTS.flatMap((p) => p.weapons);

await test('five parts, and every Topic 4 lesson is a weapon exactly once', () => {
  assert.equal(PARTS.length, 5); assert.equal(ZONES.length, 5); assert.deepEqual(ZONES.map((z) => z.name), PARTS.map((p) => p.name));
  assert.deepEqual(weapons.map((w) => w.lesson), ['4-1', '4-2', '4-3', '4-4', '4-5', '4-6', '4-7', '4-8', '4-9', '4-10']);
  for (const p of PARTS) assert.ok(p.weapons.length >= 1 && p.weapons.length <= 3 && p.name && p.blurb);
  for (const w of weapons) assert.ok(w.name && w.does && w.folder.startsWith(`${w.lesson}-`));
});

await test('every weapon is a real game with a boss zone that can run in fort mode', async () => {
  for (const w of weapons) {
    const dir = path.join(HERE, '..', w.folder);
    assert.ok(fs.existsSync(path.join(dir, 'index.html')), `${w.folder} has a page`);
    const game = fs.readFileSync(path.join(dir, 'game.js'), 'utf8');
    assert.ok(/shared\/game\/arcadeShell\.js/.test(game), `${w.name} runs on the action shell, which has fort mode`);
    const mathFile = fs.readdirSync(dir).find((f) => f.endsWith('.js') && f !== 'game.js' && !f.startsWith('test_'));
    const math = await import(pathToFileURL(path.join(dir, mathFile)).href);
    assert.equal(math.ZONES.length, WEAPON_ZONE + 1, `${w.name}: zone ${WEAPON_ZONE + 1} is its last (boss) zone`);
  }
  assert.ok(/FORT_WEAPON_DONE/.test(fs.readFileSync(path.join(HERE, '../../../../shared/game/arcadeShell.js'), 'utf8')));
});

await test('weapon addresses', () => {
  const w = weapons[3];
  assert.equal(weaponUrl(w), '../4-4-gear-shift/index.html?fort=4'); assert.equal(weaponUrl(w, { practice: true }), '../4-4-gear-shift/index.html?fort=4&practice=1');
  assert.equal(weaponUrl(w, { practice: true, test: true }), '../4-4-gear-shift/index.html?fort=4&practice=1&test');
});

await test('the golem weakens one part at a time', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(strength), [100, 80, 60, 40, 20, 0]); assert.equal(strength(9), 0);
});

await test('what a weapon sends back is made safe before it is added up', () => {
  assert.deepEqual(tally({ won: true, good: 6, bad: 1, lives: 3, practiceMode: false }), { won: true, good: 6, bad: 1 });
  assert.deepEqual(tally({ won: false, good: 2, bad: 9 }), { won: false, good: 2, bad: 9 });
  assert.deepEqual(tally({ won: 'yes', good: -4, bad: 2.6 }), { won: false, good: 0, bad: 3 }, 'won must be exactly true');
  assert.deepEqual(tally({ won: true, good: 9999, bad: NaN }), { won: true, good: 60, bad: 0 });
  for (const junk of [null, undefined, 'x', 7, []]) assert.deepEqual(tally(junk), { won: false, good: 0, bad: 0 });
});

console.log(`\n${passed} tests passed`);
