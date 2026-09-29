import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReadingItemSchema, SCHEMA_VERSION, type CapturePreview } from "../domain/schemas";
import { createDefaultSettings } from "../domain/settings";
import { ok } from "../domain/result";
import { sendMessage } from "../shared/client";
import { PopupApp } from "./main";

vi.mock("../shared/client", () => ({ sendMessage: vi.fn() }));

const preview: CapturePreview = {
  title: "A useful article",
  canonicalUrl: "https://example.com/article",
  domain: "example.com",
  estimatedMinutes: 10,
  estimateConfidence: "high",
  duplicate: false
};

const item = ReadingItemSchema.parse({
  schemaVersion: SCHEMA_VERSION,
  id: "item-one",
  originalUrl: preview.canonicalUrl,
  canonicalUrl: preview.canonicalUrl,
  title: preview.title,
  domain: preview.domain,
  contentType: "article",
  estimatedMinutes: 10,
  estimateConfidence: "high",
  priority: "normal",
  tags: [],
  status: "queued",
  createdAt: "2026-07-17T00:00:00.000Z",
  updatedAt: "2026-07-17T00:00:00.000Z"
});

const installMessageMock = ({
  pagePreview = preview,
  connected = false,
  captureResponse = { item, duplicate: false, calendarSync: { status: "not_requested" as const } }
}: {
  pagePreview?: CapturePreview;
  connected?: boolean;
  captureResponse?: unknown;
} = {}) => {
  vi.mocked(sendMessage).mockImplementation(async (message) => {
    switch (message.type) {
      case "capture.preview":
        return ok(pagePreview);
      case "calendar.status":
        return ok({ configured: true, connected });
      case "settings.get":
        return ok({ ...createDefaultSettings(), destinationCalendarId: "primary" });
      case "calendar.list":
        return ok([
          { id: "primary", summary: "Primary calendar", primary: true, accessRole: "owner" }
        ]);
      case "capture.current":
        return ok(captureResponse);
      case "navigation.open":
      case "capture.undo":
        return ok(undefined);
      default:
        return ok(undefined);
    }
  });
};

describe("PopupApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "close").mockImplementation(() => undefined);
  });

  afterEach(() => cleanup());

  it("previews without saving and saves only after explicit confirmation", async () => {
    installMessageMock();
    const user = userEvent.setup();
    render(<PopupApp />);

    expect(await screen.findByRole("heading", { name: preview.title })).toHaveAttribute(
      "title",
      preview.title
    );
    expect(sendMessage).toHaveBeenCalledWith({ type: "capture.preview", payload: {} });
    expect(sendMessage).not.toHaveBeenCalledWith({ type: "capture.current", payload: {} });

    await user.click(screen.getByRole("button", { name: "Save for later" }));
    expect(await screen.findByText("Saved to ReadSlot.")).toBeInTheDocument();
    expect(sendMessage).toHaveBeenCalledWith({ type: "capture.current", payload: {} });
    expect(screen.getByRole("button", { name: "Undo save" })).toBeInTheDocument();
  });

  it("reuses a queued duplicate for item-scoped planner navigation", async () => {
    installMessageMock({
      pagePreview: {
        ...preview,
        duplicate: true,
        existingItemId: item.id,
        existingItemStatus: "queued"
      }
    });
    const user = userEvent.setup();
    render(<PopupApp />);

    await user.click(await screen.findByRole("button", { name: "Save & choose time" }));
    expect(sendMessage).toHaveBeenCalledWith({
      type: "navigation.open",
      payload: { page: "planner.html", itemId: item.id }
    });
  });

  it("does not offer scheduling for a completed duplicate", async () => {
    installMessageMock({
      pagePreview: {
        ...preview,
        duplicate: true,
        existingItemId: item.id,
        existingItemStatus: "completed"
      }
    });
    render(<PopupApp />);

    expect(await screen.findByText(/already saved in readslot/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save & choose time" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Already saved" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Open queue" })).toBeInTheDocument();
  });

  it("describes a deleted duplicate as restorable trash instead of already saved", async () => {
    installMessageMock({
      pagePreview: {
        ...preview,
        duplicate: true,
        existingItemId: item.id,
        existingItemStatus: "deleted"
      }
    });
    render(<PopupApp />);

    expect(await screen.findByText("This page is in Trash.")).toBeInTheDocument();
    expect(screen.queryByText(/already saved in readslot/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore to queue" })).toBeEnabled();
  });

  it("replaces one-time actions with a daily-reminder action", async () => {
    installMessageMock();
    const user = userEvent.setup();
    render(<PopupApp />);

    await screen.findByRole("heading", { name: preview.title });

    const reminderCheckbox = screen.getByLabelText("Set daily reminder");
    await user.click(reminderCheckbox);

    const timeInput = screen.getByLabelText("Reminder time");
    await user.clear(timeInput);
    await user.type(timeInput, "20:00");

    expect(screen.queryByRole("button", { name: "Save & choose time" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save daily reminder" }));

    expect(sendMessage).toHaveBeenCalledWith({
      type: "capture.current",
      payload: {
        recurrence: {
          enabled: true,
          time: "20:00",
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          addToCalendar: false
        }
      }
    });
    expect(await screen.findByText(/Saved daily reminder for 20:00/i)).toBeInTheDocument();
  });

  it("updates a daily reminder on an existing queued item", async () => {
    installMessageMock({
      pagePreview: {
        ...preview,
        duplicate: true,
        existingItemId: item.id,
        existingItemStatus: "queued"
      },
      captureResponse: {
        item,
        duplicate: true,
        calendarSync: { status: "not_requested" }
      }
    });
    const user = userEvent.setup();
    render(<PopupApp />);

    await user.click(await screen.findByLabelText("Set daily reminder"));
    await user.click(screen.getByRole("button", { name: "Update daily reminder" }));

    expect(sendMessage).toHaveBeenCalledWith({
      type: "capture.current",
      payload: {
        recurrence: {
          enabled: true,
          time: "20:00",
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          addToCalendar: false
        }
      }
    });
    expect(await screen.findByText(/Updated daily reminder for 20:00/i)).toBeInTheDocument();
  });

  it("connects Google Calendar directly from the popup", async () => {
    let connected = false;
    vi.mocked(sendMessage).mockImplementation(async (message) => {
      if (message.type === "capture.preview") return ok(preview);
      if (message.type === "calendar.status") return ok({ configured: true, connected });
      if (message.type === "calendar.connect") {
        connected = true;
        return ok({ connected: true });
      }
      if (message.type === "settings.get")
        return ok({ ...createDefaultSettings(), destinationCalendarId: "primary" });
      if (message.type === "calendar.list")
        return ok([
          { id: "primary", summary: "Primary calendar", primary: true, accessRole: "owner" }
        ]);
      return ok(undefined);
    });
    const user = userEvent.setup();
    render(<PopupApp />);

    await user.click(await screen.findByRole("button", { name: "Connect" }));
    await waitFor(() => expect(screen.getByText(/Connected · Primary calendar/i)).toBeVisible());
    expect(sendMessage).toHaveBeenCalledWith({ type: "calendar.connect", payload: {} });
  });

  it("confirms and syncs a daily reminder when Calendar is ready", async () => {
    installMessageMock({
      connected: true,
      captureResponse: {
        item,
        duplicate: false,
        calendarSync: { status: "synced", calendarId: "primary", eventId: "event-one" }
      }
    });
    const user = userEvent.setup();
    render(<PopupApp />);

    await screen.findByText(/Connected · Primary calendar/i);
    await user.click(screen.getByLabelText("Set daily reminder"));
    await user.click(screen.getByLabelText("Sync with Google Calendar"));
    await user.click(screen.getByRole("button", { name: "Confirm & sync daily" }));

    expect(sendMessage).toHaveBeenCalledWith({
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
    expect(await screen.findByText(/Saved and synced daily at 20:00/i)).toBeInTheDocument();
  });
});
