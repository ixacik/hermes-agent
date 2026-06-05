import { useStore } from '@nanostores/react'
import type { ReactNode } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import type { HermesGateway } from '@/hermes'
import { triggerHaptic } from '@/lib/haptics'
import { ChevronDown, Zap, ZapFilled } from '@/lib/icons'
import { formatModelStatusLabel } from '@/lib/model-status-label'
import { usageContextLabel } from '@/lib/statusbar'
import { cn } from '@/lib/utils'
import { setSessionYolo } from '@/lib/yolo-session'
import {
  $activeSessionId,
  $currentFastMode,
  $currentModel,
  $currentProvider,
  $currentReasoningEffort,
  $currentUsage,
  $gatewayState,
  $yoloActive,
  setModelPickerOpen,
  setYoloActive
} from '@/store/session'

// Inline status cluster that lives in the composer control row (left of the
// mic/send buttons). It replaces the bottom status bar: the model + reasoning
// effort picker, a gateway connection dot, the YOLO/auto-approve toggle, and a
// context-usage meter — all reading the same session stores the old status bar
// did, so they stay live without prop drilling.

const CHIP_CLASS =
  'inline-flex h-(--composer-control-size) shrink-0 items-center gap-0.5 rounded-md px-1.5 text-xs text-(--ui-text-tertiary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground disabled:cursor-default disabled:opacity-45'

export function ComposerStatusControls({
  disabled,
  gateway,
  modelMenuContent,
  sessionId
}: {
  disabled: boolean
  gateway?: HermesGateway | null
  modelMenuContent?: ReactNode
  sessionId?: string | null
}) {
  const gatewayState = useStore($gatewayState)
  const gatewayOpen = gatewayState === 'open'

  return (
    <div className="flex min-w-0 shrink items-center gap-(--composer-control-gap)">
      <ContextMeter />
      {gatewayOpen && <YoloToggle disabled={disabled} gateway={gateway} sessionId={sessionId} />}
      <ModelControl disabled={disabled} modelMenuContent={modelMenuContent} />
    </div>
  )
}

function ContextMeter() {
  const usage = useStore($currentUsage)
  const label = usageContextLabel(usage)

  if (!label) {
    return null
  }

  // Fraction of the context window consumed. With a known max we use the
  // reported percent (falling back to used/max); without one we can't draw a
  // meaningful fill, so the ring stays empty and the tooltip shows raw tokens.
  const fraction = usage.context_max
    ? Math.max(0, Math.min(1, (usage.context_percent ?? (usage.context_used ?? 0) / usage.context_max * 100) / 100))
    : 0

  return (
    <Tip label={`Context usage · ${label}`}>
      <span className="inline-flex h-(--composer-control-size) shrink-0 items-center px-1">
        <ContextRing fraction={fraction} />
      </span>
    </Tip>
  )
}

// Circular gauge that fills clockwise with the inline-code blue as the context
// window fills. Raw token counts are surfaced via the surrounding tooltip on
// hover only — the ring itself stays numberless.
function ContextRing({ fraction }: { fraction: number }) {
  const size = 17
  const stroke = 2.5
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const dash = circumference * fraction

  return (
    <svg aria-hidden className="-rotate-90" height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
      <circle
        cx={size / 2}
        cy={size / 2}
        fill="none"
        r={r}
        stroke="var(--dt-border)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        fill="none"
        r={r}
        stroke="var(--ui-inline-code-foreground)"
        strokeDasharray={`${dash} ${circumference}`}
        strokeLinecap="round"
        strokeWidth={stroke}
        style={{ transition: 'stroke-dasharray 0.3s ease' }}
      />
    </svg>
  )
}

function YoloToggle({
  disabled,
  gateway,
  sessionId
}: {
  disabled: boolean
  gateway?: HermesGateway | null
  sessionId?: string | null
}) {
  const yoloActive = useStore($yoloActive)

  const toggle = async () => {
    const next = !$yoloActive.get()
    const sid = sessionId ?? $activeSessionId.get()

    setYoloActive(next)
    triggerHaptic(next ? 'open' : 'close')

    if (!sid || !gateway) {
      return
    }

    try {
      await setSessionYolo((method, params) => gateway.request(method, params), sid, next)
    } catch {
      setYoloActive(!next)
    }
  }

  return (
    <Tip
      label={
        yoloActive
          ? 'YOLO on — auto-approving dangerous commands. Click to turn off.'
          : 'YOLO off — click to auto-approve dangerous commands.'
      }
    >
      <button
        aria-label="Toggle auto-approve"
        aria-pressed={yoloActive}
        className={cn(CHIP_CLASS, 'px-1', yoloActive && 'text-foreground')}
        disabled={disabled}
        onClick={() => void toggle()}
        type="button"
      >
        {yoloActive ? <ZapFilled className="size-3.5" /> : <Zap className="size-3.5 opacity-70" />}
      </button>
    </Tip>
  )
}

function ModelControl({ disabled, modelMenuContent }: { disabled: boolean; modelMenuContent?: ReactNode }) {
  const currentModel = useStore($currentModel)
  const currentProvider = useStore($currentProvider)
  const currentFastMode = useStore($currentFastMode)
  const currentReasoningEffort = useStore($currentReasoningEffort)

  const label = formatModelStatusLabel(currentModel, {
    fastMode: currentFastMode,
    reasoningEffort: currentReasoningEffort
  })

  const trigger = (
    <span className="inline-flex min-w-0 items-center gap-0.5">
      <span className="truncate">{label}</span>
      <ChevronDown className="size-2.5 shrink-0 opacity-50" />
    </span>
  )

  // With a live gateway the parent threads the full ModelMenuPanel as
  // `modelMenuContent`; otherwise fall back to the model-picker overlay.
  if (!modelMenuContent) {
    return (
      <Tip label={currentProvider ? `${currentProvider} · ${currentModel || 'no model'}` : 'Open model picker'}>
        <button className={CHIP_CLASS} disabled={disabled} onClick={() => setModelPickerOpen(true)} type="button">
          {trigger}
        </button>
      </Tip>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(CHIP_CLASS, 'data-[state=open]:bg-(--chrome-action-hover) data-[state=open]:text-foreground')}
          disabled={disabled}
          title={currentProvider ? `Model · ${currentProvider}: ${currentModel || 'none'}` : 'Switch model'}
          type="button"
        >
          {trigger}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-0" side="top" sideOffset={8}>
        {modelMenuContent}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
