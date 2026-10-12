import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'
import { StorageGauge } from '@/ds/StorageGauge/StorageGauge'

import { SidebarStorage } from './SidebarStorage'

describe('SidebarStorage', () => {
  it('names the gauge by its label, and says what is left', () => {
    renderDs(
      <SidebarStorage
        icon={null}
        labelId="storage"
        label="Storage"
        action={<button type="button">Refresh</button>}
        gauge={
          <StorageGauge
            value={85}
            labelledBy="storage"
            valueText="85 MB of 100 MB used"
          />
        }
        status="15 MB available"
        statusTestId="status"
      />
    )

    expect(
      screen.getByRole('progressbar', { name: 'Storage' })
    ).toHaveAttribute('aria-valuetext', '85 MB of 100 MB used')
    expect(screen.getByTestId('status')).toHaveTextContent('15 MB available')
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeVisible()
  })
})
