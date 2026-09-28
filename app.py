"""Document studio: rich editor, web import, PDF / Word export."""
from __future__ import annotations

import io
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_file

from exporter import text_to_docx_bytes, text_to_pdf_bytes
from rich_export import (
    fetch_web_html,
    html_to_docx_bytes,
    html_to_pdf_bytes,
    plain_text_to_html,
    sanitize_html,
)
from ats import format_ats_resume_html, html_to_text, score_ai_writing, score_ats

ROOT = Path(__file__).resolve().parent
app = Flask(__name__)
app.secret_key = "local-docs-app"
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024


def _filename(raw: str) -> str:
    name = (raw or "document").strip() or "document"
    return "".join(ch if ch.isalnum() or ch in "-_ " else "-" for ch in name).strip()


@app.get("/")
def home():
    sample = (ROOT / "samples" / "venkat_application.txt").read_text(encoding="utf-8")
    return render_template("index.html", sample_html=plain_text_to_html(sample))


@app.post("/fetch-url")
def fetch_url():
    url = (request.json or {}).get("url") or ""
    try:
        html = fetch_web_html(url)
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    return jsonify({"ok": True, "html": html})


@app.post("/ats-score")
def ats_score():
    data = request.get_json(force=True, silent=True) or {}
    html = data.get("html") or ""
    text = data.get("text") or html_to_text(html)
    jd = data.get("jd") or ""
    if not text.strip():
        return jsonify({"ok": False, "error": "Resume/application is empty."}), 400
    if not jd.strip():
        return jsonify({"ok": False, "error": "Paste a job description first."}), 400
    result = score_ats(text, jd)
    result["has_tables"] = "<table" in (html or "").lower()
    if result["has_tables"]:
        result["findings"].insert(0, "Tables can break some ATS parsers. Use the Format ATS resume button.")
    return jsonify({"ok": True, **result})


@app.post("/ai-score")
def ai_score():
    data = request.get_json(force=True, silent=True) or {}
    text = data.get("text") or html_to_text(data.get("html") or "")
    return jsonify({"ok": True, **score_ai_writing(text)})


@app.post("/format-resume")
def format_resume():
    data = request.get_json(force=True, silent=True) or {}
    text = data.get("text") or html_to_text(data.get("html") or "")
    if not text.strip():
        return jsonify({"ok": False, "error": "Nothing to format."}), 400
    return jsonify({"ok": True, "html": format_ats_resume_html(text)})


@app.post("/export")
def export():
    fmt = (request.form.get("format") or "pdf").lower()
    filename = _filename(request.form.get("filename"))
    html = sanitize_html(request.form.get("html") or "")
    text = (request.form.get("text") or "").strip()
    paper = request.form.get("paper") or "A4"
    if not html and not text:
        return jsonify({"ok": False, "error": "Editor is empty."}), 400
    try:
        if fmt == "docx":
            data = html_to_docx_bytes(html) if html else text_to_docx_bytes(text, title=filename)
            download = f"{filename}.docx"
            mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        else:
            data = html_to_pdf_bytes(html, title=filename, paper=paper) if html else text_to_pdf_bytes(text, title=filename)
            download = f"{filename}.pdf"
            mime = "application/pdf"
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    buf = io.BytesIO(data)
    buf.seek(0)
    return send_file(buf, as_attachment=True, download_name=download, mimetype=mime)


if __name__ == "__main__":
    print("Open http://127.0.0.1:5055")
    app.run(host="127.0.0.1", port=5055, debug=False)
