import { NextResponse } from "next/server";
import { z } from "zod";
import { startInspection, InspectionSchema } from "@/services/tinyfish/inspect-portal";
import { getRun } from "@/services/tinyfish/client";

const Body = z.object({ url: z.string().url().refine((u) => u.startsWith("https://"), "https only") });

// TODO(auth): require a Supabase session before exposing beyond local dev.
export async function POST(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: b.error.issues[0].message }, { status: 400 });
  try {
    return NextResponse.json(await startInspection(b.data.url));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("run_id");
  if (!id) return NextResponse.json({ error: "run_id required" }, { status: 400 });
  try {
    const run = await getRun(id);
    const parsed = run.status === "COMPLETED" ? InspectionSchema.safeParse(run.result) : null;
    return NextResponse.json({
      run,
      inspection: parsed?.success ? parsed.data : null,
      unverified: parsed && !parsed.success ? "Agent result did not match the expected shape; treat as unverified." : undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
