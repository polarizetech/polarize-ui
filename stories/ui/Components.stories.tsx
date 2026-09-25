import type { Meta, StoryObj } from "@storybook/react-vite"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label as FieldLabel } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tier } from "@/science/evidence/tier"

const meta: Meta = { title: "General UI/Components" }
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
