import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, ReadingItemSchema } from "../domain/schemas";
import { createDefaultSettings } from "../domain/settings";
import { generateSuggestions, mergeBusyIntervals } from "./scheduler";

const item = ReadingItemSchema.parse({
  schemaVersion: SCHEMA_VERSION,
  id: "item-1",
  originalUrl: "https://example.com/read",
  canonicalUrl: "https://example.com/read",
  title: "An article worth reading",
  domain: "example.com",
  contentType: "article",
  estimatedMinutes: 30,
  estimateConfidence: "high",
  priority: "high",
  tags: [],
  status: "queued",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z"
});

describe("mergeBusyIntervals", () => {
  it("merges overlaps and applies buffers", () => {
    const merged = mergeBusyIntervals(
      [
        { start: "2026-07-13T12:00:00.000Z", end: "2026-07-13T12:30:00.000Z" },
        { start: "2026-07-13T12:20:00.000Z", end: "2026-07-13T13:00:00.000Z" }
      ],
      10,
      10
    );
    expect(merged).toEqual([
      { start: "2026-07-13T11:50:00.000Z", end: "2026-07-13T13:10:00.000Z" }
    ]);
  });

  it("always returns ordered non-overlapping positive intervals", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 0, max: 10_000 }), fc.integer({ min: 1, max: 500 }))),
        (values) => {
          const origin = Date.parse("2026-01-01T00:00:00.000Z");
          const merged = mergeBusyIntervals(
            values.map(([start, length]) => ({
              start: new Date(origin + start * 60_000).toISOString(),
              end: new Date(origin + (start + length) * 60_000).toISOString()
            }))
          );
          for (let index = 0; index < merged.length; index += 1) {
            expect(new Date(merged[index].end).getTime()).toBeGreaterThan(
              new Date(merged[index].start).getTime()
            );
            if (index > 0)
              expect(new Date(merged[index].start).getTime()).toBeGreaterThan(
                new Date(merged[index - 1].end).getTime()
              );
          }
        }
      )
    );
  });
});

describe("generateSuggestions", () => {
  it("does not schedule completed items", () => {
    const proposals = generateSuggestions({
      items: [ReadingItemSchema.parse({ ...item, status: "completed" })],
      busy: [],
      settings: createDefaultSettings(),
      calendarConnected: true,
      now: new Date("2026-07-13T12:00:00.000Z")
    });

    expect(proposals).toHaveLength(0);
  });

  it("generates three distinct, conflict-free proposals within allowed hours", () => {
    const settings = {
      ...createDefaultSettings(),
      timezone: "Asia/Dhaka",
      allowedWeekdays: [1, 2, 3, 4, 5, 6],
      earliestStart: "18:00",
      latestEnd: "21:00"
    };
    const proposals = generateSuggestions({
      items: [item],
      busy: [{ start: "2026-07-13T12:00:00.000Z", end: "2026-07-13T13:00:00.000Z" }],
      settings,
      now: new Date("2026-07-13T06:00:00.000Z"),
      calendarConnected: true
    });
    expect(proposals).toHaveLength(3);
    expect(new Set(proposals.map((proposal) => proposal.suggestedStart)).size).toBe(3);
    for (const proposal of proposals) {
      expect(new Date(proposal.suggestedEnd).getTime()).toBeGreaterThan(
        new Date(proposal.suggestedStart).getTime()
      );
      expect(proposal.conflictStatus).toBe("clear");
    }
  });

  it("handles a DST boundary using an IANA timezone", () => {
    const settings = {
      ...createDefaultSettings(),
      timezone: "America/New_York",
      allowedWeekdays: [0, 1, 2, 3, 4, 5, 6],
      earliestStart: "18:00",
      latestEnd: "21:00"
    };
    const proposals = generateSuggestions({
      items: [item],
      busy: [],
      settings,
      now: new Date("2026-03-07T12:00:00.000Z"),
      calendarConnected: true
    });
    expect(proposals).toHaveLength(3);
    expect(proposals.every((proposal) => proposal.durationMinutes === 30)).toBe(true);
  });

  it("schedules across multiple named reading windows with specific days and labels", () => {
    const settings = {
      ...createDefaultSettings(),
      timezone: "UTC",
      readingWindows: [
        {
          id: "morning",
          label: "Morning Commute",
          start: "08:00",
          end: "09:00",
          days: [1, 2, 3, 4, 5],
          enabled: true
        },
        {
          id: "lunch",
          label: "Lunch Break",
          start: "12:30",
          end: "13:30",
          days: [1, 2, 3, 4, 5],
          enabled: true
        }
      ],
      maximumBlocksPerDay: 2
    };

    const proposals = generateSuggestions({
      items: [item],
      busy: [],
      settings,
      now: new Date("2026-07-13T07:00:00.000Z"), // Monday 7am UTC
      calendarConnected: true
    });

    expect(proposals.length).toBeGreaterThanOrEqual(2);
    expect(proposals[0].explanation[0]).toContain("Morning Commute");
    expect(proposals[1].explanation[0]).toContain("Lunch Break");
  });
});
