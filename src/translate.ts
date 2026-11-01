import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { MAX_RETRIES, llmFromEnv, parseJsonLoose, type ChatMessage, type LLM } from "./extract";
import { SchemeTranslationSchema, translationMismatches, translationSource, type SchemeTranslation } from "./translation-schema";
import { SchemeSchema, type Scheme } from "./types";

export const LANGUAGE_NAMES: Record<string, string> = {
  hi: "Hindi", bn: "Bengali", ta: "Tamil", te: "Telugu", mr: "Marathi", gu: "Gujarati",
  kn: "Kannada", ml: "Malayalam", pa: "Punjabi", or: "Odia", ur: "Urdu", as: "Assamese",
};

export function translationPrompt(lang: string): string {
  const name = LANGUAGE_NAMES[lang] ?? lang;
  return `You translate Indian government scheme information into ${name} for ordinary citizens, many with limited schooling.

Rules:
- Use simple, everyday spoken ${name} that a Class 8 student understands. Prefer common words over formal or Sanskritized ones (for ${name === "Hindi" ? 'example "आमदनी" over "आय", "पक्का करें" over "सुनिश्चित करें"' : "example, the words people use at a local market"}).
- Keep every number, ₹ amount, percentage and date exactly as in the input. Write digits as 0-9.
- Keep acronyms and portal names in Latin script as they are: PMEGP, MUDRA, SVANidhi, NSP, CSC, AICTE, DigiLocker, UPI, DBT, PFMS, Aadhaar etc. Keep official scheme names recognisable (you may add the ${name} name before it).
- Do not add, drop, merge or reorder items. Every array must have exactly as many items as the input.
- In "optionLabels", translate only the values (the keys stay in English).
- Output one JSON object with exactly the same keys as the input. No markdown, no commentary.`;
}

export async function translateScheme(scheme: Scheme, lang: string, llm: LLM, log: (m: string) => void = () => {}): Promise<SchemeTranslation> {
  const source = translationSource(scheme);
  const messages: ChatMessage[] = [{ role: "user", content: `Translate this into ${LANGUAGE_NAMES[lang] ?? lang}:\n\n${JSON.stringify(source, null, 2)}` }];
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    log(`LLM call ${attempt}/${MAX_RETRIES + 1}`);
    const raw = await llm(translationPrompt(lang), messages);
    messages.push({ role: "assistant", content: raw });
    try {
      const obj = parseJsonLoose(raw) as Record<string, unknown>;
      const t = SchemeTranslationSchema.parse({ ...obj, schemeId: scheme.id, lang });
      const issues = translationMismatches(scheme, t);
      if (!issues.length) return t;
      lastError = issues.join("\n");
    } catch (err) {
      lastError = err instanceof z.ZodError ? z.prettifyError(err) : err instanceof Error ? err.message : String(err);
    }
    log(`  rejected: ${lastError.split("\n")[0]}`);
    messages.push({ role: "user", content: `That was not valid. Fix these problems and return the full JSON object only:\n${lastError}` });
  }
  throw new Error(`Translation failed after ${MAX_RETRIES + 1} attempts:\n${lastError}`);
}

// npm run translate -- <scheme-id> <lang> [--force]
async function main() {
  try {
    process.loadEnvFile();
  } catch {}
  const [id, lang] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const force = process.argv.includes("--force");
  if (!id || !lang) {
    console.error("Usage: npm run translate -- <scheme-id> <lang> [--force]   e.g. pm-vishwakarma hi");
    process.exit(1);
  }
  const out = `data/i18n/${id}.${lang}.json`;
  if (!force && (await access(out).then(() => true, () => false))) {
    console.error(`${out} already exists (it may be reviewed). Pass --force to overwrite.`);
    process.exit(1);
  }
  const scheme = SchemeSchema.parse(JSON.parse(await readFile(`data/schemes/${id}.json`, "utf8")));
  const t = await translateScheme(scheme, lang, llmFromEnv(), console.log);
  await mkdir("data/i18n", { recursive: true });
  await writeFile(out, JSON.stringify(t, null, 2) + "\n");
  console.log(`Saved ${out}. Have a ${LANGUAGE_NAMES[lang] ?? lang} speaker review it before the demo.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
