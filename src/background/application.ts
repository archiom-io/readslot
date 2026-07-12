import { addDays } from "date-fns";
import type { ExtensionMessage } from "../shared/messages";
import { ExtensionMessageSchema } from "../shared/messages";
import { GoogleCalendarGateway } from "../calendar/googleCalendar";
import { err, ok, toDomainError, type Result } from "../domain/result";
import {
  CalendarOperationSchema,
  ProposalSchema,
  ReadingSessionSchema,
  SCHEMA_VERSION,
  SettingsSchema,
  type Proposal
} from "../domain/schemas";
import { generateSuggestions } from "../scheduler/scheduler";
import {
  ChromeSettingsRepository,
  DexieCalendarOperationRepository,
  DexieProposalRepository,
  DexieReadingRepository,
  DexieSessionRepository,
  ReadSlotBackupRepository
} from "../storage/repositories";
import { CaptureService } from "./capture";
import { database } from "../storage/database";
import { normalizeUrl } from "../domain/url";
import { parseImportedUrls } from "../domain/import";

const items = new DexieReadingRepository();
const proposals = new DexieProposalRepository();
const sessions = new DexieSessionRepository();
const settings = new ChromeSettingsRepository();
const operations = new DexieCalendarOperationRepository();
const backups = new ReadSlotBackupRepository();
const calendar = new GoogleCalendarGateway();
export const capture = new CaptureService(items, settings);
const confirming = new Set<string>();

const escapeCsv = (value: string | number): string => `"${String(value).replaceAll('"', '""')}"`;

const deterministicEventId = async (id: string): Promise<string> => {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`readslot:${id}`))
  );
  const alphabet = "0123456789abcdefghijklmnopqrstuv";
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let encoded = "";
  for (let index = 0; index + 5 <= bits.length; index += 5)
    encoded += alphabet[Number.parseInt(bits.slice(index, index + 5), 2)];
  return `readslot${encoded.slice(0, 47)}`;
};

const overlap = (proposal: Proposal, busy: Array<{ start: string; end: string }>): boolean => {
  const start = new Date(proposal.suggestedStart).getTime();
  const end = new Date(proposal.suggestedEnd).getTime();
  return busy.some(
    (interval) =>
      start < new Date(interval.end).getTime() && end > new Date(interval.start).getTime()
  );
};

const confirmProposal = async (
  proposalId: string,
  conflictOverride = false
): Promise<Result<unknown>> => {
  if (confirming.has(proposalId))
    return err({ code: "CONFLICT", message: "This reading block is already being created." });
  confirming.add(proposalId);
  try {
    const [proposalResult, settingsResult] = await Promise.all([
      proposals.get(proposalId),
      settings.get()
    ]);
    if (!proposalResult.ok) return proposalResult;
    if (!settingsResult.ok) return settingsResult;
    const proposal = proposalResult.value;
    if (proposal.status === "confirmed")
      return err({ code: "CONFLICT", message: "This proposal was already confirmed." });
    if (new Date(proposal.expiresAt).getTime() <= Date.now())
      return err({
        code: "STALE_PROPOSAL",
        message: "This proposal expired. Generate fresh times."
      });

    const connected = await calendar.connect(false);
    if (!connected.ok) return connected;
    const busy = await calendar.getBusy(
      settingsResult.value.availabilityCalendarIds,
      proposal.suggestedStart,
      proposal.suggestedEnd,
      settingsResult.value.timezone
    );
    if (!busy.ok) return busy;
    if (overlap(proposal, busy.value) && !conflictOverride) {
      return err({
        code: "CONFLICT",
        message: "Your calendar changed. Confirm again to create this conflicting block."
      });
    }

    const eventId = await deterministicEventId(proposal.id);
    const now = new Date().toISOString();
    const previousOperation = await operations.get(proposal.id);
    if (!previousOperation.ok) return previousOperation;
    if (previousOperation.value?.state === "confirmed") {
      return err({ code: "CONFLICT", message: "This reading block already exists." });
    }
    const pending = CalendarOperationSchema.parse({
      schemaVersion: SCHEMA_VERSION,
      id: proposal.id,
      proposalId: proposal.id,
      deterministicEventId: eventId,
      state: "pending",
      createdAt: previousOperation.value?.createdAt ?? now,
      updatedAt: now
    });
    const storedOperation = await operations.put(pending);
    if (!storedOperation.ok) return storedOperation;

    const existing = await calendar.getEvent(proposal.calendarId, eventId);
    let created = existing.ok ? existing.value : undefined;
    if (!created) {
      const response = await calendar.createEvent({
        eventId,
        calendarId: proposal.calendarId,
        title: proposal.title,
        description: proposal.description,
        start: proposal.suggestedStart,
        end: proposal.suggestedEnd,
        timezone: settingsResult.value.timezone,
        reminderMinutes: proposal.reminderMinutes,
        transparency: proposal.transparency,
        privateProperties: { readslotSessionId: proposal.id, readslotProposalId: proposal.id }
      });
      if (!response.ok) {
        const reconciled = await calendar.getEvent(proposal.calendarId, eventId);
        if (!reconciled.ok || !reconciled.value) {
          await operations.put({
            ...pending,
            state: "failed",
            safeErrorCode: response.error.code,
            updatedAt: new Date().toISOString()
          });
          return response;
        }
        created = reconciled.value;
      } else created = response.value;
    }

    const session = ReadingSessionSchema.parse({
      schemaVersion: SCHEMA_VERSION,
      id: crypto.randomUUID(),
      proposalId: proposal.id,
      itemIds: proposal.itemIds,
      completedItemIds: [],
      skippedItemIds: [],
      calendarId: proposal.calendarId,
      calendarEventId: created.id,
      start: created.start,
      end: created.end,
      status: "scheduled",
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now
    });
    const savedSession = await sessions.put(session);
    if (!savedSession.ok) return savedSession;
    for (const itemId of proposal.itemIds) await items.update(itemId, { status: "scheduled" });
    await proposals.put(
      ProposalSchema.parse({ ...proposal, status: "confirmed", lastValidatedAt: now })
    );
    await operations.put({ ...pending, state: "confirmed", eventId: created.id, updatedAt: now });
    await chrome.alarms.create(`session:${session.id}`, { when: new Date(session.end).getTime() });
    return ok(session);
  } finally {
    confirming.delete(proposalId);
  }
};

export const handleMessage = async (input: unknown): Promise<Result<unknown>> => {
  const parsed = ExtensionMessageSchema.safeParse(input);
  if (!parsed.success)
    return err({ code: "INVALID_INPUT", message: "The extension received an invalid request." });
  const message: ExtensionMessage = parsed.data;
  try {
    switch (message.type) {
      case "capture.current":
        return capture.fromCurrentTab();
      case "capture.url":
        return capture.fromUrl(message.payload.url, message.payload.title, message.payload.notes);
      case "capture.undo":
        return items.remove(message.payload.itemId);
      case "items.list":
        return items.list(message.payload);
      case "items.update":
        return items.update(message.payload.id, message.payload.changes);
      case "items.remove":
        return items.remove(message.payload.id, message.payload.permanent);
      case "settings.get":
        return settings.get();
      case "settings.update": {
        const next = SettingsSchema.parse(message.payload.settings);
        const saved = await settings.put(next);
        if (saved.ok) {
          if (next.weeklyPlanningNotification)
            await chrome.alarms.create("readslot-weekly-plan", {
              delayInMinutes: 7 * 24 * 60,
              periodInMinutes: 7 * 24 * 60
            });
          else await chrome.alarms.clear("readslot-weekly-plan");
        }
        return saved;
      }
      case "backup.export":
        return backups.export();
      case "backup.import":
        return backups.import(message.payload.backup);
      case "items.export": {
        const itemResult = await items.list({ includeDeleted: false });
        if (!itemResult.ok) return itemResult;
        const active = itemResult.value.filter((item) => item.status !== "deleted");
        if (message.payload.format === "csv") {
          return ok({
            filename: "readslot-items.csv",
            mimeType: "text/csv",
            text: `title,url,status,priority,minutes,tags\n${active.map((item) => [item.title, item.originalUrl, item.status, item.priority, item.plannedMinutes ?? item.estimatedMinutes, item.tags.join("|")].map(escapeCsv).join(",")).join("\n")}\n`
          });
        }
        if (message.payload.format === "markdown") {
          return ok({
            filename: "readslot-items.md",
            mimeType: "text/markdown",
            text: `# ReadSlot reading queue\n\n${active.map((item) => `- [${item.title}](${item.originalUrl}) — ${item.plannedMinutes ?? item.estimatedMinutes} min · ${item.status}`).join("\n")}\n`
          });
        }
        if (message.payload.format === "bookmarks") {
          return ok({
            filename: "readslot-bookmarks.html",
            mimeType: "text/html",
            text: `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<TITLE>ReadSlot</TITLE>\n<H1>ReadSlot</H1>\n<DL><p>\n${active.map((item) => `<DT><A HREF="${item.originalUrl.replaceAll('"', "&quot;")}">${item.title.replaceAll("<", "&lt;")}</A>`).join("\n")}\n</DL><p>\n`
          });
        }
        return ok({
          filename: "readslot-urls.txt",
          mimeType: "text/plain",
          text: `${active.map((item) => item.originalUrl).join("\n")}\n`
        });
      }
      case "items.importText": {
        const candidates = parseImportedUrls(message.payload.format, message.payload.text);
        let added = 0;
        let skipped = 0;
        let invalid = 0;
        const unique = new Map<string, { url: string; title?: string }>();
        for (const candidate of candidates) {
          try {
            const normalized = normalizeUrl(candidate.url);
            if (unique.has(normalized.canonicalUrl)) skipped += 1;
            else unique.set(normalized.canonicalUrl, candidate);
          } catch {
            invalid += 1;
          }
        }
        for (const [canonicalUrl, candidate] of unique) {
          const existing = await items.getByCanonicalUrl(canonicalUrl);
          if (!existing.ok || existing.value) {
            skipped += 1;
            continue;
          }
          if (!message.payload.preview) {
            const captured = await capture.fromUrl(candidate.url, candidate.title);
            if (!captured.ok || captured.value.duplicate) {
              skipped += 1;
              continue;
            }
          }
          added += 1;
        }
        return ok({ added, skipped, invalid, preview: message.payload.preview });
      }
      case "calendar.status": {
        if (!calendar.isConfigured()) return ok({ configured: false, connected: false });
        const connection = await calendar.connect(false);
        return ok({
          configured: true,
          connected: connection.ok,
          error: connection.ok ? undefined : connection.error
        });
      }
      case "calendar.connect": {
        const connection = await calendar.connect(true);
        return connection.ok ? ok({ connected: true }) : connection;
      }
      case "calendar.disconnect":
        return calendar.disconnect();
      case "calendar.list":
        return calendar.listCalendars();
      case "suggestions.generate": {
        const [itemResult, settingsResult] = await Promise.all([items.list(), settings.get()]);
        if (!itemResult.ok) return itemResult;
        if (!settingsResult.ok) return settingsResult;
        const selectedItems = message.payload.itemIds?.length
          ? itemResult.value.filter((item) => message.payload.itemIds?.includes(item.id))
          : itemResult.value;
        const connection = calendar.isConfigured()
          ? await calendar.connect(false)
          : err({ code: "OAUTH_NOT_CONFIGURED" as const, message: "Calendar is not configured." });
        let busy: Array<{ start: string; end: string }> = [];
        if (connection.ok) {
          const now = new Date();
          const response = await calendar.getBusy(
            settingsResult.value.availabilityCalendarIds,
            now.toISOString(),
            addDays(now, settingsResult.value.planningHorizonDays).toISOString(),
            settingsResult.value.timezone
          );
          if (response.ok) busy = response.value;
        }
        const generated = generateSuggestions({
          items: selectedItems,
          busy,
          settings: settingsResult.value,
          calendarConnected: connection.ok
        });
        for (const proposal of generated) await proposals.put(proposal);
        for (const itemId of new Set(generated.flatMap((proposal) => proposal.itemIds))) {
          const item = itemResult.value.find((candidate) => candidate.id === itemId);
          if (item?.status === "queued") await items.update(itemId, { status: "proposed" });
        }
        return ok(generated);
      }
      case "proposals.list":
        return proposals.list();
      case "proposals.save":
        return proposals.put(message.payload.proposal);
      case "proposals.confirm":
        return confirmProposal(message.payload.proposalId, message.payload.conflictOverride);
      case "sessions.list":
        return sessions.list();
      case "sessions.review": {
        const sessionResult = await sessions.get(message.payload.sessionId);
        if (!sessionResult.ok) return sessionResult;
        const now = new Date().toISOString();
        for (const itemId of sessionResult.value.itemIds) {
          if (message.payload.completedItemIds.includes(itemId))
            await items.update(itemId, { status: "completed", completedAt: now });
          else if (message.payload.skippedItemIds.includes(itemId))
            await items.update(itemId, { status: "archived", archivedAt: now });
          else await items.update(itemId, { status: "queued" });
        }
        return sessions.put(
          ReadingSessionSchema.parse({
            ...sessionResult.value,
            completedItemIds: message.payload.completedItemIds,
            skippedItemIds: message.payload.skippedItemIds,
            status: "completed",
            updatedAt: now
          })
        );
      }
      case "dashboard.stats": {
        const [itemResult, sessionResult] = await Promise.all([
          items.list({ includeDeleted: true }),
          sessions.list()
        ]);
        if (!itemResult.ok) return itemResult;
        if (!sessionResult.ok) return sessionResult;
        const active = itemResult.value.filter(
          (item) => !["deleted", "archived"].includes(item.status)
        );
        return ok({
          totalItems: itemResult.value.length,
          queuedItems: active.filter((item) => item.status === "queued").length,
          scheduledItems: active.filter((item) => item.status === "scheduled").length,
          completedItems: itemResult.value.filter((item) => item.status === "completed").length,
          queueMinutes: active.reduce(
            (sum, item) => sum + (item.plannedMinutes ?? item.estimatedMinutes),
            0
          ),
          completedSessions: sessionResult.value.filter((session) => session.status === "completed")
            .length
        });
      }
      case "weekly.plan": {
        const [itemResult, settingsResult] = await Promise.all([items.list(), settings.get()]);
        if (!itemResult.ok) return itemResult;
        if (!settingsResult.ok) return settingsResult;
        const queueMinutes = itemResult.value
          .filter((item) => ["queued", "proposed"].includes(item.status))
          .reduce((sum, item) => sum + (item.plannedMinutes ?? item.estimatedMinutes), 0);
        const preferred = settingsResult.value.preferredBlockMinutes;
        return ok([
          {
            id: "light",
            label: "Light",
            blocks: Math.min(2, Math.ceil(queueMinutes / preferred)),
            minutes: Math.min(queueMinutes, preferred * 2),
            description: "A gentle start that protects the rest of your week."
          },
          {
            id: "balanced",
            label: "Balanced",
            blocks: Math.min(4, Math.ceil(queueMinutes / preferred)),
            minutes: Math.min(queueMinutes, preferred * 4),
            description: "Steady progress across several focused blocks."
          },
          {
            id: "aggressive",
            label: "Aggressive",
            blocks: Math.min(6, Math.ceil(queueMinutes / preferred)),
            minutes: Math.min(queueMinutes, preferred * 6),
            description: "A focused backlog-clearing week."
          }
        ]);
      }
      case "diagnostics.get":
        return ok({
          version: chrome.runtime.getManifest().version,
          oauthConfigured: calendar.isConfigured(),
          generatedAt: new Date().toISOString()
        });
      case "data.reset":
        await database.transaction(
          "rw",
          [database.items, database.proposals, database.sessions, database.calendarOperations],
          async () => {
            await Promise.all([
              database.items.clear(),
              database.proposals.clear(),
              database.sessions.clear(),
              database.calendarOperations.clear()
            ]);
          }
        );
        await chrome.storage.local.clear();
        return ok(undefined);
    }
  } catch (error) {
    return err(toDomainError(error));
  }
};

export const syncCalendarSessions = async (): Promise<void> => {
  const sessionResult = await sessions.list();
  if (!sessionResult.ok || !calendar.isConfigured()) return;
  const connection = await calendar.connect(false);
  if (!connection.ok) return;
  for (const session of sessionResult.value.filter((entry) => entry.status === "scheduled")) {
    const event = await calendar.getEvent(session.calendarId, session.calendarEventId);
    if (!event.ok || !event.value) continue;
    if (event.value.start !== session.start || event.value.end !== session.end) {
      await sessions.put(
        ReadingSessionSchema.parse({
          ...session,
          start: event.value.start,
          end: event.value.end,
          lastSyncedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      );
    }
  }
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  await database.items.where("deletedAt").below(cutoff).delete();
};
