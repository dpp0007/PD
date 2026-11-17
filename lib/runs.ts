import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { cancelRun, getRun, startRun } from "@/services/tinyfish/client";
import { deleteProfile, openSignedInPage } from "@/services/tinyfish/authenticate";
import { scrapeAttendance } from "@/services/tinyfish/erp-attendance";
import { ENGINES } from "./engines";
import { load, save, type DB, type RunRec } from "./store";
import { applySync, type Change } from "./sync";

const SIGNED_IN = 'You should already be signed in via a saved session. If a login page appears instead, the session is not valid: stop and report it in "blocker". Never ask for or type credentials or one-time codes.';

// Portals driven by a script on TinyFish's browser (deterministic) instead of the AI agent.
// The agent could not reliably click the ERP's Attendance link; a script can.
const SCRIPTED: Record<string, (page: import("playwright-core").Page, ctl: { cancelled: () => boolean; progress: (m: string, n: number) => void }, opts: { since?: string }) => Promise<unknown>> = {
  "galgotias-erp": scrapeAttendance,
};
type Live = { cancelled: boolean; msg: string; n: number };
const g = globalThis as unknown as { __live?: Map<string, Live> };
const live = (g.__live ??= new Map());

const Result = z.object({ loggedIn: z.boolean(), blocker: z.string().nullable().optional(), complete: z.boolean().optional(), notes: z.string().optional() }).passthrough();

// Shared by both paths: validate, normalize, dedupe, diff. COMPLETED is not success: only complete===true with rows is.
function ingest(db: DB, r: RunRec, raw: unknown) {
  const e = ENGINES[r.portal];
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { /* handled below */ } }
  const p = Result.safeParse(raw);
  if (!p.success) { r.status = "failed"; r.error = "Unexpected result shape; nothing was imported."; return; }
  if (!p.data.loggedIn || p.data.blocker) { r.status = "failed"; r.error = p.data.blocker ?? "Login did not succeed."; return; }
  const rows = Array.isArray(p.data[e.resultKey]) ? (p.data[e.resultKey] as Record<string, unknown>[]).filter((x) => x && typeof x === "object") : [];
  const recs = rows.map(e.normalize);
  r.found = recs.length;
  r.notes = p.data.notes;
  const log: Change[] = [];
  r.diff = applySync((db.records[r.portal] ??= {}), recs, r.id, log);
  const lean = (o?: Record<string, unknown>) => { if (!o) return o; const { source: _s, ...rest } = o; return rest; };
  r.changes = log.slice(0, 300).map((c) => ({ ...c, before: lean(c.before), after: lean(c.after)! }));
  r.status = p.data.complete && recs.length ? "completed" : "partial";
  if (r.status === "partial") r.error = recs.length ? (p.data.notes ?? "The run did not confirm it reached the end of the data.") : (p.data.notes ?? "No records were found.");
}

async function runScripted(id: string, portal: string, since?: string) {
  const state = live.get(id)!;
  let result: unknown, failure: string | undefined;
  try {
    const s = await openSignedInPage(ENGINES[portal].loginUrl()!, ENGINES[portal].proxy);
    try {
      result = await SCRIPTED[portal](s.page, { cancelled: () => state.cancelled, progress: (m, n) => { state.msg = m; state.n = n; } }, { since });
    } finally { await s.close(); } // ends the session and deletes the temporary login
  } catch (e) { failure = (e as Error).message; }
  const db = load();
  const r = db.runs.find((x) => x.id === id);
  if (r && r.status === "running") {
    r.finishedAt = new Date().toISOString();
    r.steps = state.n;
    if (failure) { r.status = "failed"; r.error = failure; }
    else if (state.cancelled) { r.status = "cancelled"; r.error = "Cancelled by you."; }
    else ingest(db, r, result);
    save(db);
  }
  live.delete(id);
}

// `sessionProfile` = a profile already signed in by the SMS flow (agent-driven portals).
export async function launch(portal: string, mode: RunRec["mode"], sessionProfile?: string, engine: "agent" | "script" = "script") {
  const e = ENGINES[portal];
  if (!e) throw new Error("No extraction engine for this portal yet.");
  const login = e.loginUrl();
  if (!login?.startsWith("https://")) throw new Error("Portal URL is not configured in .env");

  if (SCRIPTED[portal] && engine === "script") {
    const id = `local-${randomUUID()}`;
    live.set(id, { cancelled: false, msg: "Signing in…", n: 0 });
    const db = load();
    db.runs.unshift({ id, portal, engine: "script", mode, status: "running", startedAt: new Date().toISOString() });
    save(db);
    // Incremental: only re-read from one month before the newest stored record (catches late corrections); full: everything.
    const dates = Object.values(db.records[portal] ?? {}).map((v) => String(v.data.date ?? "")).filter((d) => /^\d{4}-\d{2}/.test(d)).sort();
    let since: string | undefined;
    if (mode === "incremental" && dates.length) { const [y, m] = dates[dates.length - 1].split("-").map(Number); const d = new Date(y, m - 2, 1); since = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
    db.runs[0].scope = since ? `Incremental: from ${since} onward` : "Full history";
    save(db);
    void runScripted(id, portal, since); // continues in the background; progress via /api/runs
    return id;
  }

  if (!sessionProfile && e.auth === "op") { // sign in locally (1Password), save the session into a TinyFish browser profile, hand it to the Agent
    const s = await openSignedInPage(login, e.proxy);
    try { await s.save(); } catch (err) { await s.close(); throw err; }
    await s.close(true);
    sessionProfile = s.profileId;
  }
  if (!sessionProfile) throw new Error("Sign in to this portal first.");
  try {
    const { run_id } = await startRun({
      url: e.startUrl() ?? login,
      goal: e.goal.replace(/^Log in using[^\n]*/, SIGNED_IN),
      browser_profile: "stealth", use_profile: true, profile_id: sessionProfile,
      proxy_config: { enabled: true, type: "tinyfish", country_code: e.proxy },
      agent_config: { max_duration_seconds: 1800 },
    });
    const db = load();
    db.runs.unshift({ id: run_id, portal, engine: "agent", mode, status: "running", startedAt: new Date().toISOString(), profileId: sessionProfile });
    save(db);
    return run_id;
  } catch (err) { await deleteProfile(sessionProfile); throw err; }
}

export async function cancel(id: string) {
  const l = live.get(id);
  if (l) { l.cancelled = true; l.msg = "Cancelling…"; return true; } // the script stops between steps and cleans up
  const db = load();
  const r = db.runs.find((x) => x.id === id);
  if (!r || r.status !== "running") return false;
  if (!id.startsWith("local-")) await cancelRun(id).catch(() => {});
  r.status = "cancelled"; r.error = "Cancelled by you."; r.finishedAt = new Date().toISOString(); r.ingested = true;
  if (r.profileId) { await deleteProfile(r.profileId); r.profileId = undefined; }
  save(db);
  return true;
}

// Refresh running agent runs from TinyFish; ingest each finished run exactly once (idempotent).
export async function refresh() {
  const db = load();
  for (const r of db.runs.filter((r) => r.status === "running")) {
    if (r.id.startsWith("local-")) {
      const l = live.get(r.id);
      if (l) { r.steps = l.n; r.notes = l.msg; }
      else { r.status = "failed"; r.error = "Interrupted (the app restarted while this was running)."; r.finishedAt = new Date().toISOString(); }
      continue;
    }
    const t = await getRun(r.id).catch(() => null);
    if (!t) continue;
    r.steps = t.num_of_steps ?? r.steps;
    r.streamingUrl = t.streaming_url ?? r.streamingUrl;
    if (!["FAILED", "CANCELLED", "COMPLETED"].includes(t.status)) continue;
    if (r.profileId) { await deleteProfile(r.profileId); r.profileId = undefined; } // revoke saved session
    r.finishedAt = new Date().toISOString();
    if (t.status !== "COMPLETED") { r.status = t.status === "FAILED" ? "failed" : "cancelled"; r.error = t.error?.message ?? t.status; continue; }
    r.ingested = true;
    ingest(db, r, t.result);
  }
  save(db);
  return db;
}
