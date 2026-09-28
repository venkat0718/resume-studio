# Local Flask app

```powershell
cd "C:\Users\VENKAT\Documents\Application for DOCS"
python -m pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5055

The home page is `docs/index.html` (same UI as GitHub Pages). `/export` writes PDF or `.docx` from the editor HTML.

Optional APIs still exist for `/ats-score`, `/ai-score`, and `/format-resume` if you call them from tools; the UI scores in the browser.
