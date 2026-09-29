# ADR 0005: Daily Recurring Reminders

Status: Accepted, 2026-09-21.

## Context

ReadSlot users frequently save recurring reading material (e.g. daily newspapers, textbooks, or course modules) or want to maintain a daily reading routine at consistent times of day (e.g. 8:00 PM). Previously, ReadSlot supported only one-off reading item capture, single Google Calendar blocks, and a weekly planning reminder.

## Decision

1. **Two-Tier Reminder Architecture**:
   - **Item-Specific Recurrence**: Added an optional `recurrence` schedule to `ReadingItem` (time of day, active days of week, and optional Google Calendar sync).
   - **General Habit Reminders**: Added `dailyReminders` to `Settings`, supporting multiple independent recurring reading habit alerts with custom labels and times.

2. **Delivery Mechanism**:
   - **Local Chrome Notifications** (`chrome.alarms` + `chrome.notifications`) serve as the default zero-dependency, offline-capable delivery channel. Clicking an item reminder opens its source URL directly; clicking a habit reminder opens the reading queue.
   - **Optional Google Calendar Sync**: When enabled and Google Calendar is connected, ReadSlot inserts a recurring event using standard RFC 5545 recurrence rules (`RRULE:FREQ=DAILY` or weekly day recurrence).

3. **Queue Lifecycle for Recurring Items**:
   - When a user finishes reading a recurring item, session review records completion in session history and updates `lastOpenedAt`, but preserves the item in `queued` status so it remains active in the queue for future reminders without disappearing into completed archives.

4. **Toolbar Confirmation and Calendar Connection**:
   - Selecting a daily reminder replaces the one-time Save for later / Save & choose time choice with a single daily-reminder action.
   - Local recurrence uses **Save daily reminder**. Calendar-backed recurrence uses **Confirm & sync daily**, which is available only after direct popup OAuth and writable-calendar validation.
   - Google Calendar is mandatory only for Calendar-backed scheduling and sync. Capture, the local queue, and local notifications remain available without a Google account.
   - Recurring Calendar creation uses a deterministic event ID, a persisted pending operation, timeout reconciliation, and removal of the linked event when the recurring item is undone or deleted.
