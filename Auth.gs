/**
 * Website manager sign-in.
 * One administrator password, stored as a salted SHA-256 hash in Script
 * Properties. Sessions live in the script cache for APP.sessionHours.
 */

function hash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value))
    .map(b => ((b & 0xff) + 0x100).toString(16).slice(1))
    .join('');
}

function signIn_(password) {
  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperty('ADMIN_HASH');
  const salt = props.getProperty('ADMIN_SALT') || '';
  if (!stored) {
    return { ok: false, error: 'No administrator is set up yet. Run setup() in the Apps Script editor.' };
  }

  const cache = CacheService.getScriptCache();
  const tries = Number(cache.get('apmerge_attempts') || 0);
  if (tries >= 8) return { ok: false, error: 'Too many attempts. Try again in 15 minutes.' };

  if (hash_(String(password || '') + salt) !== stored) {
    cache.put('apmerge_attempts', String(tries + 1), 900);
    return { ok: false, error: 'That password is not correct.' };
  }

  cache.remove('apmerge_attempts');
  const token = Utilities.getUuid();
  cache.put('apmerge_session_' + token, 'admin', APP.sessionHours * 3600);
  log_('sign in', '');
  return { ok: true, token: token };
}

function signOut_(token) {
  if (token) CacheService.getScriptCache().remove('apmerge_session_' + token);
  return { ok: true };
}

function sessionOk_(token) {
  const t = String(token || '');
  if (!t) return false;
  const cache = CacheService.getScriptCache();
  if (!cache.get('apmerge_session_' + t)) return false;
  cache.put('apmerge_session_' + t, 'admin', APP.sessionHours * 3600);
  return true;
}

/** Throws when the caller is not signed in; every save path calls this. */
function require_(token) {
  if (!sessionOk_(token)) throw new Error('Your session expired. Please sign in again.');
  return 'admin';
}
