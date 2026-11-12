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
| `Academic.gs`, `College.gs`, `Report.gs`, `ReEnroll.gs`, `Retention.gs`, `IdCard.gs`, `Cor.gs`, `Speed.gs`, `Housekeeping.gs`, `Contact.gs`, `Flags.gs`, `DashboardSpec.gs`, `DashboardAudit.gs` | Feature modules (academics, College roster, reports, ID cards, scheduled jobs). |
| `Public.gs`, `Gallery.gs`, `Content.gs` | Public site data: homepage content, page banners and intros, page text, photo galleries, uploads. |
| `Index.html` | Dashboard shell. |
| `College.html`, `ActivityLog.html`, `HomepageHero.html`, `HomepageSections.html`, `PageBanners.html`, `WebsitePages.html` | Dashboard screens, pulled in by `include()` at the end of `Index.html`. |
| `PublicHome.html`, `PublicPage.html` | The public homepage and interior-page templates. |
| `Script.html` | Legacy client bundle kept for reference — not loaded by any page. |

## Deploying

The script must be **bound to the school's spreadsheet**: the code reads and writes that file directly, so a standalone project will not work.

1. Open the spreadsheet → **Extensions → Apps Script**.
2. Recreate the files in the editor, keeping every file name exactly as above (the HTML screens are loaded by name). Turn on **Project Settings → Show "appsscript.json"** and paste the manifest. If you prefer the command line, `clasp clone` / `clasp push` works instead of copy-pasting.
3. Check the constants at the top of `Code.gs`:
   - `SALT` — the password salt. **Keep the value a live deployment is already using**, or every password stops working.
   - `PHOTO_FOLDER_ID` — the Drive folder that stores uploaded photos. Share it as *Anyone with the link* so public pages can display them.
   - `SCHOOL`, `HEAD_NAME`, `HEAD_TITLE`, `FEE`, `LETTERHEAD_URL` — printed on slips and forms.
4. Run the function **`setup()`** once and allow the permissions prompt. It creates the sheets, the security pepper and the first administrator; the username and one-time password appear in the execution log. **Back up the `PEPPER` script property**, and change the password at first sign-in.
5. **Deploy → New deployment → Web app.** Execute as **Me**, who has access **Anyone**, then Deploy and copy the `/exec` URL.
   - `/exec` → homepage
   - `/exec?page=portal` → staff dashboard (sign-in required)
   - `/exec?page=about` (and the other page keys in `doGet`) → interior pages
6. Optional: run `installBackupTrigger()`, `installMailQueueTrigger()` and `installRetentionTrigger()` once each to enable scheduled backups, mail and data retention.

**After any later change**, use **Deploy → Manage deployments → edit → Version: New version**. Editing the code alone does not update the live site.

## Notes

- New spreadsheet columns must be added at the **end** of `FIELDS` in `Code.gs` — the order matters for existing rows.
- Photo uploads are resized in the browser before being stored, so staff never need to resize images themselves.
- Keep secrets (`SALT`, `PEPPER`, the photo folder ID) out of screenshots, chats and public copies of this repository.
