import { z } from "zod";

export const SCHEMA_VERSION = 1;

export const ContentTypeSchema = z.enum(["article", "video", "pdf", "repository", "other"]);
export const ItemStatusSchema = z.enum([
  "queued",
  "proposed",
  "scheduled",
  "in_progress",
  "completed",
  "archived",
  "deleted"
]);
export const PrioritySchema = z.enum(["high", "normal", "low", "someday"]);
export const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export const ProposalStatusSchema = z.enum([
  "draft",
  "ready",
  "stale",
  "confirmed",
  "cancelled",
  "expired"
]);

export const CapturePreviewSchema = z.object({
  title: z.string().trim().min(1).max(500),
  canonicalUrl: z.url(),
  domain: z.string().max(253),
  estimatedMinutes: z.number().int().positive().max(10_080),
  estimateConfidence: ConfidenceSchema,
  duplicate: z.boolean(),
  existingItemId: z.string().min(1).optional(),
  existingItemStatus: ItemStatusSchema.optional()
});

const IsoDateSchema = z.iso.datetime({ offset: true });

export const RecurrenceScheduleSchema = z.object({
  enabled: z.boolean(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm"),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4, 5, 6]),
  addToCalendar: z.boolean().default(false),
  calendarEventId: z.string().optional()
});

export const DailyHabitReminderSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(100).default("Daily reading"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm"),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4, 5, 6]),
  enabled: z.boolean().default(true),
  addToCalendar: z.boolean().default(false),
  calendarEventId: z.string().optional()
});

export const ReadingItemSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  originalUrl: z.url(),
  canonicalUrl: z.url(),
  title: z.string().trim().min(1).max(500),
  domain: z.string().max(253),
  faviconUrl: z.url().optional(),
  contentType: ContentTypeSchema,
  wordCount: z.number().int().nonnegative().optional(),
  imageCount: z.number().int().nonnegative().optional(),
  pageCount: z.number().int().positive().optional(),
  mediaDurationSeconds: z.number().int().nonnegative().optional(),
  estimatedMinutes: z.number().int().positive().max(10_080),
  plannedMinutes: z.number().int().positive().max(10_080).optional(),
  estimateConfidence: ConfidenceSchema,
  priority: PrioritySchema,
  tags: z.array(z.string().trim().min(1).max(50)).max(50),
  collectionId: z.string().max(100).optional(),
  notes: z.string().max(20_000).optional(),
  recurrence: RecurrenceScheduleSchema.optional(),
  status: ItemStatusSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
  lastOpenedAt: IsoDateSchema.optional(),
  completedAt: IsoDateSchema.optional(),
  archivedAt: IsoDateSchema.optional(),
  deletedAt: IsoDateSchema.optional()
});

export const ProposalSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  itemIds: z.array(z.string().min(1)).min(1),
  calendarId: z.string().min(1),
  title: z.string().trim().min(1).max(500),
  description: z.string().max(50_000),
  suggestedStart: IsoDateSchema,
  suggestedEnd: IsoDateSchema,
  durationMinutes: z.number().int().positive().max(1_440),
  reminderMinutes: z.number().int().min(0).max(40_320).optional(),
  score: z.number(),
  explanation: z.array(z.string().min(1).max(500)).min(1),
  confidence: ConfidenceSchema,
  conflictStatus: z.enum(["clear", "unknown", "conflict"]),
  transparency: z.enum(["opaque", "transparent"]),
  status: ProposalStatusSchema,
  generatedAt: IsoDateSchema,
  expiresAt: IsoDateSchema,
  lastValidatedAt: IsoDateSchema.optional()
});

export const ReadingSessionSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  proposalId: z.string().optional(),
  itemIds: z.array(z.string().min(1)).min(1),
  completedItemIds: z.array(z.string().min(1)),
  skippedItemIds: z.array(z.string().min(1)),
  calendarId: z.string().min(1),
  calendarEventId: z.string().min(1),
  start: IsoDateSchema,
  end: IsoDateSchema,
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
  lastSyncedAt: IsoDateSchema
});

export const ReadingWindowSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(50),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  days: z.array(z.number().int().min(0).max(6)).min(1),
  enabled: z.boolean().default(true)
});

export const SettingsSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  readingSpeedWpm: z.number().int().min(50).max(1_000),
  defaultUnknownMinutes: z.number().int().min(5).max(480),
  allowedWeekdays: z.array(z.number().int().min(0).max(6)).min(1),
  readingWindows: z.array(ReadingWindowSchema).default([]),
  earliestStart: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default("18:00"),
  latestEnd: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default("21:00"),
  minimumBlockMinutes: z.number().int().min(5).max(1_440),
  preferredBlockMinutes: z.number().int().min(5).max(1_440),
  maximumBlockMinutes: z.number().int().min(5).max(1_440),
  planningHorizonDays: z.number().int().min(1).max(90),
  minimumNoticeMinutes: z.number().int().min(0).max(10_080),
  bufferBeforeMinutes: z.number().int().min(0).max(240),
  bufferAfterMinutes: z.number().int().min(0).max(240),
  maximumBlocksPerDay: z.number().int().min(1).max(20),
  destinationCalendarId: z.string().optional(),
  availabilityCalendarIds: z.array(z.string()),
  timezone: z.string().min(1),
  defaultReminderMinutes: z.number().int().min(0).max(40_320).optional(),
  allowConflicts: z.boolean(),
  ignoreAllDayEvents: z.boolean(),
  respectDeclinedEvents: z.boolean(),
  treatTentativeAsBusy: z.boolean(),
  weeklyPlanningNotification: z.boolean(),
  dailyReminders: z.array(DailyHabitReminderSchema).default([]),
  privacyMode: z.boolean()
});

export const CalendarOperationSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  proposalId: z.string().min(1),
  deterministicEventId: z.string().min(5),
  state: z.enum(["pending", "confirmed", "failed"]),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
  eventId: z.string().optional(),
  safeErrorCode: z.string().optional()
});

export const BackupSchema = z.object({
  kind: z.literal("readslot-backup"),
  schemaVersion: z.literal(SCHEMA_VERSION),
  exportedAt: IsoDateSchema,
  items: z.array(ReadingItemSchema),
  proposals: z.array(ProposalSchema),
  sessions: z.array(ReadingSessionSchema),
  settings: SettingsSchema
});

export type ContentType = z.infer<typeof ContentTypeSchema>;
export type ItemStatus = z.infer<typeof ItemStatusSchema>;
export type Priority = z.infer<typeof PrioritySchema>;
export type CapturePreview = z.infer<typeof CapturePreviewSchema>;
export type RecurrenceSchedule = z.infer<typeof RecurrenceScheduleSchema>;
export type DailyHabitReminder = z.infer<typeof DailyHabitReminderSchema>;
export type ReadingItem = z.infer<typeof ReadingItemSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
export type ReadingSession = z.infer<typeof ReadingSessionSchema>;
export type ReadingWindow = z.infer<typeof ReadingWindowSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type CalendarOperation = z.infer<typeof CalendarOperationSchema>;
export type Backup = z.infer<typeof BackupSchema>;
