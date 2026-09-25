/**
 * The documentation drawer — the React replacement for <ui-note> / <ui-docs>.
 *
 * THE RULE: a label may never be hidden, and its explanation must be. So a <Note> renders
 * ONLY a small marker; its body is never rendered inline. It opens a shadcn Sheet holding
 * every note on the page, grouped by section, scrolled to the one that was asked for.
 */
import * as React from "react"
import { Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Tier, type TierId } from "./tier"

type Entry = { id: string; title: string; section: string; tier?: TierId; body: React.ReactNode }
type Ctx = { register: (e: Entry) => () => void; openAt: (id: string) => void }

const DocsContext = React.createContext<Ctx | null>(null)

export function DocsProvider({ title = "Documentation", children }: { title?: string; children: React.ReactNode }) {
  const [entries, setEntries] = React.useState<Entry[]>([])
  const [open, setOpen] = React.useState(false)
  const [focus, setFocus] = React.useState<string | null>(null)

  const register = React.useCallback((e: Entry) => {
    setEntries((prev) => [...prev.filter((p) => p.id !== e.id), e])
    return () => setEntries((prev) => prev.filter((p) => p.id !== e.id))
  }, [])
  const openAt = React.useCallback((id: string) => { setFocus(id); setOpen(true) }, [])

  React.useEffect(() => {
    if (!open || !focus) return
    const t = setTimeout(() => document.getElementById(`doc-${focus}`)?.scrollIntoView({ block: "start" }), 50)
    return () => clearTimeout(t)
  }, [open, focus])

  const sections = React.useMemo(() => {
    const m = new Map<string, Entry[]>()
    for (const e of entries) m.set(e.section, [...(m.get(e.section) ?? []), e])
    return [...m.entries()]
  }, [entries])

  return (
    <DocsContext.Provider value={{ register, openAt }}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">{title}</SheetTitle>
            <SheetDescription>What each label on this page means, and where its numbers came from.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-8rem)] px-4">
            {sections.map(([section, list]) => (
              <section key={section} className="mb-6">
                <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[.2em] text-muted-foreground">{section}</h3>
                {list.map((e) => (
                  <article
                    key={e.id}
                    id={`doc-${e.id}`}
                    className={`mb-4 rounded-md border p-3 ${focus === e.id ? "border-primary" : ""}`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <h4 className="font-display text-lg leading-none">{e.title}</h4>
                      {e.tier && <Tier id={e.tier} />}
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">{e.body}</div>
                  </article>
                ))}
              </section>
            ))}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </DocsContext.Provider>
  )
}

/** A marker that opens the drawer at this entry. The body is NEVER rendered inline. */
export function Note({
  title, section = "Notes", tier, children,
}: { title: string; section?: string; tier?: TierId; children: React.ReactNode }) {
  const ctx = React.useContext(DocsContext)
  if (!ctx) throw new Error("<Note> needs a <DocsProvider> above it — its body has nowhere else to go")
  const id = React.useId().replace(/:/g, "")
  const { register, openAt } = ctx
  React.useEffect(() => register({ id, title, section, tier, body: children }), [id, title, section, tier, children, register])
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-6 align-middle text-muted-foreground"
      aria-label={`About ${title}`}
      onClick={() => openAt(id)}
    >
      <Info className="size-3.5" />
    </Button>
  )
}

/** A one-line hint, tooltip only — the replacement for `data-doc`. */
export function Hint({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help underline decoration-dotted underline-offset-4">{children}</span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}
