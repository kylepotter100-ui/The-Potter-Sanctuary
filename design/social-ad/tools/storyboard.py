"""Storyboard sheet of the film's key beats, pulled from the finished MP4.

    python3 design/social-ad/tools/storyboard.py out/<film>.mp4 out/storyboard.jpg
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BEATS = [
    (1.3, "The logo draws itself"), (3.3, "The Potter Sanctuary"), (4.55, "An arch fills with cream"), (7.6, "Relax. Restore. Glow."),
    (9.2, "The treatment menu"), (9.97, "A tap on Hot Stones"), (10.75, "The card opens"), (13.0, "Hot stones, rendered"),
    (14.6, "The line closes the room"), (17.5, "Whipped, plant-based"), (20.6, "Clarins-trained"), (23.4, "Date and time"),
    (24.95, "Booked"), (26.0, "The daffodil regrows"), (28.5, "Book your quiet hour"), (29.6, "End card"),
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
