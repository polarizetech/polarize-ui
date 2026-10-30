`.ui-navbar` is a 44px sticky bar: brand (display face, with an optional mono `.ui-navbar__version`), `.ui-navbar__items` links, and `.ui-navbar__actions` at the right.

Add `data-autohide` and the bar slides up out of view while scrolling down and returns when scrolling up; at the top of the page it is always shown. It stays visible while its menu is open or a control has keyboard focus. `design.js` wires it (`initNavbar`); React uses `Navbar` and `NavbarLink`.

Below 768px the items fold into a menu behind `.ui-navbar__toggle`, and `.ui-navbar__wide` (readouts, clocks) is hidden. Keep tier badges and other long labels out of the bar. Actions stay visible: use an icon-only button at phone width. Mark the current link with `aria-current`.
