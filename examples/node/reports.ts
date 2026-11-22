import { Shortn } from "@jednasoftware/shortn-sdk";

// A weekly report rule. Build a report once in the dashboard and read it
// with getRule() to see a full definition.
const shortn = new Shortn({
  apiKey: requiredEnv("SHORTN_API_KEY"),
  baseUrl: process.env.SHORTN_BASE_URL
});
const workspace = requiredEnv("SHORTN_WORKSPACE");

const { data: rule } = await shortn.reports.createRule({
  definition_json: {
    options: { include_comparison: true, locale: "en-US" },
    sections: [
      { id: "total_clicks", order: 1, settings: { window: "7d" } },
      { id: "top_links", order: 2, settings: { top_n: 10 } }
    ],
    trigger: "scheduled",
    version: "custom_builder.v1"
  },
  destination_public_ids: process.env.SHORTN_DESTINATION ? [process.env.SHORTN_DESTINATION] : [],
  interval_seconds: 604800,
  report_name: "Weekly traffic",
  report_type: "custom_builder_v1",
  workspace_public_id: workspace
});
console.log("next run", rule.next_run_at);

// Pause it, list the workspace's scheduled reports, then delete it.
await shortn.reports.updateRule(rule.public_id, { enabled: false });
const { data: rules } = await shortn.reports.listRules({ schedule_types: ["every_x"], workspace_public_id: workspace });
console.log(rules.map((item) => `${item.report_name} (${item.enabled ? "on" : "paused"})`));
await shortn.reports.deleteRule(rule.public_id);

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}.`);
  return value;
}
