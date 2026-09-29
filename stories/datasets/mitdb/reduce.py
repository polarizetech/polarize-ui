#!/usr/bin/env python3
"""Reduce two MIT-BIH Arrhythmia Database records to what the heartbeat-detection story draws.

    python3 reduce.py <base-path-100> <base-path-105> --out data.json

Each argument is a record's path without extension, next to its .hea/.dat/.atr (PhysioNet
mitdb 1.0.0, ODC-By 1.0). Record 100 is a clean recording; record 105 is the database's
well-known noisy one. Standard methods only:
  * channel MLII, the whole 30 min of each record;
  * four published R-peak detectors as implemented in NeuroKit2 (Makowski et al. 2021), each run
    on the signal cleaned the way that method specifies;
  * each scored against the database's own reference beat labels: a detection within 150 ms of a
    labelled beat is a true positive (the ANSI/AAMI EC57 matching window), matched one-to-one;
    sensitivity Se = TP / (TP + FN), positive predictivity +P = TP / (TP + FP);
  * a 10 s excerpt of each trace with every method's detections and the reference labels, taken
    at the window (on a 10 s grid, after the first 10 s) where the four detectors make the most
    errors between them. That choice is deliberate: it is where the methods differ.
Needs numpy, wfdb and neurokit2.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

METHODS = {  # detector -> the cleaning NeuroKit2 pairs with it
    "neurokit": "neurokit",
    "pantompkins1985": "pantompkins1985",
    "hamilton2002": "hamilton2002",
    "elgendi2010": "elgendi2010",
}
BEAT_SYMBOLS = set("NLRBAaJSVrFejnE/fQ?")
TOL_S = 0.150
WIN_S = 10.0


def match(ref: np.ndarray, det: np.ndarray, tol: int):
    """One-to-one greedy match in time order. Returns TP, FN, FP."""
    i = j = tp = 0
    det = np.sort(det)
    used = np.zeros(det.size, bool)
    for r in ref:
        while j < det.size and det[j] < r - tol:
            j += 1
        k = j
        best = None
        while k < det.size and det[k] <= r + tol:
            if not used[k] and (best is None or abs(det[k] - r) < abs(det[best] - r)):
                best = k
            k += 1
        if best is not None:
            used[best] = True
            tp += 1
    return tp, ref.size - tp, int((~used).sum())


def reduce_record(path: str):
    import neurokit2 as nk
    import wfdb

    rec = wfdb.rdrecord(path)
    ann = wfdb.rdann(path, "atr")
    fs = float(rec.fs)
    x = rec.p_signal[:, rec.sig_name.index("MLII")]
    beats = [(s, sym) for s, sym in zip(ann.sample, ann.symbol) if sym in BEAT_SYMBOLS]
    ref = np.array([s for s, _ in beats])
    tol = int(round(TOL_S * fs))

    scores, peaks = {}, {}
    for m, clean in METHODS.items():
        cleaned = nk.ecg_clean(x, sampling_rate=fs, method=clean)
        _, info = nk.ecg_peaks(cleaned, sampling_rate=fs, method=m)
        det = np.asarray(info["ECG_R_Peaks"], int)
        tp, fn, fp = match(ref, det, tol)
        scores[m] = {"tp": tp, "fn": fn, "fp": fp,
                     "se": round(100 * tp / (tp + fn), 2), "ppv": round(100 * tp / (tp + fp), 2)}
        peaks[m] = det

    # the 10 s window where the detectors disagree with the reference most
    n = int(WIN_S * fs)
    best, best_err = n, -1
    for s0 in range(n, x.size - n, n):
        r = ref[(ref >= s0) & (ref < s0 + n)]
        err = 0
        for det in peaks.values():
            # detections just outside the window may match beats just inside it, so they are
            # offered to the matcher; only unmatched detections INSIDE the window count as FP
            d = np.sort(det[(det >= s0 - tol) & (det < s0 + n + tol)])
            _, fn, _ = match(r, d, tol)
            rr = ref[(ref >= s0 - tol) & (ref < s0 + n + tol)]
            inside = d[(d >= s0) & (d < s0 + n)]
            _, _, fp = match(rr, inside, tol)
            err += fn + fp
        if err > best_err:
            best, best_err = s0, err
    s0, s1 = best, best + n
    t0 = s0 / fs
    inwin = lambda arr: [round(int(v) / fs, 4) for v in arr if s0 <= v < s1]
    return {
        "record": Path(path).name, "channel": "MLII", "rate_hz": fs,
        "n_reference_beats": int(ref.size), "duration_s": round(x.size / fs, 1),
        "scores": scores,
        "excerpt": {
            "t0_s": round(t0, 3), "t1_s": round(s1 / fs, 3), "errors_in_window": best_err,
            "mv": x[s0:s1].round(4).tolist(),
            "reference_s": inwin(ref),
            "reference_symbols": [sym for s, sym in beats if s0 <= s < s1],
            "detections_s": {m: inwin(v) for m, v in peaks.items()},
        },
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("records", nargs="+")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    out = {
        "source": {"database": "MIT-BIH Arrhythmia Database (mitdb) 1.0.0", "licence": "ODC-By-1.0"},
        "tolerance_ms": TOL_S * 1e3,
        "methods": list(METHODS),
        "records": [reduce_record(r) for r in a.records],
    }
    Path(a.out).write_text(json.dumps(out, separators=(",", ":")))
    for r in out["records"]:
        print(f"record {r['record']}: {r['n_reference_beats']} beats; excerpt at {r['excerpt']['t0_s']} s "
              f"({r['excerpt']['errors_in_window']} errors)")
        for m, s in r["scores"].items():
            print(f"  {m:16s} Se {s['se']:6.2f}  +P {s['ppv']:6.2f}  (FN {s['fn']}, FP {s['fp']})")


if __name__ == "__main__":
    main()
