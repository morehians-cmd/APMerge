/*****************************************************************************
 MOREH ACADEMY PORTAL - HOUSEKEEPING (new file "Housekeeping")
 Keeps Script Properties small. Requires Security, Protection, Speed, ReEnroll.
*****************************************************************************/

/** OWNER ONLY. Run ONCE after deploying the edits: copies old sc_ status times into the Students sheet, then deletes the sc_ keys. */
function migrateStatusDates() {
  ownerOnly_();
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const pr = PropertiesService.getScriptProperties(), all = pr.getProperties(), sh = sh_('S'), n = sh.getLastRow() - 1;
    const col = COLS.indexOf('StatusChangedAt') + 1;
    if (!col) throw new Error('Add the StatusChangedAt field to Code.gs first.');
    let moved = 0;
    if (n >= 1) {
      const ids = sh.getRange(2, 1, n, 1).getValues().flat().map(String);
      const cur = sh.getRange(2, col, n, 1).getValues().map(r => String(r[0]));
      const out = ids.map((id, i) => { const v = all['sc_' + id]; if (v && !cur[i]) { moved++; return [v]; } return [cur[i]]; });
      if (moved) put_(sh, 2, col, out);
    }
    const kept = {}; let dropped = 0;
    Object.keys(all).forEach(k => { if (/^sc_/.test(k)) dropped++; else kept[k] = all[k]; });
    if (dropped) pr.setProperties(kept, true);
    Logger.log('Copied ' + moved + ' status time(s) into the sheet. Removed ' + dropped + ' sc_ key(s).');
  } finally { try { lock.releaseLock(); } catch (_) {} }
}

/** Removes sign-in stamps of non-staff users and password-reset counters from earlier school years. Returns how many keys were removed.
    Uses ONE setProperties call (fast), under the script lock. Safe to run any time. */
function purgeProps_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return 0;
  try {
    const staff = {}; rows_('U').forEach(u => { if (u.Role === 'admin') staff[u.Username] = 1; });
    if (!Object.keys(staff).length) return 0;                       // never purge if the Users sheet could not be read
    const pr = PropertiesService.getScriptProperties(), all = pr.getProperties(), rsKeep = 'rs_' + activeSY_() + '_', kept = {};
    let n = 0;
    Object.keys(all).forEach(k => {
      const m = k.match(/^(?:pl|ll)_(.+)$/);
      if ((m && !staff[m[1]]) || (/^rs_/.test(k) && k.indexOf(rsKeep) !== 0)) { n++; return; }
      kept[k] = all[k];
    });
    if (n) pr.setProperties(kept, true);
    return n;
  } finally { try { lock.releaseLock(); } catch (_) {} }
}
/** OWNER ONLY. Manual run + report. */
function purgeStudentProps() { ownerOnly_(); Logger.log('Removed ' + purgeProps_() + ' key(s).'); propsUsage(); }