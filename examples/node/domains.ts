import { Shortn, ShortnAPIError } from "@jednasoftware/shortn-sdk";

// Custom domains are identified by a numeric id. Adding, verifying and
// deleting one needs an account-wide key.
const shortn = new Shortn({
  apiKey: requiredEnv("SHORTN_API_KEY"),
  baseUrl: process.env.SHORTN_BASE_URL
});

for (const domain of (await shortn.domains.list()).data) {
  console.log(domain.id, domain.domain, domain.status, `${domain.links_using ?? 0} links`);
}

const hostname = process.env.SHORTN_NEW_DOMAIN;
if (hostname) {
  try {
    const { domain } = await shortn.domains.create({ domain: hostname });
    console.log("create these DNS records:", domain.dns);
    const check = await shortn.domains.verify(domain.id);
    console.log("verified:", check.verification.verified, check.verification.error ?? "");
  } catch (error) {
    if (error instanceof ShortnAPIError && error.code === "plan_limit_exceeded") {
      console.error("Your plan has no room for another domain.");
    } else {
      throw error;
    }
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}.`);
  return value;
}
