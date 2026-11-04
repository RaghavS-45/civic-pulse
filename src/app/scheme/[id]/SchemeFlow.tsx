"use client";

import { useEffect, useRef, useState } from "react";
import { LOCALE_INFO, UI, type Locale, type UIStrings } from "@/lib/i18n";
import type { CheckResponse } from "@/lib/plan";
import { answersToProfile, type Answers, type Question } from "@/lib/questions";
import { isUploadedSource } from "@/lib/uploads";
import type { QAResult } from "@/qa";
import type { Scheme } from "@/types";

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

function Cite({ clause, sourceUrl, t, locale }: { clause: string; sourceUrl: string; t: UIStrings; locale: Locale }) {
  return (
    <details className="cite">
      <summary>{t.source}</summary>
      {locale !== "en" && <div className="small muted" style={{ marginTop: 6 }}>{t.sourceNote}</div>}
      <blockquote lang="en">“{clause}”</blockquote>
      {!isUploadedSource(sourceUrl) && <a href={sourceUrl} target="_blank" rel="noreferrer" className="small">{t.openDoc}</a>}
    </details>
  );
}

// Plays the pre-generated Gemini TTS file; falls back to the browser's own voice if the file is missing
function ListenButton({ src, text, locale, t }: { src: string | null; text: string; locale: Locale; t: UIStrings }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => {
    audio.current?.pause();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  function speakFallback() {
    if (!("speechSynthesis" in window)) return setPlaying(false);
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LOCALE_INFO[locale].speech;
    const voice = synth.getVoices().find((v) => v.lang.replace("_", "-").startsWith(u.lang.slice(0, 2)));
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = u.onerror = () => setPlaying(false);
    synth.cancel();
    synth.speak(u);
  }

  async function toggle() {
    if (playing) {
      audio.current?.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    if (!src) return speakFallback();
    if (!audio.current) {
      const a = new Audio(src);
      a.ontimeupdate = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
      a.onended = () => { setPlaying(false); setProgress(0); };
      audio.current = a;
    }
    try {
      await audio.current.play();
    } catch {
      speakFallback();
    }
  }

  return (
    <div className="listen">
      <button type="button" className="btn secondary" onClick={toggle} aria-pressed={playing}>
        {playing ? t.stop : t.listen}
      </button>
      {progress > 0 && <div className="bar" aria-hidden><span style={{ width: `${progress * 100}%` }} /></div>}
    </div>
  );
}

function AskBox({ t, locale, request }: { t: UIStrings; locale: Locale; request: Record<string, unknown> }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<QAResult | null>(null);
  const [err, setErr] = useState("");

  async function ask(question: string) {
    if (!question.trim()) return;
    setQ(question);
    setBusy(true);
    setErr("");
    setRes(null);
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...request, question, lang: locale }) });
      // A timed-out function returns a plain-text page, not JSON
      const data = await r.json().catch(() => null);
      if (!r.ok || !data) throw new Error(data?.error ?? t.aiSlow);
      setRes(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card ask">
      <h3>💬 {t.askTitle}</h3>
      <p className="muted small">{t.askHint}</p>
      <form className="askrow" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input type="text" value={q} maxLength={400} placeholder={t.askPlaceholder} onChange={(e) => setQ(e.target.value)} aria-label={t.askTitle} />
        <button className="btn" type="submit" disabled={busy || !q.trim()}>{busy ? "…" : t.askBtn}</button>
      </form>
      {!res && !busy && (
        <div className="chips">
          {t.askExamples.map((ex) => <button key={ex} type="button" className="chip" onClick={() => ask(ex)}>{ex}</button>)}
        </div>
      )}
      {busy && <p className="muted small" aria-live="polite">{t.asking}</p>}
      {err && <p className="error" role="alert">{err}</p>}
      {res && (
        <div className={`answer ${res.status}`} aria-live="polite">
          {res.status === "not_covered" && <div className="small"><b>{t.askNotCovered}</b></div>}
          {res.status === "unsupported" ? <p>{t.askUnsupported}</p> : <p className="answer-text">{res.answer}</p>}
          {res.quotes.length > 0 && (
            <>
              <div className="small muted">{t.askQuotes}</div>
              {res.quotes.map((x, i) => <blockquote key={i} lang="en">“{x.text}”</blockquote>)}
            </>
          )}
          <div className="small muted">{t.askAiNote}</div>
        </div>
      )}
    </div>
  );
}

function QuestionField({ q, value, onChange, t }: { q: Question; value: string; onChange: (v: string) => void; t: UIStrings }) {
  const inputId = `q-${q.id}`;
  if (q.kind === "confirm") {
    return (
      <div className="q" role="group" aria-labelledby={inputId}>
        <label className="prompt" id={inputId}>{q.prompt}</label>
        <div className="choices">
          {([["yes", t.yesTrue], ["no", t.no], ["unsure", t.notSure]] as const).map(([v, l]) => (
            <button key={v} type="button" className="choice" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="q">
      <label className="prompt" htmlFor={inputId}>{q.prompt}</label>
      {"hint" in q && q.hint && <div className="hint">{q.hint}</div>}
      {q.kind === "select" ? (
        <select id={inputId} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t.choose}</option>
          {q.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input id={inputId} type={q.kind === "number" ? "number" : "text"} inputMode={q.kind === "number" ? "numeric" : undefined} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {q.kind === "number" && q.unit && <div className="unit">{q.unit}</div>}
    </div>
  );
}

export default function SchemeFlow({ scheme, questions, locale, optionLabels = {}, uploaded }: { scheme: Scheme; questions: Question[]; locale: Locale; optionLabels?: Record<string, string>; uploaded?: { sourceText: string; unverified: number; header?: React.ReactNode } }) {
  const t = UI[locale];
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const listenText = [scheme.title, scheme.summary, t.whatYouGet, ...scheme.benefits.map((b) => b.description)].join(". ");
  const answered = questions.filter((q) => answers[q.id]).length;

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const profile = answersToProfile(questions, answers);
      const res = uploaded
        ? await fetch("/api/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scheme, profile, lang: locale, optionLabels }) })
        : await fetch(`/api/schemes/${scheme.id}/check`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile, lang: locale }) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error ?? t.somethingWrong);
      setResult(data);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.somethingWrong);
    } finally {
      setLoading(false);
    }
  }

  const verdictClass = result?.eligible === true ? "yes" : result?.eligible === false ? "no" : "maybe";
  const verdictText = result?.eligible === true ? t.verdictYes : result?.eligible === false ? t.verdictNo : t.verdictMaybe;

  return (
    <div lang={locale}>
      {uploaded && (
        <div className="card verdict maybe small" role="note">
          ⚠️ {t.unverifiedBanner}
          {uploaded.unverified > 0 && <> {t.unverifiedQuotes(uploaded.unverified)}</>}
        </div>
      )}
      {uploaded?.header}
      <section>
        <div className="meta muted small">{scheme.issuingAuthority}</div>
        <h1>{scheme.title}</h1>
      </section>

      <div className="section-title"><span className="step-num">1</span><h2>{t.step1}</h2></div>
      <div className="card">
        <p>{scheme.summary}</p>
        <ListenButton src={uploaded ? null : `/audio/${scheme.id}.${locale}.mp3`} text={listenText} locale={locale} t={t} />
      </div>

      <div className="card">
        <h3>{t.whatYouGet}</h3>
        <ul className="clean">
          {scheme.benefits.map((b, i) => (
            <li key={i}>
              {b.amount !== undefined && b.amount > 1 && <span className="amount">{inr(b.amount)} · </span>}
              {b.description}
              <Cite clause={b.sourceClause} sourceUrl={scheme.sourceUrl} t={t} locale={locale} />
            </li>
          ))}
        </ul>
      </div>

      <AskBox t={t} locale={locale} request={uploaded ? { scheme, sourceText: uploaded.sourceText } : { schemeId: scheme.id }} />

      <div className="section-title"><span className="step-num">2</span><h2>{t.step2}</h2></div>
      <form className="card" onSubmit={check}>
        <p className="muted small">{t.formIntro}</p>
        {questions.map((q) => (
          <QuestionField key={q.id} q={q} t={t} value={answers[q.id] ?? ""} onChange={(v) => { setAnswers((a) => ({ ...a, [q.id]: v })); setResult(null); }} />
        ))}
        <button className="btn block" type="submit" disabled={loading || answered === 0}>
          {loading ? t.checking : t.checkBtn}
        </button>
        {error && <p className="error" role="alert">{error}</p>}
      </form>

      {result && (
        <div ref={resultRef}>
          <div className="section-title"><span className="step-num">3</span><h2>{t.step3}</h2></div>
          <div className={`card verdict ${verdictClass}`} aria-live="polite">
            <div className="big">{verdictText}</div>
            <p>{result.plan.headline}</p>
            <div className="small">
              {t.conditionsMet(result.counts.passed, result.counts.total)}
              {result.counts.failed > 0 && ` · ${t.notMet(result.counts.failed)}`}
              {result.counts.missing > 0 && ` · ${t.unanswered(result.counts.missing)}`}
            </div>
            <div className="pipeline" aria-hidden>
              <span className="node">{t.pipeAnswers}</span>→
              <span className="node">{t.pipeRules(result.counts.total)}</span>→
              <span className="node">{t.pipeCode}</span>
            </div>
          </div>

          <div className="card">
            <h3>{t.howDecided}</h3>
            <ul className="clean trace">
              {result.trace.map((s, i) => (
                <li key={i}>
                  <span className="icon" aria-label={s.outcome}>{s.outcome === "pass" ? "✅" : s.outcome === "fail" ? "❌" : "❔"}</span>
                  <div>
                    <div>{s.label}</div>
                    <div className="kv">{t.ruleLabel}: <b>{s.required}</b> · {t.yourAnswer}: <b>{s.yourAnswer}</b></div>
                    <Cite clause={s.sourceClause} sourceUrl={scheme.sourceUrl} t={t} locale={locale} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {result.eligible !== false && (
            <>
              <div className="section-title"><span className="step-num">4</span><h2>{t.step4}</h2></div>

              {result.plan.findOutFirst.length > 0 && (
                <div className="card verdict maybe">
                  <h3>{t.findOutFirst}</h3>
                  <ul>{result.plan.findOutFirst.map((f, i) => <li key={i}>{f}</li>)}</ul>
                </div>
              )}

              {result.plan.documents.length > 0 && (
                <div className="card">
                  <h3>{t.docsReady}</h3>
                  {result.plan.documents.map((d, i) => (
                    <label key={i} className="check"><input type="checkbox" /> <span>{d}</span></label>
                  ))}
                </div>
              )}

              <div className="card">
                <h3>{t.howToApply}</h3>
                <ol className="steps">{result.plan.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                {result.plan.portalUrl && (
                  <a className="btn block" href={result.plan.portalUrl} target="_blank" rel="noreferrer">{t.openPortal}</a>
                )}
              </div>

              {result.plan.doubleCheck.length > 0 && (
                <div className="card">
                  <h3>{t.makeSure}</h3>
                  <ul className="clean">
                    {result.plan.doubleCheck.map((x, i) => (
                      <li key={i}>{x.description}<Cite clause={x.sourceClause} sourceUrl={scheme.sourceUrl} t={t} locale={locale} /></li>
                    ))}
                  </ul>
                </div>
              )}

              {result.plan.draftApplication && (
                <div className="card">
                  <h3>{t.draftTitle}</h3>
                  <p className="muted small">{t.draftHint}</p>
                  <textarea className="draft" readOnly value={result.plan.draftApplication} aria-label={t.draftTitle} />
                  <div className="row" style={{ marginTop: 10 }}>
                    <button type="button" className="btn secondary" onClick={async () => { await navigator.clipboard.writeText(result.plan.draftApplication); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                      {copied ? t.copied : t.copy}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {result.eligible === false && (
            <div className="card">
              <p>{t.ineligibleHelp}</p>
              {!isUploadedSource(scheme.sourceUrl) && <a className="btn secondary" href={scheme.sourceUrl} target="_blank" rel="noreferrer">{t.officialDoc}</a>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
