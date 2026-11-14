# Moreh Academy — Portal & Website

One Google Apps Script project serving two things from a single web app URL:

- **The admission portal** (`?page=portal`) — staff dashboard, student records, registration, reports, fees, scholarships, ID cards, College roster and the activity log.
- **The public school website** — the homepage (no parameters), 31 interior pages (`?page=about`, `?page=admissions`, …) and the account-creation page (`?page=create-account`).

All data lives in the Google Spreadsheet the script is attached to. Website wording and photos are edited from **System Administration → Homepage Hero / Homepage Sections / Page Banners / Website Pages** inside the portal, so no code changes are needed for content. `staff-guide.md` explains those screens for non-technical staff.

## Files

| File | What it is |
|---|---|
| `appsscript.json` | Project manifest (Asia/Manila, V8, web app runs as the deploying user, public access). |
| `Code.gs` | Core: schema, search, dashboard, reports, `doGet` routing, site constants. |
| `Security.gs`, `Protection.gs`, `Hardening.gs`, `SignInGuard.gs`, `MailSwitch.gs`, `MailQueue.gs`, `StaffControl.gs` | Sign-in, sessions, hashing, audit, backups, mail, staff control. |
| `Academic.gs`, `CollegeModule.gs`, `Report.gs`, `ReEnroll.gs`, `Retention.gs`, `IdCard.gs`, `Cor.gs`, `Speed.gs`, `Housekeeping.gs`, `Contact.gs`, `Flags.gs`, `DashboardSpec.gs`, `DashboardAudit.gs` | Feature modules (academics, College roster, reports, ID cards, scheduled jobs). |
| `Public.gs`, `Gallery.gs`, `Content.gs` | Public site data: homepage content, page banners and intros, page text, photo galleries, uploads. |
| `WebsitePublishing.gs` | Additive M7 migration preflight, empty version-store preparation, and immutable chunked baseline seeding. Does not switch public readers or redirect editor writes. |
| `AcceptanceTests.gs` | Non-production, non-destructive security acceptance checks for student self-edit, trigger guards, approved branding-folder membership, Encoder scope, dashboard/report authentication and website-publishing payload boundaries. |
| `Index.html` | Existing applicant/staff portal shell and dashboard. |
| `PublicHome.html`, `PublicPage.html` | The public homepage and interior-page templates. |
| `AdmissionDocuments.gs` | Private applicant document storage, student-owned uploads, registrar review, scoped access and email notices. |
| `AdmissionDocuments.html`, `AdmissionDocumentsShortcut.html` | Authenticated document upload/review workspace and its portal navigation shortcut. |
| `Script.html` | Legacy client bundle kept for reference — not loaded by any page. |

## Security acceptance

Use [the security acceptance runbook](docs/security-acceptance-runbook.md) to execute the mandatory M1–M7 role, endpoint, report and website-publishing test matrix in a disposable development copy. Run `runSecurityAcceptanceTests()` from the Apps Script editor as the script owner for the automated source-level/runtime checks; it temporarily changes and restores one synthetic Script Property. It does not certify untested roles or endpoints, and it must not be treated as production approval.

## Deploying

The script must be **bound to the school's spreadsheet**: the code reads and writes that file directly, so a standalone project will not work.

1. Open the spreadsheet → **Extensions → Apps Script**.
2. Recreate the files in the editor, keeping every file name exactly as above (the HTML screens are loaded by name). Turn on **Project Settings → Show "appsscript.json"** and paste the manifest. If you prefer the command line, `clasp clone` / `clasp push` works instead of copy-pasting.
3. Check the constants at the top of `Code.gs`:
   - `SALT` — the password salt. **Keep the value a live deployment is already using**, or every password stops working.
   - `PHOTO_FOLDER_ID` — the Drive folder that stores uploaded photos. Share it as *Anyone with the link* so public pages can display them.
   - `SCHOOL`, `HEAD_NAME`, `HEAD_TITLE`, `FEE`, `LETTERHEAD_URL` — printed on slips and forms.
Before changing the school logo, the script owner must identify the approved branding folder and run `setApprovedBrandingFolder('<folder ID>')` from the Apps Script editor. The folder must not be publicly shared; `setLogoFile(id)` rejects files outside that folder. This setting is separate from `PHOTO_FOLDER_ID`.
4. Run the function **`setup()`** once and allow the permissions prompt. It creates the core sheets, the security pepper and the first administrator; the username and one-time password appear in the execution log. **Back up the `PEPPER` script property**, and change the password at first sign-in. Set the `MA_SCRIPT_OWNER_EMAIL` Script Property to the actual script owner's email, then run **`initialSetupAdmissionDocuments()`** once from the Apps Script editor. This creates the `Admission Documents` metadata tab and a private Drive folder; it does not make uploaded files public.
5. **Deploy → New deployment → Web app.** Execute as **Me**, who has access **Anyone**, then Deploy and copy the `/exec` URL.
   - `/exec` → homepage
   - `/exec?page=portal` → staff dashboard (sign-in required)
   - `/exec?page=about` (and the other page keys in `doGet`) → interior pages
6. Optional: run `installBackupTrigger()`, `installMailQueueTrigger()` and `installRetentionTrigger()` once each to enable scheduled backups, mail and data retention.

**After any later change**, use **Deploy → Manage deployments → edit → Version: New version**. Editing the code alone does not update the live site.

## Notes

- The College module is `CollegeModule.gs`, not `College.gs`: Apps Script will not hold two project files with the same name, and the dashboard screen is already `College.html`. The file's functions and API are unchanged.
- New spreadsheet columns must be added at the **end** of `FIELDS` in `Code.gs` — the order matters for existing rows.
- Admission requirements continue to be tracked in the existing student record. The additive Admission Documents workspace also accepts private PDF/JPG/PNG uploads (8 MB maximum per file); applicants sign in through the existing portal, and authorized staff review submissions within their existing student search scope. Drive files are not made public. Physical originals may still be required by the Admissions Office.
- Student/staff profile photo uploads are resized in the browser before being stored, so staff never need to resize images themselves.
- Keep secrets (`SALT`, `PEPPER`, the photo folder ID) out of screenshots, chats and public copies of this repository.


### Website publishing migration (non-production preparation)

The `WebsitePublishing.gs` functions are migration tools, not part of the normal public website request path:

1. `websitePublishingPreflight(token)` performs a read-only inventory of Content, Events, gallery references, and Drive media.
2. `setupWebsitePublishingStores(token)` creates/verifies the four additive versioning tabs.
3. `seedWebsitePublishingBaseline(token)` stores and verifies an immutable chunked snapshot after a clean preflight.
4. `validateWebsitePublishingBaseline(token)` verifies chunk integrity and detects live-content drift after seeding.
5. `websitePublishingSelfCheck(token)` performs a read-only diagnostic of store headers, config, baseline integrity, permission catalog, private draft-media folder, and the still-blank public pointer.
6. `stageWebsiteMedia(token, dataUrl, fileName)` uploads JPEGs to the private draft-media folder without changing live gallery/content stores or enabling public sharing.
7. `listWebsiteStagedMedia(token)` lists the current editor's staged assets.

All five accept a Full administrator session token when called from the portal, or can be run without arguments from the bound Apps Script editor by the script owner. The self-check, preflight, and baseline validation are read-only. The setup function creates the additive publishing tabs, private draft-media folder, and folder property; the seed function writes the immutable baseline. Draft media uploads create private Drive files and metadata rows., so run them only in the bound non-production copy after reviewing the migration plan. Baseline seeding leaves the published pointer blank. The current public website and editors continue using the existing live stores; no production deployment or public-reader cutover is implied.

## Unified About Moreh Academy content

The About page is edited as one cohesive screen inside the existing portal. Its single `about_data` record holds Vision, Mission, Core Values, History milestones, and Key Leadership profiles/photos. The existing Edit Page experience already supports adding/removing values, leaders, and milestones, uploading leader photos, and saving the sections together. Keep this editor's existing Moreh Academy styling and preserve the legacy About text during migration. The website-publishing migration must snapshot this entire record and its photo references together; it must not split these sections into separate competing editors or live content stores. The About editor will be switched to versioned draft saves only as part of the coordinated editor/public-reader/media cutover. Until then, its existing live save path remains in place and publishing remains disabled.

The versioned publishing backend includes `getWebsiteDraftAbout(token, versionId)` and `saveWebsiteDraftAbout(token, parentVersionId, aboutData)`. These adapters read and revise the five About sections as one structured record, preserve legacy About HTML and all unrelated site content, and validate referenced media through the normal full-payload draft validator. The current About UI remains on its legacy save route until the coordinated public-reader and media cutover is complete.
The About editor now enforces the same field-length limits as the server validator, provides section-specific editing guidance and empty-state prompts, and labels the single save action as saving all About sections together. Removing a leader from the current About record no longer trashes that person's photo file: historical website versions and rollback snapshots may still reference it, so media cleanup must be a separate retention-aware operation.
The About draft API also includes `getWebsiteDraftAboutPhoto(token, versionId, assetId)`. It serves an image only when that exact photo ID is referenced by the selected version and belongs either to the private staged-media folder or the established approved photo folder. Draft-media preview does not change Drive sharing or the currently published site.
Draft media validation is now ownership-aware: when a draft revision is saved, every staged image it references must be in the private staging folder, remain non-public, have `Staged` state, and have been uploaded by the same editor who owns that draft. Existing non-staged image references are accepted only from the established approved photo folder.
