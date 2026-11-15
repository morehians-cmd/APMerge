/** Versioned, additive schema. Existing data is never cleared or reordered. */
const MA_SCHEMA_VERSION = '1.0.0';

const MA_SCHEMA = Object.freeze({
  Users: ['UserID','Username','PasswordHash','Role','FullName','Designation','Department','Clearance','Email','StudentID','PhotoFileID','MustChangePassword','IsLocked','IsDisabled','AfterHoursUntil','CreatedAt','UpdatedAt','LastLoginAt','SessionVersion'],
  Applicants: ['ApplicantID','StudentID','LRN','SchoolYearID','ApplicantType','Surname','FirstName','MiddleName','Suffix','FullName','BirthDate','BirthPlace','Age','LegalSex','GenderIdentity','Religion','ReligionOther','Mobile','Email','FacebookURL','AddressLine1','AddressLine2','Barangay','City','Province','GradeLevelID','Department','StrandID','ScholarshipCategoryID','ReferredBy','PreviousSchoolID','PreviousSchoolName','PreviousSchoolAddress','PreviousSchoolYear','PreviousGradeLevelID','PreviousStrandID','PreviousSection','PreviousAdviser','PreviousScholarship','ApplicationStatus','EnrollmentStatus','ConsentAt','SubmittedAt','CreatedAt','CreatedBy','UpdatedAt','UpdatedBy','ProcessedBy','ProcessedAt','StatusChangedAt','CancellationDate','CancellationReason','CancellationReasonOther','DestinationSchool','DestinationAddress','DestinationSchoolType','DestinationGradeProgram','TemporaryEnrollmentUntil','TemporaryEnrollmentBy','StudentIDCardNumber','IDPhotoFileID'],
  Applicant_Family: ['FamilyRecordID','ApplicantID','RelationshipType','FullName','Status','Occupation','Education','Mobile','Email','Religion','ReligionOther','CreatedAt','UpdatedAt'],
  Applicant_Guardians: ['GuardianID','ApplicantID','FullName','Relationship','Email','Mobile','Address','IsPrimary','CreatedAt','UpdatedAt'],
  Applicant_EmergencyContacts: ['EmergencyContactID','ApplicantID','FullName','Relationship','Mobile','SameAddress','Address','CreatedAt','UpdatedAt'],
  RequirementCatalog: ['RequirementCode','RequirementName','Description','Department','GradeLevelID','IsMandatory','ApplicableApplicantType','ApplicableScholarship','DisplayOrder','IsActive'],
  Requirements: ['RequirementRecordID','ApplicantID','RequirementCode','RequirementName','IsRequired','SubmissionStatus','DocumentCondition','DateSubmitted','VerifiedBy','VerifiedAt','Remarks','CreatedAt','UpdatedAt'],
  Sections_Assignments: ['AssignmentID','SchoolYearID','GradeLevelID','StrandID','SectionName','AdviserUserID','Capacity','IsActive','CreatedAt','CreatedBy','UpdatedAt','UpdatedBy'],
  Applicant_Enrollments: ['EnrollmentID','ApplicantID','SchoolYearID','GradeLevelID','StrandID','SectionAssignmentID','EnrollmentStatus','EnrollmentDate','AssignedBy','Remarks','CreatedAt','UpdatedAt'],
  Logs: ['LogID','EventAt','ActorUserID','ActorUsername','ActorRole','Action','EntityType','EntityID','PreviousValueJSON','NewValueJSON','Reason','RequestID'],
  Status_History: ['HistoryID','ApplicantID','PreviousStatus','NewStatus','ChangedBy','ChangedAt','Reason','Remarks'],
  Academic_Years: ['SchoolYearID','SchoolYearName','StartDate','EndDate','IsCurrent','IsAdmissionOpen','IsActive','CreatedAt','UpdatedAt'],
  Grade_Levels: ['GradeLevelID','GradeLevelName','Department','GradeOrder','IsActive'],
  Strands: ['StrandID','StrandCode','StrandName','IsActive'],
  Scholarship_Categories: ['ScholarshipCategoryID','CategoryCode','CategoryName','Description','IsActive'],
  Settings: ['SettingKey','SettingValue','Description','UpdatedAt','UpdatedBy'],
  Permission_Catalog: ['PermissionKey','PermissionName','Description','Module','IsActive'],
  Role_Permissions: ['RolePermissionID','Role','PermissionKey','IsAllowed','UpdatedAt','UpdatedBy'],
  User_Permission_Overrides: ['OverrideID','UserID','PermissionKey','Decision','Reason','GrantedBy','CreatedAt','UpdatedAt'],
});

/** Separate workbook schema: never mix College rows into the K–12 admission database. */
const MA_COLLEGE_SCHEMA = Object.freeze({
  College_Programs: ['ProgramID','ProgramCode','ProgramName','Department','NominalYears','IsActive','CreatedAt','UpdatedAt'],
  College_Students: ['CollegeStudentID','StudentNumber','RegistrationNumber','Surname','FirstName','MiddleName','FullName','BirthDate','LegalSex','ContactNumber','Email','Address','PhotoFileID','ProgramID','Major','CreatedAt','UpdatedAt'],
  College_Enrollments: ['CollegeEnrollmentID','CollegeStudentID','AcademicYearID','Term','YearLevel','Section','Room','FacultyUserID','EnrollmentStatus','RegisteredAt','CreatedAt','UpdatedAt'],
  College_Subjects: ['SubjectID','SubjectCode','SubjectTitle','Units','ProgramID','YearLevel','Term','IsActive'],
  College_Fees: ['FeeID','FeeCode','FeeName','Amount','AcademicYearID','Term','ProgramID','IsActive'],
  College_ProgramFees: ['ProgramFeeID','ProgramID','FeeID','Amount','AcademicYearID','Term'],
  College_Lists: ['ListType','ListCode','ListLabel','SortOrder','IsActive']
});

const MA_REFERENCE_DATA = Object.freeze({
  Grade_Levels: [
    ['GL-PRE-NUR','Nursery','Preschool',1,true],['GL-PRE-K1','Kinder 1','Preschool',2,true],['GL-PRE-K2','Kinder 2','Elementary',3,true],
    ...Array.from({length:6},(_,i)=>['GL-ELEM-'+(i+1),'Grade '+(i+1),'Elementary',i+4,true]),
    ...Array.from({length:4},(_,i)=>['GL-JHS-'+(i+7),'Grade '+(i+7),'Junior High School',i+10,true]),
    ['GL-SHS-11','Grade 11','Senior High School',14,true],['GL-SHS-12','Grade 12','Senior High School',15,true]
  ],
  Strands: [
    ['STR-STEM','STEM','Science, Technology, Engineering, and Mathematics',true],
    ['STR-ASSH','ASSH','Arts, Social Sciences, and Humanities',true],
    ['STR-BE','BE','Business and Entrepreneurship',true],
    ['STR-ICT','ICT','ICT Support and Computer Programming Technologies',true],
    ['STR-HT','HT','Hospitality and Tourism',true]
  ],
  Scholarship_Categories: [
    ['SCH-PUB-QVR','PUB-QVR','Public Qualified Voucher Recipient','',true],
    ['SCH-TLC','TLC','Tulong-Lingap sa mga Kabataan','',true],
    ['SCH-REGULAR','REGULAR','Regular','',true],
    ['SCH-ESC','ESC','Education Service Contracting','',true],
    ['SCH-TLC-OVAP','TLC-OVAP','TLC / OVAP','',true],
    ['SCH-QVA','QVA PASSER','QVA Passer','',true],
    ['SCH-IS','IS','Institutional Scholarship','',true]
  ]
});
