/**
 * Calendar and DatePicker. Dependency-free apart from Radix's Popover (already a dependency).
 *
 * A date is a plain ISO 8601 calendar date string, "YYYY-MM-DD" — the same value an
 * <input type="date"> holds. Not a JS Date: a Date is an instant, and turning a calendar day
 * into an instant is how a recording dated 24 Nov in Victoria shows up as 25 Nov in UTC.
 * All arithmetic below is done in UTC on whole days, so no time zone can move a date.
 *
 * Type rules hold: the month caption is the display serif in regular case, weekday headers are
 * uppercase mono, day numbers are the sans at regular weight with tabular figures. The chosen
 * day is clay (the value), today carries a hairline ring, and a day outside min/max is shown
 * but cannot be chosen.
 */
import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react"
import { cn } from "../../lib/utils"

/** "YYYY-MM-DD". */
export type ISODate = string

const DAY = 86_400_000
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Parse "YYYY-MM-DD" to a UTC day number, or null if it is not a real calendar date. */
function toDay(iso: ISODate | null | undefined): number | null {
  if (!iso) return null
  const m = ISO_RE.exec(iso)
  if (!m) return null
  const y = +m[1], mo = +m[2] - 1, d = +m[3]
  const t = Date.UTC(y, mo, d)
  const back = new Date(t)
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo || back.getUTCDate() !== d) return null
  return t / DAY
}

function fromDay(day: number): ISODate {
  return new Date(day * DAY).toISOString().slice(0, 10)
}

/** True for a well-formed, real calendar date ("2026-02-30" is false). */
export function isISODate(value: unknown): value is ISODate {
  return typeof value === "string" && toDay(value) !== null
}

/** Today in the viewer's local calendar, as "YYYY-MM-DD". */
export function todayISO(): ISODate {
  const n = new Date()
  return fromDay(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / DAY)
}

/** Shift a date by whole days (negative goes back). */
export function addDays(iso: ISODate, days: number): ISODate {
  const d = toDay(iso)
  if (d === null) throw new Error(`addDays: "${iso}" is not a YYYY-MM-DD date`)
  return fromDay(d + days)
}

type Month = { y: number; m: number } // m is 0-11

const monthOf = (iso: ISODate): Month => ({ y: +iso.slice(0, 4), m: +iso.slice(5, 7) - 1 })
const shiftMonth = ({ y, m }: Month, by: number): Month => {
  const t = y * 12 + m + by
  return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 }
}
const daysIn = ({ y, m }: Month) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

/** Move a date by whole months, clamping the day ("31 Jan" + 1 month is "28/29 Feb"). */
function addMonths(iso: ISODate, by: number): ISODate {
  const to = shiftMonth(monthOf(iso), by)
  const d = Math.min(+iso.slice(8, 10), daysIn(to))
  return fromDay(Date.UTC(to.y, to.m, d) / DAY)
}

function clamp(iso: ISODate, min?: ISODate, max?: ISODate): ISODate {
  if (min && isISODate(min) && iso < min) return min
  if (max && isISODate(max) && iso > max) return max
  return iso
}

function useLocaleNames(locale: string | undefined, weekStartsOn: 0 | 1) {
  return React.useMemo(() => {
    const month = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" })
    const monthShort = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" })
    const weekdayShort = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" })
    const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" })
    const full = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    // 2023-01-01 was a Sunday.
    const weekdays = Array.from({ length: 7 }, (_, i) => {
      const t = Date.UTC(2023, 0, 1 + ((i + weekStartsOn) % 7))
      return { short: weekdayShort.format(t), long: weekdayLong.format(t) }
    })
    return {
      month: (mo: Month) => month.format(Date.UTC(mo.y, mo.m, 1)),
      monthShort: (m: number) => monthShort.format(Date.UTC(2023, m, 1)),
      full: (iso: ISODate) => full.format((toDay(iso) ?? 0) * DAY),
      weekdays,
    }
  }, [locale, weekStartsOn])
}

/* ------------------------------------------------------------------ Calendar -- */

export type CalendarProps = {
  /** The chosen date, "YYYY-MM-DD", or null for none. */
  value?: ISODate | null
  /** Called with the date the person chose. */
  onSelect?: (value: ISODate) => void
  /** The month shown first when there is no value (any day in it). Defaults to today. */
  defaultMonth?: ISODate
  /** Earliest choosable date, inclusive. */
  min?: ISODate
  /** Latest choosable date, inclusive. */
  max?: ISODate
  /** Return true for any other date that cannot be chosen (e.g. weekends, days with no data). */
  isDisabled?: (value: ISODate) => boolean
  /** 1 = Monday (ISO 8601, the default), 0 = Sunday. */
  weekStartsOn?: 0 | 1
  /** BCP 47 locale for month and weekday names. Defaults to the browser's. */
  locale?: string
  /** Show ISO week numbers in a first column. */
  showWeekNumbers?: boolean
  /** Move keyboard focus into the grid on mount (the picker sets this when it opens). */
  autoFocus?: boolean
  className?: string
}

/** ISO 8601 week number of a UTC day. */
function isoWeek(day: number): number {
  const d = new Date(day * DAY)
  const dow = (d.getUTCDay() + 6) % 7 // Mon=0
  const thursday = day - dow + 3
  const y = new Date(thursday * DAY).getUTCFullYear()
  return 1 + Math.floor((thursday - Date.UTC(y, 0, 1) / DAY) / 7)
}

export function Calendar({
  value, onSelect, defaultMonth, min, max, isDisabled, weekStartsOn = 1, locale,
  showWeekNumbers = false, autoFocus = false, className,
}: CalendarProps) {
  const today = todayISO()
  const selected = isISODate(value) ? value : null
  const names = useLocaleNames(locale, weekStartsOn)
  const [focus, setFocus] = React.useState<ISODate>(() =>
    clamp(selected ?? (isISODate(defaultMonth) ? defaultMonth : today), min, max))
  const [view, setView] = React.useState<Month>(() => monthOf(focus))
  const [mode, setMode] = React.useState<"days" | "months">("days")
  const grid = React.useRef<HTMLDivElement>(null)
  const wantFocus = React.useRef(autoFocus)
  const captionId = React.useId()

  // A new value from outside moves the view to it.
  React.useEffect(() => {
    if (selected) { setFocus(selected); setView(monthOf(selected)) }
  }, [selected])

  React.useEffect(() => {
    if (!wantFocus.current) return
    const el = grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)
    if (el) { el.focus(); wantFocus.current = false }
  })

  const disabled = React.useCallback((iso: ISODate) =>
    (!!min && isISODate(min) && iso < min) || (!!max && isISODate(max) && iso > max) || !!isDisabled?.(iso),
  [min, max, isDisabled])

  const first = Date.UTC(view.y, view.m, 1) / DAY
  const lead = (new Date(first * DAY).getUTCDay() - weekStartsOn + 7) % 7
  const start = first - lead
  const weeks = Math.ceil((lead + daysIn(view)) / 7)
  const rows = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => start + w * 7 + d))

  const prevOk = !min || !isISODate(min) || fromDay(first - 1) >= min
  const nextOk = !max || !isISODate(max) || fromDay(first + daysIn(view)) <= max

  const moveFocus = (to: ISODate) => {
    const next = clamp(to, min, max)
    setFocus(next)
    setView(monthOf(next))
    wantFocus.current = true
  }

  const onKey = (e: React.KeyboardEvent) => {
    const step: Record<string, () => ISODate> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      PageUp: () => (e.shiftKey ? addMonths(focus, -12) : addMonths(focus, -1)),
      PageDown: () => (e.shiftKey ? addMonths(focus, 12) : addMonths(focus, 1)),
      Home: () => addDays(focus, -((new Date((toDay(focus) ?? 0) * DAY).getUTCDay() - weekStartsOn + 7) % 7)),
      End: () => addDays(focus, 6 - ((new Date((toDay(focus) ?? 0) * DAY).getUTCDay() - weekStartsOn + 7) % 7)),
    }
    if (step[e.key]) { e.preventDefault(); moveFocus(step[e.key]()) }
  }

  const navBtn = "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-foreground/8 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"

  return (
    <div data-slot="calendar" className={cn("w-fit select-none p-3", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button type="button" className={navBtn} aria-label={mode === "days" ? "Previous month" : "Previous year"}
          disabled={mode === "days" ? !prevOk : false}
          onClick={() => setView((v) => shiftMonth(v, mode === "days" ? -1 : -12))}>
          <ChevronLeft className="size-4" />
        </button>
        <button type="button" id={captionId} aria-live="polite"
          className="rounded-md px-2 py-0.5 font-display text-xl leading-tight text-foreground outline-none hover:bg-foreground/8 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={mode === "days" ? `${names.month(view)}, choose a month` : `${view.y}, back to days`}
          onClick={() => setMode((m) => (m === "days" ? "months" : "days"))}>
          {mode === "days" ? names.month(view) : view.y}
        </button>
        <button type="button" className={navBtn} aria-label={mode === "days" ? "Next month" : "Next year"}
          disabled={mode === "days" ? !nextOk : false}
          onClick={() => setView((v) => shiftMonth(v, mode === "days" ? 1 : 12))}>
          <ChevronRight className="size-4" />
        </button>
      </div>

      {mode === "months" ? (
        <div className={cn("grid grid-cols-3 gap-1", showWeekNumbers ? "w-[284px]" : "w-[252px]")} role="group" aria-labelledby={captionId}>
          {Array.from({ length: 12 }, (_, m) => {
            const last = fromDay(Date.UTC(view.y, m + 1, 0) / DAY)
            const firstOf = fromDay(Date.UTC(view.y, m, 1) / DAY)
            const out = (!!min && isISODate(min) && last < min) || (!!max && isISODate(max) && firstOf > max)
            const current = view.m === m
            return (
              <button key={m} type="button" disabled={out}
                className={cn(
                  "h-9 rounded-md px-2 text-sm text-foreground outline-none transition-colors hover:bg-foreground/8 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30",
                  current && "bg-foreground/8 text-foreground",
                )}
                onClick={() => { setView({ y: view.y, m }); setMode("days") }}>
                {names.monthShort(m)}
              </button>
            )
          })}
        </div>
      ) : (
        <div ref={grid} role="grid" aria-labelledby={captionId} onKeyDown={onKey}>
          <div role="row" className="flex">
            {showWeekNumbers && (
              <span role="columnheader" aria-label="Week number"
                className="flex h-7 w-8 items-center justify-center font-mono text-[10px] font-medium tracking-[.14em] text-(--faint-foreground) uppercase">
                Wk
              </span>
            )}
            {names.weekdays.map((w) => (
              <abbr key={w.long} role="columnheader" title={w.long} aria-label={w.long}
                className="flex h-7 w-9 items-center justify-center font-mono text-[10px] font-medium tracking-[.14em] text-muted-foreground uppercase no-underline">
                {w.short.slice(0, 2)}
              </abbr>
            ))}
          </div>
          {rows.map((row) => (
            <div role="row" key={row[0]} className="flex">
              {showWeekNumbers && (
                <span role="rowheader" className="flex h-9 w-8 items-center justify-center font-mono text-[10px] text-(--faint-foreground) tabular-nums">
                  {isoWeek(row[0] + (weekStartsOn === 0 ? 1 : 0))}
                </span>
              )}
              {row.map((day) => {
                const iso = fromDay(day)
                const inMonth = monthOf(iso).m === view.m
                const isSel = iso === selected
                const isToday = iso === today
                const off = disabled(iso)
                return (
                  <div role="gridcell" key={day} aria-selected={isSel || undefined} className="p-0">
                    <button type="button" data-date={iso}
                      tabIndex={iso === focus ? 0 : -1}
                      disabled={off}
                      aria-label={names.full(iso) + (isToday ? ", today" : "")}
                      aria-current={isToday ? "date" : undefined}
                      aria-pressed={isSel}
                      onFocus={() => setFocus(iso)}
                      onClick={() => { setFocus(iso); onSelect?.(iso) }}
                      className={cn(
                        "relative inline-flex size-9 items-center justify-center rounded-md text-sm tabular-nums outline-none transition-colors",
                        "hover:bg-foreground/8 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-popover",
                        inMonth ? "text-foreground" : "text-(--faint-foreground)",
                        isToday && !isSel && "ring-1 ring-(--border-strong) ring-inset",
                        isSel && "bg-primary text-primary-foreground hover:bg-primary",
                        off && "cursor-not-allowed text-(--faint-foreground) line-through decoration-(--faint-foreground) opacity-50 hover:bg-transparent",
                      )}>
                      {+iso.slice(8, 10)}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- DatePicker -- */

export type DatePickerProps = Omit<CalendarProps, "onSelect" | "autoFocus" | "className"> & {
  /** Called with the chosen date, or null when cleared. */
  onChange?: (value: ISODate | null) => void
  /** Uncontrolled starting value. Ignored when `value` is given. */
  defaultValue?: ISODate | null
  /** Shown when nothing is chosen. */
  placeholder?: string
  /** Show a clear button when a date is set. Default true. */
  clearable?: boolean
  /** Show a "Today" shortcut in the popover footer. Default true; hidden when today is out of range. */
  showToday?: boolean
  /** How the trigger prints the date. Defaults to the ISO date itself, in mono figures. */
  format?: (value: ISODate) => React.ReactNode
  /** Submitted with a form under this name, as "YYYY-MM-DD" (empty when cleared). */
  name?: string
  id?: string
  disabled?: boolean
  required?: boolean
  "aria-invalid"?: boolean
  "aria-label"?: string
  "aria-labelledby"?: string
  className?: string
  /** Popover alignment against the trigger. */
  align?: "start" | "center" | "end"
}

export function DatePicker({
  value: controlled, defaultValue = null, onChange, placeholder = "YYYY-MM-DD", clearable = true,
  showToday = true, format, name, id, disabled, required, className, align = "start",
  min, max, isDisabled, defaultMonth, weekStartsOn, locale, showWeekNumbers, ...aria
}: DatePickerProps) {
  const [inner, setInner] = React.useState<ISODate | null>(defaultValue)
  const isControlled = controlled !== undefined
  const value = isControlled ? (isISODate(controlled) ? controlled : null) : inner
  const [open, setOpen] = React.useState(false)
  const names = useLocaleNames(locale, weekStartsOn ?? 1)

  const set = (v: ISODate | null) => {
    if (!isControlled) setInner(v)
    onChange?.(v)
  }

  const today = todayISO()
  const todayOk = !((min && isISODate(min) && today < min) || (max && isISODate(max) && today > max) || isDisabled?.(today))

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <div data-slot="date-picker" className={cn("relative inline-flex w-56 max-w-full", className)}>
        <PopoverPrimitive.Trigger asChild>
          <button type="button" id={id} disabled={disabled}
            aria-haspopup="dialog"
            aria-invalid={aria["aria-invalid"]}
            aria-label={aria["aria-label"] ?? (value ? `Date, ${names.full(value)}. Change date` : "Choose a date")}
            aria-labelledby={aria["aria-labelledby"]}
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-input/30 px-3 text-left text-sm shadow-xs outline-none transition-[color,box-shadow]",
              "hover:bg-input/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
              "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/40",
              clearable && value && "pr-9",
            )}>
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {value
              ? <span className={cn("truncate text-foreground", !format && "font-mono tabular-nums")}>{format ? format(value) : value}</span>
              : <span className="truncate font-mono text-muted-foreground">{placeholder}</span>}
          </button>
        </PopoverPrimitive.Trigger>
        {clearable && value && !disabled && (
          <button type="button" aria-label="Clear date" onClick={() => set(null)}
            className="absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground outline-none hover:bg-foreground/8 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-3.5" />
          </button>
        )}
        {name !== undefined && <input type="hidden" name={name} value={value ?? ""} required={required} />}
      </div>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align={align} sideOffset={6} collisionPadding={16}
          aria-label="Choose a date"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            "z-50 rounded-lg border border-(--border-strong) bg-popover text-popover-foreground shadow-lg outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}>
          <Calendar value={value} autoFocus min={min} max={max} isDisabled={isDisabled}
            defaultMonth={defaultMonth} weekStartsOn={weekStartsOn} locale={locale} showWeekNumbers={showWeekNumbers}
            onSelect={(v) => { set(v); setOpen(false) }} />
          {(showToday || (clearable && value)) && (
            <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
              {showToday ? (
                <button type="button" disabled={!todayOk}
                  className="rounded px-1.5 py-1 font-mono text-[10.5px] font-medium tracking-[.14em] text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
                  onClick={() => { set(today); setOpen(false) }}>
                  Today
                </button>
              ) : <span />}
              <span className="font-mono text-[10.5px] text-(--faint-foreground) tabular-nums" aria-hidden>{value ?? ""}</span>
            </div>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
