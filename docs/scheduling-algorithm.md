# Scheduling Algorithm

The scheduler is a pure deterministic function. It merges FreeBusy intervals, adds configured
buffers, builds allowed local-time windows based on the user's active `readingWindows` for each
applicable weekday in the selected IANA timezone, enforces notice and duration limits, and selects
queue items by priority then age. It attributes matching window names to proposal explanations
(e.g., "Fits your Morning Commute reading window (30 min)") and returns up to three distinct
proposals without calling Calendar.

Confidence is high only when current Calendar data was available. Confirmation rechecks the
exact interval within 30 seconds. A new conflict requires a second explicit confirmation.
