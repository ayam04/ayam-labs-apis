import os
from PIL import Image, ImageDraw, ImageFont

OUT = r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public\og"
os.makedirs(OUT, exist_ok=True)

BG = (8, 9, 10)
INK = (237, 237, 237)
DIM = (138, 146, 154)
ACCENT = (255, 106, 43)
LINE = (40, 46, 52)

W, H = 1200, 630

def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()

BOLD = r"C:\Windows\Fonts\segoeuib.ttf"
SEMI = r"C:\Windows\Fonts\seguisb.ttf"
MONO = r"C:\Windows\Fonts\consola.ttf"

CARDS = [
    ("emailcheck", "EmailCheck API", "Verify an address without sending mail.",
     "MX DNS · disposable list · role accounts · 0-100 score", "@"),
    ("seo-audit", "SEO Audit API", "Fourteen weighted on-page checks in one request.",
     "titles · headings · structured data · sitemap · robots", "%"),
    ("docparse", "DocParse API", "PDF, DOCX and HTML into clean text.",
     "per-page text · metadata · markdown conversion", "{ }"),
    ("ai-text", "TextMind API", "Sentiment and keywords on every row.",
     "deterministic methods · neural extras on the same key", "~"),
    ("pii-shield", "PII Shield API", "Redact personal data before it leaves.",
     "19 detectors · Luhn · mod-97 · mask, label or hash", "#"),
]

def wrap(draw, text, f, max_w):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=f) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

for slug, title, pitch, sub, glyph in CARDS:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([28, 28, W - 28, H - 28], outline=LINE, width=2)
    d.line([28, 28, 118, 28], fill=ACCENT, width=5)
    d.line([28, 28, 28, 118], fill=ACCENT, width=5)
    d.line([W - 28, H - 28, W - 118, H - 28], fill=ACCENT, width=5)
    d.line([W - 28, H - 28, W - 28, H - 118], fill=ACCENT, width=5)

    gf = font(BOLD, 96)
    d.text((88, 92), glyph, font=gf, fill=ACCENT)

    tf = font(BOLD, 64)
    d.text((88, 250), title, font=tf, fill=INK)

    pf = font(SEMI, 34)
    y = 340
    for line in wrap(d, pitch, pf, W - 200)[:2]:
        d.text((88, y), line, font=pf, fill=DIM)
        y += 46

    sf = font(MONO, 24)
    d.text((88, y + 26), sub, font=sf, fill=DIM)

    df = font(MONO, 26)
    d.text((88, H - 118), "labs.ayamk.in", font=df, fill=ACCENT)
    d.text((W - 400, H - 118), "Pay as you go from $0.05", font=df, fill=DIM)

    path = os.path.join(OUT, slug + ".png")
    img.save(path, optimize=True)
    print("card", slug, os.path.getsize(path) // 1024, "KB")

# site card
img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)
d.rectangle([28, 28, W - 28, H - 28], outline=LINE, width=2)
d.line([28, 28, 118, 28], fill=ACCENT, width=5)
d.line([28, 28, 28, 118], fill=ACCENT, width=5)
d.text((88, 92), "AL", font=font(BOLD, 84), fill=ACCENT)
d.text((88, 246), "Five APIs for the", font=font(BOLD, 62), fill=INK)
d.text((88, 320), "boring, expensive parts", font=font(BOLD, 62), fill=DIM)
d.text((88, 424), "email · SEO · documents · text · privacy", font=font(MONO, 26), fill=DIM)
d.text((88, H - 118), "labs.ayamk.in", font=font(MONO, 26), fill=ACCENT)
img.save(os.path.join(OUT, "site.png"), optimize=True)
print("card site")
