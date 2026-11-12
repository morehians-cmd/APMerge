/*****************************************************************************
 MOREH ACADEMY PORTAL - REPORTS (new file "Reports")
 School-year support for report(), and the data behind the new Reports Overview.
 Requires Code.gs, ReEnroll (histSh_, HIST_COLS, activeSY_). Deploy a NEW version.
*****************************************************************************/
const RP_SY_RE = /^\d{4}-\d{4}$/;

/** A valid school year from the browser, otherwise the active one. */
function reportSY_(sy) { sy = String(sy || '').trim(); return RP_SY_RE.test(sy) ? sy : activeSY_(); }

/** Learner records of one school year.
 *  Active year: Students rows (a blank year counts as active, same as inSY_).
 *  Past year : Students rows still stamped with that year + Enrollment History snapshots of that year. */
function rowsForSY_(sy, stu) {
  stu = stu || rows_('S'); const act = activeSY_();
  if (sy === act) return stu.filter(s => (s.SchoolYear || act) === act);
  const out = stu.filter(s => s.SchoolYear === sy), seen = {};
  out.forEach(s => seen[s.StudentID] = 1);
  const hs = histSh_();
  if (hs.getLastRow() > 1) hs.getRange(2, 1, hs.getLastRow() - 1, HIST_COLS.length).getValues().forEach(r => {
    if (String(r[1]) !== sy || seen[String(r[0])]) return;
    let o = null; try { o = JSON.parse(String(r[10])); } catch (_) {}
    if (!o || !o.StudentID) {                                   // damaged snapshot: keep the summary columns
      o = {}; COLS.forEach(c => o[c] = '');
      Object.assign(o, { StudentID:String(r[0]), SchoolYear:String(r[1]), Classification:String(r[2]), Category:String(r[3]), GradeLevel:String(r[4]),
        Cluster:String(r[5]), Section:String(r[6]), EnrollStatus:String(r[7]), FullName:String(r[0]) });
    }
    seen[o.StudentID] = 1; out.push(o);
  });
  return out;
}

/** Admin / Manager. KPIs for one school year + the list of school years that have data. Encoders: no access (same rule as report()). */
function reportsHome(token, sy) {
  try {
    const u = who_(token, 'admin');
    if (u.Clearance === 'Encoder') throw new Error('Encoders do not have access to reports.');
    const stu = rows_('S'), S0 = reportSY_(sy), all = rowsForSY_(S0, stu), n = f => all.filter(f).length, m = {};
    m[activeSY_()] = 1; m[S0] = 1;
    stu.forEach(s => { if (RP_SY_RE.test(s.SchoolYear)) m[s.SchoolYear] = 1; });
    const hs = histSh_();
    if (hs.getLastRow() > 1) hs.getRange(2, 2, hs.getLastRow() - 1, 1).getValues().forEach(r => { if (RP_SY_RE.test(String(r[0]))) m[String(r[0])] = 1; });
    return ok({ sy:S0, active:activeSY_(), years:Object.keys(m).sort().reverse(),
      kpis:{ total:all.length, enrolled:n(r => r.EnrollStatus === 'Enrolled'), pending:n(r => r.EnrollStatus === 'Not Enrolled'), temp:n(r => r.EnrollStatus === 'Temporary'),
        transferred:n(r => r.EnrollStatus === 'Transferred Out'), cancelled:n(r => r.EnrollStatus === 'Cancelled') } });
  } catch (e) { return fail(e); }
}

/* ===== Phase 3: Analytics aggregate + authorized drill-down ===== */
const AN_MAX_DRILL = 500, AN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const anLive_ = r => r.EnrollStatus !== 'Cancelled' && r.EnrollStatus !== 'Transferred Out';
/** enrolled = Enrolled | pending = Not Enrolled + Temporary | closed = Cancelled + Transferred Out */
const anBucket_ = r => r.EnrollStatus === 'Enrolled' ? 'enrolled' : anLive_(r) ? 'pending' : 'closed';
const anRel_ = r => r.Religion === 'Others, specify' ? ('Others: ' + (r.ReligionOther || '')).trim() : (r.Religion || '');
const anClass_ = r => [r.GradeLevel, Object.keys(CL).find(k => CL[k] === r.Cluster) || '', r.Section].filter(Boolean).join(' ');
const anReqLabel_ = k => (FIELDS.find(f => f[1] === k) || [0, 0, k])[2];

function anCtx_(token) {
  const u = who_(token, 'admin');
  if (u.Clearance === 'Encoder') throw new Error('Encoders do not have access to reports.');
  return u;
}
function anPop_(sy, lvl, stu) {
  let a = rowsForSY_(sy, stu);
  if (lvl) a = a.filter(r => grpOf_(r.GradeLevel) === lvl);
  return a;
}
function anRange_(a, from, to) {
  if (!from && !to) return a;
  return a.filter(r => { const d = String(r.CreatedAt || '').slice(0, 10); return (!from || d >= from) && (!to || d <= to); });
}
function anArgs_(sy, level, from, to) {
  return { sy: reportSY_(sy), lvl: GROUPS.indexOf(level) >= 0 ? String(level) : '',
    from: AN_DATE_RE.test(from || '') ? from : '', to: AN_DATE_RE.test(to || '') ? to : '' };
}
function anTally_(rows, fn) {
  const m = {}; rows.forEach(r => { const k = fn(r); if (k) m[k] = (m[k] || 0) + 1; });
  return Object.keys(m).map(k => [k, m[k]]).sort((a, b) => b[1] - a[1]);
}

/** Admin / Manager. Everything the Analytics view draws, for one school year. */
function reportsAnalytics(token, sy, level, from, to, fresh) {
  try {
    const u = anCtx_(token), A = anArgs_(sy, level, from, to), ck = rpCacheKey_('ra', A);
const hit = fresh ? null : rpCacheGet_(ck);
if (hit) { audit_(u, 'analytics.view', 'SY ' + A.sy, (A.lvl || 'all levels') + ' (cached)'); return hit; }
const stu = rows_('S');
    const all = anPop_(A.sy, A.lvl, stu), live = all.filter(anLive_), enr = live.filter(r => r.EnrollStatus === 'Enrolled'), adm = anRange_(all, A.from, A.to);
    audit_(u, 'analytics.view', 'SY ' + A.sy, A.lvl || 'all levels');

    const byLevel = GROUPS.map(g => { const x = all.filter(r => grpOf_(r.GradeLevel) === g);
      return { g: g, enrolled: x.filter(r => anBucket_(r) === 'enrolled').length, pending: x.filter(r => anBucket_(r) === 'pending').length, closed: x.filter(r => anBucket_(r) === 'closed').length }; })
      .filter(x => x.enrolled + x.pending + x.closed > 0);
    const byGrade = GRADES.map(g => [g, enr.filter(r => r.GradeLevel === g).length]).filter(x => x[1] > 0);

    const mm = {}; adm.forEach(r => { const k = String(r.CreatedAt || '').slice(0, 7); if (/^\d{4}-\d{2}$/.test(k)) mm[k] = (mm[k] || 0) + 1; });
    const monthly = Object.keys(mm).sort().map(k => [k, mm[k]]);

    const rel = anTally_(live, anRel_), sec = {};
    live.forEach(r => { if (!r.Section) return; const k = r.GradeLevel + '|' + r.Section; sec[k] = (sec[k] || 0) + 1; });
    const sections = Object.keys(sec).map(k => { const p = k.split('|'); return [p[0] + ' ' + p[1], sec[k], k]; }).sort((a, b) => b[1] - a[1]).slice(0, 30);

    const miss = {}; let complete = 0, noConsent = 0;
    live.forEach(r => { const need = reqsFor_(r).req; let bad = false;
      need.forEach(k => { if (k !== 'ReqConsent' && (!r[k] || r[k] === 'None')) { miss[k] = (miss[k] || 0) + 1; bad = true; } });
      if (r.ReqConsent !== 'Original') noConsent++;
      if (!bad) complete++; });
    const missing = Object.keys(miss).map(k => [k, anReqLabel_(k), miss[k]]).sort((a, b) => b[2] - a[2]);

    const yrs = rpYears_(stu, [activeSY_(), A.sy]); yrs[A.sy] = 1;
    stu.forEach(s => { if (RP_SY_RE.test(s.SchoolYear)) yrs[s.SchoolYear] = 1; });
    const hs = histSh_(); if (hs.getLastRow() > 1) hs.getRange(2, 2, hs.getLastRow() - 1, 1).getValues().forEach(r => { if (RP_SY_RE.test(String(r[0]))) yrs[String(r[0])] = 1; });
    const yoy = Object.keys(yrs).sort().slice(-5).map(y => { const x = anPop_(y, A.lvl, stu);
      return { sy: y, total: x.length, enrolled: x.filter(r => r.EnrollStatus === 'Enrolled').length }; });

    const out = ok({ sy: A.sy, lvl: A.lvl, from: A.from, to: A.to, population: all.length, live: live.length,
      funnel: { total: adm.length, active: adm.filter(anLive_).length, enrolled: adm.filter(r => r.EnrollStatus === 'Enrolled').length },
      byLevel: byLevel, byGrade: byGrade, monthly: monthly,
      sex: anTally_(live, r => r.SexualOrient || 'Not specified'), religion: rel.slice(0, 8), religionOther: rel.slice(8).reduce((a, x) => a + x[1], 0),
      sections: sections, scholar: anTally_(live, r => r.Category || '(Not set)'),
      compliance: { complete: complete, incomplete: live.length - complete, noConsent: noConsent, missing: missing },
      gaps: { sex: live.filter(r => !r.SexualOrient).length, religion: live.filter(r => !r.Religion).length, category: live.filter(r => !r.Category).length, prevSchool: live.filter(r => !String(r.PrevSchool || '').trim()).length },
      yoy: yoy }); rpCachePut_(ck, out); return out;
  } catch (e) { return fail(e); }
}

/** Admin / Manager. The learners behind one chart segment. Same access rule as the reports; returns only the fields a list needs. */
function reportsDrill(token, sy, level, from, to, kind, key) {
  try {
    const u = anCtx_(token), A = anArgs_(sy, level, from, to), all = anPop_(A.sy, A.lvl), live = all.filter(anLive_);
    key = String(key == null ? '' : key); let rows;
    switch (String(kind)) {
      case 'funnel': { const a = anRange_(all, A.from, A.to); rows = key === 'total' ? a : key === 'active' ? a.filter(anLive_) : a.filter(r => r.EnrollStatus === 'Enrolled'); break; }
      case 'lvl': { const p = key.split('|'); rows = all.filter(r => grpOf_(r.GradeLevel) === p[0] && anBucket_(r) === p[1]); break; }
      case 'grade': rows = live.filter(r => r.EnrollStatus === 'Enrolled' && r.GradeLevel === key); break;
      case 'month': rows = anRange_(all, A.from, A.to).filter(r => String(r.CreatedAt || '').slice(0, 7) === key); break;
      case 'sex': rows = live.filter(r => (r.SexualOrient || 'Not specified') === key); break;
      case 'religion': rows = live.filter(r => anRel_(r) === key); break;
      case 'scholar': rows = live.filter(r => (r.Category || '(Not set)') === key); break;
      case 'section': { const p = key.split('|'); rows = live.filter(r => r.GradeLevel === p[0] && r.Section === p[1]); break; }
      case 'req': { if (REQ_ALL.indexOf(key) < 0) throw new Error('Unknown requirement.'); rows = live.filter(r => reqsFor_(r).req.indexOf(key) >= 0 && (!r[key] || r[key] === 'None')); break; }
      case 'consent': rows = live.filter(r => r.ReqConsent !== 'Original'); break;
      default: throw new Error('Unknown selection.');
    }
    audit_(u, 'analytics.drill', kind + ':' + key.slice(0, 60), 'SY ' + A.sy + ', ' + rows.length + ' learner(s)');
    return ok({ total: rows.length, capped: rows.length > AN_MAX_DRILL,
      rows: rows.slice(0, AN_MAX_DRILL).sort((a, b) => String(a.FullName).localeCompare(String(b.FullName)))
        .map(r => ({ id: r.StudentID, name: r.FullName, cls: anClass_(r), status: r.EnrollStatus || 'Not Enrolled', cat: r.Category || '' })) });
  } catch (e) { return fail(e); }
}

/* ===== Phase 4: Saved Reports, favorites, Report History ===== */
const RP_SAVE = ['daily','overview','section','advisory','personal','requirements','scholar','demographic','school','adviser','referral','noconsent'];
const RP_TYPES = RP_SAVE.concat(['refd', 'advd']);
const RP_NAMES = { daily:'Daily Report', overview:'Admission Conversion', section:'Section Report', advisory:'Advisory Class', personal:'Learner Personal Data', requirements:'Requirements Status',
  scholar:'Scholarship Beneficiaries', demographic:'Demographic Report', school:'Per School', adviser:'Per Previous Adviser', referral:'Referral', noconsent:'No Parental Consent',
  refd:'Referral (referrer detail)', advd:'Previous Adviser (learners)' };
const RP_FMT = ['Preview', 'Print / PDF', 'CSV', 'Excel'];
const SV_COLS = ['SavedID', 'Owner', 'Name', 'ReportID', 'SchoolYear', 'Config', 'Shared', 'CreatedAt', 'UpdatedAt'];
const PF_COLS = ['Username', 'Favorites', 'UpdatedAt'];
const HI_COLS = ['When', 'Username', 'FullName', 'ReportID', 'ReportName', 'SchoolYear', 'Format', 'Status', 'Detail'];

function rpUser_(token) {
  const u = who_(token, 'admin');
  if (u.Clearance === 'Encoder') throw new Error('Encoders do not have access to reports.');
  return u;
}
/** Safe, learner-free description of a report request (class and level only, never names). */
function rpDetail_(a) {
  if (a && typeof a === 'object' && a.grade) return [a.grade, a.section === '*' ? 'All sections' : a.section === '(none)' ? 'Unassigned' : a.section].filter(Boolean).join(' / ');
  if (typeof a === 'string' && GROUPS.indexOf(a) >= 0) return a;
  return '';
}
/** Appends one history row. Never throws. Keeps the sheet to about 5,000 rows. */
function rpLog_(u, type, fmt, sy, status, detail) {
  try {
    if (RP_TYPES.indexOf(type) < 0) return;
    const sh = acSh_('Report History', HI_COLS);
    acAppend_('Report History', HI_COLS, [[acNow_(), aClean_(u.Username), aClean_(u.FullName || ''), type, RP_NAMES[type], RP_SY_RE.test(sy || '') ? sy : '', fmt, status, aClean_(detail || '')]]);
    if (sh.getLastRow() > 5000) sh.deleteRows(2, 500);
  } catch (e) { Logger.log('rpLog: ' + e.message); }
}

/** Client calls this for exports and failures (previews are logged by report() itself). Only metadata is stored. */
function reportLog(token, type, format, sy, status, detail) {
  try {
    const u = rpUser_(token);
    if (RP_TYPES.indexOf(String(type)) < 0 || RP_FMT.indexOf(String(format)) < 0) throw new Error('Invalid entry.');
    rpLog_(u, String(type), String(format), String(sy || ''), status === 'Failed' ? 'Failed' : 'Success', String(detail || '').slice(0, 120));
    return ok(null);
  } catch (e) { return fail(e); }
}

/** Favorites + saved reports visible to this user (own and shared). */
function reportsPrefs(token) {
  try {
    const u = rpUser_(token), me = String(u.Username).toLowerCase(), names = {};
    rows_('U').forEach(x => names[x.Username] = x.FullName || x.Username);
    const pf = acRows_('Report Prefs', PF_COLS).find(x => x.Username === me); let favs = [];
    try { favs = JSON.parse(pf ? pf.Favorites : '[]'); } catch (_) {}
    favs = (Array.isArray(favs) ? favs : []).filter(k => RP_SAVE.indexOf(k) >= 0);
    const saved = acRows_('Saved Reports', SV_COLS).filter(x => x.Owner === me || x.Shared === '1').map(x => {
      let cfg = {}; try { cfg = svClean_(JSON.parse(x.Config)); } catch (_) { cfg = svClean_({}); }
      return { id: x.SavedID, name: x.Name, type: x.ReportID, sy: x.SchoolYear, cfg: cfg, shared: x.Shared === '1', mine: x.Owner === me, owner: names[x.Owner] || x.Owner, updated: x.UpdatedAt };
    }).filter(x => RP_SAVE.indexOf(x.type) >= 0).sort((a, b) => b.updated.localeCompare(a.updated));
    return ok({ favs: favs, saved: saved });
  } catch (e) { return fail(e); }
}

function svClean_(c) {
  c = c || {}; const s = (v, n) => String(v == null ? '' : v).trim().slice(0, n), arr = (a, n, m) => (Array.isArray(a) ? a : []).slice(0, n).map(x => s(x, m)).filter(Boolean);
  return { grade: GRADES.indexOf(c.grade) >= 0 ? c.grade : '', section: s(c.section, 40), level: GROUPS.indexOf(c.level) >= 0 ? c.level : '', fields: arr(c.fields, 120, 60), hide: arr(c.hide, 60, 80) };
}

function saveFavorites(token, list) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); const u = rpUser_(token), me = String(u.Username).toLowerCase(), seen = {};
    const favs = (Array.isArray(list) ? list : []).map(String).filter(k => RP_SAVE.indexOf(k) >= 0 && !seen[k] && (seen[k] = 1)).slice(0, 12);
    const old = acRows_('Report Prefs', PF_COLS).find(x => x.Username === me);
    acPut_(acSh_('Report Prefs', PF_COLS), old ? old._row : 0, PF_COLS, { Username: me, Favorites: JSON.stringify(favs), UpdatedAt: acNow_() });
    return ok(favs);
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

/** Stores the configuration only (report, filters, columns). Never stores results, so a run always uses current data.
 *  f = { id?, name, type, sy ('' = follow the active school year), shared, cfg } */
function saveReportConfig(token, f) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); const u = rpUser_(token), me = String(u.Username).toLowerCase(); f = f || {};
    const type = String(f.type || ''); if (RP_SAVE.indexOf(type) < 0) throw new Error('This report cannot be saved.');
    const name = acClean_(f.name, 60); if (!name) throw new Error('Enter a name for the saved report.');
    const sy = RP_SY_RE.test(f.sy || '') ? f.sy : '', all = acRows_('Saved Reports', SV_COLS), old = f.id ? all.find(x => x.SavedID === String(f.id)) : null;
    if (f.id && !old) throw new Error('Saved report not found.');
    if (old && old.Owner !== me && u.Clearance !== 'Full') throw new Error('Not allowed.');
    if (!old && all.filter(x => x.Owner === me).length >= 50) throw new Error('You can keep up to 50 saved reports. Delete one first.');
    const now = acNow_(), rec = { SavedID: old ? old.SavedID : acId_('SR'), Owner: old ? old.Owner : me, Name: name, ReportID: type, SchoolYear: sy,
      Config: JSON.stringify(svClean_(f.cfg)), Shared: f.shared ? '1' : '', CreatedAt: old ? old.CreatedAt : now, UpdatedAt: now };
    acPut_(acSh_('Saved Reports', SV_COLS), old ? old._row : 0, SV_COLS, rec);
    audit_(u, old ? 'report.saved.update' : 'report.saved.create', rec.SavedID, type);
    return ok({ id: rec.SavedID }, old ? 'Saved report updated' : 'Saved report created');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

function deleteReportConfig(token, id) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); const u = rpUser_(token), me = String(u.Username).toLowerCase();
    const x = acRows_('Saved Reports', SV_COLS).find(r => r.SavedID === String(id));
    if (!x) throw new Error('Saved report not found.');
    if (x.Owner !== me && u.Clearance !== 'Full') throw new Error('Not allowed.');
    acSh_('Saved Reports', SV_COLS).deleteRow(x._row);
    audit_(u, 'report.saved.delete', x.SavedID, x.ReportID);
    return ok(null, 'Saved report removed');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

/** The main administrator sees everyone's history; other staff see only their own. Newest first, 300 rows. */
function reportHistory(token) {
  try {
    const u = rpUser_(token), me = String(u.Username).toLowerCase(), all = u.Clearance === 'Full';
    const rows = acRows_('Report History', HI_COLS).filter(r => all || r.Username === me).reverse().slice(0, 300)
      .map(r => ({ when: r.When, by: r.FullName || r.Username, type: r.ReportID, name: r.ReportName, sy: r.SchoolYear, fmt: r.Format, status: r.Status, detail: r.Detail }));
    return ok({ all: all, rows: rows });
  } catch (e) { return fail(e); }
}
/* ===== Phase 5: request-level history memo, 5-minute cache, self-check ===== */
let RP_HIST_ = null;   // lives for ONE execution only
function histVals_() {
  if (RP_HIST_) return RP_HIST_;
  const hs = histSh_();
  return RP_HIST_ = hs.getLastRow() > 1 ? hs.getRange(2, 1, hs.getLastRow() - 1, HIST_COLS.length).getValues() : [];
}
/** All school years that have any data: Students rows + Enrollment History + extras. */
function rpYears_(stu, extra) {
  const m = {}; (extra || []).forEach(y => m[y] = 1);
  stu.forEach(s => { if (RP_SY_RE.test(s.SchoolYear)) m[s.SchoolYear] = 1; });
  histVals_().forEach(r => { const y = String(r[1]); if (RP_SY_RE.test(y)) m[y] = 1; });
  return m;
}

const RP_TTL = 300;   // seconds
/** The key includes the Students write-version (stGet_), so any learner change drops cached reports at once. */
const rpCacheKey_ = (p, A) => p + '_' + stGet_() + '_' + activeSY_() + '_' + A.sy + '_' + GROUPS.indexOf(A.lvl) + '_' + A.from + '_' + A.to;
function rpCacheGet_(k) { try { const v = CacheService.getScriptCache().get(k); return v ? JSON.parse(v) : null; } catch (_) { return null; } }
function rpCachePut_(k, o) { try { const s = JSON.stringify(o); if (s.length < 95000) CacheService.getScriptCache().put(k, s, RP_TTL); } catch (_) {} }

/** OWNER ONLY (editor). Reconciles the report figures with the Students and Enrollment History sheets,
 *  times the heavy calls, and tries every report function with non-admin accounts. Read the log. */
function reportsSelfCheck() {
  ownerOnly_();
  const out = [], P = (n, d) => out.push('PASS  ' + n + (d == null ? '' : ' (' + d + ')')), F = (n, d) => out.push('FAIL  ' + n + ' - ' + d), N = (n, d) => out.push('NOTE  ' + n + ' - ' + d);
  const eq = (n, want, got) => String(want) === String(got) ? P(n, got) : F(n, 'sheet says ' + want + ', report says ' + got);
  const mk = u => { const t = Utilities.getUuid(); putSession_(t, u); return t; };
  const ms = f => { const t = Date.now(), r = f(); return [r, Date.now() - t]; };
  const need = (n, r) => { if (!r || !r.success) { F(n, (r && r.error) || 'no response'); return null; } return r.data; };
  stBump_();
  const act = activeSY_(), stu = rows_('S'), tok = mk(userRow_(OWNER_USER).u);
  const cur = stu.filter(s => (s.SchoolYear || act) === act), liveF = a => a.filter(r => r.EnrollStatus !== 'Cancelled' && r.EnrollStatus !== 'Transferred Out'), live = liveF(cur);
  const cnt = (a, st) => a.filter(r => r.EnrollStatus === st).length, graded = a => a.filter(r => GROUPS.indexOf(grpOf_(r.GradeLevel)) >= 0).length;

  out.push('--- Active school year ' + act + ': ' + cur.length + ' records, ' + live.length + ' active ---');
  let x = ms(() => reportsHome(tok, act, true)), h = need('reportsHome', x[0]);
  if (h) { eq('Overview total', cur.length, h.kpis.total); eq('Overview enrolled', cnt(cur, 'Enrolled'), h.kpis.enrolled); eq('Overview not enrolled', cnt(cur, 'Not Enrolled'), h.kpis.pending);
    eq('Overview temporary', cnt(cur, 'Temporary'), h.kpis.temp); eq('Overview transferred', cnt(cur, 'Transferred Out'), h.kpis.transferred); eq('Overview cancelled', cnt(cur, 'Cancelled'), h.kpis.cancelled); P('Overview load', x[1] + ' ms'); }
  const d = need('dashboard', dashboard(tok));
  if (d) { eq('Dashboard total', cur.length, d.stats.total); eq('Dashboard enrolled', cnt(cur, 'Enrolled'), d.stats.enrolled); }
  const o = need('report overview', report(tok, 'overview', '', act));
  if (o) { const t = o.blocks.find(b => b.cols).rows.slice(-1)[0]; eq('Conversion report: applicants', cur.length, t[1]); eq('Conversion report: enrolled', cnt(cur, 'Enrolled'), t[2]); eq('Conversion report: cancelled/transferred', cur.length - live.length, t[4]); }
  const dm = need('report demographic', report(tok, 'demographic', '', act)); if (dm) eq('Demographic total', live.length, dm.blocks[0].kpis[0].value);
  const sc = need('report scholar', report(tok, 'scholar', 'All', act)); if (sc) eq('Scholarship total', live.length, sc.blocks[0].kpis[0].value);
  const se = need('report section', report(tok, 'section', '', act)); if (se) eq('Section report total (learners with a grade level)', graded(live), se.blocks[0].kpis[0].value);
  if (live.length !== graded(live)) N('Learners without a valid grade level', (live.length - graded(live)) + ' active record(s) are left out of level tables by design.');

  x = ms(() => reportsAnalytics(tok, act, '', '', '', true)); const an = need('reportsAnalytics', x[0]);
  if (an) {
    P('Analytics cold load', x[1] + ' ms'); const w = ms(() => reportsAnalytics(tok, act, '', '', '')); P('Analytics cached load', w[1] + ' ms');
    eq('Analytics population', cur.length, an.population); eq('Analytics active', live.length, an.live); eq('Funnel registered', cur.length, an.funnel.total); eq('Funnel enrolled', cnt(cur, 'Enrolled'), an.funnel.enrolled);
    eq('By-level sum (learners with a grade level)', graded(cur), an.byLevel.reduce((a, l) => a + l.enrolled + l.pending + l.closed, 0));
    eq('Sex sum = active', live.length, an.sex.reduce((a, s) => a + s[1], 0)); eq('Scholarship sum = active', live.length, an.scholar.reduce((a, s) => a + s[1], 0));
    eq('Compliance complete + missing = active', live.length, an.compliance.complete + an.compliance.incomplete);
    eq('Enrolled by grade sum', cnt(live, 'Enrolled'), an.byGrade.reduce((a, g) => a + g[1], 0));
  }

  out.push('--- Past school years ---');
  const hv = histVals_(), years = Object.keys(rpYears_(stu, [])).filter(y => y !== act).sort();
  if (!years.length) N('Past years', 'none found yet');
  years.forEach(y => {
    const ids = {}; stu.forEach(s => { if (s.SchoolYear === y) ids[s.StudentID] = 1; }); let dup = 0;
    hv.forEach(r => { if (String(r[1]) !== y) return; const id = String(r[0]); if (ids[id]) dup++; else ids[id] = 1; });
    const g = need('reportsHome ' + y, reportsHome(tok, y, true));
    if (g) eq('SY ' + y + ' total' + (dup ? ' [' + dup + ' duplicate snapshot row(s) ignored]' : ''), Object.keys(ids).length, g.kpis.total);
  });

  out.push('--- Access: every report function must refuse these accounts ---');
  const users = rows_('U').filter(u => u.Disabled !== '1');
  const probe = (label, u) => {
    const t = mk(u), calls = [['report', () => report(t, 'section', '')], ['reportsHome', () => reportsHome(t, act)], ['reportsAnalytics', () => reportsAnalytics(t, act, '', '', '')],
      ['reportsDrill', () => reportsDrill(t, act, '', '', '', 'consent', '')], ['reportHistory', () => reportHistory(t)], ['saveFavorites', () => saveFavorites(t, [])]];
    const open = calls.filter(c => { try { const r = c[1](); return r && r.success; } catch (e) { return false; } }).map(c => c[0]);
    open.length ? F('Access ' + label, 'ANSWERED: ' + open.join(', ')) : P('Access ' + label, 'all refused (if the account must change its password, the refusal may be for that reason)');
  };
  ['Encoder', 'Teacher', 'HeadTeacher', 'Guidance', 'Accounting', 'Academic'].forEach(c => { const u = users.find(z => z.Role === 'admin' && z.Clearance === c); u ? probe(c, u) : N('Access ' + c, 'no such account to test'); });
  const su = users.find(z => z.Role === 'student'); su ? probe('Student', su) : N('Access Student', 'no student account to test');

  Logger.log(out.join('\n')); return out;
}