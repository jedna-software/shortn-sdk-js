import { Shortn } from "@jednasoftware/shortn-sdk";

// Tags, UTM templates, teams and destinations live in a workspace.
const shortn = new Shortn({
  apiKey: requiredEnv("SHORTN_API_KEY"),
  baseUrl: process.env.SHORTN_BASE_URL
});

const { data: workspaces } = await shortn.workspaces.list();
const workspace = process.env.SHORTN_WORKSPACE ?? workspaces[0]?.public_id;
if (!workspace) throw new Error("No workspace.");

const tag = await shortn.tags.create(workspace, { color: "#3b82f6", name: "Spring" });
await shortn.tags.update(tag.public_id, { name: "Spring 2027" });
console.log("tags:", (await shortn.tags.list(workspace)).tags?.map((item) => item.name));

const template = await shortn.utmTemplates.create(workspace, {
  name: "Newsletter",
  utm_medium: "email",
  utm_source: "newsletter"
});
// PUT replaces the template: send every value to keep.
await shortn.utmTemplates.update(template.data.public_id, {
  name: "Newsletter",
  utm_campaign: "spring",
  utm_medium: "email",
  utm_source: "newsletter"
});

const team = await shortn.teams.create(workspace, { name: "Paid Social" });
await shortn.teams.update(team.slug, { description: "Paid social campaigns" }, { workspace });
console.log("team:", (await shortn.teams.get(team.slug, { workspace })).name);

const destination = await shortn.destinations.create(workspace, {
  config: { to: ["marketing@example.com"] },
  name: "Marketing inbox",
  type: "email"
});
await shortn.destinations.update(workspace, destination.public_id, {
  config: { to: ["marketing@example.com", "cmo@example.com"] },
  name: "Marketing inbox",
  type: "email"
});
console.log("destinations:", (await shortn.destinations.list(workspace)).map((item) => item.name));

// Clean up.
await shortn.destinations.delete(workspace, destination.public_id);
await shortn.teams.delete(team.slug, { workspace });
await shortn.utmTemplates.delete(template.data.public_id, { links: "keep" });
await shortn.tags.delete(tag.public_id);

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}.`);
  return value;
}
