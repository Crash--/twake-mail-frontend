import {
  AssistantToolsError,
  assistantToolsUrl,
  createdDraftId,
  executeAssistantTool,
  fetchAssistantTools
} from './assistantTools'

const CREATE_DRAFT = {
  type: 'function',
  function: {
    name: 'create_draft',
    description: 'Create a draft',
    parameters: {
      type: 'object',
      properties: { body: { type: 'string', description: 'The body' } },
      required: ['body']
    }
  }
}

const LIST_EMAILS = {
  type: 'function',
  function: {
    name: 'list_emails',
    description: 'List the emails',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'integer', description: 'At most' } },
      required: []
    }
  }
}

function answering(status: number, body: unknown): jest.Mock {
  return jest.fn(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status }))
  )
}

describe('assistantToolsUrl', () => {
  it('is the route of the tools on the server of the JMAP API', () => {
    expect(assistantToolsUrl({ apiUrl: 'https://jmap.example.com/jmap' })).toBe(
      'https://jmap.example.com/ai/v1/tools'
    )
  })
})

describe('fetchAssistantTools', () => {
  const url = 'https://jmap.example.com/ai/v1/tools'

  it('reads the tools, with the credentials of the session', async () => {
    const fetchFunction = answering(200, { tools: [CREATE_DRAFT, LIST_EMAILS] })

    const result = await fetchAssistantTools(url, 'Bearer token', {
      fetchFunction
    })

    expect(result).toEqual([CREATE_DRAFT.function, LIST_EMAILS.function])
    expect(fetchFunction).toHaveBeenCalledWith(url, {
      headers: { Accept: 'application/json', Authorization: 'Bearer token' }
    })
  })

  it('leaves out a tool it cannot read', async () => {
    const fetchFunction = answering(200, {
      tools: [
        CREATE_DRAFT,
        { type: 'other' },
        { type: 'function', function: { name: 'no_description' } },
        {
          type: 'function',
          function: { name: 'no_schema', description: 'x', parameters: [] }
        }
      ]
    })

    const result = await fetchAssistantTools(url, null, { fetchFunction })

    expect(result).toEqual([CREATE_DRAFT.function])
  })

  it('fails with the status when the server refuses', async () => {
    const fetchFunction = answering(401, { detail: 'not eligible' })

    await expect(
      fetchAssistantTools(url, null, { fetchFunction })
    ).rejects.toEqual(new AssistantToolsError(401))
  })

  it('fails on an answer without tools', async () => {
    const fetchFunction = answering(200, { other: [] })

    await expect(
      fetchAssistantTools(url, null, { fetchFunction })
    ).rejects.toEqual(new AssistantToolsError(null))
  })

  it('fails when the server is out of reach', async () => {
    const fetchFunction = jest.fn(() =>
      Promise.reject(new TypeError('Failed to fetch'))
    )

    await expect(
      fetchAssistantTools(url, null, { fetchFunction })
    ).rejects.toThrow('Failed to fetch')
  })
})

describe('executeAssistantTool', () => {
  const URL = 'https://jmap.example.com/ai/v1/tools'
  const CALL = {
    id: 'call-1',
    name: 'create_draft',
    arguments: { to: ['alae@example.com'], body: 'Bonjour' }
  }

  it('posts the call as an OpenAI tool call, with the authorization', async () => {
    const fetchFunction = answering(200, {
      role: 'tool',
      tool_call_id: 'call-1',
      content: '{"id":"draft-1"}'
    })

    await executeAssistantTool(URL, 'Bearer token', CALL, { fetchFunction })

    expect(fetchFunction).toHaveBeenCalledWith(URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer token'
      },
      body: JSON.stringify({
        id: 'call-1',
        type: 'function',
        function: {
          name: 'create_draft',
          arguments: { to: ['alae@example.com'], body: 'Bonjour' }
        }
      })
    })
  })

  it('gives the result of the tool, parsed', async () => {
    const fetchFunction = answering(200, {
      role: 'tool',
      tool_call_id: 'call-1',
      content: '{"id":"draft-1","subject":"Réunion"}'
    })

    expect(
      await executeAssistantTool(URL, null, CALL, { fetchFunction })
    ).toEqual({ ok: true, content: { id: 'draft-1', subject: 'Réunion' } })
  })

  it('fails with the status tmail-backend answers', async () => {
    const fetchFunction = answering(400, { detail: "Missing 'body'" })

    expect(
      await executeAssistantTool(URL, null, CALL, { fetchFunction })
    ).toEqual({ ok: false, status: 400 })
  })

  it('fails without status for an answer that is not a tool message', async () => {
    const fetchFunction = answering(200, { content: 'not json' })

    expect(
      await executeAssistantTool(URL, null, CALL, { fetchFunction })
    ).toEqual({ ok: false, status: null })
  })
})

describe('createdDraftId', () => {
  it('is the id of the saved draft', () => {
    expect(createdDraftId({ id: 'draft-1', subject: '' })).toBe('draft-1')
  })

  it('is null for another result', () => {
    expect(createdDraftId({ emails: [] })).toBe(null)
    expect(createdDraftId(null)).toBe(null)
  })
})
