import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { isWritableCalendar } from "../domain/calendar";
import { SettingsSchema, type Settings } from "../domain/schemas";
import type { CalendarSummary } from "../domain/ports";
import { sendMessage } from "../shared/client";
import { Notice, PageShell } from "../shared/ui";

interface CalendarStatus {
  configured: boolean;
  connected: boolean;
}

const App = () => {
  const [settings, setSettings] = useState<Settings>();
  const [calendars, setCalendars] = useState<CalendarSummary[]>([]);
  const [calendarsLoaded, setCalendarsLoaded] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>({
    configured: false,
    connected: false
  });
  const [notice, setNotice] = useState<{ tone: "success" | "danger" | "info"; text: string }>();
  const [confirmation, setConfirmation] = useState("");
  const selectedCalendarId = settings?.destinationCalendarId ?? "primary";
  const selectedCalendar =
    calendarsLoaded && calendarStatus.connected
      ? calendars.find((calendar) => calendar.id === selectedCalendarId) ??
        (selectedCalendarId === "primary"
          ? calendars.find((calendar) => calendar.primary)
          : undefined)
      : undefined;
  const selectedCalendarWritable = selectedCalendar
    ? isWritableCalendar(selectedCalendar.accessRole)
    : false;
  const selectedCalendarLabel =
    selectedCalendar?.summary ?? (selectedCalendarId === "primary" ? "Primary calendar" : "Selected calendar");

  const load = async () => {
    setCalendarsLoaded(false);
    const [settingsResult, statusResult] = await Promise.all([
      sendMessage<Settings>({ type: "settings.get", payload: {} }),
      sendMessage<CalendarStatus>({ type: "calendar.status", payload: {} })
    ]);
    if (settingsResult.ok) setSettings(settingsResult.value);
    if (statusResult.ok) {
      setCalendarStatus(statusResult.value);
      if (statusResult.value.connected) {
        const calendarResult = await sendMessage<CalendarSummary[]>({
          type: "calendar.list",
          payload: {}
        });
        if (calendarResult.ok) setCalendars(calendarResult.value);
        setCalendarsLoaded(true);
      }
    }
    if (!statusResult.ok || !statusResult.value.connected) setCalendarsLoaded(true);
  };
  useEffect(() => {
    void load();
  }, []);

  const connect = async () => {
    const result = await sendMessage({ type: "calendar.connect", payload: {} });
    if (result.ok) {
      setNotice({ tone: "success", text: "Google Calendar connected." });
      await load();
    } else setNotice({ tone: "danger", text: result.error.message });
  };
  const disconnect = async () => {
    const result = await sendMessage({ type: "calendar.disconnect", payload: {} });
    if (result.ok) {
      setNotice({
        tone: "success",
        text: "Google Calendar access revoked. Saved queue items remain on this device."
      });
      setCalendars([]);
      await load();
    } else {
      setNotice({ tone: "danger", text: result.error.message });
      setCalendars([]);
      await load();
    }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    const parsed = SettingsSchema.safeParse(settings);
    if (!parsed.success)
      return setNotice({ tone: "danger", text: "Check the scheduling values and try again." });
    const result = await sendMessage<Settings>({
      type: "settings.update",
      payload: { settings: parsed.data }
    });
    setNotice(
      result.ok
        ? { tone: "success", text: "Preferences saved locally." }
        : { tone: "danger", text: result.error.message }
    );
  };
  const reset = async () => {
    if (confirmation !== "DELETE READSLOT DATA") return;
    const result = await sendMessage({
      type: "data.reset",
      payload: { confirmation: "DELETE READSLOT DATA" }
    });
    if (result.ok) {
      setNotice({ tone: "success", text: "All local ReadSlot data was deleted." });
      setConfirmation("");
      await load();
    }
  };
  const exportDiagnostics = async () => {
    const result = await sendMessage<Record<string, unknown>>({
      type: "diagnostics.get",
      payload: {}
    });
    if (!result.ok) return setNotice({ tone: "danger", text: result.error.message });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([JSON.stringify(result.value, null, 2)], { type: "application/json" })
    );
    link.download = "readslot-diagnostics.json";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!settings)
    return (
      <PageShell eyebrow="Preferences" title="Settings">
        <Notice>Loading local settings…</Notice>
      </PageShell>
    );
  return (
    <PageShell eyebrow="Preferences" title="Settings">
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      <div className="split">
        <form className="panel" onSubmit={(event) => void save(event)}>
          <h2>Reading windows</h2>
          <div className="form-grid">
            <label>
              Earliest start
              <input
                type="time"
                value={settings.earliestStart}
                onChange={(event) =>
                  setSettings({ ...settings, earliestStart: event.target.value })
                }
              />
            </label>
            <label>
              Latest end
              <input
                type="time"
                value={settings.latestEnd}
                onChange={(event) => setSettings({ ...settings, latestEnd: event.target.value })}
              />
            </label>
            <label>
              Preferred block (minutes)
              <input
                type="number"
                min="5"
                max="1440"
                value={settings.preferredBlockMinutes}
                onChange={(event) =>
                  setSettings({ ...settings, preferredBlockMinutes: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Minimum block (minutes)
              <input
                type="number"
                min="5"
                max="1440"
                value={settings.minimumBlockMinutes}
                onChange={(event) =>
                  setSettings({ ...settings, minimumBlockMinutes: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Maximum block (minutes)
              <input
                type="number"
                min="5"
                max="1440"
                value={settings.maximumBlockMinutes}
                onChange={(event) =>
                  setSettings({ ...settings, maximumBlockMinutes: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Planning horizon (days)
              <input
                type="number"
                min="1"
                max="90"
                value={settings.planningHorizonDays}
                onChange={(event) =>
                  setSettings({ ...settings, planningHorizonDays: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Minimum notice (minutes)
              <input
                type="number"
                min="0"
                max="10080"
                value={settings.minimumNoticeMinutes}
                onChange={(event) =>
                  setSettings({ ...settings, minimumNoticeMinutes: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Maximum blocks per day
              <input
                type="number"
                min="1"
                max="20"
                value={settings.maximumBlocksPerDay}
                onChange={(event) =>
                  setSettings({ ...settings, maximumBlocksPerDay: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Reading speed (WPM)
              <input
                type="number"
                min="50"
                max="1000"
                value={settings.readingSpeedWpm}
                onChange={(event) =>
                  setSettings({ ...settings, readingSpeedWpm: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Default unknown duration
              <input
                type="number"
                min="5"
                max="480"
                value={settings.defaultUnknownMinutes}
                onChange={(event) =>
                  setSettings({ ...settings, defaultUnknownMinutes: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Buffer before events
              <input
                type="number"
                min="0"
                max="240"
                value={settings.bufferBeforeMinutes}
                onChange={(event) =>
                  setSettings({ ...settings, bufferBeforeMinutes: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Buffer after events
              <input
                type="number"
                min="0"
                max="240"
                value={settings.bufferAfterMinutes}
                onChange={(event) =>
                  setSettings({ ...settings, bufferAfterMinutes: Number(event.target.value) })
                }
              />
            </label>
            <label className="wide">
              Time zone
              <input
                value={settings.timezone}
                onChange={(event) => setSettings({ ...settings, timezone: event.target.value })}
              />
            </label>
            <fieldset className="wide">
              <legend>Allowed days</legend>
              <div className="actions">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, day) => (
                  <label className="check-row" key={label}>
                    <input
                      type="checkbox"
                      checked={settings.allowedWeekdays.includes(day)}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          allowedWeekdays: event.target.checked
                            ? [...settings.allowedWeekdays, day].sort()
                            : settings.allowedWeekdays.filter((value) => value !== day)
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="check-row wide">
              <input
                type="checkbox"
                checked={settings.privacyMode}
                onChange={(event) =>
                  setSettings({ ...settings, privacyMode: event.target.checked })
                }
              />
              Strip suspicious query parameters in privacy mode
            </label>
            <label className="check-row wide">
              <input
                type="checkbox"
                checked={settings.weeklyPlanningNotification}
                onChange={(event) =>
                  setSettings({ ...settings, weeklyPlanningNotification: event.target.checked })
                }
              />
              Weekly planning reminder
            </label>
          </div>
          <div className="actions" style={{ marginTop: 18 }}>
            <button className="button button-primary" type="submit">
              Save preferences
            </button>
          </div>
        </form>

        <div>
          <section className="panel sticky">
            <h2>Google Calendar</h2>
            {!calendarStatus.configured ? (
              <Notice tone="warning">OAuth is not configured for this build.</Notice>
            ) : calendarStatus.connected ? (
              <>
                <Notice tone="success">Connected</Notice>
                <label>
                  Destination calendar
                  <select
                    value={selectedCalendarId}
                    onChange={(event) =>
                      setSettings({ ...settings, destinationCalendarId: event.target.value })
                    }
                  >
                    <option value="primary">Primary calendar</option>
                    {calendars.map((calendar) => (
                      <option
                        key={calendar.id}
                        value={calendar.id}
                        disabled={!isWritableCalendar(calendar.accessRole)}
                      >
                        {calendar.summary}
                      </option>
                    ))}
                  </select>
                </label>
                {calendarsLoaded && (
                  <>
                    <p className="subtle" aria-live="polite" style={{ marginTop: 8 }}>
                      <strong>{selectedCalendarLabel}:</strong>{" "}
                      {selectedCalendar
                        ? selectedCalendarWritable
                          ? "writable"
                          : "read-only"
                        : "not currently in the connected account"}
                    </p>
                    {!selectedCalendarWritable && (
                      <Notice tone="warning">
                        Choose a calendar where you have writer or owner access before creating an
                        event.
                      </Notice>
                    )}
                  </>
                )}
                <button
                  className="button button-secondary"
                  style={{ marginTop: 14 }}
                  onClick={() => void disconnect()}
                >
                  Disconnect and revoke access
                </button>
                <p className="subtle">
                  This removes ReadSlot's Google authorization. Existing Calendar events and your
                  local queue are not deleted.
                </p>
              </>
            ) : (
              <>
                <p>
                  Connect only when you are ready to check availability. Event creation still
                  requires confirmation.
                </p>
                <button className="button button-primary" onClick={() => void connect()}>
                  Connect Google
                </button>
              </>
            )}
          </section>
          <section className="panel">
            <h2>Local diagnostics</h2>
            <p>
              Exports only version, OAuth configuration state, and generation time—never tokens,
              saved URLs, or Calendar contents.
            </p>
            <button className="button button-secondary" onClick={() => void exportDiagnostics()}>
              Export diagnostics
            </button>
          </section>
        </div>
      </div>

      <section className="panel danger-zone" style={{ marginTop: 24 }}>
        <h2>Delete local data</h2>
        <p>
          This permanently removes the queue, proposals, sessions, and settings. Calendar events are
          not deleted.
        </p>
        <div className="actions">
          <label>
            Type DELETE READSLOT DATA
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </label>
          <button
            className="button button-danger"
            disabled={confirmation !== "DELETE READSLOT DATA"}
            onClick={() => void reset()}
          >
            Delete everything
          </button>
        </div>
      </section>
    </PageShell>
  );
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
