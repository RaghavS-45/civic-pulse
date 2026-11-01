import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Disclaimer, HomeLink, LangToggle } from "./LocaleChrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "Civic Pulse · Scheme Explainer",
  description: "Understand government schemes in plain language, check your eligibility with cited rules, and get an action plan. English and Hindi.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f5c55" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="wrap">
            <Suspense fallback={<Link href="/">Civic Pulse</Link>}>
              <HomeLink />
            </Suspense>
            <Suspense fallback={null}>
              <LangToggle />
            </Suspense>
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="disclaimer">
          <Suspense fallback={null}>
            <Disclaimer />
          </Suspense>
        </footer>
      </body>
    </html>
  );
}
