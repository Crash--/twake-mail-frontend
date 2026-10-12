import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { PlainList } from './PlainList'

describe('PlainList', () => {
  it('is a list named by its label', () => {
    renderDs(
      <PlainList label="Mailboxes">
        <li>Inbox</li>
      </PlainList>
    )

    expect(screen.getByRole('list', { name: 'Mailboxes' })).toHaveTextContent(
      'Inbox'
    )
  })
})
