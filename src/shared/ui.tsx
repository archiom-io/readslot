import type { PropsWithChildren, ReactNode } from "react";
import clsx from "clsx";
import { extensionUrl } from "./client";
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
}: PropsWithChildren<{ title: string; eyebrow: string; actions?: ReactNode }>) => (
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
    <p>{children}</p>
  </div>
);
