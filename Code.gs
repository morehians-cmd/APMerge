/** Moreh Academy Admission Portal — minimal development entry points. */
const APP = Object.freeze({
  name: 'Moreh Academy Admission Portal',
  version: '0.1.0-dev',
  timezone: 'Asia/Manila'
});

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle(APP.name)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}

/** Read-only connection check. Run this before initializing any tabs. */
function checkDatabaseConnection() {
  const ss = getDatabase_();
  return {
    success: true,
    application: APP.name,
    version: APP.version,
    spreadsheetName: ss.getName(),
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    existingTabs: ss.getSheets().map(sheet => sheet.getName())
  };
}

/** Creates only the first essential K–12 tabs. Safe to run more than once. */
function initializeFoundation() {
  const ss = getDatabase_();
  const created = [];
  const existing = [];
  Object.keys(INITIAL_TABLES).forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      created.push(name);
    } else {
      existing.push(name);
    }
    const headers = INITIAL_TABLES[name];
    const lastColumn = sheet.getLastColumn();
    if (sheet.getLastRow() === 0 || lastColumn === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      const actual = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
      if (actual.length !== headers.length || headers.some((value, index) => actual[index] !== value)) {
        throw new Error('Header mismatch in "' + name + '". No existing columns were changed.');
      }
    }
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setWrap(true);
    sheet.setFrozenRows(1);
    sheet.setTabColor('#0F42C0');
  });
  return {
    success: true,
    spreadsheetName: ss.getName(),
    createdTabs: created,
    alreadyExistingTabs: existing,
    totalInitialTabs: Object.keys(INITIAL_TABLES).length
  };
}
