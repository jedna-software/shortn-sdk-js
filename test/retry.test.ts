import { describe, expect, it } from "vitest";
import { Shortn, ShortnAPIError, ShortnNetworkError } from "../src";
import { jsonResponse, mockClient } from "./helpers";

const rateLimited = () => jsonResponse({ code: "api_rate_limit_exceeded", error: "slow down" }, { headers: { "Retry-After": "0" }, status: 429 });
const unavailable = () => jsonResponse({ code: "reports_unavailable", error: "try later" }, { status: 503 });
const ok = () => jsonResponse({ data: [] });

describe("retries", () => {
  it.each([
    ["GET", (c: Shortn) => c.links.list()],
    ["PUT", (c: Shortn) => c.tags.update("t", { name: "n" })],
    ["DELETE", (c: Shortn) => c.tags.delete("t")]
  ])("retries %s on 429 and 503", async (_method, call) => {
    const { client, requests } = mockClient([rateLimited(), unavailable(), ok()]);
    await expect(call(client)).resolves.toEqual({ data: [] });
    expect(requests).toHaveLength(3);
  });

  it("retries a POST that carries an idempotency_key", async () => {
    const { client, requests } = mockClient([unavailable(), ok()]);
    await client.conversions.trackLead({ click_id: "c", idempotency_key: "k" });
    expect(requests).toHaveLength(2);
    expect(requests[1]!.body).toEqual(requests[0]!.body);
  });

  it("retries a live write that sends test_mode: false", async () => {
    const { client, requests } = mockClient([unavailable(), ok()]);
    await client.conversions.trackLead({ click_id: "c", idempotency_key: "k", test_mode: false });
    expect(requests).toHaveLength(2);
  });

  it("does not retry a test-mode write after a network error", async () => {
    let calls = 0;
    const client = new Shortn({
      apiKey: "k",
      fetch: async () => {
        calls += 1;
        throw new TypeError("socket hang up");
      },
      retry: { initialDelayMs: 0, jitter: false }
    });
    await expect(client.conversions.trackLead({ click_id: "c", idempotency_key: "k", test_mode: true }))
      .rejects.toBeInstanceOf(ShortnNetworkError);
    expect(calls).toBe(1);
  });

  it.each([
    ["test-mode lead with idempotency_key", (c: Shortn) => c.conversions.trackLead({ click_id: "c", idempotency_key: "k", test_mode: true })],
    ["test-mode sale with idempotency_key", (c: Shortn) => c.conversions.trackSale({ click_id: "c", currency: "EUR", idempotency_key: "k", invoice_id: "i", test_mode: true })],
    ["test-mode refund with idempotency_key", (c: Shortn) => c.conversions.trackRefund({ idempotency_key: "k", invoice_id: "i", refund_id: "r", test_mode: true })],
    ["POST without idempotency_key", (c: Shortn) => c.conversions.trackSale({ click_id: "c", currency: "EUR", invoice_id: "i" })],
    ["POST /links", (c: Shortn) => c.links.create({ title: "t", url: "https://e.com" })],
    ["POST enable", (c: Shortn) => c.links.enable("l")],
    ["PATCH", (c: Shortn) => c.links.update("l", { title: "t" })],
    ["PATCH reports", (c: Shortn) => c.reports.updateRule("r", { enabled: false })]
  ])("does not retry %s", async (_name, call) => {
    const { client, requests } = mockClient([unavailable(), ok()]);
    await expect(call(client)).rejects.toBeInstanceOf(ShortnAPIError);
    expect(requests).toHaveLength(1);
  });

  it.each([400, 401, 404, 409, 500, 502])("does not retry status %i", async (status) => {
    const { client, requests } = mockClient([jsonResponse({ error: "no" }, { status }), ok()]);
    await expect(client.links.list()).rejects.toMatchObject({ status });
    expect(requests).toHaveLength(1);
  });

  it("stops after maxRetries and throws the last error", async () => {
    const { client, requests } = mockClient([unavailable()], { retry: { initialDelayMs: 0, maxRetries: 3 } });
    await expect(client.links.list()).rejects.toMatchObject({ code: "reports_unavailable", status: 503 });
    expect(requests).toHaveLength(4);
  });

  it("can be switched off for the client or one request", async () => {
    const off = mockClient([unavailable(), ok()], { retry: false });
    await expect(off.client.links.list()).rejects.toBeInstanceOf(ShortnAPIError);
    expect(off.requests).toHaveLength(1);

    const perRequest = mockClient([unavailable(), ok()]);
    await expect(perRequest.client.links.list({}, { retry: false })).rejects.toBeInstanceOf(ShortnAPIError);
    expect(perRequest.requests).toHaveLength(1);
  });

  it("waits the Retry-After seconds", async () => {
    const started = Date.now();
    const { client, requests } = mockClient(
      [jsonResponse({ error: "slow" }, { headers: { "Retry-After": "0.2" }, status: 429 }), ok()],
      { retry: { initialDelayMs: 0, maxDelayMs: 5_000 } }
    );
    await client.links.list();
    expect(requests).toHaveLength(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(180);
  });

  it("throws at once when Retry-After exceeds maxDelayMs", async () => {
    const started = Date.now();
    const { client, requests } = mockClient(
      [jsonResponse({ code: "api_rate_limit_exceeded", error: "slow" }, { headers: { "Retry-After": "60" }, status: 429 }), ok()],
      { retry: { maxDelayMs: 10 } }
    );
    await expect(client.links.list()).rejects.toMatchObject({ code: "api_rate_limit_exceeded", status: 429 });
    expect(requests).toHaveLength(1);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("does not wait out the monthly quota", async () => {
    const started = Date.now();
    const monthly = jsonResponse(
      { code: "api_monthly_limit_exceeded", details: { reset_after_sec: 864_000 }, error: "Monthly API limit reached" },
      { headers: { "Retry-After": "864000" }, status: 429 }
    );
    const { client, requests } = mockClient([monthly, ok()], { retry: { maxDelayMs: 60_000 } });
    await expect(client.links.list()).rejects.toMatchObject({ code: "api_monthly_limit_exceeded", status: 429 });
    expect(requests).toHaveLength(1);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("does not wait for an HTTP-date Retry-After beyond maxDelayMs", async () => {
    const later = new Date(Date.now() + 3_600_000).toUTCString();
    const { client, requests } = mockClient(
      [jsonResponse({ error: "busy" }, { headers: { "Retry-After": later }, status: 503 }), ok()],
      { retry: { maxDelayMs: 1_000 } }
    );
    await expect(client.links.list()).rejects.toMatchObject({ status: 503 });
    expect(requests).toHaveLength(1);
  });

  it("waits a Retry-After equal to maxDelayMs", async () => {
    const { client, requests } = mockClient(
      [jsonResponse({ error: "slow" }, { headers: { "Retry-After": "0.05" }, status: 429 }), ok()],
      { retry: { maxDelayMs: 50 } }
    );
    await client.links.list();
    expect(requests).toHaveLength(2);
  });

  it("retries network errors on retryable requests only", async () => {
    let calls = 0;
    const flaky = async () => {
      calls += 1;
      if (calls === 1) throw new TypeError("socket hang up");
      return ok();
    };
    const retry = { initialDelayMs: 0, jitter: false };

    await new Shortn({ apiKey: "k", fetch: flaky, retry }).links.list();
    expect(calls).toBe(2);

    calls = 0;
    await expect(new Shortn({ apiKey: "k", fetch: flaky, retry }).links.update("l", { title: "t" }))
      .rejects.toBeInstanceOf(ShortnNetworkError);
    expect(calls).toBe(1);
  });
});
