/**
 * Shared markup helpers for the public templates.
 * Kept as functions (not partial HTML files) because Apps Script's include()
 * returns files unevaluated, so scriptlets cannot live in a partial.
 */

function navHtml_(d) {
  const base = d.base;
  let html = '<header class="mast"><div class="wrap mastin">' +
    '<a class="brand" href="' + esc_(base) + '">' +
    logoMarkup_(d.settings.schools[0], 'brand-logo') +
    '<span class="brand-name">' + esc_(d.settings.schools[0] ? d.settings.schools[0].name : d.settings.orgName) + '</span>' +
    '</a>' +
    '<div class="schools">';

  (d.settings.schools || []).slice(1).forEach(s => {
    html += '<a class="school" href="' + esc_(s.link || base) + '"' + (s.link ? ' target="_blank" rel="noopener"' : '') + '>' +
      logoMarkup_(s, 'school-logo') +
      '<span>' + esc_(s.name) + '</span></a>';
  });

  html += '</div>' +
    '<div class="mast-right">' +
    '<span class="motto">' + esc_(d.settings.motto) + '</span>' +
    socialHtml_(d.settings.social) +
    '<form class="search" action="' + esc_(base) + '" method="get" role="search">' +
    '<input type="hidden" name="page" value="search">' +
    '<input type="search" name="q" placeholder="Search the site" aria-label="Search the site">' +
    '<button type="submit" aria-label="Search">⌕</button></form>' +
    '<button class="burger" id="burger" aria-expanded="false" aria-controls="drawer"><span></span><span></span><span></span><span class="sr">Menu</span></button>' +
    '</div></div></header>';

  html += '<nav class="nav" aria-label="Main"><div class="wrap navin">';
  (d.nav || []).forEach(item => {
    if (item.children && item.children.length) {
      html += '<div class="nav-item has-menu">' +
        '<a class="nav-link" href="' + esc_(item.href) + '">' + esc_(item.label) + '</a>' +
        '<button class="nav-toggle" aria-expanded="false" aria-label="' + esc_(item.label) + ' submenu">▾</button>' +
        '<div class="nav-menu">' +
        item.children.map(c => '<a href="' + esc_(c.href) + '">' + esc_(c.label) + '</a>').join('') +
        '</div></div>';
    } else {
      html += '<a class="nav-link" href="' + esc_(item.href) + '">' + esc_(item.label) + '</a>';
    }
  });
  html += '<a class="nav-link login" href="' + esc_(base) + '?page=admin">Manage site</a>' +
    '</div></nav>';

  /* Mobile drawer: the whole navigation, grouped. */
  html += '<div class="drawer" id="drawer" hidden><div class="drawer-in">' +
    '<div class="drawer-head"><strong>' + esc_(d.settings.orgName) + '</strong>' +
    '<button class="drawer-close" id="drawer-close" aria-label="Close menu">×</button></div>' +
    (d.nav || []).map(item => (
      '<a class="drawer-link" href="' + esc_(item.href) + '">' + esc_(item.label) + '</a>' +
      (item.children || []).map(c => '<a class="drawer-sub" href="' + esc_(c.href) + '">' + esc_(c.label) + '</a>').join('')
    )).join('') +
    '<a class="drawer-link drawer-admin" href="' + esc_(base) + '?page=admin">Manage site</a>' +
    '</div></div>';

  return html;
}

function footerHtml_(d) {
  const c = d.settings.contact || {};
  const f = d.settings.footer || {};
  const lines = [
    c.address ? '<span>' + esc_(c.address) + '</span>' : '',
    c.phone ? '<span>' + esc_(c.phone) + '</span>' : '',
    c.mobile ? '<span>' + esc_(c.mobile) + '</span>' : '',
    c.email ? '<span><a href="mailto:' + esc_(c.email) + '">' + esc_(c.email) + '</a></span>' : '',
    c.hours ? '<span>' + esc_(c.hours) + '</span>' : ''
  ].filter(Boolean).join('<span class="dot" aria-hidden="true">·</span>');

  return '<footer class="foot"><div class="wrap footin">' +
    '<div class="foot-brand">' + logoMarkup_(d.settings.schools[0], 'foot-logo') +
    '<div><strong>' + esc_(d.settings.orgName) + '</strong>' +
    (f.blurb ? '<p>' + esc_(f.blurb) + '</p>' : '') + '</div></div>' +
    '<div class="foot-contact">' + lines + '</div>' +
    '<div class="foot-end"><div class="foot-social">' + socialHtml_(d.settings.social, true) + '</div>' +
    '<p>© ' + d.year + ' ' + esc_(f.copyright || d.settings.orgName) + '. All rights reserved.</p></div>' +
    '</div></footer>';
}

function logoMarkup_(school, cls) {
  if (!school) return '';
  const src = imageUrl_(school.logo, 160);
  if (!src) return '';
  return '<img class="' + cls + '" src="' + esc_(src) + '" alt="' + esc_(school.name) + ' logo" width="52" height="52" loading="eager" decoding="async">';
}

function socialHtml_(social, light) {
  const s = social || {};
  let out = '';
  if (s.facebook) out += '<a class="social-fb" href="' + esc_(s.facebook) + '" target="_blank" rel="noopener" aria-label="Facebook">f</a>';
  if (s.youtube) out += '<a class="social-yt" href="' + esc_(s.youtube) + '" target="_blank" rel="noopener" aria-label="YouTube">▶</a>';
  if (s.email) out += '<a class="social-mail" href="mailto:' + esc_(s.email) + '" aria-label="Email">✉</a>';
  return out ? '<div class="social' + (light ? ' social-light' : '') + '">' + out + '</div>' : '';
}

/** Escapes text for HTML. */
function esc_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
