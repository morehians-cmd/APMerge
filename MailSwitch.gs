/*****************************************************************************
 MOREH ACADEMY PORTAL - MAIL SWITCH BUNDLE (add as a NEW file named "MailSwitch")
 Requires the Security, Protection and Hardening files already applied.

 WHAT THIS DOES
   1. Mail switch (property MAIL_ON). OFF by default = SY2026-2027 behaviour:
        - Registration creates the account immediately (no e-mailed code)
        - No registration code, welcome, guardian notice, status update, password-reset code
          or staff sign-in code is sent
        - "Forgot password?" tells the student to visit the Admission Office
      It switches ON automatically when the owner clicks "Start enrollment for next school year"
      (or manually with enableMail()).  Owner alerts, the daily digest and e-mails to new
      staff are NOT affected.
   2. Student password-reset lock: the 3rd reset request in a school year locks the account.
      (Applies when mail is ON. Admin / Encoder accounts are never locked, so nobody can
      lock the owner out by spamming "Forgot password?".)
   3. Admin unlock + password reset for students: "Reset password / Unlock" button on the
      student record. Works any time, so it is also how forgotten passwords are handled this year.

 HOW TO APPLY
   A. Add this file (everything above PART 2).
   B. Delete the OLD forgotPassword from Code.gs (the one below replaces it).
   C. Make the small edits in PART 2.
   D. Deploy a new version. The first request adds a "Locked" column at the end of the Users sheet.
*****************************************************************************/

const RESET_LIMIT = 3;   // reset requests per school year before a STUDENT account locks
const RESET_CODE_TRIES = 2;   // wrong reset codes before a STUDENT account locks

/* ============================ 1. MAIL SWITCH ============================ */

const mailOn_ = () => PropertiesService.getScriptProperties().getProperty('AUTO_MAIL') === '1';

/** OWNER ONLY (editor). Run after upgrading to Google Workspace. Then raise MAIL_RESERVE, PUB_CAP_REG and PUB_CAP_RESET. */
function enableMail() {
  ownerOnly_();
  PropertiesService.getScriptProperties().setProperty('AUTO_MAIL', '1');
  Logger.log('Automatic e-mails are ON. Remaining mail quota today: ' + MailApp.getRemainingDailyQuota());
}
/** OWNER ONLY (editor). Back to manual sending. */
function disableMail() {
  ownerOnly_();
  PropertiesService.getScriptProperties().setProperty('AUTO_MAIL', '0');
  Logger.log('Automatic e-mails are OFF.');
}

/* ============================ 2. REGISTRATION WITHOUT E-MAIL CODE ============================ */

/** Called by registerAccount when mail is OFF. p = { sn, fn, lrn, bd, em, em0, pw, g }. Creates record + login at once. */
function registerDirect_(p) {
  const lock = LockService.getScriptLock(); let held = false, row = null;
  try {
    if (!lock.tryLock(8000)) throw new Error('The service is busy. Please try again.'); held = true;
    const cache = CacheService.getScriptCache(), pr = PropertiesService.getScriptProperties(), tz = Session.getScriptTimeZone();
    if (cache.get('rd_' + p.lrn)) throw new Error('Please wait a minute before trying again.');
    cache.put('rd_' + p.lrn, '1', 60);
    // daily cap: with no e-mail check, this limits bulk fake sign-ups (change with Script Property REG_DAILY_CAP)
    const day = Utilities.formatDate(new Date(), tz, 'yyyyMMdd'), cur = String(pr.getProperty('REG_DAY') || '').split(':'),
      n = cur[0] === day ? parseInt(cur[1] || '0', 10) : 0, cap = parseInt(pr.getProperty('REG_DAILY_CAP') || '300', 10);
    if (n >= cap) { alert_('regcap', 'Daily registration cap reached', 'More than ' + cap + ' registrations today. Could be a busy enrollment day, or abuse.'); throw new Error('Registration is busy right now. Please try again tomorrow or visit the Admissions Office.'); }
    if (!enrollOpen_() && !allowed_().includes(p.em)) throw new Error('Enrollment is currently closed. Please contact the Admissions Office.');
    const all = rows_('S'), me = (p.sn + '|' + p.fn + '|' + p.bd).toUpperCase();
    const dup = all.some(s => s.LRN === p.lrn || (s.Email || '').toLowerCase() === p.em || (s.Surname + '|' + s.FirstName + '|' + s.Birthdate).toUpperCase() === me) || rows_('U').some(u => u.Username === p.em || (u.Email || '').toLowerCase() === p.em);
    if (dup) throw new Error('We could not create an account with these details. If you already registered, please sign in; otherwise visit the Admission Office.');
    const SY = activeSY_(), g = p.g || {}, now = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
    const hashed = hash_(p.pw);
    row = { StudentID:nextIdV2_(all, SY), CreatedAt:now, Surname:p.sn, FirstName:p.fn, LRN:p.lrn, Email:p.em0, Birthdate:p.bd, Age:age_(p.bd),
      Classification:'New', SchoolYear:SY, EnrollStatus:'Not Enrolled', ReqConsent:'None', GuardName:g.name || '', GuardRelation:g.rel || '', GuardEmail:g.email || '', GuardMobile:g.mobile || '' };
    row.ConsentAt = now; row.FullName = p.sn + ', ' + p.fn;
    const sh = sh_('S'); put_(sh, sh.getLastRow() + 1, 1, [COLS.map(c => row[c] || '')]);
    addUser_(p.em, { hash: hashed }, 'student', row.FullName, row.StudentID, p.em0);
    pr.setProperty('REG_DAY', day + ':' + (n + 1));
    audit_('self:' + p.em, 'student.register', row.StudentID, 'no e-mail verification (mail switch off)');
  } catch (e) { return fail(e); } finally { if (held) { try { lock.releaseLock(); } catch (_) {} } }
  return ok({ id:row.StudentID }, 'Account created. You can now sign in with your email and password.');
}


/* ============================ 3. FORGOT PASSWORD (REPLACES the one in Code.gs) ============================ */

function forgotPassword(identifier) {
  try {
    const key = String(identifier || '').trim().toLowerCase(); if (!key) throw new Error('Enter your username or registered email.');
    const cache = CacheService.getScriptCache(), MSG = 'If the account exists, a 6-digit code has been sent to its registered email. It expires in 15 minutes. If you have reset your password several times, the account may be locked: please visit the Admission Office.';
    if (cache.get('fp_' + key)) throw new Error('A code was requested recently. Please wait 5 minutes, or use the code already sent to your email.');
    cache.put('fp_' + key, '1', 300);
    const u = rows_('U').find(x => x.Username === key || (x.Email || '').toLowerCase() === key);
    if (u && u.Locked !== '1') {
      const s = rows_('S').find(x => x.StudentID === u.StudentID) || {};
      const to = u.Email || s.Email || (u.Username.indexOf('@') > 0 ? u.Username : '');
      if (to) {
        if (!pubMailOk_('rst')) throw new Error('The service is busy. Please try again later.');
        if (u.Role === 'student' && !resetGate_(u)) return ok(null, MSG);      // 3rd request: account locks, no code sent
        const code = String(parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 8), 16) % 1000000).padStart(6, '0');
        cache.put('rc_' + u.Username, JSON.stringify({ h:rcHash_(code), n:0, exp:Date.now() + 900000 }), 900);
        try { MailApp.sendEmail({ to:to, name:'Moreh Academy Admissions', subject:'Moreh Academy portal: password reset code',
          body:'Your password reset code is: ' + code + '\n\nIt expires in 15 minutes. Your current password has NOT been changed.\nIf you did not request this, ignore this email.' }); } catch (_) {}
      }
    }
    return ok(null, MSG);
  } catch (e) { return fail(e); }
}


function setLocked_(username, on) {
  const sh = sh_('U'), r = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().flat().indexOf(username) + 1;
  if (!r) return;
  put_(sh, r, UCOLS.indexOf('Locked') + 1, [[on ? '1' : '']]);
  bumpSV_(username);                                   // kills any signed-in session
}


/* ============================ 5. ADMIN: RESET PASSWORD / UNLOCK ============================ */

/** Admin or Encoder (Admission Office). Issues a one-time password, forces a change at sign-in, unlocks, and clears the reset counter.
    To make this OWNER-only, change who_(token, 'admin') to sysOwner_(token). */
function resetStudentAccount(token, studentId) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const au = who_(token, 'admin'), users = rows_('U'), i = users.findIndex(u => u.Role === 'student' && u.StudentID === studentId);
    if (i < 0) throw new Error('This learner has no portal account yet. Use "Create account" first.');
    const acc = users[i], was = acc.Locked === '1', pw = tempPw_(), sh = sh_('U');
    put_(sh, i + 2, 2, [[hash_(pw)]]);
    put_(sh, i + 2, UCOLS.indexOf('MustChange') + 1, [['1']]);
    put_(sh, i + 2, UCOLS.indexOf('Locked') + 1, [['']]);
    PropertiesService.getScriptProperties().deleteProperty('rs_' + activeSY_() + '_' + acc.Username);
    bumpSV_(acc.Username);
    audit_(au, was ? 'account.unlock' : 'account.reset', studentId, acc.Username);
    return ok({ username:acc.Username, password:pw, wasLocked:was }, was ? 'Account unlocked' : 'Password reset');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

