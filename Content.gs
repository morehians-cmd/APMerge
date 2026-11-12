/** Editable text blocks that students see (stored in the Content sheet; same allow-list sanitizer as the privacy policy).
 *  'guide' = dashboard enrollment guide. The others are the Institutional & Academic Guides / Help pages. */
const BLOCKS = ['guide','about','cluster','handbook','facilities','faq','pubhome','pubabout','pubadmissions','pubacademics','pubcampus','pubforms','pubnews','pubcontact','history','pub_about_values','pub_about_history','pub_about_leadership','pub_adm_enrollment','pub_adm_requirements','pub_adm_scholarships','pub_adm_faq','pub_acad_kindergarten','pub_acad_elementary','pub_acad_junior_high','pub_acad_senior_high','pub_acad_college','pub_campus_organizations','pub_campus_events','pub_campus_sports','pub_campus_clubs','pub_campus_facilities','pub_forms_tlc','pub_forms_consent','pub_news_announcements','pub_news_latest','pub_news_events','pub_news_enrollment','pub_news_achievements'];

function blockRow_(key) {
  const sh = contentSh_(), n = sh.getLastRow(), keys = n < 1 ? [] : sh.getRange(1, 1, n, 1).getValues().flat().map(String), i = keys.indexOf(key);
  return { sh:sh, row:i < 0 ? 0 : i + 1 };
}
/** Any signed-in user. Returns the saved HTML, or '' when nothing is saved (the page then shows its default text). */
function getBlock(token, key) {
  try {
    who_(token);
    if (!BLOCKS.includes(key)) throw new Error('Unknown block.');
    const b = blockRow_(key);
    return ok(b.row ? cleanPolicy_(String(b.sh.getRange(b.row, 2).getValue() || '')) : '');
  } catch (e) { return fail(e); }
}
/** OWNER ONLY. */
function saveBlock(token, key, html) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const ou = owner_(token);
    if (!BLOCKS.includes(key)) throw new Error('Unknown block.');
    const h = cleanPolicy_(html), b = blockRow_(key);
    put_(b.sh, b.row || (b.sh.getLastRow() + 1), 1, [[key, h]]);
    audit_(ou, 'content.save', key, '');
    if (key === 'guide') invalidatePublicContentCache_();
    return ok(h, 'Saved');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

const ABOUT_KEY = 'about_data';
const ABOUT_ICONS = ['heart','award','users','bulb','shield','book','star','eye','target'];
const ABOUT_DEFAULT = {
  vision:  { title:'', text:'' },
  mission: { title:'', text:'' },
  values:  [{ icon:'shield', title:'Righteousness', text:'' }, { icon:'award', title:'Excellence', text:'' }],
  leaders: [],
  timeline: []
};
const abS_ = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

function aboutClean_(d) {
  d = d || {};
  const vm  = x => ({ title:abS_(x && x.title, 120), text:abS_(x && x.text, 1200) });
  const arr = (a, n) => Array.isArray(a) ? a.slice(0, n) : [];
  return {
    vision: vm(d.vision), mission: vm(d.mission),
    values: arr(d.values, 8).map(v => ({ icon:ABOUT_ICONS.includes(v && v.icon) ? v.icon : 'star', title:abS_(v && v.title, 60), text:abS_(v && v.text, 400) })).filter(v => v.title),
    leaders: arr(d.leaders, 12).map(l => ({ name:abS_(l && l.name, 80), title:abS_(l && l.title, 80), email:abS_(l && l.email, 120), phone:abS_(l && l.phone, 40),
      photo:/^[A-Za-z0-9_-]{10,80}$/.test(String(l && l.photo || '')) ? String(l.photo) : '' })).filter(l => l.name),
    timeline: arr(d.timeline, 12).map(t => ({ year:abS_(t && t.year, 12), title:abS_(t && t.title, 100), text:abS_(t && t.text, 600) })).filter(t => t.year || t.title)
  };
}
function aboutRead_() {
  const b = blockRow_(ABOUT_KEY); let d = null;
  if (b.row) { try { d = JSON.parse(String(b.sh.getRange(b.row, 2).getValue() || '')); } catch (_) {} }
  return aboutClean_(d || ABOUT_DEFAULT);
}
const inPhotoFolder_ = id => {
  try { const it = DriveApp.getFileById(id).getParents(); while (it.hasNext()) if (it.next().getId() === PHOTO_FOLDER_ID) return true; } catch (_) {}
  return false;
};

/** Any signed-in user. d = structured page data, legacy = the old free-text About page (kept so nothing is lost). */
function getAbout(token) {
  try {
    who_(token);
    const lb = blockRow_('about');
    return ok({ d:aboutRead_(), legacy:lb.row ? cleanPolicy_(String(lb.sh.getRange(lb.row, 2).getValue() || '')) : '' });
  } catch (e) { return fail(e); }
}

/** Any signed-in user. One leader photo as a data URI (cached). Only photos listed on the About page can be read. */
function getAboutPhoto(token, id) {
  try {
    who_(token); id = String(id || '');
    if (!aboutRead_().leaders.some(l => l.photo === id)) throw new Error('Photo not found.');
    const c = CacheService.getScriptCache(), k = 'abp_' + id, hit = c.get(k); if (hit) return ok(hit);
    const uri = photo_(id); if (uri && uri.length < 95000) c.put(k, uri, 21600);
    return ok(uri);
  } catch (e) { return fail(e); }
}

/** OWNER ONLY. Uploads a leader photo (JPEG, max 2 MB) and returns its Drive file ID. */
function setAboutPhoto(token, dataUrl) {
  try {
    owner_(token);
    const blob = Utilities.newBlob(Utilities.base64Decode(String(dataUrl).split(',')[1]), 'image/jpeg', 'about_leader.jpg'), pb = blob.getBytes();
    if (pb.length > 2 * 1024 * 1024) throw new Error('Photo exceeds 2 MB.');
    if (!((pb[0] & 255) === 0xFF && (pb[1] & 255) === 0xD8)) throw new Error('Photo must be a JPEG image.');
    return ok(DriveApp.getFolderById(PHOTO_FOLDER_ID).createFile(blob).getId());
  } catch (e) { return fail(e); }
}

/** OWNER ONLY. */
function saveAbout(token, d) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const ou = owner_(token), old = aboutRead_(), oldIds = old.leaders.map(l => l.photo).filter(Boolean), clean = aboutClean_(d);
    clean.leaders.forEach(l => {
      if (l.email && !EMAIL_RE.test(l.email)) throw new Error('Enter a valid email address for ' + l.name + '.');
      if (l.photo && !oldIds.includes(l.photo) && !inPhotoFolder_(l.photo)) l.photo = '';
    });
    clean.timeline.sort((a, b) => String(a.year).localeCompare(String(b.year), undefined, { numeric:true }));
    const json = JSON.stringify(clean); if (json.length > 45000) throw new Error('The page content is too long to save.');
    const b = blockRow_(ABOUT_KEY);
    put_(b.sh, b.row || (b.sh.getLastRow() + 1), 1, [[ABOUT_KEY, json]]);
    CacheService.getScriptCache().remove('puba_v1');
    const keep = clean.leaders.map(l => l.photo);
    oldIds.filter(id => !keep.includes(id)).forEach(id => { try { DriveApp.getFileById(id).setTrashed(true); } catch (_) {} });
    audit_(ou, 'content.save', ABOUT_KEY, '');
    return ok(clean, 'Saved');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}