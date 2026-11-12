/**
 * Read-only dashboard activity feed.
 * Full administrators and System Managers only.
 * Deliberately excludes Audit.Target and Audit.Details because those fields
 * may contain learner identifiers or other sensitive information.
 *
 * @param {string} token Authenticated session token.
 * @param {number} limit Maximum number of recent entries (1-30; default 12).
 */
function getRecentActivity(token, limit) {
  try {
    const u = who_(token, 'admin');
    if (['Full', 'Manager'].indexOf(u.Clearance) < 0) throw new Error('Not allowed.');

    const sh = auditSh_(), last = sh.getLastRow();
    if (last < 2) return ok({ items: [] });

    const take = Math.max(1, Math.min(30, parseInt(limit, 10) || 12));
    const count = Math.min(take, last - 1);
    const rows = sh.getRange(last - count + 1, 1, count, AUDIT_COLS.length).getDisplayValues();
    const items = rows.reverse().map(r => ({
      date: String(r[0] || ''),
      time: String(r[1] || ''),
      actor: String(r[2] || ''),
      role: String(r[3] || ''),
      action: String(r[4] || '')
    }));

    return ok({ items: items });
  } catch (e) {
    return fail(e);
  }
}
