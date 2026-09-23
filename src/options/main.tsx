import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { clsx } from "clsx";
import { isWritableCalendar } from "../domain/calendar";
import {
  SettingsSchema,
  type DailyHabitReminder,
  type ReadingWindow,
  type Settings
} from "../domain/schemas";
import type { CalendarSummary } from "../domain/ports";
import { sendMessage } from "../shared/client";
import { Notice, PageShell } from "../shared/ui";

interface CalendarStatus {
  configured: boolean;
  connected: boolean;
}

const DAYS: Array<{ day: number; label: string }> = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
  { day: 6, label: "Sat" },
  { day: 0, label: "Sun" }
];

const DURATION_PRESETS = [10, 15, 20, 30, 45, 60];

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
      ? (calendars.find((calendar) => calendar.id === selectedCalendarId) ??
        (selectedCalendarId === "primary"
          ? calendars.find((calendar) => calendar.primary)
          : undefined))
      : undefined;
  const selectedCalendarWritable = selectedCalendar
    ? isWritableCalendar(selectedCalendar.accessRole)
    : false;
  const selectedCalendarLabel =
    selectedCalendar?.summary ??
    (selectedCalendarId === "primary" ? "Primary calendar" : "Selected calendar");

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
        else setCalendars([]);
        setCalendarsLoaded(true);
      }
    }
    if (!statusResult.ok || !statusResult.value.connected) {
      setCalendars([]);
      setCalendarsLoaded(true);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (settings && window.location.hash === "#reading-windows") {
      setTimeout(() => {
        document.getElementById("reading-windows")?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    }
  }, [settings]);

  const currentWindows: ReadingWindow[] =
    settings?.readingWindows && settings.readingWindows.length > 0
      ? settings.readingWindows
      : settings
        ? [
            {
              id: "evening",
              label: "Evening",
              start: settings.earliestStart || "18:00",
              end: settings.latestEnd || "21:00",
              days: settings.allowedWeekdays || [1, 2, 3, 4, 5],
              enabled: true
            }
          ]
        : [];

  const updateWindows = (newWindows: ReadingWindow[]) => {
    if (!settings) return;
    setSettings({
      ...settings,
      readingWindows: newWindows,
      earliestStart: newWindows[0]?.start ?? settings.earliestStart,
      latestEnd: newWindows[0]?.end ?? settings.latestEnd
    });
  };

  const handleAddWindow = () => {
    const newWindow: ReadingWindow = {
      id: crypto.randomUUID(),
      label: `Reading slot ${currentWindows.length + 1}`,
      start: "12:30",
      end: "13:15",
      days: [1, 2, 3, 4, 5],
      enabled: true
    };
    updateWindows([...currentWindows, newWindow]);
  };

  const handleRemoveWindow = (id: string) => {
    if (currentWindows.length <= 1) return;
    updateWindows(currentWindows.filter((w) => w.id !== id));
  };

  const handleUpdateWindow = (id: string, updates: Partial<ReadingWindow>) => {
    updateWindows(currentWindows.map((w) => (w.id === id ? { ...w, ...updates } : w)));
  };

  const handleToggleDay = (id: string, day: number) => {
    const target = currentWindows.find((w) => w.id === id);
    if (!target) return;
    const exists = target.days.includes(day);
    if (exists && target.days.length === 1) return;
    const nextDays = exists ? target.days.filter((d) => d !== day) : [...target.days, day].sort();
    handleUpdateWindow(id, { days: nextDays });
  };

  const handleSetDayPreset = (id: string, preset: "weekdays" | "weekends" | "all") => {
    const days =
      preset === "weekdays"
        ? [1, 2, 3, 4, 5]
        : preset === "weekends"
          ? [6, 0]
          : [0, 1, 2, 3, 4, 5, 6];
    handleUpdateWindow(id, { days });
  };

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
          <div id="reading-windows" style={{ marginBottom: 22 }}>
            <div className="windows-section-header">
              <div>
                <h2 style={{ margin: 0 }}>Reading windows</h2>
                <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13.5 }}>
                  Configure when ReadSlot looks for reading time in your calendar.
                </p>
              </div>
              <button
                type="button"
                className="button button-secondary"
                style={{ padding: "6px 12px", fontSize: 13 }}
                onClick={handleAddWindow}
              >
                + Add window
              </button>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {currentWindows.map((win) => (
                <div key={win.id} className={clsx("window-card", !win.enabled && "is-disabled")}>
                  <div className="window-card-header">
                    <div className="window-card-header-left">
                      <input
                        type="checkbox"
                        checked={win.enabled}
                        aria-label={`Enable ${win.label} window`}
                        onChange={(e) => handleUpdateWindow(win.id, { enabled: e.target.checked })}
                      />
                      <input
                        type="text"
                        className="window-title-input"
                        value={win.label}
                        aria-label="Window label"
                        placeholder="Window name"
                        onChange={(e) => handleUpdateWindow(win.id, { label: e.target.value })}
                      />
                    </div>
                    {currentWindows.length > 1 && (
                      <button
                        type="button"
                        className="button-quiet"
                        style={{ color: "var(--muted)", fontSize: 16 }}
                        title="Delete window"
                        aria-label={`Delete ${win.label} window`}
                        onClick={() => handleRemoveWindow(win.id)}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="window-card-body">
                    <div className="window-times-row">
                      <input
                        type="time"
                        value={win.start}
                        aria-label={`${win.label} start time`}
                        onChange={(e) => handleUpdateWindow(win.id, { start: e.target.value })}
                      />
                      <span style={{ color: "var(--muted)", fontSize: 13 }}>to</span>
                      <input
                        type="time"
                        value={win.end}
                        aria-label={`${win.label} end time`}
                        onChange={(e) => handleUpdateWindow(win.id, { end: e.target.value })}
                      />
                    </div>

                    <div className="day-selector-group">
                      {DAYS.map(({ day, label }) => {
                        const selected = win.days.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            className={clsx("day-pill", selected && "is-selected")}
                            aria-pressed={selected}
                            onClick={() => handleToggleDay(win.id, day)}
                          >
                            {label}
                          </button>
                        );
                      })}
                      <span style={{ color: "var(--line)", margin: "0 2px" }}>|</span>
                      <button
                        type="button"
                        className="day-quick-btn"
                        onClick={() => handleSetDayPreset(win.id, "weekdays")}
                      >
                        Weekdays
                      </button>
                      <button
                        type="button"
                        className="day-quick-btn"
                        onClick={() => handleSetDayPreset(win.id, "weekends")}
                      >
                        Weekends
                      </button>
                      <button
                        type="button"
                        className="day-quick-btn"
                        onClick={() => handleSetDayPreset(win.id, "all")}
                      >
                        All
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 22 }}>
            <div style={{ fontWeight: 750, fontSize: 15, display: "block", marginBottom: 4 }}>
              Target reading block duration
            </div>
            <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: 13.5 }}>
              Choose your preferred session length, or specify custom minutes.
            </p>
            <div className="duration-chips">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={clsx(
                    "duration-chip",
                    settings.preferredBlockMinutes === preset && "is-active"
                  )}
                  onClick={() => setSettings({ ...settings, preferredBlockMinutes: preset })}
                >
                  {preset} min
                </button>
              ))}
              <div className="custom-duration-container">
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Custom:</span>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  className="custom-duration-input"
                  aria-label="Custom target duration in minutes"
                  value={
                    !DURATION_PRESETS.includes(settings.preferredBlockMinutes)
                      ? settings.preferredBlockMinutes
                      : ""
                  }
                  placeholder="min"
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val >= 5 && val <= 1440) {
                      setSettings({ ...settings, preferredBlockMinutes: val });
                    }
                  }}
                />
                <span style={{ fontSize: 13, color: "var(--muted)" }}>min</span>
              </div>
            </div>
          </div>

          <div className="form-grid">
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

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8
                }}
              >
                <h3 style={{ margin: 0, fontSize: 15 }}>Daily Reading Reminders</h3>
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ fontSize: 12, padding: "4px 10px" }}
                  onClick={() => {
                    const newReminder: DailyHabitReminder = {
                      id: crypto.randomUUID(),
                      label: "Daily reading",
                      time: "20:00",
                      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                      enabled: true,
                      addToCalendar: false
                    };
                    setSettings({
                      ...settings,
                      dailyReminders: [...(settings.dailyReminders ?? []), newReminder]
                    });
                  }}
                >
                  + Add daily reminder
                </button>
              </div>
              <p className="subtle" style={{ fontSize: 13, marginBottom: 12 }}>
                Set multiple recurring alerts to build a daily reading habit.
              </p>

              {(settings.dailyReminders ?? []).length === 0 ? (
                <p style={{ fontSize: 13, color: "#888", fontStyle: "italic" }}>
                  No daily habit reminders configured yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {settings.dailyReminders.map((reminder, index) => (
                    <div
                      key={reminder.id}
                      style={{
                        padding: 12,
                        borderRadius: 6,
                        border: "1px solid #e5e7eb",
                        backgroundColor: "#fafafa"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                          flexWrap: "wrap",
                          marginBottom: 8
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 13
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={reminder.enabled}
                            onChange={(e) => {
                              const updated = [...settings.dailyReminders];
                              updated[index] = { ...reminder, enabled: e.target.checked };
                              setSettings({ ...settings, dailyReminders: updated });
                            }}
                          />
                          <strong>Active</strong>
                        </label>
                        <input
                          type="text"
                          placeholder="Label (e.g. Daily newspaper study)"
                          value={reminder.label}
                          style={{
                            flex: 1,
                            minWidth: 140,
                            padding: "4px 8px",
                            fontSize: 13,
                            borderRadius: 4,
                            border: "1px solid #ccc"
                          }}
                          onChange={(e) => {
                            const updated = [...settings.dailyReminders];
                            updated[index] = { ...reminder, label: e.target.value };
                            setSettings({ ...settings, dailyReminders: updated });
                          }}
                        />
                        <input
                          type="time"
                          value={reminder.time}
                          style={{
                            padding: "4px 8px",
                            fontSize: 13,
                            borderRadius: 4,
                            border: "1px solid #ccc"
                          }}
                          onChange={(e) => {
                            const updated = [...settings.dailyReminders];
                            updated[index] = { ...reminder, time: e.target.value };
                            setSettings({ ...settings, dailyReminders: updated });
                          }}
                        />
                        <button
                          type="button"
                          className="button button-danger"
                          style={{ fontSize: 11, padding: "3px 8px" }}
                          onClick={() => {
                            const updated = settings.dailyReminders.filter((_, i) => i !== index);
                            setSettings({ ...settings, dailyReminders: updated });
                          }}
                        >
                          Remove
                        </button>
                      </div>

                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                        {[
                          { day: 0, label: "Sun" },
                          { day: 1, label: "Mon" },
                          { day: 2, label: "Tue" },
                          { day: 3, label: "Wed" },
                          { day: 4, label: "Thu" },
                          { day: 5, label: "Fri" },
                          { day: 6, label: "Sat" }
                        ].map(({ day, label }) => (
                          <label
                            key={day}
                            style={{
                              fontSize: 11,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              cursor: "pointer",
                              background: reminder.daysOfWeek.includes(day) ? "#e0e7ff" : "#fff",
                              padding: "2px 6px",
                              borderRadius: 4,
                              border: "1px solid #d1d5db"
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={reminder.daysOfWeek.includes(day)}
                              onChange={(e) => {
                                const nextDays = e.target.checked
                                  ? [...reminder.daysOfWeek, day].sort()
                                  : reminder.daysOfWeek.filter((d) => d !== day);
                                const updated = [...settings.dailyReminders];
                                updated[index] = { ...reminder, daysOfWeek: nextDays };
                                setSettings({ ...settings, dailyReminders: updated });
                              }}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
