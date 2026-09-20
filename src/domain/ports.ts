import type {
  Backup,
  CalendarOperation,
  ItemStatus,
  Proposal,
  ReadingItem,
  ReadingSession,
  Settings
} from "./schemas";
import type { Result } from "./result";

export interface ItemQuery {
  status?: ItemStatus;
  search?: string;
  includeDeleted?: boolean;
}

export interface ReadingRepository {
  list(query?: ItemQuery): Promise<Result<ReadingItem[]>>;
  get(id: string): Promise<Result<ReadingItem>>;
  getByCanonicalUrl(url: string): Promise<Result<ReadingItem | undefined>>;
  put(item: ReadingItem): Promise<Result<ReadingItem>>;
  update(id: string, changes: Partial<ReadingItem>): Promise<Result<ReadingItem>>;
  remove(id: string, permanent?: boolean): Promise<Result<void>>;
}

export interface ProposalRepository {
  list(): Promise<Result<Proposal[]>>;
  get(id: string): Promise<Result<Proposal>>;
  put(proposal: Proposal): Promise<Result<Proposal>>;
}

export interface SessionRepository {
  list(): Promise<Result<ReadingSession[]>>;
  get(id: string): Promise<Result<ReadingSession>>;
  put(session: ReadingSession): Promise<Result<ReadingSession>>;
}

export interface SettingsRepository {
  get(): Promise<Result<Settings>>;
  put(settings: Settings): Promise<Result<Settings>>;
}

export interface BackupRepository {
  export(): Promise<Result<Backup>>;
  import(backup: Backup): Promise<Result<{ added: number; skipped: number }>>;
}

export interface CalendarOperationRepository {
  get(id: string): Promise<Result<CalendarOperation | undefined>>;
  put(operation: CalendarOperation): Promise<Result<CalendarOperation>>;
}

export interface CalendarSummary {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: "freeBusyReader" | "reader" | "writer" | "owner";
}

export interface BusyInterval {
  start: string;
  end: string;
}

export interface CreateCalendarEventInput {
  eventId: string;
  calendarId: string;
  title: string;
  description: string;
  start: string;
  end: string;
  timezone: string;
  reminderMinutes?: number;
  transparency: "opaque" | "transparent";
  recurrence?: string[];
  privateProperties: Record<string, string>;
}

export interface CalendarGateway {
  connect(interactive: boolean): Promise<Result<void>>;
  disconnect(): Promise<Result<void>>;
  listCalendars(): Promise<Result<CalendarSummary[]>>;
  getBusy(
    calendarIds: string[],
    start: string,
    end: string,
    timezone: string
  ): Promise<Result<BusyInterval[]>>;
  getEvent(
    calendarId: string,
    eventId: string
  ): Promise<Result<{ id: string; start: string; end: string } | undefined>>;
  createEvent(
    input: CreateCalendarEventInput
  ): Promise<Result<{ id: string; start: string; end: string }>>;
  deleteEvent?(calendarId: string, eventId: string): Promise<Result<void>>;
}
