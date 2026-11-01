import { describe, expect, it } from "vitest";
import { checkAndPlan } from "./plan";
import { answersToProfile, buildQuestions, type Answers } from "./questions";
import { getScheme } from "./schemes";

function run(id: string, answers: Answers, overrides: Answers = {}) {
  const scheme = getScheme(id)!;
  const qs = buildQuestions(scheme);
  const yes = Object.fromEntries(qs.filter((q) => q.kind === "confirm").map((q) => [q.id, "yes"]));
  return checkAndPlan(scheme, answersToProfile(qs, { ...yes, ...answers, ...overrides }));
}

describe("Atal Pension Yojana", () => {
  it("30-year-old with a bank account who never paid tax is eligible", () => {
    expect(run("atal-pension-yojana", { age: "30" }).eligible).toBe(true);
  });
  it("41-year-old is not eligible", () => {
    const r = run("atal-pension-yojana", { age: "41" });
    expect(r.eligible).toBe(false);
    expect(r.trace.find((t) => t.outcome === "fail")?.required).toBe("Up to 40 years");
  });
  it("income-tax payer is not eligible, citing the 2022 rule", () => {
    const r = run("atal-pension-yojana", { age: "30" }, { "other.isOrWasIncomeTaxPayer": "no" });
    expect(r.eligible).toBe(false);
    expect(r.trace.find((t) => t.outcome === "fail")?.sourceClause).toContain("1st October, 2022");
  });
});

describe("PM-KISAN", () => {
  it("land-owning family with no excluded members is eligible", () => {
    expect(run("pm-kisan", {}).eligible).toBe(true);
  });
  it("a government employee in the family makes it ineligible", () => {
    const r = run("pm-kisan", {}, { "other.familyHasGovtEmployee": "no" });
    expect(r.eligible).toBe(false);
    expect(r.trace.filter((t) => t.outcome === "fail")).toHaveLength(1);
  });
  it("checks every main exclusion, not just land ownership", () => {
    expect(getScheme("pm-kisan")!.eligibility.length).toBeGreaterThanOrEqual(7);
  });
});

describe("Sukanya Samriddhi", () => {
  it("asks about the daughter, never the parent's own age or gender", () => {
    const ids = buildQuestions(getScheme("sukanya-samriddhi")!).map((q) => q.id);
    expect(ids).not.toContain("age");
    expect(ids).not.toContain("gender");
    expect(ids).toContain("other.girlAgeYears");
  });
  it("5-year-old daughter is eligible, 12-year-old is not", () => {
    expect(run("sukanya-samriddhi", { "other.girlAgeYears": "5" }).eligible).toBe(true);
    expect(run("sukanya-samriddhi", { "other.girlAgeYears": "12" }).eligible).toBe(false);
  });
  it("never presents the 2020 interest rate as today's rate", () => {
    const interest = getScheme("sukanya-samriddhi")!.benefits.find((b) => b.description.includes("7.6"));
    expect(interest?.description).toMatch(/today's rate/);
  });
});
