import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'
import { Mail } from '@linagora/twake-icons'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { renderDs } from '@/ds/testing/renderDs'

import { ContactCard, type ContactCardAction } from './ContactCard'

function Harness({
  actions,
  name = 'Bob',
  onCopy = () => undefined
}: {
  actions?: readonly ContactCardAction[]
  name?: string
  onCopy?: () => void
}): ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Bob
      </button>
      <ContactCard
        open={isOpen}
        onClose={() => setIsOpen(false)}
        avatar={<span>B</span>}
        name={name}
        address="bob@example.com"
        copyLabel="Copy the address"
        onCopy={onCopy}
        closeLabel="Close"
        actions={actions ?? []}
      />
    </>
  )
}

describe('ContactCard', () => {
  afterEach(() => {
    resetViewport()
  })

  it('is a dialog named by the name, with the address and a copy button', async () => {
    const onCopy = jest.fn()
    renderDs(<Harness onCopy={onCopy} />)

    await userEvent.click(screen.getByRole('button', { name: 'Bob' }))

    const card = await screen.findByRole('dialog', { name: 'Bob' })
    expect(within(card).getByText('bob@example.com')).toBeVisible()
    await userEvent.click(
      within(card).getByRole('button', { name: 'Copy the address' })
    )
    expect(onCopy).toHaveBeenCalledTimes(1)
  })

  it('is named by the address when it has no name', async () => {
    renderDs(<Harness name="" />)

    await userEvent.click(screen.getByRole('button', { name: 'Bob' }))

    expect(
      await screen.findByRole('dialog', { name: 'bob@example.com' })
    ).toBeVisible()
  })

  it('draws buttons and links for its actions', async () => {
    const onWrite = jest.fn()
    renderDs(
      <Harness
        actions={[
          { id: 'write', label: 'Write', icon: Mail, onClick: onWrite },
          {
            id: 'chat',
            label: 'Chat',
            icon: Mail,
            href: 'https://chat.test/bob'
          }
        ]}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Bob' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Write' }))

    expect(onWrite).toHaveBeenCalledTimes(1)
    const link = screen.getByRole('link', { name: 'Chat' })
    expect(link).toHaveAttribute('href', 'https://chat.test/bob')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('traps the focus, closes on Escape and gives the focus back', async () => {
    const user = userEvent.setup()
    renderDs(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Bob' })

    await user.click(trigger)
    const card = await screen.findByRole('dialog', { name: 'Bob' })
    for (let step = 0; step < 6; step += 1) {
      await user.tab()
      expect(card).toContainElement(document.activeElement as HTMLElement)
    }
    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
    expect(trigger).toHaveFocus()
  })

  it('is a bottom sheet on a phone, still a named dialog', async () => {
    mockViewport({ width: 390, touch: true })
    renderDs(<Harness />)

    await userEvent.click(screen.getByRole('button', { name: 'Bob' }))

    expect(await screen.findByRole('dialog', { name: 'Bob' })).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
  })
})
