import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { LiveRegion } from './LiveRegion'

describe('LiveRegion', () => {
  it('is a polite status holding the message', () => {
    renderDs(<LiveRegion data-testid="region">Back online</LiveRegion>)

    expect(screen.getByRole('status')).toBe(screen.getByTestId('region'))
    expect(screen.getByRole('status')).toHaveTextContent('Back online')
  })

  it('stays mounted, empty, with nothing to say', () => {
    renderDs(<LiveRegion data-testid="region" />)

    expect(screen.getByTestId('region')).toBeEmptyDOMElement()
  })
})
