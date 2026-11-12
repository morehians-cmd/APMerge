/*****************************************************************************
 MOREH ACADEMY PORTAL - SPEED BUNDLE (new file "Speed")
 Stops requests from re-reading whole sheets. Replaces sh_ (delete the old one in Code.gs).
*****************************************************************************/

const SHM_ = {};   // sheet objects, remembered for one request only

/** REPLACES sh_ in Code.gs. Same behaviour, but the header row is written only when needed (checked once per 6 hours). */
function sh_(k) {
  if (SHM_[k]) return SHM_[k];
  const ss = SpreadsheetApp.getActiveSpreadsheet(), name = k==='S'?'Students':'Users', h = k==='S'?COLS:UCOLS, cache = CacheService.getScriptCache(), fk = 'hd_' + k + h.length;
  let sh = ss.getSheetByName(name);
  if (!sh || !cache.get(fk)) {
    if (!sh) { sh = ss.insertSheet(name); sh.setFrozenRows(1); if (sh.getMaxColumns()<h.length) sh.insertColumnsAfter(sh.getMaxColumns(), h.length-sh.getMaxColumns()); sh.getRange(1,1,sh.getMaxRows(),h.length).setNumberFormat('@'); }
    else if (sh.getLastColumn() < h.length) { const from = sh.getLastColumn()+1; if (sh.getMaxColumns()<h.length) sh.insertColumnsAfter(sh.getMaxColumns(), h.length-sh.getMaxColumns()); sh.getRange(1,from,sh.getMaxRows(),h.length-from+1).setNumberFormat('@'); }
    sh.getRange(1,1,1,h.length).setValues([h]).setFontWeight('bold');
    cache.put(fk, '1', 21600);
  }
  return SHM_[k] = sh;
}


/** Finds ONE record by a column value without loading the sheet. Returns { r:rowNumber, o:record } or null. */
function findRow_(k, field, value) {
  const sh = sh_(k), n = sh.getLastRow() - 1, h = k === 'S' ? COLS : UCOLS;
  if (n < 1 || !value) return null;
  const i = sh.getRange(2, h.indexOf(field) + 1, n, 1).getValues().flat().map(String).indexOf(String(value));
  if (i < 0) return null;
  const v = sh.getRange(i + 2, 1, 1, h.length).getValues()[0], o = {};
  h.forEach((f, j) => o[f] = String(v[j]));
  return { r:i + 2, o:o };
}
const userRow_ = username => { const x = findRow_('U', 'Username', String(username || '').toLowerCase()); return x ? { r:x.r, u:x.o } : null; };

/* ---------- per-user cache (safe: any write to the Users sheet changes the version and drops every cached user) ---------- */
function uvGet_() { const c = CacheService.getScriptCache(); let v = c.get('uv'); if (!v) { v = Utilities.getUuid(); c.put('uv', v, 21600); } return v; }
function uvBump_() { try { CacheService.getScriptCache().put('uv', Utilities.getUuid(), 21600); } catch (_) {} }
/** Used by who_. The cached copy never contains the password hash. */
function userCached_(username) {
  const cache = CacheService.getScriptCache(), uv = uvGet_(), k = 'ur_' + username, raw = cache.get(k);
  if (raw) { try { const o = JSON.parse(raw); if (o.v === uv) return o.u; } catch (_) {} }
  const hit = userRow_(username); if (!hit) return null;
  const u = Object.assign({}, hit.u, { PasswordHash:'' });
  try { cache.put(k, JSON.stringify({ v:uv, u:u }), 300); } catch (_) {}
  return u;
}

/** Records "student.view" at most once per hour per staff member and learner (a sheet write on every open is slow). */
function auditView_(u, id) {
  try { const c = CacheService.getScriptCache(), k = 'av_' + u.Username + '_' + id; if (c.get(k)) return; c.put(k, '1', 3600); audit_(u, 'student.view', id, ''); }
  catch (e) { Logger.log(e.message); }
}

/** OWNER ONLY. How full are Script Properties? (limit is about 500 KB) */
function propsUsage() {
  ownerOnly_();
  const all = PropertiesService.getScriptProperties().getProperties(), by = {}; let bytes = 0;
  Object.keys(all).forEach(k => { const n = k.length + String(all[k]).length, p = (k.match(/^[a-z]+_/) || ['other'])[0]; bytes += n; by[p] = (by[p] || 0) + n; });
  Logger.log('Keys: ' + Object.keys(all).length + ', about ' + Math.round(bytes / 1024) + ' KB of 500 KB.\nBy prefix (bytes): ' + JSON.stringify(by));
}

/* ---------- compact learner cache (search, dashboard, notification bell) ---------- */
const LITE_F = ['StudentID','FullName','LRN','GradeLevel','Section','EnrollStatus','SchoolYear','CreatedAt','Cluster','ReqConsent','TempUntil'], LITE_CHUNK = 60000, LITE_TTL = 600;
const stGet_ = () => { const c = CacheService.getScriptCache(); let v = c.get('stv'); if (!v) { v = Utilities.getUuid(); c.put('stv', v, 21600); } return v; };
const stBump_ = () => { try { CacheService.getScriptCache().put('stv', Utilities.getUuid(), 21600); } catch (_) {} };

/** Returns the cached list (arrays) or null. Never rebuilds. */
function litePeek_() {
  const c = CacheService.getScriptCache(), v = stGet_(), n = parseInt(c.get('stl_' + v) || '0', 10);
  if (!n) return null;
  const keys = []; for (let i = 0; i < n; i++) keys.push('stl_' + v + '_' + i);
  const got = c.getAll(keys);
  if (!keys.every(k => got[k] != null)) return null;
  try { return JSON.parse(keys.map(k => got[k]).join('')); } catch (_) { return null; }
}
/** Returns the list, rebuilding from the sheet on a miss. A rebuild is discarded if a write happened while it was reading. */
function liteArr_() {
  const hit = litePeek_(); if (hit) return hit;
  const v = stGet_(), arr = rows_('S').map(r => LITE_F.map(f => r[f])), s = JSON.stringify(arr), put = {}; let n = 0;
  for (let i = 0; i < s.length; i += LITE_CHUNK) put['stl_' + v + '_' + (n++)] = s.slice(i, i + LITE_CHUNK);
  put['stl_' + v] = String(n);
  if (stGet_() === v) { try { CacheService.getScriptCache().putAll(put, LITE_TTL); } catch (e) { Logger.log('lite cache: ' + e.message); } }
  return arr;
}
const studentsLite_ = () => liteArr_().map(a => { const o = {}; LITE_F.forEach((f, i) => o[f] = a[i]); return o; });

/** Same return shape as findRow_('S', 'StudentID', id): { r:row, o:record }. */
function findStudent_(id) {
  id = String(id || '');
  const arr = litePeek_(), i = arr ? arr.findIndex(a => a[0] === id) : -1;
  if (i >= 0) {
    const v = sh_('S').getRange(i + 2, 1, 1, COLS.length).getValues()[0];
    if (String(v[0]) === id) { const o = {}; COLS.forEach((f, j) => o[f] = String(v[j])); return { r:i + 2, o:o }; }
  }
  return findRow_('S', 'StudentID', id);
}

/** Values of ONE column of the Students sheet, as strings. Index i = sheet row i + 2. */
function colVals_(field) {
  const sh = sh_('S'), n = sh.getLastRow() - 1;
  return n < 1 ? [] : sh.getRange(2, COLS.indexOf(field) + 1, n, 1).getValues().flat().map(String);
}

/** Next Enrollment ID for a school year. Reads ONE column (same format as nextIdV2_). */
function nextIdFast_(sh, sy) {
  const p = SCHOOL_ID + '-' + String(sy).slice(0, 4) + '-', n = sh.getLastRow() - 1; let max = 0;
  if (n >= 1) sh.getRange(2, 1, n, 1).getValues().forEach(r => {
    const s = String(r[0]); if (s.indexOf(p) === 0) max = Math.max(max, parseInt(s.slice(p.length), 10) || 0);
  });
  return p + String(max + 1).padStart(4, '0');
}

/** OWNER ONLY. Measures the cache. */
function speedTest3() {
  ownerOnly_(); stBump_(); const t = f => { const a = Date.now(); f(); return Date.now() - a; };
  const miss = t(() => studentsLite_()), hit = t(() => studentsLite_()), id = String(sh_('S').getRange(2, 1).getValue()), one = t(() => findStudent_(id));
  Logger.log('Rebuild (cache miss): ' + miss + ' ms\nCache hit: ' + hit + ' ms\nFind one learner (cache + 1 row): ' + one + ' ms');
}

/** True if another row already uses this LRN. Reads ONE column. exceptRow = sheet row of the record being saved (0 for a new record). */
function lrnTaken_(sh, lrn, exceptRow) {
  const n = sh.getLastRow() - 1; if (n < 1) return false;
  const v = sh.getRange(2, COLS.indexOf('LRN') + 1, n, 1).getValues();
  for (let i = 0; i < n; i++) if (String(v[i][0]) === lrn && i + 2 !== exceptRow) return true;
  return false;
}

function saveTimeTest() {
  ownerOnly_();
  const id = String(sh_('S').getRange(2, 1).getValue()), rec = findStudent_(id).o;
  const tok = Utilities.getUuid(), u = userRow_(OWNER_USER).u;
  putSession_(tok, u);
  const t = Date.now(), r = saveStudent(tok, rec);
  Logger.log((r.success ? 'OK ' : 'FAIL ' + r.error) + ' in ' + (Date.now() - t) + ' ms');
}

function saveProfile() {
  ownerOnly_();
  const T = [], lap = (n, t0) => T.push(n + ': ' + (Date.now() - t0) + ' ms');
  let t = Date.now();
  const sh = sh_('S'); lap('sh_', t);
  t = Date.now(); const id = String(sh.getRange(2, 1).getValue()); lap('read id', t);
  t = Date.now(); const hit = findStudent_(id); lap('findStudent_', t);
  t = Date.now(); colVals_('LRN'); lap('colVals_ LRN', t);
  t = Date.now(); put_(sh, hit.r, 1, [COLS.map(c => hit.o[c] || '')]); lap('put_ (1 row)', t);
  t = Date.now(); audit_('profile', 'test', id, ''); lap('audit_', t);
  t = Date.now(); const u = userRow_(OWNER_USER).u; lap('userRow_', t);
  t = Date.now(); decorate_(Object.assign({}, hit.o), u); lap('decorate_', t);
  const tok = Utilities.getUuid(); putSession_(tok, u);
  t = Date.now(); who_(tok); lap('who_', t);
  Logger.log(T.join('\n'));
}


