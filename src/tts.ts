import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { postJson } from "./extract";
import { SchemeTranslationSchema, applyTranslation } from "./translation-schema";
import { SchemeSchema, type Scheme } from "./types";

const INTRO: Record<string, { benefits: string }> = {
  en: { benefits: "What you get." },
  hi: { benefits: "आपको क्या मिलेगा।" },
};

export function narration(s: Scheme, lang: string): string {
  return [s.title + ".", s.summary, INTRO[lang]?.benefits ?? "", ...s.benefits.map((b) => b.description + ".")].join("\n");
}

async function synthesize(text: string, lang: string): Promise<Buffer> {
  const key = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Set GEMINI_API_KEY (or OPENAI_API_KEY with a Gemini key) in .env");
  const model = process.env.TTS_MODEL || "gemini-3.8-flash-tts";
  const voice = process.env.TTS_VOICE || "Kore";
  // Send only the narration: any instruction in the text gets read aloud
  const res = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { "x-goog-api-key": key },
    {
      contents: [{ parts: [{ text }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
    },
  );
  if (!res.ok) throw new Error(`Gemini TTS ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data: string } }[] } }[] };
  const b64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error("Gemini TTS returned no audio");
  return Buffer.from(b64, "base64");
}

// npm run tts -- <scheme-id> <lang> [--force]   writes public/audio/<id>.<lang>.mp3 (needs ffmpeg)
async function main() {
  try {
    process.loadEnvFile();
  } catch {}
  const [id, lang] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!id || !lang) {
    console.error("Usage: npm run tts -- <scheme-id> <lang> [--force]");
    process.exit(1);
  }
  const out = `public/audio/${id}.${lang}.mp3`;
  if (!process.argv.includes("--force") && (await access(out).then(() => true, () => false))) {
    console.error(`${out} exists. Pass --force to regenerate.`);
    process.exit(1);
  }
  let scheme = SchemeSchema.parse(JSON.parse(await readFile(`data/schemes/${id}.json`, "utf8")));
  if (lang !== "en") {
    const t = SchemeTranslationSchema.parse(JSON.parse(await readFile(`data/i18n/${id}.${lang}.json`, "utf8")));
    scheme = applyTranslation(scheme, t);
  }
  const text = narration(scheme, lang);
  console.log(`Synthesizing ${text.length} chars…`);
  const wav = await synthesize(text, lang);
  await mkdir("public/audio", { recursive: true });
  const tmp = `${out}.wav`;
  await writeFile(tmp, wav);
  // Some TTS models return a WAV file, others raw 24 kHz 16-bit mono PCM
  const isWav = wav.subarray(0, 4).toString("ascii") === "RIFF";
  const input = isWav ? ["-i", tmp] : ["-f", "s16le", "-ar", "24000", "-ac", "1", "-i", tmp];
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...input, "-ac", "1", "-b:a", "48k", out]);
  await unlink(tmp);
  console.log(`Saved ${out}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
