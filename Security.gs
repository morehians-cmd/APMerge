/*****************************************************************************
 MOREH ACADEMY PORTAL - SECURITY PATCH SET (for Code.gs v2.1 + Index.html)

 WHAT THIS COVERS
   1. Default admin / public setup()+tmpAuth()      -> owner-only, random password
   2. Password hashing                              -> per-user salt + secret pepper + iterated HMAC, upgrade-on-login
   3. Spreadsheet formula injection                 -> text format on EVERY write, input checks, CSV neutralising
   4. Session versioning                            -> revoke sessions on credential change, sliding TTL, forced password change

 HOW TO APPLY (order matters)
   A. In Code.gs: DELETE the old  setup, tmpAuth, hash_, addUser_, who_, pub_, login,
      saveMyProfile, resetPassword, resetStaffPassword, removeStaff  and the old  UCOLS  line.
      Paste PART 1 and PART 2 below in their place.
   B. Apply the small EDITS in PART 3 (find/replace in the existing functions).
   C. Apply the client edits in PART 4 (Index.html).
   D. In the Apps Script editor run, in this order:
        1) initSecurity      (creates the secret pepper; approve any new permission prompt)
        2) auditSecurity     (read the log: default password, formula cells, legacy hash count)
        3) ownerResetAdmin   (only if audit reports the default admin password)
        4) authorizeAll      (replaces tmpAuth; then it is safe to leave in)
   E. Deploy > Manage deployments > New version.  Everyone is signed out once.
      Old SHA-256 hashes upgrade automatically the next time each user signs in.
      When auditSecurity reports "legacy hashes: 0", delete SALT and legacyHash_.

 IMPORTANT
   - The PEPPER lives in Script Properties. Back it up (Project Settings > Script Properties).
     If it is lost, every v2 password must be reset. Anyone with script-editor access can read it,
     so keep the editor list short.
   - Functions without a trailing underscore are callable from any browser. The owner-only
     functions below refuse to run unless the caller IS the script owner (editor run).
*****************************************************************************/


/* ========================= PART 1: HELPERS ========================= */

// Replaces the old UCOLS line. MustChange is appended LAST so existing columns never shift.
const UCOLS = ['Username','PasswordHash','Role','FullName','Designation','Department','Clearance','Email','StudentID','PhotoID','MustChange','Locked','Disabled','AfterHrs'];

const EMAIL_RE   = /^[A-Za-z0-9][A-Za-z0-9._%+\-]*@[A-Za-z0-9][A-Za-z0-9.\-]*\.[A-Za-z]{2,}$/;
const DEFAULT_PW = 'ChangeMe123';
const OWNER_USER = 'admin';          // username of the main administrator
const HASH_ITER  = 1000;             // run benchmarkHash(); aim for roughly <= 150 ms per hash
const SESS_IDLE  = { admin:1800, student:3600 };   // sliding idle timeout, seconds
const SESS_ABS_MS = 8 * 3600 * 1000;               // absolute session cap

/** Refuses anyone except the script owner running from the editor. */
function ownerOnly_() {
  let a = ''; try { a = Session.getActiveUser().getEmail(); } catch (_) {}
  if (!a || a !== Session.getEffectiveUser().getEmail()) throw new Error('Owner only.');
}

const tempPw_ = () => Utilities.getUuid().replace(/-/g, '').slice(0, 12) + '#A1';

/** Write rows as PLAIN TEXT (stops =, +, -, @ values being evaluated as formulas) and grow the sheet if needed. */
function put_(sh, row, col, rows) {
  const need = row + rows.length - 1;
  if (need > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows() + 200);
  const rg = sh.getRange(row, col, rows.length, rows[0].length);
  try { rg.setNumberFormat('@'); } catch (e) { /* typed (table) column: Sheets fixes the format, write the value anyway */ }
  rg.setValues(rows);
  if (sh.getName() === 'Users') uvBump_();
  if (sh.getName() === 'Students') stBump_();
}

/* ---------- password hashing: v2$iterations$salt$base64 ---------- */
function pepper_() {
  const p = PropertiesService.getScriptProperties().getProperty('PEPPER');
  if (!p) throw new Error('Security not initialised. Owner: run initSecurity() once in the script editor.');
  return p;
}
function kdf_(p, salt, iter) {
  const key = Utilities.newBlob(pepper_() + salt).getBytes();
  let h = Utilities.computeHmacSha256Signature(Utilities.newBlob(String(p)).getBytes(), key);
  for (let i = 1; i < iter; i++) h = Utilities.computeHmacSha256Signature(h, key);
  return Utilities.base64Encode(h);
}
const legacyHash_ = p => Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, SALT + p));
const isLegacy_ = h => !/^v2\$/.test(String(h || ''));
function hash_(p) {
  const salt = Utilities.getUuid();
  return 'v2$' + HASH_ITER + '$' + salt + '$' + kdf_(p, salt, HASH_ITER);
}
function safeEq_(a, b) {
  a = String(a); b = String(b); let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
function verify_(p, stored) {
  stored = String(stored || '');
  if (stored.indexOf('v2$') === 0) { const a = stored.split('$'); return a.length === 4 && safeEq_(kdf_(p, a[2], parseInt(a[1], 10) || HASH_ITER), a[3]); }
  return safeEq_(legacyHash_(String(p)), stored);
}

/* ---------- users ---------- */
function addUser_(username, password, role, fullName, studentId, email, mustChange, designation, clearance, department) {
  const sh = sh_('U'), un = String(username).toLowerCase();
  if (rows_('U').some(u => u.Username === un)) throw new Error('User exists');
  const o = { Username:un, PasswordHash:(password && password.hash) ? password.hash : hash_(password), Role:role, FullName:fullName || '',
    Designation:designation || (role === 'admin' ? 'Administrator' : 'Student'), Department:String(department || '').trim().slice(0, 60),
    Clearance:clearance || (role === 'admin' ? 'Full' : 'Limited'), Email:email || '', StudentID:studentId || '', PhotoID:'', MustChange:mustChange ? '1' : '' };
  put_(sh, sh.getLastRow() + 1, 1, [UCOLS.map(c => o[c])]);
}
function pub_(u) {
  return { Username:u.Username, Role:u.Role, FullName:u.FullName, Designation:u.Designation, Department:u.Department, Clearance:u.Clearance,
    Email:u.Email || ((findRow_('S', 'StudentID', u.StudentID) || {}).o || {}).Email || '', StudentID:u.StudentID, Photo:photo_(u.PhotoID), MustChange:u.MustChange || '' };
}

/* ---------- sessions (versioned, sliding) ---------- */
const svGet_ = un => parseInt(PropertiesService.getScriptProperties().getProperty('sv_' + un) || '0', 10);
const bumpSV_ = un => PropertiesService.getScriptProperties().setProperty('sv_' + un, String(svGet_(un) + 1));
function putSession_(token, u, issuedAt) {
  CacheService.getScriptCache().put('s_' + token, JSON.stringify({ u:u.Username, v:svGet_(u.Username), i:issuedAt || Date.now() }), SESS_IDLE[u.Role] || 1800);
}
/** allowMustChange: only saveMyProfile passes true, so a flagged user can do nothing but change their password. */
function who_(token, role, allowMustChange) {
  const cache = CacheService.getScriptCache(), raw = cache.get('s_' + token), expired = new Error('Session expired. Please sign in again.');
  let s = null; try { s = raw && JSON.parse(raw); } catch (_) {}
  if (!s || !s.u || Date.now() - s.i > SESS_ABS_MS) throw expired;
  if (s.v !== svGet_(s.u)) { cache.remove('s_' + token); throw expired; }
  const u = userCached_(s.u);
  if (!u) { cache.remove('s_' + token); throw expired; }
  if (role && u.Role !== role) throw new Error('Not allowed.');
  if (role === 'admin' && (OFFICE_CL.indexOf(u.Clearance) >= 0 || ACAD_ROLES.indexOf(u.Clearance) >= 0)) throw new Error('Not allowed.');   // office accounts reach only the Holds functions
  if (u.MustChange === '1' && !allowMustChange) throw new Error('Please set a new password under My Profile to continue.');
  putSession_(token, u, s.i);          // sliding expiry
  return u;
}


/* ===================== PART 2: REPLACEMENT FUNCTIONS ===================== */

/** OWNER ONLY. Creates the pepper once. Safe to re-run (never overwrites). */
function initSecurity() {
  ownerOnly_();
  const pr = PropertiesService.getScriptProperties();
  if (!pr.getProperty('PEPPER')) { pr.setProperty('PEPPER', Utilities.getUuid() + Utilities.getUuid()); Logger.log('PEPPER created. Back it up from Project Settings > Script Properties.'); }
  else Logger.log('PEPPER already exists. Nothing changed.');
  sh_('S'); sh_('U'); logSh_();
}

/** OWNER ONLY (no longer callable from the browser). No more ChangeMe123: random one-time password, forced change. */
function setup() {
  ownerOnly_(); initSecurity();
  if (!rows_('U').some(u => u.Role === 'admin')) {
    const pw = tempPw_(); addUser_(OWNER_USER, pw, 'admin', 'School Administrator', '', '', true);
    Logger.log('Admin created. Username: ' + OWNER_USER + '  Temporary password: ' + pw + '  (shown once; you must change it at first sign-in)');
  } else Logger.log('An admin already exists. Nothing created.');
}

/** OWNER ONLY. Use if auditSecurity() reports the default password, or the owner is locked out. */
function ownerResetAdmin() {
  ownerOnly_();
  const users = rows_('U'), i = users.findIndex(u => u.Username === OWNER_USER); if (i < 0) throw new Error('User "' + OWNER_USER + '" not found.');
  const pw = tempPw_(), sh = sh_('U');
  put_(sh, i + 2, 2, [[hash_(pw)]]); put_(sh, i + 2, UCOLS.indexOf('MustChange') + 1, [['1']]); bumpSV_(OWNER_USER);
  Logger.log('Reset. Username: ' + OWNER_USER + '  Temporary password: ' + pw + '  (shown once; change it at first sign-in)');
}

/** OWNER ONLY. Read the Logger output. */
function auditSecurity() {
  ownerOnly_(); const out = []; let legacy = 0;
  rows_('U').forEach(u => {
    if (isLegacy_(u.PasswordHash)) legacy++;
    if (verify_(DEFAULT_PW, u.PasswordHash)) out.push('CRITICAL: "' + u.Username + '" still uses the default password.');
  });
  out.push('Legacy (SHA-256) hashes remaining: ' + legacy);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ['Students', 'Users', 'Status Log', 'Events', 'Scholarships'].forEach(name => {
    const sh = ss.getSheetByName(name); if (!sh || sh.getLastRow() < 1) return;
    const rg = sh.getDataRange(), F = rg.getFormulas(), V = rg.getValues();
    F.forEach((row, ri) => row.forEach((f, ci) => {
      const v = String(V[ri][ci]);
      if (f || /^[=@\t\r]/.test(v)) out.push('REVIEW: ' + name + '!R' + (ri + 1) + 'C' + (ci + 1) + ' looks like a formula: ' + (f || v).slice(0, 80));
    }));
  });
  Logger.log(out.join('\n')); return out;
}

/** OWNER ONLY. Pick HASH_ITER so one hash takes about 100-150 ms. */
function benchmarkHash() {
  ownerOnly_(); pepper_(); const t = Date.now(); for (let i = 0; i < 5; i++) hash_('benchmark-password');
  Logger.log('Average per hash at ' + HASH_ITER + ' iterations: ' + Math.round((Date.now() - t) / 5) + ' ms');
}

/** OWNER ONLY. Replaces tmpAuth (delete tmpAuth). Run once so the new version is authorised. */
function authorizeAll() {
  ownerOnly_();
  SpreadsheetApp.getActiveSpreadsheet().getName();
  DriveApp.getFolderById(PHOTO_FOLDER_ID).getName();
  Logger.log('Mail quota left: ' + MailApp.getRemainingDailyQuota());
  CacheService.getScriptCache().get('x'); PropertiesService.getScriptProperties().getKeys(); LockService.getScriptLock();
}

/** p = {email, newPassword, photo}. Locked; clears MustChange; revokes OTHER sessions when the password changes. */
function saveMyProfile(token, p) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const u = who_(token, null, true), sh = sh_('U'), r = sh.getRange(1,1,sh.getLastRow(),1).getValues().flat().indexOf(u.Username)+1;
    const em = String(p.email || '').trim();
    if (u.Role === 'admin' && u.Clearance !== 'Full' && !em) throw new Error('Encoders must keep a valid email address: sign-in codes are sent to it.');
    if (em && !EMAIL_RE.test(em)) throw new Error('Enter a valid email address.');
    if (em && rows_('U').some(x => x.Username !== u.Username && (x.Email || '').toLowerCase() === em.toLowerCase())) throw new Error('That email address is already used by another account.');
    const np = String(p.newPassword || '');
    if (u.MustChange === '1' && !np) throw new Error('You must set a new password to continue.');
    if (np) {
      if (np.length < 8) throw new Error('Password must be at least 8 characters.');
      if (np === DEFAULT_PW || np.toLowerCase() === u.Username) throw new Error('Choose a password that is harder to guess.');
    }
    put_(sh, r, UCOLS.indexOf('Email') + 1, [[em]]);
    if (np) {
      put_(sh, r, 2, [[hash_(np)]]);
      put_(sh, r, UCOLS.indexOf('MustChange') + 1, [['']]);
      bumpSV_(u.Username); putSession_(token, u); audit_(u, 'password.change', u.Username, '');   // old sessions die, this one continues
    }
    if (p.photo) {
      const blob = Utilities.newBlob(Utilities.base64Decode(String(p.photo).split(',')[1]), 'image/jpeg', u.Username + '_photo.jpg');
      const b = blob.getBytes();
      if (b.length > 2*1024*1024) throw new Error('Photo exceeds 2 MB.');
      if (!((b[0] & 255) === 0xFF && (b[1] & 255) === 0xD8)) throw new Error('Photo must be a JPEG image.');   // bytes are signed in Apps Script
      const f = DriveApp.getFolderById(PHOTO_FOLDER_ID).createFile(blob);
      const old = u.PhotoID;
      put_(sh, r, UCOLS.indexOf('PhotoID') + 1, [[f.getId()]]);                                            // save the new id first
      if (old) { try { DriveApp.getFileById(old).setTrashed(true); } catch (_) {} }                         // then trash the old photo
    }
    return ok(pub_(rows_('U').find(x => x.Username === u.Username)), 'Profile saved');
  } catch(e) { return fail(e); } finally { try { lock.releaseLock(); } catch(_) {} }
}

/** Same checks as before; now also revokes sessions and clears MustChange. A STUDENT who types RESET_CODE_TRIES wrong codes is locked. */
function resetPassword(identifier, code, newPassword) {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(5000)) throw new Error('The service is busy. Please try again.');
    const key = String(identifier||'').trim().toLowerCase(), c = String(code||'').trim(), pw = String(newPassword||'');
    if (!key || !c) throw new Error('Enter your username or email and the 6-digit code.');
    if (pw.length < 8 || pw === DEFAULT_PW) throw new Error('Password must be at least 8 characters.');
    const bad = new Error('Invalid or expired code. Please request a new one.');
    const users = rows_('U'), i = users.findIndex(x => x.Username===key || (x.Email||'').toLowerCase()===key);
    if (i < 0) throw bad;
    const cache = CacheService.getScriptCache(), ck = 'rc_'+users[i].Username, raw = cache.get(ck);
    if (!raw) throw bad;
    const rec = JSON.parse(raw);
    if (Date.now() > rec.exp) { cache.remove(ck); throw bad; }
    if (rec.h !== legacyOrV2Code_(c)) {
      rec.n++;
      const isStu = users[i].Role === 'student', limit = isStu ? RESET_CODE_TRIES : 5;   // staff are never locked out this way
      if (rec.n >= limit) {
        cache.remove(ck);
        if (isStu) {
          setLocked_(users[i].Username, true);
          audit_('self:' + users[i].Username, 'account.lock', users[i].StudentID, rec.n + ' wrong reset codes');
          throw new Error('Too many wrong codes. This account is now locked. Please visit the Admission Office for assistance.');
        }
      } else {
        cache.put(ck, JSON.stringify(rec), Math.max(1, Math.ceil((rec.exp-Date.now())/1000)));
      }
      throw bad;
    }
    const sh = sh_('U');
    put_(sh, i + 2, 2, [[hash_(pw)]]); put_(sh, i + 2, UCOLS.indexOf('MustChange') + 1, [['']]);
    bumpSV_(users[i].Username);                                  // every existing session for this user is revoked
    audit_(users[i].Username, 'password.reset', users[i].Username, 'via e-mail code');
    if (users[i].Role === 'student') resetCount_(users[i].Username);
    cache.remove(ck); cache.remove('fp_'+key);
    const to = users[i].Email || (users[i].Username.indexOf('@')>0 ? users[i].Username : '');
    if (to) { try { MailApp.sendEmail({ to:to, name:'Moreh Academy Admissions', subject:'Moreh Academy portal: your password was changed',
      body:'The password for "'+users[i].Username+'" was just changed using a reset code. If this was not you, contact the Admissions Office immediately.' }); } catch(_) {} }
    return ok(null, 'Password updated. You can now sign in.');
  } catch(e) { return fail(e); } finally { try { lock.releaseLock(); } catch(_) {} }
}
// The reset code is short-lived and already rate limited, so it keeps the cheap SHA-256 form used by forgotPassword().
// (forgotPassword stores hash_('RC'+code) in v1.  Because hash_ is now salted, use this helper in BOTH places, see PART 3.)
const rcHash_ = code => Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pepper_() + 'RC' + code));
const legacyOrV2Code_ = rcHash_;

function resetStaffPassword(token, username) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); const ou = sysOwner_(token);
    const users = rows_('U'), i = users.findIndex(u => u.Username === username && u.Role === 'admin');
    if (i < 0) throw new Error('User not found.'); if (users[i].Clearance === 'Full') throw new Error('The main administrator resets their own password under My Profile.');
    const pw = tempPw_(), sh = sh_('U');
    put_(sh, i + 2, 2, [[hash_(pw)]]); put_(sh, i + 2, UCOLS.indexOf('MustChange') + 1, [['1']]); bumpSV_(username);
    const em = users[i].Email; if (em) { try { MailApp.sendEmail({ to:em, name:'Moreh Academy Admissions', subject:'Moreh Academy portal: password reset', body:'Username: '+username+'\nTemporary password: '+pw+'\n\nYou will be asked to choose a new password when you sign in.' }); } catch(_) {} }
    audit_(ou, 'staff.reset', username, ''); alert_('reset:' + username, 'Staff password reset', ou.Username + ' reset the password of ' + username);
    return ok({ username:username, password:pw }, 'Password reset');
  } catch(e) { return fail(e); } finally { try { lock.releaseLock(); } catch(_) {} }
}

function removeStaff(token, username) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); const ou = sysOwner_(token);
    const users = rows_('U'), i = users.findIndex(u => u.Username === username && u.Role === 'admin');
    if (i < 0) throw new Error('User not found.'); if (users[i].Clearance === 'Full') throw new Error('The main administrator account cannot be removed.');
    bumpSV_(username); sh_('U').deleteRow(i + 2);
    audit_(ou, 'staff.remove', username, ''); alert_('rm:' + username, 'Staff account removed', ou.Username + ' removed ' + username);
    return ok(null, 'User removed');
  } catch(e) { return fail(e); } finally { try { lock.releaseLock(); } catch(_) {} }
}
