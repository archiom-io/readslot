export type DomainErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNSUPPORTED_PAGE"
  | "STORAGE_ERROR"
  | "OAUTH_NOT_CONFIGURED"
  | "OAUTH_DISCONNECTED"
  | "OAUTH_DENIED"
  | "OAUTH_REVOKED"
  | "OAUTH_REVOCATION_FAILED"
  | "CALENDAR_LIST_FORBIDDEN"
  | "CALENDAR_BUSY_FORBIDDEN"
  | "CALENDAR_UNAVAILABLE"
  | "CALENDAR_EVENT_EXISTS"
  | "CALENDAR_EVENT_NOT_FOUND"
  | "CALENDAR_READ_ONLY"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "STALE_PROPOSAL"
  | "INTERNAL_ERROR";

export interface DomainError {
  code: DomainErrorCode;
  message: string;
  retryable?: boolean;
  context?: Record<string, string | number | boolean>;
}

export type Result<T, E = DomainError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = (error: DomainError): Result<never> => ({ ok: false, error });

export const toDomainError = (error: unknown): DomainError => {
  if (error instanceof Error) {
    return { code: "INTERNAL_ERROR", message: error.message || "An unexpected error occurred." };
  }
  return { code: "INTERNAL_ERROR", message: "An unexpected error occurred." };
};
