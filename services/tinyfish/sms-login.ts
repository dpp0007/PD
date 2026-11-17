import "server-only";
import { chromium, type Browser, type Page } from "playwright-core";
import { deleteProfile } from "./authenticate";

// Human-in-the-loop login for portals that send an SMS code (the vault cannot read SMS).
// The user types the mobile number and the code in PortalDump; they go straight into the remote browser
// and are never stored or logged. The open browser is held in memory between the two steps.
const BASE = "https://agent.tinyfish.ai";
type Sess = { browser: Browser; page: Page; profileId: string; sessionId: string; timer: NodeJS.Timeout };
const g = globalThis as unknown as { __smsSessions?: Map<string, Sess> };
const sessions = (g.__smsSessions ??= new Map());

async function tf<T>(path: string, body?: object): Promise<T> {
  const r = await fetch(BASE + path, { method: "POST", headers: { "X-API-Key": process.env.TINYFISH_API_KEY!, "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  if (!r.ok) throw new Error(`TinyFish ${r.status} ${path}: ${(await r.text()).slice(0, 200)}`);
  return r.json() as Promise<T>;
}

async function discard(id: string) {
  const s = sessions.get(id);
  if (!s) return;
  sessions.delete(id);
  clearTimeout(s.timer);
  await tf(`/v1/profiles/${s.profileId}/setup-session/cancel`, { session_id: s.sessionId }).catch(() => {});
  await s.browser.close().catch(() => {});
  await deleteProfile(s.profileId);
}
export const cancelSmsLogin = discard;

// Airtel (probed on the public page): /manage-account/login has one "Mobile Number" box and a "Send OTP" button.
const MOBILE = 'input[placeholder*="mobile" i]:visible, input[type="tel"]:visible';
const SEND = /send otp/i;
const VERIFY = /verify|submit|log ?in|continue|proceed/i;

export async function startSmsLogin(entryUrl: string, mobile: string, country: string): Promise<string> {
  const profile = await tf<{ id: string }>("/v1/profiles", { name: `portaldump-${Date.now()}`, proxy_country_code: country });
  const s = await tf<{ session_id: string; cdp_url: string }>(`/v1/profiles/${profile.id}/setup-session`, { url: entryUrl, timeout_seconds: 600 });
  const id = s.session_id;
  let browser: Browser | undefined;
  try {
    browser = await chromium.connectOverCDP(s.cdp_url);
    const page = browser.contexts()[0].pages()[0];
    await page.waitForLoadState("domcontentloaded");
    const input = page.locator(MOBILE).first();
    await input.waitFor({ timeout: 40000 }).catch(() => { throw new Error("The sign-in page did not show a mobile number field in time."); }); // the page shows a loader first
    await input.fill(mobile);
    await page.getByRole("button", { name: SEND }).first().click({ timeout: 10000 }).catch(() => { throw new Error("Could not press Send OTP."); });
    await page.waitForTimeout(3000);
    if (await page.getByText(/invalid|not registered|too many|try again later|blocked/i).first().isVisible().catch(() => false)) throw new Error("The portal did not accept the number or is limiting attempts.");
    const timer = setTimeout(() => discard(id), 9 * 60 * 1000); // codes and setup sessions are short-lived
    sessions.set(id, { browser, page, profileId: profile.id, sessionId: id, timer });
    return id;
  } catch (e) { // never leave a half-open session or profile behind
    await tf(`/v1/profiles/${profile.id}/setup-session/cancel`, { session_id: id }).catch(() => {});
    await browser?.close().catch(() => {});
    await deleteProfile(profile.id);
    throw e;
  }
}

// Returns the signed-in profile id (the caller deletes it when the run ends).
export async function finishSmsLogin(id: string, otp: string): Promise<string> {
  const s = sessions.get(id);
  if (!s) throw new Error("This sign-in expired. Start again.");
  const { page } = s;
  try {
    // The code box replaces (or sits beside) the mobile box: prefer any visible input that is not the mobile one.
    const other = page.locator('input:visible:not([placeholder*="mobile" i])').first();
    const first = (await other.isVisible().catch(() => false)) ? other : page.locator("input:visible").first();
    await first.click({ timeout: 8000 });
    await page.keyboard.type(otp, { delay: 90 }); // works for one box or one box per digit
    const btn = page.getByRole("button", { name: VERIFY }).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) await btn.click().catch(() => {});
    else await page.keyboard.press("Enter");
    const left = await page.waitForURL((u: URL) => !u.pathname.includes("/login"), { timeout: 20000 }).then(() => true, () => false);
    if (!left) throw new Error(await page.getByText(/invalid|incorrect|wrong|expired/i).first().isVisible().catch(() => false) ? "The portal rejected the code. Start again to get a new one." : "Sign-in did not complete. Start again.");
    const host = new URL(page.url()).host;
    await tf(`/v1/profiles/${s.profileId}/save`, { session_id: s.sessionId, signed_in_sites: [host] });
    sessions.delete(id);
    clearTimeout(s.timer);
    await s.browser.close().catch(() => {});
    return s.profileId;
  } catch (e) {
    await discard(id);
    throw e;
  }
}
