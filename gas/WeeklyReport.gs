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
    let newTrophies = member.trophies;
    let weeklyStatus = "ok";

    if (isFrozen) {
      weeklyStatus = "frozen";
      // No changes to strikes/good_weeks/trophies
    } else if (activeDays >= 6) {
      // Perfect week - trophy!
      newGoodWeeks += 1;
      newTrophies += 1;
      weeklyStatus = "trophy";

      // Remove strike after 2 consecutive good weeks
      if (newGoodWeeks >= 2 && newStrikes > 0) {
        newStrikes -= 1;
        newGoodWeeks = 0;
      }
    } else if (activeDays >= 3) {
      // Good week (3-5 days) but no trophy streak
      newGoodWeeks += 1;
      newTrophies = 0; // Reset trophies - didn't maintain 6/6
      weeklyStatus = "ok";

      // Remove strike after 2 consecutive good weeks
      if (newGoodWeeks >= 2 && newStrikes > 0) {
        newStrikes -= 1;
        newGoodWeeks = 0;
      }
    } else {
      // Bad week - add strike, reset trophies
      newStrikes += 1;
      newGoodWeeks = 0;
      newTrophies = 0; // Reset trophies
      weeklyStatus = "strike";

      if (newStrikes >= 3) {
        newStatus = "expelled";
        weeklyStatus = "expelled";
        newStrikes = 3; // Cap at 3
      }
    }

    // Update member in sheet
    updateMemberState_(member.user_id, newStatus, newStrikes, newGoodWeeks, newTrophies);

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
      trophies: newTrophies,
      status: newStatus,
      weekly_status: weeklyStatus,
    });
  }

  logInfo_("weeklyReport", "Processing complete", null, null, {
    week: weekLabel,
    processed: results.length,
    expelled: results.filter(r => r.weekly_status === "expelled").length,
    trophies: results.filter(r => r.weekly_status === "trophy").length,
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

/**
 * Write report data to report_template sheet
 */
function writeReportToSheet_(reportData) {
  const sheet = getReportSheet_();

  // Clear previous data (keep header)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 4).clearContent();
  }

  // Write new data
  const rows = reportData.map(r => [
    r.first_name,
    r.active_days,
    r.strikes,
    r.trophies > 0 ? "🏆".repeat(r.trophies) : "",
  ]);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 4).setValues(rows);
  }

  // Apply formatting
  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    if (reportData[i].strikes >= 3) {
      // Expelled - red background
      sheet.getRange(rowNum, 1, 1, 4).setBackground("#ffcccc");
    } else if (reportData[i].trophies > 0) {
      // Has trophies - gold background
      sheet.getRange(rowNum, 1, 1, 4).setBackground("#fff9c4");
    } else {
      sheet.getRange(rowNum, 1, 1, 4).setBackground(null);
    }
  }

  return rows.length;
}

/**
 * Export report sheet as PNG
 */
function exportReportAsPng_(rowCount) {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("SHEET_ID");
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName(REPORT_SHEET);
  const gid = sheet.getSheetId();

  // Calculate range to export (header + data, 4 columns)
  const range = `A1:D${rowCount + 1}`;

  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?` +
    `format=png&gid=${gid}&range=${range}`;

  const response = UrlFetchApp.fetch(exportUrl, {
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    throw new Error("Failed to export PNG: " + response.getContentText());
  }

  return response.getBlob().setName("weekly_report.png");
}

/**
 * Send weekly report to Telegram
 */
function sendWeeklyReport_() {
  const weekLabel = getWeekLabel_();

  // Process activity
  const results = processWeeklyActivity_();

  if (results.length === 0) {
    logWarn_("weeklyReport", "No members to report", null, null, null);
    return;
  }

  // Build and write report
  const reportData = buildReportData_(results);
  const rowCount = writeReportToSheet_(reportData);

  // Export as PNG
  const pngBlob = exportReportAsPng_(rowCount);

  // Send to Telegram
  const chatId = getGroupChatId_();
  const threadId = getReportThreadId_();

  const activeCount = reportData.filter(r => r.status === "active").length;
  const trophyCount = results.filter(r => r.weekly_status === "trophy").length;

  let caption = `📊 Отчёт за неделю ${weekLabel}\n\nАктивных: ${activeCount}`;
  if (trophyCount > 0) {
    caption += `\n🏆 Трофеев на этой неделе: ${trophyCount}`;
  }

  sendPhoto_(chatId, pngBlob, caption, threadId);

  logInfo_("weeklyReport", "Report sent", null, null, {
    week: weekLabel,
    totalMembers: reportData.length,
    trophies: trophyCount,
  });
}

/**
 * Entry point for weekly trigger
 */
function runWeeklyReport() {
  try {
    sendWeeklyReport_();
  } catch (err) {
    logError_("runWeeklyReport", err.message, null, null, { stack: err.stack });
    throw err; // Re-throw so trigger shows as failed
  }
}
