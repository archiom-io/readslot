import { useState, useEffect, type PropsWithChildren, type ReactNode } from "react";
import clsx from "clsx";
import { extensionUrl, sendMessage } from "./client";
import "./styles.css";

export const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

export const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );

export const PageShell = ({
  title,
  eyebrow,
  actions,
  children
}: PropsWithChildren<{ title: string; eyebrow: string; actions?: ReactNode }>) => {
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void sendMessage<{ configured: boolean; connected: boolean }>({
      type: "calendar.status",
      payload: {}
    })
      .then((res) => {
        if (active && res && res.ok) {
          setCalendarConnected(res.value.connected);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const handleConnect = async () => {
    setBusy(true);
    const res = await sendMessage({ type: "calendar.connect", payload: {} });
    setBusy(false);
    if (res.ok) {
      setCalendarConnected(true);
      window.location.reload();
    } else {
      window.location.href = extensionUrl("options.html");
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href={extensionUrl("queue.html")} aria-label="ReadSlot home">
          <img className="brand-mark" src="icons/readslot.svg" alt="" aria-hidden="true" />
          <span>ReadSlot</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href={extensionUrl("queue.html")}>Queue</a>
          <a href={extensionUrl("planner.html")}>Planner</a>
          <a href={extensionUrl("session.html")}>Sessions</a>
          <a href={extensionUrl("options.html")}>Settings</a>
          {calendarConnected === false && (
            <button
              type="button"
              className="button nav-cta"
              disabled={busy}
              onClick={() => void handleConnect()}
              aria-label="Connect Google Calendar"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{busy ? "Connecting…" : "Connect Google Calendar"}</span>
            </button>
          )}
        </nav>
      </header>
      <main>
        <section className="page-heading">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          {actions && <div className="heading-actions">{actions}</div>}
        </section>
        {children}
      </main>
      <footer>
        Stored on this device · No tracking · Calendar actions always require confirmation
      </footer>
    </div>
  );
};

export const Notice = ({
  tone = "info",
  children
}: PropsWithChildren<{ tone?: "info" | "success" | "warning" | "danger" }>) => (
  <div className={clsx("notice", `notice-${tone}`)} role={tone === "danger" ? "alert" : "status"}>
    {children}
  </div>
);

export const EmptyState = ({ title, children }: PropsWithChildren<{ title: string }>) => (
  <div className="empty-state">
    <span aria-hidden="true">◌</span>
    <h2>{title}</h2>
    <div className="empty-state-body">{children}</div>
  </div>
);
