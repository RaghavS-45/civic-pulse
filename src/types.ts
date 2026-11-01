import { z } from "zod";

// Ordered from lowest to highest so education rules can use lt/lte/gt/gte
export const EDUCATION_LEVELS = [
  "none",
  "primary",
  "class8",
  "class10",
  "class12",
  "diploma",
  "graduate",
  "postgraduate",
  "doctorate",
] as const;

export const CATEGORIES = ["general", "ews", "obc", "sc", "st"] as const;
export const GENDERS = ["male", "female", "transgender"] as const;

export const EligibilityFieldSchema = z.enum([
  "age",
  "income",
  "category",
  "state",
  "education",
  "occupation",
  "gender",
  "other",
]);
export type EligibilityField = z.infer<typeof EligibilityFieldSchema>;

export const OperatorSchema = z.enum(["lt", "lte", "gt", "gte", "eq", "in"]);
export type Operator = z.infer<typeof OperatorSchema>;

const Scalar = z.union([z.string().min(1), z.number(), z.boolean()]);
export type Scalar = z.infer<typeof Scalar>;

const SourceClause = z.string().trim().min(10, "sourceClause must be an exact quote from the source");

const NUMERIC_FIELDS: readonly EligibilityField[] = ["age", "income"];
const COMPARISON_OPS: readonly Operator[] = ["lt", "lte", "gt", "gte"];

export const RuleSchema = z
  .object({
    field: EligibilityFieldSchema,
    // Required when field is "other": the UserProfile.other key this rule checks, e.g. "isDisabled"
    key: z.string().min(1).optional(),
    operator: OperatorSchema,
    value: z.union([Scalar, z.array(Scalar).min(1)]),
    // Short plain-language label for the UI, e.g. "Family income up to ₹2.5 lakh a year"
    label: z.string().optional(),
    sourceClause: SourceClause,
  })
  .superRefine((r, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    if (r.field === "other" && !r.key) issue('rules with field "other" need a "key"');
    if (r.operator === "in" && !Array.isArray(r.value)) issue('"in" needs an array value');
    if (r.operator !== "in" && Array.isArray(r.value)) issue(`"${r.operator}" needs a single value, not an array`);
    if (NUMERIC_FIELDS.includes(r.field) && r.operator !== "in" && typeof r.value !== "number") {
      issue(`${r.field} must be a number (age in years, income in annual INR)`);
    }
    if (COMPARISON_OPS.includes(r.operator) && !NUMERIC_FIELDS.includes(r.field) && r.field !== "education" && r.field !== "other") {
      issue(`"${r.operator}" only works on age, income, education or other`);
    }
    const values = Array.isArray(r.value) ? r.value : [r.value];
    const allowed: Partial<Record<EligibilityField, readonly string[]>> = {
      education: EDUCATION_LEVELS,
      category: CATEGORIES,
      gender: GENDERS,
    };
    const list = allowed[r.field];
    if (list) {
      for (const v of values) {
        if (typeof v !== "string" || !list.includes(v.toLowerCase())) {
          issue(`${r.field} value "${String(v)}" must be one of: ${list.join(", ")}`);
        }
      }
    }
  });
export type Rule = z.infer<typeof RuleSchema>;

export const BenefitSchema = z.object({
  description: z.string().min(1),
  // Amount in INR when the benefit is money; description holds the frequency ("per year", "one-time")
  amount: z.number().nonnegative().optional(),
  sourceClause: SourceClause,
});
export type Benefit = z.infer<typeof BenefitSchema>;

export const ExclusionSchema = z.object({
  description: z.string().min(1),
  sourceClause: SourceClause,
});
export type Exclusion = z.infer<typeof ExclusionSchema>;

export const DeadlineSchema = z.object({
  description: z.string().min(1),
  // ISO date (YYYY-MM-DD) when the source gives an exact date
  date: z.iso.date().optional(),
});

export const SchemeSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id must be a lowercase slug"),
  title: z.string().min(1),
  issuingAuthority: z.string().min(1),
  sourceUrl: z.url(),
  summary: z.string().min(1),
  benefits: z.array(BenefitSchema),
  eligibility: z.array(RuleSchema),
  exclusions: z.array(ExclusionSchema),
  documentsRequired: z.array(z.string().min(1)),
  deadlines: z.array(DeadlineSchema),
  howToApply: z.object({
    steps: z.array(z.string().min(1)),
    portalUrl: z.url().optional(),
  }),
  realWorldImpact: z.string().min(1),
});
export type Scheme = z.infer<typeof SchemeSchema>;

export const UserProfileSchema = z.object({
  age: z.number().int().nonnegative().optional(),
  // Annual family income in INR
  income: z.number().nonnegative().optional(),
  category: z.enum(CATEGORIES).optional(),
  // State or UT name, matched case-insensitively
  state: z.string().min(1).optional(),
  // Highest level passed
  education: z.enum(EDUCATION_LEVELS).optional(),
  occupation: z.string().min(1).optional(),
  gender: z.enum(GENDERS).optional(),
  other: z.record(z.string(), Scalar).optional(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export interface EligibilityResult {
  eligible: true | false | "unknown";
  passed: Rule[];
  failed: Rule[];
  missing: Rule[];
}
