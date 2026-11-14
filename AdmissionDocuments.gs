/**
 * Moreh Academy admission-document workflow.
 * Uses the bound portal spreadsheet, existing Users/Students authentication,
 * and a private Drive folder. Files are never made public.
 */
const ADMISSION_DOCS_SHEET_ = 'Admission Documents';
const ADMISSION_DOCS_FOLDER_PROPERTY_ = 'MA_ADMISSION_DOCS_FOLDER_ID';
const ADMISSION_DOCS_HEADERS_ = [
  'DocumentID','StudentID','RequirementKey','RequirementLabel','FileName',
  'MimeType','DriveFileID','Status','UploadedAt','UploadedBy',
  'ReviewedAt','ReviewedBy','ReviewRemarks'
];
const ADMISSION_DOC_TYPES_ = {
  ReqSF9:'SF9 / Report Card',
  ReqF137:'Form 137 / SF10',
  ReqBirth:'Birth Certificate',
  ReqMoral:'Good Moral Certificate',
  ReqJHS:'JHS Completion Certificate',
  ReqPhoto:'2x2 ID Photo',
  ReqTransferee:'Transferee / Scholarship Certificate',
  ReqConsent:'Parental Consent & Data Privacy Undertaking',
  ReqEnvelope:'Long Brown Expandable Envelope'
};
const ADMISSION_DOC_MAX_BYTES_ = 8 * 1024 * 1024;
const ADMISSION_DOC_MIMES_ = ['application/pdf','image/jpeg','image/png'];

/** OWNER ONLY. Creates the private folder and metadata sheet; safe to run repeatedly. */
function initialSetupAdmissionDocuments() {
  ownerOnly_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ADMISSION_DOCS_SHEET_);
  if (!sh) {
    sh = ss.insertSheet(ADMISSION_DOCS_SHEET_);
    sh.getRange(1,1,1,ADMISSION_DOCS_HEADERS_.length).setValues([ADMISSION_DOCS_HEADERS_]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,sh.getMaxRows(),ADMISSION_DOCS_HEADERS_.length).setNumberFormat('@');
    sh.getRange(1,1,1,ADMISSION_DOCS_HEADERS_.length).setFontWeight('bold');
  } else {
    const actual = sh.getRange(1,1,1,Math.max(sh.getLastColumn(),ADMISSION_DOCS_HEADERS_.length)).getDisplayValues()[0];
    ADMISSION_DOCS_HEADERS_.forEach((h,i) => {
      if (actual[i] !== h) throw new Error('Admission Documents sheet header mismatch at column ' + (i+1) + '. Do not overwrite existing data.');
    });
  }
  const props = PropertiesService.getScriptProperties();
  let folderId = String(props.getProperty(ADMISSION_DOCS_FOLDER_PROPERTY_) || '').trim();
  let folder = null;
  if (folderId) {
    try { folder = DriveApp.getFolderById(folderId); folder.getName(); } catch (_) { folder = null; }
  }
  if (!folder) {
    folder = DriveApp.createFolder('Moreh Academy - Private Admission Documents');
    folder.setDescription('Private applicant-submitted admission documents. Do not enable link sharing.');
    props.setProperty(ADMISSION_DOCS_FOLDER_PROPERTY_, folder.getId());
  }
  audit_('system:setup','admission.documents.setup',folder.getId(),'private folder and metadata sheet verified');
  return {success:true,sheet:ADMISSION_DOCS_SHEET_,folderId:folder.getId(),folderName:folder.getName(),private:true};
}

function admissionDocsSheet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ADMISSION_DOCS_SHEET_);
  if (!sh) throw new Error('Admission document storage is not set up. Ask the system administrator to run initialSetupAdmissionDocuments().');
  const head = sh.getRange(1,1,1,ADMISSION_DOCS_HEADERS_.length).getDisplayValues()[0];
  if (ADMISSION_DOCS_HEADERS_.some((h,i)=>head[i]!==h)) throw new Error('Admission Documents sheet headers are invalid.');
  return sh;
}
function admissionDocsFolder_() {
  const id = String(PropertiesService.getScriptProperties().getProperty(ADMISSION_DOCS_FOLDER_PROPERTY_) || '').trim();
  if (!id) throw new Error('Admission document folder is not configured.');
  const folder = DriveApp.getFolderById(id);
  if (folder.isTrashed()) throw new Error('Admission document folder is unavailable.');
  return folder;
}
function admissionDocRows_() {
  const sh = admissionDocsSheet_();
  if (sh.getLastRow()<2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,ADMISSION_DOCS_HEADERS_.length).getDisplayValues().map(r=>{
    const o={}; ADMISSION_DOCS_HEADERS_.forEach((h,i)=>o[h]=r[i]); return o;
  });
}
function admissionDocStudent_(u, studentId) {
  const id = u.Role === 'student' ? u.StudentID : String(studentId || '');
  if (!id) throw new Error('Student record not found.');
  const hit = findRow_('S','StudentID',id), student = hit && hit.o;
  if (!student) throw new Error('Student record not found.');
  if (u.Role === 'student' && student.StudentID !== u.StudentID) throw new Error('Not allowed.');
  if (u.Role === 'admin') assertStudentScope_(studentSearchScope_(u),student);
  return student;
}
function admissionDocSafeMeta_(r) {
  return {
    documentId:r.DocumentID, studentId:r.StudentID, requirementKey:r.RequirementKey,
    requirementLabel:r.RequirementLabel, fileName:r.FileName, mimeType:r.MimeType,
    status:r.Status, uploadedAt:r.UploadedAt, uploadedBy:r.UploadedBy,
    reviewedAt:r.ReviewedAt, reviewedBy:r.ReviewedBy, reviewRemarks:r.ReviewRemarks,
    fileUrl:'https://drive.google.com/open?id='+encodeURIComponent(r.DriveFileID)
  };
}

/** Applicant uploads one requirement. dataUrl is a browser-generated data URL, max 8 MiB. */
function uploadAdmissionDocument(token, requirementKey, fileName, mimeType, dataUrl) {
  const lock = LockService.getScriptLock();
  try {
    const u = who_(token);
    if (u.Role !== 'student') throw new Error('Only the applicant can upload documents from this screen.');
    const student = admissionDocStudent_(u,u.StudentID);
    const key = String(requirementKey || '');
    if (!Object.prototype.hasOwnProperty.call(ADMISSION_DOC_TYPES_,key)) throw new Error('Invalid admission requirement.');
    const applicable = reqsFor_(student).show;
    if (!applicable.includes(key)) throw new Error('This requirement does not apply to your current grade level or scholarship category.');
    const name = String(fileName || 'document').replace(/[\\/\\:*?"<>|\\x00-\\x1F]/g,'_').slice(0,120);
    const mime = String(mimeType || '').toLowerCase();
    if (!ADMISSION_DOC_MIMES_.includes(mime)) throw new Error('Upload a PDF, JPG, JPEG, or PNG file.');
    const match = /^data:([a-z0-9.+-]+\\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i.exec(String(dataUrl || ''));
    if (!match || match[1].toLowerCase() !== mime) throw new Error('The uploaded file data is invalid.');
    const bytes = Utilities.base64Decode(match[2]);
    if (!bytes.length || bytes.length > ADMISSION_DOC_MAX_BYTES_) throw new Error('Each file must be smaller than 8 MB.');
    if (mime==='application/pdf' && !(bytes[0]===37 && bytes[1]===80 && bytes[2]===68 && bytes[3]===70)) throw new Error('The PDF file signature is invalid.');
    if (mime==='image/jpeg' && !((bytes[0]&255)===255 && (bytes[1]&255)===216)) throw new Error('The JPEG file signature is invalid.');
    if (mime==='image/png' && !(bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71)) throw new Error('The PNG file signature is invalid.');
    if (!lock.tryLock(15000)) throw new Error('The service is busy. Please try again.');
    const now = Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss');
    const blob = Utilities.newBlob(bytes,mime,name);
    const file = admissionDocsFolder_().createFile(blob);
    file.setDescription('Applicant: '+student.StudentID+' | Requirement: '+key+' | Uploaded: '+now);
    const id = Utilities.getUuid();
    const row = [id,student.StudentID,key,ADMISSION_DOC_TYPES_[key],name,mime,file.getId(),'Pending',now,u.Username,'','',''];
    const sh = admissionDocsSheet_();
    sh.getRange(sh.getLastRow()+1,1,1,row.length).setNumberFormat('@').setValues([row]);
    audit_(u,'admission.document.upload',student.StudentID,key+' / '+name);
    return {success:true,message:'Document uploaded for review.',data:{documentId:id,status:'Pending',fileName:name}};
  } catch(e) { return fail(e); }
  finally { try { lock.releaseLock(); } catch(_) {} }
}

/** Applicant: list only their own document submissions and the requirements that apply. */
function getMyAdmissionDocuments(token) {
  try {
    const u = who_(token);
    if (u.Role !== 'student') throw new Error('Applicant account required.');
    const student = admissionDocStudent_(u,u.StudentID);
    const docs = admissionDocRows_().filter(r=>r.StudentID===student.StudentID).map(admissionDocSafeMeta_);
    return ok({studentId:student.StudentID,studentName:student.FullName,requirements:reqsFor_(student).show.map(k=>({key:k,label:ADMISSION_DOC_TYPES_[k]})),documents:docs});
  } catch(e) { return fail(e); }
}

/** Staff: search uploaded files. Staff access is limited by the existing Encoder grade/section scope. */
function searchAdmissionDocuments(token, query, status) {
  try {
    const u = who_(token,'admin');
    const scope = studentSearchScope_(u);
    const q = String(query || '').trim().toLowerCase();
    const st = String(status || '').trim();
    if (st && !['Pending','Verified','Rejected'].includes(st)) throw new Error('Invalid document status filter.');
    const students = rows_('S').filter(s=>studentWithinSearchScope_(scope,s));
    const byId = {}; students.forEach(s=>byId[s.StudentID]=s);
    const out = admissionDocRows_().filter(r=>byId[r.StudentID] && (!st || r.Status===st) &&
      (!q || [r.StudentID,r.FileName,r.RequirementLabel,byId[r.StudentID].FullName].join(' ').toLowerCase().includes(q)))
      .sort((a,b)=>String(b.UploadedAt).localeCompare(String(a.UploadedAt)))
      .slice(0,300).map(r=>Object.assign(admissionDocSafeMeta_(r),{studentName:byId[r.StudentID].FullName,grade:byId[r.StudentID].GradeLevel,section:byId[r.StudentID].Section}));
    return ok(out);
  } catch(e) { return fail(e); }
}

/** Staff marks a submission verified or rejected. Rejections require a useful reason. */
function reviewAdmissionDocument(token, documentId, decision, remarks) {
  const lock = LockService.getScriptLock();
  try {
    const u = who_(token,'admin');
    const action = String(decision || '');
    if (!['Verified','Rejected'].includes(action)) throw new Error('Choose Verified or Rejected.');
    const note = String(remarks || '').trim().slice(0,500);
    if (action==='Rejected' && note.length<5) throw new Error('Add a reason of at least five characters when rejecting a document.');
    if (!lock.tryLock(15000)) throw new Error('The service is busy. Please try again.');
    const sh = admissionDocsSheet_(), rows = admissionDocRows_(), i = rows.findIndex(r=>r.DocumentID===String(documentId || ''));
    if (i<0) throw new Error('Document not found.');
    const student = admissionDocStudent_(u,rows[i].StudentID);
    const now = Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss');
    const values = [action==='Verified'?'Verified':'Rejected',now,u.Username,note];
    sh.getRange(i+2,8,1,4).setNumberFormat('@').setValues([values]);
    audit_(u,'admission.document.review',rows[i].StudentID,rows[i].RequirementKey+' / '+action);
    const email = String(student.Email || '').trim();
    if (email && EMAIL_RE.test(email)) {
      try { MailApp.sendEmail({to:email,name:'Moreh Academy Admissions',subject:'Moreh Academy: admission document '+action.toLowerCase(),
        body:'Your '+rows[i].RequirementLabel+' submission has been marked '+action.toUpperCase()+'.'+(note?'\\n\\nRegistrar remarks: '+note:'')+'\\n\\nSign in to your Moreh Academy portal to view the updated status.'}); } catch(_) {}
    }
    return ok({documentId:String(documentId),status:action},'Document '+action.toLowerCase()+'.');
  } catch(e) { return fail(e); }
  finally { try { lock.releaseLock(); } catch(_) {} }
}

/** Staff-only document URL lookup rechecks the student scope before returning the Drive URL. */
function getAdmissionDocumentUrl(token, documentId) {
  try {
    const u = who_(token,'admin'), r = admissionDocRows_().find(x=>x.DocumentID===String(documentId || ''));
    if (!r) throw new Error('Document not found.');
    admissionDocStudent_(u,r.StudentID);
    const file = DriveApp.getFileById(r.DriveFileID);
    if (file.isTrashed()) throw new Error('Document file is unavailable.');
    return ok({url:file.getUrl(),fileName:r.FileName});
  } catch(e) { return fail(e); }
}

/** Returns the role-specific initial view without exposing another learner's data. */
function getAdmissionDocumentsHome(token) {
  try {
    const u = who_(token);
    if (u.Role==='student') {
      const r = getMyAdmissionDocuments(token);
      if (!r.success) throw new Error(r.error);
      return ok({role:'student',data:r.data,userName:u.FullName});
    }
    if (u.Role==='admin') {
      studentSearchScope_(u);
      return ok({role:'admin',userName:u.FullName});
    }
    throw new Error('Not allowed.');
  } catch(e) { return fail(e); }
}

/** Authenticated, scope-checked download. Returns only the selected file as a data URL. */
function getAdmissionDocumentData(token, documentId) {
  try {
    const u = who_(token,'admin');
    const r = admissionDocRows_().find(x=>x.DocumentID===String(documentId || ''));
    if (!r) throw new Error('Document not found.');
    admissionDocStudent_(u,r.StudentID);
    const file = DriveApp.getFileById(r.DriveFileID);
    if (file.isTrashed()) throw new Error('Document file is unavailable.');
    const blob = file.getBlob(), bytes = blob.getBytes();
    if (bytes.length>ADMISSION_DOC_MAX_BYTES_) throw new Error('The document exceeds the permitted download size.');
    return ok({fileName:r.FileName,mimeType:r.MimeType,dataUrl:'data:'+r.MimeType+';base64,'+Utilities.base64Encode(bytes)});
  } catch(e) { return fail(e); }
}
