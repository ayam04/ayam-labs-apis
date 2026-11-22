import pathlib
PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")
count = 0
for f in PUB.glob("*.html"):
    t = f.read_text(encoding="utf-8")
    if '<a href="/performance.html">Latency</a>' in t:
        continue
    old = '        <a href="/pricing.html">Pricing</a>\n'
    new = '        <a href="/performance.html">Latency</a>\n        <a href="/pricing.html">Pricing</a>\n'
    if old in t:
        t = t.replace(old, new, 1)
        f.write_text(t, encoding="utf-8")
        count += 1
print("nav links added:", count)
