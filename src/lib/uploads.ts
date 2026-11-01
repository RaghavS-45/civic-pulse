import type { ExtractEvent } from "../extract";
import type { Scheme } from "../types";

// sourceUrl used when an uploaded document has no official link; the UI hides "open document" for it
export const UPLOADED_SOURCE = "https://uploaded.local/document";

export const isUploadedSource = (url: string) => url.startsWith("https://uploaded.local/");

export type ExtractStreamEvent =
  | { type: "reading" }
  | { type: "read"; pages: number; chars: number; truncated: boolean }
  | ExtractEvent
  | { type: "done"; scheme: Scheme; attempts: number; unverified: number; sourceText: string }
  | { type: "error"; message: string };
