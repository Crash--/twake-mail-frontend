import type { Session } from 'jmap-client-ts'

/**
 * The tools of the AI assistant that tmail-backend offers
 * (`GET /ai/v1/tools`, in the OpenAI function calling format), turned into
 * the capabilities of the Assistant intent
 * (twake-assistant/docs/assistant-intent.md, "Capability").
 */

/** The parameters of a tool: a JSON schema of an object */
export interface ToolParameters {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
}

/** A tool of tmail-backend, as the LLM sees it */
export interface AssistantTool {
  name: string
  description: string
  parameters: ToolParameters
}

/** What the Assistant intent calls a capability */
export interface AssistantCapability {
  name: string
  description: string
  parameters: ToolParameters
}

export type AssistantToolsResult =
  { ok: true; value: AssistantTool[] } | { ok: false }

/** The route of the tools, on the server of the JMAP API */
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

/** A tool of the list, `{ type: 'function', function }`; null for anything else */
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

/**
 * Asks tmail-backend for the tools (`{ tools: [] }`), with the
 * credentials of the JMAP session. A tool it cannot read is left out.
 */
export async function fetchAssistantTools(
  url: string,
  authorization: string | null,
  {
    signal,
    fetchFunction = fetch
  }: { signal?: AbortSignal; fetchFunction?: typeof fetch } = {}
): Promise<AssistantToolsResult> {
  try {
    const response = await fetchFunction(url, {
      headers: {
        Accept: 'application/json',
        ...(authorization === null ? {} : { Authorization: authorization })
      },
      ...(signal ? { signal } : {})
    })
    if (!response.ok) return { ok: false }
    const json: unknown = await response.json()
    if (!isRecord(json) || !Array.isArray(json.tools)) return { ok: false }
    const tools = json.tools
      .map(readTool)
      .filter((tool): tool is AssistantTool => tool !== null)
    return { ok: true, value: tools }
  } catch {
    return { ok: false }
  }
}

export function toCapabilities(
  tools: readonly AssistantTool[]
): AssistantCapability[] {
  return tools.map(({ name, description, parameters }) => ({
    name,
    description,
    parameters
  }))
}
