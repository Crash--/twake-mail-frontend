import type { AssistantTool } from './assistantTools'

export const ASSISTANT_INTENT = {
  action: 'OPEN',
  type: 'io.cozy.ai.chat.conversations'
}

export interface AssistantConfig {
  tools?: AssistantTool[]
  /** The app gives back the result of each call: the LLM goes on with it */
  toolResults?: boolean
  /**
   * false: the LLM answers alone, with the rules of the tools, instead of
   * openRAG answering from the documents of the user (who can still turn
   * the Drive source on)
   */
  documents?: boolean
  theme?: { type: 'light' | 'dark' }
}

// What a call gave, for the LLM, with the id of the message of the stack that
// holds the call (twake-assistant/docs/assistant-intent.md, "The result of a
// call")
export interface ToolResult {
  messageId: string
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

export type ToolParam = string | string[] | number | boolean | null

export interface ToolCall {
  tool: string
  params: Record<string, ToolParam>
  text: string | null
  messageId: string | null
}

export type AssistantMessage =
  | { kind: 'ready' }
  | { kind: 'readyToUse' }
  | { kind: 'cancel' }
  | { kind: 'toolCall'; call: ToolCall }

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null
}

// The protocol sends strings, numbers, booleans, null and arrays of strings
// (`params` of a Result): anything else is not a call of the assistant
function isParamValue(value: unknown): value is ToolParam {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    (Array.isArray(value) && value.every(item => typeof item === 'string'))
  )
}

function readParams(value: unknown): Record<string, ToolParam> | null {
  if (!isRecord(value) || Array.isArray(value)) return null
  const params: Record<string, ToolParam> = {}
  for (const [name, param] of Object.entries(value)) {
    if (!isParamValue(param)) return null
    params[name] = param
  }
  return params
}

function readText(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

// `capability` and `callId` are the former names of `tool` and `messageId`,
// sent by an assistant older than twake-assistant#150
function readToolCall(result: unknown): ToolCall | null {
  if (!isRecord(result)) return null
  const tool = readText(result.tool) ?? readText(result.capability)
  const params = readParams(result.params)
  if (tool === null || params === null) return null
  return {
    tool,
    params,
    text: typeof result.text === 'string' ? result.text : null,
    messageId: readText(result.messageId) ?? readText(result.callId)
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
  const call = readToolCall(data.result)
  return call === null ? null : { kind: 'toolCall', call }
}
