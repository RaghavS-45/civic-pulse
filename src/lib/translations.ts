import { SchemeTranslationSchema, applyTranslation, type SchemeTranslation } from "../translation-schema";
import type { Scheme } from "../types";
import type { Locale } from "./i18n";
import { getScheme, SCHEMES } from "./schemes";
import csssHi from "../../data/i18n/central-sector-scholarship.hi.json";
import pmvHi from "../../data/i18n/pm-vishwakarma.hi.json";
import pmkHi from "../../data/i18n/pm-kisan.hi.json";
import apyHi from "../../data/i18n/atal-pension-yojana.hi.json";
import ssyHi from "../../data/i18n/sukanya-samriddhi.hi.json";

// Only reviewed translations go here
const REVIEWED = [csssHi, pmvHi, pmkHi, apyHi, ssyHi].map((t) => SchemeTranslationSchema.parse(t));

const byKey = new Map<string, SchemeTranslation>(REVIEWED.map((t) => [`${t.schemeId}.${t.lang}`, t]));

export interface LocalizedScheme {
  scheme: Scheme;
  optionLabels: Record<string, string>;
  locale: Locale;
}

export function localize(scheme: Scheme, locale: Locale): LocalizedScheme {
  const t = locale === "en" ? undefined : byKey.get(`${scheme.id}.${locale}`);
  if (!t) return { scheme, optionLabels: {}, locale: "en" };
  return { scheme: applyTranslation(scheme, t), optionLabels: t.optionLabels, locale };
}

export function getLocalizedScheme(id: string, locale: Locale): LocalizedScheme | undefined {
  const s = getScheme(id);
  return s ? localize(s, locale) : undefined;
}

export function localizedSchemes(locale: Locale): LocalizedScheme[] {
  return SCHEMES.map((s) => localize(s, locale));
}
