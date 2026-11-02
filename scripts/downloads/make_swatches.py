"""
Material swatches for the professionals' library (example files for the concept).
Procedural, seamless-enough 800 x 800 PNGs: oak veneer, walnut veneer, matte graphite
lacquer, white marble, brushed brass.  Run: python3 scripts/downloads/make_swatches.py
"""
import os
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'downloads')
N = 800
rng = np.random.default_rng(1969)


def noise(shape_small, size=(N, N), resample=Image.BICUBIC):
    """Value noise: a small random grid upsampled. shape_small = (rows, cols)."""
    a = rng.random(shape_small).astype(np.float32)
    img = Image.fromarray((a * 255).astype(np.uint8), 'L').resize(size, resample)
    return np.asarray(img, dtype=np.float32) / 255.0


def fbm(base, octaves=4, size=(N, N)):
    total = np.zeros((size[1], size[0]), np.float32)
    amp, norm = 1.0, 0.0
    r, c = base
    for _ in range(octaves):
        total += amp * noise((max(2, int(r)), max(2, int(c))), size)
        norm += amp
        amp *= 0.5
        r, c = r * 2, c * 2
    return total / norm


def save(name, rgb):
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    Image.fromarray(rgb, 'RGB').save(os.path.join(OUT, name), optimize=True)
    print(name, os.path.getsize(os.path.join(OUT, name)) // 1024, 'KB')


def wood(light, dark, line_strength, figure):
    """Quarter-cut veneer: fine, nearly straight growth lines with gentle drift and pores."""
    y, x = np.mgrid[0:N, 0:N].astype(np.float32)
    # growth-ring profile along x: light earlywood bands split by thin dark latewood lines
    L = int(N * 1.3)
    prof = np.zeros(L, np.float32)
    pos = 0.0
    while pos < L:
        w = rng.uniform(4.0, 15.0)
        lw = rng.uniform(0.8, 2.6) * (1.0 + 0.6 * rng.random())
        c = int(pos + w)
        for k in range(max(0, c - 3), min(L, c + 4)):
            d = abs(k - (pos + w)) / lw
            prof[k] = max(prof[k], np.exp(-d * d) * rng.uniform(0.55, 1.0))
        pos += w + lw
    # slow drift so lines are not ruler-straight, plus a soft wave for figure
    drift = (fbm((2, 3), 3) - 0.5) * 26.0 * figure + np.sin(y / N * np.pi * 2 * 1.3 + x / N * 2.0) * 3.0 * figure
    u = np.clip(x + drift + 40, 0, L - 2)
    i0 = u.astype(int)
    f = u - i0
    lines = prof[i0] * (1 - f) + prof[i0 + 1] * f
    # broad tonal variation along the grain (stretched noise)
    tone = fbm((3, 26), 4)
    k = np.clip(lines * line_strength + (tone - 0.5) * 0.45, 0, 1)[..., None]
    col = np.array(light, np.float32) * (1 - k) + np.array(dark, np.float32) * k
    # pores: short dark dashes aligned with the grain
    pores = noise((N // 6, N // 2), resample=Image.NEAREST)
    col *= np.where(pores > 0.955, 0.86, 1.0)[..., None]
    col *= (0.97 + 0.06 * fbm((2, 2), 2))[..., None]
    return col


os.makedirs(OUT, exist_ok=True)

save('swatch-oak-veneer.png', wood((216, 182, 140), (150, 108, 68), 0.75, 0.8))
save('swatch-walnut-veneer.png', wood((122, 86, 60), (52, 34, 24), 0.85, 1.3))

# matte lacquer: near-flat graphite with very fine grain and a soft light falloff
y, x = np.mgrid[0:N, 0:N].astype(np.float32)
fine = noise((N // 2, N // 2)) - 0.5
fall = 1.04 - 0.08 * (y / N) - 0.04 * np.abs(x / N - 0.5)
save('swatch-matte-lacquer.png', (np.array((46, 45, 43), np.float32) * fall[..., None]) + fine[..., None] * 4)

# white marble: turbulence veins
t = fbm((4, 4), 6)
v = np.abs(np.sin((x * 0.006 + y * 0.0035) * 3.2 + t * 9.0))
veins = np.exp(-v * 18.0)
fine_v = np.exp(-np.abs(np.sin((x * 0.011 - y * 0.006) * 2.0 + fbm((8, 8), 5) * 14.0)) * 40.0)
cloud = fbm((3, 3), 4)
base = np.array((238, 235, 229), np.float32) * (0.97 + 0.04 * cloud)[..., None]
vein_col = np.array((140, 138, 136), np.float32)
m = np.clip(veins * 0.75 + fine_v * 0.35, 0, 1)[..., None]
save('swatch-white-marble.png', base * (1 - m) + vein_col * m)

# brushed brass: horizontal streaks, warm metallic gradient
streaks = fbm((N // 2, 6), 4)
band = 0.82 + 0.3 * np.exp(-((y / N - 0.38) ** 2) / 0.05)
col = np.array((184, 142, 82), np.float32) * band[..., None] * (0.86 + 0.24 * streaks)[..., None]
save('swatch-brushed-brass.png', col)
