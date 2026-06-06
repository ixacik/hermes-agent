import { cleanup, render, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  $composerAttachments,
  clearComposerAttachments,
  hasBlockedComposerImageUploads
} from '@/store/composer'

import { useComposerActions } from './use-composer-actions'

function setHermesDesktop(overrides: Partial<Window['hermesDesktop']>) {
  Object.defineProperty(window, 'hermesDesktop', {
    configurable: true,
    value: overrides
  })
}

function clearHermesDesktop() {
  Reflect.deleteProperty(window, 'hermesDesktop')
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, reject, resolve }
}

interface HarnessHandle {
  attachImagePath: (filePath: string) => Promise<boolean>
}

function Harness({
  onReady,
  requestGateway
}: {
  onReady: (handle: HarnessHandle) => void
  requestGateway: <T>(method: string, params?: Record<string, unknown>) => Promise<T>
}) {
  const actions = useComposerActions({
    activeSessionId: null,
    currentCwd: '/Users/test/project',
    requestGateway
  })

  useEffect(() => {
    onReady({ attachImagePath: actions.attachImagePath })
  }, [actions.attachImagePath, onReady])

  return null
}

describe('useComposerActions image upload', () => {
  beforeEach(() => {
    clearComposerAttachments()
  })

  afterEach(() => {
    cleanup()
    clearComposerAttachments()
    clearHermesDesktop()
    vi.restoreAllMocks()
  })

  it('starts uploading image bytes as soon as an image enters the composer', async () => {
    const sourcePath = '/Users/test/Library/Application Support/Hermes/composer-images/shot 1.png'
    const dataUrl = `data:image/png;base64,${'A'.repeat(96)}`
    const firstShell = deferred<{ code: number; stderr: string; stdout: string }>()
    let shellCount = 0

    const requestGateway = vi.fn(async (method: string) => {
      if (method === 'shell.exec') {
        shellCount += 1

        if (shellCount === 1) {
          return (await firstShell.promise) as never
        }

        return { code: 0, stderr: '', stdout: '' } as never
      }

      return {} as never
    })

    setHermesDesktop({
      readFileDataUrl: vi.fn(async () => dataUrl)
    } as Partial<Window['hermesDesktop']>)

    let handle: HarnessHandle | null = null
    render(<Harness onReady={h => (handle = h)} requestGateway={requestGateway} />)

    const attachPromise = handle!.attachImagePath(sourcePath)
    let attachment = $composerAttachments.get()[0]

    expect(attachment).toMatchObject({
      kind: 'image',
      localPath: sourcePath,
      path: sourcePath,
      uploadProgress: 0,
      uploadStatus: 'uploading'
    })
    expect(hasBlockedComposerImageUploads($composerAttachments.get())).toBe(true)

    await waitFor(() => expect(requestGateway).toHaveBeenCalledWith('shell.exec', expect.anything()))
    attachment = $composerAttachments.get()[0]!
    expect(attachment.previewUrl).toBe(dataUrl)
    expect(attachment.uploadStatus).toBe('uploading')

    firstShell.resolve({ code: 0, stderr: '', stdout: '' })
    await attachPromise

    await waitFor(() => expect($composerAttachments.get()[0]?.uploadStatus).toBe('uploaded'))
    attachment = $composerAttachments.get()[0]!
    expect(attachment.remotePath).toMatch(/^\/tmp\/hermes-desktop-uploads\/shot_1_[A-Za-z0-9_]+\.png$/)
    expect(attachment.path).toBe(attachment.remotePath)
    expect(attachment.localPath).toBe(sourcePath)
    expect(attachment.uploadProgress).toBe(1)
    expect(hasBlockedComposerImageUploads($composerAttachments.get())).toBe(false)
  })

  it('marks the composer image as blocked when the remote upload fails', async () => {
    const sourcePath = '/Users/test/Desktop/shot.png'
    const dataUrl = `data:image/png;base64,${'B'.repeat(96)}`

    const requestGateway = vi.fn(async (method: string) => {
      if (method === 'shell.exec') {
        return { code: 1, stderr: 'disk full', stdout: '' } as never
      }

      return {} as never
    })

    setHermesDesktop({
      readFileDataUrl: vi.fn(async () => dataUrl)
    } as Partial<Window['hermesDesktop']>)

    let handle: HarnessHandle | null = null
    render(<Harness onReady={h => (handle = h)} requestGateway={requestGateway} />)

    await handle!.attachImagePath(sourcePath)

    await waitFor(() => expect($composerAttachments.get()[0]?.uploadStatus).toBe('error'))
    expect($composerAttachments.get()[0]?.uploadError).toContain('disk full')
    expect(hasBlockedComposerImageUploads($composerAttachments.get())).toBe(true)
  })
})
