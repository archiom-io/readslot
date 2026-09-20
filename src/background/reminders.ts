import type { DailyHabitReminder, ReadingItem } from "../domain/schemas";
import type { ReadingRepository, SettingsRepository } from "../domain/ports";

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

/**
 * Calculates the next epoch timestamp (ms) for a given HH:mm time and allowed days of week.
 * 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
 */
export const getNextOccurrence = (
  timeString: string,
  daysOfWeek: number[] = [0, 1, 2, 3, 4, 5, 6],
  now = new Date()
): number => {
  const [hours, minutes] = timeString.split(":").map(Number);
  const allowedDays = new Set(daysOfWeek.length > 0 ? daysOfWeek : [0, 1, 2, 3, 4, 5, 6]);

  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
      hours,
      minutes,
      0,
      0
    );
    if (candidate.getTime() > now.getTime() && allowedDays.has(candidate.getDay())) {
      return candidate.getTime();
    }
  }

  // Fallback if none found within 7 days
  const fallback = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    hours,
    minutes,
    0,
    0
  );
  return fallback.getTime();
};

/**
 * Converts days of week into RFC 5545 RRULE string array for Google Calendar.
 */
export const buildRRule = (daysOfWeek: number[] = [0, 1, 2, 3, 4, 5, 6]): string[] => {
  if (!daysOfWeek || daysOfWeek.length === 0 || daysOfWeek.length === 7) {
    return ["RRULE:FREQ=DAILY"];
  }
  const byDay = daysOfWeek
    .slice()
    .sort((a, b) => a - b)
    .map((day) => DAY_CODES[day])
    .join(",");
  return [`RRULE:FREQ=WEEKLY;BYDAY=${byDay}`];
};

export const scheduleItemAlarm = async (item: ReadingItem): Promise<void> => {
  const alarmName = `reminder:item:${item.id}`;
  if (!item.recurrence || !item.recurrence.enabled || item.status === "deleted") {
    await chrome.alarms.clear(alarmName);
    return;
  }
  const when = getNextOccurrence(item.recurrence.time, item.recurrence.daysOfWeek);
  await chrome.alarms.create(alarmName, {
    when,
    periodInMinutes: 24 * 60
  });
};

export const clearItemAlarm = async (itemId: string): Promise<void> => {
  await chrome.alarms.clear(`reminder:item:${itemId}`);
};

export const scheduleHabitAlarm = async (reminder: DailyHabitReminder): Promise<void> => {
  const alarmName = `reminder:habit:${reminder.id}`;
  if (!reminder.enabled) {
    await chrome.alarms.clear(alarmName);
    return;
  }
  const when = getNextOccurrence(reminder.time, reminder.daysOfWeek);
  await chrome.alarms.create(alarmName, {
    when,
    periodInMinutes: 24 * 60
  });
};

export const clearHabitAlarm = async (reminderId: string): Promise<void> => {
  await chrome.alarms.clear(`reminder:habit:${reminderId}`);
};

export const syncAllReminders = async (
  readingRepo: ReadingRepository,
  settingsRepo: SettingsRepository
): Promise<void> => {
  const [itemsResult, settingsResult] = await Promise.all([
    readingRepo.list({ includeDeleted: false }),
    settingsRepo.get()
  ]);

  if (itemsResult.ok) {
    for (const item of itemsResult.value) {
      if (item.recurrence?.enabled) {
        await scheduleItemAlarm(item);
      }
    }
  }

  if (settingsResult.ok) {
    for (const habit of settingsResult.value.dailyReminders ?? []) {
      if (habit.enabled) {
        await scheduleHabitAlarm(habit);
      }
    }
  }
};
