import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { toLocale } from "@/lib/i18n";
import { buildQuestions } from "@/lib/questions";
import { getLocalizedScheme } from "@/lib/translations";
import SchemeFlow from "./SchemeFlow";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const l = getLocalizedScheme((await params).id, toLocale((await searchParams).lang));
  return { title: l ? `${l.scheme.title} · Civic Pulse` : "Scheme not found" };
}

export default async function SchemePage({ params, searchParams }: Props) {
  const l = getLocalizedScheme((await params).id, toLocale((await searchParams).lang));
  if (!l) notFound();
  return (
    <SchemeFlow
      key={l.locale}
      scheme={l.scheme}
      locale={l.locale}
      optionLabels={l.optionLabels}
      questions={buildQuestions(l.scheme, l.locale, l.optionLabels)}
    />
  );
}
