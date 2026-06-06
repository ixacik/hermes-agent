import { useStore } from '@nanostores/react'
import type * as React from 'react'

import { writeSessionDrag } from '@/app/chat/composer/inline-refs'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import type { SessionInfo } from '@/hermes'
import { sessionTitle } from '@/lib/chat-runtime'
import { triggerHaptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { $attentionSessionIds } from '@/store/session'

import { SessionActionsMenu, SessionContextMenu } from './session-actions-menu'

interface SidebarSessionRowProps extends React.ComponentProps<'div'> {
  session: SessionInfo
  isPinned: boolean
  isSelected: boolean
  isWorking: boolean
  onArchive: () => void
  onDelete: () => void
  onPin: () => void
  onResume: () => void
  reorderable?: boolean
  dragging?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLElement>
}

const AGE_TICKS: ReadonlyArray<[number, string]> = [
  [86_400_000, 'd'],
  [3_600_000, 'h'],
  [60_000, 'm'],
  [1_000, 's']
]

function formatAge(seconds: number): string {
  const delta = Math.max(0, Date.now() - seconds * 1000)

  for (const [ms, suffix] of AGE_TICKS) {
    if (delta >= ms) {
      return `${Math.floor(delta / ms)}${suffix}`
    }
  }

  return 'now'
}

export function SidebarSessionRow({
  session,
  isPinned,
  isSelected,
  isWorking,
  onArchive,
  onDelete,
  onPin,
  onResume,
  reorderable = false,
  dragging = false,
  dragHandleProps,
  className,
  style,
  ref,
  ...rest
}: SidebarSessionRowProps) {
  const title = sessionTitle(session)
  const age = formatAge(session.last_active || session.started_at)
  const handleLabel = `Reorder ${title}`
  // Subscribe per-row (the leaf) instead of drilling a set through the list —
  // the atom is tiny and rarely non-empty. True when a clarify prompt in this
  // session is waiting on the user.
  const needsInput = useStore($attentionSessionIds).includes(session.id)
  // "Active" = running a turn or waiting on the user. Active rows show the
  // status light (right); idle rows show a muted relative timestamp instead.
  const isActive = isWorking || needsInput

  return (
    <SessionContextMenu
      onArchive={onArchive}
      onDelete={onDelete}
      onPin={onPin}
      pinned={isPinned}
      profile={session.profile}
      sessionId={session.id}
      title={title}
    >
      <div
        className={cn(
          'group relative grid min-h-[1.625rem] cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center rounded-lg transition-colors duration-100 ease-out hover:bg-(--ui-row-hover-background) hover:transition-none',
          isSelected && 'bg-(--ui-row-active-background)',
          isWorking && 'text-foreground',
          dragging && 'z-10 cursor-grabbing opacity-60 shadow-sm',
          className
        )}
        data-working={isWorking ? 'true' : undefined}
        draggable
        onDragStart={event => {
          // Reorder drags belong to dnd-kit (the grab handle) — cancel the
          // native drag so the two DnD systems don't fight.
          if ((event.target as HTMLElement).closest('[data-reorder-handle]')) {
            event.preventDefault()

            return
          }

          writeSessionDrag(event.dataTransfer, {
            id: session.id,
            profile: session.profile || 'default',
            title
          })
        }}
        ref={ref}
        style={style}
        {...rest}
      >
        <button
          // pl-2 puts the title on the shared left gutter (+0.5rem) — the same
          // column as the nav icons, search/pin icons, and section-header text.
          className="z-0 flex min-w-0 items-center bg-transparent py-0.5 pl-2 pr-1 text-left"
          onClick={event => {
            if (event.shiftKey) {
              event.preventDefault()
              event.stopPropagation()
              triggerHaptic('selection')
              onPin()

              return
            }

            if (event.metaKey || event.ctrlKey) {
              event.preventDefault()
              event.stopPropagation()
              triggerHaptic('selection')
              onArchive()

              return
            }

            onResume()
          }}
          type="button"
        >
          <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-normal text-(--ui-text-secondary) group-hover:text-foreground group-data-[working=true]:text-(--ui-text-secondary)">
            {title}
          </span>
        </button>
        <div className="relative flex w-14 shrink-0 items-center justify-end pr-2">
          {/* Idle → muted relative timestamp; active → status light. Hidden on
              hover so the reorder handle + actions menu take the slot. */}
          <span className="pointer-events-none flex items-center transition-opacity group-hover:opacity-0">
            {isActive ? (
              <SidebarRowDot isWorking={isWorking} needsInput={needsInput} />
            ) : (
              <span className="text-[0.625rem] leading-none tabular-nums text-(--ui-text-tertiary)">{age}</span>
            )}
          </span>
          {/* Hover cluster (right): reorder grabber + actions menu. */}
          <span className="absolute inset-y-0 right-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 pointer-events-none">
            {reorderable && (
              <span
                {...dragHandleProps}
                aria-label={handleLabel}
                className={cn(
                  'grid size-5 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-(--ui-text-quaternary) transition-colors hover:bg-(--ui-control-active-background) hover:text-(--ui-text-secondary) active:cursor-grabbing',
                  dragging && 'text-(--ui-text-secondary)'
                )}
                data-reorder-handle
                onClick={event => event.stopPropagation()}
              >
                <Codicon name="grabber" size="0.75rem" />
              </span>
            )}
            <SessionActionsMenu
              onArchive={onArchive}
              onDelete={onDelete}
              onPin={onPin}
              pinned={isPinned}
              profile={session.profile}
              sessionId={session.id}
              title={title}
            >
              <Button
                aria-label={`Actions for ${title}`}
                className="size-5 rounded-lg bg-transparent text-(--ui-text-tertiary) transition-colors duration-100 hover:bg-(--ui-control-active-background) hover:text-foreground focus-visible:bg-(--ui-control-active-background) focus-visible:text-foreground focus-visible:ring-0 data-[state=open]:bg-(--ui-control-active-background) data-[state=open]:text-foreground [&_svg]:size-3.5!"
                size="icon"
                title="Session actions"
                variant="ghost"
              >
                <Codicon name="ellipsis" size="0.875rem" />
              </Button>
            </SessionActionsMenu>
          </span>
        </div>
      </div>
    </SessionContextMenu>
  )
}

function SidebarRowDot({
  isWorking,
  needsInput = false,
  className
}: {
  isWorking: boolean
  needsInput?: boolean
  className?: string
}) {
  // "Needs input" wins over "working": a clarify-blocked session is technically
  // still running, but the actionable state is that it's waiting on the user.
  // Amber + steady (no ping) reads as "your turn", distinct from the accent
  // pulse of an active turn.
  if (needsInput) {
    return (
      <span
        aria-label="Needs your input"
        className={cn('quest-glow relative size-1.5 rounded-full bg-amber-500', className)}
        role="status"
        title="Waiting for your answer"
      />
    )
  }

  // Working → the dither square (the same motif removed from the section
  // headers), pulsing in the accent color so it reads as live. It only appears
  // while a turn is running, taking the timestamp's slot on the right.
  return (
    <span
      aria-label={isWorking ? 'Session running' : undefined}
      className={cn(
        isWorking
          ? 'dither size-2 shrink-0 animate-pulse rounded-[1px] text-(--ui-inline-code-foreground)'
          : 'size-1 rounded-full bg-(--ui-text-quaternary) opacity-80',
        className
      )}
      role={isWorking ? 'status' : undefined}
    />
  )
}
