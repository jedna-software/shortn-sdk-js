import { writeFile } from "node:fs/promises";
import { Shortn } from "@jednasoftware/shortn-sdk";

// These three helpers need no API key.
const shortn = new Shortn({ baseUrl: process.env.SHORTN_BASE_URL });

const check = await shortn.public.validateUrl("example.com/menu");
console.log(check.valid ? `stored as ${check.normalized}` : `refused: ${check.error}`);

const { plans } = await shortn.public.plans();
for (const plan of Object.values(plans)) {
  console.log(plan.ID, plan.Name, plan.Price / 100, plan.Currency, plan.Interval);
}

const png = await shortn.public.qrCode({ size: "download", url: "https://shtnl.ink/abC12x9" });
await writeFile("qr.png", png);
console.log(`wrote qr.png (${png.byteLength} bytes)`);
