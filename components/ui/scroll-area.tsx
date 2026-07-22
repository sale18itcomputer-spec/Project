import * as React from "react"

import { cn } from "../../lib/utils"

/**
 * Native scroll container (replaces the previous @radix-ui/react-scroll-area
 * implementation). Radix's ScrollArea composes refs in a way that infinite-loops
 * under React 19 + Next Fast Refresh ("Maximum update depth exceeded" via
 * useComposedRefs during ref detach on hot reload). A plain overflow container
 * with the app's `custom-scrollbar` styling avoids that entirely while keeping
 * the same API — consumers only ever pass `className` + children.
 */
const ScrollArea = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    // Accepted for API compatibility with the old Radix ScrollArea; ignored
    // (native scrollbars handle these), so no consumer needs to change.
    type?: "auto" | "always" | "scroll" | "hover"
    scrollHideDelay?: number
  }
>(({ className, children, type: _type, scrollHideDelay: _scrollHideDelay, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("relative overflow-auto custom-scrollbar", className)}
    {...props}
  >
    {children}
  </div>
))
ScrollArea.displayName = "ScrollArea"

// Kept for API compatibility with the old Radix export. Native scrollbars are
// used now, so there's nothing to render.
const ScrollBar = (_props: { orientation?: "vertical" | "horizontal"; className?: string }) => null
ScrollBar.displayName = "ScrollBar"

export { ScrollArea, ScrollBar }
