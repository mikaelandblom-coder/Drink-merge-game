"""
Extract tray hitbox from a magenta annotation drawn over the tray rim.

The annotation is a permanent source file (SRC below): a copy of the clean
background with a bright-magenta oval traced onto the inner edge of the tray.
Keeping it as its own file means the rim can be re-extracted any time without
redrawing, and the game's background is never touched.

Pipeline:
  1. Find magenta pixels in the annotated background image.
  2. Sample + simplify the contour to N polygon vertices (flat image coords).
  3. Convert image px -> flat physics coords (420x620 canvas).
  4. Apply inverse perspective (unpersp) so walls land where items visually appear.
     Items are rendered with persp(); placing a wall at unpersp(flat) makes it
     look like it is AT the flat background position.
  5. Output cornerWalls config for config/maps.js.

Usage:
  python extract_hitbox.py
"""
import math
import numpy as np
from PIL import Image

# ── config ────────────────────────────────────────────────────────────────────
SRC = 'assets/source/saigon/bg-saigon-hitbox.png'   # magenta-annotated rim

PHYSICS_W = 420
PHYSICS_H = 620
HORIZON   = PHYSICS_H * 0.285   # 176.7
FAR_W     = PHYSICS_W * 0.74    # 310.8

MAGENTA_THRESH = (150, 100, 150)  # R>150, G<100, B>150
ANGLE_STEPS    = 720
RDP_EPSILON    = 6    # image px — higher = fewer segments

# ── perspective helpers ───────────────────────────────────────────────────────
def unpersp(sx, sy):
    """Flat canvas coord -> physics coord that will appear there when rendered."""
    t    = max(0.0, min(1.0, (sy - HORIZON) / (PHYSICS_H - HORIZON)))
    rowW = FAR_W + (PHYSICS_W - FAR_W) * t
    wx   = PHYSICS_W / 2 + (sx - PHYSICS_W / 2) * (PHYSICS_W / rowW)
    wy   = t * PHYSICS_H
    return wx, wy

# ── load & detect ─────────────────────────────────────────────────────────────
img  = Image.open(SRC).convert('RGB')
arr  = np.array(img)
IH, IW = arr.shape[:2]

mask = (arr[:,:,0] > MAGENTA_THRESH[0]) & \
       (arr[:,:,1] < MAGENTA_THRESH[1]) & \
       (arr[:,:,2] > MAGENTA_THRESH[2])

ys, xs = np.where(mask)
if len(xs) == 0:
    print("ERROR: No magenta pixels found.")
    exit(1)
print(f"Found {len(xs)} magenta pixels  ({IW}x{IH})")

# ── angular boundary sampling ─────────────────────────────────────────────────
cx, cy   = float(np.mean(xs)), float(np.mean(ys))
dx_all   = xs - cx
dy_all   = ys - cy
pix_ang  = np.arctan2(dy_all, dx_all)
angles   = np.linspace(-math.pi, math.pi, ANGLE_STEPS, endpoint=False)
boundary = []
for a in angles:
    diff = np.abs(((pix_ang - a + math.pi) % (2*math.pi)) - math.pi)
    near = diff < (2*math.pi / ANGLE_STEPS * 3)
    if not np.any(near):
        continue
    dists = np.sqrt(dx_all[near]**2 + dy_all[near]**2)
    best  = np.argmax(dists)
    boundary.append((int(xs[near][best]), int(ys[near][best])))
unique = [boundary[0]]
for p in boundary[1:]:
    if p != unique[-1]:
        unique.append(p)
boundary = unique
print(f"Boundary samples: {len(boundary)}")

# ── Ramer-Douglas-Peucker ─────────────────────────────────────────────────────
def pt_line_dist(p, a, b):
    ax,ay=a; bx,by=b; px,py=p
    L = math.hypot(bx-ax, by-ay)
    if L == 0: return math.hypot(px-ax, py-ay)
    return abs((by-ay)*px - (bx-ax)*py + bx*ay - by*ax) / L

def rdp(pts, eps):
    if len(pts) < 3: return pts
    dmax, idx = 0, 0
    for i in range(1, len(pts)-1):
        d = pt_line_dist(pts[i], pts[0], pts[-1])
        if d > dmax: dmax, idx = d, i
    if dmax > eps:
        return rdp(pts[:idx+1], eps)[:-1] + rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]

simplified = rdp(boundary, RDP_EPSILON)
print(f"Simplified to {len(simplified)} vertices")

# ── convert: image px -> flat physics -> perspective-corrected physics ─────────
def to_flat(px, py):
    return px / IW * PHYSICS_W, py / IH * PHYSICS_H

CLAMP_MARGIN = 2   # push clamped coords slightly inside physics bounds
phys_pts = []
for (px, py) in simplified:
    fx, fy  = to_flat(px, py)
    wx, wy  = unpersp(fx, fy)
    # clamp to physics world
    wx = max(CLAMP_MARGIN, min(PHYSICS_W - CLAMP_MARGIN, wx))
    wy = max(0, min(PHYSICS_H, wy))
    phys_pts.append((wx, wy))

print("\nPerspective-corrected physics vertices:")
for (wx, wy) in phys_pts:
    print(f"  ({wx:.0f}, {wy:.0f})")

# ── open the loop at the drawn gap ────────────────────────────────────────────
# The launcher shoots items up from the bottom, so the boundary must be open
# there. If you leave a gap in the magenta oval, the traced vertices have one
# unusually long span across it — break the loop at that span so the output is
# an open arc (no wall across the opening). If the oval is fully closed (no gap
# large enough), emit a closed loop and open it by hand.
MIN_LEN   = 4    # skip degenerate zero-length segments
OPEN_GAP  = 70   # a span longer than this (physics px) is treated as the opening
n = len(phys_pts)
spans = [math.hypot(phys_pts[(i+1) % n][0] - phys_pts[i][0],
                    phys_pts[(i+1) % n][1] - phys_pts[i][1]) for i in range(n)]
gi = max(range(n), key=lambda i: spans[i])

if spans[gi] > OPEN_GAP:
    ordered = phys_pts[gi+1:] + phys_pts[:gi+1]   # start just after the opening
    pairs   = list(zip(ordered, ordered[1:]))     # open arc — no wrap segment
    print(f"\n// opening detected ({spans[gi]:.0f}px span) -> emitting open arc")
else:
    pairs = [(phys_pts[i], phys_pts[(i+1) % n]) for i in range(n)]  # closed loop
    print("\n// no opening found -> emitting closed loop (open the bottom by hand)")

print("cornerWalls: [")
for (x1, y1), (x2, y2) in pairs:
    length = math.hypot(x2-x1, y2-y1)
    if length < MIN_LEN:
        continue
    cx_w  = (x1 + x2) / 2
    cy_w  = (y1 + y2) / 2
    angle = math.atan2(y2-y1, x2-x1)
    print(f"  {{ x:{cx_w:5.0f}, y:{cy_w:5.0f}, len:{length:5.0f}, angle:{angle:7.3f} }}, // ({x1:.0f},{y1:.0f})->({x2:.0f},{y2:.0f})")
print("],")
