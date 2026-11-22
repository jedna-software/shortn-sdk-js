import { Shortn } from "@jednasoftware/shortn-sdk";

const shortn = new Shortn({
  apiKey: requiredEnv("SHORTN_API_KEY"),
  baseUrl: process.env.SHORTN_BASE_URL
});
const environment = process.env.SHORTN_TEST_MODE === "0" ? "live" : "test";

const summary = await shortn.conversions.summary();
console.log("all-time leads", summary.data.leads, "net revenue", summary.data.reporting.net_revenue_cents, summary.data.reporting.currency);

const attribution = await shortn.conversions.attribution({ environment, from: "2026-11-01", limit: 10 });
for (const row of attribution.data) {
  console.log(row.display_name ?? row.attribution.type, row.leads, row.sales);
}

const timeline = await shortn.conversions.timeline({ environment, interval: "week" });
console.log("weeks:", timeline.data.map((point) => `${point.start}: ${point.sales} sales`));

let offset = 0;
for (;;) {
  const page = await shortn.conversions.events({ environment, event_type: "sale", limit: 100, offset });
  for (const event of page.data) console.log(event.occurred_at, event.invoice_id, event.amount, event.currency);
  if (!page.pagination.has_more || page.pagination.next_offset == null) break;
  offset = page.pagination.next_offset;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}.`);
  return value;
}
