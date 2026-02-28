/**
 * Route bot commands to handlers
 */
function handleCommand_(message) {
  const text = message.text || "";
  const command = text.split(/[\s@]/)[0]; // "/report@botname" → "/report"
  const args = text.slice(command.length).trim();
  const userId = message.from.id;
  const chatId = message.chat.id;

  switch (command) {
    case "/start":
      sendPlainMessage_(chatId, "KL4B Bot активен.");
      break;
    case "/report":
      handleReportCommand_(message, args);
      break;
    default:
      sendPlainMessage_(chatId, "Неизвестная команда.");
      break;
  }
}

/**
 * /report [2026-W08] — generate weekly report and send to admin's DM
 * Admin-only. Runs full processing (strikes, trophies, history).
 */
function handleReportCommand_(message, args) {
  const userId = message.from.id;

  if (!isAdmin_(userId)) {
    sendPlainMessage_(message.chat.id, "Нет доступа.");
    return;
  }

  sendPlainMessage_(userId, "Генерирую отчёт...");

  try {
    const referenceDate = args ? parseWeekLabel_(args) : undefined;
    const report = generateWeeklyReport_(referenceDate);

    if (!report) {
      sendPlainMessage_(userId, "Нет участников для отчёта.");
      return;
    }

    const caption = `📊 Отчёт за неделю ${report.weekLabel}\nАктивных: ${report.activeCount}` +
      (report.trophyCount > 0 ? `\n🏆 Трофеев: ${report.trophyCount}` : "");

    sendDocument_(userId, report.csvBlob, caption);
    sendPlainMessage_(userId, "Таблица: " + report.sheetUrl);

    logInfo_("command", "/report executed", userId, message.from.username, {
      week: report.weekLabel,
    });
  } catch (err) {
    sendPlainMessage_(userId, "Ошибка: " + err.message);
    logError_("command", "/report failed: " + err.message, userId, null, { stack: err.stack });
  }
}
