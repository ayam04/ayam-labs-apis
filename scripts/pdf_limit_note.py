import pathlib

PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")

note = ('<div style="border:1px solid #3a2a1a;background:rgba(251,191,36,.06);border-radius:12px;padding:16px 18px;margin:22px 0">'
        '<p style="margin:0;color:var(--text-dim);font-size:.92rem"><b style="color:#fbbf24">Known limit, measured 2026-11-22:</b> '
        'text extraction runs on a Worker with a 10&nbsp;ms CPU budget. Small and text-light PDFs are fine; '
        'dense multi-page documents (a 16-page LaTeX paper is enough) can exceed it and return a 503 from '
        'Cloudflare rather than a JSON error. DOCX, HTML and the metadata routes are unaffected. '
        'If you need heavy PDFs today, split them with <code>/v1/pdf/pages</code>; the limit disappears '
        'on a paid Workers plan.</p></div>')

p = PUB / "docparse.html"
t = p.read_text(encoding="utf-8")
if "Known limit, measured" not in t:
    anchor = '<h2 style="margin:44px 0 14px;font-size:1.5rem">FAQ</h2>'
    if anchor in t:
        t = t.replace(anchor, note + anchor, 1)
    else:
        t = t.replace("</main>", note + "</main>", 1)
    p.write_text(t, encoding="utf-8")
    print("docparse page: limit note added")

g = PUB / "guides-pdf-text.html"
t = g.read_text(encoding="utf-8")
if "Known limit, measured" not in t:
    short = ('<p style="color:#fbbf24;margin:0 0 16px;font-size:.92rem"><b>Known limit:</b> dense multi-page PDFs '
             'can exceed the 10&nbsp;ms CPU budget of the current Workers plan and return a 503 instead of JSON. '
             'Split large files with <code>/v1/pdf/pages</code>, or run on a paid Workers plan where the budget is 30&nbsp;s.</p>')
    anchor = '<h2 style="margin:44px 0 14px;font-size:1.5rem">'
    if anchor in t:
        t = t.replace(anchor, short + anchor, 1)
    else:
        t = t.replace("</main>", short + "</main>", 1)
    g.write_text(t, encoding="utf-8")
    print("pdf guide: limit note added")
