import { NextResponse } from "next/server";
import { z } from "zod";
import { ENGINES } from "@/lib/engines";
import { launch } from "@/lib/runs";
import { cancelSmsLogin, finishSmsLogin, startSmsLogin } from "@/services/tinyfish/sms-login";

// SMS-code portals. Mobile number and code are used once and never stored or logged.
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), portal: z.string(), consent: z.literal(true), mobile: z.string().regex(/^\+?[0-9 ]{8,15}$/) }),
  z.object({ action: z.literal("verify"), portal: z.string(), connectId: z.string(), otp: z.string().regex(/^[0-9]{4,8}$/), mode: z.enum(["full", "incremental"]).default("incremental") }),
  z.object({ action: z.literal("cancel"), connectId: z.string() }),
]);

export async function POST(req: Request) {
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "Invalid request (consent, mobile number or code format)." }, { status: 400 });
  try {
    if (b.data.action === "cancel") { await cancelSmsLogin(b.data.connectId); return NextResponse.json({ ok: true }); }
    const e = ENGINES[b.data.portal];
    if (!e || e.auth !== "sms") return NextResponse.json({ error: "Portal does not use SMS sign-in." }, { status: 400 });
    if (b.data.action === "start") {
      const connectId = await startSmsLogin(e.loginUrl()!, b.data.mobile.replace(/\s/g, ""), e.proxy);
      return NextResponse.json({ connectId });
    }
    const profile = await finishSmsLogin(b.data.connectId, b.data.otp);
    return NextResponse.json({ id: await launch(b.data.portal, b.data.mode, profile) });
  } catch (err) { return NextResponse.json({ error: (err as Error).message }, { status: 502 }); }
}
