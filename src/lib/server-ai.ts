import { readFile } from "node:fs/promises";
import path from "node:path";
import { llmFromEnv, type LLM } from "../extract";

// AI features need a key on the server (Vercel env vars). Everything else works without one.
export function serverLLM(): LLM | null {
  if (!process.env.EXTRACT_MODEL) return null;
  try {
    return llmFromEnv();
  } catch {
    return null;
  }
}

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function readSourceText(id: string): Promise<string | null> {
  if (!SAFE_ID.test(id)) return null;
  try {
    return await readFile(path.join(process.cwd(), "data", "text", `${id}.txt`), "utf8");
  } catch {
    return null;
  }
}

// Best-effort per-instance limit so a public demo can't burn the API quota
const hits = new Map<string, number[]>();
export function rateLimited(req: Request, limit = 8, windowMs = 60_000): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > limit;
}
