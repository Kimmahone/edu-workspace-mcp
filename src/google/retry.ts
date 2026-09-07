export type GoogleRetryOptions = {
  idempotent?: boolean;
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
};

type GoogleErrorLike = {
  code?: number | string;
  response?: { status?: number; data?: unknown };
  errors?: Array<{ reason?: string }>;
};

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RATE_LIMIT_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded", "RESOURCE_EXHAUSTED"]);

function statusOf(error: unknown): number | undefined {
  const candidate = error as GoogleErrorLike;
  const raw = candidate?.response?.status ?? candidate?.code;
  const parsed = typeof raw === "string" ? Number(raw) : raw;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function reasonsOf(error: unknown): string[] {
  const candidate = error as GoogleErrorLike;
  const direct = candidate?.errors?.map((entry) => entry.reason).filter((value): value is string => Boolean(value)) ?? [];
  const data = candidate?.response?.data as { error?: { errors?: Array<{ reason?: string }>; status?: string } } | undefined;
  const nested = data?.error?.errors?.map((entry) => entry.reason).filter((value): value is string => Boolean(value)) ?? [];
  return [...direct, ...nested, ...(data?.error?.status ? [data.error.status] : [])];
}

export function isGoogleRateLimitError(error: unknown): boolean {
  const status = statusOf(error);
  return status === 429 || (status === 403 && reasonsOf(error).some((reason) => RATE_LIMIT_REASONS.has(reason)));
}

export function isRetryableGoogleError(error: unknown, idempotent = true): boolean {
  if (isGoogleRateLimitError(error)) return true;
  return idempotent && RETRYABLE_STATUS.has(statusOf(error) ?? 0);
}

export async function withGoogleRetry<T>(operation: () => Promise<T>, options: GoogleRetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const random = options.random ?? Math.random;

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableGoogleError(error, options.idempotent ?? true)) throw error;
      const delay = Math.min(baseDelayMs * (2 ** (attempt - 1)) + Math.floor(random() * baseDelayMs), 8_000);
      await sleep(delay);
    }
  }
}
