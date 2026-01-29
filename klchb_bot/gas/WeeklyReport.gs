/**
 * Process weekly activity and update member states
 * Returns array of results for report
 */
function processWeeklyActivity_() {
  const weekBounds = getWeekBoundaries_();
  const weekLabel = getWeekLabel_();
  const members = getActiveMembers_();
  const results = [];
  const historySheet = getHistorySheet_();

  logInfo_("weeklyReport", "Processing started", null, null, {
    week: weekLabel,
    memberCount: members.length,
    start: weekBounds.start.toISOString(),
    end: weekBounds.end.toISOString(),
  });

  for (const member of members) {
    const activeDays = getActiveDaysForUser_(
      member.user_id,
      weekBounds.start,
      weekBounds.end
    );

    const isFrozen = isMemberFrozen_(member, weekBounds.end);

    let newStatus = member.status;
    let newStrikes = member.strikes;
    let newGoodWeeks = member.good_weeks;
    let weeklyStatus = "ok";

    if (isFrozen) {
      weeklyStatus = "frozen";
      // No changes to strikes/good_weeks
    } else if (activeDays >= 3) {
      // Good week
      newGoodWeeks += 1;
      weeklyStatus = "ok";

      // Remove strike after 2 consecutive good weeks
      if (newGoodWeeks >= 2 && newStrikes > 0) {
        newStrikes -= 1;
        newGoodWeeks = 0;
      }
    } else {
      // Bad week - add strike
      newStrikes += 1;
      newGoodWeeks = 0;
      weeklyStatus = "strike";

      if (newStrikes >= 3) {
        newStatus = "expelled";
        weeklyStatus = "expelled";
        newStrikes = 3; // Cap at 3
      }
    }

    // Update member in sheet
    updateMemberState_(member.user_id, newStatus, newStrikes, newGoodWeeks);

    // Add to history
    historySheet.appendRow([
      weekLabel,
      member.user_id,
      activeDays,
      weeklyStatus,
      newStrikes,
      newStatus,
    ]);

    // Collect for report
    results.push({
      user_id: member.user_id,
      first_name: member.first_name,
      active_days: activeDays,
      strikes: newStrikes,
      status: newStatus,
      weekly_status: weeklyStatus,
    });
  }

  logInfo_("weeklyReport", "Processing complete", null, null, {
    week: weekLabel,
    processed: results.length,
    expelled: results.filter(r => r.weekly_status === "expelled").length,
  });

  return results;
}

/**
 * Build report data: active members + newly expelled (sorted)
 */
function buildReportData_(results) {
  // Active members sorted by name
  const active = results
    .filter(r => r.status === "active")
    .sort((a, b) => a.first_name.localeCompare(b.first_name, "ru"));

  // Newly expelled this week
  const expelled = results
    .filter(r => r.weekly_status === "expelled")
    .sort((a, b) => a.first_name.localeCompare(b.first_name, "ru"));

  return [...active, ...expelled];
}
