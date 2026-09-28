# ATS scoring and tailor method

Scoring runs entirely in the browser (`docs/engine.js`). It is **not** Workday, Taleo, or any vendor ATS.

## Score mix

- Keyword coverage vs terms extracted from the JD (highest weight)
- Standard headings (summary, skills, experience, education, contact)
- Quantified results (`%`, `$`, large numbers)
- Length band (about 350–900 words)

**Matching** = JD terms found in the resume. **Missing** = JD terms not found.

**Why this resume may not be selected** is derived from the same checks: score under 60, many missing tokens, weak contact parse, no Experience heading, few metrics.

## Tailor

`tailorResume` rebuilds HTML:

1. Keep the first name/role/contact lines.
2. Write an executive summary aimed at the first line of the JD, using metrics already in the resume.
3. Build Core Competencies from matched **and** previously missing JD terms.
4. Keep remaining resume lines as Professional Experience / Education (no new jobs).

After tailor, the app scores the new text and shows the **current** score and matching keywords.

## AI-writing check

The previous heuristic AI-likeness scorer remains in `engine.js` (`scoreAiWriting`) for optional reuse. The main screen is JD match, not AI detection.
