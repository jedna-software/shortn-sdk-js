import { describe, expect, it } from "vitest";
import {
  Shortn,
  ShortnAPIError,
  ShortnConfigurationError,
  ShortnNetworkError,
  ShortnTimeoutError,
  VERSION
} from "../src";
import { jsonResponse, mockClient } from "./helpers";

describe("client configuration", () => {
  it("sends the key, JSON accept and the SDK user agent", async () => {
    const { client, requests } = mockClient([], { userAgent: "my-app/1.2" });
    await client.workspaces.list();

    const headers = requests[0]!.headers;
    expect(headers.get("Authorization")).toBe("Bearer sk_live_test");
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("User-Agent")).toBe(`shortn-sdk-js/${VERSION} my-app/1.2`);
    expect(VERSION).toBe("0.1.0");
  });

  it("defaults to https://app.shortn.link/api/v1", async () => {
    const { client, requests } = mockClient([], { baseUrl: undefined as unknown as string });
    await client.workspaces.list();
    expect(requests[0]!.url.toString()).toBe("https://app.shortn.link/api/v1/workspaces");
  });

  it("accepts a base URL with a trailing slash or /api/v1", async () => {
    for (const baseUrl of ["https://dev.example.test/", "https://dev.example.test/api/v1/"]) {
      const { client, requests } = mockClient([], { baseUrl });
      await client.domains.list();
      expect(requests[0]!.url.toString()).toBe("https://dev.example.test/api/v1/domains");
    }
  });

  it("works without a key for the public helpers", async () => {
    const { client, requests } = mockClient([jsonResponse({ valid: true })], { apiKey: "" });
    await client.public.validateUrl("https://example.com");
    expect(requests[0]!.headers.has("Authorization")).toBe(false);
  });

  it("merges per-request headers", async () => {
    const { client, requests } = mockClient();
    await client.links.list({}, { headers: { "Accept-Language": "de-DE" } });
    expect(requests[0]!.headers.get("Accept-Language")).toBe("de-DE");
  });

  it("uses the global fetch by default", async () => {
    const original = globalThis.fetch;
    const urls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return jsonResponse({ plans: {} });
    }) as typeof fetch;
    try {
      await new Shortn().public.plans();
    } finally {
      globalThis.fetch = original;
    }
    expect(urls).toEqual(["https://app.shortn.link/api/v1/plans"]);
  });

  it("refuses to start without any fetch", () => {
    const original = globalThis.fetch;
    // @ts-expect-error simulating a runtime without fetch
    globalThis.fetch = undefined;
    try {
      expect(() => new Shortn({ apiKey: "k" })).toThrow(ShortnConfigurationError);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("does not send query parameters the caller left out", async () => {
    const { client, requests } = mockClient();
    await client.conversions.events({ environment: "test" });
    await client.analytics.link("l", { a: undefined, b: null, c: "" });
    await client.links.list();
    expect(requests.map((request) => request.url.search)).toEqual(["?environment=test", "?c=", ""]);
  });
});

describe("errors", () => {
  it("maps the API error envelope", async () => {
    const { client } = mockClient([
      jsonResponse(
        {
          code: "conversion_identity_required",
          details: { field: "idempotency_key" },
          error: "idempotency_key is required",
          hint: "Send a stable key.",
          request_id: "req_123"
        },
        { status: 400, statusText: "Bad Request" }
      )
    ]);

    const error = await client.conversions.trackLead({ click_id: "c", idempotency_key: "" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ShortnAPIError);
    const apiError = error as ShortnAPIError;
    expect(apiError.status).toBe(400);
    expect(apiError.statusText).toBe("Bad Request");
    expect(apiError.code).toBe("conversion_identity_required");
    expect(apiError.message).toBe("idempotency_key is required");
    expect(apiError.hint).toBe("Send a stable key.");
    expect(apiError.field).toBe("idempotency_key");
    expect(apiError.details).toEqual({ field: "idempotency_key" });
    expect(apiError.requestId).toBe("req_123");
    expect(apiError.body).toMatchObject({ code: "conversion_identity_required" });
    expect(apiError.name).toBe("ShortnAPIError");
  });

  it("keeps plan-limit fields in the body", async () => {
    const body = {
      code: "plan_limit_exceeded",
      current: 25,
      error: "Active links limit reached",
      feature: "active_links",
      limit: 25,
      required_plan: null,
      upgrade_url: "/profile/billing"
    };
    const { client } = mockClient([jsonResponse(body, { status: 403 })]);
    const error = (await client.links.create({ title: "t", url: "https://e.com" }).catch((e: unknown) => e)) as ShortnAPIError;
    expect(error.code).toBe("plan_limit_exceeded");
    expect(error.body).toEqual(body);
    expect(error.details).toBeUndefined();
  });

  it("handles errors that carry only `error`", async () => {
    const { client } = mockClient([jsonResponse({ error: "team not found" }, { status: 404 })]);
    const error = (await client.teams.get("x").catch((e: unknown) => e)) as ShortnAPIError;
    expect(error.status).toBe(404);
    expect(error.code).toBeUndefined();
    expect(error.message).toBe("team not found");
  });

  it("handles a non-JSON error body and the request-id header", async () => {
    const { client } = mockClient([
      new Response("upstream exploded", { headers: { "Shortn-Request-Id": "hdr_1" }, status: 502 })
    ]);
    const error = (await client.links.list().catch((e: unknown) => e)) as ShortnAPIError;
    expect(error.status).toBe(502);
    expect(error.message).toBe("upstream exploded");
    expect(error.body).toBe("upstream exploded");
    expect(error.requestId).toBe("hdr_1");
  });

  it("does not follow redirects and reports them as API errors", async () => {
    const inits: RequestInit[] = [];
    const client = new Shortn({
      apiKey: "k",
      fetch: async (_input, init) => {
        inits.push(init ?? {});
        return new Response("<html>Moved</html>", {
          headers: { Location: "https://www.example.test/api/v1/conversions/leads" },
          status: 301
        });
      },
      retry: { initialDelayMs: 0, jitter: false }
    });
    const error = (await client.conversions.trackLead({ click_id: "c", idempotency_key: "k" }).catch((e: unknown) => e)) as ShortnAPIError;
    expect(error).toBeInstanceOf(ShortnAPIError);
    expect(error.status).toBe(301);
    expect(error.message).toBe(
      "Shortn API answered 301 redirecting to https://www.example.test/api/v1/conversions/leads, which the SDK does not follow. Check baseUrl."
    );
    expect(error.body).toBe("<html>Moved</html>");
    expect(inits).toHaveLength(1);
    expect(inits[0]!.redirect).toBe("manual");
    expect(inits[0]!.method).toBe("POST");
  });

  it.each([302, 307, 308])("reports a %i redirect on a GET without retrying", async (status) => {
    const { client, requests } = mockClient([new Response(null, { headers: { Location: "/login" }, status })]);
    await expect(client.links.list()).rejects.toMatchObject({
      message: `Shortn API answered ${status} redirecting to /login, which the SDK does not follow. Check baseUrl.`,
      status
    });
    expect(requests).toHaveLength(1);
  });

  it("handles an empty error body", async () => {
    const { client } = mockClient([new Response(null, { status: 500 })]);
    const error = (await client.links.list().catch((e: unknown) => e)) as ShortnAPIError;
    expect(error.message).toBe("Shortn API request failed with status 500");
    expect(error.body).toBeUndefined();
  });

  it("wraps network failures", async () => {
    const client = new Shortn({
      apiKey: "k",
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
      retry: false
    });
    const error = (await client.links.list().catch((e: unknown) => e)) as ShortnNetworkError;
    expect(error).toBeInstanceOf(ShortnNetworkError);
    expect(error.cause).toBeInstanceOf(TypeError);
  });

  it("times out a slow attempt", async () => {
    const client = new Shortn({
      apiKey: "k",
      fetch: (_input, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
      retry: false,
      timeoutMs: 20
    });
    await expect(client.links.list()).rejects.toBeInstanceOf(ShortnTimeoutError);
  });

  it("times out a response body that stalls after the headers", async () => {
    const client = new Shortn({
      apiKey: "k",
      fetch: async () => stalledBody(),
      retry: false,
      timeoutMs: 20
    });
    await expect(client.links.list()).rejects.toBeInstanceOf(ShortnTimeoutError);
  });

  it("times out a stalled byte body (QR code)", async () => {
    const client = new Shortn({ fetch: async () => stalledBody(200, "image/png"), retry: false, timeoutMs: 20 });
    await expect(client.public.qrCode({ url: "https://example.com" })).rejects.toBeInstanceOf(ShortnTimeoutError);
  });

  it("times out a stalled error body", async () => {
    const client = new Shortn({ apiKey: "k", fetch: async () => stalledBody(500), retry: false, timeoutMs: 20 });
    await expect(client.links.list()).rejects.toBeInstanceOf(ShortnTimeoutError);
  });

  it("retries a retryable request whose body timed out", async () => {
    let calls = 0;
    const client = new Shortn({
      apiKey: "k",
      fetch: async () => {
        calls += 1;
        return calls === 1 ? stalledBody() : jsonResponse({ data: [] });
      },
      retry: { initialDelayMs: 0, jitter: false },
      timeoutMs: 20
    });
    await expect(client.links.list()).resolves.toEqual({ data: [] });
    expect(calls).toBe(2);
  });

  it("aborts while the response body is being read", async () => {
    const controller = new AbortController();
    const client = new Shortn({
      apiKey: "k",
      fetch: async () => {
        setTimeout(() => controller.abort(), 10);
        return stalledBody();
      },
      retry: false,
      timeoutMs: 0
    });
    const error = await client.links.list({}, { signal: controller.signal }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ShortnNetworkError);
    expect(error).not.toBeInstanceOf(ShortnTimeoutError);
    expect((error as ShortnNetworkError).message).toBe("Shortn request was aborted.");
  });

  it("wraps a body that fails mid-read", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{\"data\":"));
        controller.error(new TypeError("terminated"));
      }
    });
    const client = new Shortn({ apiKey: "k", fetch: async () => new Response(body, { status: 200 }), retry: false });
    const error = (await client.links.list().catch((e: unknown) => e)) as ShortnNetworkError;
    expect(error).toBeInstanceOf(ShortnNetworkError);
    expect(error.message).toBe("Shortn request failed while reading the response.");
    expect(error.cause).toBeInstanceOf(TypeError);
  });

  it("honours the caller's abort signal", async () => {
    const controller = new AbortController();
    controller.abort();
    const { client, requests } = mockClient();
    await expect(client.links.list({}, { signal: controller.signal })).rejects.toBeInstanceOf(ShortnNetworkError);
    expect(requests).toHaveLength(0);
  });
});

/** Headers arrive, the body never does (and ignores abort signals). */
function stalledBody(status = 200, contentType = "application/json"): Response {
  const body = new ReadableStream<Uint8Array>({ start() {} });
  return new Response(body, { headers: { "Content-Type": contentType }, status });
}
