/**
 * Moreh College module — reads the standalone College SIS workbook.
 *
 * The college records live in their own spreadsheet on purpose. The K-12 side reads
 * the bound sheet positionally (liteArr_/studentsLite_ over a fixed column list) and
 * invalidates its cache on any edit to a tab named "Students", so mixing college rows
 * in there would corrupt every K-12 count and report. This module opens the college
 * workbook by id instead and never writes to the portal spreadsheet.
 *
 * Configure the workbook with the script property COLLEGE_SS_ID. The fallback below is
 * the file the office created, and the property wins when both exist, so moving the
 * workbook later needs no code change.
 */
const COLLEGE_SS_DEFAULT = '17NcpeFVAdjpWWuSz-ICfj2oDyy1A84lSimvfuGz-Hos';

const COLLEGE_TABS = {
  students: 'STUDENTS',
  subjects: 'SUBJECTS',
  fees: 'FEES',
  programFees: 'ProgramFees',
  lists: 'LISTS',
  programs: 'COLLEGE PROGRAMS'
};

/* Program cards used until the editable table exists. Codes match the workbook's
   ProgramFees sheet, so seeded rows carry the official descriptions. */
const COLLEGE_PROGRAM_SEED = [
  { code: 'BSOA', name: 'Bachelor of Science in Office Administration', dept: 'College', years: '4', active: 'Yes' },
  { code: 'BPA', name: 'Bachelor of Public Administration', dept: 'College', years: '4', active: 'Yes' },
  { code: 'BSEntrep', name: 'Bachelor of Science in Entrepreneurship', dept: 'College', years: '4', active: 'Yes' },
  { code: 'BSTM', name: 'Bachelor of Science in Tourism Management', dept: 'College', years: '4', active: 'Yes' }
];

/** Opens the college workbook, or explains why it could not be opened. */
function collegeSS_() {
  const props = PropertiesService.getScriptProperties();
  const id = String(props.getProperty('COLLEGE_SS_ID') || COLLEGE_SS_DEFAULT || '').trim();
  if (!id) throw new Error('The College workbook is not configured. Add a COLLEGE_SS_ID script property.');
  let ss = null;
  try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  if (!ss) throw new Error('The College workbook could not be opened. Check COLLEGE_SS_ID and that the account running this web app can edit that file.');
  return ss;
}

/** Header cell to an object key: "Student ID Number" becomes "studentidnumber". */
function cKey_(h) { return String(h == null ? '' : h).toLowerCase().replace(/[^a-z0-9]/g, ''); }

/** Finds a sheet ignoring case and stray spacing, so renames in the workbook stay harmless. */
function cTab_(ss, name) {
  const want = String(name).toLowerCase().replace(/\s+/g, '');
  const sheets = ss.getSheets();
  let loose = null;
  for (let i = 0; i < sheets.length; i++) {
    const got = sheets[i].getName().toLowerCase().replace(/\s+/g, '');
    if (got === want) return sheets[i];
    if (!loose && (got.indexOf(want) === 0 || want.indexOf(got) === 0)) loose = sheets[i];
  }
  return loose;
}

/** Reads a tab as header-keyed objects. Missing tab yields an empty list, never a throw. */
function cObjects_(tabName) {
  const ss = collegeSS_();
  const sh = cTab_(ss, tabName);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const head = values[0].map(cKey_);
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    let filled = false;
    const o = {};
    for (let c = 0; c < head.length; c++) {
      const v = row[c];
      if (v !== '' && v !== null && v !== undefined) filled = true;
      if (head[c]) o[head[c]] = v;
    }
    if (!filled) continue;
    o._row = r + 1;
    out.push(o);
  }
  return out;
}

function cText_(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }

/* ---------- readers ---------- */

function collegeStudents_() {
  return cObjects_(COLLEGE_TABS.students).map(r => ({
    id: cText_(r.studentidnumber),
    regNo: cText_(r.registrationnumber),
    name: cText_(r.fullname),
    birthdate: r.dateofbirth || '',
    contact: cText_(r.contactnumber),
    sex: cText_(r.gender),
    address: cText_(r.address),
    photo: cText_(r.photopath),
    program: cText_(r.programcode).toUpperCase(),
    programName: cText_(r.programdescription),
    major: cText_(r.major),
    yearLevel: cText_(r.yearlevel),
    term: cText_(r.term),
    section: cText_(r.section),
    room: cText_(r.room),
    faculty: cText_(r.faculty),
    sy: cText_(r.academicyear),
    registeredAt: r.dateofregistration || '',
    status: cText_(r.status || r.enrollmentstatus) || 'Enrolled'
  })).filter(r => r.id || r.name);
}

/** Program rows from ProgramFees, used only to seed descriptions before edits exist. */
function collegeProgramsFromFees_() {
  const seen = {};
  const out = [];
  cObjects_(COLLEGE_TABS.programFees).forEach(r => {
    const code = cText_(r.progcode || r.programcode).toUpperCase();
    if (!code || seen[code]) return;
    seen[code] = 1;
    out.push({ code: code, name: cText_(r.program || r.programdescription), dept: 'College', years: '4', active: 'Yes' });
  });
  return out;
}

/** Programs, editable when the COLLEGE PROGRAMS tab exists. */
function collegePrograms_(includeInactive) {
  const ss = collegeSS_();
  const sh = cTab_(ss, COLLEGE_TABS.programs);
  let rows = [];
  if (sh && sh.getLastRow() >= 2) {
    rows = cObjects_(COLLEGE_TABS.programs).map(r => ({
      code: cText_(r.programcode).toUpperCase(),
      name: cText_(r.programdescription),
      dept: cText_(r.department) || 'College',
      years: cText_(r.years) || '4',
      active: cText_(r.active) || 'Yes'
    })).filter(p => p.code);
  }
  if (!rows.length) rows = collegeProgramsFromFees_();
  if (!rows.length) rows = COLLEGE_PROGRAM_SEED.slice();
  const seen = {};
  rows = rows.filter(p => (seen[p.code] ? false : (seen[p.code] = 1)));
  return includeInactive ? rows : rows.filter(p => p.active.toLowerCase() !== 'no');
}

function collegeSubjects_() {
  return cObjects_(COLLEGE_TABS.subjects).map(r => ({
    program: cText_(r.programcode).toUpperCase(),
    yearLevel: cText_(r.yearlevel),
    term: cText_(r.term),
    code: cText_(r.code),
    title: cText_(r.subjecttitle),
    lec: r.lec, lab: r.lab, credit: r.credit
  })).filter(s => s.code);
}

/* ---------- aggregation ---------- */

function cCount_(rows, keyFn) {
  const map = {};
  rows.forEach(r => {
    const k = cText_(keyFn(r)) || '(None)';
    map[k] = (map[k] || 0) + 1;
  });
  return Object.keys(map).sort((a, b) => map[b] - map[a]).map(k => ({ label: k, count: map[k] }));
}

function collegeStats_(opts) {
  opts = opts || {};
  const all = collegeStudents_();
  const rows = all.filter(r =>
    (!opts.sy || r.sy === opts.sy) &&
    (!opts.program || r.program === opts.program) &&
    (!opts.yearLevel || r.yearLevel === opts.yearLevel) &&
    (!opts.term || r.term === opts.term)
  );
  const programs = collegePrograms_(true);
  const byProgram = programs.map(p => ({
    code: p.code,
    name: p.name,
    count: rows.filter(r => r.program === p.code).length
  }));
  const unknown = cCount_(rows.filter(r => !programs.some(p => p.code === r.program)), r => r.program);
  unknown.forEach(u => { if (u.label !== '(None)') byProgram.push({ code: u.label, name: u.label, count: u.count }); });
  return {
    total: rows.length,
    allTimeTotal: all.length,
    byProgram: byProgram,
    byYearLevel: cCount_(rows, r => r.yearLevel),
    byTerm: cCount_(rows, r => r.term),
    bySex: cCount_(rows, r => r.sex),
    bySection: cCount_(rows, r => r.section),
    years: [...new Set(all.map(r => r.sy).filter(Boolean))].sort().reverse(),
    terms: [...new Set(all.map(r => r.term).filter(Boolean))]
  };
}

/* ---------- web API ---------- */

function collegeUnconfigured_(e) {
  return { success: true, data: { configured: false, message: (e && e.message) || 'The College workbook is not available.' } };
}

function collegeDashboard(token) {
  try {
    const u = who_(token, 'admin');
    if (OFFICE_CL.indexOf(u.Clearance) >= 0) throw new Error('Not allowed.');
    let students;
    try { students = collegeStudents_(); } catch (e) { return collegeUnconfigured_(e); }
    const stats = collegeStats_({});
    return ok({
      configured: true,
      total: students.length,
      programs: collegePrograms_(true),
      stats: stats,
      canEdit: u.Clearance === 'Full',
      updated: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a')
    });
  } catch (e) { return fail(e); }
}

/** Roster with filters. Kept read-only: the college write paths arrive with enrollment. */
function collegeRoster(token, opts) {
  try {
    who_(token, 'admin');
    opts = opts || {};
    let rows;
    try { rows = collegeStudents_(); } catch (e) { return collegeUnconfigured_(e); }
    const q = cText_(opts.q).toLowerCase();
    const filtered = rows.filter(r =>
      (!opts.program || r.program === opts.program) &&
      (!opts.yearLevel || r.yearLevel === opts.yearLevel) &&
      (!opts.term || r.term === opts.term) &&
      (!opts.sy || r.sy === opts.sy) &&
      (!q || (r.name + ' ' + r.id + ' ' + r.regNo + ' ' + r.program).toLowerCase().indexOf(q) >= 0)
    );
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    return ok({
      rows: filtered.slice(0, 400),
      total: filtered.length,
      shown: Math.min(filtered.length, 400),
      programs: collegePrograms_(true),
      stats: collegeStats_(opts)
    });
  } catch (e) { return fail(e); }
}

function getCollegePrograms(token) {
  try {
    const u = who_(token, 'admin');
    if (OFFICE_CL.indexOf(u.Clearance) >= 0) throw new Error('Not allowed.');
    let programs;
    try { programs = collegePrograms_(true); } catch (e) { return collegeUnconfigured_(e); }
    return ok({ programs: programs, canEdit: u.Clearance === 'Full', editable: !!cTab_(collegeSS_(), COLLEGE_TABS.programs) });
  } catch (e) { return fail(e); }
}

/** Adds or updates one program. Full administrators only. */
function saveCollegeProgram(token, prog) {
  try {
    const u = who_(token, 'admin');
    if (u.Clearance !== 'Full') throw new Error('Only full administrators can edit college programs.');
    prog = prog || {};
    const code = cText_(prog.code).toUpperCase().replace(/\s+/g, '');
    const name = cText_(prog.name);
    if (!code) throw new Error('A program code is required.');
    if (code.length > 16) throw new Error('Program codes must be 16 characters or fewer.');
    if (!name) throw new Error('A program description is required.');
    const row = [code, name, cText_(prog.dept) || 'College', cText_(prog.years) || '4', prog.active === 'No' ? 'No' : 'Yes'];

    const ss = collegeSS_();
    let sh = cTab_(ss, COLLEGE_TABS.programs);
    const head = ['Program Code', 'Program Description', 'Department', 'Years', 'Active'];
    if (!sh) {
      sh = ss.insertSheet(COLLEGE_TABS.programs);
      sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
      sh.setFrozenRows(1);
      const seed = collegePrograms_(true);
      if (seed.length) sh.getRange(2, 1, seed.length, head.length)
        .setValues(seed.map(p => [p.code, p.name, p.dept, p.years, p.active]));
    }
    const values = sh.getDataRange().getValues();
    let target = 0;
    for (let r = 1; r < values.length; r++) {
      if (cText_(values[r][0]).toUpperCase() === code) { target = r + 1; break; }
    }
    if (target) sh.getRange(target, 1, 1, head.length).setValues([row]);
    else sh.appendRow(row);
    audit_(u, target ? 'college.program.update' : 'college.program.create', code, name);
    return ok({ programs: collegePrograms_(true), message: (target ? 'Updated ' : 'Added ') + code + '.' });
  } catch (e) { return fail(e); }
}
