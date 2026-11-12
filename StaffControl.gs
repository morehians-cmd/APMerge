/*****************************************************************************
 MOREH ACADEMY PORTAL - STAFF CONTROL BUNDLE (add as a NEW file named "StaffControl")
 Requires Security, Protection, Hardening and MailSwitch already applied.

 WHAT THIS DOES
   1. Sign-in code (OTP) is for ENCODERS only. The main administrator (Clearance = Full) signs in with password only.
      Encoder OTP is ON by default and no longer depends on the mail switch (it overrides edit (g) of MailSwitch).
   2. Email is a MUST for every Encoder: required when creating, cannot be blanked by the Encoder,
      must be unique, and the owner can correct it with "Set email". An Encoder with no email cannot sign in.
   3. User Management gets Deactivate / Activate. Deactivating signs the person out at once.
   4. Encoders can sign in only from 7:00 AM to 6:00 PM Manila time. Outside that window the
      administrator can approve after-hours access for 1-12 hours. A blocked attempt is logged,
      e-mailed to the owner (once an hour per person) and shown in User Management.

 HOW TO APPLY
   A. Add this file.   B. Make the edits in PART 2.   C. Deploy a new version.
   D. Open User Management and look for the red "No email" chips: add those emails BEFORE the Encoders next sign in.
*****************************************************************************/

const STAFF_TZ = 'Asia/Manila', STAFF_FROM = 7 * 60, STAFF_TO = 18 * 60;   // minutes after midnight: 7:00 AM up to (not including) 6:00 PM

/* ============================ 1. SIGN-IN GATE (Encoders only) ============================ */

/** Throws if this Encoder may not sign in right now. Called after the password is correct and again when the OTP is verified. */
function staffGate_(u) {
  if (!u || u.Role !== 'admin' || u.Clearance === 'Full') return;
  if (u.Disabled === '1') throw new Error('This account has been deactivated. Please contact the administrator.');
  const d = new Date(), m = parseInt(Utilities.formatDate(d, STAFF_TZ, 'H'), 10) * 60 + parseInt(Utilities.formatDate(d, STAFF_TZ, 'm'), 10);
  if (m >= STAFF_FROM && m < STAFF_TO) return;
  if (parseInt(u.AfterHrs || '0', 10) > Date.now()) return;                       // approved after-hours window
  PropertiesService.getScriptProperties().setProperty('ahr_' + u.Username, String(Date.now()));
  audit_(u, 'login.afterhours.denied', u.Username, '');
  alert_('ah:' + u.Username, 'After-hours sign-in request: ' + u.Username, u.Username + ' tried to sign in outside 7:00 AM - 6:00 PM. Approve it under User Management > Approve after-hours if it is expected.');
  throw new Error('Encoder sign-in is allowed from 7:00 AM to 6:00 PM only. Ask the administrator to approve after-hours access, then try again.');
}


/* ============================ 2. USER MANAGEMENT SERVER FUNCTIONS ============================ */

/** REPLACES listUsers in Code.gs (delete the old one). */
function listUsers(token) {
  try {
    sysOwner_(token); const pr = PropertiesService.getScriptProperties(), now = Date.now();
    return ok(rows_('U').filter(u => u.Role === 'admin').map(u => {
      const until = parseInt(u.AfterHrs || '0', 10), req = parseInt(pr.getProperty('ahr_' + u.Username) || '0', 10);
      return { Username:u.Username, FullName:u.FullName, Designation:u.Designation, Department:u.Department, Clearance:u.Clearance, Email:u.Email,
        Disabled:u.Disabled === '1', AfterUntil:until > now ? Utilities.formatDate(new Date(until), STAFF_TZ, 'MMM d, h:mm a') : '', Req:now - req < 12 * 3600000 };
    }));
  } catch (e) { return fail(e); }
}

function encRow_(users, username) {
  const i = users.findIndex(u => u.Username === username && u.Role === 'admin' && u.Clearance !== 'Full');
  if (i < 0) throw new Error('Encoder not found.');
  return i;
}

/** OWNER ONLY. Deactivate (active=false) or reactivate an Encoder. Deactivating revokes every session at once. */
function setStaffActive(token, username, active) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); const ou = sysOwner_(token), users = rows_('U'), i = encRow_(users, username);
    put_(sh_('U'), i + 2, UCOLS.indexOf('Disabled') + 1, [[active ? '' : '1']]);
    if (!active) bumpSV_(username);
    audit_(ou, active ? 'staff.activate' : 'staff.deactivate', username, '');
    return ok(null, active ? 'Account activated' : 'Account deactivated');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

/** OWNER ONLY. hours 1-12 = approve after-hours sign-in from now; 0 = cancel an approval. */
function approveAfterHours(token, username, hours) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); const ou = sysOwner_(token), h = parseFloat(hours);
    if (isNaN(h) || h < 0 || h > 12) throw new Error('Enter a number of hours between 0 and 12.');
    const users = rows_('U'), i = encRow_(users, username), until = h > 0 ? Math.round(Date.now() + h * 3600000) : 0;
    put_(sh_('U'), i + 2, UCOLS.indexOf('AfterHrs') + 1, [[until ? String(until) : '']]);
    PropertiesService.getScriptProperties().deleteProperty('ahr_' + username);
    audit_(ou, 'staff.afterhours', username, h > 0 ? h + ' h' : 'cancelled');
    return ok(null, h > 0 ? 'After-hours access approved until ' + Utilities.formatDate(new Date(until), STAFF_TZ, 'MMM d, h:mm a') : 'After-hours approval cancelled');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

/** OWNER ONLY. Sets / corrects an Encoder's email (where the sign-in code is sent). */
function setStaffEmail(token, username, email) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); const ou = sysOwner_(token), em = String(email || '').trim();
    if (!EMAIL_RE.test(em)) throw new Error('Enter a valid email address.');
    const users = rows_('U'), i = encRow_(users, username);
    if (users.some((x, k) => k !== i && (x.Email || '').toLowerCase() === em.toLowerCase())) throw new Error('That email address is already used by another account.');
    put_(sh_('U'), i + 2, UCOLS.indexOf('Email') + 1, [[em]]); bumpSV_(username);
    audit_(ou, 'staff.email', username, '');
    return ok(null, 'Email updated. The next sign-in code goes to ' + maskEmail_(em) + '.');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

