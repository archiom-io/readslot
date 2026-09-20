import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getNextOccurrence,
  buildRRule,
  scheduleItemAlarm,
  scheduleHabitAlarm,
  syncAllReminders
} from "./reminders";
import type { DailyHabitReminder, ReadingItem } from "../domain/schemas";
import type { ReadingRepository, SettingsRepository } from "../domain/ports";
import { ok } from "../domain/result";
import { createDefaultSettings } from "../domain/settings";

describe("reminders", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", {
      alarms: {
        create: vi.fn(),
        clear: vi.fn()
      }
    });
  });

  describe("getNextOccurrence", () => {
    it("returns today at 20:00 if current time is before 20:00 on allowed day", () => {
      // Monday at 10:00
      const now = new Date(2026, 8, 21, 10, 0, 0, 0); // 2026-09-21 is Monday (day 1)
      const next = getNextOccurrence("20:00", [1], now);
      const expected = new Date(2026, 8, 21, 20, 0, 0, 0).getTime();
      expect(next).toBe(expected);
    });

    it("returns tomorrow if current time is after 20:00 and all days are allowed", () => {
      // Monday at 21:00
      const now = new Date(2026, 8, 21, 21, 0, 0, 0);
      const next = getNextOccurrence("20:00", [0, 1, 2, 3, 4, 5, 6], now);
      const expected = new Date(2026, 8, 22, 20, 0, 0, 0).getTime();
      expect(next).toBe(expected);
    });

    it("skips to next allowed day if today is not allowed", () => {
      // Monday at 10:00, but only Wednesday (day 3) allowed
      const now = new Date(2026, 8, 21, 10, 0, 0, 0);
      const next = getNextOccurrence("20:00", [3], now);
      const expected = new Date(2026, 8, 23, 20, 0, 0, 0).getTime();
      expect(next).toBe(expected);
    });
  });

  describe("buildRRule", () => {
    it("returns RRULE:FREQ=DAILY for everyday", () => {
      expect(buildRRule([0, 1, 2, 3, 4, 5, 6])).toEqual(["RRULE:FREQ=DAILY"]);
      expect(buildRRule([])).toEqual(["RRULE:FREQ=DAILY"]);
    });

    it("returns weekly rrule with specific days", () => {
      expect(buildRRule([1, 3, 5])).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"]);
    });
  });

  describe("scheduleItemAlarm", () => {
    it("creates alarm when recurrence is enabled", async () => {
      const item = {
        id: "item-1",
        title: "Test News",
        status: "queued",
        recurrence: {
          enabled: true,
          time: "20:00",
          daysOfWeek: [1, 2, 3, 4, 5],
          addToCalendar: false
        }
      } as ReadingItem;

      await scheduleItemAlarm(item);
      expect(chrome.alarms.create).toHaveBeenCalledWith(
        "reminder:item:item-1",
        expect.objectContaining({
          periodInMinutes: 1440
        })
      );
    });

    it("clears alarm when recurrence is disabled", async () => {
      const item = {
        id: "item-1",
        title: "Test News",
        status: "queued",
        recurrence: {
          enabled: false,
          time: "20:00",
          daysOfWeek: [1],
          addToCalendar: false
        }
      } as ReadingItem;

      await scheduleItemAlarm(item);
      expect(chrome.alarms.clear).toHaveBeenCalledWith("reminder:item:item-1");
    });
  });

  describe("scheduleHabitAlarm", () => {
    it("creates alarm when habit reminder is enabled", async () => {
      const habit: DailyHabitReminder = {
        id: "habit-1",
        label: "Study Newspaper",
        time: "20:00",
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        enabled: true,
        addToCalendar: false
      };

      await scheduleHabitAlarm(habit);
      expect(chrome.alarms.create).toHaveBeenCalledWith(
        "reminder:habit:habit-1",
        expect.objectContaining({
          periodInMinutes: 1440
        })
      );
    });
  });

  describe("syncAllReminders", () => {
    it("syncs active items and habits", async () => {
      const mockReadingRepo = {
        list: vi.fn().mockResolvedValue(
          ok([
            {
              id: "item-1",
              status: "queued",
              recurrence: { enabled: true, time: "20:00", daysOfWeek: [1], addToCalendar: false }
            }
          ])
        )
      };

      const settings = createDefaultSettings();
      settings.dailyReminders = [
        {
          id: "habit-1",
          label: "Daily study",
          time: "08:00",
          daysOfWeek: [1, 2, 3],
          enabled: true,
          addToCalendar: false
        }
      ];

      const mockSettingsRepo = {
        get: vi.fn().mockResolvedValue(ok(settings))
      };

      await syncAllReminders(
        mockReadingRepo as unknown as ReadingRepository,
        mockSettingsRepo as unknown as SettingsRepository
      );
      expect(chrome.alarms.create).toHaveBeenCalledTimes(2);
    });
  });
});
