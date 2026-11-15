/** Private Drive foundation. Applicant requirement uploads are intentionally not supported. */
function getDriveRoot_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(MA_CONFIG.driveRootProperty);
  if (id) {
    try { return DriveApp.getFolderById(id); }
    catch (e) { throw new Error('Configured Drive root folder is inaccessible. Check MA_DRIVE_ROOT_FOLDER_ID.'); }
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
    const created = [];
    names.forEach(name => {
      const folder = ensureChildFolder_(root,name);
      created.push({name:name,id:folder.getId()});
    });
    return {success:true,rootFolderId:root.getId(),folders:created};
  });
}

function getAcademicYearFolder_(schoolYearName) {
  const root = getDriveRoot_();
  const years = ensureChildFolder_(root,'01 - Academic Years');
  return ensureChildFolder_(years,String(schoolYearName).replace(/[^0-9-]/g,''));
}
