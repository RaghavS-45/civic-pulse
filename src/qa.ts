import { z } from "zod";
import { parseJsonLoose, type LLM } from "./extract";
import type { Scheme } from "./types";
import { normalizeForMatch } from "./verify";

export const MAX_QUESTION_CHARS = 400;
const MAX_SOURCE_CHARS = 100_000;

export interface QAQuote {
  text: string;
  verified: boolean;
}

export interface QAResult {
  // "answered": supported by quotes found in the document; "not_covered": the document doesn't say;
  // "unsupported": the model answered but none of its quotes could be found, so we don't show its answer as fact
  status: "answered" | "not_covered" | "unsupported";
  answer: string;
  quotes: QAQuote[];
}

const RawAnswer = z.object({
  covered: z.boolean(),
  answer: z.string().min(1),
  quotes: z.array(z.string()).default([]),
});

export function qaPrompt(lang: "en" | "hi"): string {
  const language = lang === "hi" ? "simple everyday Hindi (Devanagari script)" : "simple English";
  return `You answer citizens' questions about one Indian government scheme, using ONLY the official document provided.

Rules:
- Use only the document. Do not use outside knowledge, even if you know the scheme.
- If the document does not answer the question, set "covered" to false and say briefly what the document does not cover and who to ask (the official office or helpline named in the document, if any).
- Answer in ${language}, in 1-4 short sentences a Class 8 student understands. Be direct: start with yes, no, or it depends, when that fits.
- In "quotes", copy 1-3 short passages from the document, word for word in the document's original language, that support the answer. Never translate or paraphrase a quote.
- The question may be in Hindi or English; the document is usually in English.
- Output one JSON object only: {"covered": boolean, "answer": string, "quotes": string[]}`;
}

export function buildQAUserPrompt(question: string, scheme: Scheme, sourceText: string): string {
  const summary = {
    title: scheme.title,
    issuingAuthority: scheme.issuingAuthority,
    eligibility: scheme.eligibility.map((r) => r.label ?? r.sourceClause),
    exclusions: scheme.exclusions.map((e) => e.description),
  };
  return `<document>\n${sourceText.slice(0, MAX_SOURCE_CHARS)}\n</document>\n\n<scheme_summary>\n${JSON.stringify(summary)}\n</scheme_summary>\n\nQuestion: ${question}`;
}

export function verifyQuotes(quotes: string[], sourceText: string): QAQuote[] {
  const haystack = normalizeForMatch(sourceText);
  return quotes
    .map((q) => q.trim())
    .filter((q) => q.length >= 8)
    .map((text) => ({ text, verified: haystack.includes(normalizeForMatch(text)) }));
}

export async function askQuestion(opts: { question: string; scheme: Scheme; sourceText: string; lang: "en" | "hi"; llm: LLM }): Promise<QAResult> {
  const question = opts.question.trim().slice(0, MAX_QUESTION_CHARS);
  if (!question) throw new Error("Empty question");
  const raw = await opts.llm(qaPrompt(opts.lang), [{ role: "user", content: buildQAUserPrompt(question, opts.scheme, opts.sourceText) }]);
  const parsed = RawAnswer.parse(parseJsonLoose(raw));
  const quotes = verifyQuotes(parsed.quotes, opts.sourceText);
  if (!parsed.covered) return { status: "not_covered", answer: parsed.answer, quotes: quotes.filter((q) => q.verified) };
  const verified = quotes.filter((q) => q.verified);
  if (verified.length === 0) return { status: "unsupported", answer: parsed.answer, quotes: [] };
  return { status: "answered", answer: parsed.answer, quotes: verified };
}
