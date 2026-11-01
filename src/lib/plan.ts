import { checkEligibility, evaluateRule } from "../eligibility";
import type { EligibilityResult, Rule, Scalar, Scheme, UserProfile } from "../types";
import { UI, type Locale, type UIStrings } from "./i18n";

export interface TraceStep {
  label: string;
  outcome: "pass" | "fail" | "missing";
  required: string;
  yourAnswer: string;
  sourceClause: string;
}

export interface ActionPlan {
  headline: string;
  findOutFirst: string[];
  documents: string[];
  steps: string[];
  portalUrl?: string;
  sourceUrl: string;
  doubleCheck: { description: string; sourceClause: string }[];
  draftApplication: string;
}

export interface CheckResponse {
  schemeId: string;
  locale: Locale;
  eligible: EligibilityResult["eligible"];
  counts: { passed: number; failed: number; missing: number; total: number };
  trace: TraceStep[];
  plan: ActionPlan;
}

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

function fmt(rule: Rule, v: Scalar, t: UIStrings, optionLabels: Record<string, string>): string {
  if (rule.field === "income" && typeof v === "number") return inr(v);
  if (rule.field === "age" && typeof v === "number") return `${v} ${t.years}`;
  if (rule.field === "education" && typeof v === "string") return t.education[v as keyof UIStrings["education"]] ?? v;
  if (typeof v === "boolean") return v ? t.yes : t.no;
  if (typeof v === "string" && optionLabels[v]) return optionLabels[v]!;
  return String(v);
}

export function describeRequirement(rule: Rule, locale: Locale = "en", optionLabels: Record<string, string> = {}): string {
  const t = UI[locale];
  if (Array.isArray(rule.value)) {
    return rule.value.length > 6 ? t.reqOneOfN(rule.value.length) : `${t.reqOneOf}: ${rule.value.map((v) => fmt(rule, v, t, optionLabels)).join(", ")}`;
  }
  // Labels of boolean rules are written as the condition to meet, so "yes" always means it is met
  if (typeof rule.value === "boolean") return t.reqTrue;
  const v = fmt(rule, rule.value, t, optionLabels);
  switch (rule.operator) {
    case "lt": return `${t.reqLt} ${v}`;
    case "lte": return `${t.reqLte} ${v}`;
    case "gt": return `${t.reqGt} ${v}`;
    case "gte": return `${t.reqGte} ${v}`;
    default: return v;
  }
}

function describeAnswer(profile: UserProfile, rule: Rule, t: UIStrings, optionLabels: Record<string, string>): string {
  const raw = rule.field === "other" ? (rule.key ? profile.other?.[rule.key] : undefined) : profile[rule.field];
  if (raw === undefined) return t.ansMissing;
  if (typeof rule.value === "boolean" && typeof raw === "boolean") return raw === rule.value ? t.ansYes : t.no;
  return fmt(rule, raw, t, optionLabels);
}

function draftApplication(scheme: Scheme, profile: UserProfile, passed: Rule[], t: UIStrings, optionLabels: Record<string, string>): string {
  const blank = "____________________";
  const details: string[] = [];
  if (profile.age !== undefined) details.push(`${t.dAge}: ${profile.age} ${t.years}`);
  if (profile.occupation) details.push(`${t.dOccupation}: ${optionLabels[profile.occupation] ?? profile.occupation}`);
  if (profile.education) details.push(`${t.dEducation}: ${t.education[profile.education]}`);
  if (profile.income !== undefined) details.push(`${t.dIncome}: ${inr(profile.income)}`);
  if (profile.category) details.push(`${t.dCategory}: ${t.category[profile.category]}`);
  if (profile.state) details.push(`${t.dState}: ${profile.state}`);
  for (const r of scheme.eligibility) {
    if (r.field === "other" && typeof r.value === "number" && r.key && profile.other?.[r.key] !== undefined) {
      details.push(`${r.label ?? r.key}: ${profile.other[r.key]}`);
    }
  }
  const confirmations = passed.filter((r) => r.field === "other" && typeof r.value === "boolean").map((r) => r.label ?? r.key);
  return [
    t.dTo,
    scheme.issuingAuthority,
    "",
    t.dSubject(scheme.title),
    "",
    t.dSalutation,
    "",
    t.dIntro(scheme.title),
    "",
    `${t.dName}: ${blank}`,
    `${t.dMobile}: ${blank}`,
    ...details,
    "",
    ...(confirmations.length ? [t.dConfirm, ...confirmations.map((c) => `- ${c}`), ""] : []),
    ...(scheme.documentsRequired.length ? [t.dDocs, ...scheme.documentsRequired.map((d) => `- ${d}`), ""] : []),
    t.dDeclare,
    "",
    `${t.dSignature}: ${blank}`,
    `${t.dDate}: ${blank}`,
  ].join("\n");
}

// scheme should already be localized (applyTranslation) when locale is not "en"
export function checkAndPlan(scheme: Scheme, profile: UserProfile, locale: Locale = "en", optionLabels: Record<string, string> = {}): CheckResponse {
  const t = UI[locale];
  const result = checkEligibility(profile, scheme);
  const trace: TraceStep[] = scheme.eligibility.map((rule) => ({
    label: rule.label ?? `${rule.field} ${rule.operator} ${String(rule.value)}`,
    outcome: evaluateRule(profile, rule),
    required: describeRequirement(rule, locale, optionLabels),
    yourAnswer: describeAnswer(profile, rule, t, optionLabels),
    sourceClause: rule.sourceClause,
  }));

  const headline = result.eligible === true ? t.headlineYes : result.eligible === "unknown" ? t.headlineMaybe : t.headlineNo;

  return {
    schemeId: scheme.id,
    locale,
    eligible: result.eligible,
    counts: { passed: result.passed.length, failed: result.failed.length, missing: result.missing.length, total: scheme.eligibility.length },
    trace,
    plan: {
      headline,
      findOutFirst: result.missing.map((r) => r.label ?? r.key ?? r.field),
      documents: scheme.documentsRequired,
      steps: scheme.howToApply.steps,
      portalUrl: scheme.howToApply.portalUrl,
      sourceUrl: scheme.sourceUrl,
      doubleCheck: scheme.exclusions,
      draftApplication: result.eligible === false ? "" : draftApplication(scheme, profile, result.passed, t, optionLabels),
    },
  };
}
