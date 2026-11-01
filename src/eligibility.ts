import { EDUCATION_LEVELS, type EligibilityResult, type Rule, type Scalar, type Scheme, type UserProfile } from "./types";

type Outcome = "pass" | "fail" | "missing";

function profileValue(profile: UserProfile, rule: Rule): Scalar | undefined {
  if (rule.field === "other") return rule.key ? profile.other?.[rule.key] : undefined;
  return profile[rule.field];
}

function normalize(v: Scalar): Scalar {
  return typeof v === "string" ? v.trim().toLowerCase() : v;
}

// Education compares by rank so "gte class10" means "passed class 10 or higher"
function rank(field: Rule["field"], v: Scalar): Scalar {
  if (field !== "education" || typeof v !== "string") return v;
  const i = (EDUCATION_LEVELS as readonly string[]).indexOf(v.toLowerCase());
  return i === -1 ? v : i;
}

function compare(op: Rule["operator"], actual: Scalar, expected: Scalar): boolean {
  if (op === "eq") return actual === expected;
  if (typeof actual !== "number" || typeof expected !== "number") return false;
  switch (op) {
    case "lt": return actual < expected;
    case "lte": return actual <= expected;
    case "gt": return actual > expected;
    case "gte": return actual >= expected;
    default: return false;
  }
}

export function evaluateRule(profile: UserProfile, rule: Rule): Outcome {
  const raw = profileValue(profile, rule);
  if (raw === undefined || raw === "") return "missing";
  const actual = rank(rule.field, normalize(raw));
  if (rule.operator === "in") {
    const options = (Array.isArray(rule.value) ? rule.value : [rule.value]).map((v) => rank(rule.field, normalize(v)));
    return options.includes(actual) ? "pass" : "fail";
  }
  if (Array.isArray(rule.value)) return "fail";
  return compare(rule.operator, actual, rank(rule.field, normalize(rule.value))) ? "pass" : "fail";
}

export function checkEligibility(profile: UserProfile, scheme: Scheme): EligibilityResult {
  const result: EligibilityResult = { eligible: true, passed: [], failed: [], missing: [] };
  for (const rule of scheme.eligibility) {
    const outcome = evaluateRule(profile, rule);
    if (outcome === "pass") result.passed.push(rule);
    else if (outcome === "fail") result.failed.push(rule);
    else result.missing.push(rule);
  }
  if (result.failed.length > 0) result.eligible = false;
  else if (result.missing.length > 0) result.eligible = "unknown";
  return result;
}
