import { forwardRef, ComponentPropsWithoutRef } from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[transform,box-shadow,background-color,color,border-color,opacity] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px active:scale-[0.99] [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-[color-mix(in_oklab,var(--color-primary)_88%,black)] dark:hover:bg-[color-mix(in_oklab,var(--color-primary)_88%,white)] active:bg-[color-mix(in_oklab,var(--color-primary)_80%,black)] dark:active:bg-[color-mix(in_oklab,var(--color-primary)_80%,white)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-[color-mix(in_oklab,var(--color-destructive)_88%,black)] dark:hover:bg-[color-mix(in_oklab,var(--color-destructive)_88%,white)] active:bg-[color-mix(in_oklab,var(--color-destructive)_80%,black)] dark:active:bg-[color-mix(in_oklab,var(--color-destructive)_80%,white)] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs hover:bg-muted hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/45",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-[color-mix(in_oklab,var(--color-secondary)_88%,black)] dark:hover:bg-[color-mix(in_oklab,var(--color-secondary)_88%,white)] active:bg-[color-mix(in_oklab,var(--color-secondary)_80%,black)] dark:active:bg-[color-mix(in_oklab,var(--color-secondary)_80%,white)]",
        ghost:
          "hover:bg-muted hover:text-foreground dark:hover:bg-muted/70",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }>(function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}, ref) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})

Button.displayName = "Button"

export { Button, buttonVariants }
