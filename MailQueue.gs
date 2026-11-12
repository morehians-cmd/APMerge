/*****************************************************************************
 MOREH ACADEMY PORTAL - MAIL QUEUE (new file "MailQueue")
 Status, welcome and guardian e-mails are queued and sent by a trigger,
 keeping MAIL_RESERVE messages of the daily quota free for sign-in / reset codes.
*****************************************************************************/
const MAIL_RESERVE = 40;      // daily quota kept free for sign-in and reset codes
const MQ_PER_RUN  = 40;       // maximum queued e-mails sent per trigger run
const MQ_COLS = ['Queued', 'To', 'Subject', 'Body'];

const quotaLeft_ = () => { try { return MailApp.getRemainingDailyQuota(); } catch (e) { return 0; } };

function mqSh_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); let sh = ss.getSheetByName('Mail Queue');
  if (!sh) { sh = ss.insertSheet('Mail Queue'); sh.getRange(1, 1, 1, MQ_COLS.length).setValues([MQ_COLS]).setFontWeight('bold'); sh.setFrozenRows(1); sh.getRange(1, 1, sh.getMaxRows(), MQ_COLS.length).setNumberFormat('@'); }
  return sh;
}

/** Adds one e-mail to the queue. Never throws. */
function queueMail_(to, subject, body) {
  try {
    if (!EMAIL_RE.test(to || '')) return;
    const sh = mqSh_();
    put_(sh, sh.getLastRow() + 1, 1, [[Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), String(to), String(subject), String(body)]]);
  } catch (e) { Logger.log('queueMail: ' + e.message); }
}

/** REPLACES notify_ in Code.gs (delete the old one). Queues instead of sending. */
function notify_(row, subject, body) {
  try {
    if (typeof mailOn_ === 'function' && !mailOn_()) return;     // MailSwitch, if applied
    if (!EMAIL_RE.test(row.Email || '')) return;
    queueMail_(row.Email, SCHOOL + ' - ' + subject, 'Hello ' + (row.FirstName || '') + ',\n\n' + body + '\n\nEnrollment ID: ' + row.StudentID + '\n\n' + SCHOOL + ' Admissions Office');
  } catch (e) { Logger.log(e.message); }
}

/** Trigger target. Sends queued mail while the quota stays above the reserve. */
function processMailQueue() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const sh = mqSh_(), n = sh.getLastRow() - 1; if (n < 1) return;
    const data = sh.getRange(2, 1, Math.min(n, 200), MQ_COLS.length).getValues();
    let budget = Math.min(quotaLeft_() - MAIL_RESERVE, MQ_PER_RUN);
    const stale = Utilities.formatDate(new Date(Date.now() - 3 * 864e5), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), done = [];
    data.forEach((r, i) => {
      if (String(r[0]) < stale) { done.push(i); return; }               // too old: drop
      if (budget <= 0) return;
      try { MailApp.sendEmail({ to:r[1], subject:r[2], body:r[3], name:'Moreh Academy Admissions' }); budget--; done.push(i); }
      catch (e) { Logger.log('queue send: ' + e.message); }
    });
    for (let k = done.length - 1; k >= 0; k--) sh.deleteRow(done[k] + 2);
    if (sh.getLastRow() > 150) alert_('mqbig', 'Mail queue is backing up', (sh.getLastRow() - 1) + ' e-mails are waiting. The daily quota may be too small for this volume.');
  } finally { try { lock.releaseLock(); } catch (_) {} }
}

/** OWNER ONLY. Run once from the editor. */
function installMailQueueTrigger() {
  ownerOnly_();
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'processMailQueue').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('processMailQueue').timeBased().everyMinutes(10).create();
  Logger.log('Mail queue trigger installed (every 10 minutes). Quota left today: ' + quotaLeft_());
}
/** Queues the same message for many learners with ONE sheet write. Never throws. */
function notifyMany_(list, subject, body) {
  try {
    if (typeof mailOn_ === 'function' && !mailOn_()) return;
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), out = [];
    list.forEach(row => {
      if (!EMAIL_RE.test(row.Email || '')) return;
      out.push([now, String(row.Email), SCHOOL + ' - ' + subject, 'Hello ' + (row.FirstName || '') + ',\n\n' + body + '\n\nEnrollment ID: ' + row.StudentID + '\n\n' + SCHOOL + ' Admissions Office']);
    });
    if (out.length) { const sh = mqSh_(); put_(sh, sh.getLastRow() + 1, 1, out); }
  } catch (e) { Logger.log('notifyMany: ' + e.message); }
}

/** One sheet write for many e-mails. items = [{ to, subject, body }]. */
function queueMailMany_(items) {
  const sh = mqSh_(), now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  const out = items.filter(x => EMAIL_RE.test(x.to || '')).map(x => [now, String(x.to), String(x.subject), String(x.body)]);
  if (out.length) put_(sh, sh.getLastRow() + 1, 1, out);
}

/** Admin / Encoder. MANUAL send: queues the current-status e-mail for the chosen learners (max 100 per click, within today's quota). */
function emailStatus(token, ids) {
  try {
    const u = who_(token, 'admin');
    ids = Array.isArray(ids) ? ids.map(String).slice(0, 100) : [];
    if (!ids.length) throw new Error('Select at least one learner.');
    const want = {}; ids.forEach(i => want[i] = 1);
    const withMail = rows_('S').filter(s => want[s.StudentID] && EMAIL_RE.test(s.Email || ''));
    const waiting = Math.max(0, mqSh_().getLastRow() - 1), room = Math.max(0, quotaLeft_() - MAIL_RESERVE - waiting), send = withMail.slice(0, room);
    if (!send.length) throw new Error(room ? 'None of the selected learners has a valid email address.' : 'Today\'s e-mail allowance is used up. Try again tomorrow.');
    queueMailMany_(send.map(s => ({ to:s.Email, subject:SCHOOL + ' - Enrollment status update',
      body:'Hello ' + (s.FirstName || '') + ',\n\nYour enrollment status is now: ' + (s.EnrollStatus || 'Not Enrolled').toUpperCase() + '.\n\nEnrollment ID: ' + s.StudentID + '\n\n' + SCHOOL + ' Admissions Office' })));
    audit_(u, 'mail.status', send.length + ' learner(s)', 'manual');
    const skipped = ids.length - send.length;
    return ok({ queued:send.length, skipped:skipped }, send.length + ' email(s) queued, sent within about 10 minutes' + (skipped ? '; ' + skipped + ' skipped (no valid email, or over today\'s allowance)' : '') + '.');
  } catch (e) { return fail(e); }
}