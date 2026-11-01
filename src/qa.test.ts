import { describe, expect, it } from "vitest";
import { askQuestion, verifyQuotes } from "./qa";
import { SchemeSchema } from "./types";

const SOURCE = `The registration and benefits under the Scheme shall be restricted to one member of the family.
For availing benefits under the Scheme, a ‘family’ is defined as consisting of the husband, wife and unmarried children.`;

const scheme = SchemeSchema.parse({
  id: "t", title: "Test", issuingAuthority: "Ministry", sourceUrl: "https://example.gov.in/x", summary: "s",
  benefits: [], eligibility: [], exclusions: [], documentsRequired: [], deadlines: [], howToApply: { steps: [] }, realWorldImpact: "r",
});

const llm = (out: unknown) => async () => JSON.stringify(out);

describe("askQuestion", () => {
  it("returns an answer only with quotes found in the document", async () => {
    const r = await askQuestion({
      question: "Can my sister apply too?", scheme, sourceText: SOURCE, lang: "en",
      llm: llm({ covered: true, answer: "Only if she is in a different family.", quotes: ["restricted to one member of the family", "invented line that is not there"] }),
    });
    expect(r.status).toBe("answered");
    expect(r.quotes).toEqual([{ text: "restricted to one member of the family", verified: true }]);
  });

  it("marks an answer with no real quotes as unsupported and hides its quotes", async () => {
    const r = await askQuestion({ question: "q", scheme, sourceText: SOURCE, lang: "en", llm: llm({ covered: true, answer: "Yes.", quotes: ["made up text here"] }) });
    expect(r.status).toBe("unsupported");
    expect(r.quotes).toEqual([]);
  });

  it("passes through 'not covered'", async () => {
    const r = await askQuestion({ question: "What is the interest?", scheme, sourceText: SOURCE, lang: "hi", llm: llm({ covered: false, answer: "दस्तावेज़ में यह नहीं लिखा है।", quotes: [] }) });
    expect(r.status).toBe("not_covered");
  });

  it("rejects empty questions", async () => {
    await expect(askQuestion({ question: "  ", scheme, sourceText: SOURCE, lang: "en", llm: llm({}) })).rejects.toThrow();
  });
});

describe("verifyQuotes", () => {
  it("ignores quote marks, case and spacing", () => {
    expect(verifyQuotes(["a 'family' is DEFINED as consisting of the husband"], SOURCE)[0]?.verified).toBe(true);
  });
});
