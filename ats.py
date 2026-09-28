"""Local ATS scoring, keyword filters, and ATS-friendly resume formatting."""
from __future__ import annotations

import re
from collections import Counter

STOP = {
    "about", "above", "after", "again", "against", "along", "also", "among",
    "and", "any", "are", "because", "been", "before", "being", "below", "between",
    "both", "but", "can", "could", "did", "does", "doing", "down", "during", "each",
    "for", "from", "further", "had", "has", "have", "having", "here", "how",
    "into", "its", "just", "more", "most", "not", "now", "off", "once", "only",
    "other", "our", "out", "over", "own", "same", "should", "some", "such",
    "than", "that", "the", "their", "them", "then", "there", "these", "they",
    "this", "those", "through", "under", "until", "very", "was", "were", "what",
    "when", "where", "which", "while", "who", "will", "with", "would", "your",
    "you", "role", "team", "work", "years", "year", "plus", "including", "across",
    "within", "using", "used", "well", "able", "must", "need", "needs", "required",
    "requirement", "requirements", "experience", "experiences", "skills", "skill",
    "strong", "good", "great", "please", "job", "position", "candidate", "applicants",
}

SKILL_PHRASES = [
    "program management", "project management", "portfolio management",
    "change management", "change leader", "delivery governance", "itil",
    "agile", "scrum", "kanban", "waterfall", "hybrid delivery",
    "certified scrum master", "csm", "devops", "ci/cd", "cicd",
    "cloud", "cloud-native", "legacy modernization", "re-platforming",
    "stakeholder management", "steering committee", "vendor management",
    "budget", "kpi", "sla", "pmo", "servicenow", "jira", "power bi",
    "itil", "oracle", "oce", "ocp", "data migration", "process automation",
    "people leadership", "talent development", "matrix", "apac",
    "infrastructure", "operations", "transformation", "governance",
    "risk management", "financial governance", "it strategy",
    "business-it alignment", "follow-the-sun", "mttr", "csat",
]

SECTION_PATTERNS = {
    "contact": r"(phone|email|linkedin|location|@)",
    "summary": r"(executive summary|professional summary|profile|summary)\b",
    "skills": r"(core competencies|technical skill|skills|skillset|competencies)\b",
    "experience": r"(professional experience|work experience|employment|experience)\b",
    "education": r"(education|certification|academic)\b",
}


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower())


def extract_keywords(jd: str) -> list[dict]:
    text = _norm(jd)
    found = []
    seen = set()
    for phrase in sorted(SKILL_PHRASES, key=len, reverse=True):
        if phrase in text and phrase not in seen:
            seen.add(phrase)
            found.append({"term": phrase, "category": _category(phrase)})
    for m in re.finditer(r"\b[A-Z][A-Za-z][A-Za-z0-9+/#.&-]{2,}\b", jd or ""):
        term = m.group(0)
        key = term.lower()
        if key in STOP or key in seen or len(key) < 3:
            continue
        seen.add(key)
        found.append({"term": key, "category": _category(key)})
    tokens = re.findall(r"[a-z][a-z0-9+/#.&-]{3,}", text)
    counts = Counter(t for t in tokens if t not in STOP)
    for tok, n in counts.most_common(40):
        if tok in seen or n < 2:
            continue
        seen.add(tok)
        found.append({"term": tok, "category": _category(tok)})
    return found[:80]


def _category(term: str) -> str:
    t = term.lower()
    if t in {"jira", "servicenow", "power bi", "oracle", "oce", "ocp"}:
        return "tools"
    if t in {"csm", "itil", "certified scrum master"}:
        return "certs"
    if any(x in t for x in ("leader", "manager", "head of", "director", "change")):
        return "titles"
    if any(x in t for x in ("agile", "scrum", "devops", "cloud", "governance", "budget", "sla")):
        return "skills"
    return "keywords"


def html_to_text(html: str) -> str:
    from bs4 import BeautifulSoup

    return BeautifulSoup(html or "", "html.parser").get_text("\n", strip=True)


def score_ats(resume_text: str, jd_text: str) -> dict:
    resume = _norm(resume_text)
    jd = (jd_text or "").strip()
    keywords = extract_keywords(jd) if jd else extract_keywords(resume_text)
    matched, missing = [], []
    for item in keywords:
        present = item["term"] in resume
        row = {**item, "matched": present}
        (matched if present else missing).append(row)

    denom = max(len(keywords), 1)
    keyword_score = round(100 * len(matched) / denom)

    section_hits = {
        name: bool(re.search(pat, resume, re.I)) for name, pat in SECTION_PATTERNS.items()
    }
    # contact can also be inferred from email/phone
    if re.search(r"[\w.+-]+@[\w.-]+\.\w+", resume_text or "") and re.search(r"\+?\d[\d\s-]{8,}", resume_text or ""):
        section_hits["contact"] = True
    section_score = round(100 * sum(1 for v in section_hits.values() if v) / len(section_hits))

    metrics = len(re.findall(r"(\$[\d,.]+m?|\d+%|\d{2,}\+?)", resume_text or ""))
    metric_score = min(100, metrics * 8)

    words = len(re.findall(r"\b[\w']+\b", resume_text or ""))
    if 350 <= words <= 900:
        length_score = 100
    elif 250 <= words < 350 or 900 < words <= 1200:
        length_score = 70
    else:
        length_score = 40

    tables = bool(re.search(r"<table", resume_text or "", re.I))
    # resume_text here may be plain; caller can pass flags
    overall = round(
        0.40 * keyword_score
        + 0.25 * section_score
        + 0.15 * metric_score
        + 0.10 * length_score
        + 0.10 * (100 if section_hits.get("contact") else 40)
    )
    band = "Strong ATS match" if overall >= 80 else "Moderate ATS match" if overall >= 60 else "Below typical ATS cutoff"

    findings = []
    if missing:
        findings.append(f"{len(missing)} JD terms are not in the resume.")
    if not section_hits.get("skills"):
        findings.append("Add a Skills / Core Competencies heading (ATS parsers look for it).")
    if not section_hits.get("experience"):
        findings.append("Add a Professional Experience heading.")
    if metrics < 4:
        findings.append("Add more quantified results (%, $, team size, SLA).")
    if words > 1200:
        findings.append("Resume is long for ATS screens; aim for 1–2 pages of focused content.")
    if words < 250:
        findings.append("Resume is short; expand impact bullets.")

    return {
        "overall": overall,
        "band": band,
        "parts": {
            "keyword_coverage": keyword_score,
            "section_structure": section_score,
            "quantified_impact": metric_score,
            "length": length_score,
            "contact": 100 if section_hits.get("contact") else 0,
        },
        "sections": section_hits,
        "word_count": words,
        "metric_hits": metrics,
        "matched": matched,
        "missing": missing,
        "findings": findings,
        "filters": ["all", "matched", "missing", "skills", "tools", "certs", "titles", "keywords"],
    }


def format_ats_resume_html(resume_text: str) -> str:
    """Rebuild a linear ATS-safe resume (no tables, standard headings)."""
    lines = [ln.strip() for ln in (resume_text or "").splitlines() if ln.strip()]
    if not lines:
        return "<p></p>"

    def esc(s: str) -> str:
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    name = lines[0]
    role = ""
    contact = ""
    rest = []
    i = 1
    if i < len(lines) and "program" in lines[i].lower():
        role = lines[i]
        i += 1
    if i < len(lines) and ("location" in lines[i].lower() or "@" in lines[i]):
        contact = lines[i]
        i += 1
    # skip cover letter until Executive Summary if present
    body = lines[i:]
    start = 0
    for idx, ln in enumerate(body):
        if ln.lower() in {
            "executive summary",
            "core competencies & technical skillset",
            "professional experience",
            "education & certifications",
        } or ln.lower().startswith("executive summary"):
            start = idx
            break
    body = body[start:] if start else body

    html = [
        f'<h1 style="text-align:center;color:#0F2C4C;font-family:Calibri,Arial,sans-serif;">{esc(name)}</h1>'
    ]
    if role:
        html.append(f'<p style="text-align:center;"><strong>{esc(role)}</strong></p>')
    if contact:
        html.append(f'<p style="text-align:center;font-size:10pt;">{esc(contact)}</p>')
    html.append("<hr/>")

    current = "p"
    for ln in body:
        low = ln.lower()
        if low in {
            "executive summary",
            "core competencies & technical skillset",
            "professional experience",
            "education & certifications",
        }:
            current = "h2"
            html.append(f'<h2 style="color:#0F2C4C;font-family:Calibri,Arial,sans-serif;">{esc(ln)}</h2>')
            continue
        if re.match(r"^[A-Z][A-Z0-9 .&()/-]{8,}$", ln) and " | " in ln:
            html.append(f"<p><strong>{esc(ln)}</strong></p>")
            continue
        if re.search(r"\(\w{3} \d{4}\s*[–-]", ln) or re.search(r"\d{4}\s*[–-]\s*(Present|\d{4})", ln):
            html.append(f"<p><strong>{esc(ln)}</strong></p>")
            continue
        html.append(f"<p>{esc(ln)}</p>")
    return "\n".join(html)


AI_MARKERS = [
    "delve", "tapestry", "underscore", "pivotal", "moreover", "furthermore",
    "it is important to note", "in today's world", "landscape", "leverage",
    "robust", "seamless", "comprehensive", "cutting-edge", "elevate",
    "foster", "harness", "in conclusion", "to summarize",
    "plays a crucial role", "ever-evolving",
]


def score_ai_writing(text: str) -> dict:
    raw = (text or "").strip()
    if len(raw) < 80:
        return {
            "overall": 0,
            "band": "Not enough text",
            "findings": ["Paste more content to analyse."],
            "parts": {},
            "disclaimer": "Local heuristic only — not GPTZero or Turnitin.",
        }
    sentences = [s.strip() for s in re.split(r"[.!?]+", raw) if len(s.strip()) > 8]
    lengths = [len(s.split()) for s in sentences] or [0]
    avg = sum(lengths) / max(len(lengths), 1)
    variance = sum((n - avg) ** 2 for n in lengths) / max(len(lengths), 1)
    burstiness = variance ** 0.5
    words = re.findall(r"[a-z']+", raw.lower())
    ttr = len(set(words)) / max(len(words), 1)
    low = raw.lower()
    marker_hits = [m for m in AI_MARKERS if m in low]
    tris: dict[str, int] = {}
    for i in range(max(0, len(words) - 2)):
        tri = " ".join(words[i : i + 3])
        tris[tri] = tris.get(tri, 0) + 1
    repeat_heavy = sum(1 for n in tris.values() if n >= 3)
    score = 0
    if burstiness < 4:
        score += 25
    elif burstiness < 6:
        score += 12
    if ttr < 0.38:
        score += 20
    elif ttr < 0.48:
        score += 10
    score += min(30, len(marker_hits) * 6)
    score += min(15, repeat_heavy * 5)
    score = max(0, min(100, round(score)))
    findings = []
    if burstiness < 5:
        findings.append("Sentence length is very even (common in generated prose).")
    if ttr < 0.42:
        findings.append("Vocabulary variety is low relative to length.")
    if marker_hits:
        findings.append("AI-typical phrasing: " + ", ".join(marker_hits[:6]) + ".")
    if repeat_heavy:
        findings.append("Repeated 3-word phrases detected.")
    if score < 35:
        findings.append("Reads more like varied human writing on these tests.")
    return {
        "overall": score,
        "band": "High AI-likeness (heuristic)" if score >= 70 else "Mixed / uncertain" if score >= 45 else "Low AI-likeness (heuristic)",
        "parts": {
            "even_sentences": 75 if burstiness < 5 else 25,
            "low_variety": 70 if ttr < 0.42 else 25,
            "stock_phrases": min(100, len(marker_hits) * 20),
            "repetition": min(100, repeat_heavy * 25),
        },
        "findings": findings,
        "disclaimer": "Not GPTZero/Turnitin. Local heuristics only.",
    }
