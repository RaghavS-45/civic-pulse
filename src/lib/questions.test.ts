import { describe, expect, it } from "vitest";
import { checkEligibility } from "../eligibility";
import type { Scheme } from "../types";
import { answersToProfile, buildQuestions } from "./questions";

const vendorScheme: Scheme = {
  id: "vendor-test",
  title: "Vendor test",
  issuingAuthority: "Test",
  sourceUrl: "https://example.gov.in/x.pdf",
  summary: "s",
  benefits: [],
  eligibility: [{ field: "occupation", operator: "eq", value: "street vendor", sourceClause: "street vendors engaged in vending" }],
  exclusions: [],
  documentsRequired: [],
  deadlines: [],
  howToApply: { steps: [] },
  realWorldImpact: "r",
} as unknown as Scheme;

describe("buildQuestions for an exact occupation rule", () => {
  it("offers the required occupation as a choice instead of free text", () => {
    const q = buildQuestions(vendorScheme)[0];
    expect(q?.kind).toBe("select");
    if (q?.kind !== "select") return;
    expect(q.options.map((o) => o.value)).toEqual(["street vendor", "none of these"]);
  });

  it("picking the option passes, picking none of these fails", () => {
    const qs = buildQuestions(vendorScheme);
    expect(checkEligibility(answersToProfile(qs, { occupation: "street vendor" }), vendorScheme).eligible).toBe(true);
    expect(checkEligibility(answersToProfile(qs, { occupation: "none of these" }), vendorScheme).eligible).toBe(false);
  });
});
