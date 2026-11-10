// Game World: Unlocks, Progress & Results web app (version 2)
//
// Paste this whole file into the Apps Script project, replace SHEET_ID below with the real sheet ID
// (the long text between /d/ and /edit in the sheet's address), then see README.md in this folder.

const SHEET_ID = 'PASTE_THE_SHEET_ID_HERE';
const TOWNS = 8;
const STUDENT_COUNT = 250;                      // how many student codes setupSheet() makes sure exist
const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;          // 6 characters, no I, O, 0 or 1
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 characters
const MAX_PROGRESS_CHARS = 8000;

// ---------- Web app entry points ----------

// GET ?action=load&code=ABC234  ->  { ok, open: [8 booleans], progress: "<json text>" | null }
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.action !== 'load') return json_({ ok: false, error: 'bad_request' });
    const code = String(p.code || '').trim().toUpperCase();
    const table = unlockTable_();
    if (!CODE_RE.test(code) || !table.codes[code]) return json_({ ok: false, error: 'bad_code' });
    const open = table.codes[code].map(function (v, i) { return v || table.all[i]; });
    return json_({ ok: true, open: open, progress: readProgress_(code) });
  } catch (err) {
    return json_({ ok: false, error: 'server_error' });
  }
}

// POST {type:"save", student_code, progress}  or  {type:"result", student_code, town, lesson, ...}
function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_json' }); }
  try {
    const code = String(d.student_code || '').trim().toUpperCase();
    if (!CODE_RE.test(code) || !unlockTable_().codes[code]) return json_({ ok: false, error: 'bad_code' });
    if (d.type !== 'save' && d.type !== 'result') return json_({ ok: false, error: 'bad_type' });
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(8000)) return json_({ ok: false, error: 'busy' });   // the game retries
    try {
      if (d.type === 'save') {
        const err = saveProgress_(code, d.progress);
        if (err) return json_({ ok: false, error: err });
      } else {
        addResult_(code, d);
      }
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: 'server_error' });
  }
}

// ---------- Reading ----------

// Unlocks tab as { all: [8 booleans], codes: { CODE: [8 booleans] } }, cached for 60 seconds.
function unlockTable_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('unlocks');
  if (hit) return JSON.parse(hit);
  const rows = book_().getSheetByName('Unlocks').getDataRange().getValues();
  const table = { all: [], codes: {} };
  for (let t = 0; t < TOWNS; t++) table.all.push(false);
  for (let r = 1; r < rows.length; r++) {
    const id = String(rows[r][0]).trim().toUpperCase();
    if (!id) continue;
    const flags = [];
    for (let t = 0; t < TOWNS; t++) flags.push(isTrue_(rows[r][t + 1]));
    if (id === 'ALL') table.all = flags; else table.codes[id] = flags;
  }
  try { cache.put('unlocks', JSON.stringify(table), 60); } catch (err) { /* too big to cache: fine */ }
  return table;
}

function readProgress_(code) {
  const sheet = book_().getSheetByName('Progress');
  if (!sheet) return null;
  const cell = sheet.getRange('A:A').createTextFinder(code).matchEntireCell(true).findNext();
  if (!cell) return null;
  const v = sheet.getRange(cell.getRow(), 2).getValue();
  return v ? String(v) : null;
}

// ---------- Writing (always called while holding the lock) ----------

function saveProgress_(code, progress) {
  const text = typeof progress === 'string' ? progress : JSON.stringify(progress);
  if (!text || text.length > MAX_PROGRESS_CHARS) return 'progress_size';
  const sheet = book_().getSheetByName('Progress');
  const cell = sheet.getRange('A:A').createTextFinder(code).matchEntireCell(true).findNext();
  const row = cell ? cell.getRow() : sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, 3).setNumberFormat('@').setValues([[code, text, new Date().toISOString()]]);
  return null;
}

function addResult_(code, d) {
  const sheet = book_().getSheetByName('Results');
  const r = sheet.getLastRow() + 1;
  const row = [new Date(), code, clip_(d.town), clip_(d.lesson), clip_(d.game),
    num_(d.score), num_(d.problems_attempted), num_(d.problems_correct), num_(d.accuracy),
    d.boss_defeated === true, d.practice_mode === true];
  sheet.getRange(r, 3, 1, 3).setNumberFormat('@');          // town, lesson, game stay plain text ("4-2" is not a date)
  sheet.getRange(r, 1, 1, row.length).setValues([row]);
}

// ---------- One-time setup: run this from the Apps Script editor ----------

// Creates the Progress tab and tops the Unlocks tab up to STUDENT_COUNT student codes.
// Existing codes are never changed. To add more students later, raise STUDENT_COUNT and run it again.
function setupSheet(count) {
  const n = count || STUDENT_COUNT;
  const book = book_();
  let progress = book.getSheetByName('Progress');
  if (!progress) {
    progress = book.insertSheet('Progress');
    progress.appendRow(['student_code', 'progress', 'updated_at']);
    progress.setFrozenRows(1);
  }
  const unlocks = book.getSheetByName('Unlocks');
  const have = {};
  let students = 0;
  unlocks.getDataRange().getValues().slice(1).forEach(function (row) {
    const id = String(row[0]).trim().toUpperCase();
    if (id) { have[id] = true; if (id !== 'ALL') students++; }
  });
  const fresh = [];
  while (students + fresh.length < n) {
    const code = newCode_();
    if (!have[code]) { have[code] = true; fresh.push([code]); }
  }
  if (fresh.length) unlocks.getRange(unlocks.getLastRow() + 1, 1, fresh.length, 1).setValues(fresh);
  const last = unlocks.getLastRow();
  unlocks.getRange(2, 2, last - 1, TOWNS).insertCheckboxes();   // tick a box to open that town
  CacheService.getScriptCache().remove('unlocks');
  Logger.log('Student codes now in the Unlocks tab: ' + (students + fresh.length) + ' (added ' + fresh.length + ')');
}

// ---------- Helpers ----------

function newCode_() {
  const hex = Utilities.getUuid().replace(/-/g, '');            // characters 0-11 are random
  let out = '';
  for (let i = 0; i < 6; i++) out += ALPHABET.charAt(parseInt(hex.substr(i * 2, 2), 16) % 32);
  return out;
}
function book_() { return SpreadsheetApp.openById(SHEET_ID); }
function isTrue_(v) { return v === true || String(v).trim().toUpperCase() === 'TRUE'; }
function num_(v) { const n = Number(v); return isFinite(n) ? n : ''; }
function clip_(v) { const s = String(v == null ? '' : v).slice(0, 60); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
