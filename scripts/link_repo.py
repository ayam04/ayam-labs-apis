import pathlib
PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")
REPO = "https://github.com/ayam04/ayam-labs-apis"

# footer link on every page
count = 0
for f in PUB.glob("*.html"):
    t = f.read_text(encoding="utf-8")
    if "github.com/ayam04/ayam-labs-apis" in t:
        continue
    old = '<a href="/legal.html">Legal</a>'
    new = f'<a href="{REPO}" rel="noopener">Source</a> &nbsp;·&nbsp; <a href="/legal.html">Legal</a>'
    if old in t:
        t = t.replace(old, new, 1)
        f.write_text(t, encoding="utf-8")
        count += 1
print("footers linked:", count)

# home page: an open-source line in the how-it-works section
h = PUB / "index.html"
t = h.read_text(encoding="utf-8")
if REPO not in t:
    anchor = '<div class="section-head"><div><div class="section-num">03 - HOW IT WORKS</div>'
    if anchor in t:
        t = t.replace(anchor, f'<p style="max-width:70ch;color:var(--text-dim);margin:0 0 26px">The code is public: <a href="{REPO}" rel="noopener">github.com/ayam04/ayam-labs-apis</a>. Read the guard, the SSRF checks and the tests before you pay for anything.</p>\n      ' + anchor, 1)
        h.write_text(t, encoding="utf-8")
        print("home page: source link added")

# llms.txt
ll = PUB / "llms.txt"
t = ll.read_text(encoding="utf-8")
if REPO not in t:
    t = t.replace("## Listings", f"## Source\n\n{REPO} - MIT licensed, tests and deployment config included.\n\n## Listings")
    ll.write_text(t, encoding="utf-8")
    print("llms.txt updated")
