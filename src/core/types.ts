export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue | undefined };

/**
 * An object the API answers. The SDK types the documented fields; anything
 * else the API sends stays reachable through the index signature, so new
 * API fields need no SDK release.
 */
export type ApiObject = { [key: string]: unknown };

/** A time sent to the API: a `Date`, or an RFC 3339 string. */
export type DateInput = Date | string;

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface RetryOptions {
  /** Retries after the first attempt. Default 2. `0` disables retries. */
  maxRetries?: number | undefined;
  /** Delay before the first retry, in milliseconds. Default 500. */
  initialDelayMs?: number | undefined;
  /**
   * Upper bound for one backoff delay. Default 60000. A `Retry-After` longer
   * than this is not waited for: the error is thrown at once.
   */
  maxDelayMs?: number | undefined;
  /** Multiplier applied to the delay after each retry. Default 2. */
  backoffFactor?: number | undefined;
  /** Randomize each backoff delay by +/-20%. Default true. */
  jitter?: boolean | undefined;
}

export interface ShortnOptions {
  /** API key (`sk_live_...`). Optional only for the public helpers. */
  apiKey?: string | undefined;
  /** Default `https://app.shortn.link`; the SDK appends `/api/v1`. */
  baseUrl?: string | undefined;
  /** A fetch implementation. Defaults to the global `fetch` (Node.js 20+). */
  fetch?: FetchLike | undefined;
  /** Retry options, or `false` to never retry. */
  retry?: false | RetryOptions | undefined;
  /**
   * Timeout for one attempt, reading the response body included, in
   * milliseconds. Default 30000; `0` disables it.
   */
  timeoutMs?: number | undefined;
  /** Appended to the SDK's `User-Agent`, such as `my-app/1.2`. */
  userAgent?: string | undefined;
}

export interface RequestOptions {
  /** Extra headers for this request. */
  headers?: Record<string, string> | undefined;
  /** Retry options for this request, or `false` to never retry it. */
  retry?: false | RetryOptions | undefined;
  /** Aborts the request, also while its response body is being read. */
  signal?: AbortSignal | undefined;
}

export type QueryValue =
  | string
  | number
  | boolean
  | Date
  | ReadonlyArray<string | number>
  | null
  | undefined;
export type QueryParams = Record<string, QueryValue>;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface InternalRequestOptions extends RequestOptions {
  body?: unknown;
  method: HttpMethod;
  path: string;
  query?: QueryParams | undefined;
}

/** Offset pagination, as `GET /links` and `GET /conversions/events` answer it. */
export interface Pagination extends ApiObject {
  limit: number;
  offset?: number;
  count: number;
  has_more: boolean;
  next_offset?: number | null;
}

export interface ListParams {
  /** 1 to 100. Default 50. */
  limit?: number | undefined;
  /** How many items to skip. Default 0. */
  offset?: number | undefined;
}

/** `{"message": "..."}`, as several write endpoints answer. */
export interface MessageResponse extends ApiObject {
  message: string;
}

/** `{"success": true}`, as the team and destination endpoints answer. */
export interface SuccessResponse extends ApiObject {
  success: boolean;
}
