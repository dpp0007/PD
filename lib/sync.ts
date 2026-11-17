import { createHash } from "node:crypto";
import { z } from "zod";

// Shape the agent is asked to return (see scripts/slice.ts GOAL). Unknown extra keys are ignored.
export const AttendanceResult = z.object({
  loggedIn: z.boolean(),
  blocker: z.string().nullable().optional(),
  sectionsSeen: z.array(z.string()).optional(),
  attendance: z.array(z.record(z.unknown())).default([]),
  pagesVisited: z.number().optional(),
  complete: z.boolean().optional(),
  notes: z.string().optional(),
});

export type NormRecord = {
  key: string; // stable composite id: never timestamp-only
  hash: string;
  status: "valid" | "incomplete";
  issues: string[];
  data: Record<string, unknown>; // normalized + `source` (original values preserved)
};

const s = (v: unknown) => (v == null ? null : String(v).replace(/\s+/g, " ").trim() || null);

// Accepts 2025-01-31, 31/01/2025, 31-01-2025, 31 Jan 2025 -> ISO date; else null (original kept in source).
export function normDate(v: unknown): string | null {
  const t = s(v);
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(t + " UTC");
  return isNaN(+d) ? null : d.toISOString().slice(0, 10);
}

const STATUS: Record<string, string> = { P: "P", PRESENT: "P", A: "A", ABSENT: "A" };

// One record per (date, lecture slot): the ERP's Day Wise Attendance grid. Course name is data, not part of the key.
export function normAttendance(row: Record<string, unknown>): NormRecord {
  const date = normDate(row.date), slot = s(row.slot), course = s(row.course);
  const raw = s(row.status), status = raw ? (STATUS[raw.toUpperCase()] ?? raw) : null;
  const issues: string[] = [];
  if (!date) issues.push(row.date == null ? "missing date" : `unparseable date: ${String(row.date)}`);
  if (!slot) issues.push("missing lecture slot");
  if (!status) issues.push("missing status");
  const data = { date, slot, course, status, source: row };
  // Keyless rows get a content-hash key so they are kept and flagged, never merged or dropped.
  const key = date && slot ? `${date}|${slot}` : `UNPARSED|${createHash("sha256").update(JSON.stringify(row)).digest("hex").slice(0, 16)}`;
  const { source: _s, ...cmp } = data;
  return { key, hash: createHash("sha256").update(JSON.stringify(cmp)).digest("hex"), status: issues.length ? "incomplete" : "valid", issues, data };
}

export type Stored = Record<string, { hash: string; data: Record<string, unknown>; status: string; issues: string[]; firstRun: string; lastRun: string }>;
export type Change = { key: string; kind: "new" | "updated"; before?: Record<string, unknown>; after: Record<string, unknown> };
export type Diff = { new: number; updated: number; unchanged: number; failed: number; duplicates: number };

// Pure: applies records to the store (mutates `store`), returns what changed.
export function applySync(store: Stored, recs: NormRecord[], runId: string, log?: Change[]): Diff {
  const d: Diff = { new: 0, updated: 0, unchanged: 0, failed: 0, duplicates: 0 };
  const seen = new Set<string>();
  for (const r of recs) {
    if (seen.has(r.key)) { d.duplicates++; continue; }
    seen.add(r.key);
    if (r.status === "incomplete") d.failed++; // kept and flagged, never dropped
    const old = store[r.key];
    if (!old) { store[r.key] = { hash: r.hash, data: r.data, status: r.status, issues: r.issues, firstRun: runId, lastRun: runId }; if (r.status === "valid") d.new++; log?.push({ key: r.key, kind: "new", after: r.data }); }
    else if (old.hash !== r.hash) { log?.push({ key: r.key, kind: "updated", before: old.data, after: r.data }); store[r.key] = { ...old, hash: r.hash, data: r.data, status: r.status, issues: r.issues, lastRun: runId }; d.updated++; }
    else { old.lastRun = runId; if (r.status === "valid") d.unchanged++; }
  }
  return d;
}
