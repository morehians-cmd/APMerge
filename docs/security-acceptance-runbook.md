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
| M3.6 | Select a logo file shared with Anyone or Anyone with the link | Rejected before `LOGO_FILE_ID` or cache is changed |

Before M3.3, identify and record the actual approved branding folder, then run `setApprovedBrandingFolder(folderId)` from the Apps Script editor as the script owner. The function rejects malformed, trashed or publicly shared folders. `setLogoFile(id)` now fails closed until this property is configured and accepts only files directly contained in that folder. Do not assume PHOTO_FOLDER_ID is the branding folder. M3-02 in `runSecurityAcceptanceTests()` checks the folder-membership helper with synthetic parent iterators; it does not verify real Drive ACLs or folder membership. M3-03 verifies the shared MIME allowlist accepts PNG, JPEG, WebP and GIF and rejects SVG and non-image types; M3-04 verifies the sharing-access helper allows private/domain-restricted files and rejects Anyone/Anyone-with-link access. These helper checks do not replace real Drive file tests.

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

#### M4 source-audit inventory (reviewed on 2026-11-14)

The following endpoint paths were inspected on branch `website-pages-fixes`. This is source-review evidence only; each path still requires the live Encoder account tests above.

| Endpoint / helper | Scope behavior to verify in the development copy |
|---|---|
| `studentSearchScope_`, `studentWithinSearchScope_`, `assertStudentScope_` | Missing/malformed assignments fail closed; matching grade and section are both required. M4-03 invokes both the Encoder scope reader and website-permission reader under a synthetic collision table. The collision helper detects distinct usernames that collapse to the same suffix and duplicate case-insensitive usernames, while allowing exactly one matching account row. This helper test passed in the 2026-11-14T13:16:35.178Z 22/22 Apps Script execution. |
| `searchStudents` | Filters rows and returned bulk IDs to assigned grade/section combinations; an explicitly requested unassigned grade is rejected. |
| `getStudent` | Direct lookup of an out-of-scope StudentID fails closed. |
| `saveStudent` | Checks the existing record before editing and the resulting grade/section before writing. |
| `dashboard`, `dashboardExtra`, `getNotifications`, `getScholarships` | Student-derived counts and attention/notification rows are scoped. Verify the Encoder sees no unrelated student counts or identifiers. |
| `report` | Applies the student scope to report rows; Encoder is explicitly denied report access. |
| Holds: `flagSearch`, `flagList`, `holdsOverview` | Encoder lookup/list/overview are scoped; direct out-of-scope flag lookup must fail closed. Office accounts see only their own office's hold details. |
| Holds: `grantTemporary` | Checks the target learner against the Encoder's assigned scope before changing enrollment status. |
| ID cards: `idCardData`, `saveIdNumber`, `saveIdPhoto` | Each resolves the target learner and asserts scope before returning photo data or mutating the student record/Drive. |
| Re-enrollment: `reenrollRun` with explicit `ids` | Requires admin authentication and checks each found requested learner against scope before building the mutation list. Bulk selection must be tested with mixed in-scope and out-of-scope IDs. |
| Academic: `getClassRoster`, `getAdvisee` | Uses the separate Academic assignment model (teacher/adviser or Head Teacher grade scope), not the Encoder scope. Validate separately with HeadTeacher/Teacher accounts under M5. |

The following functions are intentionally not Encoder write paths: `raiseFlag` and `clearFlag` are restricted to the relevant office or Full owner; `saveIdArt` is owner-only; a full bulk re-enrollment without explicit IDs uses the system-owner authorization path. Do not treat these as proof of Encoder scope until their separate role-denial behavior is exercised.

For every mutation test, capture the exact target StudentID, account username/clearance, assigned grade/section, request payload, returned response, and before/after student row. Include a mixed-ID re-enrollment request and mixed-ID UI bulk selection. An out-of-scope target must not be changed even when an in-scope target is included in the same request.

### M5 — Dashboard, role and endpoint matrix

The automated suite includes M5-01 for dashboard, dashboardExtra, and dashboardDemo, M5-02 for event, notification, system-settings, school-year, and career-result endpoints, M5-03 for Encoder dashboard scope, M5-04 for the shared College role guard, and M5-05 for the admissions dashboard/report role boundary. M5-04 verifies the shared authorization helper denies Encoder, Guidance, Accounting, HeadTeacher and Teacher while preserving Full and Manager. The College dashboard, roster and program-list endpoints now all call this guard before reading the College workbook. M5-01/M5-02 invoke their listed endpoints directly with an invalid session token; M5-03/M5-04/M5-05 use controlled harnesses with stubbed dependencies, not real accounts or live spreadsheet records. These checks prove only the specific behaviors stated; they do not replace the role-by-role and data-minimization tests below.

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

Exercise `dashboard`, `dashboardExtra`, `dashboardDemo`, `dashboardSpec`, `searchStudents`, `getStudent`, `saveStudent`, notifications, scholarships, Holds endpoints, College dashboard/roster/program endpoints, ID-card endpoints, and all helper endpoints called by the corresponding screens. Confirm only Full and legacy Manager can call College dashboard, roster and program-list endpoints; verify direct calls by Encoder, Guidance, Accounting, HeadTeacher and Teacher fail before College workbook reads. For Encoder, compare `dashboardSpec` totals, charts, level cards, recent registrations and College figures against only the assigned grade/section fixture; also test direct calls with restrictive filters and with no filters. Verify sensitive demographic fields and unrelated student records are not returned.

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

The website-permission property store uses the same legacy username-suffix normalization as Encoder scopes. The shared collision guard now rejects reads and permission assignments when distinct staff usernames collapse to one property key; verify this with two synthetic staff accounts before granting website capabilities. The automated M4-03 helper check covers collision detection, but the live staff-account/property behavior remains part of browser acceptance.



The source now includes M7-07 for pure candidate-selection behavior: `Staged` rows are ignored, `Promoting` and `RecoveryRequired` rows are selected, duplicate metadata is blocked, and assets referenced by the current published version are excluded from recovery. This helper test passed in the 2026-11-14T13:16:35.178Z 22/22 Apps Script execution; it does not exercise Drive operations or prove recovery success.
The automated suite currently contains M7-01 (cutover remains disabled), M7-02 (Unicode-safe chunk reconstruction), M7-03 (duplicate content-key rejection), M7-04 (gallery asset validation), M7-05 (public content allowlist boundaries), M7-06 (section-card link and text validation), and M7-07 (retryable media-recovery candidate selection). These are helper-level checks; they do not substitute for spreadsheet, Drive, browser or end-to-end publishing tests.

Run the full sequence only after M7 implementation is synchronized to the disposable copy:

1. Read-only preflight; record source hashes and Drive references.
2. Prepare additive stores; verify exact headers and private staging folder.
3. Seed immutable baseline; verify chunk hashes and reconstructed payload.
4. Create editor, reviewer, publisher and rollback test accounts with separate explicit grants.
5. Test draft creation, revision immutability, every content key, About structured data, all six card groups, page intros/banners, every gallery page and HTML sanitization.
6. Stage JPEGs as two different editors. Verify private folder ACL, owner isolation, file magic/size checks, duplicate metadata rejection and staged-reference validation. Inject a controlled failure after at least one staged asset moves but before the published pointer commits; verify compensation restores every unpublished staged asset in the promotion journal to the private staging folder, including any file already moved into the approved folder before the failed attempt, resets metadata to `Staged`, and removes public sharing. Also inject a failure after pointer commit; verify compensation does not make media private while the public pointer references it, then reconcile version metadata and audit state. The recovery routine now records failed assets as `RecoveryRequired`, continues attempting the remaining assets, and exposes owner-only `recoverWebsiteMediaPromotions(token)` for retry. It discovers both `Promoting` (including executions terminated mid-promotion) and `RecoveryRequired` rows, blocks duplicate metadata, and refuses to privatize any asset referenced by the current published payload. Verify repeated recovery calls are safe and that unresolved rows remain visibly `RecoveryRequired`.
7. Verify creator cannot review own draft; reviewer can request changes with notes; publisher cannot publish a non-approved version.
8. Verify publish remains fail-closed while `WP_PUBLISH_CUTOVER_READY_` is false.
9. After all legacy writers, public readers, media promotion, pointer switching, cache invalidation and rollback safeguards have been implemented and tested, run the full browser workflow.
10. Publish an approved synthetic version; verify every public page reads the same version, public caches refresh, and no draft-only media is exposed.
11. Roll back to the previous version; verify exact content/media references return and both versions remain recoverable.
12. Attempt legacy live-write endpoints after cutover; all must fail closed.
13. Verify audit rows include actor, action, target version, timestamps and review/publish/rollback details.

**Current status:** publishing cutover is intentionally disabled. Steps requiring cutover cannot pass until the remaining implementation is completed.

## 3. Apps Script runtime acceptance evidence

### Latest execution — 22-check suite

**Execution:** 2026-11-14T13:16:35.178Z  
**Environment:** Non-production development copy  
**Suite:** Moreh Academy security acceptance checks  
**Result:** 22 passed, 0 failed, 22 total

The user-provided Apps Script execution confirms all 22 checks passed in the Apps Script runtime. This is the first supplied runtime result that includes M5-03 and therefore exercises the dashboardSpec() Encoder grade/section scope remediation through its controlled endpoint harness.

- M1-01–M1-02: student self-edit allow-list acceptance and protected-field rejection.
- M2-01–M2-02: direct invocation rejection for daily backup and monthly retention without installed trigger identity.
- M3-01–M3-04: malformed logo ID rejection, approved-folder membership enforcement, MIME allowlist consistency, and public-sharing rejection.
- M4-01–M4-03: grade/section scope filtering, fail-closed handling of missing/malformed/empty scope properties, and account property-key collision rejection.
- M5-01–M5-03: unauthenticated rejection for dashboard endpoints, unauthenticated rejection for additional administrative endpoints, and authenticated endpoint-harness verification that Encoder dashboard aggregates/recent registrations/charts are restricted to assigned grade/section while College figures are withheld and Full/Manager behavior is preserved.
- M6-01: invalid-session rejection for report endpoints, with mutations denied before writes.
- M7-01–M7-07: cutover gate, Unicode-safe chunking, duplicate content-key rejection, gallery asset validation, public-schema allowlist boundaries, section-card validation, and media-recovery candidate selection.

The M5-03 result uses stubbed authentication/data dependencies and synthetic fixtures. It is not a substitute for real Encoder account tests against the development spreadsheet. Likewise, M3 helper checks do not prove real Drive folder membership, ACLs or cache invalidation; M4 does not replace live mixed-ID endpoint tests; M5/M6 do not close authenticated role-by-role, helper-endpoint, export or data-minimization tests; and M7-07 does not prove Drive side effects or end-to-end publishing recovery.

The execution output retains all five manual evidence gates as open:

1. **M3:** Confirm real approved branding folder membership and test valid logo content/cache invalidation.
2. **M4:** Exercise every scoped endpoint with real Encoder accounts and mixed in/out-of-scope IDs.
3. **M5:** Run the role-by-role dashboard, direct-call, helper-endpoint and field-minimization matrix.
4. **M6:** Run every report, drill-down, export and history endpoint for every role.
5. **M7:** Complete editor/public-reader/media cutover and draft/review/publish/rollback browser acceptance.

The 22/22 result supersedes the 21/21 execution at 12:33:47 for the current automated suite. Earlier 20/21 and 20/20 results remain historical evidence only. Do not combine counts across runs. Keep `WP_PUBLISH_CUTOVER_READY_ = false`; the automated suite does not authorize publishing cutover or production deployment.


### Latest execution — updated 20-check suite

**Execution:** 2026-11-14T11:48:36.921Z  
**Environment:** Non-production development copy  
**Suite:** Moreh Academy security acceptance checks  
**Result:** 20 passed, 0 failed, 20 total

The user-provided Apps Script execution result confirms all 20 automated checks passed in the Apps Script runtime. This run explicitly reports that M4-03 detects distinct colliding usernames and that both live property readers reject the collision before reading shared Script Properties. It therefore supersedes the 11:25:43 execution for current automated-suite evidence.

- M1-01–M1-02: student self-edit allow-list acceptance and rejection.
- M2-01–M2-02: direct invocation rejection for daily backup and monthly retention without installed trigger identity.
- M3-01–M3-04: malformed logo ID rejection, approved-folder membership enforcement, consistent logo MIME allowlist, and rejection of publicly shared logo files. M3-04 reports private and domain-restricted files accepted and Anyone/Anyone-with-link files rejected.
- M4-01–M4-03: grade/section scope filtering, fail-closed handling of missing/malformed/empty scope properties, and detection of distinct usernames that collide after legacy property-key normalization. The collision check confirms Encoder scope and website-permission readers fail closed.
- M5-01–M5-02: invalid-session rejection for 3 dashboard endpoints and 9 additional administrative/event/student-career endpoints.
- M6-01: invalid-session rejection for 10 report endpoints, with mutations denied before data writes.
- M7-01–M7-06: cutover gate, Unicode-safe chunking, duplicate content-key rejection, gallery asset validation, public-schema allowlist boundaries, and all six section-card groups' link/text validation.

The execution output explicitly retains these manual evidence items as open:

1. **M3:** Confirm real approved branding folder membership and test valid logo content and cache invalidation.
2. **M4:** Exercise every scoped endpoint with real Encoder accounts and mixed in/out-of-scope IDs.
3. **M5:** Run the role-by-role dashboard, direct-call, helper-endpoint and field-minimization matrix.
4. **M6:** Run every report, drill-down, export and history endpoint for every role.
5. **M7:** Complete editor/public-reader/media cutover and draft/review/publish/rollback browser acceptance.

The latest user-provided Apps Script runtime execution is **2026-11-14T12:13:03.437Z** in the non-production development copy: **20 passed, 1 failed, 21 total**. M1-01 through M7-06 passed. M7-07 failed because duplicate media metadata was not excluded from the recovery candidate list. This is a failed suite and does not satisfy the automated release gate.

The failure was traced to the selector detecting a duplicate on its second occurrence but leaving the first occurrence in `pending`. The live recovery endpoint already blocked all work when any conflict was present, but the helper's returned candidate set was misleading and did not meet the test contract. The selector has now been changed to count metadata IDs before selecting candidates; any duplicate ID with a recovery-state row is excluded from `pending` and reported once as a conflict. M7-07 now additionally covers a duplicate split across `Promoting` and `Staged` states. This source fix and strengthened test require a new Apps Script execution; do not treat the 20/21 result as passing.



The subsequent user-provided Apps Script runtime execution is **2026-11-14T12:33:47.680Z** in the non-production development copy: **21 passed, 0 failed, 21 total**. This is the latest supplied execution and confirms that the corrected M7-07 candidate selector passes in the Apps Script runtime. Its detail explicitly confirms that `Promoting` and `RecoveryRequired` assets are retry candidates, `Staged` assets are ignored, currently published references are excluded, and duplicate metadata—including duplicates split across `Promoting` and `Staged` states—is blocked.

The 12:33:47 result supersedes the 12:13:03 failed 20/21 execution for the current 21-check automated suite. The 12:13:03 failure remains in the evidence history as the defect that prompted the correction; it must not be represented as the current result. The latest automated suite is now green, but its coverage remains the specific 21 checks listed in the returned JSON. In particular, M3's real Drive folder/file/cache checks, M4's real Encoder account and mixed-ID endpoint tests, M5's authenticated role-by-role and field-minimization matrix, M6's authenticated report/export matrix, and M7's end-to-end editor/public-reader/media cutover and draft/review/publish/rollback browser acceptance remain open.

This 21/21 result does not prove the real Drive recovery side effects succeed under injected service failures; M7-07 is still a candidate-selection/helper acceptance test. The five manual evidence gates remain mandatory. Keep `WP_PUBLISH_CUTOVER_READY_ = false`; do not enable publishing cutover or deploy to production on the strength of the automated suite alone.

The earlier **2026-11-14T11:48:36.921Z, 20 passed / 0 failed / 20 total** execution remains historical evidence and predates M7-07 and the retryable media-recovery changes. It confirms the M4-03 behavior described in its result detail, but it is not the latest suite result and cannot override the 20/21 failure.

The 12:13:03 execution is the first supplied runtime result for the 21-check suite and failed M7-07. The duplicate-selector source fix and strengthened mixed-state duplicate assertion were committed afterward; they still require a fresh Apps Script runtime result. It does not establish the case-insensitive duplicate-account subcase unless that exact assertion is confirmed in the synchronized test source and execution output. It also does not close the five manual evidence gates, prove every role's data-minimization boundary, test the new website-media compensation path in Apps Script, or authorize publishing cutover or production deployment. Retain the returned JSON and Apps Script execution log with the release evidence.

### Follow-up source audit — Encoder dashboard scope defect

After the 21/21 runtime result, a source-level review of the authenticated dashboard surface found that `dashboardSpec(token, filters)` accepted an Encoder account through `who_(token, 'admin')` but built its base `all` collection from every active-school-year student row. Its filters were presentation filters (level/type/status), not authorization filters. The endpoint also returned recent student names/IDs and aggregate totals, so this was a genuine scope-boundary defect even though the earlier M5-01 invalid-token check passed. The previous 21/21 result did not exercise this authenticated Encoder path.

The defect has been corrected on `website-pages-fixes`:
- `dashboardSpec()` now obtains `studentSearchScope_(u)` and applies `dsScopeRows_()` to the active-year rows before filters, counts, charts, recent registrations or attention data are assembled.
- The helper preserves existing Full/Manager behavior because their scope is `null`.
- College dashboard aggregates are omitted for scoped Encoder accounts; College data is not represented in the Basic Education grade/section assignment model.
- `AcceptanceTests.gs` now includes M5-03 with cross-section, cross-grade and Senior High fixtures, asserts the endpoint's returned totals/recent/chart data and confirms Full/Manager's existing unscoped scope-helper behavior remains unchanged.

**Commits:** `DashboardSpec.gs` — `e31d73c45fa96dbd0fc17534aaead83815c56695`; `AcceptanceTests.gs` — `346d1eeae3dbce10ca4ce0b02895fe549ef1bbc3`.

**Runtime status:** The user-provided Apps Script execution at `2026-11-14T13:16:35.178Z` is **22 passed, 0 failed, 22 total** in the non-production development copy. It includes M5-03, whose result confirms that the endpoint harness restricted totals, recent registrations and charts to the assigned grade/section, withheld College figures from Encoder, and preserved Full/Manager scope-helper behavior. This is the first supplied runtime result for the dashboard-scope remediation. It verifies the controlled endpoint harness, not a real authenticated Encoder account against live spreadsheet records; the authenticated M5 manual matrix must still exercise `dashboardSpec` and confirm response-level data minimization.

### Historical execution — previous 20-check suite

**Execution:** 2026-11-14T11:25:43.316Z  
**Environment:** Non-production development copy  
**Result:** 20 passed, 0 failed, 20 total

This user-provided result is retained as historical evidence. It predates the latest 11:48:36 execution and the subsequent website-publishing media recovery source changes.

### Historical execution — 19-check suite

**Execution:** 2026-11-14T11:09:32.497Z  
**Environment:** Non-production development copy  
**Result:** 19 passed, 0 failed, 19 total

This user-provided execution includes M3-04 but predates M4-03. It remains historical evidence for the then-current suite and is superseded for current automated-suite status by the 20/20 execution above.

### Historical execution — original 18-check suite

**Execution:** 2026-11-14T10:57:45.037Z  
**Environment:** Non-production development copy  
**Result:** 18 passed, 0 failed, 18 total

This earlier user-provided result remains historical evidence for the then-current suite. It predates M3-04 and is superseded by the later 19/19 and 20/20 executions. Do not add results across runs as if they were distinct checks.

## 4. Source-level verification evidence

On 2026-11-14, the branch source was re-fetched and checked independently of Apps Script:

- JavaScript syntax parsing passed for Code.gs, AcceptanceTests.gs, WebsitePublishing.gs, Public.gs, Report.gs, Content.gs, Gallery.gs, Protection.gs, Retention.gs, and Security.gs.
- `WebsitePublishing.gs` was re-fetched after the media-promotion recovery changes and passed a V8 syntax parse.
- `DashboardSpec.gs` and `AcceptanceTests.gs` were re-fetched after the Encoder dashboard-scope remediation and passed V8 syntax parsing. Static inspection confirms `dashboardSpec()` obtains the account's student scope and filters the active-year student rows before any dashboard aggregation; College aggregates are withheld for scoped Encoder accounts. M5-03 uses a controlled endpoint harness with synthetic rows to check totals, recent registrations, scholarship chart aggregation and College suppression, restoring every mocked function in a `finally` block. The M5-03 harness passed in the 2026-11-14T13:16:35.178Z 22/22 Apps Script runtime execution; real Encoder-account testing remains open.
- The subsequent retryable media-recovery update passed V8 syntax parsing for both `WebsitePublishing.gs` and `AcceptanceTests.gs`. Static checks confirmed `RecoveryRequired` persistence, retry selection for interrupted `Promoting` rows, duplicate-metadata blocking, exclusion of assets referenced by the current published payload, and explicit surfacing of unresolved assets. This remains source-level evidence only; the Apps Script Drive recovery endpoint and M7-07 have not yet been runtime-tested. Source inspection confirms all unpublished staged assets are journaled before sharing/location side effects, including assets already located in the approved folder after an interrupted earlier move; pre-pointer failures attempt to restore those assets to private staging, restore a failed version's `Approved` metadata and prior migration state, and write a compensation audit row. Post-pointer failures do not privatize media and instead return an explicit reconciliation warning. This is source-level verification only; Drive service behavior, partial-failure recovery, and publication sequencing remain untested in Apps Script.
- A local V8 helper harness passed the approved-folder membership and shared logo-MIME checks (M3-02/M3-03).
- A local V8 helper harness passed Unicode chunk reconstruction, duplicate content-key rejection, and gallery asset validation (M7-02/M7-03/M7-04).
- A local V8 schema harness confirmed 32 public block keys, 31 page-block mappings, six section-card groups, and 43 permitted content keys, with portal/internal keys excluded (M7-05).
- A local V8 sanitizer harness passed defaults, unsafe-link rejection, and title/description length limits for all six section-card groups (M7-06).

These local harnesses evaluate extracted pure helper functions; they do not execute runSecurityAcceptanceTests() inside Apps Script and do not verify Apps Script services, Drive ACLs, spreadsheet writes, authentication sessions, triggers, browser behavior, or deployment. The Apps Script runtime result is recorded in Section 3; the manual execution evidence described in Sections 2 and 3 remains mandatory for the release gates that are not covered by the automated suite.

## 5. Release gate

M1–M7 are closed only when the test evidence above is attached to the release record. Any failed, skipped, or unexecuted test remains open. Source syntax checks and self-check functions are supporting evidence, not substitutes for Apps Script runtime tests. Keep `WP_PUBLISH_CUTOVER_READY_` false and do not deploy to production until every applicable test passes and the owner explicitly approves release.

## 4. Post-22/22 source-audit finding — College role boundary

**Finding:** After the 22-check runtime result, the M5 source audit found that `collegeRoster()` rejected Encoder accounts but did not reject Guidance, Accounting, HeadTeacher or Teacher accounts. The roster response contains sensitive College student fields, including date of birth, contact number, address, sex and photo reference. `collegeDashboard()` and `getCollegePrograms()` also relied on a denylist that did not exclude Academic roles. This was an authorization defect not covered by the 22-check suite.

**Remediation on `website-pages-fixes`:**
- Added `collegeAdmin_(token)`, which authenticates an administrator and permits only `Full` and `Manager`.
- Routed `collegeDashboard()`, `collegeRoster()` and `getCollegePrograms()` through this shared guard before reading College workbook data.
- Kept `saveCollegeProgram()` restricted to `Full` only. The legacy Manager read access remains intact; no new Manager write access is granted.
- Added M5-04 to the acceptance suite. It checks the shared guard denies Encoder, Guidance, Accounting, HeadTeacher and Teacher, while allowing Full and Manager. It restores the mocked `who_` function in a `finally` block.

**Commits:** `CollegeModule.gs` — `0564fe9710142406bd73f4129e25f8327b74782a`; `AcceptanceTests.gs` — `59f8f2f9196d4c50a7e5af355767a9b7837a1e5e`.

**Runtime status:** The 22/22 execution at `2026-11-14T13:16:35.178Z` predates this finding and does not test M5-04. The current branch suite contains 24 checks. Synchronize the updated `CollegeModule.gs` and `AcceptanceTests.gs` into the disposable Apps Script copy and rerun `runSecurityAcceptanceTests()`. Do not claim 23/23 until the returned Apps Script JSON confirms it.

**Static verification required:** Re-fetch both changed files from this branch, parse them with V8, confirm the three College read endpoints call `collegeAdmin_()`, confirm the program mutation remains Full-only, confirm M5-04 is present and restores its mock, and confirm `WP_PUBLISH_CUTOVER_READY_ = false`.

**Manual evidence remains open:** Test the actual College endpoints with Full, Manager, Encoder, Guidance, Accounting, HeadTeacher and Teacher accounts against the development workbook. The helper-level M5-04 test is not a substitute for direct endpoint calls or confirmation that denied roles cause no College workbook read.

## 5. Post-22/22 source-audit finding — office and academic dashboard/report isolation

**Finding:** The expanded M5/M6 source audit found that `dashboard()` and `dashboardExtra()` authenticated any `Role: admin` account without consistently excluding office and Academic clearances. `dashboardSpec()` excluded office clearances but did not exclude HeadTeacher/Teacher. The legacy `report()`, `reportsHome()`, analytics/drill context, and report preferences/history helper similarly denied Encoder but did not deny Guidance, Accounting, HeadTeacher or Teacher. Because these staff accounts use the administrator authentication role, direct server calls could return school-wide aggregates or report data outside their assigned modules. `getNotifications()` also calculated registration/consent counts for office accounts; `getScholarships()` returned admin-only counts to office accounts.

**Remediation on `website-pages-fixes`:**
- Added `assertAdminConsoleRole_(u)` in `Code.gs`. It allows the existing administrator dashboard roles Full, Manager and Encoder, and denies office and Academic clearances.
- Applied the shared guard to `dashboard()`, `dashboardExtra()`, `dashboardSpec()`, `report()`, `reportsHome()`, `anCtx_()` and `rpUser_()`. The report paths continue to deny Encoder after the shared guard, preserving the existing report restriction.
- `getNotifications()` now returns an empty notification collection to office and Academic accounts instead of calculating school-wide student counts. `getScholarships()` no longer includes admin learner counts for office or Academic accounts; public scholarship descriptions remain available.
- Added M5-05 to the automated suite to verify Guidance, Accounting, HeadTeacher and Teacher are denied by the shared console guard, Full/Manager/Encoder retain dashboard eligibility, and a Student account is denied.
- College endpoints remain protected by `collegeAdmin_()` from M5-04; only Full and Manager may read College dashboard/roster/program lists. `saveCollegeProgram()` remains Full-only.

**Commits:** `Code.gs` — `9c89c4bf0c832f20801e215e6c050aefeaac25cb`; `DashboardSpec.gs` — `871a383a4f913c346bcac0391cb330ccaf3537e1`; `Report.gs` — final update `9f1adb8d1b7081f2f11806c7cc8e1a2e5e2bf8e3`; `AcceptanceTests.gs` — `38f3a94e469373e504eb384b746e970c98468675`.

**Runtime status:** The 22/22 execution at `2026-11-14T13:16:35.178Z` predates M5-04 and M5-05. The current branch suite contains 24 checks. Synchronize the latest `Code.gs`, `DashboardSpec.gs`, `Report.gs`, `CollegeModule.gs` and `AcceptanceTests.gs` into the disposable Apps Script copy and rerun `runSecurityAcceptanceTests()`. Do not claim 24/24 until the returned Apps Script JSON confirms it.

**Static verification:** V8 syntax parsing passed for `Code.gs`, `DashboardSpec.gs`, `Report.gs`, `AcceptanceTests.gs` and `CollegeModule.gs`. Source inspection confirms the shared guard is wired to the listed dashboard/report paths, College read endpoints call `collegeAdmin_()`, report access remains denied to Encoder, and `saveCollegeProgram()` remains Full-only. The automated M5-04/M5-05 tests exercise shared helper behavior with mocked authentication; they do not replace direct calls using real role accounts.

**Manual evidence remains open:** Test each dashboard and report endpoint directly with Full, Manager, Encoder, Guidance, Accounting, HeadTeacher and Teacher accounts. Confirm denied office/Academic calls return no student aggregates, identifiers, drill-down rows, report exports, preferences/history or College records, and verify that Full/Manager legacy access and Encoder's limited dashboard remain intact. Check browser navigation as well as direct `google.script.run` calls.

## 6. Current automated acceptance execution — 24/24

**Environment:** non-production development copy.
**Execution timestamp:** `2026-11-14T13:37:55.267Z`.
**Result:** 24 passed, 0 failed, 24 total.

The supplied Apps Script runtime JSON confirms M1-01/M1-02, M2-01/M2-02, M3-01 through M3-04, M4-01 through M4-03, M5-01 through M5-05, M6-01 and M7-01 through M7-07 all passed. In particular, M5-04 confirms the College shared guard role decisions and M5-05 confirms the admissions dashboard/report shared role guard decisions.

This execution supersedes the prior 22/22 and closes the automated-runtime pending status for the 24-check suite. It does **not** close the five manual evidence gates. Helper-level regression tests do not establish real-account direct endpoint behavior, real Drive ACL/cache behavior, full report/export role isolation, or browser end-to-end publishing/recovery. Keep `WP_PUBLISH_CUTOVER_READY_ = false` until those gates are evidenced and separately approved.

**Remaining manual evidence:**
- M3: approved branding folder membership, valid image content and cache invalidation against actual development Drive objects.
- M4: every scoped endpoint with real synthetic Encoder accounts and mixed in/out-of-scope IDs.
- M5: role-by-role dashboard, direct-call, helper-endpoint and field-minimization matrix, including the new College and office/Academic boundaries.
- M6: every report, drill-down, export, history and saved-configuration endpoint for each applicable role.
- M7: editor/public-reader/media browser acceptance, draft/review/publish/rollback and Drive failure/recovery scenarios.

## 7. Post-24/24 source-audit finding — student-care administrative endpoints

**Finding:** A further source audit found that several student-care functions authenticated any administrator account but did not exclude office/Academic clearances. This affected temporary enrollment grants (`grantTemporary`), ID-card artwork retrieval and learner ID-card read/write endpoints (`getIdArt`, `idCardData`, `saveIdNumber`, `saveIdPhoto`), manual enrollment-status email dispatch (`emailStatus`), and student portal account reset/unlock (`resetStudentAccount`). These operations were intended for the admissions/admin console and, in some cases, scoped Encoder users. Office and Academic accounts could otherwise use direct server calls to perform admissions actions outside their assigned module.

**Remediation on `website-pages-fixes`:**
- Applied `assertAdminConsoleRole_()` to all listed endpoints. The shared guard permits Full, legacy Manager and Encoder administrator accounts, denies Guidance, Accounting, Academic, HeadTeacher and Teacher clearances, and preserves the existing per-student Encoder scope checks.
- `grantTemporary()` retains the subsequent student grade/section scope check. `emailStatus()` retains per-student scope validation. ID-card learner operations retain their per-student scope validation. Student account reset still revokes sessions and forces password change as before.
- `saveIdArt()` remains owner-only (`sysOwner_()`); this remediation does not broaden artwork mutation privileges.
- Added M5-06 to the automated suite to assert the shared role policy for student-care administrative actions.

**Commits:** `Flags.gs` — `d234e04e0ac0a4551127469cb91a25377c137b1d`; `IdCard.gs` — `5f330e06352dac19104f777474735a35b2a7c275`; `MailQueue.gs` — `d778d67edd282800e71911261a1acd161840e3ff`; `MailSwitch.gs` — final update `8e6f3da5d8a5cd7fe240f7d4743816f8d2067b77`; `AcceptanceTests.gs` — final update `aa658efb8bf1d93c9222c9c612a9976b19b95c09`.

**Runtime status:** The 24/24 execution at `2026-11-14T13:37:55.267Z` predates this remediation. The branch suite now contains 26 checks. Synchronize `Flags.gs`, `IdCard.gs`, `MailQueue.gs`, `MailSwitch.gs` and `AcceptanceTests.gs` into the disposable Apps Script copy, along with any previously updated files not yet synchronized, then rerun `runSecurityAcceptanceTests()`. Do not claim 25/25 until the Apps Script JSON confirms it.

**Static verification required:** V8 parse all changed files; inspect each named endpoint to ensure the guard runs before spreadsheet/Drive reads or writes; verify the per-student Encoder scope checks remain; verify ID artwork writes remain owner-only; and verify publishing cutover remains false.

**Manual evidence remains open:** Use real synthetic Full, Manager, Encoder, Guidance, Accounting, Academic, HeadTeacher and Teacher accounts to test direct calls to each endpoint. For Encoder, test both in-scope and out-of-scope student IDs. Verify denied calls do not read or mutate student, user, Drive or mail-queue records.

## 8. M4 follow-up — student account reset scope

During verification of the M5 student-care changes, `resetStudentAccount()` was found to enforce the shared role guard but not the Encoder's per-student grade/section assignment. An Encoder could therefore attempt a direct reset for an out-of-scope student account.

**Fix:** The endpoint now resolves the student record and calls `assertStudentScope_()` immediately after authentication and before reading the Users sheet. Full/Manager retain their unscoped behavior; Encoder is constrained by the existing assignment. Added M4-04, a controlled endpoint harness that mocks an out-of-scope Encoder student and asserts the Users sheet is not read before the scope denial. The harness restores all mocked functions in `finally`.

**Commits:** `MailSwitch.gs` — `8e6f3da5d8a5cd7fe240f7d4743816f8d2067b77`; `AcceptanceTests.gs` — `aa658efb8bf1d93c9222c9c612a9976b19b95c09`.

**Runtime status:** The 24/24 execution predates M5-06 and M4-04. The current branch suite contains 26 checks. Rerun the complete suite after synchronizing all changes listed in Sections 7 and 8. Do not claim 26/26 until the Apps Script JSON confirms it.


## 9. Latest automated execution — 25/26; M4-04 follow-up

**Execution:** 2026-11-14T13:52:08.771Z  
**Environment:** non-production development copy  
**Result:** 25 passed, 1 failed, 26 total.

The supplied execution confirms all checks except M4-04. The failure detail was: "The student scope assertion was not invoked." All M1, M2, M3, M5, M6 and M7 checks passed. M4-01 through M4-03 also passed. This result does not establish M4-04.

**Investigation:** The current branch implementation of `resetStudentAccount()` calls `assertStudentScope_(scope, hit.o)` after resolving the student and before calling `rows_('U')`. The original M4-04 test replaced the assertion helper with a mock and relied on that mock being observed. That instrumentation is unnecessarily coupled to global function replacement and does not independently prove that the production scope guard rejects the fixture.

**Test hardening committed after the supplied execution:** M4-04 now leaves the real `assertStudentScope_()` implementation in place, supplies an Encoder scope and an out-of-scope synthetic student, and verifies both (a) the endpoint returns the actual scope-denial error and (b) the Users-sheet row reader is never called. It restores the mocked role guard, scope resolver, student finder and row reader in `finally`. This improves the test's evidentiary value; it is not yet runtime evidence.

**Commit:** `AcceptanceTests.gs` — `3abe2f90d233b5e7d32b06c1f2828da64c136ca9`.

**Next runtime action:** Synchronize the latest `MailSwitch.gs` and `AcceptanceTests.gs` from `website-pages-fixes` into the disposable Apps Script copy, then run `runSecurityAcceptanceTests()` again. If M4-04 still fails, retain the exact returned `error` text and Apps Script execution log; do not weaken the expected denial or infer a pass. Do not claim 26/26 until the new runtime JSON confirms it.

All five manual evidence gates remain open. Keep `WP_PUBLISH_CUTOVER_READY_ = false`; no production deployment or publishing cutover is authorized.


### M4-04 harness diagnosis and correction — authentication was not stubbed

The 2026-11-14T14:02:29.427Z execution again failed M4-04. Inspection of the harness identified the concrete cause: it replaced `assertAdminConsoleRole_()` but did not replace `who_()`. The endpoint calls `who_(token, 'admin')` before the role guard, so the real authentication lookup rejected the synthetic token before the test could reach the Encoder scope resolver. The observed failure was therefore a harness setup defect, not evidence that the production endpoint skipped `assertStudentScope_()`.

**Correction committed:** M4-04 now stubs `who_()` to return a synthetic administrator with Encoder clearance, checks the expected token/role arguments, and then observes the role guard and scope resolver. It leaves the real `assertStudentScope_()` in place, returns an out-of-scope synthetic student, checks the actual scope-denial message, and asserts the Users sheet reader was not called. All replaced globals are restored in `finally`.

**Commit:** `AcceptanceTests.gs` — `6b2d75eff27d94ab18a765e7b1d579f6b9366bd4`.

**Runtime status:** This is a test-harness correction after the 25/26 execution. It has not yet been run in Apps Script. Synchronize the latest `AcceptanceTests.gs` and run the full suite again. The prior 25/26 result remains the latest runtime evidence until a new JSON execution is supplied.


## 10. Latest automated execution — 26/26; M4-04 confirmed

**Execution:** 2026-11-14T14:09:09.850Z  
**Environment:** non-production development copy  
**Result:** 26 passed, 0 failed, 26 total.

The user-provided Apps Script runtime JSON confirms the complete current automated suite passed. M4-04 now reports: "Authenticated synthetic Encoder reached the real student-scope guard; the out-of-scope reset was denied before the user-account sheet was read." This closes the previously failing M4-04 automated check and confirms the authentication-harness correction reached the Apps Script runtime.

The execution also confirms:
- M1-01–M1-02: student self-edit allow-list acceptance and protected-field rejection.
- M2-01–M2-02: direct backup/retention invocation rejected without installed trigger identity.
- M3-01–M3-04: logo ID, approved-folder helper, MIME and sharing-access helper checks.
- M4-01–M4-04: grade/section scope, fail-closed scope properties, account property-key collision checks and reset endpoint scope enforcement.
- M5-01–M5-06: invalid-session endpoint rejection and the specified controlled role/scope harnesses.
- M6-01: unauthenticated report endpoint rejection and mutation denial.
- M7-01–M7-07: cutover gate, payload chunking, duplicate-key rejection, gallery validation, public schema allowlist, section-card validation and media-recovery candidate selection.

This 26/26 execution supersedes the earlier 25/26 execution at 2026-11-14T13:52:08.771Z as the current automated-suite result. The earlier failure remains historical evidence of the M4-04 test-harness defect and its correction; do not combine results across executions.

**Important coverage boundary:** M4-04 uses a controlled endpoint harness with synthetic authentication, scope and student lookup dependencies. It verifies the real `assertStudentScope_()` implementation and that the Users row reader is not reached for the out-of-scope fixture. It does not replace testing with real synthetic Encoder accounts and actual development-sheet records. Similarly, M3 helper tests do not prove actual Drive folder membership, ACLs or cache invalidation; M5/M6 helper and invalid-token tests do not close the authenticated role-by-role, direct-call, export and data-minimization matrix; M7 helper tests do not prove browser workflows or Drive failure/recovery side effects.

**Current release status:** Automated acceptance is green at 26/26. The five manual evidence gates below remain OPEN and mandatory:
1. **M3:** Verify the real approved branding folder, valid image selection and login-page cache invalidation using development Drive objects.
2. **M4:** Exercise every scoped endpoint using real synthetic Encoder accounts, including mixed in-scope/out-of-scope IDs and before/after row evidence.
3. **M5:** Complete the authenticated role-by-role dashboard, College, student-care, direct-call, helper-endpoint and field-minimization matrix.
4. **M6:** Exercise every report, analytics, drill-down, export, history and saved-configuration endpoint for each applicable role.
5. **M7:** Complete browser editor/public-reader/media acceptance, including draft/review/publish/rollback and controlled Drive failure/recovery tests.

Do not mark M1–M7 fully closed solely on the strength of the 26/26 automated suite. Keep `WP_PUBLISH_CUTOVER_READY_ = false`. Do not change production triggers, deploy, publish, roll back production content, or enable the cutover without the remaining evidence and explicit owner approval.


## 11. Manual acceptance execution protocol — evidence packet

This section converts the five remaining manual gates into repeatable test cases. Execute only in a disposable Apps Script development copy with synthetic records and non-production Drive folders. Do not use real student personal data, production Drive assets, production triggers, or production deployment URLs. Record the Apps Script project ID, spreadsheet ID, Drive folder IDs, test-account usernames, test timestamp and operator in the evidence packet; redact tokens and credentials.

For every case, record: **PASS/FAIL/BLOCKED**, exact endpoint or UI path, test identity/clearance, synthetic record IDs, expected result, observed result, before/after row counts or hashes where applicable, Apps Script execution log reference, screenshot or exported evidence reference, and cleanup result. A test is PASS only when the observed result and side-effect checks both match the expected result. An unrun test is BLOCKED, not PASS.

### M3 — approved branding Drive boundary and logo cache

**Development fixtures**
- One private, non-trashed approved branding folder configured in the development Script Properties key `MA_APPROVED_BRANDING_FOLDER_ID`.
- One private, non-trashed image directly inside that folder (PNG or JPEG; use a small synthetic test image).
- One private image in a different folder.
- One public/Anyone-with-link image in the approved folder.
- One unsupported SVG or non-image file in the approved folder.
- A development-only administrator account authorized to change the logo.

**Execution**
1. Confirm the configured folder ID resolves to the intended development folder; record its ID and sharing access. Confirm it is not the production branding folder.
2. As the authorized administrator, call the existing logo-selection flow with the valid direct-child image. Verify success and that the stored logo file ID equals the fixture ID.
3. Call the public logo retrieval path twice. Verify it returns a valid image data URI both times; retain the response metadata without copying the full data URI into the evidence document.
4. Replace the selected logo with a different valid synthetic image. Call retrieval again and verify the returned image corresponds to the newly selected file, proving the prior cached value was invalidated.
5. Attempt selection of the outside-folder image, publicly shared image, unsupported file and malformed ID. Each must be rejected. After each denial, verify the configured logo Script Property remains unchanged.
6. Remove the approved-folder configuration in the disposable copy and verify selection fails closed. Restore the correct development-only value afterward.
7. Restore the original development test logo or clear the test property and remove test fixtures after evidence is captured.

**Expected:** only a valid, private, direct child of the configured approved branding folder is selectable; invalid attempts do not mutate the property; logo changes invalidate cached retrieval. No public-sharing change is made to a file as part of testing.

**Evidence:** folder configuration screenshot, folder/file sharing dialogs, fixture MIME and parent listing, before/after Script Property value (redact unrelated properties), retrieval result metadata, cache invalidation result, and execution logs.

### M4 — real Encoder mixed-record scope

**Development fixtures**
- One synthetic Encoder administrator with a unique username and a valid assignment containing at least two grade/section pairs.
- Synthetic students: one in each assigned pair, one in an unassigned section of an assigned grade, one in an unassigned grade, one with a blank section, and one with a malformed/missing grade.
- A separate synthetic student portal account linked to the out-of-scope student for the reset test.
- A Full or Manager test account for comparison. Never reuse a real staff account.

**Execution**
1. Log in as the Encoder using the normal authentication flow. Confirm the displayed identity and assignment.
2. Exercise student search with no filters, each assigned grade/section pair, and explicit unassigned grade/section filters. Verify only assigned records are returned; direct filters must not widen scope.
3. Call `getStudent` directly for each fixture ID. Assigned records may return only fields allowed by the student-detail contract; every out-of-scope, blank-scope and malformed-scope record must be denied or indistinguishably absent.
4. Call `saveStudent` for one assigned synthetic student using an allowed field; verify only that row/field changes. Attempt the same operation for each out-of-scope student and verify denial plus unchanged before/after row hashes.
5. Exercise every other endpoint that accepts a student ID or returns student collections, including dashboard drill-downs, temporary grants, ID-card learner data/updates, status email dispatch and account reset. For each, test one assigned and one unassigned ID. For list endpoints, verify every returned ID is assigned.
6. Specifically call `resetStudentAccount` for the out-of-scope student's portal account. Verify a denial and confirm the Users sheet row, password/reset state, sessions and audit rows remain unchanged. Then use an assigned synthetic account only if a reset is needed to verify the allowed path; restore or delete that disposable account afterward.
7. Remove the Encoder assignment, then test malformed and empty assignments. Each must fail closed. Restore the intended development assignment after testing.
8. Repeat selected list/detail operations as Full and Manager and verify their existing unscoped access remains unchanged.

**Expected:** every student-bearing endpoint enforces the same grade/section boundary before sensitive reads or writes; an explicit ID cannot bypass the assignment; Full/Manager behavior is preserved.

**Evidence:** test-account clearance/assignment, fixture roster, endpoint-by-endpoint input/output ID matrix, before/after row hashes for denied writes, Users/session state before/after reset denial, and execution logs.

### M5 — authenticated role and data-minimization matrix

Create synthetic accounts for **Full, Manager, Encoder, Guidance, Accounting, Academic, HeadTeacher, Teacher and Student**. Use a fresh private browser profile per role. Keep the account credentials in the secure test vault, not in this runbook.

For each role, test all relevant dashboard and direct-call surfaces, not merely navigation visibility:
- Admissions dashboard: `dashboard`, `dashboardExtra`, `dashboardDemo`, `dashboardSpec`, student search/detail/update and any dashboard drill-down.
- College: `collegeDashboard`, `collegeRoster`, `getCollegePrograms`, and `saveCollegeProgram`.
- Student care: temporary grant, ID-card retrieval/read/update, enrollment status email, student account reset and related helper calls.
- Notifications and scholarships: verify office/Academic responses do not contain admin learner counts or school-wide registration/consent totals.
- Website publishing: separately verify the website content permissions and editor routes; a dashboard role must not imply publishing rights.

**Expected role outcomes**
- Full: existing full administrator access.
- Manager: preserve existing Manager read access and existing allowed operations exactly; do not grant College program mutation if the endpoint is Full-only.
- Encoder: only assigned grade/section student records and the limited admissions dashboard; no College data and no report module.
- Guidance, Accounting, Academic, HeadTeacher and Teacher: no admissions admin dashboard/report/student-care or College roster data through direct calls; their independently assigned module access must continue to work.
- Student: only the explicitly permitted student self-service routes and allow-listed self-edit fields.

For every denied direct call, verify both the response and that protected Sheets/Drive/mail queues were not read or mutated where that boundary is required. Inspect returned JSON for hidden fields even if the UI does not render them. Compare response keys and representative values against the least-privilege field contract. Attempt direct navigation to hidden pages and invoke the server function from the browser console; client-side hiding is not authorization.

**Evidence:** role/account matrix with each endpoint marked PASS/FAIL, sanitized response-key snapshots, representative denied-call execution logs, before/after protected-row hashes, and confirmation that each role's unrelated permitted module still works.

### M6 — reports, drill-down, export and history matrix

Use synthetic records only. Run the following as Full, Manager, Encoder, Guidance, Accounting, Academic, HeadTeacher and Teacher:
- Report landing/home and report catalogue.
- Every report type and filter combination available in the UI.
- Analytics summaries and each drill-down path.
- Preview and report-log/history retrieval.
- Export/download paths and any alternate direct server endpoint used by the UI.
- Saved favorites, report configuration create/update/delete, and report history.
- Invalid, expired and missing session-token direct calls.

**Expected:** Full and Manager retain their established report permissions; Encoder and roles outside the report authorization policy are denied before report data is returned; denied mutations do not write preferences, configurations, logs or history. Export responses must be checked independently from preview responses. Verify that filenames, metadata, formulas and hidden export columns do not leak fields absent from the role's report contract.

**Evidence:** report-type × role matrix, sanitized preview and export key/column lists, download artifact checksums, configuration/history before/after snapshots, and Apps Script execution logs. A successful page render alone is not sufficient evidence for export authorization.

### M7 — browser publishing, public-reader and Drive recovery acceptance

Run the full workflow on a disposable deployment connected only to the development spreadsheet and development Drive folders. Do not enable the production cutover constant.

**Editor and authorization**
1. Sign in with a user holding website content edit permission and open every migrated entry point: About, public blocks, section cards, homepage settings, page intros/banners and all gallery pages.
2. Verify the shared versioned workspace opens, loads the expected draft, and does not expose legacy live-write controls.
3. Attempt edit, review, approve, publish and rollback actions using accounts with and without the corresponding permissions. Verify each action is authorized server-side.
4. Make a draft change, navigate away and trigger unsaved-change protection. Verify the draft is not silently discarded.
5. Verify content allowlists, text limits, link safety, duplicate gallery references and portal-only key rejection through the UI and direct server calls.

**Media lifecycle**
6. Upload synthetic JPEG, PNG and WebP images. Verify client resize limits, private staging location, owner metadata and draft reference validation.
7. Attempt unsupported MIME, malformed ID, duplicate reference, another user's staged asset and unreferenced asset. Verify rejection and no publication.
8. Approve a draft using the required independent reviewer identity. Verify the creator cannot self-approve where separation of duties is required.
9. In the development copy only, exercise a successful publish after the cutover gate has been deliberately enabled in an isolated disposable clone with all prerequisites met. Verify media promotion, published pointer, immutable version payload, audit entry and public cache invalidation.
10. In a separate disposable clone, inject failures at each supported media promotion/publication boundary: before move, after move but before metadata update, during sharing/permission update, before pointer commit and after pointer commit. Verify retry/recovery behavior, no currently published asset is privatized, no duplicate metadata is silently selected, and post-pointer failures produce an explicit reconciliation warning.
11. Verify public readers (homepage, About, galleries and public images) resolve only the published snapshot in the cutover-enabled clone. Confirm drafts and staged media are never visible to anonymous readers.
12. Exercise rollback to a previously published/archived version in the isolated clone and verify pointer, status, audit and public cache behavior.

**Cutover isolation rule:** The checked-in branch constant remains `WP_PUBLISH_CUTOVER_READY_ = false`. If a cutover-enabled test is necessary, make a separate disposable clone and change the constant only in that clone. Never commit that temporary change or deploy it to production. The branch under review must remain fail-closed.

**Evidence:** browser screenshots/video, role and permission used for each action, version IDs and status transitions, before/after public-reader output, Drive file IDs/parent/sharing state, audit rows, cache verification, injected failure point and recovery result, and cleanup log.

### Manual gate closure record

Do not mark a gate closed until every applicable case above has an evidence reference and a reviewer has checked the artifacts. Record the closure here only after the user supplies or independently confirms the evidence:

| Gate | Required evidence | Status |
|---|---|---|
| M3 | Real development Drive folder/file membership, ACL, valid image retrieval and cache invalidation | OPEN |
| M4 | Real Encoder account mixed-ID endpoint matrix and before/after side-effect evidence | OPEN |
| M5 | Authenticated role × endpoint matrix and response data-minimization evidence | OPEN |
| M6 | Authenticated report × role matrix including exports, history and saved configurations | OPEN |
| M7 | Browser end-to-end publishing/media workflow and injected Drive recovery evidence | OPEN |

The current 26/26 automated execution does not change these statuses. `WP_PUBLISH_CUTOVER_READY_ = false` remains mandatory until the five manual gates are closed and the owner explicitly approves release.


## 12. Source-level execution notes for the manual reviewer

The following observations were verified against the current `Code.gs`, `Security.gs` and `WebsitePublishing.gs` source on this branch. They guide the manual tests but are **not substitutes for runtime evidence**.

### M4 source checkpoints
- `studentSearchScope_(u)` returns unrestricted scope only for Full and Manager. Encoder scope is loaded from the username-specific Script Property after collision detection; missing or malformed scope throws.
- `studentWithinSearchScope_(scope, student)` requires an exact grade membership and exact section membership for scoped users. A missing/blank section is not implicitly granted.
- `searchStudents` filters the student collection by scope before applying user search/status/grade/year filters. An explicit grade outside the assignment is rejected.
- `getStudent` resolves the requested row, then checks the returned record against scope before audit enrichment, account lookup, decoration and return. The manual test must verify that no out-of-scope details are returned.
- `saveStudent` checks an existing record against scope before constructing the update and checks the resulting grade/section against scope before writing. New student records must also resolve to an assigned grade/section before they are written. The manual test must prove denied updates/creates leave the Students sheet unchanged.
- `resetStudentAccount` checks the target student's scope before searching the Users rows, as confirmed by automated M4-04.

**Reviewer caution:** `getStudent` must read the target student row to discover its grade/section before it can decide whether the requested ID is in scope. The security boundary is that no out-of-scope student details, related user account, audit enrichment or mutation is returned/performed after that lookup. Do not incorrectly report the initial row lookup itself as proof of a leak; verify the actual response and subsequent side effects.

### M5 source checkpoints
- `who_(token, 'admin')` rejects office and Academic clearance accounts for admin-console calls.
- `assertAdminConsoleRole_(...)` is applied to the admissions dashboard/report/student-care surfaces identified in the earlier sections; verify direct server calls rather than relying on menu visibility.
- College routes use the separate College administrator guard. Test Manager and Full separately, and verify mutation permissions independently from read permissions.
- Student self-service remains a separate path; verify its field allowlist and identity lock rather than assuming admin-console role behavior applies to it.

### M7 source checkpoints
- Draft content saves require `website.content.edit`, an editable Draft/Changes Requested version, and matching draft creator.
- Gallery saves validate page, item count, unique asset IDs and caption length before saving the new draft payload.
- Publish requires `website.content.publish`, an Approved version and the cutover constant. Rollback separately requires `website.content.rollback` and the cutover constant.
- Media promotion validates the referenced asset metadata and distinguishes staged, promoting, recovery-required and published states. The manual injected-failure sequence is still required to prove Drive-side effects and retry behavior.
- The branch constant remains disabled. Any test that needs it enabled must occur in a separate disposable clone, never in this branch or a production deployment.

These source notes were added to make the manual evidence reviewer more precise; they do not change the OPEN status of M3–M7.


### Additional M4/M5 endpoint coverage identified during module audit

The module-by-module source inventory also identified the following student-bearing endpoints that must be included in manual evidence:

- **Holds / Flags (`Flags.gs`):** `flagSearch`, `flagList`, `holdsOverview`, and the Encoder-capable `grantTemporary`. Verify Encoder search/list/overview results are restricted to assigned students and that `grantTemporary` denies an out-of-scope ID without changing the Students or Status Log sheets. The office-specific Holds Desk is a separate narrow workflow: Guidance/Accounting/Academic users may search minimal learner identifiers and operate only their office's hold records; they must not receive unrestricted full student records through `getStudent` or admissions dashboard routes.
- **ID cards (`IdCard.gs`):** `idCardData`, `saveIdNumber`, and `saveIdPhoto` enforce the per-student scope after resolving the target record. Test each with assigned and unassigned IDs; denied writes must leave ID number, photo ID and Drive files unchanged.
- **Mail queue (`MailQueue.gs`):** `emailStatus` resolves selected student rows and asserts scope for every selected row. Submit mixed assigned/unassigned IDs; the request must fail without queueing or sending any message. Verify no partial send occurred.
- **Account reset (`MailSwitch.gs`):** `resetStudentAccount` must deny an out-of-scope target before reading the Users sheet, as covered by M4-04 automated harness and to be confirmed with actual development records.
- **Dashboard specification (`DashboardSpec.gs`):** `dashboardSpec` must aggregate only rows in the Encoder's assigned scope, including recent-registration and chart series. Confirm College figures are absent for Encoder.
- **Admissions reports (`Report.gs`):** Encoder is denied report access; Full/Manager retain report access. Verify direct calls and exports independently.

The office Holds Desk is not a blanket exception to the admin-console boundary. Its permitted narrow functions must be tested separately from the prohibited full-record, admissions dashboard, College and reports endpoints.


## 13. Mail queue append concurrency hardening

On 2026-11-14, `MailQueue.gs` was updated so every queue append uses `mqAppendRows_()`, which acquires the same ScriptLock used by `processMailQueue()` before calculating the next row and writing the batch. The single-message `queueMail_()`, multi-message `notifyMany_()`, `queueMailMany_()`, and the manual `emailStatus()` path now share that serialized append path. This closes the race where concurrent producers could read the same `getLastRow()+1` and overwrite one another, and prevents the sender from deleting rows while an append is in progress.

Development-copy verification:

1. Confirm all queue producers call `mqAppendRows_()` and there are no direct producer writes using `getLastRow()+1`.
2. Submit multiple concurrent synthetic queue requests, including two bulk requests, and compare the number and exact contents of queued rows with the number submitted.
3. Run `processMailQueue()` concurrently with queue submissions. Confirm appended rows remain present and are not deleted as part of the sender's earlier read batch.
4. Force a temporary lock timeout in the disposable copy. Confirm `queueMail_()` and `notifyMany_()` log the failure without throwing into their caller, while `queueMailMany_()` returns a controlled failure through its calling endpoint.
5. Confirm quota reserve, maximum batch size, stale-message expiry and retry behavior remain unchanged.

This change provides serialized queue mutation, not exactly-once email delivery. A provider-success / sheet-delete failure can still result in a later duplicate send; the development test must record that delivery boundary rather than asserting exactly-once semantics.
