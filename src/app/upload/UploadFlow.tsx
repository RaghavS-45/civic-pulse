"use client";

import { useState } from "react";
import { UI, type Locale } from "@/lib/i18n";
import { buildQuestions } from "@/lib/questions";
import type { ExtractStreamEvent } from "@/lib/uploads";
import { applyTranslation, type SchemeTranslation } from "@/translation-schema";
import type { Scheme } from "@/types";
import SchemeFlow from "../scheme/[id]/SchemeFlow";

type LogLine = { icon: string; text: string; bad?: boolean };

interface Result {
  scheme: Scheme;
  sourceText: string;
  unverified: number;
}

export default function UploadFlow({ locale }: { locale: Locale }) {
  const t = UI[locale];
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [hindi, setHindi] = useState<SchemeTranslation | null>(null);
  const [translating, setTranslating] = useState(false);

  const add = (l: LogLine) => setLog((prev) => [...prev, l]);

  function describe(e: ExtractStreamEvent) {
    switch (e.type) {
      case "reading": return add({ icon: "📄", text: t.stepReading });
      case "read":
        add({ icon: "✅", text: t.stepRead(e.pages, e.chars) });
        if (e.truncated) add({ icon: "⚠️", text: t.stepTruncated, bad: true });
        return;
      case "attempt": return add({ icon: "🤖", text: t.stepAttempt(e.attempt, e.max) });
      case "rejected": return add({ icon: "↩️", text: t.stepRejected(e.reason), bad: true });
      case "validated": return add({ icon: e.unverified ? "⚠️" : "🔍", text: t.stepValidated(e.clauses, e.unverified), bad: e.unverified > 0 });
      case "done": return add({ icon: "✅", text: t.stepDone });
      case "error": return add({ icon: "❌", text: e.message, bad: true });
    }
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setLog([]);
    setError("");
    setResult(null);
    setHindi(null);
    const body = new FormData();
    if (file) body.append("file", file);
    else body.append("text", text);
    if (sourceUrl.trim()) body.append("sourceUrl", sourceUrl.trim());
    try {
      const res = await fetch("/api/extract", { method: "POST", body });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? t.somethingWrong);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as ExtractStreamEvent;
          describe(ev);
          // Let the reader see the final check before the result replaces the log
          if (ev.type === "done") await new Promise((r) => setTimeout(r, 1800)).then(() => setResult({ scheme: ev.scheme, sourceText: ev.sourceText, unverified: ev.unverified }));
          if (ev.type === "error") setError(ev.message);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.somethingWrong);
    } finally {
      setRunning(false);
    }
  }

  async function translate() {
    if (!result) return;
    setTranslating(true);
    try {
      const res = await fetch("/api/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scheme: result.scheme }) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error ?? t.aiSlow);
      setHindi(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.somethingWrong);
    } finally {
      setTranslating(false);
    }
  }

  if (result) {
    const flowLocale: Locale = hindi ? "hi" : "en";
    const scheme = hindi ? applyTranslation(result.scheme, hindi) : result.scheme;
    const labels = hindi?.optionLabels ?? {};
    const header = (
      <>
      <details className="card small" open>
        <summary><b>{t.howExtracted}</b></summary>
        <ul className="steps-log" style={{ marginTop: 8 }}>
          {log.map((l, i) => <li key={i} className={l.bad ? "bad" : undefined}><span>{l.icon}</span><span>{l.text}</span></li>)}
        </ul>
      </details>
      <div className="row" style={{ marginBottom: 12 }}>
        <button type="button" className="btn secondary" onClick={() => { setResult(null); setLog([]); setHindi(null); }}>← {t.startOver}</button>
        {!hindi && (
          <button type="button" className="btn secondary" onClick={translate} disabled={translating}>{translating ? t.translating : t.translateBtn}</button>
        )}
      </div>
      </>
    );
    return (
      <SchemeFlow
        key={flowLocale}
        scheme={scheme}
        locale={flowLocale}
        optionLabels={labels}
        questions={buildQuestions(scheme, flowLocale, labels)}
        uploaded={{ sourceText: result.sourceText, unverified: result.unverified, header: <>{header}{error && <p className="error">{error}</p>}</> }}
      />
    );
  }

  return (
    <div lang={locale}>
      <section className="hero">
        <h1>{t.uploadTitle}</h1>
        <p>{t.uploadIntro}</p>
      </section>
      <form className="card" onSubmit={run}>
        <div className="q">
          <label className="prompt" htmlFor="pdf">{t.pickFile}</label>
          <input id="pdf" type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={running} />
        </div>
        {!file && (
          <div className="q">
            <label className="prompt" htmlFor="paste">{t.orPaste}</label>
            <textarea id="paste" value={text} onChange={(e) => setText(e.target.value)} disabled={running} />
          </div>
        )}
        <div className="q">
          <label className="prompt" htmlFor="src">{t.sourceUrlLabel}</label>
          <input id="src" type="text" inputMode="url" placeholder="https://" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} disabled={running} />
        </div>
        <button className="btn block" type="submit" disabled={running || (!file && text.trim().length < 200)}>
          {running ? t.working : t.startBtn}
        </button>
      </form>
      {log.length > 0 && (
        <div className="card" aria-live="polite">
          <ul className="steps-log">
            {log.map((l, i) => <li key={i} className={l.bad ? "bad" : undefined}><span>{l.icon}</span><span>{l.text}</span></li>)}
            {running && <li><span>⏳</span><span className="muted">{t.working}</span></li>}
          </ul>
        </div>
      )}
      {error && !running && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
