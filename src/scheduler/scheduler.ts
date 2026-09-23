import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  SCHEMA_VERSION,
  ProposalSchema,
  type Proposal,
  type ReadingItem,
  type Settings
} from "../domain/schemas";
import type { BusyInterval } from "../domain/ports";

interface Interval {
  start: number;
  end: number;
}

export interface SuggestionInput {
  items: ReadingItem[];
  busy: BusyInterval[];
  settings: Settings;
  now?: Date;
  calendarConnected: boolean;
}

const MINUTE = 60_000;

export const mergeBusyIntervals = (
  intervals: BusyInterval[],
  beforeMinutes = 0,
  afterMinutes = 0
): BusyInterval[] => {
  const sorted = intervals
    .map((interval) => ({
      start: new Date(interval.start).getTime() - beforeMinutes * MINUTE,
      end: new Date(interval.end).getTime() + afterMinutes * MINUTE
    }))
    .filter((interval) => Number.isFinite(interval.start) && interval.end > interval.start)
    .sort((left, right) => left.start - right.start);

  const merged: Interval[] = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (previous && interval.start <= previous.end)
      previous.end = Math.max(previous.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged.map((interval) => ({
    start: new Date(interval.start).toISOString(),
    end: new Date(interval.end).toISOString()
  }));
};

const priorityScore = { high: 4, normal: 3, low: 2, someday: 1 } as const;

const selectItems = (items: ReadingItem[], maximumMinutes: number): ReadingItem[] => {
  const sorted = [...items].sort(
    (left, right) =>
      priorityScore[right.priority] - priorityScore[left.priority] ||
      left.createdAt.localeCompare(right.createdAt)
  );
  const selected: ReadingItem[] = [];
  let total = 0;
  for (const item of sorted) {
    const duration = item.plannedMinutes ?? item.estimatedMinutes;
    if (selected.length === 0 || total + duration <= maximumMinutes) {
      selected.push(item);
      total += duration;
    }
  }
  return selected;
};

const eventDescription = (items: ReadingItem[]): string =>
  `${items.map((item, index) => `${index + 1}. ${item.title} — ${item.plannedMinutes ?? item.estimatedMinutes} min\n${item.originalUrl}`).join("\n\n")}\n\nCreated by ReadSlot.`;

const dateForOffset = (startDate: string, offset: number): string =>
  addDays(new Date(`${startDate}T12:00:00Z`), offset)
    .toISOString()
    .slice(0, 10);

export const generateSuggestions = (input: SuggestionInput): Proposal[] => {
  const { settings } = input;
  const now = input.now ?? new Date();
  const noticeBoundary = now.getTime() + settings.minimumNoticeMinutes * MINUTE;
  const merged = mergeBusyIntervals(
    input.busy,
    settings.bufferBeforeMinutes,
    settings.bufferAfterMinutes
  ).map((interval) => ({
    start: new Date(interval.start).getTime(),
    end: new Date(interval.end).getTime()
  }));
  const candidates = input.items.filter((item) => ["queued", "proposed"].includes(item.status));
  const selected = selectItems(candidates, settings.maximumBlockMinutes);
  if (selected.length === 0) return [];

  const estimatedTotal = selected.reduce(
    (sum, item) => sum + (item.plannedMinutes ?? item.estimatedMinutes),
    0
  );
  const duration = Math.min(
    settings.maximumBlockMinutes,
    Math.max(settings.minimumBlockMinutes, Math.min(settings.preferredBlockMinutes, estimatedTotal))
  );
  const startDate = formatInTimeZone(now, settings.timezone, "yyyy-MM-dd");
  const generatedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 24 * 60 * MINUTE).toISOString();
  const proposals: Proposal[] = [];

  for (let offset = 0; offset < settings.planningHorizonDays && proposals.length < 3; offset += 1) {
    const date = dateForOffset(startDate, offset);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();

    const dayWindows =
      settings.readingWindows && settings.readingWindows.length > 0
        ? settings.readingWindows.filter((w) => w.enabled && w.days.includes(weekday))
        : settings.allowedWeekdays.includes(weekday)
          ? [
              {
                id: "default",
                label: "Evening",
                start: settings.earliestStart,
                end: settings.latestEnd,
                days: settings.allowedWeekdays,
                enabled: true
              }
            ]
          : [];

    if (dayWindows.length === 0) continue;

    let dayBlocks = 0;
    const maxDayBlocks = settings.maximumBlocksPerDay ?? 1;

    for (const window of dayWindows) {
      if (dayBlocks >= maxDayBlocks || proposals.length >= 3) break;

      const windowStart = fromZonedTime(`${date}T${window.start}:00`, settings.timezone).getTime();
      const windowEnd = fromZonedTime(`${date}T${window.end}:00`, settings.timezone).getTime();

      if (windowEnd <= windowStart) continue;

      const slotDuration = duration * MINUTE;
      let cursor = Math.max(windowStart, noticeBoundary);
      cursor = Math.ceil(cursor / (15 * MINUTE)) * 15 * MINUTE;

      while (cursor + slotDuration <= windowEnd) {
        const conflict = merged.find(
          (interval) => cursor < interval.end && cursor + slotDuration > interval.start
        );
        if (conflict) {
          cursor = Math.ceil(conflict.end / (15 * MINUTE)) * 15 * MINUTE;
          continue;
        }

        const start = new Date(cursor).toISOString();
        const end = new Date(cursor + slotDuration).toISOString();
        const highPriorityCount = selected.filter((item) => item.priority === "high").length;
        const ageDays = Math.max(
          0,
          (now.getTime() - new Date(selected[0].createdAt).getTime()) / 86_400_000
        );
        const durationFit =
          15 *
          (1 -
            Math.min(
              1,
              Math.abs(duration - settings.preferredBlockMinutes) / settings.preferredBlockMinutes
            ));
        const score = 30 + 20 + highPriorityCount * 5 + Math.min(10, ageDays / 7) + durationFit;
        proposals.push(
          ProposalSchema.parse({
            schemaVersion: SCHEMA_VERSION,
            id: crypto.randomUUID(),
            itemIds: selected.map((item) => item.id),
            calendarId: settings.destinationCalendarId ?? "primary",
            title: `ReadSlot — ${selected.length} ${selected.length === 1 ? "item" : "items"}`,
            description: eventDescription(selected),
            suggestedStart: start,
            suggestedEnd: end,
            durationMinutes: duration,
            reminderMinutes: settings.defaultReminderMinutes,
            score,
            explanation: [
              `Fits your "${window.label}" reading window (${settings.preferredBlockMinutes} min).`,
              highPriorityCount > 0
                ? `Includes ${highPriorityCount} high-priority item${highPriorityCount === 1 ? "" : "s"}.`
                : "Prioritizes the oldest items in your queue.",
              input.calendarConnected
                ? `Leaves your configured calendar buffers intact.`
                : "Calendar is not connected; availability is unverified."
            ],
            confidence: input.calendarConnected ? "high" : "low",
            conflictStatus: input.calendarConnected ? "clear" : "unknown",
            transparency: "opaque",
            status: "ready",
            generatedAt,
            expiresAt
          })
        );
        dayBlocks += 1;
        break;
      }
    }
  }

  return proposals.sort((left, right) => right.score - left.score);
};
