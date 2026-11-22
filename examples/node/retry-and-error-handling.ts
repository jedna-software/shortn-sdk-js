import { Shortn, ShortnAPIError, ShortnNetworkError } from "@jednasoftware/shortn-sdk";

// GET, PUT and DELETE, and POSTs carrying an idempotency_key (but not
// test_mode conversions, which the API never deduplicates), are retried on
// 429 and 503 (honouring Retry-After) and on network errors. A Retry-After
// longer than maxDelayMs, such as the monthly quota's, throws at once.
const shortn = new Shortn({
  apiKey: requiredEnv("SHORTN_API_KEY"),
  baseUrl: process.env.SHORTN_BASE_URL,
  retry: { backoffFactor: 2, initialDelayMs: 250, maxDelayMs: 10_000, maxRetries: 3 },
  timeoutMs: 10_000
});

try {
  await shortn.links.create({ custom_code: "login", title: "Reserved", url: "https://example.com" });
} catch (error) {
  if (error instanceof ShortnAPIError) {
    // code is stable and safe to branch on; message is the API's `error`.
    console.error(error.status, error.code, error.message);
    if (error.hint) console.error("hint:", error.hint);
    if (error.field) console.error("field:", error.field);
    if (error.code === "plan_limit_exceeded") {
      const body = error.body as { feature?: string; required_plan?: string | null };
      console.error("needs", body.required_plan ?? "a higher plan", "for", body.feature);
    }
  } else if (error instanceof ShortnNetworkError) {
    console.error("network problem:", error.message);
  } else {
    throw error;
  }
}

// Turn retries off for one call.
await shortn.workspaces.list({ retry: false });

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}.`);
  return value;
}
