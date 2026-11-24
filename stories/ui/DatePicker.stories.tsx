import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Calendar, DatePicker, addDays, todayISO, type ISODate } from "@/components/ui/date-picker"
import { Label as FieldLabel } from "@/components/ui/label"

/* Every date here is synthetic. */

const meta: Meta = {
  title: "General UI/Components/Date picker",
  parameters: {
    docs: {
      description: {
        component:
          "A calendar in a popover. The value is an ISO calendar date string, `YYYY-MM-DD` (what `<input type=\"date\">` holds), " +
          "never a JS `Date`, so no time zone can shift it. Keyboard: arrows move by day and week, PageUp/PageDown by month " +
          "(with Shift, by year), Home/End to the week's ends, Enter or Space chooses. Weeks start on Monday (ISO 8601) unless " +
          "`weekStartsOn={0}`. Click the month caption to jump between months.",
      },
    },
  },
}
export default meta

export const Default: StoryObj = {
  render: () => {
    const [date, setDate] = React.useState<ISODate | null>(null)
    return (
      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="dp-session">Session date</FieldLabel>
        <DatePicker id="dp-session" value={date} onChange={setDate} name="session" />
        <p className="text-sm text-muted-foreground">value: <code className="font-mono">{JSON.stringify(date)}</code></p>
      </div>
    )
  },
}

export const Bounded: StoryObj = {
  name: "With min, max and blocked days",
  render: () => {
    const today = todayISO()
    const weekend = (d: ISODate) => [0, 6].includes(new Date(d + "T00:00:00Z").getUTCDay())
    const [date, setDate] = React.useState<ISODate | null>(() => {
      let d = addDays(today, -1)
      while (weekend(d)) d = addDays(d, -1)
      return d
    })
    return (
      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="dp-bounded">Recording day (last 30 days, weekdays only)</FieldLabel>
        <DatePicker id="dp-bounded" value={date} onChange={setDate} min={addDays(today, -30)} max={today} isDisabled={weekend} />
      </div>
    )
  },
}

export const Formatted: StoryObj = {
  name: "Long format, Sunday start, week numbers",
  render: () => {
    const [date, setDate] = React.useState<ISODate | null>("2026-03-20")
    const fmt = (d: ISODate) => new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeZone: "UTC" }).format(new Date(d + "T00:00:00Z"))
    return <DatePicker value={date} onChange={setDate} format={fmt} weekStartsOn={0} showWeekNumbers className="w-64" aria-label="Equinox" />
  },
}

export const States: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <DatePicker aria-label="Empty" />
      <DatePicker aria-label="Disabled" defaultValue="2026-11-24" disabled />
      <DatePicker aria-label="Invalid" aria-invalid defaultValue="2026-11-24" />
    </div>
  ),
}

export const InlineCalendar: StoryObj = {
  name: "Calendar on its own",
  render: () => {
    const [date, setDate] = React.useState<ISODate>("2026-11-24")
    return (
      <div className="w-fit rounded-lg border bg-card">
        <Calendar value={date} onSelect={setDate} showWeekNumbers />
      </div>
    )
  },
}
