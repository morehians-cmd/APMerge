/** Minimal database connection and first-stage table definitions. */
const INITIAL_TABLES = Object.freeze({
  System_Settings: ['SettingKey', 'SettingValue', 'Description', 'UpdatedAt'],
  Academic_Years: ['SchoolYearID', 'SchoolYearName', 'StartDate', 'EndDate', 'IsCurrent', 'IsAdmissionOpen', 'IsActive'],
  Grade_Levels: ['GradeLevelID', 'GradeLevelName', 'Department', 'GradeOrder', 'IsActive'],
  Applicants: ['ApplicantID', 'SchoolYearID', 'ApplicantType', 'Surname', 'FirstName', 'MiddleName', 'BirthDate', 'LRN', 'GradeLevelID', 'ApplicationStatus', 'CreatedAt', 'UpdatedAt'],
  Requirements: ['RequirementRecordID', 'ApplicantID', 'RequirementCode', 'SubmissionStatus', 'DocumentCondition', 'DateSubmitted', 'VerifiedBy', 'VerifiedAt', 'Remarks'],
  Logs: ['LogID', 'EventAt', 'Actor', 'Action', 'EntityType', 'EntityID', 'Details']
});

function getDatabase_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('This development Apps Script must be bound to the new development spreadsheet.');
  }
  return ss;
}
