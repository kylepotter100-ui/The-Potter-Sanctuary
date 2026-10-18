"""Split photo plates into two depth layers for 2.5D parallax.

Each plate is segmented with GrabCut from hand-placed seed boxes (sure
foreground / sure background, in plate pixels). The foreground is saved with
a feathered alpha; the background has the foreground region inpainted, so
when the two layers move at different rates the gap behind an edge shows
plausible texture, never a hole. At rest, fg-over-bg reproduces the plate.

    python3 design/social-ad/tools/depth_layers.py [preview.jpg [plate ...]]

Run after prep_photos.py. Writes assets/photos/<name>-fg.webp / -bg.jpg.
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

PHOTOS = Path(__file__).resolve().parents[1] / "assets" / "photos"

# (x0, y0, x1, y1) boxes in plate pixels
SEEDS = {
    "stack": {
        "bg": [(0, 0, 1080, 640), (500, 640, 1080, 1030), (0, 640, 150, 820)],
        "fg": [(70, 930, 420, 1290), (430, 1130, 1000, 1700), (0, 1250, 250, 1600), (0, 1760, 1080, 1920), (238, 770, 276, 860)],
    },
    "aroma": {
        "bg": [(0, 0, 1626, 140), (1235, 140, 1626, 600), (0, 140, 60, 860), (745, 150, 895, 470)],
        "fg": [(220, 260, 640, 800), (950, 390, 1170, 780), (720, 800, 1440, 1060), (340, 980, 740, 1270),
               (150, 1180, 560, 1420), (640, 1260, 1480, 1880), (100, 1480, 600, 1900)],
    },
    "scalp": {
        "bg": [(0, 0, 230, 1150), (0, 0, 520, 120), (230, 120, 330, 700)],
        "fg": [(470, 260, 860, 960), (760, 40, 1060, 700), (420, 1050, 1080, 1920), (60, 1500, 400, 1920)],
    },
    "studio": {
        "bg": [(0, 0, 1080, 760), (460, 760, 1080, 930), (0, 760, 300, 860)],
        "fg": [(0, 1080, 1080, 1560), (0, 1640, 640, 1920), (650, 1700, 1080, 1920)],
    },
}


def layers(name, seeds):
    img = cv2.imread(str(PHOTOS / f"{name}.jpg"))
    H, W = img.shape[:2]
    k = 0.5
    small = cv2.resize(img, (int(W * k), int(H * k)), interpolation=cv2.INTER_AREA)
    mask = np.full(small.shape[:2], cv2.GC_PR_BGD, np.uint8)
    # unseeded areas lean foreground near fg seeds: start everything as
    # probable-fg inside the union of fg boxes' bounding area
    for x0, y0, x1, y1 in seeds["fg"]:
        mask[int(y0 * k) : int(y1 * k), int(x0 * k) : int(x1 * k)] = cv2.GC_FGD
    for x0, y0, x1, y1 in seeds["bg"]:
        mask[int(y0 * k) : int(y1 * k), int(x0 * k) : int(x1 * k)] = cv2.GC_BGD
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(small, mask, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    m = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 1.0, 0.0).astype(np.float32)
    m = cv2.resize(m, (W, H), interpolation=cv2.INTER_LINEAR)
    # tidy: drop specks, fill pinholes, soften the edge
    m8 = (m > 0.5).astype(np.uint8)
    m8 = cv2.morphologyEx(m8, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    m8 = cv2.morphologyEx(m8, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    alpha = cv2.GaussianBlur(m8.astype(np.float32), (0, 0), 2.2)

    # background: inpaint a generous band around the foreground
    hole = cv2.dilate(m8, np.ones((41, 41), np.uint8))
    hs = cv2.resize(hole, (int(W * k), int(H * k)), interpolation=cv2.INTER_NEAREST)
    paint = cv2.inpaint(small, hs, 9, cv2.INPAINT_TELEA)
    paint = cv2.GaussianBlur(paint, (0, 0), 3)
    paint = cv2.resize(paint, (W, H), interpolation=cv2.INTER_CUBIC)
    hb = cv2.GaussianBlur(hole.astype(np.float32), (0, 0), 6)[..., None]
    bg = (img * (1 - hb) + paint * hb).astype(np.uint8)

    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    fg = np.dstack([rgb, (alpha * 255).astype(np.uint8)])
    Image.fromarray(fg, "RGBA").save(PHOTOS / f"{name}-fg.webp", quality=92, method=6)
    cv2.imwrite(str(PHOTOS / f"{name}-bg.jpg"), bg, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return rgb, alpha, cv2.cvtColor(bg, cv2.COLOR_BGR2RGB)


previews = []
only = sys.argv[2:]  # optional plate names
for name, seeds in SEEDS.items():
    if only and name not in only:
        continue
    rgb, alpha, bg = layers(name, seeds)
    tint = rgb.astype(np.float32).copy()
    tint[alpha < 0.5] = tint[alpha < 0.5] * 0.25 + np.array([255, 40, 40]) * 0.35
    s = 300 / rgb.shape[0] * 1.8
    a = cv2.resize(tint.astype(np.uint8), None, fx=s, fy=s)
    b = cv2.resize(bg, None, fx=s, fy=s)
    previews.append(np.hstack([a, b, np.zeros((a.shape[0], 8, 3), np.uint8)]))
    print(f"{name}: foreground {alpha.mean() * 100:.0f}% of frame")

if len(sys.argv) > 1:
    h = max(p.shape[0] for p in previews)
    sheet = np.hstack([np.pad(p, ((0, h - p.shape[0]), (0, 0), (0, 0))) for p in previews])
    Image.fromarray(sheet).save(sys.argv[1], quality=88)
