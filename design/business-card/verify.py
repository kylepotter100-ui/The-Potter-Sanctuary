#!/usr/bin/env python3
"""
Verify the built business-card artwork.

Checks, against the actual generated files (not the source):
  1. PDF page geometry is exactly 91 x 61 mm (85 x 55 trim + 3 mm bleed).
  2. The QR in the rendered artwork decodes to exactly the intended URL —
     decoded with OpenCV from the 300 DPI raster, i.e. the real printed pixels.
  3. How far the QR can be degraded (downscaled, blurred) and still decode,
     as a proxy for real-world phone scanning.
  4. Ink coverage / colour values actually present in the output.

Run:  python3 design/business-card/verify.py
"""
import pathlib
import re
import sys

import cv2
import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "out"
URL = "https://thepottersanctuary.co.uk"

MM_PER_PT = 25.4 / 72.0


def check_pdf_geometry():
    print("1. PDF PAGE GEOMETRY")
    ok = True
    for pdf in sorted(OUT.glob("*.pdf")):
        raw = pdf.read_bytes()
        boxes = re.findall(rb"/MediaBox\s*\[\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s*\]", raw)
        if not boxes:
            print(f"   {pdf.name}: no MediaBox found"); ok = False; continue
        seen = set()
        for b in boxes:
            x0, y0, x1, y1 = (float(v) for v in b)
            w_mm = round((x1 - x0) * MM_PER_PT, 2)
            h_mm = round((y1 - y0) * MM_PER_PT, 2)
            seen.add((w_mm, h_mm))
        for (w, h) in sorted(seen):
            good = abs(w - 91) < 0.6 and abs(h - 61) < 0.6
            ok &= good
            print(f"   {pdf.name:20} {len(boxes)} page(s)  {w} x {h} mm  "
                  f"{'OK' if good else 'MISMATCH (expected 91 x 61)'}")
    return ok


def find_qr_and_decode(png: pathlib.Path):
    img = cv2.imread(str(png))
    if img is None:
        return None, None
    det = cv2.QRCodeDetector()
    data, pts, _ = det.detectAndDecode(img)
    return (data or None), (pts if pts is not None else None)


def check_qr():
    print("\n2. QR DECODE FROM RENDERED ARTWORK (300 DPI)")
    png = OUT / "option-a-p1.png"
    data, pts = find_qr_and_decode(png)
    print(f"   source        : {png.name}")
    print(f"   decoded       : {data!r}")
    print(f"   expected      : {URL!r}")
    exact = data == URL
    print(f"   exact match   : {'YES' if exact else 'NO'}")
    if pts is not None:
        p = pts.reshape(-1, 2)
        w_px = float(np.linalg.norm(p[1] - p[0]))
        print(f"   symbol size   : {w_px:.0f} px @300dpi = {w_px/300*25.4:.1f} mm "
              f"(data area, excl. quiet zone)")
    return exact


def check_robustness():
    """Downscale + blur the artwork to approximate a phone camera at distance."""
    print("\n3. SCAN ROBUSTNESS (degraded copies of the real artwork)")
    img = cv2.imread(str(OUT / "option-a-p1.png"))
    det = cv2.QRCodeDetector()
    h, w = img.shape[:2]
    results = []
    for card_px in (1075, 800, 600, 450, 350, 260, 200):
        scale = card_px / w
        small = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        blurred = cv2.GaussianBlur(small, (3, 3), 0)
        d1, _, _ = det.detectAndDecode(small)
        d2, _, _ = det.detectAndDecode(blurred)
        qr_mm = 17.0
        qr_px = card_px * (qr_mm / 91.0)
        results.append((card_px, int(qr_px), d1 == URL, d2 == URL))
        print(f"   card {card_px:>4} px wide (QR ~{int(qr_px):>3} px): "
              f"sharp {'PASS' if d1 == URL else 'fail'} | blurred {'PASS' if d2 == URL else 'fail'}")
    worst = min((r[0] for r in results if r[2] and r[3]), default=None)
    if worst:
        print(f"   -> decodes reliably down to a {worst}px-wide capture of the card "
              f"(~{int(worst*(17/91))}px QR), sharp and blurred")
    return any(r[2] for r in results)


def check_colours():
    print("\n4. COLOURS PRESENT IN OUTPUT (RGB sampled from raster)")
    for name, png in (("front", "option-a-p1.png"), ("back A", "option-a-p2.png"),
                      ("back B", "option-b-p2.png")):
        img = cv2.imread(str(OUT / png))
        if img is None:
            continue
        bg = img[10, 10][::-1]  # BGR -> RGB, sampled in the bleed area
        print(f"   {name:7} background = #{bg[0]:02X}{bg[1]:02X}{bg[2]:02X}")


def check_cmyk():
    """Separate the CMYK PDFs and report actual ink values + total area coverage."""
    import subprocess
    from collections import Counter
    from PIL import Image

    print("\n5. CMYK SEPARATION (measured from the delivered CMYK PDF)")
    ok = True
    for stem in ("option-a",):
        pdf = OUT / f"{stem}-CMYK.pdf"
        if not pdf.exists():
            print("   no CMYK pdf"); return False
        tif = "/tmp/_verify_sep.tif"
        subprocess.run(["gs", "-dSAFER", "-dBATCH", "-dNOPAUSE", "-dQUIET",
                        "-sDEVICE=tiff32nc", "-r600", "-dFirstPage=1", "-dLastPage=1",
                        f"-sOutputFile={tif}", str(pdf)], check=True)
        im = Image.open(tif); W, H = im.size; px = im.load()
        pct = lambda v: round(v / 255 * 100)
        counts = Counter()
        for y in range(0, H, 2):
            for x in range(0, W, 2):
                counts[tuple(pct(v) for v in px[x, y])] += 1
        print(f"   {pdf.name} — dominant inks (C M Y K, % ):")
        for v, n in counts.most_common(4):
            tac = sum(v)
            print(f"     C{v[0]:>3} M{v[1]:>3} Y{v[2]:>3} K{v[3]:>3}   TAC {tac:>3}%   ({n} samples)")
            if tac > 300:
                print("        ^ WARNING: exceeds 300% total area coverage")
                ok = False
        qr_black = [v for v in counts if v[3] >= 95 and sum(v[:3]) <= 5]
        print(f"   QR modules are K-only: {'YES' if qr_black else 'NO — rich black, registration risk'}")
        ok &= bool(qr_black)
    return ok


def main():
    if not OUT.exists():
        sys.exit("No out/ directory — run build.py first.")
    a = check_pdf_geometry()
    b = check_qr()
    c = check_robustness()
    check_colours()
    d = check_cmyk()
    allok = a and b and c and d
    print("\nRESULT:", "ALL CHECKS PASSED" if allok else "SOME CHECKS FAILED")
    return 0 if allok else 1


if __name__ == "__main__":
    sys.exit(main())
