// The tools of tmail-backend as the capabilities of the Assistant intent,
// with the `title` of each param, which the card of a call shows next to its
// value (not sent to the LLM)

import type { TranslationKey } from '@common/i18n/useI18n'

import type { AssistantTool } from './assistantTools'

const PARAM_TITLE_KEYS: Partial<Record<string, TranslationKey>> = {
  to: 'composer.fields.to',
  cc: 'composer.fields.cc',
  subject: 'composer.fields.subject',
  body: 'assistant.params.body',
  inReplyTo: 'assistant.params.inReplyTo',
  id: 'assistant.params.email',
  from: 'search.fields.from',
  text: 'search.fields.text',
  mailboxId: 'search.fields.folder',
  inMailboxes: 'search.fields.folder',
  after: 'assistant.params.after',
  before: 'assistant.params.before'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function withTitles(
  properties: Record<string, unknown>,
  t: (key: TranslationKey) => string
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(properties).map(([name, schema]) => {
      const key = PARAM_TITLE_KEYS[name]
      return [
        name,
        key !== undefined && isRecord(schema)
          ? { ...schema, title: t(key) }
          : schema
      ]
    })
  )
}

export function toCapability(
  tool: AssistantTool,
  t: (key: TranslationKey) => string
): AssistantTool {
  return {
    ...tool,
    parameters: {
      ...tool.parameters,
      properties: withTitles(tool.parameters.properties, t)
    }
  }
}
