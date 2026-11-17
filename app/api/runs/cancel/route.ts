import { NextResponse } from "next/server";
import { z } from "zod";
import { cancel } from "@/lib/runs";

export async function POST(req: Request) {
  const b = z.object({ id: z.string() }).safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "id required" }, { status: 400 });
  return NextResponse.json({ cancelled: await cancel(b.data.id) });
}
