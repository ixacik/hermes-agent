import { useEffect, useRef, useState } from 'react'

// Module-level registry so timers survive component unmount/remount (e.g.
// when a tool row scrolls out and back). Keyed by caller-supplied timerKey;
// anonymous timers (no key) start fresh each mount.
const startedAtByKey = new Map<string, number>()

function startedAt(key?: string, initialStartedAt?: number): number {
  const nextStartedAt =
    typeof initialStartedAt === 'number' && Number.isFinite(initialStartedAt) && initialStartedAt > 0
      ? initialStartedAt
      : Date.now()

  if (!key) {
    return nextStartedAt
  }

  const existing = startedAtByKey.get(key)

  if (existing !== undefined) {
    return existing
  }

  startedAtByKey.set(key, nextStartedAt)

  return nextStartedAt
}

export function formatElapsed(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function useElapsedSeconds(active = true, timerKey?: string, initialStartedAt?: number): number {
  const start = useRef(startedAt(timerKey, initialStartedAt))
  const lastKey = useRef(timerKey)
  const lastInitialStartedAt = useRef(initialStartedAt)
  const [elapsed, setElapsed] = useState(() => Math.max(0, Math.floor((Date.now() - start.current) / 1000)))

  if (lastKey.current !== timerKey || lastInitialStartedAt.current !== initialStartedAt) {
    start.current = startedAt(timerKey, initialStartedAt)
    lastKey.current = timerKey
    lastInitialStartedAt.current = initialStartedAt
  }

  useEffect(() => {
    if (!active) {
      return
    }

    if (timerKey) {
      start.current = startedAt(timerKey, initialStartedAt)
    }

    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start.current) / 1000)))
    tick()
    const id = window.setInterval(tick, 1000)

    return () => window.clearInterval(id)
  }, [active, initialStartedAt, timerKey])

  return elapsed
}

export function __resetElapsedTimerRegistryForTests() {
  startedAtByKey.clear()
}
