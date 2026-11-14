/**
 * Non-destructive security acceptance checks for the Moreh Academy development copy.
 *
 * Run runSecurityAcceptanceTests() from the Apps Script editor while signed in as
 * the script owner. The suite never reads or writes student rows, does not invoke
 * backup/retention work, and restores the one synthetic Script Property it uses.
 * It is not a substitute for role-by-role endpoint tests with real test accounts.
 */
function runSecurityAcceptanceTests() {
  const results = [];
  const record = (id, name, fn) => {
    try {
      const detail = fn();
      results.push({ id:id, name:name, passed:true, detail:detail || '' });
    } catch (e) {
      results.push({ id:id, name:name, passed:false, detail:String(e && e.message || e) });
    }
  };
  const assert = (condition, message) => {
    if (!condition) throw new Error(message || 'Assertion failed.');
  };

  record('M1-01', 'Student self-edit allow-list accepts intended contact fields', () => {
    assert(stuCan_([null, 'AddressLine1']), 'AddressLine1 should be editable.');
    assert(stuCan_([null, 'FatherMobile']), 'FatherMobile should be editable.');
    return 'Two representative permitted fields accepted.';
  });

  record('M1-02', 'Student self-edit allow-list rejects protected identity and school fields', () => {
    const forbidden = [
      'StudentID','LRN','GradeLevel','Section','Category','Classification',
      'EnrollStatus','SchoolYear','ReqBirthCert','ReqReportCard','ReqGoodMoral',
      'CertNo','VoucherCertNo','ProcessedBy','ProcessedDate','CreatedAt','UpdatedAt'
    ];
    forbidden.forEach(key => assert(!stuCan_([null, key]), 'Protected field unexpectedly editable: ' + key));
    return forbidden.length + ' protected field names rejected.';
  });

  record('M2-01', 'Daily backup rejects direct invocation without installed trigger UID', () => {
    let rejected = false;
    try { dailyBackup({}); } catch (e) {
      rejected = /installed time trigger/.test(String(e && e.message || e));
    }
    assert(rejected, 'dailyBackup did not reject a direct call.');
    return 'Direct call rejected before backup work.';
  });

  record('M2-02', 'Monthly retention rejects direct invocation without installed trigger UID', () => {
    let rejected = false;
    try { monthlyRetention({}); } catch (e) {
      rejected = /installed time trigger/.test(String(e && e.message || e));
    }
    assert(rejected, 'monthlyRetention did not reject a direct call.');
    return 'Direct call rejected before retention work.';
  });

  record('M3-01', 'Logo mutation rejects malformed Drive IDs', () => {
    let rejected = false;
    try { setLogoFile('not-a-drive-id'); } catch (e) {
      rejected = /valid Google Drive file ID/.test(String(e && e.message || e));
    }
    assert(rejected, 'setLogoFile did not reject malformed ID with the expected validation.');
    return 'Malformed ID rejected; no Script Property update occurs.';
  });

  record('M4-01', 'Student scope filters grade and section combinations', () => {
    const scope = { grades:['Grade 1'], sections:{'Grade 1':['A']} };
    assert(studentWithinSearchScope_(scope, { GradeLevel:'Grade 1', Section:'A' }), 'Assigned student was rejected.');
    assert(!studentWithinSearchScope_(scope, { GradeLevel:'Grade 1', Section:'B' }), 'Unassigned section was allowed.');
    assert(!studentWithinSearchScope_(scope, { GradeLevel:'Grade 2', Section:'A' }), 'Unassigned grade was allowed.');
    assert(!studentWithinSearchScope_({ grades:[], sections:{} }, { GradeLevel:'Grade 1', Section:'A' }), 'Empty scope allowed a student.');
    return 'Assigned grade/section accepted; cross-section, cross-grade and empty scopes denied.';
  });

  record('M4-02', 'Encoder scope fails closed for missing, malformed and empty Script Properties', () => {
    const props = PropertiesService.getScriptProperties();
    const username = 'acceptance-test-synthetic-encoder';
    const key = 'STUDENT_SCOPE_' + username;
    const prior = props.getProperty(key);
    const grade = GRADES[0];
    assert(!!grade, 'No canonical grade is available for this test.');
    try {
      props.deleteProperty(key);
      let missingRejected = false;
      try { studentSearchScope_({ Clearance:'Encoder', Username:username }); } catch (e) {
        missingRejected = /not been assigned/.test(String(e && e.message || e));
      }
      assert(missingRejected, 'Missing Encoder scope was not rejected.');

      props.setProperty(key, '{invalid-json');
      let malformedRejected = false;
      try { studentSearchScope_({ Clearance:'Encoder', Username:username }); } catch (e) {
        malformedRejected = /scope is invalid/.test(String(e && e.message || e));
      }
      assert(malformedRejected, 'Malformed Encoder scope was not rejected.');

      props.setProperty(key, JSON.stringify({ grades:[], sections:{} }));
      const empty = studentSearchScope_({ Clearance:'Encoder', Username:username });
      assert(empty.grades.length === 0, 'Empty grade assignment did not remain empty.');
      assert(!studentWithinSearchScope_(empty, { GradeLevel:grade, Section:'' }), 'Empty Encoder scope granted a student.');
      return 'Missing and malformed assignments throw; empty assignment grants no records.';
    } finally {
      if (prior === null) props.deleteProperty(key);
      else props.setProperty(key, prior);
    }
  });

  const passed = results.filter(x => x.passed).length;
  const failed = results.length - passed;
  const report = {
    suite:'Moreh Academy security acceptance checks',
    executedAt:new Date().toISOString(),
    environment:'Run only in a non-production development copy',
    passed:passed,
    failed:failed,
    total:results.length,
    results:results,
    remainingManualEvidence:[
      'M3: confirm approved branding folder membership and test valid logo content/cache invalidation.',
      'M4: exercise every scoped endpoint with real Encoder accounts and mixed in/out-of-scope IDs.',
      'M5: run the role-by-role dashboard, direct-call, helper-endpoint and field-minimization matrix.',
      'M6: run every report, drill-down, export and history endpoint for every role.',
      'M7: complete editor/public-reader/media cutover and draft/review/publish/rollback browser acceptance.'
    ]
  };
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
