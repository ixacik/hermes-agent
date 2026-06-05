import * as React from 'react'

import { cn } from '@/lib/utils'

function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-grid h-4 min-w-4 place-items-center rounded-sm bg-(--ui-inline-code-background) px-1.5 font-mono text-[0.5625rem] font-medium leading-none text-muted-foreground',
        className
      )}
      data-slot="kbd"
      {...props}
    />
  )
}

interface KbdGroupProps extends Omit<React.ComponentProps<'span'>, 'children'> {
  keys: string[]
}

function KbdGroup({ className, keys, ...props }: KbdGroupProps) {
  return (
    <span
      aria-label={keys.join(' ')}
      className={cn('inline-flex shrink-0 items-center gap-0.5 opacity-55', className)}
      data-slot="kbd-group"
      {...props}
    >
      {keys.map(key => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </span>
  )
}

export { Kbd, KbdGroup }
