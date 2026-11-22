# API reference

Every method sends one request to `<baseUrl>/api/v1` and answers the JSON body the API
returns. Params and results use the API's snake_case field names; result types also have
an index signature, so fields added to the API later are still reachable. Each method takes
`RequestOptions` (`headers`, `signal`, `retry`) as its last argument. Path IDs are
URL-escaped; query parameters you leave out are not sent.

For what each field means, see the [Shortn API docs](https://docs.shortn.link/docs/api/).

## Client

### `new Shortn(options?: ShortnOptions)`

| Option | Default | Notes |
|---|---|---|
| `apiKey` | none | Sent as `Authorization: Bearer <key>`. Optional only for `shortn.public`. |
| `baseUrl` | `https://app.shortn.link` | The SDK appends `/api/v1` (a base URL already ending in `/api/v1` also works). |
| `timeoutMs` | `30000` | Per attempt, reading the response body included; `0` disables it. |
| `retry` | see below | `RetryOptions`, or `false` to never retry. |
| `fetch` | global `fetch` | Any fetch-compatible function. |
| `userAgent` | none | Appended to `shortn-sdk-js/0.1.0`. |

`RetryOptions`: `maxRetries` (2), `initialDelayMs` (500), `maxDelayMs` (60000),
`backoffFactor` (2), `jitter` (true). A `Retry-After` longer than `maxDelayMs` is not
waited for: the `ShortnAPIError` is thrown at once.

Retried: `429` and `503` responses and network errors, for `GET`, `PUT`, `DELETE`, and
`POST`s whose body has an `idempotency_key`. Never `PATCH`, `POST`s with `test_mode: true`
(the API never deduplicates test events) or other `POST`s.

Redirects are never followed: a `3xx` answer throws a `ShortnAPIError` naming the status and
`Location`.

## Links

| Method | Route | Params | Result |
|---|---|---|---|
| `links.list(params?)` | `GET /links` | `ListLinksParams`: `limit`, `offset` | `LinkList` (`data: Link[]`, `pagination`) |
| `links.get(publicId)` | `GET /links/{public_id}` | | `LinkResponse` (`data: Link`) |
| `links.create(params)` | `POST /links` | `CreateLinkParams` (`url`, `title` required) | `CreatedLink` |
| `links.update(publicId, params)` | `PATCH /links/{public_id}` | `UpdateLinkParams`: `title`, `description`, `url`, `short_code`, `domain`, `status`, `active`, `team_public_ids` | `UpdateLinkResponse` |
| `links.delete(publicId)` | `DELETE /links/{public_id}` | | `MessageResponse`; suspends the link |
| `links.enable(publicId)` | `POST /links/{public_id}/enable` | | `MessageResponse` |
| `links.setAbWinner(publicId, params)` | `POST /links/{public_id}/ab/winner` | `SetAbWinnerParams`: `variant` | `AbWinnerResponse` |

`CreateLinkParams` covers every field `POST /links` accepts: basics (`description`,
`custom_code`, `short_domain`), placement (`workspace_public_id`, `team_public_ids`,
`tag_public_ids`, `utm_template_id`, `utm_*`), schedule (`starts_at`, `expires_at`,
`expiration_action`), access (`access_mode`, `password`, `access_duration_hours`,
`jit_allowlist`), targeting (`targeting_geo_overrides`, `language_targets`,
`device_targets`, `os_targets`, `browser_targets`, `mobile_target_ios`,
`mobile_target_android`, `targeting_priority`), A/B (`ab_variants`, `ab_destination`,
`ab_split_percent`), conversions (`conversion_enabled`, `conversion_attribution_model`,
`conversion_attribution_window_days`, `attribution`), share preview (`preview_*`) and
`cloaking_enabled`. Times take a `Date` or an RFC 3339 string. The API refuses unknown
fields with `400 unsupported_fields`.

## Analytics

| Method | Route | Result |
|---|---|---|
| `analytics.link(publicId, query?)` | `GET /analytics/links/{public_id}` | `LinkAnalytics`: `total_clicks`, `unique_clicks`, `clicks_by_country` |

The endpoint documents no query parameters; `query` is passed through as is.

## Workspaces

| Method | Route | Result |
|---|---|---|
| `workspaces.list()` | `GET /workspaces` | `WorkspaceList` (`data: Workspace[]`) |
| `workspaces.get(workspacePublicId)` | `GET /workspaces/{public_id}` | `WorkspaceResponse` (`data: Workspace`) |

## Tags

| Method | Route | Params | Result |
|---|---|---|---|
| `tags.list(workspacePublicId, params?)` | `GET /workspaces/{id}/tags` | `ListTagsParams`: `team_public_ids`, `team`, `report_scope` | `TagList` (`tags: Tag[] \| null`) |
| `tags.create(workspacePublicId, params)` | `POST /workspaces/{id}/tags` | `CreateTagParams`: `name`, `color`, `team_public_ids` | `Tag` |
| `tags.get(tagPublicId)` | `GET /tags/{id}` | | `Tag` |
| `tags.update(tagPublicId, params)` | `PUT /tags/{id}` | `UpdateTagParams`: `name`, `color` or `team_public_ids` | `Tag` |
| `tags.delete(tagPublicId)` | `DELETE /tags/{id}` | | `DeleteTagResponse` (`message`, `links_updated`) |

## UTM templates

| Method | Route | Params | Result |
|---|---|---|---|
| `utmTemplates.list(workspacePublicId, params?)` | `GET /workspaces/{id}/utm-templates` | `ListUtmTemplatesParams`: `include_team_scoped`, `team_public_ids` | `UtmTemplateList` |
| `utmTemplates.create(workspacePublicId, params)` | `POST /workspaces/{id}/utm-templates` | `CreateUtmTemplateParams`: `name`, `utm_*`, `team_public_ids` | `UtmTemplateResponse` |
| `utmTemplates.update(templatePublicId, params)` | `PUT /utm-templates/{id}` | `UpdateUtmTemplateParams`: as create, plus `workspace_public_id`, `lost_access_action` | `UpdateUtmTemplateResponse` |
| `utmTemplates.delete(templatePublicId, params?)` | `DELETE /utm-templates/{id}` | `DeleteUtmTemplateParams`: `links` (`keep` or `clear`) | `DeleteUtmTemplateResponse` |

## Destinations

| Method | Route | Params | Result |
|---|---|---|---|
| `destinations.list(workspacePublicId)` | `GET /workspaces/{id}/destinations` | | `Destination[]` |
| `destinations.create(workspacePublicId, params)` | `POST /workspaces/{id}/destinations` | `CreateDestinationParams`: `name`, `type`, `config`, `team_public_ids` | `Destination` |
| `destinations.update(workspacePublicId, destinationPublicId, params)` | `PUT /workspaces/{id}/destinations/{destination_id}` | `UpdateDestinationParams`: `name`, `type` (both required), `config`, `team_public_ids` | `UpdateDestinationResponse` |
| `destinations.delete(workspacePublicId, destinationPublicId)` | `DELETE /workspaces/{id}/destinations/{destination_id}` | | `SuccessResponse` |

## Teams

| Method | Route | Params | Result |
|---|---|---|---|
| `teams.list(workspacePublicId)` | `GET /workspaces/{id}/teams` | | `TeamList` (`teams: Team[] \| null`) |
| `teams.create(workspacePublicId, params)` | `POST /workspaces/{id}/teams` | `CreateTeamParams`: `name`, `description` | `CreatedTeam` (`id`, `slug`, `public_id`) |
| `teams.get(slug, lookup?)` | `GET /teams/{slug}` | `TeamLookupParams`: `workspace` | `Team` |
| `teams.update(slug, params, lookup?)` | `PUT /teams/{slug}` | `UpdateTeamParams`: `name`, `description` | `Team` |
| `teams.delete(slug, lookup?)` | `DELETE /teams/{slug}` | | `SuccessResponse`; archives the team |

## Domains

| Method | Route | Params | Result |
|---|---|---|---|
| `domains.list()` | `GET /domains` | | `DomainList` (`data: Domain[]`) |
| `domains.create(params)` | `POST /domains` | `CreateDomainParams`: `domain` | `DomainResponse` (`domain`) |
| `domains.verify(id)` | `POST /domains/{id}/verify` | | `VerifyDomainResponse` (`domain`, `verification`) |
| `domains.delete(id)` | `DELETE /domains/{id}` | | `DeleteDomainResponse` (`deleted`, `id`, `domain`) |

## Reports and alerts

| Method | Route | Params | Result |
|---|---|---|---|
| `reports.listRules(params?)` | `GET /reports/rules` | `ListReportRulesParams`: `workspace_public_id`, `schedule_types`, `link_public_ids`, `team_public_ids` | `ReportRuleList` |
| `reports.getRule(rulePublicId)` | `GET /reports/rules/{id}` | | `ReportRuleResponse` |
| `reports.createRule(params)` | `POST /reports/rules` | `CreateReportRuleParams`: `report_type`, `definition_json` and the rest | `ReportRuleResponse` |
| `reports.updateRule(rulePublicId, params)` | `PATCH /reports/rules/{id}` | `UpdateReportRuleParams`: any create field, plus `enabled` | `ReportRuleResponse` |
| `reports.deleteRule(rulePublicId)` | `DELETE /reports/rules/{id}` | | `void` (`204`) |

A new rule starts enabled; pause it with `updateRule(id, { enabled: false })`.

## Conversions

| Method | Route | Params | Result |
|---|---|---|---|
| `conversions.trackLead(params)` | `POST /conversions/leads` | `TrackLeadParams` | `ConversionWriteResponse` (`type`, `event`) |
| `conversions.validateLead(params)` | `POST /conversions/leads/validations` | `TrackLeadParams` | `ConversionValidationResponse` |
| `conversions.trackSale(params)` | `POST /conversions/sales` | `TrackSaleParams` | `ConversionWriteResponse` |
| `conversions.validateSale(params)` | `POST /conversions/sales/validations` | `TrackSaleParams` | `ConversionValidationResponse` |
| `conversions.trackRefund(params)` | `POST /conversions/refunds` | `TrackRefundParams` | `ConversionWriteResponse` |
| `conversions.validateRefund(params)` | `POST /conversions/refunds/validations` | `TrackRefundParams` | `ConversionValidationResponse` |
| `conversions.summary(query?)` | `GET /conversions/summary` | none documented | `ConversionSummaryResponse` |
| `conversions.attribution(query?)` | `GET /conversions/attribution` | `ConversionAttributionQuery`: `from`, `to`, `environment`, `limit` | `ConversionAttributionResponse` |
| `conversions.timeline(query?)` | `GET /conversions/timeline` | `ConversionTimelineQuery`: `from`, `to`, `environment`, `interval` (`day`, `week`, `week_sunday`, `month`) | `ConversionTimelineResponse` |
| `conversions.events(query?)` | `GET /conversions/events` | `ConversionEventsQuery`: `from`, `to`, `environment`, `limit`, `offset`, `event_type`, `lead_category`, `event_origin`, `link`, `event`, `q`, `include_total` (adds `pagination.total`) | `ConversionEventsResponse` |

Write bodies:

- `TrackLeadParams`: `click_id`, `idempotency_key` (required), `event_name`,
  `lead_category`, `event_quantity`.
- `TrackSaleParams`: `click_id`, `currency` (required), `amount_cents` or `amount`,
  `invoice_id` or `idempotency_key`, `payment_processor`, `settlement_amount_cents`,
  `settlement_currency`.
- `TrackRefundParams`: `invoice_id`, `refund_id` (required), `amount_cents` or `amount`,
  `currency`, `payment_processor`, `reason`, `idempotency_key`.
- All three: `metadata`, `occurred_at` (`Date` or RFC 3339), `test_mode`, `event_type`.

The API refuses unknown fields. Writes that carry an `idempotency_key` are retried safely;
`test_mode` writes are never retried, since the API records every test request anew.

## Public helpers

No API key needed.

| Method | Route | Params | Result |
|---|---|---|---|
| `public.validateUrl(url)` | `GET /validate?url=` | | `UrlValidation` (`valid`, `normalized`, `code`, `error`) |
| `public.qrCode(params)` | `GET /qr` | `QrCodeParams`: `url` and the image options (`format`, `size`, `colorMode`, `fg`, `bg`, ...) | `Uint8Array` (the image) |
| `public.plans()` | `GET /plans` | | `PlanCatalog` (`plans`, keyed by plan ID) |

## Errors

| Class | When |
|---|---|
| `ShortnAPIError` | A non-2xx answer: `status`, `statusText`, `code`, `message` (the API's `error`), `hint`, `field` (`details.field`), `details`, `requestId`, `body`, `headers`. |
| `ShortnTimeoutError` | One attempt took longer than `timeoutMs` (a `ShortnNetworkError`). |
| `ShortnNetworkError` | No response arrived, or the request was aborted; `cause` holds the original error. |
| `ShortnConfigurationError` | No `fetch` is available. |

All extend `ShortnError`. An empty path ID throws a `TypeError` before sending.
