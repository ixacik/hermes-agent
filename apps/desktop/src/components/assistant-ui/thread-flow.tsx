import { ThreadPrimitive, useAuiEvent, useAuiState } from '@assistant-ui/react'
import {
  type ComponentProps,
  type FC,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef
} from 'react'

import { cn } from '@/lib/utils'
import { setThreadScrolledUp } from '@/store/thread-scroll'

const AT_BOTTOM_THRESHOLD = 8
const POST_RUN_BOTTOM_LOCK_MS = 1_200

type ThreadMessageComponents = ComponentProps<typeof ThreadPrimitive.MessageByIndex>['components']

type MessageGroup = { id: string; index: number; kind: 'standalone' } | { id: string; indices: number[]; kind: 'turn' }

interface FlowThreadProps {
  clampToComposer: boolean
  components: ThreadMessageComponents
  emptyPlaceholder?: ReactNode
  loadingIndicator?: ReactNode
  sessionKey?: string | null
}

function buildGroups(signature: string): MessageGroup[] {
  if (!signature) {
    return []
  }

  const messages = signature.split('\n').map(row => {
    const [index, id, role] = row.split(':')

    return { id, index: Number(index), role }
  })

  const groups: MessageGroup[] = []

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]

    if (message.role !== 'user') {
      groups.push({ id: message.id, index: message.index, kind: 'standalone' })

      continue
    }

    const indices = [message.index]

    while (i + 1 < messages.length && messages[i + 1].role !== 'user') {
      indices.push(messages[++i].index)
    }

    groups.push({ id: message.id, indices, kind: 'turn' })
  }

  return groups
}

function distanceFromBottom(el: HTMLDivElement): number {
  return el.scrollHeight - el.clientHeight - el.scrollTop
}

function scrollElementToBottom(el: HTMLDivElement) {
  el.scrollTop = el.scrollHeight
}

const FlowThreadInner: FC<FlowThreadProps> = ({
  clampToComposer,
  components,
  emptyPlaceholder,
  loadingIndicator,
  sessionKey
}) => {
  const messageSignature = useAuiState(s =>
    s.thread.messages.map((message, index) => `${index}:${message.id}:${message.role}`).join('\n')
  )
  const isRunning = useAuiState(s => s.thread.isRunning)

  const groups = useMemo(() => buildGroups(messageSignature), [messageSignature])
  const renderEmpty = groups.length === 0 && Boolean(emptyPlaceholder)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)

  useFlowThreadScrollAnchor({
    contentRef,
    enabled: !renderEmpty,
    groupCount: groups.length + (loadingIndicator ? 1 : 0),
    isRunning,
    scrollerRef,
    sessionKey: sessionKey ?? null
  })

  return (
    <div
      className="relative min-h-0 max-w-full overflow-hidden contain-[layout_paint]"
      style={{ height: clampToComposer ? 'var(--thread-viewport-height)' : '100%' }}
    >
      <div
        className="size-full overflow-x-hidden overflow-y-auto overscroll-contain"
        data-slot="aui_thread-viewport"
        ref={scrollerRef}
      >
        {renderEmpty ? (
          <div
            className="mx-auto grid h-full w-full max-w-(--composer-width) grid-rows-[minmax(0,1fr)_auto] min-w-0 gap-(--conversation-turn-gap) px-6 py-8"
            data-slot="aui_thread-content"
            ref={contentRef}
          >
            {emptyPlaceholder}
          </div>
        ) : (
          <div
            className={cn(
              'mx-auto flex w-full max-w-(--composer-width) min-w-0 flex-col px-6 pt-[calc(var(--titlebar-height)+1.5rem)]'
            )}
            data-slot="aui_thread-content"
            ref={contentRef}
          >
            {groups.map(group => (
              <div
                className="flex min-w-0 flex-col gap-(--conversation-turn-gap) pb-(--conversation-turn-gap)"
                data-index={group.kind === 'turn' ? group.indices[0] : group.index}
                key={group.id}
              >
                {group.kind === 'turn' ? (
                  <div
                    className="composer-human-ai-pair-container relative flex min-w-0 flex-col gap-(--conversation-turn-gap)"
                    data-slot="aui_turn-pair"
                  >
                    {group.indices.map(index => (
                      <ThreadPrimitive.MessageByIndex components={components} index={index} key={index} />
                    ))}
                  </div>
                ) : (
                  <ThreadPrimitive.MessageByIndex components={components} index={group.index} />
                )}
              </div>
            ))}
            {loadingIndicator}
            {clampToComposer && (
              <div
                aria-hidden="true"
                className="shrink-0"
                data-slot="aui_composer-clearance"
                style={{ height: 'var(--thread-last-message-clearance)' }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export const FlowThread = memo(FlowThreadInner)

interface ScrollAnchorOptions {
  contentRef: React.RefObject<HTMLDivElement | null>
  enabled: boolean
  groupCount: number
  isRunning: boolean
  scrollerRef: React.RefObject<HTMLDivElement | null>
  sessionKey: string | null
}

function useFlowThreadScrollAnchor({
  contentRef,
  enabled,
  groupCount,
  isRunning,
  scrollerRef,
  sessionKey
}: ScrollAnchorOptions) {
  const pinnedRef = useRef(true)
  const prevGroupCountRef = useRef(0)
  const prevSessionKeyRef = useRef(sessionKey)
  const prevIsRunningRef = useRef(isRunning)
  const rafRef = useRef<number | null>(null)

  const updateScrolledUp = useCallback((el: HTMLDivElement) => {
    const atBottom = distanceFromBottom(el) <= AT_BOTTOM_THRESHOLD
    pinnedRef.current = atBottom
    setThreadScrolledUp(!atBottom)
  }, [])

  const pinToBottom = useCallback(() => {
    const el = scrollerRef.current

    if (!el) {
      return
    }

    scrollElementToBottom(el)
    pinnedRef.current = true
    setThreadScrolledUp(false)
  }, [scrollerRef])

  const schedulePinToBottom = useCallback(() => {
    if (rafRef.current !== null) {
      return
    }

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null

      if (pinnedRef.current) {
        pinToBottom()
      }
    })
  }, [pinToBottom])

  useEffect(() => {
    return () => {
      setThreadScrolledUp(false)

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const el = scrollerRef.current

    if (!el) {
      return undefined
    }

    const onScroll = () => updateScrolledUp(el)
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) {
        pinnedRef.current = false
      }
    }
    const onTouchMove = () => {
      pinnedRef.current = false
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    updateScrolledUp(el)

    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchmove', onTouchMove)
    }
  }, [scrollerRef, updateScrolledUp])

  useLayoutEffect(() => {
    const sessionChanged = prevSessionKeyRef.current !== sessionKey
    const becameNonEmpty = prevGroupCountRef.current === 0 && groupCount > 0
    const groupAppended = groupCount > prevGroupCountRef.current

    prevSessionKeyRef.current = sessionKey
    prevGroupCountRef.current = groupCount

    if (!enabled) {
      return
    }

    if (sessionChanged || becameNonEmpty) {
      pinToBottom()

      return
    }

    if (groupAppended && pinnedRef.current) {
      pinToBottom()
    }
  }, [enabled, groupCount, pinToBottom, sessionKey])

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    const content = contentRef.current

    if (!content) {
      return undefined
    }

    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) {
        schedulePinToBottom()
      }
    })

    observer.observe(content)

    return () => observer.disconnect()
  }, [contentRef, enabled, schedulePinToBottom])

  useLayoutEffect(() => {
    const finishedRun = prevIsRunningRef.current && !isRunning
    prevIsRunningRef.current = isRunning

    if (!enabled || !finishedRun || !pinnedRef.current) {
      return undefined
    }

    const lockUntil = performance.now() + POST_RUN_BOTTOM_LOCK_MS
    let lockRaf: number | null = null

    const lockFrame = () => {
      lockRaf = null

      if (!pinnedRef.current) {
        return
      }

      pinToBottom()

      if (performance.now() < lockUntil) {
        lockRaf = requestAnimationFrame(lockFrame)
      }
    }

    pinToBottom()
    lockRaf = requestAnimationFrame(lockFrame)

    return () => {
      if (lockRaf !== null) {
        cancelAnimationFrame(lockRaf)
      }
    }
  }, [enabled, isRunning, pinToBottom])

  useAuiEvent('thread.runStart', pinToBottom)
}
