import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleCalendarGateway } from "./googleCalendar";

const chromeMock = (configured = true) => ({
  runtime: {
    getManifest: vi.fn(() => ({
      oauth2: configured ? { client_id: "test.apps.googleusercontent.com" } : undefined
    }))
  },
  identity: {
    getAuthToken: vi.fn(async () => ({ token: "test-auth-value" })),
    removeCachedAuthToken: vi.fn(async () => undefined)
  },
  storage: {
    local: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined)
    }
  }
});

describe("GoogleCalendarGateway", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", chromeMock());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fails safely when OAuth is not configured", async () => {
    vi.stubGlobal("chrome", chromeMock(false));
    const result = await new GoogleCalendarGateway().connect(false);
    expect(result).toEqual({
      ok: false,
      error: {
        code: "OAUTH_NOT_CONFIGURED",
        message: "Google Calendar is not configured for this build."
      }
    });
  });

  it("normalizes a successful FreeBusy response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              calendars: {
                primary: {
                  busy: [
                    {
                      start: "2026-07-14T12:00:00.000Z",
                      end: "2026-07-14T13:00:00.000Z"
                    }
                  ]
                }
              }
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
      )
    );
    const result = await new GoogleCalendarGateway().getBusy(
      ["primary"],
      "2026-07-14T00:00:00.000Z",
      "2026-07-15T00:00:00.000Z",
      "Asia/Dhaka"
    );
    expect(result.ok && result.value).toEqual([
      { start: "2026-07-14T12:00:00.000Z", end: "2026-07-14T13:00:00.000Z" }
    ]);
  });

  it("clears cached auth after a 401 without exposing the token", async () => {
    const mockedChrome = chromeMock();
    vi.stubGlobal("chrome", mockedChrome);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 401 }))
    );
    const result = await new GoogleCalendarGateway().listCalendars();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("OAUTH_REVOKED");
    expect(mockedChrome.identity.removeCachedAuthToken).toHaveBeenCalledWith({
      token: "test-auth-value"
    });
    expect(mockedChrome.storage.local.set).not.toHaveBeenCalled();
  });

  it("reports a dedicated error when reading the calendar list is forbidden", async () => {
    const mockedChrome = chromeMock();
    vi.stubGlobal("chrome", mockedChrome);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 403 }))
    );

    const result = await new GoogleCalendarGateway().listCalendars();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CALENDAR_LIST_FORBIDDEN");
      expect(result.error.message).toContain("calendar list");
    }
  });

  it("keeps an explicit disconnect from silently reconnecting", async () => {
    const mockedChrome = chromeMock();
    vi.mocked(mockedChrome.storage.local.get).mockResolvedValue({
      "readslot.googleCalendarDisconnected": true
    });
    vi.stubGlobal("chrome", mockedChrome);
    const gateway = new GoogleCalendarGateway();

    const result = await gateway.connect(false);

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OAUTH_DISCONNECTED",
        message: "Google Calendar is disconnected. Connect to continue."
      }
    });
    expect(mockedChrome.identity.getAuthToken).not.toHaveBeenCalled();
  });

  it("revokes Google access, remembers disconnect, and clears that choice after reconnect", async () => {
    const mockedChrome = chromeMock();
    vi.stubGlobal("chrome", mockedChrome);
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const gateway = new GoogleCalendarGateway();

    expect((await gateway.disconnect()).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/revoke",
      expect.objectContaining({
        method: "POST",
        body: "token=test-auth-value"
      })
    );
    expect(mockedChrome.identity.removeCachedAuthToken).toHaveBeenCalledWith({
      token: "test-auth-value"
    });
    expect(mockedChrome.storage.local.set).toHaveBeenCalledWith({
      "readslot.googleCalendarDisconnected": true
    });

    expect((await gateway.connect(true)).ok).toBe(true);
    expect(mockedChrome.storage.local.remove).toHaveBeenCalledWith(
      "readslot.googleCalendarDisconnected"
    );
  });

  it("disconnects locally and reports when Google revocation fails", async () => {
    const mockedChrome = chromeMock();
    vi.stubGlobal("chrome", mockedChrome);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 }))
    );
    const gateway = new GoogleCalendarGateway();

    const result = await gateway.disconnect();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("OAUTH_REVOCATION_FAILED");
    expect(mockedChrome.identity.removeCachedAuthToken).toHaveBeenCalledWith({
      token: "test-auth-value"
    });
    expect(mockedChrome.storage.local.set).toHaveBeenCalledWith({
      "readslot.googleCalendarDisconnected": true
    });
  });

  it("sends the caller-provided deterministic event ID", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            id: "readslot012345",
            start: { dateTime: "2026-07-14T12:00:00.000Z" },
            end: { dateTime: "2026-07-14T12:30:00.000Z" }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await new GoogleCalendarGateway().createEvent({
      eventId: "readslot012345",
      calendarId: "primary",
      title: "ReadSlot — 1 item",
      description: "Confirmed by the user.",
      start: "2026-07-14T12:00:00.000Z",
      end: "2026-07-14T12:30:00.000Z",
      timezone: "Asia/Dhaka",
      reminderMinutes: 10,
      transparency: "opaque",
      privateProperties: { readslotProposalId: "proposal-1" }
    });
    expect(result.ok).toBe(true);
    const request = fetchMock.mock.calls[0][1];
    expect(typeof request?.body).toBe("string");
    expect(JSON.parse(request?.body as string)).toMatchObject({ id: "readslot012345" });
  });

  it("treats only a 404 event lookup as not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 404 }))
    );

    const result = await new GoogleCalendarGateway().getEvent("primary", "missing-event");

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("does not mistake a Calendar outage for a missing event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500 }))
    );

    const result = await new GoogleCalendarGateway().getEvent("primary", "existing-event");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CALENDAR_UNAVAILABLE");
      expect(result.error.retryable).toBe(true);
    }
  });

  it("reports a deterministic event ID collision on 409", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 409 }))
    );

    const result = await new GoogleCalendarGateway().createEvent({
      eventId: "readslot012345",
      calendarId: "primary",
      title: "ReadSlot — 1 item",
      description: "Confirmed by the user.",
      start: "2026-07-14T12:00:00.000Z",
      end: "2026-07-14T12:30:00.000Z",
      timezone: "Asia/Dhaka",
      transparency: "opaque",
      privateProperties: { readslotProposalId: "proposal-1" }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CALENDAR_EVENT_EXISTS");
  });
});
