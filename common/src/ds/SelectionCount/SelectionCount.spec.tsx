import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { SelectionCount } from './SelectionCount'

describe('SelectionCount', () => {
  it('is a status in subtitle1 14 px', () => {
    renderDs(<SelectionCount>2 selected</SelectionCount>)

    expect(screen.getByRole('status')).toHaveTextContent('2 selected')
    expect(screen.getByRole('status')).toHaveStyle({
      fontSize: '14px'
    })
  })
})
