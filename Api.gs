/**
 * Everything the website manager calls through google.script.run.
 * Each function returns { ok, data?, error? } so the client never sees a
 * stack trace.
 */

function apiSignIn(password) {
  try {
    return signIn_(password);
  } catch (e) {
    return { ok: false, error: msg_(e) };
  }
}

function apiSignOut(token) {
  try {
    return signOut_(token);
  } catch (e) {
    return { ok: false, error: msg_(e) };
  }
}

function apiSession(token) {
  return { ok: sessionOk_(token) };
}

function apiLoad(token) {
  try {
    require_(token);
    return {
      ok: true,
      data: {
        settings: readSettings_(),
        homepage: readHomepage_(),
        pages: readPages_(),
        announcements: announcementRows_(),
        siteUrl: appUrl_()
      }
    };
  } catch (e) {
    return { ok: false, error: msg_(e) };
  }
}

/**
 * Saves one section and returns the cleaned version that was actually stored, so
 * the manager shows exactly what the site will show (slugified keys, sanitised
 * HTML, dropped blank rows) instead of drifting from it.
 */
function apiSave(token, section, payload) {
  try {
    require_(token);
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    let saved;
    try {
      if (section === 'settings') {
        saved = cleanSettings_(payload);
        writeJson_('settings', saved);
      } else if (section === 'homepage') {
        saved = cleanHomepage_(payload);
        writeJson_('homepage', saved);
      } else if (section === 'pages') {
        saved = cleanPages_(payload);
        writeJson_('pages', saved);
      } else if (section === 'announcements') {
        saved = saveAnnouncementRows_(payload);
      } else {
        throw new Error('Unknown section.');
      }
    } finally {
      try { lock.releaseLock(); } catch (_) {}
    }
    clearPublicCache_();
    log_('save', section);
    return { ok: true, savedAt: new Date().toISOString(), data: saved };
  } catch (e) {
    return { ok: false, error: msg_(e) };
  }
}

/** Stores an uploaded image in Drive and returns its file ID and preview URL. */
function apiUploadImage(token, dataUrl, name) {
  try {
    require_(token);
    const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(dataUrl || ''));
    if (!m) throw new Error('Choose a PNG, JPEG or WebP image.');

    const bytes = Utilities.base64Decode(m[2].replace(/\s/g, ''));
    if (bytes.length > 3 * 1024 * 1024) throw new Error('That image is larger than 3 MB. Use a smaller file.');

    const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
    const base = String(name || 'image').replace(/\.[A-Za-z0-9]+$/, '').replace(/[^\w-]+/g, '-').slice(0, 40) || 'image';
    const file = mediaFolder_().createFile(Utilities.newBlob(bytes, 'image/' + ext, base + '.' + ext));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    log_('upload', file.getName());
    return { ok: true, id: file.getId(), url: driveThumb_(file.getId(), 1600) };
  } catch (e) {
    return { ok: false, error: msg_(e) };
  }
}

function mediaFolder_() {
  const name = APP.mediaFolder;
  const found = DriveApp.getFoldersByName(name);
  return found.hasNext() ? found.next() : DriveApp.createFolder(name);
}
