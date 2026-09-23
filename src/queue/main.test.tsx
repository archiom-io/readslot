import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "../domain/result";
import { ReadingItemSchema, SCHEMA_VERSION, type ReadingItem } from "../domain/schemas";
import { sendMessage } from "../shared/client";
import { QueueApp } from "./main";

vi.mock("../shared/client", () => ({
  sendMessage: vi.fn(),
  extensionUrl: (path: string) => `chrome-extension://readslot/${path}`
}));

const makeItem = (id: string, recurring = false): ReadingItem =>
  ReadingItemSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    id,
    originalUrl: `https://example.com/${id}`,
    canonicalUrl: `https://example.com/${id}`,
    title: `Item ${id}`,
    domain: "example.com",
    contentType: "article",
    estimatedMinutes: 20,
    estimateConfidence: "medium",
    priority: "normal",
    tags: [],
    status: "queued",
    createdAt: "2030-01-01T00:00:00.000Z",
    updatedAt: "2030-01-01T00:00:00.000Z",
    recurrence: recurring
      ? {
          enabled: true,
          time: "20:00",
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          addToCalendar: false
        }
      : undefined
  });

describe("QueueApp redesign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockItems = [makeItem("one"), makeItem("two", true)];
    vi.mocked(sendMessage).mockImplementation((message) => {
      switch (message.type) {
        case "items.list":
          return Promise.resolve(ok(mockItems));
        case "dashboard.stats":
          return Promise.resolve(
            ok({
              totalItems: 2,
              queuedItems: 2,
              scheduledItems: 0,
              completedItems: 0,
              queueMinutes: 40,
              completedSessions: 0
            })
          );
        case "calendar.status":
          return Promise.resolve(ok({ configured: true, connected: true }));
        default:
          return Promise.resolve(ok(undefined));
      }
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders queue stats, quick-add bar, and cards with ergonomic actions", async () => {
    render(<QueueApp />);

    expect(await screen.findByText("Make later happen.")).toBeVisible();
    expect(screen.getByText("Waiting to read")).toBeVisible();
    expect(screen.getByText("Daily habits today")).toBeVisible();
    expect(screen.getByPlaceholderText(/paste any article or webpage url/i)).toBeVisible();

    expect(await screen.findByText("Item one")).toBeVisible();
    expect(await screen.findByText("Item two")).toBeVisible();

    // Check ergonomic action buttons
    const readButtons = screen.getAllByRole("link", { name: /read ↗/i });
    expect(readButtons).toHaveLength(2);

    const scheduleButtons = screen.getAllByRole("link", { name: /schedule/i });
    expect(scheduleButtons).toHaveLength(2);
    expect(scheduleButtons[0]).toHaveAttribute(
      "href",
      "chrome-extension://readslot/planner.html?itemId=one"
    );

    // One regular complete button and one done for today button
    expect(screen.getByRole("button", { name: /complete ✓/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /done for today/i })).toBeVisible();
  });

  it("filters items to only recurring items when Daily tab is clicked", async () => {
    const user = userEvent.setup();
    render(<QueueApp />);

    const dailyTab = await screen.findByRole("tab", { name: /daily 🔁/i });
    await user.click(dailyTab);

    await waitFor(() => {
      expect(screen.queryByText("Item one")).not.toBeInTheDocument();
      expect(screen.getByText("Item two")).toBeVisible();
    });
  });

  it("toggles daily done state when clicking Done for today", async () => {
    const user = userEvent.setup();
    render(<QueueApp />);

    const doneButton = await screen.findByRole("button", { name: /done for today/i });
    await user.click(doneButton);

    const updateCall = vi
      .mocked(sendMessage)
      .mock.calls.find(([msg]) => msg.type === "items.update");
    expect(updateCall).toBeDefined();
    if (updateCall && updateCall[0].type === "items.update") {
      expect(updateCall[0].payload.id).toBe("two");
      expect(updateCall[0].payload.changes.status).toBe("queued");
    }
  });
});
