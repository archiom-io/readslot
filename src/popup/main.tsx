import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CapturePreview, ItemStatus, ReadingItem } from "../domain/schemas";
import { sendMessage } from "../shared/client";
import { Notice, formatMinutes } from "../shared/ui";

type NoticeState = { tone: "info" | "success" | "danger"; text: string };

const blockedScheduleStatuses: ItemStatus[] = ["scheduled", "in_progress", "completed", "archived"];

const statusLabel = (status?: ItemStatus): string =>
  status ? status.replaceAll("_", " ") : "saved";

export const PopupApp = () => {
  const [preview, setPreview] = useState<CapturePreview>();
  const [notice, setNotice] = useState<NoticeState>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [undoItemId, setUndoItemId] = useState<string>();

  const loadPreview = async () => {
    setLoading(true);
    const result = await sendMessage<CapturePreview>({ type: "capture.preview", payload: {} });
    if (result.ok) setPreview(result.value);
    else setNotice({ tone: "danger", text: result.error.message });
    setLoading(false);
  };

  useEffect(() => {
    void loadPreview();
  }, []);

  const openPage = async (page: "queue.html" | "planner.html", itemId?: string): Promise<void> => {
    const result = await sendMessage<void>({
      type: "navigation.open",
      payload: { page, itemId }
    });
    if (result.ok) window.close();
    else setNotice({ tone: "danger", text: result.error.message });
  };

  const capture = async (): Promise<ReadingItem | undefined> => {
    setBusy(true);
    const result = await sendMessage<{ item: ReadingItem; duplicate: boolean }>({
      type: "capture.current",
      payload: {}
    });
    setBusy(false);
    if (!result.ok) {
      setNotice({ tone: "danger", text: result.error.message });
      return undefined;
    }
    const { item, duplicate } = result.value;
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
    setNotice({
      tone: duplicate ? "info" : "success",
      text: duplicate ? "Already saved in ReadSlot." : "Saved to ReadSlot."
    });
    return item;
  };

  const saveForLater = async () => {
    await capture();
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

          <div className="popup-actions">
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
      <p className="popup-footer subtle">Nothing is booked without your confirmation.</p>
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
