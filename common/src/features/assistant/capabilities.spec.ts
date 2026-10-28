import { toCapability } from './capabilities'

const CREATE_DRAFT = {
  name: 'create_draft',
  description: 'Create a draft',
  parameters: {
    type: 'object' as const,
    properties: {
      to: { type: 'array', items: { type: 'string' }, description: 'To' },
      subject: { type: 'string', description: 'The subject' },
      body: { type: 'string', description: 'The body' },
      unknown: { type: 'string', description: 'A param of a later version' }
    },
    required: ['body']
  }
}

function t(key: string): string {
  return `<${key}>`
}

describe('toCapability', () => {
  it('gives each known param a title for the card, and keeps its schema', () => {
    const { parameters } = toCapability(CREATE_DRAFT, t)

    expect(parameters).toEqual({
      type: 'object',
      properties: {
        to: {
          type: 'array',
          items: { type: 'string' },
          description: 'To',
          title: '<composer.fields.to>'
        },
        subject: {
          type: 'string',
          description: 'The subject',
          title: '<composer.fields.subject>'
        },
        body: {
          type: 'string',
          description: 'The body',
          title: '<assistant.params.body>'
        },
        unknown: { type: 'string', description: 'A param of a later version' }
      },
      required: ['body']
    })
  })
})
