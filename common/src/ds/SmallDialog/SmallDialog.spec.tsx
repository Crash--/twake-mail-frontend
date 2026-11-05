import { Button } from '@linagora/twake-mui'
import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { SmallDialog } from './SmallDialog'

describe('SmallDialog', () => {
  it('shows its title, text and actions', () => {
    renderDs(
      <SmallDialog
        open
        title="Empty Trash"
        content="You are about to delete all items."
        actions={<Button>Delete</Button>}
        onClose={jest.fn()}
      />
    )

    expect(screen.getByRole('dialog')).toHaveTextContent('Empty Trash')
    expect(screen.getByText('You are about to delete all items.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible()
  })
})
