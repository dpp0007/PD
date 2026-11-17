import Link from "next/link";

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="#15130f" />
      <path d="M14 34V22a10 10 0 0 1 20 0v12" stroke="#f6f2e8" strokeWidth="3.6" strokeLinecap="round" />
      <path d="M24 18v10M19 23h10" stroke="#ff5a1f" strokeWidth="3.6" strokeLinecap="round" />
      <path d="M11 38h26" stroke="#f6f2e8" strokeWidth="3.6" strokeLinecap="round" opacity=".45" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="PortalDump home">
      <Mark />
      <span className="text-[17px] font-semibold tracking-tight">Portal<span className="text-hot">Dump</span></span>
    </Link>
  );
}

const PILL: Record<string, string> = {
  completed: "bg-accent-soft text-accent",
  running: "bg-warn-soft text-warn",
  partial: "bg-warn-soft text-warn",
  failed: "bg-bad-soft text-bad",
  cancelled: "border border-line bg-bg text-mute",
};
export function Pill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${PILL[status] ?? "bg-bg text-mute"}`}>
      {status === "running" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />}
      {status}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="mono mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-mute">{hint}</div>}
    </div>
  );
}

export const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "–");
