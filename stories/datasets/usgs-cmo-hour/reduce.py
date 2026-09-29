#!/usr/bin/env python3
"""Reduce one hour of USGS geomagnetic data to what the stories draw. numpy only.

    python3 reduce.py <usgs-response.json[.gz]>      --out data.json

Input: the USGS Geomagnetism web service's JSON response, verbatim (geomag.usgs.gov/ws),
elements X, Y, Z at 1 s. Output:

  spectrogram  per-window power spectral density of each axis, summed (the trace of the
               spectral matrix), in dB re 1 nT²/Hz. Hann window, linear detrend per window.
  vector       X, Y, Z band-passed to the Pc5 band (1.67–6.67 mHz, IAGA's 150–600 s periods)
               with a zero-phase cosine-tapered FFT filter, sampled every 5 s.
  b0           the mean field over the hour, from the raw record, before any filtering.

Nothing here detects, classifies or tests anything. It is a spectrogram and a band-pass.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
WIN_S, STEP_S, FMAX_HZ = 512, 64, 0.1
BAND_HZ = (1 / 600, 1 / 150)
VEC_EVERY_S = 5


def main(src: Path) -> None:
    raw = src.read_bytes()
    doc = json.loads(gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw)
    fs = 1.0 / doc["metadata"]["intermagnet"]["sampling_period"]
    axes = {v["id"]: np.asarray(v["values"], float) for v in doc["values"] if v["id"] in "XYZ"}
    if any(np.isnan(a).any() for a in axes.values()):
        raise SystemExit("record has missing samples; this reducer does not fill them")
    X = np.vstack([axes[k] for k in "XYZ"])
    n = X.shape[1]
    b0 = X.mean(axis=1)

    # spectrogram (trace of the spectral matrix)
    w = np.hanning(WIN_S)
    scale = 1.0 / (fs * (w ** 2).sum())
    freqs = np.fft.rfftfreq(WIN_S, 1 / fs)
    keep = (freqs > 0) & (freqs <= FMAX_HZ)
    t = np.arange(0, n - WIN_S + 1, STEP_S)
    tt = np.arange(WIN_S)
    rows = []
    for s in t:
        seg = X[:, s:s + WIN_S]
        seg = seg - np.array([np.polyval(np.polyfit(tt, a, 1), tt) for a in seg])
        P = (np.abs(np.fft.rfft(seg * w, axis=1)) ** 2 * scale * 2).sum(axis=0)
        rows.append(10 * np.log10(P[keep]))
    grid = np.array(rows).T  # rows = frequency (bottom = lowest), cols = time

    # Pc5 band-pass, zero phase, cosine taper over 20% of each edge
    f = np.fft.rfftfreq(n, 1 / fs)
    lo, hi = BAND_HZ
    edge = 0.2 * (hi - lo)
    H = np.clip(np.minimum((f - (lo - edge)) / edge, ((hi + edge) - f) / edge), 0, 1)
    H = 0.5 - 0.5 * np.cos(np.pi * H)
    Xd = X - X.mean(axis=1, keepdims=True)
    vec = np.fft.irfft(np.fft.rfft(Xd, axis=1) * H, n=n, axis=1)[:, ::VEC_EVERY_S]

    meta = doc["metadata"]["intermagnet"]
    out = {
        "source": {
            "station": meta["imo"]["iaga_code"], "name": meta["imo"]["name"],
            "coordinates_lon_lat_elev": meta["imo"]["coordinates"],
            "data_type": meta["data_type"], "reported_orientation": meta["reported_orientation"],
            "start": doc["times"][0], "end": doc["times"][-1], "samples": n, "rate_hz": fs,
            "sha256_of_input": hashlib.sha256(raw).hexdigest(),
        },
        "spectrogram": {
            "unit": "dB re 1 nT²/Hz (sum of X, Y, Z)", "window_s": WIN_S, "step_s": STEP_S,
            "t_centre_s": [(s + WIN_S / 2) for s in t.tolist()],
            "freq_hz": freqs[keep].round(6).tolist(),
            "db": grid.round(2).tolist(),
        },
        "vector": {
            "unit": "nT", "band_hz": [round(lo, 6), round(hi, 6)], "every_s": VEC_EVERY_S,
            "x": vec[0].round(3).tolist(), "y": vec[1].round(3).tolist(), "z": vec[2].round(3).tolist(),
        },
        "b0_nT": b0.round(1).tolist(),
    }
    dst = OUT
    dst.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {dst} ({dst.stat().st_size / 1e3:.0f} kB): {grid.shape[1]} windows × {grid.shape[0]} bins, "
          f"{vec.shape[1]} vector samples")


if __name__ == "__main__":
    if "--out" not in sys.argv:
        raise SystemExit("usage: reduce.py <inputs...> --out <data.json>")
    i = sys.argv.index("--out")
    OUT = Path(sys.argv[i + 1])
    del sys.argv[i:i + 2]
    main(Path(sys.argv[1]))
