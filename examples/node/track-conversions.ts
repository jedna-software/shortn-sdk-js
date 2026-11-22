import { Shortn } from "@jednasoftware/shortn-sdk";

// Forward a lead, a sale and a refund from your backend. SHORTN_CLICK_ID is
// the click id the capture script stored for the visitor (snt_click_id).
const shortn = new Shortn({
  apiKey: requiredEnv("SHORTN_API_KEY"),
  baseUrl: process.env.SHORTN_BASE_URL
});
const clickId = requiredEnv("SHORTN_CLICK_ID");
const testMode = process.env.SHORTN_TEST_MODE !== "0";

// A lead needs a stable idempotency_key, such as your signup ID, so the
// SDK's retries record it once. Test-mode writes are never retried: the API
// records every test request as a new event.
const lead = {
  click_id: clickId,
  event_name: "Sign up",
  idempotency_key: "signup_8412",
  lead_category: "signup",
  test_mode: testMode
} as const;
const check = await shortn.conversions.validateLead(lead);
console.log("lead would be tracked:", check.result.would_track);
console.log("lead:", (await shortn.conversions.trackLead(lead)).event.public_id);

// amount_cents is in hundredths of the currency's main unit.
const sale = await shortn.conversions.trackSale({
  amount_cents: 4900,
  click_id: clickId,
  currency: "EUR",
  event_name: "Invoice paid",
  invoice_id: "inv_123",
  test_mode: testMode
});
console.log("sale:", sale.event.amount, sale.event.currency);

// A refund names its sale by invoice_id.
if (!testMode) {
  const refund = await shortn.conversions.trackRefund({
    amount_cents: 1900,
    invoice_id: "inv_123",
    reason: "Damaged item",
    refund_id: "re_456"
  });
  console.log("left to refund:", refund.event.remaining_amount_cents);
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}.`);
  return value;
}
