import type { ShortnHttpClient } from "../core/http";
import type { RequestOptions } from "../core/types";

/** URL-escapes one path segment; refuses an empty one. */
export function segment(value: string | number, name: string): string {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new TypeError(`${name} is required`);
  }
  return encodeURIComponent(text);
}

export function requestOptions(options: RequestOptions | undefined): RequestOptions {
  const next: RequestOptions = {};
  if (!options) return next;
  if (options.headers !== undefined) next.headers = options.headers;
  if (options.retry !== undefined) next.retry = options.retry;
  if (options.signal !== undefined) next.signal = options.signal;
  return next;
}

export abstract class Resource {
  constructor(protected readonly http: ShortnHttpClient) {}
}
