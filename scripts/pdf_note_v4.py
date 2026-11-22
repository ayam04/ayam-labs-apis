import pathlib, re
PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")

note = ('<div style="border:1px solid #3a2a1a;background:rgba(251,191,36,.06);border-radius:12px;padding:16px 18px;margin:22px 0">'
        '<p style="margin:0;color:var(--text-dim);font-size:.92rem"><b style="color:#fbbf24">Known issue, measured:</b> '
        'a full extraction of some dense documents kills the worker before it can answer, and Cloudflare returns an HTML '
        'page instead of our JSON. Since this build, <code>/v1/pdf/text</code> refuses documents above 400&nbsp;KB with a '
        'readable 413 and a reason; <code>/v1/pdf/pages?pages=1-4</code> extracts a slice and works on the same files. '
        'DOCX, HTML and the metadata route are unaffected. The underlying cause is under investigation: the failure '
        'arrives after ~10&nbsp;ms of CPU and the same document loads fine for a single page, so it is not simply a '
        'CPU ceiling. I would rather say that than guess.</p></div>')

p = PUB / "docparse.html"
t = p.read_text(encoding="utf-8")
t = re.sub(r'<div style="border:1px solid #3a2a1a;[\s\S]*?</div>', note, t, count=1)
p.write_text(t, encoding="utf-8")
print("docparse:", "Known issue, measured" in t)

g = PUB / "guides-pdf-text.html"
t = g.read_text(encoding="utf-8")
m = re.search(r'<p style="color:#fbbf24;margin:0 0 16px;font-size:\.92rem"><b>[^<]*</b>[\s\S]*?</p>', t)
short = ('<p style="color:#fbbf24;margin:0 0 16px;font-size:.92rem"><b>Known issue:</b> a full extraction of some dense '
         'documents kills the worker and returns an HTML error from Cloudflare. Since 2026-11-22 <code>/v1/pdf/text</code> '
         'refuses documents above 400&nbsp;KB with a readable 413; <code>/v1/pdf/pages?pages=1-4</code> still works on those '
         'files. DOCX and HTML are unaffected.</p>')
if m:
    t = t.replace(m.group(0), short, 1)
    g.write_text(t, encoding="utf-8")
    print("guide updated")
