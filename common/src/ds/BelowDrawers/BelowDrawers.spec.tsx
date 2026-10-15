import { Box } from '@linagora/twake-mui'
import { screen } from '@testing-library/react'
import type { ReactElement } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import { BelowDrawers } from './BelowDrawers'

/** What a shared library lifting itself above the modals does */
function AboveModals(): ReactElement {
  return (
    <Box
      data-testid="floating"
      sx={{ position: 'fixed', zIndex: theme => theme.zIndex.modal + 1 }}
    />
  )
}

function zIndexOf(testId: string): number {
  return Number(getComputedStyle(screen.getByTestId(testId)).zIndex)
}

describe('BelowDrawers', () => {
  it('leaves an element meant to be above the modals there without it', () => {
    renderDs(<AboveModals />)

    expect(zIndexOf('floating')).toBe(1301)
  })

  it('draws it below the drawers and the dialogs, above the app bar', () => {
    renderDs(
      <BelowDrawers>
        <AboveModals />
      </BelowDrawers>
    )

    expect(zIndexOf('floating')).toBe(1199)
  })
})
