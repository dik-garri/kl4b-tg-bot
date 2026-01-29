# KLCHB Bot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Telegram bot that automatically tracks book club activity and posts weekly PNG reports.

**Architecture:** Google Apps Script webhook receives Telegram messages, stores in Google Sheets, weekly trigger processes strikes/expulsions and sends PNG report to group.

**Tech Stack:** Google Apps Script, Google Sheets, Telegram Bot API

---

## Task 1: Project Structure & Manifest

**Files:**
- Create: `klchb_bot/gas/appsscript.json`

**Step 1: Create manifest file**

```json
{
  "timeZone": "Asia/Bishkek",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "access": "ANYONE",
    "executeAs": "USER_DEPLOYING"
  }
}
```

**Step 2: Create directory structure**

```bash
mkdir -p klchb_bot/gas
```

**Step 3: Commit**

```bash
git add klchb_bot/
git commit -m "feat: add GAS project structure and manifest"
```

---

## Task 2: Sheet Helpers Module

**Files:**
- Create: `klchb_bot/gas/SheetHelpers.gs`

**Step 1: Write sheet helper functions**

```javascript
/**
 * Sheet name constants
 */
const MESSAGES_SHEET = "messages";
const MEMBERS_SHEET = "members";
const HISTORY_SHEET = "history";
const REPORT_SHEET = "report_template";
const LOGS_SHEET = "logs";

/**
 * Get spreadsheet instance from Script Properties
 */
function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("SHEET_ID");
  if (!sheetId) throw new Error("Missing Script Property SHEET_ID");
  return SpreadsheetApp.openById(sheetId);
}

/**
 * Get or create a sheet by name
 */
function getOrCreateSheet_(name) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

/**
 * Ensure header row matches expected columns
 */
function ensureHeader_(sheet, columns) {
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.appendRow(columns);
    sheet.setFrozenRows(1);
    return;
  }
  const width = columns.length;
  const header = sheet.getRange(1, 1, 1, width).getValues()[0];
  const same = columns.every((v, i) => String(header[i] || "").trim() === v);
  if (!same) {
    sheet.getRange(1, 1, 1, width).setValues([columns]);
    sheet.setFrozenRows(1);
  }
}

/**
 * Format date to ISO string in UTC
 */
function toIsoUtc_(date) {
  return Utilities.formatDate(date, "UTC", "yyyy-MM-dd'T'HH:mm:ss'Z'");
}

/**
 * Format date to YYYY-MM-DD
 */
function toDateStr_(date) {
  return Utilities.formatDate(date, "UTC", "yyyy-MM-dd");
}

/**
 * Get sheet for messages
 */
function getMessagesSheet_() {
  const sheet = getOrCreateSheet_(MESSAGES_SHEET);
  ensureHeader_(sheet, ["ts", "user_id", "username", "first_name", "message_id"]);
  return sheet;
}

/**
 * Get sheet for members
 */
function getMembersSheet_() {
  const sheet = getOrCreateSheet_(MEMBERS_SHEET);
  ensureHeader_(sheet, [
    "user_id", "username", "first_name", "status",
    "strikes", "good_weeks", "frozen_until", "first_seen", "last_seen"
  ]);
  return sheet;
}

/**
 * Get sheet for history
 */
function getHistorySheet_() {
  const sheet = getOrCreateSheet_(HISTORY_SHEET);
  ensureHeader_(sheet, [
    "week", "user_id", "active_days", "weekly_status",
    "strikes_after", "status_after"
  ]);
  return sheet;
}

/**
 * Get sheet for report template
 */
function getReportSheet_() {
  const sheet = getOrCreateSheet_(REPORT_SHEET);
  ensureHeader_(sheet, ["Имя", "Дней", "Страйки"]);
  return sheet;
}

/**
 * Get sheet for logs
 */
function getLogsSheet_() {
  const sheet = getOrCreateSheet_(LOGS_SHEET);
  ensureHeader_(sheet, [
    "ts", "level", "action", "message", "user_id", "username", "meta_json"
  ]);
  return sheet;
}
```

**Step 2: Verify by running in GAS**

Run `getMessagesSheet_()` in GAS editor - should create sheet with headers.

**Step 3: Commit**

```bash
git add klchb_bot/gas/SheetHelpers.gs
git commit -m "feat: add Google Sheets helper functions"
```

---

## Task 3: Logging Module

**Files:**
- Create: `klchb_bot/gas/Logging.gs`

**Step 1: Write logging functions**

```javascript
/**
 * Log an event to the logs sheet
 * Never throws - logging failures should not break requests
 */
function logEvent_(level, action, message, userId, username, meta) {
  try {
    const sheet = getLogsSheet_();
    const metaStr = meta ? JSON.stringify(meta) : "";
    const metaTrimmed = metaStr.length > 20000
      ? metaStr.slice(0, 20000) + "…(truncated)"
      : metaStr;

    sheet.appendRow([
      new Date(),
      String(level || ""),
      String(action || ""),
      String(message || ""),
      userId || "",
      username || "",
      metaTrimmed,
    ]);
  } catch (e) {
    // Never fail due to logging
    Logger.log("Logging failed: " + e.message);
  }
}

/**
 * Convenience wrappers
 */
function logInfo_(action, message, userId, username, meta) {
  logEvent_("info", action, message, userId, username, meta);
}

function logWarn_(action, message, userId, username, meta) {
  logEvent_("warn", action, message, userId, username, meta);
}

function logError_(action, message, userId, username, meta) {
  logEvent_("error", action, message, userId, username, meta);
}
```

**Step 2: Verify by running in GAS**

Run `logInfo_("test", "Hello", 123, "testuser", {foo: "bar"})` - check logs sheet.

**Step 3: Commit**

```bash
git add klchb_bot/gas/Logging.gs
git commit -m "feat: add logging module"
```

---

## Task 4: Telegram API Module

**Files:**
- Create: `klchb_bot/gas/TelegramApi.gs`

**Step 1: Write Telegram API helpers**

```javascript
/**
 * Get bot token from Script Properties
 */
function getBotToken_() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("BOT_TOKEN");
  if (!token) throw new Error("Missing Script Property BOT_TOKEN");
  return token;
}

/**
 * Get target thread ID (topic "Мысли по прочитанному")
 */
function getTargetThreadId_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("TARGET_THREAD_ID");
  return id ? Number(id) : null;
}

/**
 * Get report thread ID (topic "Объявления")
 */
function getReportThreadId_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("REPORT_THREAD_ID");
  return id ? Number(id) : null;
}

/**
 * Get group chat ID
 */
function getGroupChatId_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("GROUP_CHAT_ID");
  if (!id) throw new Error("Missing Script Property GROUP_CHAT_ID");
  return id;
}

/**
 * Call Telegram Bot API
 */
function callTelegramApi_(method, payload) {
  const token = getBotToken_();
  const url = `https://api.telegram.org/bot${token}/${method}`;

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());

  if (!json.ok) {
    throw new Error(`Telegram API error: ${json.description || "Unknown"}`);
  }

  return json.result;
}

/**
 * Send a text message
 */
function sendMessage_(chatId, text, threadId) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML",
  };
  if (threadId) {
    payload.message_thread_id = threadId;
  }
  return callTelegramApi_("sendMessage", payload);
}

/**
 * Send a photo with caption
 */
function sendPhoto_(chatId, photoBlob, caption, threadId) {
  const token = getBotToken_();
  const url = `https://api.telegram.org/bot${token}/sendPhoto`;

  const formData = {
    chat_id: chatId,
    photo: photoBlob,
    caption: caption || "",
  };
  if (threadId) {
    formData.message_thread_id = threadId;
  }

  const options = {
    method: "post",
    payload: formData,
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());

  if (!json.ok) {
    throw new Error(`Telegram API error: ${json.description || "Unknown"}`);
  }

  return json.result;
}
```

**Step 2: Test by sending a message (after setting Script Properties)**

```javascript
function testSendMessage() {
  sendMessage_(getGroupChatId_(), "Test from GAS bot", getReportThreadId_());
}
```

**Step 3: Commit**

```bash
git add klchb_bot/gas/TelegramApi.gs
git commit -m "feat: add Telegram API module"
```

---

## Task 5: Members Data Access

**Files:**
- Create: `klchb_bot/gas/Members.gs`

**Step 1: Write member CRUD functions**

```javascript
/**
 * Find member row by user_id
 * Returns {row: number, data: object} or null
 */
function findMemberByUserId_(userId) {
  const sheet = getMembersSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;

  const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
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
          frozen_until: data[i][6],
          first_seen: data[i][7],
          last_seen: data[i][8],
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
  sheet.getRange(member.row, 9).setValue(dateStr); // last_seen is column 9
}

/**
 * Update member state after weekly processing
 */
function updateMemberState_(userId, status, strikes, goodWeeks) {
  const member = findMemberByUserId_(userId);
  if (!member) return;

  const sheet = getMembersSheet_();
  // status = col 4, strikes = col 5, good_weeks = col 6
  sheet.getRange(member.row, 4, 1, 3).setValues([[status, strikes, goodWeeks]]);
}

/**
 * Get all active members
 * Returns array of member objects
 */
function getActiveMembers_() {
  const sheet = getMembersSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
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
        frozen_until: row[6],
        first_seen: row[7],
        last_seen: row[8],
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
```

**Step 2: Verify by running in GAS**

```javascript
function testMembers() {
  createMember_(999999, "testuser", "Test User");
  const m = findMemberByUserId_(999999);
  Logger.log(JSON.stringify(m));
}
```

**Step 3: Commit**

```bash
git add klchb_bot/gas/Members.gs
git commit -m "feat: add members data access module"
```

---

## Task 6: Messages Data Access

**Files:**
- Create: `klchb_bot/gas/Messages.gs`

**Step 1: Write message functions**

```javascript
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
```

**Step 2: Verify by running in GAS**

```javascript
function testWeekBoundaries() {
  const bounds = getWeekBoundaries_();
  Logger.log("Start: " + bounds.start.toISOString());
  Logger.log("End: " + bounds.end.toISOString());
  Logger.log("Label: " + getWeekLabel_());
}
```

**Step 3: Commit**

```bash
git add klchb_bot/gas/Messages.gs
git commit -m "feat: add messages data access module"
```

---

## Task 7: Webhook Handler

**Files:**
- Create: `klchb_bot/gas/Webhook.gs`

**Step 1: Write webhook processing**

```javascript
/**
 * Process incoming Telegram update
 */
function processUpdate_(update) {
  const message = update.message;
  if (!message) {
    logInfo_("webhook", "No message in update", null, null, { update_id: update.update_id });
    return;
  }

  // Check if it's from the target thread
  const targetThreadId = getTargetThreadId_();
  const messageThreadId = message.message_thread_id;

  if (targetThreadId && messageThreadId !== targetThreadId) {
    // Not from target topic, ignore silently
    return;
  }

  // Extract user info
  const from = message.from;
  if (!from) {
    logWarn_("webhook", "No from field in message", null, null, null);
    return;
  }

  const userId = from.id;
  const username = from.username || "";
  const firstName = from.first_name || "";
  const messageId = message.message_id;

  logInfo_("webhook", "Message received", userId, username, {
    message_id: messageId,
    thread_id: messageThreadId,
    text_preview: (message.text || "").slice(0, 50),
  });

  // Save message
  saveMessage_(userId, username, firstName, messageId);

  // Update or create member
  const existingMember = findMemberByUserId_(userId);
  if (existingMember) {
    updateMemberLastSeen_(userId);
  } else {
    createMember_(userId, username, firstName);
  }
}
```

**Step 2: Verify logic is correct (code review)**

**Step 3: Commit**

```bash
git add klchb_bot/gas/Webhook.gs
git commit -m "feat: add webhook message processing"
```

---

## Task 8: Main Entry Points (Code.gs)

**Files:**
- Create: `klchb_bot/gas/Code.gs`

**Step 1: Write doPost and setup functions**

```javascript
/**
 * KLCHB Activity Tracker Bot
 *
 * Script Properties:
 * - SHEET_ID: Google Spreadsheet ID
 * - BOT_TOKEN: Telegram bot token
 * - GROUP_CHAT_ID: Telegram group chat ID
 * - TARGET_THREAD_ID: Topic ID for "Мысли по прочитанному"
 * - REPORT_THREAD_ID: Topic ID for "Объявления"
 */

/**
 * Handle incoming webhook from Telegram
 */
function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents
      ? e.postData.contents
      : "";

    if (!body) {
      logWarn_("doPost", "Empty body", null, null, null);
      return ContentService.createTextOutput("OK");
    }

    const update = JSON.parse(body);
    processUpdate_(update);

    return ContentService.createTextOutput("OK");
  } catch (err) {
    logError_("doPost", err.message, null, null, { stack: err.stack });
    // Always return OK to Telegram to prevent retries
    return ContentService.createTextOutput("OK");
  }
}

/**
 * Simple GET endpoint for health check
 */
function doGet() {
  return ContentService.createTextOutput("KLCHB Bot is running");
}

/**
 * One-time setup: initialize all sheets with headers
 */
function setupSheets() {
  getMessagesSheet_();
  getMembersSheet_();
  getHistorySheet_();
  getReportSheet_();
  getLogsSheet_();

  Logger.log("All sheets initialized");
}

/**
 * Test function to verify Script Properties
 */
function testConfig() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const keys = ["SHEET_ID", "BOT_TOKEN", "GROUP_CHAT_ID", "TARGET_THREAD_ID", "REPORT_THREAD_ID"];

  for (const key of keys) {
    const val = props[key];
    Logger.log(`${key}: ${val ? "SET (" + val.slice(0, 10) + "...)" : "MISSING"}`);
  }
}
```

**Step 2: Verify by running `testConfig()` in GAS**

**Step 3: Commit**

```bash
git add klchb_bot/gas/Code.gs
git commit -m "feat: add main entry points (doPost, doGet, setup)"
```

---

## Task 9: Weekly Report Logic

**Files:**
- Create: `klchb_bot/gas/WeeklyReport.gs`

**Step 1: Write weekly processing logic**

```javascript
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
```

**Step 2: Verify logic matches notebook algorithm**

**Step 3: Commit**

```bash
git add klchb_bot/gas/WeeklyReport.gs
git commit -m "feat: add weekly activity processing logic"
```

---

## Task 10: Report PNG Generation

**Files:**
- Modify: `klchb_bot/gas/WeeklyReport.gs` (append to existing)

**Step 1: Add PNG generation functions**

```javascript
/**
 * Write report data to report_template sheet
 */
function writeReportToSheet_(reportData) {
  const sheet = getReportSheet_();

  // Clear previous data (keep header)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 3).clearContent();
  }

  // Write new data
  const rows = reportData.map(r => [
    r.first_name,
    r.active_days,
    r.strikes,
  ]);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  }

  // Apply formatting for expelled (strikes = 3)
  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    if (reportData[i].strikes >= 3) {
      sheet.getRange(rowNum, 1, 1, 3).setBackground("#ffcccc");
    } else {
      sheet.getRange(rowNum, 1, 1, 3).setBackground(null);
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

  // Calculate range to export (header + data)
  const range = `A1:C${rowCount + 1}`;

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
  const caption = `📊 Отчёт за неделю ${weekLabel}\n\nАктивных: ${reportData.filter(r => r.status === "active").length}`;

  sendPhoto_(chatId, pngBlob, caption, threadId);

  logInfo_("weeklyReport", "Report sent", null, null, {
    week: weekLabel,
    totalMembers: reportData.length,
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
```

**Step 2: Test manually**

```javascript
function testWeeklyReport() {
  runWeeklyReport();
}
```

**Step 3: Commit**

```bash
git add klchb_bot/gas/WeeklyReport.gs
git commit -m "feat: add PNG report generation and sending"
```

---

## Task 11: Final Integration & Testing

**Files:**
- All files in `klchb_bot/gas/`

**Step 1: Create combined test function**

Add to Code.gs:

```javascript
/**
 * Integration test: simulate message and check state
 */
function integrationTest() {
  // 1. Setup sheets
  setupSheets();
  Logger.log("✓ Sheets initialized");

  // 2. Simulate a message
  const testUpdate = {
    update_id: 1,
    message: {
      message_id: 1001,
      message_thread_id: getTargetThreadId_(),
      from: {
        id: 888888,
        username: "integration_test",
        first_name: "Integration Test",
      },
      text: "Test message",
    }
  };
  processUpdate_(testUpdate);
  Logger.log("✓ Test message processed");

  // 3. Check member was created
  const member = findMemberByUserId_(888888);
  if (!member) throw new Error("Member not created");
  Logger.log("✓ Member created: " + JSON.stringify(member.data));

  // 4. Check message was saved
  const sheet = getMessagesSheet_();
  const lastRow = sheet.getLastRow();
  Logger.log("✓ Messages sheet has " + (lastRow - 1) + " messages");

  Logger.log("\n=== Integration test passed ===");
}
```

**Step 2: Run integration test in GAS**

**Step 3: Commit**

```bash
git add klchb_bot/gas/Code.gs
git commit -m "feat: add integration test"
```

---

## Task 12: Deployment Instructions

**Files:**
- Create: `klchb_bot/README.md`

**Step 1: Write deployment guide**

```markdown
# KLCHB Bot Deployment

## Prerequisites

1. Telegram bot created via @BotFather
2. Google account with Apps Script access
3. Bot added to group as admin

## Setup Steps

### 1. Create Google Spreadsheet

Create new spreadsheet, note the ID from URL:
`https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`

### 2. Create Apps Script Project

1. Go to https://script.google.com
2. Create new project "KLCHB Bot"
3. Copy all .gs files from this directory
4. Copy appsscript.json content to Project Settings > Manifest

### 3. Set Script Properties

Project Settings > Script Properties:

| Key | Value |
|-----|-------|
| SHEET_ID | Your spreadsheet ID |
| BOT_TOKEN | Token from BotFather |
| GROUP_CHAT_ID | Your group ID (negative number) |
| TARGET_THREAD_ID | Topic ID for "Мысли по прочитанному" |
| REPORT_THREAD_ID | Topic ID for "Объявления" |

### 4. Initialize Sheets

Run `setupSheets()` function once.

### 5. Deploy as Web App

1. Deploy > New deployment
2. Type: Web app
3. Execute as: Me
4. Access: Anyone
5. Copy deployment URL

### 6. Set Webhook

```
https://api.telegram.org/bot{TOKEN}/setWebhook?url={DEPLOYMENT_URL}
```

### 7. Create Weekly Trigger

1. Triggers (clock icon)
2. Add Trigger
3. Function: `runWeeklyReport`
4. Event source: Time-driven
5. Type: Week timer
6. Day: Sunday
7. Time: 21:00

## Testing

1. Run `testConfig()` - verify all properties set
2. Run `integrationTest()` - verify message processing
3. Send test message in group topic
4. Check logs sheet for entries

## Getting Topic IDs

Forward a message from the topic to @userinfobot or check via Bot API getUpdates.
```

**Step 2: Commit**

```bash
git add klchb_bot/README.md
git commit -m "docs: add deployment guide"
```

---

## Task 13: Final Commit & Cleanup

**Step 1: Update CLAUDE.md with bot info**

Add section about the bot to CLAUDE.md.

**Step 2: Final commit**

```bash
git add -A
git commit -m "feat: complete KLCHB bot implementation"
```

**Step 3: Verify all files**

```bash
ls -la klchb_bot/gas/
```

Expected:
```
appsscript.json
Code.gs
Logging.gs
Members.gs
Messages.gs
SheetHelpers.gs
TelegramApi.gs
Webhook.gs
WeeklyReport.gs
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Project structure | appsscript.json |
| 2 | Sheet helpers | SheetHelpers.gs |
| 3 | Logging | Logging.gs |
| 4 | Telegram API | TelegramApi.gs |
| 5 | Members CRUD | Members.gs |
| 6 | Messages access | Messages.gs |
| 7 | Webhook handler | Webhook.gs |
| 8 | Entry points | Code.gs |
| 9 | Weekly logic | WeeklyReport.gs |
| 10 | PNG generation | WeeklyReport.gs |
| 11 | Integration test | Code.gs |
| 12 | Deployment docs | README.md |
| 13 | Final cleanup | CLAUDE.md |
