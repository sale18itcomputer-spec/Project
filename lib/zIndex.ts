/**
 * The app's single z-index scale.
 *
 * Before this existed there were 19 distinct z values scattered across the
 * codebase — `z-50` on a dashboard modal, `z-[120]`/`z-[130]`/`z-[150]` in
 * User Management, `z-[500]` on global search, `z-[99999]` on the security
 * modal, `z-[1000010]` on the confirmation modal, and JS constants at
 * 999998/999999 for the window dock. Nothing was comparable to anything
 * else, so every new overlay was a guess and stacking bugs were routine.
 *
 * Rules:
 *  - Never write a raw z-index in a component. Import from here.
 *  - Layers are 100 apart so there's room to slot something in between.
 *  - `app/globals.css` mirrors POPOVER / MODAL / TOAST for the Radix and
 *    Sonner portals (which render into <body> and need `!important`).
 *    If you change those three, change them there too.
 */
export const Z = {
    /** Content that lifts inside its own container: sticky table headers,
     *  frozen columns, in-card overlays. */
    BASE: 10,
    STICKY: 20,
    /** Sticky page furniture: dashboard headers/footers, table toolbars. */
    HEADER: 100,
    /** Floating action button + docked AI assistant panel. Deliberately
     *  BELOW nav chrome: the FAB used to sit at 85 against a bottom tab bar
     *  at 80, so it covered the right-most tab on every phone. */
    FAB: 150,
    /** App chrome: sidebar, top nav, mobile bottom tab bar. */
    NAV: 200,
    /** Scrim behind the mobile sidebar drawer. */
    NAV_SCRIM: 290,
    /** Mobile navigation drawer itself. */
    DRAWER: 300,
    /** Draggable managed windows. The window manager assigns
     *  WINDOW + n as windows are focused; keep the gap to MODAL large. */
    WINDOW: 1000,
    /** Dock of minimized windows — must clear the windows themselves. */
    WINDOW_DOCK: 1200,
    /** Modal dialogs and their backdrops (backdrop sits at MODAL - 10). */
    MODAL: 1300,
    /** Popovers, dropdowns, selects, context menus. Above modals so a
     *  select inside a dialog opens over it rather than behind it. */
    POPOVER: 1400,
    /** Command palette / global search overlay. */
    COMMAND: 1500,
    /** Toasts — always the topmost surface. */
    TOAST: 1600,
} as const;

export type ZLayer = keyof typeof Z;
