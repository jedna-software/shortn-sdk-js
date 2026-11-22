# Shortn TypeScript SDK

TypeScript SDK for the [Shortn](https://shortn.link) API: links, analytics, workspaces,
tags, UTM templates, report destinations, teams, custom domains, report and alert rules,
conversions, and the key-less public helpers.

Use it from trusted server-side code (Node.js 20+, serverless functions, background jobs).
Never bundle it into browser code with a secret API key.

The SDK is server-only, `public.*` included: it does not work in a browser. The API allows
cross-origin requests only from shortn.link's own site, and never allows the
`Authorization` header, so a browser blocks every call the SDK makes from another origin.
Call it from your backend; for browser attribution, use the
[capture script](https://docs.shortn.link/docs/conversion-tracking/install-capture-script/).

## Install

```sh
npm install @jednasoftware/shortn-sdk
```

The package has no runtime dependencies. It uses the global `fetch` of Node.js 20+, or
the `fetch` you pass in. It ships ES modules, CommonJS and type declarations.

## Quickstart

```ts
import { Shortn } from "@jednasoftware/shortn-sdk";

const shortn = new Shortn({ apiKey: process.env.SHORTN_API_KEY });

const { data: workspaces } = await shortn.workspaces.list();

const link = await shortn.links.create({
  title: "Spring campaign",
  url: "https://example.com/spring",
  workspace_public_id: workspaces[0]!.public_id
});

console.log(link.short_url);
```

Every method answers the JSON body the API returns, typed. Params and results use the
API's own snake_case field names, as the [API reference](https://docs.shortn.link/docs/api/)
documents them, and results keep every field the API sends, including ones this SDK
version doesn't know yet.

## Configuration

```ts
const shortn = new Shortn({
  apiKey: process.env.SHORTN_API_KEY, // optional only for shortn.public
  baseUrl: "https://app.shortn.link", // default; the SDK appends /api/v1
  timeoutMs: 30_000, // per attempt; 0 disables it
  retry: { maxRetries: 2, initialDelayMs: 500, maxDelayMs: 60_000, backoffFactor: 2, jitter: true },
  fetch: customFetch, // any fetch-compatible function, such as for tests or a proxy
  userAgent: "my-app/1.2" // appended to shortn-sdk-js/0.1.0
});
```

Each method also takes request options as its last argument: `headers`, `signal` (an
`AbortSignal`) and `retry`.

## Resources

| Group | Methods |
|---|---|
| `links` | `list`, `get`, `create`, `update`, `delete` (suspends), `enable`, `setAbWinner` |
| `analytics` | `link` |
| `workspaces` | `list`, `get` |
| `tags` | `list`, `create`, `get`, `update`, `delete` |
| `utmTemplates` | `list`, `create`, `update`, `delete` |
| `destinations` | `list`, `create`, `update`, `delete` |
| `teams` | `list`, `create`, `get`, `update`, `delete` (archives) |
| `domains` | `list`, `create`, `verify`, `delete` |
| `reports` | `listRules`, `getRule`, `createRule`, `updateRule`, `deleteRule` |
| `conversions` | `trackLead`, `validateLead`, `trackSale`, `validateSale`, `trackRefund`, `validateRefund`, `summary`, `attribution`, `timeline`, `events` |
| `public` | `validateUrl`, `qrCode`, `plans` (no key needed) |

[docs/api-reference.md](./docs/api-reference.md) lists every method with its route, and
[examples/](./examples) has runnable scripts.

### Links

Links are identified by their `public_id`.

```ts
const created = await shortn.links.create({
  title: "Spring campaign",
  url: "https://example.com/spring",
  tag_public_ids: [tag.public_id],
  utm_source: "newsletter",
  utm_medium: "email"
});

const { data: link } = await shortn.links.get(created.public_id);
await shortn.links.update(link.public_id, { title: "Spring sale" });

const page = await shortn.links.list({ limit: 100, offset: 0 });
if (page.pagination.has_more) {
  await shortn.links.list({ limit: 100, offset: page.pagination.next_offset! });
}

await shortn.links.delete(link.public_id); // suspends; analytics are kept
await shortn.links.enable(link.public_id);
await shortn.links.setAbWinner(link.public_id, { variant: "B" });
```

### Analytics

```ts
const { total_clicks, unique_clicks, clicks_by_country } = await shortn.analytics.link(link.public_id);
```

### Workspaces

```ts
const { data: workspaces } = await shortn.workspaces.list();
const { data: workspace } = await shortn.workspaces.get(workspaces[0]!.public_id);
```

### Tags

```ts
const tag = await shortn.tags.create(workspace.public_id, { name: "Spring", color: "#3b82f6" });
await shortn.tags.update(tag.public_id, { color: "#16a34a" });
const { tags } = await shortn.tags.list(workspace.public_id, { team: "none" }); // tags is null when empty
await shortn.tags.delete(tag.public_id);
```

### UTM templates

```ts
const { data: template } = await shortn.utmTemplates.create(workspace.public_id, {
  name: "Newsletter",
  utm_source: "newsletter",
  utm_medium: "email"
});
// PUT replaces the template: send every value to keep.
await shortn.utmTemplates.update(template.public_id, { name: "Newsletter", utm_source: "newsletter", utm_medium: "email", utm_campaign: "spring" });
await shortn.utmTemplates.list(workspace.public_id, { include_team_scoped: true });
await shortn.utmTemplates.delete(template.public_id, { links: "keep" });
```

### Destinations

```ts
const destination = await shortn.destinations.create(workspace.public_id, {
  name: "Ops webhook",
  type: "webhook",
  config: { webhook_url: "https://example.com/hooks/shortn" }
});
await shortn.destinations.update(workspace.public_id, destination.public_id, { name: "Ops", type: "webhook" });
const destinations = await shortn.destinations.list(workspace.public_id); // a plain array
await shortn.destinations.delete(workspace.public_id, destination.public_id);
```

### Teams

Teams are read, changed and archived by `slug`. A slug is unique only within its
workspace; pass `{ workspace }` when the key reaches several workspaces.

```ts
const team = await shortn.teams.create(workspace.public_id, { name: "Paid Social" });
await shortn.teams.get(team.slug, { workspace: workspace.public_id });
await shortn.teams.update(team.slug, { description: "Paid campaigns" }, { workspace: workspace.public_id });
await shortn.teams.list(workspace.public_id);
await shortn.teams.delete(team.slug, { workspace: workspace.public_id }); // archives
```

### Domains

Domains have a numeric `id`. Adding, verifying and deleting need an account-wide key.

```ts
const { domain } = await shortn.domains.create({ domain: "go.example.com" });
console.log(domain.dns); // records to create at your DNS provider
const { verification } = await shortn.domains.verify(domain.id);
await shortn.domains.list();
await shortn.domains.delete(domain.id);
```

### Reports and alerts

```ts
const { data: rule } = await shortn.reports.createRule({
  workspace_public_id: workspace.public_id,
  report_type: "custom_builder_v1",
  schedule_type: "every_x",
  interval_seconds: 604800,
  report_name: "Weekly traffic",
  destination_public_ids: [destination.public_id],
  definition_json: {
    version: "custom_builder.v1",
    trigger: "scheduled",
    sections: [{ id: "total_clicks", order: 1, settings: { window: "7d" } }]
  }
});
await shortn.reports.updateRule(rule.public_id, { enabled: false }); // pause
await shortn.reports.listRules({ workspace_public_id: workspace.public_id, schedule_types: ["every_x"] });
await shortn.reports.getRule(rule.public_id);
await shortn.reports.deleteRule(rule.public_id);
```

### Conversions

Send leads, sales and refunds from your backend, with the click id the
[capture script](https://docs.shortn.link/docs/conversion-tracking/install-capture-script/)
stored for the visitor. `amount_cents` is in hundredths of the currency's main unit.

```ts
await shortn.conversions.trackLead({
  click_id: clickId,
  event_name: "Sign up",
  lead_category: "signup",
  idempotency_key: "signup_8412" // required for leads
});

await shortn.conversions.trackSale({
  click_id: clickId,
  amount_cents: 4900,
  currency: "EUR",
  invoice_id: "inv_123"
});

await shortn.conversions.trackRefund({ invoice_id: "inv_123", refund_id: "re_456", amount_cents: 1900 });

// Same bodies, checked without recording anything:
const check = await shortn.conversions.validateSale({ click_id: clickId, amount: "49.00", currency: "EUR", invoice_id: "inv_124" });

// Reports. Send test_mode: true on writes, and read them back with environment "test".
await shortn.conversions.summary();
await shortn.conversions.attribution({ from: "2026-11-01", to: "2026-11-30", limit: 20 });
await shortn.conversions.timeline({ interval: "week", environment: "test" });
await shortn.conversions.events({ event_type: "sale", limit: 50, offset: 0 });
```

Conversion events hold no customer profile: keep names, emails and other personal data
out of `event_name` and `metadata`.

### Public helpers (no API key)

```ts
const anonymous = new Shortn();

const check = await anonymous.public.validateUrl("example.com/menu"); // { valid, normalized }
const { plans } = await anonymous.public.plans(); // keyed by plan ID; fields are capitalized
const png = await anonymous.public.qrCode({ url: "https://shtnl.ink/abC12x9", size: "download" }); // Uint8Array
```

Creating a link without a key, and the public preview of an anonymous link, need a browser
human check on shortn.link, so they aren't part of the SDK: use `links.create` and
`analytics.link` with a key.

## Errors

A non-2xx answer throws `ShortnAPIError`:

```ts
import { ShortnAPIError, ShortnNetworkError, ShortnTimeoutError } from "@jednasoftware/shortn-sdk";

try {
  await shortn.links.create({ title: "Pricing", url: "https://example.com/pricing", custom_code: "pricing" });
} catch (error) {
  if (error instanceof ShortnAPIError) {
    error.status;    // 409
    error.code;      // "custom_code_conflict", stable and safe to branch on
    error.message;   // the API's readable `error`
    error.hint;      // the API's `hint`, when sent
    error.field;     // `details.field`: the request field at fault
    error.details;   // `details`, when sent
    error.requestId; // `request_id` / Shortn-Request-Id, on conversion writes
    error.body;      // the whole parsed body, e.g. plan-limit `feature` and `required_plan`
  } else if (error instanceof ShortnTimeoutError) {
    // one attempt took longer than timeoutMs
  } else if (error instanceof ShortnNetworkError) {
    // no response: DNS, connection, or an aborted request
  }
}
```

Every error the API sends carries `code`; it is `undefined` only when the answer didn't come
from the API, such as a proxy's `502` page. An empty path ID
throws a `TypeError` before anything is sent. The client never follows redirects: a `3xx`
answer is a `ShortnAPIError` whose message names the status and `Location` (usually a
`baseUrl` that needs `https://` or another host).

## Retries

The client retries a request when it gets `429` or `503`, or no response at all, but only
when repeating it is safe:

- `GET`, `PUT` and `DELETE`;
- a `POST` whose body carries an `idempotency_key` (the conversion writes record it once),
  unless it sets `test_mode: true`: the API never deduplicates test events, so a retry would
  record a second one.

`PATCH`, test-mode conversions and other `POST`s are never retried. On `429` and `503` the client waits the
`Retry-After` seconds; when `Retry-After` is longer than `maxDelayMs` (the monthly quota's
`api_monthly_limit_exceeded` sends the time until the quota resets, often days) it throws the
`ShortnAPIError` at once instead of waiting. Without `Retry-After` it backs off exponentially
from `initialDelayMs`, with jitter. By default it retries twice. Turn retries off with
`retry: false` on the client or on one request, or tune them with `retry: { maxRetries }`.

## Development

```sh
npm ci
npm run typecheck
npm test            # offline unit tests, mocked fetch
npm run build
```

`npm run test:smoke` runs the opt-in smoke test against a live instance; see
[CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
