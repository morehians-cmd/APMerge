# Moreh Academy Security Acceptance Runbook

**Target branch:** `website-pages-fixes`  
**Execution target:** Disposable, non-production copy of the bound Apps Script project and its development spreadsheet/Drive folders.  
**Production rule:** Do not run this suite against production, migrate accounts, change live triggers, or deploy without explicit approval.

## 1. Preparation and evidence

1. Record the branch commit, Apps Script project ID, deployment/version, spreadsheet ID, and execution timezone.
2. Make a disposable copy of the development spreadsheet and the required Drive folders. Use synthetic student/staff records only.
3. Synchronize the branch source into that copy. Confirm there are no duplicate Apps Script editor-visible basenames.
4. Create test accounts for Full, Manager, Encoder (assigned), Encoder (unassigned), Guidance, Accounting, HeadTeacher, Teacher, and Student. Give the Student account a single synthetic StudentID.
5. Record each account's exact Role, Clearance, grade/section scope, and expected permissions. Do not copy password hashes or production secrets into evidence.
6. Run `runSecurityAcceptanceTests()` from the Apps Script editor as the script owner. Save the returned JSON and execution log. The suite temporarily sets and restores only the synthetic property `STUDENT_SCOPE_acceptance-test-synthetic-encoder`; it does not read or write student rows or run maintenance jobs.
7. Mark a test PASS only when the expected behavior is observed in the Apps Script execution result or browser. Source inspection alone is not execution evidence.

## 2. Mandatory remediation test cases

### M1 — Student self-edit allow-list

| Test | Account / action | Expected result |
|---|---|---|
| M1.1 | Student changes AddressLine1, Mobile, Email and guardian contact fields | Allowed fields save successfully |
| M1.2 | Student submits StudentID, LRN, GradeLevel, Section, Category, Classification or SchoolYear changes | Request rejected or protected fields ignored; stored values unchanged |
| M1.3 | Student submits EnrollStatus and every Req* requirement field | Stored values unchanged |
| M1.4 | Student submits certificate numbers, processing/audit fields, staff-only fields and unknown keys | Stored values unchanged |
| M1.5 | Student requests another StudentID through getStudent | Response contains only the authenticated student's own record |
| M1.6 | Student invokes saveStudent directly rather than through the UI | Same server-side allow-list enforced |

Capture before/after values for each protected field. A successful response that silently ignores protected fields is acceptable only if the stored values are proven unchanged.

### M2 — Backup and retention trigger identity

| Test | Action | Expected result |
|---|---|---|
| M2.1 | Call dailyBackup() from editor without an event | Rejected with installed-trigger-only error; no backup created |
| M2.2 | Call monthlyRetention() from editor without an event | Rejected; no rows/files archived or purged |
| M2.3 | Inspect installed time triggers and TRIGGER_UID_dailyBackup / TRIGGER_UID_monthlyRetention | Each stored UID exactly matches its installed trigger UID |
| M2.4 | Execute each installed trigger in the development copy | Expected job runs once and logs completion |
| M2.5 | Force a controlled test failure in the disposable copy | Owner/failure alert is emitted and failure is visible in execution logs |

Do not manually change production trigger properties to perform these tests.

### M3 — Branding logo trust boundary

| Test | Action | Expected result |
|---|---|---|
| M3.1 | Invoke setLogoFile from a non-owner account | Rejected before changing LOGO_FILE_ID |
| M3.2 | Supply malformed, missing, trashed, non-image, empty and oversized files | Each rejected; existing logo property and cache remain unchanged |
| M3.3 | Configure the approved folder with `setApprovedBrandingFolder(folderId)` as script owner, then supply an image outside that folder | Rejected |
| M3.4 | Supply a valid image in the approved branding folder | Accepted only from the editor-owner path |
| M3.5 | Load the login page after changing the logo | New logo appears; stale logo cache is not served |

Before M3.3, identify and record the actual approved branding folder, then run `setApprovedBrandingFolder(folderId)` from the Apps Script editor as the script owner. The function rejects malformed, trashed or publicly shared folders. `setLogoFile(id)` now fails closed until this property is configured and accepts only files directly contained in that folder. Do not assume PHOTO_FOLDER_ID is the branding folder. M3-02 in `runSecurityAcceptanceTests()` checks the folder-membership helper with synthetic parent iterators; it does not verify real Drive ACLs or folder membership. M3-03 verifies the shared MIME allowlist accepts PNG, JPEG, WebP and GIF and rejects SVG and non-image types; it does not replace real Drive file tests.

### M4 — Encoder grade/section scope

For an assigned Encoder, configure only synthetic canonical grades/sections in `STUDENT_SCOPE_<normalized-username>`. Repeat each action with a student inside the assigned scope, outside the assigned section, and outside the assigned grade.

- Search results and bulk IDs contain only in-scope students.
- Direct getStudent requests for out-of-scope IDs fail closed.
- saveStudent rejects updates where either the existing or resulting record is outside scope.
- Dashboard, dashboard extras, notifications, scholarship counts, Holds search/list/overview/temporary enrollment, bulk status, status email, ID-card lookup/mutations, and selected-student re-enrollment enforce scope.
- Mixed in-scope/out-of-scope bulk requests must not mutate the out-of-scope record.
- Missing, malformed, empty, unknown-grade, and missing-section assignments fail closed.
- Full and legacy Manager behavior remains unchanged.
- Repeat with an Encoder whose scope property is absent and one with malformed JSON.

Record endpoint, account, requested StudentID(s), response, and before/after state for every mutation.

### M5 — Dashboard, role and endpoint matrix

The automated suite includes M5-01 for dashboard, dashboardExtra, and dashboardDemo, plus M5-02 for event, notification, system-settings, school-year, and career-result endpoints. Each is invoked directly with an invalid session token. These checks prove only unauthenticated rejection; they do not replace the role-by-role and data-minimization tests below.

Test both UI navigation and direct `google.script.run` invocation. Hidden buttons do not count as authorization.

| Role | Expected access boundary |
|---|---|
| Full | Existing full administrator access |
| Manager | Exact captured legacy Manager access; no silent additions/removals |
| Encoder | Minimized admin dashboard and assigned student scope only |
| Guidance | Office workflow only; no full student record or admin dashboard |
| Accounting | Office workflow only; no full student record or admin dashboard |
| HeadTeacher | Shared Academic module within assigned academic scope |
| Teacher | Shared Academic module within assigned academic scope |
| Student | Own record and supported self-service only |

Exercise `dashboard`, `dashboardExtra`, `dashboardDemo`, `searchStudents`, `getStudent`, `saveStudent`, notifications, scholarships, Holds endpoints, College dashboard/roster/program endpoints, ID-card endpoints, and all helper endpoints called by the corresponding screens. Verify sensitive demographic fields and unrelated student records are not returned.

### M6 — Reports

The automated suite includes M6-01, which directly invokes the legacy report data, report home, analytics, drill, history, preferences, logging, favorites, and saved-report mutation endpoints with an invalid session token. Each must reject before returning data or mutating report metadata. This does not replace authenticated role-matrix tests or export-path verification.

For Full, Manager, Encoder, Guidance, Accounting, HeadTeacher, Teacher and Student, directly call:

- `report`
- `reportsHome`
- `reportsAnalytics`
- `reportsDrill`
- `reportLog`
- `reportsPrefs`
- `saveFavorites`
- `saveReportConfig`
- `deleteReportConfig`
- `reportHistory`

Expected: only the documented administrator roles can access report data; Encoder, office, academic and Student accounts cannot obtain report datasets, drill-down rows or exports. Preferences/history metadata must remain caller-scoped as implemented. Verify the UI does not expose controls that backend rejects. Confirm Full/Manager compatibility with the captured baseline.

### M7 — Versioned website publishing

The automated suite currently contains M7-01 (cutover remains disabled), M7-02 (Unicode-safe chunk reconstruction), M7-03 (duplicate content-key rejection), M7-04 (gallery asset validation), M7-05 (public content allowlist boundaries), and M7-06 (section-card link and text validation). These are helper-level checks; they do not substitute for spreadsheet, Drive, browser or end-to-end publishing tests.

Run the full sequence only after M7 implementation is synchronized to the disposable copy:

1. Read-only preflight; record source hashes and Drive references.
2. Prepare additive stores; verify exact headers and private staging folder.
3. Seed immutable baseline; verify chunk hashes and reconstructed payload.
4. Create editor, reviewer, publisher and rollback test accounts with separate explicit grants.
5. Test draft creation, revision immutability, every content key, About structured data, all six card groups, page intros/banners, every gallery page and HTML sanitization.
6. Stage JPEGs as two different editors. Verify private folder ACL, owner isolation, file magic/size checks, duplicate metadata rejection and staged-reference validation.
7. Verify creator cannot review own draft; reviewer can request changes with notes; publisher cannot publish a non-approved version.
8. Verify publish remains fail-closed while `WP_PUBLISH_CUTOVER_READY_` is false.
9. After all legacy writers, public readers, media promotion, pointer switching, cache invalidation and rollback safeguards have been implemented and tested, run the full browser workflow.
10. Publish an approved synthetic version; verify every public page reads the same version, public caches refresh, and no draft-only media is exposed.
11. Roll back to the previous version; verify exact content/media references return and both versions remain recoverable.
12. Attempt legacy live-write endpoints after cutover; all must fail closed.
13. Verify audit rows include actor, action, target version, timestamps and review/publish/rollback details.

**Current status:** publishing cutover is intentionally disabled. Steps requiring cutover cannot pass until the remaining implementation is completed.

## 3. Release gate

M1–M7 are closed only when the test evidence above is attached to the release record. Any failed, skipped, or unexecuted test remains open. Source syntax checks and self-check functions are supporting evidence, not substitutes for Apps Script runtime tests. Keep `WP_PUBLISH_CUTOVER_READY_` false and do not deploy to production until every applicable test passes and the owner explicitly approves release.
