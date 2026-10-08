import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import {
  ModalDialog,
  ModalDialogButton,
  ModalField,
  ModalSelectButton,
  ModalTextInput
} from './ModalDialog'

describe('ModalDialog', () => {
  it('is a dialog named by its title, closed by its cross, submitted by its main button', async () => {
    const onClose = jest.fn()
    const onSubmit = jest.fn((event: { preventDefault: () => void }) => {
      event.preventDefault()
    })
    const onPick = jest.fn()
    renderDs(
      <ModalDialog
        title="Create a New Folder"
        subtitle="New folder will be created inside Personal folders"
        titleId="title"
        closeLabel="Close"
        onClose={onClose}
        onSubmit={onSubmit}
        actions={
          <>
            <ModalDialogButton onClick={onClose}>Cancel</ModalDialogButton>
            <ModalDialogButton type="submit" isMain>
              Create folder
            </ModalDialogButton>
          </>
        }
      >
        <ModalField label="Folder Name" htmlFor="name" spaceAbove={0}>
          <ModalTextInput id="name" error="Name required" errorId="error" />
        </ModalField>
        <ModalField label="Select the folder location" id="location">
          <ModalSelectButton onClick={onPick} aria-describedby="location">
            Personal folders
          </ModalSelectButton>
        </ModalField>
      </ModalDialog>
    )

    expect(
      screen.getByRole('dialog', { name: 'Create a New Folder' })
    ).toBeVisible()
    expect(
      screen.getByRole('textbox', { name: 'Folder Name' })
    ).toBeInTheDocument()
    expect(screen.getByText('Name required')).toBeVisible()
    await userEvent.click(
      screen.getByRole('button', { name: 'Personal folders' })
    )
    expect(onPick).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Create folder' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
