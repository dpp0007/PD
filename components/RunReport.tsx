"use client";
import { Pill, when } from "./ui";
import type { Run } from "./useRuns";
import type { Col } from "@/lib/portals";

type Change = { key: string; kind: "new" | "updated"; before?: Record<string, unknown>; after: Record<string, unknown> };
const TILE = [
  ["new", "New", "text-accent"],
  ["updated", "Updated", "text-hot"],
  ["unchanged", "Unchanged", "text-ink"],
  ["failed", "Flagged", "text-bad"],
  ["duplicates", "Duplicates skipped", "text-mute"],
] as const;

export function headline(r: Run) {
  if (r.status === "running") return "Collecting…";
  if (r.status === "cancelled") return "Stopped before finishing";
  if (r.status === "failed") return "Run failed";
  if (!r.diff) return "No result";
  const { new: n, updated: u, unchanged: s } = r.diff;
  if (n + u === 0) return `Up to date: ${s} records re-checked, nothing new`;
  return `${n} new${u ? `, ${u} updated` : ""}, ${s} unchanged`;
}

const line = (o: Record<string, unknown> | undefined, cols: Col[]) => cols.map((c) => o?.[c.key]).filter((v) => v != null && v !== "").join(" · ");

export default function RunReport({ run, cols, total, compact }: { run: Run; cols: Col[]; total: number; compact?: boolean }) {
  const changes = ((run as unknown as { changes?: Change[] }).changes ?? []);
  const scope = (run as unknown as { scope?: string }).scope;
  return (
    <div className={compact ? "" : "card p-5"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="label">{compact ? "What changed" : "Latest run"}</div>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight">{headline(run)}</h3>
          <p className="mt-0.5 text-xs text-mute">
            {run.mode} · {when(run.startedAt)}{scope ? ` · ${scope}` : ""}{total ? ` · ${total} records stored in total` : ""}
          </p>
        </div>
        <Pill status={run.status} />
      </div>

      {run.diff && (
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-5">
          {TILE.map(([k, label, color]) => (
            <div key={k} className="bg-surface px-3 py-3">
              <dt className="text-xs text-mute">{label}</dt>
              <dd className={`mono mt-1 text-2xl font-semibold ${color}`}>{run.diff![k]}</dd>
            </div>
          ))}
        </dl>
      )}

      {run.error && run.status !== "completed" && <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">{run.error}</p>}

      {run.diff && run.diff.new + run.diff.updated === 0 && run.status === "completed" && (
        <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
          Nothing changed at the source since the previous export. Every record was matched by its stable key and left untouched, so no duplicates were created.
        </p>
      )}

      {changes.length > 0 && (
        <details className="mt-3 rounded-lg border border-line" open={changes.length <= 12}>
          <summary className="flex items-center justify-between px-3 py-2 text-sm font-medium">
            <span>{changes.length} change{changes.length === 1 ? "" : "s"} in this run</span>
            <span className="text-xs text-mute">show / hide</span>
          </summary>
          <ul className="max-h-72 divide-y divide-line overflow-auto border-t border-line text-sm">
            {changes.slice(0, 60).map((c) => (
              <li key={c.key} className="flex items-start gap-3 px-3 py-2">
                <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${c.kind === "new" ? "bg-accent-soft text-accent" : "bg-hot-soft text-hot"}`}>{c.kind}</span>
                <span className="min-w-0">
                  <span className="mono text-xs">{line(c.after, cols)}</span>
                  {c.kind === "updated" && <span className="mt-0.5 block text-xs text-mute">was: {line(c.before, cols)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
