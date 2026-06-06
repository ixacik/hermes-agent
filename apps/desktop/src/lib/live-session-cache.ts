import type { ClientSessionState } from '@/app/types'
import type { ChatMessage } from '@/lib/chat-messages'

const CACHE_KEY = 'hermes.desktop.live-sessions.v1'
const MAX_LIVE_SESSION_AGE_MS = 12 * 60 * 60 * 1000
const MAX_LIVE_SESSIONS = 8
const WRITE_DELAY_MS = 250

interface PersistedLiveSessionsFile {
  sessions: PersistedLiveSession[]
  version: 1
}

export interface PersistedLiveSession {
  awaitingResponse: boolean
  branch: string
  busy: boolean
  cwd: string
  messages: ChatMessage[]
  needsInput: boolean
  pendingBranchGroup: null | string
  runtimeSessionId: string
  sawAssistantPayload: boolean
  storedSessionId: null | string
  streamId: null | string
  turnStartedAt: null | number
  updatedAt: number
}

const pendingWrites = new Map<string, PersistedLiveSession | null>()
let flushTimer: null | number = null
let unloadListenerInstalled = false

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function cacheKey(runtimeSessionId: string, storedSessionId: null | string): string {
  return storedSessionId || runtimeSessionId
}

function readFile(): PersistedLiveSessionsFile {
  const store = storage()

  if (!store) {
    return { sessions: [], version: 1 }
  }

  try {
    const parsed = JSON.parse(store.getItem(CACHE_KEY) || '')

    if (parsed?.version === 1 && Array.isArray(parsed.sessions)) {
      return { sessions: parsed.sessions, version: 1 }
    }
  } catch {
    // Corrupt local cache should not affect chat startup.
  }

  return { sessions: [], version: 1 }
}

function writeFile(file: PersistedLiveSessionsFile) {
  const store = storage()

  if (!store) {
    return
  }

  const cutoff = Date.now() - MAX_LIVE_SESSION_AGE_MS
  const sessions = file.sessions
    .filter(session => session.updatedAt >= cutoff)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_LIVE_SESSIONS)

  try {
    if (sessions.length) {
      store.setItem(CACHE_KEY, JSON.stringify({ sessions, version: 1 }))
    } else {
      store.removeItem(CACHE_KEY)
    }
  } catch {
    // Best-effort recovery cache. Quota failures should not break the app.
  }
}

function installUnloadListener() {
  if (unloadListenerInstalled || typeof window === 'undefined') {
    return
  }

  unloadListenerInstalled = true
  window.addEventListener('beforeunload', flushLiveSessionCache)
}

export function flushLiveSessionCache() {
  if (flushTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(flushTimer)
    flushTimer = null
  }

  if (pendingWrites.size === 0) {
    return
  }

  const file = readFile()
  const byKey = new Map(file.sessions.map(session => [cacheKey(session.runtimeSessionId, session.storedSessionId), session]))

  for (const [key, value] of pendingWrites.entries()) {
    if (value) {
      byKey.set(key, value)
    } else {
      byKey.delete(key)
    }
  }

  pendingWrites.clear()
  writeFile({ sessions: [...byKey.values()], version: 1 })
}

function scheduleFlush() {
  installUnloadListener()

  if (flushTimer !== null || typeof window === 'undefined') {
    return
  }

  flushTimer = window.setTimeout(flushLiveSessionCache, WRITE_DELAY_MS)
}

export function persistLiveSessionState(runtimeSessionId: string, state: ClientSessionState, turnStartedAt: null | number) {
  const key = cacheKey(runtimeSessionId, state.storedSessionId)

  if (!state.busy && !state.needsInput) {
    pendingWrites.set(key, null)
    scheduleFlush()

    return
  }

  pendingWrites.set(key, {
    awaitingResponse: state.awaitingResponse,
    branch: state.branch,
    busy: state.busy,
    cwd: state.cwd,
    messages: state.messages,
    needsInput: state.needsInput,
    pendingBranchGroup: state.pendingBranchGroup,
    runtimeSessionId,
    sawAssistantPayload: state.sawAssistantPayload,
    storedSessionId: state.storedSessionId,
    streamId: state.streamId,
    turnStartedAt,
    updatedAt: Date.now()
  })
  scheduleFlush()
}

export function restoreLiveSessionState(runtimeSessionId?: null | string, storedSessionId?: null | string): null | PersistedLiveSession {
  flushLiveSessionCache()

  const file = readFile()
  const cutoff = Date.now() - MAX_LIVE_SESSION_AGE_MS

  return (
    file.sessions.find(session => {
      if (session.updatedAt < cutoff) {
        return false
      }

      return (
        (!!runtimeSessionId && session.runtimeSessionId === runtimeSessionId) ||
        (!!storedSessionId && session.storedSessionId === storedSessionId)
      )
    }) ?? null
  )
}

export function clearLiveSessionState(runtimeSessionId?: null | string, storedSessionId?: null | string) {
  const restored = restoreLiveSessionState(runtimeSessionId, storedSessionId)

  if (!restored) {
    return
  }

  pendingWrites.set(cacheKey(restored.runtimeSessionId, restored.storedSessionId), null)
  scheduleFlush()
}
