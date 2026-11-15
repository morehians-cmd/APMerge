# Moreh — Website & Admission Portal

A fresh Google Apps Script project, bound to the school's spreadsheet. This first
stage is the **public website plus the website manager**. Enrollment, student
records, reports and fees are not part of this stage yet.

- Public homepage — the web app URL with no parameters
- Interior pages — `?page=about`, `?page=admissions`, `?page=academics`, …
- Site search — `?page=search&q=…`
- Website manager — `?page=admin` (password protected)

Everything the website shows is edited from the manager; no code changes are
needed for content.

## Files

| File | What it is |
|---|---|
| `appsscript.json` | Manifest — Asia/Manila, V8, web app runs as the deploying user, access Anyone. |
| `Code.gs` | `doGet` routing, `setup()`, sheet/JSON helpers, image and search helpers. |
| `Site.gs` | Starter content, reading/sanitising/saving settings, homepage, pages and announcements. |
| `Auth.gs` | Administrator password (salted SHA-256), sessions, `require_()`. |
| `Api.gs` | Functions the manager calls with `google.script.run` (load, save, image upload). |
| `Render.gs` | Shared header/navigation/footer markup for the public templates. |
| `PublicCss.html` | The one stylesheet shared by every public page. |
| `PublicHome.html` | The homepage. |
| `PublicPage.html` | Interior page template. |
| `PublicSearch.html` | Search results. |
| `Index.html` | Website manager shell: sign-in, tabs, shared form helpers, uploads. |
| `AdminHomepage.html`, `AdminPages.html`, `AdminAnnouncements.html`, `AdminSettings.html` | The four manager screens. |
| `tools/preview.js` | Local preview of the public site (development only, not part of the deployment). |

## Deploying

The script must be **bound to the spreadsheet** — `SpreadsheetApp.getActive()` is
how it reads and writes content, so a standalone project will not work.

1. Open the spreadsheet → **Extensions → Apps Script**.
2. Create the files above with exactly these names (HTML screens are loaded by
   name by `include()`), or use `clasp clone` / `clasp push`.
3. Project Settings → tick **Show "appsscript.json"** and paste the manifest.
4. Run **`setup()`** once and accept the permissions prompt. It creates the
   `Content`, `Announcements` and `Log` sheets, writes the starter content, and
   prints a one-time administrator password in the execution log. Save it.
   Lost it later? Run `resetAdminPassword()`.
5. **Deploy → New deployment → Web app** — execute as **Me**, access **Anyone**.
6. Open the `/exec` URL: homepage at `/exec`, manager at `/exec?page=admin`.

After any later edit use **Deploy → Manage deployments → edit → New version**.
Editing the code alone does not update the live site.

## Editing the site

| Tab | What it controls |
|---|---|
| **Homepage** | Announcement bar, up to 5 banner slides, values strip, About block, updates panel heading, closing call to action. |
| **Pages** | Title, web-address key, banner, introduction and main text for every interior page. |
| **Announcements** | Rows in the `Announcements` sheet — date, title, summary, link, pin, live. The three newest live items appear on the homepage; pinned items come first. |
| **Settings** | School names and logos, motto, contact details, social links, footer text and the main menu (with sub-links). |

Photos can be pasted as a Google Drive share link, a Drive file ID, or any image
URL, or uploaded from the manager. Uploads are resized in the browser, stored in
a Drive folder called **Moreh Website Media**, and shared as anyone-with-the-link
so the public pages can show them.

Page text and introductions allow basic HTML (`<p>`, `<strong>`, `<ul>`,
`<a href="…">`). Scripts, styles, embedded frames and `on…` attributes are
stripped on save.

## Local preview

```
node tools/preview.js      # http://localhost:8080
```

Renders the real public templates with the starter content from `Site.gs` — no
Apps Script and no deployment needed. It does not read the spreadsheet and does
not preview the manager screens.

## Notes

- Sign-in is one administrator password stored as a salted SHA-256 hash in Script
  Properties. Keep it out of screenshots, chat and public copies of this repo.
- Sessions last 6 hours; eight wrong passwords lock sign-in for 15 minutes.
- Public pages are cached for 5 minutes (`APP.cacheSeconds`); saving in the
  manager clears the cache immediately.
- New fields added to `cleanSettings_` / `cleanHomepage_` fall back to the
  defaults, so old saved content keeps working.
