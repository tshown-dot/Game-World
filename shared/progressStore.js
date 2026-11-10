// Student sign-in, progress saving and results for every town in Game World.
//
// How it works
//  - A student types the 6-character code from their sticky note. The code is checked against the teacher sheet.
//  - Progress is saved to the sheet (through the Apps Script web app) AND on this device.
//  - Every write goes into a small queue on the device first, then is sent. If the network is down or the script is
//    busy, the queue keeps it and sends it later, so nothing is lost and play never waits on the network.
//  - No names, passcodes or other personal details are stored or sent: only the code and game progress.

import { CONFIG } from './config.js';

const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;   // no I, O, 0 or 1

/** "k7m-2qx" -> "K7M2QX". Returns null if it is not a valid code shape. */
export function normalizeCode(raw) {
  const code = String(raw == null ? '' : raw).toUpperCase().replace(/[\s-]/g, '');
  return CODE_RE.test(code) ? code : null;
}

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
  };
}

function browserStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return memoryStorage();
    s.setItem('gw_probe', '1');
    s.removeItem('gw_probe');
    return s;
  } catch (e) {
    return memoryStorage();   // storage blocked (private mode): still works for this visit
  }
}

function readJson(storage, key, fallback) {
  try {
    const text = storage.getItem(key);
    return text ? JSON.parse(text) : fallback;
  } catch (e) {
    return fallback;
  }
}

/**
 * Makes a store. Everything is injectable so tests can run without a network:
 *   endpoint, fetchImpl, storage, sleep, random, now, timeoutMs
 */
export function createStore(options = {}) {
  const endpoint = options.endpoint !== undefined ? options.endpoint : CONFIG.SHEET_ENDPOINT;
  const fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  const storage = options.storage || browserStorage();
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const random = options.random || Math.random;
  const now = options.now || (() => new Date().toISOString());
  const timeoutMs = options.timeoutMs || 8000;
  const flushing = {};

  const localKey = (code) => `gw_progress_${code}`;
  const queueKey = (code) => `gw_queue_${code}`;
  const readLocal = (code) => readJson(storage, localKey(code), null);
  const writeLocal = (code, value) => { try { storage.setItem(localKey(code), JSON.stringify(value)); } catch (e) { /* full: ignore */ } };
  const readQueue = (code) => readJson(storage, queueKey(code), []);
  const writeQueue = (code, q) => { try { storage.setItem(queueKey(code), JSON.stringify(q)); } catch (e) { /* full: ignore */ } };

  async function call(url, init) {
    if (!fetchImpl || !endpoint) throw new Error('offline');
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const res = await fetchImpl(url, Object.assign({}, init, controller ? { signal: controller.signal } : {}));
      if (!res.ok) throw new Error(`http_${res.status}`);
      return await res.json();          // an HTML error page throws here and counts as "unreachable"
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // Sends one queued item. Returns 'sent', 'drop' (will never succeed, discard) or 'retry' (try again later).
  async function send(code, item) {
    const body = JSON.stringify(Object.assign({}, item, { student_code: code }));
    for (let attempt = 0; attempt < 3; attempt++) {
      let res;
      try {
        res = await call(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
      } catch (e) {
        return 'retry';
      }
      if (res && res.ok) return 'sent';
      if (res && (res.error === 'busy' || res.error === 'server_error')) {
        await sleep(400 + Math.floor(random() * 1200));   // spread out a whole class hitting save together
        continue;
      }
      return 'drop';   // bad_code, bad_type, progress_size, bad_json: retrying cannot help
    }
    return 'retry';
  }

  /** Sends whatever is waiting for this code, oldest first. Safe to call any time. */
  function flushQueue(code) {
    if (flushing[code]) return flushing[code];
    flushing[code] = (async () => {
      for (;;) {
        let q = readQueue(code);
        if (!q.length) break;
        if (q[0].type === 'save') {
          const lastSave = q.map((i) => i.type).lastIndexOf('save');
          if (lastSave > 0) { q = q.filter((i, idx) => i.type !== 'save' || idx === lastSave); writeQueue(code, q); }
        }
        const outcome = await send(code, q[0]);
        if (outcome === 'retry') break;
        const current = readQueue(code);        // re-read: more may have been added while sending
        current.shift();
        writeQueue(code, current);
      }
      return { pending: readQueue(code).length };
    })().then((r) => { delete flushing[code]; return r; }, (e) => { delete flushing[code]; throw e; });
    return flushing[code];
  }

  function enqueue(code, item) {
    const q = readQueue(code);
    q.push(item);
    writeQueue(code, q);
  }

  function parseProgress(text) {
    if (text && typeof text === 'object') return text;
    try {
      const value = JSON.parse(text);
      return value && typeof value === 'object' ? value : null;
    } catch (e) {
      return null;
    }
  }

  return {
    normalizeCode,

    /**
     * Signs a code in. Resolves to one of:
     *   { ok: true, source: 'sheet' | 'device', open: [8 booleans], fullAccess, progress | null }
     *   { ok: false, error: 'bad_code' }   the code is not in the sheet
     *   { ok: false, error: 'offline' }    cannot reach the sheet and this device has never seen the code
     */
    async loadStudent(code) {
      let cloud = null;
      try {
        cloud = await call(`${endpoint}?action=load&code=${encodeURIComponent(code)}`);
      } catch (e) {
        cloud = null;
      }
      if (cloud && cloud.ok === false) {
        if (cloud.error === 'bad_code') return { ok: false, error: 'bad_code' };
        cloud = null;                      // server_error and friends: treat like unreachable
      }
      const local = readLocal(code);
      if (!cloud) {
        if (!local) return { ok: false, error: 'offline' };
        return { ok: true, source: 'device', open: local.open || [], fullAccess: Boolean(local.fullAccess), progress: local.progress || null };
      }
      let progress = parseProgress(cloud.progress);
      // The device copy wins when it holds saves that never reached the sheet.
      if (local && local.progress && (!progress || String(local.progress.savedAt || '') > String(progress.savedAt || ''))) {
        progress = local.progress;
        if (!readQueue(code).some((i) => i.type === 'save')) enqueue(code, { type: 'save', progress });
      }
      const open = Array.isArray(cloud.open) ? cloud.open : [];
      writeLocal(code, { open, fullAccess: Boolean(cloud.full_access), progress });
      await flushQueue(code);
      return { ok: true, source: 'sheet', open, fullAccess: Boolean(cloud.full_access), progress };
    },

    /** Saves progress. The device copy is written immediately; the sheet copy is sent in the background. */
    saveProgress(code, progress) {
      const stamped = Object.assign({}, progress, { savedAt: now() });
      const local = readLocal(code) || {};
      writeLocal(code, Object.assign({}, local, { progress: stamped }));
      enqueue(code, { type: 'save', progress: stamped });
      return flushQueue(code);
    },

    /** Records one finished game for the teacher's Results tab. */
    logResult(code, result) {
      enqueue(code, Object.assign({ type: 'result' }, result));
      return flushQueue(code);
    },

    flushQueue,
    pendingCount: (code) => readQueue(code).length,

    // The last code used on this device, so students do not retype it every day. Not secret.
    getActiveCode: () => normalizeCode(storage.getItem('gw_active_code')),
    setActiveCode: (code) => { try { storage.setItem('gw_active_code', code); } catch (e) { /* ignore */ } },
    clearActiveCode: () => { try { storage.removeItem('gw_active_code'); } catch (e) { /* ignore */ } },
  };
}

// The store the games use. Tests build their own with createStore({...}).
export const progressStore = createStore();
