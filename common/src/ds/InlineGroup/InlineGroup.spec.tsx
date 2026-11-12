import { render, screen } from '@testing-library/react'

import { InlineGroup } from './InlineGroup'

describe('InlineGroup', () => {
  it.each(['center', 'baseline', 'flex-start', 'flex-end'] as const)(
    'aligns its children on %s',
    align => {
      render(
        <InlineGroup align={align} data-testid="group">
          <span>text</span>
        </InlineGroup>
      )

      expect(screen.getByTestId('group')).toHaveStyle({ alignItems: align })
    }
  )
})
