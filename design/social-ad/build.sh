#!/usr/bin/env bash
# Rebuild the film end to end:
#   logo strokes → score → 60 fps frames → mastered 30 fps MP4
#
#   design/social-ad/build.sh            full build
#   SKIP_FRAMES=1 design/social-ad/build.sh   re-encode existing frames
#
# Frames (1,800 PNGs, ~5 GB) and the intermediate audio go to $FRAMES,
# outside the repo; out/ keeps only the deliverables.
set -euo pipefail
cd "$(dirname "$0")"
FRAMES="${FRAMES:-${TMPDIR:-/tmp}/potter-frames}"
OUT=out
NAME=the-potter-sanctuary-reel-9x16
mkdir -p "$OUT" "$FRAMES"

python3 tools/vectorize_logo.py >/dev/null
python3 tools/score.py "$FRAMES/score.wav"

if [ -z "${SKIP_FRAMES:-}" ]; then
  node render.mjs frames --fps 60 --out "$FRAMES" --workers "${WORKERS:-4}" ${RESUME:+--resume}
fi

# Audio master: lift to -14 LUFS integrated, then a brick-wall limiter at
# -1.2 dBFS keeps true peak under -1 dBTP.
I=$(ffmpeg -hide_banner -nostats -i "$FRAMES/score.wav" -af ebur128 -f null - 2>&1 | awk '/^ *I:/{v=$2} END{print v}')
GAIN=$(python3 -c "print(round(-14.0 - ($I), 2))")
ffmpeg -hide_banner -loglevel error -y -i "$FRAMES/score.wav" \
  -af "volume=${GAIN}dB,alimiter=limit=0.87:attack=4:release=60:level=disabled" \
  -ar 48000 "$FRAMES/score-master.wav"

# Picture: the 60 fps render blended in pairs to 30 fps (a 180° shutter's
# motion blur), converted to BT.709 and tagged so phones show true colour.
ffmpeg -hide_banner -loglevel error -stats -y \
  -framerate 60 -i "$FRAMES/%05d.png" -i "$FRAMES/score-master.wav" \
  -vf "tmix=frames=2:weights='1 1',framestep=2,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -r 30 -c:v libx264 -preset slow -tune film -crf 18 -maxrate 14M -bufsize 28M -profile:v high -level 4.2 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart \
  "$OUT/$NAME.mp4"

# Cover frame for the post (the end card) and a storyboard of the key beats.
ffmpeg -hide_banner -loglevel error -y -ss 29.6 -i "$OUT/$NAME.mp4" -frames:v 1 -q:v 2 "$OUT/$NAME-cover.jpg"
python3 tools/storyboard.py "$OUT/$NAME.mp4" "$OUT/storyboard.jpg"

ffmpeg -hide_banner -nostats -i "$OUT/$NAME.mp4" -af ebur128=peak=true -f null - 2>&1 \
  | awk '/^ *I:/{i=$2} /^ *Peak:/{p=$2} END{printf "loudness %s LUFS, true peak %s dBTP\n", i, p}'
ls -lh "$OUT/$NAME.mp4"
