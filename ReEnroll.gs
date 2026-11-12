/*****************************************************************************
 MOREH ACADEMY PORTAL - RE-ENROLLMENT BUNDLE (add as a NEW file named "ReEnroll")
 Requires Security, Protection, Hardening, MailSwitch and StaffControl already applied.

 DESIGN: ONE ROW PER LEARNER + A YEAR HISTORY
   - The Students row always holds the CURRENT school year. The learner keeps the same Enrollment ID, LRN and portal login.
   - Re-enrolling copies the closing year into a new "Enrollment History" sheet (summary columns + a full JSON snapshot),
     then updates the same row for the new year:
        SchoolYear = active year, Classification = Old, Status = Not Enrolled, grade promoted (or kept), Section cleared,
        previous-school block = MOREH ACADEMY / last year's grade, section and scholarship,
        yearly requirements reset (see REENROLL_RESET), referral cleared.
   - Who is eligible: status Enrolled in a PREVIOUS school year. Grade 12 completers, Cancelled and Transferred Out are not carried over.
   - Reports, dashboard, notifications and scholarship counts now show ONLY the active school year, so unprocessed old rows never pollute new numbers.

 WORKFLOW EACH YEAR
   1. Owner: Enrollment Settings > "Start enrollment for next school year".
   2. Learners who must REPEAT a grade: open each record > "Re-enroll (retain grade)".
   3. Owner: Enrollment Settings > Re-enrollment > Preview > "Re-enroll all eligible (promote one grade)".
      (A backup copy of the spreadsheet is made first.)
   4. Students sign in with the same account, update their profile and bring the requirements; staff mark them Enrolled.
   For learners entering Grade 11, the Cluster is cleared and the Category should be reviewed (e.g. ESC to voucher).
*****************************************************************************/

const REENROLL_RESET = ['ReqSF9', 'ReqConsent', 'ReqRemarks', 'ReqEnvelope'];   // requirements that must be submitted again every year. Edit freely.
const HIST_COLS = ['StudentID', 'SchoolYear', 'Classification', 'Category', 'GradeLevel', 'Cluster', 'Section', 'EnrollStatus', 'ArchivedAt', 'ArchivedBy', 'Snapshot'];

const inSY_ = s => (s.SchoolYear || activeSY_()) === activeSY_();          // blank (legacy) year counts as the active year
const rowsSY_ = () => rows_('S').filter(inSY_);

function histSh_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); let sh = ss.getSheetByName('Enrollment History');
  if (!sh) { sh = ss.insertSheet('Enrollment History'); sh.getRange(1, 1, 1, HIST_COLS.length).setValues([HIST_COLS]).setFontWeight('bold'); sh.setFrozenRows(1); sh.getRange(1, 1, sh.getMaxRows(), HIST_COLS.length).setNumberFormat('@'); }
  return sh;
}
/** Summary lines only (never the snapshot) for one learner, oldest first. */
function history_(id) {
  const sh = histSh_(); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues().filter(r => String(r[0]) === id)
    .map(r => ({ SchoolYear:String(r[1]), Classification:String(r[2]), Category:String(r[3]), GradeLevel:String(r[4]), Cluster:String(r[5]), Section:String(r[6]), EnrollStatus:String(r[7]) }))
    .sort((a, b) => a.SchoolYear.localeCompare(b.SchoolYear));
}
/** Adds the history and the "can be re-enrolled" flag to a record that is sent to the browser. */
function decorate_(s, u) {
  s.History = history_(s.StudentID);
  s.NeedsReenroll = (u.Role === 'admin' && s.EnrollStatus === 'Enrolled' && s.SchoolYear && s.SchoolYear < activeSY_()) ? activeSY_() : '';
  return s;
}
function purgeHistory_(id) {
  try {
    const sh = histSh_(); if (sh.getLastRow() < 2) return;
    const col = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().flat().map(String);
    for (let k = col.length - 1; k >= 0; k--) if (col[k] === id) sh.deleteRow(k + 2);
  } catch (e) { Logger.log('purgeHistory: ' + e.message); }
}

/** o = { ids:[...] }  -> those learners (any admin / Encoder, max 50)
    o = { grade:'Grade 7' | '*' } -> everyone eligible in that grade (OWNER only)
    o.retain = true keeps the grade; o.preview = true only counts. */
function reenrollRun(token, o) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    o = o || {};
    const ids = Array.isArray(o.ids) ? o.ids.map(String).slice(0, 50) : null, u = ids ? who_(token, 'admin') : sysOwner_(token);
    const SY = activeSY_(), tz = Session.getScriptTimeZone(), all = rows_('S'), retain = !!o.retain, last = GRADES.length - 1, todo = [];
    let skipped = 0;
    all.forEach((r, i) => {
      if (r.EnrollStatus !== 'Enrolled' || !r.SchoolYear || r.SchoolYear >= SY) return;
      if (ids ? !ids.includes(r.StudentID) : (o.grade && o.grade !== '*' && r.GradeLevel !== o.grade)) return;
      const g = GRADES.indexOf(r.GradeLevel);
      if (g < 0 || (!retain && g === last)) { skipped++; return; }
      todo.push(i);
    });
    if (o.preview) {
      const m = {}; todo.forEach(i => { const g = all[i].GradeLevel; m[g] = (m[g] || 0) + 1; });
      return ok({ count:todo.length, skipped:skipped, rows:GRADES.filter(g => m[g]).map(g => [g, m[g], retain ? g : GRADES[GRADES.indexOf(g) + 1]]) });
    }
    if (!todo.length) throw new Error('Nothing to re-enroll. Only learners with status Enrolled from a previous school year can be re-enrolled; Grade 12 completers are not carried over unless you choose "retain grade".');
    if (todo.length > 1) { try { doBackup_(); } catch (_) {} }                // safety copy before a bulk change

    const now = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss'), hist = [], logs = [];
    todo.forEach(i => {
      const r = all[i], old = Object.assign({}, r), g = GRADES.indexOf(old.GradeLevel), ng = retain ? old.GradeLevel : GRADES[g + 1];
      hist.push([old.StudentID, old.SchoolYear, old.Classification, old.Category, old.GradeLevel, old.Cluster, old.Section, old.EnrollStatus, now, u.Username, JSON.stringify(old).slice(0, 49000)]);
      // previous school block = Moreh Academy, last year
      r.PrevSchool = SCHOOL; r.PrevSchoolID = SCHOOL_ID; r.PrevSY = old.SchoolYear; r.PrevGrade = old.GradeLevel; r.PrevSection = old.Section;
      r.PrevCluster = ['Grade 11', 'Grade 12'].includes(old.GradeLevel) ? old.Cluster : ''; r.PrevAdviser = ''; r.PrevAddress = '';
      r.PrevScholarship = old.Category === 'ESC' ? (old.Department === 'Junior High School' ? 'ESC JHS' : 'ESC SHS') : (['PUB-QVR', 'TLC', 'QVA PASSER'].includes(old.Category) ? old.Category : '');
      // new year
      r.SchoolYear = SY; r.Classification = 'Old'; r.GradeLevel = ng; r.Department = deptOf_(ng);
      r.Cluster = (r.Department !== 'Senior High School' || old.GradeLevel === 'Grade 10') ? '' : old.Cluster;   // entering Grade 11: learner chooses a cluster again
      r.Section = ''; r.ReferredBy = '';
      REENROLL_RESET.forEach(k => { r[k] = 'None'; if (k !== 'ReqRemarks') r[k + 'Date'] = ''; });
      ['CancelDate', 'CancelReason', 'CancelReasonOther', 'DestSchool', 'DestAddress', 'DestType', 'DestGrade'].forEach(k => r[k] = '');
      r.EnrollStatus = 'Not Enrolled'; r.Age = age_(r.Birthdate); stampAudit_(r, u);
      r.StatusChangedAt = old.StatusChangedAt || '';
      logs.push(logRow_(r, 'Enrolled', u));
    });
    const hs = histSh_(); put_(hs, hs.getLastRow() + 1, 1, hist);                 // history first: if the next write fails, nothing is lost
    put_(sh_('S'), 2, 1, all.map(r => COLS.map(c => r[c] || '')));
    logStatus_(logs);
    audit_(u, 'student.reenroll', todo.length + ' record(s)', (retain ? 'retain grade' : 'promote') + ' to ' + SY);
    if (todo.length >= 10) alert_('reenroll', 'Bulk re-enrollment', u.Username + ' re-enrolled ' + todo.length + ' learners for ' + SY + '. A backup copy was made first.');
    return ok({ done:todo.length, skipped:skipped }, todo.length + ' learner(s) re-enrolled for ' + SY + (skipped ? ' (' + skipped + ' not carried over)' : ''));
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}


