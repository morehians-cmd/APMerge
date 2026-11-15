/**
 * Website content: defaults, reading, sanitising and saving.
 * Stored in the bound spreadsheet — "Content" (key → JSON) and
 * "Announcements" (one row per item, so staff can also edit them in Sheets).
 */

const ANNOUNCE_HEADERS = ['Date', 'Title', 'Summary', 'Link', 'Pinned', 'Published'];

const DEFAULT_SETTINGS = {
  orgName: 'Moreh Academy',
  motto: 'Learn · Grow · Excel',
  schools: [
    { name: 'Moreh Academy', logo: '1OlkaaLh1ZaXg7sjfLe0ubDgrlNXiPbQF', link: 'https://www.facebook.com/ilovemoreh' },
    { name: 'Moreh Global Innovative College', logo: '1b8RARy_gzEBsFuHN8qU2zmpdXX7XrYWq', link: 'https://www.facebook.com/MorehGlobal2019' },
    { name: 'Moreh College', logo: '1WD0A18SLhBaDl9lGi6HOMQOLXggRq3hK', link: 'https://www.facebook.com/morehcollege' }
  ],
  contact: {
    address: 'Moreh Academy Campus',
    phone: '',
    mobile: '',
    email: 'morehians@gmail.com',
    hours: 'Monday to Friday, 8:00 AM – 5:00 PM'
  },
  social: {
    facebook: 'https://www.facebook.com/ilovemoreh',
    youtube: 'https://www.youtube.com/@ilovemoreh',
    email: 'morehians@gmail.com'
  },
  nav: [
    { label: 'Home', page: '', children: [] },
    { label: 'About Us', page: 'about', children: [
      { label: 'Our History', page: 'about-history' },
      { label: 'Leadership', page: 'about-leadership' }
    ] },
    { label: 'Admissions', page: 'admissions', children: [] },
    { label: 'Academics', page: 'academics', children: [] },
    { label: 'Campus Life', page: 'campus', children: [] },
    { label: 'Forms', page: 'forms', children: [] },
    { label: 'News', page: 'news', children: [] },
    { label: 'Contact', page: 'contact', children: [] }
  ],
  footer: {
    blurb: 'A Christ-centered community where every learner is known, challenged and equipped.',
    copyright: 'Moreh Academy'
  }
};

const DEFAULT_HOME = {
  notice: { on: false, text: 'Admissions inquiries for the coming school year are open.', page: 'admissions' },
  hero: {
    slides: [
      {
        image: '138oALvviA236UvUnJZR62TVqask4gmWQ',
        eyebrow: 'Welcome to Moreh',
        title: 'School of',
        accent: 'Righteousness & Excellence',
        subtitle: 'Learn · Grow · Excel',
        text: 'We partner with families to form learners who think clearly, serve faithfully and lead with integrity.',
        primaryLabel: 'Inquire about admission',
        primaryPage: 'admissions',
        secondaryLabel: 'About our schools',
        secondaryPage: 'about'
      },
      {
        image: '1GodLs1Umo_qPFwt7PRJIYenfsUsNeJkD',
        eyebrow: 'Now accepting inquiries',
        title: 'A place to',
        accent: 'grow in wisdom',
        subtitle: 'Kindergarten to Senior High School',
        text: 'Small classes, teachers who stay, and a campus where character is formed alongside academics.',
        primaryLabel: 'See our programs',
        primaryPage: 'academics',
        secondaryLabel: 'Talk to us',
        secondaryPage: 'contact'
      },
      {
        image: '1iW7wmwTgy38RS7g7cccbA-hCBCcd38Xf',
        eyebrow: 'Moreh Global Innovative College',
        title: 'Start your',
        accent: 'college journey',
        subtitle: 'Prepared for work, service and further study',
        text: 'College programs built around real practice, mentorship and a clear path after graduation.',
        primaryLabel: 'Explore the College',
        primaryPage: 'academics',
        secondaryLabel: 'Visit the campus',
        secondaryPage: 'contact'
      }
    ]
  },
  values: [
    { icon: '✝', label: 'Christ-centered' },
    { icon: '🏅', label: 'Excellence' },
    { icon: '🛡', label: 'Integrity' },
    { icon: '🤝', label: 'Community' },
    { icon: '💡', label: 'Innovation' }
  ],
  about: {
    eyebrow: 'About Moreh',
    title: 'One family of schools, one purpose',
    text: 'Moreh Academy, Moreh Global Innovative College and Moreh College share a single conviction: education forms the whole person. From kindergarten to college, our teachers know their students by name and hold them to a standard worth reaching for.',
    image: '1GodLs1Umo_qPFwt7PRJIYenfsUsNeJkD',
    ctaLabel: 'More about our schools',
    ctaPage: 'about'
  },
  updates: { title: 'Latest Updates', ctaLabel: 'View all news', ctaPage: 'news' },
  band: {
    on: true,
    title: 'Ready to join the Moreh family?',
    text: 'Ask about requirements, fees and available slots. Our admissions office replies within one working day.',
    label: 'Inquire about admission',
    page: 'admissions'
  }
};

const DEFAULT_PAGES = [
  {
    key: 'about',
    title: 'About Us',
    banner: '',
    intro: 'Moreh Academy is a Christ-centered school serving learners from kindergarten through college, together with Moreh Global Innovative College and Moreh College.',
    body: '<p>Our schools exist to form learners who think clearly, serve faithfully and lead with integrity. We keep classes small, we know our students by name, and we hold them to a standard worth reaching for.</p><p>Use the links in this section to read our history and meet the people who lead the schools.</p>'
  },
  {
    key: 'about-history',
    title: 'Our History',
    banner: '',
    intro: 'Moreh began with a handful of families and a simple conviction about what education is for.',
    body: '<p>Replace this text in the Website Manager with your school history — founding year, milestones and the people who built it.</p>'
  },
  {
    key: 'about-leadership',
    title: 'Leadership',
    banner: '',
    intro: 'The school heads and administrators who serve our families.',
    body: '<p>Add the names, roles and short introductions of your leadership team in the Website Manager.</p>'
  },
  {
    key: 'admissions',
    title: 'Admissions',
    banner: '',
    intro: 'Everything a family needs before inquiring about a place at Moreh.',
    body: '<p>Inquiries for the coming school year are open. Contact the admissions office for requirements, fees and available slots.</p><p><strong>How to inquire</strong></p><ol><li>Message or call the admissions office.</li><li>Submit the required documents.</li><li>Complete the entrance interview or assessment.</li><li>Reserve a slot.</li></ol>'
  },
  {
    key: 'academics',
    title: 'Academics',
    banner: '',
    intro: 'Programs from kindergarten to college, each built around clear standards and personal attention.',
    body: '<p>Describe your kindergarten, elementary, junior high, senior high and college programs here. You can add a section per level and keep this page as the overview.</p>'
  },
  {
    key: 'campus',
    title: 'Campus Life',
    banner: '',
    intro: 'Organizations, events, sports and the facilities our students use every day.',
    body: '<p>Use this page for student organizations, school events, sports and a short campus tour.</p>'
  },
  {
    key: 'forms',
    title: 'Downloadable Forms',
    banner: '',
    intro: 'Forms families can download, print and submit to the office.',
    body: '<p>Link each form here with a short description of who needs it and where to submit it.</p>'
  },
  {
    key: 'news',
    title: 'News & Updates',
    banner: '',
    intro: 'Announcements, events and achievements from across the Moreh schools.',
    body: '<p>Announcements added in the Website Manager appear on the homepage and are listed here.</p>'
  },
  {
    key: 'contact',
    title: 'Contact Us',
    banner: '',
    intro: 'Talk to the admissions office or visit the campus.',
    body: '<p>Update your address, phone numbers, email and office hours in Website Manager → Settings.</p>'
  }
];

const DEFAULT_ANNOUNCEMENTS = [
  { date: '2026-11-10', title: 'Admissions inquiries are open', summary: 'Ask about requirements, fees and available slots for the coming school year.', link: 'admissions', pinned: true, published: true },
  { date: '2026-11-05', title: 'Campus open house', summary: 'Meet the teachers, tour the campus and ask questions in person.', link: 'contact', pinned: false, published: true },
  { date: '2026-10-28', title: 'First quarter recognition', summary: 'Celebrating our learners and the families who support them.', link: 'news', pinned: false, published: true }
];

/* ------------------------------------------------------------------- reading */

function readSettings_() { return cleanSettings_(readJson_('settings', DEFAULT_SETTINGS)); }
function readHomepage_() { return cleanHomepage_(readJson_('homepage', DEFAULT_HOME)); }
function readPages_() { return cleanPages_(readJson_('pages', DEFAULT_PAGES)); }

/** Everything the public templates need, cached for APP.cacheSeconds. */
function publicData_() {
  const cache = CacheService.getScriptCache();
  try {
    const hit = cache.get(APP.cacheKey);
    if (hit) return JSON.parse(hit);
  } catch (_) {}

  const base = appUrl_();
  const d = buildPublicData_(readSettings_(), readHomepage_(), readPages_(), base,
    publishedAnnouncements_(announcementRows_()));
  try {
    cache.put(APP.cacheKey, JSON.stringify(d), APP.cacheSeconds);
  } catch (_) {}
  return d;
}

/** Pure: no Apps Script services, so tools/preview.js can run it too. */
function buildPublicData_(settings, homepage, pages, base, announcements) {
  const d = {
    base: base,
    settings: settings,
    home: homepage,
    pages: pages,
    announcements: announcements || [],
    year: new Date().getFullYear()
  };
  d.nav = (settings.nav || []).map(item => ({
    label: item.label,
    href: hrefFor_(base, item.page),
    children: (item.children || []).map(c => ({ label: c.label, href: hrefFor_(base, c.page) }))
  }));
  return d;
}

/* --------------------------------------------------------------- sanitising */

function text_(value, max) { return String(value == null ? '' : value).trim().slice(0, max); }

function key_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function safeUrl_(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v.slice(0, 400);
  if (/^mailto:|^tel:/i.test(v)) return v.slice(0, 400);
  return '';
}

function image_(value) { return String(value || '').trim().slice(0, 400); }

/** Block-list sanitiser for the small amount of HTML staff may paste in. */
function cleanHtml_(html) {
  let s = String(html || '');
  if (!s) return '';
  s = s.replace(/<\s*(script|style|iframe|object|embed|form|input|button|link|meta|base)[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  s = s.replace(/<\s*\/?\s*(script|style|iframe|object|embed|form|input|button|link|meta|base)[^>]*>/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/(href|src)\s*=\s*("\s*(?:javascript|data):[^"]*"|'\s*(?:javascript|data):[^']*'|(?:javascript|data):[^\s>]+)/gi, '$1="#"');
  s = s.replace(/style\s*=\s*("[^"]*expression[^"]*"|'[^']*expression[^']*')/gi, '');
  return s.slice(0, 20000);
}

function cleanSettings_(input) {
  const s = input && typeof input === 'object' ? input : {};
  const schools = (Array.isArray(s.schools) ? s.schools : DEFAULT_SETTINGS.schools)
    .slice(0, 4)
    .map(x => ({ name: text_(x && x.name, 80), logo: image_(x && x.logo), link: safeUrl_(x && x.link) }))
    .filter(x => x.name);

  const nav = (Array.isArray(s.nav) ? s.nav : DEFAULT_SETTINGS.nav)
    .slice(0, 12)
    .map(n => ({
      label: text_(n && n.label, 40),
      page: key_(n && n.page),
      children: (Array.isArray(n && n.children) ? n.children : [])
        .slice(0, 10)
        .map(c => ({ label: text_(c && c.label, 40), page: key_(c && c.page) }))
        .filter(c => c.label)
    }))
    .filter(n => n.label);

  const contact = s.contact || {};
  const social = s.social || {};
  const footer = s.footer || {};

  return {
    orgName: text_(s.orgName, 80) || DEFAULT_SETTINGS.orgName,
    motto: text_(s.motto, 80) || DEFAULT_SETTINGS.motto,
    schools: schools,
    contact: {
      address: text_(contact.address, 200),
      phone: text_(contact.phone, 60),
      mobile: text_(contact.mobile, 60),
      email: text_(contact.email, 120),
      hours: text_(contact.hours, 120)
    },
    social: {
      facebook: safeUrl_(social.facebook),
      youtube: safeUrl_(social.youtube),
      email: text_(social.email, 120)
    },
    nav: nav,
    footer: { blurb: text_(footer.blurb, 300), copyright: text_(footer.copyright, 80) }
  };
}

function cleanHomepage_(input) {
  const h = input && typeof input === 'object' ? input : {};
  const slides = (Array.isArray(h.hero && h.hero.slides) ? h.hero.slides : DEFAULT_HOME.hero.slides)
    .slice(0, 5)
    .map(s => ({
      image: image_(s && s.image),
      eyebrow: text_(s && s.eyebrow, 60),
      title: text_(s && s.title, 120),
      accent: text_(s && s.accent, 120),
      subtitle: text_(s && s.subtitle, 120),
      text: text_(s && s.text, 400),
      primaryLabel: text_(s && s.primaryLabel, 40),
      primaryPage: key_(s && s.primaryPage),
      secondaryLabel: text_(s && s.secondaryLabel, 40),
      secondaryPage: key_(s && s.secondaryPage)
    }))
    .filter(s => s.title || s.accent);

  const values = (Array.isArray(h.values) ? h.values : DEFAULT_HOME.values)
    .slice(0, 5)
    .map(v => ({ icon: text_(v && v.icon, 4), label: text_(v && v.label, 40) }))
    .filter(v => v.label);

  const about = h.about || {};
  const updates = h.updates || {};
  const band = h.band || {};
  const notice = h.notice || {};

  return {
    notice: { on: !!notice.on, text: text_(notice.text, 160), page: key_(notice.page) },
    hero: { slides: slides.length ? slides : DEFAULT_HOME.hero.slides },
    values: values.length ? values : DEFAULT_HOME.values,
    about: {
      eyebrow: text_(about.eyebrow, 60),
      title: text_(about.title, 120),
      text: text_(about.text, 700),
      image: image_(about.image),
      ctaLabel: text_(about.ctaLabel, 40),
      ctaPage: key_(about.ctaPage)
    },
    updates: {
      title: text_(updates.title, 60) || 'Latest Updates',
      ctaLabel: text_(updates.ctaLabel, 40),
      ctaPage: key_(updates.ctaPage)
    },
    band: {
      on: band.on !== false,
      title: text_(band.title, 120),
      text: text_(band.text, 300),
      label: text_(band.label, 40),
      page: key_(band.page)
    }
  };
}

function cleanPages_(input) {
  const list = Array.isArray(input) ? input : DEFAULT_PAGES;
  const seen = {};
  return list
    .slice(0, 40)
    .map(p => {
      let key = key_(p && (p.key || p.title));
      if (!key) return null;
      while (seen[key]) key = key + '-2';
      seen[key] = true;
      return {
        key: key,
        title: text_(p && p.title, 80) || key,
        banner: image_(p && p.banner),
        intro: cleanHtml_(p && p.intro),
        body: cleanHtml_(p && p.body)
      };
    })
    .filter(Boolean);
}

/* ------------------------------------------------------------ announcements */

function announcementRows_() {
  const sh = sheet_('Announcements', ANNOUNCE_HEADERS);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 6).getValues().map(r => ({
    date: isoDate_(r[0]),
    title: String(r[1] || ''),
    summary: String(r[2] || ''),
    link: String(r[3] || ''),
    pinned: yes_(r[4]),
    published: yes_(r[5])
  })).filter(a => a.title || a.summary);
}

function isoDate_(value) {
  if (value instanceof Date && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const s = String(value || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? m[0] : '';
}

function yes_(value) { return /^(y|yes|true|1|x)$/i.test(String(value || '').trim()); }

function appendAnnouncement_(a) {
  sheet_('Announcements', ANNOUNCE_HEADERS).appendRow([
    a.date || '', a.title || '', a.summary || '', a.link || '',
    a.pinned ? 'Y' : '', a.published ? 'Y' : ''
  ]);
}

/** Replaces every announcement row with what the manager sent; returns what was kept. */
function saveAnnouncementRows_(rows) {
  const sh = sheet_('Announcements', ANNOUNCE_HEADERS);
  const clean = (Array.isArray(rows) ? rows : []).slice(0, 200).map(a => [
    /^\d{4}-\d{2}-\d{2}$/.test(String(a && a.date)) ? String(a.date) : '',
    text_(a && a.title, 140),
    text_(a && a.summary, 400),
    key_(a && a.link),
    a && a.pinned ? 'Y' : '',
    a && a.published ? 'Y' : ''
  ]).filter(r => r[1] || r[2]);
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 6).clearContent();
  if (clean.length) sh.getRange(2, 1, clean.length, 6).setValues(clean);
  return clean.map(r => ({
    date: r[0], title: r[1], summary: r[2], link: r[3],
    pinned: r[4] === 'Y', published: r[5] === 'Y'
  }));
}

/** Pinned first, then newest. Used by the homepage and the news page. */
function publishedAnnouncements_(rows) {
  return (rows || [])
    .filter(a => a.published && a.title)
    .map(a => {
      const parts = a.date ? a.date.split('-') : [];
      const when = a.date ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) : null;
      return {
        date: a.date,
        day: when ? String(when.getDate()) : '',
        month: when ? when.toLocaleString('en-US', { month: 'short' }).toUpperCase() : '',
        year: when ? String(when.getFullYear()) : '',
        title: a.title,
        summary: a.summary,
        link: a.link,
        pinned: a.pinned,
        sort: when && !isNaN(when) ? when.getTime() : 0
      };
    })
    .sort((a, b) => (b.pinned - a.pinned) || (b.sort - a.sort));
}
