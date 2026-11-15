/** Header-keyed Sheets access helpers. All writes are plain text and lock-protected. */
function getSheet_(name) {
  const sh = getDatabase_().getSheetByName(name);
  if (!sh) throw new Error('Missing database tab: ' + name);
  return sh;
}

function getTableObjects_(name) {
  const sh = getSheet_(name), last = sh.getLastRow(), width = sh.getLastColumn();
  if (last < 2 || width < 1) return [];
  const headers = sh.getRange(1,1,1,width).getDisplayValues()[0];
  return sh.getRange(2,1,last-1,width).getValues().map((row, i) => {
    const obj = {_rowNumber:i+2};
    headers.forEach((key, col) => { if (key) obj[key] = row[col]; });
    return obj;
  }).filter(row => headers.some(key => key && row[key] !== '' && row[key] !== null));
}

function appendTableRecord_(name, record) {
  return withScriptLock_(() => {
    const sh = getSheet_(name);
    const headers = sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
    const row = headers.map(key => safeCellValue_(record[key]));
    const target = sh.getLastRow()+1;
    const range = sh.getRange(target,1,1,headers.length);
    range.setNumberFormat('@');
    range.setValues([row]);
    return target;
  });
}

function safeCellValue_(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  const text = String(value);
  return /^[=+@\-\t\r]/.test(text) ? "'" + text : text;
}

function assertTableHeaders_(sheet, expected) {
  const actual = sheet.getLastColumn()
    ? sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0]
    : [];
  if (!actual.length || actual.every(v => !v)) return;
  const matches = actual.length === expected.length && expected.every((h,i) => actual[i] === h);
  if (!matches) {
    throw new Error('Schema mismatch in tab "' + sheet.getName() + '". No columns were changed. Expected: ' + expected.join(' | '));
  }
}
