import type { AssistantTool } from './assistantTools'

export const ASSISTANT_INTENT = {
  action: 'OPEN',
  type: 'io.cozy.ai.chat.conversations'
}

export interface AssistantConfig {
  capabilities?: AssistantTool[]
  theme?: { type: 'light' | 'dark' }
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

export interface CapabilityCall {
  capability: string
  params: Record<string, string | string[]>
  text: string | null
}

export type AssistantMessage =
  | { kind: 'ready' }
  | { kind: 'readyToUse' }
  | { kind: 'cancel' }
  | { kind: 'capabilityCall'; call: CapabilityCall }

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null
}

// The protocol sends strings and arrays of strings only (`params` of a
// Result): anything else is not a call of the assistant
function isParamValue(value: unknown): value is string | string[] {
  return (
    typeof value === 'string' ||
    (Array.isArray(value) && value.every(item => typeof item === 'string'))
  )
}

function readParams(value: unknown): Record<string, string | string[]> | null {
  if (!isRecord(value) || Array.isArray(value)) return null
  const params: Record<string, string | string[]> = {}
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
    text: typeof result.text === 'string' ? result.text : null
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
