/** MA Admission Portal — environment configuration. No IDs or secrets are committed. */
const MA_CONFIG = Object.freeze({
  applicationName: 'Moreh Academy Admission Portal',
  version: '0.1.0-phase1',
  timezone: 'Asia/Manila',
  databaseProperty: 'MA_DB_SPREADSHEET_ID',
  collegeDatabaseProperty: 'MA_COLLEGE_DB_SPREADSHEET_ID',
  driveRootProperty: 'MA_DRIVE_ROOT_FOLDER_ID',
  driveRootName: 'MA School Admission Portal',
  requiredTabs: Object.freeze([])
});

function getDatabase_() {
  const id = PropertiesService.getScriptProperties().getProperty(MA_CONFIG.databaseProperty);
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('Database is not configured. Set Script Property MA_DB_SPREADSHEET_ID or bind this script to the development spreadsheet.');
}

function getCollegeDatabase_() {
  const id = PropertiesService.getScriptProperties().getProperty(MA_CONFIG.collegeDatabaseProperty);
  if (!id) throw new Error('College database is not configured. Set MA_COLLEGE_DB_SPREADSHEET_ID after the College workbook has been reviewed and approved.');
  return SpreadsheetApp.openById(id);
}

function assertEditorOwner_() {
  const active = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  const effective = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (!active || !effective || active !== effective) {
    throw new Error('This setup operation must be run by the spreadsheet/script owner from the Apps Script editor.');
  }
}

function withScriptLock_(callback, timeoutMs) {
  const lock = LockService.getScriptLock();
  lock.waitLock(timeoutMs || 30000);
  try { return callback(); }
  finally { lock.releaseLock(); }
}
