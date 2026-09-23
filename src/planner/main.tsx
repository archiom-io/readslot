import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { clsx } from "clsx";
import { z } from "zod";
import { ProposalSchema, type Proposal } from "../domain/schemas";
import { extensionUrl, sendMessage } from "../shared/client";
import { EmptyState, Notice, PageShell, formatDateTime, formatMinutes } from "../shared/ui";

interface CalendarStatus {
  configured: boolean;
  connected: boolean;
}
interface WeeklyPlan {
  id: string;
  label: string;
  blocks: number;
  minutes: number;
  description: string;
}

const ItemIdQuerySchema = z.string().trim().min(1).max(200);

const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export const PlannerApp = () => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [status, setStatus] = useState<CalendarStatus>({ configured: false, connected: false });
  const [notice, setNotice] = useState<{
    tone: "info" | "success" | "warning" | "danger";
    text: string;
  }>();
  const [loading, setLoading] = useState(false);
  const [conflictId, setConflictId] = useState<string>();
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>([]);

  const load = async (): Promise<CalendarStatus | undefined> => {
    const [proposalResult, statusResult, weeklyResult] = await Promise.all([
      sendMessage<Proposal[]>({ type: "proposals.list", payload: {} }),
      sendMessage<CalendarStatus>({ type: "calendar.status", payload: {} }),
      sendMessage<WeeklyPlan[]>({ type: "weekly.plan", payload: {} })
    ]);
    if (proposalResult.ok)
      setProposals(
        proposalResult.value
          .filter((proposal) => ["ready", "draft", "stale"].includes(proposal.status))
          .sort((a, b) => b.score - a.score)
      );
    if (statusResult.ok) setStatus(statusResult.value);
    if (weeklyResult.ok) setWeeklyPlans(weeklyResult.value);
    return statusResult.ok ? statusResult.value : undefined;
  };

  const connect = async () => {
    const result = await sendMessage<{ connected: boolean }>({
      type: "calendar.connect",
      payload: {}
    });
    if (result.ok) {
      setNotice({ tone: "success", text: "Google Calendar connected." });
      await load();
    } else setNotice({ tone: "danger", text: result.error.message });
  };

  const generate = async (itemIds?: string[], calendarConnected = status.connected) => {
    setLoading(true);
    const result = await sendMessage<Proposal[]>({
      type: "suggestions.generate",
      payload: { itemIds }
    });
    setLoading(false);
    if (result.ok) {
      setProposals(result.value);
      setNotice(
        result.value.length
          ? {
              tone: calendarConnected ? "success" : "warning",
              text: calendarConnected
                ? "Found your best available reading windows."
                : "Previewing times without Calendar availability. Connect Google before confirmation."
            }
          : {
              tone: "info",
              text: "No fitting times were found. Check your queue and scheduling preferences."
            }
      );
    } else setNotice({ tone: "danger", text: result.error.message });
  };

  useEffect(() => {
    void (async () => {
      const loadedStatus = await load();
      const rawItemId = new URLSearchParams(window.location.search).get("itemId");
      if (!rawItemId) return;
      const parsedItemId = ItemIdQuerySchema.safeParse(rawItemId);
      if (!parsedItemId.success) {
        setNotice({
          tone: "danger",
          text: "This planner link is invalid. Open the queue and choose an item again."
        });
        return;
      }
      await generate([parsedItemId.data], loadedStatus?.connected ?? false);
    })();
  }, []);

  const saveProposal = async (proposal: Proposal) => {
    const result = await sendMessage<Proposal>({
      type: "proposals.save",
      payload: { proposal: ProposalSchema.parse(proposal) }
    });
    if (result.ok)
      setProposals((current) =>
        current.map((entry) => (entry.id === proposal.id ? result.value : entry))
      );
    else setNotice({ tone: "danger", text: result.error.message });
  };

  const updateStart = (proposal: Proposal, local: string) => {
    const start = new Date(local);
    const next = ProposalSchema.parse({
      ...proposal,
      suggestedStart: start.toISOString(),
      suggestedEnd: new Date(start.getTime() + proposal.durationMinutes * 60_000).toISOString(),
      status: "draft",
      conflictStatus: "unknown"
    });
    void saveProposal(next);
  };

  const updateDuration = (proposal: Proposal, duration: number) => {
    const next = ProposalSchema.parse({
      ...proposal,
      durationMinutes: duration,
      suggestedEnd: new Date(
        new Date(proposal.suggestedStart).getTime() + duration * 60_000
      ).toISOString(),
      status: "draft",
      conflictStatus: "unknown"
    });
    void saveProposal(next);
  };

  const confirm = async (proposalId: string, conflictOverride = false) => {
    setLoading(true);
    const result = await sendMessage({
      type: "proposals.confirm",
      payload: { proposalId, conflictOverride }
    });
    setLoading(false);
    if (result.ok) {
      setConflictId(undefined);
      setNotice({ tone: "success", text: "Reading block created. Your items are now scheduled." });
      await load();
    } else if (result.error.code === "CONFLICT" && !conflictOverride) {
      setConflictId(proposalId);
      setNotice({ tone: "warning", text: result.error.message });
    } else setNotice({ tone: "danger", text: result.error.message });
  };

  return (
    <PageShell
      eyebrow="Calendar planner"
      title="Choose the time."
      actions={
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a
            className="button button-secondary"
            href={`${extensionUrl("options.html")}#reading-windows`}
            title="Configure reading windows and block durations"
          >
            ⚙️ Reading windows
          </a>
          <button
            className="button button-primary"
            disabled={loading}
            onClick={() => void generate()}
          >
            {loading ? "Checking…" : "Find reading times"}
          </button>
        </div>
      }
    >
      {!status.configured && (
        <Notice tone="warning">
          Calendar is not configured in this build. You can preview suggestions, but confirmation is
          disabled.
        </Notice>
      )}
      {status.configured && !status.connected && (
        <Notice tone="info">
          Connect Google Calendar to check real availability.{" "}
          <button className="button button-secondary" onClick={() => void connect()}>
            Connect Google
          </button>
        </Notice>
      )}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <section
        className="grid grid-3"
        aria-label="Weekly planning strategies"
        style={{ marginBottom: 24 }}
      >
        {weeklyPlans.map((plan) => (
          <article className="panel stat" key={plan.id}>
            <div>
              <p className="eyebrow">{plan.label}</p>
              <h2>
                {plan.blocks} {plan.blocks === 1 ? "block" : "blocks"} ·{" "}
                {formatMinutes(plan.minutes)}
              </h2>
            </div>
            <span>{plan.description}</span>
          </article>
        ))}
      </section>

      {proposals.length === 0 ? (
        <EmptyState title="No active suggestions">
          <p style={{ margin: "0 0 14px" }}>
            Choose “Find reading times” to turn your queued items into editable proposals, or
            customize your reading windows to fit your schedule.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              className="button button-primary"
              disabled={loading}
              onClick={() => void generate()}
            >
              {loading ? "Checking…" : "Find reading times"}
            </button>
            <a
              className="button button-secondary"
              href={`${extensionUrl("options.html")}#reading-windows`}
            >
              ⚙️ Configure reading windows
            </a>
          </div>
        </EmptyState>
      ) : (
        <div className="grid grid-2">
          {proposals.map((proposal, index) => (
            <article className="panel proposal" key={proposal.id}>
              <div className="proposal-header">
                <div>
                  <p className="eyebrow">Option {index + 1}</p>
                  <h2>{formatDateTime(proposal.suggestedStart)}</h2>
                </div>
                <span
                  className={`pill confidence-badge confidence-badge-${proposal.confidence}`}
                  aria-label={`${proposal.confidence} confidence`}
                >
                  <span className="confidence-badge-dot" aria-hidden="true" />
                  {proposal.confidence.charAt(0).toUpperCase() + proposal.confidence.slice(1)}
                  <span className="confidence-badge-label">confidence</span>
                </span>
              </div>
              <div className="meta">
                <strong>{formatMinutes(proposal.durationMinutes)}</strong>
                <span>·</span>
                <span>{proposal.itemIds.length} items</span>
                <span>·</span>
                <span>Score {Math.round(proposal.score)}</span>
              </div>
              <ul className="explanations">
                {proposal.explanation.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <div className="form-grid">
                <label>
                  Start time
                  <input
                    type="datetime-local"
                    value={toLocalInput(proposal.suggestedStart)}
                    onChange={(event) => updateStart(proposal, event.target.value)}
                  />
                </label>
                <div className="wide">
                  <div style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>
                    Slot duration
                  </div>
                  <div className="duration-chips">
                    {[10, 15, 20, 30, 45, 60].map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        className={clsx(
                          "duration-chip",
                          proposal.durationMinutes === minutes && "is-active"
                        )}
                        onClick={() => updateDuration(proposal, minutes)}
                      >
                        {minutes} min
                      </button>
                    ))}
                    <div className="custom-duration-container">
                      <span style={{ fontSize: 13, color: "var(--muted)" }}>Custom:</span>
                      <input
                        type="number"
                        min="5"
                        max="1440"
                        className="custom-duration-input"
                        aria-label="Custom duration in minutes"
                        value={
                          ![10, 15, 20, 30, 45, 60].includes(proposal.durationMinutes)
                            ? proposal.durationMinutes
                            : ""
                        }
                        placeholder="min"
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (val >= 5 && val <= 1440) {
                            updateDuration(proposal, val);
                          }
                        }}
                      />
                      <span style={{ fontSize: 13, color: "var(--muted)" }}>min</span>
                    </div>
                  </div>
                </div>
                <label className="wide">
                  Event title
                  <input
                    value={proposal.title}
                    onChange={(event) =>
                      setProposals((current) =>
                        current.map((entry) =>
                          entry.id === proposal.id ? { ...entry, title: event.target.value } : entry
                        )
                      )
                    }
                    onBlur={(event) =>
                      void saveProposal(
                        ProposalSchema.parse({ ...proposal, title: event.target.value })
                      )
                    }
                  />
                </label>
              </div>
              <p className="meta">
                Nothing is added to Calendar until you press the confirmation button.
              </p>
              {conflictId === proposal.id ? (
                <div className="notice notice-warning">
                  <strong>Conflict detected.</strong>
                  <p>
                    This creates over another event. ReadSlot will proceed only after this second
                    confirmation.
                  </p>
                  <button
                    className="button button-danger"
                    onClick={() => void confirm(proposal.id, true)}
                  >
                    Create conflicting block
                  </button>
                </div>
              ) : (
                <button
                  className="button button-primary"
                  disabled={!status.connected || loading}
                  onClick={() => void confirm(proposal.id)}
                >
                  Create reading block
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
};

const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <StrictMode>
      <PlannerApp />
    </StrictMode>
  );
