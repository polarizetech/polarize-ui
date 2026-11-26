/**
 * MapSearch: find a place, type coordinates, or click a map, and get its latitude and longitude.
 * Dependency-free apart from lucide icons (already a dependency). No map library.
 *
 * Coordinates are WGS 84 decimal degrees, { lat, lon }, latitude first, north and east positive.
 * The map is the standard Web Mercator tile grid (EPSG:3857, the z/x/y "slippy map" scheme public
 * tile servers use), drawn with plain <img> tiles.
 *
 * Nothing here touches the network on its own. Without `tileUrl` the map is a graticule (lines of
 * latitude and longitude) on the surface colour, so it works offline. Without `search` the box still
 * takes typed coordinates. Pass `tileUrl` + `attribution`, and `search` (e.g. `nominatimSearch()`),
 * to use online services; each has a usage policy the consumer must follow. Search runs on Enter,
 * never per keystroke, because Nominatim's policy forbids autocomplete.
 *
 * Type rules hold: labels are uppercase mono, figures are mono tabular, the pin is clay (the value).
 * Light tiles are inverted and dimmed by default so a dark page gets no light backdrop.
 *
 * Exploratory (operator: "the exploratory version should be way more lenient").
 */
import * as React from "react"
import { Crosshair, LocateFixed, MapPin, Minus, Plus, Search, X } from "lucide-react"
import { cn } from "../../lib/utils"

/** WGS 84 decimal degrees. */
export type LatLon = { lat: number; lon: number }

export type GeocodeResult = LatLon & {
  /** What the result list shows, e.g. "Victoria, British Columbia, Canada". */
  label: string
  /** Optional bounding box [south, west, north, east]; the map zooms to fit it. */
  bbox?: [number, number, number, number]
}

/** A place search. Must honour `signal` (a newer search aborts the older one). */
export type GeocodeFn = (query: string, signal: AbortSignal) => Promise<GeocodeResult[]>

const TILE = 256
/** Web Mercator's latitude limit: where the square world map ends. */
const MAX_LAT = 85.0511287798
/** TASTE: inverts and dims light raster tiles for the dark theme. Chosen by eye. */
const DARK_TILES = "invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9) saturate(0.6)"

const clampLat = (v: number) => Math.max(-MAX_LAT, Math.min(MAX_LAT, v))
const wrapLon = (v: number) => ((((v + 180) % 360) + 360) % 360) - 180
const clampZoom = (z: number, max: number) => Math.max(0, Math.min(max, Math.round(z)))

/** True for a finite { lat, lon } with |lat| <= 90 and |lon| <= 180. */
export function isLatLon(v: unknown): v is LatLon {
  if (!v || typeof v !== "object") return false
  const { lat, lon } = v as LatLon
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
}

/** Degrees to world pixels at zoom z (Web Mercator). */
function project({ lat, lon }: LatLon, z: number) {
  const s = TILE * 2 ** z
  const phi = (clampLat(lat) * Math.PI) / 180
  return {
    x: ((lon + 180) / 360) * s,
    y: ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * s,
  }
}

/** World pixels at zoom z back to degrees. Longitude wraps; latitude clamps to the map. */
function unproject(x: number, y: number, z: number): LatLon {
  const s = TILE * 2 ** z
  const n = Math.PI * (1 - (2 * y) / s)
  return { lat: clampLat((180 / Math.PI) * Math.atan(Math.sinh(n))), lon: wrapLon((x / s) * 360 - 180) }
}

function fmtDeg(v: number, digits: number, pos: string, neg: string) {
  if (Math.abs(v) < 1e-9) return `${(0).toFixed(digits)}°`
  return `${Math.abs(v).toFixed(digits)}° ${v > 0 ? pos : neg}`
}

const fmtPoint = (v: LatLon, digits: number) => `${fmtDeg(v.lat, digits, "N", "S")}, ${fmtDeg(v.lon, digits, "E", "W")}`

/** "lat, lon" in signed decimal degrees, e.g. "48.428400, -123.365600". */
export function formatCoordinates(v: LatLon, digits = 6): string {
  return `${v.lat.toFixed(digits)}, ${v.lon.toFixed(digits)}`
}

const DECIMAL_RE = /^\s*([-+]?\d+(?:\.\d+)?)\s*[,;\s]\s*([-+]?\d+(?:\.\d+)?)\s*$/
const DMS_RE = /(\d+(?:\.\d+)?)\s*°?\s*(?:(\d+(?:\.\d+)?)\s*['′]\s*)?(?:(\d+(?:\.\d+)?)\s*(?:["″]|'')\s*)?([NSEWnsew])/g

/**
 * Read coordinates a person typed. Accepts signed decimal degrees ("48.4284, -123.3656", latitude
 * first) and degrees-minutes-seconds with hemispheres ("48°25′42″N 123°21′56″W"). Returns null
 * for anything else or anything out of range.
 */
export function parseCoordinates(text: string): LatLon | null {
  const d = DECIMAL_RE.exec(text)
  if (d) {
    const v = { lat: +d[1], lon: +d[2] }
    return isLatLon(v) ? v : null
  }
  const parts = [...text.matchAll(DMS_RE)]
  if (parts.length !== 2) return null
  let lat: number | null = null
  let lon: number | null = null
  for (const p of parts) {
    const deg = +p[1], min = p[2] ? +p[2] : 0, sec = p[3] ? +p[3] : 0
    if (min >= 60 || sec >= 60) return null
    const hemi = p[4].toUpperCase()
    const val = (deg + min / 60 + sec / 3600) * (hemi === "S" || hemi === "W" ? -1 : 1)
    if (hemi === "N" || hemi === "S") { if (lat !== null) return null; lat = val }
    else { if (lon !== null) return null; lon = val }
  }
  if (lat === null || lon === null) return null
  const v = { lat, lon }
  return isLatLon(v) ? v : null
}

/**
 * A GeocodeFn for OpenStreetMap's Nominatim (or a self-hosted copy via `endpoint`). The public
 * server's usage policy: at most one request a second, no autocomplete, and credit
 * "© OpenStreetMap contributors" (data under ODbL). Pass `email` so heavy users can be contacted.
 */
export function nominatimSearch({
  endpoint = "https://nominatim.openstreetmap.org/search", limit = 5, language, email,
}: { endpoint?: string; limit?: number; language?: string; email?: string } = {}): GeocodeFn {
  return async (query, signal) => {
    const u = new URL(endpoint)
    u.searchParams.set("q", query)
    u.searchParams.set("format", "jsonv2")
    u.searchParams.set("limit", String(limit))
    if (language) u.searchParams.set("accept-language", language)
    if (email) u.searchParams.set("email", email)
    const r = await fetch(u, { signal, headers: { Accept: "application/json" } })
    if (!r.ok) throw new Error(`Search failed (${r.status})`)
    const rows = (await r.json()) as Array<{ lat: string; lon: string; display_name: string; boundingbox?: [string, string, string, string] }>
    // Nominatim's boundingbox is [south, north, west, east].
    return rows.map((row) => ({
      lat: +row.lat,
      lon: +row.lon,
      label: row.display_name,
      bbox: row.boundingbox
        ? [+row.boundingbox[0], +row.boundingbox[2], +row.boundingbox[1], +row.boundingbox[3]] as [number, number, number, number]
        : undefined,
    }))
  }
}

/** Highest zoom at which the box fits inside the map with a 16px margin. */
function fitZoom([south, west, north, east]: [number, number, number, number], w: number, h: number, maxZoom: number) {
  for (let z = maxZoom; z > 0; z--) {
    const a = project({ lat: north, lon: west }, z)
    const b = project({ lat: south, lon: east }, z)
    if (Math.abs(b.x - a.x) <= w - 32 && Math.abs(b.y - a.y) <= h - 32) return z
  }
  return 0
}

/* ----------------------------------------------------------------- Graticule -- */

const STEPS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 30]

function Graticule({ ox, oy, w, h, z }: { ox: number; oy: number; w: number; h: number; z: number }) {
  const s = TILE * 2 ** z
  const ppd = s / 360
  const step = STEPS.find((st) => st * ppd >= 80) ?? 30
  const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9))
  const meridians: { x: number; label: string; main: boolean }[] = []
  const lonL = (ox / s) * 360 - 180
  const lonR = ((ox + w) / s) * 360 - 180
  for (let k = Math.ceil(lonL / step); k <= Math.floor(lonR / step); k++) {
    const lon = wrapLon(k * step)
    meridians.push({ x: (((k * step + 180) / 360) * s) - ox, label: fmtDeg(lon, dec, "E", "W"), main: Math.abs(lon) < 1e-9 })
  }
  const parallels: { y: number; label: string; main: boolean }[] = []
  const latT = unproject(0, Math.max(0, oy), z).lat
  const latB = unproject(0, Math.min(s, oy + h), z).lat
  for (let k = Math.ceil(latB / step); k <= Math.floor(latT / step); k++) {
    const lat = k * step
    if (Math.abs(lat) > MAX_LAT) continue
    parallels.push({ y: project({ lat, lon: 0 }, z).y - oy, label: fmtDeg(lat, dec, "N", "S"), main: Math.abs(lat) < 1e-9 })
  }
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0" width={w} height={h}>
      {meridians.map((m, i) => (
        <line key={`m${i}`} x1={m.x} x2={m.x} y1={0} y2={h} stroke={m.main ? "var(--border-strong)" : "var(--border)"} />
      ))}
      {parallels.map((p, i) => (
        <line key={`p${i}`} x1={0} x2={w} y1={p.y} y2={p.y} stroke={p.main ? "var(--border-strong)" : "var(--border)"} />
      ))}
      {meridians.map((m, i) => (
        <text key={`mt${i}`} x={m.x + 3} y={12} fontSize={9} className="font-mono" fill="var(--faint-foreground)">{m.label}</text>
      ))}
      {parallels.map((p, i) => (
        <text key={`pt${i}`} x={4} y={p.y - 3} fontSize={9} className="font-mono" fill="var(--faint-foreground)">{p.label}</text>
      ))}
    </svg>
  )
}

/* ----------------------------------------------------------------- MapSearch -- */

export type MapSearchProps = {
  /** The chosen point, or null for none. */
  value?: LatLon | null
  /** Uncontrolled starting value. Ignored when `value` is given. */
  defaultValue?: LatLon | null
  /** Called with the chosen point, or null when cleared. */
  onChange?: (value: LatLon | null) => void
  /** Place search. Without it the box only takes typed coordinates. */
  search?: GeocodeFn
  /** Raster tile template with {z}, {x}, {y}, e.g. "https://tile.openstreetmap.org/{z}/{x}/{y}.png". Without it the map is an offline graticule. */
  tileUrl?: string
  /** Credit for the tiles, shown in the corner. Required by most tile servers. */
  attribution?: React.ReactNode
  /** "dark" (default) inverts and dims light tiles for the dark theme; "none" shows them as served. */
  tileFilter?: "dark" | "none"
  /** Where the map looks when there is no value. Default { lat: 20, lon: 0 }. */
  defaultCenter?: LatLon
  /** Starting zoom (0 = whole world). Default 10 with a value, 1 without. */
  defaultZoom?: number
  /** Highest zoom. Default 18. */
  maxZoom?: number
  /** Zoom used when a search result has no bounding box. Default 12. */
  zoomOnSelect?: number
  /** Map height in px. Default 320. */
  height?: number
  /** Decimal places kept and shown. Default 6. */
  digits?: number
  /** Show the use-my-location button where the browser supports it. Default true. */
  showLocate?: boolean
  placeholder?: string
  /** Submitted with a form under these names, as decimal degrees (empty when cleared). */
  latName?: string
  lonName?: string
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

export function MapSearch({
  value: controlled, defaultValue = null, onChange, search, tileUrl, attribution, tileFilter = "dark",
  defaultCenter = { lat: 20, lon: 0 }, defaultZoom, maxZoom = 18, zoomOnSelect = 12, height = 320,
  digits = 6, showLocate = true, placeholder = "Search a place, or type 48.4284, -123.3656",
  latName, lonName, disabled, className, "aria-label": ariaLabel = "Location",
}: MapSearchProps) {
  const [inner, setInner] = React.useState<LatLon | null>(defaultValue)
  const isControlled = controlled !== undefined
  const value = isControlled ? (isLatLon(controlled) ? controlled : null) : (isLatLon(inner) ? inner : null)

  const [center, setCenter] = React.useState<LatLon>(() => value ?? defaultCenter)
  const [zoom, setZoom] = React.useState(() => clampZoom(defaultZoom ?? (value ? 10 : 1), maxZoom))
  const [size, setSize] = React.useState({ w: 0, h: height })
  const mapRef = React.useRef<HTMLDivElement>(null)
  const lastSet = React.useRef<LatLon | null>(value)

  const round = (v: number) => +v.toFixed(digits)
  const set = (v: LatLon | null) => {
    const next = v && { lat: round(v.lat), lon: round(v.lon) }
    lastSet.current = next
    if (!isControlled) setInner(next)
    onChange?.(next)
  }
  const go = (v: LatLon, z?: number) => {
    setCenter(v)
    if (z !== undefined) setZoom(clampZoom(z, maxZoom))
  }

  // A value set from outside recentres the map.
  React.useEffect(() => {
    if (value && (value.lat !== lastSet.current?.lat || value.lon !== lastSet.current?.lon)) {
      lastSet.current = value
      setCenter(value)
    }
  }, [value?.lat, value?.lon])

  React.useEffect(() => {
    const el = mapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Geometry of the current view.
  const s = TILE * 2 ** zoom
  const c = project(center, zoom)
  const ox = c.x - size.w / 2
  const oy = c.y - size.h / 2

  const zoomAt = (to: number, px = size.w / 2, py = size.h / 2) => {
    const z2 = clampZoom(to, maxZoom)
    if (z2 === zoom) return
    const f = 2 ** (z2 - zoom)
    const wx = (ox + px) * f
    const wy = (oy + py) * f
    setCenter(unproject(wx - px + size.w / 2, wy - py + size.h / 2, z2))
    setZoom(z2)
  }
  const zoomAtRef = React.useRef(zoomAt)
  zoomAtRef.current = zoomAt
  const zoomRef = React.useRef(zoom)
  zoomRef.current = zoom

  // Wheel zoom needs a non-passive listener so the page does not scroll under the map.
  React.useEffect(() => {
    const el = mapRef.current
    if (!el || disabled) return
    let acc = 0
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      acc += e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY
      if (Math.abs(acc) < 100) return
      const r = el.getBoundingClientRect()
      zoomAtRef.current(zoomRef.current + (acc < 0 ? 1 : -1), e.clientX - r.left, e.clientY - r.top)
      acc = 0
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [disabled])

  // Drag pans; a press that does not move drops the pin.
  const drag = React.useRef<{ id: number; x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null)
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return
    if ((e.target as HTMLElement).closest("button,a")) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: c.x, cy: c.y, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < 4) return
    d.moved = true
    setCenter(unproject(d.cx - dx, d.cy - dy, zoom))
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    if (!d || d.id !== e.pointerId || d.moved) return
    const r = e.currentTarget.getBoundingClientRect()
    set(unproject(ox + e.clientX - r.left, oy + e.clientY - r.top, zoom))
  }

  const onMapKey = (e: React.KeyboardEvent) => {
    if (disabled || e.target !== e.currentTarget) return
    const pan = (dx: number, dy: number) => setCenter(unproject(c.x + dx, c.y + dy, zoom))
    const keys: Record<string, () => void> = {
      ArrowLeft: () => pan(-64, 0),
      ArrowRight: () => pan(64, 0),
      ArrowUp: () => pan(0, -64),
      ArrowDown: () => pan(0, 64),
      "+": () => zoomAt(zoom + 1),
      "=": () => zoomAt(zoom + 1),
      "-": () => zoomAt(zoom - 1),
      "_": () => zoomAt(zoom - 1),
      Enter: () => set(center),
      " ": () => set(center),
    }
    if (keys[e.key]) { e.preventDefault(); keys[e.key]() }
  }

  // Tiles in view.
  const n = 2 ** zoom
  const tiles: { key: string; src: string; left: number; top: number }[] = []
  if (tileUrl && size.w > 0) {
    for (let ty = Math.max(0, Math.floor(oy / TILE)); ty <= Math.min(n - 1, Math.floor((oy + size.h) / TILE)); ty++) {
      for (let tx = Math.floor(ox / TILE); tx <= Math.floor((ox + size.w) / TILE); tx++) {
        const wx = ((tx % n) + n) % n
        tiles.push({
          key: `${zoom}/${tx}/${ty}`,
          src: tileUrl.replace("{z}", String(zoom)).replace("{x}", String(wx)).replace("{y}", String(ty)),
          left: Math.round(tx * TILE - ox),
          top: Math.round(ty * TILE - oy),
        })
      }
    }
  }

  // The pin, drawn at the copy of the world nearest the centre.
  let marker: { x: number; y: number } | null = null
  if (value && size.w > 0) {
    const p = project(value, zoom)
    let dx = p.x - c.x
    dx -= Math.round(dx / s) * s
    marker = { x: size.w / 2 + dx, y: p.y - oy }
  }

  /* -- search -- */
  const [text, setText] = React.useState("")
  const [results, setResults] = React.useState<GeocodeResult[]>([])
  const [status, setStatus] = React.useState<"idle" | "loading" | "empty" | "error">("idle")
  const [message, setMessage] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(0)
  const abort = React.useRef<AbortController | null>(null)
  const listId = React.useId()
  const typed = parseCoordinates(text)
  const options: GeocodeResult[] = typed ? [{ ...typed, label: `Go to ${formatCoordinates(typed, digits)}` }] : results

  const pick = (r: GeocodeResult) => {
    const v = { lat: r.lat, lon: r.lon }
    set(v)
    go(v, r.bbox && size.w > 0 ? fitZoom(r.bbox, size.w, size.h, maxZoom) : (typed ? Math.max(zoom, zoomOnSelect) : zoomOnSelect))
    if (!typed) setText(r.label)
    setOpen(false)
  }

  const runSearch = async () => {
    const q = text.trim()
    if (!q) return
    if (typed) { pick(options[0]); return }
    if (!search) {
      setStatus("error"); setMessage("Type coordinates as latitude, longitude"); setOpen(true)
      return
    }
    abort.current?.abort()
    const ctl = new AbortController()
    abort.current = ctl
    setStatus("loading"); setResults([]); setOpen(true)
    try {
      const found = (await search(q, ctl.signal)).filter(isLatLon)
      if (ctl.signal.aborted) return
      setResults(found); setActive(0); setStatus(found.length ? "idle" : "empty")
    } catch (err) {
      if (ctl.signal.aborted) return
      setStatus("error"); setMessage(err instanceof Error ? err.message : "Search failed")
    }
  }

  React.useEffect(() => () => abort.current?.abort(), [])

  /* -- fields -- */
  const [latText, setLatText] = React.useState(value ? value.lat.toFixed(digits) : "")
  const [lonText, setLonText] = React.useState(value ? value.lon.toFixed(digits) : "")
  React.useEffect(() => {
    setLatText(value ? value.lat.toFixed(digits) : "")
    setLonText(value ? value.lon.toFixed(digits) : "")
  }, [value?.lat, value?.lon, digits])
  const latNum = Number(latText)
  const lonNum = Number(lonText)
  const latBad = latText.trim() !== "" && !(Number.isFinite(latNum) && Math.abs(latNum) <= 90)
  const lonBad = lonText.trim() !== "" && !(Number.isFinite(lonNum) && Math.abs(lonNum) <= 180)
  const commitFields = () => {
    if (latText.trim() === "" && lonText.trim() === "") { if (value) set(null); return }
    if (latText.trim() === "" || lonText.trim() === "" || latBad || lonBad) return
    const v = { lat: latNum, lon: lonNum }
    if (value && round(v.lat) === value.lat && round(v.lon) === value.lon) return
    set(v); go(v)
  }

  /* -- locate -- */
  const canLocate = showLocate && typeof navigator !== "undefined" && "geolocation" in navigator
  const [locating, setLocating] = React.useState(false)
  const [note, setNote] = React.useState("")
  const locate = () => {
    setLocating(true); setNote("")
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false)
        const v = { lat: p.coords.latitude, lon: p.coords.longitude }
        set(v); go(v, 14)
        setNote(`your location, ±${Math.round(p.coords.accuracy)} m`)
      },
      (err) => { setLocating(false); setNote(err.message || "location unavailable") },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const ctl = "inline-flex size-7 items-center justify-center rounded-md border border-border bg-popover/90 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
  const labelCls = "font-mono text-[10px] font-medium tracking-[.14em] text-muted-foreground uppercase"
  const fieldCls = "h-9 w-36 rounded-md border border-input bg-input/30 px-3 font-mono text-sm text-foreground tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"

  return (
    <div data-slot="map-search" role="group" aria-label={ariaLabel}
      className={cn("flex w-full flex-col gap-3", disabled && "pointer-events-none opacity-50", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input type="text" role="combobox" disabled={disabled} value={text} placeholder={placeholder}
          aria-label="Search a place or type coordinates"
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            setText(e.target.value); setResults([]); setStatus("idle"); setActive(0)
            setOpen(parseCoordinates(e.target.value) !== null)
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && options.length) { e.preventDefault(); setOpen(true); setActive((a) => Math.min(options.length - 1, a + 1)) }
            else if (e.key === "ArrowUp" && options.length) { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
            else if (e.key === "Enter") {
              e.preventDefault()
              if (open && options[active] && (typed || results.length)) pick(options[active])
              else void runSearch()
            } else if (e.key === "Escape") setOpen(false)
          }}
          className="h-9 w-full rounded-md border border-input bg-input/30 pr-20 pl-9 text-sm text-foreground shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" />
        <button type="button" disabled={disabled || !text.trim()} onClick={() => void runSearch()}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded px-2 py-1 font-mono text-[10.5px] font-medium tracking-[.14em] text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30">
          Search
        </button>
        {open && (status !== "idle" || options.length > 0) && (
          <div className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-lg border border-(--border-strong) bg-popover text-popover-foreground shadow-lg">
            {status === "loading" && <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>}
            {status === "empty" && <p className="px-3 py-2 text-sm text-muted-foreground">No places found</p>}
            {status === "error" && <p className="px-3 py-2 text-sm text-muted-foreground">{message}</p>}
            {options.length > 0 && (
              <ul id={listId} role="listbox" aria-label="Places" className="max-h-64 overflow-auto py-1">
                {options.map((r, i) => (
                  <li key={`${r.label}-${i}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(r)}
                    className={cn("flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5 text-sm", i === active && "bg-foreground/8")}>
                    <span className="truncate text-foreground">{r.label}</span>
                    <span className="shrink-0 font-mono text-[10.5px] text-(--faint-foreground) tabular-nums">
                      {r.lat.toFixed(3)}, {r.lon.toFixed(3)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div ref={mapRef} tabIndex={disabled ? -1 : 0} role="application" aria-roledescription="map"
        aria-label={`Map. ${value ? `Pin at ${fmtPoint(value, digits)}.` : "No pin."} Arrow keys pan, plus and minus zoom, Enter drops the pin at the centre.`}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null }}
        onKeyDown={onMapKey}
        className="group relative cursor-crosshair touch-none overflow-hidden rounded-lg border border-border bg-(--surface) outline-none select-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ height }}>
        {tiles.length > 0 && (
          <div aria-hidden className="absolute inset-0" style={{ filter: tileFilter === "dark" ? DARK_TILES : undefined }}>
            {tiles.map((t) => (
              <img key={t.key} src={t.src} alt="" draggable={false} width={TILE} height={TILE}
                className="absolute max-w-none" style={{ left: t.left, top: t.top }} />
            ))}
          </div>
        )}
        {!tileUrl && size.w > 0 && <Graticule ox={ox} oy={oy} w={size.w} h={size.h} z={zoom} />}
        <Crosshair aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-muted-foreground opacity-0 group-focus-visible:opacity-100" />
        {marker && (
          <MapPin aria-hidden className="pointer-events-none absolute size-7 -translate-x-1/2 -translate-y-full fill-primary text-primary-foreground drop-shadow"
            style={{ left: marker.x, top: marker.y }} />
        )}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <button type="button" aria-label="Zoom in" disabled={disabled || zoom >= maxZoom} onClick={() => zoomAt(zoom + 1)} className={ctl}>
            <Plus className="size-4" />
          </button>
          <button type="button" aria-label="Zoom out" disabled={disabled || zoom <= 0} onClick={() => zoomAt(zoom - 1)} className={ctl}>
            <Minus className="size-4" />
          </button>
          {canLocate && (
            <button type="button" aria-label="Use my location" disabled={disabled || locating} onClick={locate} className={ctl}>
              <LocateFixed className={cn("size-4", locating && "motion-safe:animate-pulse")} />
            </button>
          )}
        </div>
        <span aria-hidden className="pointer-events-none absolute bottom-2 left-2 font-mono text-[10px] text-(--faint-foreground) tabular-nums">z{zoom}</span>
        {tileUrl && attribution && (
          <div className="absolute right-0 bottom-0 rounded-tl bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground [&_a]:underline">
            {attribution}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Latitude</span>
          <input type="text" inputMode="decimal" disabled={disabled} value={latText} placeholder="−90 to 90"
            aria-invalid={latBad || undefined}
            onChange={(e) => setLatText(e.target.value)} onBlur={commitFields}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitFields() } }}
            className={fieldCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Longitude</span>
          <input type="text" inputMode="decimal" disabled={disabled} value={lonText} placeholder="−180 to 180"
            aria-invalid={lonBad || undefined}
            onChange={(e) => setLonText(e.target.value)} onBlur={commitFields}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitFields() } }}
            className={fieldCls} />
        </label>
        {value && !disabled && (
          <button type="button" aria-label="Clear location" onClick={() => set(null)}
            className="mb-1 inline-flex size-7 items-center justify-center rounded text-muted-foreground outline-none hover:bg-foreground/8 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-3.5" />
          </button>
        )}
        <p aria-live="polite" className="ml-auto pb-2 font-mono text-[10.5px] text-muted-foreground tabular-nums">
          {value ? fmtPoint(value, digits) : "no location"}{note && ` · ${note}`}
        </p>
        {latName !== undefined && <input type="hidden" name={latName} value={value ? String(value.lat) : ""} />}
        {lonName !== undefined && <input type="hidden" name={lonName} value={value ? String(value.lon) : ""} />}
      </div>
    </div>
  )
}
