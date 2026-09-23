import { SCHEMA_VERSION, SettingsSchema, type Settings } from "./schemas";

export const createDefaultSettings = (): Settings =>
  SettingsSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    readingSpeedWpm: 220,
    defaultUnknownMinutes: 15,
    allowedWeekdays: [1, 2, 3, 4, 5],
    readingWindows: [
      {
        id: "morning",
        label: "Morning Commute",
        start: "08:00",
        end: "08:45",
        days: [1, 2, 3, 4, 5],
        enabled: true
      },
      {
        id: "lunch",
        label: "Lunch Break",
        start: "12:30",
        end: "13:15",
        days: [1, 2, 3, 4, 5],
        enabled: true
      },
      {
        id: "evening",
        label: "Evening Wind-Down",
        start: "19:30",
        end: "21:00",
        days: [0, 1, 2, 3, 4, 5, 6],
        enabled: true
      }
    ],
    earliestStart: "18:00",
    latestEnd: "21:00",
    minimumBlockMinutes: 15,
    preferredBlockMinutes: 30,
    maximumBlockMinutes: 90,
    planningHorizonDays: 14,
    minimumNoticeMinutes: 60,
    bufferBeforeMinutes: 10,
    bufferAfterMinutes: 10,
    maximumBlocksPerDay: 1,
    availabilityCalendarIds: ["primary"],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    defaultReminderMinutes: 10,
    allowConflicts: false,
    ignoreAllDayEvents: false,
    respectDeclinedEvents: true,
    treatTentativeAsBusy: true,
    weeklyPlanningNotification: false,
    dailyReminders: [],
    privacyMode: false
  });
