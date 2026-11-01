import type { Metadata } from "next";
import { toLocale } from "@/lib/i18n";
import UploadFlow from "./UploadFlow";

export const metadata: Metadata = { title: "Explain any notification · Civic Pulse" };

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const locale = toLocale((await searchParams).lang);
  return <UploadFlow key={locale} locale={locale} />;
}
