/*****************************************************************************
 MOREH ACADEMY PORTAL - HARDENING BUNDLE (add as a NEW file named "Hardening")
 Requires Security + Protection files (ownerOnly_, put_, safeEq_, otHash_, maskEmail_, pubMailOk_, audit_, alert_, tempPw_, ...).

 WHAT THIS ADDS
   1. Verified self-registration  - e-mail code BEFORE any record is created; duplicates look identical to new
                                    registrations (no enumeration of minors' records); names restricted to letters
   2. Policy editor sanitizer     - allow-list on the server (save AND read) + on the client (stops stored XSS)
   3. Locks on the remaining writers (status, delete, create login, delete event) and no mail sent while holding a lock
   4. Delete safety net           - deleted students are copied to a "Deleted Students" sheet first
   5. Identity lock               - after a learner is Enrolled, students can no longer change LRN / name / birthdate / grade
   6. Retention review            - lists applications older than 12 months that were never enrolled (RA 10173 promise)

 NOTE ON CAPTCHA: reCAPTCHA / Turnstile do not work reliably inside an Apps Script web app (it runs in a sandboxed iframe),
 so this bundle uses e-mail verification + the daily mail cap + per-address throttling instead.

 HOW TO APPLY
   A. Add this file. In Code.gs DELETE the old versions of:
        registerAccount, getPolicy, savePolicy, setStatus, deleteStudent, createLogin, deleteEvent
      (these replace them, and already include the audit/alert lines from the Protection bundle, so skip those older edits
       for these functions).
   B. Do the small edits in PART 3 and the Index.html edits in PART 4.
   C. Deploy a new version and run the tests listed in the reply.
*****************************************************************************/

const NAME_RE = /^[A-Z\u00C0-\u00DD][A-Z\u00C0-\u00DD .'\-]{0,59}$/;     // used after upper-casing
const IDLOCK  = ['LRN','Surname','FirstName','MiddleName','Suffix','Birthdate','SchoolYear','GradeLevel','Cluster'];
const POLICY_TAGS = ['h1','h2','h3','h4','p','ul','ol','li','b','i','u','br','strong','em','div','span','details','summary','section','article','figure','figcaption','blockquote','a'];


/* ========================= 1. VERIFIED REGISTRATION ========================= */

/** PUBLIC step 1. Validates, then e-mails a 6-digit code. Creates NOTHING yet. Same response whether or not the learner already exists. */
function registerAccount(f) {
  try {
    const SY = activeSY_(), up = v => String(v || '').trim().toUpperCase();
    const em0 = String(f.email || '').trim(), em = em0.toLowerCase(), pw = String(f.password || ''), lrn = String(f.lrn || '').trim(), bd = String(f.birthdate || '').trim();
    const sn = up(f.surname), fn = up(f.firstName);
    if (!enrollOpen_() && !allowed_().includes(em)) throw new Error('Enrollment is currently closed. Please contact the Admissions Office.');
    if (!f.consent) throw new Error('You must accept the Data Privacy Notice to create an account.');
    if (!sn || !fn) throw new Error('Surname and first name are required.');
    if (!NAME_RE.test(sn) || !NAME_RE.test(fn)) throw new Error('Names may contain letters, spaces, periods, apostrophes and hyphens only.');
    if (!EMAIL_RE.test(em0)) throw new Error('Enter a valid email address.');
    if (!/^[1-5]\d{11}$/.test(lrn)) throw new Error('LRN must be 12 digits and start with 1, 2, 3, 4 or 5.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bd)) throw new Error('Enter your birth date.');
    if (pw.length < 8 || pw === DEFAULT_PW) throw new Error('Password must be at least 8 characters.');
    const age = parseInt(age_(bd), 10); let g = {};
    if (age < 18) {
      g = { name:up(f.guardName), rel:up(f.guardRel), email:String(f.guardEmail || '').trim(), mobile:String(f.guardMobile || '').trim() };
      if (!g.name || !g.rel) throw new Error('Parent / legal guardian name and relationship are required for applicants below 18.');
      if (!NAME_RE.test(g.name) || !NAME_RE.test(g.rel)) throw new Error('Guardian name and relationship may contain letters, spaces, periods, apostrophes and hyphens only.');
      if (!EMAIL_RE.test(g.email)) throw new Error('Enter a valid parent / guardian email address.');
      if (g.email.toLowerCase() === em) throw new Error('The parent / guardian email must be different from the student email.');
      if (!/^\d{11}$/.test(g.mobile)) throw new Error('Parent / guardian mobile number must be 11 digits.');
    }
    if (!mailOn_()) return registerDirect_({ sn:sn, fn:fn, lrn:lrn, bd:bd, em:em, em0:em0, pw:pw, g:g });   // no e-mail code while automatic mail is off
    const cache = CacheService.getScriptCache();
    if (cache.get('rg_' + em)) throw new Error('A code was sent recently. Please wait a minute, or enter the code you already received.');
    cache.put('rg_' + em, '1', 60);
    if (!pubMailOk_('reg')) throw new Error('Registration is busy right now. Please try again later.');

    const ch = Utilities.getUuid(), all = rows_('S'), me = (sn + '|' + fn + '|' + bd).toUpperCase();
    const dup = all.some(s => s.LRN === lrn || (s.Email || '').toLowerCase() === em || (s.Surname + '|' + s.FirstName + '|' + s.Birthdate).toUpperCase() === me) || rows_('U').some(u => u.Username === em || (u.Email || '').toLowerCase() === em);
    if (!dup) {
      const code = String(parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 8), 16) % 1000000).padStart(6, '0');
      cache.put('rp_' + ch, JSON.stringify({ sn:sn, fn:fn, lrn:lrn, bd:bd, em:em, em0:em0, hash:hash_(pw), g:g, h:otHash_(ch, code), n:0, exp:Date.now() + 900000 }), 900);
      try {
        MailApp.sendEmail({ to:em0, name:'Moreh Academy Admissions', subject:'Moreh Academy portal: verify your email',
          body:'Your verification code is: ' + code + '\n\nEnter it on the registration screen within 15 minutes to finish creating your account. If you did not start a registration, ignore this email.' });
      } catch (e) { cache.remove('rp_' + ch); throw new Error('Could not send the verification email. Please check the address and try again.'); }
    }
    return ok({ pending:true, challenge:ch, hint:maskEmail_(em0) }, 'If this email can be registered, a 6-digit code has been sent. Enter it to finish.');
  } catch (e) { return fail(e); }
}

/** PUBLIC step 2. Creates the student record + login only after the e-mailed code is entered correctly. */
function confirmRegistration(challenge, code) {
  const lock = LockService.getScriptLock(); let held = false, p = null, row = null;
  try {
    if (!lock.tryLock(8000)) throw new Error('The service is busy. Please try again.'); held = true;
    const cache = CacheService.getScriptCache(), ch = String(challenge || ''), ck = 'rp_' + ch, raw = cache.get(ck), bad = new Error('Invalid or expired code. Please register again.');
    if (!raw) throw bad;
    p = JSON.parse(raw);
    if (Date.now() > p.exp) { cache.remove(ck); throw bad; }
    if (!safeEq_(p.h, otHash_(ch, String(code || '').trim()))) {
      p.n++; if (p.n >= 5) cache.remove(ck); else cache.put(ck, JSON.stringify(p), Math.max(1, Math.ceil((p.exp - Date.now()) / 1000)));
      throw bad;
    }
    const SY = activeSY_();
    if (!enrollOpen_() && !allowed_().includes(p.em)) throw new Error('Enrollment is currently closed. Please contact the Admissions Office.');
    const all = rows_('S'), me = (p.sn + '|' + p.fn + '|' + p.bd).toUpperCase();
    if (all.some(s => s.LRN === p.lrn || (s.Email || '').toLowerCase() === p.em || (s.Surname + '|' + s.FirstName + '|' + s.Birthdate).toUpperCase() === me) || rows_('U').some(u => u.Username === p.em)) { cache.remove(ck); throw bad; }
    const g = p.g || {};
    row = { StudentID:nextIdV2_(all, SY), CreatedAt:Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      Surname:p.sn, FirstName:p.fn, LRN:p.lrn, Email:p.em0, Birthdate:p.bd, Age:age_(p.bd), Classification:'New', SchoolYear:SY, EnrollStatus:'Not Enrolled', ReqConsent:'None',
      GuardName:g.name || '', GuardRelation:g.rel || '', GuardEmail:g.email || '', GuardMobile:g.mobile || '' };
    row.ConsentAt = row.CreatedAt; row.FullName = p.sn + ', ' + p.fn;
    const sh = sh_('S'); put_(sh, sh.getLastRow() + 1, 1, [COLS.map(c => row[c] || '')]);
    addUser_(p.em, { hash:p.hash }, 'student', row.FullName, row.StudentID, p.em0);
    cache.remove(ck);
    audit_('self:' + p.em, 'student.register', row.StudentID, 'e-mail verified');
  } catch (e) { return fail(e); } finally { if (held) { try { lock.releaseLock(); } catch (_) {} } }
  // mails are sent AFTER the lock is released
  notify_(row, 'Registration received', 'Your account is ready. Sign in with your email as the username to complete your student profile. Please print the Parental Consent & Data Privacy Undertaking Form from your dashboard and submit it with your hardcopy requirements.');
  return ok({ id:row.StudentID }, 'Email verified. Your account is ready. You can now sign in.');
}


/* ========================= 2. POLICY SANITIZER ========================= */

/** Allow-list: keeps only POLICY_TAGS (all attributes removed) and escapes every other '<'. */
function cleanPolicy_(html) {
  let h = String(html || '').slice(0, 45000);
  h = h.replace(/<!--[\s\S]*?-->/g, '');
  h = h.replace(/<\s*(script|style|iframe|object|embed|svg|math|template|noscript|form|textarea|title|head)\b[\s\S]*?<\/\s*\1\s*>/gi, '');
  h = h.replace(/<\s*(\/?)\s*([a-z0-9]+)\b[^>]*>/gi, (m, slash, t) => POLICY_TAGS.indexOf(t.toLowerCase()) >= 0 ? '<' + slash + t.toLowerCase() + '>' : '');
  h = h.replace(new RegExp('<(?!\\/?(?:' + POLICY_TAGS.join('|') + ')>)', 'gi'), '&lt;');
  return h;
}
function getPolicy() { try { return ok(cleanPolicy_(String(contentSh_().getRange(2, 2).getValue() || ''))); } catch (e) { return fail(e); } }
function savePolicy(token, html) {
  try { const ou = owner_(token), h = cleanPolicy_(html); contentSh_().getRange(2, 2).setValue(h); audit_(ou, 'policy.save', 'privacy', ''); return ok(h, 'Policy saved'); }
  catch (e) { return fail(e); }
}


/* ========================= 3. LOCKED WRITERS ========================= */

function setStatus(token, ids, status) {
  const lock = LockService.getScriptLock(), notes = []; let n = 0, skipped = 0, blocked = 0, u = null;
  try {
    lock.waitLock(20000);
    u = who_(token, 'admin');
    if (!['Not Enrolled', 'Enrolled'].includes(status))
      throw new Error(status === 'Transferred Out' ? 'Transferred Out needs a reason and a date. Open the learner and set it in Step 5.' : 'Invalid status.');
    ids = Array.isArray(ids) ? ids.slice(0, 500) : [];
    const sh = sh_('S'), all = rows_('S'), logs = [], pos = {}, held = status === 'Enrolled' ? activeFlags_() : {};
    all.forEach((s, i) => { pos[s.StudentID] = i; });
    ids.forEach(id => {
      const i = pos[id]; if (i == null) return;
      const row = all[i];
      if (row.EnrollStatus === 'Cancelled') { skipped++; return; }          // cancelled records are never revived in bulk
      if (held[id]) { blocked++; return; }                                  // an active hold blocks Enrolled
      if (row.EnrollStatus === status) return;
      const was = row.EnrollStatus; row.EnrollStatus = status; stampAudit_(row, u);
      n++; logs.push(logRow_(row, was, u)); notes.push(row);
    });
    if (n) {   // one write per changed column instead of one write per learner
      ['EnrollStatus', 'ProcessedBy', 'ProcessedDate', 'ProcessedTime', 'StatusChangedAt']
        .forEach(k => put_(sh, 2, COLS.indexOf(k) + 1, all.map(r => [r[k] || ''])));
      audit_(u, 'status.set', n + ' record(s)', status);
    }
    if (ids.length >= 10) alert_('bulk', 'Bulk status change', u.Username + ' set ' + n + ' record(s) to ' + status);
    if (logs.length) logStatus_(logs);
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
  notifyMany_(notes, 'Enrollment status update', 'Your enrollment status is now: ' + status.toUpperCase() + '.');   // after the lock; silent while AUTO_MAIL is off
  return ok(n, n + ' record(s) updated' + (skipped ? ' (' + skipped + ' cancelled skipped)' : '') + (blocked ? ' (' + blocked + ' not enrolled: active hold)' : ''));
}
/** Copies the full record to "Deleted Students" before removing it (restore = copy the row back). */
function archiveStudent_(rec, u) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); let sh = ss.getSheetByName('Deleted Students');
  const head = ['DeletedAt', 'DeletedBy'].concat(COLS);
  if (!sh) { sh = ss.insertSheet('Deleted Students'); sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold'); sh.setFrozenRows(1); }
  put_(sh, sh.getLastRow() + 1, 1, [[Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), u.Username].concat(COLS.map(c => rec[c] || ''))]);
}
function deleteStudent(token, id) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const ou = owner_(token), sh = sh_('S'), all = rows_('S'), i = all.findIndex(s => s.StudentID === id);
    if (i < 0) throw new Error('Not found.');
    archiveStudent_(all[i], ou);
    try { if (all[i].IDPhotoID) DriveApp.getFileById(all[i].IDPhotoID).setTrashed(true); } catch (_) {}
    purgeHistory_(id);
    sh.deleteRow(i + 2);stBump_();
    const us = sh_('U'), uids = us.getLastRow() > 1 ? us.getRange(2, 9, us.getLastRow() - 1, 1).getValues().flat() : [];
    for (let k = uids.length - 1; k >= 0; k--) if (uids[k] === id) us.deleteRow(k + 2);
    uvBump_();
    audit_(ou, 'student.delete', id, 'archived');
    alert_('del', 'Student record deleted', ou.Username + ' deleted ' + id + ' (a copy is in the "Deleted Students" sheet).');
    return ok(null, 'Deleted ' + id);
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

function createLogin(token, id, username, password) {
  const lock = LockService.getScriptLock(); let s = null, out = null;
  try {
    lock.waitLock(20000);
    const ou = owner_(token);
    s = rows_('S').find(x => x.StudentID === id); if (!s) throw new Error('Student not found.');
    if (rows_('U').some(u => u.StudentID === id)) throw new Error('This student already has an account.');
    username = String(username || s.LRN).trim().toLowerCase();
    if (!/^[a-z0-9._@-]{4,60}$/.test(username)) throw new Error('Username must be 4-60 characters (letters, numbers, . _ @ -).');
    if (password && String(password).length < 8) throw new Error('Password must be at least 8 characters.');
    password = password || tempPw_();
    addUser_(username, password, 'student', s.FullName, id, '', true);
    audit_(ou, 'account.create', id, username);
    out = { username:username, password:password, emailed:mailOn_() && /@/.test(s.Email || '') };
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
  notify_(s, 'Your portal account', 'Your portal account is ready.\nUsername: ' + out.username + '\nTemporary password: ' + out.password + '\n\nYou will be asked to choose a new password when you sign in.');
  return ok(out, 'Account created');
}

function deleteEvent(token, id) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const ou = owner_(token), sh = evSh_(), ids = sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().flat().map(String), i = ids.indexOf(String(id));
    if (i < 0) throw new Error('Event not found.');
    sh.deleteRow(i + 2); audit_(ou, 'event.delete', String(id), ''); invalidatePublicContentCache_(); return ok(null, 'Event deleted');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

