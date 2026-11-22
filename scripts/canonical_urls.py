import pathlib, re

PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")
changed = 0
for f in PUB.glob("*.html"):
    t = f.read_text(encoding="utf-8")
    o = t
    # internal links and canonical/og urls: drop the .html suffix the edge redirects away from
    t = re.sub(r'href="/([a-z0-9\-]+)\.html"', r'href="/\1"', t)
    t = re.sub(r'href="https://labs\.ayamk\.in/([a-z0-9\-]+)\.html"', r'href="https://labs.ayamk.in/\1"', t)
    t = re.sub(r'content="https://labs\.ayamk\.in/([a-z0-9\-]+)\.html"', r'content="https://labs.ayamk.in/\1"', t)
    # root canonical
    t = t.replace('href="https://labs.ayamk.in/index"', 'href="https://labs.ayamk.in/"')
    if t != o:
        f.write_text(t, encoding="utf-8")
        changed += 1
print("pages rewritten:", changed)

sm = PUB / "sitemap.xml"
xml = sm.read_text(encoding="utf-8")
xml2 = re.sub(r'https://labs\.ayamk\.in/([a-z0-9\-]+)\.html', r'https://labs.ayamk.in/\1', xml)
xml2 = xml2.replace("https://labs.ayamk.in/index", "https://labs.ayamk.in/")
if xml2 != xml:
    sm.write_text(xml2, encoding="utf-8")
print("sitemap urls:", xml2.count("<loc>"))
print(xml2[:400])

# feed links too
fd = PUB / "feed.xml"
t = fd.read_text(encoding="utf-8")
t2 = re.sub(r'https://labs\.ayamk\.in/([a-z0-9\-]+)\.html', r'https://labs.ayamk.in/\1', t)
if t2 != t:
    fd.write_text(t2, encoding="utf-8")
    print("feed rewritten")
