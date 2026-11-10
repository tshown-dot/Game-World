// Tests the Apps Script (docs/apps-script/Code.gs) against a pretend Google:
// an in-memory spreadsheet, cache and lock. Run with:  node tests/test_apps_script.js
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '..', 'docs', 'apps-script', 'Code.gs'), 'utf8');

// ---------- pretend Google ----------
class Sheet {
  constructor(rows = []) { this.rows = rows.map(r => r.slice()); this.textCells = new Set(); }
  getDataRange() { return { getValues: () => this.rows.map(r => r.slice()) }; }
  getLastRow() { return this.rows.length; }
  appendRow(r) { this.rows.push(Array.from(r)); }
  setFrozenRows() {}
  getRange(a, b, nr = 1, nc = 1) {
    const sheet = this;
    if (typeof a === 'string') {              // 'A:A' style, only used for text searches
      return { createTextFinder: text => ({ matchEntireCell: () => ({ findNext() {
        for (let i = 0; i < sheet.rows.length; i++) if (String(sheet.rows[i][0]) === text) return { getRow: () => i + 1 };
        return null;
      } }) }) };
    }
    const row = a, col = b;
    const range = {
      getValue: () => (sheet.rows[row - 1] && sheet.rows[row - 1][col - 1] !== undefined ? sheet.rows[row - 1][col - 1] : ''),
      setNumberFormat(f) { if (f === '@') for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) sheet.textCells.add(`${row + i},${col + j}`); return range; },
      setValues(vals) {
        for (let i = 0; i < vals.length; i++) {
          while (sheet.rows.length < row + i) sheet.rows.push([]);
          for (let j = 0; j < vals[i].length; j++) sheet.rows[row - 1 + i][col - 1 + j] = vals[i][j];
        }
        return range;
      },
      insertCheckboxes() {
        for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
          const r = sheet.rows[row - 1 + i]; const v = r[col - 1 + j];
          r[col - 1 + j] = v === true || String(v).toUpperCase() === 'TRUE';
        }
        return range;
      },
    };
    return range;
  }
}

function makeWorld() {
  const book = {
    Unlocks: new Sheet([['student_code', ...Array.from({ length: 8 }, (_, i) => `town_${i + 1}`)], ['ALL', ...Array(8).fill('')]]),
    Results: new Sheet([['timestamp', 'student_code', 'town', 'lesson', 'game', 'score', 'problems_attempted', 'problems_correct', 'accuracy', 'boss_defeated', 'practice_mode']]),
  };
  const cache = new Map();
  let lockAvailable = true;
  const ctx = {
    SpreadsheetApp: { openById: () => ({
      getSheetByName: n => book[n] || null,
      insertSheet: n => (book[n] = new Sheet()),
    }) },
    CacheService: { getScriptCache: () => ({ get: k => cache.get(k) ?? null, put: (k, v) => cache.set(k, v), remove: k => cache.delete(k) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => lockAvailable, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ text: t, setMimeType() { return this; } }) },
    Utilities: { getUuid: () => crypto.randomUUID() },
    Logger: { log() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  const call = {
    get: params => JSON.parse(ctx.doGet({ parameter: params }).text),
    post: body => JSON.parse(ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).text),
  };
  return { book, cache, ctx, call, setLock: v => { lockAvailable = v; } };
}

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }

// ---------- tests ----------
test('setupSheet makes 250 unique valid codes, a Progress tab and checkboxes; rerun changes nothing', () => {
  const w = makeWorld();
  w.ctx.setupSheet();
  const codes = w.book.Unlocks.rows.slice(2).map(r => r[0]);
  assert.equal(codes.length, 250);
  assert.equal(new Set(codes).size, 250);
  assert.ok(codes.every(c => /^[A-HJ-NP-Z2-9]{6}$/.test(c)), 'codes use the safe alphabet');
  assert.deepEqual(w.book.Progress.rows[0], ['student_code', 'progress', 'updated_at']);
  assert.ok(w.book.Unlocks.rows.slice(1).every(r => r.slice(1, 9).every(v => v === false)), 'town cells are unchecked checkboxes');
  const before = JSON.stringify(w.book.Unlocks.rows);
  w.ctx.setupSheet();
  assert.equal(JSON.stringify(w.book.Unlocks.rows), before, 'second run adds nothing and keeps all codes');
  w.ctx.setupSheet(255);
  assert.equal(w.book.Unlocks.rows.length, 2 + 255);
  assert.deepEqual(w.book.Unlocks.rows.slice(2, 252).map(r => r[0]), codes, 'old codes unchanged');
});

test('load: valid code merges the ALL row; lowercase accepted', () => {
  const w = makeWorld(); w.ctx.setupSheet(3);
  const code = w.book.Unlocks.rows[2][0];
  w.book.Unlocks.rows[2][3] = true;   // student's town_3
  w.book.Unlocks.rows[1][5] = true;   // ALL row, town_5
  w.cache.clear();
  const res = w.call.get({ action: 'load', code: code.toLowerCase() });
  assert.equal(res.ok, true);
  assert.deepEqual(res.open, [false, false, true, false, true, false, false, false]);
  assert.equal(res.progress, null);
});

test('load: rejects unknown codes, bad shapes and missing action; never leaks other rows', () => {
  const w = makeWorld(); w.ctx.setupSheet(3);
  assert.equal(w.call.get({ action: 'load', code: 'AAAAAA' }).error, 'bad_code');
  assert.equal(w.call.get({ action: 'load', code: 'ALL' }).error, 'bad_code');
  assert.equal(w.call.get({ action: 'load', code: '' }).error, 'bad_code');
  assert.equal(w.call.get({ action: 'load', code: "' OR 1=1" }).error, 'bad_code');
  assert.equal(w.call.get({ code: w.book.Unlocks.rows[2][0] }).error, 'bad_request');
  const ok = w.call.get({ action: 'load', code: w.book.Unlocks.rows[2][0] });
  assert.deepEqual(Object.keys(ok).sort(), ['ok', 'open', 'progress']);
});

test('save: creates then updates the same row (no duplicates); load returns it', () => {
  const w = makeWorld(); w.ctx.setupSheet(3);
  const code = w.book.Unlocks.rows[3][0];
  assert.equal(w.call.post({ type: 'save', student_code: code, progress: { towns: { 3: { done: 2 } } } }).ok, true);
  assert.equal(w.book.Progress.rows.length, 2);
  assert.equal(w.call.post({ type: 'save', student_code: code.toLowerCase(), progress: '{"v":2}' }).ok, true);
  assert.equal(w.book.Progress.rows.length, 2, 'updated in place');
  assert.equal(w.book.Progress.rows[1][1], '{"v":2}');
  assert.equal(w.call.get({ action: 'load', code }).progress, '{"v":2}');
  const other = w.book.Unlocks.rows[2][0];
  w.call.post({ type: 'save', student_code: other, progress: '{"v":9}' });
  assert.equal(w.book.Progress.rows.length, 3, 'a second student gets their own row');
  assert.equal(w.call.get({ action: 'load', code }).progress, '{"v":2}', 'students do not overwrite each other');
});

test('save: oversize or empty progress is refused', () => {
  const w = makeWorld(); w.ctx.setupSheet(2);
  const code = w.book.Unlocks.rows[2][0];
  assert.equal(w.call.post({ type: 'save', student_code: code, progress: 'x'.repeat(8001) }).error, 'progress_size');
  assert.equal(w.call.post({ type: 'save', student_code: code, progress: '' }).error, 'progress_size');
  assert.equal(w.book.Progress.rows.length, 1);
});

test('result: appends one row, lesson stays text, formulas and junk numbers are neutralised', () => {
  const w = makeWorld(); w.ctx.setupSheet(2);
  const code = w.book.Unlocks.rows[2][0];
  const res = w.call.post({ type: 'result', student_code: code, town: 'topic-4', lesson: '4-2', game: '=HYPERLINK("x")',
    score: 120, problems_attempted: 10, problems_correct: 'lots', accuracy: 90, boss_defeated: true, practice_mode: 'yes' });
  assert.equal(res.ok, true);
  const row = w.book.Results.rows[1];
  assert.equal(row[1], code);
  assert.equal(row[3], '4-2');
  assert.ok(w.book.Results.textCells.has('2,3') && w.book.Results.textCells.has('2,4') && w.book.Results.textCells.has('2,5'), 'columns C-E are plain text');
  assert.equal(row[4], `'=HYPERLINK("x")`);
  assert.equal(row[6], 10);
  assert.equal(row[7], '', 'non-numeric becomes blank');
  assert.equal(row[9], true);
  assert.equal(row[10], false, 'only a real true counts as practice mode');
});

test('post: bad json, bad type, unknown code and busy lock give clear errors and write nothing', () => {
  const w = makeWorld(); w.ctx.setupSheet(2);
  const code = w.book.Unlocks.rows[2][0];
  assert.equal(w.call.post('not json').error, 'bad_json');
  assert.equal(w.call.post({ type: 'delete', student_code: code }).error, 'bad_type');
  assert.equal(w.call.post({ type: 'save', student_code: 'ZZZZZZ', progress: '{}' }).error, 'bad_code');
  w.setLock(false);
  assert.equal(w.call.post({ type: 'save', student_code: code, progress: '{}' }).error, 'busy');
  assert.equal(w.book.Progress.rows.length, 1);
  assert.equal(w.book.Results.rows.length, 1);
});

test('unlock changes show up once the 60 second cache is cleared', () => {
  const w = makeWorld(); w.ctx.setupSheet(2);
  const code = w.book.Unlocks.rows[2][0];
  assert.deepEqual(w.call.get({ action: 'load', code }).open.slice(0, 2), [false, false]);
  w.book.Unlocks.rows[2][1] = true;
  assert.deepEqual(w.call.get({ action: 'load', code }).open.slice(0, 2), [false, false], 'cached for up to a minute');
  w.cache.clear();
  assert.deepEqual(w.call.get({ action: 'load', code }).open.slice(0, 2), [true, false]);
});

console.log(`\n${passed} tests passed`);
