import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { basename, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { CATEGORIES, EDUCATION_LEVELS, GENDERS, SchemeSchema, type Scheme } from "./types";
import { findUnverifiedClauses } from "./verify";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type LLM = (system: string, messages: ChatMessage[]) => Promise<string>;

export const MAX_RETRIES = 3;
const MAX_CHARS = 200_000;

export const SYSTEM_PROMPT = `You extract Indian government scheme and notification documents into structured JSON for citizens.

Rules:
- Use only information present in the text. If something is not stated, omit the field or use an empty array. Never guess.
- For every benefit, eligibility rule and exclusion, copy the exact supporting sentence or phrase from the text into "sourceClause", word for word. Do not paraphrase or fix typos in it.
- Normalize income to annual INR (e.g. "Rs. 2.5 lakh per annum" -> 250000, "Rs. 20,000 per month" -> 240000) and age to whole years.
- Write "summary" and "realWorldImpact" in plain language at a Class 8 reading level: short sentences, no jargon. The summary must state the key numbers (income limit, age limit, benefit amounts) when the text gives them.
- "eligibility" is only for who can apply for the first time. Conditions for keeping or renewing the benefit (marks, attendance, conduct) are NOT eligibility rules: put them in howToApply.steps, and conduct-based forfeiture in exclusions.
- If the text says people receiving some other benefit cannot apply, add it both as an exclusion and as an eligibility rule with field "other" and a boolean key (e.g. "receivesOtherScholarship" eq false).
- "documentsRequired" lists only documents the text says applicants must provide or have. Do not add documents that are only mentioned in passing (for example, an ID used to track payment status).
- Output a single JSON object and nothing else. No markdown fences.

JSON shape:
{
  "title": string,
  "issuingAuthority": string,               // ministry / department
  "summary": string,                        // 3-5 plain sentences: what it is, who it's for, what you get
  "benefits": [{ "description": string, "amount"?: number /* INR */, "sourceClause": string }],
  "eligibility": [{
    "field": "age" | "income" | "category" | "state" | "education" | "occupation" | "gender" | "other",
    "key"?: string,                         // required when field is "other", camelCase, e.g. "isDisabled", "marksPercentClass12"
    "operator": "lt" | "lte" | "gt" | "gte" | "eq" | "in",
    "value": number | string | boolean | array,
    "label": string,                        // plain-language version, e.g. "Family income up to ₹2.5 lakh a year"
    "sourceClause": string
  }],
  "exclusions": [{ "description": string, "sourceClause": string }],
  "documentsRequired": string[],
  "deadlines": [{ "description": string, "date"?: "YYYY-MM-DD" }],
  "howToApply": { "steps": string[], "portalUrl"?: string },
  "realWorldImpact": string                 // 1-2 sentences: what this changes for a typical eligible family
}

Field conventions for eligibility rules:
- age, income: number values. income means annual family income in INR unless the text says otherwise (then say so in label).
- category: one of ${CATEGORIES.join(", ")} (use "in" for several).
- gender: one of ${GENDERS.join(", ")}.
- education: highest level passed, one of ${EDUCATION_LEVELS.join(", ")} (ordered low to high; "gte class10" = passed class 10 or above). Use "eq" or "in" for "currently studying in" if that is the closest fit, and explain in label.
- state: lowercase state/UT name, e.g. "bihar".
- occupation: short lowercase word, e.g. "student", "farmer", "street vendor".
- other: anything else that is checkable (disability, marks percentage, BPL card, enrolment in a recognised institution). Boolean conditions use "eq" with true/false.
- One rule per condition. Conditions that cannot be checked as a single comparison go in the rule with field "other" and a descriptive key.`;

export function buildUserPrompt(text: string): string {
  return `Extract the scheme from this document.\n\n<document>\n${text}\n</document>`;
}

export function parseJsonLoose(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  let s = (fenced?.[1] ?? raw).trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

export interface ExtractOptions {
  id: string;
  sourceUrl: string;
  llm: LLM;
  log?: (msg: string) => void;
  onEvent?: (e: ExtractEvent) => void;
}

// Structured progress for the web UI
export type ExtractEvent =
  | { type: "attempt"; attempt: number; max: number }
  | { type: "rejected"; attempt: number; reason: string; kind: "invalid" | "quotes" }
  | { type: "validated"; attempt: number; clauses: number; unverified: number };

export interface ExtractResult {
  scheme: Scheme;
  attempts: number;
  unverifiedClauses: { where: string; sourceClause: string }[];
}

export async function extractScheme(text: string, opts: ExtractOptions): Promise<ExtractResult> {
  const log = opts.log ?? (() => {});
  const messages: ChatMessage[] = [{ role: "user", content: buildUserPrompt(text) }];
  let lastError = "";
  let best: ExtractResult | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    log(`LLM call ${attempt}/${MAX_RETRIES + 1}`);
    opts.onEvent?.({ type: "attempt", attempt, max: MAX_RETRIES + 1 });
    const raw = await opts.llm(SYSTEM_PROMPT, messages);
    messages.push({ role: "assistant", content: raw });

    let feedback: string;
    try {
      const obj = parseJsonLoose(raw) as Record<string, unknown>;
      const scheme = SchemeSchema.parse({ ...obj, id: opts.id, sourceUrl: opts.sourceUrl });
      const unverifiedClauses = findUnverifiedClauses(scheme, text);
      best = { scheme, attempts: attempt, unverifiedClauses };
      const clauses = scheme.benefits.length + scheme.eligibility.length + scheme.exclusions.length;
      opts.onEvent?.({ type: "validated", attempt, clauses, unverified: unverifiedClauses.length });
      if (unverifiedClauses.length === 0) return best;
      feedback =
        "These sourceClause values are not exact quotes from the document. Replace each with the exact text from the document (word for word), or drop the item if the document does not support it:\n" +
        unverifiedClauses.map((c) => `- ${c.where}: "${c.sourceClause}"`).join("\n");
      lastError = `${unverifiedClauses.length} unverified source clauses`;
      opts.onEvent?.({ type: "rejected", attempt, kind: "quotes", reason: `${unverifiedClauses.length} quote(s) not found word for word in the document` });
    } catch (err) {
      lastError = err instanceof z.ZodError ? z.prettifyError(err) : err instanceof Error ? err.message : String(err);
      feedback = `Your output was not valid. Fix these problems and return the full corrected JSON object only:\n${lastError}`;
      opts.onEvent?.({ type: "rejected", attempt, kind: "invalid", reason: lastError.split("\n").slice(0, 2).join(" ").slice(0, 200) });
    }
    log(`  rejected: ${lastError.split("\n")[0]}`);
    messages.push({ role: "user", content: feedback });
  }

  // Schema-valid output with a few unmatched quotes is still saved; hand-verification catches the rest
  if (best) return best;
  throw new Error(`Extraction failed after ${MAX_RETRIES + 1} attempts:\n${lastError}`);
}

export async function pdfToText(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  return { text: text.map((page, i) => `--- page ${i + 1} ---\n${page}`).join("\n\n"), pages: text.length };
}

export async function loadText(path: string): Promise<string> {
  const ext = extname(path).toLowerCase();
  if (ext === ".pdf") return (await pdfToText(new Uint8Array(await readFile(path)))).text;
  if (ext === ".txt" || ext === ".md") return readFile(path, "utf8");
  throw new Error(`Unsupported input type "${ext}". Use a .pdf, .txt or .md file.`);
}

// Free tiers often return 429/503 under load; back off and retry before giving up
export async function postJson(url: string, headers: Record<string, string>, body: unknown, tries = 4): Promise<Response> {
  for (let i = 1; ; i++) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
    const retryable = res.status === 429 || res.status >= 500;
    if (res.ok || !retryable || i >= tries) return res;
    // A used-up daily quota won't recover by waiting; let the caller fall back to another model
    if (res.status === 429 && /per ?day/i.test(await res.clone().text())) return res;
    const wait = Math.min(2000 * 2 ** (i - 1), 15000);
    console.warn(`  API ${res.status}, retrying in ${wait / 1000}s (${i}/${tries - 1})`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
  return v;
}

// EXTRACT_MODEL may list several models, comma-separated: each is tried in turn when one is busy or out of quota
export function llmFromEnv(): LLM {
  const provider = (process.env.EXTRACT_PROVIDER ?? "anthropic").toLowerCase();
  const models = requireEnv("EXTRACT_MODEL").split(",").map((m) => m.trim()).filter(Boolean);
  let call: (model: string, system: string, messages: ChatMessage[]) => Promise<Response>;
  let read: (res: Response) => Promise<string>;

  if (provider === "anthropic") {
    const key = requireEnv("ANTHROPIC_API_KEY");
    call = (model, system, messages) =>
      postJson("https://api.anthropic.com/v1/messages", { "x-api-key": key, "anthropic-version": "2023-06-01" }, { model, max_tokens: 8000, system, messages });
    read = async (res) => {
      const data = (await res.json()) as { content: { type: string; text?: string }[] };
      return data.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    };
  } else if (provider === "openai") {
    const key = requireEnv("OPENAI_API_KEY");
    const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    call = (model, system, messages) =>
      postJson(`${base}/chat/completions`, { authorization: `Bearer ${key}` }, { model, messages: [{ role: "system", content: system }, ...messages], response_format: { type: "json_object" } });
    read = async (res) => {
      const data = (await res.json()) as { choices: { message: { content: string | null } }[] };
      return data.choices[0]?.message.content ?? "";
    };
  } else {
    throw new Error(`Unknown EXTRACT_PROVIDER "${provider}". Use "anthropic" or "openai".`);
  }

  return async (system, messages) => {
    let lastError = "";
    for (const model of models) {
      const res = await call(model, system, messages);
      if (res.ok) return read(res);
      lastError = `${provider} API ${res.status} (${model}): ${await res.text()}`;
      if (res.status !== 429 && res.status < 500) break;
      if (models.length > 1) console.warn(`  ${model} unavailable (${res.status}), trying the next model`);
    }
    throw new Error(lastError);
  };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function parseArgs(argv: string[]) {
  const args: { input?: string; id?: string; sourceUrl?: string; force: boolean } = { force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--id") args.id = argv[++i];
    else if (a === "--source-url") args.sourceUrl = argv[++i];
    else if (a === "--force") args.force = true;
    else if (a && !a.startsWith("--")) args.input = a;
  }
  return args;
}

const exists = (p: string) => access(p).then(() => true, () => false);

// npm run extract -- data/pdfs/<file>.pdf --source-url <official url> [--id <slug>] [--force]
async function main() {
  try {
    process.loadEnvFile();
  } catch {}
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.sourceUrl) {
    console.error("Usage: npm run extract -- <file.pdf|.txt> --source-url <official url> [--id <slug>] [--force]");
    process.exit(1);
  }
  const id = slugify(args.id ?? basename(args.input, extname(args.input)));
  const outPath = `data/schemes/${id}.json`;
  if ((await exists(outPath)) && !args.force) {
    console.error(`${outPath} already exists (it may be hand-verified). Pass --force to overwrite.`);
    process.exit(1);
  }

  let text = await loadText(args.input);
  if (text.length > MAX_CHARS) {
    console.warn(`Text is ${text.length} chars; truncating to ${MAX_CHARS}.`);
    text = text.slice(0, MAX_CHARS);
  }
  console.log(`Read ${text.length} chars from ${args.input}`);

  const { scheme, attempts, unverifiedClauses } = await extractScheme(text, {
    id,
    sourceUrl: args.sourceUrl,
    llm: llmFromEnv(),
    log: console.log,
  });

  await mkdir("data/schemes", { recursive: true });
  await mkdir("data/text", { recursive: true });
  await writeFile(outPath, JSON.stringify(scheme, null, 2) + "\n");
  await writeFile(`data/text/${id}.txt`, text);

  console.log(`\nSaved ${outPath} after ${attempts} attempt(s)`);
  console.log(`  ${scheme.benefits.length} benefits, ${scheme.eligibility.length} eligibility rules, ${scheme.exclusions.length} exclusions, ${scheme.documentsRequired.length} documents`);
  if (unverifiedClauses.length) {
    console.warn(`  WARNING: ${unverifiedClauses.length} sourceClause(s) not found verbatim in the source:`);
    for (const c of unverifiedClauses) console.warn(`    ${c.where}: "${c.sourceClause}"`);
  }
  console.log("Now hand-check it against the source document before using it in the demo.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
