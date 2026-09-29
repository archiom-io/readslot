import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { isWritableCalendar } from "../domain/calendar";
import type { CalendarSummary } from "../domain/ports";
import type { DomainError } from "../domain/result";
import type { CapturePreview, ItemStatus, ReadingItem, Settings } from "../domain/schemas";
import { sendMessage } from "../shared/client";
import { Icon } from "../shared/icons";
import { Notice, formatMinutes } from "../shared/ui";

type NoticeState = { tone: "info" | "success" | "warning" | "danger"; text: string };

interface CalendarStatus {
  configured: boolean;
  connected: boolean;
  error?: DomainError;
}

type CaptureCalendarSync =
  | { status: "not_requested" }
  | { status: "synced"; calendarId: string; eventId: string }
  | { status: "failed"; error: DomainError };

interface CaptureResponse {
  item: ReadingItem;
  duplicate: boolean;
  calendarSync?: CaptureCalendarSync;
}

const blockedScheduleStatuses: ItemStatus[] = ["scheduled", "in_progress", "completed", "archived"];

const statusLabel = (status?: ItemStatus): string =>
  status ? status.replaceAll("_", " ") : "saved";

const dailyActionLabel = (duplicate: boolean): string =>
  duplicate ? "Update daily reminder" : "Save daily reminder";

export const PopupApp = () => {
  const [preview, setPreview] = useState<CapturePreview>();
  const [notice, setNotice] = useState<NoticeState>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [undoItemId, setUndoItemId] = useState<string>();
  const [dailyReminder, setDailyReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState("20:00");
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>();
  const [calendarName, setCalendarName] = useState<string>();
  const [calendarWritable, setCalendarWritable] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarNotice, setCalendarNotice] = useState<NoticeState>();

  const loadPreview = async () => {
    setLoading(true);
    const result = await sendMessage<CapturePreview>({ type: "capture.preview", payload: {} });
    if (result.ok) setPreview(result.value);
    else setNotice({ tone: "danger", text: result.error.message });
    setLoading(false);
  };

  const loadCalendar = async (): Promise<boolean> => {
    setCalendarLoading(true);
    const statusResult = await sendMessage<CalendarStatus>({
      type: "calendar.status",
      payload: {}
    });
    if (!statusResult.ok) {
      setCalendarNotice({ tone: "danger", text: statusResult.error.message });
      setCalendarLoading(false);
      return false;
    }
    setCalendarStatus(statusResult.value);
    setCalendarWritable(false);
    setCalendarName(undefined);
    if (!statusResult.value.connected) {
      setCalendarLoading(false);
      return true;
    }

    const [settingsResult, calendarsResult] = await Promise.all([
      sendMessage<Settings>({ type: "settings.get", payload: {} }),
      sendMessage<CalendarSummary[]>({ type: "calendar.list", payload: {} })
    ]);
    if (!settingsResult.ok) {
      setCalendarNotice({ tone: "danger", text: settingsResult.error.message });
      setCalendarLoading(false);
      return false;
    }
    if (!calendarsResult.ok) {
      setCalendarNotice({ tone: "danger", text: calendarsResult.error.message });
      setCalendarLoading(false);
      return false;
    }
    const selectedId = settingsResult.value.destinationCalendarId ?? "primary";
    const selected =
      calendarsResult.value.find((calendar) => calendar.id === selectedId) ??
      (selectedId === "primary"
        ? calendarsResult.value.find((calendar) => calendar.primary)
        : undefined);
    setCalendarName(selected?.summary);
    setCalendarWritable(Boolean(selected && isWritableCalendar(selected.accessRole)));
    setCalendarLoading(false);
    return true;
  };

  useEffect(() => {
    void loadPreview();
    void loadCalendar();
  }, []);

  const connectCalendar = async (): Promise<void> => {
    setCalendarBusy(true);
    setCalendarNotice(undefined);
    const result = await sendMessage<{ connected: boolean }>({
      type: "calendar.connect",
      payload: {}
    });
    if (!result.ok) {
      setCalendarNotice({ tone: "danger", text: result.error.message });
      setCalendarBusy(false);
      return;
    }
    const loaded = await loadCalendar();
    if (loaded) setCalendarNotice({ tone: "success", text: "Google Calendar connected." });
    setCalendarBusy(false);
  };

  const openPage = async (
    page: "queue.html" | "planner.html" | "session.html" | "options.html",
    itemId?: string
  ): Promise<void> => {
    const result = await sendMessage<void>({
      type: "navigation.open",
      payload: { page, itemId }
    });
    if (result.ok) window.close();
    else setNotice({ tone: "danger", text: result.error.message });
  };

  const capture = async (
    calendarSyncRequested = addToCalendar
  ): Promise<ReadingItem | undefined> => {
    setBusy(true);
    const recurrence = dailyReminder
      ? {
          enabled: true,
          time: reminderTime,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          addToCalendar: calendarSyncRequested
        }
      : undefined;
    const result = await sendMessage<CaptureResponse>({
      type: "capture.current",
      payload: recurrence ? { recurrence } : {}
    });
    setBusy(false);
    if (!result.ok) {
      setNotice({ tone: "danger", text: result.error.message });
      return undefined;
    }
    const { item, duplicate } = result.value;
    const calendarSync = result.value.calendarSync;
    setPreview((current) =>
      current
        ? {
            ...current,
            duplicate: true,
            existingItemId: item.id,
            existingItemStatus: item.status
          }
        : current
    );
    setUndoItemId(duplicate ? undefined : item.id);
    if (calendarSync?.status === "failed") {
      setNotice({
        tone: "warning",
        text: `Saved locally, but Calendar sync failed: ${calendarSync.error.message}`
      });
    } else {
      setNotice({
        tone: duplicate ? "info" : "success",
        text: dailyReminder
          ? calendarSync?.status === "synced"
            ? `${duplicate ? "Updated" : "Saved"} and synced daily at ${reminderTime}.`
            : `${duplicate ? "Updated" : "Saved"} daily reminder for ${reminderTime}.`
          : duplicate
            ? "Already saved in ReadSlot."
            : "Saved to ReadSlot."
      });
    }
    return item;
  };

  const saveForLater = async () => {
    await capture();
  };

  const saveDailyLocally = async () => {
    await capture(false);
  };

  const saveAndSchedule = async () => {
    let itemId =
      preview?.duplicate && ["queued", "proposed"].includes(preview.existingItemStatus ?? "")
        ? preview.existingItemId
        : undefined;
    if (!itemId) itemId = (await capture())?.id;
    if (itemId) await openPage("planner.html", itemId);
  };

  const undo = async () => {
    if (!undoItemId) return;
    setBusy(true);
    const result = await sendMessage<void>({
      type: "capture.undo",
      payload: { itemId: undoItemId }
    });
    setBusy(false);
    if (!result.ok) {
      setNotice({ tone: "danger", text: result.error.message });
      return;
    }
    setPreview((current) =>
      current
        ? { ...current, duplicate: true, existingItemStatus: "deleted", existingItemId: undoItemId }
        : current
    );
    setUndoItemId(undefined);
    setNotice({ tone: "info", text: "Save undone. The item is in Trash." });
  };

  const scheduleBlocked =
    preview?.duplicate && blockedScheduleStatuses.includes(preview.existingItemStatus ?? "queued");
  const alreadyActive = preview?.duplicate && preview.existingItemStatus !== "deleted";
  const calendarReady = Boolean(calendarStatus?.connected && calendarWritable);

  return (
    <main className="popup-shell">
      <header className="popup-brand">
        <img className="brand-mark" src="icons/readslot.svg" alt="" aria-hidden="true" />
        <span>ReadSlot</span>
      </header>

      {loading ? (
        <section className="panel popup-loading" aria-live="polite">
          Checking this page…
        </section>
      ) : preview ? (
        <section className="panel popup-card" aria-labelledby="popup-title">
          <p className="eyebrow">Save this page</p>
          <h1 id="popup-title" className="popup-title" title={preview.title}>
            {preview.title}
          </h1>
          <div className="meta">
            <span>{preview.domain}</span>
            <span>·</span>
            <strong>{formatMinutes(preview.estimatedMinutes)}</strong>
            <span className="pill">{preview.estimateConfidence} estimate</span>
          </div>

          {preview.duplicate && !notice && (
            <Notice tone={scheduleBlocked ? "warning" : "info"}>
              {preview.existingItemStatus === "deleted"
                ? "This page is in Trash."
                : `Already saved in ReadSlot · ${statusLabel(preview.existingItemStatus)}`}
            </Notice>
          )}
          {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
          {calendarNotice && <Notice tone={calendarNotice.tone}>{calendarNotice.text}</Notice>}

          <div className="popup-calendar-status" aria-live="polite">
            <div className="popup-calendar-copy">
              <Icon name="calendar" size={18} />
              <div>
                <strong>Google Calendar</strong>
                <span>
                  {!calendarStatus || calendarLoading
                    ? "Checking connection…"
                    : !calendarStatus.configured
                      ? "Unavailable in this build"
                      : !calendarStatus.connected
                        ? "Connect to schedule and sync"
                        : calendarWritable
                          ? `Connected${calendarName ? ` · ${calendarName}` : ""}`
                          : "Choose a writable destination"}
                </span>
              </div>
            </div>
            {calendarStatus?.configured && !calendarStatus.connected && (
              <button
                type="button"
                className="button button-secondary popup-calendar-button"
                disabled={calendarBusy || busy}
                onClick={() => void connectCalendar()}
              >
                {calendarBusy ? "Connecting…" : "Connect"}
              </button>
            )}
            {calendarStatus?.connected && !calendarLoading && !calendarWritable && (
              <button
                type="button"
                className="button button-secondary popup-calendar-button"
                disabled={calendarBusy || busy}
                onClick={() => void openPage("options.html")}
              >
                Choose
              </button>
            )}
          </div>

          <div
            style={{
              marginTop: 10,
              marginBottom: 12,
              paddingTop: 8,
              borderTop: "1px solid #e5e7eb"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8
              }}
            >
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--ink)"
                }}
              >
                <input
                  type="checkbox"
                  aria-label="Set daily reminder"
                  checked={dailyReminder}
                  onChange={(e) => {
                    setDailyReminder(e.target.checked);
                    if (!e.target.checked) setAddToCalendar(false);
                  }}
                />
                <span>Remind daily at</span>
              </label>
              <input
                type="time"
                aria-label="Reminder time"
                value={reminderTime}
                disabled={!dailyReminder}
                onChange={(e) => setReminderTime(e.target.value)}
                style={{
                  width: "auto",
                  fontSize: 12,
                  padding: "3px 6px",
                  borderRadius: 6,
                  border: "1px solid var(--line)"
                }}
              />
            </div>
            {dailyReminder && (
              <>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 8,
                    marginLeft: 24,
                    fontSize: 12,
                    color: "var(--muted)",
                    cursor: "pointer"
                  }}
                >
                  <input
                    type="checkbox"
                    aria-label="Sync with Google Calendar"
                    checked={addToCalendar}
                    onChange={(e) => setAddToCalendar(e.target.checked)}
                  />
                  <span>Sync with Google Calendar</span>
                </label>
                <p className="popup-reminder-summary">
                  Every day at {reminderTime} · About {formatMinutes(preview.estimatedMinutes)}
                  {addToCalendar && calendarName ? ` · ${calendarName}` : ""}
                </p>
              </>
            )}
          </div>

          <div className="popup-actions">
            {dailyReminder ? (
              !scheduleBlocked && (
                <>
                  {addToCalendar && calendarLoading ? (
                    <button className="button button-primary" disabled>
                      Checking Calendar…
                    </button>
                  ) : addToCalendar && calendarStatus?.configured && !calendarStatus.connected ? (
                    <button
                      className="button button-primary"
                      disabled={busy || calendarBusy}
                      onClick={() => void connectCalendar()}
                    >
                      {calendarBusy ? "Connecting…" : "Connect Google Calendar"}
                    </button>
                  ) : addToCalendar && calendarStatus?.connected && !calendarWritable ? (
                    <button
                      className="button button-primary"
                      disabled={busy}
                      onClick={() => void openPage("options.html")}
                    >
                      Choose a writable calendar
                    </button>
                  ) : (
                    <button
                      className="button button-primary"
                      disabled={
                        busy || (addToCalendar && (!calendarStatus?.configured || !calendarReady))
                      }
                      onClick={() => void capture()}
                    >
                      {busy
                        ? "Saving…"
                        : addToCalendar
                          ? calendarStatus?.configured === false
                            ? "Calendar unavailable"
                            : "Confirm & sync daily"
                          : preview.existingItemStatus === "deleted"
                            ? "Restore with daily reminder"
                            : dailyActionLabel(preview.duplicate)}
                    </button>
                  )}
                  {addToCalendar && (
                    <button
                      className="button button-secondary"
                      disabled={busy || calendarBusy}
                      onClick={() => void saveDailyLocally()}
                    >
                      Save reminder locally
                    </button>
                  )}
                </>
              )
            ) : (
              <>
                <button
                  className="button button-secondary"
                  disabled={busy || Boolean(alreadyActive)}
                  onClick={() => void saveForLater()}
                >
                  {busy
                    ? "Saving…"
                    : preview.existingItemStatus === "deleted"
                      ? "Restore to queue"
                      : alreadyActive
                        ? "Already saved"
                        : "Save for later"}
                </button>
                {!scheduleBlocked && (
                  <button
                    className="button button-primary"
                    disabled={busy}
                    onClick={() => void saveAndSchedule()}
                  >
                    Save & choose time
                  </button>
                )}
              </>
            )}
            {undoItemId && (
              <button className="button button-quiet" disabled={busy} onClick={() => void undo()}>
                Undo save
              </button>
            )}
            <button
              className="button button-quiet"
              disabled={busy}
              onClick={() => void openPage("queue.html")}
            >
              Open queue
            </button>
          </div>
        </section>
      ) : (
        <section className="panel popup-card">
          {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
          <button className="button button-secondary" onClick={() => void openPage("queue.html")}>
            Open queue
          </button>
        </section>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 8
        }}
      >
        <p className="popup-footer subtle" style={{ margin: 0 }}>
          Nothing is booked without your confirmation.
        </p>
        <button
          className="button button-quiet"
          style={{ fontSize: 11, padding: "2px 6px" }}
          onClick={() => void openPage("options.html")}
          title="Configure reading windows and settings"
        >
          <Icon name="settings" size={14} />
          Windows
        </button>
      </div>
    </main>
  );
};

const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <StrictMode>
      <PopupApp />
    </StrictMode>
  );
