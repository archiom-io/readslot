import { StrictMode, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import clsx from "clsx";
import type {
  Backup,
  ItemStatus,
  Priority,
  ReadingItem,
  RecurrenceSchedule
} from "../domain/schemas";
import { extensionUrl, sendMessage } from "../shared/client";
import { EmptyState, Notice, PageShell, formatMinutes } from "../shared/ui";

type View = "all" | "queued" | "daily" | "scheduled" | "completed" | "archived" | "deleted";
type SortOption = "newest" | "oldest" | "shortest" | "longest" | "priority";

interface Stats {
  totalItems: number;
  queuedItems: number;
  scheduledItems: number;
  completedItems: number;
  queueMinutes: number;
  completedSessions: number;
}

const priorityWeight: Record<Priority, number> = {
  high: 4,
  normal: 3,
  low: 2,
  someday: 1
};

const views: Array<{ value: View; label: string }> = [
  { value: "queued", label: "Inbox" },
  { value: "daily", label: "Daily 🔁" },
  { value: "scheduled", label: "Scheduled" },
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
  { value: "deleted", label: "Trash" }
];

const isDoneToday = (item: ReadingItem): boolean => {
  if (!item.lastOpenedAt) return false;
  const last = new Date(item.lastOpenedAt);
  const now = new Date();
  return (
    last.getFullYear() === now.getFullYear() &&
    last.getMonth() === now.getMonth() &&
    last.getDate() === now.getDate()
  );
};

export const QueueApp = () => {
  const [allItems, setAllItems] = useState<ReadingItem[]>([]);
  const [stats, setStats] = useState<Stats>();
  const [view, setView] = useState<View>("queued");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "danger" | "info"; text: string }>();
  const [loading, setLoading] = useState(true);
  const [editingReminder, setEditingReminder] = useState<ReadingItem>();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showDataMenu, setShowDataMenu] = useState(false);
  const [reminderForm, setReminderForm] = useState<RecurrenceSchedule>({
    enabled: true,
    time: "20:00",
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    addToCalendar: false
  });

  const menuRef = useRef<HTMLDivElement>(null);
  const dataMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setActiveMenuId(null);
      }
      if (dataMenuRef.current && !dataMenuRef.current.contains(target)) {
        setShowDataMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const load = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    const [allResult, statsResult] = await Promise.all([
      sendMessage<ReadingItem[]>({
        type: "items.list",
        payload: { includeDeleted: true }
      }),
      sendMessage<Stats>({ type: "dashboard.stats", payload: {} })
    ]);

    if (allResult.ok) {
      setAllItems(allResult.value);
    } else {
      setNotice({ tone: "danger", text: allResult.error.message });
    }

    if (statsResult.ok) setStats(statsResult.value);
    setLoading(false);
  };

  useEffect(() => {
    void load(true);
  }, []);

  // Tab counts
  const tabCounts = useMemo(() => {
    const active = allItems.filter((i) => i.status !== "deleted");
    return {
      queued: active.filter((i) => i.status === "queued").length,
      daily: active.filter((i) => i.recurrence?.enabled).length,
      scheduled: active.filter((i) => i.status === "scheduled").length,
      all: active.length,
      completed: allItems.filter((i) => i.status === "completed").length,
      archived: allItems.filter((i) => i.status === "archived").length,
      deleted: allItems.filter((i) => i.status === "deleted").length
    };
  }, [allItems]);

  // Daily habit stats
  const dailyHabits = useMemo(
    () => allItems.filter((i) => i.status !== "deleted" && i.recurrence?.enabled),
    [allItems]
  );
  const dailyHabitsDone = useMemo(
    () => dailyHabits.filter((i) => isDoneToday(i)).length,
    [dailyHabits]
  );

  // Filtered & sorted items
  const displayedItems = useMemo(() => {
    let list = [...allItems];
    if (view === "daily") {
      list = list.filter((i) => i.status !== "deleted" && i.recurrence?.enabled);
    } else if (view === "deleted") {
      list = list.filter((i) => i.status === "deleted");
    } else if (view !== "all") {
      list = list.filter((i) => i.status === view);
    } else {
      list = list.filter((i) => i.status !== "deleted");
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((item) =>
        [
          item.title,
          item.originalUrl,
          item.domain,
          item.notes ?? "",
          item.collectionId ?? "",
          ...item.tags
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    switch (sort) {
      case "oldest":
        return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      case "shortest":
        return list.sort(
          (a, b) =>
            (a.plannedMinutes ?? a.estimatedMinutes) - (b.plannedMinutes ?? b.estimatedMinutes)
        );
      case "longest":
        return list.sort(
          (a, b) =>
            (b.plannedMinutes ?? b.estimatedMinutes) - (a.plannedMinutes ?? a.estimatedMinutes)
        );
      case "priority":
        return list.sort(
          (a, b) => (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0)
        );
      case "newest":
      default:
        return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  }, [allItems, view, search, sort]);

  const selectedItems = useMemo(
    () => displayedItems.filter((item) => selected.has(item.id)),
    [displayedItems, selected]
  );

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return;
    const result = await sendMessage<{ item: ReadingItem; duplicate: boolean }>({
      type: "capture.url",
      payload: { url }
    });
    if (result.ok) {
      setUrl("");
      setNotice({
        tone: result.value.duplicate ? "info" : "success",
        text: result.value.duplicate ? "That URL is already in ReadSlot." : "Saved to your queue."
      });
      await load();
    } else {
      setNotice({ tone: "danger", text: result.error.message });
    }
  };

  const update = async (
    id: string,
    changes: {
      status?: ItemStatus;
      priority?: Priority;
      plannedMinutes?: number;
      recurrence?: RecurrenceSchedule;
      lastOpenedAt?: string;
    }
  ) => {
    const result = await sendMessage<ReadingItem>({
      type: "items.update",
      payload: { id, changes }
    });
    if (!result.ok) setNotice({ tone: "danger", text: result.error.message });
    await load();
  };

  const remove = async (id: string, permanent = false) => {
    const result = await sendMessage<void>({ type: "items.remove", payload: { id, permanent } });
    if (!result.ok) setNotice({ tone: "danger", text: result.error.message });
    setSelected((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setActiveMenuId(null);
    await load();
  };

  const bulkStatus = async (status: ItemStatus) => {
    await Promise.all(selectedItems.map((item) => update(item.id, { status })));
    setSelected(new Set());
    setNotice({
      tone: "success",
      text: `Updated ${selectedItems.length} items.`
    });
  };

  const handleToggleDailyDone = async (item: ReadingItem) => {
    const markDone = !isDoneToday(item);
    await update(item.id, {
      status: "queued",
      lastOpenedAt: markDone ? new Date().toISOString() : undefined
    });
    setNotice({
      tone: "success",
      text: markDone
        ? `Finished reading today. Reminder scheduled again for ${item.recurrence?.time ?? "tomorrow"}.`
        : "Marked daily reading unread for today."
    });
  };

  const handleToggleComplete = async (item: ReadingItem) => {
    const nextStatus = item.status === "completed" ? "queued" : "completed";
    await update(item.id, { status: nextStatus });
    setNotice({
      tone: "success",
      text: nextStatus === "completed" ? "Marked as completed." : "Returned to queue."
    });
  };

  const exportBackup = async () => {
    setShowDataMenu(false);
    const result = await sendMessage<Backup>({ type: "backup.export", payload: {} });
    if (!result.ok) return setNotice({ tone: "danger", text: result.error.message });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([JSON.stringify(result.value, null, 2)], { type: "application/json" })
    );
    link.download = `readslot-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const downloadExport = async (format: "csv" | "markdown" | "bookmarks" | "urls") => {
    setShowDataMenu(false);
    const result = await sendMessage<{ filename: string; mimeType: string; text: string }>({
      type: "items.export",
      payload: { format }
    });
    if (!result.ok) return setNotice({ tone: "danger", text: result.error.message });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([result.value.text], { type: result.value.mimeType }));
    link.download = result.value.filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importBackup = async (file?: File) => {
    setShowDataMenu(false);
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text()) as Backup;
      if (
        !window.confirm(
          `Import ${backup.items?.length ?? 0} items from this ReadSlot backup? Existing URLs will be preserved.`
        )
      )
        return;
      const result = await sendMessage<{ added: number; skipped: number }>({
        type: "backup.import",
        payload: { backup }
      });
      if (!result.ok) throw new Error(result.error.message);
      setNotice({
        tone: "success",
        text: `Imported ${result.value.added} items; skipped ${result.value.skipped} duplicates.`
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "danger",
        text: error instanceof Error ? error.message : "That backup is not valid."
      });
    }
  };

  const importText = async (file?: File) => {
    setShowDataMenu(false);
    if (!file) return;
    const extension = file.name.split(".").at(-1)?.toLowerCase();
    const format =
      extension === "csv"
        ? "csv"
        : extension === "html" || extension === "htm"
          ? "html"
          : extension === "md"
            ? "markdown"
            : "urls";
    const text = await file.text();
    const preview = await sendMessage<{ added: number; skipped: number; invalid: number }>({
      type: "items.importText",
      payload: { format, text, preview: true }
    });
    if (!preview.ok) return setNotice({ tone: "danger", text: preview.error.message });
    if (
      !window.confirm(
        `Import ${preview.value.added} new URLs? ${preview.value.skipped} duplicates and ${preview.value.invalid} invalid entries will be skipped.`
      )
    )
      return;
    const result = await sendMessage<{ added: number; skipped: number; invalid: number }>({
      type: "items.importText",
      payload: { format, text, preview: false }
    });
    if (result.ok) {
      setNotice({ tone: "success", text: `Imported ${result.value.added} URLs.` });
      await load();
    } else setNotice({ tone: "danger", text: result.error.message });
  };

  return (
    <PageShell
      eyebrow="Reading queue"
      title="Make later happen."
      actions={
        <>
          <a
            className="button button-secondary"
            href={`${extensionUrl("options.html")}#reading-windows`}
            title="Configure reading windows and block durations"
          >
            ⚙️ Reading windows
          </a>
          <a className="button button-primary" href={extensionUrl("planner.html")}>
            Plan reading time
          </a>
          <div className="header-data-menu-container" ref={dataMenuRef}>
            <button
              className="button button-secondary"
              onClick={() => setShowDataMenu((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={showDataMenu}
            >
              Data &amp; Backups ▾
            </button>
            {showDataMenu && (
              <div className="header-data-dropdown" role="menu">
                <div className="data-menu-section-title">Backups</div>
                <button
                  className="data-menu-item"
                  role="menuitem"
                  onClick={() => void exportBackup()}
                >
                  📥 Export JSON backup
                </button>
                <label className="data-menu-item">
                  📤 Import JSON backup
                  <input
                    type="file"
                    accept="application/json"
                    hidden
                    onChange={(event) => void importBackup(event.target.files?.[0])}
                  />
                </label>
                <label className="data-menu-item">
                  📑 Import links (CSV, HTML, MD)
                  <input
                    type="file"
                    accept=".csv,.html,.htm,.md,.txt"
                    hidden
                    onChange={(event) => void importText(event.target.files?.[0])}
                  />
                </label>
                <div className="more-menu-divider" />
                <div className="data-menu-section-title">Export As</div>
                <button
                  className="data-menu-item"
                  role="menuitem"
                  onClick={() => void downloadExport("csv")}
                >
                  CSV
                </button>
                <button
                  className="data-menu-item"
                  role="menuitem"
                  onClick={() => void downloadExport("markdown")}
                >
                  Markdown
                </button>
                <button
                  className="data-menu-item"
                  role="menuitem"
                  onClick={() => void downloadExport("bookmarks")}
                >
                  Bookmarks HTML
                </button>
                <button
                  className="data-menu-item"
                  role="menuitem"
                  onClick={() => void downloadExport("urls")}
                >
                  URL list
                </button>
              </div>
            )}
          </div>
        </>
      }
    >
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <section className="grid grid-4" aria-label="Queue summary">
        <div className="panel stat">
          <span>Waiting to read</span>
          <strong>{stats?.queuedItems ?? "—"}</strong>
        </div>
        <div className="panel stat">
          <span>Queue commitment</span>
          <strong>{stats ? formatMinutes(stats.queueMinutes) : "—"}</strong>
        </div>
        <div className="panel stat">
          <span>Daily habits today</span>
          <strong>
            {dailyHabits.length > 0
              ? `${dailyHabitsDone} of ${dailyHabits.length} done`
              : "0 active"}
          </strong>
        </div>
        <div className="panel stat">
          <span>Completed total</span>
          <strong>{stats?.completedItems ?? "—"}</strong>
        </div>
      </section>

      <section className="panel quick-add-panel" style={{ marginTop: 22 }}>
        <form className="quick-add-form" onSubmit={(event) => void handleAdd(event)}>
          <span className="quick-add-icon" aria-hidden="true">
            🔗
          </span>
          <input
            type="url"
            required
            className="quick-add-input"
            placeholder="Paste any article or webpage URL to save to your queue…"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            aria-label="URL to save"
          />
          <button className="button button-primary" type="submit">
            + Add to queue
          </button>
        </form>
      </section>

      <section aria-labelledby="items-heading" style={{ marginTop: 24 }}>
        <div className="tabs" role="tablist" aria-label="Queue views">
          {views.map((entry) => {
            const count = tabCounts[entry.value];
            return (
              <button
                key={entry.value}
                role="tab"
                aria-selected={view === entry.value}
                onClick={() => {
                  setView(entry.value);
                  setSelected(new Set());
                }}
              >
                {entry.label}
                {typeof count === "number" && <span className="tab-badge">{count}</span>}
              </button>
            );
          })}
        </div>

        <div className="queue-filter-row">
          <div className="search-bar-container">
            <span className="search-icon" aria-hidden="true">
              🔍
            </span>
            <input
              type="search"
              className="search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search queue by title, URL, tag, note…"
              aria-label="Search queue"
            />
          </div>
          <select
            className="sort-select"
            value={sort}
            aria-label="Sort queue items"
            onChange={(event) => setSort(event.target.value as SortOption)}
          >
            <option value="newest">Sort: Newest first</option>
            <option value="oldest">Sort: Oldest first</option>
            <option value="shortest">Sort: Shortest read</option>
            <option value="longest">Sort: Longest read</option>
            <option value="priority">Sort: Priority</option>
          </select>
        </div>

        {loading ? (
          <Notice>Loading your local queue…</Notice>
        ) : displayedItems.length === 0 ? (
          <EmptyState
            title={
              view === "daily"
                ? "No daily reading habits"
                : view === "completed"
                  ? "No completed items yet"
                  : "Nothing in this view"
            }
          >
            {view === "daily"
              ? "Turn any article or newspaper into a daily routine by setting a daily reminder."
              : "Save a useful page with the toolbar button or paste a URL above."}
          </EmptyState>
        ) : (
          <ul className="item-list" id="items-heading" style={{ marginTop: 16 }}>
            {displayedItems.map((item) => {
              const isRecurring = Boolean(item.recurrence?.enabled);
              const doneToday = isRecurring && isDoneToday(item);
              const isMenuOpen = activeMenuId === item.id;

              return (
                <li className="item-card" key={item.id}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${item.title}`}
                    checked={selected.has(item.id)}
                    onChange={(event) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(item.id);
                        else next.delete(item.id);
                        return next;
                      })
                    }
                  />

                  <div>
                    <a
                      className="item-title"
                      href={item.originalUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() =>
                        void update(item.id, { lastOpenedAt: new Date().toISOString() })
                      }
                    >
                      {item.title}
                    </a>
                    <div className="meta">
                      <span>{item.domain}</span>
                      <span>·</span>
                      <span>{formatMinutes(item.plannedMinutes ?? item.estimatedMinutes)}</span>
                      <span className="pill">{item.contentType}</span>
                      <span className={item.priority === "high" ? "pill pill-high" : "pill"}>
                        {item.priority}
                      </span>
                      <span className="pill">{item.status}</span>
                      {isRecurring && (
                        <span
                          className="pill"
                          style={{ backgroundColor: "#e0f2fe", color: "#0369a1", fontWeight: 700 }}
                        >
                          🔁 Daily @ {item.recurrence?.time}
                        </span>
                      )}
                      {doneToday && <span className="pill pill-success">✓ Done today</span>}
                    </div>
                  </div>

                  <div className="item-card-actions">
                    <a
                      className="button-read"
                      href={item.originalUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() =>
                        void update(item.id, { lastOpenedAt: new Date().toISOString() })
                      }
                    >
                      Read ↗
                    </a>

                    <a
                      className="button-schedule"
                      href={`${extensionUrl("planner.html")}?itemId=${item.id}`}
                      title="Schedule reading block in Calendar"
                    >
                      📅 Schedule
                    </a>

                    {item.status === "deleted" ? (
                      <button
                        className="button button-secondary"
                        onClick={() => void update(item.id, { status: "queued" })}
                      >
                        Restore
                      </button>
                    ) : isRecurring ? (
                      <button
                        className={clsx("button-complete", doneToday && "is-done")}
                        onClick={() => void handleToggleDailyDone(item)}
                      >
                        {doneToday ? "✓ Done for today" : "Done for today"}
                      </button>
                    ) : (
                      <button
                        className="button-complete"
                        onClick={() => void handleToggleComplete(item)}
                      >
                        {item.status === "completed" ? "Mark unread" : "Complete ✓"}
                      </button>
                    )}

                    <div className="more-menu-container" ref={isMenuOpen ? menuRef : undefined}>
                      <button
                        className="button button-quiet"
                        style={{ padding: "6px 8px", fontSize: 16, lineHeight: 1 }}
                        aria-label={`More options for ${item.title}`}
                        aria-haspopup="true"
                        aria-expanded={isMenuOpen}
                        onClick={() => setActiveMenuId(isMenuOpen ? null : item.id)}
                      >
                        ⋯
                      </button>

                      {isMenuOpen && (
                        <div className="more-menu-dropdown" role="menu">
                          <div className="more-menu-section-label">Priority</div>
                          <div style={{ display: "flex", gap: 4, padding: "2px 8px 6px" }}>
                            {(["high", "normal", "low", "someday"] as Priority[]).map((p) => (
                              <button
                                key={p}
                                className={clsx("pill", item.priority === p && "pill-high")}
                                style={{
                                  cursor: "pointer",
                                  border: item.priority === p ? "1px solid var(--purple)" : "none"
                                }}
                                onClick={() => {
                                  void update(item.id, { priority: p });
                                  setActiveMenuId(null);
                                }}
                              >
                                {p}
                              </button>
                            ))}
                          </div>

                          <div className="more-menu-divider" />
                          <button
                            className="more-menu-item"
                            role="menuitem"
                            onClick={() => {
                              setReminderForm(
                                item.recurrence ?? {
                                  enabled: true,
                                  time: "20:00",
                                  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                                  addToCalendar: false
                                }
                              );
                              setEditingReminder(item);
                              setActiveMenuId(null);
                            }}
                          >
                            <span>⏰ Daily reminder</span>
                            <span style={{ fontSize: 11, color: "var(--muted)" }}>
                              {item.recurrence?.enabled ? item.recurrence.time : "Off"}
                            </span>
                          </button>

                          <div className="more-menu-divider" />

                          {item.status === "deleted" ? (
                            <button
                              className="more-menu-item danger"
                              role="menuitem"
                              onClick={() => void remove(item.id, true)}
                            >
                              Delete forever
                            </button>
                          ) : (
                            <>
                              <button
                                className="more-menu-item"
                                role="menuitem"
                                onClick={() => {
                                  void update(item.id, { status: "archived" });
                                  setActiveMenuId(null);
                                }}
                              >
                                📦 Archive
                              </button>
                              <button
                                className="more-menu-item danger"
                                role="menuitem"
                                onClick={() => void remove(item.id)}
                              >
                                🗑️ Move to trash
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selected.size > 0 && (
        <div className="floating-bulk-bar" role="toolbar" aria-label="Bulk actions">
          <span style={{ fontWeight: 700, fontSize: 13 }}>{selected.size} selected</span>
          <button className="button button-secondary" onClick={() => void bulkStatus("proposed")}>
            📅 Plan reading time
          </button>
          <button className="button button-secondary" onClick={() => void bulkStatus("archived")}>
            📦 Archive
          </button>
          <button className="button button-danger" onClick={() => void bulkStatus("deleted")}>
            🗑️ Move to trash
          </button>
          <button
            className="button button-quiet"
            style={{ color: "white" }}
            onClick={() => setSelected(new Set())}
          >
            Cancel
          </button>
        </div>
      )}

      {editingReminder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reminder-dialog-title"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
        >
          <div
            className="panel"
            style={{
              maxWidth: 420,
              width: "90%",
              backgroundColor: "#fff",
              padding: 24,
              borderRadius: 16,
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)"
            }}
          >
            <h2 id="reminder-dialog-title" style={{ fontSize: 18, marginBottom: 8 }}>
              Daily Reading Reminder
            </h2>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>{editingReminder.title}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void update(editingReminder.id, {
                  recurrence: reminderForm
                });
                setEditingReminder(undefined);
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <input
                  type="checkbox"
                  checked={reminderForm.enabled}
                  onChange={(e) => setReminderForm({ ...reminderForm, enabled: e.target.checked })}
                />
                <strong>Enable daily reminder</strong>
              </label>

              {reminderForm.enabled && (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label
                      htmlFor="reminder-time-input"
                      style={{ display: "block", fontSize: 13, marginBottom: 4 }}
                    >
                      Reminder time:
                    </label>
                    <input
                      id="reminder-time-input"
                      type="time"
                      value={reminderForm.time}
                      onChange={(e) => setReminderForm({ ...reminderForm, time: e.target.value })}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--line)"
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <span style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
                      Active days:
                    </span>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
                            fontSize: 12,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            cursor: "pointer",
                            background: reminderForm.daysOfWeek.includes(day)
                              ? "var(--purple-light)"
                              : "#f1f1f1",
                            padding: "4px 8px",
                            borderRadius: 6,
                            fontWeight: 600,
                            color: reminderForm.daysOfWeek.includes(day)
                              ? "var(--purple-dark)"
                              : "#666"
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={reminderForm.daysOfWeek.includes(day)}
                            onChange={(e) => {
                              const days = e.target.checked
                                ? [...reminderForm.daysOfWeek, day].sort()
                                : reminderForm.daysOfWeek.filter((d) => d !== day);
                              setReminderForm({ ...reminderForm, daysOfWeek: days });
                            }}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <label
                    style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}
                  >
                    <input
                      type="checkbox"
                      checked={reminderForm.addToCalendar}
                      onChange={(e) =>
                        setReminderForm({ ...reminderForm, addToCalendar: e.target.checked })
                      }
                    />
                    <span>Sync with Google Calendar</span>
                  </label>
                </>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setEditingReminder(undefined)}
                >
                  Cancel
                </button>
                <button type="submit" className="button button-primary">
                  Save reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  );
};

const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <StrictMode>
      <QueueApp />
    </StrictMode>
  );
