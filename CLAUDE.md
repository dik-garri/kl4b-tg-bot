# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Book club activity tracker (КЛЧБ - Кыргызский Литературный Клуб Библиі) for managing member engagement in a Telegram Bible reading discussion group. Tracks participation in the "Мысли по прочитанному" (Thoughts on Reading) thread and manages membership status based on activity levels.

## Running the Project

This is a Jupyter notebook project. Run cells sequentially in `klchb_new.ipynb`:
- Designed for Google Colab (paths default to `/content/`)
- For local execution, update all path constants in Cell 5 to local paths

## Data Flow

1. **Input**: `result.json` - Telegram group export (via Telegram Desktop: Export Chat History → JSON)
2. **State tracking**: `klchb_state.csv` - current member status, strikes, consecutive good weeks
3. **History**: `klchb_history.csv` - full week-by-week tracking
4. **Output**: `klchb_summary_this_week.csv` and `.png` - weekly report for posting to Telegram

## Weekly Run Checklist

Before each run, update in Cell 5:
1. `WEEK_LABEL` - current week identifier (e.g., "2026-Jan-4")
2. `new_members` - first-time participants (protected from strikes)
3. `frozen_members` - members with temporary freeze
4. `returned_members` - previously expelled members returning
5. Copy the updated `club_members` list printed at the end for next week

## Business Rules

- Members need **≥3 active days** per week to avoid a strike
- **3 strikes** = expulsion
- **2 consecutive good weeks** removes 1 strike (resets good week counter)
- New members cannot receive strikes in their first week
- Frozen members don't receive strikes
- Messages only count if `reply_to_message_id == 3` (the discussion thread)

## Notebook Structure

| Cell | Purpose |
|------|---------|
| 1 | Imports (pandas, matplotlib, json, datetime) |
| 2 | Telegram JSON parsing helpers |
| 3 | State management and rule application logic |
| 4 | PNG table rendering for Telegram posting |
| 5 | **Main execution** - paths, member lists, weekly pipeline |
| 7 | Year-end statistics (optional, standalone) |

## Key Functions

- `get_weekly_activity()` - parses Telegram JSON, returns active days per member
- `update_state_for_week()` - applies strike/expulsion rules, returns new state
- `plot_aligned_activity_list()` - renders summary as monospace PNG

## Output Columns

CSV/PNG use Russian headers:
- `Автор` - member name
- `Активных дней` - days with ≥1 message
- `Страйки` - current strike count
