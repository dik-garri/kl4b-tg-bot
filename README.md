# KL4B Bot — Трекер активности книжного клуба

Telegram-бот для автоматического отслеживания участия в книжном клубе KL4B (Клуб Любителей чтения Библии).

## Что делает бот

- Автоматически отслеживает сообщения в топике "Мысли по прочитанному"
- Ведёт учёт активных дней каждого участника
- Применяет систему страйков (< 3 активных дней в неделю = страйк)
- Исключает участников после 3 страйков
- Снимает 1 страйк за 2 подряд хорошие недели
- Поддерживает заморозки для временного отсутствия
- Каждое воскресенье постит PNG-отчёт в топик "Объявления"

## Технологии

- **Backend:** Google Apps Script
- **Database:** Google Sheets
- **API:** Telegram Bot API

## Структура проекта

```
kl4b/
├── klchb_bot/
│   └── gas/                    # Google Apps Script код
│       ├── appsscript.json     # Манифест GAS
│       ├── Code.gs             # Точки входа (doPost, doGet)
│       ├── SheetHelpers.gs     # Работа с таблицами
│       ├── Logging.gs          # Логирование
│       ├── TelegramApi.gs      # Telegram Bot API
│       ├── Members.gs          # CRUD для участников
│       ├── Messages.gs         # Работа с сообщениями
│       ├── Webhook.gs          # Обработка webhook
│       └── WeeklyReport.gs     # Генерация отчётов
├── docs/
│   └── plans/                  # Документация и планы
└── CLAUDE.md                   # Контекст для Claude Code
```

## Быстрый старт

### 1. Создать бота в Telegram

Через [@BotFather](https://t.me/BotFather):
- `/newbot` → получить токен
- Добавить бота в группу как администратора

### 2. Создать Google Spreadsheet

Создать новую таблицу и скопировать ID из URL:
```
https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit
```

### 3. Настроить Google Apps Script

1. Открыть [script.google.com](https://script.google.com)
2. Создать новый проект "KL4B Bot"
3. Скопировать все `.gs` файлы из `klchb_bot/gas/`
4. В Project Settings включить "Show appsscript.json manifest file" и скопировать содержимое `appsscript.json`

### 4. Установить Script Properties

Project Settings → Script Properties:

| Ключ | Значение |
|------|----------|
| SHEET_ID | ID Google Spreadsheet |
| BOT_TOKEN | Токен от BotFather |
| GROUP_CHAT_ID | ID группы (отрицательное число) |
| TARGET_THREAD_ID | ID топика "Мысли по прочитанному" |
| REPORT_THREAD_ID | ID топика "Объявления" |

### 5. Инициализировать таблицы

Запустить функцию `setupSheets()` один раз.

### 6. Задеплоить как Web App

Deploy → New deployment:
- Type: Web app
- Execute as: Me
- Who has access: Anyone

Скопировать URL деплоя.

### 7. Установить webhook

```
https://api.telegram.org/bot{TOKEN}/setWebhook?url={DEPLOYMENT_URL}
```

### 8. Создать триггер для отчётов

Triggers → Add Trigger:
- Function: `runWeeklyReport`
- Event source: Time-driven
- Type: Week timer
- Day: Sunday
- Time: 21:00

## Получение ID топиков

Переслать сообщение из топика боту [@userinfobot](https://t.me/userinfobot) или использовать `getUpdates`:
```
https://api.telegram.org/bot{TOKEN}/getUpdates
```

## Заморозки

Для временной заморозки участника (отпуск, болезнь):
1. Открыть Google Spreadsheet
2. В листе `members` найти участника
3. В столбце `frozen_until` указать дату окончания заморозки (YYYY-MM-DD)

## Тестирование

```javascript
// Проверить конфигурацию
testConfig();

// Интеграционный тест
integrationTest();

// Ручной запуск отчёта
runWeeklyReport();
```

## Бизнес-логика

| Условие | Результат |
|---------|-----------|
| ≥3 активных дней | good_weeks += 1 |
| <3 активных дней | strikes += 1, good_weeks = 0 |
| 2 хороших недели подряд + strikes > 0 | strikes -= 1, good_weeks = 0 |
| strikes >= 3 | status = expelled |
| frozen_until в будущем | пропустить неделю |

## Лицензия

MIT
