#!/usr/bin/env node
/**
 * Local preview of the public website — no Apps Script, no deployment.
 *
 *   node tools/preview.js            → http://localhost:8080
 *   PORT=9000 node tools/preview.js
 *
 * It loads Code.gs / Site.gs / Render.gs in a sandbox with stub Apps Script
 * services, renders the real PublicHome / PublicPage / PublicSearch templates
 * and serves them. Content shown is the starter content from Site.gs, not the
 * spreadsheet, so edits made in the Website Manager do not appear here.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 8080);

/* ---------------------------------------------------- load the Apps Script code */

const stubs = {
  console,
  Date, JSON, Math, String, Number, Array, Object, RegExp, Boolean, Error,
  encodeURIComponent, decodeURIComponent, isNaN, parseInt, parseFloat, Intl,
  SpreadsheetApp: {}, PropertiesService: {}, CacheService: {}, DriveApp: {},
  Session: {}, ScriptApp: {}, HtmlService: {}, Logger: { log() {} },
  Utilities: { formatDate: (d) => new Date(d).toISOString().slice(0, 10) },
  LockService: {}
};

const context = vm.createContext(stubs);
const sources = ['Code.gs', 'Site.gs', 'Render.gs']
  .map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8'))
  .join('\n');

const exposed = [
  'cleanSettings_', 'cleanHomepage_', 'cleanPages_', 'buildPublicData_',
  'publishedAnnouncements_', 'searchSite_',
  'DEFAULT_SETTINGS', 'DEFAULT_HOME', 'DEFAULT_PAGES', 'DEFAULT_ANNOUNCEMENTS',
  'esc_', 'plain_', 'hrefFor_', 'imageUrl_', 'homeDescription_', 'navHtml_', 'footerHtml_'
];

/* Publish the helpers as sandbox globals so compiled templates can call them. */
vm.runInContext(
  sources + '\n' +
  exposed.map((name) => 'globalThis.' + name + ' = ' + name + ';').join('\n') + '\n' +
  'globalThis.__api = {' + exposed.map((name) => name + ': ' + name).join(', ') + '};',
  context,
  { filename: 'appscript-bundle.gs' }
);

const api = context.__api;

/* ----------------------------------------------------- tiny scriptlet renderer */

function include(name) {
  return fs.readFileSync(path.join(ROOT, name + '.html'), 'utf8');
}

function render(file, variables) {
  const source = fs.readFileSync(path.join(ROOT, file + '.html'), 'utf8');
  const pattern = /<\?(!?=)?([\s\S]*?)\?>/g;
  let code = 'var __out = [];\n';
  let cursor = 0;
  let match;

  while ((match = pattern.exec(source))) {
    const text = source.slice(cursor, match.index);
    if (text) code += '__out.push(' + JSON.stringify(text) + ');\n';
    if (match[1] === '=') code += '__out.push((' + match[2] + '));\n';
    else if (match[1] === '!=') code += '__out.push((' + match[2] + ') || "");\n';
    else code += match[2] + '\n';
    cursor = match.index + match[0].length;
  }
  code += '__out.push(' + JSON.stringify(source.slice(cursor)) + ');\nreturn __out.join("");';

  const fn = vm.runInContext('(function (d, page, q, results, include) {' + code + '\n})', context, { filename: file + '.html' });
  return fn(variables.d, variables.page, variables.q, variables.results, include);
}

/* --------------------------------------------------------------- request router */

function publicData(base) {
  const settings = api.cleanSettings_(api.DEFAULT_SETTINGS);
  const home = api.cleanHomepage_(api.DEFAULT_HOME);
  const pages = api.cleanPages_(api.DEFAULT_PAGES);
  const announcements = api.publishedAnnouncements_(api.DEFAULT_ANNOUNCEMENTS);
  return api.buildPublicData_(settings, home, pages, base, announcements);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const host = req.headers.host || 'localhost:' + PORT;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);
  const proto = req.headers['x-forwarded-proto'] || (local ? 'http' : 'https');
  const base = proto + '://' + host;
  const key = String(url.searchParams.get('page') || '').toLowerCase();

  try {
    const d = publicData(base);
    let html;

    if (key === 'search') {
      const q = url.searchParams.get('q') || '';
      html = render('PublicSearch', { d, q, results: api.searchSite_(d, q) });
    } else if (key) {
      const page = d.pages.filter((p) => p.key === key)[0];
      html = page ? render('PublicPage', { d, page }) : render('PublicHome', { d });
    } else {
      html = render('PublicHome', { d });
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html);
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Preview failed:\n\n' + (err && err.stack ? err.stack : err));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Preview running at http://localhost:' + PORT);
  console.log('Press Ctrl+C to stop.');
});
