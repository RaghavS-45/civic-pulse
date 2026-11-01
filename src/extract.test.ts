import { describe, expect, it } from "vitest";
import { MAX_RETRIES, extractScheme, parseJsonLoose, type LLM } from "./extract";
import { normalizeForMatch } from "./verify";

const SOURCE = `Scheme for Testing
Ministry of Testing
Students whose parental income does not exceed Rs. 2,50,000/- per annum are eligible.
A scholarship of ₹12,000 per year will be paid.
Students already receiving any other scholarship are not eligible.`;

const good = {
  title: "Scheme for Testing",
  issuingAuthority: "Ministry of Testing",
  summary: "A scholarship for students from low-income families.",
  benefits: [{ description: "₹12,000 a year", amount: 12000, sourceClause: "A scholarship of ₹12,000 per year will be paid." }],
  eligibility: [
    { field: "income", operator: "lte", value: 250000, label: "Family income up to ₹2.5 lakh", sourceClause: "parental income does not exceed Rs. 2,50,000/- per annum" },
  ],
  exclusions: [{ description: "Already getting another scholarship", sourceClause: "Students already receiving any other scholarship are not eligible." }],
  documentsRequired: [],
  deadlines: [],
  howToApply: { steps: [] },
  realWorldImpact: "Helps pay for school.",
};

function scripted(responses: string[]): LLM & { calls: number } {
  const fn = Object.assign(async () => responses[Math.min(fn.calls++, responses.length - 1)] ?? "", { calls: 0 });
  return fn;
}

const opts = { id: "test-scheme", sourceUrl: "https://example.gov.in/scheme" };

describe("extractScheme", () => {
  it("accepts valid JSON on the first try and sets id/sourceUrl itself", async () => {
    const llm = scripted([JSON.stringify({ ...good, id: "wrong", sourceUrl: "https://wrong.com" })]);
    const r = await extractScheme(SOURCE, { ...opts, llm });
    expect(r.attempts).toBe(1);
    expect(r.scheme.id).toBe("test-scheme");
    expect(r.scheme.sourceUrl).toBe(opts.sourceUrl);
    expect(r.unverifiedClauses).toEqual([]);
  });

  it("retries on invalid JSON and schema errors", async () => {
    const badSchema = { ...good, eligibility: [{ ...good.eligibility[0], value: "2.5 lakh" }] };
    const llm = scripted(["not json at all", JSON.stringify(badSchema), "```json\n" + JSON.stringify(good) + "\n```"]);
    const r = await extractScheme(SOURCE, { ...opts, llm });
    expect(r.attempts).toBe(3);
    expect(llm.calls).toBe(3);
  });

  it("gives up after the retry limit", async () => {
    const llm = scripted(["{}"]);
    await expect(extractScheme(SOURCE, { ...opts, llm })).rejects.toThrow(/failed after/);
    expect(llm.calls).toBe(MAX_RETRIES + 1);
  });

  it("retries when a sourceClause is not a real quote, and keeps the best valid result", async () => {
    const invented = { ...good, benefits: [{ ...good.benefits[0], sourceClause: "Students will get free laptops every year." }] };
    const llm = scripted([JSON.stringify(invented)]);
    const r = await extractScheme(SOURCE, { ...opts, llm });
    expect(llm.calls).toBe(MAX_RETRIES + 1);
    expect(r.unverifiedClauses.map((c) => c.where)).toEqual(["benefits[0]"]);
  });
});

describe("normalizeForMatch", () => {
  it("matches across PDF line-break hyphenation and rupee formats", () => {
    const pdf = normalizeForMatch("Rs.20,000/-per annum at Post-\nGraduation level");
    expect(pdf).toContain(normalizeForMatch("Rs.20,000/-per annum at Post-Graduation level"));
    expect(pdf).toContain(normalizeForMatch("₹20,000/- per annum at Post Graduation level"));
  });
});

describe("parseJsonLoose", () => {
  it("strips fences and surrounding prose", () => {
    expect(parseJsonLoose('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose('Sure! {"a":2} hope that helps')).toEqual({ a: 2 });
  });
});

describe("llmFromEnv model fallback", () => {
  it("moves to the next model when one is out of daily quota, without retrying it", async () => {
    const { llmFromEnv } = await import("./extract");
    const seen: string[] = [];
    const realFetch = globalThis.fetch;
    const env = { ...process.env };
    Object.assign(process.env, { EXTRACT_PROVIDER: "openai", EXTRACT_MODEL: "model-a, model-b", OPENAI_API_KEY: "k", OPENAI_BASE_URL: "https://llm.test/v1" });
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const model = JSON.parse(String(init.body)).model as string;
      seen.push(model);
      if (model === "model-a") return new Response("Generate content requests per day limit exceeded", { status: 429 });
      return new Response(JSON.stringify({ choices: [{ message: { content: "hello" } }] }), { status: 200 });
    }) as typeof fetch;
    try {
      expect(await llmFromEnv()("sys", [{ role: "user", content: "hi" }])).toBe("hello");
      expect(seen).toEqual(["model-a", "model-b"]);
    } finally {
      globalThis.fetch = realFetch;
      process.env = env;
    }
  });
});

describe("llmFromEnv timeouts", () => {
  it("treats a model that hangs as unavailable and moves on", async () => {
    const { llmFromEnv } = await import("./extract");
    const seen: string[] = [];
    const realFetch = globalThis.fetch;
    const env = { ...process.env };
    Object.assign(process.env, { EXTRACT_PROVIDER: "openai", EXTRACT_MODEL: "slow,fast", OPENAI_API_KEY: "k", OPENAI_BASE_URL: "https://llm.test/v1", LLM_TIMEOUT_MS: "50" });
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const model = JSON.parse(String(init.body)).model as string;
      seen.push(model);
      if (model === "slow") {
        return new Promise<Response>((_, reject) => init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("timeout"), { name: "TimeoutError" }))));
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
    }) as typeof fetch;
    try {
      expect(await llmFromEnv()("sys", [{ role: "user", content: "hi" }])).toBe("ok");
      expect(seen).toEqual(["slow", "fast"]);
    } finally {
      globalThis.fetch = realFetch;
      process.env = env;
    }
  });
});
