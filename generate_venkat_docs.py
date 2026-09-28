"""Create PDF and Word files from the saved application text."""
from pathlib import Path

from exporter import text_to_docx_bytes, text_to_pdf_bytes

ROOT = Path(__file__).resolve().parent
text = (ROOT / "samples" / "venkat_application.txt").read_text(encoding="utf-8")
out = ROOT / "output"
out.mkdir(exist_ok=True)
stem = "Sample_ATS_Resume"
(out / f"{stem}.pdf").write_bytes(text_to_pdf_bytes(text, title=stem))
(out / f"{stem}.docx").write_bytes(text_to_docx_bytes(text, title=stem))
print(f"Wrote {out / (stem + '.pdf')}")
print(f"Wrote {out / (stem + '.docx')}")
