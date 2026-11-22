import os
from PIL import Image, ImageDraw, ImageFont

out = os.path.join(os.environ["TEMP"], "logos")
os.makedirs(out, exist_ok=True)

BG = (8, 9, 10)
ACCENT = (255, 106, 43)
DIM = (125, 134, 143)
LINE = (47, 54, 61)

specs = [
    ("emailcheck", "@", "MAIL"),
    ("seo-audit", "%", "SEO"),
    ("docparse", "{ }", "DOCS"),
    ("ai-text", "~", "TEXT"),
    ("pii-shield", "#", "PII"),
]

def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()

bold = "C:\\Windows\\Fonts\\segoeuib.ttf"
mono = "C:\\Windows\\Fonts\\consola.ttf"

for slug, glyph, label in specs:
    img = Image.new("RGB", (500, 500), BG)
    d = ImageDraw.Draw(img)
    # thin inner frame
    d.rectangle([18, 18, 481, 481], outline=LINE, width=2)
    # accent corner ticks
    d.line([18, 18, 78, 18], fill=ACCENT, width=4)
    d.line([18, 18, 18, 78], fill=ACCENT, width=4)
    d.line([481, 481, 421, 481], fill=ACCENT, width=4)
    d.line([481, 481, 481, 421], fill=ACCENT, width=4)
    # glyph
    size = 190 if len(glyph) == 1 else 140
    f = font(bold, size)
    box = d.textbbox((0, 0), glyph, font=f)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((500 - w) / 2 - box[0], (500 - h) / 2 - box[1] - 18), glyph, font=f, fill=ACCENT)
    # label
    lf = font(mono, 34)
    lb = d.textbbox((0, 0), label, font=lf)
    lw = lb[2] - lb[0]
    d.text(((500 - lw) / 2 - lb[0], 372), label, font=lf, fill=DIM)
    path = os.path.join(out, slug + ".png")
    img.save(path)
    print("logo", path)

print("dir", out)
