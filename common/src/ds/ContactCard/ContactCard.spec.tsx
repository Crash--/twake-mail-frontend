import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

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
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  return (
    <>
      <button type="button" onClick={event => setAnchorEl(event.currentTarget)}>
        Bob
      </button>
      <ContactCard
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        name={name}
        address="bob@example.com"
        onCopy={onCopy}
        actions={actions ?? []}
      />
    </>
  )
}

describe('ContactCard', () => {
  afterEach(() => {
    resetViewport()
  })

  it('is a dialog named by the name, with the address, copying it', async () => {
    const user = userEvent.setup()
    const onCopy = jest.fn()
    renderDs(<Harness onCopy={onCopy} />)

    await user.click(screen.getByRole('button', { name: 'Bob' }))

    const card = await screen.findByRole('dialog', { name: 'Bob' })
    expect(within(card).getByText('bob@example.com')).toBeVisible()
    await user.click(within(card).getByRole('button', { name: 'Copy email' }))
    await waitFor(() => {
      expect(onCopy).toHaveBeenCalledTimes(1)
    })
    expect(await navigator.clipboard.readText()).toBe('bob@example.com')
  })

  it('is named by the address when it has no name', async () => {
    renderDs(<Harness name="" />)

    await userEvent.click(screen.getByRole('button', { name: 'Bob' }))

    expect(
      await screen.findByRole('dialog', { name: 'bob@example.com' })
    ).toBeVisible()
  })

  it('draws a button for each action, the main one filled', async () => {
    const onWrite = jest.fn()
    const onRule = jest.fn()
    renderDs(
      <Harness
        actions={[
          { id: 'rule', label: 'Create a rule', onClick: onRule },
          { id: 'write', label: 'Write', isPrimary: true, onClick: onWrite }
        ]}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Bob' }))
    const write = await screen.findByRole('button', { name: 'Write' })
    expect(write).toHaveClass('MuiButton-contained')
    await userEvent.click(write)
    const rule = screen.getByRole('button', { name: 'Create a rule' })
    expect(rule).toHaveClass('MuiButton-outlined')
    await userEvent.click(rule)

    expect(onWrite).toHaveBeenCalledTimes(1)
    expect(onRule).toHaveBeenCalledTimes(1)
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

  it('stays next to what opened it on a phone', async () => {
    mockViewport({ width: 390, touch: true })
    renderDs(<Harness />)

    await userEvent.click(screen.getByRole('button', { name: 'Bob' }))

    expect(await screen.findByRole('dialog', { name: 'Bob' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible()
  })
})
