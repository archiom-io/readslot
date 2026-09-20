import { z } from "zod";
import {
  BackupSchema,
  ItemStatusSchema,
  PrioritySchema,
  ProposalSchema,
  RecurrenceScheduleSchema,
  SettingsSchema
} from "../domain/schemas";

const EmptyPayload = z.object({});
const ItemChangesSchema = z.object({
  status: ItemStatusSchema.optional(),
  priority: PrioritySchema.optional(),
  plannedMinutes: z.number().int().positive().max(10_080).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).optional(),
  collectionId: z.string().max(100).optional(),
  notes: z.string().max(20_000).optional(),
  title: z.string().trim().min(1).max(500).optional(),
  recurrence: RecurrenceScheduleSchema.optional()
});

export const ExtensionMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("capture.preview"), payload: EmptyPayload }),
  z.object({
    type: z.literal("capture.current"),
    payload: z.object({ recurrence: RecurrenceScheduleSchema.optional() }).default({})
  }),
  z.object({
    type: z.literal("capture.url"),
    payload: z.object({
      url: z.url(),
      title: z.string().optional(),
      notes: z.string().optional(),
      recurrence: RecurrenceScheduleSchema.optional()
    })
  }),
  z.object({ type: z.literal("capture.undo"), payload: z.object({ itemId: z.string() }) }),
  z.object({
    type: z.literal("items.list"),
    payload: z.object({
      status: ItemStatusSchema.optional(),
      search: z.string().optional(),
      includeDeleted: z.boolean().optional()
    })
  }),
  z.object({
    type: z.literal("items.update"),
    payload: z.object({ id: z.string(), changes: ItemChangesSchema })
  }),
  z.object({
    type: z.literal("items.remove"),
    payload: z.object({ id: z.string(), permanent: z.boolean().optional() })
  }),
  z.object({ type: z.literal("backup.export"), payload: EmptyPayload }),
  z.object({ type: z.literal("backup.import"), payload: z.object({ backup: BackupSchema }) }),
  z.object({
    type: z.literal("items.export"),
    payload: z.object({ format: z.enum(["csv", "markdown", "bookmarks", "urls"]) })
  }),
  z.object({
    type: z.literal("items.importText"),
    payload: z.object({
      format: z.enum(["csv", "html", "markdown", "urls"]),
      text: z.string().max(10_000_000),
      preview: z.boolean()
    })
  }),
  z.object({ type: z.literal("settings.get"), payload: EmptyPayload }),
  z.object({ type: z.literal("settings.update"), payload: z.object({ settings: SettingsSchema }) }),
  z.object({ type: z.literal("calendar.status"), payload: EmptyPayload }),
  z.object({ type: z.literal("calendar.connect"), payload: EmptyPayload }),
  z.object({ type: z.literal("calendar.disconnect"), payload: EmptyPayload }),
  z.object({ type: z.literal("calendar.list"), payload: EmptyPayload }),
  z.object({
    type: z.literal("suggestions.generate"),
    payload: z.object({ itemIds: z.array(z.string()).optional() })
  }),
  z.object({ type: z.literal("proposals.list"), payload: EmptyPayload }),
  z.object({ type: z.literal("proposals.save"), payload: z.object({ proposal: ProposalSchema }) }),
  z.object({
    type: z.literal("proposals.confirm"),
    payload: z.object({ proposalId: z.string(), conflictOverride: z.boolean().optional() })
  }),
  z.object({ type: z.literal("sessions.list"), payload: EmptyPayload }),
  z.object({
    type: z.literal("sessions.review"),
    payload: z.object({
      sessionId: z.string(),
      completedItemIds: z.array(z.string()),
      skippedItemIds: z.array(z.string())
    })
  }),
  z.object({ type: z.literal("dashboard.stats"), payload: EmptyPayload }),
  z.object({ type: z.literal("weekly.plan"), payload: EmptyPayload }),
  z.object({ type: z.literal("diagnostics.get"), payload: EmptyPayload }),
  z.object({
    type: z.literal("data.reset"),
    payload: z.object({ confirmation: z.literal("DELETE READSLOT DATA") })
  }),
  z.object({
    type: z.literal("navigation.open"),
    payload: z.object({
      page: z.enum(["queue.html", "planner.html", "session.html", "options.html"]),
      itemId: z.string().min(1).optional()
    })
  })
]);

export type ExtensionMessage = z.infer<typeof ExtensionMessageSchema>;
