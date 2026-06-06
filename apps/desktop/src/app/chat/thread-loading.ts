import type { ChatMessage } from '@/lib/chat-messages'

export type ThreadLoadingState = 'response' | 'session'

export function lastVisibleMessageIsUser(messages: ChatMessage[]): boolean {
  const lastVisible = [...messages].reverse().find(message => !message.hidden)

  return lastVisible?.role === 'user'
}

export function activeTurnRunningState(
  loadingSession: boolean,
  busy: boolean,
  selectedSessionId: null | string,
  workingSessionIds: readonly string[]
): boolean {
  if (!busy || loadingSession) {
    return false
  }

  // When a stored/routed conversation is being fetched for the first time,
  // `busy` only blocks input until session.resume returns. The server-confirmed
  // working set is the transcript display authority for those sessions.
  return selectedSessionId ? workingSessionIds.includes(selectedSessionId) : true
}

export function threadLoadingState(
  loadingSession: boolean,
  busy: boolean,
  awaitingResponse: boolean,
  lastVisibleIsUser: boolean
): ThreadLoadingState | undefined {
  if (loadingSession) {
    return 'session'
  }

  if (busy && awaitingResponse && lastVisibleIsUser) {
    return 'response'
  }

  return undefined
}
