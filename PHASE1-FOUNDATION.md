# Phase 1 — Foundation and Database

Status: implementation in progress. Development branch: `rebuild/admission-portal-phase1`.

## Scope decisions
- Requirement workflow: physical submission; portal records receipt/verification only.
- Initial scope: K–12 plus College.
- K–12 admission data is kept in the new admission database.
- College data remains a separate workbook/database boundary. Do not point the new College database property at the legacy workbook until its schema and migration are reviewed.
- No production deployment or live data migration is authorized.

## Source layout
Apps Script source is under `src/`; configure clasp `rootDir` as `src` in the local development workspace. No script ID is committed.

## Setup
1. Create a NEW development Google Spreadsheet.
2. Create a NEW standalone Apps Script project (or bind it to that development spreadsheet).
3. Import the contents of `src/` using clasp with rootDir `src`, or create the files in Apps Script editor.
4. If standalone, set Script Property `MA_DB_SPREADSHEET_ID` to the development spreadsheet ID. If bound, the active spreadsheet is used.
5. Run `initializeFoundation` from the editor and authorize Sheets access.
6. If using the College scope in this phase, create a SECOND blank development spreadsheet, set Script Property `MA_COLLEGE_DB_SPREADSHEET_ID`, then run `initializeCollegeFoundation`. This does not touch the legacy College workbook.\n7. Run `initializeDriveFoundation` from the editor and authorize Drive access.
8. Run `getFoundationStatus` and verify the tabs and schema version.

## Safety properties
- Schema initialization is additive and idempotent.
- Existing non-empty tabs with mismatched headers fail closed; no columns are silently reordered.
- Reference data is seeded by stable IDs and only missing IDs are added.
- Writes are plain-text formatted and guarded by a script lock.
- Applicant requirement files are not uploaded; the Requirements table records physical receipt and verification.
- College uses a separate database workbook and separate schema initializer; K–12 initialization never creates College tabs in its workbook. The legacy College workbook is not modified.

## Phase 1 acceptance checks
- [ ] Initialization creates every declared tab.
- [ ] A second initialization creates no duplicate tabs or duplicate reference rows.
- [ ] Header mismatch stops initialization without overwriting the tab.
- [ ] Formula-like text is neutralized by the database write helper.
- [ ] Drive root and six top-level folders are created once.
- [ ] No public deployment or production data mutation occurs.
- [ ] College database remains untouched until its separate migration review.
