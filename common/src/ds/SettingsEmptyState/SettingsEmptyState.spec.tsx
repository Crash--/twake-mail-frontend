import { Filter, ForwardSingle, Plus } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { SettingsEmptyState } from './SettingsEmptyState'

describe('SettingsEmptyState', () => {
  it('says the list is empty and starts it', async () => {
    const onClick = jest.fn()
    renderDs(
      <SettingsEmptyState
        icon={Filter}
        title="No Rules Configured"
        text="Start by creating your first rule."
        action={{ label: 'Create My First Rule', icon: Plus, onClick }}
      />
    )

    expect(
      screen.getByRole('heading', { name: 'No Rules Configured' })
    ).toBeVisible()
    await userEvent.click(
      screen.getByRole('button', { name: 'Create My First Rule' })
    )
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('draws the tile look with the tile of twake-mui, its icon white in every scheme', () => {
    renderDs(
      <SettingsEmptyState
        icon={Filter}
        look="tile"
        title="No Rules Configured"
        text="Start by creating your first rule."
        data-testid="empty"
      />
    )

    const tile = screen.getByTestId('empty').querySelector('.Empty-iconTile')
    if (tile === null) throw new Error('No tile')
    expect(tile).toHaveAttribute('aria-hidden', 'true')
    // common.white, not background.paper, which is dark in dark mode
    expect(getComputedStyle(tile).color).toBe(
      'var(--twake-palette-common-white)'
    )
  })

  it('draws the tinted look as a 60 px icon in the light primary colour', () => {
    renderDs(
      <SettingsEmptyState
        icon={ForwardSingle}
        look="tinted"
        title="No forwarding"
        text="Add a recipient."
        data-testid="empty"
      />
    )

    const glyph = screen.getByTestId('empty').querySelector('svg')
    expect(glyph).toHaveAttribute('height', '60')
    expect(glyph).toHaveAttribute('aria-hidden', 'true')
    expect(glyph).toHaveStyle({ fill: 'var(--twake-palette-primary-light)' })
  })
})
