export interface ShellExecResponse {
  code?: number
  stderr?: string
  stdout?: string
}

export type DesktopGatewayRequester = <T>(method: string, params?: Record<string, unknown>) => Promise<T>

export interface UploadDataImageOptions {
  dataUrl: string
  label: string
  onProgress?: (progress: number) => void
  requestGateway: DesktopGatewayRequester
}

export const REMOTE_IMAGE_UPLOAD_DIR = '/tmp/hermes-desktop-uploads'
export const REMOTE_IMAGE_UPLOAD_CHUNK_SIZE = 8 * 1024

export function isDataImageUrl(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(value)
}

function dataImageBase64(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/[a-z0-9.+-]+;base64,([\s\S]+)$/i)

  if (!match) {
    throw new Error('Image attachment is not a base64 image data URL')
  }

  return match[1].replace(/\s+/g, '')
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function remoteImageExtension(label: string, dataUrl: string): string {
  const subtype = dataUrl.match(/^data:image\/([a-z0-9.+-]+);base64,/i)?.[1]?.toLowerCase()

  const mimeExt =
    subtype === 'jpeg' || subtype === 'pjpeg'
      ? '.jpg'
      : subtype && /^[a-z0-9]{1,8}$/.test(subtype)
        ? `.${subtype}`
        : ''

  if (mimeExt) {
    return mimeExt
  }

  const labelExt = label.match(/\.([A-Za-z0-9]{1,8})$/)?.[1]?.toLowerCase()

  return labelExt ? `.${labelExt}` : '.png'
}

function remoteImagePath(label: string, dataUrl: string): string {
  const ext = remoteImageExtension(label, dataUrl)

  const stem =
    (label || 'image')
      .replace(/\.[A-Za-z0-9]{1,8}$/, '')
      .replace(/[^A-Za-z0-9_.-]+/g, '_')
      .replace(/^[._-]+|[._-]+$/g, '')
      .slice(0, 64) || 'image'

  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14)

  return `${REMOTE_IMAGE_UPLOAD_DIR}/${stem}_${Date.now().toString(36)}_${random}${ext}`
}

function reportProgress(onProgress: UploadDataImageOptions['onProgress'], value: number) {
  onProgress?.(Math.max(0, Math.min(1, value)))
}

async function runUploadShellCommand(requestGateway: DesktopGatewayRequester, command: string, label: string) {
  const result = await requestGateway<ShellExecResponse>('shell.exec', { command })

  if (Number(result.code || 0) !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').trim()

    throw new Error(detail || `Could not upload ${label} to the remote server`)
  }

  return result
}

export async function uploadDataImageWithRemoteShell({
  dataUrl,
  label,
  onProgress,
  requestGateway
}: UploadDataImageOptions): Promise<string> {
  const base64 = dataImageBase64(dataUrl)
  const remotePath = remoteImagePath(label, dataUrl)
  const b64Path = `${remotePath}.b64`

  reportProgress(onProgress, 0)

  await runUploadShellCommand(
    requestGateway,
    [
      `python3 - ${shellQuote(b64Path)} <<'PY'`,
      'import pathlib, sys',
      'path = pathlib.Path(sys.argv[1])',
      'path.parent.mkdir(parents=True, exist_ok=True)',
      'path.write_text("", encoding="ascii")',
      'PY'
    ].join('\n'),
    label
  )
  reportProgress(onProgress, 0.05)

  for (let index = 0; index < base64.length; index += REMOTE_IMAGE_UPLOAD_CHUNK_SIZE) {
    const chunk = base64.slice(index, index + REMOTE_IMAGE_UPLOAD_CHUNK_SIZE)

    await runUploadShellCommand(
      requestGateway,
      [
        `python3 - ${shellQuote(b64Path)} <<'PY'`,
        'import pathlib, sys',
        'path = pathlib.Path(sys.argv[1])',
        'with path.open("a", encoding="ascii") as fh:',
        `    fh.write(${JSON.stringify(chunk)})`,
        'PY'
      ].join('\n'),
      label
    )
    reportProgress(onProgress, 0.05 + 0.85 * Math.min(1, (index + chunk.length) / Math.max(base64.length, 1)))
  }

  await runUploadShellCommand(
    requestGateway,
    [
      `python3 - ${shellQuote(b64Path)} ${shellQuote(remotePath)} <<'PY'`,
      'import base64, pathlib, sys',
      'src = pathlib.Path(sys.argv[1])',
      'dst = pathlib.Path(sys.argv[2])',
      'dst.write_bytes(base64.b64decode(src.read_text(encoding="ascii"), validate=True))',
      'src.unlink(missing_ok=True)',
      'print(str(dst))',
      'PY'
    ].join('\n'),
    label
  )
  reportProgress(onProgress, 1)

  return remotePath
}
