# Demo video script (target: 2 min 50 s)

**Persona:** Ramesh, 42, a self-employed tailor. He reads Hindi better than English.
**Story:** the AI reads a government document live → Ramesh hears his scheme explained in Hindi, asks his own question, finds out he qualifies and *why*, and leaves with a checklist and a filled-in application.

The submission asks for "real-time AI reasoning and tool usage", so the video opens with the live upload, where the progress log shows each AI step and each check.

---

## Before recording

- [ ] Gemini key has quota: billing enabled, or record right after the daily reset (about 1:30 pm IST). Test one upload and one question first.
- [ ] Use the live site in a phone-sized window (Chrome DevTools → iPhone 12/13, 390 px wide).
- [ ] Have `atal-pension-yojana.pdf` ready to upload (2 pages, fastest). It's in `data/pdfs/`.
- [ ] Open each page fresh so no old answers are filled in.
- [ ] Sound on for the Hindi narration.

---

## Shot list

### 1. Hook (0:00–0:12)
**Screen:** the PM Vishwakarma guidelines PDF, scrolling fast through dense pages.

> "Government schemes are written like this: 64 pages of legal English. The tailors and farmers they're meant for can't use them. Civic Pulse fixes that."

### 2. The AI at work, live (0:12–0:50)
**Screen:** home page → **Explain any notification** → choose `atal-pension-yojana.pdf` → **Explain this document**.

> "Give it any government document. The AI reads it and pulls out every rule, benefit and step."

Let the progress log fill in: *Read 2 pages… AI is reading the rules…* If a **Rejected** line appears, point at it:

> "Every rule has to quote the document word for word. Here the AI got one wrong, so our code rejected it and made it try again."

When it finishes, point at the yellow banner:

> "It's clearly marked as AI-extracted. The five schemes on our home page went further: each was checked by a person against the PDF."

*(If the upload is slow, cut the waiting in editing.)*

### 3. Explainer in Hindi (0:50–1:10)
**Screen:** home page → **हिंदी** → **पीएम विश्वकर्मा**.

> "Ramesh opens his scheme in Hindi."

Tap **🔊 सुनें** for 5–6 seconds, then stop.

> "He can listen instead of reading."

### 4. Ramesh asks his own question (1:10–1:30)
**Screen:** the **💬 सवाल पूछें** box. Tap the example **"क्या मेरी बहन भी आवेदन कर सकती है?"**

> "He wonders if his sister can apply too. The answer comes only from the official document, with the exact lines it relies on, and each line is checked against the PDF."

Point at the quoted English line under the answer.

### 5. The check (1:30–2:05)
**Screen:** scroll to **क्या आप आवेदन कर सकते हैं?** Trade **दर्जी**, age **42**, **हाँ** for the yes/no questions → **मेरी पात्रता जाँचें**.

Result: **✅ आप आवेदन कर सकते हैं** · "6 में से 6 शर्तें पूरी". Point at *"कोड से जाँचा गया, AI का अंदाज़ा नहीं"*.

> "Eligibility is decided by plain code, not an AI guess. Each condition shows the rule, his answer and the official line."

Change **"आप या आपके परिवार का कोई भी सदस्य सरकारी नौकरी में न हो"** to **नहीं** → check again → **❌**.

> "If his wife had a government job, he'd see exactly which rule rules him out."

Change it back and check again.

### 6. Action plan (2:05–2:30)
Scroll to **आपकी कार्य योजना**.

> "Then what to actually do: documents to keep ready, the steps, the official portal, and an application already filled in from his answers."

Tick two checklist items, scroll the draft, tap **टेक्स्ट कॉपी करें**.

### 7. Close (2:30–2:50)
**Screen:** Hindi home page showing all five schemes.

> "Five verified schemes for artisans, farmers, workers, daughters and students. Any other notification, live. English and Hindi, every answer quoted from the official source. Civic Pulse, by Team Codesh."

---

## Backup if something breaks

- **Upload says the AI is busy or out of quota:** wait a minute and retry, or cut to a recording made earlier.
- **A question fails:** move on. The rest of the demo doesn't need the AI.
- **Audio doesn't play:** "Every scheme has narration in both languages", then move on.
