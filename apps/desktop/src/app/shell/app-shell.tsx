import { useStore } from '@nanostores/react'
import type { CSSProperties, ReactNode } from 'react'
import { useState, useSyncExternalStore } from 'react'

import { NotificationStack } from '@/components/notifications'
import { PaneShell } from '@/components/pane-shell'
import { SidebarProvider } from '@/components/ui/sidebar'
import {
  $sidebarOpen,
  setSidebarOpen
} from '@/store/layout'
import { $connection } from '@/store/session'

import { TITLEBAR_HEIGHT } from './titlebar'
import { TitlebarControls, type TitlebarTool } from './titlebar-controls'
import { TitlebarSlotProvider } from './titlebar-slot'

interface AppShellProps {
  children: ReactNode
  leftTitlebarTools?: readonly TitlebarTool[]
  onOpenSettings: () => void
  overlays?: ReactNode
  titlebarTools?: readonly TitlebarTool[]
}

// Renderer-side fallback so layout snaps even when the main-process fullscreen event
// hasn't landed yet (e.g. dev reloads, before the IPC bridge is wired).
function subscribeWindowSize(cb: () => void) {
  window.addEventListener('resize', cb)
  window.addEventListener('fullscreenchange', cb)

  return () => {
    window.removeEventListener('resize', cb)
    window.removeEventListener('fullscreenchange', cb)
  }
}

const viewportIsFullscreen = () =>
  window.innerWidth >= window.screen.width && window.innerHeight >= window.screen.height

export function AppShell({
  children,
  leftTitlebarTools,
  onOpenSettings,
  overlays,
  titlebarTools
}: AppShellProps) {
  const sidebarOpen = useStore($sidebarOpen)
  const connection = useStore($connection)
  const [titlebarSlot, setTitlebarSlot] = useState<HTMLDivElement | null>(null)
  const viewportFullscreen = useSyncExternalStore(subscribeWindowSize, viewportIsFullscreen, () => false)
  const isFullscreen = Boolean(connection?.isFullscreen) || viewportFullscreen

  return (
    <SidebarProvider
      className="h-screen min-h-0 flex-col bg-background"
      onOpenChange={setSidebarOpen}
      open={sidebarOpen}
      style={
        {
          // Alias for shadcn <Sidebar> descendants. Resolves to the chat-sidebar
          // pane track via PaneShell's emitted --pane-chat-sidebar-width.
          '--sidebar-width': 'var(--pane-chat-sidebar-width)',
          '--titlebar-height': `${TITLEBAR_HEIGHT}px`
        } as CSSProperties
      }
    >
      <TitlebarSlotProvider target={titlebarSlot}>
        <main className="relative z-3 flex min-h-0 w-full flex-1 flex-col overflow-hidden transition-none">
          <PaneShell className="min-h-0 flex-1">
            <TitlebarControls
              leftTools={leftTitlebarTools}
              nativeOverlayWidth={connection?.nativeOverlayWidth ?? 0}
              onOpenSettings={onOpenSettings}
              titleSlotRef={setTitlebarSlot}
              tools={titlebarTools}
              windowButtonPosition={connection?.windowButtonPosition}
              windowFullscreen={isFullscreen}
            />

            {children}
          </PaneShell>
        </main>
      </TitlebarSlotProvider>

      {overlays}

      {/* Mounted at the shell root (after overlays) so success/error toasts
          surface above every route and overlay — not just the chat view. */}
      <NotificationStack />
    </SidebarProvider>
  )
}
