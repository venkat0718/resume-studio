/* Document Studio — ATS, AI-writing heuristics, resume builder (browser-only). */
(function (global) {
  const STOP = new Set("about after again against along also among and any are because been before being below between both but can could did does doing down during each for from further had has have having here how into its just more most not now off once only other our out over own same should some such than that the their them then there these they this those through under until very was were what when where which while who will with would your you role team work years year plus including across within using used well able must need needs required requirement requirements experience experiences skills skill strong good great please job position candidate applicants".split(" "));

  const SKILL_PHRASES = [
    "program management", "project management", "portfolio management", "change management",
    "change leader", "delivery governance", "itil", "agile", "scrum", "kanban", "devops",
    "ci/cd", "cloud-native", "legacy modernization", "stakeholder management", "steering committee",
    "vendor management", "servicenow", "jira", "power bi", "it strategy", "people leadership",
    "matrix", "apac", "sla", "kpi", "pmo", "csm", "oracle"
  ];

  const AI_MARKERS = [
    "delve", "tapestry", "underscore", "pivotal", "moreover", "furthermore",
    "it is important to note", "in today's world", "landscape", "leverage",
    "robust", "seamless", "comprehensive", "cutting-edge", "elevate",
    "foster", "harness", "as an ai", "in conclusion", "to summarize",
    "plays a crucial role", "not only", "but also", "ever-evolving"
  ];

  function norm(t) {
    return String(t || "").toLowerCase().replace(/\s+/g, " ");
  }

  function category(term) {
    const t = term.toLowerCase();
    if (["jira", "servicenow", "power bi", "oracle"].includes(t)) return "tools";
    if (["csm", "itil", "certified scrum master"].includes(t)) return "certs";
    if (/leader|manager|head of|director|change/.test(t)) return "titles";
    if (/agile|scrum|devops|cloud|governance|budget|sla/.test(t)) return "skills";
    return "keywords";
  }

  function extractKeywords(jd) {
    const text = norm(jd);
    const seen = new Set();
    const found = [];
    SKILL_PHRASES.slice().sort((a, b) => b.length - a.length).forEach((phrase) => {
      if (text.includes(phrase) && !seen.has(phrase)) {
        seen.add(phrase);
        found.push({ term: phrase, category: category(phrase) });
      }
    });
    (jd || "").split(/[^A-Za-z0-9+/#.&-]+/).forEach((tok) => {
      if (/^[A-Z][A-Za-z]{2,}/.test(tok)) {
        const key = tok.toLowerCase();
        if (!STOP.has(key) && !seen.has(key) && key.length > 2) {
          seen.add(key);
          found.push({ term: key, category: category(key) });
        }
      }
    });
    const counts = {};
    (text.match(/[a-z][a-z0-9+/#.&-]{3,}/g) || []).forEach((t) => {
      if (!STOP.has(t)) counts[t] = (counts[t] || 0) + 1;
    });
    Object.entries(counts)
      .filter(([t, n]) => n >= 2 && !seen.has(t))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .forEach(([t]) => {
        seen.add(t);
        found.push({ term: t, category: category(t) });
      });
    return found.slice(0, 80);
  }

  function scoreAts(resumeText, jdText) {
    const resume = norm(resumeText);
    const keywords = extractKeywords(jdText);
    const matched = [];
    const missing = [];
    keywords.forEach((item) => {
      const row = Object.assign({ matched: resume.includes(item.term) }, item);
      (row.matched ? matched : missing).push(row);
    });
    const keywordScore = Math.round((100 * matched.length) / Math.max(keywords.length, 1));
    const sections = {
      contact: /@|phone|linkedin|location/.test(resume) && /\d[\d\s-]{8,}/.test(resumeText || ""),
      summary: /executive summary|professional summary|profile/.test(resume),
      skills: /core competencies|technical skill|skills|skillset/.test(resume),
      experience: /professional experience|work experience|employment/.test(resume),
      education: /education|certification/.test(resume)
    };
    const sectionScore = Math.round((100 * Object.values(sections).filter(Boolean).length) / 5);
    const metrics = (resumeText.match(/(\$[\d,.]+m?|\d+%|\d{2,}\+?)/g) || []).length;
    const metricScore = Math.min(100, metrics * 8);
    const words = (resumeText.match(/\b[\w']+\b/g) || []).length;
    let lengthScore = 40;
    if (words >= 350 && words <= 900) lengthScore = 100;
    else if ((words >= 250 && words < 350) || (words > 900 && words <= 1200)) lengthScore = 70;
    const overall = Math.round(
      0.4 * keywordScore + 0.25 * sectionScore + 0.15 * metricScore + 0.1 * lengthScore + 0.1 * (sections.contact ? 100 : 40)
    );
    const findings = [];
    if (missing.length) findings.push(missing.length + " JD terms are missing from the resume.");
    if (!sections.skills) findings.push("Add a Skills / Core Competencies heading.");
    if (!sections.experience) findings.push("Add a Professional Experience heading.");
    if (metrics < 4) findings.push("Add more quantified results (%, $, team size, SLA).");
    if (words > 1200) findings.push("Too long for many ATS screens (aim 1–2 pages).");
    if (words < 250) findings.push("Too short; expand impact bullets.");
    return {
      overall,
      band: overall >= 80 ? "Strong ATS match" : overall >= 60 ? "Moderate ATS match" : "Below typical ATS cutoff",
      parts: {
        keyword_coverage: keywordScore,
        section_structure: sectionScore,
        quantified_impact: metricScore,
        length: lengthScore,
        contact: sections.contact ? 100 : 0
      },
      sections,
      word_count: words,
      matched,
      missing,
      findings,
      filters: ["all", "matched", "missing", "skills", "tools", "certs", "titles", "keywords"]
    };
  }

  function scoreAiWriting(text) {
    const raw = String(text || "").trim();
    if (raw.length < 80) {
      return { overall: 0, band: "Not enough text", findings: ["Paste more content to analyse."], parts: {} };
    }
    const sentences = raw.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 8);
    const lengths = sentences.map((s) => s.split(/\s+/).length);
    const avg = lengths.reduce((a, b) => a + b, 0) / Math.max(lengths.length, 1);
    const variance = lengths.reduce((a, n) => a + (n - avg) ** 2, 0) / Math.max(lengths.length, 1);
    const burstiness = Math.sqrt(variance);
    const words = raw.toLowerCase().match(/[a-z']+/g) || [];
    const uniq = new Set(words);
    const ttr = uniq.size / Math.max(words.length, 1);
    const low = raw.toLowerCase();
    const markerHits = AI_MARKERS.filter((m) => low.includes(m));
    const repeated = {};
    for (let i = 0; i < words.length - 2; i++) {
      const tri = words.slice(i, i + 3).join(" ");
      repeated[tri] = (repeated[tri] || 0) + 1;
    }
    const repeatHeavy = Object.values(repeated).filter((n) => n >= 3).length;
    let score = 0;
    if (burstiness < 4) score += 25;
    else if (burstiness < 6) score += 12;
    if (ttr < 0.38) score += 20;
    else if (ttr < 0.48) score += 10;
    score += Math.min(30, markerHits.length * 6);
    score += Math.min(15, repeatHeavy * 5);
    if (/\n(-|•|\d+\.)\s/.test(raw) && sentences.length < 8) score += 10;
    score = Math.max(0, Math.min(100, Math.round(score)));
    const findings = [];
    if (burstiness < 5) findings.push("Sentence length is very even (common in generated prose).");
    if (ttr < 0.42) findings.push("Vocabulary variety is low relative to length.");
    if (markerHits.length) findings.push("AI-typical phrasing: " + markerHits.slice(0, 6).join(", ") + ".");
    if (repeatHeavy) findings.push("Repeated 3-word phrases detected.");
    if (score < 35) findings.push("Reads more like varied human writing on these tests.");
    return {
      overall: score,
      band: score >= 70 ? "High AI-likeness (heuristic)" : score >= 45 ? "Mixed / uncertain" : "Low AI-likeness (heuristic)",
      parts: {
        even_sentences: burstiness < 5 ? 75 : 25,
        low_variety: ttr < 0.42 ? 70 : 25,
        stock_phrases: Math.min(100, markerHits.length * 20),
        repetition: Math.min(100, repeatHeavy * 25)
      },
      findings,
      disclaimer: "Not GPTZero/Turnitin. Local heuristics only — use as a draft check, not a fact."
    };
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatAtsResume(text) {
    const lines = String(text || "").split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return "<p></p>";
    const headings = new Set([
      "executive summary",
      "core competencies & technical skillset",
      "professional experience",
      "education & certifications"
    ]);
    let i = 0;
    const name = lines[i++] || "";
    let role = "", contact = "";
    if (lines[i] && /program|manager|lead/i.test(lines[i])) role = lines[i++];
    if (lines[i] && /location|@|phone|linkedin/i.test(lines[i])) contact = lines[i++];
    let start = 0;
    lines.forEach((ln, idx) => {
      if (headings.has(ln.toLowerCase())) start = idx;
    });
    const body = start ? lines.slice(start) : lines.slice(i);
    const html = [
      '<h1 style="text-align:center;color:#0F2C4C;font-family:Calibri,Arial,sans-serif;">' + escapeHtml(name) + "</h1>"
    ];
    if (role) html.push("<p style='text-align:center;'><strong>" + escapeHtml(role) + "</strong></p>");
    if (contact) html.push("<p style='text-align:center;font-size:10pt;'>" + escapeHtml(contact) + "</p>");
    html.push("<hr/>");
    body.forEach((ln) => {
      if (headings.has(ln.toLowerCase())) {
        html.push('<h2 style="color:#0F2C4C;">' + escapeHtml(ln) + "</h2>");
      } else if (/[|].*\d{4}/.test(ln) || /\d{4}\s*[–-]\s*(Present|\d{4})/.test(ln)) {
        html.push("<p><strong>" + escapeHtml(ln) + "</strong></p>");
      } else {
        html.push("<p>" + escapeHtml(ln) + "</p>");
      }
    });
    return html.join("\n");
  }

  function buildResume(form) {
    const bullets = (s) =>
      String(s || "")
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => "<p>• " + escapeHtml(l.replace(/^•\s*/, "")) + "</p>")
        .join("");
    return [
      '<h1 style="text-align:center;color:#0F2C4C;">' + escapeHtml(form.name) + "</h1>",
      '<p style="text-align:center;"><strong>' + escapeHtml(form.title) + "</strong></p>",
      '<p style="text-align:center;font-size:10pt;">' +
        escapeHtml([form.location, form.phone, form.email, form.linkedin].filter(Boolean).join(" | ")) +
        "</p>",
      "<hr/>",
      "<h2 style='color:#0F2C4C;'>Executive Summary</h2>",
      "<p>" + escapeHtml(form.summary) + "</p>",
      "<h2 style='color:#0F2C4C;'>Core Competencies</h2>",
      "<p>" + escapeHtml(form.skills) + "</p>",
      "<h2 style='color:#0F2C4C;'>Professional Experience</h2>",
      bullets(form.experience),
      "<h2 style='color:#0F2C4C;'>Education & Certifications</h2>",
      bullets(form.education)
    ].join("\n");
  }

  global.DocStudioEngine = { scoreAts, scoreAiWriting, formatAtsResume, buildResume, extractKeywords };
})(window);
