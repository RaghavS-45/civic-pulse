import { NextResponse } from "next/server";
import { toLocale } from "@/lib/i18n";
import { buildQuestions } from "@/lib/questions";
import { getLocalizedScheme } from "@/lib/translations";

// GET ?lang=hi returns the translated scheme; sourceClause quotes always stay in the original English
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const l = getLocalizedScheme((await params).id, toLocale(new URL(req.url).searchParams.get("lang")));
  if (!l) return NextResponse.json({ error: "Scheme not found" }, { status: 404 });
  return NextResponse.json({ locale: l.locale, scheme: l.scheme, questions: buildQuestions(l.scheme, l.locale, l.optionLabels) });
}
