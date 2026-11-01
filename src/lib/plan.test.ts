import { describe, expect, it } from "vitest";
import { checkAndPlan } from "./plan";
import { answersToProfile, buildQuestions } from "./questions";
import { getScheme, SCHEMES } from "./schemes";

const pmv = getScheme("pm-vishwakarma")!;
const csss = getScheme("central-sector-scholarship")!;

describe("verified schemes", () => {
  it("all load and pass the schema", () => {
    expect(SCHEMES.map((s) => s.id).sort()).toEqual(["atal-pension-yojana", "central-sector-scholarship", "pm-kisan", "pm-vishwakarma", "sukanya-samriddhi"]);
  });
});

describe("buildQuestions + answersToProfile", () => {
  it("makes one question per rule field and a trade dropdown", () => {
    const qs = buildQuestions(pmv);
    expect(qs).toHaveLength(pmv.eligibility.length);
    const trade = qs.find((q) => q.id === "occupation");
    expect(trade?.kind).toBe("select");
  });

  it("maps 'yes' on a must-be-false rule to false, and skips 'not sure'", () => {
    const qs = buildQuestions(pmv);
    const p = answersToProfile(qs, {
      age: "42",
      occupation: "tailor",
      "other.familyInGovernmentService": "yes",
      "other.hasDisqualifyingLoanPast5Years": "unsure",
    });
    expect(p.age).toBe(42);
    expect(p.other?.familyInGovernmentService).toBe(false);
    expect(p.other).not.toHaveProperty("hasDisqualifyingLoanPast5Years");
  });
});

describe("checkAndPlan", () => {
  const allYes = (scheme: typeof pmv) =>
    Object.fromEntries(buildQuestions(scheme).filter((q) => q.kind === "confirm").map((q) => [q.id, "yes"]));

  it("eligible tailor gets a full plan and a draft application", () => {
    const qs = buildQuestions(pmv);
    const r = checkAndPlan(pmv, answersToProfile(qs, { ...allYes(pmv), age: "42", occupation: "tailor" }));
    expect(r.eligible).toBe(true);
    expect(r.trace.every((t) => t.outcome === "pass")).toBe(true);
    expect(r.plan.draftApplication).toContain("Occupation / trade: tailor");
    expect(r.plan.documents.length).toBeGreaterThan(0);
  });

  it("unanswered questions become 'find out first'", () => {
    const qs = buildQuestions(csss);
    const r = checkAndPlan(csss, answersToProfile(qs, { income: "300000", education: "class12" }));
    expect(r.eligible).toBe("unknown");
    expect(r.plan.findOutFirst.length).toBe(r.counts.missing);
  });

  it("ineligible gets no draft and the failing rule carries its source quote", () => {
    const qs = buildQuestions(csss);
    const r = checkAndPlan(csss, answersToProfile(qs, { ...allYes(csss), income: "600000", education: "class12", "other.classXIIPercentileInStream": "90" }));
    expect(r.eligible).toBe(false);
    expect(r.plan.draftApplication).toBe("");
    const failed = r.trace.find((t) => t.outcome === "fail")!;
    expect(failed.required).toBe("Up to ₹4,50,000");
    expect(failed.sourceClause).toContain("4.5 lakh");
  });
});
