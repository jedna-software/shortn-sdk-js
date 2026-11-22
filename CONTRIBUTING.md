# Contributing

Thanks for your interest in improving the Shortn TypeScript SDK.

## Development

Requirements: Node.js 20 or newer, npm 10 or newer.

```sh
npm ci
npm run typecheck
npm test
npm run build
```

`npm test` runs the unit tests offline, against a mocked `fetch`; it never runs the smoke
test, whatever is set in your shell. `dist/` and
`node_modules/` are build output and stay out of git.

## Smoke test

`test/smoke.test.ts` runs the whole surface against a live instance. Only
`npm run test:smoke` runs it, and it is skipped unless `SHORTN_API_KEY` is set:

```sh
export SHORTN_API_KEY=...            # a key with every scope, account-wide
export SHORTN_BASE_URL=https://...   # a development instance
export SHORTN_SMOKE_WORKSPACE=...    # a workspace the test may write in
export SHORTN_SMOKE_CLICK_ID=...     # optional: a click on a conversion-enabled link
npm run test:smoke
```

It creates links, tags, UTM templates, teams, a webhook destination, a report rule that
first runs in 2099, and test-mode conversions, all with unique names, and deletes them again
even when a step fails. Links can only be suspended through the API, so its test links
remain, suspended. It refuses `https://app.shortn.link` unless
`SHORTN_SMOKE_ALLOW_PRODUCTION=1` is set. Never commit keys or env files.

## Pull requests

- Keep public API changes small and typed, with field names as the API sends them.
- Add a unit test for each new method: method, path, query, body and the answer.
- Do not add runtime dependencies without a strong reason.
- Never include real API keys, user data or production responses in fixtures.

## Release policy

Releases map to documented Shortn API behavior. If an endpoint is not stable in the API,
wait until it is.
