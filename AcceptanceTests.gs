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


  record('M3-02', 'Logo selection requires direct membership in the configured approved branding folder', () => {
    const fakeFile = ids => ({
      getParents:() => {
        let index = 0;
        return {
          hasNext:() => index < ids.length,
          next:() => ({ getId:() => ids[index++] })
        };
      }
    });
    assert(logoIsInApprovedFolder_(fakeFile(['parent-a','approved-folder']), 'approved-folder'),
      'A file directly in the approved folder was rejected.');
    assert(!logoIsInApprovedFolder_(fakeFile(['parent-a']), 'approved-folder'),
      'A file outside the approved folder was accepted.');
    assert(!logoIsInApprovedFolder_(fakeFile(['approved-folder']), ''),
      'A file was accepted without a configured approved folder.');
    assert(!logoIsInApprovedFolder_(null, 'approved-folder'),
      'A missing Drive file object was accepted.');
    return 'Approved-folder membership required; missing configuration and outside files fail closed.';
  });

  record('M3-04', 'Logo selection rejects files shared publicly', () => {
    const fakeFile = access => ({ getSharingAccess:() => access });
    assert(logoFileIsPrivate_(fakeFile(DriveApp.Access.PRIVATE)), 'Private logo file was rejected.');
    assert(logoFileIsPrivate_(fakeFile(DriveApp.Access.DOMAIN)), 'Domain-restricted logo file was rejected.');
    assert(!logoFileIsPrivate_(fakeFile(DriveApp.Access.ANYONE)), 'Publicly shared logo file was accepted.');
    assert(!logoFileIsPrivate_(fakeFile(DriveApp.Access.ANYONE_WITH_LINK)), 'Anyone-with-link logo file was accepted.');
    assert(!logoFileIsPrivate_(null), 'Missing logo file was accepted.');
    return 'Private and domain-restricted files accepted; public and anyone-with-link files rejected.';
  });

  record('M3-03', 'Logo MIME validation is consistent between upload and public retrieval', () => {
    ['image/png','image/jpeg','image/webp','image/gif'].forEach(mime =>
      assert(logoMimeAllowed_(mime), 'Supported logo MIME type was rejected: ' + mime));
    ['image/svg+xml','image/bmp','text/html','application/octet-stream',''].forEach(mime =>
      assert(!logoMimeAllowed_(mime), 'Unsupported logo MIME type was accepted: ' + mime));
    assert(logoMimeAllowed_('IMAGE/GIF'), 'MIME validation should normalize case.');
    return 'PNG, JPEG, WebP and GIF are accepted consistently; SVG and non-image types are rejected.';
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

  record('M4-03', 'Account-scoped property keys reject colliding staff usernames', () => {
    assert(accountPropertyKeySuffix_('desk@moreh') === accountPropertyKeySuffix_('desk_moreh'),
      'Test fixture no longer represents a legacy key collision.');
    const collisions = accountPropertyKeyCollisions_('desk@moreh', ['desk@moreh', 'desk_moreh', 'another.encoder']);
    assert(collisions.length === 1 && collisions[0] === 'desk_moreh',
      'A colliding username was not detected.');
    assert(accountPropertyKeyCollisions_('encoder.one', ['encoder.one', 'encoder-two']).length === 0,
      'Distinct non-colliding usernames were incorrectly rejected.');
    const duplicateCase = accountPropertyKeyCollisions_('desk@moreh', ['desk@moreh', 'DESK@MOREH']);
    assert(duplicateCase.length === 1 && duplicateCase[0] === 'desk@moreh',
      'Duplicate usernames differing only by case were not detected.');

    const originalRows = rows_;
    try {
      rows_ = function(key) {
        if (key === 'U') return [
          { Username:'desk@moreh', Role:'Admin' },
          { Username:'desk_moreh', Role:'Admin' }
        ];
        return originalRows(key);
      };

      let encoderRejected = false;
      try {
        studentSearchScope_({ Clearance:'Encoder', Username:'desk@moreh' });
      } catch (error) {
        encoderRejected = /property key/.test(String(error && error.message || error));
      }
      assert(encoderRejected, 'Encoder scope reader did not fail closed for colliding staff usernames.');

      let websiteRejected = false;
      try {
        wpPermissionMap_('desk@moreh');
      } catch (error) {
        websiteRejected = /property key/.test(String(error && error.message || error));
      }
      assert(websiteRejected, 'Website permission reader did not fail closed for colliding staff usernames.');
    } finally {
      rows_ = originalRows;
    }

    return 'Distinct colliding usernames are detected, and both live property readers reject the collision before reading shared Script Properties.';
  });

  record('M6-02', 'Report history detail accepts only non-identifying grade and level descriptors', () => {
    const grade = GRADES[0];
    const level = GROUPS[0];
    assert(!!grade && !!level, 'Canonical grade and level fixtures are required.');
    assert(rpDetail_(level) === level, 'A recognized report level should remain available.');
    const validSection = (SEC[grade] || [])[0] || [].concat.apply([], Object.keys(SEC).filter(key => key.indexOf(grade + '|') === 0).map(key => SEC[key]))[0];
    assert(!!validSection, 'A canonical section fixture is required.');
    assert(rpDetail_({ grade:grade, section:validSection }) === grade + ' / ' + validSection, 'A valid grade/section descriptor was rejected.');
    assert(rpDetail_({ grade:grade, section:'*' }) === grade + ' / All sections', 'The all-sections descriptor was rejected.');
    assert(rpDetail_({ grade:grade, section:'(none)' }) === grade + ' / Unassigned', 'The unassigned descriptor was rejected.');
    [ 'STU-2026-0001', 'student@example.com', 'Juan Dela Cruz', { grade:'Juan Dela Cruz', section:'A' },
      { grade:grade, section:'NOT-A-REAL-SECTION' }, ['Grade 1','A'] ].forEach(value =>
      assert(rpDetail_(value) === '', 'Potentially identifying report detail was retained.'));
    return 'Only canonical grade/level and bounded section labels survive; IDs, emails, names and arbitrary payloads are discarded.';
  });

  record('M7-01', 'Website publishing cutover remains disabled until acceptance gates close', () => {
    assert(WP_PUBLISH_CUTOVER_READY_ === false, 'Publishing cutover must remain disabled.');
    wpAssertLegacyWriterOpen_();
    return 'Legacy live writers remain available only in the pre-cutover state; publish and rollback remain gated.';
  });

  record('M4-04', 'Student account reset enforces Encoder scope before reading user accounts', () => {
    const originals = {
      who:who_, guard:assertAdminConsoleRole_, scope:studentSearchScope_, find:findStudent_, rows:rows_
    };
    let userRowsRead = false, roleGuardCalled = false, scopeResolverCalled = false;
    try {
      who_ = (token, requiredRole) => {
        assert(token === 'acceptance-token' && requiredRole === 'admin', 'Unexpected authentication arguments.');
        return { Role:'admin', Clearance:'Encoder', Username:'acceptance-encoder' };
      };
      assertAdminConsoleRole_ = user => {
        roleGuardCalled = true;
        return user;
      };
      studentSearchScope_ = user => {
        scopeResolverCalled = true;
        assert(user && user.Username === 'acceptance-encoder', 'Scope resolver received the wrong account.');
        return { grades:['Grade 1'], sections:{ 'Grade 1':['A'] } };
      };
      findStudent_ = id => ({ r:2, o:{ StudentID:id, GradeLevel:'Grade 2', Section:'B' } });
      rows_ = key => { if (key === 'U') userRowsRead = true; return []; };
      const result = resetStudentAccount('acceptance-token', 'OUT-OF-SCOPE');
      assert(result && result.success === false, 'Out-of-scope account reset did not return a denied result.');
      assert(roleGuardCalled, 'The admin-console role guard was not invoked.');
      assert(scopeResolverCalled, 'The Encoder scope resolver was not invoked.');
      assert(/outside your assigned/i.test(String(result.error || '')),
        'The endpoint did not return the real student-scope denial: ' + String(result.error || 'no error returned'));
      assert(!userRowsRead, 'The endpoint read user-account rows before enforcing student scope.');
      return 'Authenticated synthetic Encoder reached the real student-scope guard; the out-of-scope reset was denied before the user-account sheet was read.';
    } finally {
      who_ = originals.who;
      assertAdminConsoleRole_ = originals.guard;
      studentSearchScope_ = originals.scope;
      findStudent_ = originals.find;
      rows_ = originals.rows;
    }
  });

  record('M4-05', 'ID-card endpoints restrict records to TLC scholar categories', () => {
    assertIdCardEligible_({ Category:'TLC' });
    assertIdCardEligible_({ Category:'TLC-OVAP' });
    ['Regular','ALS','',null].forEach(category => {
      let rejected = false;
      try { assertIdCardEligible_({ Category:category }); } catch (e) {
        rejected = /ID cards are for TLC scholars only/.test(String(e && e.message || e));
      }
      assert(rejected, 'Non-TLC category was accepted: ' + category);
    });
    let missingRejected = false;
    try { assertIdCardEligible_(null); } catch (_) { missingRejected = true; }
    assert(missingRejected, 'Missing learner was accepted.');
    return 'TLC and TLC-OVAP accepted; all other and missing categories rejected by the shared endpoint guard.';
  });

  record('M5-01', 'Dashboard endpoints reject unauthenticated direct invocation', () => {
    const calls = [
      ['dashboard', () => dashboard('invalid-acceptance-token')],
      ['dashboardExtra', () => dashboardExtra('invalid-acceptance-token')],
      ['dashboardDemo', () => dashboardDemo('invalid-acceptance-token')]
    ];
    calls.forEach(([name, call]) => {
      let denied = false;
      try { const result = call(); denied = !!result && result.success === false; }
      catch (_) { denied = true; }
      assert(denied, name + ' did not reject an unauthenticated direct call.');
    });
    return calls.length + ' dashboard endpoints rejected an invalid session token.';
  });


  record('M5-02', 'Additional administrative endpoints reject unauthenticated direct invocation', () => {
    const calls = [
      ['getEvents', () => getEvents('invalid-acceptance-token')],
      ['getNotifications', () => getNotifications('invalid-acceptance-token')],
      ['getSettings', () => getSettings('invalid-acceptance-token')],
      ['saveSettings', () => saveSettings('invalid-acceptance-token', {})],
      ['startNextSY', () => startNextSY('invalid-acceptance-token')],
      ['saveEvent', () => saveEvent('invalid-acceptance-token', {})],
      ['clusterAccess', () => clusterAccess('invalid-acceptance-token')],
      ['getCareerResult', () => getCareerResult('invalid-acceptance-token')],
      ['saveCareerResult', () => saveCareerResult('invalid-acceptance-token', {})]
    ];
    calls.forEach(([name, call]) => {
      let denied = false;
      try { const result = call(); denied = !!result && result.success === false; }
      catch (_) { denied = true; }
      assert(denied, name + ' did not reject an unauthenticated direct call.');
    });
    return calls.length + ' administrative, event, and student-career endpoints rejected an invalid session token.';
  });


  record('M5-03', 'Admissions dashboard specification applies Encoder grade and section scope before aggregation', () => {
    const fixtures = [
      { StudentID:'IN-001', FullName:'In Scope Learner', GradeLevel:'Grade 1', Section:'A', SchoolYear:activeSY_(), EnrollStatus:'Enrolled', Classification:'New', Category:'ESC', CreatedAt:'2026-11-14 09:00:00' },
      { StudentID:'OUT-SECTION', FullName:'Other Section Learner', GradeLevel:'Grade 1', Section:'B', SchoolYear:activeSY_(), EnrollStatus:'Enrolled', Classification:'New', Category:'ESC', CreatedAt:'2026-11-14 09:01:00' },
      { StudentID:'OUT-GRADE', FullName:'Other Grade Learner', GradeLevel:'Grade 2', Section:'A', SchoolYear:activeSY_(), EnrollStatus:'Enrolled', Classification:'New', Category:'TLC', CreatedAt:'2026-11-14 09:02:00' },
      { StudentID:'OUT-SHS', FullName:'Senior High Learner', GradeLevel:'Grade 11', Section:'STEM-A', SchoolYear:activeSY_(), EnrollStatus:'Enrolled', Classification:'Old', Category:'PUB-QVR', Cluster:'STEM', CreatedAt:'2026-11-14 09:03:00' }
    ];
    const scope = { grades:['Grade 1'], sections:{ 'Grade 1':['A'] } };
    const originals = {
      who:who_, rows:rows_, studentScope:studentSearchScope_,
      college:dsCollegeLevels_, extra:dashboardExtra,
      activity:getRecentActivity, schoolYears:dsSchoolYears_
    };
    let collegeCalls = 0;
    try {
      who_ = () => ({ Role:'admin', Clearance:'Encoder', Username:'acceptance-encoder' });
      rows_ = key => key === 'S' ? fixtures : originals.rows(key);
      studentSearchScope_ = () => scope;
      dsCollegeLevels_ = () => { collegeCalls++; return [{ label:'Synthetic College', name:'Synthetic College', count:999 }]; };
      dashboardExtra = () => ({ success:true, data:{ attention:{ counts:{ req:0, consent:0, cert:0 }, total:0, rows:[] } } });
      getRecentActivity = () => ({ success:true, data:{ items:[] } });
      dsSchoolYears_ = () => [activeSY_()];

      const result = dashboardSpec('acceptance-encoder-token', {});
      assert(result && result.success && result.data, 'dashboardSpec did not return a successful response for the synthetic Encoder.');
      const data = result.data;
      assert(data.totals.rows === 1 && data.totals.scoped === 1,
        'Dashboard totals included cross-section or cross-grade learners.');
      assert(data.recent.length === 1 && data.recent[0].id === 'IN-001',
        'Recent registrations exposed an out-of-scope learner.');
      assert(data.charts.byScholarship.reduce((sum, item) => sum + item.count, 0) === 1,
        'Scholarship chart aggregated learners outside the Encoder scope.');
      const college = data.levels.find(level => level.key === 'College');
      assert(college && college.total === 0 && college.kids.length === 0 && collegeCalls === 0,
        'College dashboard figures were exposed to an Encoder without a College scope assignment.');
      assert(dsScopeRows_(fixtures, null).length === fixtures.length,
        'Full/Manager unscoped dashboard behavior changed.');
      return 'Authenticated endpoint harness confirms totals, recent registrations and charts include only assigned grade/section rows; College figures are withheld from Encoder; Full/Manager scope helper behavior is preserved.';
    } finally {
      who_ = originals.who;
      rows_ = originals.rows;
      studentSearchScope_ = originals.studentScope;
      dsCollegeLevels_ = originals.college;
      dashboardExtra = originals.extra;
      getRecentActivity = originals.activity;
      dsSchoolYears_ = originals.schoolYears;
    }
  });

  record('M5-04', 'College administration endpoints reject non-Full and non-Manager roles', () => {
    const originalWho = who_;
    const denied = ['Encoder','Guidance','Accounting','HeadTeacher','Teacher'];
    try {
      denied.forEach(clearance => {
        who_ = () => ({ Role:'admin', Clearance:clearance, Username:'acceptance-'+clearance.toLowerCase() });
        let rejected = false;
        try { collegeAdmin_('acceptance-role-token'); } catch (e) {
          rejected = /Not allowed/.test(String(e && e.message || e));
        }
        assert(rejected, clearance + ' unexpectedly received College administration access.');
      });
      ['Full','Manager'].forEach(clearance => {
        who_ = () => ({ Role:'admin', Clearance:clearance, Username:'acceptance-'+clearance.toLowerCase() });
        const actor = collegeAdmin_('acceptance-role-token');
        assert(actor.Clearance === clearance, clearance + ' legacy administrator access was not preserved.');
      });
      return 'Encoder, Guidance, Accounting, HeadTeacher and Teacher denied; Full and Manager accepted by the shared College endpoint guard.';
    } finally {
      who_ = originalWho;
    }
  });

  record('M5-05', 'Admissions dashboard and report role guard excludes office and academic accounts', () => {
    const denied = ['Guidance','Accounting','HeadTeacher','Teacher'];
    denied.forEach(clearance => {
      let rejected = false;
      try { assertAdminConsoleRole_({ Role:'admin', Clearance:clearance }); }
      catch (e) { rejected = /Not allowed/.test(String(e && e.message || e)); }
      assert(rejected, clearance + ' unexpectedly passed the admissions dashboard role guard.');
    });
    ['Full','Manager','Encoder'].forEach(clearance => {
      const actor = assertAdminConsoleRole_({ Role:'admin', Clearance:clearance });
      assert(actor.Clearance === clearance, clearance + ' should retain its existing dashboard access.');
    });
    let nonAdminRejected = false;
    try { assertAdminConsoleRole_({ Role:'student', Clearance:'Student' }); }
    catch (e) { nonAdminRejected = /Not allowed/.test(String(e && e.message || e)); }
    assert(nonAdminRejected, 'A non-admin account passed the admissions dashboard role guard.');
    return 'Guidance, Accounting, HeadTeacher and Teacher denied; Full, Manager and scoped Encoder remain eligible; student account denied.';
  });

  record('M5-06', 'Student-care administrative actions exclude office and Academic accounts', () => {
    ['Guidance','Accounting','Academic','HeadTeacher','Teacher'].forEach(clearance => {
      let rejected = false;
      try { assertAdminConsoleRole_({ Role:'admin', Clearance:clearance }); }
      catch (e) { rejected = /Not allowed/.test(String(e && e.message || e)); }
      assert(rejected, clearance + ' unexpectedly passed the student-care role guard.');
    });
    ['Full','Manager','Encoder'].forEach(clearance => {
      const actor = assertAdminConsoleRole_({ Role:'admin', Clearance:clearance });
      assert(actor.Clearance === clearance, clearance + ' lost intended student-care console eligibility.');
    });
    return 'Office and Academic accounts denied; Full, Manager and Encoder retain the shared admin-console role policy.';
  });

  record('M5-07', 'Encoder sign-in hours do not restrict Manager or office staff', () => {
    assert(staffHoursGateApplies_({ Role:'admin', Clearance:'Encoder' }), 'Encoder hours policy must apply to Encoders.');
    ['Full','Manager','Guidance','Accounting','Academic','HeadTeacher','Teacher'].forEach(clearance =>
      assert(!staffHoursGateApplies_({ Role:'admin', Clearance:clearance }), 'Encoder hours policy unexpectedly applies to ' + clearance + '.'));
    assert(!staffHoursGateApplies_({ Role:'student', Clearance:'Encoder' }), 'Encoder hours policy must not apply to student accounts.');
    return 'Only authenticated admin accounts with Encoder clearance are subject to the 7 AM–6 PM window; Manager and office staff are not time-restricted by this gate.';
  });

  record('M6-01', 'Report endpoints reject unauthenticated direct invocation', () => {
    const calls = [
      ['report', () => report('invalid-acceptance-token', 'daily')],
      ['reportsHome', () => reportsHome('invalid-acceptance-token')],
      ['reportsAnalytics', () => reportsAnalytics('invalid-acceptance-token')],
      ['reportsDrill', () => reportsDrill('invalid-acceptance-token')],
      ['reportLog', () => reportLog('invalid-acceptance-token', 'daily', 'Preview')],
      ['reportsPrefs', () => reportsPrefs('invalid-acceptance-token')],
      ['saveFavorites', () => saveFavorites('invalid-acceptance-token', [])],
      ['saveReportConfig', () => saveReportConfig('invalid-acceptance-token', {})],
      ['deleteReportConfig', () => deleteReportConfig('invalid-acceptance-token', 'acceptance-invalid-id')],
      ['reportHistory', () => reportHistory('invalid-acceptance-token')]
    ];
    calls.forEach(([name, call]) => {
      let denied = false;
      try { const result = call(); denied = !!result && result.success === false; }
      catch (_) { denied = true; }
      assert(denied, name + ' did not reject an unauthenticated direct call.');
    });
    return calls.length + ' report endpoints rejected an invalid session token; mutations were denied before data writes.';
  });


  record('M7-02', 'Website payload chunking preserves Unicode and reconstructs the exact source', () => {
    const source = 'ab😀cd🚀ef';
    const chunks = wpSplitChunks_(source, 3);
    assert(chunks.join('') === source, 'Chunk reconstruction changed the original payload.');
    chunks.forEach((chunk, index) => {
      assert(chunk.length <= 3, 'A payload chunk exceeded its configured character limit.');
      for (let i = 0; i < chunk.length; i++) {
        const code = chunk.charCodeAt(i);
        if (code >= 0xD800 && code <= 0xDBFF) {
          assert(i + 1 < chunk.length, 'A high surrogate was split at the end of a chunk.');
          const next = chunk.charCodeAt(i + 1);
          assert(next >= 0xDC00 && next <= 0xDFFF, 'A high surrogate was not followed by its low surrogate.');
          i++;
        } else {
          assert(!(code >= 0xDC00 && code <= 0xDFFF), 'A low surrogate was separated from its high surrogate.');
        }
      }
    });
    return chunks.length + ' chunks preserve emoji pairs and exact payload reconstruction.';
  });

  record('M7-03', 'Published content lookup rejects duplicate keys instead of choosing an ambiguous value', () => {
    const payload = { contentRows:[['pubhome', '<p>First</p>'], ['pubabout', '<p>About</p>']] };
    assert(wpPublicContentValue_(payload, 'pubhome') === '<p>First</p>', 'Unique published content key was not returned.');
    assert(wpPublicContentValue_(payload, 'missing') === '', 'Missing published content key should resolve to an empty string.');
    let duplicateRejected = false;
    try {
      wpPublicContentValue_({ contentRows:[['pubhome', 'one'], ['pubhome', 'two']] }, 'pubhome');
    } catch (e) {
      duplicateRejected = /duplicate key/.test(String(e && e.message || e));
    }
    assert(duplicateRejected, 'Duplicate published content keys were not rejected.');
    return 'Unique and missing keys resolve deterministically; duplicate keys fail closed.';
  });

  record('M7-04', 'Published gallery adapter rejects malformed and duplicate asset references', () => {
    const valid = wpPublicGallery_({ galleries:{ history:[{ id:'Abcdefghijk_123456', cap:'Historic building' }] } }, 'history');
    assert(valid.length === 1 && valid[0].cap === 'Historic building', 'Valid gallery item was not normalized.');
    const absent = wpPublicGallery_({ galleries:{} }, 'history');
    assert(Array.isArray(absent) && absent.length === 0, 'Missing published gallery should resolve to an empty list.');
    let malformedRejected = false;
    try {
      wpPublicGallery_({ galleries:{ history:[{ id:'invalid id', cap:'' }] } }, 'history');
    } catch (e) {
      malformedRejected = /invalid or duplicate asset reference/.test(String(e && e.message || e));
    }
    assert(malformedRejected, 'Malformed gallery asset ID was not rejected.');
    let duplicateRejected = false;
    try {
      wpPublicGallery_({ galleries:{ history:[{ id:'Abcdefghijk_123456', cap:'A' }, { id:'Abcdefghijk_123456', cap:'B' }] } }, 'history');
    } catch (e) {
      duplicateRejected = /invalid or duplicate asset reference/.test(String(e && e.message || e));
    }
    assert(duplicateRejected, 'Duplicate gallery asset ID was not rejected.');
    return 'Valid references are normalized; malformed and duplicate references fail closed.';
  });


  record('M7-05', 'Website draft allowlist covers the complete captured public schema and excludes portal-only keys', () => {
    const defaults = wpSnapshotDefaults_();
    const allowed = wpWebsiteContentAllowlist_(defaults);
    (defaults.publicBlockKeys || []).forEach(key =>
      assert(allowed.has(key), 'Captured public block key was omitted: ' + key));
    Object.keys(defaults.pageBlockKeys || {}).forEach(slug =>
      assert(allowed.has(defaults.pageBlockKeys[slug]), 'Page block key was omitted: ' + slug));
    Object.keys(defaults.sectionCards || {}).forEach(group => {
      const key = defaults.sectionCards[group] && defaults.sectionCards[group].key;
      assert(!!key && allowed.has(key), 'Section-card key was omitted: ' + group);
    });
    ['about_data',PUBLIC_CONTENT_KEY_,PUBLIC_HERO_KEY_,PAGE_INTRO_KEY_,PAGE_BANNERS_KEY_]
      .forEach(key => assert(allowed.has(key), 'Required public settings key was omitted: ' + key));
    ['guide','Users','Sessions','Audit','Students','Settings','StaffCredentials',''].forEach(key =>
      assert(!allowed.has(key), 'Internal or empty key was unexpectedly allowed: ' + key));
    return allowed.size + ' captured public keys allowed; portal-only keys excluded.';
  });

  record('M7-06', 'All configured section-card groups enforce link safety and text limits', () => {
    const groups = Object.keys(SECTION_CARDS_ || {});
    assert(groups.length === 6, 'Expected all six configured section-card groups.');
    groups.forEach(group => {
      const defaults = SECTION_CARDS_[group].defaults;
      assert(Array.isArray(defaults) && defaults.length > 0, group + ' has no configured defaults.');
      const valid = sectionCardsClean_(group, defaults);
      assert(valid.length === defaults.length, group + ' defaults did not pass sanitization.');
      const unsafe = defaults.map((card, index) => index === 0
        ? { title:card.title, text:card.text, link:'javascript:alert(1)' }
        : card);
      let unsafeRejected = false;
      try { sectionCardsClean_(group, unsafe); }
      catch (e) { unsafeRejected = /link must start with https:\/\/ or \?page=/.test(String(e && e.message || e)); }
      assert(unsafeRejected, group + ' accepted an unsafe link.');
      const bounded = sectionCardsClean_(group, defaults.map(card => ({
        title:'T'.repeat(500), text:'X'.repeat(500), link:card.link
      })));
      assert(bounded.every(card => card.title.length <= 90 && card.text.length <= 200),
        group + ' exceeded its configured title or description length.');
    });
    return groups.length + ' section-card groups validated against their defaults, link policy and text limits.';
  });

  record('M7-07', 'Interrupted media recovery is retryable and never privatizes currently published assets', () => {
    const rows = [
      ['asset-staged-0001','staged.jpg','image/jpeg','123','editor@example.test','2026-01-01T00:00:00Z','Staged'],
      ['asset-moving-0002','moving.jpg','image/jpeg','123','editor@example.test','2026-01-01T00:00:00Z','Promoting'],
      ['asset-retry-0003','retry.jpg','image/jpeg','123','editor@example.test','2026-01-01T00:00:00Z','RecoveryRequired'],
      ['asset-live-0004','live.jpg','image/jpeg','123','editor@example.test','2026-01-01T00:00:00Z','RecoveryRequired']
    ];
    const candidates = wpPendingMediaRecovery_(rows, {'asset-live-0004':true});
    assert(candidates.pending.length === 2, 'Expected only the two interrupted, unpublished assets to be recoverable.');
    assert(candidates.pending[0] === 'asset-moving-0002' && candidates.pending[1] === 'asset-retry-0003',
      'Interrupted recovery candidates were not selected deterministically.');
    assert(candidates.conflicts.length === 1 && candidates.conflicts[0].assetId === 'asset-live-0004',
      'An asset referenced by the published version was not isolated as a conflict.');
    const duplicate = wpPendingMediaRecovery_([rows[1], rows[1]], {});
    assert(duplicate.pending.length === 0 && duplicate.conflicts.length === 1,
      'Duplicate media metadata was not blocked from recovery.');
    const mixedStateDuplicate = wpPendingMediaRecovery_([
      rows[1],
      ['asset-moving-0002','duplicate.jpg','image/jpeg','123','editor@example.test','2026-01-01T00:00:00Z','Staged']
    ], {});
    assert(mixedStateDuplicate.pending.length === 0 && mixedStateDuplicate.conflicts.length === 1,
      'Duplicate metadata spanning a recovery and non-recovery state was not blocked.');
    return 'Promoting and RecoveryRequired assets are retry candidates; staged assets are ignored; published references and duplicate metadata—including mixed-state duplicates—are blocked.';
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
