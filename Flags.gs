/*****************************************************************************
 MOREH ACADEMY PORTAL - HOLDS (new file "Flags")
 Guidance / Accounting / Academic offices raise holds. While a hold is active a learner cannot be
 marked Enrolled. An Owner or Encoder may allow TEMPORARY enrollment until a deadline.
 The portal never stores or computes amounts: Accounting only marks "hold" or "cleared".
*****************************************************************************/
const OFFICE_CL = ['Guidance', 'Accounting', 'Academic'];   // also the Clearance value of each office account
const FLAG_COLS = ['FlagID','StudentID','Office','Status','Reason','Instruction','RaisedBy','RaisedAt','ClearedBy','ClearedAt'];
const TEMP_MAX_DAYS = 120;                                   // longest temporary enrollment that can be granted

const flagNow_ = () => Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

function flagSh_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); let sh = ss.getSheetByName('Flags');
  if (!sh) { sh = ss.insertSheet('Flags'); sh.getRange(1, 1, 1, FLAG_COLS.length).setValues([FLAG_COLS]).setFontWeight('bold'); sh.setFrozenRows(1); sh.getRange(1, 1, sh.getMaxRows(), FLAG_COLS.length).setNumberFormat('@'); }
  return sh;
}
function flagRows_() {
  const sh = flagSh_(), n = sh.getLastRow() - 1;
  return n < 1 ? [] : sh.getRange(2, 1, n, FLAG_COLS.length).getValues().map((r, i) => { const o = { _r:i + 2 }; FLAG_COLS.forEach((c, j) => o[c] = String(r[j])); return o; });
}
/** { StudentID: ['Guidance', ...] } for ACTIVE holds only. */
function activeFlags_() { const m = {}; flagRows_().forEach(f => { if (f.Status === 'Active') (m[f.StudentID] || (m[f.StudentID] = [])).push(f.Office); }); return m; }
const holdsOf_ = id => activeFlags_()[String(id)] || [];
/** What a student may see: office and instruction only, never the internal reason. */
function studentHolds_(id) { return flagRows_().filter(f => f.StudentID === id && f.Status === 'Active').map(f => ({ Office:f.Office, Instruction:f.Instruction })); }

/** Owner, Encoder or an office account. office = the account's own office ('' for Owner / Encoder). */
function flagUser_(token) {
  const u = who_(token);                                   // any signed-in role
  if (u.Role !== 'admin' || ACAD_ROLES.indexOf(u.Clearance) >= 0) throw new Error('Not allowed.');
  return { u:u, office:OFFICE_CL.indexOf(u.Clearance) >= 0 ? u.Clearance : '' };
}

/** Minimal learner lookup for the Desk. Matches name, LRN or ID but never returns the LRN. */
function flagSearch(token, q) {
  try {
    const fu = flagUser_(token); q = String(q || '').trim().toLowerCase();
    if (q.length < 3) throw new Error('Type at least 3 characters of the name, LRN or Enrollment ID.');
    const act = activeFlags_();
    return ok(studentsLite_().filter(s => (s.FullName + ' ' + s.LRN + ' ' + s.StudentID).toLowerCase().includes(q)).slice(0, 25).map(s => {
      const h = act[s.StudentID] || [];
      return { StudentID:s.StudentID, FullName:s.FullName, GradeLevel:s.GradeLevel, Section:s.Section, SchoolYear:s.SchoolYear, EnrollStatus:s.EnrollStatus,
        Holds:fu.office ? h.filter(o => o === fu.office) : h };
    }));
  } catch (e) { return fail(e); }
}

/** Holds of one learner. The internal reason is returned only to the Owner and to the office that raised it. */
function flagList(token, studentId) {
  try {
    const fu = flagUser_(token), id = String(studentId || ''), owner = isFull_(fu.u);
    return ok(flagRows_().filter(f => f.StudentID === id && (!fu.office || f.Office === fu.office)).map(f => ({
      FlagID:f.FlagID, Office:f.Office, Status:f.Status, Instruction:f.Instruction, RaisedBy:f.RaisedBy, RaisedAt:f.RaisedAt, ClearedBy:f.ClearedBy, ClearedAt:f.ClearedAt,
      Reason:(owner || fu.office === f.Office) ? f.Reason : '' })).sort((a, b) => b.RaisedAt.localeCompare(a.RaisedAt)));
  } catch (e) { return fail(e); }
}

/** Office account (its own office) or Owner (any office). Encoders cannot raise holds. */
function raiseFlag(token, studentId, office, reason, instruction) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const fu = flagUser_(token);
    if (!fu.office && !isFull_(fu.u)) throw new Error('Only the Guidance, Accounting and Academic offices can raise holds.');
    office = fu.office || String(office || '');
    if (OFFICE_CL.indexOf(office) < 0) throw new Error('Choose an office.');
    const id = String(studentId || ''); if (!findStudent_(id)) throw new Error('Learner not found.');
    reason = String(reason || '').trim().slice(0, 300); instruction = String(instruction || '').trim().slice(0, 200);
    if (!reason) throw new Error('Enter a short internal reason.');
    if (flagRows_().some(f => f.StudentID === id && f.Office === office && f.Status === 'Active')) throw new Error('This learner already has an active ' + office + ' hold.');
    const sh = flagSh_();
    put_(sh, sh.getLastRow() + 1, 1, [['FL' + Date.now(), id, office, 'Active', reason, instruction, fu.u.Username, flagNow_(), '', '']]);
    audit_(fu.u, 'flag.raise', id, office);
    return ok(null, office + ' hold raised');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

/** Office account (its own holds) or Owner (any hold). */
function clearFlag(token, flagId) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const fu = flagUser_(token);
    if (!fu.office && !isFull_(fu.u)) throw new Error('Only the office that raised a hold can clear it.');
    const f = flagRows_().find(x => x.FlagID === String(flagId));
    if (!f) throw new Error('Hold not found.');
    if (f.Status !== 'Active') throw new Error('This hold is already cleared.');
    if (fu.office && fu.office !== f.Office) throw new Error('Not allowed.');
    put_(flagSh_(), f._r, 4, [['Cleared', f.Reason, f.Instruction, f.RaisedBy, f.RaisedAt, fu.u.Username, flagNow_()]]);
    audit_(fu.u, 'flag.clear', f.StudentID, f.Office);
    const left = holdsOf_(f.StudentID);
    return ok(null, f.Office + ' hold cleared' + (left.length ? '. Still on hold: ' + left.join(', ') : '. No holds remain.'));
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

/** Owner or Encoder (office accounts are rejected by who_). Enrolls a held learner on condition, until a deadline. */
function grantTemporary(token, studentId, until, reason) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const u = who_(token, 'admin'), id = String(studentId || ''), hit = findStudent_(id), tz = Session.getScriptTimeZone();
    if (!hit) throw new Error('Learner not found.');
    const row = hit.o, was = row.EnrollStatus, d = String(until || '').trim(), why = String(reason || '').trim().slice(0, 200);
    if (['Enrolled', 'Temporary', 'Cancelled', 'Transferred Out'].includes(was)) throw new Error('Temporary enrollment can only be granted to a learner who is not yet enrolled.');
    if (!holdsOf_(id).length) throw new Error('This learner has no active hold. Mark the learner Enrolled instead.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('Choose the deadline date.');
    const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'), max = Utilities.formatDate(new Date(Date.now() + TEMP_MAX_DAYS * 864e5), tz, 'yyyy-MM-dd');
    if (d <= today) throw new Error('The deadline must be a future date.');
    if (d > max) throw new Error('The deadline can be at most ' + TEMP_MAX_DAYS + ' days from today.');
    if (!why) throw new Error('Enter the reason for allowing temporary enrollment.');
    row.EnrollStatus = 'Temporary'; row.TempUntil = d; row.TempBy = u.FullName || u.Username; row.TempReason = why;
    stampAudit_(row, u);
    put_(sh_('S'), hit.r, 1, [COLS.map(c => row[c] || '')]);
    logStatus_([logRow_(row, was, u)]);
    audit_(u, 'flag.temporary', id, 'until ' + d);
    return ok(null, 'Temporary enrollment allowed until ' + d);
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

/** Data for the Holds page (Owner / Encoder) and the Desk (office accounts). */
function holdsOverview(token) {
  try {
    const fu = flagUser_(token), owner = isFull_(fu.u), rows = flagRows_(), lite = {}, act = {};
    studentsLite_().forEach(s => lite[s.StudentID] = s);
    rows.forEach(f => { if (f.Status === 'Active') (act[f.StudentID] || (act[f.StudentID] = [])).push(f.Office); });
    const flags = rows.filter(f => f.Status === 'Active' && (!fu.office || f.Office === fu.office)).map(f => { const s = lite[f.StudentID] || {};
      return { FlagID:f.FlagID, StudentID:f.StudentID, FullName:s.FullName || f.StudentID, GradeLevel:s.GradeLevel || '', Section:s.Section || '', Office:f.Office,
        Instruction:f.Instruction, RaisedBy:f.RaisedBy, RaisedAt:f.RaisedAt, Reason:(owner || fu.office === f.Office) ? f.Reason : '' }; })
      .sort((a, b) => b.RaisedAt.localeCompare(a.RaisedAt)).slice(0, 500);
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const temps = fu.office ? [] : Object.keys(lite).map(k => lite[k]).filter(s => s.EnrollStatus === 'Temporary').map(s => ({ StudentID:s.StudentID, FullName:s.FullName,
      GradeLevel:s.GradeLevel, Section:s.Section, TempUntil:s.TempUntil || '', Overdue:!!s.TempUntil && s.TempUntil < today, Holds:act[s.StudentID] || [] }));
    return ok({ me:{ office:fu.office, owner:owner }, flags:flags, temps:temps });
  } catch (e) { return fail(e); }
}

/** Removes the hold rows of one learner or a list of learners (used by delete and by retention). */
function purgeFlags_(ids) {
  try {
    const want = {}; [].concat(ids).forEach(i => want[String(i)] = 1);
    const nums = flagRows_().filter(f => want[f.StudentID]).map(f => f._r);
    if (nums.length) deleteRowNums_(flagSh_(), nums);
  } catch (e) { Logger.log('purgeFlags: ' + e.message); }
}