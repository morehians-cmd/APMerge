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

function wpHash_(value) {
  const bytes = Utilities.newBlob(String(value), 'text/plain').getBytes();
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes));
}

function wpText_(value) {
  return String(value == null ? '' : value);
}

function wpReferencedDriveIds_(contentRows, galleries) {
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
  return Object.keys(ids).sort();
}

/**
 * Read-only source inventory for website content migration.
 * No public content or media is changed by this function.
 */
function websitePublishingPreflight(token) {
  try {
    const actor = sysOwner_(token);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const contentSheet = ss.getSheetByName('Content');
    const eventsSheet = ss.getSheetByName('Events');

    if (!contentSheet) throw new Error('The existing Content sheet was not found. Preflight stopped without creating it.');

    const contentRows = contentSheet.getLastRow() > 1
      ? contentSheet.getRange(2, 1, contentSheet.getLastRow() - 1, 2).getDisplayValues()
          .filter(row => wpText_(row[0]).trim() !== '')
          .map(row => [wpText_(row[0]), wpText_(row[1])])
      : [];

    const keyCounts = {};
    contentRows.forEach(row => { keyCounts[row[0]] = (keyCounts[row[0]] || 0) + 1; });
    const duplicateKeys = Object.keys(keyCounts).filter(key => keyCounts[key] > 1).sort();

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

    const driveIds = wpReferencedDriveIds_(contentRows, galleries);
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
      events:eventRows,
      galleries:galleries
    };
    const payloadJson = JSON.stringify(payload);
    const payloadBytes = Utilities.newBlob(payloadJson, 'application/json').getBytes().length;
    const contentJson = JSON.stringify(contentRows);
    const eventJson = JSON.stringify(eventRows);
    const galleryJson = JSON.stringify(galleries);
    const missingOrTrashed = driveFiles.filter(file => !file.exists || file.trashed);
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
        content:{ sheetFound:true, rowCount:contentRows.length, uniqueKeyCount:Object.keys(keyCounts).length, duplicateKeys:duplicateKeys, sha256:wpHash_(contentJson) },
        events:{ sheetFound:!!eventsSheet, rowCount:eventRows.length, sha256:wpHash_(eventJson) },
        galleries:{ pageCount:Object.keys(galleries).length, photoReferenceCount:Object.keys(allGalleryIds).length, duplicateIds:duplicateGalleryIds, sha256:wpHash_(galleryJson) }
      },
      media:{
        referenceCount:driveIds.length,
        files:driveFiles,
        missingOrTrashed:missingOrTrashed
      },
      candidatePayload:{
        serializedChars:payloadJson.length,
        serializedBytes:payloadBytes,
        sha256:wpHash_(payloadJson),
        singleCellSafe:payloadJson.length <= 45000,
        chunkChars:WP_PREFLIGHT_CHUNK_CHARS_,
        requiredChunkRows:Math.max(1, Math.ceil(payloadJson.length / WP_PREFLIGHT_CHUNK_CHARS_)),
        oversizedExistingContentCells:oversizedContentCells
      },
      readiness:{
        readyForBaselineSeed:!!eventsSheet && duplicateKeys.length === 0 && duplicateGalleryIds.length === 0 && missingOrTrashed.length === 0 && oversizedContentCells.length === 0 && payloadJson.length <= 45000,
        blockers:[]
      }
    };

    if (!eventsSheet) report.readiness.blockers.push('Events sheet is absent; confirm whether the public event feed is intentionally empty before seeding.');
    if (duplicateKeys.length) report.readiness.blockers.push('Duplicate Content keys must be reconciled before a deterministic snapshot can be seeded.');
    if (duplicateGalleryIds.length) report.readiness.blockers.push('Duplicate gallery file references were found within a page.');
    if (missingOrTrashed.length) report.readiness.blockers.push('One or more referenced Drive files are missing or trashed.');
    if (oversizedContentCells.length) report.readiness.blockers.push('One or more existing Content values exceed the conservative single-cell limit.');
    if (payloadJson.length > 45000) report.readiness.blockers.push('The complete snapshot requires chunked storage; do not store it in one Google Sheets cell.');

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
  rows.forEach(row => { if (row[0]) existing[wpText_(row[0])] = true; });
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
    const actor = sysOwner_(token);
    lock.waitLock(20000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const versions = wpEnsureSheet_(ss, 'Website Versions', WP_VERSION_HEADERS_);
    const chunks = wpEnsureSheet_(ss, 'Website Version Chunks', WP_CHUNK_HEADERS_);
    const config = wpEnsureSheet_(ss, 'Website Publishing Config', WP_CONFIG_HEADERS_);
    const audit = wpEnsureSheet_(ss, 'Website Publishing Audit', WP_AUDIT_HEADERS_);
    const configKeys = wpConfigEnsure_(config);
    const pointer = config.getLastRow() > 1
      ? config.getRange(2, 1, config.getLastRow() - 1, 2).getDisplayValues().find(row => row[0] === 'published_version_id')
      : null;
    audit.appendRow([
      Utilities.getUuid(),
      '',
      'stores.prepare',
      actor.Username,
      new Date(),
      'Created or verified additive versioned publishing store headers; no live website data changed.',
      ''
    ]);
    return ok({
      sheets:['Website Versions','Website Version Chunks','Website Publishing Config','Website Publishing Audit'],
      versionHeaderCount:WP_VERSION_HEADERS_.length,
      chunkHeaderCount:WP_CHUNK_HEADERS_.length,
      configKeyCount:configKeys,
      publishedVersionId:pointer ? pointer[1] : '',
      migrationState:'PREPARED',
      liveContentChanged:false,
      publicReaderChanged:false,
      editorWritesRedirected:false
    }, 'Website publishing stores are prepared. Existing live website content remains unchanged.');
  } catch (error) {
    return fail(error);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
