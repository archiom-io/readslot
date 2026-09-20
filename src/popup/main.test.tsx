import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReadingItemSchema, SCHEMA_VERSION, type CapturePreview } from "../domain/schemas";
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

describe("PopupApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "close").mockImplementation(() => undefined);
  });

  afterEach(() => cleanup());

  it("previews without saving and saves only after explicit confirmation", async () => {
    vi.mocked(sendMessage)
      .mockResolvedValueOnce(ok(preview))
      .mockResolvedValueOnce(ok({ item, duplicate: false }));
    const user = userEvent.setup();
    render(<PopupApp />);

    expect(await screen.findByRole("heading", { name: preview.title })).toHaveAttribute(
      "title",
      preview.title
    );
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenNthCalledWith(1, { type: "capture.preview", payload: {} });

    await user.click(screen.getByRole("button", { name: "Save for later" }));
    expect(await screen.findByText("Saved to ReadSlot.")).toBeInTheDocument();
    expect(sendMessage).toHaveBeenNthCalledWith(2, { type: "capture.current", payload: {} });
    expect(screen.getByRole("button", { name: "Undo save" })).toBeInTheDocument();
  });

  it("reuses a queued duplicate for item-scoped planner navigation", async () => {
    vi.mocked(sendMessage)
      .mockResolvedValueOnce(
        ok({ ...preview, duplicate: true, existingItemId: item.id, existingItemStatus: "queued" })
      )
      .mockResolvedValueOnce(ok(undefined));
    const user = userEvent.setup();
    render(<PopupApp />);

    await user.click(await screen.findByRole("button", { name: "Save & choose time" }));
    expect(sendMessage).toHaveBeenNthCalledWith(2, {
      type: "navigation.open",
      payload: { page: "planner.html", itemId: item.id }
    });
  });

  it("does not offer scheduling for a completed duplicate", async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      ok({ ...preview, duplicate: true, existingItemId: item.id, existingItemStatus: "completed" })
    );
    render(<PopupApp />);

    expect(await screen.findByText(/already saved in readslot/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save & choose time" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Already saved" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Open queue" })).toBeInTheDocument();
  });

  it("describes a deleted duplicate as restorable trash instead of already saved", async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      ok({ ...preview, duplicate: true, existingItemId: item.id, existingItemStatus: "deleted" })
    );
    render(<PopupApp />);

    expect(await screen.findByText("This page is in Trash.")).toBeInTheDocument();
    expect(screen.queryByText(/already saved in readslot/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore to queue" })).toBeEnabled();
  });

  it("saves an item with daily reminder when toggled", async () => {
    vi.mocked(sendMessage)
      .mockResolvedValueOnce(ok(preview))
      .mockResolvedValueOnce(ok({ item, duplicate: false }));
    const user = userEvent.setup();
    render(<PopupApp />);

    await screen.findByRole("heading", { name: preview.title });

    const reminderCheckbox = screen.getByLabelText("Set daily reminder");
    await user.click(reminderCheckbox);

    const timeInput = screen.getByLabelText("Reminder time");
    await user.clear(timeInput);
    await user.type(timeInput, "20:00");

    await user.click(screen.getByRole("button", { name: "Save for later" }));

    expect(sendMessage).toHaveBeenNthCalledWith(2, {
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
    expect(await screen.findByText(/Saved with daily reminder/i)).toBeInTheDocument();
  });
});
