# Changelog

All notable changes to this project are documented in this file. The project follows
semantic versioning from its first stable release.

## 0.1.0 - 2026-11-22

First release.

- `Shortn` client for the Shortn API (`<baseUrl>/api/v1`, default
  `https://app.shortn.link`), on the global `fetch` of Node.js 20+ or a custom `fetch`.
  ES modules, CommonJS and type declarations.
- Every API-key and public route: `links`, `analytics`, `workspaces`, `tags`,
  `utmTemplates`, `destinations`, `teams`, `domains`, `reports`, `conversions` (leads,
  sales, refunds, their validations, summary, attribution, timeline, events) and `public`
  (`validateUrl`, `qrCode`, `plans`, usable without a key).
- Typed params and results in the API's snake_case field names; results keep every field
  the API sends.
- `ShortnAPIError` with `status`, `code`, `message`, `hint`, `field`, `details`,
  `requestId` and the raw `body`; `ShortnNetworkError` and `ShortnTimeoutError` for
  requests that got no response.
- Retries on `429` and `503` (honouring `Retry-After`) and on network errors, for `GET`,
  `PUT`, `DELETE` and `POST`s that carry an `idempotency_key` (never `test_mode` writes,
  which the API does not deduplicate); bounded, with exponential
  backoff and jitter, configurable per client and per request, and can be turned off. A
  `Retry-After` longer than `maxDelayMs` (such as the monthly quota's) throws the error at
  once instead of waiting.
- Redirects are not followed; a `3xx` answer is a `ShortnAPIError` naming its `Location`.
- Per-attempt timeout, abort signals, extra headers, and `User-Agent: shortn-sdk-js/0.1.0`.
