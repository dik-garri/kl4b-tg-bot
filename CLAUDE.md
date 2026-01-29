# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**KL4B** (Клуб Любителей чтения Библии) — трекер активности для Telegram-группы книжного клуба. Отслеживает участие в топике "Мысли по прочитанному" и управляет статусом участников на основе активности.

## Project Structure

```
kl4b/
├── klchb_bot/              # Telegram bot (Google Apps Script)
│   └── gas/
│       ├── Code.gs         # Entry points (doPost, doGet, setup)
│       ├── SheetHelpers.gs # Google Sheets utilities
│       ├── Logging.gs      # Logging to sheets
│       ├── TelegramApi.gs  # Telegram Bot API
│       ├── Members.gs      # Member CRUD
│       ├── Messages.gs     # Message storage, week calculations
│       ├── Webhook.gs      # Process incoming messages
│       ├── WeeklyReport.gs # Weekly processing, PNG generation
│       └── appsscript.json # GAS manifest
├── klchb_new.ipynb         # Legacy notebook (reference only)
└── docs/plans/             # Design documents
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

### Script Properties Required

```
SHEET_ID, BOT_TOKEN, GROUP_CHAT_ID, TARGET_THREAD_ID, REPORT_THREAD_ID
```

### Deployment

See `klchb_bot/README.md` for full setup instructions.

## Business Rules

- **≥3 активных дней** в неделю — хорошая неделя
- **<3 дней** — страйк
- **3 страйка** = исключение
- **2 хороших недели подряд** снимают 1 страйк
- Замороженные участники не получают страйков (frozen_until в Google Sheets)

## Legacy Notebook

`klchb_new.ipynb` — старый ручной процесс (для справки):
- Требовал ручного экспорта чата в JSON
- Ручного запуска notebook
- Ручной публикации PNG

Заменён автоматическим ботом.
