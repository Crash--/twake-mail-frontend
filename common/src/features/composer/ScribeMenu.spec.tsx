import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { ScribeMenu, type ScribeInput } from './ScribeMenu'

const ENDPOINT = 'https://ai.example.com/chat/completions'

const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>()
const originalFetch = global.fetch

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [{ message: { content: 'Bonjour Bob,\nMerci !' } }]
      }),
      { status: 200 }
    )
  )
  global.fetch = fetchMock
})

afterAll(() => {
  global.fetch = originalFetch
})

function renderMenu(
  input: ScribeInput,
  capabilities: Record<string, unknown> = {
    'com:linagora:params:jmap:aibot': { scribeEndpoint: ENDPOINT }
  }
): { onInsert: jest.Mock; onReplace: jest.Mock } {
  const onInsert = jest.fn()
  const onReplace = jest.fn()
  renderWithProviders(
    <ScribeMenu
      getInput={() => input}
      onInsert={onInsert}
      onReplace={onReplace}
    />,
    { withJmapSession: true, jmapServer: makeFakeJmapServer({ capabilities }) }
  )
  return { onInsert, onReplace }
}

async function runAction(name: string): Promise<HTMLElement> {
  await userEvent.click(
    await screen.findByRole('button', { name: 'AI assistant' })
  )
  await userEvent.click(screen.getByRole('menuitem', { name }))
  return screen.getByRole('dialog')
}

describe('ScribeMenu', () => {
  it('translates the selection, which the answer can replace', async () => {
    const { onReplace } = renderMenu({
      text: 'Hello Bob, thanks!',
      isSelection: true
    })
    const dialog = await runAction('French')

    expect(
      await within(dialog).findByRole('region', { name: 'Suggestion' })
    ).toHaveTextContent('Bonjour Bob,Merci !')
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe(ENDPOINT)
    const body: unknown = JSON.parse(
      typeof init?.body === 'string' ? init.body : ''
    )
    expect(body).toMatchObject({
      messages: [
        { role: 'system' },
        {
          role: 'user',
          content:
            'INSTRUCTION:\nTranslate the text to French.\n\nTEXT:\nHello Bob, thanks!\n'
        }
      ]
    })
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Replace' })
    )
    expect(onReplace).toHaveBeenCalledWith('Bonjour Bob,\nMerci !')
  })

  it('inserts the answer for the whole text, without offering to replace it', async () => {
    const { onInsert } = renderMenu({ text: 'Hello Bob', isSelection: false })
    const dialog = await runAction('Make it shorter')

    await within(dialog).findByRole('region', { name: 'Suggestion' })
    expect(within(dialog).queryByRole('button', { name: 'Replace' })).toBe(null)
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Insert' })
    )
    expect(onInsert).toHaveBeenCalledWith('Bonjour Bob,\nMerci !')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
  })

  it('says when the assistant fails, and tries again', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 502 }))
    renderMenu({ text: 'Hello', isSelection: false })
    const dialog = await runAction('Correct')

    expect(
      await within(dialog).findByTestId('composer-scribe-error')
    ).toHaveTextContent('Failed to generate AI response')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retry' }))
    expect(
      await within(dialog).findByRole('region', { name: 'Suggestion' })
    ).toBeVisible()
  })

  it('writes from the task of the user', async () => {
    renderMenu({ text: '', isSelection: false })
    const dialog = await runAction('Help me write')

    await userEvent.type(
      within(dialog).getByRole('textbox', {
        name: 'What should the assistant write?'
      }),
      'Thank Bob'
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ask' }))

    expect(
      await within(dialog).findByRole('region', { name: 'Suggestion' })
    ).toBeVisible()
    const [, init] = fetchMock.mock.calls[0] ?? []
    expect(typeof init?.body === 'string' ? init.body : '').toContain(
      'Thank Bob'
    )
  })

  it('asks for a text first, and calls nothing', async () => {
    renderMenu({ text: '  ', isSelection: false })
    await userEvent.click(
      await screen.findByRole('button', { name: 'AI assistant' })
    )
    await userEvent.click(screen.getByRole('menuitem', { name: 'Emojify' }))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Write or select some text first'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is not offered without the aibot capability', async () => {
    renderMenu({ text: 'Hello', isSelection: false }, {})

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'AI assistant' })).toBe(null)
    })
  })
})
