# The Potter Sanctuary — "Drop your shoulders." (social film)

A 25-second vertical film for Instagram Reels, TikTok, YouTube Shorts and
Stories. **Standalone design asset: no application code, routes or data are
involved.**

| | |
|---|---|
| Master | `out/the-potter-sanctuary-reel-9x16.mp4` (31 MB) |
| Cover frame | `out/the-potter-sanctuary-reel-9x16-cover.jpg` (the end card) |
| Storyboard | `out/storyboard.jpg` — the sixteen key beats on one page, for sign-off |
| Format | 1080 × 1920 (9:16), 25.0 s, 30 fps |
| Video | H.264 High 4.2, ~10 Mbps, BT.709 tagged; rendered at 60 fps and blended in pairs to 30 fps (a 180° shutter's motion blur) |
| Audio | AAC 48 kHz stereo, mastered to −14 LUFS integrated, true peak under −1 dBTP |
| Safe zones | All type and the logo sit between y ≈ 210 and y ≈ 1450 of 1920, clear of the platform UI at the top and the caption and buttons at the bottom |
| Sound off | Every message is on screen, so the film works muted in the feed |

## The idea: one line

The logo is a single hand-drawn line, so the film is too. One cream line runs
through all of it, and every scene change is that line turning into the next
thing, never a cut:

| Time | Beat | The line | Copy |
|---|---|---|---|
| 0.0–3.2 | **Hook** | Draws a woman from behind, shoulders hunched up to her ears, trembling — the word *shoulders* shivers with them, in a tight vignette. Then they drop on a spring, the word falls with them, the vignette opens, the room warms and her spine lengthens. | *Drop your* ***shoulders.*** → *Breathe* ***out.*** |
| 3.2–4.3 | Lie down | The pen keeps going — the seated figure unravels as the same line draws her lying on the table. | |
| 4.4–7.0 | **Hot stones** | Four stones drop onto her back, one per beat. The real photograph develops outward from each stone: the drawn stones were placed where the real ones are. | — HOT STONES — *Heat travels / where pressure alone /* ***cannot reach.*** |
| 6.6–7.6 | Zoom-through | The camera dives into a stone and pulls back out of another, into the candle-lit stack. | |
| 8.4–9.6 | Steam | The line rises off the hot stone as steam and dissolves the frame like smoke, onto lavender and oils. | |
| 9.3–12.3 | **Aromatherapy** | | — AROMATHERAPY — *Oils blended / on the day, /* ***for you.*** |
| 12.3–13.9 | A drop of oil | The line lowers a thread, pinches into a drop, and the drop lands in a ripple that opens onto the next scene. | |
| 13.2–16.0 | **Back, neck & scalp** | | — BACK, NECK & SCALP — *A trained hand, /* ***a natural touch.*** |
| 15.9–17.0 | Doors | The line cuts the frame horizontally and the two halves part like doors onto the real studio. | |
| 16.7–19.4 | **The studio** | The real treatment room in Beck Row (`public/hero.jpg`). | *Clarins-trained. / Plant-based. / One guest /* ***at a time.*** |
| 19.3–20.6 | Portal | The line finds the room's own arched mirror, traces it, the glass turns sage, and the camera pushes through it. | |
| 20.3–25.0 | **End card** | The line rises from below and grows into the daffodil: stem, leaves, then each petal closing at its tip. | *The Potter Sanctuary* · BODY THERAPY · BECK ROW, SUFFOLK · **Book your quiet hour →** · thepottersanctuary.co.uk |

The hook speaks to the viewer's body ("drop your shoulders") because most
people scrolling will, and it is the brand's promise in two seconds: tension,
then release. It obeys the editorial voice in the main README — unhurried, no
exclamation marks, no urgency — and the copy is lifted from the site
(`lib/services.ts`, `app/page.tsx`): "heat travels where pressure alone cannot
reach", "a trained hand, a natural touch", "one guest at a time", "book your
quiet hour".

## Brand system used

- **Colour:** the site tokens from `app/globals.css` — sage `#8A9E85`,
  sage-deep `#6E8068`, cream `#EFE8D6`, ink `#3A3F31`. The film moves from a
  dark ink-sage room to the sage end card: tension to calm.
- **Type:** Cormorant Garamond 300 (roman and italic) for headlines and the
  wordmark, Lora 500 tracked capitals for labels — the site's own pairing.
- **Logo:** `public/sanctuary-logo.png` is the only source (no vector exists),
  so `tools/vectorize_logo.py` skeletonises it into centre-line strokes with
  measured widths. Each stroke point carries its distance from the stem tip,
  which is what lets the flower *grow*; fully drawn it matches the PNG
  (checked by overlap against the original alpha).
- **Photography:** the site's treatment photos and the real studio, cropped
  to 9:16 and given one grade (`tools/prep_photos.py`) — ink-sage shadows,
  cream highlights, purples eased — so stock and studio read as one film.
  Four plates are split into foreground/background depth layers
  (`tools/depth_layers.py`) so camera moves have real parallax.

## Sound

Original, synthesised from scratch in `tools/score.py` (numpy/scipy; no
samples, no licensing). It reads the same cue sheet as the picture
(`src/cues.json`), so each sound sits on its frame: a thin, beating tension
tone that cuts when the shoulders drop; an exhale and a singing bowl on the
release; a mallet note per stone, panned to where it lands; a whoosh and a
sub bloom for the zoom-through; air and wind-chimes on the steam; the oil
drop's glide, plink and shimmer; a blade of air left to right; three rising
notes for the studio lines; a bowl and four bells as the daffodil grows.
Underneath, a slow pad moves through D major (Dmaj9 → Bm11 → Gmaj9 →
A6/9sus → D/F♯ → Gmaj7 → Asus → Dmaj9), dark under the hook and opening up.

## How it is made

```
src/index.html, main.js   page: loads fonts, plates, logo strokes, cue sheet
src/film.js               every scene, transition and type move, as a pure function of time
src/shapes.js             hand-authored line drawings and measured landmarks
src/cues.json             the timeline — shared by picture and sound
src/lib/                  easing/springs, splines, the ribbon stroke, kinetic type,
                          and the WebGL compositor (smoke dissolve, ripple, zoom blur,
                          heat shimmer, vignette, grain)
tools/prep_photos.py      crop + grade the site photos into plates
tools/depth_layers.py     split plates into parallax layers (GrabCut + inpainting)
tools/vectorize_logo.py   PNG logo → growable centre-line strokes
tools/score.py            the score and sound design
render.mjs                headless Chromium renderer (stills or a full frame sequence)
build.sh                  everything, end to end
```

Each frame is drawn on 2D canvases (photos, type, the line) and composited in
WebGL, then captured by Playwright. Because the film is a function of time,
any frame can be rendered alone: `node render.mjs stills --times 1.6,20.9`.

### Rebuild

```bash
design/social-ad/build.sh              # ~15 min on 4 cores
SKIP_FRAMES=1 design/social-ad/build.sh   # re-encode/re-mix existing frames
```

Needs Node with Playwright + Chromium, ffmpeg (libx264), and Python 3 with
numpy, scipy, Pillow, scikit-image and opencv-python-headless. Frames go to
`$FRAMES` (default `/tmp/potter-frames`), outside the repo.

Preview in a browser: serve the repo root (`npx serve .`) and open
`/design/social-ad/src/index.html?play` (or `?t=12.9` for one frame).

## Before this runs as a paid ad

1. **Check the stock photo licences.** The treatment photos in
   `public/treatments/` look like stock images. A licence that covers the
   website does not always cover paid social advertising — confirm with
   wherever they were bought. The studio shot (`public/hero.jpg`) is the
   owner's own.
2. **Fonts** are Cormorant Garamond and Lora (SIL Open Font License), which
   permits this use; the files in `assets/fonts/` come from the Fontsource
   packages.
3. **Platform crops.** Reels, TikTok, Shorts and Stories use the full 9:16.
   Feed placements crop to 4:5 or 1:1, which would trim the top and bottom of
   several layouts; a feed version would need its own layout pass in
   `src/film.js` (positions are authored for 1080 × 1920).
