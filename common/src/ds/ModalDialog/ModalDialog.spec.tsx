import { Button } from '@linagora/twake-mui'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { ModalDialog } from './ModalDialog'

describe('ModalDialog', () => {
  it('shows its title, content and actions, and closes from its button', async () => {
    const onClose = jest.fn()
    renderDs(
      <ModalDialog
        open
        title="Create a new folder"
        content="Body"
        actions={<Button>Create</Button>}
        onClose={onClose}
      />
    )

    expect(
      screen.getByRole('dialog', { name: 'Create a new folder' })
    ).toHaveTextContent('Body')
    expect(screen.getByRole('button', { name: 'Create' })).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(onClose).toHaveBeenCalled()
  })
})
