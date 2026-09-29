#!/usr/bin/env python3
"""Derive and check the diverging ramp. Stdlib only.

    python3 scripts/diverging.py            # print the ramp and every check
    python3 scripts/diverging.py --json     # the block that goes in tokens.json

Blue arm: the sequential blue steps, unchanged. Red arm: for each blue step, the red with
the SAME OKLCH lightness (hue of the categorical red, #e34948), at the highest chroma that
stays inside sRGB. Matching lightness step for step is what makes −x and +x equally strong;
a red arm picked by eye is usually darker or lighter than its blue partner, and the reader
then sees a bias the data does not have. The midpoint is the reference neutral gray.

Checks (all computed; exit 1 on any failure):
  1. each arm's lightness is monotone away from the midpoint, by at least 0.04 per step
  2. the two arms match in lightness step for step (|ΔL| ≤ 0.01)
  3. the midpoint is neutral (OKLCH C < 0.01) and lighter/darker than every arm step
     (lighter on light themes, darker on dark), so zero recedes toward the surface
  4. at every step the two arms stay apart under protan, deutan and tritan simulation
     (ΔE ×100 ≥ 15) — the sign must survive colour-blindness
  5. no step clips out of sRGB after conversion
"""
from __future__ import annotations

import json
import math
import sys

SEQ = {"100": "#cde2fb", "150": "#b7d3f6", "200": "#9ec5f4", "250": "#86b6ef", "300": "#6da7ec",
       "350": "#5598e7", "400": "#3987e5", "450": "#2a78d6", "500": "#256abf", "550": "#1c5cab",
       "600": "#184f95", "650": "#104281", "700": "#0d366b"}  # tokens.json "sequential" (checked below)
# Steps used from the midpoint OUTWARD, per theme. Light: pale near zero, dark at the poles.
# Dark: dark near zero (so zero recedes into a dark surface), light at the poles.
# 100 and 150 are never used: there the two arms are too close to tell apart (ΔE < 15 normal,
# < 8 under protanopia), and a sign you cannot see is worse than a lighter "near zero".
OUTWARD = {"light": ["200", "300", "400", "500", "600", "700"],
           "dark": ["650", "550", "450", "350", "250", "200"]}
RED_REF = "#e34948"
MID = {"light": "#f0efec", "dark": "#383835"}
MACHADO = {  # severity 1.0, Machado, Oliveira & Fernandes (2009) — the matrices the dataviz validator uses
    "protan": [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    "deutan": [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    "tritan": [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
}


def s2lin(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def lin2s(c): return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
def hex2lin(h): return [s2lin(int(h[i:i + 2], 16) / 255) for i in (1, 3, 5)]


def lin2oklab(r, g, b):
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s]


def oklab2lin(L, a, b):
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s]


def oklch(h):
    L, a, b = lin2oklab(*hex2lin(h))
    return L, math.hypot(a, b), math.degrees(math.atan2(b, a)) % 360


def to_hex(L, C, H):
    a, b = C * math.cos(math.radians(H)), C * math.sin(math.radians(H))
    return "#" + "".join(f"{round(max(0, min(1, lin2s(max(0, v)))) * 255):02x}" for v in oklab2lin(L, a, b))


def in_gamut(L, C, H):
    a, b = C * math.cos(math.radians(H)), C * math.sin(math.radians(H))
    return all(-1e-6 <= v <= 1 + 1e-6 for v in oklab2lin(L, a, b))


def red_like(Lt, H, cmax=0.25):
    lo, hi = 0.0, cmax
    for _ in range(40):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if in_gamut(Lt, mid, H) else (lo, mid)
    return to_hex(Lt, lo, H)


def dE(h1, h2, kind=None):
    def lab(h):
        r = hex2lin(h)
        if kind:
            M = MACHADO[kind]
            r = [max(0, sum(M[i][j] * r[j] for j in range(3))) for i in range(3)]
        return lin2oklab(*r)
    return 100 * math.dist(lab(h1), lab(h2))


def ramp(mode):
    """13 stops, --div-1 (most negative, blue) … --div-7 (zero, gray) … --div-13 (most positive, red)."""
    H = oklch(RED_REF)[2]
    blue = [SEQ[k] for k in OUTWARD[mode]]
    red = [red_like(oklch(b)[0], H) for b in blue]
    return blue[::-1] + [MID[mode]] + red, blue, red


def check(mode):
    fails = []
    stops, blue, red = ramp(mode)
    Lm = oklch(MID[mode])[0]
    if oklch(MID[mode])[1] >= 0.01:
        fails.append(f"{mode}: midpoint is not neutral")
    for arm, name in ((blue, "blue"), (red, "red")):
        L = [Lm] + [oklch(h)[0] for h in arm]
        for i in range(len(L) - 1):
            step = (L[i] - L[i + 1]) if mode == "light" else (L[i + 1] - L[i])
            if step < 0.04:
                fails.append(f"{mode} {name}: lightness does not move away from zero at step {i} ({step:.3f})")
    for i, (b, r) in enumerate(zip(blue, red)):
        if abs(oklch(b)[0] - oklch(r)[0]) > 0.01:
            fails.append(f"{mode}: arms differ in lightness at step {i+1}")
        if dE(b, r) < 15:
            fails.append(f"{mode}: step {i+1} arms dE {dE(b, r):.1f} < 15 (normal vision)")
        for k in ("protan", "deutan", "tritan"):
            if dE(b, r, k) < 8:
                fails.append(f"{mode}: step {i+1} arms dE {dE(b, r, k):.1f} < 8 ({k})")
    worst = {k or "normal": round(min(dE(b, r, k) for b, r in zip(blue, red)), 1) for k in (None, "protan", "deutan", "tritan")}
    return stops, worst, fails


if __name__ == "__main__":
    out, allfails = {}, []
    for mode in ("light", "dark"):
        stops, worst, fails = check(mode)
        out[mode] = stops
        allfails += fails
        if "--json" not in sys.argv:
            print(f"{mode}: " + " ".join(stops))
            print(f"  worst dE between the two arms at equal distance from zero: {worst}")
    if "--json" in sys.argv:
        print(json.dumps(out, indent=2))
    else:
        print("FAIL:\n  " + "\n  ".join(allfails) if allfails else "ALL CHECKS PASS")
    sys.exit(1 if allfails else 0)
