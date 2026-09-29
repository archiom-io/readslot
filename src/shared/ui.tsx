import { useState, useEffect, type PropsWithChildren, type ReactNode } from "react";
import clsx from "clsx";
import type { DomainError } from "../domain/result";
import { extensionUrl, sendMessage } from "./client";
import { Icon } from "./icons";
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
  const [calendarStatus, setCalendarStatus] = useState<{
    configured: boolean;
    connected: boolean;
    error?: DomainError;
  }>();
  const [calendarNotice, setCalendarNotice] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void sendMessage<{ configured: boolean; connected: boolean; error?: DomainError }>({
      type: "calendar.status",
      payload: {}
    })
      .then((res) => {
        if (active && res && res.ok) {
          setCalendarStatus(res.value);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const handleConnect = async () => {
    setBusy(true);
    setCalendarNotice(undefined);
    const res = await sendMessage({ type: "calendar.connect", payload: {} });
    setBusy(false);
    if (res.ok) {
      setCalendarStatus((current) => ({
        configured: current?.configured ?? true,
        connected: true
      }));
      window.location.reload();
    } else {
      setCalendarNotice(res.error.message);
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
          {calendarStatus?.configured && !calendarStatus.connected && (
            <button
              type="button"
              className="button nav-cta"
              disabled={busy}
              onClick={() => void handleConnect()}
              aria-label="Connect Google Calendar"
            >
              <Icon name="calendar" size={14} />
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
        {calendarNotice && <Notice tone="danger">{calendarNotice}</Notice>}
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
    <Icon name="circle-dashed" size={58} />
    <h2>{title}</h2>
    <div className="empty-state-body">{children}</div>
  </div>
);
