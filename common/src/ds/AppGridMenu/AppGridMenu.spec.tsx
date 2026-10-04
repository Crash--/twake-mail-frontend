import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { AppGridMenu } from './AppGridMenu'

const APPS = [
  { name: 'Chat', link: 'https://chat.example.com', icon: '/chat.svg' },
  { name: 'Drive', link: 'https://drive.example.com', icon: '/drive.svg' }
]

describe('AppGridMenu', () => {
  it('opens a menu of links to the applications, from the keyboard too', async () => {
    renderDs(<AppGridMenu apps={APPS} label="Go to applications" />)
    const button = screen.getByRole('button', { name: 'Go to applications' })

    button.focus()
    await userEvent.keyboard('{Enter}')

    const items = screen.getAllByRole('menuitem')
    expect(items.map(item => item.textContent)).toEqual(['Chat', 'Drive'])
    expect(items[1]).toHaveAttribute('href', 'https://drive.example.com')
    expect(items[1]).toHaveAttribute('target', '_blank')
    expect(items[1]).toHaveAttribute('rel', 'noopener noreferrer')

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).toBe(null)
    expect(button).toHaveFocus()
  })

  it('renders nothing without applications', () => {
    renderDs(<AppGridMenu apps={[]} label="Go to applications" />)

    expect(screen.queryByRole('button')).toBe(null)
  })
})
