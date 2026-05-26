const Event = require('../models/Event');

/**
 * expireEvents — deletes server events whose date has passed.
 *
 * The client stores the scheduled time in `event_date` (legacy schema also has
 * `starts_at`/`ends_at`). An event is considered expired once the END of its
 * day has passed (so an all-day event isn't removed mid-day). We check every
 * supported field and delete anything older than the start of today.
 *
 * Idempotent and safe to run repeatedly. Errors are logged, never thrown, so a
 * cleanup failure can't crash the server.
 */
async function expireEvents() {
  try {
    // Start of today — anything strictly before this is from a previous day.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    // event_date may be stored as a Date OR as an ISO-ish string (the client
    // sends a datetime-local value). $lt works for both Date<Date and
    // string<string (ISO strings sort chronologically), so we compare against
    // both a Date and its ISO string to cover either storage form.
    const isoCutoff = startOfToday.toISOString();

    const result = await Event.deleteMany({
      $or: [
        { event_date: { $lt: startOfToday } },
        { event_date: { $lt: isoCutoff } },
        { ends_at:    { $lt: startOfToday } },
        { ends_at: { $exists: false }, starts_at: { $lt: startOfToday } },
      ],
    });

    if (result?.deletedCount) {
      console.log(`✓ Expired ${result.deletedCount} past server event(s)`);
    }
    return result?.deletedCount || 0;
  } catch (err) {
    console.warn('Event expiry cleanup failed:', err?.message);
    return 0;
  }
}

/**
 * Schedule the cleanup: run once on boot, then every 6 hours. Returns the
 * interval handle so callers could clear it if needed.
 */
function scheduleEventExpiry() {
  expireEvents();
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  return setInterval(expireEvents, SIX_HOURS);
}

module.exports = { expireEvents, scheduleEventExpiry };
