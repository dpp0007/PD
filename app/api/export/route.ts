import { zipSync, strToU8 } from "fflate";
import { load } from "@/lib/store";
import { bySlug } from "@/lib/portals";

const csv = (rows: Record<string, unknown>[], cols: string[]) =>
  [cols.join(","), ...rows.map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("portal") ?? "";
  const portal = bySlug(slug);
  if (!portal) return new Response("Unknown portal.", { status: 400 });
  const db = load();
  const stored = db.records[slug] ?? {};
  const rows = Object.entries(stored).map(([id, v]) => ({ record_key: id, record_status: v.status, issues: v.issues.join("; "), ...v.data, source: undefined }));
  if (!rows.length) return new Response("Nothing to export yet.", { status: 404 }); // no empty/fabricated files
  const cols = ["record_key", "record_status", "issues", ...portal.columns.map((c) => c.key).filter((k, i, a) => a.indexOf(k) === i)];
  const runs = db.runs.filter((r) => r.portal === slug);
  const last = runs.find((r) => r.status === "completed" || r.status === "partial");
  const name = portal.dataTypes[0].toLowerCase();
  const root = "PortalDump_Export";
  const manifest = {
    portal: portal.name, schema_version: 1, exported_at: new Date().toISOString(),
    categories: { [name]: { records: rows.length, incomplete: rows.filter((r) => r.record_status === "incomplete").length } },
    documents: 0, // TinyFish documents no file-download API; none collected
    completion_status: last?.status ?? "unknown", last_run: last?.id,
    extraction_errors: runs.filter((r) => r.error).map((r) => ({ run: r.id, error: r.error })),
  };
  const zip = zipSync({
    [`${root}/manifest.json`]: strToU8(JSON.stringify(manifest, null, 2)),
    [`${root}/records/${name}.csv`]: strToU8(csv(rows, cols)),
    [`${root}/records/${name}.json`]: strToU8(JSON.stringify(rows.map(({ source, ...r }) => r), null, 2)),
    [`${root}/metadata/export_summary.json`]: strToU8(JSON.stringify(runs, null, 2)),
  });
  return new Response(zip, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="PortalDump_${slug}.zip"` } });
}
