import { NextResponse } from "next/server";
import { z } from "zod";
import { toLocale } from "@/lib/i18n";
import { checkAndPlan } from "@/lib/plan";
import { SchemeSchema, UserProfileSchema } from "@/types";

// POST { scheme, profile, lang?, optionLabels? } for a scheme that is not in the verified registry (an uploaded document).
// Same deterministic engine as /api/schemes/:id/check; the scheme is validated before use.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const scheme = SchemeSchema.safeParse(body?.scheme);
  if (!scheme.success) return NextResponse.json({ error: "Invalid scheme: " + z.prettifyError(scheme.error) }, { status: 400 });
  const profile = UserProfileSchema.safeParse(body?.profile ?? {});
  if (!profile.success) return NextResponse.json({ error: z.prettifyError(profile.error) }, { status: 400 });
  const labels = z.record(z.string(), z.string()).safeParse(body?.optionLabels ?? {});
  return NextResponse.json(checkAndPlan(scheme.data, profile.data, toLocale(body?.lang), labels.success ? labels.data : {}));
}
