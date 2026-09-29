import * as React from "react"
import type { Comodulogram as ComodulogramResult } from "../stats/pac"
import { Heatmap } from "./Heatmap"

/**
 * A comodulogram: phase–amplitude coupling for every (phase band, amplitude band) pair.
 *
 * Built on Heatmap (one-hue magnitude ramp, stated colour bar, hover readout), plus what a
 * comodulogram specifically needs said:
 *   · SIGNIFICANT cells are outlined, against a FAMILY-WISE threshold (the maximum over the
 *     whole grid, per surrogate). The correction is printed; so is the surrogate count.
 *   · UNRESOLVABLE cells are hatched over and carry no colour: their amplitude band is too
 *     narrow to hold sidebands at f_amp ± f_phase, or overlaps the phase band. They are not
 *     "no coupling"; the filter removed what would have been measured.
 *   · The amplitude axis is only as sharp as the amplitude bandwidth, and that is printed.
 *   · The colour range comes from resolvable cells only.
 *   · Standing caveats: coupling can come from non-sinusoidal or sharp-edged waveforms, not only
 *     from interaction; and time-shift surrogates assume the phase rhythm is not strictly
 *     periodic (a pure sinusoid keeps its coupling under any shift).
 */
export type ComodulogramProps = {
  /** From computeComodulogram(). */
  result: ComodulogramResult
  /** Colour range shared with other panels; omit to scale to this panel's resolvable cells. */
  colorDomain?: [number, number]
  scaleNote?: "shared" | "independent"
  width?: number
  height?: number
  title?: string
}

function uniformDomain(freqs: number[], name: string): [number, number] {
  if (freqs.length < 2) throw new Error(`Comodulogram: needs at least two ${name} frequencies`)
  const step = freqs[1] - freqs[0]
  if (!(step > 0) || freqs.some((f, i) => i > 0 && Math.abs(f - freqs[i - 1] - step) > 1e-9 * Math.max(1, step))) {
    throw new Error(`Comodulogram: ${name} frequencies must be evenly spaced and increasing (each cell is drawn the same size)`)
  }
  return [freqs[0] - step / 2, freqs[freqs.length - 1] + step / 2]
}

export function Comodulogram({ result: c, colorDomain, scaleNote, width = 720, height = 320, title }: ComodulogramProps) {
  const hatchId = React.useId().replace(/:/g, "")
  const cells = c.resolvable.flat()
  const nRes = cells.filter(Boolean).length
  const nUnres = cells.length - nRes
  const nSig = c.significant.flat().filter(Boolean).length
  const resolvableMI = c.mi.flatMap((row, ai) => row.filter((_, pi) => c.resolvable[ai][pi]))
  if (!resolvableMI.length) throw new Error("Comodulogram: no cell is resolvable at this amplitude bandwidth")
  const domain = colorDomain ?? [0, Math.max(...resolvableMI)]
  const fmt = (v: number) => (Math.abs(v) < 1e-3 && v !== 0 ? v.toExponential(2) : String(+v.toPrecision(3)))

  const notes = [
    `${nSig} of ${nRes} resolvable cells exceed the family-wise threshold (MI > ${fmt(c.threshold)}: grid maximum over ${c.nSurrogates} time-shift surrogates, α = ${c.alpha}); outlined`,
    ...(nUnres ? [`${nUnres} cells not resolvable (hatched): the ${fmt(c.ampBandwidth)} Hz amplitude band is narrower than 2 × the phase frequency, or overlaps the ${fmt(c.phaseBandwidth)} Hz phase band`] : []),
    `amplitude axis resolution ≈ the amplitude bandwidth (${fmt(c.ampBandwidth)} Hz); ${fmt(c.seconds)} s analysed after trimming ${fmt(c.trimmedSeconds)} s of filter edges`,
    "coupling can also come from non-sinusoidal or sharp-edged waveforms; time-shift surrogates assume the phase rhythm is not strictly periodic",
  ]

  return (
    <Heatmap
      title={title ?? "Comodulogram"}
      // Unresolvable cells carry no value at all: not a colour, not a hover number.
      values={c.mi.map((row, r) => row.map((v, col) => (c.resolvable[r][col] ? v : NaN)))}
      missingNote={null}
      x={{ domain: uniformDomain(c.phaseFreqs, "phase"), label: "phase frequency (Hz)" }}
      y={{ domain: uniformDomain(c.ampFreqs, "amplitude"), label: "amplitude frequency (Hz)" }}
      colorDomain={domain}
      colorLabel="modulation index (Tort)"
      scaleNote={scaleNote ?? (colorDomain ? undefined : "independent")}
      width={width}
      height={height}
      notes={notes}
      describeCell={(r, col) =>
        !c.resolvable[r][col]
          ? "not resolvable"
          : `z = ${Number.isFinite(c.z[r][col]) ? c.z[r][col].toFixed(1) : "n/a"} · family-wise p = ${c.pFamilywise[r][col].toFixed(3)} · ${c.significant[r][col] ? "significant" : "not significant"}`}
      overlay={(cell) => (
        <>
          <defs>
            <pattern id={hatchId} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width={6} height={6} fill="var(--background)" />
              <line x1={0} y1={0} x2={0} y2={6} stroke="var(--muted-foreground)" strokeWidth={1} strokeOpacity={0.5} />
            </pattern>
          </defs>
          {c.resolvable.map((row, r) => row.map((ok, col) => {
            if (ok) return null
            const g = cell(r, col)
            return <rect key={`u${r}-${col}`} {...g} fill={`url(#${hatchId})`} />
          }))}
          {c.significant.map((row, r) => row.map((sig, col) => {
            if (!sig) return null
            const g = cell(r, col)
            return <rect key={`s${r}-${col}`} x={g.x + 0.75} y={g.y + 0.75} width={g.width - 1.5} height={g.height - 1.5}
              fill="none" stroke="var(--foreground)" strokeWidth={1.5} />
          }))}
        </>
      )}
    />
  )
}
