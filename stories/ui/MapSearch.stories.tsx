import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { MapSearch, nominatimSearch, type LatLon } from "@/components/ui/map-search"

/* Coordinates here are typed by the viewer or a public landmark (Victoria, BC, approximate).
   The "OpenStreetMap" story loads tiles and place search from OpenStreetMap
   (© OpenStreetMap contributors, data under ODbL); the other stories make no network request. */

const meta: Meta = {
  title: "General UI/Components/Map search",
  parameters: {
    docs: {
      description: {
        component:
          "Search a place, type coordinates, or click the map; the value is `{ lat, lon }` in WGS 84 decimal degrees. " +
          "Typed coordinates are read locally: signed decimals, latitude first (`48.4284, -123.3656`), or degrees-minutes-seconds " +
          "with hemispheres (`48°25′42″N 123°21′56″W`). Place search needs a `search` function such as `nominatimSearch()`; it runs " +
          "on Enter, never per keystroke. The map is a dependency-free Web Mercator tile grid: pass `tileUrl` and `attribution` " +
          "for raster tiles, otherwise it draws an offline graticule. Drag pans, the wheel and +/− zoom, a click drops the pin; " +
          "with the map focused, arrows pan and Enter drops the pin at the centre.",
      },
    },
  },
}
export default meta

export const Offline: StoryObj = {
  name: "Offline (graticule, typed coordinates)",
  render: () => {
    const [v, setV] = React.useState<LatLon | null>(null)
    return (
      <div className="max-w-2xl">
        <MapSearch value={v} onChange={setV} latName="lat" lonName="lon" />
        <p className="mt-2 text-sm text-muted-foreground">value: <code className="font-mono">{JSON.stringify(v)}</code></p>
      </div>
    )
  },
}

const osmSearch = nominatimSearch()

export const OpenStreetMap: StoryObj = {
  name: "OpenStreetMap tiles and place search",
  render: () => {
    const [v, setV] = React.useState<LatLon | null>({ lat: 48.4222, lon: -123.3657 })
    return (
      <div className="max-w-2xl">
        <MapSearch value={v} onChange={setV} search={osmSearch} defaultZoom={12} height={380}
          tileUrl="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution={<>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors</>} />
        <p className="mt-2 text-sm text-muted-foreground">value: <code className="font-mono">{JSON.stringify(v)}</code></p>
      </div>
    )
  },
}

export const States: StoryObj = {
  render: () => (
    <div className="flex max-w-2xl flex-col gap-6">
      <MapSearch aria-label="Disabled" defaultValue={{ lat: 48.4222, lon: -123.3657 }} disabled height={200} />
      <MapSearch aria-label="Four decimals, no locate" digits={4} showLocate={false} height={200} />
    </div>
  ),
}
