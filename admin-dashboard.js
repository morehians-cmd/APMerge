/* Admissions dashboard — built to the office specification.
 *
 * Layout order follows section 13 of the spec: welcome banner, filters, six bento
 * cards, enrollment progress, four doughnut charts, per-level cards, recent
 * registrations, quick actions, needs attention, recent activity.
 *
 * Every figure comes from dashboardSpec in one call; nothing here invents numbers.
 */
(function () {
  var DS = { filters: { level: '', type: '', status: '' }, busy: false };

  function ic(d) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  var ICO = {
    users: ic('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    check: ic('<circle cx="12" cy="12" r="9"/><path d="M8.4 12.4l2.6 2.6 4.6-5.2"/>'),
    clock: ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    x: ic('<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>'),
    out: ic('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'),
    cap: ic('<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12.6V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.4"/>'),
    plus: ic('<path d="M12 5v14M5 12h14"/>'),
    search: ic('<path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3"/>'),
    rep: ic('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h8"/>'),
    globe: ic('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>'),
    user: ic('<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/>'),
    fee: ic('<path d="M4 6h16v12H4z"/><path d="M8 10h8M8 14h4"/>'),
    alert: ic('<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
    pulse: ic('<path d="M3 12h4l3 8 4-16 3 8h4"/>'),
    refresh: ic('<path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5"/>')
  };

  var escv = function (v) { return esc(v == null ? '' : String(v)); };
  var nf = function (n) { return Number(n || 0).toLocaleString('en-US'); };
  var pctOf = function (n, t) { return t ? Math.round((n || 0) / t * 100) : 0; };

  function greeting() {
    var h = new Date().getHours();
    return h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
  }
  function displayName() {
    var raw = (S.user && S.user.FullName) || 'Administrator';
    if (typeof tc === 'function') { try { return tc(raw); } catch (e) { return raw; } }
    return raw;
  }
  function initials() {
    var parts = String(displayName()).replace(/,/g, ' ').trim().split(/\s+/);
    return ((parts[0] || 'A')[0] + ((parts[1] || '')[0] || '')).toUpperCase();
  }

  /* ---------- doughnut ---------- */
  var DONUT_COLORS = ['#2563eb', '#f7941d', '#16a34a', '#7c3aed', '#ef4444', '#0ea5e9', '#f59e0b', '#14b8a6', '#8b5cf6', '#64748b', '#94a3b8'];

  function donut(title, sub, rows, total, unit) {
    var sum = rows.reduce(function (a, r) { return a + (r.count || 0); }, 0);
    var acc = 0, segs = [];
    rows.forEach(function (r, i) {
      if (!r.count) return;
      var from = acc / sum * 360; acc += r.count;
      segs.push(DONUT_COLORS[i % DONUT_COLORS.length] + ' ' + from.toFixed(2) + 'deg ' + (acc / sum * 360).toFixed(2) + 'deg');
    });
    var bg = segs.length ? 'conic-gradient(' + segs.join(',') + ')' : '#e8eef7';
    var legend = rows.map(function (r, i) {
      return '<div class="ds-leg"><i style="background:' + DONUT_COLORS[i % DONUT_COLORS.length] + '"></i>' +
        '<b>' + escv(r.label) + '</b><small>' + nf(r.count) + ' &middot; ' + pctOf(r.count, sum) + '%</small></div>';
    }).join('');
    return '<section class="ds-panel ds-donut-card">' +
      '<header><h3>' + escv(title) + '</h3><small>' + escv(sub) + '</small></header>' +
      '<div class="ds-donut-wrap"><div class="ds-donut" style="background:' + bg + '"><div><b>' + nf(total) + '</b><span>' + escv(unit) + '</span></div></div>' +
      '<div class="ds-legend' + (rows.length > 7 ? ' two' : '') + '">' + legend + '</div></div></section>';
  }

  /* ---------- page ---------- */
  function render(d) {
    var host = $('view');
    if (!host) return;
    var p = d.progress || {}, ch = d.charts || {};

    var cards = (d.cards || []).map(function (c) {
      var look = { total: 'blue', enrolled: 'green', today: 'orange', pending: 'amber', cancelled: 'red', transferred: 'slate' }[c.key] || 'blue';
      return '<button type="button" class="ds-card ' + look + '" data-act="dflt" data-v="' + escv(c.status || 'All') + '">' +
        '<span class="ds-card-ic">' + (ICO[{ total: 'users', enrolled: 'check', today: 'plus', pending: 'clock', cancelled: 'x', transferred: 'out' }[c.key]] || ICO.users) + '</span>' +
        '<span class="ds-card-body"><small>' + escv(c.label) + '</small><b>' + nf(c.value) + '</b><em>' + escv(c.hint) + '</em></span>' +
      '</button>';
    }).join('');

    var charts =
      '<div class="ds-col">' +
        donut('Enrolled by Level', 'Officially enrolled', ch.byLevel || [], p.enrolled, 'Enrolled') +
        donut('Students by Sex', 'Legal sex on record', ch.bySex || [], d.totals.scoped, 'Students') +
      '</div>' +
      '<div class="ds-col">' +
        donut('Applicants by Scholarship', 'Stored categories, unmerged', ch.byScholarship || [], d.totals.scoped, 'Applicants') +
        donut('Applicants by Previous School', 'Top 10, then Others', ch.bySchool || [], d.totals.scoped, 'Applicants') +
      '</div>';

    var levels = (d.levels || []).map(function (l) {
      var kids = (l.kids || []).filter(function (k) { return k.count || k.label; });
      var rows = kids.length ? kids.map(function (k) {
        return '<div class="ds-lvl-row"><span title="' + escv(k.name || '') + '">' + escv(k.label) + '</span><b>' + nf(k.count) + '</b></div>';
      }).join('') : '<div class="ds-lvl-empty">No programs recorded yet</div>';
      return '<article class="ds-lvl"><header><h4>' + escv(l.label) + '</h4><b>' + nf(l.total) + '</b></header><div class="ds-lvl-kids">' + rows + '</div></article>';
    }).join('');

    var recent = (d.recent || []).length ? (d.recent || []).map(function (r) {
      var st = String(r.status || '');
      var tone = st === 'Enrolled' ? 'ok' : st === 'Cancelled' ? 'bad' : st === 'Transferred Out' ? 'mut' : st === 'Temporary' ? 'warn' : 'pend';
      return '<tr><td><b>' + escv(r.name) + '</b><small>' + escv(r.id) + '</small></td>' +
        '<td>' + escv(r.grade || r.level) + '</td>' +
        '<td>' + escv(r.date) + (r.time ? '<small>' + escv(r.time) + '</small>' : '') + '</td>' +
        '<td><span class="ds-badge ' + tone + '">' + escv(st || 'Not Enrolled') + '</span></td></tr>';
    }).join('') : '<tr><td colspan="4"><div class="ds-empty">No registrations for this selection yet.</div></td></tr>';

    var canFull = (typeof FULL === 'function') && FULL();
    var canSys = (typeof SYS === 'function') && SYS();
    var quick = [
      { ico: ICO.plus, label: 'Register Student', act: 'nav', v: 'adm' },
      { ico: ICO.search, label: 'Find Learner', act: 'gsopen' },
      canFull ? { ico: ICO.rep, label: 'Reports', act: 'nav', v: 'rep' } : null,
      canFull ? { ico: ICO.globe, label: 'Website Management', act: 'nav', v: 'webm' } : null,
      canSys ? { ico: ICO.user, label: 'User Management', act: 'nav', v: 'um' } : null,
      { ico: ICO.fee, label: 'Schedule of Fees', act: 'nav', v: 'tf' }
    ].filter(Boolean).map(function (q) {
      return '<button type="button" data-act="' + q.act + '"' + (q.v ? ' data-v="' + q.v + '"' : '') + '>' + q.ico + '<span>' + q.label + '</span></button>';
    }).join('');

    var att = d.attention || { counts: {}, total: 0, rows: [] };
    var attnRows = (att.rows || []).slice(0, 5).map(function (r) {
      return '<div class="ds-attn-row"><b>' + escv(r.name) + '</b><span>' + escv(r.grade) + '</span>' +
        '<em>' + escv((r.badges || []).join(' · ')) + '</em></div>';
    }).join('');
    var attn =
      '<section class="ds-panel"><header><h3>' + ICO.alert + 'Needs Attention</h3>' +
        '<a href="javascript:void(0)" data-act="nav" data-v="adm">View all</a></header>' +
        '<div class="ds-attn-counts">' +
          '<div><b>' + nf(att.total) + '</b><span>Students</span></div>' +
          '<div><b>' + nf((att.counts || {}).req) + '</b><span>Incomplete requirements</span></div>' +
          '<div><b>' + nf((att.counts || {}).consent) + '</b><span>Consent missing</span></div>' +
          '<div><b>' + nf((att.counts || {}).cert) + '</b><span>Certificate blank</span></div>' +
        '</div>' +
        (attnRows ? '<div class="ds-attn-list">' + attnRows + '</div>' : '<div class="ds-empty">Every live student has complete requirements.</div>') +
      '</section>';

    var act = (d.activity || []).length ? (d.activity || []).map(function (x) {
      var what = String(x.action || 'System activity').replace(/[._]/g, ' ');
      return '<div class="ds-act-row"><i></i><span><b>' + escv(what.charAt(0).toUpperCase() + what.slice(1)) + '</b>' +
        '<small>' + escv([x.actor || 'System', x.role || ''].filter(Boolean).join(' · ')) + '</small></span>' +
        '<time>' + escv(String(x.date || '').slice(0, 10)) + (x.time ? ' ' + escv(String(x.time).slice(0, 5)) : '') + '</time></div>';
    }).join('') : '<div class="ds-empty">No activity recorded yet.</div>';

    host.innerHTML =
      '<div class="ds-page">' +
        '<section class="ds-welcome">' +
          '<div class="ds-welcome-copy"><h2>' + greeting() + ', ' + escv(displayName()) + '</h2>' +
            '<p>Here’s what’s happening with admissions today. Click a card to open that list.</p>' +
            '<div class="ds-welcome-meta">' +
              '<span>' + escv(new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })) + '</span>' +
              '<span id="dsClock">' + escv(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })) + '</span>' +
              '<span>SY ' + escv(d.sy) + '</span>' +
            '</div></div>' +
          '<div class="ds-avatar" aria-hidden="true">' + escv(initials()) + '</div>' +
        '</section>' +
        '<div class="ds-main">' +
          '<section class="ds-cards">' + cards + '</section>' +
          charts +
        '</div>' +
        '<section class="ds-levels-wrap"><header><h3>Summary per Academic Level</h3><small>Enrolled students, with grade, strand and program counts</small></header>' +
          '<div class="ds-levels">' + levels + '</div></section>' +
        '<div class="ds-two">' +
          '<section class="ds-panel"><header><h3>Recent Registrations</h3><a href="javascript:void(0)" data-act="nav" data-v="adm">View all</a></header>' +
            '<div class="ds-table-wrap"><table class="ds-table"><thead><tr><th>Student</th><th>Level</th><th>Registered</th><th>Status</th></tr></thead>' +
            '<tbody>' + recent + '</tbody></table></div></section>' +
          '<section class="ds-panel"><header><h3>Quick Actions</h3></header><div class="ds-quick">' + quick + '</div></section>' +
        '</div>' +
        '<div class="ds-two">' + attn +
          '<section class="ds-panel"><header><h3>' + ICO.pulse + 'Recent Activity</h3><a href="javascript:void(0)" data-act="auditall">Full log</a></header>' + act + '</section>' +
        '</div>' +
      '</div>';
  }

  /* ---------- wiring ---------- */
  function load() {
    if (DS.busy) return;
    DS.busy = true;
    call('dashboardSpec', [T(), DS.filters], function (r) {
      DS.busy = false;
      render(r.data || {});
    });
    setTimeout(function () { DS.busy = false; }, 8000);
  }

  /* keep the banner clock live while the dashboard is mounted */
  setInterval(function () {
    var el = document.getElementById('dsClock');
    if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }, 20000);

  window.homeAdmin = function () {
    var sy = (S.cfg && S.cfg.sy) || '';
    head('Dashboard', 'Admissions overview for School Year ' + sy);
    var dt = $('maTopDate');
    if (dt) dt.innerHTML = ((typeof I === 'object' && I.cal) ? I.cal : '') + '<b>' +
      new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + '</b>';
    DS.filters = { level: '', type: '', status: '' };
    $('view').innerHTML = '<div class="ds-page"><div class="ds-empty">Loading the dashboard&hellip;</div></div>';
    load();
    /* if the backend never answers, say so instead of spinning forever */
    setTimeout(function () {
      var host = $('view');
      if (!host || host.querySelector('.ds-cards')) return;
      host.innerHTML = '<div class="ds-page"><div class="ds-empty">The dashboard could not be loaded. Make sure the latest Apps Script version is deployed, then refresh this page.</div></div>';
    }, 12000);
  };
})();

/* ---------- Homepage hero editor, integrated into Website Management ---------- */
(function () {
  const baseWebsiteManagementPage = window.websiteManagementPage;
  const escField = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  function heroField(id,label,value,wide) {
    return '<label class="ma-hero-field'+(wide?' wide':'')+'"><span>'+label+'</span><input id="'+id+'" type="text" value="'+escField(value)+'" maxlength="1000"></label>';
  }
  function websiteHeroEditor() {
    if (typeof SYS !== 'function' || !SYS()) return toast('Website Management is restricted to the main administrator.','warn');
    head('Homepage Hero & Images','Edit the public homepage welcome banner, call-to-action links and three carousel images.');
    google.script.run.withSuccessHandler(res => {
      if (!res || !res.success) return toast((res && res.error) || 'Could not load homepage settings.',false);
      const h=res.data||{};
      $('view').innerHTML=
        '<div class="ma-hero-editor">'+
          '<div class="ma-web-warning"><b>Publishing notice</b><p>Saving updates the public homepage immediately. Use Google Drive thumbnail links for images. The public homepage will keep its approved layout and styling.</p></div>'+
          '<div class="sbar"><button class="btn" data-act="webherosave">Save &amp; Publish</button><button class="btn alt" data-act="webherocancel">Back to Website Management</button></div>'+
          '<section class="ma-v2-panel"><div class="ma-v2-panelhead"><h3>Welcome Banner</h3><small>Text and calls to action</small></div><div class="ma-hero-fields">'+
            heroField('maHeroHeadline','Main headline',h.headline,true)+
            heroField('maHeroSubheadline','Tagline',h.subheadline,true)+
            heroField('maHeroDescription','Description',h.description,true)+
            heroField('maHeroPrimaryText','Primary button label',h.primaryText)+
            heroField('maHeroPrimaryUrl','Primary button link',h.primaryUrl)+
            heroField('maHeroSecondaryText','Secondary button label',h.secondaryText)+
            heroField('maHeroSecondaryUrl','Secondary button link',h.secondaryUrl)+
          '</div></section>'+
          '<section class="ma-v2-panel"><div class="ma-v2-panelhead"><h3>Carousel Images</h3><small>Three slides · Google Drive hosted images</small></div><div class="ma-hero-fields">'+
            heroField('maHeroImage1','Slide 1 image URL',h.images&&h.images[0],true)+
            heroField('maHeroImage2','Slide 2 image URL',h.images&&h.images[1],true)+
            heroField('maHeroImage3','Slide 3 image URL',h.images&&h.images[2],true)+
          '</div><p class="ma-web-note">Paste a Google Drive thumbnail URL in this format: https://drive.google.com/thumbnail?id=FILE_ID&amp;sz=w2000. Make sure the image is accessible to viewers of the public website.</p></section>'+
        '</div>';
    }).withFailureHandler(e=>toast(e.message||'Could not load homepage settings.',false)).getHomepageHero();
  }
  act.webhero = websiteHeroEditor;
  act.webherocancel = () => websiteManagementPage();
  act.webherosave = () => {
    if (typeof SYS !== 'function' || !SYS()) return toast('Not allowed.','warn');
    const value=id=>{const el=$(id);return el?el.value.trim():'';};
    const settings={
      headline:value('maHeroHeadline'),
      subheadline:value('maHeroSubheadline'),
      description:value('maHeroDescription'),
      primaryText:value('maHeroPrimaryText'),
      primaryUrl:value('maHeroPrimaryUrl'),
      secondaryText:value('maHeroSecondaryText'),
      secondaryUrl:value('maHeroSecondaryUrl'),
      images:[value('maHeroImage1'),value('maHeroImage2'),value('maHeroImage3')]
    };
    google.script.run.withSuccessHandler(res=>{
      if(!res||!res.success)return toast((res&&res.error)||'Homepage settings were not saved.',false);
      toast(res.message||'Homepage hero settings saved.');
      websiteManagementPage();
    }).withFailureHandler(e=>toast(e.message||'Could not save homepage settings.',false)).saveHomepageHero(S.token,settings);
  };
  if (typeof baseWebsiteManagementPage === 'function') {
    window.websiteManagementPage = function () {
      baseWebsiteManagementPage();
      const root=document.querySelector('.ma-web-page');
      if (!root || root.querySelector('[data-act="webhero"]')) return;
      const section=document.createElement('section');
      section.className='ma-v2-panel';
      section.innerHTML='<div class="ma-v2-panelhead"><h3>Homepage Hero &amp; Images</h3><small>Editable welcome banner</small></div><p>Edit the homepage headline, tagline, buttons and carousel images without changing the page layout or navigation.</p><button type="button" class="btn" data-act="webhero">Edit Hero &amp; Images</button>';
      const first=root.querySelector('section');
      if(first) first.insertAdjacentElement('afterend',section); else root.appendChild(section);
      const note=root.querySelector('.ma-web-note');
      if(note) note.textContent='The homepage hero and carousel images are now editable here. Institutional logos, navigation, section layout and footer remain controlled by the approved homepage template.';
    };
  }
})();
