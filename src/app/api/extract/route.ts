import { NextResponse } from "next/server";
import { extractScheme, pdfToText } from "@/extract";
import { rateLimited, serverLLM } from "@/lib/server-ai";
import { UPLOADED_SOURCE, type ExtractStreamEvent } from "@/lib/uploads";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 4 * 1024 * 1024; // Vercel's request body limit is 4.5 MB
const MAX_CHARS = 100_000;
// POST multipart: file (PDF) or text (pasted), optional sourceUrl. Streams NDJSON progress events.
export async function POST(req: Request) {
  const llm = serverLLM();
  if (!llm) return NextResponse.json({ error: "AI features are not configured on this server (missing EXTRACT_MODEL / API key)." }, { status: 503 });
  if (rateLimited(req, 4)) return NextResponse.json({ error: "Too many requests. Please wait a minute and try again." }, { status: 429 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Send a PDF file or pasted text." }, { status: 400 });
  const file = form.get("file");
  const pasted = form.get("text");
  const urlRaw = String(form.get("sourceUrl") ?? "").trim();
  const sourceUrl = /^https?:\/\/\S+$/.test(urlRaw) ? urlRaw : UPLOADED_SOURCE;

  let bytes: Uint8Array | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "That PDF is over 4 MB. Try a shorter document or paste the text." }, { status: 413 });
    bytes = new Uint8Array(await file.arrayBuffer());
    if (String.fromCharCode(...bytes.slice(0, 4)) !== "%PDF") return NextResponse.json({ error: "That file is not a PDF." }, { status: 400 });
  } else if (typeof pasted !== "string" || pasted.trim().length < 200) {
    return NextResponse.json({ error: "Upload a PDF, or paste at least a paragraph of the notification text." }, { status: 400 });
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ExtractStreamEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        send({ type: "reading" });
        let text: string;
        let pages = 1;
        if (bytes) ({ text, pages } = await pdfToText(bytes));
        else text = String(pasted);
        const words = (text.match(/[A-Za-zऀ-ॿ]{3,}/g) ?? []).length;
        if (words < 50) throw new Error("No readable text found. Is this a scanned PDF? Try pasting the text instead.");
        const truncated = text.length > MAX_CHARS;
        if (truncated) text = text.slice(0, MAX_CHARS);
        send({ type: "read", pages, chars: text.length, truncated });

        const r = await extractScheme(text, { id: "uploaded", sourceUrl, llm, onEvent: send });
        send({ type: "done", scheme: r.scheme, attempts: r.attempts, unverified: r.unverifiedClauses.length, sourceText: text });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const friendly = /503|overloaded|high demand|UNAVAILABLE/i.test(msg)
          ? "The AI service is busy right now. Please try again in a minute."
          : /429|quota|RESOURCE_EXHAUSTED/i.test(msg)
            ? "The AI service's free quota is used up for now. Please try again later."
            : msg.split("\n")[0]!.slice(0, 300);
        send({ type: "error", message: friendly });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
