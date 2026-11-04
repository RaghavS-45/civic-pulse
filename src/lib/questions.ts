import { CATEGORIES, EDUCATION_LEVELS, GENDERS, type Rule, type Scheme, type UserProfile } from "../types";
import { UI, type Locale } from "./i18n";

export type Option = { value: string; label: string };

export type Question =
  | { id: string; kind: "number"; prompt: string; hint?: string; unit?: string }
  | { id: string; kind: "select"; prompt: string; options: Option[] }
  | { id: string; kind: "text"; prompt: string; hint?: string }
  // Yes/No/Not sure about a statement; "yes" stores the rule's required value
  | { id: string; kind: "confirm"; prompt: string; required: boolean };

export type Answers = Record<string, string>;

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export function questionId(rule: Rule): string {
  return rule.field === "other" ? `other.${rule.key}` : rule.field;
}

export function buildQuestions(scheme: Scheme, locale: Locale = "en", optionLabels: Record<string, string> = {}): Question[] {
  const t = UI[locale];
  const out: Question[] = [];
  const seen = new Set<string>();
  for (const rule of scheme.eligibility) {
    const id = questionId(rule);
    if (seen.has(id)) continue;
    seen.add(id);
    switch (rule.field) {
      case "age":
        out.push({ id, kind: "number", prompt: t.qAge, unit: t.unitYears });
        break;
      case "income":
        out.push({ id, kind: "number", prompt: t.qIncome, unit: t.unitIncome, hint: t.hintIncome });
        break;
      case "education":
        out.push({ id, kind: "select", prompt: t.qEducation, options: EDUCATION_LEVELS.map((v) => ({ value: v, label: t.education[v] })) });
        break;
      case "category":
        out.push({ id, kind: "select", prompt: t.qCategory, options: CATEGORIES.map((v) => ({ value: v, label: t.category[v] })) });
        break;
      case "gender":
        out.push({ id, kind: "select", prompt: t.qGender, options: GENDERS.map((v) => ({ value: v, label: t.gender[v] })) });
        break;
      case "state":
        out.push({ id, kind: "text", prompt: t.qState });
        break;
      case "occupation": {
        const values = scheme.eligibility
          .filter((r) => r.field === "occupation" && (r.operator === "in" || r.operator === "eq"))
          .flatMap((r) => (Array.isArray(r.value) ? r.value : [r.value]))
          .map(String);
        out.push(
          values.length
            ? { id, kind: "select", prompt: t.qOccupation, options: [...values.map((v) => ({ value: v, label: optionLabels[v] ?? titleCase(v) })), { value: "none of these", label: t.noneOfThese }] }
            : { id, kind: "text", prompt: t.qOccupation },
        );
        break;
      }
      case "other":
        if (typeof rule.value === "boolean") out.push({ id, kind: "confirm", prompt: rule.label ?? rule.key ?? "", required: rule.value });
        else if (typeof rule.value === "number") out.push({ id, kind: "number", prompt: rule.label ?? rule.key ?? "", hint: t.enterNumber });
        // Free text never matches an exact rule value, so offer the value as a choice
        else if (rule.operator === "eq" && typeof rule.value === "string")
          out.push({ id, kind: "select", prompt: rule.label ?? rule.key ?? "", options: [{ value: rule.value, label: optionLabels[rule.value] ?? titleCase(rule.value) }, { value: "none of these", label: t.noneOfThese }] });
        else out.push({ id, kind: "text", prompt: rule.label ?? rule.key ?? "" });
        break;
    }
  }
  return out;
}

// Unanswered and "not sure" answers are left out so eligibility returns "unknown" for them
export function answersToProfile(questions: Question[], answers: Answers): UserProfile {
  const profile: UserProfile = {};
  const other: Record<string, string | number | boolean> = {};
  for (const q of questions) {
    const raw = answers[q.id]?.trim();
    if (!raw || raw === "unsure") continue;
    let value: string | number | boolean;
    if (q.kind === "number") {
      const n = Number(raw.replace(/,/g, ""));
      if (!Number.isFinite(n)) continue;
      value = n;
    } else if (q.kind === "confirm") {
      value = raw === "yes" ? q.required : !q.required;
    } else {
      value = raw;
    }
    if (q.id.startsWith("other.")) other[q.id.slice(6)] = value;
    else (profile as Record<string, unknown>)[q.id] = value;
  }
  if (Object.keys(other).length) profile.other = other;
  return profile;
}
