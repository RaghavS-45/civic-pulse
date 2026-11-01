import Link from "next/link";
import { UI, toLocale } from "@/lib/i18n";
import { clauseCount } from "@/lib/schemes";
import { localizedSchemes } from "@/lib/translations";

export default async function Home({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const locale = toLocale((await searchParams).lang);
  const t = UI[locale];
  const q = locale === "en" ? "" : `?lang=${locale}`;
  return (
    <div lang={locale}>
      <section className="hero">
        <h1>{t.heroTitle}</h1>
        <p>{t.heroText}</p>
      </section>

      {localizedSchemes(locale).map(({ scheme: s }) => (
        <Link key={s.id} href={`/scheme/${s.id}${q}`} className="card link">
          <div className="meta">{s.issuingAuthority}</div>
          <h2>{s.title}</h2>
          <p className="muted">{s.summary.split(/(?<=[.।])\s+/).slice(0, 2).join(" ")}</p>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <span className="pill">{t.citedBadge(clauseCount(s))}</span>
            <span className="cta">{t.checkCta}</span>
          </div>
        </Link>
      ))}

      <Link href={`/upload${q}`} className="card upload-cta">
        <p>{t.uploadCtaText}</p>
        <span className="cta">{t.uploadCta}</span>
      </Link>
    </div>
  );
}
