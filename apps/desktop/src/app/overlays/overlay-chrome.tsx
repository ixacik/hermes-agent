import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export const overlayCardClass =
  'rounded-lg border border-border bg-card shadow-[inset_0_0.0625rem_0_color-mix(in_srgb,white_34%,transparent)]'

interface OverlayCardProps extends ComponentProps<'div'> {
  children: ReactNode
}

interface OverlayActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'default' | 'danger' | 'subtle'
}

export function OverlayCard({ children, className, ...props }: OverlayCardProps) {
  return (
    <div className={cn(overlayCardClass, className)} {...props}>
      {children}
    </div>
  )
}

export function OverlayActionButton({
  children,
  className,
  tone = 'default',
  type = 'button',
  ...props
}: OverlayActionButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-45',
        tone === 'default' &&
          'border-border bg-card text-foreground hover:bg-[color-mix(in_srgb,var(--dt-muted)_46%,var(--dt-card))]',
        tone === 'subtle' &&
          'h-7 border-transparent px-2 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground',
        tone === 'danger' &&
          'h-7 border-transparent px-2 text-destructive hover:border-(--ui-border-error) hover:bg-(--ui-bg-error) hover:text-destructive',
        className
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  )
}

interface OverlayIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
}

export function OverlayIconButton({ children, className, type = 'button', ...props }: OverlayIconButtonProps) {
  return (
    <OverlayActionButton
      className={cn('h-7 w-7 justify-center px-0 [&_svg]:size-4', className)}
      tone="subtle"
      type={type}
      {...props}
    >
      {children}
    </OverlayActionButton>
  )
}
