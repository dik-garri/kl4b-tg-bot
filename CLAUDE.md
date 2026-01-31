# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules

1. **Всегда обновлять документацию** — при изменении кода или бизнес-логики обновлять:
   - `README.md` — пользовательская документация
   - `CLAUDE.md` — контекст для Claude Code
   - `TODOs.md` — если появились новые идеи/задачи

2. **Учитывать LESSONS_LEARNED** — перед изменением GAS кода проверить `telegram-mini-app-poc/skills/LESSONS_LEARNED.md`

3. **Коммиты после каждого логического изменения**

## Project Overview

**KL4B** (Клуб Любителей чтения Библии) — трекер активности для Telegram-группы книжного клуба. Отслеживает участие в топике "Мысли по прочитанному" и управляет статусом участников на основе активности.

## Project Structure

```
kl4b/
├── gas/                    # Google Apps Script код
│   ├── Code.gs             # Entry points (doPost, doGet, setup)
│   ├── SheetHelpers.gs     # Google Sheets utilities
│   ├── Logging.gs          # Logging to sheets
│   ├── TelegramApi.gs      # Telegram Bot API
│   ├── Members.gs          # Member CRUD
│   ├── Messages.gs         # Message storage, week calculations
│   ├── Webhook.gs          # Process incoming messages
│   ├── WeeklyReport.gs     # Weekly processing, PNG generation
│   └── appsscript.json     # GAS manifest
├── docs/plans/             # Design documents
├── README.md               # Пользовательская документация
├── CLAUDE.md               # Контекст для Claude Code
└── TODOs.md                # Будущие улучшения
```

## KL4B Bot (Primary)

Автоматический Telegram-бот на Google Apps Script.

### How It Works

1. **Webhook** получает сообщения из топика "Мысли по прочитанному"
2. Сохраняет в Google Sheets (messages, members)
3. **Weekly trigger** (воскресенье 21:00) обрабатывает активность
4. Генерирует PNG-отчёт и постит в топик "Объявления"

### Key Files

| File | Purpose |
|------|---------|
| Code.gs | `doPost()`, `doGet()`, `setupSheets()`, `testConfig()`, `integrationTest()` |
| WeeklyReport.gs | `runWeeklyReport()` — entry point for weekly trigger |
| Webhook.gs | `processUpdate_()` — processes incoming Telegram messages |

### Google Sheets Structure

**members** — участники:
```
user_id, username, first_name, status, strikes, good_weeks, trophies, max_trophies, frozen_until, first_seen, last_seen
```

**messages** — все сообщения из целевого топика:
```
ts, user_id, username, first_name, message_id
```

**history** — еженедельная история:
```
week, user_id, active_days, weekly_status, strikes_after, status_after
```

### Script Properties Required

```
SHEET_ID, BOT_TOKEN, GROUP_CHAT_ID, TARGET_THREAD_ID, REPORT_THREAD_ID
COLLECTION_ONLY (опционально) — true для режима сбора данных без отчётов
```

### Deployment

See main `README.md` for full setup instructions.

## Business Rules

### Подсчёт суток
Сутки считаются с **4:00 до 4:00** по времени GMT+6 (Бишкек). Сообщение в 3:00 ночи засчитывается за предыдущий день.

### Страйки
- **≥3 активных дней** в неделю — хорошая неделя
- **<3 дней** — страйк, good_weeks и trophies обнуляются
- **3 страйка** = исключение (status = expelled)
- **2 хороших недели подряд** снимают 1 страйк

### Трофеи 🏆
- **6 активных дней** — +1 трофей
- **<6 дней** — trophies обнуляются (даже без страйка)
- **max_trophies** — максимум за всё время (для подарков), не отображается в отчётах

### Заморозка
- Замороженные участники (frozen_until в Google Sheets) пропускают неделю без страйка

### COLLECTION_ONLY режим
- При `COLLECTION_ONLY=true` бот работает полностью, но без отправки в Telegram
- Все подсчёты ведутся: страйки, трофеи, история
- Данные записываются в `report_template` для ручной проверки
- Только отправка PNG в Telegram отключена

## Legacy Notebook

`klchb_new.ipynb` — старый ручной процесс (для справки):
- Требовал ручного экспорта чата в JSON
- Ручного запуска notebook
- Ручной публикации PNG

Заменён автоматическим ботом.
