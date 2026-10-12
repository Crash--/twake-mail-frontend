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

async function openAssistant(): Promise<void> {
  await userEvent.click(
    await screen.findByRole('button', { name: 'AI assistant' })
  )
}

/** A category, then its action when it has several (as tmail-flutter) */
async function runAction(
  category: string,
  action: string | null = null
): Promise<HTMLElement> {
  await openAssistant()
  await userEvent.click(screen.getByRole('menuitem', { name: category }))
  if (action !== null) {
    await userEvent.click(
      within(screen.getByRole('menu', { name: category })).getByRole(
        'menuitem',
        { name: action }
      )
    )
  }
  return screen.getByRole('dialog')
}

describe('ScribeMenu', () => {
  it('lists the categories of tmail-flutter, the ones of several actions opening them beside', async () => {
    renderMenu({ text: 'Hello Bob', isSelection: false })
    await openAssistant()

    const menu = screen.getByRole('menu', { name: 'AI assistant' })
    const categories = within(menu)
      .getAllByRole('menuitem')
      .map(item => item.textContent)
    expect(categories).toEqual([
      'Correct',
      'Translate',
      'Change tone',
      'Improve'
    ])
    const tone = within(menu).getByRole('menuitem', { name: 'Change tone' })
    expect(tone).toHaveAttribute('aria-haspopup', 'menu')
    expect(tone).toHaveAttribute('aria-expanded', 'false')

    tone.focus()
    await userEvent.keyboard('{ArrowRight}')
    const submenu = screen.getByRole('menu', { name: 'Change tone' })
    expect(tone).toHaveAttribute('aria-expanded', 'true')
    expect(
      within(submenu)
        .getAllByRole('menuitem')
        .map(item => item.textContent)
    ).toEqual(['More professional', 'More casual', 'More polite'])
    await waitFor(() => {
      expect(
        within(submenu).getByRole('menuitem', { name: 'More professional' })
      ).toHaveFocus()
    })

    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.queryByRole('menu', { name: 'Change tone' })).toBe(null)
    expect(tone).toHaveFocus()
    expect(screen.getByRole('textbox', { name: 'Help me write' })).toBeVisible()
  })

  it('translates the selection, which the answer can replace', async () => {
    const { onReplace } = renderMenu({
      text: 'Hello Bob, thanks!',
      isSelection: true
    })
    const dialog = await runAction('Translate', 'French')

    expect(dialog).toHaveAccessibleName('Translate > French')
    expect(
      await within(dialog).findByRole('region', { name: 'Suggestion' })
    ).toHaveTextContent('Bonjour Bob, Merci !')
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

  it('says it is generating the response, then inserts it for the whole text, without offering to replace it', async () => {
    let answer: (response: Response) => void = () => undefined
    fetchMock.mockReturnValueOnce(
      new Promise(resolve => {
        answer = resolve
      })
    )
    const { onInsert } = renderMenu({ text: 'Hello Bob', isSelection: false })
    const dialog = await runAction('Correct')

    expect(dialog).toHaveAccessibleName('Correct')
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Generating response'
    )
    answer(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Bonjour Bob,\nMerci !' } }]
        }),
        { status: 200 }
      )
    )
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

  it('improves the answer with another action', async () => {
    renderMenu({ text: 'Hello Bob', isSelection: false })
    const dialog = await runAction('Correct')
    await within(dialog).findByRole('region', { name: 'Suggestion' })

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Improve' })
    )
    await userEvent.click(
      screen.getAllByRole('menuitem', { name: 'Improve' }).at(-1) ??
        document.body
    )
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Make it shorter' })
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
    const [, init] = fetchMock.mock.calls[1] ?? []
    expect(typeof init?.body === 'string' ? init.body : '').toContain(
      'Bonjour Bob,\\nMerci !'
    )
  })

  it('says when the assistant fails, and tries again', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 502 }))
    renderMenu({ text: 'Hello', isSelection: false })
    const dialog = await runAction('Correct')

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Failed to generate AI response'
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retry' }))
    expect(
      await within(dialog).findByRole('region', { name: 'Suggestion' })
    ).toBeVisible()
  })

  it('offers only "Help me write" when nothing is written, and writes from the prompt on Enter', async () => {
    renderMenu({ text: '', isSelection: false })
    await openAssistant()

    expect(screen.queryByRole('menu', { name: 'AI assistant' })).toBe(null)
    const prompt = screen.getByRole('textbox', { name: 'Help me write' })
    await waitFor(() => {
      expect(prompt).toHaveFocus()
    })
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await userEvent.type(prompt, 'Thank Bob{Enter}')

    const dialog = screen.getByRole('dialog', { name: 'Help me write' })
    expect(
      await within(dialog).findByRole('region', { name: 'Suggestion' })
    ).toBeVisible()
    const [, init] = fetchMock.mock.calls[0] ?? []
    expect(typeof init?.body === 'string' ? init.body : '').toContain(
      'Thank Bob'
    )
  })

  it('is not offered without the aibot capability', async () => {
    renderMenu({ text: 'Hello', isSelection: false }, {})

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'AI assistant' })).toBe(null)
    })
  })
})
