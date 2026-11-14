# Moreh Academy Website Publishing Migration

## Scope and safety

This migration is being developed on the `website-pages-fixes` branch of `morehians-cmd/APMerge`. It extends the existing portal; it does not create a second Apps Script application or replace the existing `Index.html` shell.

The public site continues using its legacy live stores while `Website Publishing Config.published_version_id` is blank. The versioned reader adapters use the legacy source only while `legacy_fallback_enabled=true`. No production deployment or live sheet setup has been performed from this repository change.

## Versioned storage

The publishing foundation creates five additive tabs:

| Sheet | Purpose |
|---|---|
| Website Versions | Immutable version metadata, status, ownership, review and publication history |
| Website Version Chunks | SHA-256-verified payload chunks |
| Website Publishing Config | Baseline and published pointers plus migration state |
| Website Publishing Audit | Append-only publishing workflow audit |
| Website Draft Media | Private staged-media metadata and promotion state |

The snapshot payload contains:
- Unique `Content` key/value rows.
- The existing defaults and page allow-lists.
- The Events sheet column schema and the actual event rows.
- Every supported gallery page and its file IDs/captions.

Event rows are part of the immutable snapshot. A baseline created by an earlier revision that contains only the Events schema must be refreshed before a draft can be created. Run `seedWebsitePublishingBaseline(token)` again from the Full administrator setup panel; the old baseline remains recorded and the new baseline becomes the configured source.

## Workflow and permissions

Version states are `Baseline`, `Draft`, `InReview`, `ChangesRequested`, `Approved`, `Published`, and `Archived`.

Individual Script Property permissions are:
- `website.content.edit`
- `website.content.review`
- `website.content.publish`
- `website.content.rollback`

A creator cannot review their own draft. A creator can save immutable About revisions only to their own Draft or Changes Requested version. Publishing and rollback require separate permissions.

## Media lifecycle

Draft JPEGs are uploaded into a private Drive staging folder. Staged assets are checked for:
- Unique metadata records.
- Matching Drive MIME type and file size.
- Correct uploader and draft creator.
- Membership in the private staging folder.
- No public link sharing before publication.

Publication promotion is idempotent: a staged asset enters `Promoting` before it is moved into the approved `PHOTO_FOLDER_ID`; after the move, it receives public-view sharing and transitions to `Published`. A retry can complete a partially promoted asset. Published media stays available to historical versions and rollback snapshots.

## Integrated editor

The existing portal shell now includes a Website Publishing workspace, opened from the About page's **Draft & Publish** control. It supports:
- Version listing and selection.
- Creating drafts from the current published version, or from the baseline before first publication.
- Editing the five structured About sections.
- Private leader-photo staging and draft-version photo previews.
- Saving immutable About revisions.
- Submitting drafts for independent review.
- Approving or requesting changes.
- Full administrator setup, preflight, baseline seeding/refresh, baseline validation and self-check.

The legacy About editor remains intact during migration and still writes to the legacy live store.

Legacy writer safety: every inventoried legacy writer now calls `wpAssertLegacyWriterOpen_()` before its live mutation. The guard preserves current behavior while `WP_PUBLISH_CUTOVER_READY_` is false, and rejects the old live-write path if the gate is ever enabled. This is a safety interlock, not proof that those editor screens have been migrated; the gate remains false until their callers are redirected and tested.

## Public reader migration

The public reader endpoints now resolve from the published payload when a published pointer exists, while preserving legacy fallback before first publication. This includes homepage content and hero, public blocks, About data and leadership photos, Events, section cards, page photos, Facilities and History galleries, page introductions and page banners.

The admin editors for homepage content, homepage hero, page introductions and page banners were separated onto authenticated live-source reader methods so their existing editing experience is not accidentally switched to published data during the migration.

## Publication gate — intentionally closed

`WP_PUBLISH_CUTOVER_READY_` remains `false`. The publish and rollback endpoints fail closed, and the workspace displays the blockers. Do not change this gate until every legacy writer below has been redirected to immutable draft versions and acceptance-tested:

1. About editor: `saveAbout` and `setAboutPhoto`.
2. Public text blocks: `saveBlock`.
3. Homepage hero and homepage sections: `saveHomepageHero`, `saveHomepageContent`, and homepage photo upload.
4. Page introductions and banners: `savePageIntro`, `savePageBanner`.
5. Section cards: `saveSectionCards` / `saveAboutCards`.
6. Gallery management: `addGalleryPhoto`, `setGalleryCaption`, and `removeGalleryPhoto`. Gallery removal now removes only the live list reference and retains the Drive file for immutable version history; the gallery list writer still needs migration.

The next migration step is to move these editors to draft payload adapters, preserve their existing permissions and validation, and test that a draft revision changes only the intended records. Once all legacy writers are migrated, run the preflight and self-check, test review/publish/rollback in a non-production copy, then enable the gate in a separate reviewed commit.

Gallery file retention safeguard: `removeGalleryPhoto` no longer trashes removed images. Historical immutable versions and rollback snapshots may still reference those Drive IDs. Any future media cleanup must be retention-aware and must verify that no retained version references an asset before deleting it.

The generic draft content adapter is restricted to the captured public-block allow-list, public page-block keys, and the explicit homepage/About/page-setting keys; internal portal blocks such as the student enrollment guide are excluded from website publishing edits. The draft gallery adapter now enforces the same per-page image limits as the legacy gallery endpoint and sanitizes captions before creating a new immutable revision. The existing Website Pages gallery upload confirmation now accurately states that removed assets are retained for version history rather than trashed. The publishing workspace warns before discarding unsaved content or gallery text when switching keys, gallery pages, or versions, and exposes supported keys even when their initial value comes from captured defaults. Draft editor adapters now include `saveWebsiteDraftContent` for captured Content keys and `saveWebsiteDraftGallery` for versioned gallery lists. The publishing workspace exposes these as draft-only editors, including private JPEG staging for gallery photos. These adapters do not migrate or disable the existing legacy editor screens: `saveBlock`, `saveAbout`, `setAboutPhoto`, homepage/page-setting save endpoints, section-card saves, and legacy gallery endpoints remain active live writers. The publication cutover gate therefore remains closed until those entry points are redirected to these adapters (or an equivalent version-aware flow), and each old workflow is tested against the new version model. The live caller inventory is confirmed in `Index.html` / `Script.html` (About, public blocks and gallery actions), `WebsitePages.html` (section cards, page blocks and gallery actions), `HomepageHero.html` (hero/photo), `HomepageSections.html` (homepage content), and `PageBanners.html` (page banners and introductions). These callers have not yet been redirected.

## Required runtime acceptance tests

Repository syntax parsing is not a substitute for Apps Script execution. Before enabling publication, verify in a development copy:

1. Full administrator can prepare stores and run read-only preflight.
2. Baseline seed includes the complete Events row collection and passes integrity validation.
3. Existing public pages render unchanged while the published pointer is blank.
4. Draft creation uses the current published version after first publication, otherwise the baseline.
5. Draft About edits preserve legacy About HTML and every unrelated content row.
6. Staged media remains private, is creator-bound, previews only from a version that references it, and promotes safely.
7. A reviewer cannot approve their own draft.
8. Publication switches the pointer only after approval and media promotion.
9. Rollback restores an archived version and invalidates public caches.
10. All legacy editor workflows write to drafts; none can silently mutate the live stores after cutover.

Production deployment remains a separate, explicitly approved operation.
