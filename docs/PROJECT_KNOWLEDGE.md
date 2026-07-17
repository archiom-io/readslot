# ReadSlot Project Knowledge

**Purpose:** Living context for maintainers, contributors, and coding agents  
**Last updated:** 2026-07-17
**Current phase:** Version 0.9.0 beta implementation; real OAuth verification and final release packaging pending

## 1. Project identity

- **Product name:** ReadSlot
- **Tagline:** Schedule what you save.
- **Repository slug:** `readslot`
- **Product type:** Free, local-first Chrome/Chromium extension
- **License direction:** MIT
- **Upstream foundation:** Reading Block by Zara Zhang (`zarazhangrui/reading-block`), MIT licensed
- **Canonical specification:** [`ReadSlot_Complete_Blueprint.md`](ReadSlot_Complete_Blueprint.md)

Use **ReadSlot** in product copy, UI labels, package metadata, documentation, OAuth configuration, and store listings. Use **Reading Block** only when referring to the upstream project or preserving its legal attribution.

ReadSlot replaced the former working name on 2026-07-13 because it communicates the reading-plus-time-slot behavior directly and has fewer obvious software collisions in a preliminary search. Formal Chrome Web Store, GitHub, domain, and trademark clearance remains a publication gate.

## 2. Product in one paragraph

ReadSlot turns saved web content into intentional reading time. A user saves an article, video, PDF, document, or repository; ReadSlot estimates the effort, keeps the item in a local queue, checks Google Calendar availability, and suggests suitable reading blocks. The user can edit a proposal, and ReadSlot creates a calendar event only after explicit confirmation. After the session, completed items leave the queue and unfinished items can return to it.

Core promise:

> Save now. Choose a suggested time. Actually read it.

## 3. Current repository state

This repository now contains the ReadSlot Manifest V3 application, its domain/storage/Calendar
adapters, React queue/planner/session/settings surfaces, unit/property/E2E tests, local quality gates,
store assets, release scripts, and project documentation. `ReadSlot_Complete_Blueprint.md` remains
the full product specification; this file records the implemented baseline.

The clean TypeScript foundation is settled in ADR 0001. The upstream source was not imported
wholesale. The remaining external checkpoint is a Chrome Extension OAuth client ID for real
Calendar verification; production packaging also requires the Store extension's OAuth client ID.

## 4. Decision hierarchy

When documents or implementation details disagree, use this order:

1. User-approved decisions and accepted architecture decision records (ADRs)
2. Security, privacy, and human-confirmation invariants in this file
3. `ReadSlot_Complete_Blueprint.md`
4. Issue acceptance criteria
5. Existing implementation behavior

Record a material change as an ADR and update both this file and the blueprint section it supersedes. Do not silently let code become the only record of a product or security decision.

## 5. Non-negotiable product invariants

1. **Human confirmation:** Suggestions may be automatic; calendar event creation may not be.
2. **Local first:** Saved content and reading history remain on-device unless the user explicitly exports or confirms inclusion in a calendar event.
3. **No backend for the core product:** The first release talks directly to local browser APIs and Google Calendar.
4. **No paid API dependency:** Capture, estimation, planning, and scheduling must work without a paid service or LLM.
5. **Least privilege:** New browser permissions, host access, OAuth scopes, or external services require explicit review and documentation.
6. **Explainable scheduling:** Each proposed time slot states why it was selected.
7. **Reversible behavior:** Users can cancel proposals, undo saves, and control removal of ReadSlot-created calendar events.
8. **Conflict safety:** Recheck availability within 30 seconds before creation. A known conflict requires a second confirmation.
9. **Idempotency:** One confirmed user action must create at most one calendar event.
10. **No hidden telemetry:** Diagnostics and product metrics are local by default and exported only by explicit user action.

## 6. Scope boundary

### Version 1 loop

1. Capture a page.
2. Normalize and deduplicate its URL.
3. Store it in a local reading queue.
4. Estimate reading or viewing duration.
5. Connect to Google Calendar.
6. Read availability and generate at least three candidates when possible.
7. Let the user edit and explicitly confirm a proposal.
8. Create exactly one event and track its local session.
9. Review completion and return unfinished content to the queue.
10. Export or delete local data on demand.

### Deliberately outside version 1

- AI summaries or chat
- Cloud accounts or sync
- Collaboration or team calendars
- Mobile applications
- Automatic booking or rescheduling
- Paid subscriptions
- Full note-taking or knowledge-base features
- Browser-history analysis

## 7. Architecture baseline

ReadSlot is a Manifest V3 browser extension with a non-persistent background service worker.

```text
Content script / popup / extension pages
                  |
                  v
       Background service worker
          |       |       |
          v       v       v
      IndexedDB  Chrome   Google Calendar API
                 APIs
```

Primary components:

- **Background service worker:** message routing, storage orchestration, OAuth, Calendar API calls, proposal generation, alarms, migrations, and idempotent event creation.
- **Content script:** safe metadata/readable-text extraction, content detection, selected-text capture, and save feedback.
- **Popup:** non-persisting current-page preview, explicit save-for-later, duplicate status, Undo,
  queue navigation, and item-scoped planner handoff.
- **Queue page:** search, filters, sorting, editing, bulk actions, import/export, and local statistics.
- **Planner page:** candidate review, proposal editing, conflict checks, and explicit confirmation.
- **Session page:** item opening, timer, completion, and end-of-session review.
- **Options page:** Calendar connection, schedule preferences, privacy controls, diagnostics, import/export, and reset.

Keep domain logic independent of Chrome and Google APIs. Put browser storage, identity, and calendar calls behind typed adapters so scheduling and state transitions can be tested without an extension runtime.

## 8. Technology baseline

The implementation uses:

- TypeScript 6 in strict mode on Node 24 and pnpm 11
- React and Vite
- Manifest V3
- IndexedDB with Dexie for queue/domain data and forward migrations
- `chrome.storage.local` for small settings
- `chrome.storage.session` for ephemeral state
- Zod at untrusted data boundaries
- date-fns plus native `Intl` for date presentation
- Vitest, Testing Library, fake IndexedDB, and fast-check
- Playwright with mocked Chrome/Calendar boundaries for end-to-end tests
- ESLint and Prettier
- Local `pnpm check` and Playwright verification before every push
- Optional Docker tooling pins Node 24 and pnpm 11.7.0 for reproducible local checks and packaging
- Dependabot for npm dependency updates; GitHub Actions are intentionally disabled for now

React reducer/local component state is used instead of Zustand. Vite builds the background and
extension pages as ES modules plus a separate isolated IIFE content bundle. Any new dependency
must earn its place through a documented use case, maintenance check, license check, and
bundle/permission impact review.

## 9. Domain model and state rules

Core entities:

- **ReadingItem:** captured content, estimate, priority, tags, lifecycle timestamps, and local status.
- **Proposal:** one or more item IDs plus a candidate time, score, explanation, expiry, and validation state.
- **ReadingSession:** the link between selected items and one confirmed Calendar event.
- **Settings:** schedule boundaries, duration preferences, calendars, timezone, reminders, and conflict policy.

Reading-item states:

```text
queued -> proposed -> scheduled -> in_progress -> completed
   |          |           |             |
   +----------+-----------+-------------+-> archived
   +--------------------------------------> deleted
```

Important rules:

- Opening the toolbar popup never writes to the queue. Toolbar capture requires an explicit Save
  for later or Save & choose time action; context-menu and keyboard capture remain immediate.
- An item can belong to only one active confirmed session.
- A proposal expires after 24 hours by default and must be revalidated if stale.
- Deletion is soft first; trash retention defaults to 30 days.
- Deleting an item does not silently delete its Calendar event.
- Unfinished session items can return to `queued`.
- Store timestamps as ISO strings and use an IANA timezone in settings.

The full transition table and TypeScript interface drafts are in blueprint sections 7 and 13.

## 10. Data and trust boundaries

### Local personal data

Saved URLs, titles, notes, tags, estimates, reading history, and settings.

### Google data

Free/busy results, selected calendar identifiers, created event details, and event IDs.

### Secrets

OAuth/release credentials, signing material, CI tokens, and store publishing credentials. These never belong in source control, fixtures, diagnostics, screenshots, or AI prompts.

Required protections:

- Sanitize page metadata and render it as text, never trusted HTML.
- Use a strict extension content security policy and no remote executable code.
- Never persist or log Google access tokens manually.
- When the user chooses **Disconnect and revoke access**, send the current token directly to
  Google's OAuth revocation endpoint, clear Chrome's cached token, and retain only a local
  disconnected marker.
- Strip known tracking/authentication parameters and warn about suspicious URLs.
- Do not include a saved URL in Calendar until the user confirms the event.
- Diagnostics exclude tokens, calendar contents, and saved URLs by default.

## 11. Calendar creation contract

Calendar event creation is the highest-risk workflow. Its application service should require all of the following inputs or checks:

- A user-confirmed proposal
- A still-valid OAuth connection
- A writable destination calendar
- Valid item states
- Current timezone and valid start/end/duration
- A free/busy recheck no older than 30 seconds
- Explicit override if a conflict remains
- An idempotency key persisted before or atomically with the creation attempt

The service must persist the Google event ID, calendar ID, local session ID, creation timestamp, and last-sync timestamp. Retries must reconcile an uncertain prior response before issuing another create request.

Calendar lookup outcomes are intentionally distinct: `404` means the deterministic event does not
exist, `409` means creation collided with an existing deterministic event and must be reconciled,
and `5xx` remains a retryable outage. Never issue `events.insert` after an inconclusive initial
lookup. A timed-out or collided insert is successful only when a follow-up lookup returns the
expected event.

Session review is a single IndexedDB transaction. Completed and skipped IDs must be disjoint and
belong to the session; a completed session cannot be reviewed again; and missing or stale items
must leave every item and the session unchanged.

## 12. Suggested implementation sequence

Start with Sprint 0 in the blueprint. A practical first delivery chain is:

1. Decide whether to fork/import upstream code or bootstrap cleanly while preserving MIT attribution.
2. Add license and attribution files before importing upstream code.
3. Bootstrap TypeScript, Vite, React, Manifest V3, formatting, tests, and local quality gates.
4. Define domain types and runtime schemas without UI dependencies.
5. Implement storage adapters and migrations.
6. Implement capture, URL normalization, and duplicate detection.
7. Build the queue before integrating OAuth.
8. Implement duration estimation.
9. Add Calendar identity and read-only availability flows.
10. Build the pure suggestion engine and property tests.
11. Add proposal editing and confirmation.
12. Add idempotent Calendar creation and session review.

Avoid implementing the entire roadmap in one change. Each issue should have acceptance criteria, tests, privacy impact, and a narrow file scope.

## 13. Verification gates

Every implementation change should run the checks relevant to the files touched. The eventual standard gate is:

- Format check
- Type check
- Lint
- Unit tests
- Component tests where UI changed
- Build and manifest validation
- End-to-end tests for critical flows
- Permission and OAuth-scope diff
- Secret scan and dependency review
- Accessibility check for interactive UI

Critical property/integration tests include:

- Suggestions never overlap normalized busy intervals.
- Generated blocks obey notice, working-hour, buffer, duration, and daily-limit settings.
- Timezone and DST transitions preserve intended instants and displayed local time.
- Duplicate confirmation/retry creates at most one Calendar event.
- Stale proposals cannot bypass revalidation.
- Storage migrations preserve existing user data or fail safely.

## 14. Open decisions before implementation

Resolved implementation choices:

- Clean TypeScript bootstrap with MIT attribution
- Node 24, pnpm 11, React reducers/local state
- OAuth scopes: Calendar event management, event FreeBusy, and read-only Calendar List
- On-demand `activeTab` plus `scripting`; never `<all_urls>`
- Multi-page Vite build plus a separately bundled isolated extraction script
- Chrome-first version 1 with JSON, CSV, Markdown, bookmark HTML, and URL-list interchange

Still external or post-v1:

- Development and production Chrome Extension OAuth client IDs
- Chrome Web Store reserved extension ID, repository/support URL, and account-level submission
- Broader Firefox/WebExtension compatibility

Resolve decisions at the last responsible moment, record material ones in `docs/adr/`, and update this list.

## 15. Definition of a healthy next handoff

A development handoff is complete when it states:

- What user-visible behavior changed
- Which files and domain contracts changed
- What was verified and the exact result
- Any new permission, data, privacy, or security impact
- Remaining risks and open decisions
- The next smallest useful issue

Keep this document short enough to scan. Put detailed specifications in the blueprint or focused files under `docs/`, then link them here.
