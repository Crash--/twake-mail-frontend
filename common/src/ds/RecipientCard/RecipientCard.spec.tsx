import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { RecipientCard } from './RecipientCard'

const LABELS = {
  copy: 'Copy the email address',
  edit: 'Edit email',
  createRule: 'Create a rule',
  close: 'Close'
}

function renderCard(props: Partial<Parameters<typeof RecipientCard>[0]> = {}): {
  onCopy: jest.Mock
  onEdit: jest.Mock
  onCreateRule: jest.Mock
  onClose: jest.Mock
} {
  const anchor = document.createElement('button')
  document.body.append(anchor)
  const handlers = {
    onCopy: jest.fn(),
    onEdit: jest.fn(),
    onCreateRule: jest.fn(),
    onClose: jest.fn()
  }
  renderDs(
    <RecipientCard
      open
      anchorEl={anchor}
      name="Alice Martin"
      address="alice@example.com"
      initials="AM"
      labels={LABELS}
      {...handlers}
      {...props}
    />
  )
  return handlers
}

describe('RecipientCard', () => {
  it('is a dialog named by the recipient, with its address and actions', async () => {
    const { onCopy, onEdit, onCreateRule, onClose } = renderCard()

    const dialog = screen.getByRole('dialog', { name: 'Alice Martin' })
    expect(dialog).toHaveTextContent('alice@example.com')
    await userEvent.click(
      screen.getByRole('button', { name: 'Copy the email address' })
    )
    expect(onCopy).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Edit email' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Create a rule' }))
    expect(onCreateRule).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps the tooltip of the copy button off the way of the pills', async () => {
    const { onCreateRule } = renderCard()

    await userEvent.hover(
      screen.getByRole('button', { name: 'Copy the email address' })
    )
    const tooltip = await screen.findByRole('tooltip')
    expect(getComputedStyle(tooltip).pointerEvents).toBe('none')
    await userEvent.click(screen.getByRole('button', { name: 'Create a rule' }))
    expect(onCreateRule).toHaveBeenCalledTimes(1)
  })

  it('is named by the address without a name, and has no rule without rules', () => {
    renderCard({ name: null, onCreateRule: null })

    expect(
      screen.getByRole('dialog', { name: 'alice@example.com' })
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Create a rule' })).toBe(null)
  })
})
