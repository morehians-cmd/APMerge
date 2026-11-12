/*****************************************************************************
 MOREH ACADEMY PORTAL - CERTIFICATE OF REGISTRATION (new file "Cor")
 For Enrolled TLC scholars. Fee values are FIXED text kept in the "COR Settings" sheet:
 the portal prints them as typed and never calculates or assesses fees.
*****************************************************************************/
const COR_COLS = ['Key', 'Value', 'Note'];
function corSeed_() {
  return [['RegistrarName', 'ABIGAIL C. DE LEON', 'Printed under the signature line'], ['RegistrarTitle', 'School Registrar', ''],
    ['TLC_Tuition', 26750, 'Assessment of Fees: fixed amount for TLC scholars'], ['TLC_Misc', 9750, 'Assessment of Fees'],
    ['TLC_Gross', 36500, 'Gross School Fee. Should equal tuition + miscellaneous (the portal only warns, it does not calculate)'],
    ['TLC_SpecialDiscount', 26750, 'Scholarship Details: tuition discount'], ['TLC_MiscDiscount', 9750, 'Scholarship Details: miscellaneous fee discount'],
    ['TLC_UponEnrollment', 0, 'Summary of Assessment'], ['TLC_Balance', 0, 'Total Account Balance']];
}
const corMoney_ = v => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? String(v) : n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

/** Admin / Encoder. Everything the COR needs besides the learner record: ID photo and the fixed values. */
function corData(token, studentId) {
  try {
    const u = who_(token, 'admin'), hit = findStudent_(String(studentId || '')); if (!hit) throw new Error('Learner not found.');
    const s = hit.o;
    if (!ID_CATS.includes(s.Category) || s.EnrollStatus !== 'Enrolled') throw new Error('A Certificate of Registration is issued only to Enrolled TLC scholars.');
    if (!s.IDNumber) throw new Error('Enter the Student ID number first: Print / PDF > Student ID card.');
    const sh = feeSheet_('COR Settings', COR_COLS, corSeed_), n = sh.getLastRow() - 1, m = {};
    if (n > 0) sh.getRange(2, 1, n, 2).getValues().forEach(r => { const k = String(r[0]).trim(); if (k) m[k] = r[1]; });
    const num = k => parseFloat(String(m[k]).replace(/[^0-9.\-]/g, '')), a = num('TLC_Tuition'), b = num('TLC_Misc'), g = num('TLC_Gross'), mo = k => corMoney_(m[k] == null ? '' : m[k]);
    audit_(u, 'cor.open', s.StudentID, '');
    return ok({ photo:photo_(s.IDPhotoID),
      s:{ RegistrarName:String(m.RegistrarName || ''), RegistrarTitle:String(m.RegistrarTitle || 'School Registrar'), Tuition:mo('TLC_Tuition'), Misc:mo('TLC_Misc'), Gross:mo('TLC_Gross'),
        Special:mo('TLC_SpecialDiscount'), MiscDisc:mo('TLC_MiscDiscount'), Upon:mo('TLC_UponEnrollment'), Balance:mo('TLC_Balance'),
        warn:(isNaN(a + b + g) || Math.abs(a + b - g) > 0.005) ? 'Gross School Fee does not equal Tuition + Miscellaneous in the COR Settings sheet. Check the figures with Accounting before printing.' : '',
        url:u.Clearance === 'Full' ? SpreadsheetApp.getActiveSpreadsheet().getUrl() + '#gid=' + sh.getSheetId() : '' } });
  } catch (e) { return fail(e); }
}