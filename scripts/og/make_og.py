"""
Social preview image (public/og.jpg, 1200 x 630) from a concept render and the site fonts.
Needs Pillow (with raqm for Hebrew) and fontTools + brotli (to read the woff2 fonts):
  python3 scripts/og/make_og.py
"""
import io, os
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
FONTS = os.path.join(ROOT, 'public', 'fonts')


def font(name, size, axes=None):
    tt = TTFont(os.path.join(FONTS, name))
    tt.flavor = None
    buf = io.BytesIO()
    tt.save(buf)
    buf.seek(0)
    f = ImageFont.truetype(buf, size)
    if axes:
        try:
            f.set_variation_by_axes(axes)
        except Exception:
            pass
    return f


W, H = 1200, 630
img = Image.open(os.path.join(ROOT, 'public', 'renders', 'room-b-modern.webp')).convert('RGB')
scale = W / img.width
img = img.resize((W, round(img.height * scale)), Image.LANCZOS)
top = (img.height - H) // 2
img = img.crop((0, top, W, top + H))

# Soft graphite veil from the right (Hebrew reading start) so the type reads on the render.
veil = Image.new('L', (W, H))
vd = ImageDraw.Draw(veil)
for x in range(W):
    t = max(0.0, (x - W * 0.16) / (W * 0.62))
    vd.line([(x, 0), (x, H)], fill=int(255 * min(1.0, t ** 1.2) * 0.93))
veil = veil.filter(ImageFilter.GaussianBlur(24))
dark = Image.new('RGB', (W, H), (18, 17, 16))
img = Image.composite(dark, img, veil)

d = ImageDraw.Draw(img)
bone, muted, oak = (244, 240, 234), (190, 181, 168), (201, 162, 122)
pad = 72
he_big = font('frank-ruhl-libre-hebrew.woff2', 92, [400])
he_small = font('heebo-hebrew.woff2', 30, [400])
en_tag = font('fraunces-latin-core.woff2', 34, [144, 380])
ui = font('inter-tight-latin-core.woff2', 18, [500])

d.text((W - pad, 150), 'אביבי מטבחים', font=he_small, fill=oak, anchor='ra', direction='rtl')
d.text((W - pad, 205), 'מעצבים מטבחים', font=he_big, fill=bone, anchor='ra', direction='rtl')
d.text((W - pad, 315), 'מעצבים חוויות', font=he_big, fill=bone, anchor='ra', direction='rtl')
d.text((W - pad, 452), 'Designing kitchens. Designing experiences.', font=en_tag, fill=muted, anchor='ra')
d.line([(W - pad - 64, 528), (W - pad, 528)], fill=oak, width=2)
d.text((W - pad, 548), 'AVIVI KITCHENS  ·  DESIGN CONCEPT', font=ui, fill=muted, anchor='ra')

img.save(os.path.join(ROOT, 'public', 'og.jpg'), quality=86, optimize=True, progressive=True)
print('og.jpg', os.path.getsize(os.path.join(ROOT, 'public', 'og.jpg')) // 1024, 'KB')
