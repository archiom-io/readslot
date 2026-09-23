# Data Model

All persisted records carry `schemaVersion: 1` and are validated with Zod.

- `ReadingItem`: local URL metadata, estimate, priority, organization, optional recurrence schedule, lifecycle, and timestamps.
- `Proposal`: editable non-booking candidate, explanation, expiry, validation, and selected items.
- `ReadingSession`: confirmed Calendar mapping and per-item review outcomes.
- `CalendarOperation`: persistent idempotency/reconciliation state for event creation.
- `ReadingWindow`: named schedule slots (e.g. Morning, Lunch, Evening) with start/end times, active day-of-week filters, and enabled toggles.
- `Settings`: multi-window schedule boundaries (`readingWindows`), block duration preferences (with presets and custom duration limits), timezone, calendars, reminders (including multiple daily habit reminders), privacy, and notification choices.

Item states are `queued`, `proposed`, `scheduled`, `in_progress`, `completed`, `archived`, and
`deleted`. Deleted items are retained locally for 30 days unless permanently removed.
Recurring items remain in `queued` status after session completion to stay active for subsequent
scheduled daily reminders.
