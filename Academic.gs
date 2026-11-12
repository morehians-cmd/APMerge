/** MOREH ACADEMY PORTAL - Academic.gs (Phase B)
 *  Head Teacher / Teacher accounts (level-scoped), subjects, teacher loads, section advisers,
 *  class lists, and the read-only adviser learner view.
 *
 *  Design: Teachers and Head Teachers are Role 'admin' with Clearance 'Teacher' / 'HeadTeacher'
 *  (same pattern as your office accounts). Their level scope lives in the new 'Academic Staff'
 *  sheet, so UCOLS is NOT touched. Every function here is deny-by-default.
 *  Uses only helpers already called in Code.gs: who_, owner_, ok, fail, audit_, auditView_, findRow_,
 *  rows_, rowsSY_, addUser_, tempPw_, otpOn_, EMAIL_RE, activeSY_, GRADES, CL, SEC, FIELDS, age_.
 *  who_(token,'admin') must be extended to refuse ACAD_ROLES (see Phase-B-patches.txt, edit 1).
 *  Deploy a NEW version after pasting. Sheets are created automatically on first use. */

const ACAD_ROLES = ['HeadTeacher', 'Teacher'];
/** Preschool (Nursery - Kinder 2) is under the Elementary Head Teacher. Lazy, so file load order never matters. */
const acLevels_ = () => ({
  'Elementary': GRADES.slice(0, 9),
  'Junior High School': GRADES.slice(9, 13),
  'Senior High - Grade 11': ['Grade 11'],
  'Senior High - Grade 12': ['Grade 12']
});
const AC_SUBJ = ['SubjectID', 'SchoolYear', 'GradeLevel', 'Cluster', 'SubjectName', 'UpdatedAt', 'UpdatedBy'];
const AC_LOAD = ['LoadID', 'SchoolYear', 'Teacher', 'SubjectID', 'GradeLevel', 'Cluster', 'Section', 'UpdatedAt', 'UpdatedBy'];
const AC_ADV = ['SchoolYear', 'GradeLevel', 'Cluster', 'Section', 'Teacher', 'UpdatedAt', 'UpdatedBy'];
const AC_STAFF = ['Username', 'Role', 'Scope', 'CreatedAt', 'CreatedBy'];

/* ---------- small helpers ---------- */
function acSh_(name, cols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold'); sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
  }
  return sh;
}
function acRows_(name, cols) {
  const sh = acSh_(name, cols); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, cols.length).getValues().map((r, i) => {
    const o = { _row: i + 2 }; cols.forEach((c, j) => o[c] = String(r[j])); return o;
  });
}
function acAppend_(name, cols, rows) {
  if (!rows.length) return; const sh = acSh_(name, cols);
  put_(sh, sh.getLastRow() + 1, 1, rows);
}
/** Write one row (insert at the end, or overwrite row n). put_ grows the sheet and keeps the cells as plain text. */
function acPut_(sh, n, cols, rec) { put_(sh, n || sh.getLastRow() + 1, 1, [cols.map(k => rec[k] || '')]); }
const acNow_ = () => Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
const acId_ = p => p + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase();
const acStrip_ = o => { const r = {}; Object.keys(o).forEach(k => { if (k[0] !== '_') r[k] = o[k]; }); return r; };
const acShs_ = g => g === 'Grade 11' || g === 'Grade 12';
const acSecKey_ = (g, cl) => g + (cl ? '|' + cl : '');
/** Senior High needs a cluster key (STEM, ASSH...). Other levels always ''. */
function acCluster_(g, cl) {
  if (!acShs_(g)) return '';
  if (!CL[cl]) throw new Error('Select the cluster for ' + g + '.');
  return cl;
}
function acClean_(v, max) {
  v = String(v == null ? '' : v).trim().slice(0, max);
  if (/^[=@\t\r]/.test(v)) throw new Error('Text cannot start with = or @.');
  return v;
}
function acInScope_(c, g) { if (c.grades.indexOf(g) < 0) throw new Error('"' + g + '" is outside your level.'); }

/** Resolves who is calling. Owner = all levels. HeadTeacher = own level. Teacher = no management rights. */
function acCtx_(token) {
  const u = who_(token);                                     // NOT who_(token,'admin'): that call rejects teacher accounts by design
  if (u.Role !== 'admin') throw new Error('Not allowed.');
  if (u.Clearance === 'Full') return { u: u, role: 'Owner', isMgr: true, grades: GRADES.slice(), scopeName: 'All levels' };
  if (ACAD_ROLES.indexOf(u.Clearance) < 0) throw new Error('Not allowed.');
  const un = String(u.Username).toLowerCase();
  const st = acRows_('Academic Staff', AC_STAFF).find(x => x.Username === un);
  if (!st || st.Role !== u.Clearance) throw new Error('Your academic account is not set up yet. Please contact the administrator.');
  const lv = acLevels_()[st.Scope];
  if (u.Clearance === 'HeadTeacher' && !lv) throw new Error('Your level is not set. Please contact the administrator.');
  return { u: u, role: u.Clearance, isMgr: u.Clearance === 'HeadTeacher', grades: lv || [], scopeName: st.Scope || 'Teacher' };
}
function acMgr_(token) { const c = acCtx_(token); if (!c.isMgr) throw new Error('Not allowed.'); return c; }
/** A valid, active teacher or head teacher account. */
function acTeacher_(username) {
  const un = String(username || '').trim().toLowerCase();
  const st = acRows_('Academic Staff', AC_STAFF).find(x => x.Username === un);
  const us = rows_('U').find(x => x.Username === un && x.Role === 'admin' && ACAD_ROLES.indexOf(x.Clearance) >= 0 && x.Disabled !== '1');
  if (!st || !us) throw new Error('Select a valid, active teacher.');
  return { Username: un, FullName: us.FullName };
}

/* ---------- accounts (Owner only) ---------- */
/** Creates a Head Teacher (with a level) or a Teacher. No email is sent automatically (free Gmail policy): the temporary password is shown once. */
function createAcademicStaff(token, f) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); const ou = owner_(token);
    const role = ACAD_ROLES.indexOf(f.role) >= 0 ? f.role : '';
    if (!role) throw new Error('Select Head Teacher or Teacher.');
    const scope = role === 'HeadTeacher' ? String(f.scope || '') : '';
    if (role === 'HeadTeacher' && !acLevels_()[scope]) throw new Error('Select the level of the Head Teacher.');
    const un = String(f.username || '').trim().toLowerCase(), name = String(f.fullName || '').trim().toUpperCase(), em = String(f.email || '').trim();
    let pw = String(f.password || '');
    if (!name) throw new Error('Full name is required.');
    if (!/^[a-z0-9._@-]{4,40}$/.test(un)) throw new Error('Username must be 4-40 characters (letters, numbers, . _ @ -).');
    if (rows_('U').some(u => u.Username === un)) throw new Error('This username already exists.');
    if (em && !EMAIL_RE.test(em)) throw new Error('Enter a valid email address.');
    if (otpOn_() && !em) throw new Error('An email address is required: staff sign-in codes are switched on.');
    if (pw && pw.length < 8) throw new Error('Password must be at least 8 characters.');
    if (!pw) pw = tempPw_();
    addUser_(un, pw, 'admin', name, '', em, true, role === 'HeadTeacher' ? 'Head Teacher' : 'Teacher', role);
    acAppend_('Academic Staff', AC_STAFF, [[un, role, scope, acNow_(), ou.Username]]);
    audit_(ou, 'academic.staff.create', un, role + (scope ? ' / ' + scope : ''));
    return ok({ username: un, password: pw }, role === 'HeadTeacher' ? 'Head Teacher account created' : 'Teacher account created');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}
/** Names and roles only. Head Teachers need this list to assign loads. */
function listAcademicStaff(token) {
  try {
    acMgr_(token); const us = {}; rows_('U').forEach(x => us[x.Username] = x);
    return ok(acRows_('Academic Staff', AC_STAFF).filter(s => us[s.Username] && us[s.Username].Disabled !== '1')
      .map(s => ({ Username: s.Username, FullName: us[s.Username].FullName, Role: s.Role, Scope: s.Scope })));
  } catch (e) { return fail(e); }
}

/* ---------- main data load ---------- */
function acadBootstrap(token) {
  try {
    const c = acCtx_(token), sy = activeSY_(), me = String(c.u.Username).toLowerCase();
    const subj = acRows_('Subjects', AC_SUBJ).filter(s => s.SchoolYear === sy);
    const loads = acRows_('Teacher Loads', AC_LOAD).filter(l => l.SchoolYear === sy);
    const adv = acRows_('Advisers', AC_ADV).filter(a => a.SchoolYear === sy);
    const nm = {}; subj.forEach(s => nm[s.SubjectID] = s.SubjectName);
    const inS = g => c.grades.indexOf(g) >= 0;
    return ok({
      sy: sy, role: c.role, isMgr: c.isMgr, scope: c.scopeName, grades: c.grades,
      subjects: c.isMgr ? subj.filter(s => inS(s.GradeLevel)).map(acStrip_) : [],
      loads: c.isMgr ? loads.filter(l => inS(l.GradeLevel)).map(acStrip_) : [],
      advisers: c.isMgr ? adv.filter(a => inS(a.GradeLevel)).map(acStrip_) : [],
      mine: {
        loads: loads.filter(l => l.Teacher === me).map(l => Object.assign(acStrip_(l), { SubjectName: nm[l.SubjectID] || '' })),
        advisory: adv.filter(a => a.Teacher === me).map(acStrip_)
      }
    });
  } catch (e) { return fail(e); }
}

/* ---------- subjects ---------- */
/** New subject: { GradeLevel, Cluster, SubjectName }. Rename: { SubjectID, SubjectName } (grade and cluster never change). */
function saveSubject(token, s) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); const c = acMgr_(token), sy = activeSY_(), all = acRows_('Subjects', AC_SUBJ);
    const old = s.SubjectID ? all.find(x => x.SubjectID === s.SubjectID && x.SchoolYear === sy) : null;
    if (s.SubjectID && !old) throw new Error('Subject not found.');
    const g = old ? old.GradeLevel : String(s.GradeLevel || ''); acInScope_(c, g);
    const cl = old ? old.Cluster : acCluster_(g, String(s.Cluster || '')), name = acClean_(s.SubjectName, 80);
    if (!name) throw new Error('Enter the subject name.');
    if (all.some(x => x.SchoolYear === sy && x.GradeLevel === g && x.Cluster === cl && x.SubjectName.toLowerCase() === name.toLowerCase() && (!old || x.SubjectID !== old.SubjectID)))
      throw new Error('This subject already exists for ' + g + (cl ? ' ' + cl : '') + '.');
    const rec = { SubjectID: old ? old.SubjectID : acId_('SB'), SchoolYear: sy, GradeLevel: g, Cluster: cl, SubjectName: name, UpdatedAt: acNow_(), UpdatedBy: c.u.Username };
    const sh = acSh_('Subjects', AC_SUBJ);
    acPut_(sh, old ? old._row : 0, AC_SUBJ, rec);
    audit_(c.u, old ? 'subject.rename' : 'subject.create', rec.SubjectID, g + (cl ? ' ' + cl : '') + ': ' + name);
    return ok(acStrip_(rec), 'Subject saved');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}
function deleteSubject(token, id) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); const c = acMgr_(token), sy = activeSY_();
    const s = acRows_('Subjects', AC_SUBJ).find(x => x.SubjectID === id && x.SchoolYear === sy);
    if (!s) throw new Error('Subject not found.'); acInScope_(c, s.GradeLevel);
    if (acRows_('Teacher Loads', AC_LOAD).some(l => l.SubjectID === id)) throw new Error('Remove this subject\u2019s teacher loads first.');
    acSh_('Subjects', AC_SUBJ).deleteRow(s._row);
    audit_(c.u, 'subject.delete', id, s.GradeLevel + ': ' + s.SubjectName);
    return ok(null, 'Subject removed');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

/* ---------- teacher loads (one teacher per subject per section; saving again reassigns) ---------- */
function saveLoad(token, l) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); const c = acMgr_(token), sy = activeSY_();
    const subj = acRows_('Subjects', AC_SUBJ).find(x => x.SubjectID === l.SubjectID && x.SchoolYear === sy);
    if (!subj) throw new Error('Select a subject.'); acInScope_(c, subj.GradeLevel);
    const sec = String(l.Section || '').toUpperCase();
    if ((SEC[acSecKey_(subj.GradeLevel, subj.Cluster)] || []).indexOf(sec) < 0) throw new Error('Select a valid section.');
    const t = acTeacher_(l.Teacher), all = acRows_('Teacher Loads', AC_LOAD);
    const old = all.find(x => x.SchoolYear === sy && x.SubjectID === subj.SubjectID && x.Section === sec);
    const rec = { LoadID: old ? old.LoadID : acId_('LD'), SchoolYear: sy, Teacher: t.Username, SubjectID: subj.SubjectID, GradeLevel: subj.GradeLevel, Cluster: subj.Cluster, Section: sec, UpdatedAt: acNow_(), UpdatedBy: c.u.Username };
    const sh = acSh_('Teacher Loads', AC_LOAD);
    acPut_(sh, old ? old._row : 0, AC_LOAD, rec);
    audit_(c.u, old ? 'load.reassign' : 'load.create', rec.LoadID, subj.SubjectName + ' ' + subj.GradeLevel + ' ' + sec + ' -> ' + t.Username);
    return ok(acStrip_(rec), old ? 'Teacher reassigned' : 'Load saved');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}
function deleteLoad(token, id) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); const c = acMgr_(token), sy = activeSY_();
    const l = acRows_('Teacher Loads', AC_LOAD).find(x => x.LoadID === id && x.SchoolYear === sy);
    if (!l) throw new Error('Load not found.'); acInScope_(c, l.GradeLevel);
    acSh_('Teacher Loads', AC_LOAD).deleteRow(l._row);
    audit_(c.u, 'load.delete', id, l.GradeLevel + ' ' + l.Section + ' -> ' + l.Teacher);
    return ok(null, 'Load removed');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

/* ---------- section advisers (one adviser per section) ---------- */
function saveAdviser(token, a) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); const c = acMgr_(token), sy = activeSY_();
    const g = String(a.GradeLevel || ''); acInScope_(c, g);
    const cl = acCluster_(g, String(a.Cluster || '')), sec = String(a.Section || '').toUpperCase();
    if ((SEC[acSecKey_(g, cl)] || []).indexOf(sec) < 0) throw new Error('Select a valid section.');
    const t = acTeacher_(a.Teacher), old = acRows_('Advisers', AC_ADV).find(x => x.SchoolYear === sy && x.GradeLevel === g && x.Cluster === cl && x.Section === sec);
    const rec = { SchoolYear: sy, GradeLevel: g, Cluster: cl, Section: sec, Teacher: t.Username, UpdatedAt: acNow_(), UpdatedBy: c.u.Username };
    const sh = acSh_('Advisers', AC_ADV);
    acPut_(sh, old ? old._row : 0, AC_ADV, rec);
    audit_(c.u, 'adviser.set', g + ' ' + sec, t.Username);
    return ok(acStrip_(rec), 'Adviser saved');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}
function deleteAdviser(token, a) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); const c = acMgr_(token), sy = activeSY_();
    const x = acRows_('Advisers', AC_ADV).find(r => r.SchoolYear === sy && r.GradeLevel === a.GradeLevel && r.Cluster === String(a.Cluster || '') && r.Section === a.Section);
    if (!x) throw new Error('Adviser not found.'); acInScope_(c, x.GradeLevel);
    acSh_('Advisers', AC_ADV).deleteRow(x._row);
    audit_(c.u, 'adviser.remove', x.GradeLevel + ' ' + x.Section, x.Teacher);
    return ok(null, 'Adviser removed');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

/** Copies last school year's subjects, loads and advisers (within the caller's level) into the active year.
 *  Skips anything that already exists, and loads/advisers whose teacher is no longer active. */
function copyForward(token) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); const c = acMgr_(token), sy = activeSY_(), y = parseInt(sy.slice(0, 4), 10), py = (y - 1) + '-' + y;
    const inS = g => c.grades.indexOf(g) >= 0, now = acNow_(), by = c.u.Username;
    const S0 = acRows_('Subjects', AC_SUBJ), L0 = acRows_('Teacher Loads', AC_LOAD), A0 = acRows_('Advisers', AC_ADV);
    const key = x => x.GradeLevel + '|' + x.Cluster + '|' + x.SubjectName.toLowerCase(), cur = S0.filter(x => x.SchoolYear === sy);
    const map = {}, nS = [], nL = [], nA = [], ok_ = {};
    const valid = u => { if (!(u in ok_)) { try { acTeacher_(u); ok_[u] = 1; } catch (_) { ok_[u] = 0; } } return ok_[u]; };
    S0.filter(x => x.SchoolYear === py && inS(x.GradeLevel)).forEach(p => {
      const ex = cur.find(x => key(x) === key(p));
      if (ex) { map[p.SubjectID] = ex.SubjectID; return; }
      const id = acId_('SB'); map[p.SubjectID] = id; nS.push([id, sy, p.GradeLevel, p.Cluster, p.SubjectName, now, by]);
    });
    const curL = L0.filter(x => x.SchoolYear === sy);
    L0.filter(x => x.SchoolYear === py && inS(x.GradeLevel) && map[x.SubjectID]).forEach(p => {
      if (curL.some(x => x.SubjectID === map[p.SubjectID] && x.Section === p.Section)) return;
      if ((SEC[acSecKey_(p.GradeLevel, p.Cluster)] || []).indexOf(p.Section) < 0 || !valid(p.Teacher)) return;
      nL.push([acId_('LD'), sy, p.Teacher, map[p.SubjectID], p.GradeLevel, p.Cluster, p.Section, now, by]);
    });
    const curA = A0.filter(x => x.SchoolYear === sy);
    A0.filter(x => x.SchoolYear === py && inS(x.GradeLevel)).forEach(p => {
      if (curA.some(x => x.GradeLevel === p.GradeLevel && x.Cluster === p.Cluster && x.Section === p.Section)) return;
      if ((SEC[acSecKey_(p.GradeLevel, p.Cluster)] || []).indexOf(p.Section) < 0 || !valid(p.Teacher)) return;
      nA.push([sy, p.GradeLevel, p.Cluster, p.Section, p.Teacher, now, by]);
    });
    acAppend_('Subjects', AC_SUBJ, nS); acAppend_('Teacher Loads', AC_LOAD, nL); acAppend_('Advisers', AC_ADV, nA);
    audit_(c.u, 'academic.copyforward', py + ' -> ' + sy, nS.length + ' subjects, ' + nL.length + ' loads, ' + nA.length + ' advisers');
    return ok({ subjects: nS.length, loads: nL.length, advisers: nA.length },
      'Copied ' + nS.length + ' subject(s), ' + nL.length + ' load(s) and ' + nA.length + ' adviser(s) from ' + py + '.');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

/* ---------- class list (minimal data) ---------- */
/** Subject teacher: ID, name, sex. Adviser or Head Teacher: also LRN and parent / emergency contact. Active learners only. */
function getClassRoster(token, grade, cluster, section) {
  try {
    const c = acCtx_(token), sy = activeSY_(), me = String(c.u.Username).toLowerCase();
    grade = String(grade || ''); cluster = acCluster_(grade, String(cluster || '')); section = String(section || '').toUpperCase();
    const adv = acRows_('Advisers', AC_ADV).some(a => a.SchoolYear === sy && a.GradeLevel === grade && a.Cluster === cluster && a.Section === section && a.Teacher === me);
    const teaches = acRows_('Teacher Loads', AC_LOAD).some(l => l.SchoolYear === sy && l.GradeLevel === grade && l.Cluster === cluster && l.Section === section && l.Teacher === me);
    const mgr = c.isMgr && c.grades.indexOf(grade) >= 0;
    if (!adv && !teaches && !mgr) throw new Error('You are not assigned to this class.');
    const full = adv || mgr;
    const rows = rowsSY_().filter(r => r.GradeLevel === grade && (r.Section || '') === section && (!cluster || r.Cluster === CL[cluster]) && (r.EnrollStatus === 'Enrolled' || r.EnrollStatus === 'Temporary'))
      .sort((a, b) => String(a.FullName).localeCompare(String(b.FullName)))
      .map(r => full
        ? { StudentID: r.StudentID, FullName: r.FullName, Sex: r.SexualOrient, LRN: r.LRN, EmName: r.EmName, EmRelation: r.EmRelation, EmMobile: r.EmMobile }
        : { StudentID: r.StudentID, FullName: r.FullName, Sex: r.SexualOrient });
    audit_(c.u, 'roster.view', grade + (cluster ? ' ' + cluster : '') + ' ' + section, adv ? 'adviser' : mgr ? 'head' : 'teacher');
    return ok({ rows: rows, full: full, adviser: adv });
  } catch (e) { return fail(e); }
}

/* ---------- adviser learner view (everything except holds, cancellation / transfer data, audit trail) ---------- */
const AC_HIDE_SEC = ['cancel', 'dest', 'audit'];
const AC_HIDE_KEY = ['ReferredBy', 'ConsentAt', 'StatusChangedAt', 'TempUntil', 'TempBy', 'TempReason', 'IDPhotoID', 'EscCertNo', 'VoucherCertNo', 'EscSchoolNo'];
const AC_HIDDEN_OK = ['FullName', 'Province', 'IDNumber'];
/** Strips a record for the adviser. Built from FIELDS so new fields in the hidden/cancel/dest/audit areas never leak. */
function adviseeView_(s) {
  const out = { StudentID: s.StudentID };
  FIELDS.forEach(f => {
    const k = f[1];
    if (AC_HIDE_SEC.indexOf(f[0]) >= 0 || AC_HIDE_KEY.indexOf(k) >= 0) return;
    if (f[0] === 'hidden' && AC_HIDDEN_OK.indexOf(k) < 0) return;
    out[k] = s[k] || '';
  });
  out.Age = age_(s.Birthdate); out.RelAge = age_(s.RelBirthdate);
  out.EnrollStatus = 'Enrolled';            // a Temporary learner looks like any other enrollee (that would reveal a hold)
  return out;
}
function getAdvisee(token, id) {
  try {
    const c = acCtx_(token), sy = activeSY_(), me = String(c.u.Username).toLowerCase();
    const hit = findRow_('S', 'StudentID', String(id || '')), s = hit && hit.o, deny = 'Learner not found in your advisory class.';
    if (!s || s.SchoolYear !== sy || (s.EnrollStatus !== 'Enrolled' && s.EnrollStatus !== 'Temporary')) throw new Error(deny);
    const cl = Object.keys(CL).find(k => CL[k] === s.Cluster) || '';
    const mine = acRows_('Advisers', AC_ADV).some(a => a.SchoolYear === sy && a.Teacher === me && a.GradeLevel === s.GradeLevel && a.Cluster === cl && a.Section === (s.Section || ''));
    if (!mine) throw new Error(deny);
    auditView_(c.u, s.StudentID);
    return ok(adviseeView_(s));
  } catch (e) { return fail(e); }
}

/** OWNER / SYSTEM MANAGER. Converts an existing Academic *Office* (holds) account into a Teacher or Head Teacher.
 *  role = 'Teacher' | 'HeadTeacher'. scope is required for HeadTeacher (see acLevels_()). */
function convertToAcademicStaff(token, username, role, scope) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); const ou = owner_(token);
    const un = String(username || '').trim().toLowerCase();
    if (ACAD_ROLES.indexOf(role) < 0) throw new Error('Select Head Teacher or Teacher.');
    scope = role === 'HeadTeacher' ? String(scope || '') : '';
    if (role === 'HeadTeacher' && !acLevels_()[scope]) throw new Error('Select the level of the Head Teacher.');
    const users = rows_('U'), i = users.findIndex(u => u.Username === un && u.Role === 'admin' && OFFICE_CL.indexOf(u.Clearance) >= 0);
    if (i < 0) throw new Error('Only Guidance / Accounting / Academic office accounts can be converted.');
    const sh = sh_('U');
    put_(sh, i + 2, UCOLS.indexOf('Clearance') + 1, [[role]]);
    put_(sh, i + 2, UCOLS.indexOf('Designation') + 1, [[role === 'HeadTeacher' ? 'Head Teacher' : 'Teacher']]);
    const st = acRows_('Academic Staff', AC_STAFF).find(x => x.Username === un);
    acPut_(acSh_('Academic Staff', AC_STAFF), st ? st._row : 0, AC_STAFF,
      { Username: un, Role: role, Scope: scope, CreatedAt: acNow_(), CreatedBy: ou.Username });
    bumpSV_(un);                       // signs them out so the new role loads at next sign-in
    audit_(ou, 'academic.staff.convert', un, role + (scope ? ' / ' + scope : ''));
    return ok(null, 'Converted to ' + (role === 'HeadTeacher' ? 'Head Teacher' : 'Teacher') + '. They must sign in again.');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}