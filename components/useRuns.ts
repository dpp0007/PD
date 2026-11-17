"use client";
import { useCallback, useEffect, useState } from "react";

export type Run = {
  id: string; portal: string; mode: string; status: string; startedAt: string; finishedAt?: string;
  found?: number; steps?: number; error?: string; notes?: string; streamingUrl?: string;
  diff?: { new: number; updated: number; unchanged: number; failed: number; duplicates: number };
};
export type Rec = Record<string, unknown> & { portal: string; key: string; status: string; issues: string[] };

// Polls the real /api/runs (which itself polls TinyFish) every 5s while any run is active.
export function useRuns(portal?: string) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [records, setRecords] = useState<Rec[]>([]);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch("/api/runs" + (portal ? `?portal=${portal}` : "")).then((x) => x.json()).catch(() => null);
    if (r) { setRuns(r.runs); setRecords(r.records); setLoaded(true); }
  }, [portal]);
  const active = runs.some((r) => r.status === "running");
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [active, load]);
  return { runs, records, loaded, active, reload: load };
}
