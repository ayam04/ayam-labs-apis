import pathlib, re

PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")
SITE = "https://labs.ayamk.in"

image_for = {
    "emailcheck.html": "emailcheck",
    "seo-audit.html": "seo-audit",
    "docparse.html": "docparse",
    "ai-text.html": "ai-text",
    "pii-shield.html": "pii-shield",
}

count = 0
for f in PUB.glob("*.html"):
    t = f.read_text(encoding="utf-8")
    if 'property="og:image"' in t:
        continue
    slug = image_for.get(f.name, "site")
    title = re.search(r'property="og:title" content="([^"]*)"', t)
    desc = re.search(r'property="og:description" content="([^"]*)"', t)
    title = title.group(1) if title else "Ayam Labs"
    desc = desc.group(1) if desc else "Five APIs on Cloudflare Workers."
    alt = title.replace('"', "&quot;")
    block = (
        f'<meta property="og:image" content="{SITE}/og/{slug}.png">\n'
        '<meta property="og:image:width" content="1200">\n'
        '<meta property="og:image:height" content="630">\n'
        f'<meta property="og:image:alt" content="{alt}">\n'
        '<meta name="twitter:card" content="summary_large_image">\n'
        f'<meta name="twitter:title" content="{title}">\n'
        f'<meta name="twitter:description" content="{desc}">\n'
        f'<meta name="twitter:image" content="{SITE}/og/{slug}.png">\n'
    )
    t = t.replace("</head>", block + "</head>", 1)
    f.write_text(t, encoding="utf-8")
    count += 1
print("pages with social cards:", count)
