/*****************************************************************************
 MOREH ACADEMY PORTAL - STUDENT ID CARD (new file "IdCard")
 TLC scholars only (Category TLC or TLC-OVAP), Junior High and Senior High.
 The Student ID number is typed by staff and never changes for the learner.
*****************************************************************************/
const ID_SLOTS = ['front', 'back', 'STEM', 'ASSH', 'BE', 'ICT', 'HT'];
const ID_RE = /^TLC\d{4}-\d{4}$/, ID_CATS = ['TLC', 'TLC-OVAP'];

/** Decodes a data URL and checks that it is a JPEG within the size limit. */
function jpegBytes_(dataUrl, maxBytes) {
  const bytes = Utilities.base64Decode(String(dataUrl || '').split(',')[1] || '');
  if (!bytes.length || bytes.length > maxBytes) throw new Error('The image is empty or too large.');
  if (!((bytes[0] & 255) === 0xFF && (bytes[1] & 255) === 0xD8)) throw new Error('The image must be a JPEG.');
  return bytes;
}

/** Admin / Encoder. The saved artwork as data URIs ('' when a slot is missing). */
function getIdArt(token) {
  try {
    who_(token, 'admin'); const pr = PropertiesService.getScriptProperties(), out = {};
    ID_SLOTS.forEach(s => { const id = pr.getProperty('idart_' + s); out[s] = id ? photo_(id) : ''; });
    return ok(out);
  } catch (e) { return fail(e); }
}

/** OWNER ONLY. Saves one artwork slot (front, back or a cluster logo). */
function saveIdArt(token, slot, dataUrl) {
  try {
    const ou = sysOwner_(token); if (!ID_SLOTS.includes(slot)) throw new Error('Unknown artwork slot.');
    const bytes = jpegBytes_(dataUrl, 1500 * 1024), pr = PropertiesService.getScriptProperties(), old = pr.getProperty('idart_' + slot);
    const f = DriveApp.getFolderById(PHOTO_FOLDER_ID).createFile(Utilities.newBlob(bytes, 'image/jpeg', 'idart_' + slot + '.jpg'));
    pr.setProperty('idart_' + slot, f.getId());                                   // save the new id first
    if (old) { try { DriveApp.getFileById(old).setTrashed(true); } catch (_) {} }
    audit_(ou, 'idart.save', slot, '');
    return ok(photo_(f.getId()), 'Saved');
  } catch (e) { return fail(e); }
}

/** Highest number used for a year, e.g. 'TLC2026-1633' ('' when none). */
function idHighest_(year) {
  const p = 'TLC' + year + '-'; let best = '', max = -1;
  colVals_('IDNumber').forEach(v => { if (v.indexOf(p) === 0) { const n = parseInt(v.slice(p.length), 10); if (n > max) { max = n; best = v; } } });
  return best;
}

/** Admin / Encoder. The learner's ID photo and the hint for the number field. */
function idCardData(token, studentId) {
  try {
    who_(token, 'admin');
    const hit = findStudent_(String(studentId || '')); if (!hit) throw new Error('Learner not found.');
    return ok({ photo:photo_(hit.o.IDPhotoID), last:idHighest_(activeSY_().slice(0, 4)) });
  } catch (e) { return fail(e); }
}

/** Admin / Encoder. Saves the typed Student ID number: format, year and duplicate checks. */
function saveIdNumber(token, studentId, number) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const u = who_(token, 'admin'), hit = findStudent_(String(studentId || '')); if (!hit) throw new Error('Learner not found.');
    if (!ID_CATS.includes(hit.o.Category)) throw new Error('ID cards are for TLC scholars only.');
    const n = String(number || '').trim().toUpperCase();
    if (!ID_RE.test(n)) throw new Error('The Student ID number must look like TLC2027-0001 (TLC, school year, 4 digits).');
    const yr = parseInt(n.slice(3, 7), 10), top = parseInt(activeSY_().slice(0, 4), 10) + 1;
    if (yr < 2018 || yr > top) throw new Error('The year in the number must be between 2018 and ' + top + '.');
    if (colVals_('IDNumber').some((v, i) => v === n && i + 2 !== hit.r)) throw new Error(n + ' is already assigned to another learner.');
    const was = hit.o.IDNumber || '';
    put_(sh_('S'), hit.r, COLS.indexOf('IDNumber') + 1, [[n]]);
    audit_(u, 'idcard.number', hit.o.StudentID, was ? was + ' -> ' + n : n);
    return ok(null, 'Student ID number saved');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}

/** Admin / Encoder. Saves the learner's ID photo (already cropped to 4:5 by the browser). */
function saveIdPhoto(token, studentId, dataUrl) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const u = who_(token, 'admin'), hit = findStudent_(String(studentId || '')); if (!hit) throw new Error('Learner not found.');
    const bytes = jpegBytes_(dataUrl, 1024 * 1024), old = hit.o.IDPhotoID;
    const f = DriveApp.getFolderById(PHOTO_FOLDER_ID).createFile(Utilities.newBlob(bytes, 'image/jpeg', hit.o.StudentID + '_idphoto.jpg'));
    put_(sh_('S'), hit.r, COLS.indexOf('IDPhotoID') + 1, [[f.getId()]]);          // save the new id first
    if (old) { try { DriveApp.getFileById(old).setTrashed(true); } catch (_) {} }
    audit_(u, 'idcard.photo', hit.o.StudentID, '');
    return ok(photo_(f.getId()), 'ID photo saved');
  } catch (e) { return fail(e); } finally { try { lock.releaseLock(); } catch (_) {} }
}