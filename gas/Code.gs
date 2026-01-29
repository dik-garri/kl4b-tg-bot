/**
 * KL4B Activity Tracker Bot
 * Клуб Любителей чтения Библии
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
  return ContentService.createTextOutput("KL4B Bot is running");
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