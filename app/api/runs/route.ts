import { NextResponse } from "next/server";
import { z } from "zod";
import { launch, refresh } from "@/lib/runs";
import { wipe } from "@/lib/store";
import { ENGINES } from "@/lib/engines";

// TODO(auth): gate all /api routes behind a Supabase session before hosting.
export async function GET(req: Request) {
  const portal = new URL(req.url).searchParams.get("portal");
  const db = await refresh();
  const runs = portal ? db.runs.filter((r) => r.portal === portal) : db.runs;
  const records = Object.entries(db.records)
    .filter(([p]) => !portal || p === portal)
    .flatMap(([p, rows]) => Object.entries(rows).map(([key, v]) => ({ portal: p, key, status: v.status, issues: v.issues, firstRun: v.firstRun, lastRun: v.lastRun, ...v.data, source: undefined })));
  return NextResponse.json({ runs, records });
}

const Body = z.object({ portal: z.string(), consent: z.literal(true), mode: z.enum(["full", "incremental"]).default("incremental"), engine: z.enum(["agent", "script"]).default("script") });
export async function POST(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "Explicit consent is required to start extraction." }, { status: 400 });
  const e = ENGINES[b.data.portal];
  if (!e) return NextResponse.json({ error: "No extraction engine for this portal yet." }, { status: 400 });
  if (e.auth === "sms") return NextResponse.json({ error: "This portal needs you to sign in with an SMS code first." }, { status: 400 });
  try { return NextResponse.json({ id: await launch(b.data.portal, b.data.mode, undefined, b.data.engine) }); }
  catch (err) { return NextResponse.json({ error: (err as Error).message }, { status: 502 }); }
}

export async function DELETE(req: Request) {
  wipe(new URL(req.url).searchParams.get("portal") ?? undefined);
  return NextResponse.json({ ok: true });
}
