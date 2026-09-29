import type { Meta, StoryObj } from "@storybook/react-vite"
import mitdb from "virtual:dataset/mitdb"
import mitdbSource from "../datasets/mitdb/SOURCE.json"
import { LineChart } from "@/science/charts/LineChart"
import { BarChart } from "@/science/charts/BarChart"
import { Eyebrow } from "@/components/typography"
import { EventRaster } from "@/science/signals/EventRaster"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const meta: Meta = {
  title: "Science/Detection",
  parameters: {
    docs: {
      description: {
        component:
          "Finding events in a signal, scored against labels made independently of the detector. Real public data: the MIT-BIH Arrhythmia Database (PhysioNet, ODC-By 1.0).",
      },
    },
  },
}
export default meta

const NAMES: Record<string, string> = {
  neurokit: "NeuroKit2 default",
  pantompkins1985: "Pan & Tompkins 1985",
  hamilton2002: "Hamilton 2002",
  elgendi2010: "Elgendi et al. 2010",
}

type Rec = (typeof mitdb.records)[number]

function RecordPanel({ rec, blurb }: { rec: Rec; blurb: string }) {
  const ex = rec.excerpt
  const t = ex.mv.map((_, i) => ex.t0_s + i / rec.rate_hz)
  return (
    <div className="grid gap-4">
      <Eyebrow>Record {rec.record}: {blurb}</Eyebrow>
      <Table>
        <TableHeader><TableRow>
          <TableHead>detector</TableHead><TableHead>sensitivity Se</TableHead><TableHead>positive predictivity +P</TableHead>
          <TableHead>missed beats (FN)</TableHead><TableHead>false beats (FP)</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {Object.entries(rec.scores).map(([m, s]) => (
            <TableRow key={m}>
              <TableCell>{NAMES[m] ?? m}</TableCell>
              <TableCell className="font-mono tabular-nums">{s.se.toFixed(2)} %</TableCell>
              <TableCell className="font-mono tabular-nums">{s.ppv.toFixed(2)} %</TableCell>
              <TableCell className="font-mono tabular-nums">{s.fn}</TableCell>
              <TableCell className="font-mono tabular-nums">{s.fp}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <BarChart
        title={`Record ${rec.record}: errors per detector over ${Math.round(rec.duration_s / 60)} minutes`}
        data={Object.entries(rec.scores).map(([m, s]) => ({ category: NAMES[m] ?? m, value: s.fn + s.fp }))}
        y={{ label: `missed + false beats (of ${rec.n_reference_beats})` }} height={200}
      />
      <div>
        <LineChart
          title={`Record ${rec.record}, ${ex.t0_s}–${ex.t1_s} s: the ECG`}
          series={[{ label: "ECG, lead MLII", points: t.map((x, i) => [x, ex.mv[i]] as [number, number]) }]}
          x={{ label: "time (s)", domain: [ex.t0_s, ex.t1_s] }} y={{ label: "mV" }} height={220}
        />
        <EventRaster
          title={`Record ${rec.record}: where each detector put a beat`}
          x={{ domain: [ex.t0_s, ex.t1_s], label: "time (s)" }}
          rows={[
            { label: "database labels", times: ex.reference_s, color: "var(--tier-measured)", reference: true },
            ...mitdb.methods.map((m, k) => ({ label: NAMES[m] ?? m, times: (ex.detections_s as Record<string, number[]>)[m], color: `var(--chart-${k + 2})` })),
          ]}
        />
      </div>
    </div>
  )
}

export const HeartbeatDetection: StoryObj = {
  name: "Heartbeat detection, scored against the reference labels",
  render: () => (
    <div className="grid gap-10">
      <p className="m-0 max-w-3xl text-sm text-muted-foreground">
        Four published R-peak detectors, as implemented in NeuroKit2, run on two 30-minute records and scored against
        the beats the database's cardiologists labelled. A detection within {mitdb.tolerance_ms} ms of a labelled beat
        counts (the ANSI/AAMI EC57 window). On a clean record every method is near perfect, which is why a detector
        should be judged on hard records too; on the noisy one they disagree, in both directions. The excerpt of each
        record is the 10 s where the detectors made the most errors between them — chosen for that reason.
      </p>
      {mitdb.records.map((r) => (
        <RecordPanel key={r.record} rec={r} blurb={r.record === "100" ? "a clean recording" : "the database's noisy record"} />
      ))}
      <p className="max-w-3xl text-[length:var(--text-xs)] text-muted-foreground">
        <span className="font-mono">Data · {mitdbSource.licence} · {mitdbSource.accession}.</span> {mitdbSource.attribution}
      </p>
    </div>
  ),
}
