/** Contact.gs - "Send us a message" form on the Help Center. Add as a NEW file in Apps Script (Files > + > Script),
 *  paste this whole file, then Deploy > Manage deployments > Edit > New version.
 *  Uses only functions that already exist in your project: who_, audit_, findRow_, ok, fail.
 *  First run in the Apps Script editor will ask you to approve sending email (you already do this for reset codes). */
const CF_TO_ = 'morehians@gmail.com';
const CF_TOPICS_ = ['Enrollment / admission','Requirements','Payments and fees','Scholarship','Account or password','Other'];

function sendContactMessage(token, topic, message, replyTo) {
  try {
    const u = who_(token);
    if (u.Role !== 'student') throw new Error('This form is for students. Staff can use the Admissions mailbox directly.');
    if (CF_TOPICS_.indexOf(topic) < 0) throw new Error('Choose a topic.');
    message = String(message || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
    if (message.length < 10) throw new Error('Please write at least a short sentence (10 characters).');
    if (message.length > 1000) throw new Error('Please keep your message under 1,000 characters.');
    replyTo = String(replyTo || '').trim();
    if (replyTo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(replyTo)) throw new Error('Enter a valid reply email address, or leave it blank.');

    const cache = CacheService.getScriptCache(), key = 'cf_' + String(u.Username || u.StudentID).toLowerCase(), n = parseInt(cache.get(key) || '0', 10);
    if (n >= 3) throw new Error('You have already sent several messages this hour. Please wait a while, or call the office at 0961 876 6886.');
    if (MailApp.getRemainingDailyQuota() < 20) throw new Error('The message service is busy today. Please call the office at 0961 876 6886.');

    let s = {};
    try { const h = u.StudentID ? findRow_('S', 'StudentID', u.StudentID) : null; if (h && h.o) s = h.o; } catch (_) {}
    const reply = replyTo || s.Email || u.Email || '';
    if (!reply) throw new Error('Enter an email address where we can reply.');
    const clean = x => String(x || '').replace(/[\r\n]+/g, ' ').trim();
    const name = clean(s.FullName || u.FullName || u.Username);

    const body = [
      'A student sent a message from the Moreh Academy portal.', '',
      'Topic: ' + topic,
      'Student: ' + name,
      'Enrollment ID: ' + clean(s.StudentID || u.StudentID),
      'Grade and section: ' + clean([s.GradeLevel, s.Section].filter(Boolean).join(' ')),
      'Enrollment status: ' + clean(s.EnrollStatus || 'Not Enrolled'),
      'Reply to: ' + reply, '',
      'Message:', message, '',
      '(Press Reply to answer the student directly.)'
    ].join('\n');

    MailApp.sendEmail({ to: CF_TO_, name: 'Moreh Academy Portal', replyTo: reply, subject: '[Portal message] ' + topic + ' - ' + name, body: body });
    cache.put(key, String(n + 1), 3600);
    try { audit_(u, 'contact.send', u.StudentID || u.Username, topic); } catch (_) {}
    return ok(null, 'Message sent. The Admissions Office will reply by email.');
  } catch (e) { return fail(e); }
}