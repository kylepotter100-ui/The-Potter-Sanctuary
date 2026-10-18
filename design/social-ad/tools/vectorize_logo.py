"""Turn the shipped daffodil PNG into drawable centre-line strokes.

public/sanctuary-logo.png is the only logo source in the repo (no SVG exists),
and a line-art mark wants to be *drawn*, not faded in. This skeletonises the
artwork, walks the skeleton graph into edges, and records the stroke width at
every point from the distance transform, so the film can grow the flower
stroke by stroke and still land on the exact shipped artwork.

    python3 design/social-ad/tools/vectorize_logo.py

Writes assets/logo-strokes.json: graph edges in logo pixel space, each point
[x, y, width, birth], where birth is the geodesic distance from the stem tip.
Drawing every point with birth < D, for D rising from 0 to maxBirth, grows
the flower from the stem: leaves branch off, each petal outline flows round
both sides and closes at its tip. Always prints a fidelity check (vector
re-render vs the PNG alpha); with paths given, also writes a labelled edge
preview (argv[1]) and growth stages beside the original (argv[2]).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from skimage.morphology import skeletonize

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parents[1] / "assets"
SCALE = 4  # supersample before skeletonising for smoother centre-lines

src = Image.open(ROOT / "public" / "sanctuary-logo.png").convert("RGBA")
alpha = np.asarray(src)[..., 3].astype(np.float32) / 255.0
H, W = alpha.shape

big = Image.fromarray((alpha * 255).astype(np.uint8)).resize(
    (W * SCALE, H * SCALE), Image.LANCZOS
)
mask = np.asarray(big).astype(np.float32) / 255.0 > 0.5
mask = ndimage.binary_closing(mask, iterations=2)
edt = ndimage.distance_transform_edt(mask)
skel = skeletonize(mask)

# --- skeleton graph -------------------------------------------------------
ys, xs = np.nonzero(skel)
pix = set(zip(ys.tolist(), xs.tolist()))
NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def nbrs(p):
    y, x = p
    return [(y + dy, x + dx) for dy, dx in NB if (y + dy, x + dx) in pix]


deg = {p: len(nbrs(p)) for p in pix}
nodes = {p for p, d in deg.items() if d != 2}

edges = []
seen = set()  # undirected pixel-step pairs already walked


def walk(start, nxt):
    path = [start, nxt]
    seen.add((start, nxt))
    seen.add((nxt, start))
    prev, cur = start, nxt
    while cur not in nodes:
        cands = [n for n in nbrs(cur) if n != prev and (cur, n) not in seen]
        if not cands:
            break
        # prefer 4-connected continuation for smoother walks
        cands.sort(key=lambda n: abs(n[0] - cur[0]) + abs(n[1] - cur[1]))
        n = cands[0]
        seen.add((cur, n))
        seen.add((n, cur))
        path.append(n)
        prev, cur = cur, n
    return path


for nd in nodes:
    for n in nbrs(nd):
        if (nd, n) not in seen:
            edges.append(walk(nd, n))

# isolated loops with no nodes (pure cycles)
rest = {p for p in pix if all((p, n) not in seen for n in nbrs(p))}
while rest:
    p = rest.pop()
    nodes.add(p)
    for n in nbrs(p):
        if (p, n) not in seen:
            edges.append(walk(p, n))
            break
    rest = {q for q in rest if all((q, n) not in seen for n in nbrs(q))}


def smooth(pts, k=9):
    if len(pts) < k + 2:
        return pts
    out = pts.copy()
    half = k // 2
    for i in range(half, len(pts) - half):
        out[i] = pts[i - half : i + half + 1].mean(axis=0)
    return out


# Junctions are usually clusters of adjacent node pixels: give each cluster
# one id so edges can be joined into a graph.
node_mask = np.zeros(mask.shape, dtype=bool)
for y, x in nodes:
    node_mask[y, x] = True
cluster_lbl, _ = ndimage.label(node_mask, structure=np.ones((3, 3)))

result = []  # (points[x,y,w], node_a, node_b)
for e in edges:
    arr = np.array([(x, y) for y, x in e], dtype=np.float64)
    if len(arr) < 6:
        continue
    w = np.array([edt[y, x] for y, x in e]) * 2.0
    arr = smooth(arr)
    w = np.convolve(np.pad(w, 3, mode="edge"), np.ones(7) / 7, mode="valid")
    keep = np.arange(0, len(arr), 2)
    if keep[-1] != len(arr) - 1:
        keep = np.append(keep, len(arr) - 1)
    pts = np.array([[arr[i, 0] / SCALE, arr[i, 1] / SCALE, w[i] / SCALE] for i in keep])
    a = int(cluster_lbl[e[0]])
    b = int(cluster_lbl[e[-1]])
    result.append((pts, a, b))

# --- growth order: geodesic distance from the stem root -------------------
# Root = lowest endpoint in the artwork (the tip of the stem).
lengths = [float(np.sum(np.hypot(*np.diff(p[:, :2], axis=0).T))) for p, _, _ in result]
adj = {}
for i, (p, a, b) in enumerate(result):
    adj.setdefault(a, []).append((b, lengths[i]))
    adj.setdefault(b, []).append((a, lengths[i]))

root_edge = max(range(len(result)), key=lambda i: max(result[i][0][0, 1], result[i][0][-1, 1]))
p0, a0, b0 = result[root_edge]
root = a0 if p0[0, 1] > p0[-1, 1] else b0


def dijkstra(sources):
    import heapq

    dist = dict(sources)
    pq = [(d, n) for n, d in sources.items()]
    heapq.heapify(pq)
    while pq:
        d, n = heapq.heappop(pq)
        if d > dist.get(n, 1e18):
            continue
        for m, L in adj.get(n, []):
            if d + L < dist.get(m, 1e18):
                dist[m] = d + L
                heapq.heappush(pq, (d + L, m))
    return dist


dist = dijkstra({root: 0.0})
# Floating details (stamens, corona marks) aren't joined to the main graph:
# bridge each to its nearest already-reached point, so it sparks from there.
while True:
    unreached = [i for i, (_, a, b) in enumerate(result) if a not in dist and b not in dist]
    if not unreached:
        break
    reached_pts = []
    for i, (p, a, b) in enumerate(result):
        if a in dist or b in dist:
            da, db = dist.get(a, 1e18), dist.get(b, 1e18)
            s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(p[:, :2], axis=0).T))])
            birth = np.minimum(da + s, db + (s[-1] - s))
            reached_pts.append(np.column_stack([p[:, :2], birth]))
    rp = np.concatenate(reached_pts)
    best = None
    for i in unreached:
        p, a, b = result[i]
        for end, node in ((p[0, :2], a), (p[-1, :2], b)):
            d2 = np.hypot(rp[:, 0] - end[0], rp[:, 1] - end[1])
            j = int(np.argmin(d2))
            cand = rp[j, 2] + d2[j] * 1.5
            if best is None or cand < best[0]:
                best = (cand, node)
    dist = dijkstra({**dist, best[1]: best[0]})

out_edges = []
for (p, a, b), L in zip(result, lengths):
    s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(p[:, :2], axis=0).T))])
    birth = np.minimum(dist[a] + s, dist[b] + (L - s))
    out_edges.append(
        [[round(x, 2), round(y, 2), round(w, 2), round(bt, 2)] for (x, y, w), bt in zip(p, birth)]
    )
max_birth = max(pt[3] for e in out_edges for pt in e)

OUT.mkdir(parents=True, exist_ok=True)
(OUT / "logo-strokes.json").write_text(
    json.dumps(
        {
            "source": "public/sanctuary-logo.png",
            "width": W,
            "height": H,
            "maxBirth": round(max_birth, 2),
            "edges": out_edges,
        }
    )
)
result = [r[0].tolist() for r in result]

# --- labelled preview (only when a path is given) -------------------------
if len(sys.argv) > 1:
    PV = 4
    prev = Image.new("RGB", (W * PV, H * PV), (110, 128, 104))
    ghost = Image.fromarray((alpha * 90).astype(np.uint8)).resize((W * PV, H * PV))
    prev.paste(Image.new("RGB", prev.size, (160, 175, 150)), (0, 0), ghost)
    dr = ImageDraw.Draw(prev)
    rng = np.random.default_rng(3)
    for i, pts in enumerate(result):
        col = tuple(int(c) for c in rng.integers(120, 255, 3))
        xy = [(p[0] * PV, p[1] * PV) for p in pts]
        dr.line(xy, fill=col, width=3)
        mx, my = xy[len(xy) // 2]
        dr.text((mx + 4, my - 6), str(i), fill=(255, 255, 255))
        dr.ellipse([xy[0][0] - 3, xy[0][1] - 3, xy[0][0] + 3, xy[0][1] + 3], fill=(0, 0, 0))
    prev.save(sys.argv[1])
print(f"{len(result)} edges, {len(nodes)} nodes")

# --- fidelity check: re-render the strokes and compare with the PNG -------
def render(edges_xyzw, scale, upto=None):
    img = Image.new("L", (W * scale, H * scale), 0)
    d = ImageDraw.Draw(img)
    for e in edges_xyzw:
        for p, q in zip(e[:-1], e[1:]):
            if upto is not None and (p[3] > upto or q[3] > upto):
                continue
            r = (p[2] + q[2]) / 4 * scale
            d.line([(p[0] * scale, p[1] * scale), (q[0] * scale, q[1] * scale)], fill=255, width=max(1, int(round(2 * r))))
            d.ellipse([q[0] * scale - r, q[1] * scale - r, q[0] * scale + r, q[1] * scale + r], fill=255)
    return img


vec = np.asarray(render(out_edges, 1)).astype(np.float32) / 255 > 0.5
ref = alpha > 0.5
iou = (vec & ref).sum() / max(1, (vec | ref).sum())
print(f"fidelity IoU vs PNG alpha: {iou:.3f}  (maxBirth {max_birth:.1f}px)")

if len(sys.argv) > 2:
    S = 3
    frames = [render(out_edges, S, max_birth * f) for f in (0.2, 0.45, 0.7, 1.0)]
    ref_img = Image.fromarray((alpha * 255).astype(np.uint8)).resize((W * S, H * S), Image.LANCZOS)
    sheet = Image.new("RGB", (W * S * 5, H * S), (110, 128, 104))
    for i, fr in enumerate(frames + [ref_img]):
        tile = Image.new("RGB", (W * S, H * S), (110, 128, 104))
        tile.paste(Image.new("RGB", tile.size, (239, 232, 214)), (0, 0), fr)
        sheet.paste(tile, (i * W * S, 0))
    sheet.save(sys.argv[2])
