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
        chunkedStorageSupported:true,
        chunkChars:WP_PREFLIGHT_CHUNK_CHARS_,
        requiredChunkRows:Math.max(1, Math.ceil(payloadJson.length / WP_PREFLIGHT_CHUNK_CHARS_)),
        oversizedExistingContentCells:oversizedContentCells
      },
      readiness:{
        readyForBaselineSeed:!!eventsSheet && duplicateKeys.length === 0 && duplicateGalleryIds.length === 0 && missingOrTrashed.length === 0 && oversizedContentCells.length === 0,
        blockers:[]
      }
    };

    if (!eventsSheet) report.readiness.blockers.push('Events sheet is absent; confirm whether the public event feed is intentionally empty before seeding.');
    if (duplicateKeys.length) report.readiness.blockers.push('Duplicate Content keys must be reconciled before a deterministic snapshot can be seeded.');
    if (duplicateGalleryIds.length) report.readiness.blockers.push('Duplicate gallery file references were found within a page.');
    if (missingOrTrashed.length) report.readiness.blockers.push('One or more referenced Drive files are missing or trashed.');
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
    const actor = sysOwner_(token);
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

    const payloadJson = JSON.stringify({ schemaVersion:WP_PREFLIGHT_SCHEMA_, contentRows:contentRows, events:events, galleries:galleries });
    const payloadHash = wpHash_(payloadJson);
    if (payloadHash !== preflight.data.candidatePayload.sha256) {
      throw new Error('Live website content changed after preflight. Run the preflight again and retry.');
    }

    const versionId = 'WV-' + Utilities.getUuid();
    const chunkCount = Math.max(1, Math.ceil(payloadJson.length / WP_PREFLIGHT_CHUNK_CHARS_));
    const chunkRows = [];
    for (let i = 0; i < chunkCount; i++) {
      const part = payloadJson.slice(i * WP_PREFLIGHT_CHUNK_CHARS_, (i + 1) * WP_PREFLIGHT_CHUNK_CHARS_);
      chunkRows.push([versionId, i + 1, chunkCount, part, wpHash_(part)]);
    }

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
      versionId, '', 'Approved', actor.Username, now, actor.Username, now,
      actor.Username, now, 'Immutable migration baseline captured from the current live website.',
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
      status:'Approved',
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
