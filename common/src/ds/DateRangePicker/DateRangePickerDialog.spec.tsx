import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { renderDs } from '@/ds/testing/renderDs'

import { DateRangePickerDialog } from './DateRangePickerDialog'

const LABELS = {
  dialog: 'Custom range',
  start: 'Start date',
  end: 'End date',
  hint: 'dd/mm/yyyy',
  cancel: 'Cancel',
  confirm: 'Set date',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  pickDate: 'Select date',
  close: 'Close'
}

function Picker({ onSubmit }: { onSubmit: () => void }): ReactElement {
  const [startText, setStartText] = useState('')
  const [endText, setEndText] = useState('')
  return (
    <DateRangePickerDialog
      labels={LABELS}
      locale="en"
      today="2026-10-08"
      max="2026-10-08"
      presets={[
        { label: 'Last 7 days', start: '2026-10-01', end: '2026-10-08' }
      ]}
      startText={startText}
      endText={endText}
      onStartTextChange={setStartText}
      onEndTextChange={setEndText}
      startError={startText === '' ? 'The start date cannot be null.' : null}
      onSubmit={onSubmit}
      onClose={() => undefined}
    />
  )
}

describe('DateRangePickerDialog', () => {
  afterEach(() => {
    resetViewport()
  })

  it('shows the quick ranges, two months and the two fields, the errors tied to them', async () => {
    mockViewport({ width: 1280 })
    const onSubmit = jest.fn()
    renderDs(<Picker onSubmit={onSubmit} />)
    const dialog = screen.getByRole('dialog', { name: 'Custom range' })
    expect(
      within(dialog)
        .getAllByRole('grid')
        .map(grid => grid.getAttribute('aria-labelledby'))
    ).toHaveLength(2)
    expect(
      within(dialog).getByRole('grid', { name: 'September 2026' })
    ).toBeVisible()
    expect(
      within(dialog).getByRole('grid', { name: 'October 2026' })
    ).toBeVisible()
    const start = within(dialog).getByLabelText('Start date')
    expect(start).toHaveAccessibleDescription('The start date cannot be null.')
    expect(start).toHaveAttribute('aria-invalid', 'true')

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Last 7 days' })
    )
    expect(start).toHaveValue('01/10/2026')
    expect(within(dialog).getByLabelText('End date')).toHaveValue('08/10/2026')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Set date' })
    )
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('on a phone, picks each day from its own one month calendar', async () => {
    mockViewport({ width: 400 })
    renderDs(<Picker onSubmit={() => undefined} />)
    const dialog = screen.getByRole('dialog', { name: 'Custom range' })
    expect(within(dialog).queryByRole('grid')).toBe(null)
    // Each calendar button is told from its twin by its field
    const pickStart = within(dialog).getByRole('button', {
      name: 'Select date',
      description: 'Start date'
    })
    await userEvent.click(pickStart)
    const sheet = await screen.findByRole('dialog', { name: 'Start date' })
    // An empty field opens on the month of today
    expect(within(sheet).getAllByRole('grid')).toHaveLength(1)
    expect(
      within(sheet).getByRole('grid', { name: 'October 2026' })
    ).toBeVisible()
    await userEvent.click(
      within(sheet).getByRole('gridcell', {
        name: 'Monday, October 5, 2026'
      })
    )
    expect(within(dialog).getByLabelText('Start date')).toHaveValue(
      '05/10/2026'
    )
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Start date' })).toBe(null)
    })
  })
})
