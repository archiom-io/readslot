# ADR 0006: Multi-Window Reading Schedules and Flexible Duration Blocks

Status: Accepted, 2026-09-23.

## Context

Prior to this decision, ReadSlot's scheduling system modeled availability windows as a single rigid daily time range (`earliestStart` and `latestEnd`, defaulting to 18:00–21:00) and a single preferred block length (defaulting to 30 minutes). In real-world reading habits, reading times are fragmented and diverse: users often have distinct slots throughout the day (e.g., a 15-minute morning commute, a 30-minute lunch break, a 60-minute evening wind-down, and longer weekend reading blocks).

Furthermore, the planner proposal editor offered only a hardcoded select dropdown of durations (`15, 30, 45, 60, 90`), omitting quick 10-minute or 20-minute reads and preventing users from specifying custom minutes (e.g. 25-minute Pomodoro sessions). Finally, setup access was hidden deep inside the settings page without direct shortcuts from primary workflow surfaces.

## Decision

1. **`ReadingWindow` Data Model**:
   - Added `ReadingWindowSchema` to `src/domain/schemas.ts`:
     ```ts
     {
       id: string;
       label: string;
       start: string; // HH:mm
       end: string;   // HH:mm
       days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
       enabled: boolean;
     }
     ```
   - Extended `SettingsSchema` with `readingWindows: z.array(ReadingWindowSchema)`.
   - Maintained `earliestStart` and `latestEnd` defaults for backward compatibility and non-destructive migration of existing IndexedDB settings.
   - Initialized sensible defaults: Morning Commute (`08:00–08:45`, Mon–Fri), Lunch Break (`12:30–13:15`, Mon–Fri), and Evening Wind-Down (`19:30–21:00`, Every day).

2. **Duration Presets & Custom Duration Entry**:
   - Added 1-click duration preset chips (`10 min`, `15 min`, `20 min`, `30 min`, `45 min`, `60 min`) alongside an inline custom minute input in both Settings and Planner proposal cards.

3. **Multi-Window Scheduling Engine**:
   - Updated `generateSuggestions` in `src/scheduler/scheduler.ts` to evaluate each calendar date against active reading windows matching the date's day of week.
   - Scans available FreeBusy intervals within each window and attributes matching window labels to proposal explanations (e.g. `Fits your "Morning Commute" reading window (30 min)`).
   - Falls back gracefully to `earliestStart`/`latestEnd` if no multi-windows are configured.

4. **Cross-Surface Setup Shortcuts**:
   - Added `[ ⚙️ Reading windows ]` setup CTA buttons across the Planner header action bar, Planner empty states, Queue header action bar, and Popup footer.
   - Implemented deep-link auto-scrolling to `#reading-windows` on the Settings page.

5. **Queue UI & Visual Ergonomics**:
   - Converted queue tab switching and search filtering to synchronous in-memory memoization from full local state, eliminating loading unmount flickers.
   - Aligned search queue and sort dropdown on the same horizontal row with matching 40px heights.
   - Normalized panel card heights across CSS grid layouts (`.grid > .panel { margin-top: 0; }`).
