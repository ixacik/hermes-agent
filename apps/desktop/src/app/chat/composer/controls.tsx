import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'
import { triggerHaptic } from '@/lib/haptics'
import { Loader2, Square } from '@/lib/icons'
import { cn } from '@/lib/utils'

import type { ConversationStatus } from './hooks/use-voice-conversation'
import type { ChatBarState, VoiceStatus } from './types'

export const ICON_BTN = 'size-(--composer-control-size) shrink-0 rounded-md'
export const GHOST_ICON_BTN = cn(
  ICON_BTN,
  'text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground'
)

interface ConversationProps {
  active: boolean
  level: number
  muted: boolean
  status: ConversationStatus
  onEnd: () => void
  onStart: () => void
  onStopTurn: () => void
  onToggleMute: () => void
}

export function ComposerControls({
  conversation,
  disabled,
  state,
  voiceStatus,
  onDictate
}: {
  conversation: ConversationProps
  disabled: boolean
  state: ChatBarState
  voiceStatus: VoiceStatus
  onDictate: () => void
}) {
  if (conversation.active) {
    return <ConversationPill {...conversation} disabled={disabled} />
  }

  // No send/stop/queue button — this fork submits via Enter only, and the
  // composer never shows a primary circle. The dictation mic is the sole
  // trailing control.
  return (
    <div className="ml-auto flex shrink-0 items-center gap-(--composer-control-gap)">
      <DictationButton disabled={disabled} onToggle={onDictate} state={state.voice} status={voiceStatus} />
    </div>
  )
}

function ConversationPill({
  disabled,
  level,
  muted,
  onEnd,
  onStopTurn,
  onToggleMute,
  status
}: ConversationProps & { disabled: boolean }) {
  const speaking = status === 'speaking'
  const listening = status === 'listening' && !muted

  const label =
    status === 'speaking'
      ? 'Speaking'
      : status === 'transcribing'
        ? 'Transcribing'
        : status === 'thinking'
          ? 'Thinking'
          : muted
            ? 'Muted'
            : 'Listening'

  return (
    <div className="ml-auto flex shrink-0 items-center gap-(--composer-control-gap)">
      <Tip label={muted ? 'Unmute microphone' : 'Mute microphone'}>
        <Button
          aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
          aria-pressed={muted}
          className={cn(GHOST_ICON_BTN, 'p-0', muted && 'bg-muted text-muted-foreground')}
          disabled={disabled}
          onClick={() => {
            triggerHaptic('selection')
            onToggleMute()
          }}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Codicon name={muted ? 'mic-off' : 'mic'} size="1rem" />
        </Button>
      </Tip>
      {listening && (
        <Button
          aria-label="Stop listening and send"
          className="h-(--composer-control-size) shrink-0 gap-1.5 rounded-full px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          disabled={disabled}
          onClick={() => {
            triggerHaptic('submit')
            onStopTurn()
          }}
          type="button"
          variant="ghost"
        >
          <Square className="fill-current" size={11} />
          <span>Stop</span>
        </Button>
      )}
      <Button
        aria-label="End voice conversation"
        className="h-(--composer-control-size) gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-(--ui-bg-selected)"
        disabled={disabled}
        onClick={() => {
          triggerHaptic('close')
          onEnd()
        }}
        type="button"
      >
        <ConversationIndicator level={level} listening={listening} speaking={speaking} />
        <span>End</span>
      </Button>
      <span className="sr-only" role="status">
        {label}
      </span>
    </div>
  )
}

function ConversationIndicator({
  level,
  listening,
  speaking
}: {
  level: number
  listening: boolean
  speaking: boolean
}) {
  if (speaking) {
    return <Loader2 className="animate-spin" size={12} />
  }

  const bars = [0.55, 0.85, 1, 0.85, 0.55]
  const normalized = Math.max(0, Math.min(level, 1))

  return (
    <span aria-hidden="true" className="flex h-3 items-center gap-0.5">
      {bars.map((weight, index) => {
        const height = listening ? 0.3 + Math.min(0.7, normalized * weight) : 0.3

        return <span className="w-0.5 rounded-full bg-current" key={index} style={{ height: `${height * 100}%` }} />
      })}
    </span>
  )
}

function DictationButton({
  disabled,
  state,
  status,
  onToggle
}: {
  disabled: boolean
  state: ChatBarState['voice']
  status: VoiceStatus
  onToggle: () => void
}) {
  const active = state.active || status !== 'idle'

  const aria =
    status === 'recording' ? 'Stop dictation' : status === 'transcribing' ? 'Transcribing dictation' : 'Voice dictation'

  return (
    <Tip label={aria}>
      <Button
        aria-label={aria}
        aria-pressed={active}
        className={cn(
          GHOST_ICON_BTN,
          'p-0',
          'data-[active=true]:bg-accent data-[active=true]:text-foreground',
          status === 'recording' && 'bg-(--ui-bg-selected) text-primary hover:bg-(--ui-bg-selected) hover:text-primary',
          status === 'transcribing' && 'bg-(--ui-bg-selected) text-primary'
        )}
        data-active={active}
        disabled={disabled || !state.enabled || status === 'transcribing'}
        onClick={() => {
          triggerHaptic(active ? 'close' : 'open')
          onToggle()
        }}
        size="icon"
        type="button"
        variant="ghost"
      >
        {status === 'recording' ? (
          <Square className="fill-current" size={12} />
        ) : status === 'transcribing' ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <Codicon name="mic" size="1rem" />
        )}
      </Button>
    </Tip>
  )
}
