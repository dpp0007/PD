"use client";
import Link from "next/link";
import { Pill, Stat, when } from "@/components/ui";
import { useRuns } from "@/components/useRuns";
import { PORTALS, bySlug } from "@/lib/portals";
import { headline } from "@/components/RunReport";

export default function Dashboard() {
  const { runs, records, loaded } = useRuns();
  const last = runs.find((r) => r.status === "completed" || r.status === "partial");
  const used = PORTALS.filter((p) => runs.some((r) => r.portal === p.slug));
  const failed = runs.filter((r) => r.status === "failed" || r.status === "partial").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-mute">Everything PortalDump has collected for you, in one place.</p>
        </div>
        <Link href="/app/portals" className="btn-hot">Connect a portal</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Records exported" value={loaded ? records.length : "–"} />
        <Stat label="Documents" value={0} hint="not collected yet" />
        <Stat label="Incomplete or failed" value={loaded ? failed : "–"} />
        <Stat label="Last sync" value={last?.finishedAt ? when(last.finishedAt) : "Never"} />
      </div>

      <section>
        <h2 className="label mb-3">Your portals</h2>
        {loaded && !used.length ? (
          <div className="card p-8 text-center">
            <p className="font-medium">Nothing connected yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-mute">Choose a portal, give consent, and your first export will appear here.</p>
            <Link href="/app/portals" className="btn-primary mt-5">Browse portals</Link>
          </div>
        ) : (
          <div className="card divide-y divide-line">
            {used.map((p) => {
              const mine = runs.filter((r) => r.portal === p.slug);
              const n = records.filter((r) => r.portal === p.slug).length;
              return (
                <Link key={p.slug} href={`/app/portals/${p.slug}`} className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-bg">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-mute">{n} records · {headline(mine[0])} · {when(mine[0].startedAt)}</div>
                  </div>
                  <Pill status={mine[0].status} />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="label mb-3">Recent activity</h2>
        <div className="card divide-y divide-line">
          {runs.slice(0, 8).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <span className="font-medium">{bySlug(r.portal)?.name ?? r.portal}</span>
                <span className="text-mute"> · {r.mode} · {when(r.startedAt)}</span>
                {r.error && <div className="mt-0.5 max-w-xl truncate text-xs text-mute" title={r.error}>{r.error}</div>}
              </div>
              <Pill status={r.status} />
            </div>
          ))}
          {loaded && !runs.length && <div className="px-4 py-6 text-sm text-mute">No activity yet.</div>}
        </div>
      </section>
    </div>
  );
}
