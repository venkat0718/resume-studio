"""HTML export helpers and web fetch for the document studio."""
from __future__ import annotations

import io
import re
from urllib.parse import urlparse

import bleach
import requests
from bs4 import BeautifulSoup
from htmldocx import HtmlToDocx
from xhtml2pdf import pisa

from exporter import HEADING_NAMES, USER_AGENT, text_to_docx_bytes, text_to_pdf_bytes

ALLOWED_TAGS = [
    "p", "br", "div", "span", "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup",
    "blockquote", "pre", "code", "hr", "ul", "ol", "li",
    "table", "thead", "tbody", "tr", "th", "td", "caption",
    "a", "img", "figure", "figcaption",
]
ALLOWED_ATTRS = {
    "*": ["style", "class", "align"],
    "a": ["href", "title", "target"],
    "img": ["src", "alt", "width", "height"],
    "td": ["colspan", "rowspan"],
    "th": ["colspan", "rowspan"],
}
ALLOWED_PROTOCOLS = ["http", "https", "mailto", "data"]


def sanitize_html(html: str) -> str:
    return bleach.clean(
        html or "",
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRS,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,
    )


def plain_text_to_html(text: str) -> str:
    blocks = []
    seen_name = 0
    for raw in text.replace("\r\n", "\n").split("\n"):
        line = raw.strip()
        if not line:
            continue
        esc = (
            line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        )
        if line.strip().isupper() and 2 <= len(line.strip().split()) <= 4 and seen_name < 2:
            blocks.append(f'<h1 style="text-align:center;color:#0F2C4C;">{esc}</h1>')
            seen_name += 1
            continue
        if line.lower().startswith("senior it program manager"):
            blocks.append(f'<p style="text-align:center;"><em>{esc}</em></p>')
            continue
        if line.startswith("Location:"):
            blocks.append(f'<p style="text-align:center;font-size:10pt;">{esc}</p>')
            continue
        if line.strip().lower() in HEADING_NAMES:
            blocks.append(f'<h2 style="color:#0F2C4C;">{esc}</h2>')
            continue
        if line.endswith(":") and len(line) < 80 and not line.startswith("Dear"):
            blocks.append(f"<p><strong>{esc}</strong></p>")
            continue
        blocks.append(f"<p>{esc}</p>")
    return "\n".join(blocks)


def fetch_web_html(url: str, timeout: int = 15, max_bytes: int = 2_000_000) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("Only http and https URLs are allowed.")
    response = requests.get(
        url.strip(),
        timeout=timeout,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,text/plain"},
        stream=True,
    )
    response.raise_for_status()
    chunks = []
    total = 0
    for chunk in response.iter_content(chunk_size=16384):
        total += len(chunk)
        if total > max_bytes:
            raise ValueError("Page is larger than 2 MB.")
        chunks.append(chunk)
    raw = b"".join(chunks)
    content_type = (response.headers.get("Content-Type") or "").lower()
    if "text/plain" in content_type:
        return plain_text_to_html(raw.decode(response.encoding or "utf-8", errors="replace"))
    soup = BeautifulSoup(raw, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "iframe", "form", "button"]):
        tag.decompose()
    article = soup.find("article") or soup.find("main") or soup.body or soup
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    inner = sanitize_html(str(article))
    if title:
        return f"<h1>{bleach.clean(title)}</h1>\n{inner}"
    return inner


def html_to_pdf_bytes(html: str, title: str = "Document", paper: str = "A4") -> bytes:
    size = "A4" if paper.upper() != "LETTER" else "letter"
    wrapped = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>{bleach.clean(title)}</title>
<style>
@page {{ size: {size}; margin: 18mm; }}
mark {{ background: transparent !important; color: inherit !important; }}
img {{ max-width: 100%; }}
</style>
</head>
<body>{html}</body>
</html>"""
    output = io.BytesIO()
    result = pisa.CreatePDF(src=wrapped, dest=output, encoding="utf-8")
    if result.err:
        raise ValueError("Could not build PDF from the current formatting.")
    return output.getvalue()


def html_to_docx_bytes(html: str) -> bytes:
    parser = HtmlToDocx()
    parser.table_style = "Table Grid"
    wrapped = f"<html><body>{html}</body></html>"
    document = parser.parse_html_string(wrapped)
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()
