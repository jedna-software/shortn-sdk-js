import { Shortn } from "@jednasoftware/shortn-sdk";

// Create a link, read it, rename it, read its clicks, then suspend it.
const shortn = new Shortn({
  apiKey: requiredEnv("SHORTN_API_KEY"),
  baseUrl: process.env.SHORTN_BASE_URL
});

const link = await shortn.links.create({
  title: "Spring campaign",
  url: "https://example.com/spring",
  utm_medium: "email",
  utm_source: "newsletter",
  workspace_public_id: process.env.SHORTN_WORKSPACE
});
console.log("created", link.short_url, link.link_status);

const { data } = await shortn.links.get(link.public_id);
console.log("status", data.status, "clicks", data.clicks);

await shortn.links.update(link.public_id, { title: "Spring sale" });

const page = await shortn.links.list({ limit: 20 });
console.log("links on the first page:", page.data.length, "more:", page.pagination.has_more);

const clicks = await shortn.analytics.link(link.public_id);
console.log("total clicks", clicks.total_clicks, clicks.clicks_by_country);

// DELETE suspends the link; enable() would make it active again.
await shortn.links.delete(link.public_id);

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}.`);
  return value;
}
