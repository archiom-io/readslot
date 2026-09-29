import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok, type Result } from "../domain/result";
import type { CalendarSummary } from "../domain/ports";
import {
  ProposalSchema,
  ReadingItemSchema,
  ReadingSessionSchema,
  SCHEMA_VERSION,
  type ReadingItem
} from "../domain/schemas";
import { createDefaultSettings } from "../domain/settings";
import { database } from "../storage/database";

const calendarMocks = vi.hoisted(() => ({
  isConfigured: vi.fn(() => true),
  connect: vi.fn(async () => ok(undefined)),
  disconnect: vi.fn(async () => ok(undefined)),
  listCalendars: vi.fn(async (): Promise<Result<CalendarSummary[]>> => ok([])),
  getBusy: vi.fn(async () => ok([])),
  getEvent: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn()
}));

vi.mock("../calendar/googleCalendar", () => ({
  GoogleCalendarGateway: class {
    isConfigured = calendarMocks.isConfigured;
    connect = calendarMocks.connect;
    disconnect = calendarMocks.disconnect;
    listCalendars = calendarMocks.listCalendars;
    getBusy = calendarMocks.getBusy;
    getEvent = calendarMocks.getEvent;
    createEvent = calendarMocks.createEvent;
    updateEvent = calendarMocks.updateEvent;
    deleteEvent = calendarMocks.deleteEvent;
  }
}));

import { handleMessage } from "./application";

const now = "2030-01-01T00:00:00.000Z";
const event = {
  id: "readslot-event",
  start: "2030-01-03T12:00:00.000Z",
  end: "2030-01-03T12:30:00.000Z"
};

const makeItem = (id: string, status: ReadingItem["status"] = "proposed") =>
  ReadingItemSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    id,
    originalUrl: `https://example.com/${id}`,
    canonicalUrl: `https://example.com/${id}`,
    title: `Item ${id}`,
    domain: "example.com",
    contentType: "article",
    estimatedMinutes: 15,
    estimateConfidence: "medium",
    priority: "normal",
    tags: [],
    status,
    createdAt: now,
    updatedAt: now
  });

const makeProposal = () =>
  ProposalSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    id: "proposal-one",
    itemIds: ["item-one"],
    calendarId: "primary",
    title: "Read one item",
    description: "Confirmed by the user.",
    suggestedStart: event.start,
    suggestedEnd: event.end,
    durationMinutes: 30,
    reminderMinutes: 10,
    score: 100,
    explanation: ["Fits the preferred block length."],
    confidence: "high",
    conflictStatus: "clear",
    transparency: "opaque",
    status: "ready",
    generatedAt: now,
    expiresAt: "2031-01-01T00:00:00.000Z"
  });

const makeSession = (status: "scheduled" | "completed" = "scheduled") =>
  ReadingSessionSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    id: "session-one",
    proposalId: "proposal-one",
    itemIds: ["item-one", "item-two", "item-three"],
    completedItemIds: status === "completed" ? ["item-one"] : [],
    skippedItemIds: [],
    calendarId: "primary",
    calendarEventId: event.id,
    start: event.start,
    end: event.end,
    status,
    createdAt: now,
    updatedAt: now,
    lastSyncedAt: now
  });

beforeEach(async () => {
  vi.clearAllMocks();
  await database.open();
  await database.transaction(
    "rw",
    [database.items, database.proposals, database.sessions, database.calendarOperations],
    async () => {
      await Promise.all([
        database.items.clear(),
        database.proposals.clear(),
        database.sessions.clear(),
        database.calendarOperations.clear()
      ]);
    }
  );
  const settings = createDefaultSettings();
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async () => ({ settings })),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined)
      }
    },
    alarms: {
      create: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined)
    },
    tabs: {
      query: vi.fn(async () => [
        {
          id: 7,
          url: "https://example.com/daily",
          title: "Daily article"
        }
      ]),
      sendMessage: vi.fn(async () => ({ title: "Daily article", wordCount: 1200 }))
    },
    scripting: { executeScript: vi.fn(async () => undefined) },
    runtime: { getManifest: vi.fn(() => ({ version: "0.10.0" })) }
  });
  calendarMocks.getEvent.mockResolvedValue(ok(undefined));
  calendarMocks.createEvent.mockResolvedValue(ok(event));
  calendarMocks.updateEvent.mockResolvedValue(ok(event));
  calendarMocks.deleteEvent.mockResolvedValue(ok(undefined));
  calendarMocks.getBusy.mockResolvedValue(ok([]));
  calendarMocks.listCalendars.mockResolvedValue(
    ok([
      {
        id: "primary",
        summary: "Primary calendar",
        primary: true,
        accessRole: "writer"
      }
    ])
  );
});

afterAll(async () => {
  database.close();
  vi.unstubAllGlobals();
});

describe("proposal confirmation recovery", () => {
  beforeEach(async () => {
    await database.items.put(makeItem("item-one"));
    await database.proposals.put(makeProposal());
  });

  it("does not create an event when the initial reconciliation lookup is unavailable", async () => {
    calendarMocks.getEvent.mockResolvedValue(
      err({
        code: "CALENDAR_UNAVAILABLE",
        message: "Google Calendar is temporarily unavailable.",
        retryable: true
      })
    );

    const result = await handleMessage({
      type: "proposals.confirm",
      payload: { proposalId: "proposal-one" }
    });

    expect(result.ok).toBe(false);
    expect(calendarMocks.createEvent).not.toHaveBeenCalled();
    expect((await database.calendarOperations.get("proposal-one"))?.state).toBe("pending");
  });

  it("reconciles a timed-out create without issuing a duplicate request", async () => {
    calendarMocks.getEvent.mockResolvedValueOnce(ok(undefined)).mockResolvedValueOnce(ok(event));
    calendarMocks.createEvent.mockResolvedValue(
      err({ code: "NETWORK_ERROR", message: "Could not reach Google Calendar.", retryable: true })
    );

    const result = await handleMessage({
      type: "proposals.confirm",
      payload: { proposalId: "proposal-one" }
    });

    expect(result.ok).toBe(true);
    expect(calendarMocks.createEvent).toHaveBeenCalledTimes(1);
    expect(calendarMocks.getEvent).toHaveBeenCalledTimes(2);
    expect((await database.calendarOperations.get("proposal-one"))?.state).toBe("confirmed");
    expect((await database.items.get("item-one"))?.status).toBe("scheduled");
    expect(await database.sessions.count()).toBe(1);
  });

  it("reconciles a 409 collision to the existing deterministic event", async () => {
    calendarMocks.getEvent.mockResolvedValueOnce(ok(undefined)).mockResolvedValueOnce(ok(event));
    calendarMocks.createEvent.mockResolvedValue(
      err({ code: "CALENDAR_EVENT_EXISTS", message: "This event already exists." })
    );

    const result = await handleMessage({
      type: "proposals.confirm",
      payload: { proposalId: "proposal-one" }
    });

    expect(result.ok).toBe(true);
    expect(calendarMocks.createEvent).toHaveBeenCalledTimes(1);
    expect(await database.sessions.count()).toBe(1);
  });

  it("rejects a destination calendar that is not writable before creating an event", async () => {
    calendarMocks.listCalendars.mockResolvedValueOnce(
      ok([
        {
          id: "primary",
          summary: "Primary calendar",
          primary: true,
          accessRole: "reader"
        }
      ])
    );

    const result = await handleMessage({
      type: "proposals.confirm",
      payload: { proposalId: "proposal-one" }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CALENDAR_READ_ONLY");
      expect(result.error.message).toContain("writer or owner access");
    }
    expect(calendarMocks.createEvent).not.toHaveBeenCalled();
    expect(await database.calendarOperations.get("proposal-one")).toBeUndefined();
  });
});

describe("daily Calendar sync", () => {
  it("captures and idempotently syncs a recurring item to the primary calendar", async () => {
    const result = await handleMessage({
      type: "capture.current",
      payload: {
        recurrence: {
          enabled: true,
          time: "20:00",
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          addToCalendar: true
        }
      }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const value = result.value as {
      item: ReadingItem;
      duplicate: boolean;
      calendarSync: { status: string; eventId?: string };
    };
    expect(value.calendarSync.status).toBe("synced");
    expect(value.item.recurrence?.calendarEventId).toBe(event.id);
    expect(value.item.recurrence?.calendarId).toBe("primary");
    expect(calendarMocks.createEvent).toHaveBeenCalledTimes(1);
    expect(calendarMocks.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: "primary",
        recurrence: ["RRULE:FREQ=DAILY"],
        privateProperties: { readslotItemId: value.item.id, recurring: "true" }
      })
    );
    const operation = await database.calendarOperations.get(`recurrence:${value.item.id}`);
    expect(operation?.operationKind).toBe("recurrence");
    expect(operation?.state).toBe("confirmed");
  });

  it("updates the deterministic recurring event instead of creating a duplicate", async () => {
    const message = {
      type: "capture.current" as const,
      payload: {
        recurrence: {
          enabled: true,
          time: "20:00",
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          addToCalendar: true
        }
      }
    };

    expect((await handleMessage(message)).ok).toBe(true);
    const repeated = await handleMessage(message);

    expect(repeated.ok).toBe(true);
    expect(calendarMocks.createEvent).toHaveBeenCalledTimes(1);
    expect(calendarMocks.updateEvent).toHaveBeenCalledTimes(1);
    if (repeated.ok) {
      expect((repeated.value as { duplicate: boolean }).duplicate).toBe(true);
    }
  });

  it("reports a Calendar failure without losing the local reminder", async () => {
    calendarMocks.listCalendars.mockResolvedValueOnce(
      ok([
        {
          id: "primary",
          summary: "Read-only calendar",
          primary: true,
          accessRole: "reader"
        }
      ])
    );

    const result = await handleMessage({
      type: "capture.current",
      payload: {
        recurrence: {
          enabled: true,
          time: "20:00",
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          addToCalendar: true
        }
      }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const value = result.value as {
      item: ReadingItem;
      calendarSync: { status: string; error?: { code: string } };
    };
    expect(value.calendarSync).toMatchObject({
      status: "failed",
      error: { code: "CALENDAR_READ_ONLY" }
    });
    expect(value.item.recurrence?.enabled).toBe(true);
    expect(await database.items.get(value.item.id)).toBeDefined();
    expect(calendarMocks.createEvent).not.toHaveBeenCalled();
  });

  it("removes the recurring event and alarm when a new capture is undone", async () => {
    const captured = await handleMessage({
      type: "capture.current",
      payload: {
        recurrence: {
          enabled: true,
          time: "20:00",
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          addToCalendar: true
        }
      }
    });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const itemId = (captured.value as { item: ReadingItem }).item.id;

    const undone = await handleMessage({ type: "capture.undo", payload: { itemId } });

    expect(undone.ok).toBe(true);
    expect(calendarMocks.deleteEvent).toHaveBeenCalledWith("primary", event.id);
    expect(chrome.alarms.clear).toHaveBeenCalledWith(`reminder:item:${itemId}`);
    expect((await database.items.get(itemId))?.status).toBe("deleted");
  });
});

describe("session review", () => {
  beforeEach(async () => {
    await database.items.bulkPut([
      makeItem("item-one", "scheduled"),
      makeItem("item-two", "scheduled"),
      makeItem("item-three", "scheduled")
    ]);
    await database.sessions.put(makeSession());
  });

  it("atomically completes, archives, and requeues the selected outcomes", async () => {
    const result = await handleMessage({
      type: "sessions.review",
      payload: {
        sessionId: "session-one",
        completedItemIds: ["item-one"],
        skippedItemIds: ["item-two"]
      }
    });

    expect(result.ok).toBe(true);
    expect((await database.items.get("item-one"))?.status).toBe("completed");
    expect((await database.items.get("item-two"))?.status).toBe("archived");
    expect((await database.items.get("item-three"))?.status).toBe("queued");
    expect((await database.sessions.get("session-one"))?.status).toBe("completed");
  });

  it("rejects overlapping outcomes without changing local state", async () => {
    const result = await handleMessage({
      type: "sessions.review",
      payload: {
        sessionId: "session-one",
        completedItemIds: ["item-one"],
        skippedItemIds: ["item-one"]
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_INPUT");
    expect((await database.items.get("item-one"))?.status).toBe("scheduled");
    expect((await database.sessions.get("session-one"))?.status).toBe("scheduled");
  });

  it("rejects outcomes for items outside the session", async () => {
    const result = await handleMessage({
      type: "sessions.review",
      payload: {
        sessionId: "session-one",
        completedItemIds: ["unknown-item"],
        skippedItemIds: []
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_INPUT");
    expect((await database.sessions.get("session-one"))?.status).toBe("scheduled");
  });

  it("does not allow a completed session to be reviewed again", async () => {
    await database.sessions.put(makeSession("completed"));

    const result = await handleMessage({
      type: "sessions.review",
      payload: {
        sessionId: "session-one",
        completedItemIds: [],
        skippedItemIds: ["item-one"]
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CONFLICT");
    expect((await database.items.get("item-one"))?.status).toBe("scheduled");
  });

  it("does not partially update a review when a session item is missing", async () => {
    await database.items.delete("item-three");

    const result = await handleMessage({
      type: "sessions.review",
      payload: {
        sessionId: "session-one",
        completedItemIds: ["item-one"],
        skippedItemIds: ["item-two"]
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    expect((await database.items.get("item-one"))?.status).toBe("scheduled");
    expect((await database.items.get("item-two"))?.status).toBe("scheduled");
    expect((await database.sessions.get("session-one"))?.status).toBe("scheduled");
  });

  it("keeps a recurring item queued when completed during session review", async () => {
    const recurringItem = {
      ...makeItem("item-recurring", "scheduled"),
      recurrence: {
        enabled: true,
        time: "20:00",
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        addToCalendar: false
      }
    };
    await database.items.put(recurringItem);
    const session = {
      ...makeSession("scheduled"),
      id: "session-recurring",
      itemIds: ["item-recurring", "item-two"]
    };
    await database.sessions.put(session);

    const result = await handleMessage({
      type: "sessions.review",
      payload: {
        sessionId: "session-recurring",
        completedItemIds: ["item-recurring"],
        skippedItemIds: ["item-two"]
      }
    });

    expect(result.ok).toBe(true);
    const updated = await database.items.get("item-recurring");
    expect(updated?.status).toBe("queued");
    expect(updated?.lastOpenedAt).toBeDefined();
    expect((await database.items.get("item-two"))?.status).toBe("archived");
    expect((await database.sessions.get("session-recurring"))?.status).toBe("completed");
  });

  it("schedules alarms when saving settings with daily reminders", async () => {
    const settings = createDefaultSettings();
    settings.dailyReminders = [
      {
        id: "habit-evening",
        label: "Study Newspaper",
        time: "20:00",
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        enabled: true,
        addToCalendar: false
      }
    ];

    const result = await handleMessage({
      type: "settings.update",
      payload: { settings }
    });

    expect(result.ok).toBe(true);
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      "reminder:habit:habit-evening",
      expect.objectContaining({ periodInMinutes: 1440 })
    );
  });
});
