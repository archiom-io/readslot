import { expect, test, type Page } from "@playwright/test";

const now = "2026-07-14T12:00:00.000Z";

const installChromeMock = async (page: Page) => {
  await page.addInitScript(
    ({ now }) => {
      const item = {
        schemaVersion: 1,
        id: "item-1",
        originalUrl: "https://example.com/focused-reading",
        canonicalUrl: "https://example.com/focused-reading",
        title: "A practical guide to focused reading",
        domain: "example.com",
        contentType: "article",
        estimatedMinutes: 30,
        estimateConfidence: "high",
        priority: "high",
        tags: ["architecture"],
        status: "queued",
        createdAt: now,
        updatedAt: now
      };
      const proposal = {
        schemaVersion: 1,
        id: "proposal-1",
        itemIds: [item.id],
        calendarId: "primary",
        title: "ReadSlot — 1 item",
        description: "1. A practical guide to focused reading",
        suggestedStart: "2026-07-15T12:00:00.000Z",
        suggestedEnd: "2026-07-15T12:30:00.000Z",
        durationMinutes: 30,
        reminderMinutes: 10,
        score: 82,
        explanation: ["Fits your preferred 30-minute window.", "Includes 1 high-priority item."],
        confidence: "high",
        conflictStatus: "clear",
        transparency: "opaque",
        status: "ready",
        generatedAt: now,
        expiresAt: "2026-07-15T12:00:00.000Z"
      };
      const secondItem = {
        ...item,
        id: "item-2",
        originalUrl: "https://example.com/unfinished-reading",
        canonicalUrl: "https://example.com/unfinished-reading",
        title: "An unfinished reading item"
      };
      const session = {
        schemaVersion: 1,
        id: "session-1",
        proposalId: proposal.id,
        itemIds: [item.id, secondItem.id],
        completedItemIds: [],
        skippedItemIds: [],
        calendarId: "primary",
        calendarEventId: "event-1",
        start: "2026-07-15T12:00:00.000Z",
        end: "2026-07-15T12:30:00.000Z",
        status: "scheduled",
        createdAt: now,
        updatedAt: now,
        lastSyncedAt: now
      };
      const settings = {
        schemaVersion: 1,
        readingSpeedWpm: 220,
        defaultUnknownMinutes: 15,
        allowedWeekdays: [1, 2, 3, 4, 5],
        earliestStart: "18:00",
        latestEnd: "21:00",
        minimumBlockMinutes: 15,
        preferredBlockMinutes: 30,
        maximumBlockMinutes: 90,
        planningHorizonDays: 14,
        minimumNoticeMinutes: 60,
        bufferBeforeMinutes: 10,
        bufferAfterMinutes: 10,
        maximumBlocksPerDay: 1,
        availabilityCalendarIds: ["primary"],
        destinationCalendarId: "primary",
        timezone: "UTC",
        defaultReminderMinutes: 10,
        allowConflicts: false,
        ignoreAllDayEvents: false,
        respectDeclinedEvents: true,
        treatTentativeAsBusy: true,
        weeklyPlanningNotification: false,
        privacyMode: false
      };
      const testState: { reviewPayload?: unknown } = {};
      Object.defineProperty(window, "__readslotE2E", { value: testState, configurable: true });
      const successful = (value: unknown) => ({ ok: true, value });
      const chromeTarget = window.chrome ?? {};
      Object.defineProperty(chromeTarget, "runtime", {
        value: {
          getURL: (path: string) => `http://127.0.0.1:4173/${path}`,
          sendMessage: (message: { type: string; payload?: unknown }) => {
            if (message.type === "items.list") return successful([item, secondItem]);
            if (message.type === "dashboard.stats")
              return successful({
                totalItems: 1,
                queuedItems: 1,
                scheduledItems: 0,
                completedItems: 0,
                queueMinutes: 30,
                completedSessions: 0
              });
            if (message.type === "proposals.list" || message.type === "suggestions.generate")
              return successful([proposal]);
            if (message.type === "calendar.status")
              return successful({ configured: true, connected: true });
            if (message.type === "calendar.list")
              return successful([
                {
                  id: "primary",
                  summary: "Primary calendar",
                  primary: true,
                  accessRole: "owner"
                }
              ]);
            if (message.type === "settings.get") return successful(settings);
            if (message.type === "weekly.plan")
              return successful([
                {
                  id: "light",
                  label: "Light",
                  blocks: 1,
                  minutes: 30,
                  description: "A gentle start."
                }
              ]);
            if (message.type === "proposals.confirm") return successful({ id: "session-1" });
            if (message.type === "sessions.list") return successful([session]);
            if (message.type === "sessions.review") {
              testState.reviewPayload = message.payload;
              return successful({ ...session, status: "completed" });
            }
            return successful(undefined);
          }
        },
        configurable: true
      });
      if (!window.chrome)
        Object.defineProperty(window, "chrome", { value: chromeTarget, configurable: true });
    },
    { now }
  );
};

test("queue renders local reading data and primary actions", async ({ page }) => {
  await installChromeMock(page);
  await page.goto("/queue.html");
  await expect(page.getByRole("heading", { name: "Make later happen." })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "A practical guide to focused reading" })
  ).toBeVisible();
  await expect(page.getByText("30 min").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Plan reading time" })).toBeVisible();
  await page.screenshot({ path: "store-assets/screenshots/queue.png" });
});

test("planner keeps event creation behind explicit confirmation", async ({ page }) => {
  await installChromeMock(page);
  await page.goto("/planner.html");
  await expect(page.getByRole("link", { name: "ReadSlot home" })).toBeVisible();
  await expect(
    page.getByText("Nothing is added to Calendar until you press the confirmation button.")
  ).toBeVisible();
  await page.screenshot({ path: "store-assets/screenshots/planner.png" });
  await page.getByRole("button", { name: "Create reading block" }).click();
  await expect(
    page.getByText("Reading block created. Your items are now scheduled.")
  ).toBeVisible();
  await page.screenshot({ path: "store-assets/screenshots/calendar-confirmed.png" });
});

test("toolbar popup previews first and saves only after an explicit action", async ({ page }) => {
  await page.addInitScript(() => {
    const item = {
      schemaVersion: 1,
      id: "popup-item",
      originalUrl: "https://example.com/popup-article",
      canonicalUrl: "https://example.com/popup-article",
      title: "A useful popup article",
      domain: "example.com",
      contentType: "article",
      estimatedMinutes: 15,
      estimateConfidence: "high",
      priority: "normal",
      tags: [],
      status: "queued",
      createdAt: "2026-07-17T00:00:00.000Z",
      updatedAt: "2026-07-17T00:00:00.000Z"
    };
    const state = { captures: 0 };
    Object.defineProperty(window, "__readslotPopupTest", { value: state, configurable: true });
    const chromeTarget = window.chrome ?? {};
    Object.defineProperty(chromeTarget, "runtime", {
      value: {
        sendMessage: (message: { type: string }) => {
          if (message.type === "capture.preview")
            return Promise.resolve({
              ok: true,
              value: {
                title: item.title,
                canonicalUrl: item.canonicalUrl,
                domain: item.domain,
                estimatedMinutes: item.estimatedMinutes,
                estimateConfidence: item.estimateConfidence,
                duplicate: false
              }
            });
          if (message.type === "capture.current") {
            state.captures += 1;
            return Promise.resolve({ ok: true, value: { item, duplicate: false } });
          }
          return Promise.resolve({ ok: true, value: undefined });
        }
      },
      configurable: true
    });
    if (!window.chrome)
      Object.defineProperty(window, "chrome", { value: chromeTarget, configurable: true });
  });

  await page.goto("/popup.html");
  await expect(page.getByRole("heading", { name: "A useful popup article" })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __readslotPopupTest: { captures: number } }).__readslotPopupTest
          .captures
    )
  ).toBe(0);

  await page.getByRole("button", { name: "Save for later" }).click();
  await expect(page.getByText("Saved to ReadSlot.")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __readslotPopupTest: { captures: number } }).__readslotPopupTest
          .captures
    )
  ).toBe(1);
});

test("session review completes one item and returns an unfinished item to the queue", async ({
  page
}) => {
  await installChromeMock(page);
  await page.goto("/session.html");
  await expect(page.getByRole("heading", { name: "Read with intention." })).toBeVisible();
  await page.screenshot({ path: "store-assets/screenshots/session-review.png" });

  await page
    .getByLabel("Outcome for A practical guide to focused reading")
    .selectOption("completed");
  await page.getByRole("button", { name: "Finish review" }).click();

  await expect(page.getByText(/unfinished items returned to your queue/i)).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as {
            __readslotE2E: { reviewPayload?: unknown };
          }
        ).__readslotE2E.reviewPayload
    )
  ).toEqual({
    sessionId: "session-1",
    completedItemIds: ["item-1"],
    skippedItemIds: []
  });
});

test("settings explains connected Calendar access and local controls", async ({ page }) => {
  await installChromeMock(page);
  await page.goto("/options.html");

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Google Calendar" })).toBeVisible();
  await expect(page.getByText("Connected", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Disconnect and revoke access" })).toBeVisible();
  await page.screenshot({ path: "store-assets/screenshots/settings.png" });
});
