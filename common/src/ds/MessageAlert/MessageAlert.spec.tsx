import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { MessageAlert } from './MessageAlert'

const BASE = {
  level: 'error',
  levelLabel: 'Danger',
  title: 'This message may be dangerous',
  description: 'Do not click the links.',
  'data-testid': 'alert'
} as const

describe('MessageAlert', () => {
  it('is a group named by its title, led by the level in words', () => {
    renderDs(<MessageAlert {...BASE} />)

    const group = screen.getByRole('group', {
      name: 'Danger: This message may be dangerous'
    })
    expect(group).toHaveTextContent('Do not click the links.')
  })

  it('is not a live region', () => {
    renderDs(<MessageAlert {...BASE} />)

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.each(['info', 'warn', 'error'] as const)(
    'says the %s level in text',
    level => {
      renderDs(<MessageAlert {...BASE} level={level} levelLabel="Level" />)

      expect(screen.getByRole('group')).toHaveTextContent(/^Level: /)
    }
  )

  it('shows no button without action nor dismiss', () => {
    renderDs(<MessageAlert {...BASE} />)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('runs its action and its dismiss, named by their labels', async () => {
    const user = userEvent.setup()
    const onAction = jest.fn()
    const onDismiss = jest.fn()
    renderDs(
      <MessageAlert
        {...BASE}
        action={{ label: 'Not spam', onClick: onAction }}
        dismiss={{ label: 'Dismiss', onClick: onDismiss }}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Not spam' }))
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('disables its action', () => {
    renderDs(
      <MessageAlert
        {...BASE}
        action={{ label: 'Not spam', onClick: jest.fn(), disabled: true }}
      />
    )

    expect(screen.getByRole('button', { name: 'Not spam' })).toBeDisabled()
  })

  it('reaches both buttons with the keyboard, the action first', async () => {
    const user = userEvent.setup()
    renderDs(
      <MessageAlert
        {...BASE}
        action={{ label: 'Not spam', onClick: jest.fn() }}
        dismiss={{ label: 'Dismiss', onClick: jest.fn() }}
      />
    )

    await user.tab()
    expect(screen.getByRole('button', { name: 'Not spam' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveFocus()
  })
})
