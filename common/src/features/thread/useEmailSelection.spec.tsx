import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import { makeEmail } from '@common/testing/fakeJmapServer'

import { EmailSelectionMemoryProvider } from './EmailSelectionMemoryProvider'
import type { EmailListItemData } from './queries'
import { useEmailSelection } from './useEmailSelection'

const EMAILS: EmailListItemData[] = ['a', 'b', 'c', 'd'].map(id =>
  makeEmail({ id })
)

interface ListProps {
  emails: readonly EmailListItemData[]
  listKey: string
}

function List({ emails, listKey }: ListProps): ReactElement {
  const selection = useEmailSelection(emails, listKey)
  return (
    <>
      <output aria-label="Selected">
        {selection.selected.map(email => email.id).join(',')}
      </output>
      <output aria-label="Whole folder">
        {String(selection.isAllInFolder)}
      </output>
      {emails.map(email => (
        <button
          key={email.id}
          type="button"
          onClick={event => {
            selection.toggle(email.id, event.shiftKey)
          }}
        >
          {`Toggle ${email.id}`}
        </button>
      ))}
      <button type="button" onClick={selection.selectAllInFolder}>
        Whole folder
      </button>
    </>
  )
}

interface HarnessProps extends Partial<ListProps> {
  /** False while an email opened from the list replaces it */
  isShown?: boolean
  hasMemory?: boolean
}

function Harness({
  emails = EMAILS,
  listKey = 'inbox',
  isShown = true,
  hasMemory = true
}: HarnessProps): ReactElement {
  const list = isShown ? <List emails={emails} listKey={listKey} /> : null
  return hasMemory ? (
    <EmailSelectionMemoryProvider>{list}</EmailSelectionMemoryProvider>
  ) : (
    <>{list}</>
  )
}

function selected(): string {
  return screen.getByRole('status', { name: 'Selected' }).textContent
}

function isWholeFolder(): string {
  return screen.getByRole('status', { name: 'Whole folder' }).textContent
}

async function selectBAndC(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Toggle b' }))
  await userEvent.click(screen.getByRole('button', { name: 'Toggle c' }))
}

describe('useEmailSelection', () => {
  it('selects by range from the last email toggled', async () => {
    render(<Harness />)

    await userEvent.click(screen.getByRole('button', { name: 'Toggle a' }))
    const user = userEvent.setup()
    await user.keyboard('{Shift>}')
    await user.click(screen.getByRole('button', { name: 'Toggle c' }))
    await user.keyboard('{/Shift}')

    expect(selected()).toBe('a,b,c')
  })

  it('finds its selection again once the list is shown again', async () => {
    const { rerender } = render(<Harness />)
    await selectBAndC()

    rerender(<Harness isShown={false} />)
    rerender(<Harness />)

    expect(selected()).toBe('b,c')
  })

  it('leaves out the emails that left the list meanwhile', async () => {
    const { rerender } = render(<Harness />)
    await selectBAndC()

    rerender(<Harness isShown={false} />)
    const remaining = EMAILS.filter(email => email.id !== 'b')
    rerender(<Harness emails={remaining} />)
    expect(selected()).toBe('c')

    // Back in the list, it does not come back selected
    rerender(<Harness />)
    expect(selected()).toBe('c')
  })

  it('keeps the selection while the list loads again', async () => {
    const { rerender } = render(<Harness />)
    await selectBAndC()

    rerender(<Harness isShown={false} />)
    rerender(<Harness emails={[]} />)
    rerender(<Harness />)

    expect(selected()).toBe('b,c')
  })

  it('finds the whole folder selected again', async () => {
    const { rerender } = render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Whole folder' }))

    rerender(<Harness isShown={false} />)
    rerender(<Harness />)

    expect(isWholeFolder()).toBe('true')
    expect(selected()).toBe('a,b,c,d')
  })

  it('starts over in another list, and forgets the first one', async () => {
    const { rerender } = render(<Harness />)
    await selectBAndC()

    rerender(<Harness isShown={false} />)
    rerender(<Harness listKey="sent" />)
    expect(selected()).toBe('')
    rerender(<Harness isShown={false} />)
    rerender(<Harness />)

    expect(selected()).toBe('')
  })

  it('starts over when the list changes in place (a filter, a search)', async () => {
    const { rerender } = render(<Harness />)
    await selectBAndC()

    rerender(<Harness listKey="inbox-unread" />)
    expect(selected()).toBe('')
    rerender(<Harness />)

    expect(selected()).toBe('')
  })

  it('keeps nothing without a memory', async () => {
    const { rerender } = render(<Harness hasMemory={false} />)
    await selectBAndC()

    rerender(<Harness hasMemory={false} isShown={false} />)
    rerender(<Harness hasMemory={false} />)

    expect(selected()).toBe('')
  })
})
