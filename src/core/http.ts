import { VERSION } from "../version";
import {
  ShortnAPIError,
  ShortnConfigurationError,
  ShortnNetworkError,
  ShortnTimeoutError
} from "./errors";
import type {
  FetchLike,
  InternalRequestOptions,
  QueryParams,
  RetryOptions,
  ShortnOptions
} from "./types";

export const DEFAULT_BASE_URL = "https://app.shortn.link";
const DEFAULT_TIMEOUT_MS = 30_000;
interface ResolvedRetry {
  backoffFactor: number;
  initialDelayMs: number;
  jitter: boolean;
  maxDelayMs: number;
  maxRetries: number;
}

const DEFAULT_RETRY_OPTIONS: ResolvedRetry = {
  backoffFactor: 2,
  initialDelayMs: 500,
  jitter: true,
  maxDelayMs: 60_000,
  maxRetries: 2
};
/** Statuses worth retrying: rate limited, or briefly unavailable. */
const RETRY_STATUSES = new Set([429, 503]);
export const SDK_USER_AGENT = `shortn-sdk-js/${VERSION}`;

type NormalizedRetry = false | ResolvedRetry;

type AttemptOutcome<R> =
  | { ok: true; value: R }
  | { ok: false; response: Response; body: unknown };

export class ShortnHttpClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly retry: NormalizedRetry;
  private readonly timeoutMs: number;
  private readonly userAgent: string;

  constructor(options: ShortnOptions) {
    const fetchImpl = options.fetch ?? (globalThis.fetch as FetchLike | undefined);
    if (typeof fetchImpl !== "function") {
      throw new ShortnConfigurationError(
        "A fetch implementation is required. Use Node.js 20+ or pass options.fetch."
      );
    }
    const apiKey = options.apiKey?.trim();
    this.apiKey = apiKey ? apiKey : undefined;
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    this.fetchImpl = fetchImpl;
    this.retry = normalizeRetryOptions(options.retry);
    this.timeoutMs = Math.max(0, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    this.userAgent = options.userAgent?.trim()
      ? `${SDK_USER_AGENT} ${options.userAgent.trim()}`
      : SDK_USER_AGENT;
  }

  /** Sends a request and answers its parsed JSON body (undefined when empty). */
  async request<T>(options: InternalRequestOptions): Promise<T> {
    return (await this.send(options, parseBody)) as T;
  }

  /** Sends a request and answers its body as bytes. */
  requestBytes(options: InternalRequestOptions): Promise<Uint8Array> {
    return this.send(options, async (response) => new Uint8Array(await response.arrayBuffer()));
  }

  buildUrl(path: string, query?: QueryParams): URL {
    const url = new URL(`${this.baseUrl}/api/v1${path}`);
    appendQuery(url, query);
    return url;
  }

  private async send<R>(options: InternalRequestOptions, read: (response: Response) => Promise<R>): Promise<R> {
    const url = this.buildUrl(options.path, options.query);

    const headers = new Headers(options.headers);
    if (this.apiKey && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${this.apiKey}`);
    }
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    headers.set("User-Agent", this.userAgent);

    let body: string | undefined;
    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.body);
    }

    const retry = options.retry === undefined ? this.retry : normalizeRetryOptions(options.retry);
    const retryable = isRetryableRequest(options);

    for (let attempt = 0; ; attempt += 1) {
      const canRetry = retry !== false && retryable && attempt < retry.maxRetries;
      // Never follow a redirect: a 301/302 would turn a POST into a GET.
      const init: RequestInit = { headers, method: options.method, redirect: "manual" };
      if (body !== undefined) init.body = body;

      let outcome: AttemptOutcome<R>;
      try {
        outcome = await this.attempt(url, init, options.signal, read);
      } catch (error) {
        const requestError = toRequestError(error);
        // An abort the caller asked for is never retried.
        if (canRetry && !options.signal?.aborted) {
          await waitForRetry(backoffDelayMs(retry, attempt), options.signal);
          continue;
        }
        throw requestError;
      }

      if (outcome.ok) return outcome.value;

      const { response } = outcome;
      const apiError = apiErrorFromResponse(response, outcome.body);
      if (canRetry && RETRY_STATUSES.has(response.status)) {
        const delay = retryDelayMs(response.headers, retry, attempt);
        // A Retry-After beyond maxDelayMs (the monthly quota sends days) is
        // not worth waiting for: answer the error now.
        if (delay === undefined) throw apiError;
        await waitForRetry(delay, options.signal);
        continue;
      }
      throw apiError;
    }
  }

  /**
   * One attempt: the fetch and the whole body read, both under the timeout and
   * the caller's signal. An error response's body is parsed for the error.
   */
  private async attempt<R>(
    url: URL,
    init: RequestInit,
    signal: AbortSignal | undefined,
    read: (response: Response) => Promise<R>
  ): Promise<AttemptOutcome<R>> {
    if (signal?.aborted) {
      throw new ShortnNetworkError("Shortn request was aborted.", signal.reason);
    }
    const controller = new AbortController();
    // Settles the attempt even when a fetch or body ignores the abort signal.
    let stop: (reason: unknown) => void = () => {};
    const stopped = new Promise<never>((_resolve, reject) => {
      stop = reject;
    });
    stopped.catch(() => {});
    const abort = () => {
      controller.abort();
      stop(controller.signal.reason);
    };
    let timedOut = false;
    const timeout = this.timeoutMs > 0
      ? setTimeout(() => {
        timedOut = true;
        abort();
      }, this.timeoutMs)
      : undefined;
    signal?.addEventListener("abort", abort, { once: true });

    let received = false;
    try {
      const response = await Promise.race([
        this.fetchImpl(url, { ...init, signal: controller.signal }),
        stopped
      ]);
      received = true;
      if (response.ok) return { ok: true, value: await Promise.race([read(response), stopped]) };
      return { body: await Promise.race([parseBody(response), stopped]), ok: false, response };
    } catch (error) {
      if (timedOut) {
        throw new ShortnTimeoutError(`Shortn request timed out after ${this.timeoutMs}ms.`, error);
      }
      if (signal?.aborted) {
        throw new ShortnNetworkError("Shortn request was aborted.", error);
      }
      throw new ShortnNetworkError(
        received
          ? "Shortn request failed while reading the response."
          : "Shortn request failed before receiving a response.",
        error
      );
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
}

/**
 * GET, PUT and DELETE are safe to repeat; a POST only when it carries an
 * `idempotency_key` (the conversion endpoints record it once) and is not a
 * `test_mode` write, which the API never deduplicates. PATCH never.
 */
export function isRetryableRequest(options: Pick<InternalRequestOptions, "method" | "body">): boolean {
  switch (options.method) {
    case "GET":
    case "PUT":
    case "DELETE":
      return true;
    case "POST": {
      if (!isRecord(options.body) || options.body.test_mode === true) return false;
      const key = options.body.idempotency_key;
      return typeof key === "string" && key.trim() !== "";
    }
    default:
      return false;
  }
}

function toRequestError(error: unknown): ShortnNetworkError {
  if (error instanceof ShortnNetworkError) return error;
  return new ShortnNetworkError("Shortn request failed before receiving a response.", error);
}

function apiErrorFromResponse(response: Response, parsed: unknown): ShortnAPIError {
  const redirect = redirectMessage(response);
  const record = isRecord(parsed) ? parsed : undefined;
  const details = record?.details;
  const field = isRecord(details) ? stringValue(details.field) : undefined;
  return new ShortnAPIError({
    body: parsed,
    code: stringValue(record?.code),
    details,
    field: field ?? stringValue(record?.field),
    headers: response.headers,
    hint: stringValue(record?.hint),
    message: redirect
      ?? stringValue(record?.error)
      ?? stringValue(record?.message)
      ?? (typeof parsed === "string" && parsed.trim() ? parsed.trim().slice(0, 500) : undefined)
      ?? `Shortn API request failed with status ${response.status}`,
    requestId: stringValue(record?.request_id) ?? response.headers.get("shortn-request-id") ?? undefined,
    status: response.status,
    statusText: response.statusText
  });
}

/** The error message for a redirect the SDK did not follow; undefined otherwise. */
function redirectMessage(response: Response): string | undefined {
  // A browser-style fetch hides a manual redirect as an opaque status 0.
  if (response.type === "opaqueredirect") {
    return "Shortn API answered a redirect, which the SDK does not follow. Check baseUrl.";
  }
  if (response.status < 300 || response.status > 399) return undefined;
  const location = response.headers.get("location");
  return `Shortn API answered ${response.status} redirecting to ${location ?? "(no Location)"}, `
    + "which the SDK does not follow. Check baseUrl.";
}

function appendQuery(url: URL, query: QueryParams | undefined) {
  if (!query) return;
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      url.searchParams.set(key, value.join(","));
    } else if (value instanceof Date) {
      url.searchParams.set(key, value.toISOString());
    } else {
      url.searchParams.set(key, String(value));
    }
  }
}

function normalizeRetryOptions(value: false | RetryOptions | undefined): NormalizedRetry {
  if (value === false) return false;
  return {
    backoffFactor: finiteAtLeast(value?.backoffFactor, DEFAULT_RETRY_OPTIONS.backoffFactor, 1),
    initialDelayMs: finiteAtLeast(value?.initialDelayMs, DEFAULT_RETRY_OPTIONS.initialDelayMs, 0),
    jitter: value?.jitter ?? DEFAULT_RETRY_OPTIONS.jitter,
    maxDelayMs: finiteAtLeast(value?.maxDelayMs, DEFAULT_RETRY_OPTIONS.maxDelayMs, 0),
    maxRetries: Math.floor(finiteAtLeast(value?.maxRetries, DEFAULT_RETRY_OPTIONS.maxRetries, 0))
  };
}

function finiteAtLeast(value: number | undefined, fallback: number, minimum: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(minimum, value) : fallback;
}

/** The delay before the next attempt; undefined when Retry-After exceeds maxDelayMs. */
function retryDelayMs(headers: Headers, retry: ResolvedRetry, attempt: number): number | undefined {
  const retryAfter = headers.get("retry-after");
  const retryAfterMs = retryAfter ? parseRetryAfterMs(retryAfter) : undefined;
  if (retryAfterMs !== undefined) return retryAfterMs > retry.maxDelayMs ? undefined : retryAfterMs;
  return backoffDelayMs(retry, attempt);
}

function backoffDelayMs(retry: ResolvedRetry, attempt: number): number {
  const delay = Math.min(retry.initialDelayMs * retry.backoffFactor ** attempt, retry.maxDelayMs);
  if (!retry.jitter || delay <= 0) return delay;
  return Math.round(delay * (0.8 + Math.random() * 0.4));
}

function parseRetryAfterMs(value: string): number | undefined {
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed) * 1_000;
  const timestamp = Date.parse(trimmed);
  if (!Number.isNaN(timestamp)) return Math.max(0, timestamp - Date.now());
  return undefined;
}

function waitForRetry(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new ShortnNetworkError("Shortn request was aborted before retrying.", signal.reason));
  }
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timeout);
      reject(new ShortnNetworkError("Shortn request was aborted before retrying.", signal?.reason));
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_BASE_URL;
  // Accept a base URL that already ends in /api/v1.
  return trimmed.replace(/\/api\/v1$/, "");
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
