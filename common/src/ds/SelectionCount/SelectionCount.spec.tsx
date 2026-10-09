import { screen } from '@testing-library/react'

import { TMAIL } from '@/ds/TmailColors/tmailColors'
import { renderDs } from '@/ds/testing/renderDs'

import { SelectionCount } from './SelectionCount'

describe('SelectionCount', () => {
  it('is a status in steel grey 15 px', () => {
    renderDs(<SelectionCount>2 selected</SelectionCount>)

    expect(screen.getByRole('status')).toHaveTextContent('2 selected')
    expect(screen.getByRole('status')).toHaveStyle({
      fontSize: '15px',
      color: TMAIL.steel
    })
  })
})
