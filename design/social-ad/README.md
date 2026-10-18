# The Potter Sanctuary — "Relax. Restore. Glow." (social film)

A 30-second vertical film for Instagram Reels, TikTok, YouTube Shorts and
Stories. **Standalone design asset: no application code, routes or data are
involved.**

| | |
|---|---|
| Master | `out/the-potter-sanctuary-reel-9x16.mp4` (34 MB) |
| Cover frame | `out/the-potter-sanctuary-reel-9x16-cover.jpg` (the end card) |
| Storyboard | `out/storyboard.jpg`: the sixteen key beats on one page, for sign-off |
| Format | 1080 × 1920 (9:16), 30.0 s, 30 fps |
| Video | H.264 High 4.2, BT.709 tagged; rendered at 60 fps and blended in pairs to 30 fps (a 180° shutter's motion blur) |
| Audio | AAC 48 kHz stereo, mastered to −14 LUFS integrated, true peak under −1 dBTP |
| Safe zones | All type, prices and buttons sit inside x 60–940, y 300–1460 of 1080 × 1920, clear of the platform UI: the top bar, the caption and buttons along the bottom, and the action rail on the right |
| Sound off | Every message is on screen, so the film also works muted in the feed |

## The idea: the line that draws the logo

The film opens on the logo drawing itself, a single luminous line on the
brand's sage. That drawing is the film's signature. The same line goes on to
draw the shape each new screen opens from, so there are no hard cuts. Every
screen is designed for the film: no photography is used, and the imagery is
rendered in code. Picture and music share one 72 BPM grid
(`src/cues.json`). Screens change on bar lines, and every tap lands on a beat.

| Time | Screen | The line / transition | Motion | Copy |
|---|---|---|---|---|
| 0.0–3.5 | **The logo** | A point of light grows the daffodil: the stem shoots up, the leaves unfold, then the petals close at their tips | Glow swells as the flower completes; the wordmark rises out of a mask; the eyebrow letters fade in one by one as their spacing tightens | *The Potter Sanctuary* · BODY THERAPY · BECK ROW, SUFFOLK |
| 3.5–5.0 | Arch | The line draws an arch around the logo from its apex, and cream fills it from below like poured liquid | The leaf shadows fall across the cream as well | |
| 5.0–7.9 | **Relax. Restore. Glow.** | A small daffodil regrows at the top; the line loops "Glow." like a pen note | Elastic type: each letter springs up, overshoots and settles, one word per beat | BODY THERAPIES TO · *Relax. Restore.* ***Glow.*** |
| 7.9–8.4 | Push | The screen slides away with directional motion blur | | |
| 8.4–10.3 | **The menu** | The tapped card is traced by the line | Four treatment cards spring up in sequence, each with a glossy pearl in its oil or stone colour. A fingertip arcs in and taps *Hot Stones*: the card squishes, flashes and sends out a ripple | THE TREATMENT MENU · *Four rituals.* · names, times, pressures and prices from `lib/services.ts` |
| 10.3–11.1 | Card opens | The card grows to full screen, revealing the 3D set through its window | | |
| 11.1–13.9 | **Hot stones** | | Rendered basalt stack on a cream plinth in a sage arched niche, under leaf shadows. The top stone lands on the downbeat and the camera drifts. A caption card springs up with a £60 price pill | HOT STONES · 60 MIN · *Heat travels where / pressure alone cannot reach.* |
| 13.9–15.0 | Iris | The line draws a circle and the room closes to it, opening onto a whipped body butter seen from above | | |
| 15.0–18.4 | **Products** | | Elastic words, each landing on a melody note; a pill slides in on a spring; the dish shrinks into a badge | *Whipped. Plant-based. Small-batch.* · MADE BY PRECYSE BY NATURE |
| 18.3–21.6 | **Trust** | The line draws the badge's rings, then underlines the headline | Rotating circular type, five stars that pop in one by one, masked headline, chips that spring in. The badge flies off as the next card is drawn | FIVE-STAR CARE · PLANT-BASED · ONE GUEST AT A TIME · *Clarins* TRAINED · *A trained hand, / a natural touch.* · 1:1 PRIVATE STUDIO · BY APPOINTMENT |
| 21.2–25.3 | **Booking in three taps** | The line draws the booking card out from its top centre, then the check mark | Dates spring in and Fri 16 is tapped; time chips spring in and 11:30 is tapped; the summary rises in. The *Confirm booking* button is pressed, ripples, and morphs into a circle with a check | BOOK ONLINE · *Choose a time.* · Hot Stones Full Body £60 · *You're booked.* |
| 25.0–30.0 | **The logo + CTA** | The check's stroke carries on upward into the stem and the daffodil grows again; then the line runs once around the CTA | The CTA springs in and is tapped on the downbeat. The press triggers an inner ripple, a halo, an arrow nudge and a burst of fluttering petals. The URL rises in, then a final pulse | *The Potter Sanctuary* · **BOOK YOUR QUIET HOUR →** · thepottersanctuary.co.uk |

The copy keeps to the editorial voice in the main README: unhurried, no
exclamation marks, no urgency. The facts come from the site: names, durations,
pressures and prices from `lib/services.ts`; "heat travels where pressure
alone cannot reach", Clarins-trained, five-star, Precyse By Nature's
small-batch plant-based products and "one guest at a time" from
`lib/services.ts` and `app/page.tsx`; "A trained hand, a natural touch." and
"Book your quiet hour." are the site's own headlines. "Relax. Restore. Glow.",
"Four rituals.", "Choose a time." and "You're booked." are new lines written
for the film.

## Brand system used

- **Colour:** the site tokens from `app/globals.css`: sage `#8A9E85` (the
  ground of the whole film), sage-deep `#6E8068`, cream `#EFE8D6`, ink
  `#3A3F31`, plus two tints made from them (`src/kit.js`).
- **Type:** Cormorant Garamond 300 (roman and italic) for headlines and the
  wordmark, and Lora 500 tracked capitals for labels: the site's own pairing.
- **Logo:** `public/sanctuary-logo.png` is the only source (no vector exists),
  so `tools/vectorize_logo.py` skeletonises it into centre-line strokes with
  measured widths. Each stroke point also records its distance from the stem
  tip, which is what lets the flower *grow*. Fully drawn, it matches the PNG
  (checked against the original alpha).
- **Imagery:** rendered, not photographed. `src/beauty3d.js` raymarches the
  hot-stone set (glossy basalt, plinth and arched niche, soft shadows, ambient
  occlusion, a leaf-shadow gobo) and the whipped body butter (a spiral height
  field in a ceramic dish). `src/leaves.js` paints the drifting leaf shadows
  that lie over the sage.

## Music and sound

The music is an original spa piece, synthesised from scratch in
`tools/score.py` (numpy/scipy): no samples and no licensing. It is in D major
at 72 BPM, with a felt-piano melody over flowing left-hand arpeggios, warm
strings, a soft sub, harp glissandi (Karplus–Strong) into each transition and
a singing bowl at the start and end. The chords run Dmaj9 → Bm11 → Gmaj9 →
Em9–A → D/F♯ → Gmaj7♯11 → Em9–Asus4 → Dmaj9–G/D → Dmaj9. The final cadence
lands on the CTA tap.

The melody is written to the picture. It plays a note on each of *Relax*,
*Restore* and *Glow*, on the menu tap, on the stone landing, and on each of
*Whipped*, *Plant-based* and *Small-batch*. It walks down the scale across
the date, time and confirm taps. The UI sounds sit 6–13 dB under the music:
soft pitched taps, elastic pops tuned to the melody, the stone's clack, bells
for the stars and the check, and a sparkle for the CTA. The mix gets
convolution reverb and gentle bus compression, and is mastered to −14 LUFS.

## How it is made

```
src/index.html, main.js   page: loads fonts, logo strokes and the cue sheet; builds the 3D renderer
src/film.js               every screen, transition and type move, as a pure function of time
src/kit.js                motion-graphics kit: cards, pills, fingertip and ripple, stars,
                          pearls, circular type, and the outlines the line traces
src/beauty3d.js           WebGL raymarcher for the stones set and the whipped butter (+ FXAA)
src/leaves.js             tileable leaf-shadow texture
src/cues.json             the timeline on the 72 BPM grid, shared by picture and sound
src/lib/                  easing/springs, splines, the ribbon stroke and its glow,
                          kinetic type, and the WebGL compositor (grain, vignette, motion blur)
tools/vectorize_logo.py   PNG logo → growable centre-line strokes
tools/score.py            the music and sound design
tools/storyboard.py       storyboard sheet from the finished MP4
render.mjs                headless Chromium renderer (stills or a full frame sequence)
build.sh                  everything, end to end
```

Each frame is drawn on 2D canvases (screens, type, the line) and composited
in WebGL, then captured by Playwright. The 3D imagery renders at 0.75× scale
and 30 fps; it is soft-lit, so the upscale doesn't show. Because the film is
a function of time, any frame can be rendered on its own:
`node render.mjs stills --times 1.6,24.9`.

### Rebuild

```bash
design/social-ad/build.sh                 # ~15 min on 4 cores
SKIP_FRAMES=1 design/social-ad/build.sh   # re-encode/re-mix existing frames
```

Needs Node with Playwright + Chromium, ffmpeg (libx264), and Python 3 with
numpy, scipy, Pillow and scikit-image. Frames go to `$FRAMES` (default
`/tmp/potter-frames`), outside the repo.

Preview in a browser: serve the repo root (`npx serve .`) and open
`/design/social-ad/src/index.html?play` (or `?t=12.9` for one frame).

## Before this runs as a paid ad

1. **No third-party imagery or audio.** The film uses no stock photos and no
   samples. The fonts are Cormorant Garamond and Lora (SIL Open Font
   License), which permits this use; the files in `assets/fonts/` come from
   the Fontsource packages.
2. **The booking screen is illustrative.** It shows the idea of booking in
   three taps. It is not a screenshot of the live booking page, and the dates
   are examples.
3. **Platform crops.** Reels, TikTok, Shorts and Stories use the full 9:16.
   Feed placements crop to 4:5 or 1:1, which would trim the top and bottom of
   several layouts. A feed version would need its own layout pass in
   `src/film.js` (positions are authored for 1080 × 1920).
