import { Calendar } from '@linagora/twake-icons'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import {
  ModalDialog,
  ModalDialogButton,
  ModalField,
  ModalFieldIconButton,
  ModalSelect,
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

  it('has a labelled list of choices, picked again to reopen a choice, and a named icon button', async () => {
    const onChange = jest.fn()
    const onCalendar = jest.fn()
    renderDs(
      <ModalField label="Deletion date" id="deletion" isInline>
        <ModalSelect
          labelId="deletion"
          value="custom"
          valueLabel="From 2026-10-01 to 2026-10-05"
          options={[
            { value: 'week', label: 'Last 7 days' },
            { value: 'custom', label: 'Custom range' }
          ]}
          onChange={onChange}
          data-testid="deletion-select"
        />
        <ModalFieldIconButton
          label="Select date"
          icon={Calendar}
          onClick={onCalendar}
          aria-describedby="deletion"
        />
      </ModalField>
    )

    const select = screen.getByRole('combobox', { name: 'Deletion date' })
    expect(select).toHaveTextContent('From 2026-10-01 to 2026-10-05')
    expect(screen.getByTestId('deletion-select')).toBe(select)
    await userEvent.click(select)
    const listbox = await screen.findByRole('listbox', {
      name: 'Deletion date'
    })
    const chosen = within(listbox).getByRole('option', {
      name: 'Custom range'
    })
    expect(chosen).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(chosen)
    expect(onChange).toHaveBeenCalledWith('custom')
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Select date',
        description: 'Deletion date'
      })
    )
    expect(onCalendar).toHaveBeenCalledTimes(1)
  })
})
