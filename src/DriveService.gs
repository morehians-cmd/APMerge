/** Private Drive foundation. Applicant requirement uploads are intentionally not supported. */
function getDriveRoot_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(MA_CONFIG.driveRootProperty);
  if (id) {
    try {
      const folder = DriveApp.getFolderById(id);
      const access = folder.getSharingAccess();
      if (access === DriveApp.Access.ANYONE || access === DriveApp.Access.ANYONE_WITH_LINK) {
        throw new Error('The configured Drive root is publicly shared. Remove public sharing before continuing.');
      }
      return folder;
    } catch (e) {
      if (String(e.message || e).indexOf('publicly shared') >= 0) throw e;
      throw new Error('Configured Drive root folder is inaccessible. Check MA_DRIVE_ROOT_FOLDER_ID.');
    }
  }
  const folder = DriveApp.createFolder(MA_CONFIG.driveRootName + ' (DEVELOPMENT)');
  props.setProperty(MA_CONFIG.driveRootProperty, folder.getId());
  return folder;
}

function ensureChildFolder_(parent, name) {
  const matches = parent.getFoldersByName(name);
  return matches.hasNext() ? matches.next() : parent.createFolder(name);
}

function initializeDriveFoundation() {
  assertEditorOwner_();
  return withScriptLock_(() => {
    const root = getDriveRoot_();
    const names = ['01 - Academic Years','02 - Student Profile Photos','03 - Generated Admission Forms','04 - Enrollment Documents','05 - System Backups','06 - Archived Applications'];
    const folders = [];
    names.forEach(name => {
      const folder = ensureChildFolder_(root,name);
      folders.push({name:name,id:folder.getId()});
    });
    return {success:true,rootFolderId:root.getId(),folders:folders};
  });
}

function safeFolderName_(value) {
  const name=String(value || '').trim().replace(/[\\/:*?"<>|#%{}~&]/g,'-').replace(/\s+/g,' ');
  if (!name) throw new Error('A folder name is required.');
  return name.slice(0,100);
}

function getAcademicYearFolder_(schoolYearName) {
  const root = getDriveRoot_();
  const years = ensureChildFolder_(root,'01 - Academic Years');
  return ensureChildFolder_(years,safeFolderName_(schoolYearName));
}

/** Per-applicant folder for generated forms and approved profile images only. */
function getApplicantDriveFolder_(schoolYearName, department, gradeLevel, applicantId) {
  [schoolYearName,department,gradeLevel,applicantId].forEach(v => {
    if (!String(v || '').trim()) throw new Error('Academic year, department, grade level and ApplicantID are required.');
  });
  return withScriptLock_(() => {
    const year=getAcademicYearFolder_(schoolYearName);
    const dept=ensureChildFolder_(year,safeFolderName_(department));
    const grade=ensureChildFolder_(dept,safeFolderName_(gradeLevel));
    const applicant=ensureChildFolder_(grade,safeFolderName_(applicantId));
    ensureChildFolder_(applicant,'01 - Generated Forms');
    ensureChildFolder_(applicant,'02 - Approved Profile Photo');
    return {folderId:applicant.getId(),url:applicant.getUrl()};
  });
}
