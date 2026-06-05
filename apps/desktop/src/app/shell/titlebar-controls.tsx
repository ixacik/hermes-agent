import { useStore } from '@nanostores/react'
import type { CSSProperties, ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { triggerHaptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import {
  $fileBrowserOpen,
  $panesFlipped,
  $sidebarOpen,
  toggleFileBrowserOpen,
  togglePanesFlipped,
  toggleSidebarOpen
} from '@/store/layout'

import { appViewForPath, isOverlayView } from '../routes'

import { titlebarButtonClass, titlebarControlsPosition } from './titlebar'

export interface TitlebarTool {
  id: string
  label: string
  active?: boolean
  className?: string
  disabled?: boolean
  hidden?: boolean
  href?: string
  icon: ReactNode
  onSelect?: () => void
  title?: string
  to?: string
}

export type TitlebarToolSide = 'left' | 'right'
export type SetTitlebarToolGroup = (id: string, tools: readonly TitlebarTool[], side?: TitlebarToolSide) => void

interface TitlebarControlsProps {
  leftTools?: readonly TitlebarTool[]
  nativeOverlayWidth?: number
  onOpenSettings: () => void
  titleSlotRef?: (node: HTMLDivElement | null) => void
  tools?: readonly TitlebarTool[]
  windowButtonPosition?: { x: number; y: number } | null
  windowFullscreen?: boolean
}

export function TitlebarControls({
  leftTools = [],
  nativeOverlayWidth = 0,
  onOpenSettings,
  titleSlotRef,
  tools = [],
  windowButtonPosition,
  windowFullscreen = false
}: TitlebarControlsProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const fileBrowserOpen = useStore($fileBrowserOpen)
  const sidebarOpen = useStore($sidebarOpen)
  const panesFlipped = useStore($panesFlipped)
  const titlebarControls = titlebarControlsPosition(windowButtonPosition, windowFullscreen)

  // Each titlebar button controls the pane physically on its side, so a flip
  // swaps which pane each one toggles. Default: sessions left, file browser
  // right. Flipped: file browser left, sessions right. Sidebar toggles never
  // carry an active highlight — they're plain show/hide affordances.
  const fileBrowserEdge = { open: fileBrowserOpen, toggle: toggleFileBrowserOpen }
  const sessionsEdge = { open: sidebarOpen, toggle: toggleSidebarOpen }
  const leftEdge = panesFlipped ? fileBrowserEdge : sessionsEdge
  const rightEdge = panesFlipped ? sessionsEdge : fileBrowserEdge

  const leftToolbarTools: TitlebarTool[] = [
    {
      icon: <Codicon name="layout-sidebar-left" />,
      id: 'sidebar',
      label: `${leftEdge.open ? 'Hide' : 'Show'} left sidebar`,
      onSelect: () => {
        triggerHaptic('tap')
        leftEdge.toggle()
      }
    },
    {
      icon: <Codicon name="arrow-swap" />,
      id: 'flip-panes',
      label: 'Swap sidebar sides',
      onSelect: () => {
        triggerHaptic('tap')
        togglePanesFlipped()
      },
      title: 'Swap the sessions and file browser sides'
    },
    ...leftTools
  ]

  const rightSidebarTool: TitlebarTool = {
    icon: <Codicon name="layout-sidebar-right" />,
    id: 'right-sidebar',
    label: `${rightEdge.open ? 'Hide' : 'Show'} right sidebar`,
    onSelect: () => {
      triggerHaptic('tap')
      rightEdge.toggle()
    }
  }

  // Static system tools — always pinned to the screen's right edge.
  const systemTools: TitlebarTool[] = [
    {
      icon: <Codicon name="settings-gear" />,
      id: 'settings',
      label: 'Open settings',
      onSelect: () => {
        triggerHaptic('open')
        onOpenSettings()
      }
    }
  ]

  // While a full-screen overlay (settings, command center, …) is open it should
  // visually own the window. These control clusters are `fixed` at a higher
  // z-index than the overlay card, so they'd otherwise bleed over it — hide them
  // and let the overlay's own chrome (close button, drag region) take over.
  if (isOverlayView(appViewForPath(location.pathname))) {
    return null
  }

  const visibleSystemTools = systemTools.filter(tool => !tool.hidden)
  const settingsTool = visibleSystemTools.find(tool => tool.id === 'settings')
  const visibleSystemToolsBeforeSettings = visibleSystemTools.filter(tool => tool.id !== 'settings')
  const visiblePaneTools = tools.filter(tool => !tool.hidden)
  const leftEdgePaneWidth = panesFlipped ? 'var(--pane-file-browser-width)' : 'var(--pane-chat-sidebar-width)'

  const leftSegmentStyle = {
    '--titlebar-native-left-inset': `${titlebarControls.left}px`,
    width: leftEdge.open ? leftEdgePaneWidth : undefined
  } as CSSProperties

  const rightSegmentStyle = {
    '--titlebar-native-overlay-fallback': `${nativeOverlayWidth}px`
  } as CSSProperties

  return (
    <div className="fixed inset-x-0 top-0 z-70 flex h-(--titlebar-height) select-none [-webkit-app-region:drag]">
      <div
        aria-label="Window controls"
        className="flex h-full shrink-0 items-center"
        style={leftSegmentStyle}
      >
        <div aria-hidden="true" className="h-full w-(--titlebar-native-left-inset) shrink-0" />
        <div className="min-w-2 flex-1" />
        <div className="pointer-events-auto mr-2 flex flex-row items-center gap-x-1 [-webkit-app-region:no-drag]">
          {leftToolbarTools
            .filter(tool => !tool.hidden)
            .map(tool => (
              <TitlebarToolButton key={tool.id} navigate={navigate} tool={tool} />
            ))}
        </div>
      </div>

      <div
        className="flex h-full min-w-0 flex-1 items-center bg-(--ui-chat-surface-background) pl-2 pr-[max(0.5rem,var(--titlebar-native-overlay-fallback),calc(100vw-env(titlebar-area-x,100vw)-env(titlebar-area-width,0px)))]"
        style={rightSegmentStyle}
      >
        <div className="relative flex min-w-0 flex-1 items-center" ref={titleSlotRef} />

        {visiblePaneTools.length > 0 && (
          <div
            aria-label="Pane controls"
            className="pointer-events-auto flex flex-row items-center gap-x-1 [-webkit-app-region:no-drag]"
          >
            {visiblePaneTools.map(tool => (
              <TitlebarToolButton key={tool.id} navigate={navigate} tool={tool} />
            ))}
          </div>
        )}

        <div
          aria-label="App controls"
          className="pointer-events-auto ml-1 flex flex-row items-center justify-end gap-x-1 [-webkit-app-region:no-drag]"
        >
          {visibleSystemToolsBeforeSettings.map(tool => (
            <TitlebarToolButton key={tool.id} navigate={navigate} tool={tool} />
          ))}
          {settingsTool && <TitlebarToolButton navigate={navigate} tool={settingsTool} />}
          <TitlebarToolButton navigate={navigate} tool={rightSidebarTool} />
        </div>
      </div>
    </div>
  )
}

function TitlebarToolButton({ navigate, tool }: { navigate: ReturnType<typeof useNavigate>; tool: TitlebarTool }) {
  // Titlebar actions never show an active background — state reads from the
  // icon itself (e.g. the mute/unmute glyph). aria-pressed still carries it
  // for a11y.
  const className = cn(titlebarButtonClass, 'bg-transparent select-none', tool.className)

  if (tool.href) {
    return (
      <Button asChild className={className} size="icon-titlebar" variant="ghost">
        <a
          aria-label={tool.label}
          href={tool.href}
          onPointerDown={event => event.stopPropagation()}
          rel="noreferrer"
          target="_blank"
        >
          {tool.icon}
        </a>
      </Button>
    )
  }

  return (
    <Button
      aria-label={tool.label}
      aria-pressed={tool.active ?? undefined}
      className={className}
      disabled={tool.disabled}
      onClick={() => {
        if (tool.to) {
          navigate(tool.to)
        }

        tool.onSelect?.()
      }}
      onPointerDown={event => event.stopPropagation()}
      size="icon-titlebar"
      type="button"
      variant="ghost"
    >
      {tool.icon}
    </Button>
  )
}
