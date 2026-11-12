/*****************************************************************************
 MOREH ACADEMY PORTAL - PUBLIC (add as a NEW file named "Public")
 Server side of PublicHome.html. These functions need NO sign-in, so they return
 only what is safe for anyone on the internet: school year, portal link, the
 enrollment guide text, next 3 events, 5 campus photos, vision / mission / values /
 history. Never students, staff, leaders' contact details or holds.

 Requires the existing: ok, fail, activeSY_, blockRow_ (Content), cleanPolicy_ (Hardening),
 galRead_ (Gallery), photo_, evRows_, aboutRead_ (Content).
 This file already contains getPublicAbout, so do NOT also paste Public-addition.gs.
*****************************************************************************/
const PUB_GALLERY_PAGE = 'facilities', PUB_GALLERY_MAX = 5, PUB_EVENTS_MAX = 3;

/** Internal: expire today's cached public homepage feed after relevant content changes. */
function invalidatePublicContentCache_() {
  try {
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    CacheService.getScriptCache().remove('pubc_v1_' + today);
  } catch (_) {}
}

/** PUBLIC. Everything the homepage needs in one call (cached 5 minutes). */
function getPublicContent() {
  try {
    const cache = CacheService.getScriptCache(), tz = Session.getScriptTimeZone();
    const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'), ck = 'pubc_v1_' + today;
    const hit = cache.get(ck); if (hit) return JSON.parse(hit);

    const gb = blockRow_('guide');
    const guide = gb.row ? cleanPolicy_(String(gb.sh.getRange(gb.row, 2).getValue() || '')) : '';

    const posts = evRows_();
    const announcements = posts
      .filter(e => e.Category === 'Announcement' && e.EventDate >= today)
      .sort((a, b) => b.EventDate.localeCompare(a.EventDate))
      .slice(0, 5)
      .map(e => ({ t:e.Title, d:e.EventDate, v:e.Venue, x:e.Details, category:e.Category }));
    const events = posts
      .filter(e => e.Category !== 'Announcement' && e.EventDate >= today)
      .sort((a, b) => (a.EventDate + a.EventTime).localeCompare(b.EventDate + b.EventTime))
      .slice(0, PUB_EVENTS_MAX)
      .map(e => ({ t:e.Title, d:e.EventDate, tm:e.EventTime, v:e.Venue, x:e.Details, category:e.Category }));

    const gallery = galRead_(PUB_GALLERY_PAGE).list.slice(0, PUB_GALLERY_MAX).map(p => ({ id: p.id, cap: p.cap }));

    const out = ok({ sy: activeSY_(), portal: ScriptApp.getService().getUrl() + '?page=portal', guide: guide, announcements:announcements, events:events, gallery:gallery });
    try { cache.put(ck, JSON.stringify(out), 300); } catch (_) {}
    return out;
  } catch (e) { return fail(e); }
}

/** PUBLIC. One campus photo as a data URI. Serves ONLY photos shown on the homepage, so it cannot read other Drive files. */
function getPublicPhoto(id) {
  try {
    id = String(id || '');
    if (!galRead_(PUB_GALLERY_PAGE).list.slice(0, PUB_GALLERY_MAX).some(x => x.id === id)) throw new Error('Photo not found.');
    const cache = CacheService.getScriptCache(), k = 'pubp_' + id, hit = cache.get(k);
    if (hit) return ok(hit);
    const uri = photo_(id);
    if (uri && uri.length < 95000) { try { cache.put(k, uri, 21600); } catch (_) {} }   // cache entries are limited to 100 KB
    return ok(uri);
  } catch (e) { return fail(e); }
}

/** PUBLIC. Vision, mission, core values and history. Leaders (names, emails, phones, photos) are NOT returned. */
function getPublicAbout() {
  try {
    const cache = CacheService.getScriptCache(), hit = cache.get('puba_v1');
    if (hit) return JSON.parse(hit);
    const a = aboutRead_();
    const out = ok({ vision: a.vision, mission: a.mission, values: a.values, timeline: a.timeline, leaders: a.leaders.map(l => ({ name:l.name, title:l.title, photo:l.photo })) });
    try { cache.put('puba_v1', JSON.stringify(out), 600); } catch (_) {}
    return out;
  } catch (e) { return fail(e); }
}

/** PUBLIC. URL of the public homepage (used by the sign-in page's "Back to homepage" link). */
function getHomeUrl() { return ScriptApp.getService().getUrl(); }

/** PUBLIC. Returns only approved, sanitized public-page HTML blocks. */
const PUBLIC_BLOCK_KEYS = ['pubhome','pubabout','pubadmissions','pubacademics','pubcampus','pubforms','pubnews','pubcontact','pub_about_values','pub_about_history','pub_about_leadership','pub_adm_enrollment','pub_adm_requirements','pub_adm_scholarships','pub_adm_faq','pub_acad_kindergarten','pub_acad_elementary','pub_acad_junior_high','pub_acad_senior_high','pub_acad_college','pub_campus_organizations','pub_campus_events','pub_campus_sports','pub_campus_clubs','pub_campus_facilities','pub_forms_tlc','pub_forms_consent','pub_news_announcements','pub_news_latest','pub_news_events','pub_news_enrollment','pub_news_achievements'];
function getPublicBlock(key) {
  try {
    key = String(key || '');
    if (!PUBLIC_BLOCK_KEYS.includes(key)) throw new Error('Unknown public page.');
    const b = blockRow_(key);
    const saved = b.row ? String(b.sh.getRange(b.row, 2).getValue() || '') : '';
    let html = saved ? cleanPolicy_(saved) : '';
    // Admin's initial editor placeholders contain headings and generic "to be added" text.
    // Do not let those placeholders replace the complete public-page template.
    const hasRealContent = /<(p|li|h[1-4]|details|summary|blockquote)\b/i.test(html) &&
      !/Content to be added by the Administrator/i.test(html);
    if (!hasRealContent) html = '';
    return ok({ html: html });
  } catch (e) { return fail(e); }
}


/** PUBLIC. Read only the approved facilities gallery and its captions. */
function getPublicFacilities() {
  try {
    const list = galRead_('facilities').list.map(p => ({ id:p.id, cap:p.cap }));
    return ok({ items:list });
  } catch (e) { return fail(e); }
}
/** PUBLIC. Serves only an image already listed in the Facilities & Campus Tour gallery. */
function getPublicFacilityPhoto(id) {
  try {
    id = String(id || '');
    if (!galRead_('facilities').list.some(x => x.id === id)) throw new Error('Photo not found.');
    const cache = CacheService.getScriptCache(), key = 'pubfacility_' + id, hit = cache.get(key);
    if (hit) return ok(hit);
    const uri = photo_(id);
    if (uri && uri.length < 95000) { try { cache.put(key, uri, 21600); } catch (_) {} }
    return ok(uri);
  } catch (e) { return fail(e); }
}
/** PUBLIC. Serves only the one approved photo assigned to a public subsection page. */
function getPublicPagePhoto(page) {
  try {
    page = String(page || '');
    const allowed = ["about-values","about-history","about-leadership","admissions-enrollment","admissions-requirements","admissions-scholarships","admissions-faq","academics-kindergarten","academics-elementary","academics-junior-high","academics-senior-high","academics-college","campus-organizations","campus-events","campus-sports","campus-clubs","campus-facilities","forms-tlc-application","forms-consent","news-announcements","news-latest","news-events","news-enrollment","news-achievements"];
    if (!allowed.includes(page)) throw new Error('Unknown public page.');
    const item = galRead_(page).list[0];
    if (!item) return ok({ photo:'' });
    const cache = CacheService.getScriptCache(), key = 'pubpagephoto_' + page + '_' + item.id, hit = cache.get(key);
    if (hit) return ok({ photo:hit });
    const uri = photo_(item.id);
    if (uri && uri.length < 95000) { try { cache.put(key, uri, 21600); } catch (_) {} }
    return ok({ photo:uri || '' });
  } catch (e) { return fail(e); }
}

/** PUBLIC. Serves only a current School Leadership photo, never private contact details. */
function getPublicLeaderPhoto(id) {
  try {
    id = String(id || '');
    if (!aboutRead_().leaders.some(x => x.photo === id)) throw new Error('Photo not found.');
    const cache = CacheService.getScriptCache(), key = 'publeader_' + id, hit = cache.get(key);
    if (hit) return ok(hit);
    const uri = photo_(id);
    if (uri && uri.length < 95000) { try { cache.put(key, uri, 21600); } catch (_) {} }
    return ok(uri);
  } catch (e) { return fail(e); }
}


/** PUBLIC. Approved historical photo highlights for the About Us page. */
function getPublicHistoryGallery() {
  try { return ok({ items:galRead_('history').list }); }
  catch (e) { return fail(e); }
}
function getPublicHistoryPhoto(id) {
  try {
    id = String(id || '');
    if (!galRead_('history').list.some(x => x.id === id)) throw new Error('Photo not found.');
    const cache = CacheService.getScriptCache(), key = 'pubhistory_' + id, hit = cache.get(key);
    if (hit) return ok(hit);
    const uri = photo_(id);
    if (uri && uri.length < 95000) { try { cache.put(key, uri, 21600); } catch (_) {} }
    return ok(uri);
  } catch (e) { return fail(e); }
}

/* ---------- Uploaded homepage photos ---------- */

const HOME_PHOTO_MAX_B64 = 2200000;               // about 1.5 MB of image data after base64

/** OWNER ONLY. Stores a browser-resized JPEG in the school photos folder and returns a public link. */
function uploadHomepagePhoto(token, dataUrl) {
  const lock = LockService.getScriptLock(); let fid = '';
  try {
    lock.waitLock(20000);
    const u = owner_(token);
    const parts = String(dataUrl || '').split(',');
    if (parts.length < 2 || !/^data:image\/jpeg;base64$/i.test(parts[0])) throw new Error('Photo must be a JPEG image.');
    if (parts[1].length > HOME_PHOTO_MAX_B64) throw new Error('Photo is too large (limit about 1.5 MB).');
    const bytes = Utilities.base64Decode(parts[1]);
    if (!bytes.length || !((bytes[0] & 255) === 0xFF && (bytes[1] & 255) === 0xD8)) throw new Error('Photo must be a JPEG image.');   // bytes are signed in Apps Script
    const f = DriveApp.getFolderById(PHOTO_FOLDER_ID).createFile(Utilities.newBlob(bytes, 'image/jpeg', 'homepage_' + Date.now() + '.jpg'));
    fid = f.getId();
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const url = 'https://drive.google.com/thumbnail?id=' + fid + '&sz=w2000';
    const res = UrlFetchApp.fetch(url + '&cache=' + Date.now(), { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() !== 200) throw new Error('The photo saved, but Drive would not share it. Share the school photos folder as "Anyone with the link" and try again.');
    audit_(u, 'content.upload', 'homepage.photo', fid);
    return ok(url, 'Photo uploaded.');
  } catch (e) {
    if (fid) { try { DriveApp.getFileById(fid).setTrashed(true); } catch (_) {} }   // do not leave an orphan file
    return fail(e);
  } finally { try { lock.releaseLock(); } catch (_) {} }
}

/* ---------- Editable homepage section text ---------- */

const PUBLIC_CONTENT_KEY_ = 'pubhome_content';
const PUBLIC_CONTENT_DEFAULTS_ = {
  values: ['Quality Education', 'Holistic Development', 'Academic Excellence', 'Supportive Community', 'A Brighter Future'],
  aboutEyebrow: 'ABOUT MOREH ACADEMY',
  aboutTitle: 'Building a Strong Foundation for Lifelong Success',
  aboutText: 'Moreh Academy is a learning community committed to providing excellent and values-driven education from Kindergarten to Grade 12.',
  aboutPhoto: 'https://drive.google.com/thumbnail?id=19OD320sqeKyWHhaeA_5mwVxxRKO5HKHy&sz=w1200',
  aboutPhotoAlt: 'Moreh Academy students',
  updatesTitle: '📣 Latest Updates',
  updatesItems: [],
  footerLocation: '📍 Moreh Academy, Taguig City, Philippines',
  footerPhone: '☎ Admissions: 0961 876 6886',
  footerEmail: '✉ registrar@morehacademy.com'
};
/** Homepage photo: a Drive thumbnail or a secure https image address. */
function homeImage_(value, fallback) {
  const s = String(value == null ? fallback : value).trim().slice(0, 1000);
  if (!s) return fallback;
  if (/^https:\/\/drive\.google\.com\/thumbnail\?id=[A-Za-z0-9_-]+(?:&[^"'<> ]*)?$/i.test(s)) return s;
  if (/^https:\/\/(?:lh3\.googleusercontent|images\.unsplash)\.com\/[A-Za-z0-9_./?=&%-]+$/i.test(s)) return s;
  throw new Error('The About photo must be a Google Drive thumbnail link or a secure https image address.');
}
function homeContentText_(value, max, fallback) {
  const s = String(value == null ? fallback : value).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return s || fallback;
}
/** Validates the homepage section text. Blank values fall back to the approved wording. */
function publicContentClean_(input) {
  input = input && typeof input === 'object' ? input : {};
  const d = PUBLIC_CONTENT_DEFAULTS_;
  const vals = Array.isArray(input.values) ? input.values : [];
  return {
    values: [0, 1, 2, 3, 4].map(i => homeContentText_(vals[i], 40, d.values[i])),
    aboutEyebrow: homeContentText_(input.aboutEyebrow, 60, d.aboutEyebrow),
    aboutTitle: homeContentText_(input.aboutTitle, 90, d.aboutTitle),
    aboutText: homeContentText_(input.aboutText, 400, d.aboutText),
    aboutPhoto: homeImage_(input.aboutPhoto, d.aboutPhoto),
    aboutPhotoAlt: homeContentText_(input.aboutPhotoAlt, 100, d.aboutPhotoAlt),
    updatesTitle: homeContentText_(input.updatesTitle, 60, d.updatesTitle),
    footerLocation: homeContentText_(input.footerLocation, 90, d.footerLocation),
    footerPhone: homeContentText_(input.footerPhone, 90, d.footerPhone),
    footerEmail: homeContentText_(input.footerEmail, 90, d.footerEmail),
    updatesItems: (Array.isArray(input.updatesItems) ? input.updatesItems : [])
      .slice(0, 4)
      .map(homeUpdateItem_)
      .filter(it => it.t)
  };
}
/** One line inside the Latest Updates card. Blank rows are dropped. */
function homeUpdateItem_(item) {
  item = item && typeof item === 'object' ? item : {};
  return {
    m: homeContentText_(item.m, 4, '').toUpperCase(),
    d: homeContentText_(item.d, 3, ''),
    t: homeContentText_(item.t, 70, ''),
    s: homeContentText_(item.s, 90, '')
  };
}
function homeEsc_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/** Card rows for the server-rendered homepage. Empty when the live feed should show. */
function homeUpdatesHtml_(items) {
  return (items || []).map(it =>
    '<div class="update"><div class="date"><b>' + homeEsc_(it.m || 'INFO') + '</b>' + homeEsc_(it.d || '—') + '</div>' +
    '<div><strong>' + homeEsc_(it.t) + '</strong>' + (it.s ? '<small>' + homeEsc_(it.s) + '</small>' : '') + '</div></div>'
  ).join('');
}
/** Internal. Saved text merged over the standard wording. */
function homepageContent_() {
  const b = blockRow_(PUBLIC_CONTENT_KEY_);
  let raw = null;
  if (b.row) { try { raw = JSON.parse(String(b.sh.getRange(b.row, 2).getValue() || '')); } catch (_) { raw = null; } }
  return raw ? publicContentClean_(raw) : publicContentClean_({});
}
/** PUBLIC. Plain text only, so it is safe for the open web. */
function getHomepageContent() {
  try { return ok(homepageContent_()); } catch (e) { return fail(e); }
}
/** OWNER ONLY. Saves the homepage section headings and text. */
function saveHomepageContent(token, input) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const u = owner_(token), clean = publicContentClean_(input), b = blockRow_(PUBLIC_CONTENT_KEY_);
    put_(b.sh, b.row || (b.sh.getLastRow() + 1), 1, [[PUBLIC_CONTENT_KEY_, JSON.stringify(clean)]]);
    audit_(u, 'content.save', PUBLIC_CONTENT_KEY_, 'Homepage section headings and text');
    return ok(clean, 'Homepage sections saved.');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

/* ---------- Editable interior page intro text (eyebrow + heading) ---------- */

const PAGE_INTRO_KEY_ = 'pubpage_intro';
/** Which content block each interior page uses (the same map the public page runs on). */
const PAGE_BLOCK_KEYS_ = {"about":"pubabout","admissions":"pubadmissions","academics":"pubacademics","campus-life":"pubcampus","resources":"pubforms","news":"pubnews","contact":"pubcontact","about-values":"pub_about_values","about-history":"pub_about_history","about-leadership":"pub_about_leadership","admissions-enrollment":"pub_adm_enrollment","admissions-requirements":"pub_adm_requirements","admissions-scholarships":"pub_adm_scholarships","admissions-faq":"pub_adm_faq","academics-kindergarten":"pub_acad_kindergarten","academics-elementary":"pub_acad_elementary","academics-junior-high":"pub_acad_junior_high","academics-senior-high":"pub_acad_senior_high","academics-college":"pub_acad_college","campus-organizations":"pub_campus_organizations","campus-events":"pub_campus_events","campus-sports":"pub_campus_sports","campus-clubs":"pub_campus_clubs","campus-facilities":"pub_campus_facilities","forms-tlc-application":"pub_forms_tlc","forms-consent":"pub_forms_consent","news-announcements":"pub_news_announcements","news-latest":"pub_news_latest","news-events":"pub_news_events","news-enrollment":"pub_news_enrollment","news-achievements":"pub_news_achievements"};
/** The eyebrow and heading a page shows until someone edits it. */
const PAGE_INTRO_DEFAULTS_ = {"about":{"eyebrow":"EXPLORE MOREH ACADEMY","title":"About Moreh Academy","lead":"Learn about our purpose, history, and school leadership."},"admissions":{"eyebrow":"EXPLORE MOREH ACADEMY","title":"Admissions","lead":"Explore the enrollment process, requirements, scholarship opportunities, and answers to common questions."},"academics":{"eyebrow":"EXPLORE MOREH ACADEMY","title":"Academic Programs","lead":"At Moreh Academy, we believe that meaningful education develops both knowledge and character. Our academic programs guide learners through every stage of their educational journey."},"campus-life":{"eyebrow":"EXPLORE MOREH ACADEMY","title":"Campus Life","lead":"Education extends beyond academic lessons. Explore student organizations, activities, sports, student development, and campus facilities."},"resources":{"eyebrow":"EXPLORE MOREH ACADEMY","title":"Downloadable Forms","lead":"Find the official forms for students and parents."},"news":{"eyebrow":"EXPLORE MOREH ACADEMY","title":"News & Updates","lead":"Stay connected with the latest happenings, announcements, activities, and achievements of the Moreh Academy community."},"contact":{"eyebrow":"GET IN TOUCH","title":"Contact Information","lead":"For inquiries, please contact the appropriate Moreh Academy office."},"about-values":{"eyebrow":"OUR FOUNDATION","title":"Vision, Mission & Core Values","lead":""},"about-history":{"eyebrow":"OUR STORY","title":"History of Moreh Academy","lead":"Discover the milestones and moments that have shaped the Moreh Academy community."},"about-leadership":{"eyebrow":"OUR PEOPLE","title":"School Leadership","lead":"Meet the people who guide Moreh Academy in its commitment to righteousness and excellence."},"admissions-enrollment":{"eyebrow":"START YOUR JOURNEY","title":"Enrollment Procedure","lead":"Follow these seven steps to complete the admission and enrollment process at Moreh Academy."},"admissions-requirements":{"eyebrow":"ADMISSION CHECKLIST","title":"Admission Requirements","lead":"Select the applicant's level and grade to review the applicable checklist. Scholarship and transferee requirements are included where applicable."},"admissions-scholarships":{"eyebrow":"STUDENT OPPORTUNITIES","title":"Scholarships","lead":"Eligible applicants may inquire about the scholarship and assistance programs listed below. Each program follows its own eligibility and documentation requirements."},"admissions-faq":{"eyebrow":"NEED TO KNOW","title":"Frequently Asked Questions","lead":""},"academics-kindergarten":{"eyebrow":"EARLY LEARNING","title":"Kindergarten","lead":"Our Kindergarten program provides young learners with opportunities to explore, discover, communicate, and develop essential foundational skills in a supportive learning environment."},"academics-elementary":{"eyebrow":"FOUNDATIONAL EDUCATION","title":"Elementary","lead":"The Elementary program develops foundational competencies in literacy, numeracy, communication, critical thinking, and social responsibility."},"academics-junior-high":{"eyebrow":"SECONDARY EDUCATION","title":"Junior High School","lead":"The Junior High School program provides learners with opportunities to strengthen their academic competencies, develop independent thinking, and prepare for specialized Senior High School pathways."},"academics-senior-high":{"eyebrow":"CAREER PATHWAYS","title":"Senior High School","lead":"Our Senior High School program offers specialized learning pathways that allow students to explore their interests, develop competencies, and prepare for higher education, employment, or entrepreneurship."},"academics-college":{"eyebrow":"HIGHER EDUCATION","title":"College Program","lead":"Moreh Academy is preparing for future opportunities in higher education."},"campus-organizations":{"eyebrow":"STUDENT LEADERSHIP","title":"Student Organizations","lead":"Students are encouraged to participate in school-based organizations that promote leadership, collaboration, responsibility, and service."},"campus-events":{"eyebrow":"SCHOOL COMMUNITY","title":"School Activities and Events","lead":"From academic celebrations to institutional gatherings, school activities provide opportunities for students to connect, participate, and develop their talents."},"campus-sports":{"eyebrow":"ATHLETICS","title":"Sports and Athletics","lead":"Our sports and athletic activities encourage students to develop physical fitness, perseverance, teamwork, and a healthy competitive spirit."},"campus-clubs":{"eyebrow":"STUDENT DEVELOPMENT","title":"Clubs and Societies","lead":"Moreh Academy recognizes the importance of developing students beyond academic achievement."},"campus-facilities":{"eyebrow":"EXPLORE OUR CAMPUS","title":"Campus Facilities and Tour","lead":"Explore the learning environments and shared spaces that support the Moreh Academy community."},"forms-tlc-application":{"eyebrow":"DOWNLOADABLE FORMS","title":"TLC Student Application Form","lead":"Access the official TLC Student Application Form here when the school uploads the approved downloadable file."},"forms-consent":{"eyebrow":"DOWNLOADABLE FORMS","title":"Consent Form","lead":"Access the official parent/legal guardian Consent Form here when the school uploads the approved downloadable file."},"news-announcements":{"eyebrow":"OFFICIAL NOTICES","title":"School Announcements","lead":"Official announcements concerning school operations, academic activities, important reminders, and institutional notices."},"news-latest":{"eyebrow":"FROM OUR COMMUNITY","title":"Latest News","lead":"Feature stories covering school activities, academic milestones, student achievements, faculty accomplishments, and institutional developments."},"news-events":{"eyebrow":"MARK YOUR CALENDAR","title":"Upcoming Events","lead":"A calendar-driven listing of future school activities."},"news-enrollment":{"eyebrow":"ENROLLMENT UPDATES","title":"Enrollment Announcements","lead":"Stay informed about enrollment updates for the current academic year."},"news-achievements":{"eyebrow":"MILESTONES","title":"School Achievements","lead":"Showcasing accomplishments of Moreh Academy students, teachers, administrators, and the institution."}};
const PAGE_INTRO_SLUGS_ = Object.keys(PAGE_INTRO_DEFAULTS_);

function pageIntroClean_(input, page) {
  page = String(page || '');
  if (!PAGE_INTRO_SLUGS_.includes(page)) throw new Error('Unknown page.');
  input = input && typeof input === 'object' ? input : {};
  const d = PAGE_INTRO_DEFAULTS_[page];
  return {
    eyebrow: pageBannerText_(input.eyebrow, 60, d.eyebrow),
    title: pageBannerText_(input.title, 90, d.title),
    lead: pageBannerText_(input.lead, 300, d.lead || '')
  };
}
/** Saved intro overrides only; a page without one shows its default wording. */
function pageIntrosRead_() {
  const b = blockRow_(PAGE_INTRO_KEY_); let raw = null;
  if (b.row) { try { raw = JSON.parse(String(b.sh.getRange(b.row, 2).getValue() || '')); } catch (_) { raw = null; } }
  const out = {};
  if (raw && typeof raw === 'object') Object.keys(raw).forEach(function (k) {
    if (!PAGE_INTRO_SLUGS_.includes(k)) return;
    try { out[k] = pageIntroClean_(raw[k], k); } catch (_) {}
  });
  return out;
}
/** PUBLIC. Intro text only, so it is safe for the open web. */
function getPageIntros() {
  try { return ok({ saved: pageIntrosRead_(), defaults: PAGE_INTRO_DEFAULTS_ }); } catch (e) { return fail(e); }
}
/** Internal. The intro a given interior page shows when it has no saved Website Pages content. */
function pageIntroFor_(page) {
  page = String(page || '');
  return pageIntroClean_(pageIntrosRead_()[page] || {}, page);
}
/** Pages whose Website Pages content has been saved; their default intro no longer shows. */
function savedPublicPages_() {
  try {
    const sh = contentSh_(), n = sh.getLastRow();
    if (n < 1) return [];
    const keys = sh.getRange(1, 1, n, 1).getValues().flat().map(String);
    const saved = {};
    keys.forEach(function (k) { if (k) saved[k] = 1; });
    return Object.keys(PAGE_BLOCK_KEYS_).filter(function (slug) { return saved[PAGE_BLOCK_KEYS_[slug]]; });
  } catch (_) { return []; }
}
/** OWNER ONLY. Page slugs whose Website Pages content has been saved. */
function getSavedPublicBlocks(token) {
  try { owner_(token); return ok(savedPublicPages_()); } catch (e) { return fail(e); }
}
/** OWNER ONLY. Saves one interior page eyebrow and heading. */
function savePageIntro(token, page, input) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const u = owner_(token), clean = pageIntroClean_(input, page), all = pageIntrosRead_();
    all[String(page)] = clean;
    const b = blockRow_(PAGE_INTRO_KEY_);
    put_(b.sh, b.row || (b.sh.getLastRow() + 1), 1, [[PAGE_INTRO_KEY_, JSON.stringify(all)]]);
    audit_(u, 'content.save', 'intro.' + page, '');
    return ok(all, 'Intro text saved.');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}
/** OWNER ONLY. Restores the default eyebrow and heading for one page. */
function resetPageIntro(token, page) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const u = owner_(token), all = pageIntrosRead_();
    page = String(page || '');
    if (!PAGE_INTRO_SLUGS_.includes(page)) throw new Error('Unknown page.');
    if (!all[page]) return ok(all, 'This page already shows its default intro text.');
    delete all[page];
    const b = blockRow_(PAGE_INTRO_KEY_);
    put_(b.sh, b.row || (b.sh.getLastRow() + 1), 1, [[PAGE_INTRO_KEY_, JSON.stringify(all)]]);
    audit_(u, 'content.reset', 'intro.' + page, '');
    return ok(all, 'Intro text reset.');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

/* ---------- Editable interior page banners ---------- */

const PAGE_BANNERS_KEY_ = 'pubpage_banners';
const PAGE_BANNER_DEFAULTS_ = {
  eyebrow: 'MOREH ACADEMY · TAGUIG CITY',
  subtitle: 'Welcome to Moreh Academy. School of Righteousness and Excellence.'
};
const PAGE_TITLES_ = {"about":"About Moreh Academy","admissions":"Admissions","academics":"Academic Programs","campus-life":"Campus Life","resources":"Downloadable Forms","news":"News & Updates","contact":"Contact Information","about-values":"Vision, Mission & Core Values","about-history":"History","about-leadership":"School Leadership","admissions-enrollment":"Enrollment Procedure","admissions-requirements":"Admission Requirements","admissions-scholarships":"Scholarships","admissions-faq":"Frequently Asked Questions","academics-kindergarten":"Kindergarten","academics-elementary":"Elementary","academics-junior-high":"Junior High School","academics-senior-high":"Senior High School","academics-college":"College Program","campus-organizations":"Student Organizations","campus-events":"School Activities & Events","campus-sports":"Sports & Athletics","campus-clubs":"Clubs & Societies","campus-facilities":"Campus Facilities & Tour","forms-tlc-application":"TLC Student Application Form","forms-consent":"Consent Form","news-announcements":"School Announcements","news-latest":"Latest News","news-events":"Upcoming Events","news-enrollment":"Enrollment Announcements","news-achievements":"School Achievements"};
const PAGE_BANNER_SLUGS_ = Object.keys(PAGE_TITLES_);

/** Banner background: a Drive thumbnail or any secure https image. Blank keeps the navy gradient. */
function bannerImage_(value) {
  const s = String(value == null ? '' : value).trim().slice(0, 1000);
  if (!s) return '';
  if (/^https:\/\/drive\.google\.com\/thumbnail\?id=[A-Za-z0-9_-]+(?:&[^"'<> ]*)?$/i.test(s)) return s;
  if (/^https:\/\/(?:lh3\.googleusercontent|images\.unsplash)\.com\/[A-Za-z0-9_./?=&%-]+$/i.test(s)) return s;
  throw new Error('Banner photos must be a Google Drive thumbnail link or a secure https image address.');
}
function pageBannerText_(value, max, fallback) {
  const s = String(value == null ? fallback : value).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return s || fallback;
}
/** Validates one page banner. Missing values fall back to the standard wording. */
function pageBannerClean_(input, page) {
  page = String(page || '');
  if (!PAGE_BANNER_SLUGS_.includes(page)) throw new Error('Unknown page.');
  input = input && typeof input === 'object' ? input : {};
  return {
    eyebrow: pageBannerText_(input.eyebrow, 60, PAGE_BANNER_DEFAULTS_.eyebrow),
    title: pageBannerText_(input.title, 90, PAGE_TITLES_[page]),
    subtitle: pageBannerText_(input.subtitle, 200, PAGE_BANNER_DEFAULTS_.subtitle),
    image: bannerImage_(input.image)
  };
}
/** Saved overrides only; a page without an override shows its standard banner. */
function pageBannersRead_() {
  const b = blockRow_(PAGE_BANNERS_KEY_); let raw = null;
  if (b.row) { try { raw = JSON.parse(String(b.sh.getRange(b.row, 2).getValue() || '')); } catch (_) { raw = null; } }
  const out = {};
  if (raw && typeof raw === 'object') Object.keys(raw).forEach(function (k) {
    if (!PAGE_BANNER_SLUGS_.includes(k)) return;
    try { out[k] = pageBannerClean_(raw[k], k); } catch (_) {}
  });
  return out;
}
/** PUBLIC. Banner text and image addresses only, so it is safe for the open web. */
function getPageBanners() {
  try { return ok({ saved: pageBannersRead_(), defaults: PAGE_TITLES_ }); } catch (e) { return fail(e); }
}
/** Internal. The banner a given interior page renders. */
function pageBannerFor_(page) {
  page = String(page || '');
  const saved = pageBannersRead_()[page] || {};
  return pageBannerClean_(saved, page);
}
/** OWNER ONLY. Saves one interior page banner. */
function savePageBanner(token, page, input) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const u = owner_(token), clean = pageBannerClean_(input, page), all = pageBannersRead_();
    all[String(page)] = clean;
    const json = JSON.stringify(all);
    if (json.length > 45000) throw new Error('The saved banners are too long to store.');
    const b = blockRow_(PAGE_BANNERS_KEY_);
    put_(b.sh, b.row || (b.sh.getLastRow() + 1), 1, [[PAGE_BANNERS_KEY_, json]]);
    audit_(u, 'content.save', 'banner.' + page, '');
    return ok(all, 'Banner saved.');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}
/** OWNER ONLY. Removes the override so the page returns to its standard banner. */
function resetPageBanner(token, page) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const u = owner_(token), all = pageBannersRead_();
    page = String(page || '');
    if (!PAGE_BANNER_SLUGS_.includes(page)) throw new Error('Unknown page.');
    if (!all[page]) return ok(all, 'This page already uses the standard banner.');
    delete all[page];
    const b = blockRow_(PAGE_BANNERS_KEY_);
    put_(b.sh, b.row || (b.sh.getLastRow() + 1), 1, [[PAGE_BANNERS_KEY_, JSON.stringify(all)]]);
    audit_(u, 'content.reset', 'banner.' + page, '');
    return ok(all, 'Banner reset to the standard wording.');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

/* ---------- Editable public homepage hero settings ---------- */
const PUBLIC_HERO_KEY_ = 'pubhome_hero';
const PUBLIC_HERO_DEFAULTS_ = {
  headline:'Welcome to Moreh Academy',
  subheadline:'School of Righteousness and Excellence.',
  description:'Welcome to Moreh Academy. School of Righteousness and Excellence.',
  primaryText:'Enroll Now!',
  primaryUrl:'?page=create-account',
  secondaryText:'Discover Moreh Academy',
  secondaryUrl:'?page=about',
  images:[
    'https://drive.google.com/thumbnail?id=138oALvviA236UvUnJZR62TVqask4gmWQ&sz=w2000',
    'https://drive.google.com/thumbnail?id=1GodLs1Umo_qPFwt7PRJIYenfsUsNeJkD&sz=w2000',
    'https://drive.google.com/thumbnail?id=1iW7wmwTgy38RS7g7cccbA-hCBCcd38Xf&sz=w2000'
  ]
};
function publicHeroImage_(value, fallback) {
  const s=String(value||'').trim();
  if (!s) return fallback;
  if (/^https:\/\/drive\.google\.com\/thumbnail\?id=[A-Za-z0-9_-]+(?:&[^"'<> ]*)?$/i.test(s)) return s.slice(0,1000);
  if (/^https:\/\/lh3\.googleusercontent\.com\/[A-Za-z0-9_./?=&%-]+$/i.test(s)) return s.slice(0,1000);
  throw new Error('Hero images must use a Google Drive thumbnail or Google-hosted image URL.');
}
function publicHeroClean_(input) {
  input=input&&typeof input==='object'?input:{};
  const clean=(key,max,fallback)=>String(input[key]==null?fallback:input[key]).replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
  const url=(key,fallback)=>{
    const s=String(input[key]==null?fallback:input[key]).trim().slice(0,1000);
    if (!s) return fallback;
    if (/^https:\/\//i.test(s) || /^\?page=[A-Za-z0-9_-]+$/.test(s)) return s;
    throw new Error('Use a secure https link or an internal ?page= link for homepage buttons.');
  };
  const imgs=Array.isArray(input.images)?input.images:[];
  return {
    headline:clean('headline',100,PUBLIC_HERO_DEFAULTS_.headline),
    subheadline:clean('subheadline',140,PUBLIC_HERO_DEFAULTS_.subheadline),
    description:clean('description',280,PUBLIC_HERO_DEFAULTS_.description),
    primaryText:clean('primaryText',40,PUBLIC_HERO_DEFAULTS_.primaryText),
    primaryUrl:url('primaryUrl',PUBLIC_HERO_DEFAULTS_.primaryUrl),
    secondaryText:clean('secondaryText',50,PUBLIC_HERO_DEFAULTS_.secondaryText),
    secondaryUrl:url('secondaryUrl',PUBLIC_HERO_DEFAULTS_.secondaryUrl),
    images:[0,1,2].map(i=>publicHeroImage_(imgs[i],PUBLIC_HERO_DEFAULTS_.images[i]))
  };
}
/** PUBLIC. Only non-sensitive public homepage presentation settings are returned. */
function getHomepageHero() {
  try {
    const b=blockRow_(PUBLIC_HERO_KEY_);
    if (!b.row) return ok(PUBLIC_HERO_DEFAULTS_);
    const raw=String(b.sh.getRange(b.row,2).getValue()||'');
    if (!raw) return ok(PUBLIC_HERO_DEFAULTS_);
    return ok(publicHeroClean_(JSON.parse(raw)));
  } catch(e) { return fail(e); }
}
/** OWNER ONLY. Saves homepage hero text, CTA links and three approved image URLs. */
function saveHomepageHero(token, input) {
  const lock=LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const u=owner_(token), clean=publicHeroClean_(input), b=blockRow_(PUBLIC_HERO_KEY_);
    put_(b.sh,b.row||(b.sh.getLastRow()+1),1,[[PUBLIC_HERO_KEY_,JSON.stringify(clean)]]);
    audit_(u,'content.save',PUBLIC_HERO_KEY_,'Homepage hero text, links and images');
    return ok(clean,'Homepage hero settings saved.');
  } catch(e) { return fail(e); }
  finally { try { lock.releaseLock(); } catch(_) {} }
}

