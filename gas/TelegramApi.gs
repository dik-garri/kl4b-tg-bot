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
 * Send a plain text message (no HTML parsing — safe for error messages)
 */
function sendPlainMessage_(chatId, text) {
  return callTelegramApi_("sendMessage", {
    chat_id: chatId,
    text: text,
  });
}

/**
 * Send a document (file) with caption
 */
function sendDocument_(chatId, docBlob, caption, threadId) {
  const token = getBotToken_();
  const url = `https://api.telegram.org/bot${token}/sendDocument`;

  const formData = {
    chat_id: String(chatId),
    document: docBlob,
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

/**
 * Send a photo with caption
 */
function sendPhoto_(chatId, photoBlob, caption, threadId) {
  const token = getBotToken_();
  const url = `https://api.telegram.org/bot${token}/sendPhoto`;

  const formData = {
    chat_id: String(chatId),
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
