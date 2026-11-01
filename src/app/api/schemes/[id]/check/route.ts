import { NextResponse } from "next/server";
import { z } from "zod";
import { toLocale } from "@/lib/i18n";
import { checkAndPlan } from "@/lib/plan";
import { getLocalizedScheme } from "@/lib/translations";
import { UserProfileSchema } from "@/types";

// POST { profile: UserProfile, lang?: "en" | "hi" } -> verdict, rule-by-rule trace with citations, action plan. No LLM involved.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await req.json().catch(() => null);
  const l = getLocalizedScheme((await params).id, toLocale(body?.lang));
  if (!l) return NextResponse.json({ error: "Scheme not found" }, { status: 404 });

  const parsed = UserProfileSchema.safeParse(body?.profile ?? {});
  if (!parsed.success) return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });

  return NextResponse.json(checkAndPlan(l.scheme, parsed.data, l.locale, l.optionLabels));
}
