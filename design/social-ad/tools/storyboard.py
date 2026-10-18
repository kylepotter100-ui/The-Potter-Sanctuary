"""Storyboard sheet of the film's key beats, pulled from the finished MP4.

    python3 design/social-ad/tools/storyboard.py out/<film>.mp4 out/storyboard.jpg
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BEATS = [
    (0.9, "Shoulders up to the ears"), (2.2, "…and drop"), (3.7, "The line lies her down"), (4.75, "Four hot stones"),
    (6.2, "The photograph develops"), (6.95, "Into the stone"), (7.9, "Out of the stack"), (9.1, "Steam dissolves the frame"),
    (11.0, "Aromatherapy"), (13.4, "A drop of oil, a ripple"), (14.9, "Back, neck & scalp"), (16.5, "The frame opens"),
    (18.7, "The real studio"), (20.1, "Through the mirror"), (21.25, "The daffodil grows"), (24.5, "Book your quiet hour"),
]

src, out = Path(sys.argv[1]), Path(sys.argv[2])
TW, TH, COLS, PAD, LABEL = 300, 534, 4, 18, 46
rows = (len(BEATS) + COLS - 1) // COLS
sheet = Image.new("RGB", (COLS * TW + (COLS + 1) * PAD, rows * (TH + LABEL) + (rows + 1) * PAD), (32, 37, 30))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("DejaVuSans.ttf", 17)
    small = ImageFont.truetype("DejaVuSans.ttf", 14)
except OSError:
    font = small = ImageFont.load_default()

with tempfile.TemporaryDirectory() as tmp:
    for i, (t, label) in enumerate(BEATS):
        png = Path(tmp) / f"{i}.png"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", str(png)], check=True)
        x = PAD + (i % COLS) * (TW + PAD)
        y = PAD + (i // COLS) * (TH + LABEL + PAD)
        sheet.paste(Image.open(png).convert("RGB").resize((TW, TH), Image.LANCZOS), (x, y))
        draw.text((x, y + TH + 8), f"{t:05.2f}s", fill=(184, 196, 166), font=small)
        draw.text((x + 62, y + TH + 6), label, fill=(239, 232, 214), font=font)

sheet.save(out, quality=90)
print(f"wrote {out}")
