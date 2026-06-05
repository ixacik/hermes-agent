import type * as React from 'react'

import { cn } from '@/lib/utils'

interface SidebarPanelLabelProps extends React.ComponentProps<'span'> {
  dotClassName?: string
  hideDot?: boolean
}

export function SidebarPanelLabel({
  children,
  className,
  dotClassName,
  hideDot = false,
  ...props
}: SidebarPanelLabelProps) {
  return (
    <span
      className={cn(
        'flex min-w-0 items-center text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-(--theme-primary)',
        // The dot carries the left inset + gap; without it the label sits flush.
        hideDot ? 'gap-0' : 'gap-2 pl-2',
        className
      )}
      {...props}
    >
      {!hideDot && (
        <span aria-hidden="true" className={cn('dither inline-block size-2 shrink-0 rounded-[1px]', dotClassName)} />
      )}
      <span className="min-w-0 truncate leading-none">{children}</span>
    </span>
  )
}
