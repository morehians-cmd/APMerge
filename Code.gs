/** MOREH ACADEMY PORTAL - Code.gs (core). Field schema (FIELDS), saveStudent, search, dashboard, reports, events, scholarships, fees, settings.
 *  FILE MAP: Security (hashing, sessions, passwords) | Protection (audit, alerts, backup, staff OTP) | Hardening (registration, locked writers, policy sanitizer)
 *  MailSwitch (mail on/off, reset lock) | MailQueue (queued mail) | StaffControl (Encoder hours, deactivate) | ReEnroll (yearly carry-over)
 *  Speed (caches, lookups) | SignInGuard (trusted devices, mail buckets) | Housekeeping (script property cleanup) | Retention (disposal jobs)
 *  Keep your existing SALT value. Add new columns only at the END of FIELDS / UCOLS. Deploy a NEW version after every change. */
const SALT = 'M0r3#@cad3m4';
const PHOTO_FOLDER_ID = '18YcLeZCXpbO4-UIGov6PRlEV1CpZMHxb';
// Optional: public image URL of the blank letterhead (A4 portrait). Leave '' to use the built-in drawn letterhead.
const LETTERHEAD_URL = '';
const SCHOOL = 'MOREH ACADEMY', HEAD_NAME = 'JOSE JAY I. CABARDO', HEAD_TITLE = 'Head, Admissions Office', FEE = 1000;
// Scholarship benefits printed on the confirmation slip, by Category. Edit freely.
const B7 = ['100% Free Tuition Fee','100% Free Miscellaneous Fee','Free 1 Set of School Uniform','Free 1 Physical Education Shirt','Free School ID','Free Teambuilding','Free Swimming Lessons'];
const SCHOLARSHIP = { 'PUB-QVR':B7.concat(['1,000.00 Academic Incentive (G11)']), 'REGULAR':['Full-fee paying student'], 'TLC':B7.concat(['2,000.00 Annual Allowance from LGU']),
  'TLC-OVAP':['Additional Free 1 Set of School Uniform','1,000.00 Academic Incentive (G11)'], 'ESC-JHS':['100% Free Tuition Fee','Miscellaneous Fee - JHS 9,750.00'], 'ESC-SHS':['100% Free Tuition Fee','Miscellaneous Fee - SHS 5,125.00'],
  'QVA PASSER':['100% Free Tuition Fee','Miscellaneous Fee - SHS 5,125.00'], 'IS':B7 };
const GRADES = ['Nursery','Kinder 1','Kinder 2','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'];
const CL = { STEM:'Science, Technology, Engineering, and Mathematics', ASSH:'Arts, Social Sciences, and Humanities', BE:'Business and Entrepreneurship', ICT:'ICT Support and Computer Programming Technologies', HT:'Hospitality and Tourism' };
const w = s => s.split(' ');
const SEC = {
 'Nursery':['JOY'],'Kinder 1':['LOVE','FAITH'],'Kinder 2':['PEACE','HOPE'],
 'Grade 1':['RIGHTEOUSNESS','OBEDIENCE'],'Grade 2':['HARMONY','GOODNESS'],'Grade 3':['KINDNESS','TRUST'],'Grade 4':['RESPECT','COMPASSION'],'Grade 5':['COURTEOUS','UNITY'],'Grade 6':['EXCELLENCE'],
 'Grade 7':w('Charity Courage Generosity Gratitude Humility Integrity Patience Prudence Wisdom Empathy'),
 'Grade 8':w('Amber Amethyst Diamond Garnet Jade Jasper Opal Sapphire Topaz Zircon'),
 'Grade 9':w('Jupiter Mars Mercury Neptune Pluto Saturn Terra Uranus Venus'),
 'Grade 10':w('Copernicus Darwin Franklin Galilei Kepler Mendel Pascal'),
 'Grade 11|STEM':w('JOHN LUKE MATTHEW PAUL PRISCILLA TABITHA'),'Grade 12|STEM':w('ABRAHAM ADAN ISAAC JACOB NOAH SETH'),
 'Grade 11|ASSH':w('ANDREW JAMES MARK NATHANIEL PETER SILAS SIMON THOMAS TIMOTHY'),'Grade 12|ASSH':w('AMOS DANIEL ELISHA EZEKIEL ELIJAH ISAIAH JEREMIAH MICAH SAMUEL'),
 'Grade 11|BE':w('AQUILA THADDEUS PHILEMON ZACCHAEUS'),'Grade 12|BE':w('NEHEMIAH JOSEPH BOAZ JETHRO'),
 'Grade 11|ICT':w('STEPHEN TITUS CORNELIUS'),'Grade 12|ICT':w('JOB UZZIAH BENJAMIN'),
 'Grade 11|HT':w('DAMARIS MARIAM PHOEBE SALOME'),'Grade 12|HT':w('DEBORAH ESTHER RUTH ABIGAIL')
};
Object.keys(SEC).forEach(k => SEC[k] = SEC[k].map(s => s.toUpperCase()));
const REL = ['Catholic','Islam','Iglesia ni Cristo','Iglesia Filipina Independiente','The Episcopal Church in the Philippines','Seventh-day Adventist Church',"Jehovah's Witnesses",'The Church of Jesus Christ of Latter-day Saints','Born Again Christian','Methodist Christian','Protestant','Others, specify'];
const RO = ['None','Original','Photocopy','Original & Photocopy'];
const EDU = ['','Elementary Level','High School Level','High School Graduate','College Level','College Graduate','Vocational Level','Vocational Graduate','Master Degree','Doctorate Degree'];
const O3 = x => [x+' Original', x+' Photocopy', x+' O|P'];
const LIVING = ['Both Father and Mother','Father only','Mother only','Relatives / Legal Guardian','Independent / Boarding / Living alone'];
const CIVIL = ['','Single','Married','Widowed','Separated','Divorced','Annulled','Live-in'];
const CERT_CATS = ['PUB-QVR','ESC','QVA PASSER'];
const REASONS = ['','Transferring to a private / public school','Relocation / Moving family residence','Financial constraints / Difficulty in tuition payment','Health / Medical reasons','Migrating abroad','Online / Distance learning compatibility issues','Distance / Transportation difficulties','Academic adjustment / Program fit','Personal / Family reasons','Other'];
// [section, key, label, type(sel|date|auto|tel|lrn|sec|chk|txt|rad|src), options]
const SY_LIST = [''], PSY_LIST = [''];
for (let y = 2018; y <= 2040; y++) { PSY_LIST.push(y + '-' + (y + 1)); if (y >= 2025) SY_LIST.push(y + '-' + (y + 1)); }
const FIELDS = []; const add = (s,k,l,t,o) => FIELDS.push([s,k,l,t||'txt',o]);
add('academic','Classification','Classification','sel',['','New','Old']);
add('academic','SchoolYear','School Year','sel',SY_LIST);
add('academic','LRN','Learner Reference Number (LRN)','lrn');
add('academic','Surname','Surname'); add('academic','FirstName','First Name'); add('academic','MiddleName','Middle Name'); add('academic','Suffix','Suffix (JR., III, etc.)'); add('hidden','FullName','Full Name','auto');
add('academic','Category','Category','sel',['','PUB-QVR','TLC','REGULAR','ESC','TLC-OVAP','QVA PASSER','IS']);
add('academic','GradeLevel','Grade Level','sel',[''].concat(GRADES));
add('academic','Department','Department','sel',['','Preschool','Elementary','Junior High School','Senior High School']);
add('academic','Cluster','Cluster (Senior High only)','sel',[''].concat(Object.values(CL)));
add('academic','Section','Section','sec');
add('academic','ReferredBy','Referred By');
add('prev','PrevSchool','School Name'); add('prev','PrevSY','School Year','sel',PSY_LIST); add('prev','PrevGrade','Grade Level','sel',[''].concat(GRADES)); add('prev','PrevCluster','Cluster (editable for Grade 11 or 12)','sel',[''].concat(Object.values(CL))); add('prev','PrevSection','Section'); add('prev','PrevAdviser','Adviser'); add('prev','PrevScholarship','Scholarship, if any','sel',['','PUB-QVR','TLC','ESC JHS','ESC SHS','QVA PASSER']); add('hidden','EscCertNo','ESC Certificate Number (legacy)'); add('hidden','VoucherCertNo','Voucher Certificate Number (legacy)'); add('hidden','EscSchoolNo','School ESC Number (legacy)');
add('personal','AddressLine1','Address Line 1 (House/Unit #, Building Name, Street Name)'); add('personal','AddressLine2','Address Line 2 (Subdivision, Village, or Phase)'); add('personal','Barangay','Barangay'); add('personal','City','City'); add('hidden','Province','Province (legacy)');
add('personal','Birthdate','Birth Date','date'); add('personal','Age','Age (auto)','auto');
add('personal','Mobile','Contact Number (11 digits)','tel');
add('personal','SexualOrient','Legal Sex','sel',['','Male','Female']);
add('personal','GenderOrient','Gender Identity (Optional)','sel',['','Feminine','Masculine']);
add('personal','Religion','Religion','sel',[''].concat(REL)); add('personal','ReligionOther','Specify religion');
add('personal','Email','Email Address');
['Father','Mother'].forEach(p => {
  add('family',p+'Name',p+'\u2019s Name'); add('family',p+'Status',p+' is','sel',['','Alive','Deceased']);
  add('family',p+'Occupation','Occupation'); add('family',p+'Education','Highest Educational Attainment','sel',EDU);
  add('family',p+'Mobile','Contact Number (11 digits)','tel'); add('family',p+'Religion','Religion','sel',[''].concat(REL)); add('family',p+'ReligionOther','Specify religion');
});
add('emergency','EmName','Full Name'); add('emergency','EmRelation','Relationship to Applicant');
add('emergency','EmMobile','Contact Number (11 digits)','tel'); add('emergency','EmSameAddr','Same address as the student','chk'); add('emergency','EmAddress','Address');
add('guard','GuardName','Parent / Legal Guardian Full Name'); add('guard','GuardRelation','Guardian Relationship'); add('guard','GuardEmail','Parent / Guardian Email'); add('guard','GuardMobile','Parent / Guardian Mobile (11 digits)','tel'); add('guard','ConsentAt','Privacy consent given on','auto');
add('req','ReqSF9','SF9 / Report Card','sel',RO); add('req','ReqF137','Form 137','sel',RO);
add('req','ReqBirth','Birth Certificate','sel',['None'].concat(O3('PSA'),O3('NSO'),O3('Live Birth Certificate'),['Foreign-Issued Birth Certificate-P','PSA No Record-CRS Form No. 1']));
add('req','ReqMoral','Good Moral Certificate','sel',RO); add('req','ReqJHS','JHS Completion Certificate','sel',RO);
add('req','ReqPhoto','2x2 ID Photo','sel',['None','1 Piece','2 Pieces','3 Pieces']);
add('req','ReqTransferee','Transferee Certification','sel',['None','TLC TF Original','TLC TF Photocopy','TLC TF Original & Photocopy'].concat(O3('ESC Certificate'),O3('Voucher Certificate')));
add('req','ReqConsent','Parental Consent & Data Privacy Undertaking Form','sel',['None','Original']);
add('req','ReqRemarks','Remarks','sel',['None','OVAP Applicant','QVA Applicant','OVAP Passer','QVA Passer','ECD Checklist Passed','ECCD Certificate Submitted','KRA Passed']);
add('status','EnrollStatus','Enrollment Status','sel',['Enrolled','Not Enrolled','Cancelled','Transferred Out']);
add('cancel','CancelDate','Date of Cancellation / Transfer','date'); add('cancel','CancelReason','Primary Reason for Cancellation / Transfer (Select One)','sel',REASONS);
// ---- v2.1 additions: appended AFTER every existing field so existing sheet columns never shift ----
add('academic','CertNo','Certificate Number');
add('personal','Facebook','Facebook Account Link');
add('family','FatherEmail','Email Address'); add('family','MotherEmail','Email Address');
add('living','LivingWith','Who does the student currently live with? (Select one)','rad',LIVING);
add('rel','RelName','Full Name'); add('rel','RelRelation','Relationship to Applicant'); add('rel','RelBirthdate','Birth Date','date'); add('rel','RelAge','Age (auto)','auto');
add('rel','RelSex','Sex Assigned at Birth / Biological Sex','sel',['','Male','Female']);
add('rel','RelGender','Gender Orientation / Identity','sel',['','Masculine','Feminine','Others, specify']); add('rel','RelGenderOther','Specify gender identity');
add('rel','RelMobile','Contact Number (11 digits)','tel'); add('rel','RelCivil','Civil Status','sel',CIVIL);
add('rel','RelSameAddr','Same address as the student','chk'); add('rel','RelAddress','Address');
add('rel','RelSide','Parental Relationship with Student','rad',["Father's Side","Mother's Side",'None']);
add('emergency','EmSource','Quick selection: autofill from','src');
add('cancel','CancelReasonOther','Please specify the other reason');
add('dest','DestSchool','Name of New / Receiving School'); add('dest','DestAddress','School Address'); add('dest','DestType','School Type','rad',['Public','Private','Overseas / International']); add('dest','DestGrade','Intended Grade Level / Program at New School');
add('audit','ProcessedBy','Encoder Name','auto'); add('audit','ProcessedDate','Date Processed','auto'); add('audit','ProcessedTime','Time Processed','auto');
add('personal','BirthPlace','Birth Place');
add('prev','PrevSchoolID','School ID');
add('prev','PrevAddress','School Address');
// ---- v2.2: "Date Submitted" per requirement. Appended LAST so existing sheet columns never shift. ----
[['ReqSF9','SF9 / Report Card'],['ReqF137','Form 137'],['ReqBirth','Birth Certificate'],['ReqMoral','Good Moral Certificate'],['ReqJHS','JHS Completion Certificate'],['ReqPhoto','2x2 ID Photo'],['ReqTransferee','Transferee Certification'],['ReqConsent','Parental Consent & Data Privacy Undertaking Form']]
  .forEach(q => add('req', q[0] + 'Date', q[1] + ' \u2013 Date Submitted', 'date'));
add('req','ReqEnvelope','Long Brown Expandable Envelope','sel',['None','Submitted']);
add('req','ReqEnvelopeDate','Long Brown Expandable Envelope \u2013 Date Submitted','date');
add('hidden','StatusChangedAt','Status changed at','auto');
add('hidden','TempUntil','Temporary enrollment until','auto');
add('hidden','TempBy','Temporary enrollment approved by','auto');
add('hidden','IDNumber','Student ID card number','auto');
add('hidden','IDPhotoID','ID photo file','auto');

const COLS = ['StudentID','CreatedAt'].concat(FIELDS.map(f => f[1]));
/* ---------- Requirements by level ---------- */
const REQ_ALL = ['ReqSF9','ReqF137','ReqBirth','ReqMoral','ReqJHS','ReqPhoto','ReqTransferee','ReqConsent','ReqEnvelope']; // same order as FIELDS
const REQ_STD = ['ReqSF9','ReqF137','ReqMoral','ReqBirth','ReqPhoto','ReqEnvelope','ReqConsent'];
const REQ_RULES = {
  PRE:  { req:['ReqBirth','ReqPhoto','ReqEnvelope','ReqConsent'], opt:[] },   // Nursery, Kinder 1
  ELEM: { req:REQ_STD, opt:[] },                                              // Kinder 2 - Grade 6
  JHS:  { req:REQ_STD, opt:['ReqTransferee'] },                               // Grade 7 - 10
  SHS:  { req:REQ_STD, opt:['ReqTransferee'] }                                // Grade 11 - 12
};
const REQ_TF_CATS = ['TLC','ESC','PUB-QVR','QVA PASSER']; // categories that may need a transfer / voucher certificate
const H_COM = { ReqBirth:'PSA Birth Certificate (photocopy)', ReqPhoto:'Three (3) 2"x2" photos, white background, with nametag', ReqEnvelope:'Long brown expandable envelope, clean and free of writings/markings', ReqConsent:'Original, signed by parent / legal guardian' };
const H_STD = Object.assign({ ReqSF9:'Original official report card', ReqF137:'Original Form 137 / Permanent Record', ReqMoral:'Original certificate' }, H_COM);
const REQ_HINTS = {
  PRE:  H_COM,
  ELEM: H_STD,
  JHS:  Object.assign({}, H_STD, { ReqF137:'Original Form 137 / SF10', ReqTransferee:'TLC Transfer Form (TLC scholars only) or ESC Certification (ESC grantees only)' }),
  SHS:  Object.assign({}, H_COM, { ReqSF9:'Photocopy (grades up to 3rd grading) for evaluation; original upon admission', ReqBirth:'Photocopy for evaluation; original upon admission',
          ReqMoral:'Original, upon admission', ReqF137:'Original Form 137 / SF10, upon admission', ReqTransferee:'ESC Certificate, TLC Transfer Form, or Voucher Certificate (SHSVP / PUB-QVR / QVA)' })
};
// lv = levels, g = optional list of grades. {Y} = first year of the active school year.
const REQ_NOTES = [
  { lv:['PRE','ELEM'], g:['Nursery','Kinder 1','Kinder 2'], t:'All preschool applicants must undergo assessment and evaluation. Please approach Teacher Christine Teodoro at the LC1 Building.' },
  { lv:['PRE'], g:['Kinder 1'], t:'Kinder 1: must be 4 years old on or before October 31, {Y}. Learners who turn 4 between November 1 and December 31, {Y} may be admitted only if they pass the Philippine ECD Checklist (DepEd Order No. 015, s. 2025).' },
  { lv:['ELEM'], g:['Kinder 2'], t:'Kinder 2: must be 5 years old on or before October 31, {Y}. Learners who turn 5 between November 1 and December 31, {Y} may be admitted only with a Certificate of Completion from an ECCD program (Day Care / Child Development Center) or by passing the Philippine ECD Checklist (DepEd Order No. 015, s. 2025).' },
  { lv:['ELEM'], g:['Grade 1'], t:'Grade 1: must have completed Kinder 2 in a DepEd-accredited school, or be at least 6 years old on or before October 31, {Y}. Learners who completed an ECCD or home-based kindergarten program may be admitted if they pass the Kindergarten Readiness Assessment (KRA) or the Philippine ECD Checklist.' },
  { lv:['SHS'], t:'Initial requirements (for evaluation): report card (photocopy, grades up to at least the 3rd grading period), PSA Birth Certificate (photocopy), three 2"x2" photos, long brown expandable envelope.' },
  { lv:['SHS'], t:'Requirements for completion (upon official admission): original report card, original PSA Birth Certificate, original Good Moral Certificate, original Form 137 / SF10.' }
];
const reqNotes_ = () => REQ_NOTES.map(n => Object.assign({}, n, { t:n.t.replace(/\{Y\}/g, activeSY_().slice(0, 4)) }));
const reqLevel_ = g => { const i = GRADES.indexOf(g); return i<0 ? '' : i<2 ? 'PRE' : i<9 ? 'ELEM' : i<13 ? 'JHS' : 'SHS'; };
/** Which requirements apply to this learner. req = mandatory; show = what to display (mandatory + applicable optional + anything already recorded). */
function reqsFor_(r) {
  const lv = reqLevel_(r.GradeLevel), ru = REQ_RULES[lv]; if (!ru) return { level:'', req:[], show:[] };
  const tf = ru.opt.includes('ReqTransferee') && REQ_TF_CATS.includes(r.Category);
  return { level:lv, req:ru.req, show:REQ_ALL.filter(k => ru.req.includes(k) || (tf && k==='ReqTransferee') || (r[k] && r[k]!=='None')) };
}
const STU_SECS = ['prev','personal','family','living','rel','emergency','guard'];
const stuCan_ = f => STU_SECS.includes(f[0]) || (f[0]==='academic' && !['Section','ReferredBy','Category','Classification'].includes(f[1]));
const addr_ = r => [r.AddressLine1,r.AddressLine2,r.Barangay,r.City].filter(Boolean).join(', ');
const ok = (data, message) => ({ success:true, message:message||'', data:data });
const fail = e => ({ success:false, error:e.message });
const deptOf_ = g => { const i = GRADES.indexOf(g); return i<0?'':i<3?'Preschool':i<9?'Elementary':i<13?'Junior High School':'Senior High School'; };

function doGet(e) {
  const p = (e && e.parameter) || {};
  const page = String(p.page || '');
  const wantsAccount = page === 'create-account' || page === 'register';   // homepage "Enroll Now" button
  const portal = page === 'portal' || wantsAccount;
  const publicPages = ["about","admissions","academics","campus-life","resources","news","contact","about-values","about-history","about-leadership","admissions-enrollment","admissions-requirements","admissions-scholarships","admissions-faq","academics-kindergarten","academics-elementary","academics-junior-high","academics-senior-high","academics-college","campus-organizations","campus-events","campus-sports","campus-clubs","campus-facilities","forms-tlc-application","forms-consent","news-announcements","news-latest","news-events","news-enrollment","news-achievements"];
  const isPublicPage = publicPages.indexOf(page) >= 0;
  const t = HtmlService.createTemplateFromFile(portal ? 'Index' : (isPublicPage ? 'PublicPage' : 'PublicHome'));
  t.appUrl = ScriptApp.getService().getUrl();
  t.reg = portal && (String(p.reg || '') === '1' || wantsAccount);
  t.prog = ['TLC','ESC','QVR','QVA'].includes(String(p.prog || '')) ? String(p.prog) : '';
  t.page = isPublicPage ? page : 'home';
  const pageTitles = PAGE_TITLES_;
  t.pageTitle = pageTitles[page] || 'Moreh Academy';
  if (!portal && !isPublicPage) {
    t.hc = homepageContent_();
    t.updatesLive = !(t.hc.updatesItems || []).length;
    t.updatesHtml = homeUpdatesHtml_(t.hc.updatesItems);
  }
  const bn = isPublicPage ? pageBannerFor_(page) : null;
  t.bannerEyebrow = bn ? bn.eyebrow : PAGE_BANNER_DEFAULTS_.eyebrow;
  t.bannerSubtitle = bn ? bn.subtitle : PAGE_BANNER_DEFAULTS_.subtitle;
  t.bannerImage = bn ? bn.image : '';
  t.bannerAttr = (bn && bn.image) ? ' style="background-image:linear-gradient(105deg,#04215ae8,#063f96c9 60%,#1764bdbf),url(&quot;' + bn.image + '&quot;)"' : '';
  if (bn) t.pageTitle = bn.title;
  if (isPublicPage) {
    t.foot = homepageContent_();
    const mail = String(t.foot.footerEmail || '').replace(/^[^A-Za-z0-9]+/, '').trim();
    t.footMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) ? 'mailto:' + mail : '';
    t.introJson = JSON.stringify(pageIntroFor_(page));
    t.introBlocked = savedPublicPages_().indexOf(page) >= 0;
  }
  return t.evaluate()
    .setTitle(portal ? 'Moreh Academy Portal' : (isPublicPage ? 'Moreh Academy | ' + t.pageTitle : 'Moreh Academy'))
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}
function include(f) { return HtmlService.createHtmlOutputFromFile(f).getContent(); }

function rows_(k) {
  const sh = sh_(k), h = k==='S'?COLS:UCOLS;
  if (sh.getLastRow()<2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,h.length).getValues().map(r => { const o={}; h.forEach((c,i)=>o[c]=String(r[i])); return o; });
}
function age_(b) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b||'')) return '';
  const d=new Date(b), n=new Date(); let a=n.getFullYear()-d.getFullYear();
  if (n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate())) a--;
  return String(a);
}
function photo_(id) {
  try { if (!id) return ''; const b = DriveApp.getFileById(id).getBlob(); return 'data:'+b.getContentType()+';base64,'+Utilities.base64Encode(b.getBytes()); } catch(e) { return ''; }
}

/** Cached delivery for the three public header PNGs. Cache chunks stay below Apps Script's per-value limit. */
function publicLogo_(id) {
  try {
    var cache = CacheService.getScriptCache();
    var key = 'public-logo-v1-' + id;
    var meta = cache.get(key + '-meta');
    var encoded = '';
    if (meta) {
      var count = Number(meta);
      for (var i = 0; i < count; i++) {
        var part = cache.get(key + '-' + i);
        if (part === null) { encoded = ''; break; }
        encoded += part;
      }
    }
    if (!encoded) {
      var blob = DriveApp.getFileById(id).getBlob();
      encoded = Utilities.base64Encode(blob.getBytes());
      var chunkSize = 80000;
      var chunks = Math.ceil(encoded.length / chunkSize);
      for (var n = 0; n < chunks; n++) {
        cache.put(key + '-' + n, encoded.slice(n * chunkSize, (n + 1) * chunkSize), 21600);
      }
      cache.put(key + '-meta', String(chunks), 21600);
      return 'data:' + (blob.getContentType() || 'image/png') + ';base64,' + encoded;
    }
    return 'data:image/png;base64,' + encoded;
  } catch (e) {
    return photo_(id);
  }
}

/** Cached image delivery that preserves the Drive file's actual MIME type. */
function publicPhoto_(id) {
  try {
    var cache = CacheService.getScriptCache();
    var key = 'public-photo-v1-' + id;
    var meta = cache.get(key + '-meta');
    var encoded = '', mime = '';
    if (meta) {
      var parts = meta.split('|'), count = Number(parts[0]);
      mime = parts[1] || 'image/jpeg';
      for (var i = 0; i < count; i++) {
        var chunk = cache.get(key + '-' + i);
        if (chunk === null) { encoded = ''; break; }
        encoded += chunk;
      }
    }
    if (!encoded) {
      var blob = DriveApp.getFileById(id).getBlob();
      mime = blob.getContentType() || 'image/jpeg';
      encoded = Utilities.base64Encode(blob.getBytes());
      var size = 80000, total = Math.ceil(encoded.length / size);
      for (var n = 0; n < total; n++) cache.put(key + '-' + n, encoded.slice(n * size, (n + 1) * size), 21600);
      cache.put(key + '-meta', total + '|' + mime, 21600);
    }
    return 'data:' + mime + ';base64,' + encoded;
  } catch (e) { return photo_(id); }
}

/** PUBLIC. Returns the approved About Us photo as a cached image data URI. */
function getPublicAboutPhoto() {
  try { return ok({ photo: publicPhoto_('19OD320sqeKyWHhaeA_5mwVxxRKO5HKHy') }); }
  catch (e) { return fail(e); }
}

/** PUBLIC. Returns only the three approved transparent header PNGs. */
function getPublicHeaderLogos() {
  try {
    return ok({
      academy: publicLogo_('1OlkaaLh1ZaXg7sjfLe0ubDgrlNXiPbQF'),
      mgic: publicLogo_('1b8RARy_gzEBsFuHN8qU2zmpdXX7XrYWq'),
      college: publicLogo_('1WD0A18SLhBaDl9lGi6HOMQOLXggRq3hK')
    });
  } catch (e) { return fail(e); }
}


function searchStudents(token, q, status, limit, grade, sy) {
  try {
    who_(token, 'admin'); q = String(q || '').toLowerCase();
    limit = Math.max(25, Math.min(parseInt(limit, 10) || 25, 5000));
    grade = GRADES.indexOf(grade) >= 0 ? grade : '';
    sy = /^\d{4}-\d{4}$/.test(sy || '') ? sy : '';
    const hits = studentsLite_().filter(s => (s.FullName + s.LRN + s.StudentID).toLowerCase().includes(q))
      .filter(s => !status || status === 'All' || (s.EnrollStatus || 'Not Enrolled') === status)
      .filter(s => !grade || s.GradeLevel === grade)
      .filter(s => !sy || s.SchoolYear === sy).reverse();
    return ok({
      total: hits.length,
      rows: hits.slice(0, limit).map(s => ({ StudentID:s.StudentID, FullName:s.FullName, LRN:s.LRN, GradeLevel:s.GradeLevel, Section:s.Section, EnrollStatus:s.EnrollStatus, SchoolYear:s.SchoolYear })),
      ids: hits.filter(s => s.EnrollStatus !== 'Cancelled').slice(0, 500).map(s => s.StudentID)
    });
  } catch (e) { return fail(e); }
}

function getStudent(token, id) {
  try {
    const u = who_(token); if (u.Role==='student') id = u.StudentID;
    if (OFFICE_CL.indexOf(u.Clearance) >= 0 || ACAD_ROLES.indexOf(u.Clearance) >= 0) throw new Error('Not allowed.');   // office accounts never open full records
    const hit = findRow_('S', 'StudentID', id), s = hit && hit.o;
    if (!s) throw new Error('Student record not found.');
    if (u.Role === 'admin') auditView_(u, id);
    if (u.Role === 'admin') { const ax = findRow_('U', 'StudentID', id), acc = ax && ax.o.Role === 'student' ? ax.o : null; s.Photo = acc ? photo_(acc.PhotoID) : ''; s.AcctLocked = acc && acc.Locked === '1' ? '1' : ''; }
    s.Age = age_(s.Birthdate); s.RelAge = age_(s.RelBirthdate);decorate_(s, u);
    if (!s.CertNo) s.CertNo = s.VoucherCertNo || s.EscCertNo || '';
    if (u.Role==='student') { s.ProcessedBy = ''; s.ProcessedDate = ''; s.ProcessedTime = ''; s.TempBy = ''; s.TempReason = ''; s.Holds = studentHolds_(s.StudentID); }
    else s.HoldOffices = holdsOf_(s.StudentID);
    return ok(s);
  } catch(e) { return fail(e); }
}
function saveStudent(token, rec) {
  const lock = LockService.getScriptLock(); let u, row, old, isNew, oldStatus, statusChanged;
  try {
    u = who_(token);                                   // before the lock: a bad session fails fast
    if (OFFICE_CL.indexOf(u.Clearance) >= 0 || ACAD_ROLES.indexOf(u.Clearance) >= 0) throw new Error('Not allowed.');
    const sh = sh_('S'), admin = u.Role==='admin';
    lock.waitLock(20000);
    const id = admin ? rec.StudentID : u.StudentID, hit = id ? findStudent_(id) : null, rowNo = hit ? hit.r : 0;
    old = hit ? hit.o : null;
    if (!old && !admin) throw new Error('Not allowed.');
    row = old ? Object.assign({}, old) : {}; oldStatus = old ? old.EnrollStatus : ''; isNew = !old;
    FIELDS.forEach(f => { if (f[3]==='auto'||(!admin&&!stuCan_(f))) return; row[f[1]] = String(rec[f[1]]==null?'':rec[f[1]]).trim(); if (f[3]==='txt' && !/(Email|Facebook)$/.test(f[1])) row[f[1]] = row[f[1]].toUpperCase(); });
    if (!admin && old && old.EnrollStatus === 'Enrolled') IDLOCK.forEach(k => row[k] = old[k]);   // identity lock (Hardening)
    if (!row.EnrollStatus) row.EnrollStatus = 'Not Enrolled';
    if (row.Email && !EMAIL_RE.test(row.Email)) throw new Error('Enter a valid student email address.');
    if (row.GuardEmail && !EMAIL_RE.test(row.GuardEmail)) throw new Error('Enter a valid parent / guardian email address.');
    FIELDS.forEach(f => { const v = row[f[1]]; if (typeof v === 'string' && /^[=@\t\r]/.test(v)) throw new Error('"' + f[2] + '" cannot start with = or @.'); });
    FIELDS.forEach(f => { if (/^Req.+Date$/.test(f[1]) && row[f[1]] && !/^\d{4}-\d{2}-\d{2}$/.test(row[f[1]])) throw new Error('"' + f[2] + '" must be a valid date.'); });
    if (!/^[1-5]\d{11}$/.test(row.LRN||'')) throw new Error('LRN must be 12 digits and start with 1, 2, 3, 4 or 5.');
    { if (!row.Surname || !row.FirstName) throw new Error('Surname and first name are required.'); row.FullName = [row.Surname+',', row.FirstName, row.MiddleName ? row.MiddleName[0]+'.' : '', row.Suffix].filter(Boolean).join(' '); }
    if (row.EnrollStatus === 'Temporary' && oldStatus !== 'Temporary') throw new Error('Use "Allow temporary enrollment" in the Enrollment Holds panel to set Temporary.');
    if (row.EnrollStatus === 'Enrolled' && oldStatus !== 'Enrolled' && !isNew) { const h = holdsOf_(row.StudentID); if (h.length) throw new Error('Cannot mark as Enrolled: active hold from ' + h.join(', ') + '. Clear the hold, or use "Allow temporary enrollment".'); }
    if (row.EnrollStatus !== 'Temporary') { row.TempUntil = ''; row.TempBy = ''; row.TempReason = ''; }
    statusChanged = isNew ? row.EnrollStatus!=='Not Enrolled' : oldStatus!==row.EnrollStatus;
    if (row.EnrollStatus==='Cancelled' || row.EnrollStatus==='Transferred Out') {
      if (statusChanged && !row.CancelReason) throw new Error('Step 5: select the primary reason for the cancellation / transfer.');
      if (row.CancelReason==='Other' && !row.CancelReasonOther) throw new Error('Step 5: please specify the other reason.');
      if (!row.CancelDate) row.CancelDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    if (statusChanged) stampAudit_(row, u);
    ['Mobile','FatherMobile','MotherMobile','EmMobile','GuardMobile','RelMobile'].forEach(k => { if (row[k] && !/^\d{11}$/.test(row[k])) throw new Error('Contact numbers must be exactly 11 digits.'); });
    ['FatherEmail','MotherEmail'].forEach(k => { if (row[k] && !EMAIL_RE.test(row[k])) throw new Error('Enter a valid parent email address.'); });
    if (colVals_('LRN').some((v, i) => v === row.LRN && i + 2 !== rowNo)) throw new Error('This LRN already exists.');
    { row.Department = deptOf_(row.GradeLevel) || row.Department; if (row.Department!=='Senior High School') { row.Cluster = ''; }
      if (!['Grade 11','Grade 12'].includes(row.PrevGrade)) row.PrevCluster = '';
      if (!CERT_CATS.includes(row.Category)) row.CertNo = '';
      if (!admin && old && (row.GradeLevel!==old.GradeLevel || row.Cluster!==old.Cluster)) row.Section = ''; }
    if (row.LivingWith!=='Relatives / Legal Guardian') ['RelName','RelRelation','RelBirthdate','RelAge','RelSex','RelGender','RelGenderOther','RelMobile','RelCivil','RelSameAddr','RelAddress','RelSide'].forEach(k => row[k] = '');
    if (row.RelSameAddr==='Yes') row.RelAddress = addr_(row);
    if (row.RelGender!=='Others, specify') row.RelGenderOther = '';
    row.RelAge = age_(row.RelBirthdate);
    if (row.EmSameAddr==='Yes') row.EmAddress = addr_(row);
    row.Age = age_(row.Birthdate);
    let r;
    if (isNew) {
      if (!/^\d{4}-\d{4}$/.test(row.SchoolYear||'')) throw new Error('Select a School Year.');
      row.StudentID = nextIdFast_(sh, row.SchoolYear);
      row.CreatedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      r = sh.getLastRow()+1;
    } else r = rowNo;
    put_(sh, r, 1, [COLS.map(c=>row[c]||'')]);
  } catch(e) { return fail(e); } finally { try { lock.releaseLock(); } catch(_) {} }

  // ---- everything below runs AFTER the lock is released ----
  audit_(u, isNew ? 'student.create' : 'student.update', row.StudentID, isNew ? '' : COLS.filter(c => !['CreatedAt','Age','RelAge','ProcessedBy','ProcessedDate','ProcessedTime'].includes(c) && String(old[c]||'') !== String(row[c]||'')).join(', '));
  if (isNew) notify_(row, 'Application registered', 'Your application has been registered with our Admissions Office. We will email you whenever your enrollment status changes.');
  else if (oldStatus !== row.EnrollStatus) notify_(row, 'Enrollment status update', 'Your enrollment status is now: '+row.EnrollStatus.toUpperCase()+'.');
  if (statusChanged) logStatus_([logRow_(row, isNew?'':oldStatus, u)]);
  return ok(decorate_(row, u), 'Saved '+row.StudentID);
}

function dashboard(token) {
  try {
    who_(token,'admin'); const all = studentsLite_().filter(inSY_), s = all.filter(r=>r.EnrollStatus==='Enrolled');
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const byG = a => a.map(g=>[g, s.filter(r=>r.GradeLevel===g).length]);
    const byC = g => Object.keys(CL).map(c=>[c, s.filter(r=>r.GradeLevel===g && r.Cluster===CL[c]).length]);
    return ok({ stats:{ total:all.length, enrolled:s.length, pending:all.filter(r=>r.EnrollStatus==='Not Enrolled').length, approved:all.filter(r=>r.EnrollStatus==='Approved').length, today:all.filter(r=>String(r.CreatedAt || '').startsWith(today)).length,temp:all.filter(r=>r.EnrollStatus==='Temporary').length,
transferred:all.filter(r=>r.EnrollStatus==='Transferred Out').length,cancelled:all.filter(r=>r.EnrollStatus==='Cancelled').length },
      gradeLevels:byG(GRADES),
      cards:[{title:'Preschool',rows:byG(GRADES.slice(0,3))},{title:'Elementary',rows:byG(GRADES.slice(3,9))},{title:'Junior High School',rows:byG(GRADES.slice(9,13))},{title:'Senior High \u2013 Grade 11',rows:byC('Grade 11')},{title:'Senior High \u2013 Grade 12',rows:byC('Grade 12')}] });
  } catch(e) { return fail(e); }
}

const GROUPS = ['Preschool','Elementary','Junior High School','Senior High \u2013 Grade 11','Senior High \u2013 Grade 12'];
const CATS = ['PUB-QVR','TLC','REGULAR','ESC','TLC-OVAP','QVA PASSER','IS'];
const grpOf_ = g => { const i = GRADES.indexOf(g); return i<0 ? '' : i<3 ? GROUPS[0] : i<9 ? GROUPS[1] : i<13 ? GROUPS[2] : GROUPS[i===13?3:4]; };
function report(token, type, arg, sy) {
  try {
    const _u = who_(token,'admin'); if (_u.Clearance==='Encoder' && type!=='daily') throw new Error('Encoders do not have access to reports.');
    audit_(_u, 'report.view', type, 'SY ' + reportSY_(sy));
    const SYX = reportSY_(sy), all = rowsForSY_(SYX), s = all.filter(r=>r.EnrollStatus!=='Cancelled'&&r.EnrollStatus!=='Transferred Out'), to = all.filter(r=>r.EnrollStatus==='Transferred Out'), n = (a,f)=>a.filter(f).length;
    const asof = 'Data as of '+Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'EEEE, MMMM dd, yyyy  h:mm:ss a');
    const tb = (title,label,rows,fn,num) => { const m={}; rows.forEach(r=>{ const v=fn(r)||'(NONE)'; m[v]=(m[v]||0)+1; });
      let e = Object.entries(m); e = num ? e.sort((a,b)=>String(a[0]).localeCompare(String(b[0]),undefined,{numeric:true})) : e.sort((a,b)=>b[1]-a[1]);
      return { title:title, cols:[label,'Students'], rows:e.concat([['TOTAL',rows.length]]) }; };
    const clab = r => Object.keys(CL).find(k=>CL[k]===r.Cluster) || '';
    const tip = sel => 'Not Enrolled: '+n(s.filter(sel),r=>r.EnrollStatus==='Not Enrolled')+'  \u2022  Transferred Out: '+n(to,sel);
    const matrix = (title,labels,sel,lab,cats,lead) => { cats = cats||CATS; const sub = s.filter(sel);
      const rows = labels.map(l=>{ const x = sub.filter(r=>lab(r)===l); return [l].concat(cats.map(c=>n(x,r=>r.Category===c)),[x.length]); });
      const tips = labels.map(l=>tip(r=>sel(r)&&lab(r)===l));
      rows.push(['TOTAL'].concat(cats.map((c,i)=>rows.reduce((a,r)=>a+r[i+1],0)),[sub.length])); tips.push(tip(sel));
      return { title:title+'  \u2022  NEW '+n(sub,r=>r.Classification==='New')+'  \u2022  OLD '+n(sub,r=>r.Classification==='Old')+'  \u2022  TOTAL '+sub.length, cols:[lead||'LEVEL'].concat(cats,['TOTAL']), rows:rows, tips:tips }; };
    const oldnew = (title,labels) => { const rows = labels.map(l=>{ const x = s.filter(r=>r.GradeLevel===l); return [l,n(x,r=>r.Classification==='Old'),n(x,r=>r.Classification==='New'),x.length]; });
      const tips = labels.map(l=>tip(r=>r.GradeLevel===l)); tips.push(tip(r=>labels.includes(r.GradeLevel)));
      rows.push(['TOTAL',0,0,0].map((v,i)=>i?rows.reduce((a,r)=>a+r[i],0):v));
      return { title:title, cols:['LEVEL','OLD','NEW','TOTAL'], rows:rows, tips:tips }; };
    const ori = ['Male-Masculine','Male-Feminine','Female-Feminine','Female-Masculine'].map(l=>[l,n(s,r=>r.SexualOrient+'-'+r.GenderOrient===l)]);
    const PERSONAL_DEFAULT = ['LRN','Classification','Category','GradeLevel','Section','Birthdate','Age','SexualOrient','Religion','Mobile','FatherName','FatherOccupation','FatherEducation','FatherMobile','FatherReligion','MotherName','MotherOccupation','MotherEducation','MotherMobile','MotherReligion','EmName','EmRelation','EmMobile'];
    // ---------- shared helpers for the visual reports ----------
    const GC = ['#db2777','#16a34a','#2563eb','#7c3aed','#d97706'], SXC = { Male:'#2563eb', Female:'#db2777' };
    const sexOf = r => r.SexualOrient==='Male' ? 'Male' : r.SexualOrient==='Female' ? 'Female' : '';
    const pct = (a,b) => b ? (Math.round(a/b*1000)/10).toFixed(1)+'%' : '0.0%';
    const secLab = x => x || 'UNASSIGNED';
    const catOf = r => (r.Classification==='New' && r.ReqTransferee && r.ReqTransferee!=='None') ? 'Transferee' : (r.Classification||'');
    const rel_ = (r,p) => r[p+'Religion']==='Others, specify' ? (r[p+'ReligionOther']||'') : (r[p+'Religion']||'');
    const dob_ = b => { try { return /^\d{4}-\d{2}-\d{2}$/.test(b||'') ? Utilities.formatDate(new Date(b+'T00:00:00'), Session.getScriptTimeZone(), 'MMM dd, yyyy') : ''; } catch(e) { return b||''; } };
    const byName = (a,b) => String(a.FullName).localeCompare(String(b.FullName));
    // arg = { grade, section }  (section '*' = every section of the grade, '(none)' or '' = unassigned)
    const pick = a => { a = a||{}; const g = String(a.grade||''); if (!GRADES.includes(g)) throw new Error('Select a grade level.');
      const secs = a.section==='*' ? [...new Set(s.filter(r=>r.GradeLevel===g).map(r=>r.Section||''))].sort((x,y)=>(x||'~').localeCompare(y||'~')) : [a.section==='(none)' ? '' : String(a.section||'')];
      if (!secs.length) throw new Error('No learners found for '+g+'.'); return { g:g, secs:secs }; };
    const inSec = (g,sec) => s.filter(r=>r.GradeLevel===g && (r.Section||'')===sec).sort(byName);
    const lvlColor = g => GC[Math.max(0,GROUPS.indexOf(grpOf_(g)))];
    const RQ = [['ReqSF9','SF9 / Report Card',1],['ReqF137','Form 137',1],['ReqBirth','Birth Certificate',1],['ReqMoral','Good Moral',1],['ReqJHS','JHS Completion',0],['ReqPhoto','2x2 ID Photo',1],['ReqTransferee','Transferee Cert.',0],['ReqConsent','Parental Consent',1],['ReqEnvelope','Envelope',1]];
    const needed = (q,r) => reqsFor_(r).req.includes(q[0]);
    const rqOf = r => { const miss = []; const cells = RQ.map(q => { const v = r[q[0]]; if (v && v!=='None') return v; if (needed(q,r)) { miss.push(q[1]); return 'Deficient'; } return 'N/A'; }); return { cells:cells, miss:miss }; };
    const R = {
      daily: () => ({ title:'ADMISSION DAILY REPORT', blocks:[
        matrix('SENIOR HIGH GRADE 12',Object.keys(CL),r=>r.GradeLevel==='Grade 12',clab,CATS,'CLUSTER'),
        matrix('SENIOR HIGH GRADE 11',Object.keys(CL),r=>r.GradeLevel==='Grade 11',clab,CATS,'CLUSTER'),
        matrix('JUNIOR HIGH SCHOOL',GRADES.slice(9,13),r=>grpOf_(r.GradeLevel)===GROUPS[2],r=>r.GradeLevel,['REGULAR','TLC','ESC','IS'],'LEVEL'),
        oldnew('ELEMENTARY',GRADES.slice(3,9)), oldnew('PRESCHOOL',GRADES.slice(0,3)) ].map((b,i)=>Object.assign(b,{ color:['#7c3aed','#7c3aed','#2563eb','#16a34a','#db2777'][i] })) }),
      school: () => ({ title:'PER SCHOOL REPORT', blocks:GROUPS.map((g,gi) => {
        const x = all.filter(r=>grpOf_(r.GradeLevel)===g), m = {};
        x.forEach(r => { const k = r.PrevSchool||'(NONE)', a = m[k]||(m[k]=[0,0]); a[0]++; if (r.EnrollStatus==='Enrolled') a[1]++; });
        const e = Object.entries(m).sort((p,q)=>q[1][0]-p[1][0] || String(p[0]).localeCompare(String(q[0]))), A = x.length, E = n(x,r=>r.EnrollStatus==='Enrolled');
        return { title:g, color:GC[gi], cols:['Previous School','Total Applicants','Enrolled','Conversion Rate'], rows:e.map(z=>[z[0],z[1][0],z[1][1],pct(z[1][1],z[1][0])]).concat([['TOTAL',A,E,pct(E,A)]]), num:[1,2,3], pctCol:3, hcols:{2:'#16a34a',3:'#2563eb'} }; }) }),
      adviser: () => ({ title:'PER PREVIOUS ADVISER REPORT', blocks:GROUPS.map((g,gi) => {
        const x = all.filter(r=>grpOf_(r.GradeLevel)===g), m = {};
        x.forEach(r => { const a = String(r.PrevAdviser||'').trim()||'(NONE)', sc = String(r.PrevSchool||'').trim()||'(NONE)', k = a+'||'+sc, e = m[k]||(m[k]=[a,sc,0,0]);
          e[2]++; if (r.EnrollStatus==='Enrolled') e[3]++; });
        const e = Object.values(m).sort((p,q)=>q[2]-p[2] || String(p[0]).localeCompare(String(q[0]))), A = x.length, E = n(x,r=>r.EnrollStatus==='Enrolled');
        return { title:g, color:GC[gi], cols:['Previous Adviser','Previous School','Total Applicants','Enrolled','Conversion Rate'],
          rows:e.map(z=>[z[0],z[1],z[2],z[3],pct(z[3],z[2])]).concat([['TOTAL','',A,E,pct(E,A)]]), num:[2,3,4], pctCol:4, hcols:{3:'#16a34a',4:'#2563eb'} }; }) }),
        advd: () => { const a0 = String((arg&&arg.a)||''), s0 = String((arg&&arg.s)||''), nz = v => String(v||'').trim()||'(NONE)';
         const x = all.filter(r => nz(r.PrevAdviser)===a0 && nz(r.PrevSchool)===s0).sort(byName);
         return { title:'ADVISER: '+a0, blocks:[{ title:a0+'  \u2022  '+s0+'  \u2022  '+x.length+' learner'+(x.length===1?'':'s'), color:'#2563eb',
          cols:['Enrollment ID','Learner','Level / Section','Status'], bcols:{3:'status'},
          rows:x.map(r=>[r.StudentID,r.FullName,(r.GradeLevel+(r.Section?' \u2013 '+r.Section:'')).trim(),r.EnrollStatus||'Not Enrolled']) }] }; },
      section: () => {
        const bl = [], lv = [];
        GROUPS.forEach((gname,gi) => { const rows = [], acts = []; let M=0, F=0, T=0;
          GRADES.filter(g=>grpOf_(g)===gname).forEach(g => {
            const secs = [...new Set(s.filter(r=>r.GradeLevel===g).map(r=>r.Section||''))].sort((x,y)=>(x||'~').localeCompare(y||'~'));
            secs.forEach(sec => { const x = s.filter(r=>r.GradeLevel===g && (r.Section||'')===sec), m = n(x,r=>sexOf(r)==='Male'), f = n(x,r=>sexOf(r)==='Female');
              rows.push([g,secLab(sec),m,f,x.length]); acts.push({ g:g, s:sec }); M+=m; F+=f; T+=x.length; }); });
          lv.push([gname,M,F,T]); rows.push(['TOTAL','',M,F,T]); acts.push(null);
          bl.push({ title:gname, color:GC[gi], cols:['Grade Level','Section','Male','Female','Total Students'], rows:rows, actions:acts, num:[2,3,4], hcols:{2:SXC.Male,3:SXC.Female} }); });
        const tM = lv.reduce((a,x)=>a+x[1],0), tF = lv.reduce((a,x)=>a+x[2],0), tT = lv.reduce((a,x)=>a+x[3],0);
        return { title:'SECTION REPORT', blocks:[{ kpis:[{label:'Total Learners',value:tT,sub:'Active enrollees',c:'c1'},{label:'Male',value:tM,sub:pct(tM,tT)+' of learners',c:'c2'},{label:'Female',value:tF,sub:pct(tF,tT)+' of learners',c:'c5'},{label:'Sections',value:bl.reduce((a,b)=>a+b.rows.length-1,0),sub:'With learners',c:'c4'}],
          charts:[{ type:'stack', title:'Learners by level and sex', labels:lv.map(x=>x[0]), series:[{name:'Male',color:SXC.Male,values:lv.map(x=>x[1])},{name:'Female',color:SXC.Female,values:lv.map(x=>x[2])}] }] }].concat(bl) };
      },
      overview: () => {
        const gl = r => grpOf_(r.GradeLevel) || 'Unassigned', names = GROUPS.concat(['Unassigned']);
        const st = x => { const en = n(x,r=>r.EnrollStatus==='Enrolled'), ct = n(x,r=>r.EnrollStatus==='Cancelled'||r.EnrollStatus==='Transferred Out'); return { a:x.length, en:en, ct:ct, pe:x.length-en-ct }; };
        const L = names.map((g,i) => ({ g:g, c:i<5?GC[i]:'#94a3b8', t:st(all.filter(r=>gl(r)===g)) })).filter(x=>x.g!=='Unassigned' || x.t.a>0), T = st(all);
        const rows = L.map(x=>[x.g,x.t.a,x.t.en,x.t.pe,x.t.ct,pct(x.t.en,x.t.a)]).concat([['TOTAL',T.a,T.en,T.pe,T.ct,pct(T.en,T.a)]]);
        return { title:'SCHOOL OVERVIEW / ADMISSION CONVERSION', blocks:[
          { kpis:[{label:'Total Applicants',value:T.a,sub:'All registrations',c:'c1'},{label:'Total Enrolled',value:T.en,sub:'Confirmed enrollees',c:'c2'},{label:'Not Yet Enrolled',value:T.pe,sub:'Pending applicants',c:'c3'},{label:'Conversion Rate',value:pct(T.en,T.a),sub:'Enrolled \u00f7 Applicants',c:'c4'}],
            charts:[{ type:'funnel', title:'Admission funnel', stages:[{label:'Total Applicants',value:T.a,color:'#2563eb'},{label:'Active (not cancelled / transferred)',value:T.a-T.ct,color:'#7c3aed'},{label:'Enrolled',value:T.en,color:'#16a34a'}] },
              { type:'stack', title:'Status by level', labels:L.map(x=>x.g), series:[{name:'Enrolled',color:'#16a34a',values:L.map(x=>x.t.en)},{name:'Not Enrolled',color:'#f59e0b',values:L.map(x=>x.t.pe)},{name:'Cancelled / Transferred',color:'#dc2626',values:L.map(x=>x.t.ct)}] }] },
          { title:'Admission conversion by level', color:'#12204a', cols:['Level','Total Applicants','Total Enrolled','Not Enrolled','Cancelled / Transferred','Conversion Rate'], rows:rows, num:[1,2,3,4,5], pctCol:5,
            rcol:L.map(x=>x.c), hcols:{2:'#16a34a',3:'#d97706',4:'#dc2626',5:'#2563eb'} }] };
      },
      demographic: () => {
        const X = (title,label,fn,o) => { o = o||{}; const m = {}; (o.fixed||[]).forEach(k=>m[k]=[0,0,0,0,0,0]);
          s.forEach(r => { const k = fn(r)||'(NONE)', a = m[k]||(m[k]=[0,0,0,0,0,0]), gi = GROUPS.indexOf(grpOf_(r.GradeLevel)); if (gi>=0) a[gi]++; a[5]++; });
          let e = Object.entries(m); e = o.num ? e.sort((x,y)=>String(x[0]).localeCompare(String(y[0]),undefined,{numeric:true})) : o.fixed ? e : e.sort((x,y)=>y[1][5]-x[1][5]);
          const tot = [0,0,0,0,0,0]; e.forEach(x=>x[1].forEach((v,i)=>tot[i]+=v));
          return { title:title, color:o.color||'#12204a', cols:[label].concat(GROUPS,['Total Students']), rows:e.map(x=>[x[0]].concat(x[1])).concat([['TOTAL'].concat(tot)]), num:[1,2,3,4,5,6], levelCols:true, rcol:o.rcol }; };
        const sx = X('Sex','Sex',r=>sexOf(r)||'Not specified',{ fixed:['Male','Female'], rcol:[SXC.Male,SXC.Female] });
        const og = X('Sex and Gender Identity','Sex-Gender',r=>(r.SexualOrient&&r.GenderOrient)?r.SexualOrient+'-'+r.GenderOrient:'',{ fixed:['Male-Masculine','Male-Feminine','Female-Feminine','Female-Masculine'] });
        const tt = sx.rows[sx.rows.length-1];
        return { title:'DEMOGRAPHIC REPORT', blocks:[
          { kpis:[{label:'Total Learners',value:tt[6],sub:'Active enrollees',c:'c1'},{label:'Male',value:sx.rows[0][6],sub:pct(sx.rows[0][6],tt[6]),c:'c2'},{label:'Female',value:sx.rows[1][6],sub:pct(sx.rows[1][6],tt[6]),c:'c5'}],
            charts:[{ type:'stack', title:'Sex by level', labels:GROUPS, series:[{name:'Male',color:SXC.Male,values:sx.rows[0].slice(1,6)},{name:'Female',color:SXC.Female,values:sx.rows[1].slice(1,6)}] }] },
          sx, og,
          X('Religion','Religion',r=>r.Religion==='Others, specify'?'OTHERS: '+r.ReligionOther:r.Religion),
          X('By Age','Age',r=>age_(r.Birthdate),{ num:true }), X('By Year of Birth','Year',r=>(r.Birthdate||'').slice(0,4),{ num:true }),
          X('By School','Previous School',r=>r.PrevSchool), X('By Barangay and City','Barangay, City',r=>[r.Barangay,r.City].filter(Boolean).join(', ')) ] };
      },
      advisory: () => {
        const P = pick(arg), bl = [];
        P.secs.forEach(sec => { const x = inSec(P.g,sec), head = P.g+' \u2013 '+secLab(sec);
          ['Male','Female'].forEach(sx => { const y = x.filter(r=>sexOf(r)===sx); bl.push({ title:head+'  \u2022  '+sx.toUpperCase()+' ('+y.length+')', color:SXC[sx], cols:['No.','Enrollment ID','LRN','Full Name','Category'], rows:y.map((r,i)=>[String(i+1),r.StudentID,r.LRN,r.FullName,catOf(r)]) }); });
          const u = x.filter(r=>!sexOf(r)); if (u.length) bl.push({ title:head+'  \u2022  SEX NOT SPECIFIED ('+u.length+')', color:'#64748b', cols:['No.','Enrollment ID','LRN','Full Name','Category'], rows:u.map((r,i)=>[String(i+1),r.StudentID,r.LRN,r.FullName,catOf(r)]) }); });
        return { title:(arg&&arg.ml)?'MASTERLIST':'ADVISORY CLASS REPORT', blocks:bl };
      },
      personal: () => {
        const P = pick(arg), A = arg||{}, want = Array.isArray(A.fields) && A.fields.length ? A.fields : PERSONAL_DEFAULT;
        const HO = { EmName:'Primary Contact Name', EmRelation:'Primary Contact Relationship', EmMobile:'Primary Contact Number', EmSameAddr:'Primary Contact Same Address as Student', EmAddress:'Primary Contact Address',
          RelName:'Relative/Guardian Name', RelRelation:'Relative/Guardian Relationship', RelBirthdate:'Relative/Guardian Birth Date', RelAge:'Relative/Guardian Age', RelSex:'Relative/Guardian Sex', RelGender:'Relative/Guardian Gender', RelGenderOther:'Relative/Guardian Gender (Specify)', RelMobile:'Relative/Guardian Contact Number', RelCivil:'Relative/Guardian Civil Status', RelSameAddr:'Relative/Guardian Same Address as Student', RelAddress:'Relative/Guardian Address', RelSide:'Relative/Guardian Side',
          GuardName:'Minor Guardian Name', GuardRelation:'Minor Guardian Relationship', GuardEmail:'Minor Guardian Email', GuardMobile:'Minor Guardian Mobile', ConsentAt:'Privacy Consent Date',
          DestSchool:'Receiving School', DestAddress:'Receiving School Address', DestType:'Receiving School Type', DestGrade:'Receiving Grade / Program',
          CancelDate:'Cancellation / Transfer Date', CancelReason:'Cancellation Reason', CancelReasonOther:'Cancellation Reason (Other)', ProcessedBy:'Processed By', ProcessedDate:'Date Processed', ProcessedTime:'Time Processed', FullAddress:'Complete Address' };
        const hdr = f => { const k = f[1]; if (HO[k]) return HO[k]; let l = String(f[2]).replace(/\s*\([^)]*\)\s*$/,'').replace('Specify religion','Religion (Specify)');
          if (f[0]==='family') { const pp = k.indexOf('Father')===0 ? 'Father' : 'Mother'; if (/Status$/.test(k)) return pp+' Status'; if (/Name$/.test(k)) return pp+' Name'; return pp+' '+l.replace('Highest Educational Attainment','Education'); }
          if (f[0]==='prev') return 'Previous '+l; return l; };
        let defs = FIELDS.filter(f => f[0]!=='hidden' && f[3]!=='src' && f[1]!=='FullName');
        const ia = defs.findIndex(f=>f[1]==='AddressLine1'); defs.splice(Math.max(0,ia),0,['personal','FullAddress','Complete Address','txt']);
        defs = defs.filter(f => want.includes(f[1]));
        if (!defs.length) throw new Error('Select at least one data field.');
        const val = (r,f) => { const k = f[1]; return k==='Age' ? age_(r.Birthdate) : k==='RelAge' ? age_(r.RelBirthdate) : k==='FullAddress' ? addr_(r) : (r[k]||''); };
        const rows = []; P.secs.forEach(sec => inSec(P.g,sec).forEach(r => rows.push([r.StudentID, r.FullName].concat(defs.map(f=>val(r,f))))));
        return { title:"LEARNER'S PERSONAL DATA REPORT", blocks:[{ title:P.g+' \u2013 '+(P.secs.length>1?'ALL SECTIONS':secLab(P.secs[0]))+'  \u2022  '+rows.length+' learner'+(rows.length===1?'':'s')+'  \u2022  '+defs.length+' data field'+(defs.length===1?'':'s'),
          color:lvlColor(P.g), cols:['Enrollment ID','Full Name'].concat(defs.map(hdr)), rows:rows, plain:true }] };
      },
      requirements: () => {
        const P = pick(arg), bl = [], tally = { ok:0, bad:0 };
        P.secs.forEach(sec => { const x = inSec(P.g,sec), head = P.g+' \u2013 '+secLab(sec), bc = {};
          RQ.forEach((q,i)=>bc[i+1]='req'); bc[RQ.length+1] = 'req';
          const rows = x.map(r => { const o = rqOf(r); if (o.miss.length) tally.bad++; else tally.ok++;
            return [r.FullName].concat(o.cells,[o.miss.length?'Deficient ('+o.miss.length+')':'Complete', [(r.ReqRemarks&&r.ReqRemarks!=='None')?r.ReqRemarks:'', o.miss.length?'Missing: '+o.miss.join(', '):''].filter(Boolean).join(' \u2022 ')]); });
          bl.push({ title:head+'  \u2022  '+x.length+' learner'+(x.length===1?'':'s'), color:lvlColor(P.g), cols:['Learner'].concat(RQ.map(q=>q[1]),['Status','Remarks']), rows:rows, bcols:bc }); });
        const T = tally.ok + tally.bad;
        return { title:'REQUIREMENTS STATUS REPORT', blocks:[{ kpis:[{label:'Learners',value:T,sub:P.g,c:'c1'},{label:'Complete',value:tally.ok,sub:pct(tally.ok,T),c:'c2'},{label:'Deficient',value:tally.bad,sub:pct(tally.bad,T),c:'c5'}],
          charts:[{ type:'donut', title:'Requirements completion', center:'Learners', items:[{label:'Complete',value:tally.ok,color:'#16a34a'},{label:'Deficient',value:tally.bad,color:'#dc2626'}] }] }].concat(bl) };
      },
      scholar: () => {
        const lvl = String(arg||'All'); let cd;
        if (lvl==='All') cd = GROUPS.map(g=>[g,r=>grpOf_(r.GradeLevel)===g]);
        else { if (!GROUPS.includes(lvl)) throw new Error('Unknown level.'); cd = GRADES.filter(g=>grpOf_(g)===lvl).map(g=>[g,r=>r.GradeLevel===g]); }
        const pop = lvl==='All' ? s : s.filter(r=>grpOf_(r.GradeLevel)===lvl);
        const defs = [['PUB-QVR','PUB-QVR','#2563eb'],['ESC','ESC','#16a34a'],['TLC','TLC','#d97706'],['TLC-OVAP','TLC-OVAP','#7c3aed'],['IS','IS','#db2777'],['REGULAR','Regular / Non-Scholar','#64748b'],['QVA PASSER','QVA PASSER','#0891b2']];
        if (pop.some(r=>!r.Category)) defs.push(['','(Not set)','#94a3b8']);
        const cnt = defs.map(d => { const x = pop.filter(r=>(r.Category||'')===d[0]); return { d:d, x:x, per:cd.map(c=>n(x,c[1])) }; });
        const rows = cnt.map(c=>[c.d[1]].concat(c.per,[c.x.length])), tot = ['TOTAL'].concat(cd.map((c,i)=>cnt.reduce((a,z)=>a+z.per[i],0)),[pop.length]); rows.push(tot);
        const sch = cnt.filter(c=>c.d[0] && c.d[0]!=='REGULAR').reduce((a,c)=>a+c.x.length,0), reg = cnt.filter(c=>c.d[0]==='REGULAR').reduce((a,c)=>a+c.x.length,0);
        return { title:'SCHOLARSHIP BENEFICIARIES REPORT'+(lvl==='All'?'':' \u2013 '+lvl.toUpperCase()), blocks:[
          { kpis:[{label:'Total Learners',value:pop.length,sub:lvl==='All'?'All levels':lvl,c:'c1'},{label:'Scholarship Beneficiaries',value:sch,sub:pct(sch,pop.length)+' of learners',c:'c2'},{label:'Regular / Non-Scholar',value:reg,sub:pct(reg,pop.length)+' of learners',c:'c3'}],
            charts:[{ type:'donut', title:'Share by scholarship type', center:'Learners', items:cnt.map(c=>({label:c.d[1],value:c.x.length,color:c.d[2]})) },
              { type:'stack', title:'By '+(lvl==='All'?'level':'grade level'), labels:cd.map(c=>c[0]), series:cnt.map(c=>({name:c.d[1],color:c.d[2],values:c.per})) }] },
          { title:'Beneficiaries by '+(lvl==='All'?'level':'grade level'), color:'#12204a', cols:['Scholarship / Category'].concat(cd.map(c=>c[0]),['Total Students']), rows:rows, num:cd.map((c,i)=>i+1).concat([cd.length+1]), levelCols:lvl==='All', rcol:defs.map(d=>d[2]) }] };
      },
      referral: () => { const t = tb('Referrers','Referrer',s.filter(r=>r.ReferredBy),r=>r.ReferredBy); t.cols = ['Referrer','Referred students']; return { title:'REFERRAL REPORT', blocks:[t] }; },
      noconsent: () => ({ title:'NO PARENTAL CONSENT', blocks:[{ title:'Learners without a submitted Parental Consent & Data Privacy Undertaking Form', bcols:{3:'status'}, color:'#d97706', cols:['ID','Learner','Grade & Section','Status'], rows:s.filter(r=>r.ReqConsent!=='Original').map(r=>[r.StudentID,r.FullName,(r.GradeLevel+' '+r.Section).trim(),r.EnrollStatus]) }] }),
      refd: () => ({ title:'REFERRED BY '+arg, blocks:[{ title:'Referred by '+arg, cols:['Referred student','Level / Section','Department','Date completed'],
        rows:s.filter(r=>r.ReferredBy===arg).map(r=>[r.FullName,r.GradeLevel+(r.Section?' \u2013 '+r.Section:''),r.Department,r.EnrollStatus==='Enrolled'?r.CreatedAt.slice(0,10):'']) }] })
    };
    if (!Object.prototype.hasOwnProperty.call(R, type)) throw new Error('Unknown report.');
    const out = R[type](); out.asof = 'School Year ' + SYX + '  \u2022  ' + asof; out.sy = SYX; rpLog_(_u, type, 'Preview', SYX, 'Success', rpDetail_(arg)); return ok(out);
  } catch(e) { return fail(e); }
}


/* ---------- Audit trail: who processed a status change, and when ---------- */
const LOG_COLS = ['Date','Time','StudentID','Learner','From','To','Reason','Destination School','Encoder Username','Encoder Name'];
function stampAudit_(row, u) {
  const tz = Session.getScriptTimeZone(), d = new Date();
  row.ProcessedBy = u.FullName || u.Username;
  row.ProcessedDate = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  row.ProcessedTime = Utilities.formatDate(d, tz, 'hh:mm:ss a');
  row.StatusChangedAt = Utilities.formatDate(d, tz, 'yyyy-MM-dd HH:mm:ss');
}
function logRow_(row, from, u) {
  const reason = row.CancelReason==='Other' && row.CancelReasonOther ? 'Other: '+row.CancelReasonOther : (row.CancelReason||'');
  const cx = row.EnrollStatus==='Cancelled' || row.EnrollStatus==='Transferred Out';
  return [row.ProcessedDate, row.ProcessedTime, row.StudentID, row.FullName, from||'(new)', row.EnrollStatus, cx?reason:'', cx?row.DestSchool||'':'', u.Username, u.FullName||''];
}
function logSh_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); let sh = ss.getSheetByName('Status Log');
  if (!sh) { sh = ss.insertSheet('Status Log'); sh.getRange(1,1,1,LOG_COLS.length).setValues([LOG_COLS]).setFontWeight('bold'); sh.setFrozenRows(1); sh.getRange(1,1,sh.getMaxRows(),LOG_COLS.length).setNumberFormat('@'); }
  return sh;
}
function logStatus_(rows) {
  try { const sh = logSh_(); put_(sh, sh.getLastRow()+1, 1, rows); } catch(e) { Logger.log(e.message); }
}


/** Sign out: invalidates the session token. */
function logout(token) { try { CacheService.getScriptCache().remove('s_'+token); } catch(e) {} return ok(null,'Signed out'); }

/* ---------- Upcoming School Events (students: view only, admin: add/edit/delete) ---------- */
const EVCOLS = ['EventID','Title','EventDate','EventTime','Venue','Details','UpdatedAt','UpdatedBy','Category'], EVCATS = ['Announcement','Enrollment','Academic','Activities','Meetings','Holiday','Other']
function evSh_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); let sh = ss.getSheetByName('Events');
  if (!sh) { sh = ss.insertSheet('Events'); sh.getRange(1,1,1,EVCOLS.length).setValues([EVCOLS]).setFontWeight('bold'); sh.setFrozenRows(1); sh.getRange(1,1,sh.getMaxRows(),EVCOLS.length).setNumberFormat('@'); }
  else if (sh.getLastColumn() < EVCOLS.length) { // older sheet: append the new Category column automatically
    const from = sh.getLastColumn()+1;
    if (sh.getMaxColumns() < EVCOLS.length) sh.insertColumnsAfter(sh.getMaxColumns(), EVCOLS.length-sh.getMaxColumns());
    sh.getRange(1,from,sh.getMaxRows(),EVCOLS.length-from+1).setNumberFormat('@');
    sh.getRange(1,1,1,EVCOLS.length).setValues([EVCOLS]).setFontWeight('bold');
  }
  return sh;
}
function getEvents(token) {
  try {
    const u = who_(token), sh = evSh_(), today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    let ev = sh.getLastRow()<2 ? [] : sh.getRange(2,1,sh.getLastRow()-1,EVCOLS.length).getValues().map(r => { const o={}; EVCOLS.forEach((c,i)=>o[c]=String(r[i])); return o; });
    if (u.Role!=='admin') ev = ev.filter(e=>e.EventDate>=today);
    ev.sort((a,b)=>(a.EventDate+a.EventTime).localeCompare(b.EventDate+b.EventTime));
    return ok(ev);
  } catch(e) { return fail(e); }
}
function saveEvent(token, e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); const u = owner_(token), sh = evSh_();
    const t = String(e.Title||'').trim().slice(0,120), d = String(e.EventDate||'').trim();
    if (!t) throw new Error('Event title is required.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('Select the event date.');
    const rec = { EventID:String(e.EventID||'')||('EV'+Date.now()), Title:t, EventDate:d, EventTime:String(e.EventTime||'').trim().slice(0,40), Venue:String(e.Venue||'').trim().slice(0,120),
      Details:String(e.Details||'').trim().slice(0,1000), Category:(EVCATS.includes(e.Category)?e.Category:'Other'), UpdatedAt:Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), UpdatedBy:u.Username };
    const ids = sh.getLastRow()<2 ? [] : sh.getRange(2,1,sh.getLastRow()-1,1).getValues().flat().map(String), i = ids.indexOf(rec.EventID);
    put_(sh, i<0?sh.getLastRow()+1:i+2, 1, [EVCOLS.map(c=>rec[c])]);
    audit_(u, i<0?'event.create':'event.update', rec.EventID, rec.Title);
    invalidatePublicContentCache_();
    return ok(rec, 'Event saved');
  } catch(err) { return fail(err); } finally { try { lock.releaseLock(); } catch(_) {} }
}

/* ---------- Access levels ---------- */
const FULL_CL = ['Full', 'Manager'];
const isFull_ = u => FULL_CL.indexOf(u.Clearance) >= 0;

/** Administrator or System Manager: everything an admin can do except System Administration. */
function owner_(token) {
  const u = who_(token, 'admin');
  if (!isFull_(u)) throw new Error('Only the administrator or System Manager can do this.');
  return u;
}

/** System Administration only (User Management, Enrollment Settings, ID Artwork): main administrator. */
function sysOwner_(token) {
  const u = who_(token, 'admin');
  if (u.Clearance !== 'Full') throw new Error('Only the main administrator can do this.');
  return u;
}

/** Creates an Encoder: Role 'admin' (full admin privileges) but Clearance 'Encoder' (cannot manage users). */
function createStaff(token, f) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); const ou = sysOwner_(token);
    const un = String(f.username||'').trim().toLowerCase(), name = String(f.fullName||'').trim().toUpperCase(), em = String(f.email||'').trim(), dept = String(f.department||'').trim().slice(0,60);
    let pw = String(f.password || '');
    if (!name) throw new Error('Full name is required.');
    if (!dept) throw new Error('Department is required.');
    if (!/^[a-z0-9._@-]{4,40}$/.test(un)) throw new Error('Username must be 4-40 characters (letters, numbers, . _ @ -).');
    if (rows_('U').some(u=>u.Username===un)) throw new Error('This username already exists.');
    if (em && !EMAIL_RE.test(em)) throw new Error('Enter a valid email address.');
    if (otpOn_() && !em) throw new Error('An email address is required: staff sign-in codes are switched on.');
    if (pw && pw.length<8) throw new Error('Password must be at least 8 characters.');
    if (!pw) pw = tempPw_();
    const cl = ['Guidance', 'Accounting'].indexOf(f.type) >= 0 ? f.type : (f.type === 'Manager' ? 'Manager' : 'Encoder');
    addUser_(un, pw, 'admin', name, '', em, true, cl === 'Encoder' ? 'Encoder' : cl === 'Manager' ? 'System Manager' : cl + ' Office', cl, dept);
    if (em) { try { MailApp.sendEmail({ to:em, name:'Moreh Academy Admissions', subject:'Moreh Academy portal: your staff account', body:'Hello '+name+',\n\nAn Encoder account was created for you on the Moreh Academy portal.\n\nUsername: '+un+'\nTemporary password: '+pw+'\n\nYou will be asked to choose a new password when you sign in.' }); } catch(_) {} }
    audit_(ou, 'staff.create', un, cl); alert_('staff:' + un, 'New staff account created', ou.Username + ' created ' + un);
    return ok({ username:un, password:pw }, 'Encoder account created');
  } catch(e) { return fail(e); } finally { try { lock.releaseLock(); } catch(_) {} }
}


/* ---------- Notification bell ---------- */
function evRows_() {
  const sh = evSh_(); if (sh.getLastRow()<2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,EVCOLS.length).getValues().map(r => { const o={}; EVCOLS.forEach((c,i)=>o[c]=String(r[i])); return o; });
}
function getNotifications(token) {
  try {
    { const _a = who_(token); if (ACAD_ROLES.indexOf(_a.Clearance) >= 0) return ok({ count:0, items:[] }); }
    const u = who_(token), pr = PropertiesService.getScriptProperties(), tz = Session.getScriptTimeZone(),
  prev = u.Role === 'admin' ? (pr.getProperty('pl_'+u.Username)||'') : Utilities.formatDate(new Date(Date.now()-7*864e5), tz, 'yyyy-MM-dd HH:mm:ss');
    const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'), wk = Utilities.formatDate(new Date(Date.now()+6*86400000), tz, 'yyyy-MM-dd');
   const evs = evRows_(), items = [], all = u.Role==='admin' ? studentsLite_() : []
   if (u.Role==='admin' && ACAD_ROLES.indexOf(u.Clearance) < 0) {
   const nw = prev ? all.filter(s=>s.CreatedAt>prev).length : 0;
      if (nw) items.push({ title:nw+' new registration'+(nw>1?'s':''), text:'Since you last signed in.', go:'newreg' });
      const nc = all.filter(inSY_).filter(s=>s.EnrollStatus!=='Cancelled'&&s.EnrollStatus!=='Transferred Out'&&s.ReqConsent!=='Original').length;
      if (nc && u.Clearance!=='Encoder') items.push({ title:nc+' learner'+(nc>1?'s':'')+' without Parental Consent', text:'Parental Consent & Data Privacy Undertaking Form not yet submitted.', go:'noconsent' });
      const we = evs.filter(e=>e.Category!=='Announcement'&&e.EventDate>=today&&e.EventDate<=wk);
      if (we.length) items.push({ title:we.length+' event'+(we.length>1?'s':'')+' this week', text:we.map(e=>e.Title).join(', '), go:'ev' });
    } else {
      const sx = findRow_('S', 'StudentID', u.StudentID), s = sx && sx.o;
      if (s) {
        const sc = s.StatusChangedAt || ''; if (sc && sc>prev) items.push({ title:'Enrollment status update', text:'Your enrollment status is now: '+(s.EnrollStatus||'Not Enrolled')+'.', go:'home' });
        if (s.Classification==='New' && CERT_CATS.includes(s.Category) && !(s.CertNo||s.VoucherCertNo||s.EscCertNo)) items.push({ title:'Certificate Number not yet submitted', text:'Required for transfer students. You may submit it later; your enrollment can still proceed.', go:'sp' });
        if (s.ReqConsent!=='Original') items.push({ title:'Parental Consent form not yet submitted', text:'Print it from your dashboard and submit it with your hardcopy requirements.', go:'home' });
        const miss = reqsFor_(s).req.filter(k => k!=='ReqConsent' && (!s[k]||s[k]==='None')).map(k => (FIELDS.find(f=>f[1]===k)||[0,0,k])[2]);
        if (miss.length) items.push({ title:miss.length+' requirement'+(miss.length>1?'s':'')+' still missing', text:miss.join(', '), go:'rq' });
      }
      const ne = prev ? evs.filter(e=>e.EventDate>=today&&e.UpdatedAt>prev) : [];
      if (ne.length) items.push({ title:ne.length+' new bulletin post'+(ne.length>1?'s':''), text:ne.map(e=>e.Title).join(', '), go:'ev' });
    }
    return ok({ count:items.length, items:items });
  } catch(e) { return fail(e); }
}
/* ---------- School year, enrollment switch, policy ---------- */
const SCHOOL_ID = '488011';
const props_ = () => PropertiesService.getScriptProperties();
let SY_MEMO_ = null;   // lives for ONE execution only, so it can never go stale between requests
const activeSY_ = () => SY_MEMO_ || (SY_MEMO_ = props_().getProperty('SY_ACTIVE') || '2026-2027');
const enrollOpen_ = () => props_().getProperty('ENROLL_OPEN') !== '0';
const allowed_ = () => String(props_().getProperty('ALLOWED')||'').toLowerCase().split(/[\s,;]+/).filter(Boolean);
function nextIdV2_(all, sy) {
  const p = SCHOOL_ID+'-'+String(sy).slice(0,4);
  const max = all.filter(s=>s.StudentID.startsWith(p+'-')).reduce((m,s)=>Math.max(m,parseInt(s.StudentID.split('-')[2],10)||0),0);
  return p+'-'+String(max+1).padStart(4,'0');
}
function getSettings(token) { try { sysOwner_(token); return ok({ sy:activeSY_(), mail:mailOn_(), open:enrollOpen_(), allowed:props_().getProperty('ALLOWED')||'' }); } catch(e) { return fail(e); } }
function saveSettings(token, s) {
  try { const ou = sysOwner_(token); props_().setProperty('ENROLL_OPEN', s.open?'1':'0'); props_().setProperty('ALLOWED', String(s.allowed||'').slice(0,4000)); audit_(ou, 'settings.save', 'enrollment', s.open ? 'open' : 'closed'); alert_('settings', 'Enrollment settings changed', ou.Username + ' set registration to ' + (s.open ? 'OPEN' : 'CLOSED')); return ok(null,'Settings saved'); } catch(e) { return fail(e); }
}
function startNextSY(token) {
  try {
    const ou = sysOwner_(token), y = parseInt(activeSY_().slice(0,4),10)+1, sy = y+'-'+(y+1);
    props_().setProperty('SY_ACTIVE', sy);
    SY_MEMO_ = sy;
    audit_(ou, 'settings.nextsy', sy, '');
    return ok({ sy:sy }, 'Enrollment started for '+sy);
  } catch(e) { return fail(e); }
}
function contentSh_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); let sh = ss.getSheetByName('Content');
  if (!sh) { sh = ss.insertSheet('Content'); sh.getRange(1,1,1,2).setValues([['Key','Value']]).setFontWeight('bold'); sh.getRange(2,1).setValue('privacy'); }
  return sh;
}

/* ---------- Fee schedules (editable in the "Fees" and "Fee Notes" sheets) ---------- */
const FEE_COLS = ['Tier','Plan','Item','Amount'], NOTE_COLS = ['Type','Title','Details','Until'];
function feeSeed_() {
  const SEMI = ['Upon Enrollment','2nd Payment (Dec. 15)'], QTR = ['Upon Enrollment','2nd Payment (Aug. 15)','3rd Payment (Oct. 15)','4th Payment (Feb. 15)'];
  const MON = ['Upon Enrollment','2nd Payment (July 15)','3rd Payment (Aug. 15)','4th Payment (Sept. 15)','5th Payment (Oct. 15)','6th Payment (Nov. 15)','7th Payment (Dec. 15)','8th Payment (Jan. 15)','9th Payment (Feb. 15)'];
  const rep = (a,n) => Array(n).fill(a), N = '\u2013';
  const T = [['Preschool',[17339,7450,24789],[13822.08,11833.87,25655.95],[11160.55].concat(rep(4947.39,3),[26002.73]),[7450].concat(rep(3178.82,6),[26522.90])],
    ['Grade 1'+N+'2',[18707,7750,26457],[14624.82,12767.53,27392.35],[11753.30].concat(rep(5337.73,3),[27766.49]),[7750].concat(rep(2572.21,8),[28327.70])],
    ['Grade 3'+N+'4',[21749,7750,29499],[15742.76,14843.69,30586.45],[12404.29].concat(rep(6205.71,3),[31021.43]),[7750].concat(rep(2990.49,8),[31673.90])],
    ['Grade 5'+N+'6',[22357,8250,30607],[16466.20,15258.65,31724.85],[13034.40].concat(rep(6379.20,3),[32171.99]),[8250].concat(rep(3074.09,8),[32842.70])],
    ['Grade 7'+N+'10',[26750,9750,36500],[19580.63,18256.88,37837.50],[15474.50].concat(rep(7632.67,3),[38372.50]),[9750].concat(rep(3678.13,8),[39175.00])],
    ['Grade 11'+N+'12',[26750,9750,36500],[19580.63,18256.88,37837.50],[15474.50].concat(rep(7632.67,3),[38372.50]),[9750].concat(rep(3678.13,8),[39175.00])]];
  const rows = [];
  T.forEach(t => { const n = t[0];
    rows.push([n,'Full Payment','Tuition Fee',t[1][0]],[n,'Full Payment','Miscellaneous',t[1][1]],[n,'Full Payment','Total',t[1][2]]);
    [['Semi-Annual',SEMI,t[2]],['Quarterly',QTR,t[3]],['Monthly',MON,t[4]]].forEach(p => { const a = p[2]; for (let i=0;i<a.length-1;i++) rows.push([n,p[0],p[1][i],a[i]]); rows.push([n,p[0],'Total',a[a.length-1]]); }); });
  return rows;
}
function noteSeed_() {
  const y = activeSY_().slice(0, 4);
  return [['Promo','Early Bird Promo','15% tuition discount on or before March 31, '+y+' | 10% on or before April 24, '+y+' | 5% on or before May 15, '+y, y+'-05-15'],
    ['Promo','Discounts','Sibling Discount: 5\u201310% | Loyalty Discount: 2%',''],
    ['Promo','3+1 Promo','Refer 3 New Elem Students and get a 100% FREE Tuition Fee for your child.',''],
    ['Promo','Scholarships','ESC, SHS Voucher and TLC Scholar \u2013 see the Scholarships tab.',''],
    ['Grant','Junior High ESC','Tuition Fee: FREE, Misc. Fee: 9,750.00',''],['Grant','Senior High ESC','Tuition Fee: FREE, Misc. Fee: 5,125.00',''],
    ['Grant','TLC Scholar','Tuition Fee: FREE (100%), Misc. Fee: FREE',''],['Grant','SHS Voucher','Tuition Fee: FREE (100%), Misc. Fee: FREE','']];
}
function feeSheet_(name, cols, seed) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1,1,1,cols.length).setValues([cols]).setFontWeight('bold'); sh.setFrozenRows(1);
    const r = seed(); sh.getRange(2,1,r.length,cols.length).setValues(r); sh.autoResizeColumns(1,cols.length); }
  return sh;
}
function getFees(token) {
  try {
    const u = who_(token), fs = feeSheet_('Fees',FEE_COLS,feeSeed_), ns = feeSheet_('Fee Notes',NOTE_COLS,noteSeed_), tz = Session.getScriptTimeZone();
    if (ns.getLastColumn() < NOTE_COLS.length) ns.getRange(1, NOTE_COLS.length).setValue('Until').setFontWeight('bold');   // older sheet: add the column
    const todayS = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'), ds = v => v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v || '').trim();
    const read = (sh,n) => sh.getLastRow()<2 ? [] : sh.getRange(2,1,sh.getLastRow()-1,n).getValues();
    const rows = read(fs,4).map(r => ({ Tier:String(r[0]).trim(), Plan:String(r[1]).trim(), Item:String(r[2]).trim(), Amount:typeof r[3]==='number'?r[3]:parseFloat(String(r[3]).replace(/[^0-9.]/g,'')) }))
      .filter(r => r.Tier && r.Plan && r.Item && !isNaN(r.Amount));
    const notes = read(ns,4).map(r => ({ Type:String(r[0]).trim(), Title:String(r[1]).trim(), Details:String(r[2]).trim(), Until:ds(r[3]) }))
      .filter(r => r.Type && r.Title && (!/^\d{4}-\d{2}-\d{2}$/.test(r.Until) || r.Until >= todayS));   // expired notes are hidden
    return ok({ rows:rows, notes:notes, url:(u.Role==='admin' && u.Clearance==='Full') ? SpreadsheetApp.getActiveSpreadsheet().getUrl()+'#gid='+fs.getSheetId() : '' });
  } catch(e) { return fail(e); }
}

/* ---------- Scholarships (admin edits, students view) ---------- */
const SCH_KEYS = ['TLC','ESC','QVR','QVA'];
function schSh_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); let sh = ss.getSheetByName('Scholarships');
  if (!sh) { sh = ss.insertSheet('Scholarships'); sh.getRange(1,1,1,6).setValues([['Program','Order','Title','Items','UpdatedAt','UpdatedBy']]).setFontWeight('bold'); sh.setFrozenRows(1); sh.getRange(1,1,sh.getMaxRows(),6).setNumberFormat('@'); }
  return sh;
}
function getScholarships(token) {
  try {
    const u = who_(token), sh = schSh_(), pr = PropertiesService.getScriptProperties();
    const rows = sh.getLastRow()<2 ? [] : sh.getRange(2,1,sh.getLastRow()-1,4).getValues().map(r=>({ Program:String(r[0]), Order:parseInt(r[1],10)||0, Title:String(r[2]), Items:String(r[3]) }));
    SCH_KEYS.forEach(k => { if (!rows.some(r=>r.Program===k)) (SCH_DEFAULT[k]||[]).forEach((s,i) => rows.push({ Program:k, Order:i+1, Title:s[0], Items:s[1] })); });
    const pics = {}; SCH_KEYS.forEach(k => { const id = pr.getProperty('schpic_'+k); pics[k] = id ? photo_(id) : ''; });
    // Admin only: active learners per program (cancelled / transferred-out excluded)
    let counts = null;
    if (u.Role==='admin' && ACAD_ROLES.indexOf(u.Clearance) < 0) {
      const MAP = { TLC:['TLC','TLC-OVAP'], ESC:['ESC'], QVR:['PUB-QVR'], QVA:['QVA PASSER'] };
      const act = rowsSY_().filter(s=>s.EnrollStatus!=='Cancelled' && s.EnrollStatus!=='Transferred Out');
      counts = {};
      SCH_KEYS.forEach(k => { const x = act.filter(s=>MAP[k].includes(s.Category)); counts[k] = { total:x.length, enrolled:x.filter(s=>s.EnrollStatus==='Enrolled').length }; });
    }
    return ok({ rows:rows, pics:pics, counts:counts });
  } catch(e) { return fail(e); }
}

function saveScholarship(token, program, sections) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); const u = owner_(token);
    if (!SCH_KEYS.includes(program)) throw new Error('Unknown program.');
    if (!Array.isArray(sections) || sections.length>40) throw new Error('Invalid sections.');
    const sh = schSh_(), now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const old = sh.getLastRow()<2 ? [] : sh.getRange(2,1,sh.getLastRow()-1,6).getValues();
    const keep = old.filter(r=>String(r[0])!==program);
    const add = sections.map((s,i)=>[program, String(i+1), String(s.title||'').trim().slice(0,150)||'Untitled', (s.items||[]).slice(0,80).map(x=>String(x).trim().slice(0,2000)).filter(Boolean).join('\n'), now, u.Username]);
    const all = keep.concat(add);
    if (sh.getLastRow()>1) sh.getRange(2,1,sh.getLastRow()-1,6).clearContent();
    if (all.length) put_(sh, 2, 1, all);
    return ok(null,'Saved');
  } catch(e) { return fail(e); } finally { try { lock.releaseLock(); } catch(_) {} }
}
function setSchPhoto(token, program, dataUrl) {
  try {
    owner_(token); if (!SCH_KEYS.includes(program)) throw new Error('Unknown program.');
    const blob = Utilities.newBlob(Utilities.base64Decode(String(dataUrl).split(',')[1]), 'image/jpeg', 'scholarship_'+program+'.jpg');
    const pb = blob.getBytes();
    if (pb.length > 2*1024*1024) throw new Error('Photo exceeds 2 MB.');
    if (!((pb[0] & 255) === 0xFF && (pb[1] & 255) === 0xD8)) throw new Error('Photo must be a JPEG image.');
    const pr = PropertiesService.getScriptProperties(), old = pr.getProperty('schpic_'+program);
    const f = DriveApp.getFolderById(PHOTO_FOLDER_ID).createFile(blob);
    pr.setProperty('schpic_'+program, f.getId());                                   // save the new id first
    if (old) { try { DriveApp.getFileById(old).setTrashed(true); } catch(_) {} }    // then trash the old photo
    return ok(photo_(f.getId()), 'Photo updated');
  } catch(e) { return fail(e); }
}
/** Keeps a signed-in session alive while a student fills in a long form. */
function ping(token) { try { who_(token); return ok(null); } catch (e) { return fail(e); } }

/** PUBLIC. Returns the school logo as a data URI (cached), or '' to keep the fallback link. The logo is not secret: it shows on the login page. */
function getLogo() {
  try {
    const c = CacheService.getScriptCache(), hit = c.get('logo_v1'); if (hit) return ok(hit);
    const id = PropertiesService.getScriptProperties().getProperty('LOGO_FILE_ID'); if (!id) return ok('');
    const b = DriveApp.getFileById(id).getBlob(), ct = b.getContentType();
    if (!/^image\/(png|jpeg|webp)$/.test(ct)) return ok('');
    const bytes = b.getBytes(); if (bytes.length > 68000) return ok('');   // must fit in one cache entry (100 KB) once encoded
    const uri = 'data:' + ct + ';base64,' + Utilities.base64Encode(bytes);
    c.put('logo_v1', uri, 21600);
    return ok(uri);
  } catch (e) { return ok(''); }
}

/** OWNER ONLY (editor). setLogoFile('<Drive file ID>') */
function setLogoFile(id) {
  id = id || '1MyLv_pIxcQOFM3uNz2QttGApcCoLLQbO';
  ownerOnly_(); id = String(id || '').trim();
  const f = DriveApp.getFileById(id);
  PropertiesService.getScriptProperties().setProperty('LOGO_FILE_ID', id);
  CacheService.getScriptCache().remove('logo_v1');
  Logger.log('Logo set to "' + f.getName() + '" (' + f.getSize() + ' bytes, ' + f.getMimeType() + '). Keep it under 68,000 bytes.');
}

/** Built-in scholarship text, used until a program is saved from the Scholarships editor. */
const SCH_DEFAULT = {"TLC": [["Definition", "The TLC Scholarship Program is an initiative of the Taguig City Government that provides opportunities for graduates of public elementary schools in Taguig. Through this program, students may continue their high school education in a public school or enroll as Grade 7 students in selected private institutions recognized as TLC Partner Schools."], ["Eligibility – For the Student", "**Academic Residency:** Must have studied for at least three (3) years in any public school in Taguig City and is a candidate for graduation.\n**Grade Level:** Must be an incoming Grade 7 student.\n**Character:** Must have a clean disciplinary record or a Certificate of Good Moral Character."], ["Eligibility – For the Parent", "**Voter Status:** Must be a registered and active voter in Taguig City for at least three (3) years."], ["Documentary Requirements for TLC Application", "**Original Student Application Form** – Must be duly signed with accurate information. Please wait for the official announcement regarding the release of the S.Y. 2026-2027 form.\n**Certified True Copy of Form 137** – Can be requested from the school once 3rd Grading marks are available. Provide three (3) photocopies, each bearing the official school seal.\n**Photocopy of PSA Birth Certificate** – Must be issued by the Philippine Statistics Authority (PSA), not NSO or a Local Live Birth certificate. Ensure the copy is clear and legible.\n**Original School Certification** – A certificate of graduation/completion to be requested alongside Form 137. Provide three (3) photocopies with the official school seal.\n**COMELEC Certification** – Official proof of parent’s voter registration in Taguig (Note: This is different from a Voter’s ID).\n**Barangay Residency Certificate (BRC)** – The certificate must explicitly state the number of years of residency in your specific barangay in Taguig.\n__Submit 2 sets of requirements in 1 Long Brown Expandable Envelope and 1 Long Brown Ordinary Envelope.__"], ["Documentary Requirements for School Enrollment", "Original Student Registration Form – Must be duly signed with accurate information.\nOriginal Report Card\nTwo (2) pieces of 2x2 ID Photo (Recent, white background, with nametag)\n__For TLC Transferees, enrollees must submit a TLC Transfer Form signed by the School Principal or School Administrator from their previous school.__"], ["Scholarship Benefits at Moreh Academy", "**Full Tuition & Miscellaneous Fees:** Free from Grade 7 to Grade 12.\n**School Uniforms:** Two (2) free sets of school uniforms (provided upon entry to Grade 7 and Grade 9).\n**Physical Education (P.E.) Gear:** One (1) free P.E. T-shirt (provided in Grade 7 and Grade 9).\n**School ID:** Free School Identification Card and official lace/lanyard.\n**Extracurricular Activities:** Free Class Teambuilding and Swimming Lessons.\n**Financial Assistance:** An Annual Allowance of ₱2,000.00"], ["Source of Funding", "City Government of Taguig through Taguig Scholarships Office"]], "ESC": [["Definition", "The Education Service Contracting (ESC) program is a partnership between the Department of Education (DepEd) and the Private Education Assistance Committee (PEAC). It is a financial assistance program designed to decongest public schools by providing subsidies for students to attend private Junior High Schools (Grades 7 to 10)."], ["Eligibility Requirements", "The program is specifically for incoming Grade 7 students. You cannot apply for a new ESC grant once you are in Grade 8 or higher.\nFilipino citizens who have graduated from a public elementary school or a DepEd-recognized private elementary school.\nPriority is often given to graduates from public elementary schools.\nIncoming Grade 7 students (including ALS A&E and PEPT qualifiers)."], ["Documentary Requirements", "Since slots are limited per school, the applicant must submit the following to the private school’s registrar:\nESC Application Form (provided by the school).\nRecent 2x2 ID photos.\nPhotocopy of PSA Birth Certificate.\nGrade 6 Report Card (showing graduation).\nProof of Income (ITR of parents, Certificate of Employment, or Certificate of Indigency from the Barangay).\n__For ESC Transferees, enrollees must submit a system generated ESC Certificate from their previous school.__"], ["Scholarship Benefits at Moreh Academy", "**Full Tuition Fees:** Free from Grade 7 to Grade 12. Miscellaneous Fee is payable at 9,750.00 for JHS and 5,125.00 for SHS annually.\n**School ID:** Free School Identification Card and official lace/lanyard.\n**Extracurricular Activities:** Free Class Teambuilding and Swimming Lessons."], ["Source of Funding", "Department of Education through Private Education Assistance Committee (PEAC)."]], "QVR": [["Definition", "The Senior High School (SHS) Voucher Program is a financial assistance initiative by the Department of Education (DepEd) designed to give Grade 10 completers more options for their senior high school education. For students currently in or graduating from public schools, the program is particularly streamlined because they are prioritized for assistance."], ["Eligibility Requirements", "**No Application Needed:** If you are a Grade 10 completer from a DepEd public school, a State University or College (SUC), or a Local University or College (LUC), you do not need to apply for the voucher through the Online Voucher Application Portal (OVAP).\n**Voucher Amount:** Public school graduates typically receive the full voucher amount (100%), whereas private school graduates (who are ESC grantees) receive only 80% of the value."], ["Documentary Requirements for Enrollment", "Since public school students are automatically qualified, the process is simple:\nStudent Registration Form from Moreh Academy\nOriginal and Photocopy of Report Card\nOriginal and Photocopy of PSA Birth Certificate\nPhotocopy of JHS Completion Certificate\nThree (3) pieces of 2x2 ID Photo (Recent, white background, with nametag)\nLong Brown Expandable Envelope\n__For Grade 12 Transferees, enrollees must submit a system generated Voucher Certificate from their previous school.__"], ["Scholarship Benefits at Moreh Academy", "**Full Tuition & Miscellaneous Fees:** Free from Grade 11 to Grade 12.\n**School Uniforms:** One (1) free set of school uniforms (provided upon entry to Grade 11).\n**Physical Education (P.E.) Gear:** One (1) free P.E. T-shirt (provided upon entry to Grade 11).\n**School ID:** Free School Identification Card and official lace/lanyard.\n**Extracurricular Activities:** Free Class Teambuilding and Swimming Lessons.\n**Academic Allowance:** One-time incentive of One Thousand Pesos (1,000.00)"], ["Source of Funding", "Department of Education through Private Education Assistance Committee (PEAC)."]], "QVA": [["Definition", "For Grade 10 completers from private schools, the SHS Voucher Program works differently than it does for public school students. While public school students are \"automatic,\" private school students often need to undergo an application process and may receive a different subsidy amount. Private school students (ESC grantees or successful applicants) generally receive 80% of the full voucher value."], ["Eligibility Requirements (Difference of QVA and ESC grantee)", "**ESC Grantees:** Students who previously received a Department of Education (DepEd) subsidy while enrolled in a private Junior High School. No application needed.\n**QVA or Non-ESC Students** include:\nStudents from private Junior High Schools who did not receive the ESC subsidy (those who paid full tuition or held separate private scholarships).\n**ALS Passers:** Learners who passed the ALS Accreditation and Equivalency (A&E) Test or the Presentation Portfolio Assessment for Grade 10.\n**PEPT Passers:** Learners who passed the Philippine Educational Placement Test (PEPT) for Grade 10 and are certified for admission to Senior High School.\n**Past JHS Completers:** Students who completed Grade 10 in previous years (usually not earlier than 2016) but have not yet enrolled in Grade 11."], ["Application Process (OVAP)", "Applications are submitted exclusively through the Online Voucher Application Portal (OVAP) at ovap.peac.org.ph. The process is free of charge and fully digital.\n**Account Creation:** Register using a working email address. A confirmation link will be sent to verify the account.\n**Form Completion:** Log in and fill out the Electronic Voucher Application Form (VAF-1) with accurate personal details, school information, and family socio-economic data.\n**Document Upload** (clear and legible scans): recent 2x2 ID photo; signed Parent/Guardian Consent Form (if the applicant is under 18); proof of financial means (latest ITR of parents/guardian, Certificate of Employment, or Municipal Certificate of Unemployment); category-specific documents (ALS Certificate of Rating/Completion or PEPT Certificate, if applicable).\n**Attestation and Submission:** Review all entries and click the Attestation button to certify the truthfulness of the information. Once the status changes to \"Submitted,\" it is queued for review."], ["Summary of Documentary Requirements", "Proof of Income from BIR (for ITR) or Employer (for COE)\nProof of Unemployment from Office of the Mayor or City Assessor\nALS / PEPT Results from DepEd Schools Division Office (SDO) or BEA\nFinancial Assistance Certificate from Junior High School (only if previously a scholar)"], ["Results and Redemption", "**Status Tracking:** Applicants must regularly check their OVAP account for the \"Qualified\" status.\n**QVA Certificate:** Once approved, the Qualified Voucher Applicant (QVA) Certificate must be downloaded and printed.\n**Redemption:** Present the QVA Certificate to the private Senior High School during the enrollment period. The voucher is not convertible to cash; it is applied directly as a tuition discount."], ["Important Reminders", "**Strict Deadlines:** Applications submitted beyond the DepEd-prescribed period (usually ending in mid-May) will not be processed.\n**No Manual Submissions:** DepEd and the PEAC National Secretariat do not accept hard-copy applications via mail or walk-ins."], ["Documentary Requirements for School Enrollment", "Student Registration Form from Moreh Academy\nOriginal and Photocopy of Report Card\nOriginal and Photocopy of PSA Birth Certificate\nPrinted Copy of Voucher Certificate for OVAP Passer\nPhotocopy of JHS/ALS/PEPT Completion Certificate\nThree (3) pieces of 2x2 ID Photo (Recent, white background, with nametag)\nLong Brown Expandable Envelope\n__For QVA Transferees, enrollees must submit a system generated Voucher Certificate from their previous school.__"], ["Scholarship Benefits at Moreh Academy", "**Full Tuition Fees:** Free from Grade 7 to Grade 12. Miscellaneous Fee is payable at 9,750.00 for JHS and 5,125.00 for SHS annually.\n**School ID:** Free School Identification Card and official lace/lanyard.\n**Extracurricular Activities:** Free Class Teambuilding and Swimming Lessons.\n**Academic Allowance:** One-time incentive of One Thousand Pesos (1,000.00) for Eligible QVA Passers."], ["Source of Funding", "Department of Education through Private Education Assistance Committee (PEAC)."]]};

/* ===== Dashboard extras (admin Home) =====
 * Paste at the END of Code.gs, then deploy a NEW version.
 * Separate from dashboard() on purpose: admStats() and loadBadges() call dashboard() often
 * and only need the four counts, so they stay fast and unchanged.
 */

/**
 * Extra panels for the admin Home page: registration trend, needs-attention list,
 * recent registrations and applicants per scholarship category.
 * Holds / overdue temporary enrollments are merged on the client from holdsOverview().
 * @param {string} token Session token.
 * @return {{success:boolean, data?:Object, error?:string}}
 */
function dashboardExtra(token) {
  try {
    const u = who_(token, 'admin');
    if (OFFICE_CL.indexOf(u.Clearance) >= 0) throw new Error('Not allowed.');
    const tz = Session.getScriptTimeZone(), full = u.Clearance !== 'Encoder';
    const dayKey = n => Utilities.formatDate(new Date(Date.now() - n * 864e5), tz, 'yyyy-MM-dd');
    const all = rowsSY_();
    const live = all.filter(r => r.EnrollStatus !== 'Cancelled' && r.EnrollStatus !== 'Transferred Out');

    // 14-day registration counts, oldest first (index 13 = today)
    const idx = {}; for (let i = 13; i >= 0; i--) idx[dayKey(i)] = 13 - i;
    const spark = Array(14).fill(0);
    all.forEach(r => { const k = String(r.CreatedAt || '').slice(0, 10); if (k in idx) spark[idx[k]]++; });
    const sum = (a, b) => spark.slice(a, b).reduce((x, y) => x + y, 0);
    const trend = { week: sum(7, 14), prev: sum(0, 7), today: spark[13], yesterday: spark[12] };

    // Needs attention (consent is hidden from Encoders, same rule as the notification bell)
    const cnt = { consent: 0, req: 0, cert: 0 }, rows = [];
    live.forEach(r => {
      const b = [];
      if (full && r.ReqConsent !== 'Original') { b.push('Missing consent'); cnt.consent++; }
      if (reqsFor_(r).req.some(k => k !== 'ReqConsent' && (!r[k] || r[k] === 'None'))) { b.push('Requirements incomplete'); cnt.req++; }
      if (r.Classification === 'New' && CERT_CATS.indexOf(r.Category) >= 0 && !(r.CertNo || r.VoucherCertNo || r.EscCertNo)) { b.push('Certificate No. blank'); cnt.cert++; }
      if (b.length) rows.push({ id: r.StudentID, name: r.FullName, grade: (r.GradeLevel + ' ' + r.Section).trim(), status: r.EnrollStatus, badges: b });
    });
    rows.sort((a, b) => (b.status === 'Enrolled') - (a.status === 'Enrolled') || b.badges.length - a.badges.length);

    // Last 5 registrations
    const recent = live.slice().sort((a, b) => String(b.CreatedAt).localeCompare(String(a.CreatedAt))).slice(0, 5)
      .map(r => ({ id: r.StudentID, name: r.FullName, grade: (r.GradeLevel + ' ' + r.Section).trim(), date: String(r.CreatedAt || '').slice(0, 10), status: r.EnrollStatus || 'Not Enrolled' }));

    // Applicants by scholarship category (Encoders do not see reports, so they do not get this either)
    let byCategory = null;
    if (full) { const m = {}; live.forEach(r => { const k = r.Category || ''; m[k] = (m[k] || 0) + 1; }); byCategory = Object.keys(m).map(k => [k, m[k]]).sort((a, b) => b[1] - a[1]); }

    return ok({ trend: trend, spark: spark, attention: { counts: cnt, total: rows.length, rows: rows.slice(0, 300) }, recent: recent, byCategory: byCategory });
  } catch (e) { return fail(e); }
}

/* ===== Career Evaluation + Grade 11 access =====
 * PASTE at the END of Code.gs, then deploy a NEW version.
 */

const CAREER_COLS = ['Date', 'StudentID', 'Learner', 'ASSH', 'BE', 'STEM', 'ICT', 'HT', 'TopCluster'];
const CAREER_KEYS = ['ASSH', 'BE', 'STEM', 'ICT', 'HT'];

/** Incoming Grade 11 = a Grade 11 record in the ACTIVE school year that is not cancelled / transferred out.
 *  The main administrator (Clearance 'Full') also has access, to maintain the content. */
function careerAllowed_(u) {
  if (u.Role === 'admin') return isFull_(u);
  const hit = findRow_('S', 'StudentID', u.StudentID), s = hit && hit.o;
  if (!s) return false;
  if (s.EnrollStatus === 'Cancelled' || s.EnrollStatus === 'Transferred Out') return false;
  return s.GradeLevel === 'Grade 11' && s.SchoolYear === activeSY_();
  // Optional: also let current Grade 10 learners (who are about to move up) see it. Replace the line above with:
  // return (s.GradeLevel === 'Grade 11' && s.SchoolYear === activeSY_()) || (s.GradeLevel === 'Grade 10' && s.EnrollStatus === 'Enrolled');
}

function clusterAccess(token) {
  try { const u = who_(token); return ok({ allowed: careerAllowed_(u) }); }
  catch (e) { return fail(e); }
}

function careerSh_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); let sh = ss.getSheetByName('Career Results');
  if (!sh) {
    sh = ss.insertSheet('Career Results');
    sh.getRange(1, 1, 1, CAREER_COLS.length).setValues([CAREER_COLS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), CAREER_COLS.length).setNumberFormat('@');
  }
  return sh;
}

/** Student only. Stores the five cluster scores (each 0-15, total 15). */
function saveCareerResult(token, scores) {
  try {
    const u = who_(token);
    if (u.Role !== 'student' || !careerAllowed_(u)) throw new Error('Not allowed.');
    let total = 0; const v = CAREER_KEYS.map(k => {
      const n = parseInt(scores && scores[k], 10);
      if (isNaN(n) || n < 0 || n > 15) throw new Error('Invalid result.');
      total += n; return n;
    });
    if (total !== 15) throw new Error('Invalid result.');
    const top = CAREER_KEYS[v.indexOf(Math.max.apply(null, v))];
    const s = (findRow_('S', 'StudentID', u.StudentID) || {}).o || {};
    const sh = careerSh_();
    sh.appendRow([Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'), u.StudentID, s.FullName || '']
      .concat(v.map(String), [top]));
    return ok(null, 'Saved');
  } catch (e) { return fail(e); }
}

/** Student only. Returns their latest saved result, or null. */
function getCareerResult(token) {
  try {
    const u = who_(token);
    if (u.Role !== 'student' || !careerAllowed_(u)) return ok(null);
    const sh = careerSh_(); if (sh.getLastRow() < 2) return ok(null);
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, CAREER_COLS.length).getValues();
    for (let i = rows.length - 1; i >= 0; i--) {
      if (String(rows[i][1]) === u.StudentID) {
        const sc = {}; CAREER_KEYS.forEach((k, j) => sc[k] = parseInt(rows[i][3 + j], 10) || 0);
        return ok({ date: String(rows[i][0]).slice(0, 10), scores: sc, top: String(rows[i][8]) });
      }
    }
    return ok(null);
  } catch (e) { return fail(e); }
}

/* ===== Dashboard demographic donuts =====
 * PASTE at the END of Code.gs, then deploy a NEW version.
 * Read-only. Counts active learners of the active school year (cancelled and transferred-out are excluded),
 * the same population as the "Applicants by Scholarship" donut.
 */

/**
 * Counts for the Sex, Gender Identity and Per School donuts on the admin Home page.
 * Same access rule as the Demographic report: not for Encoders, office desks or academic staff.
 * @param {string} token Session token.
 * @return {{success:boolean, data?:{sex:Array, gender:Array, schools:Array, otherSchools:number}, error?:string}}
 */
function dashboardDemo(token) {
  try {
    const u = who_(token, 'admin');
    if (u.Clearance === 'Encoder' || OFFICE_CL.indexOf(u.Clearance) >= 0 || ACAD_ROLES.indexOf(u.Clearance) >= 0) throw new Error('Not allowed.');
    const live = rowsSY_().filter(r => r.EnrollStatus !== 'Cancelled' && r.EnrollStatus !== 'Transferred Out');

    /** [[label, count], ...] sorted by count, skipping rows where fn returns ''. */
    const tally = fn => {
      const m = {};
      live.forEach(r => { const k = fn(r); if (k) m[k] = (m[k] || 0) + 1; });
      return Object.keys(m).map(k => [k, m[k]]).sort((a, b) => b[1] - a[1]);
    };

    const schools = tally(r => String(r.PrevSchool || '').trim());   // learners with no previous school are left out
    return ok({
      sex: tally(r => r.SexualOrient || 'Not specified'),
      gender: tally(r => r.GenderOrient || 'Not specified'),
      schools: schools.slice(0, 5),
      otherSchools: schools.slice(5).reduce((a, x) => a + x[1], 0)
    });
  } catch (e) { return fail(e); }
}