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
