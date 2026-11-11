// Station Mode: classroom stations with no sign-in.
//
// Open any page with ?station in the address and the whole tab becomes a station:
//   index.html?station                               the Super Map, every built town and building open
//   towns/topic-3-expression-town/?station          just that town, every building open, no way out to the Super Map
//   ...?station=off                                  back to normal sign-in in this tab
// Nothing is saved to the Google Sheet and nothing counts toward any student's real progress. Stars earned at a
// station last only until the tab is closed (they live in sessionStorage), so the next student starts fresh.
// The links are hidden, not locked: anyone with a link can open every building.

export const STATION_CODE = 'STATION';          // has an I and an O, so it can never be a real student code
const KEY = 'gw_station';

function session() {
  try { return globalThis.sessionStorage || null; } catch (e) { return null; }
}

/** The station this tab is in: { scope: 'world' | '<town id>' }, or null for normal sign-in. */
export function getStation(storage = session()) {
  try {
    const s = storage && JSON.parse(storage.getItem(KEY));
    return s && s.scope ? s : null;
  } catch (e) { return null; }
}

/**
 * Called by each page as it starts. `scope` is 'world' for the Super Map or the town's id for a town page.
 * ?station turns station mode on for this tab (scope = this page); ?station=off turns it off; otherwise
 * whatever the tab already is stays as it is (a world station keeps going when the student walks into a town).
 */
export function startStation(scope, { search = globalThis.location ? globalThis.location.search : '', storage = session() } = {}) {
  const q = new URLSearchParams(search);
  if (!q.has('station')) return getStation(storage);
  if (q.get('station') === 'off') { try { storage && storage.removeItem(KEY); } catch (e) { /* ignore */ } return null; }
  const st = { scope };
  try { storage && storage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage blocked: still works on this page */ }
  return st;
}

/** Is this town page a town-only station (students cannot walk out to the Super Map)? */
export const lockedToTown = (st, townId) => Boolean(st && st.scope === townId);
