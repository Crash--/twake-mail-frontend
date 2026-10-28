// The tools of the AI assistant that tmail-backend offers (`GET /ai/v1/tools`,
// in the OpenAI function calling format), sent as the capabilities of the
// Assistant intent (twake-assistant/docs/assistant-intent.md, "Capability").

import type { Session } from 'jmap-client-ts'

export interface ToolParameters {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
}

export interface AssistantTool {
  name: string
  description: string
  parameters: ToolParameters
}

export class AssistantToolsError extends Error {
  readonly status: number | null

  constructor(status: number | null) {
    super(
      status === null
        ? 'tmail-backend answered no tools'
        : `tmail-backend answered ${status} for the tools`
    )
    this.name = 'AssistantToolsError'
    this.status = status
  }
}

export function assistantToolsUrl(session: Pick<Session, 'apiUrl'>): string {
  return new URL('/ai/v1/tools', session.apiUrl).href
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readParameters(value: unknown): ToolParameters | null {
  if (
    !isRecord(value) ||
    value.type !== 'object' ||
    !isRecord(value.properties)
  ) {
    return null
  }
  const { required } = value
  return Array.isArray(required) &&
    required.every(name => typeof name === 'string')
    ? { type: 'object', properties: value.properties, required }
    : { type: 'object', properties: value.properties }
}

function readTool(entry: unknown): AssistantTool | null {
  if (!isRecord(entry) || entry.type !== 'function') return null
  const tool = entry.function
  if (
    !isRecord(tool) ||
    typeof tool.name !== 'string' ||
    typeof tool.description !== 'string'
  ) {
    return null
  }
  const parameters = readParameters(tool.parameters)
  return parameters === null
    ? null
    : { name: tool.name, description: tool.description, parameters }
}

export async function fetchAssistantTools(
  url: string,
  authorization: string | null,
  {
    signal,
    fetchFunction = fetch
  }: { signal?: AbortSignal; fetchFunction?: typeof fetch } = {}
): Promise<AssistantTool[]> {
  const response = await fetchFunction(url, {
    headers: {
      Accept: 'application/json',
      ...(authorization === null ? {} : { Authorization: authorization })
    },
    ...(signal ? { signal } : {})
  })
  if (!response.ok) throw new AssistantToolsError(response.status)
  const json: unknown = await response.json()
  if (!isRecord(json) || !Array.isArray(json.tools)) {
    throw new AssistantToolsError(null)
  }
  return json.tools
    .map(readTool)
    .filter((tool): tool is AssistantTool => tool !== null)
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, string | string[]>
}

export type ToolCallOutcome =
  { ok: true; content: unknown } | { ok: false; status: number | null }

export async function executeAssistantTool(
  url: string,
  authorization: string | null,
  call: ToolCall,
  { fetchFunction = fetch }: { fetchFunction?: typeof fetch } = {}
): Promise<ToolCallOutcome> {
  const response = await fetchFunction(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(authorization === null ? {} : { Authorization: authorization })
    },
    body: JSON.stringify({
      id: call.id,
      type: 'function',
      function: { name: call.name, arguments: call.arguments }
    })
  })
  if (!response.ok) return { ok: false, status: response.status }
  const json: unknown = await response.json()
  if (!isRecord(json) || typeof json.content !== 'string') {
    return { ok: false, status: null }
  }
  try {
    const content: unknown = JSON.parse(json.content)
    return { ok: true, content }
  } catch {
    return { ok: false, status: null }
  }
}

export function createdDraftId(content: unknown): string | null {
  return isRecord(content) && typeof content.id === 'string' ? content.id : null
}
