#!/usr/bin/env python3
"""
Build the Potter Sanctuary business card artwork.

Composes the fragments in src/ into fully self-contained HTML (fonts, logo and
QR inlined as base64 data URIs — no external files, no network), then renders
each to a print-ready PDF and a 300 DPI PNG proof via headless Chromium.

Outputs (in out/):
  option-a.pdf / option-b.pdf   production artwork, 2 pages (front, back), 91x61mm
  option-a.html / option-b.html self-contained HTML source
  proof-guides.pdf              same artwork with trim + safe-area guides overlaid
  *-p1.png / *-p2.png           300 DPI raster proofs (also used for the QR scan test)

Requires: segno, playwright (+ the pre-installed Chromium), pillow.
Run:  python3 design/business-card/build.py
"""
import base64
import pathlib
import shutil
import sys

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE / "src"
OUT = HERE / "out"
ASSETS = HERE / "assets"
FONTS = HERE / "fonts"

# Chromium shipped with the image; version-pinned playwright downloads are disabled.
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

TRIM_W_MM, TRIM_H_MM = 85, 55
BLEED_MM = 3
ART_W_MM = TRIM_W_MM + 2 * BLEED_MM  # 91
ART_H_MM = TRIM_H_MM + 2 * BLEED_MM  # 61

URL = "https://thepottersanctuary.co.uk"


def data_uri(path: pathlib.Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def ensure_qr() -> pathlib.Path:
    """QR as SVG (vector — stays crisp at any print resolution).

    ECC level Q (25% recovery) for tolerance to ink spread and handling.
    border=4 modules is the spec-mandated quiet zone; the cream panel in the CSS
    adds more on top.
    """
    import segno

    out = HERE / "qr-thepottersanctuary.svg"
    qr = segno.make(URL, error="q")
    qr.save(str(out), scale=10, border=4, dark="#1C1C1C", light="#F5F0E8",
            xmldecl=True, svgns=True)
    print(f"  QR: version {qr.version}, ECC {qr.error.upper()}, "
          f"{qr.symbol_size(border=0)[0]} modules + 4-module quiet zone")
    return out


def compose(face_files, guides: bool) -> str:
    css = (SRC / "card.css").read_text()
    css = css.replace("{{FONT_CORMORANT}}",
                      data_uri(FONTS / "CormorantGaramond-latin.woff2", "font/woff2"))
    css = css.replace("{{FONT_LORA}}",
                      data_uri(FONTS / "Lora-latin.woff2", "font/woff2"))

    subs = {
        "{{LOGO_CREAM}}": data_uri(ASSETS / "logo-cream.png", "image/png"),
        "{{LOGO_SAGE}}": data_uri(ASSETS / "logo-sage.png", "image/png"),
        "{{QR}}": data_uri(HERE / "qr-thepottersanctuary.svg", "image/svg+xml"),
        "{{GUIDECLASS}}": " guides" if guides else "",
        "{{GUIDES}}": ('<div class="trim"></div><div class="safe-line"></div>'
                       '<div class="glabel">red = trim 85x55 · blue = safe</div>')
                      if guides else "",
    }

    body = ""
    for f in face_files:
        frag = (SRC / f).read_text()
        for k, v in subs.items():
            frag = frag.replace(k, v)
        body += frag + "\n"

    return (
        "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\" />\n"
        "<title>The Potter Sanctuary — business card</title>\n"
        f"<style>\n{css}\n</style>\n</head>\n<body>\n{body}</body>\n</html>\n"
    )


def render(html_path: pathlib.Path, pdf_path: pathlib.Path, png_stem: str, page_count: int):
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        page = browser.new_page()
        page.goto(html_path.as_uri())
        page.emulate_media(media="print")
        page.wait_for_timeout(400)  # let embedded fonts settle before paint

        page.pdf(
            path=str(pdf_path),
            width=f"{ART_W_MM}mm",
            height=f"{ART_H_MM}mm",
            margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
            print_background=True,
            prefer_css_page_size=True,
        )

        # 300 DPI raster proof: 1mm = 300/25.4 px, so scale CSS px (96dpi) by 3.125
        scale = 300 / 96
        page.set_viewport_size({
            "width": round(ART_W_MM / 25.4 * 96),
            "height": round(ART_H_MM / 25.4 * 96),
        })
        for i in range(page_count):
            card = page.locator(".card").nth(i)
            card.screenshot(path=str(OUT / f"{png_stem}-p{i+1}.png"), scale="css",
                            omit_background=False)
        browser.close()

    # Re-render the PNGs at true 300 DPI using a device scale factor.
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        page = browser.new_page(device_scale_factor=scale)
        page.goto(html_path.as_uri())
        # Screen media here (not print): the screen-only gap in card.css keeps each
        # face isolated so no sliver of the neighbouring card enters the proof.
        page.wait_for_timeout(400)
        for i in range(page_count):
            page.locator(".card").nth(i).screenshot(path=str(OUT / f"{png_stem}-p{i+1}.png"))
        browser.close()


def make_cmyk():
    """Convert the RGB PDFs to DeviceCMYK with Ghostscript.

    IMPORTANT: this is an UNMANAGED conversion using Ghostscript's default CMYK
    profile — it is NOT a press-specific separation (e.g. FOGRA39 / GRACoL).
    Supply the RGB master to the printer if they prefer to convert with their own
    profile; the CMYK file is provided for printers who require CMYK on delivery.
    """
    import subprocess
    for stem in ("option-a", "option-b"):
        src = OUT / f"{stem}.pdf"
        dst = OUT / f"{stem}-CMYK.pdf"
        cmd = [
            "gs", "-dSAFER", "-dBATCH", "-dNOPAUSE", "-dQUIET",
            "-sDEVICE=pdfwrite",
            "-dPDFSETTINGS=/prepress",
            "-sColorConversionStrategy=CMYK",
            "-dProcessColorModel=/DeviceCMYK",
            "-dAutoRotatePages=/None",
            "-dEmbedAllFonts=true", "-dSubsetFonts=true",
            "-dDownsampleColorImages=false",
            "-dDownsampleGrayImages=false",
            "-dDownsampleMonoImages=false",
            f"-sOutputFile={dst}", str(src),
        ]
        subprocess.run(cmd, check=True)
        print(f"  {dst.name}: DeviceCMYK (unmanaged conversion)")


def force_k_only_blacks():
    """Rewrite rich-black fills in the CMYK PDFs to 100% K only.

    Ghostscript's unmanaged RGB->CMYK separates the QR's near-black into a
    four-colour black (measured C72 M68 Y67 K88, ~280% total area coverage).
    On 0.45 mm QR modules that is a real defect: any plate misregistration
    softens the module edges and can break scanning, and 280% TAC exceeds the
    limit of many presses. Nothing else on the card uses a rich black (the type
    is cream/bone on the front and sage-deep on the backs), so rewriting only
    the rich-black colour operators is safe and precise.

    Both operators must be handled: segno draws the QR modules as STROKED paths,
    so the colour is set with `K` (stroke), not `k` (fill). Replacing only the
    fill operator silently does nothing — verified via a 600 dpi separation.
    """
    import pikepdf, re

    def fix(data: bytes):
        n = 0

        def make_repl(op: bytes):
            def repl(m):
                nonlocal n
                c, mm, y, k = (float(m.group(i)) for i in range(1, 5))
                if c > 0.4 and mm > 0.4 and y > 0.4 and k > 0.6:
                    n += 1
                    return b"0 0 0 1 " + op
                return m.group(0)
            return repl

        for op in (b"k", b"K"):  # fill and stroke
            data = re.sub(
                rb"([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+" + op + rb"\b",
                make_repl(op), data)
        return data, n

    for stem in ("option-a", "option-b"):
        path = OUT / f"{stem}-CMYK.pdf"
        pdf = pikepdf.open(path, allow_overwriting_input=True)
        total = 0
        for page in pdf.pages:
            data = pikepdf.Page(page).obj["/Contents"].read_bytes()
            new, n = fix(data)
            if n:
                page.Contents = pdf.make_stream(new)
                total += n
        pdf.save(path)
        print(f"  {path.name}: {total} rich-black fill(s) -> 100% K only")


def main():
    if not pathlib.Path(CHROME).exists():
        sys.exit(f"Chromium not found at {CHROME}")
    OUT.mkdir(exist_ok=True)
    print("Generating QR…")
    ensure_qr()

    jobs = [
        ("option-a", ["front.html", "back-a.html"], False, 2),
        ("option-b", ["front.html", "back-b.html"], False, 2),
        ("proof-guides", ["front.html", "back-a.html", "back-b.html"], True, 3),
    ]
    for stem, faces, guides, n in jobs:
        html = compose(faces, guides)
        hp = OUT / f"{stem}.html"
        hp.write_text(html)
        render(hp, OUT / f"{stem}.pdf", stem, n)
        print(f"  {stem}: {hp.name} -> {stem}.pdf ({n} page(s)) + PNG proofs")

    print("Converting to CMYK…")
    make_cmyk()

    force_k_only_blacks()

    print("\nDone. Artwork in", OUT)


if __name__ == "__main__":
    main()
