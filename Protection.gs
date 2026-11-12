/*****************************************************************************
 MOREH ACADEMY PORTAL - PROTECTION BUNDLE (add as a NEW file named "Protection" in the same project)
 Requires the earlier Security file (ownerOnly_, put_, safeEq_, pepper_, putSession_, pub_, verify_, ...).

 WHAT THIS ADDS
   1. Audit log        - "Audit" sheet: who did what, when (deletes, edits, staff changes, report views, logins)
   2. Alert emails     - to the script owner, throttled (lockouts, deletes, new staff, bulk changes, settings, backup failure)
   3. Daily backup     - private Drive folder, 30-day retention, plus a daily e-mailed digest (an off-sheet copy of the audit trail)
   4. Staff sign-in code - admins/Encoders must enter a 6-digit code e-mailed to them after the correct password
   5. Public mail cap  - registration / forgot-password cannot use up the mail quota the staff codes need

 HOW TO APPLY
   A. Add this file. DELETE the old `login` function from the Security file (the new `login` below replaces it).
   B. Make the edits in PART 3 (server) and PART 4 (Index.html).
   C. Run in the editor:  installBackupTrigger  (approve the new permission) ->  check the backup folder in Drive.
   D. Deploy a new version. Sign in as admin and confirm a "login" row appears in the Audit sheet.
   E. ONLY THEN run enableStaffOtp. Keep your first browser signed in while you test a second sign-in.
      If anything goes wrong with e-mail, run disableStaffOtp from the editor (break-glass).
*****************************************************************************/


/* ============================ PART 1: AUDIT + ALERTS ============================ */

const AUDIT_COLS = ['Date','Time','Actor','Role','Action','Target','Details'];
function auditSh_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); let sh = ss.getSheetByName('Audit');
  if (!sh) { sh = ss.insertSheet('Audit'); sh.getRange(1,1,1,AUDIT_COLS.length).setValues([AUDIT_COLS]).setFontWeight('bold'); sh.setFrozenRows(1); sh.getRange(1,1,sh.getMaxRows(),AUDIT_COLS.length).setNumberFormat('@'); }
  return sh;
}
const aClean_ = v => { v = String(v == null ? '' : v).slice(0, 300); return /^[=+\-@\t\r]/.test(v) ? ' ' + v : v; };   // leading space = never a formula

/** actor = user object (from who_/owner_) or a username string. Never throws. */
function audit_(actor, action, target, details) {
  try {
    const a = typeof actor === 'string' ? { Username:actor, Role:'' } : (actor || {}), d = new Date(), tz = Session.getScriptTimeZone();
    auditSh_().appendRow([Utilities.formatDate(d, tz, 'yyyy-MM-dd'), Utilities.formatDate(d, tz, 'HH:mm:ss'), a.Username || '', a.Role || '', action, target, details].map(aClean_));
  } catch (e) { Logger.log('audit: ' + e.message); }
}

/** E-mail the owner. Same key is sent at most once per hour. Never throws. */
function alert_(key, subject, body) {
  try {
    const cache = CacheService.getScriptCache(), k = 'al_' + String(key).slice(0, 80);
    if (cache.get(k)) return; cache.put(k, '1', 3600);
    MailApp.sendEmail({ to:Session.getEffectiveUser().getEmail(), subject:'[Moreh portal alert] ' + subject,
      body:String(body) + '\n\nTime: ' + new Date() + '\n\nReview the Audit sheet for details.' });
  } catch (e) { Logger.log('alert: ' + e.message); }
}


/* ============================ PART 2: BACKUP + DIGEST ============================ */

const BACKUP_KEEP_DAYS = 30;
function backupFolder_() {
  const pr = PropertiesService.getScriptProperties(), id = pr.getProperty('BACKUP_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (_) {} }
  const f = DriveApp.createFolder('Moreh Academy Portal Backups (PRIVATE - do not share)');
  pr.setProperty('BACKUP_FOLDER_ID', f.getId()); return f;
}
function doBackup_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), tz = Session.getScriptTimeZone(), folder = backupFolder_();
  DriveApp.getFileById(ss.getId()).makeCopy('Backup ' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HHmm') + ' - ' + ss.getName(), folder);
  const cutoff = Date.now() - BACKUP_KEEP_DAYS * 864e5, it = folder.getFiles();
  while (it.hasNext()) { const f = it.next(); if (f.getName().indexOf('Backup ') === 0 && f.getDateCreated().getTime() < cutoff) f.setTrashed(true); }
  const pr = PropertiesService.getScriptProperties(), today = 'pm_' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
  pr.setProperty('LAST_BACKUP', String(Date.now()));
  const dayS = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
  pr.getKeys().forEach(k => { const m = k.match(/^pm_(?:[a-z]+_)?(\d{8})$/); if (m && m[1] !== dayS) pr.deleteProperty(k); });   // tidy old mail counters 
}

/** Off-sheet copy of yesterday's sensitive actions, e-mailed to the owner (cannot be edited in the spreadsheet). */
function digest_() {
  const sh = auditSh_(); if (sh.getLastRow() < 2) return;
  const tz = Session.getScriptTimeZone(), y = Utilities.formatDate(new Date(Date.now() - 864e5), tz, 'yyyy-MM-dd'), ds = v => v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v);
  const start = Math.max(2, sh.getLastRow() - 1999), rows = sh.getRange(start, 1, sh.getLastRow() - start + 1, AUDIT_COLS.length).getValues().filter(r => ds(r[0]) === y);
  if (!rows.length) return;
  const cnt = {}; rows.forEach(r => cnt[r[4]] = (cnt[r[4]] || 0) + 1);
  const SENS = /^(student\.delete|staff\.|account\.create|settings\.|password\.reset|policy\.|status\.set)/;
  const sens = rows.filter(r => SENS.test(String(r[4]))).map(r => r[1] + '  ' + r[2] + '  ' + r[4] + '  ' + r[5] + '  ' + r[6]);
  MailApp.sendEmail({ to:Session.getEffectiveUser().getEmail(), subject:'[Moreh portal] Daily activity digest ' + y,
    body:'Actions by type:\n' + Object.keys(cnt).map(k => '  ' + k + ': ' + cnt[k]).join('\n') + '\n\nSensitive actions:\n' + (sens.join('\n') || '  none') });
}

/** Trigger target. Public but harmless: it refuses to run more than once per 12 hours. */
function dailyBackup() {
  const pr = PropertiesService.getScriptProperties();
  if (Date.now() - parseInt(pr.getProperty('LAST_BACKUP') || '0', 10) < 12 * 3600 * 1000) return;
  try { doBackup_(); } catch (e) { alert_('backupfail', 'Backup FAILED', String(e.message)); }
  try { digest_(); } catch (e) { Logger.log('digest: ' + e.message); }
  try { purgeProps_(); } catch (e) { Logger.log('purgeProps: ' + e.message); }
}
function backupNow() { ownerOnly_(); doBackup_(); Logger.log('Backup saved in the private backup folder.'); }
function installBackupTrigger() {
  ownerOnly_();
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'dailyBackup').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailyBackup').timeBased().everyDays(1).atHour(2).create();
  doBackup_(); Logger.log('Daily backup installed (about 2 AM) and a first backup was made. Folder: ' + backupFolder_().getUrl());
}


/* ============================ PART 2b: STAFF SIGN-IN CODE ============================ */

const otpOn_ = () => PropertiesService.getScriptProperties().getProperty('OTP_STAFF') !== '0';
const otHash_ = (ch, code) => Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pepper_() + 'OT' + ch + code));
const maskEmail_ = e => String(e).replace(/^(.).*(@.*)$/, '$1***$2');

/** OWNER ONLY. Sends yourself a test e-mail first, then turns staff sign-in codes ON. */
function enableStaffOtp() {
  ownerOnly_();
  MailApp.sendEmail({ to:Session.getEffectiveUser().getEmail(), subject:'Moreh portal: test e-mail', body:'Mail works. Staff sign-in codes will be sent from this account.' });
  const miss = rows_('U').filter(u => u.Role === 'admin' && !u.Email && u.Clearance !== 'Full').map(u => u.Username);
  PropertiesService.getScriptProperties().setProperty('OTP_STAFF', '1');
  Logger.log('Staff sign-in codes are ON. ' + (miss.length ? 'These staff have NO e-mail and cannot sign in until you add one in the Users sheet (Email column): ' + miss.join(', ') : 'All staff have an e-mail.'));
}
/** OWNER ONLY. Break-glass if e-mail is down. */
function disableStaffOtp() { ownerOnly_(); PropertiesService.getScriptProperties().setProperty('OTP_STAFF', '0'); Logger.log('Staff sign-in codes are OFF.'); }

function startOtp_(u) {
  const to = u.Email || (u.Clearance === 'Full' ? Session.getEffectiveUser().getEmail() : '');
  if (!to) throw new Error('Your account has no e-mail address for verification. Ask the administrator to add one.');
  const cache = CacheService.getScriptCache();
  if (cache.get('ors_' + u.Username)) throw new Error('A code was just sent. Please wait a minute, then sign in again.');
  const ch = Utilities.getUuid(), code = String(parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 8), 16) % 1000000).padStart(6, '0');
  cache.put('ot_' + ch, JSON.stringify({ u:u.Username, h:otHash_(ch, code), n:0, exp:Date.now() + 600000 }), 600);
  cache.put('ors_' + u.Username, '1', 60);
  try {
    MailApp.sendEmail({ to:to, name:'Moreh Academy Admissions', subject:'Moreh Academy portal: sign-in code',
      body:'Your sign-in code is: ' + code + '\n\nIt expires in 10 minutes. If you did not just try to sign in, change your password and tell the owner.' });
  } catch (e) { cache.remove('ot_' + ch); cache.remove('ors_' + u.Username); throw new Error('Could not send the verification e-mail. Please try again, or contact the owner.'); }
  return ok({ otp:true, challenge:ch, hint:maskEmail_(to) });
}

/** PUBLIC. Step 2 of staff sign-in. 5 tries per code, serialised so parallel guesses cannot beat the counter. */
function verifyOtp(challenge, code, deviceId) {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(5000)) throw new Error('The service is busy. Please try again.');
    const cache = CacheService.getScriptCache(), ch = String(challenge || ''), ck = 'ot_' + ch, bad = new Error('Invalid or expired code. Please sign in again.'), raw = cache.get(ck);
    if (!raw) throw bad;
    const rec = JSON.parse(raw);
    if (Date.now() > rec.exp) { cache.remove(ck); throw bad; }
    if (!safeEq_(rec.h, otHash_(ch, String(code || '').trim()))) {
      rec.n++;
      if (rec.n >= 5) { cache.remove(ck); alert_('otpfail:' + rec.u, 'Repeated wrong sign-in codes for ' + rec.u, '5 wrong codes were entered after a correct password. The password may be compromised.'); }
      else cache.put(ck, JSON.stringify(rec), Math.max(1, Math.ceil((rec.exp - Date.now()) / 1000)));
      throw bad;
    }
    cache.remove(ck);
    const u = rows_('U').find(x => x.Username === rec.u);
    if (!u || u.Role !== 'admin') throw bad;
    staffGate_(u);
    return loginPayload_(u, DEV_RE.test(String(deviceId || '')) ? String(deviceId) : '');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

/** The data the browser needs after sign-in. Shared by login and resumeSession. */
function sessionData_(token, u) {
  return { token:token, user:pub_(u), fields:FIELDS, grades:GRADES, sections:SEC, clusters:CL, cfg:{ head:HEAD_NAME, headTitle:HEAD_TITLE, fee:FEE, sch:SCHOLARSHIP, letterhead:LETTERHEAD_URL,
      reqAll:REQ_ALL, reqRules:REQ_RULES, reqTf:REQ_TF_CATS, reqHints:REQ_HINTS, reqNotes:reqNotes_(), sy:activeSY_() } };
}


/** PUBLIC. Called when the page loads with a stored token. Re-validates it and returns the same data as sign-in, with the SAME token (no new session, no audit row). */
function resumeSession(token) {
  try {
    const u = who_(String(token || ''), null, true);   // true: a user who must change their password may still resume
    return ok(sessionData_(String(token), u));
  } catch (e) { return fail(e); }
}
