# KLCHB Telegram Bot — Design Document

## Overview

Автоматизация трекера активности книжного клуба (КЛЧБ). Telegram-бот на Google Apps Script заменяет ручной процесс с Jupyter notebook.

**Было:** ручной экспорт чата → запуск notebook → ручная публикация PNG
**Стало:** бот автоматически собирает сообщения и публикует недельный отчёт

## Решения

| Вопрос | Решение |
|--------|---------|
| Источник сообщений | Бот слушает webhook в реальном времени |
| Публикация отчёта | Автоматически по расписанию (воскресенье 21:00) |
| Фильтр сообщений | Только топик "Мысли по прочитанному" (по thread_id) |
| Участники клуба | Все, кто пишет в топик (автоопределение) |
| Исключение (expelled) | Только отметка в отчёте, без кика из группы |
| Заморозка | Вручную через Google Sheets (столбец frozen_until) |
| Формат отчёта | PNG из Google Sheets (export range as image) |
| Куда постить | Топик "Объявления" |

## Архитектура

```
┌─────────────────┐         ┌─────────────────┐
│  Telegram Group │ ──────► │  Google Apps    │
│                 │ webhook │  Script (GAS)   │
│  - Топик        │         │                 │
│   "Мысли..."    │         │  doPost()       │
│  - Топик        │ ◄────── │  - сохраняет    │
│   "Объявления"  │   PNG   │    сообщения    │
└─────────────────┘         │  - weekly       │
                            │    trigger      │
                            └────────┬────────┘
                                     │
                            ┌────────▼────────┐
                            │  Google Sheets  │
                            │                 │
                            │  - messages     │
                            │  - members      │
                            │  - state        │
                            │  - report_view  │
                            └─────────────────┘
```

## Структура Google Sheets

### Лист `messages`

Сырые сообщения из топика "Мысли по прочитанному".

| Столбец | Тип | Описание |
|---------|-----|----------|
| ts | datetime | Время сообщения (UTC) |
| user_id | number | Telegram user ID |
| username | string | @username (может быть пустым) |
| first_name | string | Имя в Telegram |
| message_id | number | ID сообщения |

### Лист `members`

Состояние участников клуба.

| Столбец | Тип | Описание |
|---------|-----|----------|
| user_id | number | Telegram user ID (ключ) |
| username | string | @username |
| first_name | string | Имя |
| status | string | `active` / `expelled` |
| strikes | number | Текущее количество страйков (0-3) |
| good_weeks | number | Подряд хороших недель |
| frozen_until | date | Дата окончания заморозки (пустая = нет) |
| first_seen | date | Дата первого сообщения |
| last_seen | date | Дата последнего сообщения |

### Лист `history`

История по неделям для аналитики.

| Столбец | Тип | Описание |
|---------|-----|----------|
| week | string | Метка недели (2026-W05) |
| user_id | number | Telegram user ID |
| active_days | number | Дней с активностью |
| weekly_status | string | ok/strike/expelled/frozen/new |
| strikes_after | number | Страйки после этой недели |
| status_after | string | Статус после этой недели |

### Лист `report_template`

Визуальный шаблон для PNG-отчёта. Форматирование:
- Заголовки с цветным фоном
- Условное форматирование для expelled (красный)
- Моноширинный шрифт для выравнивания

### Лист `logs`

Логи для отладки (как в telegram-mini-app-poc).

## Обработка сообщений (webhook)

```
Telegram webhook (doPost)
      │
      ▼
┌─────────────────────────────┐
│ message_thread_id ==        │
│ TARGET_THREAD_ID?           │
└─────────────┬───────────────┘
              │
     нет      │      да
   ┌──────────┴──────────┐
   │                     │
   ▼                     ▼
return OK          сохраняем в
(игнорируем)       лист messages
                         │
                         ▼
                   ┌─────────────┐
                   │ user_id уже │
                   │ в members?  │
                   └──────┬──────┘
                          │
                 нет      │      да
               ┌──────────┴──────────┐
               │                     │
               ▼                     ▼
        создаём запись         обновляем
        в members              last_seen
        (status=active,
         strikes=0)
```

## Недельная обработка (триггер)

**Расписание:** воскресенье 21:00 (Time-driven trigger в GAS)

**Алгоритм:**

1. Определить границы недели (понедельник 00:00 UTC — воскресенье 23:59 UTC)

2. Для каждого участника из `members` где `status = active`:
   - Посчитать `active_days` = количество уникальных дат в `messages` за неделю
   - Проверить `frozen_until`: если дата в будущем — пропустить обработку
   - Применить правила:

   ```
   if active_days >= 3:
       good_weeks += 1
       if good_weeks >= 2 and strikes > 0:
           strikes -= 1
           good_weeks = 0
   else:
       strikes += 1
       good_weeks = 0
       if strikes >= 3:
           status = "expelled"
   ```

   - Записать строку в `history`
   - Обновить `members`

3. Сформировать данные для отчёта (активные + новые expelled)

4. Записать в `report_template`

5. Экспортировать как PNG через Google Sheets API

6. Отправить в топик "Объявления" через Telegram Bot API

## Генерация PNG

```javascript
// URL для экспорта диапазона как PNG
const exportUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?` +
  `format=png&gid=${REPORT_TEMPLATE_GID}&range=A1:C${rowCount}`;

// Fetch с авторизацией (GAS автоматически добавляет OAuth)
const response = UrlFetchApp.fetch(exportUrl, {
  headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
});
const imageBlob = response.getBlob();

// Отправка в Telegram
UrlFetchApp.fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
  method: 'post',
  payload: {
    chat_id: GROUP_CHAT_ID,
    message_thread_id: REPORT_THREAD_ID,
    photo: imageBlob,
    caption: `Отчёт за неделю ${weekLabel}`
  }
});
```

## Конфигурация (Script Properties)

| Property | Описание |
|----------|----------|
| BOT_TOKEN | Токен Telegram бота |
| SHEET_ID | ID Google Spreadsheet |
| TARGET_THREAD_ID | ID топика "Мысли по прочитанному" |
| REPORT_THREAD_ID | ID топика "Объявления" |
| GROUP_CHAT_ID | ID группы (отрицательное число) |

## Структура проекта

```
kl4b/
├── klchb_new.ipynb              # старый notebook (справка)
├── klchb_bot/
│   └── gas/
│       ├── Code.gs              # точки входа (doGet, doPost)
│       ├── Webhook.gs           # обработка входящих сообщений
│       ├── WeeklyReport.gs      # генерация отчёта
│       ├── SheetHelpers.gs      # работа с таблицами
│       ├── TelegramApi.gs       # отправка сообщений/фото
│       └── appsscript.json      # манифест GAS
├── docs/
│   └── plans/
│       └── 2026-01-29-klchb-bot-design.md
└── CLAUDE.md
```

## Настройка и деплой

1. **Создать Google Spreadsheet**
   - Листы: `messages`, `members`, `history`, `report_template`, `logs`
   - Настроить заголовки и форматирование `report_template`

2. **Создать GAS проект**
   - Добавить файлы из `klchb_bot/gas/`
   - Установить Script Properties

3. **Деплой как Web App**
   - Execute as: Me
   - Who has access: Anyone

4. **Установить webhook**
   ```
   https://api.telegram.org/bot{TOKEN}/setWebhook?url={DEPLOY_URL}
   ```

5. **Создать триггер**
   - Edit → Current project's triggers
   - Add trigger: `runWeeklyReport`, Time-driven, Weekly, Sunday, 9pm

6. **Добавить бота в группу**
   - Добавить бота как админа (для чтения сообщений в топиках)

## Миграция данных

Для переноса текущего состояния из `klchb_state.csv`:

1. Импортировать CSV в лист `members`
2. Сопоставить столбцы (Author → first_name, status, strikes, good_weeks_in_a_row → good_weeks)
3. user_id заполнится автоматически при первом сообщении участника

## Ограничения

- Бот не видит историю до момента добавления в группу
- Первую неделю после запуска данные будут неполными
- Google Sheets export API может иметь лимиты на частые запросы
