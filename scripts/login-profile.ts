// One-time manual login into a TinyFish Browser Context Profile (docs: /v1/profiles, setup-session, save).
// You type your mobile number and the 6-digit code here; they go straight into the remote browser.
// Nothing is logged or stored; only the (non-secret) profile id is printed for .env.
//   npm run login
import readline from "node:readline/promises";
import { chromium } from "playwright-core";

const BASE = "https://agent.tinyfish.ai";
const KEY = process.env.TINYFISH_API_KEY;
const ERP = process.env.ERP_URL ?? "https://gustudent.icloudems.com/";
if (!KEY) throw new Error("TINYFISH_API_KEY not set");

async function tf<T>(path: string, body?: object): Promise<T> {
  const r = await fetch(BASE + path, { method: "POST", headers: { "X-API-Key": KEY!, "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  if (!r.ok) throw new Error(`${path} ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json() as Promise<T>;
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const profile = await tf<{ id: string }>("/v1/profiles", { name: "galgotias-erp", proxy_country_code: process.env.PROXY_COUNTRY ?? "IN" });
  const s = await tf<{ session_id: string; cdp_url: string }>(`/v1/profiles/${profile.id}/setup-session`, { url: ERP, timeout_seconds: 600 });
  const browser = await chromium.connectOverCDP(s.cdp_url);
  const page = browser.contexts()[0].pages()[0];
  await page.waitForLoadState("domcontentloaded");
  console.log("Opened:", new URL(page.url()).host);

  const mobile = (await rl.question("Mobile number or email for the ERP: ")).trim();
  await page.locator("input:visible").first().fill(mobile);
  await page.getByRole("button", { name: /sign in/i }).click();

  const otpBox = page.locator('input:visible').first();
  await otpBox.waitFor({ timeout: 20000 });
  const code = (await rl.question("Current 6-digit authenticator code: ")).trim();
  await otpBox.fill(code);
  await page.getByRole("button", { name: /sign in/i }).click();
  rl.close();

  // success = we left the Keycloak host and are on the student app
  await page.waitForURL((u) => u.host.startsWith("gustudent"), { timeout: 30000 }).catch(() => {});
  const host = new URL(page.url()).host;
  if (!host.startsWith("gustudent")) {
    console.error("Login did not complete (still on " + host + "). Cancelling; nothing saved.");
    await tf(`/v1/profiles/${profile.id}/setup-session/cancel`, { session_id: s.session_id }).catch(() => {});
    await browser.close().catch(() => {});
    process.exit(1);
  }
  const saved = await tf<{ domains_updated: string[]; cookie_count: number }>(`/v1/profiles/${profile.id}/save`, { session_id: s.session_id, signed_in_sites: [host] });
  console.log("Saved. domains:", saved.domains_updated.join(", "), "cookies:", saved.cookie_count);
  console.log("\nAdd this line to .env:\nPROFILE_ID=" + profile.id);
  await browser.close().catch(() => {});
}
main().catch((e) => { console.error(e.message); process.exit(1); });
