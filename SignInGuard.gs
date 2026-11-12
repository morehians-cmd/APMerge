/*****************************************************************************
 MOREH ACADEMY PORTAL - SIGN-IN GUARD (new file "SignInGuard")
 Trusted devices, per-device throttle, separate public-mail buckets, reset counting that attackers cannot trigger.
 DELETE the old versions of: login, loginPayload_ (Protection), pubMailOk_ (Protection), resetGate_ (MailSwitch).
*****************************************************************************/
const DEV_RE = /^[A-Za-z0-9]{16,40}$/;

/* ---------- trusted-device token: "<deviceId>.<signature>", nothing stored on the server ---------- */
const devSig_ = (user, id) => Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature('DV|' + user + '|' + id + '|' + svGet_(user), pepper_())).slice(0, 27);
const devToken_ = (user, id) => DEV_RE.test(String(id || '')) ? id + '.' + devSig_(user, id) : '';
function devTrusted_(user, tok) {
  const p = String(tok || '').split('.');
  return p.length === 2 && DEV_RE.test(p[0]) && safeEq_(p[1], devSig_(user, p[0]));
}

/** REPLACES login. dev = { id, tok } from the browser (optional: older pages send only two arguments). */
function login(username, password, dev) {
  try {
    const key = String(username).trim().toLowerCase().slice(0, 100), pw = String(password), cache = CacheService.getScriptCache();
    dev = dev || {}; const did = DEV_RE.test(String(dev.id || '')) ? String(dev.id) : '';
    const trusted = devTrusted_(key, dev.tok), fk = (trusted ? 'lt_' : 'lf_') + key, limit = trusted ? 10 : 5, dk = did ? 'ld_' + did : '';
    const fails = parseInt(cache.get(fk) || '0', 10), dfails = dk ? parseInt(cache.get(dk) || '0', 10) : 0;
    if (fails >= limit || dfails >= 10) throw new Error('Too many failed attempts. Please wait 15 minutes, or use "Forgot password?".');
    const hit = userRow_(key), idx = hit ? hit.r - 2 : -1, u = hit ? hit.u : null;
    const good = u ? verify_(pw, u.PasswordHash) : (hash_('timing-equaliser'), false);
    if (!good) {
      cache.put(fk, String(fails + 1), 900); if (dk) cache.put(dk, String(dfails + 1), 900);
      if (!trusted && u && u.Role === 'admin' && fails + 1 === limit) alert_('lock:' + key, 'Staff sign-in locked for new devices: ' + key, '5 failed sign-in attempts for this staff account from devices that are not yet trusted. Devices you already signed in from can still sign in. Run unlockSignIn("' + key + '") in the editor to clear it.');throw new Error('Invalid username or password. If you forgot it, use "Forgot password?". If your account was locked after reset attempts, please visit the Admission Office.');
    }
    if (u.Locked === '1') throw new Error('This account is locked after repeated password resets. Please visit the Admission Office to unlock it.');
    if (pw === DEFAULT_PW) throw new Error('This default password is disabled. Ask the owner to reset the account.');
    cache.remove(fk); if (dk) cache.remove(dk);
    if (isLegacy_(u.PasswordHash)) { try { put_(sh_('U'), idx + 2, 2, [[hash_(pw)]]); } catch (_) {} }
    staffGate_(u);
    if (u.Role === 'admin' && u.Clearance !== 'Full' && otpOn_()) return startOtp_(u);
    return loginPayload_(u, did);
  } catch (e) { return fail(e); }
}

/** REPLACES loginPayload_. did = the browser's device id; the reply carries a fresh trusted-device token. */
function loginPayload_(u, did) {
  const token = Utilities.getUuid(); putSession_(token, u);
  if (u.Role === 'admin') {
    try { const pr = PropertiesService.getScriptProperties(); pr.setProperty('pl_'+u.Username, pr.getProperty('ll_'+u.Username)||''); pr.setProperty('ll_'+u.Username, Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')); } catch (_) {}
    audit_(u, 'login', '', '');
  }
  const out = sessionData_(token, u); out.dev = devToken_(u.Username, did);
  return ok(out);
}

/** OWNER ONLY (editor). Clears the sign-in failure counters of a username (default: admin). */
function unlockSignIn(username) {
  ownerOnly_(); const k = String(username || OWNER_USER).trim().toLowerCase();
  CacheService.getScriptCache().removeAll(['lf_' + k, 'lt_' + k, 'fp_' + k]);
  Logger.log('Sign-in counters cleared for "' + k + '".');
}

/* ---------- public e-mail caps: separate buckets so one kind of abuse cannot starve the other ---------- */
/** REPLACES pubMailOk_. kind: 'reg' (registration codes, default cap 40) or 'rst' (reset codes, default cap 20).
    Override with Script Properties PUB_CAP_REG / PUB_CAP_RESET (on Google Workspace you can raise both). */
function pubMailOk_(kind) {
  kind = kind === 'rst' ? 'rst' : 'reg';
  if (quotaLeft_() <= MAIL_RESERVE) { alert_('mailres', 'Mail quota reserve reached', 'Public e-mails are paused to keep the remaining quota for staff sign-in codes.'); return false; }
  const pr = PropertiesService.getScriptProperties(), k = 'pm_' + kind + '_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  const n = parseInt(pr.getProperty(k) || '0', 10), cap = parseInt(pr.getProperty(kind === 'rst' ? 'PUB_CAP_RESET' : 'PUB_CAP_REG') || (kind === 'rst' ? '20' : '40'), 10);
  if (n >= cap) { alert_('mailcap_' + kind, 'Public e-mail cap reached (' + (kind === 'rst' ? 'password resets' : 'registrations') + ')', 'Refused for the rest of today (cap ' + cap + '). Could be a surge of real enrollees, or abuse. Emergency lever: Enrollment Settings > close enrollment and use the allow-list.'); return false; }
  pr.setProperty(k, String(n + 1));
  if (n + 1 === Math.floor(cap * 0.8)) alert_('mailcap80_' + kind, 'Public e-mail use at 80% (' + kind + ')', 'Today\'s cap (' + cap + ') is 80% used.');
  return true;
}

/* ---------- student reset lock: only COMPLETED resets count, so an attacker cannot lock someone else ---------- */
/** REPLACES resetGate_. True = a code may be sent. A student who already completed (RESET_LIMIT - 1) resets is locked on the next request. */
function resetGate_(u) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) throw new Error('The service is busy. Please try again.');
  try {
    const done = parseInt(PropertiesService.getScriptProperties().getProperty('rs_' + activeSY_() + '_' + u.Username) || '0', 10);
    if (done + 1 >= RESET_LIMIT) { setLocked_(u.Username, true); audit_('self:' + u.Username, 'account.lock', u.StudentID, done + ' completed password resets'); return false; }
    return true;
  } finally { try { lock.releaseLock(); } catch (_) {} }
}
/** Called by resetPassword after a successful reset (it already holds the script lock). */
function resetCount_(username) {
  const pr = PropertiesService.getScriptProperties(), k = 'rs_' + activeSY_() + '_' + username;
  pr.setProperty(k, String(parseInt(pr.getProperty(k) || '0', 10) + 1));
}