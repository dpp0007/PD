import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Change, Diff, Stored } from "./sync";

// ponytail: single-user local JSON file. Swap for Supabase using db/schema.sql (RLS per user) before multi-user/hosting.
export type RunRec = {
  id: string; // TinyFish run id
  portal: string;
  engine?: "agent" | "script";
  mode: "full" | "incremental";
  status: "running" | "completed" | "partial" | "failed" | "cancelled";
  startedAt: string; finishedAt?: string;
  found?: number; diff?: Diff; changes?: Change[]; scope?: string; error?: string; notes?: string; steps?: number;
  streamingUrl?: string; ingested?: boolean; profileId?: string;
};
export type DB = { runs: RunRec[]; records: Record<string, Stored> }; // records keyed by portal slug

const FILE = path.join(process.cwd(), "data", "store.json");
export const load = (): DB => {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (d.attendance) { d.records = { ...(d.records ?? {}), "galgotias-erp": d.attendance }; delete d.attendance; } // migrate v1
    for (const r of d.runs ?? []) r.portal ??= "galgotias-erp";
    return { runs: d.runs ?? [], records: d.records ?? {} };
  } catch { return { runs: [], records: {} }; }
};
export const save = (db: DB) => {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
};
export const wipe = (portal?: string) => {
  if (!portal) return fs.rmSync(FILE, { force: true });
  const db = load();
  db.runs = db.runs.filter((r) => r.portal !== portal);
  delete db.records[portal];
  save(db);
};
