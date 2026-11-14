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
| M3 | Logo mutation: Code.gs setLogoFile() uses ownerOnly_(), validates ID syntax, trash state, MIME type, and size. | Verify all callers are editor-only; enforce approved branding-folder membership and validate image content; verify cache invalidation. |
| M4 | Student search: searchStudents() calls who_(token,'admin') and returns a broad student result set to accepted admin-role users. | Enforce server-side scope per role; prove Encoder/office/academic accounts cannot enumerate out-of-scope records; exports and ID lists use identical filters. |
| M5 | Dashboard separation: dashboard endpoints have differing role checks and require an endpoint-by-endpoint payload audit. | Tests prove Admin, Academic, office, and Student payloads do not leak across role boundaries; academic results are scope-limited. |
| M6 | Reports: report() denies Encoders except when type is daily; other report endpoints use separate checks. | Decide whether daily exception remains; enforce explicit permission keys consistently in backend and UI; test every report type per role. |
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

This first M4 code change scopes the student search response and its bulk-action `ids` list. It does **not** yet authorize direct `getStudent`, `saveStudent`, report, dashboard, or export endpoints for Encoders. Those endpoints remain separate M4/M5/M6 remediation work and must be audited before claiming full closure. Existing Encoder accounts without an explicit property will temporarily see an authorization message rather than a broad school-wide search.

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
- searchStudents() still needs explicit per-role record-scope enforcement.
- website content writes currently use legacy Full/Manager authorization.
- setLogoFile() does not yet prove the selected file belongs to an approved branding folder.
- backup/retention source handlers validate installed trigger event UIDs, but live trigger state remains unverified.

## Acceptance checklist

- [ ] Legacy Manager access snapshot captured and preserved exactly.
- [ ] System Manager seeded from that snapshot and independently customizable.
- [ ] Permission catalog/templates/overrides stored without shifting existing columns.
- [ ] Individual allow/deny overrides are audited and tested.
- [ ] Student forbidden-field tests pass, including every Req* field.
- [ ] Search, dashboard, report, and export scopes enforced server-side.
- [ ] Academic roles share approved template and assigned data scope.
- [ ] Website edit, review, and publish are separate permissions and states.
- [ ] Existing public website content survives migration unchanged.
- [ ] Backup and retention trigger authorization verified in the live script.
- [ ] Non-production endpoint tests pass.
- [ ] Production deployment approved separately by the user.
