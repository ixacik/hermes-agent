import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'

// Text buttons are square (no radius) and sized by padding + line-height — no
// fixed heights — so they stay snug and scale with content. Only icon buttons
// (inherently square) carry the shared 4px radius.
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-xs leading-4 font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[0.1875rem] focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-default disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive dark:aria-invalid:ring-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-(--ui-bg-selected)',
        destructive:
          'bg-destructive text-white hover:bg-(--ui-bg-error) focus-visible:ring-destructive dark:bg-(--ui-bg-error) dark:focus-visible:ring-destructive',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input dark:hover:bg-input',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary',
        ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent',
        link: 'text-primary underline-offset-4 decoration-current hover:underline',
        // Boxless inline-text action (no bg/border). Quiet by default — reads as
        // muted label text, underlines on hover (e.g. "Cancel", "Clear").
        text: 'text-muted-foreground underline-offset-4 hover:text-foreground hover:underline',
        // Emphasized inline-text action: bold + always-underlined link. Use for
        // the actionable affordance in a row ("Change", "Set", "Open logs", …).
        textStrong: 'font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground'
      },
      size: {
        default: 'px-3 py-1.5 has-[>svg]:px-2.5',
        xs: "gap-1 px-2 py-0.5 text-[0.6875rem] leading-4 has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'px-2.5 py-1 has-[>svg]:px-2',
        lg: 'px-5 py-2 text-sm leading-5 has-[>svg]:px-4',
        icon: 'size-9 rounded-lg',
        'icon-xs': "size-6 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8 rounded-lg',
        'icon-lg': 'size-10 rounded-lg',
        'icon-titlebar':
          'h-(--titlebar-control-height) w-(--titlebar-control-size) rounded-lg [&_.codicon]:text-[0.875rem]'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      data-size={size}
      data-slot="button"
      data-variant={variant}
      {...props}
    />
  )
}

export { Button, buttonVariants }
