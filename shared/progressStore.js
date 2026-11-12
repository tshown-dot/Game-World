// Student sign-in, progress saving and results for every town in Game World.
//
// How it works
//  - A student types the 6-character code from their sticky note. The code is checked against the teacher sheet.
//  - Progress is saved to the sheet (through the Apps Script web app) AND on this device.
//  - Every write goes into a small queue on the device first, then is sent. If the network is down or the script is
//    busy, the queue keeps it and sends it later, so nothing is lost and play never waits on the network.
//  - No names, passcodes or other personal details are stored or sent: only the code and game progress.

import { CONFIG } from './config.js';
import { STATION_CODE, getStation } from './station.js';

const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;   // no I, O, 0 or 1

/** "k7m-2qx" -> "K7M2QX". Returns null if it is not a valid code shape. */
export function normalizeCode(raw) {
  const code = String(raw == null ? '' : raw).toUpperCase().replace(/[\s-]/g, '');
  if (code === STATION_CODE && getStation()) return STATION_CODE;   // station mode only (see shared/station.js)
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
  // Station mode (shared/station.js): no sign-in, everything open, nothing sent to the sheet.
  const inStation = options.inStation || (() => Boolean(getStation()));
  const stationStorage = options.stationStorage || (() => { try { return globalThis.sessionStorage || memoryStorage(); } catch (e) { return memoryStorage(); } })();
  const STATION_KEY = 'gw_station_progress';
  const isStation = (code) => code === STATION_CODE;
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

  const api = {
    normalizeCode,

    /**
     * Signs a code in. Resolves to one of:
     *   { ok: true, source: 'sheet' | 'device', open: [booleans in TOWNS order], fullAccess, progress | null }
     *   { ok: false, error: 'bad_code' }   the code is not in the sheet
     *   { ok: false, error: 'offline' }    cannot reach the sheet and this device has never seen the code
     */
    /**
     * Signs a code in. With { fast: true } and a copy already on this device, answers at once from that copy
     * (no waiting on the sheet), then checks the sheet in the background and calls onFresh(result) when it answers.
     * Without a device copy it always waits for the sheet (a code's first sign-in on a device needs the internet).
     */
    loadStudent(code, { fast = false, onFresh = null } = {}) {
      if (isStation(code)) {                                // a classroom station: every town open, this tab's stars only
        return Promise.resolve({ ok: true, source: 'station', open: Array(16).fill(true), fullAccess: true, progress: readJson(stationStorage, STATION_KEY, null) });
      }
      const local = fast ? readLocal(code) : null;
      if (!local) return api.loadFromSheet(code);
      const fresh = api.loadFromSheet(code);
      fresh.then((res) => { if (onFresh) onFresh(res); }).catch(() => {});
      return Promise.resolve({ ok: true, source: 'device', open: local.open || [], fullAccess: Boolean(local.fullAccess), progress: local.progress || null, fresh });
    },

    async loadFromSheet(code) {
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
      if (isStation(code)) {                                // kept only until the tab closes; never sent anywhere
        try { stationStorage.setItem(STATION_KEY, JSON.stringify(stamped)); } catch (e) { /* ignore */ }
        return Promise.resolve({ pending: 0 });
      }
      const local = readLocal(code) || {};
      writeLocal(code, Object.assign({}, local, { progress: stamped }));
      enqueue(code, { type: 'save', progress: stamped });
      return flushQueue(code);
    },

    /** Records one finished game for the teacher's Results tab. */
    logResult(code, result) {
      if (isStation(code)) return Promise.resolve({ pending: 0 });   // station play is not recorded
      enqueue(code, Object.assign({ type: 'result' }, result));
      return flushQueue(code);
    },

    flushQueue: (code) => (isStation(code) ? Promise.resolve({ pending: 0 }) : flushQueue(code)),
    hasDeviceCopy: (code) => isStation(code) || Boolean(readLocal(code)),
    pendingCount: (code) => (isStation(code) ? 0 : readQueue(code).length),
    isStation: () => inStation(),

    // The last code used on this device, so students do not retype it every day. Not secret.
    // In station mode the "code" is always STATION and the real remembered code is left alone.
    getActiveCode: () => (inStation() ? STATION_CODE : normalizeCode(storage.getItem('gw_active_code'))),
    setActiveCode: (code) => { if (isStation(code)) return; try { storage.setItem('gw_active_code', code); } catch (e) { /* ignore */ } },
    clearActiveCode: () => { if (inStation()) return; try { storage.removeItem('gw_active_code'); } catch (e) { /* ignore */ } },
  };
  return api;
}

// The store the games use. Tests build their own with createStore({...}).
export const progressStore = createStore();
