"""Resume Studio: JD match, tailor, PDF / Word export."""
from __future__ import annotations

import io
from pathlib import Path

from flask import Flask, jsonify, request, send_file, send_from_directory

from exporter import text_to_docx_bytes, text_to_pdf_bytes
from rich_export import html_to_docx_bytes, html_to_pdf_bytes, sanitize_html

ROOT = Path(__file__).resolve().parent
app = Flask(__name__)
app.secret_key = "local-docs-app"
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024


def _filename(raw: str) -> str:
    name = (raw or "document").strip() or "document"
    return "".join(ch if ch.isalnum() or ch in "-_ " else "-" for ch in name).strip()


@app.get("/")
def home():
    return send_from_directory(ROOT / "docs", "index.html")


@app.get("/engine.js")
def engine_js():
    return send_from_directory(ROOT / "docs", "engine.js")


@app.get("/sample.txt")
def sample_txt():
    return send_from_directory(ROOT / "docs", "sample.txt")


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
    app.run(host="0.0.0.0", port=5055, debug=False)
