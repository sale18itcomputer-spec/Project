import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex flex-shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md hover:shadow-primary/20",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-md hover:shadow-destructive/20",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/20",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-sm",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-md hover:shadow-emerald-600/20",
        // Icon-only tones. Base state is muted so a row of these reads as
        // secondary until hovered; the hover colour signals what it does.
        ghostPrimary:
          "text-muted-foreground hover:bg-primary/10 hover:text-primary",
        ghostDanger:
          "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
        ghostMuted:
          "text-muted-foreground hover:bg-accent hover:text-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        xs: "h-8 rounded-md px-2.5 text-xs",
        // Touch-first icon sizes: 44px on a phone (the accessibility floor),
        // tightening from `lg` up where a mouse makes 36px comfortable.
        iconTouch: "h-11 w-11 lg:h-9 lg:w-9",
        iconTouchSm: "h-9 w-9 lg:h-8 lg:w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// FIX: Changed interface to type to correctly intersect VariantProps.
// This resolves the issue where `variant` and `size` were not being recognized on ButtonProps.
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }