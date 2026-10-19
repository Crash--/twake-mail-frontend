import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@common/testing/renderWithProviders'

import type { RecoveryForm } from './recovery'
import { RecoveryDialog } from './RecoveryDialog'

// Tests run in UTC (jest.config.ts)
const NOW = new Date('2026-10-08T10:30:00Z')

function renderDialog(): jest.Mock<Promise<boolean>, [RecoveryForm]> {
  const onSubmit = jest.fn<Promise<boolean>, [RecoveryForm]>(() =>
    Promise.resolve(true)
  )
  renderWithProviders(
    <RecoveryDialog
      horizon={15}
      now={NOW}
      onSubmit={onSubmit}
      onClose={() => undefined}
    />
  )
  return onSubmit
}

describe('RecoveryDialog', () => {
  it('lists the periods of tmail-flutter, the deletion ones within the horizon', async () => {
    renderDialog()
    const deletion = screen.getByRole('combobox', { name: 'Deletion date' })
    expect(deletion).toHaveTextContent('Last 7 days')
    await userEvent.click(deletion)
    const options = within(await screen.findByRole('listbox')).getAllByRole(
      'option'
    )
    expect(options.map(option => option.textContent)).toEqual([
      'Last 7 days',
      'Last 15 days',
      'Custom range'
    ])
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('option', { name: 'Last 15 days' }))
    expect(deletion).toHaveTextContent('Last 15 days')

    const reception = screen.getByRole('combobox', { name: 'Reception date' })
    expect(reception).toHaveTextContent('All time')
    // The keyboard opens it and picks in it
    act(() => {
      reception.focus()
    })
    await userEvent.keyboard('{Enter}')
    expect(
      within(await screen.findByRole('listbox'))
        .getAllByRole('option')
        .map(option => option.textContent)
    ).toEqual([
      'All time',
      'Last 7 days',
      'Last 30 days',
      'Last 6 months',
      'Last 1 year',
      'Custom range'
    ])
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(reception).toHaveTextContent('Last 30 days')
  })

  it('refuses a missing, inverted or out of horizon custom range, each error tied to its date', async () => {
    const onSubmit = renderDialog()
    const opener = screen.getByRole('button', {
      name: 'Select date',
      description: 'Deletion date'
    })
    await userEvent.click(opener)
    const range = await screen.findByRole('dialog', { name: 'Custom range' })
    const start = within(range).getByLabelText('Start date')
    const end = within(range).getByLabelText('End date')
    expect(start).toHaveAttribute('min', '2026-09-23')
    expect(start).toHaveAttribute('max', '2026-10-08')
    const setDate = within(range).getByRole('button', { name: 'Set date' })

    await userEvent.click(setDate)
    expect(start).toHaveAccessibleDescription('The start date cannot be null.')
    expect(start).toHaveAttribute('aria-invalid', 'true')
    expect(end).toHaveAccessibleDescription('The end date cannot be null.')
    expect(start).toHaveFocus()

    fireEvent.change(start, { target: { value: '2026-09-20' } })
    fireEvent.change(end, { target: { value: '2026-09-30' } })
    await userEvent.click(setDate)
    expect(start).toHaveAccessibleDescription(
      'The start date cannot be before 2026-09-23.'
    )

    fireEvent.change(start, { target: { value: '2026-10-02' } })
    await userEvent.click(setDate)
    expect(start).toHaveAttribute('aria-invalid', 'false')
    expect(end).toHaveAccessibleDescription(
      'The end time cannot be less than the start time.'
    )
    expect(end).toHaveFocus()

    fireEvent.change(end, { target: { value: '2026-10-05' } })
    await userEvent.click(setDate)
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Custom range' })).toBe(null)
    })
    expect(
      screen.getByRole('combobox', { name: 'Deletion date' })
    ).toHaveTextContent('From 2026-10-02 to 2026-10-05')
    expect(opener).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Restore' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        deletion: {
          range: 'customRange',
          start: '2026-10-02',
          end: '2026-10-05'
        },
        reception: { range: 'allTime' }
      })
    )
  })

  it('keeps the period when the custom range is canceled, and gives the focus back to the menu', async () => {
    renderDialog()
    const reception = screen.getByRole('combobox', { name: 'Reception date' })
    await userEvent.click(reception)
    await userEvent.click(
      await screen.findByRole('option', { name: 'Custom range' })
    )
    const range = await screen.findByRole('dialog', { name: 'Custom range' })
    // No horizon for the reception
    expect(within(range).getByLabelText('Start date')).not.toHaveAttribute(
      'min'
    )
    await userEvent.click(within(range).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(reception).toHaveFocus()
    })
    expect(reception).toHaveTextContent('All time')
    expect(
      await screen.findByRole('dialog', { name: 'Recover deleted messages' })
    ).toBeVisible()
  })
})
