# KL4B Bot Deployment

Инструкция по развёртыванию бота KL4B (Клуб Любителей чтения Библии).

## Prerequisites

1. Telegram bot created via @BotFather
2. Google account with Apps Script access
3. Bot added to group as admin

## Setup Steps

### 1. Create Google Spreadsheet

Create new spreadsheet, note the ID from URL:
`https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`

### 2. Create Apps Script Project

1. Go to https://script.google.com
2. Create new project "KL4B Bot"
3. Copy all .gs files from this directory
4. Copy appsscript.json content to Project Settings > Manifest

### 3. Set Script Properties

Project Settings > Script Properties:

| Key | Value |
|-----|-------|
| SHEET_ID | Your spreadsheet ID |
| BOT_TOKEN | Token from BotFather |
| GROUP_CHAT_ID | Your group ID (negative number) |
| TARGET_THREAD_ID | Topic ID for "Мысли по прочитанному" |
| REPORT_THREAD_ID | Topic ID for "Объявления" |

### 4. Initialize Sheets

Run `setupSheets()` function once.

### 5. Deploy as Web App

1. Deploy > New deployment
2. Type: Web app
3. Execute as: Me
4. Access: Anyone
5. Copy deployment URL

### 6. Set Webhook

```
https://api.telegram.org/bot{TOKEN}/setWebhook?url={DEPLOYMENT_URL}
```

### 7. Create Weekly Trigger

1. Triggers (clock icon)
2. Add Trigger
3. Function: `runWeeklyReport`
4. Event source: Time-driven
5. Type: Week timer
6. Day: Sunday
7. Time: 21:00

## Testing

1. Run `testConfig()` - verify all properties set
2. Run `integrationTest()` - verify message processing
3. Send test message in group topic
4. Check logs sheet for entries

## Getting Topic IDs

Forward a message from the topic to @userinfobot or check via Bot API getUpdates.
