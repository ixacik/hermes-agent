import {
  assistantTextPart,
  chatMessageText,
  type ChatMessage,
  textPart
} from '@/lib/chat-messages'
import type { SessionInflightTurn } from '@/types/hermes'

interface HydratedInflightMessages {
  messages: ChatMessage[]
  sawAssistantPayload: boolean
  startedAtMs: null | number
  streamId: null | string
}

export function hydrateInflightMessages(
  messages: ChatMessage[],
  sessionId: string,
  inflight: null | SessionInflightTurn | undefined
): HydratedInflightMessages {
  if (!inflight) {
    return {
      messages,
      sawAssistantPayload: false,
      startedAtMs: null,
      streamId: null
    }
  }

  const next = [...messages]
  const userText = String(inflight.user || '').trim()
  const matchingUser = [...next]
    .reverse()
    .find(message => message.role === 'user' && !message.hidden && chatMessageText(message).trim() === userText)

  if (userText && !matchingUser) {
    next.push({
      id: `inflight-user-${sessionId}`,
      role: 'user',
      parts: [textPart(userText)]
    })
  }

  const fallbackAssistantText = String(inflight.assistant || '').trim()
  const deterministicStreamId = `inflight-assistant-${sessionId}`
  const existingPendingIndex = [...next].reverse().findIndex(message => message.role === 'assistant' && message.pending && !message.hidden)
  const assistantIndex = existingPendingIndex >= 0 ? next.length - 1 - existingPendingIndex : -1
  const existingAssistant = assistantIndex >= 0 ? next[assistantIndex] : null
  const streamId = existingAssistant?.id ?? deterministicStreamId
  const parts = fallbackAssistantText ? [assistantTextPart(fallbackAssistantText)] : []
  let sawAssistantPayload = false

  if (fallbackAssistantText) {
    sawAssistantPayload = true
  }

  if (!sawAssistantPayload) {
    return {
      messages: next,
      sawAssistantPayload: false,
      startedAtMs: null,
      streamId: null
    }
  }

  const assistantMessage: ChatMessage = {
    ...(existingAssistant ?? {
      id: streamId,
      role: 'assistant' as const
    }),
    parts,
    pending: true
  }

  if (assistantIndex >= 0) {
    next[assistantIndex] = assistantMessage
  } else {
    next.push(assistantMessage)
  }

  return {
    messages: next.filter((message, index) => message.id !== deterministicStreamId || index === next.findIndex(m => m.id === deterministicStreamId)),
    sawAssistantPayload,
    startedAtMs: null,
    streamId
  }
}
