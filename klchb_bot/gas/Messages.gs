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
 * Get active days count for a user within date range
 * Returns number of unique days with messages
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

    const dayStr = toDateStr_(msgDate);
    uniqueDays.add(dayStr);
  }

  return uniqueDays.size;
}

/**
 * Get week boundaries (Monday 00:00 UTC to Sunday 23:59:59 UTC)
 * For current week if no date specified
 */
function getWeekBoundaries_(referenceDate) {
  const d = referenceDate ? new Date(referenceDate) : new Date();

  // Get Monday of this week
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1, Sunday = 0

  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

/**
 * Get week label in format "2026-W05"
 */
function getWeekLabel_(date) {
  const d = date ? new Date(date) : new Date();
  const year = d.getUTCFullYear();

  // ISO week number calculation
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const days = Math.floor((d - jan1) / 86400000);
  const weekNum = Math.ceil((days + jan1.getUTCDay() + 1) / 7);

  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}
