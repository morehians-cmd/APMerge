# Moreh Academy Portal — Permission Catalog and Migration Plan

**Target:** Existing integrated Apps Script + Sheets application on branch website-pages-fixes. This is a specification only; no production deployment or live permission changes are authorized.

## Approved decisions

- System Manager is a custom role.
- Website publishing is separate from general management.
- Student self-editing is limited to a server-side allow-list.
- Individual allow/deny permission overrides are supported.
- Academic access is shared across HeadTeacher and Teacher, with assigned data scope.
- Existing Manager access must be preserved exactly when first migrated.
- Applicants submit admission requirements physically. The portal displays checklist/status; authorized staff record receipt. No applicant document uploads.
- Production deployment requires separate approval.

## Authorization rules

Every server endpoint must authorize independently; hiding a button is not security. Resolve permissions in this order: explicit user override, role-template permission, then deny. An explicit deny overrides a role allow. Overrides apply only to their exact permission key and are audit logged with actor, target, old/new value, reason, and timestamp.

The System Manager template must be initialized from a captured snapshot of the current legacy Manager effective access. Keep legacy Manager accounts compatible with that snapshot until individually migrated. Do not silently reduce or expand their access.

## Permission definitions catalog

| Key | Capability |
|---|---|
| portal.dashboard.view | View role-filtered dashboard |
| students.search | Search only records within authorized scope |
| students.view.own | View the authenticated student's own record |
| students.view.scoped | View records in assigned grade/section/office scope |
| students.view.all | View all student records |
| students.create | Create student records |
| students.update.general | Edit permitted general student fields |
| students.update.requirements | Record physical requirement receipt/verification |
| students.update.status | Change admission/enrollment status |
| students.delete | Archive/delete student records |
| students.export | Export only records within authorized scope |
| reports.daily.view | View daily admission report |
| reports.general.view | View non-daily reports |
| reports.sensitive.view | View demographic/sensitive reports |
| academics.dashboard.view | View shared academic dashboard |
| academics.records.view | View academic records within assigned scope |
| academics.records.update | Update academic records within assigned scope |
| enrollment.holds.view | View enrollment holds within assigned scope |
| enrollment.holds.manage | Create, clear, or authorize enrollment holds |
| users.view | View staff accounts |
| users.create | Create staff accounts |
| users.update | Update staff account properties |
| users.disable | Disable staff accounts |
| settings.view | View system settings |
| settings.update | Change system settings |
| website.content.view | View editable website content |
| website.content.edit | Save website drafts |
| website.content.publish | Publish an approved website version |
| website.media.manage | Manage approved website media |
| branding.logo.manage | Change portal branding logo |
| security.audit.view | Read audit/security logs |
| security.accounts.manage | Manage authentication/security controls |
| maintenance.backup.run | Run an immediate backup |
| maintenance.retention.review | Preview retention candidates |
| maintenance.retention.run | Execute retention disposal |

Permissions are granular. Website publishing is not implied by content editing or by System Manager. Media management is also a separate grant.

## Role template matrix

| Domain | Full Administrator | System Manager | Encoder | Guidance / Accounting | HeadTeacher / Teacher | Student |
|---|---|---|---|---|---|---|
| Dashboard | All | Custom | Minimized | Office scope | Shared academic scope | Own |
| Student search | All | Custom | Limited scope | Office scope | Academic scope | Deny |
| Student records | All | Custom | Limited scope | Office fields/workflow | Academic scope | Own only |
| General editing | Allow | Custom | Scoped | Office-specific | Academic-specific | Own allow-list |
| Requirements | Allow | Custom | Explicit staff grant | Admissions/registrar grant | Deny unless assigned | Read-only |
| Status changes | Allow | Custom | Scoped | Office-specific | Deny unless assigned | Read-only |
| Reports | All | Custom | Daily only if explicitly retained | Deny by default | Academic reports | Deny |
| Academic functions | All | Custom | Deny by default | Deny by default | Shared academic template | Own view where supported |
| User management | Allow | Deny by default unless individually granted | Deny | Deny | Deny | Deny |
| System settings/security | Allow | Deny by default unless individually granted | Deny | Deny | Deny | Deny |
| Website edit | Separate grant | Separate grant | Deny | Deny | Deny | Deny |
| Website publish | Separate grant | Separate grant | Deny | Deny | Deny | Deny |
| Audit/maintenance | Restricted owner grants | Custom/read-only default | Deny | Deny | Deny | Deny |

Full Administrator maps to the existing Full clearance during transition. System Manager is a new custom template. Legacy Manager must retain its captured effective permissions until explicit conversion. Encoder, Guidance, Accounting, HeadTeacher, Teacher, and Student keep their existing account identities until their endpoint audit is complete. Academic roles share a template but are restricted by assigned scope. Students never receive staff permissions; own-record access derives from the authenticated account's StudentID.

## Seven mandatory remediation findings

| ID | Finding and current source observation | Closure evidence |
|---|---|---|
| M1 | Student self-edit: Code.gs contains STU_EDIT_KEYS and stuCan_(). The allow-list includes personal/contact/family/previous-school/guardian fields; requirement fields are excluded. | Negative tests prove students cannot change StudentID, LRN, grade/section, category, classification, status, any Req* field, certificate numbers, or staff-only fields. |
| M2 | Scheduled jobs: Protection.gs dailyBackup(e) and Retention.gs monthlyRetention(e) call triggerAuthorized_(); trigger UIDs are stored by their installer functions. | Verify live trigger UID/property match; direct browser/editor calls without event UID fail; test trigger execution and failure alerts. |
| M3 | Logo mutation: Code.gs setLogoFile() uses ownerOnly_(), validates ID syntax, trash state, MIME type, and size. Source search found no browser caller in Index.html; intended path is an editor-run utility. | Confirm actual Drive location/approved branding folder, verify editor-only invocation in the deployed script, enforce approved-folder membership and validate image content; verify cache invalidation. |
| M4 | Student search and staff actions: grade/section scope now applies to search, direct record view/save, admin dashboard/extras, notifications, scholarship counts, Holds search/list/overview/temporary enrollment, bulk status updates, status emails, ID-card lookup/mutations, and selected-student re-enrollment. Full and Manager retain unrestricted legacy behavior. | Run negative tests for each endpoint with scoped and unscoped Encoder accounts, including mixed in/out-of-scope bulk IDs; verify office/academic paths and alternate student-bearing endpoints. |
| M5 | Dashboard source review: main dashboard/extras require admin-role access; Encoder data is grade/section scoped; demographic dashboard data is Full/Manager only; academic users use the separate Academic module with grade/advisory/teaching-load checks; Student record access is forced to the signed-in StudentID; office users use Holds/desk functions; College dashboard/roster/program endpoints now deny Encoder while retaining legacy Full/Manager view and Full-only edit. | Complete the UI-to-endpoint inventory and run role-by-role negative tests (including direct browser invocation) for Admin, Manager, Encoder, Academic, office, and Student; verify field minimization and helper endpoints. |
| M6 | The previous Encoder-only daily exception in Code.gs conflicted with Report.gs, which denies Encoders. The exception is now removed: Encoder access is denied consistently across report() and the newer report endpoints. Full/Manager legacy report access remains. | Test every report endpoint/type for Full, Manager, Encoder, Academic, office, and Student; confirm UI controls match backend denial and no drill/export endpoint remains exposed. |
| M7 | Website workflow: Public.gs and Content.gs content-save methods currently use owner_(), which permits Full and Manager. | Preserve published content; introduce draft/review/publish states; require separate website.content.publish grant; verify Manager does not receive publish by default after explicit migration. |

### M4 implementation note — explicit Encoder search scope

The current implementation in `Code.gs` preserves unrestricted legacy search for `Full` and `Manager`, while requiring an explicit Script Property for each `Encoder`. The property name is `STUDENT_SCOPE_<normalized-username>` (lowercase; characters outside letters, digits, period, underscore, and hyphen become underscores). Its value is JSON in this shape:

```json
{
  "grades": ["Grade 1", "Grade 2"],
  "sections": {
    "Grade 1": ["A", "B"],
    "Grade 2": ["C"]
  }
}
```

Only listed grades and listed sections are returned. To include unassigned-section students for a grade, include the empty string in that grade's section list. Missing, malformed, or empty assignments fail closed. Grade and section names must match the canonical student record values. Configure these properties manually in Apps Script Project Settings > Script Properties only after the school confirms each Encoder's authorized grade/section scope.

The Encoder grade/section scope now applies to `searchStudents`, `getStudent`, `saveStudent`, `dashboard`, `dashboardExtra`, notifications, scholarship counts, Holds search/list/overview/temporary enrollment, bulk status updates, status emails, ID-card lookup/mutations, and selected-student re-enrollment. Report access is denied consistently to Encoders; the former daily exception is removed. Every Encoder requires an explicit scope property; missing or invalid assignments fail closed. Full and Manager behavior remains unchanged. This is source-level enforcement only: M4 is not certified until negative tests are run against each endpoint with real scoped accounts.

## Migration sequence and release gates

### Gate 0 — Baseline
1. Record branch commit and live Apps Script version.
2. Snapshot role/clearance values and effective legacy Manager permissions. Do not copy password hashes into working documents.
3. Inventory all callable server functions and map each to permission keys.
4. Snapshot website content and relevant Script Property names before migration.

### Gate 1 — Additive storage
1. Add permission definitions, role templates, and user overrides without shifting existing sheet columns.
2. Store override account, permission key, allow/deny, reason, actor, and timestamp.
3. Seed System Manager from the captured Manager baseline.
4. Keep legacy authorization as compatibility fallback until endpoint migration is complete.

### Gate 2 — Backend authorization
1. Implement one server-side permission resolver with deny-by-default behavior.
2. Migrate endpoints by domain, not by UI screen.
3. Filter records before returning them; never depend on client-side hiding.
4. Keep trigger-only maintenance authorization separate from portal permissions.
5. Keep owner/editor emergency functions outside normal browser-callable authorization.

### Gate 3 — Website publishing
1. Preserve current public content as the initial published version.
2. Save edits as drafts without changing the live public version.
3. Require review before publish.
4. Require website.content.publish explicitly; do not grant it automatically to System Manager.
5. Audit editor, reviewer, publisher, and publication time; retain version history.

### Gate 4 — Test and migrate
1. Run positive and negative endpoint tests for every template and override.
2. Test student own-record isolation and forbidden field changes.
3. Test search, dashboard, export, and report scopes.
4. Test draft/review/publish against the pre-migration public-content baseline.
5. Verify live backup/retention trigger IDs and direct-call rejection.
6. Migrate accounts in controlled batches only after tests pass.
7. Deploy only after explicit owner approval.

## Current source configuration

The Apps Script manifest uses V8, Asia/Manila, executes the web app as the deploying user, and allows anonymous transport access. Public pages and registration need that public entry point; every sensitive server method must therefore authenticate and authorize independently.

Source inspection also confirms:
- getStudent() forces Student accounts to their own StudentID and blocks office/academic accounts from full-record access.
- saveStudent() applies stuCan_() for Student accounts; Req* fields are not in the student allow-list.
- Encoder student scope is enforced across the endpoints listed in the M4 implementation note; live negative tests remain outstanding.
- Website content writes still use legacy Full/Manager authorization and still write directly to live content; separate draft/review/publish is not implemented.
- setLogoFile() has no browser caller found in Index.html and remains an editor-run utility, but does not prove approved branding-folder membership.
- backup/retention source handlers validate installed trigger event UIDs, but live trigger state remains unverified.

## Follow-up source audit — 2026-11-14

This section records source observations from the current `website-pages-fixes` branch. It is not a substitute for execution tests against the bound Apps Script deployment.

### Dashboard and student-data endpoint inventory

| Endpoint / path | Current source gate or filtering | Remaining verification |
|---|---|---|
| `searchStudents` | Admin session plus `studentSearchScope_()`; result rows and bulk IDs are scope-filtered | Test each clearance, mixed-scope bulk IDs, and malformed/missing Script Properties |
| `getStudent` | Student forced to own StudentID; admin-role path applies `studentSearchScope_()`; other staff paths retain their existing restrictions | Direct-call negative tests for cross-student IDs |
| `saveStudent` | Student writes use `stuCan_()`; admin-role writes validate both existing and resulting grade/section scope | Attempt forbidden identity, academic, status, requirement, audit, and certificate fields |
| `dashboard` / `dashboardExtra` | Admin-role gate; student aggregates filtered by scope; Encoder demographic/category panels minimized | Verify payload fields for Full, Manager, Encoder and confirm office/academic denial behavior |
| `dashboardDemo` | Explicitly denies Encoder, office clearances and academic roles | Verify no alternate demographic endpoint bypasses this gate |
| `getNotifications` | Academic roles receive an empty result; admin-role student counts are scope-filtered; Encoder consent count is suppressed | Verify office-role behavior and notification deep links against actual UI navigation |
| `getScholarships` | Admin-role applicant counts are scope-filtered; non-admin paths retain their existing behavior | Verify returned scholarship metadata and counts by role |
| Holds, ID-card, bulk status and re-enrollment paths | Scope checks are present in the relevant backend paths and documented in the M4 implementation note | Exercise each mutation/read path with both in-scope and out-of-scope IDs |
| College dashboard/roster/program paths | Encoder is denied; legacy Full/Manager read behavior is retained; edit path is Full-only | Verify each endpoint and the College UI independently |

### Report endpoint inventory

- `report()`, `reportsHome()`, `reportsAnalytics()`, `reportsDrill()`, `reportLog()`, `reportsPrefs()`, `saveFavorites()`, `saveReportConfig()`, `deleteReportConfig()`, and `reportHistory()` all require an authenticated admin-role session through `who_(token, 'admin')` directly or via `rpUser_()`.
- The actual report-data entry points reject Encoder clearance. `report()` additionally obtains `studentSearchScope_()`; the current resolver allows only Full/Manager unrestricted access or Encoder scope, and denies other clearances. Report endpoints therefore do not grant office or academic roles a student-report dataset.
- Report preferences/history are metadata and configuration endpoints, not report-data endpoints. They remain available to non-Encoder admin-role accounts under `rpUser_()`; report history is limited to the caller except Full, which can view all history. Saved report configurations are caller-owned or shared; only Full can modify/delete another user's saved configuration.
- `reportsSelfCheck()` is an editor-run diagnostic, not evidence of a completed test run. Its existence does not close M6.

### Website content write-path finding

The live public renderer currently reads the existing content stores directly. The following write endpoints still persist immediately to those live stores under legacy `owner_(token)` authorization: `saveBlock`, `saveAbout`, `saveHomepageContent`, `savePageIntro`, `savePageBanner`, `saveHomepageHero`, and `saveSectionCards` (including the `saveAboutCards` alias). This confirms M7 is a data-model and migration change, not a role-check-only patch. A safe migration must snapshot every affected key and media reference, add draft/review/published version storage, switch public readers only after the published baseline is seeded, and preserve an explicit rollback path. No live content was changed in this source audit.


### M7 complete content-store inventory and cutover contract

The current live website is not backed by one content record. Its public renderer reads a mixture of:

1. **Content sheet key/value records**
   - Legacy/public HTML blocks: `pubhome`, `pubabout`, `pubadmissions`, `pubacademics`, `pubcampus`, `pubforms`, `pubnews`, `pubcontact`, and the page-specific `pub_*` blocks listed in `PUBLIC_BLOCK_KEYS`.
   - Structured About page record: `about_data` (vision, mission, values, leadership names/titles, and photo IDs), plus legacy `about` HTML.
   - Homepage section content: `pubhome_content`.
   - Interior page intro overrides: `pubpage_intro`.
   - Interior page banner overrides: `pubpage_banners`.
   - Homepage hero: `pubhome_hero`.
   - Section-card records: `pub_about_cards`, `pub_admissions_cards`, `pub_academics_cards`, `pub_campus_cards`, `pub_forms_cards`, and `pub_news_cards`.
   - Enrollment guide: `guide` (also returned by the public feed).
2. **Other live data sources**
   - Events/announcements from the Events store.
   - Gallery and campus/facility photos from the existing gallery store.
   - School leader and About photos referenced by Drive file IDs.
   - Homepage, page-banner, and hero image URLs that may refer to Drive-hosted assets.
3. **Public cache surfaces**
   - Public feed cache `pubc_v1_<date>`, About cache `puba_v1`, individual photo caches, and the cache invalidation helper. A publish must invalidate every affected public cache after the published pointer changes.

### Required versioned publishing model

Use a dedicated additive store; do not repurpose or overwrite the current Content sheet records.

- **Website Versions**: immutable version rows with `VersionID`, `ParentVersionID`, `Status` (Draft, InReview, ChangesRequested, Approved, Published, Archived), `CreatedBy`, `CreatedAt`, `UpdatedBy`, `UpdatedAt`, `ReviewedBy`, `ReviewedAt`, `ReviewNotes`, `PublishedBy`, `PublishedAt`, `PayloadJSON`, and `PayloadHash`.
- **Website Publishing Config**: one controlled pointer to the currently published version, current schema version, migration baseline ID, and migration state. The published pointer is the only source-selection switch for public reads.
- **Website Publishing Audit**: append-only action history with actor, action, version, timestamp, and reason. Do not store applicant/student data in these records.

A version payload must be a complete, schema-validated snapshot of every content domain above, including stable Drive file IDs/URLs and the event/gallery references that the public site currently displays. Events and galleries that remain operational records should be referenced by stable IDs and not copied into editable website prose. Their inclusion/exclusion must be explicit in the payload schema.

### Permission and state transitions

- `website.content.edit`: create/update Draft versions. Existing Full/Manager legacy write access must not silently become a grant to this new permission.
- `website.content.review`: move Draft to InReview, then Approved or ChangesRequested. Reviewer cannot approve their own draft.
- `website.content.publish`: publish only an Approved version; separate from edit/review and default-deny. System Manager does not inherit this automatically.
- `website.content.rollback`: restore a previously published immutable version through a new audited publication event; never mutate historical rows.
- Public readers: anonymous read of the one published version only. Draft/InReview/Approved content must never be returned by public endpoints.
- Existing legacy write endpoints must be converted into draft mutations before any new role grants are activated. During migration they must not bypass the draft workflow.

The exact per-account permission grants must be seeded only after the existing user/clearance inventory and legacy Manager snapshot have been captured. The publishing permission must be independently assignable; do not hard-code a clearance name as a permanent substitute for the permission catalog.

### Safe migration and rollback sequence

1. Run a read-only preflight that inventories every key and row, records row counts and hashes, captures all relevant Drive IDs/URLs, and checks that the snapshot can be serialized within Apps Script and Sheets limits.
2. Create the additive version/config/audit stores without modifying the live Content, Events, Gallery, or Drive records.
3. Seed a baseline version from the current live stores. Compare source and payload hashes; abort if any key, media reference, or structured record is missing.
4. Keep the public pointer unset until a complete baseline passes validation. While unset, public readers continue using the legacy live stores.
5. Route every editor save/reset operation to a draft version. This includes all legacy HTML block writes, About structured data and photos, homepage sections/hero, page intros/banners, and section cards. Photo uploads must remain unreferenced until a draft includes them; abandoning a draft must not trash assets referenced by the published version.
6. Convert public readers as one release unit to resolve the published payload, with legacy fallback only while the pointer is unset. Switch the pointer atomically after smoke tests pass.
7. Publish an approved test version and verify all public page routes, hero links, page intros/banners, section cards, About content, leader photos, and gallery/event integrations. Verify that a draft edit cannot alter public output.
8. Rollback by moving the published pointer to the previous immutable version and invalidating all relevant caches. Preserve both versions and audit the rollback.
9. Only after these checks pass, disable legacy direct-to-live writes. Keep a documented emergency rollback procedure.

### M7 implementation boundary

The source audit has completed the inventory and migration contract only. It has **not** created the version sheets, migrated any live content, changed public readers, or redirected existing editor saves. That restraint is intentional: a partial cutover would either expose drafts or make current content disappear. Implementation should proceed in additive stages with a complete snapshot and regression tests before the single public-reader cutover.

### Release-gate status

- M1: allow-list exists; negative field-tampering tests are not evidenced.
- M2: source trigger-UID checks exist; installed trigger ownership and event-UID behavior have not been verified in the live script.
- M3: `setLogoFile()` is editor-only and validates ID syntax, trash state, MIME type and size; approved branding-folder membership is not established.
- M4: broad source-level scope checks are present; endpoint-by-endpoint negative tests remain outstanding.
- M5: primary dashboards have role gates and scoped/minimized payloads; complete UI-to-endpoint testing and helper-endpoint review remain outstanding.
- M6: Encoder report-data access is consistently denied in the inspected report entry points; role-by-role execution tests and UI/export verification remain outstanding.
- M7: draft/review/publish separation is not implemented; existing live content writes remain in place.
- Part 5 / deployment: source files can be reviewed on this branch, but no production deployment, live Apps Script execution test, or production approval has occurred. This gate cannot be marked complete from repository inspection alone.

## Acceptance checklist

- [ ] Legacy Manager access snapshot captured and preserved exactly.
- [ ] System Manager seeded from that snapshot and independently customizable.
- [ ] Permission catalog/templates/overrides stored without shifting existing columns.
- [ ] Individual allow/deny overrides are audited and tested.
- [ ] Student forbidden-field tests pass, including every Req* field.
- [ ] Search, dashboard, report, and export scopes enforced server-side and negative-tested for every role.
- [ ] Academic roles share approved template and assigned data scope.
- [ ] Website edit, review, and publish are separate permissions and states.
- [ ] Existing public website content survives migration unchanged.
- [ ] Backup and retention trigger authorization verified in the live script.
- [ ] Non-production endpoint tests pass.
- [ ] Production deployment approved separately by the user.


### M7 source implementation audit — editor, media, and public-reader paths

The follow-up audit inspected the current branch copies of `Content.gs`, `Public.gs`, `Gallery.gs`, `Index.html`, `PublicHome.html`, `PublicPage.html`, `WebsitePages.html`, `HomepageHero.html`, `HomepageSections.html`, and `PageBanners.html`. This is a repository source audit, not a live Apps Script execution test.

#### Current editor write paths

| Content domain | Current server mutation | Current UI caller | Cutover requirement |
|---|---|---|---|
| HTML blocks, including legacy About and public page blocks | `saveBlock(token,key,html)` in `Content.gs` | `Index.html` guide/page editors and About legacy-text clear; `WebsitePages.html` page editor | Convert all keys to draft payload mutations; preserve sanitizer and allow-lists |
| Structured About page | `saveAbout(token,data)` in `Content.gs` | `Index.html` About editor | Draft JSON only; do not trash old live photos on save |
| About leader photo upload | `setAboutPhoto(token,dataUrl)` in `Content.gs` | `Index.html` About editor | Upload to private staging storage; attach asset reference to draft; no public exposure before publish |
| Homepage section text/cards | `saveHomepageContent`, `saveSectionCards` in `Public.gs` | `HomepageSections.html`, `WebsitePages.html`, and page editor integrations | Draft mutations; keep group-key validation and existing defaults |
| Interior page intro | `savePageIntro`, `resetPageIntro` in `Public.gs` | `PageBanners.html` | Save/reset draft values, not the live Content key |
| Interior page banner | `savePageBanner`, `resetPageBanner` in `Public.gs` | `PageBanners.html` | Save/reset draft values, not the live Content key |
| Homepage hero | `saveHomepageHero` in `Public.gs` | `HomepageHero.html` | Draft mutation; validate and stage referenced images |
| Homepage hero/About image upload | `uploadHomepagePhoto` in `Public.gs` | `HomepageHero.html` | Current implementation sets `ANYONE_WITH_LINK` immediately; replace with private staging and publish-time promotion |
| Gallery items | `addGalleryPhoto`, `setGalleryCaption`, `removeGalleryPhoto` in `Gallery.gs` | `Index.html` and `WebsitePages.html` | Gallery list changes must be versioned; remove/trash must be deferred until no published version references the asset |

The editor is distributed across the integrated `Index.html` and included HTML partials. There is no separate `Admin.html` in this architecture. The actual UI integrations include the About editor, page-block editor, homepage hero/sections editors, page intro/banner editor, and gallery editor. The M7 cutover must cover every caller, including aliases retained for old browser copies.

#### Media side effects that make a naive draft conversion unsafe

1. `uploadHomepagePhoto` creates a file in `PHOTO_FOLDER_ID`, applies `DriveApp.Access.ANYONE_WITH_LINK`, probes its thumbnail URL, and deletes the file on failure. A draft upload is therefore publicly shareable before review.
2. `setAboutPhoto` creates a Drive file in `PHOTO_FOLDER_ID`. The file is immediately returned to the editor, and the subsequent `saveAbout` stores the reference. The folder's inherited sharing and the public photo-serving path must be verified before defining staging ACLs.
3. `saveAbout` compares old and new leader-photo IDs and calls `setTrashed(true)` on old IDs no longer present. This is incompatible with immutable published versions: an older published version or rollback could still require that photo.
4. `addGalleryPhoto` immediately appends the file ID to the live `gal_<page>` Content key. Public facilities/history/page-photo endpoints read those live lists, so an uploaded gallery image can become public before review.
5. `removeGalleryPhoto` first removes the ID from the live gallery list and then trashes the Drive file. A published page can lose its image immediately, and a prior version cannot restore it from the trash reliably.
6. `saveBlock`, homepage section/hero saves, page intro/banner saves, and section-card saves currently write directly to the live Content key/value store. They are not draft-aware.
7. Cache invalidation is incomplete as a publication mechanism: `saveBlock` invalidates the daily public feed cache, while About save removes `puba_v1`; other website writes do not provide one centralized version-pointer/cache invalidation path. Individual photo caches use separate keys. The publish transaction must invalidate all affected keys after the pointer update.

#### Public read surfaces that must switch together

- `PublicHome.html` reads `getPublicContent`, `getHomepageHero`, and public HTML blocks.
- `PublicPage.html` reads `getPublicBlock`, page intro/banner data, section cards, About content/photos, history/facilities galleries, and public page photos.
- `Public.gs` contains the anonymous public data/photo endpoints, including `getPublicContent`, `getPublicAbout`, `getPublicBlock`, `getPublicFacilities`, `getPublicHistoryGallery`, and the associated public photo handlers.
- `WebsitePages.html`, `HomepageHero.html`, `HomepageSections.html`, and `PageBanners.html` contain the corresponding staff editor integrations.
- Events are read from the existing Events store via `evRows_()`; they remain operational records and should be referenced in the website snapshot only where a page's content configuration explicitly pins or selects them.
- Gallery records are stored as JSON under `gal_<page>` keys in the existing Content sheet. The gallery page aliases and the single-photo page limits must be preserved during migration.

#### Required media lifecycle for the versioned implementation

- A draft upload must create a private staged asset and an immutable asset record; it must not change any published gallery list, public URL, or sharing permission.
- A draft may reference an existing live asset without copying it. Existing assets must remain intact while any Published or rollback-retained version references them.
- Publishing must validate every referenced file, expected MIME type, size, folder ownership, and accessibility; only then may it make the required public assets available and atomically switch the published version pointer.
- Removing an asset from a draft must only remove that draft reference. Physical deletion/trashing must be a separate retention job after a reference scan proves that no published, approved, draft, or rollback-retained version needs it.
- Rollback must restore the previous version's exact references without depending on trashed files or mutable gallery lists.
- The preflight must inventory Drive IDs and URLs without changing permissions, moving files, or trashing anything.

#### M7 implementation decision after this audit

Do not yet add the version sheets or redirect editor writes. The remaining prerequisite is a complete, executable payload/asset schema and a read-only preflight that measures actual Content/Events/Gallery data and Drive references against Apps Script/Sheets storage limits. In particular, the source audit confirms that a version-only text snapshot is insufficient: media staging, publication ACL transitions, reference retention, and rollback-safe deletion must be designed as one coherent lifecycle. Existing public content and current editor behavior remain untouched until that complete implementation can be tested as one release unit.


#### Read-only preflight implementation added

A new additive server file, `WebsitePublishing.gs`, now provides `websitePublishingPreflight(token)`.

- Requires the existing Full administrator session through `sysOwner_(token)`; System Manager and all other roles are denied.
- Reads the existing `Content` and `Events` sheets directly and reads all configured gallery pages through the existing gallery reader.
- Reports duplicate Content keys, duplicate gallery IDs within a page, missing/trashed referenced Drive files, media metadata and parent folders, per-source SHA-256 hashes, and a combined candidate-payload hash/size.
- Reports a conservative 40,000-character chunk plan and whether the current candidate fits the conservative single-cell threshold.
- Does not create sheets, write rows, change Drive permissions, move/trash files, change gallery references, alter public caches, or switch public readers.
- If the Events sheet is absent, a source has duplicates, a referenced file is missing/trashed, or the payload exceeds the conservative single-cell threshold, baseline readiness is false and the report lists blockers.

This is an additive diagnostic only. It has been committed to the working branch but has **not** been executed in the live Apps Script project. Its runtime result is required before a baseline version can be seeded. The final version-store design must use chunked payload storage when the measured payload exceeds the Sheets cell limit; the preflight does not write any snapshot chunks.


### M3 logo mutation caller and trust-boundary follow-up

The current `setLogoFile(id)` implementation is in `Code.gs`. Repository inspection found no browser-side call to this function in `Index.html`; it is documented as a manual Apps Script editor operation. Its guard is `ownerOnly_()`, which compares the active user's email with the effective user, then validates Drive ID syntax, trash state, image MIME type, and a 68,000-byte maximum before writing the `LOGO_FILE_ID` Script Property and clearing `logo_v1`.

The public `getLogo()` endpoint reads that property and returns a bounded image data URI. The current implementation does not establish that the selected file belongs to an approved branding folder. The only known `PHOTO_FOLDER_ID` is explicitly used for student/staff and website photos, so it must not be assumed to be the approved logo folder. M3 therefore remains open: identify or create an approved branding folder under the school's control, inventory the currently configured logo ID and its parent folders, then add folder-membership validation and test the editor-only mutation path. No folder restriction was added because doing so before confirming the current logo location could break the live login page.
