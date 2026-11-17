"use client";
import { useState } from "react";

type Insp = { loginPageFound: boolean; fields: string[]; otp: boolean; totp: boolean; captcha: boolean; sso: string[]; notes?: string };

export default function InspectForm() {
  const [state, setState] = useState<{ phase: "idle" | "running" | "done" | "error"; msg?: string; insp?: Insp | null; steps?: number }>({ phase: "idle" });

  async function go(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const url = String(new FormData(e.currentTarget).get("url"));
    setState({ phase: "running", msg: "Starting inspection…" });
    const s = await fetch("/api/inspect", { method: "POST", body: JSON.stringify({ url }) }).then((r) => r.json());
    if (s.error) return setState({ phase: "error", msg: s.error });
    for (;;) { // real polling of the TinyFish run
      const r = await fetch("/api/inspect?run_id=" + s.run_id).then((x) => x.json());
      if (r.error) return setState({ phase: "error", msg: r.error });
      const st = r.run.status as string;
      setState({ phase: "running", msg: `Inspecting… (${st.toLowerCase()})`, steps: r.run.num_of_steps });
      if (st === "COMPLETED") return setState({ phase: "done", insp: r.inspection, msg: r.unverified });
      if (st === "FAILED" || st === "CANCELLED") return setState({ phase: "error", msg: r.run.error?.message ?? st });
      await new Promise((res) => setTimeout(res, 3000));
    }
  }

  const i = state.insp;
  const yes = (b: boolean) => (b ? "Detected" : "Not seen");
  return (
    <div className="mt-4">
      <form onSubmit={go} className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="url">Portal login URL</label>
        <input id="url" name="url" type="url" required placeholder="https://portal.example.com/login" className="input" />
        <button disabled={state.phase === "running"} className="btn-primary shrink-0">{state.phase === "running" ? "Inspecting…" : "Inspect portal"}</button>
      </form>
      <div aria-live="polite" className="mt-3 text-sm">
        {state.phase === "running" && <p className="text-mute">{state.msg}</p>}
        {state.phase === "error" && <p className="rounded-md bg-bad-soft px-3 py-2 text-bad">{state.msg}</p>}
        {state.phase === "done" && !i && <p className="rounded-md bg-warn-soft px-3 py-2 text-warn">{state.msg ?? "The agent finished but returned nothing usable. Treat the login flow as unverified."}</p>}
        {state.phase === "done" && i && (
          <div className="rounded-md border border-line">
            <div className="border-b border-line px-4 py-2.5 font-medium">Inspection report</div>
            <dl className="divide-y divide-line">
              {[
                ["Login page", yes(i.loginPageFound)],
                ["Sign-in fields", i.fields.length ? i.fields.join(", ") : "None seen"],
                ["One-time code (SMS / email)", yes(i.otp)],
                ["Authenticator (TOTP)", yes(i.totp)],
                ["CAPTCHA", yes(i.captcha)],
                ["Single sign-on", i.sso.length ? i.sso.join(", ") : "None seen"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-2"><dt className="text-mute">{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
            <p className="border-t border-line px-4 py-2.5 text-xs text-mute">Only the public sign-in page was inspected. Data sections and downloads are unverified until you sign in.</p>
          </div>
        )}
      </div>
    </div>
  );
}
