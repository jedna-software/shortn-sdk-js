# Examples

Small scripts for common server-side flows. Run one from this repository with a TypeScript
runner, for example:

```sh
npm ci
SHORTN_API_KEY=sk_live_... npx tsx examples/node/links.ts
```

`tsx` is not a dependency of the SDK; any TypeScript runner works, or copy the code into
your project.

## Environment

| Variable | Used by | Notes |
|---|---|---|
| `SHORTN_API_KEY` | all but `public-api-helpers.ts` | Keep it server-side. |
| `SHORTN_BASE_URL` | all | Optional; defaults to `https://app.shortn.link`. |
| `SHORTN_WORKSPACE` | `links.ts`, `workspace-resources.ts`, `reports.ts` | A workspace `public_id`. |
| `SHORTN_CLICK_ID` | `track-conversions.ts` | A click id from a conversion-enabled link. |
| `SHORTN_TEST_MODE` | `track-conversions.ts`, `read-conversion-reporting.ts` | `0` for live events; test events by default. |
| `SHORTN_DESTINATION` | `reports.ts` | Optional destination `public_id` for the report. |
| `SHORTN_NEW_DOMAIN` | `domains.ts` | Optional hostname to add and verify. |

## Scripts

| File | What it does |
|---|---|
| `node/links.ts` | Create, read, rename, list and suspend a link, and read its clicks. |
| `node/workspace-resources.ts` | Tags, UTM templates, teams and destinations, created and removed again. |
| `node/domains.ts` | List custom domains; optionally add and verify one. |
| `node/reports.ts` | Create a weekly report rule, pause it, list rules, delete it. |
| `node/track-conversions.ts` | Validate and send a lead, a sale and a refund. |
| `node/read-conversion-reporting.ts` | Summary, attribution, timeline and paged events. |
| `node/public-api-helpers.ts` | Validate a URL, list plans and save a QR code, without a key. |
| `node/retry-and-error-handling.ts` | Tune retries and branch on `ShortnAPIError` codes. |

These scripts change data in the account the key belongs to; try them in a test workspace.
