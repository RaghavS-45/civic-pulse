import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { SchemeSchema, type Scheme } from "./types";

// Compares letters and digits only, so PDF line breaks, hyphenation, quotes and rupee symbols don't matter
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/₹|\brs\.?|\binr\b/g, "rs")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export interface ClauseRef {
  where: string;
  sourceClause: string;
}

export function allClauses(scheme: Scheme): ClauseRef[] {
  return [
    ...scheme.benefits.map((b, i) => ({ where: `benefits[${i}]`, sourceClause: b.sourceClause })),
    ...scheme.eligibility.map((r, i) => ({ where: `eligibility[${i}]`, sourceClause: r.sourceClause })),
    ...scheme.exclusions.map((e, i) => ({ where: `exclusions[${i}]`, sourceClause: e.sourceClause })),
  ];
}

export function findUnverifiedClauses(scheme: Scheme, sourceText: string): ClauseRef[] {
  const haystack = normalizeForMatch(sourceText);
  return allClauses(scheme).filter((c) => !haystack.includes(normalizeForMatch(c.sourceClause)));
}

// npm run verify -- <id>   re-checks data/schemes/<id>.json against data/text/<id>.txt
async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("Usage: npm run verify -- <scheme-id>");
    process.exit(1);
  }
  const scheme = SchemeSchema.parse(JSON.parse(await readFile(`data/schemes/${id}.json`, "utf8")));
  const text = await readFile(`data/text/${id}.txt`, "utf8");
  const bad = findUnverifiedClauses(scheme, text);
  const total = allClauses(scheme).length;
  console.log(`${scheme.title}: ${total - bad.length}/${total} source clauses found verbatim in the source text`);
  for (const c of bad) console.log(`  NOT FOUND ${c.where}: "${c.sourceClause}"`);
  process.exit(bad.length ? 2 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
