import { NextResponse } from "next/server";
import { toLocale } from "@/lib/i18n";
import { clauseCount } from "@/lib/schemes";
import { localizedSchemes } from "@/lib/translations";

export function GET(req: Request) {
  const locale = toLocale(new URL(req.url).searchParams.get("lang"));
  return NextResponse.json(
    localizedSchemes(locale).map(({ scheme: s, locale: l }) => ({
      id: s.id,
      locale: l,
      title: s.title,
      issuingAuthority: s.issuingAuthority,
      summary: s.summary,
      sourceUrl: s.sourceUrl,
      citedClauses: clauseCount(s),
      audioUrl: `/audio/${s.id}.${l}.mp3`,
    })),
  );
}
