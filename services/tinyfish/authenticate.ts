import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium, type Page } from "playwright-core";

const run = promisify(execFile);
const BASE = "https://agent.tinyfish.ai";

async function tf<T>(path: string, method = "POST", body?: object): Promise<T> {
  const r = await fetch(BASE + path, { method, headers: { "X-API-Key": process.env.TINYFISH_API_KEY!, "Content-Type": "application/json" }, body: method === "POST" ? JSON.stringify(body ?? {}) : undefined });
  if (!r.ok) throw new Error(`TinyFish ${r.status} ${path}: ${(await r.text()).slice(0, 200)}`);
  return r.json() as Promise<T>;
}

// 1Password CLI, run locally: the TOTP seed never leaves 1Password; we only ever hold a 6-digit code for seconds.
const op = async (...a: string[]) => {
  const item = process.env.OP_ITEM ?? "Galgotias ERP", vault = process.env.OP_VAULT ?? "Portal Dump";
  try { return (await run("op", ["item", "get", item, "--vault", vault, ...a])).stdout.trim(); }
  catch (e) { throw new Error("1Password CLI failed (installed, signed in, approved in the app?): " + String((e as { stderr?: string }).stderr || (e as Error).message).split("\n")[0].slice(0, 200)); }
};

export const deleteProfile = (id: string) => tf(`/v1/profiles/${id}`, "DELETE").catch(() => {});

export type Signed = { page: Page; close: (keepProfile?: boolean) => Promise<void>; profileId: string; save: () => Promise<void> };

// Opens a TinyFish browser session and signs in (username + 1Password TOTP). The caller drives `page`, then calls close(),
// which ends the session and deletes its temporary profile (revoking the login). Never logs the username or code.
export async function openSignedInPage(entryUrl: string, country = "IN"): Promise<Signed> {
  const profile = await tf<{ id: string }>("/v1/profiles", "POST", { name: `portaldump-${Date.now()}`, proxy_country_code: country });
  const s = await tf<{ session_id: string; cdp_url: string }>(`/v1/profiles/${profile.id}/setup-session`, "POST", { url: entryUrl, timeout_seconds: 900 });
  let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | undefined;
  const close = async (keepProfile = false) => {
    await tf(`/v1/profiles/${profile.id}/setup-session/cancel`, "POST", { session_id: s.session_id }).catch(() => {});
    await browser?.close().catch(() => {});
    if (!keepProfile) await deleteProfile(profile.id);
  };
  // Persist the signed-in browser state (cookies/storage) into the profile so a TinyFish Agent run can reuse it.
  const save = async () => { await tf(`/v1/profiles/${profile.id}/save`, "POST", { session_id: s.session_id, signed_in_sites: [new URL(entryUrl).host] }); };
  try {
    browser = await chromium.connectOverCDP(s.cdp_url);
    const page = browser.contexts()[0].pages()[0];
    await page.waitForLoadState("domcontentloaded");
    await page.locator("input:visible").first().fill(await op("--fields", "label=username"));
    await page.getByRole("button", { name: /sign in/i }).click();
    const box = page.locator("input:visible").first();
    await box.waitFor({ timeout: 20000 });
    // Code fetched only now; one retry on the next code, then stop (lockout protection).
    for (let attempt = 0; attempt < 2; attempt++) {
      const code = await op("--otp");
      if (!/^\d{6,8}$/.test(code)) throw new Error("1Password did not return a numeric code");
      await box.fill(code);
      await page.getByRole("button", { name: /sign in/i }).click();
      const ok = await page.waitForURL((u: URL) => u.host.startsWith("gustudent"), { timeout: 15000 }).then(() => true, () => false);
      if (ok) { await page.waitForTimeout(3000); return { page, close, profileId: profile.id, save }; }
      if (attempt === 0) await page.waitForTimeout(31000); // wait for the next 30s code
    }
    throw new Error("Login rejected twice by the ERP; stopped to avoid account lockout.");
  } catch (e) { await close(); throw e; }
}
