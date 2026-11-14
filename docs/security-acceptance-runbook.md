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
| `studentSearchScope_`, `studentWithinSearchScope_`, `assertStudentScope_` | Missing/malformed assignments fail closed; matching grade and section are both required. M4-03 invokes both the Encoder scope reader and website-permission reader under a synthetic collision table. The collision helper now detects distinct usernames that collapse to the same suffix and duplicate case-insensitive usernames, while allowing exactly one matching account row. The latest source change and expanded test have not yet been rerun in Apps Script. |
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

The website-permission property store uses the same legacy username-suffix normalization as Encoder scopes. The shared collision guard now rejects reads and permission assignments when distinct staff usernames collapse to one property key; verify this with two synthetic staff accounts before granting website capabilities. The automated M4-03 helper check covers collision detection, but the live staff-account/property behavior remains part of browser acceptance.



The source now includes M7-07 for pure candidate-selection behavior: `Staged` rows are ignored, `Promoting` and `RecoveryRequired` rows are selected, duplicate metadata is blocked, and assets referenced by the current published version are excluded from recovery. This helper test must be rerun in Apps Script after synchronizing the latest source; it does not exercise Drive operations or prove recovery success.
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

The earlier **2026-11-14T11:48:36.921Z, 20 passed / 0 failed / 20 total** execution remains historical evidence and predates M7-07 and the retryable media-recovery changes. It confirms the M4-03 behavior described in its result detail, but it is not the latest suite result and cannot override the 20/21 failure.

The 12:13:03 execution is the first supplied runtime result for the 21-check suite and failed M7-07. The duplicate-selector source fix and strengthened mixed-state duplicate assertion were committed afterward; they still require a fresh Apps Script runtime result. It does not establish the case-insensitive duplicate-account subcase unless that exact assertion is confirmed in the synchronized test source and execution output. It also does not close the five manual evidence gates, prove every role's data-minimization boundary, test the new website-media compensation path in Apps Script, or authorize publishing cutover or production deployment. Retain the returned JSON and Apps Script execution log with the release evidence.

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
- The subsequent retryable media-recovery update passed V8 syntax parsing for both `WebsitePublishing.gs` and `AcceptanceTests.gs`. Static checks confirmed `RecoveryRequired` persistence, retry selection for interrupted `Promoting` rows, duplicate-metadata blocking, exclusion of assets referenced by the current published payload, and explicit surfacing of unresolved assets. This remains source-level evidence only; the Apps Script Drive recovery endpoint and M7-07 have not yet been runtime-tested. Source inspection confirms all unpublished staged assets are journaled before sharing/location side effects, including assets already located in the approved folder after an interrupted earlier move; pre-pointer failures attempt to restore those assets to private staging, restore a failed version's `Approved` metadata and prior migration state, and write a compensation audit row. Post-pointer failures do not privatize media and instead return an explicit reconciliation warning. This is source-level verification only; Drive service behavior, partial-failure recovery, and publication sequencing remain untested in Apps Script.
- A local V8 helper harness passed the approved-folder membership and shared logo-MIME checks (M3-02/M3-03).
- A local V8 helper harness passed Unicode chunk reconstruction, duplicate content-key rejection, and gallery asset validation (M7-02/M7-03/M7-04).
- A local V8 schema harness confirmed 32 public block keys, 31 page-block mappings, six section-card groups, and 43 permitted content keys, with portal/internal keys excluded (M7-05).
- A local V8 sanitizer harness passed defaults, unsafe-link rejection, and title/description length limits for all six section-card groups (M7-06).

These local harnesses evaluate extracted pure helper functions; they do not execute runSecurityAcceptanceTests() inside Apps Script and do not verify Apps Script services, Drive ACLs, spreadsheet writes, authentication sessions, triggers, browser behavior, or deployment. The Apps Script runtime result is recorded in Section 3; the manual execution evidence described in Sections 2 and 3 remains mandatory for the release gates that are not covered by the automated suite.

## 5. Release gate

M1–M7 are closed only when the test evidence above is attached to the release record. Any failed, skipped, or unexecuted test remains open. Source syntax checks and self-check functions are supporting evidence, not substitutes for Apps Script runtime tests. Keep `WP_PUBLISH_CUTOVER_READY_` false and do not deploy to production until every applicable test passes and the owner explicitly approves release.
