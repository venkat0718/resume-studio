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
    const rejection = [];
    if (overall < 60) {
      rejection.push("Overall score is under 60. Many ATS screens discard applications below this band.");
    }
    if (missing.length >= 5) {
      rejection.push("Keyword mismatch: the JD asks for " + missing.slice(0, 10).map((m) => m.term).join(", ") + ". Parsers often reject when those tokens are absent.");
    }
    if (!sections.contact) {
      rejection.push("Contact details are incomplete, so the recruiter ATS record may not parse.");
    }
    if (!sections.experience) {
      rejection.push("No standard Experience heading — ATS may not map your work history.");
    }
    if (metrics < 3) {
      rejection.push("Few measurable results. Screeners often skip resumes without %, $, or team-size proof.");
    }
    if (!rejection.length && overall < 80) {
      rejection.push("Not an automatic reject, but coverage is only moderate; missing terms still reduce rank.");
    }
    if (!rejection.length) {
      rejection.push("No hard reject flags on this check. Ranking still depends on recruiter review.");
    }
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
      rejection,
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

  function cleanResumeText(raw) {
    let s = String(raw || "");
    if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
    s = s
      .replace(/\u0000/g, "")
      .replace(/ï»¿/g, "")
      .replace(/â€œ|â€\x9d|â€/g, '"')
      .replace(/â€™|â€˜/g, "'")
      .replace(/â€“|â€”/g, "–")
      .replace(/â€¢/g, "•")
      .replace(/Â /g, " ")
      .replace(/Â/g, "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n");
    return s;
  }

  function looksLikeBinary(s) {
    if (!s) return false;
    if (s.slice(0, 2) === "PK" || s.slice(0, 4) === "%PDF") return true;
    if (s.indexOf("\x00") >= 0) return true;
    const sample = s.slice(0, 4000);
    let odd = 0;
    for (let i = 0; i < sample.length; i++) {
      const c = sample.charCodeAt(i);
      if (c < 9 || (c > 13 && c < 32) || c === 65533) odd++;
    }
    return odd > 40;
  }

  function isHeading(ln) {
    const t = ln.replace(/[:]+$/, "").trim().toLowerCase();
    return /^(executive summary|professional summary|career summary|summary|profile|core competencies.*|technical skillset|technical skills|skills|skillset|professional experience|work experience|employment history|experience|education.*|certifications?|key highlights)$/.test(t);
  }

  function isJobLine(ln) {
    return /[|].*\d{4}/.test(ln) || /\d{4}\s*[–-]\s*(Present|\d{4})/i.test(ln) || /\([A-Za-z]{3,9}\.?\s+\d{4}/.test(ln);
  }

  function parseResume(resumeText) {
    const text = cleanResumeText(resumeText);
    let lines = text.split(/\n/).map((l) => l.replace(/^[\s•·▪►‣–\-]+/, "").trim()).filter(Boolean);
    const dear = lines.findIndex((l) => /^dear\s/i.test(l));
    const exec = lines.findIndex((l) => /^executive summary$/i.test(l));
    if (dear >= 0 && exec > dear) {
      const nameIdx = lines.findIndex((l, idx) => idx > dear && idx <= exec && l === lines[0]);
      if (nameIdx > 0) lines = lines.slice(nameIdx);
      else lines = lines.slice(exec);
    }
    let i = 0;
    const name = lines[i++] || "";
    let role = "";
    let contact = "";
    if (lines[i] && lines[i].length < 90 && !isHeading(lines[i]) && !/@/.test(lines[i])) {
      role = lines[i++];
    }
    while (lines[i] && (/location:|linkedin|@|phone|tel:|\+\d/i.test(lines[i]) || (lines[i].split("|").length >= 2 && lines[i].length < 180))) {
      contact = contact ? contact + " | " + lines[i] : lines[i];
      i++;
    }
    contact = contact.replace(/\s+\|\s+/g, " | ");
    const sections = { summary: [], skills: [], experience: [], education: [] };
    let bucket = "experience";
    for (; i < lines.length; i++) {
      const ln = lines[i];
      const low = ln.replace(/[:]+$/, "").toLowerCase();
      if (isHeading(ln)) {
        if (/summary|profile/.test(low)) bucket = "summary";
        else if (/skill|competenc/.test(low)) bucket = "skills";
        else if (/education|certif/.test(low)) bucket = "education";
        else if (/experience|employment|highlight/.test(low)) bucket = "experience";
        else bucket = "experience";
        continue;
      }
      if (/^(sincerely|regards|yours faithfully),?$/i.test(ln)) continue;
      sections[bucket].push(ln);
    }
    return { name, role, contact, sections, text };
  }

  const FACE = "Calibri,Carlito,Arial,sans-serif";
  const NAVY = "#0F2C4C";

  function wrapDoc(inner) {
    return (
      '<div style="font-family:' +
      FACE +
      ';font-size:11pt;color:#1c2433;line-height:1.35;max-width:720px;margin:0 auto;">' +
      inner +
      "</div>"
    );
  }

  function formatAtsResume(text) {
    const p = parseResume(text);
    return resumeHtml(p, p.sections.summary.join(" "), p.sections.skills);
  }

  function resumeHtml(p, summary, skillLines) {
    const h = [];
    h.push('<h1 style="text-align:center;color:' + NAVY + ";font-family:" + FACE + ';font-size:18pt;letter-spacing:0.04em;margin:0 0 4pt 0;">' + escapeHtml(p.name) + "</h1>");
    if (p.role) h.push('<p style="text-align:center;margin:0 0 4pt 0;font-size:12pt;">' + escapeHtml(p.role) + "</p>");
    if (p.contact) h.push('<p style="text-align:center;margin:0 0 10pt 0;font-size:10pt;color:#334;">' + escapeHtml(p.contact) + "</p>");
    h.push('<hr style="border:none;border-top:1px solid ' + NAVY + ';margin:0 0 12pt 0;"/>');
    if (summary) {
      h.push('<h2 style="color:' + NAVY + ";font-family:" + FACE + ';font-size:12pt;border-bottom:1px solid #c5cdd6;padding-bottom:2pt;margin:14pt 0 6pt 0;">Professional summary</h2>');
      h.push('<p style="margin:0 0 8pt 0;">' + escapeHtml(summary) + "</p>");
    }
    const skills = (skillLines || []).map((x) => x.replace(/^•\s*/, "").trim()).filter(Boolean);
    if (skills.length) {
      h.push('<h2 style="color:' + NAVY + ";font-family:" + FACE + ';font-size:12pt;border-bottom:1px solid #c5cdd6;padding-bottom:2pt;margin:14pt 0 6pt 0;">Skills</h2>');
      h.push("<ul style='margin:0 0 8pt 18pt;padding:0;'>");
      skills.forEach((sk) => h.push("<li style='margin:0 0 3pt 0;'>" + escapeHtml(sk) + "</li>"));
      h.push("</ul>");
    }
    if (p.sections.experience.length) {
      h.push('<h2 style="color:' + NAVY + ";font-family:" + FACE + ';font-size:12pt;border-bottom:1px solid #c5cdd6;padding-bottom:2pt;margin:14pt 0 6pt 0;">Experience</h2>');
      p.sections.experience.forEach((ln) => {
        if (isJobLine(ln) || (ln === ln.toUpperCase() && ln.length > 6 && ln.length < 80)) {
          h.push('<p style="margin:10pt 0 2pt 0;"><strong>' + escapeHtml(ln) + "</strong></p>");
        } else {
          h.push("<p style='margin:0 0 3pt 14pt;'>" + escapeHtml(ln) + "</p>");
        }
      });
    }
    if (p.sections.education.length) {
      h.push('<h2 style="color:' + NAVY + ";font-family:" + FACE + ';font-size:12pt;border-bottom:1px solid #c5cdd6;padding-bottom:2pt;margin:14pt 0 6pt 0;">Education and certifications</h2>');
      p.sections.education.forEach((ln) => {
        h.push("<p style='margin:0 0 4pt 0;'>" + escapeHtml(ln) + "</p>");
      });
    }
    return wrapDoc(h.join("\n"));
  }

  function humanSummary(p) {
    const existing = p.sections.summary.join(" ").replace(/\s+/g, " ").trim();
    if (existing && existing.length > 40 && !/aligned to this job|targeting |ATS|watermark|keywords/i.test(existing)) {
      return existing.slice(0, 520);
    }
    const bits = p.sections.experience.filter((ln) => /(\$|\d+%|\d{2,}|led |managed |delivered |built )/i.test(ln)).slice(0, 3);
    const role = p.role || "";
    if (bits.length) {
      const facts = bits.map((b) => b.replace(/^[^:]+:\s*/, "").replace(/\.$/, "")).join("; ");
      return (role ? role + " with a record of " : "") + facts + ".";
    }
    return ((role ? role + ". " : "") + (p.sections.experience.slice(0, 2).join(" ") || existing)).trim();
  }

  function skillLinesFor(p, scored) {
    const fromResume = p.sections.skills.slice();
    if (fromResume.length) return fromResume;
    const matched = (scored.matched || []).map((m) => m.term).filter((t) => t.length > 2 && t.length < 32);
    const uniq = [];
    matched.forEach((t) => {
      const nice = t.replace(/\b\w/g, (c) => c.toUpperCase());
      if (uniq.indexOf(nice) < 0) uniq.push(nice);
    });
    return uniq.length ? [uniq.join(", ")] : [];
  }

  function tailorResume(resumeText, jdText) {
    const cleaned = cleanResumeText(resumeText);
    const before = scoreAts(cleaned, jdText);
    if (looksLikeBinary(cleaned)) {
      return { html: "<p>This file could not be read as text. Attach a Word (.docx) or paste the resume.</p>", before: before, after: before };
    }
    const p = parseResume(cleaned);
    const summary = humanSummary(p).replace(/<[^>]+>/g, "");
    const html = resumeHtml(p, summary, skillLinesFor(p, before));
    const after = scoreAts(html.replace(/<[^>]+>/g, "\n"), jdText);
    return { html: html, before: before, after: after };
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

  global.DocStudioEngine = {
    scoreAts,
    scoreAiWriting,
    formatAtsResume,
    buildResume,
    extractKeywords,
    tailorResume,
    cleanResumeText,
    looksLikeBinary
  };
})(window);
