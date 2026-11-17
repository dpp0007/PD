import Link from "next/link";
import { Logo } from "@/components/ui";
import { PORTALS, status } from "@/lib/portals";

const HARD = [
  ["Logins that fight back", "Authenticator codes from your own 1Password, SMS codes you type once. No passwords in code, ever."],
  ["Menus, filters, long histories", "It clicks the portal's own menus, walks every month and page, and stops with a clear reason if something blocks it."],
  ["Only what's new", "Every record gets a stable key. Re-run and you see exactly what's new, what changed and what was left alone."],
  ["Clean on arrival", "Consistent fields, normalized dates and money, duplicates skipped, bad rows flagged with a reason instead of dropped."],
];
const SAFETY = [
  "Only your own accounts. Read-only: it never pays, edits or deletes.",
  "Passwords and authenticator secrets are never stored by PortalDump.",
  "Temporary sign-in sessions are deleted the moment a run ends or is cancelled.",
  "You give explicit consent before every export, and can cancel mid-run.",
  "Delete one portal's data, or everything, any time.",
];
const TREE = [
  ["PortalDump_Export/", "", 0],
  ["manifest.json", "counts · status · errors · schema", 1],
  ["records/", "", 1],
  ["attendance.csv", "one row per lecture slot", 2],
  ["attendance.json", "same records, typed", 2],
  ["documents/", "files the portal holds", 1],
  ["metadata/export_summary.json", "every run, what changed", 1],
] as const;

export default function Landing() {
  const verified = PORTALS.filter((p) => p.verified).length;
  return (
    <>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-6 text-sm text-mute">
          <a href="#hard" className="hidden hover:text-ink sm:inline">What it handles</a>
          <a href="#safety" className="hidden hover:text-ink sm:inline">Safety</a>
          <Link href="/app" className="btn-ghost !py-1.5">Open app</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-12 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
          <div>
            <p className="label">The export button the portal should have shipped</p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">Get my data <span className="text-hot">out.</span></h1>
            <p className="mt-6 max-w-xl text-lg text-mute">
              Your records are stuck behind portals with no export button. PortalDump signs in as you, clicks through, and hands back a clean CSV and JSON, then next time only what&apos;s new.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/app/portals" className="btn-hot !px-5 !py-2.5">Start exporting</Link>
              <Link href="/app/portals" className="btn-ghost !px-5 !py-2.5">Explore portals</Link>
            </div>
            <p className="mt-6 max-w-md text-sm text-mute">
              Honest status: {verified} portal{verified === 1 ? "" : "s"} verified, {PORTALS.filter((p) => p.available).length} available to try. A portal is only called verified after a real test on a real account.
            </p>
          </div>

          <div className="card overflow-hidden shadow-[8px_8px_0_0_var(--color-ink)]" aria-label="Example export structure">
            <div className="flex items-center justify-between border-b border-line bg-bg px-4 py-2.5">
              <span className="label">What you get</span>
              <span className="mono text-[11px] text-mute">structure, not real data</span>
            </div>
            <ul className="mono space-y-1.5 px-5 py-5 text-[13px]">
              {TREE.map(([name, note, depth]) => (
                <li key={name} className="flex flex-wrap items-baseline gap-x-3" style={{ paddingLeft: depth * 18 }}>
                  <span className={name.endsWith("/") ? "font-semibold" : ""}><span className="text-mute">{name.endsWith("/") ? "▸ " : "· "}</span>{name}</span>
                  {note && <span className="text-xs text-mute">{note}</span>}
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-3 divide-x divide-line border-t border-line text-center">
              {[["new", "text-accent"], ["updated", "text-hot"], ["unchanged", "text-ink"]].map(([k, c]) => (
                <div key={k} className="px-2 py-3"><div className={`mono text-sm font-semibold ${c}`}>{k}</div><div className="text-[11px] text-mute">reported every run</div></div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-3">
            {[["01", "Connect", "Pick a portal. You sign in with your own account; codes come from your password manager or your phone."],
              ["02", "Collect", "A TinyFish cloud browser opens the portal and reads your records page by page, with real progress and a Cancel button."],
              ["03", "Own it", "Download one ZIP: CSV, JSON and a manifest. Run again any time to pick up only what's new."]].map(([n, t, d]) => (
              <div key={n}>
                <div className="mono text-sm text-hot">{n}</div>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">{t}</h2>
                <p className="mt-2 text-sm leading-relaxed text-mute">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="hard" className="mx-auto max-w-6xl px-6 py-16">
          <p className="label">Built for the hard parts</p>
          <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
            {HARD.map(([t, d]) => (
              <div key={t} className="bg-surface p-6">
                <h3 className="font-semibold">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mute">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16">
          <p className="label">Portals</p>
          <div className="card mt-5 divide-y divide-line">
            {PORTALS.map((p) => (
              <div key={p.slug} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="font-medium">{p.name}</div>
                  <div className="truncate text-sm text-mute">{p.category} · {p.dataTypes.join(", ")}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${p.verified ? "bg-emerald-100 text-emerald-800" : p.available ? "bg-warn-soft text-warn" : "border border-line text-mute"}`}>{p.verified ? "✓ " : ""}{status(p)}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="safety" className="border-t border-line bg-ink text-bg">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
            <div>
              <p className="label !text-bg/60">Safety</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">Your data stays yours, start to finish.</h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-bg/70">For retrieving your own information from accounts you own, where the portal&apos;s rules allow it. It never bypasses CAPTCHAs or security checks.</p>
            </div>
            <ul className="space-y-3.5 text-sm">
              {SAFETY.map((t) => <li key={t} className="flex gap-3"><span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-hot" />{t}</li>)}
            </ul>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-sm text-mute">
        <Logo />
        <span>Connect your portal. Collect your records. Own your data.</span>
      </footer>
    </>
  );
}
