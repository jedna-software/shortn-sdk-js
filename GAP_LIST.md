# Gap list

What this SDK covers of the Shortn public API (`/api/v1`), and what is left.

## Covered

All 50 API-key and public routes, one method each:

- links: list, get, create, update, delete (suspend), enable, setAbWinner
- analytics: link
- workspaces: list, get
- tags: list, create, get, update, delete
- utmTemplates: list, create, update, delete
- destinations: list, create, update, delete
- teams: list, create, get, update, delete (archive)
- domains: list, create, verify, delete
- reports: listRules, getRule, createRule, updateRule, deleteRule
- conversions: trackLead, validateLead, trackSale, validateSale, trackRefund,
  validateRefund, summary, attribution, timeline, events
- public (no key): validateUrl, qrCode, plans

Client: API key, base URL, per-attempt timeout, retries (429/503 with `Retry-After`,
network errors; GET/PUT/DELETE and POSTs with an `idempotency_key` that are not
`test_mode`), custom `fetch`,
`ShortnAPIError` with status, code, message, hint, field, details, request id and body.

Tests: offline unit tests for every method (method, escaped path, query, body, headers),
error mapping and the retry rules; an opt-in smoke test against a live instance
(`npm run test:smoke`).

## Left out on purpose

- Key-less `POST /links` and `GET /links/{code}/analytics`: both need a browser human check
  (`X-Turnstile-Token`), so a server can't call them. Use `links.create` and
  `analytics.link` with a key.
- Dashboard (browser-session) endpoints.

## Behaviour to know

- Test mode and refunds (by design): a `test_mode` refund names a live sale's `invoice_id`
  and is recorded as a test event that leaves the sale's totals alone; a test-mode sale can't
  be refunded, so the smoke test expects `404 conversion_sale_not_found` for that step.
  Test-mode leads and sales are never deduplicated: each request records a new test event,
  so the SDK never retries a `test_mode` write.

## Left to do

- Pagination helpers (an async iterator over `links.list` and `conversions.events`).
- Typed `definition_json` sections and alert conditions for report rules; today
  `ReportDefinition` types the envelope and leaves section settings open.
- Narrower types for a few loosely documented results: `UpdateUtmTemplateResponse.move_impact`,
  `ConversionAttributionResponse.pagination`, domain `verification.txt` / `routing`.
- The API can't yet delete a link for good (only suspend it), change a link's schedule,
  targeting, UTM, tags, access or conversion settings after creation, or pause a report rule
  at creation; the SDK will follow when it does.
