/**
 * Opt-in smoke test against a live Shortn instance. Skipped unless
 * SHORTN_API_KEY is set. Needs:
 *
 *   SHORTN_API_KEY          a key with every scope (account-wide)
 *   SHORTN_BASE_URL         such as https://staging.example.com
 *   SHORTN_SMOKE_WORKSPACE  public ID of a workspace the test may write in
 *   SHORTN_SMOKE_CLICK_ID   a click on a conversion-enabled link (optional:
 *                           without it, the conversion writes are skipped)
 *
 * Everything it creates gets a random suffix and is deleted again, also when
 * a step fails. Links can only be suspended through the API, so the test
 * link stays behind suspended. Pointing it at https://app.shortn.link needs
 * SHORTN_SMOKE_ALLOW_PRODUCTION=1.
 *
 *   npm run test:smoke
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  type DeleteTagResponse,
  type DeleteUtmTemplateResponse,
  Shortn,
  ShortnAPIError,
  type SuccessResponse
} from "../src";

const env = process.env;
const apiKey = env.SHORTN_API_KEY?.trim() ?? "";
const baseUrl = env.SHORTN_BASE_URL?.trim() ?? "";
const workspace = env.SHORTN_SMOKE_WORKSPACE?.trim() ?? "";
const clickId = env.SHORTN_SMOKE_CLICK_ID?.trim() ?? "";
const suffix = randomUUID().slice(0, 8);
const name = (prefix: string) => `${prefix}-js-${suffix}`;
let salePublicId = "";

if (apiKey && !baseUrl) {
  throw new Error("Set SHORTN_BASE_URL for the smoke test.");
}
if (apiKey && !workspace) {
  throw new Error("Set SHORTN_SMOKE_WORKSPACE for the smoke test.");
}
if (apiKey && /^https:\/\/app\.shortn\.link\/?$/.test(baseUrl) && env.SHORTN_SMOKE_ALLOW_PRODUCTION !== "1") {
  throw new Error("Refusing to run the smoke test against production without SHORTN_SMOKE_ALLOW_PRODUCTION=1.");
}

const client = new Shortn({
  apiKey,
  baseUrl,
  retry: { maxRetries: 4, maxDelayMs: 65_000 },
  userAgent: "smoke-test"
});

/** Cleanup steps, run last-in first-out even when a test fails. */
const cleanups: Array<{ label: string; run: () => Promise<unknown> }> = [];
function cleanup(label: string, run: () => Promise<unknown>) {
  cleanups.push({ label, run });
}
/** Answers undefined for the known `conversion_sale_not_found` of a test refund. */
async function knownSaleNotFound<T>(call: Promise<T>): Promise<T | undefined> {
  try {
    return await call;
  } catch (error) {
    if (error instanceof ShortnAPIError && error.status === 404 && error.code === "conversion_sale_not_found") {
      console.warn("by design: a test-mode refund cannot find the test-mode sale (conversion_sale_not_found)");
      return undefined;
    }
    throw error;
  }
}

/** Runs one cleanup step now and answers its result. */
async function runCleanup<T>(label: string): Promise<T> {
  const index = cleanups.findIndex((item) => item.label === label);
  if (index < 0) throw new Error(`no cleanup step ${label}`);
  const [item] = cleanups.splice(index, 1);
  return (await item!.run()) as T;
}

describe.skipIf(!apiKey)("smoke test against a live instance", { timeout: 180_000 }, () => {
  afterAll(async () => {
    const failures: string[] = [];
    for (const item of cleanups.reverse()) {
      try {
        await item.run();
      } catch (error) {
        failures.push(`${item.label}: ${String(error)}`);
      }
    }
    if (failures.length) throw new Error(`Cleanup failed:\n${failures.join("\n")}`);
  });

  it("workspaces.list and get", async () => {
    const list = await client.workspaces.list();
    expect(list.data.some((item) => item.public_id === workspace)).toBe(true);
    const one = await client.workspaces.get(workspace);
    expect(one.data.public_id).toBe(workspace);
  });

  it("public helpers, without a key", async () => {
    const anonymous = new Shortn({ baseUrl });
    const valid = await anonymous.public.validateUrl("example.com/sdk-smoke");
    expect(valid).toMatchObject({ normalized: "https://example.com/sdk-smoke", valid: true });

    const invalid = await anonymous.public.validateUrl("not a url");
    expect(invalid.valid).toBe(false);

    const catalog = await anonymous.public.plans();
    expect(catalog.plans.free?.ID).toBe("free");

    const png = await anonymous.public.qrCode({ url: "https://example.com/sdk-smoke" });
    expect(png.byteLength).toBeGreaterThan(100);
    expect(Array.from(png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("links: create, get, update, list, analytics, suspend, enable", async () => {
    const created = await client.links.create({
      title: name("sdk-smoke"),
      url: "https://example.com/sdk-smoke-js",
      workspace_public_id: workspace
    });
    expect(created.public_id).toBeTruthy();
    const id = created.public_id;
    cleanup("link", () => client.links.delete(id));

    const got = await client.links.get(id);
    expect(got.data).toMatchObject({ original_url: "https://example.com/sdk-smoke-js", public_id: id });

    const updated = await client.links.update(id, { title: name("sdk-smoke-renamed") });
    expect(updated.message).toBeTruthy();
    expect((await client.links.get(id)).data.title).toBe(name("sdk-smoke-renamed"));

    const list = await client.links.list({ limit: 100 });
    expect(list.data.some((link) => link.public_id === id)).toBe(true);
    expect(list.pagination.limit).toBe(100);

    const analytics = await client.analytics.link(id);
    expect(analytics.total_clicks).toBe(0);
    expect(typeof analytics.clicks_by_country).toBe("object");

    const abError = await client.links.setAbWinner(id, { variant: "B" }).catch((error: unknown) => error);
    expect(abError).toBeInstanceOf(ShortnAPIError);
    expect((abError as ShortnAPIError).status).toBeGreaterThanOrEqual(400);
    expect((abError as ShortnAPIError).code).toBeTruthy();

    expect((await client.links.delete(id)).message).toBeTruthy();
    expect((await client.links.enable(id)).message).toBeTruthy();
    await runCleanup("link");
    expect((await client.links.get(id)).data.status).toBe("suspended");
  });

  it("tags: create, get, update, list, delete", async () => {
    const tag = await client.tags.create(workspace, { color: "#3b82f6", name: `t-${suffix}` });
    cleanup("tag", () => client.tags.delete(tag.public_id));
    expect(tag.name).toBe(`t-${suffix}`);

    expect((await client.tags.get(tag.public_id)).public_id).toBe(tag.public_id);
    const updated = await client.tags.update(tag.public_id, { color: "#16a34a" });
    expect(updated.color).toBe("#16a34a");

    const list = await client.tags.list(workspace);
    expect(list.tags?.some((item) => item.public_id === tag.public_id)).toBe(true);

    expect((await runCleanup<DeleteTagResponse>("tag")).message).toBeTruthy();
  });

  it("utmTemplates: create, update, list, delete", async () => {
    const created = await client.utmTemplates.create(workspace, { name: name("utm"), utm_source: "sdk-smoke" });
    const id = created.data.public_id;
    cleanup("utm", () => client.utmTemplates.delete(id, { links: "keep" }));
    expect(created.data.utm_source).toBe("sdk-smoke");

    const updated = await client.utmTemplates.update(id, { name: name("utm"), utm_medium: "email", utm_source: "sdk-smoke" });
    expect(updated.data.utm_medium).toBe("email");

    const list = await client.utmTemplates.list(workspace, { include_team_scoped: true });
    expect(list.data.some((item) => item.public_id === id)).toBe(true);

    const deleted = await runCleanup<DeleteUtmTemplateResponse>("utm");
    expect(deleted.data).toMatchObject({ deleted: true, public_id: id });
  });

  it("teams: create, get, update, list, delete", async () => {
    const created = await client.teams.create(workspace, { description: "SDK smoke test", name: name("team") });
    cleanup("team", () => client.teams.delete(created.slug, { workspace }));

    const got = await client.teams.get(created.slug, { workspace });
    expect(got.public_id).toBe(created.public_id);

    const updated = await client.teams.update(created.slug, { description: "SDK smoke test, renamed" }, { workspace });
    expect(updated.description).toBe("SDK smoke test, renamed");

    const list = await client.teams.list(workspace);
    expect(list.teams?.some((team) => team.public_id === created.public_id)).toBe(true);

    expect((await runCleanup<SuccessResponse>("team")).success).toBe(true);
  });

  it("destinations: create, update, list, delete", async () => {
    const created = await client.destinations.create(workspace, {
      config: { webhook_url: "https://example.com/hooks/sdk-smoke" },
      name: name("hook"),
      type: "webhook"
    });
    cleanup("destination", () => client.destinations.delete(workspace, created.public_id));

    const updated = await client.destinations.update(workspace, created.public_id, { name: name("hook-renamed"), type: "webhook" });
    expect(updated.success).toBe(true);

    const list = await client.destinations.list(workspace);
    expect(list.find((item) => item.public_id === created.public_id)?.name).toBe(name("hook-renamed"));

    const deleted = await runCleanup<SuccessResponse>("destination");
    expect(deleted.success).toBe(true);
  });

  it("reports: a rule that first runs in 2099, paused, then list, get, update, delete", async () => {
    const created = await client.reports.createRule({
      definition_json: {
        options: { locale: "en-US" },
        sections: [{ id: "total_clicks", order: 1, settings: { window: "7d" } }],
        trigger: "scheduled",
        version: "custom_builder.v1"
      },
      initial_run_at: "2099-01-01T00:00:00Z",
      interval_seconds: 604800,
      report_name: name("report"),
      report_type: "custom_builder_v1",
      schedule_type: "every_x",
      workspace_public_id: workspace
    });
    const id = created.data.public_id;
    expect(id).toBeTruthy();
    cleanup("report", () => client.reports.deleteRule(id));
    expect(created.data.next_run_at).toMatch(/^2099-01-01/);

    // `enabled` is not applied on create (the rule starts enabled), so the
    // rule is paused right away; its first run is in 2099 either way.
    const paused = await client.reports.updateRule(id, { enabled: false });
    expect(paused.data.enabled).toBe(false);

    const list = await client.reports.listRules({ schedule_types: ["every_x"], workspace_public_id: workspace });
    expect(list.data.some((rule) => rule.public_id === id)).toBe(true);

    const got = await client.reports.getRule(id);
    expect(got.data.report_name).toBe(name("report"));

    const updated = await client.reports.updateRule(id, { report_name: name("report-renamed") });
    expect(updated.data).toMatchObject({ enabled: false, report_name: name("report-renamed") });

    await runCleanup("report");
    await expect(client.reports.getRule(id)).rejects.toMatchObject({ status: 404 });
  });

  it("domains.list", async () => {
    const domains = await client.domains.list();
    expect(Array.isArray(domains.data)).toBe(true);
  });

  it.skipIf(!clickId)("conversions: test-mode lead, sale, refund and their validations", async () => {
    const invoiceId = `inv-js-${suffix}`;

    const leadParams = { click_id: clickId, event_name: "SDK smoke lead", idempotency_key: `lead-js-${suffix}`, lead_category: "signup", test_mode: true };
    const leadCheck = await client.conversions.validateLead(leadParams);
    expect(leadCheck).toMatchObject({ dry_run: true, valid: true });
    const lead = await client.conversions.trackLead(leadParams);
    expect(lead).toMatchObject({ event: { duplicate: false, is_test: true }, type: "lead" });

    const saleParams = { amount_cents: 1000, click_id: clickId, currency: "EUR", invoice_id: invoiceId, test_mode: true };
    expect(await client.conversions.validateSale(saleParams)).toMatchObject({ dry_run: true, valid: true });
    const sale = await client.conversions.trackSale(saleParams);
    salePublicId = sale.event.public_id;
    expect(sale).toMatchObject({ event: { amount_cents: 1000, currency: "EUR", invoice_id: invoiceId, is_test: true }, type: "sale" });

    // By design, a test-mode refund names a live sale, so the test sale above
    // is not found (404 conversion_sale_not_found). The step accepts that
    // answer.
    const refundParams = { amount_cents: 400, invoice_id: invoiceId, reason: "SDK smoke test", refund_id: `re-js-${suffix}`, test_mode: true };
    const refundCheck = await knownSaleNotFound(client.conversions.validateRefund(refundParams));
    if (refundCheck) expect(refundCheck).toMatchObject({ dry_run: true, valid: true });
    const refund = await knownSaleNotFound(client.conversions.trackRefund(refundParams));
    if (refund) expect(refund).toMatchObject({ event: { is_test: true }, type: "refund" });
  });

  it("conversions: summary, attribution, timeline, events (test environment)", async () => {
    const summary = await client.conversions.summary();
    expect(typeof summary.data.leads).toBe("number");

    const attribution = await client.conversions.attribution({ environment: "test", limit: 5 });
    expect(Array.isArray(attribution.data)).toBe(true);

    const timeline = await client.conversions.timeline({ environment: "test", interval: "day" });
    expect(timeline.interval).toBe("day");
    expect(Array.isArray(timeline.data)).toBe(true);

    const events = await client.conversions.events({ environment: "test", limit: 10 });
    expect(events.environment).toBe("test");
    expect(Array.isArray(events.data)).toBe(true);
    expect(events.pagination.limit).toBe(10);
    if (salePublicId) {
      const ours = await client.conversions.events({ environment: "test", event: salePublicId });
      expect(ours.data.map((event) => event.invoice_id)).toEqual([`inv-js-${suffix}`]);
    }
  });
});
