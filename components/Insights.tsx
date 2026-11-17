"use client";
import { useMemo, useState } from "react";
import type { Rec } from "./useRuns";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

// ---------- Attendance: per-day heat strip + per-month breakdown ----------
export function AttendanceInsights({ records }: { records: Rec[] }) {
  const [tip, setTip] = useState("");
  const { days, months, totals } = useMemo(() => {
    const days = new Map<string, { p: number; a: number; o: number }>();
    for (const r of records) {
      const d = String(r.date ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      const x = days.get(d) ?? { p: 0, a: 0, o: 0 };
      const s = String(r.status);
      if (s === "P") x.p++; else if (s === "A") x.a++; else x.o++;
      days.set(d, x);
    }
    const months = new Map<string, { p: number; a: number; o: number; days: [string, { p: number; a: number; o: number }][] }>();
    for (const [d, v] of [...days].sort(([a], [b]) => a.localeCompare(b))) {
      const m = months.get(d.slice(0, 7)) ?? { p: 0, a: 0, o: 0, days: [] };
      m.p += v.p; m.a += v.a; m.o += v.o; m.days.push([d, v]);
      months.set(d.slice(0, 7), m);
    }
    const totals = [...months.values()].reduce((t, m) => ({ p: t.p + m.p, a: t.a + m.a, o: t.o + m.o }), { p: 0, a: 0, o: 0 });
    return { days, months: [...months], totals };
  }, [records]);
  if (!days.size) return null;
  const all = totals.p + totals.a + totals.o;
  const cell = (v: { p: number; a: number; o: number }) => {
    const n = v.p + v.a + v.o, bad = v.a / n;
    if (v.a === 0 && v.o === 0) return "bg-accent";
    if (v.a === 0) return "bg-warn";
    return bad > 0.5 ? "bg-bad" : "bg-hot";
  };
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label">Attendance at a glance</div>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight">{days.size} class days · {all} lecture slots</h3>
        </div>
        <div className="mono flex gap-4 text-sm">
          <span className="text-accent">P {totals.p}</span><span className="text-bad">A {totals.a}</span><span className="text-warn">E {totals.o}</span>
          <span className="text-mute">{Math.round((totals.p / all) * 100)}% present</span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {months.map(([ym, m]) => {
          const n = m.p + m.a + m.o;
          return (
            <div key={ym} className="grid items-center gap-x-4 gap-y-1.5 sm:grid-cols-[6rem_1fr_9rem]">
              <div className="text-sm font-medium">{monthLabel(ym)}</div>
              <div className="flex flex-wrap gap-1" role="img" aria-label={`${monthLabel(ym)}: ${m.p} present, ${m.a} absent, ${m.o} other`}>
                {m.days.map(([d, v]) => (
                  <button key={d} type="button" onMouseEnter={() => setTip(`${d}: ${v.p} present, ${v.a} absent${v.o ? `, ${v.o} E` : ""}`)} onFocus={() => setTip(`${d}: ${v.p} present, ${v.a} absent${v.o ? `, ${v.o} E` : ""}`)}
                    title={`${d}: ${v.p} P, ${v.a} A${v.o ? `, ${v.o} E` : ""}`} className={`h-4 w-4 rounded-[4px] ${cell(v)}`} aria-label={`${d}`} />
                ))}
              </div>
              <div className="mono text-xs text-mute">
                <div className="mb-1 flex h-1.5 overflow-hidden rounded-full bg-line">
                  <span className="bg-accent" style={{ width: `${(m.p / n) * 100}%` }} /><span className="bg-warn" style={{ width: `${(m.o / n) * 100}%` }} /><span className="bg-bad" style={{ width: `${(m.a / n) * 100}%` }} />
                </div>
                {m.p}P · {m.a}A · {m.o}E · {Math.round((m.p / n) * 100)}%
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-mute">
        <div className="flex items-center gap-3">
          {[["bg-accent", "all present"], ["bg-warn", "has E"], ["bg-hot", "some absent"], ["bg-bad", "mostly absent"]].map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><i className={`inline-block h-2.5 w-2.5 rounded-[3px] ${c}`} />{l}</span>)}
        </div>
        <span className="mono min-h-4" aria-live="polite">{tip}</span>
      </div>
      <p className="mt-2 text-xs text-mute">“E” is shown exactly as the portal marks it; PortalDump does not interpret it.</p>
    </section>
  );
}

// ---------- Airtel: spend by month and type ----------
export function SpendInsights({ records }: { records: Rec[] }) {
  const { months, byType, total } = useMemo(() => {
    const months = new Map<string, number>(), byType = new Map<string, number>();
    let total = 0;
    for (const r of records) {
      const amt = Number(r.amount), d = String(r.date ?? "");
      if (!Number.isFinite(amt) || !/^\d{4}-\d{2}/.test(d)) continue;
      months.set(d.slice(0, 7), (months.get(d.slice(0, 7)) ?? 0) + amt);
      byType.set(String(r.type), (byType.get(String(r.type)) ?? 0) + amt);
      total += amt;
    }
    return { months: [...months].sort(([a], [b]) => a.localeCompare(b)), byType: [...byType], total };
  }, [records]);
  if (!months.length) return null;
  const max = Math.max(...months.map(([, v]) => v));
  return (
    <section className="card p-5">
      <div className="label">Spend at a glance</div>
      <h3 className="mono mt-1.5 text-lg font-semibold tracking-tight">{total.toLocaleString(undefined, { maximumFractionDigits: 2 })} across {records.length} entries</h3>
      <div className="mt-4 space-y-2">
        {months.map(([ym, v]) => (
          <div key={ym} className="grid grid-cols-[6rem_1fr_6rem] items-center gap-3 text-sm">
            <span>{monthLabel(ym)}</span>
            <span className="h-2 overflow-hidden rounded-full bg-line"><span className="block h-full bg-hot" style={{ width: `${(v / max) * 100}%` }} /></span>
            <span className="mono text-right text-xs">{v.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        ))}
      </div>
      <p className="mono mt-4 text-xs text-mute">{byType.map(([t, v]) => `${t} ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`).join("  ·  ")}</p>
    </section>
  );
}
