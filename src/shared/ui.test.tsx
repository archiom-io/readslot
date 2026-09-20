import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "../domain/result";
import { sendMessage } from "./client";
import { PageShell } from "./ui";

vi.mock("./client", () => ({
  sendMessage: vi.fn(),
  extensionUrl: (path: string) => `chrome-extension://readslot/${path}`
}));

describe("PageShell navbar Google Calendar CTA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the Connect Google Calendar CTA when calendar is not connected", async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(ok({ configured: true, connected: false }));

    render(
      <PageShell eyebrow="Queue" title="Local Queue">
        <div>Queue content</div>
      </PageShell>
    );

    const ctaButton = await screen.findByRole("button", { name: /connect google calendar/i });
    expect(ctaButton).toBeInTheDocument();
  });

  it("does not render the CTA button when calendar is already connected", async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(ok({ configured: true, connected: true }));

    render(
      <PageShell eyebrow="Queue" title="Local Queue">
        <div>Queue content</div>
      </PageShell>
    );

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: "calendar.status", payload: {} });
    });

    expect(
      screen.queryByRole("button", { name: /connect google calendar/i })
    ).not.toBeInTheDocument();
  });

  it("calls calendar.connect when CTA button is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(sendMessage)
      .mockResolvedValueOnce(ok({ configured: true, connected: false }))
      .mockResolvedValueOnce(ok(undefined));

    render(
      <PageShell eyebrow="Queue" title="Local Queue">
        <div>Queue content</div>
      </PageShell>
    );

    const ctaButton = await screen.findByRole("button", { name: /connect google calendar/i });
    await user.click(ctaButton);

    expect(sendMessage).toHaveBeenCalledWith({ type: "calendar.connect", payload: {} });
  });
});
