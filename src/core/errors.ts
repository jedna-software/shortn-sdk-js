export class ShortnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The client was configured wrongly, such as without a fetch implementation. */
export class ShortnConfigurationError extends ShortnError {}

/** The request failed before a response arrived, or was aborted. */
export class ShortnNetworkError extends ShortnError {
  override readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.cause = cause;
  }
}

/** One attempt took longer than `timeoutMs`. */
export class ShortnTimeoutError extends ShortnNetworkError {}

export interface ShortnAPIErrorParams {
  status: number;
  statusText?: string | undefined;
  message: string;
  code?: string | undefined;
  hint?: string | undefined;
  field?: string | undefined;
  details?: unknown | undefined;
  requestId?: string | undefined;
  body: unknown;
  headers: Headers;
}

/**
 * The API answered with a non-2xx status.
 *
 * The API's error envelope is
 * `{"code", "error", "hint"?, "details"?, "request_id"?}`. Plan-limit errors
 * add `feature`, `limit`, `current`, `required_plan` and `upgrade_url` at the
 * top level. `code` is undefined only for an answer that didn't come from the
 * API, such as a proxy's 502 page. `body` keeps the whole parsed response.
 */
export class ShortnAPIError extends ShortnError {
  /** HTTP status. */
  readonly status: number;
  readonly statusText: string;
  /** The stable `code`, when the API sent one. */
  readonly code: string | undefined;
  /** The `hint`, when the API sent one. */
  readonly hint: string | undefined;
  /** `details.field`: the request field at fault. */
  readonly field: string | undefined;
  /** `details`, when the API sent them. */
  readonly details: unknown;
  /** `request_id`, or the `Shortn-Request-Id` response header. */
  readonly requestId: string | undefined;
  /** The parsed response body: an object, a string, or undefined. */
  readonly body: unknown;
  readonly headers: Headers;

  constructor(params: ShortnAPIErrorParams) {
    super(params.message);
    this.status = params.status;
    this.statusText = params.statusText ?? "";
    this.code = params.code;
    this.hint = params.hint;
    this.field = params.field;
    this.details = params.details;
    this.requestId = params.requestId;
    this.body = params.body;
    this.headers = params.headers;
  }
}
