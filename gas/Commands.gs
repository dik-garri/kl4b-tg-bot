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
      handleHelpCommand_(message);
      break;
    case "/help":
      handleHelpCommand_(message);
      break;
    case "/report":
      handleReportCommand_(message, args);
      break;
    case "/getlastreport":
      handleGetLastReportCommand_(message);
      break;
    default:
      sendPlainMessage_(chatId, "Неизвестная команда. /help — список команд.");
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

  // Dedup: ignore repeated /report within 120 seconds (Telegram retries slow webhooks)
  const cache = CacheService.getScriptCache();
  const cacheKey = "report_" + message.message_id;
  if (cache.get(cacheKey)) return;
  cache.put(cacheKey, "1", 120);

  sendPlainMessage_(userId, "Генерирую отчёт... Это может занять несколько минут.");

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
    // Idempotency: week already processed — not an error for the user
    if (err.message.includes("уже обработана")) {
      sendPlainMessage_(userId, "Отчёт за эту неделю уже готов.");
      return;
    }
    sendPlainMessage_(userId, "Ошибка: " + err.message);
    logError_("command", "/report failed: " + err.message, userId, null, { stack: err.stack });
  }
}

/**
 * /help — show available commands
 */
function handleHelpCommand_(message) {
  const userId = message.from.id;
  const isAdmin = isAdmin_(userId);

  let text = "Доступные команды:\n\n";
  text += "/help — список команд\n";

  if (isAdmin) {
    text += "/report — сгенерировать отчёт за последнюю неделю (обновляет страйки и трофеи)\n";
    text += "/report 2026-W08 — отчёт за конкретную неделю\n";
    text += "/getlastreport — получить последний готовый отчёт (без пересчёта)\n";
  }

  sendPlainMessage_(userId, text);
}

/**
 * /getlastreport — send last report from report_template sheet (read-only, no processing)
 * Admin-only.
 */
function handleGetLastReportCommand_(message) {
  const userId = message.from.id;

  if (!isAdmin_(userId)) {
    sendPlainMessage_(message.chat.id, "Нет доступа.");
    return;
  }

  try {
    const sheet = getReportSheet_();
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      sendPlainMessage_(userId, "Отчёт ещё не генерировался.");
      return;
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    const activeCount = data.length;

    const header = "Имя,Дни,Страйки,Трофеи";
    const rows = data.map(r => `${r[0]},${r[1]},${r[2]},${r[3]}`);
    const csv = [header, ...rows].join("\n");
    const csvBlob = Utilities.newBlob(csv, "text/csv", "last_report.csv");

    const sheetUrl = getReportSheetUrl_();

    const caption = `📊 Последний отчёт\nАктивных: ${activeCount}`;

    sendDocument_(userId, csvBlob, caption);
    sendPlainMessage_(userId, "Таблица: " + sheetUrl);
  } catch (err) {
    sendPlainMessage_(userId, "Ошибка: " + err.message);
    logError_("command", "/getlastreport failed: " + err.message, userId, null, { stack: err.stack });
  }
}
