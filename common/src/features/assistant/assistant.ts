import type { AssistantCapability } from './assistantTools'

export const ASSISTANT_INTENT = {
  action: 'OPEN',
  type: 'io.cozy.ai.chat.conversations'
}

/** The configuration sent to the assistant in reply to its `ready`. */
export interface AssistantConfig {
  content?: string
  answerActions?: { name: string; label?: string }[]
  /** What the app can do: the tools of tmail-backend */
  capabilities?: AssistantCapability[]
  theme?: { type: 'light' | 'dark' }
}

/** The service of the intent: the page to frame */
export interface AssistantService {
  intentId: string
  href: string
  origin: string
}

export function assistantService(intent: {
  id: string
  services: { href: string }[]
}): AssistantService | null {
  const href = intent.services[0]?.href
  if (href === undefined) return null
  try {
    return { intentId: intent.id, href, origin: new URL(href).origin }
  } catch {
    return null
  }
}

export interface AnswerResult {
  answerAction: string
  text: string
}

/** The capability the LLM picked*/
export interface CapabilityCall {
  capability: string
  params: Record<string, string | string[]>
  text: string | null
}

export type AssistantMessage =
  | { kind: 'ready' }
  | { kind: 'readyToUse' }
  | { kind: 'cancel' }
  | { kind: 'result'; result: AnswerResult }
  | { kind: 'capabilityCall'; call: CapabilityCall }

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null
}

function toParamString(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return null
}

function toParamValue(value: unknown): string | string[] | null {
  if (!Array.isArray(value)) return toParamString(value)
  const items: string[] = []
  for (const item of value) {
    const text = toParamString(item)
    if (text === null) return null
    items.push(text)
  }
  return items
}

/** The parameters of a call, numbers and booleans as strings **/
function readParams(value: unknown): Record<string, string | string[]> | null {
  if (!isRecord(value) || Array.isArray(value)) return null
  const params: Record<string, string | string[]> = {}
  for (const [name, param] of Object.entries(value)) {
    const converted = toParamValue(param)
    if (converted === null) return null
    params[name] = converted
  }
  return params
}

function readCapabilityCall(result: unknown): CapabilityCall | null {
  if (!isRecord(result) || typeof result.capability !== 'string') return null
  const params = readParams(result.params)
  if (params === null) return null
  return {
    capability: result.capability,
    params,
    text: typeof result.text === 'string' ? result.text : null
  }
}

/** Reads a message of the assistant's frame; null for anything else. */
export function parseAssistantMessage(
  data: unknown,
  intentId: string
): AssistantMessage | null {
  if (!isRecord(data) || typeof data.type !== 'string') return null
  const prefix = `intent-${intentId}:`
  if (!data.type.startsWith(prefix)) return null
  const kind = data.type.slice(prefix.length)
  if (kind === 'ready' || kind === 'readyToUse' || kind === 'cancel') {
    return { kind }
  }
  if (kind !== 'result') return null
  const call = readCapabilityCall(data.result)
  if (call !== null) return { kind: 'capabilityCall', call }
  if (
    isRecord(data.result) &&
    typeof data.result.answerAction === 'string' &&
    typeof data.result.text === 'string'
  ) {
    return {
      kind: 'result',
      result: { answerAction: data.result.answerAction, text: data.result.text }
    }
  }
  return null
}
