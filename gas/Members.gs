/**
 * Find member row by user_id
 * Returns {row: number, data: object} or null
 */
function findMemberByUserId_(userId) {
  const sheet = getMembersSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;

  const data = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(userId)) {
      return {
        row: i + 2,
        data: {
          user_id: data[i][0],
          username: data[i][1],
          first_name: data[i][2],
          status: data[i][3] || "active",
          strikes: Number(data[i][4]) || 0,
          good_weeks: Number(data[i][5]) || 0,
          trophies: Number(data[i][6]) || 0,
          max_trophies: Number(data[i][7]) || 0,
          frozen_until: data[i][8],
          first_seen: data[i][9],
          last_seen: data[i][10],
        }
      };
    }
  }
  return null;
}

/**
 * Create new member
 */
function createMember_(userId, username, firstName) {
  const sheet = getMembersSheet_();
  const now = new Date();
  const dateStr = toDateStr_(now);

  sheet.appendRow([
    userId,
    username || "",
    firstName || "",
    "active",
    0,  // strikes
    0,  // good_weeks
    0,  // trophies
    0,  // max_trophies
    "", // frozen_until
    dateStr, // first_seen
    dateStr, // last_seen
  ]);

  logInfo_("createMember", `New member: ${firstName}`, userId, username, null);
}

/**
 * Update member's last_seen timestamp
 */
function updateMemberLastSeen_(userId) {
  const member = findMemberByUserId_(userId);
  if (!member) return;

  const sheet = getMembersSheet_();
  const dateStr = toDateStr_(new Date());
  sheet.getRange(member.row, 11).setValue(dateStr); // last_seen is column 11
}

/**
 * Update member state after weekly processing
 */
function updateMemberState_(userId, status, strikes, goodWeeks, trophies) {
  const member = findMemberByUserId_(userId);
  if (!member) return;

  const sheet = getMembersSheet_();

  // Update max_trophies if current trophies is higher
  const maxTrophies = Math.max(trophies, member.data.max_trophies);

  // status = col 4, strikes = col 5, good_weeks = col 6, trophies = col 7, max_trophies = col 8
  sheet.getRange(member.row, 4, 1, 5).setValues([[status, strikes, goodWeeks, trophies, maxTrophies]]);
}

/**
 * Get all active members
 * Returns array of member objects
 */
function getActiveMembers_() {
  const sheet = getMembersSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  const members = [];

  for (const row of data) {
    if (row[3] === "active") {
      members.push({
        user_id: row[0],
        username: row[1],
        first_name: row[2],
        status: row[3],
        strikes: Number(row[4]) || 0,
        good_weeks: Number(row[5]) || 0,
        trophies: Number(row[6]) || 0,
        max_trophies: Number(row[7]) || 0,
        frozen_until: row[8],
        first_seen: row[9],
        last_seen: row[10],
      });
    }
  }

  return members;
}

/**
 * Check if member is frozen for given date
 */
function isMemberFrozen_(member, checkDate) {
  if (!member.frozen_until) return false;

  let frozenDate;
  if (member.frozen_until instanceof Date) {
    frozenDate = member.frozen_until;
  } else {
    frozenDate = new Date(member.frozen_until);
  }

  if (isNaN(frozenDate.getTime())) return false;
  return frozenDate >= checkDate;
}
