import type {
  BusyInterval,
  CalendarGateway,
  CalendarSummary,
  CreateCalendarEventInput
} from "../domain/ports";
import { err, ok, type Result } from "../domain/result";

interface TokenState {
  token: string;
}

const API_ROOT = "https://www.googleapis.com/calendar/v3";
const REVOCATION_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const DISCONNECTED_KEY = "readslot.googleCalendarDisconnected";

interface RequestOptions {
  forbiddenCode: "CALENDAR_READ_ONLY" | "CALENDAR_LIST_FORBIDDEN" | "CALENDAR_BUSY_FORBIDDEN";
  forbiddenMessage: string;
}

export class GoogleCalendarGateway implements CalendarGateway {
  private tokenState?: TokenState;

  isConfigured(): boolean {
    return Boolean(chrome.runtime.getManifest().oauth2?.client_id);
  }

  private async isExplicitlyDisconnected(): Promise<boolean> {
    const stored = await chrome.storage.local.get(DISCONNECTED_KEY);
    return stored[DISCONNECTED_KEY] === true;
  }

  private async clearCachedToken(token?: string): Promise<void> {
    if (token) await chrome.identity.removeCachedAuthToken({ token }).catch(() => undefined);
    this.tokenState = undefined;
  }

  private async revokeToken(token: string): Promise<Result<void>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(REVOCATION_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }).toString(),
        signal: controller.signal
      });
      if (response.ok) return ok(undefined);
      return err({
        code: "OAUTH_REVOCATION_FAILED",
        message:
          "ReadSlot disconnected locally, but Google access could not be revoked. Remove ReadSlot from your Google Account connections."
      });
    } catch {
      return err({
        code: "OAUTH_REVOCATION_FAILED",
        message:
          "ReadSlot disconnected locally, but Google could not be reached to revoke access. Try again from your Google Account connections."
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async connect(interactive: boolean): Promise<Result<void>> {
    if (!this.isConfigured()) {
      return err({
        code: "OAUTH_NOT_CONFIGURED",
        message: "Google Calendar is not configured for this build."
      });
    }
    if (!interactive && (await this.isExplicitlyDisconnected())) {
      return err({
        code: "OAUTH_DISCONNECTED",
        message: "Google Calendar is disconnected. Connect to continue."
      });
    }
    try {
      const response = await chrome.identity.getAuthToken({ interactive });
      if (!response.token)
        return err({ code: "OAUTH_DENIED", message: "Google sign-in was cancelled or denied." });
      this.tokenState = { token: response.token };
      if (interactive) await chrome.storage.local.remove(DISCONNECTED_KEY);
      return ok(undefined);
    } catch {
      return err({ code: "OAUTH_DENIED", message: "Google sign-in was cancelled or denied." });
    }
  }

  async disconnect(): Promise<Result<void>> {
    const cached = await chrome.identity
      .getAuthToken({ interactive: false })
      .catch(() => undefined);
    const token = this.tokenState?.token ?? cached?.token;
    const revocation = token ? await this.revokeToken(token) : ok(undefined);
    await this.clearCachedToken(token);
    try {
      await chrome.storage.local.set({ [DISCONNECTED_KEY]: true });
    } catch {
      return err({
        code: "STORAGE_ERROR",
        message: "Google access was cleared, but ReadSlot could not save the disconnected state."
      });
    }
    return revocation;
  }

  private async request<T>(
    path: string,
    options: RequestOptions,
    init?: RequestInit
  ): Promise<Result<T>> {
    const connection = this.tokenState ? ok(undefined) : await this.connect(false);
    if (!connection.ok || !this.tokenState) return connection as Result<T>;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${this.tokenState.token}`);
      headers.set("Content-Type", "application/json");
      const response = await fetch(`${API_ROOT}${path}`, {
        ...init,
        signal: controller.signal,
        headers
      });
      if (response.status === 401) {
        await this.clearCachedToken(this.tokenState.token);
        return err({
          code: "OAUTH_REVOKED",
          message: "Google Calendar access expired. Reconnect to continue."
        });
      }
      if (response.status === 403)
        return err({ code: options.forbiddenCode, message: options.forbiddenMessage });
      if (response.status === 404)
        return err({
          code: "CALENDAR_EVENT_NOT_FOUND",
          message: "The Google Calendar event was not found."
        });
      if (response.status === 409)
        return err({
          code: "CALENDAR_EVENT_EXISTS",
          message: "This Google Calendar event already exists."
        });
      if (response.status === 429)
        return err({
          code: "RATE_LIMITED",
          message: "Google Calendar is temporarily rate limited.",
          retryable: true
        });
      if (!response.ok)
        return err({
          code: "CALENDAR_UNAVAILABLE",
          message: "Google Calendar is temporarily unavailable.",
          retryable: response.status >= 500
        });
      return ok((await response.json()) as T);
    } catch {
      return err({
        code: "NETWORK_ERROR",
        message: "Could not reach Google Calendar.",
        retryable: true
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async listCalendars(): Promise<Result<CalendarSummary[]>> {
    const response = await this.request<{
      items?: Array<{
        id: string;
        summary?: string;
        primary?: boolean;
        accessRole: CalendarSummary["accessRole"];
      }>;
    }>(
      "/users/me/calendarList?minAccessRole=freeBusyReader",
      {
        forbiddenCode: "CALENDAR_LIST_FORBIDDEN",
        forbiddenMessage:
          "Google Calendar did not allow ReadSlot to read your calendar list. Check the connected account, Calendar API settings, and the granted permissions."
      }
    );
    if (!response.ok) return response;
    return ok(
      (response.value.items ?? []).map((item) => ({
        id: item.id,
        summary: item.summary ?? item.id,
        primary: Boolean(item.primary),
        accessRole: item.accessRole
      }))
    );
  }

  async getBusy(
    calendarIds: string[],
    start: string,
    end: string,
    timezone: string
  ): Promise<Result<BusyInterval[]>> {
    const response = await this.request<{ calendars?: Record<string, { busy?: BusyInterval[] }> }>(
      "/freeBusy",
      {
        forbiddenCode: "CALENDAR_BUSY_FORBIDDEN",
        forbiddenMessage:
          "Google Calendar did not allow ReadSlot to read free/busy availability for the selected calendars. Check the connected account and granted permissions."
      },
      {
        method: "POST",
        body: JSON.stringify({
          timeMin: start,
          timeMax: end,
          timeZone: timezone,
          items: calendarIds.map((id) => ({ id }))
        })
      }
    );
    if (!response.ok) return response;
    return ok(
      Object.values(response.value.calendars ?? {}).flatMap((calendar) => calendar.busy ?? [])
    );
  }

  async getEvent(
    calendarId: string,
    eventId: string
  ): Promise<Result<{ id: string; start: string; end: string } | undefined>> {
    const response = await this.request<{
      id: string;
      start?: { dateTime?: string };
      end?: { dateTime?: string };
    }>(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        forbiddenCode: "CALENDAR_READ_ONLY",
        forbiddenMessage: "The selected calendar is not writable."
      }
    );
    if (!response.ok) {
      if (response.error.code === "CALENDAR_EVENT_NOT_FOUND") return ok(undefined);
      return response;
    }
    if (!response.value.start?.dateTime || !response.value.end?.dateTime) return ok(undefined);
    return ok({
      id: response.value.id,
      start: response.value.start.dateTime,
      end: response.value.end.dateTime
    });
  }

  async createEvent(
    input: CreateCalendarEventInput
  ): Promise<Result<{ id: string; start: string; end: string }>> {
    const response = await this.request<{
      id: string;
      start: { dateTime: string };
      end: { dateTime: string };
    }>(
      `/calendars/${encodeURIComponent(input.calendarId)}/events`,
      {
        forbiddenCode: "CALENDAR_READ_ONLY",
        forbiddenMessage: "The selected calendar is not writable."
      },
      {
        method: "POST",
        body: JSON.stringify({
          id: input.eventId,
        summary: input.title,
        description: input.description,
        start: { dateTime: input.start, timeZone: input.timezone },
        end: { dateTime: input.end, timeZone: input.timezone },
        transparency: input.transparency,
        reminders:
          input.reminderMinutes === undefined
            ? { useDefault: false }
            : {
                useDefault: false,
                overrides: [{ method: "popup", minutes: input.reminderMinutes }]
              },
        extendedProperties: { private: input.privateProperties }
      })
      }
    );
    if (!response.ok) return response;
    return ok({
      id: response.value.id,
      start: response.value.start.dateTime,
      end: response.value.end.dateTime
    });
  }
}
