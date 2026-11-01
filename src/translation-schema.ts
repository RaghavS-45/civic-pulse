import { z } from "zod";
import type { Scheme } from "./types";

// Arrays are index-aligned with the scheme. sourceClause quotes are never translated
export const SchemeTranslationSchema = z.object({
  schemeId: z.string(),
  lang: z.string().min(2),
  title: z.string().min(1),
  issuingAuthority: z.string().min(1),
  summary: z.string().min(1),
  realWorldImpact: z.string().min(1),
  benefits: z.array(z.string().min(1)),
  eligibility: z.array(z.string().min(1)),
  exclusions: z.array(z.string().min(1)),
  documentsRequired: z.array(z.string().min(1)),
  deadlines: z.array(z.string().min(1)),
  steps: z.array(z.string().min(1)),
  // Display labels for option values, e.g. occupation "tailor" -> "दर्जी"
  optionLabels: z.record(z.string(), z.string()).default({}),
});
export type SchemeTranslation = z.infer<typeof SchemeTranslationSchema>;

export function translationSource(s: Scheme) {
  const optionValues = s.eligibility.flatMap((r) => (Array.isArray(r.value) && r.field === "occupation" ? r.value.map(String) : []));
  return {
    title: s.title,
    issuingAuthority: s.issuingAuthority,
    summary: s.summary,
    realWorldImpact: s.realWorldImpact,
    benefits: s.benefits.map((b) => b.description),
    eligibility: s.eligibility.map((r) => r.label ?? ""),
    exclusions: s.exclusions.map((e) => e.description),
    documentsRequired: s.documentsRequired,
    deadlines: s.deadlines.map((d) => d.description),
    steps: s.howToApply.steps,
    optionLabels: Object.fromEntries(optionValues.map((v) => [v, v])),
  };
}

export function translationMismatches(s: Scheme, t: SchemeTranslation): string[] {
  const src = translationSource(s);
  const issues: string[] = [];
  for (const k of ["benefits", "eligibility", "exclusions", "documentsRequired", "deadlines", "steps"] as const) {
    if (t[k].length !== src[k].length) issues.push(`${k}: expected ${src[k].length} items, got ${t[k].length}`);
  }
  for (const v of Object.keys(src.optionLabels)) if (!t.optionLabels[v]) issues.push(`optionLabels missing "${v}"`);
  return issues;
}

export function applyTranslation(s: Scheme, t: SchemeTranslation): Scheme {
  const issues = translationMismatches(s, t);
  if (issues.length) throw new Error(`Translation ${t.schemeId}.${t.lang} does not match the scheme: ${issues.join("; ")}`);
  return {
    ...s,
    title: t.title,
    issuingAuthority: t.issuingAuthority,
    summary: t.summary,
    realWorldImpact: t.realWorldImpact,
    benefits: s.benefits.map((b, i) => ({ ...b, description: t.benefits[i]! })),
    eligibility: s.eligibility.map((r, i) => ({ ...r, label: t.eligibility[i] || r.label })),
    exclusions: s.exclusions.map((e, i) => ({ ...e, description: t.exclusions[i]! })),
    documentsRequired: t.documentsRequired,
    deadlines: s.deadlines.map((d, i) => ({ ...d, description: t.deadlines[i]! })),
    howToApply: { ...s.howToApply, steps: t.steps },
  };
}
