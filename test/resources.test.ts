import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  ConversionAttributionRow,
  ConversionEvent,
  ConversionReporting,
  ConversionTimelinePoint,
  ConversionTotals,
  ConversionWriteResponse,
  DnsRecord,
  Link,
  ReportRule,
  ReportRuleDestination,
  Shortn
} from "../src";
import { apiPath, jsonResponse, mockClient, query } from "./helpers";

interface Case {
  name: string;
  call: (client: Shortn) => Promise<unknown>;
  method: string;
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  response?: unknown;
}

const WS = "8c0f6b52-4d0e-4a71-9a3e-2f6d1c7b5a10";
const LINK = "3f6c1e2a-9b8d-4c7e-a1f0-5d2e3c4b6a71";
const occurredAt = new Date("2026-10-24T10:00:00Z");

const definition = {
  sections: [{ id: "total_clicks", order: 1, settings: { window: "7d" } }],
  trigger: "scheduled",
  version: "custom_builder.v1"
};

// Every SDK method, the request it must send, and a representative answer.
const cases: Case[] = [
  // links
  {
    call: (c) => c.links.list(),
    method: "GET",
    name: "links.list without params",
    path: "/links",
    query: {},
    response: { data: [], pagination: { count: 0, has_more: false, limit: 50, next_offset: null, offset: 0 } }
  },
  {
    call: (c) => c.links.list({ limit: 10, offset: 20 }),
    method: "GET",
    name: "links.list with paging",
    path: "/links",
    query: { limit: "10", offset: "20" }
  },
  {
    call: (c) => c.links.get(LINK),
    method: "GET",
    name: "links.get",
    path: `/links/${LINK}`,
    response: { data: { public_id: LINK } }
  },
  {
    call: (c) => c.links.create({
      expires_at: new Date("2027-01-01T00:00:00Z"),
      expiration_action: "suspended",
      tag_public_ids: ["t1"],
      title: "Spring",
      url: "https://example.com/spring",
      utm_source: "newsletter",
      workspace_public_id: WS
    }),
    method: "POST",
    name: "links.create",
    path: "/links",
    body: {
      expiration_action: "suspended",
      expires_at: "2027-01-01T00:00:00.000Z",
      tag_public_ids: ["t1"],
      title: "Spring",
      url: "https://example.com/spring",
      utm_source: "newsletter",
      workspace_public_id: WS
    },
    response: { public_id: LINK, short_code: "abC12x9", short_url: "https://shtnl.ink/abC12x9" }
  },
  {
    call: (c) => c.links.update(LINK, { title: "Spring sale" }),
    method: "PATCH",
    name: "links.update",
    path: `/links/${LINK}`,
    body: { title: "Spring sale" },
    response: { message: "URL updated successfully" }
  },
  {
    call: (c) => c.links.delete(LINK),
    method: "DELETE",
    name: "links.delete",
    path: `/links/${LINK}`,
    response: { message: "URL disabled successfully" }
  },
  {
    call: (c) => c.links.enable(LINK),
    method: "POST",
    name: "links.enable",
    path: `/links/${LINK}/enable`,
    response: { message: "URL enabled successfully" }
  },
  {
    call: (c) => c.links.setAbWinner(LINK, { variant: "B" }),
    method: "POST",
    name: "links.setAbWinner",
    path: `/links/${LINK}/ab/winner`,
    body: { variant: "B" },
    response: { destination: "https://example.com/b", test: 1, winner: "B" }
  },
  // analytics
  {
    call: (c) => c.analytics.link(LINK),
    method: "GET",
    name: "analytics.link",
    path: `/analytics/links/${LINK}`,
    query: {},
    response: { clicks_by_country: { Germany: 1 }, total_clicks: 1, unique_clicks: 1 }
  },
  {
    call: (c) => c.analytics.link(LINK, { future: "x" }),
    method: "GET",
    name: "analytics.link passes a query through",
    path: `/analytics/links/${LINK}`,
    query: { future: "x" }
  },
  // workspaces
  { call: (c) => c.workspaces.list(), method: "GET", name: "workspaces.list", path: "/workspaces", response: { data: [] } },
  { call: (c) => c.workspaces.get(WS), method: "GET", name: "workspaces.get", path: `/workspaces/${WS}` },
  // tags
  {
    call: (c) => c.tags.list(WS),
    method: "GET",
    name: "tags.list",
    path: `/workspaces/${WS}/tags`,
    query: {},
    response: { tags: null }
  },
  {
    call: (c) => c.tags.list(WS, { report_scope: true, team: "none", team_public_ids: ["a", "b"] }),
    method: "GET",
    name: "tags.list with filters",
    path: `/workspaces/${WS}/tags`,
    query: { report_scope: "1", team: "none", team_public_ids: "a,b" }
  },
  {
    call: (c) => c.tags.create(WS, { color: "#3b82f6", name: "Spring" }),
    method: "POST",
    name: "tags.create",
    path: `/workspaces/${WS}/tags`,
    body: { color: "#3b82f6", name: "Spring" }
  },
  { call: (c) => c.tags.get("tag-1"), method: "GET", name: "tags.get", path: "/tags/tag-1" },
  {
    call: (c) => c.tags.update("tag-1", { name: "Summer" }),
    method: "PUT",
    name: "tags.update",
    path: "/tags/tag-1",
    body: { name: "Summer" }
  },
  { call: (c) => c.tags.delete("tag-1"), method: "DELETE", name: "tags.delete", path: "/tags/tag-1" },
  // UTM templates
  {
    call: (c) => c.utmTemplates.list(WS, { include_team_scoped: true, team_public_ids: ["t"] }),
    method: "GET",
    name: "utmTemplates.list",
    path: `/workspaces/${WS}/utm-templates`,
    query: { include_team_scoped: "1", team_public_ids: "t" },
    response: { data: [] }
  },
  {
    call: (c) => c.utmTemplates.create(WS, { name: "Newsletter", utm_source: "newsletter" }),
    method: "POST",
    name: "utmTemplates.create",
    path: `/workspaces/${WS}/utm-templates`,
    body: { name: "Newsletter", utm_source: "newsletter" }
  },
  {
    call: (c) => c.utmTemplates.update("tpl", { lost_access_action: "copy", name: "N", utm_medium: "email" }),
    method: "PUT",
    name: "utmTemplates.update",
    path: "/utm-templates/tpl",
    body: { lost_access_action: "copy", name: "N", utm_medium: "email" }
  },
  {
    call: (c) => c.utmTemplates.delete("tpl"),
    method: "DELETE",
    name: "utmTemplates.delete",
    path: "/utm-templates/tpl",
    query: {}
  },
  {
    call: (c) => c.utmTemplates.delete("tpl", { links: "clear" }),
    method: "DELETE",
    name: "utmTemplates.delete with links mode",
    path: "/utm-templates/tpl",
    query: { links: "clear" }
  },
  // destinations
  { call: (c) => c.destinations.list(WS), method: "GET", name: "destinations.list", path: `/workspaces/${WS}/destinations`, response: [] },
  {
    call: (c) => c.destinations.create(WS, { config: { webhook_url: "https://example.com/h" }, name: "Hook", type: "webhook" }),
    method: "POST",
    name: "destinations.create",
    path: `/workspaces/${WS}/destinations`,
    body: { config: { webhook_url: "https://example.com/h" }, name: "Hook", type: "webhook" }
  },
  {
    call: (c) => c.destinations.update(WS, "dst", { name: "Hook 2", type: "webhook" }),
    method: "PUT",
    name: "destinations.update",
    path: `/workspaces/${WS}/destinations/dst`,
    body: { name: "Hook 2", type: "webhook" },
    response: { success: true }
  },
  {
    call: (c) => c.destinations.delete(WS, "dst"),
    method: "DELETE",
    name: "destinations.delete",
    path: `/workspaces/${WS}/destinations/dst`,
    response: { success: true }
  },
  // teams
  { call: (c) => c.teams.list(WS), method: "GET", name: "teams.list", path: `/workspaces/${WS}/teams`, response: { teams: null } },
  {
    call: (c) => c.teams.create(WS, { description: "d", name: "Paid Social" }),
    method: "POST",
    name: "teams.create",
    path: `/workspaces/${WS}/teams`,
    body: { description: "d", name: "Paid Social" }
  },
  { call: (c) => c.teams.get("paid-social"), method: "GET", name: "teams.get", path: "/teams/paid-social", query: {} },
  {
    call: (c) => c.teams.get("paid-social", { workspace: WS }),
    method: "GET",
    name: "teams.get in a workspace",
    path: "/teams/paid-social",
    query: { workspace: WS }
  },
  {
    call: (c) => c.teams.update("paid-social", { name: "Paid Social EU" }, { workspace: WS }),
    method: "PUT",
    name: "teams.update",
    path: "/teams/paid-social",
    query: { workspace: WS },
    body: { name: "Paid Social EU" }
  },
  {
    call: (c) => c.teams.delete("paid-social"),
    method: "DELETE",
    name: "teams.delete",
    path: "/teams/paid-social",
    query: {},
    response: { success: true }
  },
  // domains
  { call: (c) => c.domains.list(), method: "GET", name: "domains.list", path: "/domains", response: { data: [] } },
  {
    call: (c) => c.domains.create({ domain: "go.example.com" }),
    method: "POST",
    name: "domains.create",
    path: "/domains",
    body: { domain: "go.example.com" }
  },
  { call: (c) => c.domains.verify(14), method: "POST", name: "domains.verify", path: "/domains/14/verify" },
  { call: (c) => c.domains.delete(14), method: "DELETE", name: "domains.delete", path: "/domains/14" },
  // reports
  {
    call: (c) => c.reports.listRules(),
    method: "GET",
    name: "reports.listRules",
    path: "/reports/rules",
    query: {},
    response: { data: [] }
  },
  {
    call: (c) => c.reports.listRules({
      link_public_ids: ["l1", "l2"],
      schedule_types: ["every_x", "event"],
      team_public_ids: ["t1"],
      workspace_public_id: WS
    }),
    method: "GET",
    name: "reports.listRules with filters",
    path: "/reports/rules",
    query: { link_public_ids: "l1,l2", schedule_types: "every_x,event", team_public_ids: "t1", workspace_public_id: WS }
  },
  { call: (c) => c.reports.getRule("rule-1"), method: "GET", name: "reports.getRule", path: "/reports/rules/rule-1" },
  {
    call: (c) => c.reports.createRule({
      definition_json: definition,
      initial_run_at: new Date("2099-01-01T00:00:00Z"),
      interval_seconds: 604800,
      report_type: "custom_builder_v1",
      workspace_public_id: WS
    }),
    method: "POST",
    name: "reports.createRule",
    path: "/reports/rules",
    body: {
      definition_json: definition,
      initial_run_at: "2099-01-01T00:00:00.000Z",
      interval_seconds: 604800,
      report_type: "custom_builder_v1",
      workspace_public_id: WS
    }
  },
  {
    call: (c) => c.reports.updateRule("rule-1", { enabled: false }),
    method: "PATCH",
    name: "reports.updateRule",
    path: "/reports/rules/rule-1",
    body: { enabled: false }
  },
  // conversions
  {
    call: (c) => c.conversions.trackLead({ click_id: "clk_1", idempotency_key: "k1", lead_category: "signup", occurred_at: occurredAt }),
    method: "POST",
    name: "conversions.trackLead",
    path: "/conversions/leads",
    body: { click_id: "clk_1", idempotency_key: "k1", lead_category: "signup", occurred_at: "2026-10-24T10:00:00.000Z" },
    response: { event: { duplicate: false, event_type: "lead" }, type: "lead" }
  },
  {
    call: (c) => c.conversions.validateLead({ click_id: "clk_1", idempotency_key: "k1" }),
    method: "POST",
    name: "conversions.validateLead",
    path: "/conversions/leads/validations",
    body: { click_id: "clk_1", idempotency_key: "k1" },
    response: { dry_run: true, result: { valid: true }, valid: true }
  },
  {
    call: (c) => c.conversions.trackSale({ amount_cents: 4900, click_id: "clk_1", currency: "EUR", invoice_id: "inv_1" }),
    method: "POST",
    name: "conversions.trackSale",
    path: "/conversions/sales",
    body: { amount_cents: 4900, click_id: "clk_1", currency: "EUR", invoice_id: "inv_1" }
  },
  {
    call: (c) => c.conversions.validateSale({ amount: "49.00", click_id: "clk_1", currency: "EUR", idempotency_key: "s1" }),
    method: "POST",
    name: "conversions.validateSale",
    path: "/conversions/sales/validations",
    body: { amount: "49.00", click_id: "clk_1", currency: "EUR", idempotency_key: "s1" }
  },
  {
    call: (c) => c.conversions.trackRefund({ amount_cents: 1900, invoice_id: "inv_1", reason: "Damaged", refund_id: "re_1" }),
    method: "POST",
    name: "conversions.trackRefund",
    path: "/conversions/refunds",
    body: { amount_cents: 1900, invoice_id: "inv_1", reason: "Damaged", refund_id: "re_1" }
  },
  {
    call: (c) => c.conversions.validateRefund({ amount_cents: 1900, invoice_id: "inv_1", refund_id: "re_1" }),
    method: "POST",
    name: "conversions.validateRefund",
    path: "/conversions/refunds/validations",
    body: { amount_cents: 1900, invoice_id: "inv_1", refund_id: "re_1" }
  },
  { call: (c) => c.conversions.summary(), method: "GET", name: "conversions.summary", path: "/conversions/summary", query: {} },
  {
    call: (c) => c.conversions.attribution({ environment: "test", from: "2026-10-01", limit: 10, to: new Date("2026-10-31T00:00:00Z") }),
    method: "GET",
    name: "conversions.attribution",
    path: "/conversions/attribution",
    query: { environment: "test", from: "2026-10-01", limit: "10", to: "2026-10-31T00:00:00.000Z" }
  },
  {
    call: (c) => c.conversions.timeline({ environment: "test", interval: "week" }),
    method: "GET",
    name: "conversions.timeline",
    path: "/conversions/timeline",
    query: { environment: "test", interval: "week" }
  },
  {
    call: (c) => c.conversions.timeline({ interval: "week_sunday" }),
    method: "GET",
    name: "conversions.timeline week_sunday",
    path: "/conversions/timeline",
    query: { interval: "week_sunday" }
  },
  {
    call: (c) => c.conversions.events({ include_total: true, limit: 10 }),
    method: "GET",
    name: "conversions.events include_total",
    path: "/conversions/events",
    query: { include_total: "1", limit: "10" },
    response: { data: [], pagination: { count: 0, has_more: false, limit: 10, next_offset: null, offset: 0, total: 42 } }
  },
  {
    call: (c) => c.conversions.events({ include_total: false }),
    method: "GET",
    name: "conversions.events include_total false",
    path: "/conversions/events",
    query: {}
  },
  {
    call: (c) => c.conversions.events({
      environment: "test",
      event: "ev_1",
      event_origin: "inferred",
      event_type: "sale",
      lead_category: "purchase_inferred",
      limit: 5,
      link: "abC12x9",
      offset: 5,
      q: "invoice"
    }),
    method: "GET",
    name: "conversions.events",
    path: "/conversions/events",
    query: {
      environment: "test",
      event: "ev_1",
      event_origin: "inferred",
      event_type: "sale",
      lead_category: "purchase_inferred",
      limit: "5",
      link: "abC12x9",
      offset: "5",
      q: "invoice"
    }
  },
  // public
  {
    call: (c) => c.public.validateUrl("example.com/menu"),
    method: "GET",
    name: "public.validateUrl",
    path: "/validate",
    query: { url: "example.com/menu" },
    response: { normalized: "https://example.com/menu", valid: true }
  },
  { call: (c) => c.public.plans(), method: "GET", name: "public.plans", path: "/plans", response: { plans: {} } }
];

describe("every method sends the documented request", () => {
  it.each(cases)("$name", async (testCase) => {
    const response = testCase.response ?? { ok: true };
    const { client, requests } = mockClient([jsonResponse(response)]);

    await expect(testCase.call(client)).resolves.toEqual(response);

    expect(requests).toHaveLength(1);
    const request = requests[0]!;
    expect(request.method).toBe(testCase.method);
    expect(apiPath(request)).toBe(testCase.path);
    if (testCase.query) expect(query(request)).toEqual(testCase.query);
    expect(request.body).toEqual(testCase.body);
    expect(request.headers.get("Authorization")).toBe("Bearer sk_live_test");
    if (testCase.body === undefined) {
      expect(request.headers.has("Content-Type")).toBe(false);
    } else {
      expect(request.headers.get("Content-Type")).toBe("application/json");
    }
  });

  it("covers every SDK route", () => {
    const routes = new Set(cases.map((testCase) => `${testCase.method} ${testCase.path}`));
    // 50 methods, one route each; qrCode and reports.deleteRule are tested
    // separately below.
    expect(routes.size + 2).toBe(50);
  });
});

describe("special responses", () => {
  it("reports.deleteRule accepts 204 with no body", async () => {
    const { client, requests } = mockClient([new Response(null, { status: 204 })]);
    await expect(client.reports.deleteRule("rule-1")).resolves.toBeUndefined();
    expect(requests[0]!.method).toBe("DELETE");
    expect(apiPath(requests[0]!)).toBe("/reports/rules/rule-1");
  });

  it("public.qrCode answers the image bytes and sends only the options set", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const { client, requests } = mockClient([new Response(png, { headers: { "Content-Type": "image/png" } })]);

    const bytes = await client.public.qrCode({ format: "png", frameTextFollowsBackground: false, size: "download", url: "https://shtnl.ink/abC12x9" });

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes)).toEqual(Array.from(png));
    const request = requests[0]!;
    expect(request.method).toBe("GET");
    expect(apiPath(request)).toBe("/qr");
    expect(query(request)).toEqual({
      format: "png",
      frameTextFollowsBackground: "false",
      size: "download",
      url: "https://shtnl.ink/abC12x9"
    });
    expect(request.headers.get("Accept")).toContain("image/png");
  });

  it("public.qrCode asks for SVG when format is svg", async () => {
    const { client, requests } = mockClient([new Response("<svg/>", { headers: { "Content-Type": "image/svg+xml" } })]);
    const bytes = await client.public.qrCode({ format: "svg", url: "https://shtnl.ink/x" });
    expect(new TextDecoder().decode(bytes)).toBe("<svg/>");
    expect(requests[0]!.headers.get("Accept")).toContain("image/svg+xml");
  });

  it("keeps fields the SDK does not know", async () => {
    const { client } = mockClient([jsonResponse({ data: { brand_new_field: 7, public_id: LINK } })]);
    const link = await client.links.get(LINK);
    expect(link.data.brand_new_field).toBe(7);
  });
});

describe("path segments", () => {
  it("are URL-escaped", async () => {
    const { client, requests } = mockClient();
    await client.links.get("a/b c?d#e");
    await client.teams.get("team/../x", { workspace: "w s" });
    await client.destinations.delete("ws/1", "dst?2");
    await client.domains.verify("1/2");

    expect(requests.map((request) => request.url.pathname)).toEqual([
      "/api/v1/links/a%2Fb%20c%3Fd%23e",
      "/api/v1/teams/team%2F..%2Fx",
      "/api/v1/workspaces/ws%2F1/destinations/dst%3F2",
      "/api/v1/domains/1%2F2/verify"
    ]);
    expect(requests[1]!.url.searchParams.get("workspace")).toBe("w s");
  });

  it("refuse an empty ID before sending anything", async () => {
    const { client, requests } = mockClient();
    expect(() => client.links.get("")).toThrow(TypeError);
    expect(() => client.tags.list("  ")).toThrow(/workspacePublicId is required/);
    expect(requests).toHaveLength(0);
  });
});

describe("response types promise only what the API always sends", () => {
  it("leaves out fields the API omits when empty", () => {
    const link: Link = {
      active: true,
      clicks: 0,
      created_at: "2026-10-24T10:00:00Z",
      description: "",
      original_url: "https://example.com",
      public_id: LINK,
      short_code: "abC12x9",
      status: "active",
      title: "t",
      updated_at: "2026-10-24T10:00:00Z"
    };
    const row: ConversionEvent = {
      attribution: { type: "link" },
      created_at: "2026-10-24T10:00:00Z",
      event_name: "Sign up",
      event_type: "lead",
      is_test: false,
      occurred_at: "2026-10-24T10:00:00Z",
      public_id: "ev_1"
    };
    const dns: DnsRecord = { name: "go", type: "CNAME", value: "shtnl.ink" };
    expect([link.domain, row.duplicate, dns.ttl]).toEqual([undefined, undefined, undefined]);

    expectTypeOf<Link["domain"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<ConversionEvent["duplicate"]>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<ConversionWriteResponse["event"]["duplicate"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ConversionTotals["reporting"]>().toEqualTypeOf<ConversionReporting | undefined>();
    expectTypeOf<ConversionTimelinePoint["reporting"]>().toEqualTypeOf<ConversionReporting | undefined>();
    expectTypeOf<ConversionAttributionRow["reporting"]>().toEqualTypeOf<ConversionReporting | undefined>();
    expectTypeOf<ReportRule["destinations"]>().toEqualTypeOf<ReportRuleDestination[] | undefined>();
    expectTypeOf<DnsRecord["ttl"]>().toEqualTypeOf<string | undefined>();
  });
});
