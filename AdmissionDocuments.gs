/**
 * Moreh Academy — private applicant document vault.
 * Documents are linked to existing Students records and existing portal sessions.
 * Files are private in Drive; the browser requests a short-lived data URL only after
 * the backend verifies that the caller owns the application or has registrar access.
 */
const ADMISSION_DOC_SHEET = 'Admission Documents';
const ADMISSION_DOC_HEADERS = [
  'DocumentID','StudentID','DocumentType','FileName','MimeType','DriveFileID',
  'FileSize','Status','ApplicantNote','ReviewNote','UploadedAt','UploadedBy',
  'ReviewedAt','ReviewedBy'
];
const ADMISSION_DOC_TYPES = [
  'Birth Certificate','Report Card / SF9','Form 137','Good Moral Certificate',
  'JHS Completion Certificate','Transferee Certification','Other Supporting Document'
];
const ADMISSION_DOC_MAX_BYTES = 10 * 1024 * 1024;
const ADMISSION_DOC_MIME = ['application/pdf','image/jpeg','image/png'];

function admissionDocSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ADMISSION_DOC_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ADMISSION_DOC_SHEET);
    sh.getRange(1,1,1,ADMISSION_DOC_HEADERS.length).setValues([ADMISSION_DOC_HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1,1,sh.getMaxRows(),ADMISSION_DOC_HEADERS.length).setNumberFormat('@');
  } else {
    const got = sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getDisplayValues()[0];
    ADMISSION_DOC_HEADERS.forEach((h,i) => {
      if (got[i] !== h) throw new Error('Admission Documents sheet schema mismatch at column ' + (i+1) + '.');
    });
  }
  return sh;
}

function admissionDocFolder_() {
  const pr = PropertiesService.getScriptProperties();
  let id = pr.getProperty('ADMISSION_DOC_FOLDER_ID');
  if (id) {
    try {
      const f = DriveApp.getFolderById(id);
      if (!f.isTrashed()) return f;
    } catch (_) {}
  }
  const f = DriveApp.createFolder('Moreh Academy — Applicant Documents (Private)');
  pr.setProperty('ADMISSION_DOC_FOLDER_ID', f.getId());
  return f;
}

function initialSetupAdmissionDocuments() {
  ownerOnly_();
  const sh = admissionDocSheet_(), folder = admissionDocFolder_();
  Logger.log('Admission Documents sheet ready: ' + sh.getName());
  Logger.log('Private applicant document folder: ' + folder.getUrl());
  return { sheet:sh.getName(), folderId:folder.getId(), folderUrl:folder.getUrl() };
}

function admissionDocRows_() {
  const sh = admissionDocSheet_(), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2,1,n,ADMISSION_DOC_HEADERS.length).getDisplayValues().map((r,i) => {
    const o = { _row:i+2 };
    ADMISSION_DOC_HEADERS.forEach((h,j) => o[h] = String(r[j] || ''));
    return o;
  });
}

function admissionDocAccess_(token, studentId) {
  const u = who_(token);
  if (u.Role === 'student') {
    const own = String(u.StudentID || '');
    if (!own || (studentId && String(studentId) !== own)) throw new Error('Not allowed.');
    return { user:u, studentId:own, admin:false, reviewer:false };
  }
  if (u.Role !== 'admin' || OFFICE_CL.indexOf(u.Clearance) >= 0 || ACAD_ROLES.indexOf(u.Clearance) >= 0) {
    throw new Error('Not allowed.');
  }
  if (!studentId || !findStudent_(String(studentId))) throw new Error('Select a valid applicant.');
  return { user:u, studentId:String(studentId), admin:true, reviewer:isFull_(u) };
}

function listAdmissionDocuments(token, studentId) {
  try {
    const ctx = admissionDocAccess_(token, studentId);
    const docs = admissionDocRows_().filter(d => d.StudentID === ctx.studentId)
      .sort((a,b) => b.UploadedAt.localeCompare(a.UploadedAt))
      .map(d => ({
        documentId:d.DocumentID, studentId:d.StudentID, type:d.DocumentType, fileName:d.FileName,
        mimeType:d.MimeType, fileSize:Number(d.FileSize)||0, status:d.Status,
        applicantNote:d.ApplicantNote, reviewNote:ctx.reviewer ? d.ReviewNote : '',
        uploadedAt:d.UploadedAt, reviewedAt:d.ReviewedAt, reviewedBy:ctx.reviewer ? d.ReviewedBy : ''
      }));
    return ok({ studentId:ctx.studentId, documents:docs, types:ADMISSION_DOC_TYPES, canReview:ctx.reviewer });
  } catch(e) { return fail(e); }
}

function uploadAdmissionDocument(token, documentType, fileName, mimeType, dataUrl, applicantNote) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const u = who_(token), ctx = admissionDocAccess_(token, u.Role === 'student' ? u.StudentID : '');
    if (!ADMISSION_DOC_TYPES.includes(String(documentType))) throw new Error('Choose a valid document type.');
    const mime = String(mimeType || '').toLowerCase();
    if (!ADMISSION_DOC_MIME.includes(mime)) throw new Error('Upload a PDF, JPEG or PNG file.');
    const raw = String(dataUrl || ''), match = raw.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!match || match[1].toLowerCase() !== mime) throw new Error('The uploaded file could not be read.');
    const bytes = Utilities.base64Decode(match[2]);
    if (!bytes.length || bytes.length > ADMISSION_DOC_MAX_BYTES) throw new Error('Each document must be 10 MB or smaller.');
    const ext = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : 'jpg';
    const safeName = String(fileName || ('document.' + ext)).replace(/[\\/:*?"<>|\r\n]/g,'_').slice(0,120) || ('document.' + ext);
    const blob = Utilities.newBlob(bytes, mime, safeName);
    const file = admissionDocFolder_().createFile(blob);
    file.setDescription('Moreh Academy applicant document. StudentID=' + ctx.studentId + '; Type=' + documentType);
    const sh = admissionDocSheet_(), id = 'AD' + Utilities.getUuid().replace(/-/g,'').slice(0,16).toUpperCase();
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    put_(sh, sh.getLastRow()+1, 1, [[id,ctx.studentId,documentType,safeName,mime,file.getId(),String(bytes.length),'Pending',
      String(applicantNote||'').trim().slice(0,300),'',now,u.Username,'','']]);
    audit_(u, 'admission.document.upload', ctx.studentId, documentType + ' / ' + safeName);
    return ok({ documentId:id, fileName:safeName, status:'Pending' }, 'Document uploaded for review.');
  } catch(e) { return fail(e); } finally { try { lock.releaseLock(); } catch(_) {} }
}

function reviewAdmissionDocument(token, documentId, decision, note) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const u = owner_(token), status = String(decision || '');
    if (!['Approved','Rejected','Needs Correction'].includes(status)) throw new Error('Choose a valid review decision.');
    const docs = admissionDocRows_(), d = docs.find(x => x.DocumentID === String(documentId));
    if (!d) throw new Error('Document not found.');
    if (d.Status === 'Approved' && status !== 'Needs Correction') throw new Error('An approved document cannot be changed directly.');
    const msg = String(note || '').trim().slice(0,500);
    if (status !== 'Approved' && !msg) throw new Error('Add a note explaining what the applicant must correct.');
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    put_(admissionDocSheet_(), d._row, 8, [[status,msg ? d.ApplicantNote : d.ApplicantNote, msg, now, u.Username]]);
    audit_(u, 'admission.document.review', d.StudentID, d.DocumentType + ' => ' + status);
    return ok(null, 'Document marked ' + status + '.');
  } catch(e) { return fail(e); } finally { try { lock.releaseLock(); } catch(_) {} }
}

function getAdmissionDocument(token, documentId) {
  try {
    const d = admissionDocRows_().find(x => x.DocumentID === String(documentId));
    if (!d) throw new Error('Document not found.');
    const ctx = admissionDocAccess_(token, d.StudentID);
    const f = DriveApp.getFileById(d.DriveFileID);
    if (f.isTrashed()) throw new Error('This file is no longer available.');
    const blob = f.getBlob(), bytes = blob.getBytes();
    if (bytes.length > ADMISSION_DOC_MAX_BYTES) throw new Error('This file exceeds the preview limit.');
    return ok({ fileName:d.FileName, mimeType:d.MimeType, dataUrl:'data:'+d.MimeType+';base64,'+Utilities.base64Encode(bytes) });
  } catch(e) { return fail(e); }
}
