"use client";
import { useEffect, useMemo, useState } from "react";
import { Pill, when } from "@/components/ui";
import { useRuns, type Run } from "@/components/useRuns";
import RunReport, { headline } from "@/components/RunReport";
import { AttendanceInsights, SpendInsights } from "@/components/Insights";
import type { Portal } from "@/lib/portals";

const post = (url: string, body: object) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

function Elapsed({ since }: { since: string }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((Date.now() - +new Date(since)) / 1000));
  return <>{Math.floor(s / 60)}m {String(s % 60).padStart(2, "0")}s</>;
}

export default function Workspace({ portal }: { portal: Portal }) {
  const { runs, records, loaded, active, reload } = useRuns(portal.slug);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"idle" | "mobile" | "code">("idle");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [connectId, setConnectId] = useState("");
  const [mode, setMode] = useState<"full" | "incremental">("incremental");
  const [engine, setEngine] = useState<"agent" | "script">(portal.engines?.[0] ?? "script");
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "new" | "flagged">("all");

  const running = runs.find((r) => r.status === "running");
  const finished = runs.filter((r) => r.status !== "running");
  const latest = finished.find((r) => r.diff) ?? finished[0];
  const bad = records.filter((r) => r.status === "incomplete").length;
  const latestOk = runs.find((r) => r.status === "completed" || r.status === "partial");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return records.filter((r) => {
      if (only === "flagged" && r.status !== "incomplete") return false;
      if (only === "new" && !(latestOk && r.firstRun === latestOk.id)) return false;
      return !needle || portal.columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(needle));
    });
  }, [records, q, only, latestOk, portal.columns]);

  async function start(m: "full" | "incremental") {
    setErr(""); setMode(m);
    if (portal.auth === "sms") return setStep("mobile");
    setBusy(true);
    const r = await post("/api/runs", { portal: portal.slug, consent, mode: m, engine });
    setBusy(false);
    if (r.error) setErr(r.error); else reload();
  }
  async function sendCode(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    const r = await post("/api/connect", { action: "start", portal: portal.slug, consent, mobile });
    setBusy(false);
    if (r.error) return setErr(r.error);
    setConnectId(r.connectId); setStep("code");
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    const r = await post("/api/connect", { action: "verify", portal: portal.slug, connectId, otp, mode });
    setBusy(false); setOtp("");
    if (r.error) return setErr(r.error);
    setStep("idle"); setMobile(""); setConnectId(""); reload();
  }
  async function abandon() {
    if (connectId) await post("/api/connect", { action: "cancel", connectId });
    setStep("idle"); setConnectId(""); setOtp(""); setErr("");
  }
  async function cancel(run: Run) {
    if (!confirm("Stop this extraction? Records collected so far in this run are not saved.")) return;
    await post("/api/runs/cancel", { id: run.id });
    reload();
  }
  async function wipe() {
    if (!confirm(`Delete all runs and records for ${portal.name}? This cannot be undone.`)) return;
    await fetch(`/api/runs?portal=${portal.slug}`, { method: "DELETE" });
    reload();
  }

  const files = records.length
    ? [[`records/${portal.dataTypes[0].toLowerCase()}.csv`, `${records.length} rows`], [`records/${portal.dataTypes[0].toLowerCase()}.json`, `${records.length} records`], ["manifest.json", "counts, run status, errors, schema version"], ["metadata/export_summary.json", `${runs.length} runs`], ["documents/", "none yet (see limits)"]]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label">{portal.category} · {portal.site}</div>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight">{portal.name}</h1>
        </div>
        <span className={`rounded-full border px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wide ${portal.verified ? "border-emerald-300 bg-emerald-100 text-emerald-800" : "border-warn/30 bg-warn-soft text-warn"}`}>{portal.verified ? "✓ Verified working" : "Not yet verified"}</span>
      </div>

      {running ? (
        <section className="card border-hot/40 p-5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><Pill status="running" /><span className="font-medium">Collecting from {portal.name}</span></div>
            <button onClick={() => cancel(running)} className="btn-danger">Cancel</button>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><dt className="label">Elapsed</dt><dd className="mono mt-1"><Elapsed since={running.startedAt} /></dd></div>
            <div><dt className="label">{running.id.startsWith("local-") ? "Months done" : "Agent steps"}</dt><dd className="mono mt-1">{running.steps ?? 0}</dd></div>
            <div><dt className="label">Mode</dt><dd className="mt-1">{running.mode}{(running as unknown as { scope?: string }).scope ? ` · ${(running as unknown as { scope?: string }).scope}` : ""}</dd></div>
            <div><dt className="label">{running.id.startsWith("local-") ? "Now" : "Live view"}</dt><dd className="mt-1">{running.id.startsWith("local-") ? (running.notes ?? "Starting…") : running.streamingUrl ? <a className="underline" href={running.streamingUrl} target="_blank" rel="noreferrer">Watch (read-only)</a> : "Starting…"}</dd></div>
          </dl>
          <p className="mt-4 text-xs text-mute">You can leave this page; the run continues. Records appear when it finishes.</p>
        </section>
      ) : (
        <section className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <h2 className="font-semibold">Export my data</h2>
              <p className="mt-1 text-sm text-mute">{portal.collects}</p>
            </div>
            {step === "idle" && (
              <div className="flex flex-wrap gap-2">
                <button disabled={!consent || busy || active} onClick={() => start("incremental")} className="btn-hot">{busy ? "Signing in…" : records.length ? "Sync new records" : "Start export"}</button>
                {records.length > 0 && <button disabled={!consent || busy || active} onClick={() => start("full")} className="btn-ghost">Full re-export</button>}
              </div>
            )}
          </div>

          <label className="mt-4 flex items-start gap-3 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-hot)]" />
            <span>I authorize PortalDump to access <strong className="font-medium">my own account</strong> on this portal and collect the data described here.</span>
          </label>

          {(portal.engines?.length ?? 0) > 1 && step === "idle" && (
            <fieldset className="mt-3">
              <legend className="label mb-2">Engine</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {([["script", "Fast browser script", "Drives the TinyFish cloud browser directly. About 1.5 minutes."], ["agent", "TinyFish Agent (experimental)", "Experimental. An AI agent clicks through the portal, billed per step. On this ERP it reached the attendance page once and stalled on the dashboard in other runs."]] as const).map(([k, t2, d]) => (
                  <label key={k} className={`cursor-pointer rounded-lg border p-3 text-sm ${engine === k ? "border-ink bg-surface" : "border-line bg-bg"}`}>
                    <input type="radio" name="engine" value={k} checked={engine === k} onChange={() => setEngine(k)} className="mr-2 accent-[var(--color-hot)]" />
                    <span className="font-medium">{t2}</span>
                    <span className="mt-1 block text-xs text-mute">{d}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <details className="mt-3 rounded-lg border border-line">
            <summary className="px-3 py-2 text-sm font-medium">What will happen (portal, sign-in, retention, limits)</summary>
            <dl className="divide-y divide-line border-t border-line text-sm">
              {[
                ["Portal accessed", `${portal.name} (${portal.site})`],
                ["Collected", portal.collects],
                ["Documents", "None downloaded yet."],
                ["Purpose", "Give you your own records as CSV and JSON."],
                ["Sign-in", portal.authNote],
                ["Retention", "Kept on this computer until you delete it. Temporary sign-in sessions are deleted when a run ends."],
                ["Limits", portal.limits],
              ].map(([k, v]) => (
                <div key={k} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[9rem_1fr]"><dt className="text-mute">{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          </details>

          {step === "mobile" && (
            <form onSubmit={sendCode} className="mt-4 max-w-sm space-y-3">
              <label htmlFor="mobile" className="label block">Mobile number registered with {portal.name}</label>
              <input id="mobile" autoFocus inputMode="tel" required value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="9876543210" className="input" />
              <div className="flex gap-2">
                <button disabled={busy || !consent} className="btn-hot">{busy ? "Requesting code…" : "Send code"}</button>
                <button type="button" onClick={abandon} className="btn-ghost">Back</button>
              </div>
              <p className="text-xs text-mute">Used once to request your SMS code. It is not stored.</p>
            </form>
          )}
          {step === "code" && (
            <form onSubmit={verify} className="mt-4 max-w-sm space-y-3">
              <label htmlFor="otp" className="label block">Code sent by SMS</label>
              <input id="otp" autoFocus inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{4,8}" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="123456" className="input mono tracking-[0.3em]" />
              <div className="flex gap-2">
                <button disabled={busy} className="btn-hot">{busy ? "Verifying…" : "Verify and start"}</button>
                <button type="button" onClick={abandon} className="btn-ghost">Cancel</button>
              </div>
              <p className="text-xs text-mute">Entered into the secure browser session only. Never stored or logged.</p>
            </form>
          )}
          {err && <p role="alert" className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{err}</p>}
        </section>
      )}

      {latest && <RunReport run={latest} cols={portal.columns} total={records.length} />}

      {portal.slug === "galgotias-erp" && <AttendanceInsights records={records} />}
      {portal.slug === "airtel" && <SpendInsights records={records} />}

      {files.length > 0 && (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="label">Export archive</div>
              <h3 className="mt-1.5 text-lg font-semibold tracking-tight">PortalDump_Export.zip</h3>
            </div>
            <a href={`/api/export?portal=${portal.slug}`} className="btn-primary">Download ZIP</a>
          </div>
          <ul className="mono mt-4 divide-y divide-line rounded-lg border border-line text-xs">
            {files.map(([f, d]) => <li key={f} className="flex justify-between gap-4 px-3 py-2"><span>{f}</span><span className="text-mute">{d}</span></li>)}
          </ul>
          <p className="mt-3 text-xs text-mute">{records.length - bad} clean records{bad ? `, ${bad} flagged incomplete (kept, with the reason)` : ", none flagged"}. Duplicates are skipped by stable key.</p>
        </section>
      )}

      <section>
        <h2 className="label mb-3">Run history</h2>
        <div className="space-y-2">
          {runs.map((r) => (
            <details key={r.id} className="card">
              <summary className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{headline(r)}</div>
                  <div className="mono mt-0.5 text-xs text-mute">{when(r.startedAt)} · {r.mode} · {(r as unknown as { engine?: string }).engine === "agent" ? "TinyFish Agent" : "browser script"}</div>
                </div>
                <div className="flex items-center gap-3">
                  {r.diff && <span className="mono hidden text-xs text-mute sm:inline">+{r.diff.new} ~{r.diff.updated} ={r.diff.unchanged}</span>}
                  <Pill status={r.status} />
                </div>
              </summary>
              <div className="border-t border-line p-4">
                <RunReport run={r} cols={portal.columns} total={0} compact />
                <p className="mono mt-3 break-all text-[11px] text-mute">{r.id.startsWith("local-") ? "local run id" : "TinyFish run id"}: {r.id}</p>
              </div>
            </details>
          ))}
          {loaded && !runs.length && <div className="card px-4 py-8 text-center text-sm text-mute">No runs yet.</div>}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="label">Records {records.length ? `· ${shown.length}${shown.length !== records.length ? ` of ${records.length}` : ""}` : ""}</h2>
          {records.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <input aria-label="Search records" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="input !w-44 !py-1.5" />
              {(["all", "new", "flagged"] as const).map((k) => (
                <button key={k} onClick={() => setOnly(k)} aria-pressed={only === k}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${only === k ? "border-ink bg-ink text-bg" : "border-line bg-surface hover:bg-bg"}`}>
                  {k === "all" ? "All" : k === "new" ? "New in last run" : `Flagged ${bad}`}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="card max-h-[30rem] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b border-line bg-surface font-mono text-[11px] uppercase tracking-wide text-mute">
              <tr>{[...portal.columns.map((c) => c.label), "Flag"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2.5 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.slice(0, 500).map((r) => (
                <tr key={r.key} className="hover:bg-bg/60">
                  {portal.columns.map((c, i) => (
                    <td key={c.key} className="mono px-3 py-2 text-[13px]">
                      {String(r[c.key] ?? "")}
                      {i === 0 && latestOk && r.firstRun === latestOk.id && runs.filter((x) => x.status === "completed" || x.status === "partial").length > 1 && <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">new</span>}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-xs text-warn">{r.issues.join("; ")}</td>
                </tr>
              ))}
              {loaded && !shown.length && <tr><td colSpan={portal.columns.length + 1} className="px-3 py-8 text-center text-mute">{records.length ? "No records match." : "No records collected yet."}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="border-t border-line pt-6">
        <button onClick={wipe} className="btn-danger">Delete this portal&apos;s data</button>
      </div>
    </div>
  );
}
