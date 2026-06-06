import type { QueryClient } from '@tanstack/react-query'
import { act, cleanup, render } from '@testing-library/react'
import { type MutableRefObject, useCallback, useEffect, useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createClientSessionState } from '@/lib/chat-runtime'
import type { RpcEvent } from '@/types/hermes'

import type { ClientSessionState } from '../../types'
import { useMessageStream } from './use-message-stream'

interface HarnessHandle {
  event: (event: RpcEvent) => void
  state: (sessionId: string) => ClientSessionState | undefined
}

function Harness({ onReady }: { onReady: (handle: HarnessHandle) => void }) {
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
  const requestGateway = useCallback(async <T,>() => ({ sessions: [] }) as T, [])

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
})
