import type { QueryClient } from '@tanstack/react-query'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { type MutableRefObject, useCallback, useEffect, useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { assistantTextPart, textPart } from '@/lib/chat-messages'
import { createClientSessionState } from '@/lib/chat-runtime'
import { flushLiveSessionCache, persistLiveSessionState } from '@/lib/live-session-cache'
import { $sessions, $turnStartedAt, $workingSessionIds } from '@/store/session'
import type { RpcEvent } from '@/types/hermes'

import type { ClientSessionState } from '../../types'
import { useMessageStream } from './use-message-stream'

interface HarnessHandle {
  event: (event: RpcEvent) => void
  state: (sessionId: string) => ClientSessionState | undefined
}

function Harness({
  activeList = { sessions: [] },
  onReady
}: {
  activeList?: unknown
  onReady: (handle: HarnessHandle) => void
}) {
  const activeSessionIdRef = useRef<string | null>('active-runtime')
  const statesRef = useRef(new Map<string, ClientSessionState>())

  useEffect(() => {
    statesRef.current.set('background-runtime', {
      ...createClientSessionState('stored-background'),
      awaitingResponse: true,
      busy: true,
      pendingBranchGroup: 'branch-background',
      streamId: 'assistant-background'
    })
  }, [])

  const updateSessionState = useCallback(
    (
      sessionId: string,
      updater: (state: ClientSessionState) => ClientSessionState,
      storedSessionId?: string | null
    ) => {
      const previous = statesRef.current.get(sessionId) ?? createClientSessionState(storedSessionId ?? null)
      const next = updater(previous)
      statesRef.current.set(sessionId, next)

      return next
    },
    []
  )
  const requestGateway = useCallback(async <T,>() => activeList as T, [activeList])

  const stream = useMessageStream({
    activeSessionIdRef: activeSessionIdRef as MutableRefObject<string | null>,
    hydrateFromStoredSession: vi.fn(async () => undefined),
    queryClient: {} as QueryClient,
    refreshHermesConfig: vi.fn(async () => undefined),
    refreshSessions: vi.fn(async () => undefined),
    requestGateway,
    updateSessionState
  })

  useEffect(() => {
    onReady({
      event: stream.handleGatewayEvent,
      state: sessionId => statesRef.current.get(sessionId)
    })
  }, [onReady, stream.handleGatewayEvent])

  return null
}

describe('useMessageStream session lifecycle', () => {
  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    $sessions.set([])
    $turnStartedAt.set(null)
    $workingSessionIds.set([])
  })

  it('applies server idle state for a non-active session', () => {
    let handle: HarnessHandle | null = null

    render(<Harness onReady={next => (handle = next)} />)

    act(() => {
      handle!.event({
        payload: { running: false },
        session_id: 'background-runtime',
        type: 'session.info'
      })
    })

    expect(handle!.state('background-runtime')).toMatchObject({
      awaitingResponse: false,
      busy: false,
      interrupted: false,
      pendingBranchGroup: null,
      streamId: null
    })
  })

  it('hydrates a live active session from the desktop cache on gateway ready', async () => {
    const turnStartedAt = Date.now() - 123_000
    const cached = {
      ...createClientSessionState('stored-live', [
        {
          id: 'user-live',
          role: 'user' as const,
          parts: [textPart('cached prompt')]
        },
        {
          id: 'assistant-live',
          role: 'assistant' as const,
          parts: [assistantTextPart('cached partial with tool state')],
          pending: true
        }
      ]),
      awaitingResponse: false,
      busy: true,
      sawAssistantPayload: true,
      streamId: 'assistant-live'
    }

    persistLiveSessionState('active-runtime', cached, turnStartedAt)
    flushLiveSessionCache()

    let handle: HarnessHandle | null = null

    render(
      <Harness
        activeList={{
          sessions: [
            {
              id: 'active-runtime',
              inflight: { assistant: 'server fallback', user: 'cached prompt' },
              last_active: 20,
              message_count: 0,
              model: 'model-live',
              preview: 'cached prompt',
              running: true,
              session_key: 'stored-live',
              started_at: 10,
              status: 'working',
              title: 'Live session'
            }
          ]
        }}
        onReady={next => (handle = next)}
      />
    )

    act(() => {
      handle!.event({
        payload: {},
        session_id: '',
        type: 'gateway.ready'
      })
    })

    await waitFor(() => {
      expect(handle!.state('active-runtime')?.messages).toEqual(cached.messages)
    })

    expect(handle!.state('active-runtime')).toMatchObject({
      awaitingResponse: false,
      busy: true,
      sawAssistantPayload: true,
      streamId: 'assistant-live'
    })
    expect($turnStartedAt.get()).toBe(turnStartedAt)
    expect($workingSessionIds.get()).toEqual(['stored-live'])
    expect($sessions.get()[0]).toMatchObject({
      id: 'stored-live',
      is_active: false,
      model: 'model-live',
      preview: 'cached prompt',
      title: 'Live session'
    })
  })
})
