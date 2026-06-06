import { cleanup, render } from '@testing-library/react'
import type { MutableRefObject } from 'react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $composerAttachments, clearComposerAttachments } from '@/store/composer'
import { $sessions, setSessions } from '@/store/session'
import type { SessionInfo } from '@/types/hermes'

import { usePromptActions } from './use-prompt-actions'

vi.mock('@/hermes', () => ({
  setApiRequestProfile: vi.fn(),
  transcribeAudio: vi.fn()
}))

// The active id the desktop holds is the *runtime* session id from
// session.create — deliberately distinct from the stored DB id here, because
// that mismatch is the bug: the REST renameSession endpoint resolves against
// the stored sessions table and 404s on a runtime id. session.title accepts
// the runtime id directly.
const RUNTIME_SESSION_ID = 'rt-abc123'

function sessionInfo(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    ended_at: null,
    id: RUNTIME_SESSION_ID,
    input_tokens: 0,
    is_active: true,
    last_active: 0,
    message_count: 3,
    model: null,
    output_tokens: 0,
    preview: null,
    source: null,
    started_at: 0,
    title: 'Old title',
    tool_call_count: 0,
    ...overrides
  }
}

function setHermesDesktop(overrides: Partial<Window['hermesDesktop']>) {
  Object.defineProperty(window, 'hermesDesktop', {
    configurable: true,
    value: overrides
  })
}

function clearHermesDesktop() {
  Reflect.deleteProperty(window, 'hermesDesktop')
}

interface HarnessHandle {
  submitText: (text: string) => Promise<boolean>
}

function Harness({
  onReady,
  refreshSessions,
  requestGateway
}: {
  onReady: (handle: HarnessHandle) => void
  refreshSessions: () => Promise<void>
  requestGateway: <T>(method: string, params?: Record<string, unknown>) => Promise<T>
}) {
  const activeSessionIdRef: MutableRefObject<string | null> = { current: RUNTIME_SESSION_ID }
  const selectedStoredSessionIdRef: MutableRefObject<string | null> = { current: RUNTIME_SESSION_ID }
  const busyRef = { current: false }

  const actions = usePromptActions({
    activeSessionId: RUNTIME_SESSION_ID,
    activeSessionIdRef,
    branchCurrentSession: async () => true,
    busyRef,
    createBackendSessionForSend: async () => RUNTIME_SESSION_ID,
    refreshSessions,
    requestGateway,
    selectedStoredSessionIdRef,
    startFreshSessionDraft: () => undefined,
    sttEnabled: false,
    updateSessionState: (_sessionId, updater) =>
      updater({ messages: [], busy: false, awaitingResponse: false } as never)
  })

  useEffect(() => {
    onReady({ submitText: actions.submitText })
  }, [actions.submitText, onReady])

  return null
}

describe('usePromptActions /title', () => {
  beforeEach(() => {
    setSessions(() => [sessionInfo()])
  })

  afterEach(() => {
    cleanup()
    clearComposerAttachments()
    clearHermesDesktop()
    vi.restoreAllMocks()
  })

  it('renames via the session.title RPC (with the runtime id), updates the sidebar store, and refreshes', async () => {
    const refreshSessions = vi.fn(async () => undefined)

    const requestGateway = vi.fn(async (method: string) =>
      (method === 'session.title' ? { pending: false, title: 'New title' } : {}) as never
    )

    let handle: HarnessHandle | null = null
    render(<Harness onReady={h => (handle = h)} refreshSessions={refreshSessions} requestGateway={requestGateway} />)

    await handle!.submitText('/title New title')

    // Routes through session.title with the runtime session id — NOT the slash
    // worker (slash.exec) and NOT the REST endpoint. This is the path that
    // resolves the runtime id and persists reliably across platforms.
    expect(requestGateway).toHaveBeenCalledWith('session.title', {
      session_id: RUNTIME_SESSION_ID,
      title: 'New title'
    })
    expect(requestGateway).not.toHaveBeenCalledWith('slash.exec', expect.anything())
    expect(refreshSessions).toHaveBeenCalledTimes(1)
    expect($sessions.get()[0]?.title).toBe('New title')
  })

  it('reports the queued state when the session row is not persisted yet', async () => {
    const refreshSessions = vi.fn(async () => undefined)

    const requestGateway = vi.fn(async (method: string) =>
      (method === 'session.title' ? { pending: true, title: 'Fresh chat' } : {}) as never
    )

    let handle: HarnessHandle | null = null
    render(<Harness onReady={h => (handle = h)} refreshSessions={refreshSessions} requestGateway={requestGateway} />)

    await handle!.submitText('/title Fresh chat')

    expect(requestGateway).toHaveBeenCalledWith('session.title', {
      session_id: RUNTIME_SESSION_ID,
      title: 'Fresh chat'
    })
    // Even when queued, the sidebar reflects the chosen title optimistically.
    expect(refreshSessions).toHaveBeenCalledTimes(1)
    expect($sessions.get()[0]?.title).toBe('Fresh chat')
  })

  it('falls through to the slash worker for a bare /title (show current title)', async () => {
    const refreshSessions = vi.fn(async () => undefined)
    const requestGateway = vi.fn(async () => ({ output: 'Title: Old title' }) as never)

    let handle: HarnessHandle | null = null
    render(<Harness onReady={h => (handle = h)} refreshSessions={refreshSessions} requestGateway={requestGateway} />)

    await handle!.submitText('/title')

    expect(requestGateway).not.toHaveBeenCalledWith('session.title', expect.anything())
    expect(requestGateway).toHaveBeenCalledWith('slash.exec', expect.objectContaining({ command: 'title' }))
  })

  it('surfaces a rename error without touching the sidebar store', async () => {
    const refreshSessions = vi.fn(async () => undefined)

    const requestGateway = vi.fn(async (method: string) => {
      if (method === 'session.title') {
        throw new Error('Title too long')
      }

      return {} as never
    })

    let handle: HarnessHandle | null = null
    render(<Harness onReady={h => (handle = h)} refreshSessions={refreshSessions} requestGateway={requestGateway} />)

    await handle!.submitText('/title way too long title')

    expect(requestGateway).toHaveBeenCalledWith('session.title', expect.objectContaining({ title: 'way too long title' }))
    expect(refreshSessions).not.toHaveBeenCalled()
    expect($sessions.get()[0]?.title).toBe('Old title')
  })
})

describe('usePromptActions image attachments', () => {
  beforeEach(() => {
    setSessions(() => [sessionInfo()])
    clearComposerAttachments()
  })

  afterEach(() => {
    cleanup()
    clearComposerAttachments()
    clearHermesDesktop()
    vi.restoreAllMocks()
  })

  it('sends the full image detail path when the stored path was shortened at a space', async () => {
    const fullPath = '/Users/test/.hermes/composer-images/shot 1.png'
    const truncatedPath = '/Users/test/Library/Application'
    const refreshSessions = vi.fn(async () => undefined)

    const requestGateway = vi.fn(async (method: string, params?: Record<string, unknown>) => {
      if (method === 'image.attach') {
        return {
          attached: true,
          path: params?.path,
          count: 1
        } as never
      }

      return { status: 'streaming' } as never
    })

    $composerAttachments.set([
      {
        id: 'image:shot',
        kind: 'image',
        label: 'shot 1.png',
        detail: fullPath,
        path: truncatedPath
      }
    ])

    let handle: HarnessHandle | null = null
    render(<Harness onReady={h => (handle = h)} refreshSessions={refreshSessions} requestGateway={requestGateway} />)

    await handle!.submitText('can you see this')

    expect(requestGateway).toHaveBeenCalledWith('image.attach', {
      session_id: RUNTIME_SESSION_ID,
      path: fullPath
    })
    expect(requestGateway).toHaveBeenCalledWith('prompt.submit', {
      session_id: RUNTIME_SESSION_ID,
      text: 'can you see this'
    })
  })

  it('uploads image bytes to remote tmp through shell.exec before image.attach', async () => {
    const sourcePath = '/Users/test/Library/Application Support/Hermes/composer-images/shot.png'
    const dataUrl = `data:image/png;base64,${'A'.repeat(96)}`
    const refreshSessions = vi.fn(async () => undefined)

    const requestGateway = vi.fn(async (method: string, params?: Record<string, unknown>) => {
      if (method === 'shell.exec') {
        return { code: 0, stderr: '', stdout: '' } as never
      }

      if (method === 'image.attach') {
        return { attached: true, path: params?.path } as never
      }

      return { status: 'streaming' } as never
    })

    $composerAttachments.set([
      {
        id: 'image:pasted',
        kind: 'image',
        label: 'shot.png',
        path: sourcePath,
        previewUrl: dataUrl
      }
    ])

    let handle: HarnessHandle | null = null
    render(<Harness onReady={h => (handle = h)} refreshSessions={refreshSessions} requestGateway={requestGateway} />)

    await handle!.submitText('can you read this')

    const shellCommands = requestGateway.mock.calls
      .filter(([method]) => method === 'shell.exec')
      .map(([, params]) => String(params?.command || ''))

    const attachCall = requestGateway.mock.calls.find(([method]) => method === 'image.attach')
    const attachPath = (attachCall?.[1] as { path?: string } | undefined)?.path || ''

    expect(shellCommands.length).toBeGreaterThanOrEqual(3)
    expect(shellCommands[0]).toContain('path.write_text("", encoding="ascii")')
    expect(shellCommands.some(command => command.includes('fh.write('))).toBe(true)
    expect(shellCommands.at(-1)).toContain('base64.b64decode')
    expect(attachPath).toMatch(/^\/tmp\/hermes-desktop-uploads\/shot_[A-Za-z0-9_]+\.png$/)
    expect(requestGateway).not.toHaveBeenCalledWith('image.attach_data', expect.anything())
    expect(requestGateway).toHaveBeenCalledWith('prompt.submit', {
      session_id: RUNTIME_SESSION_ID,
      text: 'can you read this'
    })
  })

  it('keeps remote upload shell commands below argv limits for large images', async () => {
    const dataUrl = `data:image/png;base64,${'A'.repeat(40_000)}`
    const refreshSessions = vi.fn(async () => undefined)

    const requestGateway = vi.fn(async (method: string, params?: Record<string, unknown>) => {
      if (method === 'shell.exec') {
        return { code: 0, stderr: '', stdout: '' } as never
      }

      if (method === 'image.attach') {
        return { attached: true, path: params?.path } as never
      }

      return { status: 'streaming' } as never
    })

    $composerAttachments.set([
      {
        id: 'image:pasted',
        kind: 'image',
        label: 'large-shot.png',
        previewUrl: dataUrl
      }
    ])

    let handle: HarnessHandle | null = null
    render(<Harness onReady={h => (handle = h)} refreshSessions={refreshSessions} requestGateway={requestGateway} />)

    await handle!.submitText('can you read this')

    const shellCommands = requestGateway.mock.calls
      .filter(([method]) => method === 'shell.exec')
      .map(([, params]) => String(params?.command || ''))

    expect(shellCommands.length).toBeGreaterThan(3)
    expect(Math.max(...shellCommands.map(command => command.length))).toBeLessThan(12_000)
    expect(requestGateway).toHaveBeenCalledWith('prompt.submit', {
      session_id: RUNTIME_SESSION_ID,
      text: 'can you read this'
    })
  })

  it('reads local image bytes when the composer attachment has no preview data URL', async () => {
    const sourcePath = '/Users/test/Library/Application Support/Hermes/composer-images/shot.png'
    const dataUrl = `data:image/png;base64,${'B'.repeat(96)}`
    const readFileDataUrl = vi.fn(async () => dataUrl)
    const refreshSessions = vi.fn(async () => undefined)

    const requestGateway = vi.fn(async (method: string, params?: Record<string, unknown>) => {
      if (method === 'shell.exec') {
        return { code: 0, stderr: '', stdout: '' } as never
      }

      if (method === 'image.attach') {
        return { attached: true, path: params?.path } as never
      }

      return { status: 'streaming' } as never
    })

    setHermesDesktop({ readFileDataUrl } as Partial<Window['hermesDesktop']>)
    $composerAttachments.set([
      {
        id: 'image:pasted',
        kind: 'image',
        label: 'shot.png',
        path: sourcePath
      }
    ])

    let handle: HarnessHandle | null = null
    render(<Harness onReady={h => (handle = h)} refreshSessions={refreshSessions} requestGateway={requestGateway} />)

    await handle!.submitText('can you see this?')

    expect(readFileDataUrl).toHaveBeenCalledWith(sourcePath)
    expect(requestGateway).toHaveBeenCalledWith('image.attach', {
      session_id: RUNTIME_SESSION_ID,
      path: expect.stringMatching(/^\/tmp\/hermes-desktop-uploads\/shot_[A-Za-z0-9_]+\.png$/)
    })
    expect(requestGateway).toHaveBeenCalledWith('prompt.submit', {
      session_id: RUNTIME_SESSION_ID,
      text: 'can you see this?'
    })
  })

  it('does not probe the remote clipboard when remote tmp upload fails', async () => {
    const dataUrl = `data:image/png;base64,${'A'.repeat(96)}`
    const refreshSessions = vi.fn(async () => undefined)

    const requestGateway = vi.fn(async (method: string) => {
      if (method === 'shell.exec') {
        return { code: 1, stderr: 'disk full', stdout: '' } as never
      }

      return { attached: true, path: '/Users/test/.hermes/images/clip.png' } as never
    })

    $composerAttachments.set([
      {
        id: 'image:pasted',
        kind: 'image',
        label: 'shot.png',
        path: '/Users/test/Library/Application',
        previewUrl: dataUrl
      }
    ])

    let handle: HarnessHandle | null = null
    render(<Harness onReady={h => (handle = h)} refreshSessions={refreshSessions} requestGateway={requestGateway} />)

    await handle!.submitText('can you see this screenshot?')

    expect(requestGateway).toHaveBeenCalledWith('shell.exec', expect.anything())
    expect(requestGateway).not.toHaveBeenCalledWith('clipboard.paste', expect.anything())
    expect(requestGateway).not.toHaveBeenCalledWith('prompt.submit', expect.anything())
  })

  it('does not submit while a composer image upload is still pending', async () => {
    const refreshSessions = vi.fn(async () => undefined)
    const requestGateway = vi.fn(async () => ({ status: 'streaming' }) as never)

    $composerAttachments.set([
      {
        id: 'image:pasted',
        kind: 'image',
        label: 'shot.png',
        path: '/Users/test/Desktop/shot.png',
        uploadStatus: 'uploading'
      }
    ])

    let handle: HarnessHandle | null = null
    render(<Harness onReady={h => (handle = h)} refreshSessions={refreshSessions} requestGateway={requestGateway} />)

    await handle!.submitText('can you see this screenshot?')

    expect(requestGateway).not.toHaveBeenCalledWith('image.attach', expect.anything())
    expect(requestGateway).not.toHaveBeenCalledWith('prompt.submit', expect.anything())
  })
})
