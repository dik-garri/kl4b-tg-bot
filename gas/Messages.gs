/**
 * Save a message to the messages sheet
 */
function saveMessage_(userId, username, firstName, messageId) {
  const sheet = getMessagesSheet_();
  const now = new Date();

  sheet.appendRow([
    now,
    userId,
    username || "",
    firstName || "",
    messageId,
  ]);
}

/**
 * Get "activity day" for a timestamp.
 * Day boundary is 4:00 AM GMT+6 (Bishkek time).
 * Message at 3:00 AM counts as previous day.
 */
function getActivityDay_(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  // Convert to GMT+6 (Bishkek), then subtract 4 hours
  // This makes 4:00 AM the day boundary
  const GMT6_OFFSET_MS = 6 * 60 * 60 * 1000;
  const DAY_START_OFFSET_MS = 4 * 60 * 60 * 1000;

  const localTime = new Date(date.getTime() + GMT6_OFFSET_MS);
  const adjustedTime = new Date(localTime.getTime() - DAY_START_OFFSET_MS);

  return Utilities.formatDate(adjustedTime, "UTC", "yyyy-MM-dd");
}

/**
 * Get active days count for a user within date range
 * Returns number of unique days with messages
 * Uses 4:00 AM GMT+6 as day boundary
 */
function getActiveDaysForUser_(userId, startDate, endDate) {
  const sheet = getMessagesSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;

  const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues(); // ts, user_id
  const uniqueDays = new Set();

  for (const row of data) {
    const ts = row[0];
    const msgUserId = row[1];

    if (String(msgUserId) !== String(userId)) continue;

    let msgDate;
    if (ts instanceof Date) {
      msgDate = ts;
    } else {
      msgDate = new Date(ts);
    }

    if (isNaN(msgDate.getTime())) continue;
    if (msgDate < startDate || msgDate > endDate) continue;

    // Use activity day (4:00 AM boundary)
    const dayStr = getActivityDay_(msgDate);
    uniqueDays.add(dayStr);
  }

  return uniqueDays.size;
}

/**
 * Get week boundaries for the last complete week (Monday 00:00 UTC to Sunday 23:59:59 UTC)
 * "Last complete" = most recent Sunday (including today if Sunday) and its Monday
 * - Run on Sunday: reports on the week ending today (Mon–Sun)
 * - Run on any other day: reports on the previous week ending last Sunday
 */
function getWeekBoundaries_(referenceDate) {
  const d = referenceDate ? new Date(referenceDate) : new Date();

  // Find the most recent Sunday (including today if it's Sunday)
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysBack = day === 0 ? 0 : day;

  const sunday = new Date(d);
  sunday.setUTCDate(d.getUTCDate() - daysBack);
  sunday.setUTCHours(23, 59, 59, 999);

  const monday = new Date(sunday);
  monday.setUTCDate(sunday.getUTCDate() - 6);
  monday.setUTCHours(0, 0, 0, 0);

  return { start: monday, end: sunday };
}

/**
 * Get week label in format "2026-W05" for the last complete week
 * Uses the same logic as getWeekBoundaries_ to stay consistent
 */
function getWeekLabel_(date) {
  const bounds = getWeekBoundaries_(date);
  const d = bounds.start; // Monday of the target week
  const year = d.getUTCFullYear();

  // ISO week number calculation
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const days = Math.floor((d - jan1) / 86400000);
  const weekNum = Math.ceil((days + jan1.getUTCDay() + 1) / 7);

  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}
