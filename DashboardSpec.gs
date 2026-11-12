/**
 * Admissions dashboard per the office specification.
 *
 * One call builds every block the layout needs, from the active school year's rows,
 * so the page does not fan out into a dozen round trips. Counting rules follow the
 * spec: unique students, cancelled and transferred-out records never count as
 * enrolled, and "New Today" keeps its own current-day definition even when filters
 * are applied elsewhere.
 */
const DS_LEVELS = [
  { key: 'Preschool', label: 'Preschool', grades: ['Nursery', 'Kinder 1', 'Kinder 2'], kids: [] },
  { key: 'Elementary', label: 'Elementary', grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'], kids: [] },
  { key: 'Junior High', label: 'Junior High', grades: ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'], kids: [] },
  { key: 'SHS 11', label: 'Senior High 11', grades: ['Grade 11'], kids: [] },
  { key: 'SHS 12', label: 'Senior High 12', grades: ['Grade 12'], kids: [] },
  { key: 'College', label: 'College', grades: [], kids: [] }
];

const DS_STATUSES = ['Enrolled', 'Not Enrolled', 'Temporary', 'Cancelled', 'Transferred Out'];

const dsLevelOf_ = g => {
  const i = GRADES.indexOf(g);
  if (i < 0) return 'College';
  if (i < 3) return 'Preschool';
  if (i < 9) return 'Elementary';
  if (i < 13) return 'Junior High';
  return g === 'Grade 11' ? 'SHS 11' : 'SHS 12';
};

const dsSex_ = r => (r.SexualOrient === 'Male' ? 'Male' : r.SexualOrient === 'Female' ? 'Female' : 'Not specified');

const dsDay_ = v => String(v == null ? '' : v).slice(0, 10);

function dsCount_(rows, fn) {
  const m = {};
  rows.forEach(r => { const k = fn(r) || '(None)'; m[k] = (m[k] || 0) + 1; });
  return Object.keys(m).map(k => ({ label: k, count: m[k] })).sort((a, b) => b.count - a.count);
}

/** Filters the roster the same way the cards, charts and lists will read it. */
function dsApply_(rows, f) {
  f = f || {};
  return rows.filter(r =>
    (!f.level || dsLevelOf_(r.GradeLevel) === f.level) &&
    (!f.type || String(r.Classification || '') === f.type) &&
    (!f.status || String(r.EnrollStatus || '') === f.status)
  );
}

function dashboardSpec(token, filters) {
  try {
    const u = who_(token, 'admin');
    if (OFFICE_CL.indexOf(u.Clearance) >= 0) throw new Error('Not allowed.');
    const full = u.Clearance !== 'Encoder';
    const tz = Session.getScriptTimeZone();
    const now = new Date();
    const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');

    const sy = activeSY_();
    const all = rowsSY_().filter(r => String(r.SchoolYear || '') === String(sy));
    const scoped = dsApply_(all, filters);

    const isEnrolled = r => r.EnrollStatus === 'Enrolled';
    const isClosed = r => r.EnrollStatus === 'Cancelled' || r.EnrollStatus === 'Transferred Out';

    const enrolled = scoped.filter(isEnrolled);
    const eligible = scoped.filter(r => !isClosed(r));
    const pending = scoped.filter(r => r.EnrollStatus === 'Not Enrolled');
    // New Today is the day's registrations for the school year, independent of the
    // level/type/status filters, so the figure still means what its label says.
    const todayRows = all.filter(r => dsDay_(r.CreatedAt) === today);

    const cards = [
      { key: 'total', label: 'Total Applicants', value: scoped.length, hint: 'Unique students on record for SY ' + sy, status: '' },
      { key: 'enrolled', label: 'Total Enrolled', value: enrolled.length, hint: 'Officially enrolled', status: 'Enrolled' },
      { key: 'today', label: 'New Today', value: todayRows.length, hint: 'Registered ' + Utilities.formatDate(now, tz, 'MMM d, yyyy'), status: '' },
      { key: 'pending', label: 'Not Yet Enrolled', value: pending.length, hint: 'Pending or incomplete', status: 'Not Enrolled' },
      { key: 'cancelled', label: 'Cancelled', value: scoped.filter(r => r.EnrollStatus === 'Cancelled').length, hint: 'Withdrawn applications', status: 'Cancelled' },
      { key: 'transferred', label: 'Transferred Out', value: scoped.filter(r => r.EnrollStatus === 'Transferred Out').length, hint: 'Moved to another school', status: 'Transferred Out' }
    ];

    const pct = eligible.length ? Math.round(enrolled.length / eligible.length * 1000) / 10 : 0;
    const progress = {
      pct: pct,
      enrolled: enrolled.length,
      pending: pending.length,
      eligible: eligible.length,
      cancelled: scoped.filter(r => r.EnrollStatus === 'Cancelled').length,
      transferred: scoped.filter(r => r.EnrollStatus === 'Transferred Out').length
    };

    // College students live in the separate College workbook, so their level figures
    // come from there instead of the bound Students tab.
    const collegeKids = dsCollegeLevels_();
    const collegeTotal = collegeKids.reduce((a, k) => a + (k.count || 0), 0);

    // Doughnut 1 — enrolled students by academic level
    const byLevel = DS_LEVELS.map(l => ({
      label: l.label,
      count: l.key === 'College' ? collegeTotal : enrolled.filter(r => dsLevelOf_(r.GradeLevel) === l.key).length
    }));

    // Doughnut 2 — applicants by scholarship category, keeping the stored categories apart
    const cats = CATS.slice();
    const byScholarship = cats.map(c => ({ label: c, count: scoped.filter(r => String(r.Category || '') === c).length }));
    const otherCats = dsCount_(scoped.filter(r => cats.indexOf(String(r.Category || '')) < 0), r => r.Category);
    otherCats.forEach(o => byScholarship.push(o));

    // Doughnut 3 — students by sex
    const bySex = ['Male', 'Female', 'Not specified'].map(s => ({ label: s, count: scoped.filter(r => dsSex_(r) === s).length }));

    // Doughnut 4 — applicants by previous school, top 10 then Others
    const schoolCounts = dsCount_(scoped.filter(r => String(r.PrevSchool || '').trim()), r => String(r.PrevSchool).trim());
    const topSchools = schoolCounts.slice(0, 10);
    const restSchools = schoolCounts.slice(10).reduce((a, s) => a + s.count, 0);
    const bySchool = topSchools.concat(restSchools ? [{ label: 'Others', count: restSchools }] : []);

    // Per-level bento cards with their grade / strand breakdown
    const levels = DS_LEVELS.map(l => {
      const rowsFor = enrolled.filter(r => dsLevelOf_(r.GradeLevel) === l.key);
      if (l.key === 'College') return { key: l.key, label: l.label, total: collegeTotal, kids: collegeKids };
      let kids;
      if (l.key === 'SHS 11' || l.key === 'SHS 12') {
        kids = Object.keys(CL).map(c => ({
          label: c,
          name: CL[c],
          count: rowsFor.filter(r => String(r.Cluster || '') === c).length
        }));
      } else {
        kids = l.grades.map(g => ({ label: g, count: rowsFor.filter(r => r.GradeLevel === g).length }));
      }
      return { key: l.key, label: l.label, total: rowsFor.length, kids: kids };
    });

    // Recent registrations: newest first, ten of them
    const recent = scoped.slice()
      .sort((a, b) => String(b.CreatedAt || '').localeCompare(String(a.CreatedAt || '')))
      .slice(0, 10)
      .map(r => ({
        id: r.StudentID,
        name: r.FullName,
        level: dsLevelOf_(r.GradeLevel),
        grade: (String(r.GradeLevel || '') + ' ' + String(r.Section || '')).trim(),
        date: dsDay_(r.CreatedAt),
        time: String(r.CreatedAt || '').length >= 16 ? String(r.CreatedAt).slice(11, 16) : '',
        status: r.EnrollStatus || 'Not Enrolled',
        category: r.Category || ''
      }));

    // Needs attention comes from the existing attention query; the activity feed is
    // the audit log, which is only readable by the full administrator and managers.
    let attention = { counts: { req: 0, consent: 0, cert: 0 }, total: 0, rows: [] };
    let activity = [];
    try {
      const extra = dashboardExtra(token);
      if (extra && extra.success && extra.data && extra.data.attention) attention = extra.data.attention;
    } catch (e) { /* the rest of the dashboard still renders */ }
    try {
      const feed = getRecentActivity(token, 8);
      if (feed && feed.success && feed.data && Array.isArray(feed.data.items)) activity = feed.data.items;
    } catch (e) { /* Encoders do not get the audit log */ }

    return ok({
      sy: sy,
      updated: Utilities.formatDate(now, tz, 'MMM d, yyyy h:mm a'),
      canEdit: u.Clearance === 'Full',
      filters: {
        level: (filters && filters.level) || '',
        type: (filters && filters.type) || '',
        status: (filters && filters.status) || ''
      },
      totals: { rows: all.length, scoped: scoped.length, enrolled: enrolled.length, eligible: eligible.length },
      cards: cards,
      progress: progress,
      charts: { byLevel: byLevel, byScholarship: byScholarship, bySex: bySex, bySchool: bySchool },
      levels: levels,
      recent: recent,
      attention: attention,
      activity: activity.slice(0, 8),
      schoolYears: dsSchoolYears_()
    });
  } catch (e) { return fail(e); }
}

/** College figures come from the separate College workbook; an unreachable file yields no programs. */
function dsCollegeLevels_() {
  try {
    if (typeof collegeStats_ !== 'function') return [];
    const st = collegeStats_({});
    return (st.byProgram || []).map(p => ({ label: p.code, name: p.name, count: p.count }));
  } catch (e) { return []; }
}

/** School years present in the sheet, newest first, for the year filter. */
function dsSchoolYears_() {
  try {
    const m = {};
    rows_('S').forEach(r => { const y = String(r.SchoolYear || ''); if (y) m[y] = 1; });
    return Object.keys(m).sort().reverse();
  } catch (e) { return []; }
}
