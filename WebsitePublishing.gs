/**
 * Moreh Academy — Website publishing migration preflight.
 *
 * This file is intentionally read-only. It inventories the existing live website
 * sources for the M7 migration without creating sheets, changing Content/Events/
 * Gallery rows, changing Drive sharing, moving files, or invalidating public caches.
 *
 * Run websitePublishingPreflight(token) from the authenticated Full administrator
 * session. The returned hashes are a point-in-time baseline, not a migration.
 */

const WP_PREFLIGHT_SCHEMA_ = 1;
const WP_PREFLIGHT_CHUNK_CHARS_ = 40000;

function wpActor_(token) {
  if (token) return sysOwner_(token);
  ownerOnly_();
  return { Username:Session.getEffectiveUser().getEmail() || 'script-owner' };
}

function wpHash_(value) {
  const bytes = Utilities.newBlob(String(value), 'text/plain').getBytes();
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes));
}

function wpSplitChunks_(value, maxChars) {
  const textValue = String(value);
  const size = Math.max(2, Number(maxChars) || WP_PREFLIGHT_CHUNK_CHARS_);
  const parts = [];
  let start = 0;
  while (start < textValue.length) {
    let end = Math.min(start + size, textValue.length);
    if (end < textValue.length) {
      const last = textValue.charCodeAt(end - 1);
      if (last >= 0xD800 && last <= 0xDBFF) end--;
    }
    if (end <= start) end = Math.min(start + size + 1, textValue.length);
    parts.push(textValue.slice(start, end));
    start = end;
  }
  return parts.length ? parts : [''];
}

function wpText_(value) {
  return String(value == null ? '' : value);
}

function wpSnapshotDefaults_() {
  return {
    about:ABOUT_DEFAULT,
    homepageContent:PUBLIC_CONTENT_DEFAULTS_,
    homepageHero:PUBLIC_HERO_DEFAULTS_,
    pageIntros:PAGE_INTRO_DEFAULTS_,
    pageBanners:PAGE_BANNER_DEFAULTS_,
    sectionCards:SECTION_CARDS_,
    contentBlockKeys:BLOCKS,
    publicBlockKeys:PUBLIC_BLOCK_KEYS,
    pageBlockKeys:PAGE_BLOCK_KEYS_,
    pageIntroSlugs:PAGE_INTRO_SLUGS_,
    pageBannerSlugs:PAGE_BANNER_SLUGS_,
    galleryPages:GAL_PAGES,
    galleryAliases:GAL_ALIAS
  };
}

function wpReferencedDriveIds_(contentRows, galleries, defaults) {
  const ids = {};
  const add = id => {
    id = wpText_(id).trim();
    if (/^[A-Za-z0-9_-]{10,80}$/.test(id)) ids[id] = true;
  };
  contentRows.forEach(row => {
    const value = row[1];
    const text = wpText_(value);
    let m;
    const re = /drive\.google\.com\/(?:thumbnail\?[^"'<> ]*?id=|uc\?[^"'<> ]*?id=|file\/d\/)([A-Za-z0-9_-]{10,80})/gi;
    while ((m = re.exec(text))) add(m[1]);
    if (row[0] === 'about_data') {
      try {
        const about = JSON.parse(text);
        (Array.isArray(about.leaders) ? about.leaders : []).forEach(person => add(person && person.photo));
      } catch (_) {}
    }
  });
  Object.keys(galleries).forEach(page => galleries[page].forEach(item => add(item.id)));
  const defaultText = JSON.stringify(defaults || {});
  let defaultMatch;
    const defaultRe = /drive\.google\.com\/(?:thumbnail\?[^"'<> ]*?id=|uc\?[^"'<> ]*?id=|file\/d\/)([A-Za-z0-9_-]{10,80})/gi;
  while ((defaultMatch = defaultRe.exec(defaultText))) add(defaultMatch[1]);
  return Object.keys(ids).sort();
}

/**
 * Read-only source inventory for website content migration.
 * No public content or media is changed by this function.
 */
function websitePublishingPreflight(token) {
  try {
    const actor = wpActor_(token);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const contentSheet = ss.getSheetByName('Content');
    const eventsSheet = ss.getSheetByName('Events');

    if (!contentSheet) throw new Error('The existing Content sheet was not found. Preflight stopped without creating it.');
    const contentHeaders = contentSheet.getRange(1, 1, 1, 2).getDisplayValues()[0];
    const contentHeaderValid = contentHeaders[0] === 'Key' && contentHeaders[1] === 'Value';

    const contentRows = contentSheet.getLastRow() > 1
      ? contentSheet.getRange(2, 1, contentSheet.getLastRow() - 1, 2).getDisplayValues()
          .filter(row => wpText_(row[0]).trim() !== '')
          .map(row => [wpText_(row[0]), wpText_(row[1])])
      : [];

    const keyCounts = {};
    contentRows.forEach(row => { keyCounts[row[0]] = (keyCounts[row[0]] || 0) + 1; });
    const duplicateKeys = Object.keys(keyCounts).filter(key => keyCounts[key] > 1).sort();

    const eventHeaderCount = eventsSheet ? Math.min(eventsSheet.getLastColumn(), EVCOLS.length) : 0;
    const eventHeaders = eventsSheet && eventHeaderCount > 0
      ? eventsSheet.getRange(1, 1, 1, eventHeaderCount).getDisplayValues()[0]
      : [];
    const eventHeaderValid = !!eventsSheet && eventHeaderCount >= 8 && EVCOLS.slice(0, eventHeaderCount).every((header, index) => eventHeaders[index] === header);
    const eventRows = eventsSheet && eventsSheet.getLastRow() > 1
      ? eventsSheet.getRange(2, 1, eventsSheet.getLastRow() - 1, Math.min(eventsSheet.getLastColumn(), EVCOLS.length)).getDisplayValues()
          .filter(row => row.some(cell => wpText_(cell).trim() !== ''))
          .map(row => {
            const event = {};
            EVCOLS.forEach((key, i) => { event[key] = wpText_(row[i]); });
            return event;
          })
      : [];

    const galleries = {};
    const duplicateGalleryIds = [];
    const allGalleryIds = {};
    (typeof GAL_PAGES !== 'undefined' ? GAL_PAGES : []).forEach(page => {
      const list = galRead_(page).list.map(item => ({ id:wpText_(item.id), cap:wpText_(item.cap) }));
      galleries[page] = list;
      const pageSeen = {};
      list.forEach(item => {
        if (pageSeen[item.id]) duplicateGalleryIds.push({ page:page, id:item.id });
        pageSeen[item.id] = true;
        allGalleryIds[item.id] = (allGalleryIds[item.id] || 0) + 1;
      });
    });

    const defaults = wpSnapshotDefaults_();
    const driveIds = wpReferencedDriveIds_(contentRows, galleries, defaults);
    const driveFiles = driveIds.map(id => {
      try {
        const file = DriveApp.getFileById(id);
        const parents = [];
        const parentIt = file.getParents();
        while (parentIt.hasNext()) {
          const folder = parentIt.next();
          parents.push({ id:folder.getId(), name:folder.getName() });
        }
        return {
          id:id,
          exists:true,
          trashed:file.isTrashed(),
          mimeType:file.getMimeType(),
          size:file.getSize(),
          parents:parents
        };
      } catch (error) {
        return { id:id, exists:false, error:String(error && error.message || error) };
      }
    });

    const payload = {
      schemaVersion:WP_PREFLIGHT_SCHEMA_,
      contentRows:contentRows,
      defaults:defaults,
      eventFeed:{ source:'Events', columns:EVCOLS.slice(), announcementLimit:5, eventLimit:PUB_EVENTS_MAX },
      galleries:galleries
    };
    const payloadJson = JSON.stringify(payload);
    const payloadBytes = Utilities.newBlob(payloadJson, 'application/json').getBytes().length;
    const contentJson = JSON.stringify(contentRows);
    const eventJson = JSON.stringify(eventRows);
    const galleryJson = JSON.stringify(galleries);
    const missingOrTrashed = driveFiles.filter(file => !file.exists || file.trashed);
    const invalidMediaTypes = driveFiles.filter(file => file.exists && !/^image\/(png|jpeg|webp|gif)$/i.test(file.mimeType || ''));
    const oversizedContentCells = contentRows
      .map(row => ({ key:row[0], chars:row[1].length }))
      .filter(row => row.chars > 45000)
      .sort((a, b) => b.chars - a.chars);

    const report = {
      schemaVersion:WP_PREFLIGHT_SCHEMA_,
      mode:'READ_ONLY',
      generatedAt:new Date().toISOString(),
      generatedBy:actor.Username,
      spreadsheetId:ss.getId(),
      sources:{
        content:{ sheetFound:true, headerValid:contentHeaderValid, rowCount:contentRows.length, uniqueKeyCount:Object.keys(keyCounts).length, duplicateKeys:duplicateKeys, sha256:wpHash_(contentJson) },
        events:{ sheetFound:!!eventsSheet, headerValid:eventHeaderValid, headerColumns:eventHeaderCount, rowCount:eventRows.length, sha256:wpHash_(eventJson) },
        galleries:{ pageCount:Object.keys(galleries).length, photoReferenceCount:Object.keys(allGalleryIds).length, duplicateIds:duplicateGalleryIds, sha256:wpHash_(galleryJson) }
      },
      media:{
        referenceCount:driveIds.length,
        files:driveFiles,
        missingOrTrashed:missingOrTrashed,
        invalidMediaTypes:invalidMediaTypes
      },
      candidatePayload:{
        serializedChars:payloadJson.length,
        serializedBytes:payloadBytes,
        sha256:wpHash_(payloadJson),
        singleCellSafe:payloadJson.length <= 45000,
        chunkedStorageSupported:true,
        chunkChars:WP_PREFLIGHT_CHUNK_CHARS_,
        requiredChunkRows:Math.max(1, Math.ceil(payloadJson.length / WP_PREFLIGHT_CHUNK_CHARS_)),
        oversizedExistingContentCells:oversizedContentCells
      },
      readiness:{
        readyForBaselineSeed:contentHeaderValid && eventHeaderValid && duplicateKeys.length === 0 && duplicateGalleryIds.length === 0 && missingOrTrashed.length === 0 && invalidMediaTypes.length === 0 && oversizedContentCells.length === 0,
        blockers:[]
      }
    };

    if (!contentHeaderValid) report.readiness.blockers.push('Content sheet headers must be Key and Value in columns A and B.');
    if (!eventsSheet) report.readiness.blockers.push('Events sheet is absent; confirm whether the public event feed is intentionally empty before seeding.');
    else if (!eventHeaderValid) report.readiness.blockers.push('Events sheet headers do not match the existing event schema.');
    if (duplicateKeys.length) report.readiness.blockers.push('Duplicate Content keys must be reconciled before a deterministic snapshot can be seeded.');
    if (duplicateGalleryIds.length) report.readiness.blockers.push('Duplicate gallery file references were found within a page.');
    if (missingOrTrashed.length) report.readiness.blockers.push('One or more referenced Drive files are missing or trashed.');
    if (invalidMediaTypes.length) report.readiness.blockers.push('One or more referenced Drive files are not supported image types.');
    if (oversizedContentCells.length) report.readiness.blockers.push('One or more existing Content values exceed the conservative single-cell limit.');
    if (payloadJson.length > 45000) report.candidatePayload.chunkedStorageRequired = true;

    return ok(report, 'Read-only website publishing preflight completed. No live data was changed.');
  } catch (error) {
    return fail(error);
  }
}


const WP_VERSION_HEADERS_ = [
  'VersionID','ParentVersionID','Status','CreatedBy','CreatedAt','UpdatedBy','UpdatedAt',
  'ReviewedBy','ReviewedAt','ReviewNotes','PublishedBy','PublishedAt','PayloadHash',
  'PayloadChars','PayloadBytes','PayloadChunkCount'
];
const WP_CHUNK_HEADERS_ = ['VersionID','ChunkIndex','ChunkCount','PayloadChunk','ChunkHash'];
const WP_CONFIG_HEADERS_ = ['ConfigKey','ConfigValue'];
const WP_AUDIT_HEADERS_ = ['AuditID','VersionID','Action','Actor','Timestamp','Reason','PayloadHash'];
const WP_MEDIA_HEADERS_ = ['AssetID','FileName','MimeType','SizeBytes','UploadedBy','UploadedAt','State'];
const WP_MEDIA_FOLDER_PROPERTY_ = 'MA_WEBSITE_DRAFT_MEDIA_FOLDER_ID';
const WP_MEDIA_MAX_BYTES_ = 2 *  1024 * 1024;

function wpEnsureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  const first = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  const empty = first.every(value => !wpText_(value).trim());
  if (empty) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, sheet.getMaxRows(), headers.length).setNumberFormat('@');
  } else if (headers.some((header, index) => wpText_(first[index]) !== header)) {
    throw new Error('The existing "' + name + '" sheet has a different header schema. No rows were changed.');
  }
  return sheet;
}

function wpConfigEnsure_(sheet) {
  const defaults = [
    ['schema_version', String(WP_PREFLIGHT_SCHEMA_)],
    ['migration_state', 'PREPARED'],
    ['published_version_id', ''],
    ['baseline_version_id', ''],
    ['legacy_fallback_enabled', 'true']
  ];
  const last = sheet.getLastRow();
  const rows = last > 1 ? sheet.getRange(2, 1, last - 1, 2).getDisplayValues() : [];
  const existing = {};
  rows.forEach(row => {
    if (!row[0]) return;
    const key = wpText_(row[0]);
    if (existing[key]) throw new Error('Duplicate publishing configuration key: ' + key);
    existing[key] = true;
  });
  const missing = defaults.filter(row => !existing[row[0]]);
  if (missing.length) {
    const start = Math.max(2, sheet.getLastRow() + 1);
    sheet.getRange(start, 1, missing.length, 2).setNumberFormat('@');
    sheet.getRange(start, 1, missing.length, 2).setValues(missing);
  }
  return defaults.length;
}

/**
 * Creates only the additive, empty website-publishing stores.
 * This does not migrate content, seed a version, or change public reads/writes.
 */
function setupWebsitePublishingStores(token) {
  const lock = LockService.getScriptLock();
  try {
    const actor = wpActor_(token);
    lock.waitLock(20000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const versions = wpEnsureSheet_(ss, 'Website Versions', WP_VERSION_HEADERS_);
    const chunks = wpEnsureSheet_(ss, 'Website Version Chunks', WP_CHUNK_HEADERS_);
    const config = wpEnsureSheet_(ss, 'Website Publishing Config', WP_CONFIG_HEADERS_);
    const audit = wpEnsureSheet_(ss, 'Website Publishing Audit', WP_AUDIT_HEADERS_);
    const media = wpEnsureSheet_(ss, 'Website Draft Media', WP_MEDIA_HEADERS_);
    const properties = PropertiesService.getScriptProperties();
    let folderId = properties.getProperty(WP_MEDIA_FOLDER_PROPERTY_);
    let folder = null;
    if (folderId) {
      try { folder = DriveApp.getFolderById(folderId); if (folder.isTrashed()) folder = null; } catch (_) { folder = null; }
    }
    if (!folder) {
      folder = DriveApp.createFolder('MA Website Draft Media (Private)');
      folderId = folder.getId();
      properties.setProperty(WP_MEDIA_FOLDER_PROPERTY_, folderId);
    }
    const access = folder.getSharingAccess();
    if (access === DriveApp.Access.ANYONE || access === DriveApp.Access.ANYONE_WITH_LINK) {
      throw new Error('The website draft media folder is publicly shared. Remove public sharing before using draft uploads.');
    }
    const configKeys = wpConfigEnsure_(config);
    const configValues = wpConfigMap_(config);
    const pointer = configValues.published_version_id || '';
    const baselineVersionId = configValues.baseline_version_id || '';
    const migrationState = configValues.migration_state || 'PREPARED';
    audit.appendRow([
      Utilities.getUuid(), '', 'stores.prepare', actor.Username, new Date(),
      'Created or verified additive publishing stores and private draft-media staging; no live website data changed.', ''
    ]);
    return ok({
      sheets:['Website Versions','Website Version Chunks','Website Publishing Config','Website Publishing Audit','Website Draft Media'],
      versionHeaderCount:WP_VERSION_HEADERS_.length,
      chunkHeaderCount:WP_CHUNK_HEADERS_.length,
      mediaHeaderCount:WP_MEDIA_HEADERS_.length,
      configKeyCount:configKeys,
      draftMediaFolderId:folderId,
      draftMediaFolderPrivate:true,
      publishedVersionId:pointer,
      baselineVersionId:baselineVersionId,
      migrationState:migrationState,
      liveContentChanged:false,
      publicReaderChanged:false,
      editorWritesRedirected:false
    }, 'Website publishing stores and private media staging are prepared. Existing live website content remains unchanged.');
  } catch (error) {
    return fail(error);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}


function wpConfigMap_(sheet) {
  const out = {};
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues().forEach(row => {
      if (row[0]) out[wpText_(row[0])] = wpText_(row[1]);
    });
  }
  return out;
}

function wpSetConfigValue_(sheet, key, value) {
  if (sheet.getLastRow() > 1) {
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === key) {
        sheet.getRange(i + 2, 2).setNumberFormat('@').setValue(wpText_(value));
        return;
      }
    }
  }
  throw new Error('Publishing configuration key is missing: ' + key);
}

/**
 * Seeds one immutable, chunked snapshot of the current live website data.
 * Requires the additive stores and a clean read-only preflight.
 * Leaves published_version_id blank; public readers remain on legacy stores.
 */
function seedWebsitePublishingBaseline(token) {
  const lock = LockService.getScriptLock();
  try {
    const actor = wpActor_(token);
    lock.waitLock(20000);

    const preflight = websitePublishingPreflight(token);
    if (!preflight.success) throw new Error(preflight.error || 'Website preflight failed.');
    if (!preflight.data.readiness.readyForBaselineSeed) {
      throw new Error('Baseline seed blocked: ' + preflight.data.readiness.blockers.join(' '));
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const versions = ss.getSheetByName('Website Versions');
    const chunks = ss.getSheetByName('Website Version Chunks');
    const config = ss.getSheetByName('Website Publishing Config');
    const audit = ss.getSheetByName('Website Publishing Audit');
    if (!versions || !chunks || !config || !audit) throw new Error('Run setupWebsitePublishingStores(token) before seeding the baseline.');
    [WP_VERSION_HEADERS_, WP_CHUNK_HEADERS_, WP_CONFIG_HEADERS_, WP_AUDIT_HEADERS_].forEach((headers, index) => {
      const sheet = [versions, chunks, config, audit][index];
      const actual = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
      if (headers.some((header, i) => actual[i] !== header)) throw new Error('Publishing store schema mismatch in "' + sheet.getName() + '".');
    });

    const currentConfig = wpConfigMap_(config);
    if (currentConfig.baseline_version_id) throw new Error('A baseline version is already recorded. Do not overwrite it.');
    if (currentConfig.published_version_id) throw new Error('The published pointer is already set. Baseline seeding is closed.');
    if (currentConfig.migration_state !== 'PREPARED') throw new Error('Publishing migration is not in PREPARED state.');

    const contentSheet = ss.getSheetByName('Content');
    const eventsSheet = ss.getSheetByName('Events');
    const contentRows = contentSheet.getLastRow() > 1
      ? contentSheet.getRange(2, 1, contentSheet.getLastRow() - 1, 2).getDisplayValues()
          .filter(row => wpText_(row[0]).trim() !== '')
          .map(row => [wpText_(row[0]), wpText_(row[1])])
      : [];
    const events = eventsSheet.getLastRow() > 1
      ? eventsSheet.getRange(2, 1, eventsSheet.getLastRow() - 1, Math.min(eventsSheet.getLastColumn(), EVCOLS.length)).getDisplayValues()
          .filter(row => row.some(cell => wpText_(cell).trim() !== ''))
          .map(row => {
            const event = {};
            EVCOLS.forEach((key, i) => { event[key] = wpText_(row[i]); });
            return event;
          })
      : [];
    const galleries = {};
    GAL_PAGES.forEach(page => {
      galleries[page] = galRead_(page).list.map(item => ({ id:wpText_(item.id), cap:wpText_(item.cap) }));
    });

    const defaults = wpSnapshotDefaults_();
    const payloadJson = JSON.stringify({
      schemaVersion:WP_PREFLIGHT_SCHEMA_,
      contentRows:contentRows,
      defaults:defaults,
      eventFeed:{ source:'Events', columns:EVCOLS.slice(), announcementLimit:5, eventLimit:PUB_EVENTS_MAX },
      galleries:galleries
    });
    const payloadHash = wpHash_(payloadJson);
    if (payloadHash !== preflight.data.candidatePayload.sha256) {
      throw new Error('Live website content changed after preflight. Run the preflight again and retry.');
    }

    const versionId = 'WV-' + Utilities.getUuid();
    const payloadParts = wpSplitChunks_(payloadJson, WP_PREFLIGHT_CHUNK_CHARS_);
    const chunkCount = payloadParts.length;
    const chunkRows = payloadParts.map((part, index) => [versionId, index + 1, chunkCount, part, wpHash_(part)]);

    const chunkStart = chunks.getLastRow() + 1;
    chunks.getRange(chunkStart, 1, chunkRows.length, WP_CHUNK_HEADERS_.length).setNumberFormat('@');
    chunks.getRange(chunkStart, 1, chunkRows.length, WP_CHUNK_HEADERS_.length).setValues(chunkRows);
    const saved = chunks.getRange(chunkStart, 1, chunkRows.length, WP_CHUNK_HEADERS_.length).getDisplayValues();
    const rebuilt = saved.map(row => row[3]).join('');
    if (saved.length !== chunkCount || wpHash_(rebuilt) !== payloadHash) {
      throw new Error('Stored baseline chunks failed integrity verification. The published pointer remains unchanged.');
    }

    const now = new Date();
    const payloadBytes = Utilities.newBlob(payloadJson, 'application/json').getBytes().length;
    versions.appendRow([
      versionId, '', 'Baseline', actor.Username, now, actor.Username, now,
      '', '', 'Immutable migration baseline representing the live public website; not yet connected to the published pointer.',
      '', '', payloadHash, payloadJson.length, payloadBytes, chunkCount
    ]);
    wpSetConfigValue_(config, 'baseline_version_id', versionId);
    wpSetConfigValue_(config, 'migration_state', 'BASELINE_SEEDED');
    audit.appendRow([
      Utilities.getUuid(), versionId, 'baseline.seed', actor.Username, now,
      'Baseline snapshot stored and chunk hashes verified; published pointer intentionally left blank.',
      payloadHash
    ]);

    return ok({
      versionId:versionId,
      status:'Baseline',
      payloadHash:payloadHash,
      payloadChars:payloadJson.length,
      payloadBytes:payloadBytes,
      payloadChunkCount:chunkCount,
      publishedVersionId:'',
      migrationState:'BASELINE_SEEDED',
      publicReadersChanged:false,
      editorWritesRedirected:false
    }, 'Baseline snapshot seeded and verified. Public readers and editor writes remain unchanged.');
  } catch (error) {
    return fail(error);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}


/**
 * Read-only integrity check for a seeded baseline.
 * Also detects any legacy editor changes made after the baseline was captured.
 */
function validateWebsitePublishingBaseline(token) {
  const lock = LockService.getScriptLock();
  try {
    const actor = wpActor_(token);
    lock.waitLock(20000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const versions = ss.getSheetByName('Website Versions');
    const chunks = ss.getSheetByName('Website Version Chunks');
    const config = ss.getSheetByName('Website Publishing Config');
    if (!versions || !chunks || !config) throw new Error('Website publishing stores have not been prepared.');

    const cfg = wpConfigMap_(config);
    const versionId = cfg.baseline_version_id || '';
    if (!versionId) throw new Error('No baseline version has been seeded.');
    const vh = versions.getRange(1, 1, 1, WP_VERSION_HEADERS_.length).getDisplayValues()[0];
    if (WP_VERSION_HEADERS_.some((header, i) => vh[i] !== header)) throw new Error('Website Versions header schema mismatch.');
    const ch = chunks.getRange(1, 1, 1, WP_CHUNK_HEADERS_.length).getDisplayValues()[0];
    if (WP_CHUNK_HEADERS_.some((header, i) => ch[i] !== header)) throw new Error('Website Version Chunks header schema mismatch.');

    const versionRows = versions.getLastRow() > 1
      ? versions.getRange(2, 1, versions.getLastRow() - 1, WP_VERSION_HEADERS_.length).getValues()
      : [];
    const versionMatches = versionRows.filter(row => wpText_(row[0]) === versionId);
    if (versionMatches.length !== 1) throw new Error('The baseline version metadata is missing or duplicated.');
    const meta = versionMatches[0];
    if (wpText_(meta[2]) !== 'Baseline') throw new Error('The baseline version is not in the immutable Baseline state.');

    const chunkRows = chunks.getLastRow() > 1
      ? chunks.getRange(2, 1, chunks.getLastRow() - 1, WP_CHUNK_HEADERS_.length).getDisplayValues()
          .filter(row => row[0] === versionId)
          .sort((a, b) => Number(a[1]) - Number(b[1]))
      : [];
    const expectedCount = Number(meta[15]) || 0;
    let chunkIntegrity = chunkRows.length === expectedCount && expectedCount > 0;
    const parts = [];
    chunkRows.forEach((row, index) => {
      const part = wpText_(row[3]);
      if (Number(row[1]) !== index + 1 || Number(row[2]) !== expectedCount || wpHash_(part) !== row[4]) chunkIntegrity = false;
      parts.push(part);
    });
    const payloadJson = parts.join('');
    const payloadHash = wpHash_(payloadJson);
    const payloadIntegrity = chunkIntegrity &&
      payloadHash === wpText_(meta[12]) &&
      payloadJson.length === Number(meta[13]) &&
      Utilities.newBlob(payloadJson, 'application/json').getBytes().length === Number(meta[14]);

    let parsed = null, payloadSchemaValid = false;
    try {
      parsed = JSON.parse(payloadJson);
      payloadSchemaValid = !!parsed && parsed.schemaVersion === WP_PREFLIGHT_SCHEMA_ &&
        Array.isArray(parsed.contentRows) && parsed.defaults && typeof parsed.defaults === 'object' &&
        parsed.eventFeed && parsed.eventFeed.source === 'Events' &&
        parsed.galleries && typeof parsed.galleries === 'object';
    } catch (_) {}

    const live = websitePublishingPreflight(token);
    if (!live.success) throw new Error(live.error || 'The current live-source preflight failed.');
    const liveHash = live.data.candidatePayload.sha256;
    const sourceUnchanged = liveHash === wpText_(meta[12]);
    const report = {
      generatedAt:new Date().toISOString(),
      generatedBy:actor.Username,
      baselineVersionId:versionId,
      versionStatus:wpText_(meta[2]),
      chunkCountStored:chunkRows.length,
      chunkCountExpected:expectedCount,
      chunkIntegrity:chunkIntegrity,
      payloadIntegrity:payloadIntegrity,
      payloadSchemaValid:payloadSchemaValid,
      baselinePayloadHash:wpText_(meta[12]),
      currentLivePayloadHash:liveHash,
      sourceUnchangedSinceSeed:sourceUnchanged,
      livePreflightReady:!!live.data.readiness.readyForBaselineSeed,
      livePreflightBlockers:live.data.readiness.blockers,
      publishedVersionId:cfg.published_version_id || '',
      migrationState:cfg.migration_state || '',
      baselineValidationPassed:payloadIntegrity && payloadSchemaValid,
      sourceDriftDetected:!sourceUnchanged
    };
    return ok(report, report.baselineValidationPassed
      ? (sourceUnchanged ? 'Baseline integrity verified; live sources are unchanged.' : 'Baseline integrity verified, but live website content changed after seeding.')
      : 'Baseline integrity verification failed.');
  } catch (error) {
    return fail(error);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}


const WP_PERMISSION_KEYS_ = [
  'website.content.edit',
  'website.content.review',
  'website.content.publish',
  'website.content.rollback'
];

function wpPermissionProperty_(username) {
  return 'WP_PERMS_' + String(username || '').toLowerCase().replace(/[^a-z0-9._-]/g, '_');
}

function wpPermissionMap_(username) {
  const raw = PropertiesService.getScriptProperties().getProperty(wpPermissionProperty_(username));
  if (!raw) return {};
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_) { throw new Error('Website permission configuration is malformed for ' + username + '.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Website permission configuration is invalid for ' + username + '.');
  const out = {};
  WP_PERMISSION_KEYS_.forEach(key => { out[key] = parsed[key] === true; });
  return out;
}

function wpRequirePermission_(token, permission) {
  const user = who_(token, 'admin');
  if (!WP_PERMISSION_KEYS_.includes(permission)) throw new Error('Unknown website permission.');
  const map = wpPermissionMap_(user.Username);
  if (map[permission] !== true) throw new Error('You do not have the website permission: ' + permission);
  return user;
}

/**
 * Full administrator assigns explicit user-level website permissions.
 * No role template or clearance implicitly grants publish/review access.
 */
function setWebsiteUserPermissions(token, username, permissions) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const actor = sysOwner_(token);
    const target = String(username || '').trim().toLowerCase();
    if (!/^[a-z0-9._@-]{4,60}$/.test(target)) throw new Error('Enter a valid existing username.');
    const matches = rows_('U').filter(user => wpText_(user.Username).trim().toLowerCase() === target && wpText_(user.Role).trim().toLowerCase() === 'admin');
    if (matches.length !== 1) throw new Error(matches.length ? 'The target username is ambiguous in the staff account table.' : 'The target staff account was not found.');
    if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) throw new Error('Invalid permission map.');
    const next = {};
    WP_PERMISSION_KEYS_.forEach(key => {
      if (permissions[key] !== undefined && typeof permissions[key] !== 'boolean') throw new Error('Permission values must be true or false.');
      next[key] = permissions[key] === true;
    });
    PropertiesService.getScriptProperties().setProperty(wpPermissionProperty_(target), JSON.stringify(next));
    audit_(actor, 'website.permission.set', target, JSON.stringify(next));
    const result = { username:target, permissions:next };
    return ok(result, 'Website permissions saved.');
  } catch (error) {
    return fail(error);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}


function wpValidateDraftAssets_(payload, actor) {
  const ids = wpReferencedDriveIds_(payload.contentRows || [], payload.galleries || {}, payload.defaults || {});
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mediaSheet = ss.getSheetByName('Website Draft Media');
  const staged = {};
  if (mediaSheet && mediaSheet.getLastRow() > 1) {
    mediaSheet.getRange(2, 1, mediaSheet.getLastRow() - 1, WP_MEDIA_HEADERS_.length).getDisplayValues()
      .forEach(row => { if (row[0]) staged[row[0]] = staged[row[0]] ? { duplicate:true } : { state:row[6], uploadedBy:row[4] }; });
  }
  const invalid = [];
  const folderId = PropertiesService.getScriptProperties().getProperty(WP_MEDIA_FOLDER_PROPERTY_);
  ids.forEach(id => {
    try {
      const file = DriveApp.getFileById(id);
      if (file.isTrashed() || !/^image\/(png|jpeg|webp|gif)$/i.test(file.getMimeType() || '')) {
        invalid.push(id);
        return;
      }
      if (staged[id]) {
        if (staged[id].duplicate || staged[id].state !== 'Staged' || !folderId || !actor || wpText_(staged[id].uploadedBy).toLowerCase() !== wpText_(actor.Username).toLowerCase()) { invalid.push(id); return; }
        const parents = file.getParents();
        let inStagingFolder = false;
        while (parents.hasNext()) if (parents.next().getId() === folderId) inStagingFolder = true;
        if (!inStagingFolder || file.getSharingAccess() === DriveApp.Access.ANYONE ||
            file.getSharingAccess() === DriveApp.Access.ANYONE_WITH_LINK) invalid.push(id);
      } else if (typeof inPhotoFolder_ !== 'function' || !inPhotoFolder_(id)) {
        // Existing (non-staged) images are trusted only when they belong to the
        // established public-photo library. Never allow a draft to reference an
        // arbitrary Drive image that happens to be readable by the script owner.
        invalid.push(id);
      }
    } catch (_) { invalid.push(id); }
  });
  if (invalid.length) throw new Error('Draft references missing, trashed, unsupported, or unavailable image assets: ' + invalid.join(', '));
}

function wpReadVersion_(versionId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const versions = ss.getSheetByName('Website Versions');
  const chunks = ss.getSheetByName('Website Version Chunks');
  if (!versions || !chunks) throw new Error('Website publishing stores have not been prepared.');
  const rows = versions.getLastRow() > 1
    ? versions.getRange(2, 1, versions.getLastRow() - 1, WP_VERSION_HEADERS_.length).getValues()
    : [];
  const matches = [];
  rows.forEach((row, index) => { if (wpText_(row[0]) === versionId) matches.push({ row:row, sheetRow:index + 2 }); });
  if (matches.length !== 1) throw new Error('Website version was not found or is duplicated.');
  const meta = matches[0].row;
  const stored = chunks.getLastRow() > 1
    ? chunks.getRange(2, 1, chunks.getLastRow() - 1, WP_CHUNK_HEADERS_.length).getDisplayValues()
        .filter(row => row[0] === versionId).sort((a, b) => Number(a[1]) - Number(b[1]))
    : [];
  const count = Number(meta[15]) || 0;
  if (!count || stored.length !== count) throw new Error('Website version payload chunks are incomplete.');
  const parts = [];
  stored.forEach((row, index) => {
    if (Number(row[1]) !== index + 1 || Number(row[2]) !== count || wpHash_(row[3]) !== row[4]) {
      throw new Error('Website version payload chunk integrity check failed.');
    }
    parts.push(row[3]);
  });
  const json = parts.join('');
  if (wpHash_(json) !== wpText_(meta[12]) || json.length !== Number(meta[13]) ||
      Utilities.newBlob(json, 'application/json').getBytes().length !== Number(meta[14])) {
    throw new Error('Website version payload integrity check failed.');
  }
  let payload;
  try { payload = JSON.parse(json); } catch (_) { throw new Error('Website version payload is not valid JSON.'); }
  if (!payload || payload.schemaVersion !== WP_PREFLIGHT_SCHEMA_ ||
      !Array.isArray(payload.contentRows) || !payload.defaults ||
      !payload.eventFeed || payload.eventFeed.source !== 'Events' ||
      !payload.galleries || typeof payload.galleries !== 'object') {
    throw new Error('Website version payload schema is invalid.');
  }
  return { meta:meta, sheetRow:matches[0].sheetRow, payload:payload, hash:wpText_(meta[12]) };
}

function wpWriteVersion_(versionId, parentId, status, actor, payload, notes) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const versions = ss.getSheetByName('Website Versions');
  const chunks = ss.getSheetByName('Website Version Chunks');
  if (!versions || !chunks) throw new Error('Website publishing stores have not been prepared.');
  const json = JSON.stringify(payload);
  const parts = wpSplitChunks_(json, WP_PREFLIGHT_CHUNK_CHARS_);
  const rows = parts.map((part, index) => [versionId, index + 1, parts.length, part, wpHash_(part)]);
  const start = chunks.getLastRow() + 1;
  chunks.getRange(start, 1, rows.length, WP_CHUNK_HEADERS_.length).setNumberFormat('@');
  chunks.getRange(start, 1, rows.length, WP_CHUNK_HEADERS_.length).setValues(rows);
  const verify = chunks.getRange(start, 1, rows.length, WP_CHUNK_HEADERS_.length).getDisplayValues();
  const rebuilt = verify.map(row => row[3]).join('');
  if (verify.length !== parts.length || wpHash_(rebuilt) !== wpHash_(json)) {
    throw new Error('New website version payload failed storage verification.');
  }
  const now = new Date();
  const bytes = Utilities.newBlob(json, 'application/json').getBytes().length;
  versions.appendRow([
    versionId, parentId || '', status, actor.Username, now, actor.Username, now,
    '', '', notes || '', '', '', wpHash_(json), json.length, bytes, parts.length
  ]);
  return { versionId:versionId, payloadHash:wpHash_(json), payloadChars:json.length, payloadBytes:bytes, payloadChunkCount:parts.length };
}

function wpUpdateVersionStatus_(version, values) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Website Versions');
  const current = version.meta.slice();
  Object.keys(values).forEach(key => {
    const index = WP_VERSION_HEADERS_.indexOf(key);
    if (index < 0) throw new Error('Invalid website version metadata field.');
    current[index] = values[key];
  });
  sheet.getRange(version.sheetRow, 1, 1, WP_VERSION_HEADERS_.length).setValues([current]);
}

/** Creates a new editable draft from the immutable live baseline. */
function createWebsiteDraft(token) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const actor = wpRequirePermission_(token, 'website.content.edit');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const config = ss.getSheetByName('Website Publishing Config');
    if (!config) throw new Error('Website publishing stores have not been prepared.');
    const cfg = wpConfigMap_(config);
    const baselineId = cfg.baseline_version_id || '';
    if (!baselineId) throw new Error('Seed and validate the migration baseline before creating a draft.');
    const baseline = wpReadVersion_(baselineId);
    const id = 'WV-' + Utilities.getUuid();
    const saved = wpWriteVersion_(id, baselineId, 'Draft', actor, baseline.payload, 'New draft copied from the immutable migration baseline.');
    const audit = ss.getSheetByName('Website Publishing Audit');
    audit.appendRow([Utilities.getUuid(), id, 'draft.create', actor.Username, new Date(), 'Draft copied from baseline ' + baselineId, saved.payloadHash]);
    return ok({ versionId:id, parentVersionId:baselineId, status:'Draft', payloadHash:saved.payloadHash, payloadChars:saved.payloadChars, payloadChunkCount:saved.payloadChunkCount }, 'Website draft created.');
  } catch (error) {
    return fail(error);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/** Saves a new immutable revision; the prior draft version remains available for audit. */
function saveWebsiteDraft(token, parentVersionId, payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const actor = wpRequirePermission_(token, 'website.content.edit');
    const parent = wpReadVersion_(String(parentVersionId || ''));
    if (!['Draft','ChangesRequested'].includes(wpText_(parent.meta[2]))) throw new Error('Only a Draft or Changes Requested version can be revised.');
    if (wpText_(parent.meta[3]).toLowerCase() !== actor.Username.toLowerCase()) throw new Error('Only the draft creator can revise this version.');
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        payload.schemaVersion !== WP_PREFLIGHT_SCHEMA_ || !Array.isArray(payload.contentRows) ||
        !payload.defaults || typeof payload.defaults !== 'object' ||
        !payload.eventFeed || payload.eventFeed.source !== 'Events' ||
        !payload.galleries || typeof payload.galleries !== 'object') {
      throw new Error('The submitted website payload does not match the supported schema.');
    }
    const keys = {};
    payload.contentRows.forEach(row => {
      if (!Array.isArray(row) || row.length !== 2 || !wpText_(row[0]).trim()) throw new Error('Website content rows must contain a non-empty key and a value.');
      const key = wpText_(row[0]);
      if (keys[key]) throw new Error('Duplicate website content key: ' + key);
      keys[key] = true;
      if (wpText_(row[1]).length > 45000) throw new Error('A website content value exceeds the Google Sheets cell limit: ' + key);
    });
    const allowedPages = typeof GAL_PAGES !== 'undefined' ? GAL_PAGES : [];
    Object.keys(payload.galleries).forEach(page => {
      if (!allowedPages.includes(page) || !Array.isArray(payload.galleries[page])) throw new Error('Invalid website gallery page: ' + page);
      const seen = {};
      payload.galleries[page].forEach(item => {
        if (!item || !/^[A-Za-z0-9_-]{10,80}$/.test(wpText_(item.id)) || seen[item.id]) throw new Error('Invalid or duplicate gallery asset reference on ' + page + '.');
        seen[item.id] = true;
        if (wpText_(item.cap).length > 120) throw new Error('Gallery captions must be 120 characters or fewer.');
      });
    });
    wpValidateDraftAssets_(payload, actor);
    const id = 'WV-' + Utilities.getUuid();
    const saved = wpWriteVersion_(id, parentVersionId, 'Draft', actor, payload, 'Revision of draft ' + parentVersionId);
    const audit = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Website Publishing Audit');
    audit.appendRow([Utilities.getUuid(), id, 'draft.revise', actor.Username, new Date(), 'Created from ' + parentVersionId, saved.payloadHash]);
    return ok({ versionId:id, parentVersionId:parentVersionId, status:'Draft', payloadHash:saved.payloadHash }, 'Website draft revision saved.');
  } catch (error) {
    return fail(error);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/** Submits a creator-owned draft for independent review. */
function submitWebsiteDraftForReview(token, versionId) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const actor = wpRequirePermission_(token, 'website.content.edit');
    const version = wpReadVersion_(String(versionId || ''));
    if (!['Draft','ChangesRequested'].includes(wpText_(version.meta[2]))) throw new Error('This version is not ready for review submission.');
    if (wpText_(version.meta[3]).toLowerCase() !== actor.Username.toLowerCase()) throw new Error('Only the draft creator can submit this version.');
    wpUpdateVersionStatus_(version, { Status:'InReview', UpdatedBy:actor.Username, UpdatedAt:new Date() });
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Website Publishing Audit')
      .appendRow([Utilities.getUuid(), versionId, 'draft.submit', actor.Username, new Date(), 'Submitted for independent review.', version.hash]);
    return ok({ versionId:versionId, status:'InReview' }, 'Website draft submitted for review.');
  } catch (error) {
    return fail(error);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/** Reviewer cannot approve or request changes on their own draft. */
function reviewWebsiteDraft(token, versionId, decision, notes) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const actor = wpRequirePermission_(token, 'website.content.review');
    const version = wpReadVersion_(String(versionId || ''));
    if (wpText_(version.meta[2]) !== 'InReview') throw new Error('Only a version awaiting review can be reviewed.');
    if (wpText_(version.meta[3]).toLowerCase() === actor.Username.toLowerCase()) throw new Error('A draft creator cannot review their own draft.');
    decision = String(decision || '').trim();
    if (!['Approve','RequestChanges'].includes(decision)) throw new Error('Choose Approve or RequestChanges.');
    notes = String(notes || '').trim().slice(0, 2000);
    if (decision === 'RequestChanges' && !notes) throw new Error('Provide review notes when requesting changes.');
    const now = new Date();
    const status = decision === 'Approve' ? 'Approved' : 'ChangesRequested';
    wpUpdateVersionStatus_(version, {
      Status:status, ReviewedBy:actor.Username, ReviewedAt:now, ReviewNotes:notes,
      UpdatedBy:actor.Username, UpdatedAt:now
    });
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Website Publishing Audit')
      .appendRow([Utilities.getUuid(), versionId, 'draft.' + decision.toLowerCase(), actor.Username, now, notes, version.hash]);
    return ok({ versionId:versionId, status:status, reviewedBy:actor.Username, reviewNotes:notes }, status === 'Approved' ? 'Website draft approved.' : 'Changes requested.');
  } catch (error) {
    return fail(error);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/**
 * Publication is deliberately blocked until every anonymous public reader is switched
 * to the immutable version store and the staged-media lifecycle has passed acceptance tests.
 */
function publishWebsiteVersion(token, versionId) {
  try {
    wpRequirePermission_(token, 'website.content.publish');
    return fail(new Error('Publishing is disabled until the public-reader cutover and media publication lifecycle are implemented and verified.'));
  } catch (error) {
    return fail(error);
  }
}


function getMyWebsitePermissions(token) {
  try {
    const user = who_(token, 'admin');
    return ok({ username:user.Username, permissions:wpPermissionMap_(user.Username), available:WP_PERMISSION_KEYS_.slice() });
  } catch (error) {
    return fail(error);
  }
}

function listWebsiteVersions(token) {
  try {
    const user = who_(token, 'admin');
    const permissions = wpPermissionMap_(user.Username);
    if (!permissions['website.content.edit'] && !permissions['website.content.review'] &&
        !permissions['website.content.publish'] && !permissions['website.content.rollback'] &&
        user.Clearance !== 'Full') throw new Error('You do not have access to website publishing.');
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Website Versions');
    if (!sheet || sheet.getLastRow() < 2) return ok([]);
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, WP_VERSION_HEADERS_.length).getValues();
    const versions = rows.filter(row => row[0] && (user.Clearance === 'Full' || permissions['website.content.review'] || wpText_(row[3]).toLowerCase() === user.Username.toLowerCase() || (['Baseline','Published','Archived'].includes(wpText_(row[2])) || (wpText_(row[2]) === 'Approved' && permissions['website.content.publish'])))).map(row => ({
      versionId:wpText_(row[0]), parentVersionId:wpText_(row[1]), status:wpText_(row[2]),
      createdBy:wpText_(row[3]), createdAt:row[4] instanceof Date ? row[4].toISOString() : wpText_(row[4]),
      updatedBy:wpText_(row[5]), updatedAt:row[6] instanceof Date ? row[6].toISOString() : wpText_(row[6]),
      reviewedBy:wpText_(row[7]), reviewedAt:row[8] instanceof Date ? row[8].toISOString() : wpText_(row[8]),
      reviewNotes:wpText_(row[9]), publishedBy:wpText_(row[10]),
      publishedAt:row[11] instanceof Date ? row[11].toISOString() : wpText_(row[11]),
      payloadHash:wpText_(row[12]), payloadChars:Number(row[13]) || 0,
      payloadBytes:Number(row[14]) || 0, payloadChunkCount:Number(row[15]) || 0
    }));
    return ok(versions.sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))));
  } catch (error) {
    return fail(error);
  }
}

function getWebsiteVersion(token, versionId) {
  try {
    const user = who_(token, 'admin');
    const permissions = wpPermissionMap_(user.Username);
    if (!permissions['website.content.edit'] && !permissions['website.content.review'] &&
        !permissions['website.content.publish'] && !permissions['website.content.rollback'] &&
        user.Clearance !== 'Full') throw new Error('You do not have access to website publishing.');
    const version = wpReadVersion_(String(versionId || ''));
    if (!['Baseline','Published','Archived'].includes(wpText_(version.meta[2])) &&
        !(wpText_(version.meta[2]) === 'Approved' && permissions['website.content.publish']) &&
        wpText_(version.meta[3]).toLowerCase() !== user.Username.toLowerCase() &&
        !permissions['website.content.review'] && user.Clearance !== 'Full') {
      throw new Error("You cannot view another user's draft.");
    }
    return ok({
      versionId:wpText_(version.meta[0]), parentVersionId:wpText_(version.meta[1]),
      status:wpText_(version.meta[2]), createdBy:wpText_(version.meta[3]),
      updatedBy:wpText_(version.meta[5]), reviewedBy:wpText_(version.meta[7]),
      reviewNotes:wpText_(version.meta[9]), payloadHash:version.hash, payload:version.payload
    });
  } catch (error) {
    return fail(error);
  }
}


/**
 * Returns one leader photo only when the selected authorized version explicitly references it.
 * Private staged assets remain private in Drive; the image bytes are streamed to the authenticated editor.
 */
function getWebsiteDraftAboutPhoto(token, versionId, assetId) {
  try {
    const version = getWebsiteVersion(token, versionId);
    if (!version || version.success !== true) return version || fail(new Error('Unable to read the selected website version.'));
    const id = String(assetId || '');
    if (!/^[A-Za-z0-9_-]{10,80}$/.test(id)) throw new Error('Invalid About photo reference.');
    const rows = version.data.payload.contentRows || [];
    const records = rows.filter(row => row[0] === 'about_data');
    if (records.length !== 1) throw new Error('The selected version does not contain one valid About record.');
    let about;
    try { about = JSON.parse(records[0][1]); }
    catch (_) { throw new Error('The selected version contains invalid About data.'); }
    const referenced = Array.isArray(about.leaders) && about.leaders.some(person => String(person && person.photo || '') === id);
    if (!referenced) throw new Error('This photo is not referenced by the selected About version.');
    const mediaSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Website Draft Media');
    const mediaRows = mediaSheet && mediaSheet.getLastRow() > 1
      ? mediaSheet.getRange(2, 1, mediaSheet.getLastRow() - 1, WP_MEDIA_HEADERS_.length).getDisplayValues()
      : [];
    const staged = mediaRows.filter(row => row[0] === id);
    let allowed = false;
    if (staged.length === 1 && staged[0][6] === 'Staged') {
      const folderId = PropertiesService.getScriptProperties().getProperty(WP_MEDIA_FOLDER_PROPERTY_);
      const file = DriveApp.getFileById(id);
      const parents = file.getParents();
      while (parents.hasNext()) if (parents.next().getId() === folderId) allowed = true;
      if (file.isTrashed() || !folderId || !allowed ||
          file.getSharingAccess() === DriveApp.Access.ANYONE ||
          file.getSharingAccess() === DriveApp.Access.ANYONE_WITH_LINK) allowed = false;
    } else if (!staged.length && typeof inPhotoFolder_ === 'function') {
      allowed = inPhotoFolder_(id);
    }
    if (!allowed) throw new Error('The referenced About photo is unavailable or is not approved website media.');
    const uri = photo_(id);
    if (!uri) throw new Error('The referenced About photo could not be read.');
    return ok(uri, 'About photo loaded from the selected website version.');
  } catch (error) {
    return fail(error);
  }
}

/**
 * Produces a full website payload revision with only the structured About record changed.
 * All legacy About HTML and unrelated page content are copied without modification.
 */
function wpAboutPayloadWithData_(sourcePayload, aboutData) {
  if (!sourcePayload || typeof sourcePayload !== 'object' || !Array.isArray(sourcePayload.contentRows)) {
    throw new Error('The source website version has no valid content row collection.');
  }
  const payload = JSON.parse(JSON.stringify(sourcePayload));
  const rows = payload.contentRows;
  const matches = [];
  rows.forEach((row, index) => {
    if (!Array.isArray(row) || row.length !== 2) throw new Error('The source website version contains an invalid content row.');
    if (row[0] === 'about_data') matches.push(index);
  });
  if (matches.length > 1) throw new Error('The website version contains duplicate about_data keys.');
  const value = JSON.stringify(aboutData);
  if (matches.length === 1) rows[matches[0]][1] = value;
  else rows.push(['about_data', value]);
  return payload;
}

/**
 * Reads the About Moreh Academy sections from one immutable website version.
 * The legacy About HTML is returned for preservation and migration; it is not rewritten.
 */
function getWebsiteDraftAbout(token, versionId) {
  try {
    const result = getWebsiteVersion(token, versionId);
    if (!result || result.success !== true) return result || fail(new Error('Unable to read the website version.'));
    const rows = result.data.payload.contentRows || [];
    const aboutRows = rows.filter(row => row[0] === 'about_data');
    const legacyRows = rows.filter(row => row[0] === 'about');
    if (aboutRows.length > 1 || legacyRows.length > 1) throw new Error('The About content contains duplicate keys; reconcile the baseline before editing.');
    let about = ABOUT_DEFAULT;
    if (aboutRows.length && wpText_(aboutRows[0][1]).trim()) {
      try { about = JSON.parse(aboutRows[0][1]); }
      catch (_) { throw new Error('The saved About content is not valid JSON.'); }
    }
    return ok({
      versionId:result.data.versionId,
      parentVersionId:result.data.parentVersionId,
      status:result.data.status,
      about:aboutClean_(about),
      legacyAbout:legacyRows.length ? wpText_(legacyRows[0][1]) : ''
    }, 'About content loaded from the selected website version.');
  } catch (error) {
    return fail(error);
  }
}

/**
 * Saves the five About sections as a new immutable revision of the editor's draft.
 * It updates only about_data and preserves legacy About HTML plus every other site record.
 * Leader photos may reference existing approved photos or privately staged draft media;
 * the full-payload validator verifies every referenced Drive asset before storage.
 */
function saveWebsiteDraftAbout(token, parentVersionId, aboutData) {
  try {
    const actor = wpRequirePermission_(token, 'website.content.edit');
    const parent = wpReadVersion_(String(parentVersionId || ''));
    if (!['Draft','ChangesRequested'].includes(wpText_(parent.meta[2]))) {
      throw new Error('Only a Draft or Changes Requested version can be edited.');
    }
    if (wpText_(parent.meta[3]).toLowerCase() !== actor.Username.toLowerCase()) {
      throw new Error('Only the draft creator can edit this About content.');
    }
    if (typeof aboutClean_ !== 'function') throw new Error('The About content validator is unavailable.');
    const clean = aboutClean_(aboutData);
    clean.timeline.sort((a, b) => String(a.year).localeCompare(String(b.year), undefined, { numeric:true }));
    clean.leaders.forEach(leader => {
      if (leader.email && !EMAIL_RE.test(leader.email)) throw new Error('Enter a valid email address for ' + leader.name + '.');
    });
    const payload = wpAboutPayloadWithData_(parent.payload, clean);
    const saved = saveWebsiteDraft(token, parentVersionId, payload);
    if (!saved || saved.success !== true) return saved || fail(new Error('The About draft revision could not be saved.'));
    return ok({
      versionId:saved.data.versionId,
      parentVersionId:parentVersionId,
      status:saved.data.status,
      about:clean
    }, 'About Moreh Academy saved as a new website draft revision.');
  } catch (error) {
    return fail(error);
  }
}


/**
 * Read-only diagnostic for the website publishing foundation.
 * It does not create sheets, alter permissions, edit versions, or change the public site.
 */
function websitePublishingSelfCheck(token) {
  try {
    const actor = wpActor_(token);
    const checks = [];
    const check = (name, passed, detail) => checks.push({ name:name, passed:!!passed, detail:detail || '' });
    const unicodeSample = 'a'.repeat(WP_PREFLIGHT_CHUNK_CHARS_ - 1) + '😀' + 'b'.repeat(17);
    const unicodeParts = wpSplitChunks_(unicodeSample, WP_PREFLIGHT_CHUNK_CHARS_);
    const aboutFixture = {
      schemaVersion:WP_PREFLIGHT_SCHEMA_,
      contentRows:[['about','<p>Legacy About text</p>'],['pubhome','Homepage copy'],['about_data','{}']],
      defaults:{}, eventFeed:{source:'Events'}, galleries:{}
    };
    const aboutFixtureUpdated = wpAboutPayloadWithData_(aboutFixture, { vision:{title:'Test vision',text:''} });
    check('About draft update preserves legacy and unrelated content',
      aboutFixtureUpdated.contentRows.length === 3 &&
      aboutFixtureUpdated.contentRows.find(row => row[0] === 'about')[1] === '<p>Legacy About text</p>' &&
      aboutFixtureUpdated.contentRows.find(row => row[0] === 'pubhome')[1] === 'Homepage copy' &&
      JSON.parse(aboutFixtureUpdated.contentRows.find(row => row[0] === 'about_data')[1]).vision.title === 'Test vision' &&
      aboutFixture.contentRows.find(row => row[0] === 'about_data')[1] === '{}',
      'Synthetic check confirms only about_data changes and the source payload remains immutable.');
    check('Unicode-safe chunk round trip',
      unicodeParts.join('') === unicodeSample && unicodeParts.every((part, index) => {
        if (index === unicodeParts.length - 1 || !part.length) return true;
        const last = part.charCodeAt(part.length - 1);
        return !(last >= 0xD800 && last <= 0xDBFF);
      }), 'Synthetic emoji boundary round trip across ' + unicodeParts.length + ' chunks.');
    check('Version schema has unique headers', new Set(WP_VERSION_HEADERS_).size === WP_VERSION_HEADERS_.length);
    check('Chunk schema has unique headers', new Set(WP_CHUNK_HEADERS_).size === WP_CHUNK_HEADERS_.length);
    check('Config schema has unique headers', new Set(WP_CONFIG_HEADERS_).size === WP_CONFIG_HEADERS_.length);
    check('Audit schema has unique headers', new Set(WP_AUDIT_HEADERS_).size === WP_AUDIT_HEADERS_.length);
    check('Media schema has unique headers', new Set(WP_MEDIA_HEADERS_).size === WP_MEDIA_HEADERS_.length);
    check('Explicit website permission catalog is unique',
      new Set(WP_PERMISSION_KEYS_).size === WP_PERMISSION_KEYS_.length &&
      WP_PERMISSION_KEYS_.every(key => /^website\.content\.(edit|review|publish|rollback)$/.test(key)));
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const expected = [
      ['Website Versions',WP_VERSION_HEADERS_],
      ['Website Version Chunks',WP_CHUNK_HEADERS_],
      ['Website Publishing Config',WP_CONFIG_HEADERS_],
      ['Website Publishing Audit',WP_AUDIT_HEADERS_],
      ['Website Draft Media',WP_MEDIA_HEADERS_]
    ];
    const storeStates = expected.map(([name, headers]) => {
      const sheet = ss.getSheetByName(name);
      if (!sheet) return { name:name, exists:false, headerValid:false, rows:0 };
      const actual = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
      return { name:name, exists:true, headerValid:headers.every((header, index) => actual[index] === header), rows:Math.max(0, sheet.getLastRow() - 1) };
    });
    check('Additive publishing store headers', storeStates.every(item => item.exists && item.headerValid),
      storeStates.map(item => item.name + ': ' + (item.headerValid ? 'valid' : 'missing/invalid')).join('; '));
    const mediaFolderId = PropertiesService.getScriptProperties().getProperty(WP_MEDIA_FOLDER_PROPERTY_);
    let mediaFolderPrivate = false;
    if (mediaFolderId) {
      try {
        const folder = DriveApp.getFolderById(mediaFolderId);
        mediaFolderPrivate = !folder.isTrashed() &&
          ![DriveApp.Access.ANYONE, DriveApp.Access.ANYONE_WITH_LINK].includes(folder.getSharingAccess());
      } catch (_) {}
    }
    check('Draft media folder exists and is not publicly shared', mediaFolderPrivate,
      mediaFolderPrivate ? 'Private draft media folder is available.' : 'Run setup and verify the folder sharing policy.');
    const configSheet = ss.getSheetByName('Website Publishing Config');
    let config = {}, configValid = false;
    if (configSheet) {
      config = wpConfigMap_(configSheet);
      configValid = !!config.schema_version && !!config.migration_state &&
        Object.prototype.hasOwnProperty.call(config, 'published_version_id') &&
        Object.prototype.hasOwnProperty.call(config, 'baseline_version_id');
    }
    check('Publishing configuration is readable', configValid);
    check('No public version is activated prematurely', !config.published_version_id,
      config.published_version_id ? 'A published pointer exists; verify the reader cutover before continuing.' : 'Published pointer is blank.');
    const baselineId = config.baseline_version_id || '';
    if (baselineId) {
      const baseline = wpReadVersion_(baselineId);
      check('Baseline metadata and payload integrity', wpText_(baseline.meta[2]) === 'Baseline', 'Baseline version: ' + baselineId);
    } else {
      check('Baseline metadata and payload integrity', false, 'No baseline has been seeded yet.');
    }
    const passed = checks.filter(item => item.passed).length;
    const failed = checks.length - passed;
    return ok({
      generatedAt:new Date().toISOString(), generatedBy:actor.Username,
      checks:checks, passed:passed, failed:failed, stores:storeStates,
      migrationState:config.migration_state || 'UNPREPARED',
      baselineVersionId:baselineId, publishedVersionId:config.published_version_id || '',
      draftMediaFolderPrivate:mediaFolderPrivate,
      publicReaderCutoverImplemented:false, publishEndpointEnabled:false
    }, failed ? 'Website publishing self-check found issues.' : 'Website publishing self-check passed.');
  } catch (error) {
    return fail(error);
  }
}


/**
 * Uploads a JPEG into a private, non-public Drive folder for website drafts.
 * This endpoint never writes to the live Content or Gallery stores and never
 * grants public sharing. Run setupWebsitePublishingStores() before first use.
 */
function stageWebsiteMedia(token, dataUrl, fileName) {
  const lock = LockService.getScriptLock();
  let fileId = '';
  try {
    lock.waitLock(20000);
    const actor = wpRequirePermission_(token, 'website.content.edit');
    const folderId = PropertiesService.getScriptProperties().getProperty(WP_MEDIA_FOLDER_PROPERTY_);
    if (!folderId) throw new Error('Private draft media storage is not prepared. Run setupWebsitePublishingStores first.');
    const folder = DriveApp.getFolderById(folderId);
    if (folder.isTrashed() || [DriveApp.Access.ANYONE, DriveApp.Access.ANYONE_WITH_LINK].includes(folder.getSharingAccess())) {
      throw new Error('The private draft media folder is unavailable or publicly shared.');
    }
    const parts = String(dataUrl || '').split(',');
    if (parts.length !== 2 || !/^data:image\/jpeg;base64$/i.test(parts[0])) throw new Error('Draft media must be a JPEG image.');
    if (!parts[1] || parts[1].length > Math.ceil(WP_MEDIA_MAX_BYTES_ * 4 / 3) + 8) throw new Error('Draft media exceeds the 2 MB upload limit.');
    const bytes = Utilities.base64Decode(parts[1]);
    if (!bytes.length || bytes.length > WP_MEDIA_MAX_BYTES_ ||
        (bytes[0] & 255) !== 0xFF || (bytes[1] & 255) !== 0xD8) throw new Error('The uploaded file is not a valid JPEG within the 2 MB limit.');
    const safeName = String(fileName || 'website-draft.jpg').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100) || 'website-draft.jpg';
    const file = folder.createFile(Utilities.newBlob(bytes, 'image/jpeg', safeName));
    fileId = file.getId();
    if (file.getSharingAccess() === DriveApp.Access.ANYONE || file.getSharingAccess() === DriveApp.Access.ANYONE_WITH_LINK) {
      file.setTrashed(true);
      throw new Error('Drive returned a publicly shared draft asset; the upload was rejected.');
    }
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Website Draft Media');
    if (!sheet) throw new Error('Website Draft Media store is missing. Run setupWebsitePublishingStores first.');
    sheet.appendRow([fileId, safeName, 'image/jpeg', bytes.length, actor.Username, new Date(), 'Staged']);
    audit_(actor, 'website.media.stage', fileId, safeName);
    return ok({ assetId:fileId, fileName:safeName, mimeType:'image/jpeg', sizeBytes:bytes.length, state:'Staged' }, 'Image uploaded privately for website draft use.');
  } catch (error) {
    if (fileId) {
      try {
        const file = DriveApp.getFileById(fileId);
        if (!file.isTrashed()) file.setTrashed(true);
      } catch (_) {}
    }
    return fail(error);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function listWebsiteStagedMedia(token) {
  try {
    const actor = wpRequirePermission_(token, 'website.content.edit');
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Website Draft Media');
    if (!sheet || sheet.getLastRow() < 2) return ok([]);
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, WP_MEDIA_HEADERS_.length).getDisplayValues();
    return ok(rows.filter(row => row[0] && row[4].toLowerCase() === actor.Username.toLowerCase() && row[6] === 'Staged')
      .map(row => ({ assetId:row[0], fileName:row[1], mimeType:row[2], sizeBytes:Number(row[3]) || 0, uploadedAt:row[5] })));
  } catch (error) {
    return fail(error);
  }
}
