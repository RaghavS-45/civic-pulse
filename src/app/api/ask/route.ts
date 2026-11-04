import { NextResponse } from "next/server";
import { askQuestion, MAX_QUESTION_CHARS } from "@/qa";
import { toLocale } from "@/lib/i18n";
import { getScheme } from "@/lib/schemes";
import { rateLimited, readSourceText, serverLLM } from "@/lib/server-ai";
import { SchemeSchema } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST { question, lang, schemeId } for a verified scheme, or { question, lang, scheme, sourceText } for an uploaded one.
// The answer must quote the official text; quotes are checked word for word before they are returned.
export async function POST(req: Request) {
  const llm = serverLLM();
  if (!llm) return NextResponse.json({ error: "AI features are not configured on this server." }, { status: 503 });
  if (rateLimited(req, 10)) return NextResponse.json({ error: "Too many questions. Please wait a minute." }, { status: 429 });

  const body = await req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question || question.length > MAX_QUESTION_CHARS) return NextResponse.json({ error: `Ask a question of up to ${MAX_QUESTION_CHARS} characters.` }, { status: 400 });
  const lang = toLocale(body?.lang) === "hi" ? "hi" : "en";

  let scheme, sourceText: string | null;
  if (typeof body?.schemeId === "string") {
    scheme = getScheme(body.schemeId);
    sourceText = scheme ? await readSourceText(scheme.id) : null;
  } else {
    const parsed = SchemeSchema.safeParse(body?.scheme);
    scheme = parsed.success ? parsed.data : undefined;
    sourceText = typeof body?.sourceText === "string" ? body.sourceText.slice(0, 100_000) : null;
  }
  if (!scheme || !sourceText) return NextResponse.json({ error: "Scheme or its source text not found." }, { status: 404 });

  try {
    return NextResponse.json(await askQuestion({ question, scheme, sourceText, lang, llm }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const busy = /503|overloaded|high demand|UNAVAILABLE|429|quota/i.test(msg);
    return NextResponse.json({ error: busy ? "The AI service is busy right now. Please try again in a minute." : "Could not answer that. Please try rephrasing." }, { status: busy ? 503 : 502 });
  }
}
