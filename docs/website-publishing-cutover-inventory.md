# Website Publishing Cutover Inventory

Branch: `website-pages-fixes`

Status: **publishing remains disabled**. This inventory is a migration control document, not authorization to activate the published-version pointer.

## Public read paths identified

| Surface | Current source / behavior | Cutover requirement |
|---|---|---|
| `getPublicContent()` | Live Events, Guide, active school year, and live homepage gallery; date-keyed `pubc_v1_*` cache | Preserve operational event feed and school-year data as live operational sources; route only editable website content and approved gallery references through the published payload |
| `getPublicPhoto(id)` | Allows only IDs in the live homepage gallery; `pubp_*` cache | Resolve membership against the active published version and retain an explicit allow-list |
| `getPublicAbout()` | Reads live `about_data`; `puba_v1` cache; returns public leader name/title/photo only | Read `about_data` from the published snapshot; continue omitting leader contact details |
| `getPublicBlock(key)` | Reads live Content sheet rows from `PUBLIC_BLOCK_KEYS` | Resolve the matching key from the published snapshot; preserve sanitization and key allow-list |
| `getPublicFacilities()` / `getPublicFacilityPhoto(id)` | Live facilities gallery and image membership checks | Version gallery membership and keep photo serving allow-listed |
| `getPublicPagePhoto(page)` | First item from each page-specific live gallery | Version page-to-gallery membership and preserve page allow-list |
| `getPublicLeaderPhoto(id)` | Current live `about_data.leaders[].photo` allow-list | Resolve leader references from the published About record; continue excluding contact details |
| `getPublicHistoryGallery()` / `getPublicHistoryPhoto(id)` | Live history gallery and image membership checks | Version history gallery membership and retain explicit photo allow-list |
| `getHomepageHero()` | Live `pubhome_hero` row/defaults | Resolve from published snapshot |
| `getHomepageContent()` | Live `pubhome_content` setting | Resolve from published snapshot |
| `getPageIntros()` / `getPageBanners()` | Live `pubpage_intro` and `pubpage_banners` settings | Resolve from published snapshot |
| `getPublicSectionCards(group)` | Live `pub_*_cards` rows | Resolve from published snapshot |
| Other page-specific photo, gallery, event and resource readers | Separate live stores / operational sources | Inventory each caller and distinguish editable website content from operational data before migration |

## Live write paths identified

The current owner-only/live writer family includes:

- `saveBlock`, `saveAbout`, `setAboutPhoto`
- `saveHomepageContent`, `savePageIntro`, `resetPageIntro`
- `savePageBanner`, `resetPageBanner`, `saveHomepageHero`
- `saveSectionCards` and the compatibility alias `saveAboutCards`
- `uploadHomepagePhoto` and the gallery upload/caption/removal endpoints

These remain live-write paths until the complete draft editor is wired. They must not be partially redirected: a mixed state would allow the public site to show a combination of the published snapshot and newer live edits.

## Operational data that must remain live

Events, announcements, active school year, admission/application status, and other time-sensitive school operations must not be frozen into a website-content snapshot unless a specific editorial copy field is explicitly separated from the operational record.

## Cutover gates (all required)

1. Inventory every public read endpoint and every image endpoint, including page-specific facilities, gallery, news, resource, and leader media.
2. Classify each data field as editorial snapshot content or live operational data.
3. Implement one fail-closed published-payload resolver with schema/hash verification and no fallback to live editable content when the published pointer is missing or corrupt.
4. Migrate all public readers and their cache keys/invalidation to the same published-version pointer.
5. Migrate every website editor writer to immutable draft revisions; remove or disable direct live-write paths only after UI migration is complete.
6. Implement staged-media promotion/copy into the approved public photo library, validate all references, and retain rollback-safe originals. The published pointer must be updated last.
7. Implement publish and rollback under a script lock, with independent approval, audit records, cache invalidation, and recovery behavior for partial media promotion.
8. Add automated tests for every reader/writer, role/permission combinations, corrupted pointers, missing chunks, duplicate metadata, private staged media, and rollback.
9. Run deployment-bound Apps Script smoke tests and verify the production deployment is unchanged until explicitly approved.

## Current safe state

- Draft storage, immutable chunked versions, permission catalog, independent review, About draft adapters, and private staged-media upload are implemented.
- About photo preview verifies the image is referenced by the selected version, staged metadata is unique, the uploader matches the draft creator, MIME/size match Drive, and the staging folder/file are not publicly shared.
- `publishWebsiteVersion()` deliberately fails closed.
- No public-reader cutover or production deployment has been activated.


## Reader inventory follow-up

The Public.gs endpoint list was enumerated during this pass. In addition to the primary content readers, the implementation includes page-specific image, leadership-photo, history-gallery, facilities-gallery, and homepage-hero readers. Their allow-list checks are security boundaries and must be preserved while changing the source of truth. The homepage About/brand header photo and header logos are served by separate helpers in Code.gs; these are institutional branding assets and need an explicit decision on whether they are versioned editorial assets or fixed deployment assets before cutover.
