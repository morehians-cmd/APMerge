/**
 * APMerge — Moreh family of schools.
 * Public website:  /exec                    (homepage)
 *                  /exec?page=about         (any page key)
 *                  /exec?page=search&q=...  (site search)
 * Website manager: /exec?page=admin
 *
 * Setup: open the spreadsheet → Extensions → Apps Script, run setup() once,
 * then Deploy → New deployment → Web app (execute as Me, access Anyone).
 */

const APP = {
  sessionHours: 6,
  cacheSeconds: 300,
  mediaFolder: 'Moreh Website Media',
  cacheKey: 'apmerge_public_v1'
};

/* ------------------------------------------------------------------ routing */

function doGet(e) {
  const p = (e && e.parameter) || {};
  const route = String(p.page || '').trim().toLowerCase();

  if (route === 'admin') return renderAdmin_();

  const d = publicData_();
  if (route === 'search') return renderSearch_(d, String(p.q || ''));
  if (!route) return renderHome_(d);

  const page = pageByKey_(d.pages, route);
  return page ? renderPage_(d, page) : renderHome_(d);
}

function renderAdmin_() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Website Manager')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* The public templates write their own <head>, so the server adds nothing to it. */

function renderHome_(d) {
  const tpl = HtmlService.createTemplateFromFile('PublicHome');
  tpl.d = d;
  return tpl.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function renderPage_(d, page) {
  const tpl = HtmlService.createTemplateFromFile('PublicPage');
  tpl.d = d;
  tpl.page = page;
  return tpl.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function renderSearch_(d, q) {
  const tpl = HtmlService.createTemplateFromFile('PublicSearch');
  tpl.d = d;
  tpl.q = q;
  tpl.results = searchSite_(d, q);
  return tpl.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Used by templates: <?!= include('PublicCss') ?> */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* -------------------------------------------------------------------- setup */

/**
 * Run once. Creates the sheets, writes the starting content and prints a
 * one-time administrator password in the execution log.
 */
function setup() {
  const ss = SpreadsheetApp.getActive();
  if (!ss) throw new Error('Open this script from the school spreadsheet (Extensions → Apps Script).');

  sheet_('Content', ['Key', 'JSON']);
  sheet_('Announcements', ANNOUNCE_HEADERS);
  sheet_('Log', ['When', 'Action', 'Detail']);

  if (!readJson_('settings', null)) writeJson_('settings', DEFAULT_SETTINGS);
  if (!readJson_('homepage', null)) writeJson_('homepage', DEFAULT_HOME);
  if (!readJson_('pages', null)) writeJson_('pages', DEFAULT_PAGES);
  if (!announcementRows_().length) {
    DEFAULT_ANNOUNCEMENTS.forEach(a => appendAnnouncement_(a));
  }

  const props = PropertiesService.getScriptProperties();
  let password = '';
  if (!props.getProperty('ADMIN_HASH')) {
    password = 'moreh-' + Math.random().toString(36).slice(2, 10);
    const salt = Utilities.getUuid();
    props.setProperties({ ADMIN_SALT: salt, ADMIN_HASH: hash_(password + salt) });
  }

  Logger.log(password
    ? 'Setup complete.\nAdministrator password: ' + password + '\nSign in at <web app URL>?page=admin and change nothing until you save this password somewhere safe.'
    : 'Setup complete. An administrator password already exists — run resetAdminPassword() if you lost it.');
}

/** Run from the editor to print a fresh administrator password. */
function resetAdminPassword() {
  const password = 'moreh-' + Math.random().toString(36).slice(2, 10);
  const salt = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperties({ ADMIN_SALT: salt, ADMIN_HASH: hash_(password + salt) });
  Logger.log('New administrator password: ' + password);
  return password;
}

/* -------------------------------------------------------------------- sheets */

function sheet_(name, headers) {
  const ss = SpreadsheetApp.getActive();
  if (!ss) throw new Error('This script must be bound to the school spreadsheet.');
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (headers) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#eef4ff');
      sh.setFrozenRows(1);
    }
  }
  return sh;
}

function readJson_(key, fallback) {
  const sh = sheet_('Content', ['Key', 'JSON']);
  const last = sh.getLastRow();
  if (last < 2) return fallback;
  const rows = sh.getRange(2, 1, last - 1, 2).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === key) {
      try {
        const parsed = JSON.parse(String(rows[i][1] || ''));
        return parsed || fallback;
      } catch (_) {
        return fallback;
      }
    }
  }
  return fallback;
}

function writeJson_(key, value) {
  const sh = sheet_('Content', ['Key', 'JSON']);
  const last = sh.getLastRow();
  const rows = last < 2 ? [] : sh.getRange(2, 1, last - 1, 2).getValues();
  const json = JSON.stringify(value);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === key) {
      sh.getRange(i + 2, 2).setValue(json);
      return;
    }
  }
  sh.appendRow([key, json]);
}

function log_(action, detail) {
  try {
    sheet_('Log', ['When', 'Action', 'Detail']).appendRow([new Date(), action, String(detail || '').slice(0, 300)]);
  } catch (_) {}
}

function clearPublicCache_() {
  CacheService.getScriptCache().remove(APP.cacheKey);
}

/* ------------------------------------------------------------------- helpers */

function appUrl_() {
  try {
    return ScriptApp.getService().getUrl();
  } catch (_) {
    return '';
  }
}

function hrefFor_(base, key) {
  return key ? base + '?page=' + encodeURIComponent(key) : base;
}

function pageByKey_(pages, key) {
  const k = String(key || '').toLowerCase();
  return (pages || []).filter(p => p.key === k)[0] || null;
}

function msg_(e) {
  return String((e && e.message) || e || 'Something went wrong.');
}

function plain_(html, max) {
  const text = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return max && text.length > max ? text.slice(0, max - 1).trim() + '…' : text;
}

function homeDescription_(d) {
  const about = plain_(d.home.about.text, 160);
  return about || plain_(d.home.hero.slides[0] && d.home.hero.slides[0].text, 160) || d.settings.motto;
}

/** Turns anything the admin typed into an image URL. */
function imageUrl_(value, width) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) {
    const m = /(?:drive\.google\.com\/(?:file\/d\/|open\?id=|thumbnail\?id=)|docs\.google\.com\/[^/]+\/d\/)([A-Za-z0-9_-]{20,})/.exec(v);
    return m ? driveThumb_(m[1], width) : v;
  }
  if (/^[A-Za-z0-9_-]{20,}$/.test(v)) return driveThumb_(v, width);
  return '';
}

/** Drive stops serving thumbnails above 2048px wide, so cap the request there. */
function driveThumb_(id, width) {
  const w = Math.min(Math.round(Number(width) || 1200), 2048);
  return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + w;
}

function searchSite_(d, q) {
  const term = String(q || '').trim().toLowerCase();
  if (!term) return [];
  const out = [];
  (d.pages || []).forEach(p => {
    const hay = (p.title + ' ' + p.intro + ' ' + p.body).toLowerCase();
    if (hay.indexOf(term) >= 0) {
      out.push({ title: p.title, href: hrefFor_(d.base, p.key), text: plain_(p.intro || p.body, 180) });
    }
  });
  (d.announcements || []).forEach(a => {
    if ((a.title + ' ' + a.summary).toLowerCase().indexOf(term) >= 0) {
      out.push({ title: a.title, href: hrefFor_(d.base, 'news'), text: a.summary });
    }
  });
  return out.slice(0, 20);
}
