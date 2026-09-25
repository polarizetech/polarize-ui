import type { Meta, StoryObj } from "@storybook/react-vite"
import { Pause, Play, Repeat, SkipBack } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label as FieldLabel } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tier } from "@/components/tier"
import { Readout } from "@/components/value"
import { Waveform } from "@/charts/Waveform"
import { amTone } from "./data"

const meta: Meta = { title: "Components" }
export default meta

export const Buttons: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button>Record</Button>
      <Button variant="secondary">Connect</Button>
      <Button variant="outline">Export</Button>
      <Button variant="ghost">Cancel</Button>
      <Button variant="destructive">Discard session</Button>
    </div>
  ),
}

export const StimulusCard: StoryObj = {
  name: "Card with controls",
  render: () => (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Stimulus</CardTitle>
        <CardDescription>40 Hz AM on a 500 Hz carrier.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <FieldLabel>Carrier (Hz)</FieldLabel>
          <Slider defaultValue={[500]} min={120} max={1000} step={10} />
        </div>
        <Button><Play /> Play</Button>
      </CardContent>
    </Card>
  ),
}

export const ReadoutStory: StoryObj = {
  name: "Readout",
  render: () => (
    <Readout items={[
      { label: "Sample rate", value: "250.0 Hz", source: "measured from timestamps" },
      { label: "Mains pickup", value: "+32.2 dB", source: "60 Hz, p = 2e-26" },
      { label: "Contact", value: "good", source: "bridge quality check" },
    ]} />
  ),
}

export const TableStory: StoryObj = {
  name: "Table",
  render: () => (
    <Table>
      <TableHeader><TableRow><TableHead>Channel</TableHead><TableHead className="text-right">RMS (µV)</TableHead><TableHead>Tier</TableHead></TableRow></TableHeader>
      <TableBody>
        <TableRow><TableCell>Oz</TableCell><TableCell className="text-right font-mono">5.3</TableCell><TableCell><Tier id="MEASURED" /></TableCell></TableRow>
        <TableRow><TableCell>Cz</TableCell><TableCell className="text-right font-mono">7.9</TableCell><TableCell><Tier id="PREDICTED" /></TableCell></TableRow>
      </TableBody>
    </Table>
  ),
}

export const TabsStory: StoryObj = {
  name: "Tabs",
  render: () => (
    <Tabs defaultValue="live" className="max-w-md">
      <TabsList><TabsTrigger value="live">Live</TabsTrigger><TabsTrigger value="playback">Playback</TabsTrigger></TabsList>
      <TabsContent value="live" className="text-sm text-muted-foreground">Connect, then record.</TabsContent>
      <TabsContent value="playback" className="text-sm text-muted-foreground">Pick a session to replay.</TabsContent>
    </Tabs>
  ),
}

export const Transport: StoryObj = {
  name: "Waveform + transport",
  render: () => (
    <div className="max-w-2xl space-y-2">
      <Waveform samples={amTone()} progress={0.38} regions={[{ start: 0.55, end: 0.68, label: "blink", kind: "attention" }]} />
      <div className="flex items-center gap-1">
        <Button size="icon" aria-label="Play"><Play /></Button>
        <Button size="icon" variant="ghost" aria-label="Pause"><Pause /></Button>
        <Button size="icon" variant="ghost" aria-label="Back"><SkipBack /></Button>
        <Button size="icon" variant="ghost" aria-label="Repeat"><Repeat /></Button>
        <span className="ml-2 font-mono text-xs tabular-nums text-muted-foreground">00:12 / 05:00</span>
      </div>
    </div>
  ),
}
