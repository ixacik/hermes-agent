import {
  appendAssistantTextPart,
  appendReasoningPart,
  assistantTextPart,
  chatMessageText,
  type ChatMessage,
  type ChatMessagePart,
  reasoningPart,
  textPart,
  upsertToolPart
} from '@/lib/chat-messages'
import type { InflightReplayEvent, SessionInflightTurn } from '@/types/hermes'

interface HydratedInflightMessages {
  lastSeq: number
  messages: ChatMessage[]
  sawAssistantPayload: boolean
  startedAtMs: null | number
  streamId: null | string
  turnId: string
}

function eventText(event: InflightReplayEvent): string {
  const text = event.payload?.text

  return typeof text === 'string' ? text : ''
}

function partsText(parts: ChatMessagePart[]): string {
  return parts
    .filter((part): part is Extract<ChatMessagePart, { type: 'text' }> => part.type === 'text')
    .map(part => part.text)
    .join('')
}

function sortedReplayEvents(inflight: SessionInflightTurn): InflightReplayEvent[] {
  return [...(inflight.events ?? [])]
    .filter(event => event && typeof event.type === 'string')
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
}

export function inflightStartedAtMs(inflight: null | SessionInflightTurn | undefined): null | number {
  const startedAt = inflight?.started_at

  return typeof startedAt === 'number' && Number.isFinite(startedAt) && startedAt > 0
    ? Math.floor(startedAt * 1000)
    : null
}

export function hydrateInflightMessages(
  messages: ChatMessage[],
  sessionId: string,
  inflight: null | SessionInflightTurn | undefined
): HydratedInflightMessages {
  if (!inflight) {
    return {
      lastSeq: 0,
      messages,
      sawAssistantPayload: false,
      startedAtMs: null,
      streamId: null,
      turnId: ''
    }
  }

  const next = [...messages]
  const userText = String(inflight.user || '').trim()
  const turnId = String(inflight.turn_id || '')
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

  const events = sortedReplayEvents(inflight)
  const fallbackAssistantText = String(inflight.assistant || '').trim()
  const deterministicStreamId = `inflight-assistant-${sessionId}`
  const existingPendingIndex = [...next].reverse().findIndex(message => message.role === 'assistant' && message.pending && !message.hidden)
  const assistantIndex = existingPendingIndex >= 0 ? next.length - 1 - existingPendingIndex : -1
  const existingAssistant = assistantIndex >= 0 ? next[assistantIndex] : null
  const streamId = existingAssistant?.id ?? deterministicStreamId
  let parts: ChatMessagePart[] = []
  let sawAssistantPayload = false
  let lastSeq = 0

  if (events.length > 0) {
    for (const event of events) {
      lastSeq = Math.max(lastSeq, Number(event.seq || 0))

      if (event.type === 'message.delta') {
        const text = eventText(event)
        if (text) {
          parts = appendAssistantTextPart(parts, text)
          sawAssistantPayload = true
        }
      } else if (event.type === 'reasoning.delta') {
        const text = eventText(event)
        if (text) {
          parts = appendReasoningPart(parts, text)
          sawAssistantPayload = true
        }
      } else if (event.type === 'reasoning.available') {
        const text = eventText(event)
        if (text && !partsText(parts).trim()) {
          parts = [...parts.filter(part => part.type !== 'reasoning'), reasoningPart(text)]
          sawAssistantPayload = true
        }
      } else if (event.type === 'tool.start' || event.type === 'tool.progress' || event.type === 'tool.generating') {
        parts = upsertToolPart(parts, event.payload, 'running')
        sawAssistantPayload = true
      } else if (event.type === 'tool.complete') {
        parts = upsertToolPart(parts, event.payload, 'complete')
        sawAssistantPayload = true
      }
    }
  } else if (fallbackAssistantText) {
    parts = [assistantTextPart(fallbackAssistantText)]
    sawAssistantPayload = true
  }

  if (!sawAssistantPayload) {
    return {
      lastSeq,
      messages: next,
      sawAssistantPayload: false,
      startedAtMs: inflightStartedAtMs(inflight),
      streamId: null,
      turnId
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
    lastSeq,
    messages: next.filter((message, index) => message.id !== deterministicStreamId || index === next.findIndex(m => m.id === deterministicStreamId)),
    sawAssistantPayload,
    startedAtMs: inflightStartedAtMs(inflight),
    streamId,
    turnId
  }
}
