"""Crop and grade the site photography into the film's plates.

Every plate gets the same grade so stock imagery and the real studio read as
one film in the brand palette: shadows lifted towards ink-sage, highlights
rolled into cream, saturation eased (purples hardest, so lavender and the
massage-table vinyl sit with sage rather than fighting it).

    python3 design/social-ad/tools/prep_photos.py

Sources are public/ images, untouched; plates land in assets/photos/.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
PUB = ROOT / "public"
OUT = Path(__file__).resolve().parents[1] / "assets" / "photos"

INK = np.array([0x2A, 0x31, 0x27]) / 255.0  # where the blacks settle
CREAM = np.array([0xF6, 0xEF, 0xDF]) / 255.0  # where the whites settle


def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def rgb_to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn + 1e-8
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
    s = np.where(mx > 0, (mx - mn) / (mx + 1e-8), 0)
    return h, s, mx


def grade(img, exposure=0.0, sat=0.82, purple_sat=0.55, warmth=0.03, lift=1.0, contrast=0.10):
    a = np.asarray(img.convert("RGB")).astype(np.float64) / 255.0
    lin = srgb_to_lin(a) * (2.0 ** exposure)
    a = lin_to_srgb(lin)

    # saturation, with purples/magentas eased harder
    h, s, v = rgb_to_hsv(a)
    lum = (a * [0.2126, 0.7152, 0.0722]).sum(-1, keepdims=True)
    purple = np.exp(-(((h - 0.80) / 0.075) ** 2))[..., None]
    k = sat * (1 - purple) + purple_sat * purple
    a = lum + (a - lum) * k

    # gentle S-curve around mid grey
    a = a + contrast * (a - 0.5) * (1 - np.abs(2 * a - 1))

    # warmth: nudge red up / blue down in the mids
    mid = 4 * a * (1 - a)
    a[..., 0] += warmth * mid[..., 0]
    a[..., 2] -= warmth * mid[..., 2]

    # split-tone: blacks to ink-sage, whites to cream
    lum = (a * [0.2126, 0.7152, 0.0722]).sum(-1, keepdims=True)
    sh = (1 - lum) ** 3 * 0.55 * lift
    hi = lum ** 3 * 0.35
    a = a * (1 - sh) + INK * sh
    a = a * (1 - hi) + CREAM * hi
    return Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))


def fit(img, box, size):
    return img.crop(box).resize(size, Image.LANCZOS)


def save(img, name):
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / name, quality=95, subsampling=0)
    print(f"{name:18s} {img.size}")


# Hot stones on a back — shown as a cinematic band (1080 wide).
src = Image.open(PUB / "treatments/hot-stones-full-body/1.jpg")
save(grade(fit(src, (0, 120, 1280, 720), (1280, 600)), exposure=0.05), "band-stones.jpg")

# Candle + stacked basalt — full-bleed 9:16.
src = Image.open(PUB / "treatments/hot-stones-back/3.jpg")
save(grade(fit(src, (920, 0, 1874, 1696), (1080, 1920)), sat=0.80, warmth=0.0), "stack.jpg")

# Lavender, candle, oils — a wider plate so the camera can drift right.
src = Image.open(PUB / "treatments/aromatherapy/3.jpg")
save(grade(fit(src, (425, 0, 2900, 2922), (1626, 1920)), sat=0.80, purple_sat=0.62), "aroma.jpg")

# Face-up scalp massage, turned upright: hands cradle the head from above.
src = Image.open(PUB / "treatments/back-neck-scalp/1.jpg").rotate(90, expand=True)
save(grade(fit(src, (40, 0, 1446, 2500), (1080, 1920)), exposure=-0.05, sat=0.85), "scalp.jpg")

# The real studio: warmed and brightened so the walls read cream.
src = Image.open(PUB / "hero.jpg")
studio = grade(
    fit(src, (384, 0, 1536, 2048), (1080, 1920)),
    exposure=0.42,
    sat=0.80,
    purple_sat=0.35,
    warmth=0.06,
    lift=0.6,
    contrast=0.06,
)
# a whisper of halation so the phone photo sits with the stock plates
glow = studio.filter(ImageFilter.GaussianBlur(18))
studio = Image.blend(studio, Image.fromarray(np.maximum(np.asarray(studio), np.asarray(glow))), 0.2)
save(studio, "studio.jpg")
