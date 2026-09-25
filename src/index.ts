// Self-hosted faces. Imported from JS, not from theme.css, so the bundler resolves
// their url()s against this package rather than the consuming app.
import "./fonts.css"

// ── Science: the reason this library exists ─────────────────────────────────────
// Charts
export * from "./science/charts/LineChart"
export * from "./science/charts/BarChart"
export { decimate } from "./science/charts/decimate"
export { SERIES, TIER_COLOR } from "./science/charts/common"
// Signals
export * from "./science/signals/Waveform"
export * from "./science/signals/Heatmap"
// Statistics
export * from "./science/stats/NullDistribution"
// Evidence: how sure a value is, said so it cannot be hidden
export * from "./science/evidence/tier"
export * from "./science/evidence/value"
export * from "./science/evidence/docs"

// ── General UI ──────────────────────────────────────────────────────────────────
export * from "./components/typography"
export * from "./components/publication"
export * from "./specimens"
export * from "./components/specimen"

// shadcn/ui components, restyled to the type rules (never bold, never tracked)
export * from "./components/ui/badge"
export * from "./components/ui/button"
export * from "./components/ui/card"
export * from "./components/ui/input"
export * from "./components/ui/label"
export * from "./components/ui/scroll-area"
export * from "./components/ui/select"
export * from "./components/ui/separator"
export * from "./components/ui/sheet"
export * from "./components/ui/slider"
export * from "./components/ui/table"
export * from "./components/ui/tabs"
export * from "./components/ui/tooltip"
export { cn } from "./lib/utils"
