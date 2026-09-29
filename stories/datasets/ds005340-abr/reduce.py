#!/usr/bin/env python3
"""Reduce the click trials of OpenNeuro ds005340 (sub-01) to a per-trial brainstem response stack.

    python3 reduce.py <bids-root> <pulses.npz>      --out data.json

Standard click-evoked averaging, nothing more:
  * channel A1 (left earlobe; reference FCz, ground Fpz, per the dataset's own sidecar),
    band-passed 30–2000 Hz (4th-order Butterworth, zero phase) per 10 s trial;
  * epochs −5 … +20 ms around every LEFT-ear click in that trial, averaged: one row per trial;
  * the control row set: the same averaging with the NEXT trial's click times, which were
    played at a different moment. Clicks in the two ears are independent random trains,
    so neither this control nor the right ear's clicks line up with the left ear's times.

`pulses.npz` holds each trial's click sample indices at the stimulus rate (48 kHz), read out of
the dataset's stimulus files. Needs numpy and scipy.
"""
from __future__ import annotations

import configparser
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfiltfilt

HERE = Path(__file__).resolve().parent
T_MIN, T_MAX, TRIAL_S, CH = -0.005, 0.020, 10.0, "A1"
CLICKS = ("clicks_low", "clicks_mid", "clicks_high")


def load_bv(vhdr: Path):
    text = vhdr.read_text(encoding="utf-8-sig").split("\n", 1)[1].split("[Comment]", 1)[0]
    cp = configparser.ConfigParser(strict=False, interpolation=None)
    cp.optionxform = str
    cp.read_string(text)
    c, b = cp["Common Infos"], cp["Binary Infos"]
    assert c["DataOrientation"] == "MULTIPLEXED" and b["BinaryFormat"] == "IEEE_FLOAT_32"
    n = int(c["NumberOfChannels"])
    labels = [cp["Channel Infos"][f"Ch{i}"].split(",")[0] for i in range(1, n + 1)]
    data = np.memmap(vhdr.with_name(c["DataFile"]), dtype="<f4", mode="r").reshape(-1, n)
    return labels, 1e6 / float(c["SamplingInterval"]), data


def epoch_mean(x, idx, lo, hi):
    idx = idx[(idx + lo >= 0) & (idx + hi <= x.size)]
    return np.mean([x[i + lo:i + hi] for i in idx], axis=0), idx.size


def main(root: Path, pulses: Path) -> None:
    vhdr = root / "sub-01" / "eeg" / "sub-01_task-peakypitch_eeg.vhdr"
    labels, fs, data = load_bv(vhdr)
    ch = labels.index(CH)
    pz = np.load(pulses, allow_pickle=True)
    sos = butter(4, [30, 2000], btype="band", fs=fs, output="sos")
    lo, hi = int(round(T_MIN * fs)), int(round(T_MAX * fs))
    n = int(TRIAL_S * fs)

    trials = []
    for i, typ in enumerate(pz["trial_type"]):
        if str(typ) not in CLICKS:
            continue
        s = int(pz["onset_sample"][i])
        if s + n > data.shape[0]:
            continue
        scale = fs / float(pz["stim_fs"][i])
        trials.append({"type": str(typ), "start": s,
                       "left": np.round(pz["left"][i] * scale).astype(int)})

    rows, ctrl, counts = [], [], []
    for k, t in enumerate(trials):
        x = np.asarray(data[t["start"]:t["start"] + n, ch], float)
        x = sosfiltfilt(sos, x - x.mean())
        r, m = epoch_mean(x, t["left"], lo, hi)
        c, _ = epoch_mean(x, trials[(k + 1) % len(trials)]["left"], lo, hi)
        rows.append(r); ctrl.append(c); counts.append(m)
    rows, ctrl = np.array(rows), np.array(ctrl)
    step = 2  # 10 kHz → 5 kHz for display; 0.2 ms per point
    lags_ms = (np.arange(lo, hi) / fs * 1e3)[::step]

    out = {
        "source": {
            "dataset": "OpenNeuro ds005340 v1.0.4", "doi": "10.18112/openneuro.ds005340.v1.0.4",
            "licence": "CC0", "subject": "sub-01", "channel": CH,
            "reference": "FCz", "ground": "Fpz", "rate_hz": fs,
            "paper": "Polonenko & Maddox (2024), JASA Express Letters 4(11):114401, doi:10.1121/10.0034329",
            "sha256_of_pulses": hashlib.sha256(pulses.read_bytes()).hexdigest(),
        },
        "filter": "Butterworth 4th order, 30–2000 Hz, zero phase, per trial",
        "lags_ms": lags_ms.round(2).tolist(),
        "trial_type": [t["type"] for t in trials],
        "clicks_per_trial": counts,
        "rows_uv": rows[:, ::step].round(4).tolist(),
        "control_rows_uv": ctrl[:, ::step].round(4).tolist(),
    }
    dst = OUT
    dst.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {dst} ({dst.stat().st_size / 1e3:.0f} kB): {rows.shape[0]} trials × {lags_ms.size} lags; "
          f"clicks per trial {min(counts)}–{max(counts)}")


if __name__ == "__main__":
    if "--out" not in sys.argv:
        raise SystemExit("usage: reduce.py <inputs...> --out <data.json>")
    i = sys.argv.index("--out")
    OUT = Path(sys.argv[i + 1])
    del sys.argv[i:i + 2]
    main(Path(sys.argv[1]), Path(sys.argv[2]))
