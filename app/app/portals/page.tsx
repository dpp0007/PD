import Link from "next/link";
import { PORTALS, status } from "@/lib/portals";
import InspectForm from "@/components/InspectForm";

export default function Portals() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portals</h1>
        <p className="mt-1 text-sm text-mute">Choose where your data lives. A portal is only called verified after a real test on a real account.</p>
      </div>

      <section aria-label="Supported portals" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PORTALS.map((p) => {
          const inner = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="mt-0.5 text-sm text-mute">{p.category} · {p.site}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${p.verified ? "bg-emerald-100 text-emerald-800" : p.available ? "bg-warn-soft text-warn" : "border border-line text-mute"}`}>{p.verified ? "✓ " : ""}{status(p)}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.dataTypes.map((d) => <span key={d} className="rounded border border-line px-2 py-0.5 text-xs text-mute">{d}</span>)}
              </div>
              {p.available && <div className="mt-4 text-sm font-medium text-accent">Open →</div>}
            </>
          );
          return p.available ? (
            <Link key={p.slug} href={`/app/portals/${p.slug}`} className="card p-4 transition-colors hover:border-ink/30">{inner}</Link>
          ) : (
            <div key={p.slug} className="card p-4 opacity-60">{inner}</div>
          );
        })}
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Add a custom portal</h2>
        <p className="mt-1 max-w-2xl text-sm text-mute">
          Paste a login page address. PortalDump will look at the public sign-in page only (no credentials, nothing submitted) and report what it finds. Extraction for custom portals is not available yet.
        </p>
        <InspectForm />
      </section>
    </div>
  );
}
