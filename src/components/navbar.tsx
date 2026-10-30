// The NAVBAR: a short sticky bar that can slide away while you scroll down and come back when
// you scroll up. Same classes as design.css (.ui-navbar), same behaviour as design.js
// `initNavbar`, so a zero-build page and a React app look and act alike.
// Below the tablet breakpoint (768px) `items` fold into a menu and `wide` content is hidden.
import * as React from "react"
import { Menu, X } from "lucide-react"
import { cn } from "../lib/utils"

export type NavbarProps = {
  /** The app name, set in the display face. */
  brand: React.ReactNode
  /** Small mono label after the name, e.g. "v1". Stays visible at every width. */
  version?: React.ReactNode
  /** Links, a select, anything that can fold into the menu below the tablet breakpoint. */
  items?: React.ReactNode
  /** Always visible, at the right (an icon button, a theme toggle). */
  actions?: React.ReactNode
  /** Readouts and status text. Hidden below the tablet breakpoint. */
  wide?: React.ReactNode
  /** Slide up out of view while scrolling down; slide back on scroll up. Always shown at the top. */
  autohide?: boolean
  /** Max width of the bar's content. Defaults to the page content width. */
  maxWidth?: string
  className?: string
}

export function Navbar({ brand, version, items, actions, wide, autohide = true, maxWidth, className }: NavbarProps) {
  const ref = React.useRef<HTMLElement>(null)
  const [open, setOpen] = React.useState(false)
  const [hidden, setHidden] = React.useState(false)
  const menuId = React.useId()

  React.useEffect(() => {
    const mq = matchMedia("(min-width: 768px)")
    const onChange = (e: MediaQueryListEvent) => { if (e.matches) setOpen(false) }
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    mq.addEventListener("change", onChange)
    document.addEventListener("click", onDoc)
    return () => { mq.removeEventListener("change", onChange); document.removeEventListener("click", onDoc) }
  }, [])

  React.useEffect(() => {
    if (!autohide) return
    let last = window.scrollY
    const onScroll = () => {
      const y = Math.max(0, window.scrollY), d = y - last
      if (y <= 8 || open || ref.current?.querySelector(":focus-visible")) { setHidden(false); last = y }
      else if (d > 6) { setHidden(true); last = y }
      else if (d < -6) { setHidden(false); last = y }
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [autohide, open])

  return (
    <header
      ref={ref}
      className={cn("ui-navbar", hidden && "is-hidden", className)}
      data-open={open ? "" : undefined}
      onFocus={(e) => { if (e.target.matches(":focus-visible")) setHidden(false) }}
      onKeyDown={(e) => { if (e.key === "Escape") setOpen(false) }}
    >
      <div className="ui-navbar__bar" style={maxWidth ? ({ "--navbar-max": maxWidth } as React.CSSProperties) : undefined}>
        <span className="ui-navbar__brand">{brand}{version != null && <span className="ui-navbar__version">{version}</span>}</span>
        {items != null && <div className="ui-navbar__items" id={menuId} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false) }}>{items}</div>}
        <div className="ui-navbar__actions">
          {wide != null && <span className="ui-navbar__wide">{wide}</span>}
          {actions}
        </div>
        {items != null && (
          <button type="button" className="ui-navbar__toggle" aria-label="Menu" aria-expanded={open} aria-controls={menuId}
            onClick={() => setOpen((o) => !o)}>
            {open ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
        )}
      </div>
    </header>
  )
}

/** A link for `items`. Set `current` on the one for the section in view. */
export function NavbarLink({ current, className, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { current?: boolean }) {
  return <a className={cn("ui-navbar__link", className)} aria-current={current ? "true" : undefined} {...props} />
}
