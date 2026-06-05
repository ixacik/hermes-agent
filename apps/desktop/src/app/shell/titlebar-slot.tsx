import { createContext, type ReactNode, useContext } from 'react'
import { createPortal } from 'react-dom'

const TitlebarSlotContext = createContext<HTMLElement | null>(null)

export function TitlebarSlotProvider({ children, target }: { children: ReactNode; target: HTMLElement | null }) {
  return <TitlebarSlotContext.Provider value={target}>{children}</TitlebarSlotContext.Provider>
}

export function TitlebarSlot({ children }: { children: ReactNode }) {
  const target = useContext(TitlebarSlotContext)

  if (!target) {
    return null
  }

  return createPortal(children, target)
}
