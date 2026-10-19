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
    // The calendar keeps to the horizon of the vault and to today
    expect(
      within(range).getByRole('gridcell', {
        name: 'Tuesday, September 22, 2026'
      })
    ).toHaveAttribute('aria-disabled', 'true')
    expect(
      within(range).getByRole('gridcell', {
        name: 'Wednesday, September 23, 2026'
      })
    ).not.toHaveAttribute('aria-disabled')
    expect(
      within(range).getByRole('gridcell', { name: 'Friday, October 9, 2026' })
    ).toHaveAttribute('aria-disabled', 'true')
    const setDate = within(range).getByRole('button', { name: 'Set date' })

    await userEvent.click(setDate)
    expect(start).toHaveAccessibleDescription('The start date cannot be null.')
    expect(start).toHaveAttribute('aria-invalid', 'true')
    expect(end).toHaveAccessibleDescription('The end date cannot be null.')
    expect(start).toHaveFocus()

    fireEvent.change(start, { target: { value: '20/09/2026' } })
    fireEvent.change(end, { target: { value: '30/09/2026' } })
    await userEvent.click(setDate)
    expect(start).toHaveAccessibleDescription(
      'The start date cannot be before 23/09/2026.'
    )

    fireEvent.change(start, { target: { value: '02/10/2026' } })
    await userEvent.click(setDate)
    expect(start).toHaveAttribute('aria-invalid', 'false')
    expect(end).toHaveAccessibleDescription(
      'The end time cannot be less than the start time.'
    )
    expect(end).toHaveFocus()

    fireEvent.change(end, { target: { value: '05/10/2026' } })
    await userEvent.click(setDate)
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Custom range' })).toBe(null)
    })
    expect(
      screen.getByRole('combobox', { name: 'Deletion date' })
    ).toHaveTextContent('From 02/10/2026 to 05/10/2026')
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
    expect(
      within(range).getByRole('gridcell', {
        name: 'Tuesday, September 1, 2026'
      })
    ).not.toHaveAttribute('aria-disabled')
    await userEvent.click(within(range).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(reception).toHaveFocus()
    })
    expect(reception).toHaveTextContent('All time')
    expect(
      await screen.findByRole('dialog', { name: 'Recover deleted messages' })
    ).toBeVisible()
  })

  it('picks a custom range on the calendar, from a quick range or with the keyboard, as tmail-flutter', async () => {
    renderDialog()
    const reception = screen.getByRole('combobox', { name: 'Reception date' })
    await userEvent.click(reception)
    await userEvent.click(
      await screen.findByRole('option', { name: 'Custom range' })
    )
    const range = await screen.findByRole('dialog', { name: 'Custom range' })
    const start = within(range).getByLabelText('Start date')
    const end = within(range).getByLabelText('End date')
    expect(start).toHaveFocus()
    expect(start).toHaveAttribute('placeholder', 'dd/mm/yyyy')

    // Two days: the first starts the range, the second (before it) swaps
    await userEvent.click(
      within(range).getByRole('gridcell', { name: 'Monday, October 5, 2026' })
    )
    expect(start).toHaveValue('05/10/2026')
    expect(end).toHaveValue('')
    await userEvent.click(
      within(range).getByRole('gridcell', {
        name: 'Monday, September 28, 2026'
      })
    )
    expect(start).toHaveValue('28/09/2026')
    expect(end).toHaveValue('05/10/2026')
    expect(
      within(range).getByRole('gridcell', { name: 'Thursday, October 1, 2026' })
    ).toHaveAttribute('aria-selected', 'true')

    const lastWeek = within(range).getByRole('button', { name: 'Last 7 days' })
    await userEvent.click(lastWeek)
    expect(lastWeek).toHaveAttribute('aria-pressed', 'true')
    expect(start).toHaveValue('01/10/2026')
    expect(end).toHaveValue('08/10/2026')

    // Typed: the slashes come by themselves
    await userEvent.clear(start)
    await userEvent.type(start, '03102026')
    expect(start).toHaveValue('03/10/2026')
    expect(lastWeek).toHaveAttribute('aria-pressed', 'false')

    // The grid: the arrows move the day, Page Up a month, Enter picks
    const day = within(range).getByRole('gridcell', {
      name: 'Saturday, October 3, 2026'
    })
    expect(day).toHaveAttribute('tabindex', '0')
    day.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowDown}')
    expect(
      within(range).getByRole('gridcell', { name: 'Sunday, October 11, 2026' })
    ).toHaveFocus()
    await userEvent.keyboard('{PageUp}')
    expect(
      within(range).getByRole('gridcell', {
        name: 'Friday, September 11, 2026'
      })
    ).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(start).toHaveValue('11/09/2026')
    expect(end).toHaveValue('')

    await userEvent.click(
      within(range).getByRole('button', { name: 'Previous month' })
    )
    expect(
      within(range).getByRole('grid', { name: 'August 2026' })
    ).toBeVisible()
  })
})
