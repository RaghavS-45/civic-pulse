import { describe, expect, it } from "vitest";
import { checkEligibility } from "./eligibility";
import { SchemeSchema, type Scheme, type UserProfile } from "./types";

const scheme: Scheme = SchemeSchema.parse({
  id: "test-post-matric-scholarship",
  title: "Test Post-Matric Scholarship",
  issuingAuthority: "Ministry of Social Justice and Empowerment",
  sourceUrl: "https://socialjustice.gov.in/",
  summary: "Money for SC students studying after Class 10.",
  benefits: [
    { description: "Maintenance allowance per year", amount: 13500, sourceClause: "maintenance allowance of Rs. 13,500 per annum" },
  ],
  eligibility: [
    { field: "category", operator: "eq", value: "sc", sourceClause: "students belonging to Scheduled Castes" },
    { field: "income", operator: "lte", value: 250000, sourceClause: "parental income does not exceed Rs. 2,50,000 per annum" },
    { field: "education", operator: "gte", value: "class10", sourceClause: "who have passed matriculation or higher secondary" },
    { field: "age", operator: "lt", value: 30, sourceClause: "students below the age of 30 years" },
    { field: "state", operator: "in", value: ["bihar", "uttar pradesh"], sourceClause: "domiciled in the States of Bihar and Uttar Pradesh" },
    { field: "other", key: "isFullTimeStudent", operator: "eq", value: true, sourceClause: "pursuing a full-time recognised course" },
  ],
  exclusions: [],
  documentsRequired: ["Caste certificate", "Income certificate"],
  deadlines: [],
  howToApply: { steps: ["Apply on the National Scholarship Portal"], portalUrl: "https://scholarships.gov.in/" },
  realWorldImpact: "Helps families pay college costs.",
});

const eligibleProfile: UserProfile = {
  category: "sc",
  income: 180000,
  education: "class12",
  age: 19,
  state: "Bihar",
  other: { isFullTimeStudent: true },
};

describe("checkEligibility", () => {
  it("returns eligible when every rule passes", () => {
    const r = checkEligibility(eligibleProfile, scheme);
    expect(r.eligible).toBe(true);
    expect(r.passed).toHaveLength(6);
    expect(r.failed).toHaveLength(0);
    expect(r.missing).toHaveLength(0);
  });

  it("returns ineligible and names the failing rule", () => {
    const r = checkEligibility({ ...eligibleProfile, income: 400000 }, scheme);
    expect(r.eligible).toBe(false);
    expect(r.failed.map((x) => x.field)).toEqual(["income"]);
    expect(r.failed[0]?.sourceClause).toContain("2,50,000");
  });

  it("returns unknown when profile info is missing, never a guess", () => {
    const { income: _income, ...noIncome } = eligibleProfile;
    const r = checkEligibility(noIncome, scheme);
    expect(r.eligible).toBe("unknown");
    expect(r.missing.map((x) => x.field)).toEqual(["income"]);
    expect(r.failed).toHaveLength(0);
  });

  it("missing other-key gives unknown", () => {
    const r = checkEligibility({ ...eligibleProfile, other: {} }, scheme);
    expect(r.eligible).toBe("unknown");
    expect(r.missing[0]?.key).toBe("isFullTimeStudent");
  });

  it("a definite failure wins over missing info", () => {
    const r = checkEligibility({ category: "general" }, scheme);
    expect(r.eligible).toBe(false);
    expect(r.failed.map((x) => x.field)).toEqual(["category"]);
    expect(r.missing.length).toBeGreaterThan(0);
  });

  it("handles boundary values for lte and lt", () => {
    expect(checkEligibility({ ...eligibleProfile, income: 250000 }, scheme).eligible).toBe(true);
    expect(checkEligibility({ ...eligibleProfile, age: 30 }, scheme).eligible).toBe(false);
  });

  it("compares education by level", () => {
    expect(checkEligibility({ ...eligibleProfile, education: "class10" }, scheme).eligible).toBe(true);
    expect(checkEligibility({ ...eligibleProfile, education: "class8" }, scheme).eligible).toBe(false);
  });

  it("matches state case-insensitively and rejects other states", () => {
    expect(checkEligibility({ ...eligibleProfile, state: "UTTAR PRADESH" }, scheme).eligible).toBe(true);
    expect(checkEligibility({ ...eligibleProfile, state: "kerala" }, scheme).eligible).toBe(false);
  });

  it("a scheme with no rules is open to everyone", () => {
    expect(checkEligibility({}, { ...scheme, eligibility: [] }).eligible).toBe(true);
  });
});

describe("RuleSchema validation", () => {
  const base = { sourceClause: "some exact clause from the document" };
  it("rejects non-numeric income", () => {
    expect(SchemeSchema.shape.eligibility.safeParse([{ ...base, field: "income", operator: "lte", value: "2.5 lakh" }]).success).toBe(false);
  });
  it("rejects an unknown category", () => {
    expect(SchemeSchema.shape.eligibility.safeParse([{ ...base, field: "category", operator: "eq", value: "minority" }]).success).toBe(false);
  });
  it("requires a key for other rules", () => {
    expect(SchemeSchema.shape.eligibility.safeParse([{ ...base, field: "other", operator: "eq", value: true }]).success).toBe(false);
  });
  it("requires an array for in", () => {
    expect(SchemeSchema.shape.eligibility.safeParse([{ ...base, field: "state", operator: "in", value: "bihar" }]).success).toBe(false);
  });
});
