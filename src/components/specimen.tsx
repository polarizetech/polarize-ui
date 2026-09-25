import { SPECIMENS, SPECIMEN_LABELS, type SpecimenKey } from "../specimens"
import { cn } from "../lib/utils"

/**
 * A specimen icon (see SPECIMEN-ICONS.md). Decorative by default, because a visible
 * caption usually carries the meaning; pass `label` to give it an accessible name instead.
 */
export function Specimen({ name, label, className }: { name: SpecimenKey; label?: boolean | string; className?: string }) {
  const title = label === true ? SPECIMEN_LABELS[name] : label || undefined
  return (
    <svg
      className={cn("ui-specimen", className)}
      viewBox="0 0 200 200"
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
      dangerouslySetInnerHTML={{ __html: SPECIMENS[name] }}
    />
  )
}
