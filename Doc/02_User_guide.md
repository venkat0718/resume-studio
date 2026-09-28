# User guide

## Layout

Three columns on a wide screen:

1. **Job description** — paste the full posting.
2. **Resume editor** — paste, attach a file, or load the fictional sample.
3. **Score & keywords** — matching, missing, reject reasons.

On a narrow window the columns stack: JD, then editor, then scores. Each pane scrolls on its own so toolbars and chips do not sit on top of other content.

## Typical path

1. Paste the JD on the left.
2. Paste the resume in the editor, or **Attach resume (txt / html)**.
3. Click **Analyse match**.
4. Read matching (green), missing (red), and “why this resume may not be selected”.
5. Click **Write tailored resume**. The editor is rewritten from **your existing experience** plus JD language in the summary and skills line.
6. Check the new score and matching keywords on the right.
7. **Save PDF** or **Save Word**.

## Fonts

The editor font list loads Google Fonts (Carlito as a Calibri stand-in, Arimo, Tinos, Caladea, Cousine, EB Garamond, Libre Baskerville, Merriweather, PT Serif, Noto Serif/Sans, Open Sans, Source Sans 3, Roboto, Lato, Nunito, Work Sans, IBM Plex Sans). System Arial, Georgia, and Times New Roman remain available.

## What tailoring does and does not do

- Does: keep name, contact, and experience lines from the attached resume; add a JD-aligned summary; add a skills line that includes JD terms so ATS parsers can see them.
- Does not: invent employers, dates, or achievements that are not already in the resume text.

## Sample

**Load sample** fills a fictional Jordan Lee resume for a demo. Do not publish real personal data on the public GitHub Pages site if you want it to stay private.

## Local PDF/Word vs browser

When you run Flask (`python app.py`), Save PDF / Word uses the Python exporters. On GitHub Pages there is no `/export` API, so PDF uses the in-browser engine and Word downloads a `.doc` HTML file you can open in Word and save as `.docx`.
