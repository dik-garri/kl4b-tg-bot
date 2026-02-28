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
    "strikes", "good_weeks", "trophies", "max_trophies", "frozen_until", "first_seen", "last_seen",
    "report_name", "role"
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
  ensureHeader_(sheet, ["Имя", "Дней", "Страйки", "Трофеи"]);
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
