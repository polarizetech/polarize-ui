#!/usr/bin/env python3
"""Reduce OpenNeuro ds005185 (EESM19, sub-001 ses-001) to what three stories draw.

    python3 reduce.py <assr.set> <wake_window.npz>        # writes data.json beside this file

Inputs, both from ds005185 v1.0.2 (CC0):
  assr.set          sub-001_ses-001_task-ASSR_acq-PSG_eeg.set (+ its .fdt): 40 Hz amplitude-
                    modulated noise was played (the dataset's own task description).
  wake_window.npz   110 s of the same session's overnight PSG (task-sleep), cut from 63 s,
                    the first run of epochs the dataset's own scoring (column Scoring1) marks
                    wake: keys data (samples × channels, µV), labels, rate_hz, start_s.

Three reductions, all standard methods:
  steady_state  one FFT over 130–240 s of the ASSR run, channel F3: power in dB, 20–60 Hz, and
                the classic spectral F-test (power in a bin against the mean of 20 bins either
                side, skipping the adjacent one; F(2, 80)) at 40 Hz, at two control frequencies
                (37, 43 Hz), at the 50 Hz mains line, and at 300 random frequencies as a null.
  aperiodic     Welch spectra (2 s Hann, 50 % overlap) fitted with specparam (Donoghue et al.
                2020, 'fixed' aperiodic mode) for the ASSR run and for the wake window.
  surrogates    time-reversal asymmetry (Schreiber & Schmitz 2000) of 30 s of the wake window
                against three linear nulls: phase-randomised (FT), amplitude-adjusted (AAFT) and
                iterated AAFT (IAAFT), 199 each; and the same test on a phase-randomised copy of
                the data, a linear signal by construction, as the control that must NOT reject.
Needs numpy, scipy, mne and specparam.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfiltfilt, welch
from scipy.stats import f as fdist

HERE = Path(__file__).resolve().parent
SEG_S, CH = (130.0, 240.0), "F3"
RNG = np.random.default_rng(20260929)


def ftest(power, k, side=20, gap=1):
    idx = [j for j in range(k - gap - side, k + gap + side + 1) if abs(j - k) > gap]
    F = power[k] / power[idx].mean()
    return float(F), float(fdist.sf(F, 2, 2 * len(idx)))


def steady_state(x, fs):
    n = x.size
    X = np.fft.rfft((x - x.mean()) * np.hanning(n))
    P = np.abs(X) ** 2
    f = np.fft.rfftfreq(n, 1 / fs)
    kof = lambda hz: int(np.argmin(np.abs(f - hz)))
    band = (f >= 20) & (f <= 60)
    tests = {}
    for name, hz in (("40 Hz (stimulus rate)", 40.0), ("37 Hz (control)", 37.0), ("43 Hz (control)", 43.0), ("50 Hz (mains)", 50.0)):
        Fv, p = ftest(P, kof(hz))
        tests[name] = {"hz": round(float(f[kof(hz)]), 4), "F": round(Fv, 2), "p": p, "snr_db": round(10 * np.log10(Fv), 2)}
    avoid = lambda hz: min(abs(hz - t) for t in (40, 50, 37, 43)) < 1.0
    cand = [k for k in np.nonzero(band)[0] if not avoid(f[k])]
    null = [round(10 * np.log10(ftest(P, int(k))[0]), 3) for k in RNG.choice(cand, 300, replace=False)]
    return {
        "channel": CH, "segment_s": list(SEG_S), "resolution_hz": round(fs / n, 5),
        "freq_hz": f[band].round(4).tolist(), "power_db": (10 * np.log10(P[band])).round(2).tolist(),
        "tests": tests, "null_snr_db": null,
        "test": "F = power at the bin / mean power of 20 bins either side (adjacent bin skipped); F(2, 80)",
    }


def aperiodic(x, fs, fmax):
    from specparam import SpectralModel
    f, p = welch(x - x.mean(), fs, nperseg=int(2 * fs))
    m = SpectralModel(peak_width_limits=(1, 8), max_n_peaks=6, aperiodic_mode="fixed", verbose=False)
    m.fit(f, p, [1, fmax])
    fr = m.data.freqs
    ap = m.results.model.get_component("aperiodic") if hasattr(m.results, "model") else m._ap_fit
    peaks = m.results.get_params("periodic") if hasattr(m.results, "get_params") else m.get_params("peak_params")
    peaks = np.atleast_2d(peaks)
    offset, exponent = (m.results.get_params("aperiodic") if hasattr(m.results, "get_params") else m.get_params("aperiodic_params"))
    r2 = m.results.get_metrics("gof_rsquared") if hasattr(m.results, "get_metrics") else m.get_params("r_squared")
    return {
        "freq_hz": fr.round(3).tolist(),
        "log_power": m.data.power_spectrum.round(4).tolist(),
        "aperiodic_log_power": np.asarray(ap).round(4).tolist(),
        "offset": round(float(offset), 3), "exponent": round(float(exponent), 3),
        "r_squared": round(float(r2), 4),
        "peaks": [{"cf_hz": round(float(c), 2), "height_log10": round(float(h), 3), "bw_hz": round(float(b), 2)}
                  for c, h, b in peaks if np.isfinite(c)],
        "settings": "specparam, fixed aperiodic, peak width 1–8 Hz, up to 6 peaks, Welch 2 s Hann",
    }


def trev(x, lag=1):
    d = x[lag:] - x[:-lag]
    return float(np.mean(d ** 3) / np.mean(d ** 2) ** 1.5)


def ft(x):
    X = np.fft.rfft(x)
    ph = RNG.uniform(0, 2 * np.pi, X.size); ph[0] = 0
    if x.size % 2 == 0: ph[-1] = 0
    return np.fft.irfft(np.abs(X) * np.exp(1j * ph), n=x.size)


def aaft(x):
    r = np.sort(x); g = np.sort(RNG.standard_normal(x.size))
    y = np.empty_like(x); y[np.argsort(x)] = g
    s = ft(y)
    out = np.empty_like(x); out[np.argsort(s)] = r
    return out


def iaaft(x, n_iter=100):
    amp = np.abs(np.fft.rfft(x)); r = np.sort(x)
    y = RNG.permutation(x)
    for _ in range(n_iter):
        Y = np.fft.rfft(y)
        y = np.fft.irfft(amp * np.exp(1j * np.angle(Y)), n=x.size)
        z = np.empty_like(x); z[np.argsort(y)] = r
        if np.array_equal(z, y): break
        y = z
    return y


def ladder(x, n=199):
    obs = trev(x)
    out = {}
    for name, fn in (("phase-randomised (FT)", ft), ("amplitude-adjusted (AAFT)", aaft), ("iterated AAFT (IAAFT)", iaaft)):
        null = np.array([trev(fn(x)) for _ in range(n)])
        p = (1 + np.sum(np.abs(null) >= abs(obs))) / (n + 1)
        out[name] = {"null": null.round(5).tolist(), "p_two_sided": p}
    return {"observed": round(obs, 5), "nulls": out}


def main(assr_set: Path, wake_npz: Path):
    import mne
    raw = mne.io.read_raw_eeglab(assr_set, preload=True, verbose=False)
    fs = raw.info["sfreq"]
    a = raw.get_data(picks=[CH])[0] * 1e6
    seg = a[int(SEG_S[0] * fs):int(SEG_S[1] * fs)]
    z = np.load(wake_npz, allow_pickle=True)
    w = z["data"][:, list(z["labels"]).index(CH)].astype(float)
    wfs = float(z["rate_hz"])

    sos = butter(4, [1, 40], btype="band", fs=wfs, output="sos")
    w30 = sosfiltfilt(sos, w[: int(30 * wfs)])[:: 4]  # 125 Hz after the 40 Hz low-pass
    lin = ft(w30)

    out = {
        "source": {"dataset": "OpenNeuro ds005185 v1.0.2 (EESM19)", "doi": "10.18112/openneuro.ds005185.v1.0.2",
                   "licence": "CC0", "subject": "sub-001", "session": "ses-001", "channel": CH,
                   "assr_sha256": hashlib.sha256(assr_set.read_bytes()).hexdigest(),
                   "wake_window_start_s": float(z["start_s"])},
        "steady_state": steady_state(seg, fs),
        "aperiodic": {"assr": aperiodic(seg, fs, 60), "wake": aperiodic(w, wfs, 45)},
        "surrogates": {"data": ladder(w30), "linear_control": ladder(lin),
                       "segment": "first 30 s of the wake window, band-passed 1–40 Hz, 125 Hz",
                       "statistic": "time-reversal asymmetry, lag 1 sample (8 ms)"},
    }
    dst = HERE / "data.json"
    dst.write_text(json.dumps(out, separators=(",", ":")))
    t = out["steady_state"]["tests"]
    print(f"wrote {dst} ({dst.stat().st_size / 1e3:.0f} kB)")
    for k, v in t.items(): print(f"  {k}: F {v['F']}  p {v['p']:.2g}")
    for k in ("assr", "wake"):
        ap = out["aperiodic"][k]; print(f"  aperiodic {k}: exp {ap['exponent']} r2 {ap['r_squared']} peaks {ap['peaks']}")
    for k in ("data", "linear_control"):
        s = out["surrogates"][k]; print(f"  trev {k}: obs {s['observed']} " + ", ".join(f"{n}: p {v['p_two_sided']:.3f}" for n, v in s['nulls'].items()))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
