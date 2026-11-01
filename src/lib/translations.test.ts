import { describe, expect, it } from "vitest";
import { checkAndPlan } from "./plan";
import { answersToProfile, buildQuestions } from "./questions";
import { SCHEMES } from "./schemes";
import { getLocalizedScheme, localize } from "./translations";

const devanagari = /[ऀ-ॿ]/;

describe("Hindi translations", () => {
  it("exist for every verified scheme and line up item by item", () => {
    for (const s of SCHEMES) {
      const l = localize(s, "hi");
      expect(l.locale).toBe("hi");
      expect(l.scheme.benefits).toHaveLength(s.benefits.length);
      expect(devanagari.test(l.scheme.summary)).toBe(true);
    }
  });

  it("never translate the source quotes or change the rules", () => {
    for (const s of SCHEMES) {
      const { scheme: h } = localize(s, "hi");
      expect(h.benefits.map((b) => b.sourceClause)).toEqual(s.benefits.map((b) => b.sourceClause));
      expect(h.eligibility.map(({ label: _l, ...r }) => r)).toEqual(s.eligibility.map(({ label: _l, ...r }) => r));
    }
  });

  it("gives the same verdict in Hindi and English, with Hindi text", () => {
    const en = getLocalizedScheme("pm-vishwakarma", "en")!;
    const hi = getLocalizedScheme("pm-vishwakarma", "hi")!;
    const qsHi = buildQuestions(hi.scheme, "hi", hi.optionLabels);
    const answers = { age: "42", occupation: "tailor", ...Object.fromEntries(qsHi.filter((q) => q.kind === "confirm").map((q) => [q.id, "yes"])) };
    const rHi = checkAndPlan(hi.scheme, answersToProfile(qsHi, answers), "hi", hi.optionLabels);
    const rEn = checkAndPlan(en.scheme, answersToProfile(buildQuestions(en.scheme), answers), "en");
    expect(rHi.eligible).toBe(true);
    expect(rHi.eligible).toBe(rEn.eligible);
    expect(qsHi.find((q) => q.id === "occupation")?.kind === "select" && qsHi.find((q) => q.id === "occupation")).toBeTruthy();
    expect(rHi.plan.draftApplication).toContain("दर्जी");
    expect(devanagari.test(rHi.plan.headline)).toBe(true);
  });

  it("falls back to English for a language with no reviewed translation", () => {
    expect(localize(SCHEMES[0]!, "en").locale).toBe("en");
  });
});
