import { useStore } from '@nanostores/react'

import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'
import { AlertCircle, FileText, FolderOpen, ImageIcon, Link, Terminal } from '@/lib/icons'
import { normalizeOrLocalPreviewTarget } from '@/lib/local-preview'
import type { ComposerAttachment } from '@/store/composer'
import { notifyError } from '@/store/notifications'
import { setCurrentSessionPreviewTarget } from '@/store/preview'
import { $currentCwd } from '@/store/session'

export function AttachmentList({
  attachments,
  onRemove
}: {
  attachments: ComposerAttachment[]
  onRemove?: (id: string) => void
}) {
  return (
    <div className="flex max-w-full flex-wrap gap-1.5 px-1 pt-1" data-slot="composer-attachments">
      {attachments.map(attachment => (
        <AttachmentPill attachment={attachment} key={attachment.id} onRemove={onRemove} />
      ))}
    </div>
  )
}

function AttachmentPill({ attachment, onRemove }: { attachment: ComposerAttachment; onRemove?: (id: string) => void }) {
  const Icon = { folder: FolderOpen, url: Link, image: ImageIcon, file: FileText, terminal: Terminal }[attachment.kind]
  const cwd = useStore($currentCwd)
  const canPreview = attachment.kind !== 'folder' && attachment.kind !== 'terminal'
  const detail = attachment.detail && attachment.detail !== attachment.label ? attachment.detail : undefined

  const tipLabel =
    attachment.uploadStatus === 'error'
      ? attachment.uploadError || 'Image upload failed'
      : attachment.uploadStatus === 'uploading'
        ? 'Uploading image to server'
        : attachment.path || attachment.detail || attachment.label

  async function openPreview() {
    if (!canPreview) {
      return
    }

    const rawTarget =
      attachment.localPath ||
      attachment.path ||
      attachment.detail ||
      attachment.refText?.replace(/^@(file|image|url):/, '') ||
      attachment.label ||
      ''

    const target = rawTarget.replace(/^`|`$/g, '')

    if (!target) {
      return
    }

    try {
      const preview = await normalizeOrLocalPreviewTarget(target, cwd || undefined)

      if (!preview) {
        throw new Error(`Could not preview ${attachment.label}`)
      }

      setCurrentSessionPreviewTarget(preview, 'manual', target)
    } catch (error) {
      notifyError(error, 'Preview unavailable')
    }
  }

  return (
    <Tip label={tipLabel}>
      <div className="group/attachment relative min-w-0 shrink-0">
        <button
          aria-label={canPreview ? `Preview ${attachment.label}` : attachment.label}
          className="flex max-w-56 items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-colors hover:border-(--dt-ring) hover:bg-accent disabled:cursor-default"
          disabled={!canPreview}
          onClick={() => void openPreview()}
          type="button"
        >
          {attachment.previewUrl && attachment.kind === 'image' ? (
            <span className="relative size-8 shrink-0">
              <img
                alt={attachment.label}
                className="size-8 border border-border object-cover"
                draggable={false}
                src={attachment.previewUrl}
              />
              <ImageUploadBadge attachment={attachment} />
            </span>
          ) : (
            <span className="relative grid size-8 shrink-0 place-items-center border border-border bg-muted text-muted-foreground">
              <Icon className="size-3.5" />
              <ImageUploadBadge attachment={attachment} />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-[0.72rem] font-medium leading-4 text-(--ui-text-secondary)">
              {attachment.label}
            </span>
            {detail && (
              <span className="block truncate font-mono text-[0.6rem] leading-3 text-muted-foreground">
                {detail}
              </span>
            )}
          </span>
        </button>
        {onRemove && (
          <button
            aria-label={`Remove ${attachment.label}`}
            className="absolute -right-1 -top-1 grid size-3.5 place-items-center rounded-full border border-border bg-background text-muted-foreground opacity-0 shadow-xs transition hover:bg-accent hover:text-foreground group-hover/attachment:opacity-100 focus-visible:opacity-100"
            onClick={() => onRemove(attachment.id)}
            type="button"
          >
            <Codicon name="close" size="0.625rem" />
          </button>
        )}
      </div>
    </Tip>
  )
}

function ImageUploadBadge({ attachment }: { attachment: ComposerAttachment }) {
  if (attachment.kind !== 'image') {
    return null
  }

  if (attachment.uploadStatus === 'error') {
    return (
      <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full border border-background bg-destructive text-destructive-foreground shadow-sm">
        <AlertCircle className="size-3" />
      </span>
    )
  }

  if (attachment.uploadStatus !== 'uploading') {
    return null
  }

  const progress = Math.max(0.04, Math.min(0.98, attachment.uploadProgress ?? 0.04))
  const radius = 5.5
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  return (
    <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full border border-background bg-background shadow-sm">
      <svg aria-hidden className="size-3.5 -rotate-90" viewBox="0 0 16 16">
        <circle
          className="stroke-muted"
          cx="8"
          cy="8"
          fill="none"
          r={radius}
          strokeWidth="2.4"
        />
        <circle
          className="stroke-(--dt-ring)"
          cx="8"
          cy="8"
          fill="none"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeWidth="2.4"
        />
      </svg>
    </span>
  )
}
