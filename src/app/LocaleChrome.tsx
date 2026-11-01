"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LOCALES, LOCALE_INFO, UI, toLocale } from "@/lib/i18n";

export function useLocale() {
  return toLocale(useSearchParams().get("lang"));
}

export function LangToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  return (
    <nav className="lang" aria-label="Language">
      {LOCALES.map((l) => (
        <Link key={l} href={l === "en" ? pathname : `${pathname}?lang=${l}`} aria-current={l === locale ? "true" : undefined} lang={l}>
          {LOCALE_INFO[l].native}
        </Link>
      ))}
    </nav>
  );
}

export function HomeLink() {
  const locale = useLocale();
  return <Link href={locale === "en" ? "/" : `/?lang=${locale}`}>Civic Pulse</Link>;
}

export function Disclaimer() {
  const locale = useLocale();
  return <div className="wrap" lang={locale}>{UI[locale].disclaimer}</div>;
}
