import pathlib
PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")

# 1. guide: bullet economics section before "Where this fits"
g = PUB / "guides-email-verification.html"
t = g.read_text(encoding="utf-8")
anchor = "<h2 style=\"margin:44px 0 14px;font-size:1.5rem\">Where this fits</h2>"
if anchor in t and "bulk maths" not in t:
    block = ('<h2 style="margin:44px 0 14px;font-size:1.5rem">The bulk maths</h2>'
             '<p style="color:var(--text-dim);margin:0 0 16px">One call to <code>/v1/bulk</code> verifies up to 100 addresses. '
             'Against a credit-pack vendor charging roughly half a cent per address, a bulk call works out about ten times cheaper per address. '
             'If you are checking a single signup, the per-call price is the wrong shape for you and a credit pack will be cheaper. '
             'The maths is laid out with sources on the <a href="/compare-pricing.html">pricing comparison</a> page.</p>')
    t = t.replace(anchor, block + anchor, 1)
    g.write_text(t, encoding="utf-8")
    print("guide updated")

# 2. product page: note in the pricing section
p = PUB / "emailcheck.html"
t = p.read_text(encoding="utf-8")
note = ("<p style=\"margin-top:8px;font-size:.85rem\">The bulk endpoint verifies up to 100 addresses per call, "
        "which is the cheapest per-address path here. <a href=\"/compare-pricing.html\">See the arithmetic</a>.</p>")
if "compare-pricing.html" not in t:
    old = '<p style="margin-top:16px;font-size:.85rem">All plans are managed by the RapidAPI marketplace'
    if old in t:
        t = t.replace(old, note + old, 1)
        p.write_text(t, encoding="utf-8")
        print("product page updated")
    else:
        print("pricing paragraph anchor not found")
