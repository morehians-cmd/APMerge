/** Phase 1 entry points. No production web app deployment is configured. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(MA_CONFIG.applicationName)
    .addMetaTag('viewport','width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** Run manually from the Apps Script editor on a NEW development spreadsheet. */
function initializeFoundation() {
  assertEditorOwner_();
  return withScriptLock_(() => {
    const ss = getDatabase_(), created = [], existing = [];
    Object.keys(MA_SCHEMA).forEach(name => {
      let sh = ss.getSheetByName(name);
      if (!sh) { sh = ss.insertSheet(name); created.push(name); }
      else existing.push(name);
      const expected = MA_SCHEMA[name];
      if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
        sh.getRange(1,1,1,expected.length).setValues([expected]);
      } else {
        assertTableHeaders_(sh,expected);
      }
      const header = sh.getRange(1,1,1,expected.length);
      header.setFontWeight('bold').setWrap(true);
      sh.setFrozenRows(1);
      if (!sh.getFilter() && sh.getLastRow() > 1) sh.getRange(1,1,Math.max(2,sh.getLastRow()),expected.length).createFilter();
      sh.setTabColor('#0F42C0');
    });
    seedReferenceData_(ss);
    PropertiesService.getScriptProperties().setProperty('MA_SCHEMA_VERSION',MA_SCHEMA_VERSION);
    return {success:true,version:MA_SCHEMA_VERSION,spreadsheetId:ss.getId(),spreadsheetName:ss.getName(),createdTabs:created,existingTabs:existing,tabCount:Object.keys(MA_SCHEMA).length};
  });
}

function seedReferenceData_(ss) {
  const definitions = {
    Grade_Levels:{headers:['GradeLevelID','GradeLevelName','Department','GradeOrder','IsActive'],rows:MA_REFERENCE_DATA.Grade_Levels},
    Strands:{headers:['StrandID','StrandCode','StrandName','IsActive'],rows:MA_REFERENCE_DATA.Strands},
    Scholarship_Categories:{headers:['ScholarshipCategoryID','CategoryCode','CategoryName','Description','IsActive'],rows:MA_REFERENCE_DATA.Scholarship_Categories}
  };
  Object.keys(definitions).forEach(name => {
    const sh=ss.getSheetByName(name), def=definitions[name];
    const existing=sh.getLastRow()>1 ? sh.getRange(2,1,sh.getLastRow()-1,def.headers.length).getDisplayValues() : [];
    const ids=new Set(existing.map(r=>r[0]));
    const missing=def.rows.filter(r=>!ids.has(r[0]));
    if (missing.length) {
      const start=sh.getLastRow()+1, rg=sh.getRange(start,1,missing.length,def.headers.length);
      rg.setNumberFormat('@'); rg.setValues(missing);
    }
  });
}

function getFoundationStatus() {
  const ss=getDatabase_();
  return {application:MA_CONFIG.applicationName,version:MA_CONFIG.version,schemaVersion:PropertiesService.getScriptProperties().getProperty('MA_SCHEMA_VERSION')||'not initialized',spreadsheet:ss.getName(),tabs:Object.keys(MA_SCHEMA).map(name=>({name:name,exists:!!ss.getSheetByName(name)}))};
}


/** Initialize the separate College workbook only after its development ID is configured. */
function initializeCollegeFoundation() {
  assertEditorOwner_();
  return withScriptLock_(() => {
    const ss = getCollegeDatabase_(), created = [], existing = [];
    Object.keys(MA_COLLEGE_SCHEMA).forEach(name => {
      let sh = ss.getSheetByName(name);
      if (!sh) { sh = ss.insertSheet(name); created.push(name); }
      else existing.push(name);
      const expected = MA_COLLEGE_SCHEMA[name];
      if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) sh.getRange(1,1,1,expected.length).setValues([expected]);
      else assertTableHeaders_(sh,expected);
      sh.getRange(1,1,1,expected.length).setFontWeight('bold').setWrap(true);
      sh.setFrozenRows(1);
      sh.setTabColor('#FF9D50');
    });
    PropertiesService.getScriptProperties().setProperty('MA_COLLEGE_SCHEMA_VERSION',MA_SCHEMA_VERSION);
    return {success:true,version:MA_SCHEMA_VERSION,spreadsheetId:ss.getId(),spreadsheetName:ss.getName(),createdTabs:created,existingTabs:existing,tabCount:Object.keys(MA_COLLEGE_SCHEMA).length};
  });
}
