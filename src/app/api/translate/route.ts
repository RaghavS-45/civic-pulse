import { NextResponse } from "next/server";
import { rateLimited, serverLLM } from "@/lib/server-ai";
import { translateScheme } from "@/translate";
import { SchemeSchema } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

// POST { scheme } -> Hindi translation of an uploaded scheme's display text (rules and quotes unchanged)
export async function POST(req: Request) {
  const llm = serverLLM();
  if (!llm) return NextResponse.json({ error: "AI features are not configured on this server." }, { status: 503 });
  if (rateLimited(req, 4)) return NextResponse.json({ error: "Too many requests. Please wait a minute." }, { status: 429 });
  const body = await req.json().catch(() => null);
  const scheme = SchemeSchema.safeParse(body?.scheme);
  if (!scheme.success) return NextResponse.json({ error: "Invalid scheme" }, { status: 400 });
  try {
    return NextResponse.json(await translateScheme(scheme.data, "hi", llm));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const busy = /503|overloaded|high demand|UNAVAILABLE|429|quota/i.test(msg);
    return NextResponse.json({ error: busy ? "The AI service is busy right now. Please try again in a minute." : "Translation failed. Please try again." }, { status: busy ? 503 : 502 });
  }
}
