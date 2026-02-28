/**
 * Process incoming Telegram update
 */
function processUpdate_(update) {
  if (!update) {
    logWarn_("webhook", "Empty update received", null, null, null);
    return;
  }

  const message = update.message;
  if (!message) {
    logInfo_("webhook", "No message in update", null, null, { update_id: update.update_id });
    return;
  }

  // Handle bot commands before thread filter (commands work from any chat/topic)
  const text = message.text || "";
  if (text.startsWith("/")) {
    handleCommand_(message);
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
