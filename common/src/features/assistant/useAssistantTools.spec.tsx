import { screen } from '@testing-library/react'
import type { ReactElement } from 'react'

import { FAKE_JMAP_ORIGIN } from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { useAssistantTools } from './useAssistantTools'

const TOOLS_URL = `${FAKE_JMAP_ORIGIN}/ai/v1/tools`

const CREATE_DRAFT = {
  name: 'create_draft',
  description: 'Create a draft',
  parameters: {
    type: 'object',
    properties: { body: { type: 'string', description: 'The body' } },
    required: ['body']
  }
}

// tmail-backend, behind the global `fetch` the route is called with
const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>()
const originalFetch = global.fetch

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock
})

afterAll(() => {
  global.fetch = originalFetch
})

function answerTools(status: number, body: unknown): void {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }))
}

function ToolNames(): ReactElement {
  const { data, isPending, isError } = useAssistantTools()
  if (isPending) return <p>loading</p>
  if (isError) return <p>no tools</p>
  return <p>{data.map(tool => tool.name).join(', ')}</p>
}

describe('useAssistantTools', () => {
  it('reads the tools of tmail-backend, with the credentials of the session', async () => {
    answerTools(200, { tools: [{ type: 'function', function: CREATE_DRAFT }] })

    renderWithProviders(<ToolNames />, { withJmapSession: true })

    expect(await screen.findByText('create_draft')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      TOOLS_URL,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.any(String)
        })
      })
    )
  })

  it('fails at once when tmail-backend refuses, without a retry', async () => {
    answerTools(401, { detail: 'User is not eligible for AI tools' })

    renderWithProviders(<ToolNames />, { withJmapSession: true })

    expect(await screen.findByText('no tools')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
