# ReadSlot — Complete Product, Engineering, Delivery, and Open-Source Blueprint

This is ReadSlot's canonical product and engineering specification.

**Document status:** Implemented beta baseline; OAuth verification pending  
**Version:** 2.1  
**Project type:** Free, local-first Chrome extension  
**Primary platform:** Google Chrome / Chromium browsers  
**Distribution target:** Chrome Web Store, GitHub Releases, source installation  
**Recommended license:** MIT  
**Source foundation:** Fork/derivative of `zarazhangrui/reading-block` (MIT)

---

# 0. Executive Decision Summary

**Implementation status (2026-07-13):** The version 0.9.0 Chrome-first beta is implemented with
a clean TypeScript foundation, on-demand `activeTab` capture, explicit Calendar confirmation,
local imports/exports, automated tests, release tooling, and store assets. Real OAuth smoke tests
and the production package require environment-specific Chrome Extension OAuth client IDs.

## Product decision

Build a free, privacy-first browser extension that saves articles, videos, PDFs, documentation, repositories, and other web content, analyzes the user's Google Calendar, and **suggests suitable reading blocks**.

The extension must never create a calendar event without explicit confirmation.

## Development decision

Use:
- TypeScript
- Manifest V3
- Vite
- React for extension pages
- Chrome Identity API
- Google Calendar API
- IndexedDB for the reading queue
- Vitest for unit tests
- Playwright for browser tests
- Local verification before every push
- GitHub Projects for sprint planning

No paid AI API is required.

## Open-source decision

**Yes, keep the project open source.**

Recommended approach:
- Fork the original MIT repository or clearly acknowledge it as the foundation.
- Retain the original copyright and MIT license notices.
- Add your own copyright notice for new work.
- Use the MIT license for continued compatibility and low contribution friction.
- Publish releases through the Chrome Web Store and GitHub.
- Keep OAuth client configuration and release keys under maintainer control.
- Never commit private keys, refresh tokens, test-user data, or release credentials.

## Core product promise

> Save now. Choose a suggested time. Actually read it.

---

# 1. Product Requirements Document

## 1.1 Product name

Product name: **ReadSlot**

Tagline: **Schedule what you save.**

ReadSlot is the canonical product, extension, and repository name. It replaced the former working name on 2026-07-13 after a preliminary collision review. Before publication, it must still receive formal Chrome Web Store, GitHub, domain, and trademark clearance.

## 1.2 Vision

People do not need another place to store links. They need help creating realistic time to consume what they save.

ReadSlot transforms a passive reading backlog into intentional calendar sessions while preserving human control.

## 1.3 Mission

Help users reduce their saved-content backlog by:
1. Capturing content with minimal friction.
2. Estimating the amount of time needed.
3. Identifying realistic free periods.
4. Suggesting candidate reading sessions.
5. Requiring explicit confirmation.
6. Reviewing outcomes and rescheduling unfinished content.

## 1.4 Problem statement

Users commonly save:
- Articles
- Videos
- Technical documentation
- PDFs
- Research papers
- GitHub repositories
- Reddit posts
- Newsletters
- Tutorials
- Courses
- Threads

The content accumulates in bookmarks, tabs, read-later services, messages, and notes.

Most read-later products solve collection and presentation. They do not adequately solve allocation of time.

The result is:
- Large backlogs
- Forgotten content
- Guilt and decision fatigue
- Repeated saving of duplicates
- Poor follow-through
- Unused bookmarks
- Overloaded browser sessions

## 1.5 Product principles

1. **Human in the loop**  
   Suggestions are automatic. Calendar creation is manual.

2. **Local first**  
   Reading data stays on the user's device unless explicitly exported.

3. **Minimal permissions**  
   Request only permissions required for capture, scheduling, and notifications.

4. **No paid dependency**  
   Core functionality must operate without paid APIs or subscriptions.

5. **Transparent behavior**  
   Explain why each time slot was suggested.

6. **Reversible actions**  
   The user can undo saves, cancel proposals, and remove created events.

7. **Queue reduction over queue growth**  
   The product should encourage completion, archiving, or deletion.

8. **Calendar respect**  
   Never book over existing events without a visible warning.

9. **Progressive complexity**  
   Simple defaults first; advanced options remain optional.

10. **Accessible by design**  
    Full keyboard support, semantic UI, visible focus, sufficient contrast, and screen-reader labels.

---

# 2. Goals and Non-goals

## 2.1 Primary goals

- Save a page with one click or keyboard shortcut.
- Maintain a clear reading queue.
- Estimate reading or viewing time without LLM APIs.
- Query Google Calendar availability.
- Generate three or more candidate time blocks.
- Let the user edit date, time, duration, reminders, and selected items.
- Recheck availability before event creation.
- Create an event only after explicit confirmation.
- Track completed, unfinished, archived, and deleted content.
- Operate without a backend.
- Publish safely to the Chrome Web Store.

## 2.2 Secondary goals

- Weekly reading planning.
- Queue-health reporting.
- Import and export.
- Offline article snapshots.
- Reading-mode extraction.
- Statistics and streaks.
- Multi-calendar support.
- Cross-browser compatibility.

## 2.3 Non-goals for the first release

- Paid AI summaries
- LLM chat
- Knowledge-base Q&A
- Collaborative workspaces
- Team calendars
- Mobile application
- Cloud account system
- Social features
- Paid subscriptions
- Full note-taking environment
- Browser history analysis
- Automatic calendar booking
- Automatic rescheduling without approval

---

# 3. Target Users and Personas

## 3.1 Primary persona: knowledge worker

Traits:
- Saves articles and documentation throughout the workday.
- Uses Google Calendar.
- Struggles to return to saved material.
- Wants controlled planning rather than automation.

Needs:
- Fast capture
- Work-hour exclusions
- Short weekday sessions
- Priority scheduling
- Privacy

## 3.2 Secondary persona: student

Traits:
- Saves course readings, videos, and papers.
- Has variable class schedules.
- Needs longer weekend blocks.
- Often underestimates reading time.

Needs:
- Collections by course
- Due dates
- Long-form session planning
- PDF support
- Progress tracking

## 3.3 Secondary persona: developer

Traits:
- Saves GitHub repositories, documentation, tutorials, and videos.
- Uses keyboard shortcuts.
- Values open source and local storage.
- May contribute code.

Needs:
- GitHub metadata
- Keyboard-first workflow
- Exportable data
- Transparent architecture
- Easy local development

## 3.4 Secondary persona: researcher

Traits:
- Saves papers, reports, and citations.
- Needs high-focus sessions.
- Works across multiple calendars.

Needs:
- Deep-focus classification
- Long session duration
- PDF metadata
- Custom tags
- Archive and citation fields

---

# 4. Jobs to Be Done

## Core job

> When I save useful content, help me reserve realistic time to consume it without making calendar decisions for me.

## Supporting jobs

- When I have a growing queue, show me its real time cost.
- When I have free calendar periods, suggest useful reading combinations.
- When a suggested period does not fit my plans, let me adjust it.
- When I fail to finish a session, help me reschedule without losing context.
- When content is no longer relevant, help me archive or remove it.
- When I revisit the same URL, tell me it is already saved.
- When my calendar changes, prevent stale suggestions from creating conflicts.

---

# 5. Market Position and Opportunity

## 5.1 Category

ReadSlot sits between:
- Read-later tools
- Calendar time-blocking tools
- Personal productivity tools
- Knowledge-management tools

It should not position itself as a complete reader or note-taking platform.

## 5.2 Positioning statement

> ReadSlot is a local-first scheduling assistant for saved content. It turns articles and videos into suggested calendar time while keeping the final decision with the user.

## 5.3 Differentiation

Traditional read-later tools:
- Save content
- Organize content
- Improve reading display
- Highlight and annotate

Calendar tools:
- Reserve time
- Show availability
- Remind users

ReadSlot:
- Connects saved content with available time
- Estimates backlog effort
- Suggests multiple blocks
- Requires confirmation
- Reviews outcomes
- Returns unfinished items to the queue

## 5.4 Opportunity

The strongest opportunity is not feature breadth. It is the behavioral gap between saving and consuming.

The product can win by being:
- Smaller than Readwise Reader
- More intentional than bookmarks
- Less autonomous than auto-schedulers
- More private than SaaS productivity platforms
- More transparent than AI scheduling tools
- Free and modifiable

## 5.5 Risks in the market

- Users may prefer simple bookmarks.
- Calendar permission can reduce installation conversion.
- Chrome Web Store users may distrust broad scopes.
- Read-later behavior is difficult to change.
- The product can become too complex.
- Existing calendar and task tools may add similar features.
- Google API policies may change.
- Maintaining a public extension requires ongoing security work.

## 5.6 Market validation plan

Before building advanced features:
1. Publish a landing page or README with screenshots.
2. Recruit 10–20 test users.
3. Track:
   - Saved items
   - Suggestions viewed
   - Suggestions accepted
   - Sessions completed
   - Queue reduction
4. Interview users after one week.
5. Ask:
   - Did suggested times feel realistic?
   - Did confirmation create too much friction?
   - Did calendar access feel trustworthy?
   - Which content types mattered most?
   - Did the extension help reduce backlog?

---

# 6. Functional Specification

# 6.1 Capture

## Requirements

The user can save:
- Current tab
- Right-clicked link
- Selected text plus current page
- PDF URL
- YouTube video
- GitHub repository
- Any valid HTTP or HTTPS page

## Saved metadata

- Unique ID
- Canonical URL
- Original URL
- Title
- Domain
- Favicon
- Content type
- Date saved
- Estimated duration
- User-set priority
- Tags
- Collection
- Status
- Notes
- Source metadata
- Last opened time
- Completion time

## Capture entry points

- Toolbar click
- Context menu
- Keyboard shortcut
- Extension popup
- Queue page paste input
- Import file

## Capture outcome

Show a toast:
- Saved
- Already saved
- Save failed
- Unsupported page
- Updated existing item

## Acceptance criteria

- Capture completes in under 300 ms locally, excluding metadata enrichment.
- Duplicate detection works with normalized URLs.
- Saving never triggers event creation.
- Save works while the user is offline.
- Metadata enrichment failure does not prevent saving.

---

# 6.2 Reading queue

## Views

- Inbox
- Scheduled
- Completed
- Archived
- All
- Collections
- Tags
- Recently saved
- Oldest first
- High priority
- Unscheduled

## Queue actions

- Open
- Mark completed
- Mark unread
- Schedule
- Add to proposal
- Change priority
- Add tag
- Add collection
- Edit duration
- Archive
- Delete
- Restore
- Export
- Copy URL

## Bulk actions

- Select all visible
- Add to proposal
- Change priority
- Add tag
- Archive
- Delete
- Export

## Search

Search fields:
- Title
- URL
- Domain
- Tags
- Collection
- Notes

Search should be local and incremental.

---

# 6.3 Duration estimation

## Articles

Default formula:
- Extract readable text where possible.
- Count words.
- Divide by configured reading speed.
- Add image overhead.
- Round to nearest 5 minutes.
- Enforce configurable minimum.

Default reading speed:
- 220 words per minute

Formula:

`estimatedMinutes = max(minimumMinutes, roundTo5(wordCount / wordsPerMinute + imageCount * imageSeconds / 60))`

## YouTube

Preferred:
- Use duration available in page metadata or structured data.
- Do not scrape protected APIs or require API keys.
- If unavailable, use a user-configurable default.

## PDFs

Options:
- Estimate from page count where available.
- Use PDF.js locally.
- Allow manual override.
- Avoid downloading very large files automatically.

## GitHub repositories

Default estimate:
- README only: 10 minutes
- User override recommended
- Optional metadata from visible page only

## Unknown content

Default:
- 15 minutes
- User can change globally or per item.

## Rules

- Manual duration always overrides estimated duration.
- Store both `estimatedMinutes` and `plannedMinutes`.
- Show confidence:
  - High
  - Medium
  - Low
- Never present an estimate as exact.

---

# 6.4 Google Calendar connection

## Requirements

- User explicitly initiates sign-in.
- Explain requested permissions before OAuth.
- Request the minimum practical scopes.
- Allow disconnect.
- Allow calendar selection.
- Store no Google refresh token manually.
- Use Chrome Identity APIs.
- Handle token revocation and expiry.

## Calendar choices

- Primary calendar default
- Optional selected calendars for availability checks
- One selected destination calendar for created events
- Option to ignore all-day events
- Option to respect declined events
- Option to treat tentative events as busy

## Connection states

- Not connected
- Connecting
- Connected
- Token expired
- Permission revoked
- API unavailable
- Rate limited

---

# 6.5 Suggestion engine

## User settings

- Allowed days
- Earliest start time
- Latest end time
- Minimum block length
- Maximum block length
- Preferred block length
- Minimum notice
- Planning horizon
- Buffer before events
- Buffer after events
- Maximum blocks per day
- Preferred calendar
- Time zone
- Weekend preference
- Deep-focus hours
- Light-reading hours

## Suggestion output

Each suggestion includes:
- Date
- Start
- End
- Duration
- Items included
- Estimated total time
- Remaining buffer
- Explanation
- Confidence
- Conflict status
- Calendar used
- Reminder default

## Suggestion ranking

Example scoring:

`score = availabilityFit + preferenceFit + priorityFit + ageFit + durationFit + energyFit - fragmentationPenalty - lateHourPenalty - conflictRisk`

## Explanation examples

- "Fits your preferred 45-minute weekday window."
- "Includes your two oldest high-priority items."
- "Leaves a 15-minute buffer before your next meeting."
- "Weekend option for long-form reading."
- "Short session matched to three 10-minute items."

## Confirmation rule

A suggestion is not an event.

Only a click on a clearly labeled action such as **Create reading block** may create the event.

---

# 6.6 Proposal editor

## Editable fields

- Title
- Date
- Start time
- End time
- Duration
- Reminder
- Calendar
- Items
- Description
- Color, if supported
- Busy/free status
- Recurrence for manually created future feature
- Add video-conference link: not required

## Actions

- Create block
- Save proposal
- Show alternatives
- Pick custom time
- Remove item
- Add item
- Cancel
- Create anyway after conflict warning

## Preflight check

Before creation:
1. Refresh free/busy data.
2. Confirm calendar connection.
3. Confirm item states.
4. Detect duplicate event creation.
5. Validate local time zone.
6. Check duration.
7. Show conflict if availability changed.

---

# 6.7 Calendar event format

## Default title

`ReadSlot — 3 items`

Optional:
`Reading: AI safety and system design`

## Description

Include:
- Numbered list of titles
- Direct URLs
- Estimated duration per item
- Link to extension queue or session page
- Privacy-safe note

Example:

1. Article title — 15 min  
   https://example.com/article

2. Video title — 22 min  
   https://youtube.com/...

Created by ReadSlot.

## Reminders

Defaults:
- 10 minutes before
- Configurable
- Optional disabled reminder

## Event identifiers

Store:
- Google event ID
- Calendar ID
- Local session ID
- Creation timestamp
- Last synchronization timestamp

---

# 6.8 Reading session

## Session page

Show:
- Session timer
- Selected items
- Open next
- Open all
- Mark completed
- Skip
- Move to later
- Add note
- End session

## Session completion

At session end:
- Show review
- Allow partial completion
- Return unfinished items to queue
- Archive skipped items optionally
- Suggest follow-up slots, but do not create them automatically

---

# 6.9 Weekly planner

## Trigger

- Manual opening
- Optional browser notification
- No automatic event creation
- Optional day/time preference

## Planner output

- Queue size
- Estimated queue duration
- High-priority items
- Available time next week
- Three planning strategies:
  - Light
  - Balanced
  - Aggressive

## Example

Light:
- 2 blocks
- 60 total minutes

Balanced:
- 4 blocks
- 150 total minutes

Aggressive:
- 6 blocks
- 240 total minutes

Each plan requires confirmation per block or a final bulk confirmation screen.

---

# 6.10 Import and export

## Imports

- Browser bookmarks HTML
- Pocket export
- Instapaper export
- CSV
- JSON
- Plain URL list

## Exports

- JSON full backup
- CSV
- Markdown
- Browser-bookmark HTML

## Rules

- Preview before import.
- Detect duplicates.
- Allow tag assignment during import.
- Include schema version.
- Never overwrite existing data silently.

---

# 6.11 Notifications

Use notifications for:
- Proposal ready
- Reading session beginning
- Session review
- OAuth reauthorization required
- Import completed
- Storage error

Do not use notifications for:
- Advertising
- Engagement manipulation
- Repeated reminders after dismissal

---

# 7. Business Logic

## 7.1 Item states

```text
queued
proposed
scheduled
in_progress
completed
archived
deleted
```

## 7.2 Valid transitions

```text
queued -> proposed
queued -> scheduled
queued -> completed
queued -> archived
queued -> deleted

proposed -> queued
proposed -> scheduled
proposed -> archived
proposed -> deleted

scheduled -> in_progress
scheduled -> queued
scheduled -> completed
scheduled -> archived

in_progress -> completed
in_progress -> queued
in_progress -> archived

completed -> queued
completed -> archived
completed -> deleted

archived -> queued
archived -> deleted
```

## 7.3 Proposal states

```text
draft
ready
stale
confirmed
cancelled
expired
```

## 7.4 Scheduling rules

- A proposal can include one or more items.
- An item can belong to only one active confirmed session.
- An item may appear in multiple unconfirmed drafts only if clearly indicated.
- Confirming a proposal invalidates overlapping drafts containing the same item.
- Proposals expire after a configurable period, default 24 hours.
- Stale proposals must be revalidated.
- Calendar creation requires an explicit user action.
- Calendar availability must be rechecked within 30 seconds before creation.
- If the user chooses a conflicting time, require a second confirmation.

## 7.5 Priority rules

Priority values:
- High
- Normal
- Low
- Someday

Suggested ordering:
1. Due soon
2. High priority
3. Oldest
4. Shortest fitting item
5. Normal
6. Low
7. Someday only when explicitly included

## 7.6 Backlog rules

Queue health bands:
- Healthy: under 2 hours
- Growing: 2–5 hours
- Heavy: 5–10 hours
- Overloaded: over 10 hours

These thresholds must be configurable or presented as estimates, not judgments.

## 7.7 Duplicate logic

Normalize:
- Remove URL fragments unless required.
- Remove common tracking parameters.
- Normalize trailing slash.
- Lowercase host.
- Preserve meaningful query parameters.
- Resolve canonical URL only when safe.

Duplicate outcomes:
- Exact duplicate: show existing item.
- Canonical duplicate: offer merge.
- Same title, different URL: do not merge automatically.

## 7.8 Deletion rules

- Soft-delete first.
- Keep in trash for 30 days locally.
- Permanent deletion requires confirmation.
- Deleting an item does not automatically delete a calendar event unless the user chooses that action.
- Deleting a session should ask whether to return unfinished items to the queue.

---

# 8. Real-Life Scenarios

## Scenario 1: article queue reaches five items

1. User saves five articles.
2. Extension shows "5 items ready to plan."
3. User opens planner.
4. Calendar availability is read.
5. Three blocks are suggested.
6. User changes 45 minutes to 30 minutes.
7. Extension removes one item from the proposal.
8. User confirms.
9. Event is created.
10. Items become scheduled.

## Scenario 2: user has an unrecorded personal plan

1. Extension suggests Saturday 4 PM.
2. Calendar is technically free.
3. User knows they will be out.
4. User rejects the slot.
5. Extension offers alternatives.
6. No calendar event is created.

## Scenario 3: stale suggestion

1. Suggestion is generated at 10 AM.
2. A meeting is added at 11 AM.
3. User confirms at noon.
4. Extension rechecks availability.
5. Conflict is shown.
6. User chooses another slot.

## Scenario 4: partial completion

1. Session contains four articles.
2. User finishes two.
3. User marks two complete.
4. Remaining items return to queue.
5. Extension suggests a follow-up but does not create it.

## Scenario 5: OAuth revoked

1. User revokes access in Google settings.
2. Extension attempts availability lookup.
3. API returns unauthorized.
4. Local queue remains intact.
5. Extension shows reconnect action.
6. No data is lost.

## Scenario 6: offline capture

1. User is offline.
2. User saves a cached page.
3. Item is stored locally.
4. Duration estimation is deferred.
5. Calendar features remain unavailable.
6. When online, metadata enrichment resumes.

## Scenario 7: time-zone travel

1. User travels from Dhaka to London.
2. Browser time zone changes.
3. Extension detects change.
4. Existing events preserve absolute timestamps.
5. New suggestions use the current time zone.
6. User sees a time-zone notice.

## Scenario 8: event changed externally

1. User moves a ReadSlot reading block in Google Calendar.
2. Extension later queries the event.
3. Local session updates to the new time.
4. User is not forced back to the original time.

## Scenario 9: event deleted externally

1. User deletes the calendar event.
2. Extension detects missing event.
3. Scheduled items return to queue after confirmation or according to a clear setting.
4. Event is not silently recreated.

## Scenario 10: duplicate event request

1. User double-clicks Create.
2. First request succeeds.
3. Second request is blocked by an idempotency key.
4. Only one event exists.

---

# 9. Edge Cases

## 9.1 Calendar

- No calendar available
- No free slots in planning horizon
- All-day event covering day
- Recurring event exception
- Tentative event
- Declined event
- Private event without details
- Working-location event
- Focus-time event
- Out-of-office event
- Event created while suggestion modal is open
- FreeBusy response incomplete
- API returns partial failure
- Destination calendar is read-only
- Calendar deleted after selection
- Multiple Google accounts
- User switches Chrome profile
- Event ID changes through import
- Calendar rate limit reached
- Clock skew
- Daylight-saving transition
- Time zone with half-hour offset
- Midnight-spanning reading window
- Leap day
- Calendar event longer than 24 hours
- Duplicate calendar event
- User manually edits generated description

## 9.2 Browser and extension

- Service worker terminated mid-operation
- Extension update during scheduling
- Storage quota reached
- Browser crashes
- Incognito mode
- Restricted pages such as `chrome://`
- File URLs
- Browser PDF viewer
- Content Security Policy restrictions
- Page title changes after capture
- Tab closes before metadata extraction
- Multiple windows
- Browser sync disabled
- Extension uninstalled and reinstalled
- Storage migration fails
- Notification permission disabled
- Context menu unavailable
- Keyboard shortcut conflict

## 9.3 Content

- Paywalled article
- Dynamic single-page app
- Infinite-scroll article
- Empty page
- Non-English content
- Right-to-left text
- Very long page
- Huge PDF
- Password-protected PDF
- YouTube live stream
- YouTube playlist
- Deleted video
- GitHub private repository
- Localhost page
- URL with authentication token
- Sensitive query parameters
- URL shortener
- Duplicate canonical tags
- No favicon
- Malicious page title
- HTML injection attempt in metadata

## 9.4 User behavior

- User rejects every suggestion
- User continuously postpones items
- User changes reading speed
- User marks item completed before session
- User deletes items in active proposal
- User opens the same session on multiple devices
- User edits calendar event while session is active
- User creates a conflicting event intentionally
- User selects more content than fits
- User sets zero-minute duration
- User sets end before start
- User closes OAuth window
- User denies only one scope
- User signs into wrong account
- User clears browser data

---

# 10. Technical Architecture

## 10.1 Architecture style

Local-first Chrome extension with direct Google API integration.

```text
Content Script
     |
     v
Background Service Worker
     |
     +--> IndexedDB
     |
     +--> Chrome Storage
     |
     +--> Chrome Identity
     |
     +--> Google Calendar API
     |
     +--> Notifications / Alarms
     |
     v
Popup / Queue / Planner / Session UI
```

## 10.2 Components

### Background service worker

Responsibilities:
- Message routing
- OAuth token requests
- Calendar API calls
- Queue persistence orchestration
- Proposal generation
- Alarm management
- Notification dispatch
- Data migration
- Idempotent event creation

### Content script

Responsibilities:
- Extract page metadata
- Extract readable text on demand
- Capture selected text
- Detect content type
- Sanitize extracted metadata
- Show lightweight save toast

### Popup

Responsibilities:
- Save current page
- Show queue count
- Show upcoming reading block
- Open planner
- Quick schedule
- Connection status

### Queue page

Responsibilities:
- Search, filter, sort
- Bulk actions
- Item editing
- Import/export
- Statistics

### Planner page

Responsibilities:
- Fetch or display suggestions
- Edit proposal
- Recheck conflicts
- Confirm event creation

### Session page

Responsibilities:
- Open items
- Timer
- Completion state
- End-of-session review

### Options page

Responsibilities:
- Calendar connection
- Scheduling preferences
- Privacy controls
- Import/export
- Data reset
- Advanced settings

---

# 11. Recommended Technology Stack

## Core

- TypeScript
- React
- Vite
- Manifest V3
- WebExtension-compatible abstractions where practical

## State

- Zustand or lightweight reducer-based state
- Avoid large state frameworks unless justified

## Storage

- IndexedDB with Dexie
- `chrome.storage.local` for lightweight settings
- `chrome.storage.session` for ephemeral state

## Validation

- Zod

## Dates

- date-fns
- Native `Intl.DateTimeFormat`
- Avoid storing local-formatted dates

## Testing

- Vitest
- Testing Library
- Playwright
- Mock Service Worker or custom fetch mocks

## Quality

- ESLint
- Prettier
- TypeScript strict mode
- Husky optional
- lint-staged optional
- Commitlint optional

## Quality automation

- Local `pnpm check` and Playwright verification before every push
- Dependabot for npm dependency visibility
- npm audit as advisory, not sole security gate
- GitHub Actions and CodeQL may be restored later through an ADR

---

# 12. Proposed Repository Structure

```text
readslot/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug.yml
│   │   ├── feature.yml
│   │   ├── security.yml
│   │   └── config.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── CODEOWNERS
│   └── dependabot.yml
├── docs/
│   ├── architecture.md
│   ├── oauth.md
│   ├── privacy.md
│   ├── testing.md
│   ├── release.md
│   ├── ai-development.md
│   └── adr/
├── public/
│   ├── icons/
│   └── manifest.json
├── src/
│   ├── background/
│   ├── content/
│   ├── popup/
│   ├── queue/
│   ├── planner/
│   ├── session/
│   ├── options/
│   ├── calendar/
│   ├── scheduler/
│   ├── storage/
│   ├── domain/
│   ├── shared/
│   └── test/
├── scripts/
│   ├── build-release.ts
│   ├── validate-manifest.ts
│   └── generate-changelog.ts
├── tests/
│   ├── e2e/
│   ├── fixtures/
│   └── mocks/
├── CHANGELOG.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE
├── NOTICE
├── PRIVACY.md
├── README.md
├── SECURITY.md
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

# 13. Data Model

## ReadingItem

```ts
export interface ReadingItem {
  id: string;
  originalUrl: string;
  canonicalUrl: string;
  title: string;
  domain: string;
  faviconUrl?: string;
  contentType: ContentType;
  wordCount?: number;
  pageCount?: number;
  mediaDurationSeconds?: number;
  estimatedMinutes: number;
  plannedMinutes?: number;
  estimateConfidence: "high" | "medium" | "low";
  priority: "high" | "normal" | "low" | "someday";
  tags: string[];
  collectionId?: string;
  notes?: string;
  status: ItemStatus;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  completedAt?: string;
  archivedAt?: string;
  deletedAt?: string;
}
```

## Proposal

```ts
export interface Proposal {
  id: string;
  itemIds: string[];
  calendarId: string;
  suggestedStart: string;
  suggestedEnd: string;
  durationMinutes: number;
  reminderMinutes?: number;
  score: number;
  explanation: string[];
  status: ProposalStatus;
  generatedAt: string;
  expiresAt: string;
  lastValidatedAt?: string;
}
```

## ReadingSession

```ts
export interface ReadingSession {
  id: string;
  proposalId?: string;
  itemIds: string[];
  calendarId: string;
  calendarEventId: string;
  start: string;
  end: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
}
```

## Settings

```ts
export interface Settings {
  schemaVersion: number;
  readingSpeedWpm: number;
  defaultUnknownMinutes: number;
  allowedWeekdays: number[];
  earliestStart: string;
  latestEnd: string;
  minimumBlockMinutes: number;
  preferredBlockMinutes: number;
  maximumBlockMinutes: number;
  planningHorizonDays: number;
  minimumNoticeMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  maximumBlocksPerDay: number;
  destinationCalendarId?: string;
  availabilityCalendarIds: string[];
  timezone: string;
  defaultReminderMinutes?: number;
  allowConflicts: boolean;
}
```

---

# 14. Google OAuth Setup Guide

## 14.1 Important concept

OAuth removes setup burden for end users after the extension is published, but the maintainer still owns and configures the OAuth client.

End users should experience:

```text
Install extension
-> Click Connect Google Calendar
-> Choose Google account
-> Approve requested access
-> Use extension
```

They should not create their own Google Cloud project.

## 14.2 Development setup

1. Create a Google Cloud project.
2. Enable Google Calendar API.
3. Configure the OAuth consent screen.
4. Add development test users if the app is in testing mode.
5. Load the unpacked extension.
6. Copy the generated extension ID.
7. Create an OAuth client for a Chrome extension.
8. Associate it with the extension ID.
9. Add the client ID and scopes to `manifest.json`.
10. Test token acquisition with `chrome.identity.getAuthToken`.

## 14.3 Stable extension ID

During development and release, preserve a stable extension ID.

Options:
- Use the Chrome Web Store assigned ID for production.
- Use a manifest `key` for stable local development where appropriate.
- Never commit private signing material.

## 14.4 Scope strategy

Request only the narrowest scopes that support required behavior.

Potential needs:
- Read calendar availability
- Create and manage events created by the extension

Evaluate whether `calendar.events` plus narrower availability access can replace broader read-only access.

Document each scope in:
- README
- Privacy policy
- Store listing
- OAuth consent screen
- In-product permission explanation

## 14.5 Token handling

- Use Chrome Identity APIs.
- Do not store access tokens in IndexedDB.
- Do not log tokens.
- Remove cached tokens on disconnect.
- Handle 401 by clearing cached token and reauthenticating.
- Never request or store account passwords.
- Never commit tokens in fixtures.

## 14.6 OAuth verification considerations

Before public release:
- Complete OAuth consent screen details.
- Provide accurate application name and support email.
- Publish a privacy policy.
- Verify authorized domains where required.
- Ensure the Chrome Web Store listing and OAuth app identity match.
- Prepare a demonstration video if Google requests verification.
- Explain why each sensitive scope is necessary.
- Remove unused scopes before submission.

## 14.7 Development, staging, and production

Use separate Google Cloud projects:
- Development
- Optional staging
- Production

Benefits:
- Test-user isolation
- Safer credential rotation
- Reduced accidental quota mixing
- Cleaner verification

---

# 15. Security and Privacy Specification

## 15.1 Data classification

Local personal data:
- Saved URLs
- Titles
- Tags
- Notes
- Reading history

Google account data:
- Calendar free/busy information
- Event identifiers
- Created event details

Secrets:
- Release credentials
- Chrome Web Store API credentials
- Signing materials
- CI tokens

## 15.2 Privacy commitments

- No analytics by default.
- No advertising.
- No sale of data.
- No remote article upload.
- No behavioral profiling.
- No hidden telemetry.
- No remote code execution.
- No loading executable code from a CDN.
- No broad browsing-history collection.

## 15.3 Permission minimization

Likely permissions:
- storage
- identity
- alarms
- notifications
- activeTab
- contextMenus
- scripting

Host permissions:
- Google Calendar API endpoints
- Avoid `<all_urls>` unless content extraction requires it.
- Prefer `activeTab` and optional host permissions.

## 15.4 Threat model

Threats:
- Malicious page metadata
- XSS in extension pages
- OAuth token leakage
- Compromised dependency
- Supply-chain attack
- Calendar event injection
- URL containing secrets
- Insecure logging
- Overbroad permissions
- Rogue contributor
- Compromised release credential or maintainer account
- Malicious release artifact

Mitigations:
- Sanitize all external text.
- Never use `innerHTML` for metadata.
- Enforce strict CSP.
- Use dependency review.
- Require PR reviews for release files.
- Protect main branch.
- Use reproducible builds where possible.
- Create checksums for releases.
- Maintain security policy.
- Run local lint, type, test, audit, secret, and package checks before release.
- Keep dependencies minimal.

## 15.5 Sensitive URLs

URLs may contain:
- Session tokens
- Authentication codes
- Private document identifiers
- Email addresses
- Search terms

Mitigation:
- Strip known tracking and authentication parameters.
- Warn before storing suspicious query parameters.
- Never send saved URLs anywhere except Google Calendar when the user confirms an event.
- Offer a privacy mode that stores only title and manually edited URL.

---

# 16. Coding Style and Standards

## 16.1 Language

- TypeScript strict mode required.
- Avoid `any`.
- Use unknown plus validation for external data.
- Export domain types from dedicated modules.
- Prefer pure functions for scheduling logic.

## 16.2 Naming

- `camelCase` for variables and functions.
- `PascalCase` for components, classes, and types.
- `SCREAMING_SNAKE_CASE` only for immutable global constants.
- Boolean names begin with `is`, `has`, `can`, or `should`.
- Event handlers begin with `handle`.
- Callback props begin with `on`.

## 16.3 Functions

- Prefer functions under 40 lines.
- One clear responsibility.
- Avoid more than four parameters; use objects.
- Return typed results.
- Do not throw for expected domain outcomes.
- Use result types for recoverable errors.

Example:

```ts
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

## 16.4 Errors

- Use domain-specific error codes.
- Preserve safe technical context.
- Never expose tokens or raw API payloads to users.
- User messages must be actionable.

## 16.5 React

- Functional components only.
- Keep business logic outside components.
- Avoid effects for derived state.
- Use accessible native elements before custom widgets.
- Every modal must trap focus and restore it.
- Every icon-only button needs an accessible label.

## 16.6 Storage

- All persisted records include schema version.
- Migrations are forward-only and tested.
- Writes use transactions where possible.
- No direct storage calls from UI components.
- Storage APIs must be wrapped.

## 16.7 Calendar API

- Centralize API requests.
- Add timeout and retry only for safe idempotent requests.
- Event creation uses an idempotency mechanism.
- Do not blindly retry POST creation.
- Validate all date-time strings.
- Log only non-sensitive diagnostics.

## 16.8 Formatting

- Prettier is authoritative.
- ESLint must pass locally with zero warnings before every push.
- Import order is automated.
- Use LF line endings.
- UTF-8 files.
- Final newline required.

## 16.9 Comments

Comments explain:
- Why a non-obvious decision exists
- Security constraints
- Algorithm trade-offs
- External API limitations

Comments should not restate obvious code.

## 16.10 Documentation

Every exported domain service includes:
- Purpose
- Inputs
- Outputs
- Error behavior
- Side effects

Architectural decisions go in ADR files.

---

# 17. AI-Assisted Coding Guidelines

## 17.1 Purpose

AI coding tools may accelerate:
- Boilerplate
- Tests
- Refactoring
- Documentation
- Issue decomposition
- Type generation
- Mock data
- Review checklists

AI must not replace verification.

## 17.2 Mandatory rules

- AI-generated code is treated as untrusted until reviewed.
- Never paste OAuth tokens, personal calendar data, or private keys into an AI service.
- Never ask AI to generate dependencies without verifying licenses and maintenance.
- Run formatting, type checking, tests, and security checks after every AI-generated change.
- Keep prompts scoped to one issue.
- Require the AI to explain changed files and assumptions.
- Never merge code the maintainer cannot understand.
- Verify copied code does not violate licenses.
- Prefer official documentation over generated assumptions.
- Record significant AI-assisted decisions in PR descriptions.

## 17.3 Recommended prompt template

```text
Task:
Implement GitHub issue #123.

Context:
- Chrome extension using Manifest V3, React, TypeScript.
- No backend.
- No paid APIs.
- Calendar event creation requires explicit user confirmation.

Constraints:
- Follow docs/coding-standards.md.
- Do not add dependencies without justification.
- Do not modify OAuth scopes.
- Add unit tests.
- Keep changes within listed files unless necessary.

Acceptance criteria:
[Paste issue acceptance criteria]

Output:
1. Brief implementation plan
2. Files changed
3. Code changes
4. Tests added
5. Risks or assumptions
```

## 17.4 AI review checklist

- Does the code invent a nonexistent API?
- Does it use Manifest V2 patterns?
- Does it assume a persistent background page?
- Does it violate service-worker constraints?
- Does it add remote executable code?
- Does it broaden permissions?
- Does it mishandle time zones?
- Does it log private data?
- Does it skip error handling?
- Does it create events without confirmation?
- Does it add unnecessary dependencies?
- Are tests meaningful rather than superficial?

## 17.5 Commit discipline

AI-generated changes should still be:
- Small
- Reviewable
- Issue-linked
- Tested
- Reversible

Avoid "implement entire app" commits.

---

# 18. Git and GitHub Workflow

## 18.1 Branches

- `main`: protected, releasable
- `develop`: optional; avoid unless needed
- Feature branches:
  - `feat/123-proposal-editor`
  - `fix/245-oauth-refresh`
  - `docs/77-privacy-policy`
  - `chore/90-dependency-update`

A trunk-based approach with short-lived branches is recommended.

## 18.2 Commit format

Use Conventional Commits:

```text
feat(planner): add editable duration controls
fix(oauth): clear cached token after 401
test(calendar): cover stale proposal conflict
docs(contributing): add AI coding rules
```

## 18.3 Pull request requirements

Every PR must:
- Link an issue
- Explain user impact
- List changed behavior
- Include tests
- Include screenshots for UI changes
- Note permission or privacy impact
- Pass the documented local quality gates
- Avoid unrelated refactors

## 18.4 Branch protection

Require:
- Pull request before merge
- Status checks
- At least one review
- Conversation resolution
- Signed commits optional
- Linear history
- No direct pushes to main
- CODEOWNERS review for:
  - Manifest
  - OAuth
  - Release scripts
  - Privacy policy
  - Security-sensitive code

---

# 19. GitHub Issue System

## 19.1 Labels

Type:
- `type:bug`
- `type:feature`
- `type:enhancement`
- `type:docs`
- `type:test`
- `type:security`
- `type:refactor`
- `type:chore`

Area:
- `area:capture`
- `area:queue`
- `area:planner`
- `area:calendar`
- `area:oauth`
- `area:storage`
- `area:session`
- `area:ui`
- `area:release`

Priority:
- `priority:p0`
- `priority:p1`
- `priority:p2`
- `priority:p3`

Status:
- `status:needs-triage`
- `status:ready`
- `status:blocked`
- `status:in-progress`
- `status:needs-review`

Contribution:
- `good first issue`
- `help wanted`
- `needs-design`
- `needs-reproduction`

## 19.2 Bug issue form

```yaml
name: Bug report
description: Report reproducible incorrect behavior
title: "[Bug]: "
labels: ["type:bug", "status:needs-triage"]
body:
  - type: markdown
    attributes:
      value: Thanks for helping improve ReadSlot.
  - type: textarea
    id: summary
    attributes:
      label: Summary
      description: What went wrong?
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Steps to reproduce
      placeholder: |
        1. Open...
        2. Click...
        3. Observe...
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected behavior
    validations:
      required: true
  - type: input
    id: chrome
    attributes:
      label: Chrome version
    validations:
      required: true
  - type: input
    id: extension
    attributes:
      label: Extension version
    validations:
      required: true
  - type: dropdown
    id: oauth
    attributes:
      label: Google Calendar connected?
      options:
        - "Yes"
        - "No"
        - "Not relevant"
  - type: textarea
    id: logs
    attributes:
      label: Sanitized logs
      description: Remove tokens, calendar data, email addresses, and private URLs.
  - type: checkboxes
    id: privacy
    attributes:
      label: Privacy confirmation
      options:
        - label: I removed private URLs, tokens, and personal calendar information.
          required: true
```

## 19.3 Feature request form

```yaml
name: Feature request
description: Suggest a user-facing improvement
title: "[Feature]: "
labels: ["type:feature", "status:needs-triage"]
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem
      description: What user problem does this solve?
    validations:
      required: true
  - type: textarea
    id: proposal
    attributes:
      label: Proposed solution
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
  - type: dropdown
    id: principle
    attributes:
      label: Does it preserve explicit confirmation before calendar creation?
      options:
        - "Yes"
        - "Not applicable"
        - "No"
    validations:
      required: true
  - type: textarea
    id: privacy
    attributes:
      label: Privacy or permission impact
```

## 19.4 Issue-ready definition

An issue is ready when it includes:
- User story
- Problem statement
- Acceptance criteria
- Out-of-scope notes
- Design reference
- Test expectations
- Dependencies
- Risk notes
- Estimated size

---

# 20. Sprint and Development Plan

## Sprint cadence

Recommended:
- Two-week sprints
- One maintainer planning session
- Weekly backlog refinement
- End-of-sprint demo
- Retrospective
- Release every 2–4 sprints during early development

## Sizing

Use:
- XS: under half day
- S: 1 day
- M: 2–3 days
- L: 4–5 days
- XL: must be split

## Definition of Ready

- Clear user value
- Acceptance criteria
- No unresolved architecture dependency
- Privacy impact considered
- Test plan described
- Mock or wireframe available for UI work

## Definition of Done

- Code complete
- Tests pass
- Type checking passes
- Accessibility checked
- Security impact reviewed
- Documentation updated
- No new unapproved permissions
- PR reviewed
- Screenshots added where relevant
- Release notes entry added

---

## Sprint 0 — Foundation and governance

Goals:
- Establish repository, legal foundation, and development workflow.

Issues:
1. Fork or import original MIT repository.
2. Preserve license and attribution.
3. Add README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT.
4. Configure TypeScript, Vite, React, ESLint, Prettier.
5. Configure local quality-gate scripts.
6. Configure issue forms and PR template.
7. Add architecture decision records.
8. Add npm Dependabot and document local security checks.
9. Create initial Chrome Manifest V3 shell.
10. Document AI-assisted coding rules.

Exit criteria:
- Empty extension builds and loads.
- Local quality gates pass.
- Governance files exist.
- First tagged development release created.

---

## Sprint 1 — Capture and local storage

Goals:
- Save current pages safely and persist them.

Issues:
1. Define reading-item schema.
2. Implement IndexedDB adapter.
3. Build metadata extractor.
4. Add toolbar capture.
5. Add context-menu capture.
6. Add keyboard shortcut.
7. Implement URL normalization.
8. Implement duplicate detection.
9. Add save toast.
10. Add storage migration framework.

Exit criteria:
- User can save supported pages.
- Duplicate behavior is clear.
- Queue survives restart.
- Tests cover storage and normalization.

---

## Sprint 2 — Queue interface

Goals:
- Provide a usable local reading backlog.

Issues:
1. Build queue page.
2. Add search.
3. Add filters.
4. Add sort.
5. Add priority.
6. Add tags.
7. Add archive and trash.
8. Add bulk actions.
9. Add accessible keyboard navigation.
10. Add import/export JSON.

Exit criteria:
- Queue is usable for at least 500 items.
- Search responds quickly.
- Item states are correct.
- Accessibility smoke test passes.

---

## Sprint 3 — Duration estimation

Goals:
- Estimate effort without paid services.

Issues:
1. Add article word counting.
2. Add reading-speed setting.
3. Add Readability extraction.
4. Add YouTube duration extraction.
5. Add PDF page-count estimation.
6. Add unknown-content fallback.
7. Add confidence indicator.
8. Add manual duration override.
9. Add estimate tests.
10. Add large-content safeguards.

Exit criteria:
- Estimates exist for major content types.
- User can override all estimates.
- No remote paid service is used.

---

## Sprint 4 — OAuth and calendar connectivity

Goals:
- Connect Google Calendar safely.

Issues:
1. Create development Google Cloud project.
2. Add OAuth manifest configuration.
3. Implement connect flow.
4. Implement disconnect flow.
5. Handle token expiry.
6. List calendars.
7. Select destination calendar.
8. Select availability calendars.
9. Add permission explanation UI.
10. Add privacy policy draft.

Exit criteria:
- User can connect and disconnect.
- Tokens are not manually persisted.
- Calendar list loads.
- Unauthorized and denied flows are tested.

---

## Sprint 5 — Availability and suggestion engine

Goals:
- Generate candidate slots without creating events.

Issues:
1. Implement FreeBusy client.
2. Normalize busy intervals.
3. Implement user scheduling preferences.
4. Generate candidate windows.
5. Rank suggestions.
6. Add suggestion explanations.
7. Add no-availability state.
8. Add stale-proposal expiry.
9. Add time-zone tests.
10. Add scheduling property tests.

Exit criteria:
- Three useful suggestions are generated.
- No event creation occurs.
- DST and time-zone cases pass.

---

## Sprint 6 — Proposal editor and explicit confirmation

Goals:
- Let the user review and modify suggestions.

Issues:
1. Build planner page.
2. Build proposal editor.
3. Edit date and time.
4. Edit duration.
5. Add/remove items.
6. Change reminders.
7. Select calendar.
8. Add conflict warning.
9. Add availability recheck.
10. Add explicit confirmation control.

Exit criteria:
- User can fully edit a proposal.
- Calendar creation is impossible without confirmation.
- Stale conflict is caught.

---

## Sprint 7 — Calendar event creation and synchronization

Goals:
- Create and track approved sessions.

Issues:
1. Implement event creation.
2. Add idempotency protection.
3. Store event mapping.
4. Format event description.
5. Handle read-only calendars.
6. Detect external move.
7. Detect external deletion.
8. Add event cancellation.
9. Add retry policy.
10. Add integration tests.

Exit criteria:
- One approved action creates one event.
- Duplicate clicks do not duplicate events.
- External changes are handled predictably.

---

## Sprint 8 — Reading session and review

Goals:
- Support actual reading and completion.

Issues:
1. Build session page.
2. Add item-opening controls.
3. Add timer.
4. Add completion marking.
5. Add skip/archive actions.
6. Return unfinished items to queue.
7. Add session-end alarm.
8. Add review notification.
9. Handle missed reviews.
10. Add session tests.

Exit criteria:
- Scheduled items move through session states.
- Partial completion works.
- Unfinished items are preserved.

---

## Sprint 9 — Weekly planner and queue health

Goals:
- Help users plan multiple sessions.

Issues:
1. Add queue-health metrics.
2. Add weekly planning dashboard.
3. Add light/balanced/aggressive plans.
4. Add bulk confirmation review.
5. Add notification preference.
6. Add old-item cleanup suggestions.
7. Add charts without tracking.
8. Add streak optionality.
9. Add planner tests.
10. Add accessibility review.

Exit criteria:
- Weekly plan is understandable.
- Every event still requires final confirmation.
- Metrics are local.

---

## Sprint 10 — Chrome Web Store readiness

Goals:
- Prepare production publication.

Issues:
1. Finalize icons.
2. Create screenshots.
3. Write store description.
4. Finalize privacy policy.
5. Audit permissions.
6. Configure production OAuth.
7. Run security review.
8. Build reproducible release zip.
9. Add release checklist.
10. Submit private/unlisted test version.

Exit criteria:
- Store package validates.
- Privacy disclosures match behavior.
- Production OAuth works.
- No secrets are included.

---

## Sprint 11 — Public beta

Goals:
- Test with real users.

Issues:
1. Recruit beta users.
2. Add feedback link.
3. Triage installation issues.
4. Monitor OAuth failures without telemetry.
5. Collect voluntary feedback.
6. Fix critical bugs.
7. Improve onboarding.
8. Update FAQ.
9. Publish beta release notes.
10. Decide public listing readiness.

Exit criteria:
- No P0 or P1 defects.
- OAuth onboarding is understandable.
- Calendar trust concerns are addressed.

---

# 21. Testing Strategy

## 21.1 Test pyramid

- Unit tests: domain and algorithm logic
- Integration tests: storage, OAuth wrappers, API adapters
- Component tests: queue, planner, settings
- End-to-end tests: extension workflows
- Manual tests: Chrome and real calendar behavior
- Security tests: permission, CSP, dependency, data leakage

## 21.2 Unit test areas

- URL normalization
- Duplicate detection
- Reading-time estimation
- Interval merging
- Free-slot generation
- Suggestion ranking
- Proposal expiry
- State transitions
- Time-zone conversion
- Event formatting
- Data migration

## 21.3 Property-based tests

Useful for:
- Interval merging
- Suggestion windows
- No-overlap invariants
- Duration fitting
- Time-zone boundaries

Invariants:
- Suggested block never has negative duration.
- Suggested block stays inside allowed hours.
- Suggested block does not overlap known busy intervals.
- Confirmed event includes only selected items.
- No item appears in two active sessions.

## 21.4 Integration tests

Mock:
- Successful OAuth
- Denied OAuth
- Expired token
- 401
- 403
- 429
- 500
- Partial FreeBusy response
- Event creation timeout
- Duplicate create response
- Calendar removed

## 21.5 E2E flows

1. Save article.
2. Open queue.
3. Generate suggestion.
4. Edit duration.
5. Confirm event.
6. Complete one item.
7. Return unfinished item.
8. Disconnect OAuth.

## 21.6 Manual browser matrix

- Latest stable Chrome
- Chrome Beta
- Edge
- Brave
- Chromium where possible

Operating systems:
- Windows
- macOS
- Linux

## 21.7 Accessibility testing

- Keyboard-only navigation
- Screen reader smoke test
- 200% zoom
- High contrast
- Reduced motion
- Focus order
- Modal focus trapping
- Form error association
- Color-independent status indicators

## 21.8 Performance budgets

- Popup interactive under 500 ms on ordinary hardware.
- Queue initial render under 1 second for 1,000 items.
- Extension package under 5 MB preferred.
- No long-running service-worker loops.
- Metadata extraction capped by timeout.
- Calendar suggestion generation under 2 seconds after API response.

## 21.9 Security testing

- CSP validation
- No eval
- No remote scripts
- HTML injection tests
- URL sanitization tests
- Token-log scan
- Dependency audit
- Permission audit
- Build artifact inspection
- Secret scan

---

# 22. Chrome Web Store Publishing Guide

## 22.1 Prerequisites

- Chrome Web Store developer account
- Verified developer email
- Production-ready extension package
- Privacy policy
- Store assets
- OAuth production configuration
- Support contact
- GitHub repository
- Release notes

## 22.2 Package requirements

- Manifest at archive root
- No source maps containing secrets
- No `.env`
- No test data
- No Git history
- No development-only permissions
- No localhost endpoints
- No remote executable code
- Correct version number
- Production OAuth client ID
- Valid icons

## 22.3 Store listing assets

Prepare:
- Extension name
- Short description
- Detailed description
- 128x128 icon
- Screenshots
- Promotional tile if desired
- Privacy policy
- Support URL
- Homepage URL
- Category
- Language
- Single-purpose explanation

## 22.4 Single-purpose statement

Suggested:

> ReadSlot saves web content and helps users schedule confirmed reading sessions in Google Calendar.

## 22.5 Permission explanations

Examples:

`identity`  
Used to let the user connect their Google account through Chrome's OAuth flow.

`storage`  
Used to store the reading queue and preferences locally.

`activeTab`  
Used only when the user saves the current page.

`alarms`  
Used to trigger session review at the end of a scheduled reading block.

`notifications`  
Used for user-configured reminders and review prompts.

## 22.6 Privacy disclosures

Disclose:
- URLs and titles are stored locally.
- Calendar availability is requested from Google.
- Confirmed reading events are written to the selected calendar.
- No data is sold.
- No advertising.
- No analytics by default.
- No server operated by the project.

## 22.7 Review risk reducers

- Minimize permissions.
- Explain every permission.
- Match behavior to listing.
- Avoid vague descriptions.
- Include a functioning privacy policy.
- Use a stable OAuth app identity.
- Ensure all features work in review.
- Avoid hidden features.
- Provide test instructions if needed.
- Keep onboarding straightforward.

## 22.8 Release process

1. Update version.
2. Update changelog.
3. Run the full local quality gate.
4. Run manual OAuth test.
5. Run permission diff.
6. Build production package.
7. Inspect zip contents.
8. Generate checksum.
9. Create Git tag.
10. Create GitHub release.
11. Upload to Chrome Web Store.
12. Submit for review.
13. Monitor review email.
14. Publish after approval.
15. Verify installation from store.

---

# 23. Open-Source Strategy

## 23.1 Recommendation

Keep it open source.

Reasons:
- The foundation repository is MIT licensed.
- Open code improves trust for a calendar-connected extension.
- Privacy claims can be inspected.
- Contributors can add browser support and fix edge cases.
- It aligns with a free personal project.
- Users can self-host development credentials.
- Public issue tracking improves transparency.
- It reduces abandonment risk.

## 23.2 Recommended license

Use MIT to remain compatible with the upstream project.

Required:
- Preserve upstream license.
- Preserve copyright notices.
- Add attribution in README and NOTICE.
- Clearly describe major changes.

Example:

> ReadSlot is based on Reading Block by Zara Zhang, licensed under the MIT License. This project substantially modifies the scheduling workflow by replacing automatic event creation with user-confirmed suggestions.

## 23.3 What should remain private

Open source does not mean every operational asset is public.

Keep private:
- Chrome Web Store API credentials
- Future release-automation credentials
- OAuth verification correspondence
- Private signing keys
- Personal test calendars
- Screenshots containing personal data
- Security reports before remediation
- Maintainer account recovery information

## 23.4 Governance

Initial model:
- Benevolent maintainer
- Public roadmap
- Public issues
- Required review for security-sensitive changes
- Contributor license agreement not necessary for MIT at small scale
- Developer Certificate of Origin optional

## 23.5 Contribution boundaries

Accept:
- Bug fixes
- Accessibility improvements
- Browser compatibility
- Tests
- Documentation
- Local-only features

Require deeper review:
- New OAuth scopes
- Analytics
- External services
- Remote code
- New host permissions
- Cloud sync
- Monetization
- Automatic event creation

## 23.6 Sustainability

Even free projects need maintenance.

Sustainable options:
- GitHub Sponsors, optional
- Open Collective, optional
- Contributor rotation
- Clear maintenance status
- Automated dependency updates
- Limited scope
- Scheduled release cadence

Do not introduce monetization unless the product direction changes.

---

# 24. Documentation Set

Required:
- README.md
- CONTRIBUTING.md
- SECURITY.md
- CODE_OF_CONDUCT.md
- PRIVACY.md
- CHANGELOG.md
- docs/architecture.md
- docs/oauth.md
- docs/testing.md
- docs/release.md
- docs/ai-development.md
- docs/troubleshooting.md
- docs/data-model.md
- docs/scheduling-algorithm.md

README sections:
- What it does
- Screenshots
- Privacy
- Installation
- Development
- OAuth setup
- Contributing
- Attribution
- License

---

# 25. Local Verification and Release Specification

GitHub Actions are intentionally disabled during the current development phase. Before every
push, run:

- Install with lockfile
- Type check
- Lint
- Format check
- Unit tests
- Component tests
- Build
- Manifest validation
- Permission diff
- Secret scan
- Dependency review
- E2E tests

## Manual release workflow

Before creating a version tag:
- Verify tag matches manifest
- Build production zip
- Generate SHA-256 checksum
- Inspect the artifact and run the manual browser/OAuth checklist
- Create the GitHub release and attach artifacts manually if desired
- Never publish to the Chrome Web Store without maintainer approval

---

# 26. Release and Versioning

Use Semantic Versioning.

Examples:
- `0.1.0`: internal prototype
- `0.5.0`: private beta
- `0.9.0`: public beta
- `1.0.0`: stable

Chrome manifest version must contain one to four dot-separated integers.

Release channels:
- Development
- Beta
- Stable

Changelog categories:
- Added
- Changed
- Fixed
- Security
- Deprecated
- Removed

---

# 27. Observability Without Tracking

Because the project avoids analytics:

Use local diagnostics:
- Last successful calendar sync
- Last error code
- Storage usage
- Extension version
- OAuth state
- Sanitized event-operation log
- Export diagnostics button

Diagnostics must:
- Exclude tokens
- Exclude calendar event content
- Exclude saved URLs by default
- Require user action to export

---

# 28. Product Analytics Without Telemetry

For personal evaluation, show local-only metrics:
- Items saved
- Items scheduled
- Items completed
- Completion rate
- Queue duration
- Oldest item age
- Sessions per week
- Average planned duration
- Average completion percentage

Users can optionally export anonymized aggregate metrics manually for research.

---

# 29. Risk Register

## High risks

### OAuth verification delays

Mitigation:
- Narrow scopes
- Accurate privacy documentation
- Early production OAuth setup
- Clear demo

### Chrome Web Store rejection

Mitigation:
- Permission minimization
- Single-purpose design
- Complete privacy disclosure
- Manual pre-submission audit

### Time-zone defects

Mitigation:
- Store ISO timestamps
- Use IANA zones
- Extensive tests
- Avoid hand-written date math

### Duplicate events

Mitigation:
- Idempotency keys
- Disable button after click
- Confirm response before retry

### Scope creep

Mitigation:
- MVP gates
- Non-goals
- Issue review
- No paid AI features

## Medium risks

- Storage migration corruption
- Large queue performance
- Unmaintained dependencies
- Browser incompatibility
- Contributor security mistakes
- Private URLs appearing in events

---

# 30. Acceptance Criteria for Version 1.0

A release is ready when:

- User can save a page in one action.
- Queue persists locally.
- Duplicate pages are detected.
- User can connect Google Calendar.
- User can configure available hours.
- Extension generates at least three candidate blocks when possible.
- Candidate generation creates no calendar events.
- User can edit date, time, duration, reminders, and items.
- Extension rechecks availability.
- Event is created only after explicit confirmation.
- Duplicate clicks do not create duplicate events.
- Session review supports partial completion.
- Unfinished items return to queue.
- User can disconnect Google Calendar.
- User can export and delete local data.
- Privacy policy accurately describes behavior.
- Chrome Web Store package passes review requirements.
- All P0 and P1 tests pass.
- No known critical vulnerabilities exist.

---

# 31. First 25 GitHub Issues

1. Repository bootstrap and upstream attribution
2. Add MIT license and NOTICE
3. Configure TypeScript strict mode
4. Add Vite extension build
5. Add Manifest V3 validation
6. Define reading item schema
7. Implement IndexedDB adapter
8. Add schema migration system
9. Implement current-tab capture
10. Implement context-menu capture
11. Add URL normalization
12. Add duplicate detection
13. Build save toast
14. Build queue page shell
15. Add queue search
16. Add priority editing
17. Add archive and trash
18. Implement article duration estimation
19. Implement manual duration override
20. Add OAuth connection UI
21. Implement Chrome Identity token flow
22. List user calendars
23. Add availability preferences
24. Implement FreeBusy adapter
25. Generate three non-booking slot suggestions

---

# 32. Final Recommendation

Build ReadSlot as an open-source, local-first fork or derivative of Reading Block under MIT.

Keep the first public release focused on:

1. Capture
2. Queue
3. Calendar connection
4. Suggested blocks
5. Explicit confirmation
6. Session review

Do not add AI, summaries, cloud accounts, or collaborative features before the basic loop proves useful.

The project's trust advantage should be visible everywhere:

- Source code is public.
- Data remains local.
- Permissions are narrow.
- Calendar actions are explicit.
- The extension explains its decisions.
- Users can disconnect, export, and delete everything.

That is a strong and credible product position for a free Chrome extension.

---

# 33. Official Reference Links

- Chrome Web Store documentation: https://developer.chrome.com/docs/webstore
- Chrome Web Store program policies: https://developer.chrome.com/docs/webstore/program-policies
- Manifest V3 overview: https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
- Chrome extension OAuth guide: https://developer.chrome.com/docs/extensions/how-to/integrate/oauth
- Chrome Identity API: https://developer.chrome.com/docs/extensions/reference/api/identity
- OAuth manifest configuration: https://developer.chrome.com/docs/extensions/reference/manifest/oauth2
- Google OAuth 2.0: https://developers.google.com/identity/protocols/oauth2
- Google OAuth scopes: https://developers.google.com/identity/protocols/oauth2/scopes
- GitHub issue forms: https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms
- Original Reading Block repository: https://github.com/zarazhangrui/reading-block
