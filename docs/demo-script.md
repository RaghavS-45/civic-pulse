# Demo video script (target: 2 min 40 s)

**Persona:** Ramesh, 42, a self-employed tailor. He reads Hindi better than English.
**Story:** a 60-page government PDF → Ramesh hears it explained in Hindi → finds out he qualifies, sees *why* with the official line → leaves with a document checklist and a filled-in application.

The submission asks to show "real-time AI reasoning and tool usage", so the video opens with the extraction pipeline running live in the terminal, then shows the app.

---

## Before recording

- [ ] Run the live site (or `npm run build && npm start` locally). Use a phone-sized browser window (Chrome DevTools → iPhone 12/13, 390 px wide).
- [ ] Clear previous answers: open each scheme page fresh.
- [ ] Terminal: large font (18+ pt), dark theme, in the project folder, `.env` filled in.
- [ ] **Record the terminal part first, early in the day.** It uses the Gemini free tier, which can be overloaded or out of quota later. Use `gemini-3.5-flash` (about 20 seconds for a short PDF).
- [ ] Use a demo id so you don't overwrite the verified file:
  `EXTRACT_MODEL=gemini-3.5-flash npm run extract -- data/pdfs/atal-pension-yojana.pdf --id apy-demo --source-url "https://www.pfrda.org.in/documents/33652/307349/APY%20Subscriber%20Information%20Brochure%20English"`
  Delete `data/schemes/apy-demo.json` and `data/text/apy-demo.txt` afterwards.
- [ ] Check the sound is on for the Hindi narration.

---

## Shot list

### 1. Hook (0:00–0:15)
**Screen:** the PM Vishwakarma guidelines PDF, scrolling fast through dense pages.

> "This is the official guideline for PM Vishwakarma, a scheme for India's tailors, carpenters and barbers. It's 64 pages of legal English. Ramesh is a tailor. He doesn't know if he qualifies, or what to do next. We built Civic Pulse for him."

### 2. The AI pipeline, live (0:15–0:50)
**Screen:** terminal. Run the extract command above.

> "First, the AI reads the government document once. Gemini turns the PDF into structured rules, benefits and steps."

Let the output show `LLM call 1/4` → `Saved … after N attempt(s)`. If it shows a `rejected:` line, point at it:

> "Every rule has to quote the official document word for word. If the AI paraphrases or invents a line, our code rejects it and makes it try again."

Open the JSON and highlight one rule with its `sourceClause`. Then run:
`npm run verify -- atal-pension-yojana`

> "Every quote is checked against the PDF, and we hand-verify each scheme before it goes live. After that, the AI is out of the loop. Eligibility is decided by plain code."

### 3. Explainer in Hindi (0:50–1:15)
**Screen:** app home page. Tap **हिंदी**, then **पीएम विश्वकर्मा**.

> "Ramesh opens the app in Hindi."

Tap **🔊 सुनें** and let 5–6 seconds of narration play, then stop it.

> "He can listen instead of reading. Every benefit links to its source."

Tap **स्रोत** under the ₹15,000 tool kit benefit to show the English quote.

### 4. The check (1:15–1:55)
**Screen:** scroll to **क्या आप आवेदन कर सकते हैं?**

Fill in: trade **दर्जी**, age **42**, and **हाँ** for the yes/no questions. Tap **मेरी पात्रता जाँचें**.

> "Six simple questions. No documents uploaded, no login."

The result: **✅ आप आवेदन कर सकते हैं** · "6 में से 6 शर्तें पूरी".
Point at the bar *"आपके जवाब → सरकारी PDF के 6 नियम → कोड से जाँचा गया, AI का अंदाज़ा नहीं"*.

> "The verdict comes from code, not an AI guess. Each condition shows the rule, Ramesh's answer, and the exact line from the government document."

Expand **स्रोत** on the age rule.

### 5. What changes the answer (1:55–2:15)
Scroll back up. Change **"आप या आपके परिवार का कोई भी सदस्य सरकारी नौकरी में न हो"** to **नहीं**. Check again.

> "If his wife had a government job, the answer changes, and Ramesh sees exactly which rule and which official line caused it."

Show **❌ आप पात्र नहीं हैं** with the one failed rule. Change it back to **हाँ** and check again.

### 6. Action plan (2:15–2:35)
Scroll to **आपकी कार्य योजना**.

> "Then, what to actually do: the documents to keep ready, the steps, the official portal, and an application already filled in from his answers. He just adds his name and mobile number."

Tick two checklist items, scroll through the draft application, tap **टेक्स्ट कॉपी करें**.

### 7. Close (2:35–2:45)
**Screen:** home page in Hindi showing all five schemes.

> "Five real schemes: for artisans, farmers, workers, daughters and students. In English and Hindi, every rule cited from the official source. Adding a scheme or a language takes minutes. Civic Pulse, by Team Codesh."

---

## Backup lines if something breaks

- **Extraction is slow or fails live:** cut to a pre-recorded terminal clip, or show `npm run verify -- pm-vishwakarma` (works offline) and say "this one took about two minutes to extract."
- **Audio doesn't play:** "Each scheme has narration in both languages", then move on.
