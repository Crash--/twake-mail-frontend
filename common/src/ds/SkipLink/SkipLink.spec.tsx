import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { SkipLink } from './SkipLink'

describe('SkipLink', () => {
  it('is the first stop of the page and focuses its target', async () => {
    const user = userEvent.setup()
    renderDs(
      <>
        <SkipLink label="Skip to main content" targetId="content" />
        <button type="button">Menu</button>
        <div id="content" tabIndex={-1}>
          Content
        </div>
      </>
    )

    await user.tab()
    const link = screen.getByRole('link', { name: 'Skip to main content' })

    expect(link).toHaveFocus()

    await user.keyboard('{Enter}')

    expect(screen.getByText('Content')).toHaveFocus()
  })
})
