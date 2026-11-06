import type { AssistantTool } from './assistantTools'

export const ASSISTANT_INTENT = {
  action: 'OPEN',
  type: 'io.cozy.ai.chat.conversations'
}

export interface AssistantConfig {
  capabilities?: AssistantTool[]
  /** The app gives back the result of each call: the LLM goes on with it */
  capabilityResults?: boolean
  theme?: { type: 'light' | 'dark' }
}

// What a call gave, for the LLM (twake-assistant/docs/assistant-intent.md,
// "The result of a call")
export interface CapabilityResult {
  callId: string
  ok: boolean
  content: string
}

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

export type CapabilityParam = string | string[] | number | boolean | null

export interface CapabilityCall {
  capability: string
  params: Record<string, CapabilityParam>
  text: string | null
  callId: string | null
}

export type AssistantMessage =
  | { kind: 'ready' }
  | { kind: 'readyToUse' }
  | { kind: 'cancel' }
  | { kind: 'capabilityCall'; call: CapabilityCall }

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null
}

// The protocol sends strings, numbers, booleans, null and arrays of strings
// (`params` of a Result): anything else is not a call of the assistant
function isParamValue(value: unknown): value is CapabilityParam {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    (Array.isArray(value) && value.every(item => typeof item === 'string'))
  )
}

function readParams(value: unknown): Record<string, CapabilityParam> | null {
  if (!isRecord(value) || Array.isArray(value)) return null
  const params: Record<string, CapabilityParam> = {}
  for (const [name, param] of Object.entries(value)) {
    if (!isParamValue(param)) return null
    params[name] = param
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
    text: typeof result.text === 'string' ? result.text : null,
    callId:
      typeof result.callId === 'string' && result.callId !== ''
        ? result.callId
        : null
  }
}

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
  return call === null ? null : { kind: 'capabilityCall', call }
}
