/*****************************************************************************
 MOREH ACADEMY PORTAL - RETENTION (new file "Retention")
 Makes the privacy-policy promise real: applications that were never enrolled are archived and
 removed after RETAIN_APPL_MONTHS, and the "Deleted Students" archive is emptied after RETAIN_DELETED_DAYS.
 Requires Security, Protection, Hardening, Speed, ReEnroll. DELETE the old retentionReview in Hardening.
*****************************************************************************/
const RETAIN_APPL_MONTHS = 12, RETAIN_DELETED_DAYS = 90, RETAIN_MAX_PER_RUN = 150;

/** Applications that were never enrolled and are past the retention period. */
function staleApplications_() {
  const tz = Session.getScriptTimeZone(), c = new Date(); c.setMonth(c.getMonth() - RETAIN_APPL_MONTHS);
  const cut = Utilities.formatDate(c, tz, 'yyyy-MM-dd HH:mm:ss'), sy = activeSY_(), seen = {}, hs = histSh_();
  if (hs.getLastRow() > 1) hs.getRange(2, 1, hs.getLastRow() - 1, 1).getValues().flat().forEach(v => seen[String(v)] = 1);
  return rows_('S').filter(s => s.EnrollStatus === 'Not Enrolled' && s.CreatedAt && s.CreatedAt < cut && s.SchoolYear && s.SchoolYear < sy && !seen[s.StudentID]);
}

/** OWNER ONLY (editor). Preview: lists what the next run would remove. Changes nothing. */
function retentionReview() {
  ownerOnly_();
  const list = staleApplications_().map(s => s.StudentID + '  ' + s.FullName + '  created ' + s.CreatedAt.slice(0, 10) + '  SY ' + s.SchoolYear);
  Logger.log(list.length + ' application(s) never enrolled and older than ' + RETAIN_APPL_MONTHS + ' months (a run removes at most ' + RETAIN_MAX_PER_RUN + '):\n' + list.join('\n'));
  return list;
}

/** One write for the whole batch. Same sheet and columns as archiveStudent_. */
function archiveMany_(recs, actor) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), head = ['DeletedAt', 'DeletedBy'].concat(COLS); let sh = ss.getSheetByName('Deleted Students');
  if (!sh) { sh = ss.insertSheet('Deleted Students'); sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold'); sh.setFrozenRows(1); }
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  put_(sh, sh.getLastRow() + 1, 1, recs.map(r => [now, actor.Username].concat(COLS.map(c => r[c] || ''))));
}

/** Deletes whole rows (row numbers, 1-based) from the bottom up, grouping neighbours into one call. */
function deleteRowNums_(sh, nums) {
  nums.sort((a, b) => a - b);
  for (let k = nums.length - 1; k >= 0;) { let j = k; while (j > 0 && nums[j - 1] === nums[j] - 1) j--; sh.deleteRows(nums[j], k - j + 1); k = j - 1; }
}

/** Archives, then removes, stale applications with their portal logins and profile photos. Returns how many were removed. */
function disposeApplications_(actor) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('The service is busy.');
  try {
    const stale = staleApplications_().slice(0, RETAIN_MAX_PER_RUN); if (!stale.length) return 0;
    const ids = {}; stale.forEach(s => ids[s.StudentID] = 1);
    const all = rows_('S'), sNums = []; all.forEach((r, i) => { if (ids[r.StudentID]) sNums.push(i + 2); });
    if (!sNums.length || sNums.length >= all.length) return 0;                       // never wipe the whole sheet
    try { doBackup_(); } catch (_) {}                                                // safety copy first
    archiveMany_(stale, actor);                                                      // archive BEFORE deleting
    stale.forEach(s => { if (s.IDPhotoID) { try { DriveApp.getFileById(s.IDPhotoID).setTrashed(true); } catch (_) {} } });
    purgeFlags_(stale.map(s => s.StudentID));
    deleteRowNums_(sh_('S'), sNums);
    const users = rows_('U'), uNums = [];
    users.forEach((u, i) => { if (u.Role === 'student' && ids[u.StudentID]) { uNums.push(i + 2); if (u.PhotoID) { try { DriveApp.getFileById(u.PhotoID).setTrashed(true); } catch (_) {} } } });
    if (uNums.length && uNums.length < users.length) deleteRowNums_(sh_('U'), uNums);
    stBump_(); uvBump_();
    audit_(actor, 'retention.applications', sNums.length + ' record(s)', 'archived then removed');
    return sNums.length;
  } finally { try { lock.releaseLock(); } catch (_) {} }
}

/** Empties archive rows older than RETAIN_DELETED_DAYS. Returns how many were removed. */
function purgeDeletedArchive_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Deleted Students'); if (!sh || sh.getLastRow() < 2) return 0;
  const tz = Session.getScriptTimeZone(), cut = Utilities.formatDate(new Date(Date.now() - RETAIN_DELETED_DAYS * 864e5), tz, 'yyyy-MM-dd HH:mm:ss');
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().flat().map(x => x instanceof Date ? Utilities.formatDate(x, tz, 'yyyy-MM-dd HH:mm:ss') : String(x));
  let k = 0; while (k < v.length && v[k] && v[k] < cut) k++;
  if (!k) return 0;
  if (k >= v.length) { if (k > 1) sh.deleteRows(3, k - 1); sh.getRange(2, 1, 1, sh.getLastColumn()).clearContent(); }   // a sheet cannot lose all non-frozen rows
  else sh.deleteRows(2, k);
  audit_('system:retention', 'retention.archive', k + ' row(s)', 'older than ' + RETAIN_DELETED_DAYS + ' days');
  return k;
}

/** Trigger target (monthly). */
function monthlyRetention() {
  try {
    const a = disposeApplications_({ Username: 'system:retention', Role: '' }), d = purgeDeletedArchive_();
    if (a || d) alert_('retention', 'Retention run finished', a + ' unenrolled application(s) archived and removed. ' + d + ' old archive row(s) purged.');
  } catch (e) { alert_('retfail', 'Retention run FAILED', String(e.message)); }
}

/** OWNER ONLY (editor). Run the retention job now. Run retentionReview first. */
function retentionRunNow() {
  ownerOnly_();
  const a = disposeApplications_({ Username: 'system:retention', Role: '' }), d = purgeDeletedArchive_();
  Logger.log(a + ' application(s) archived and removed. ' + d + ' old archive row(s) purged.');
}

/** OWNER ONLY (editor). Run once: installs the monthly job (1st of each month, about 3 AM). */
function installRetentionTrigger() {
  ownerOnly_();
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'monthlyRetention').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('monthlyRetention').timeBased().onMonthDay(1).atHour(3).create();
  Logger.log('Monthly retention job installed.');
}