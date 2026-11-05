import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { SegmentedChoice } from './SegmentedChoice'

const CHOICES = [
  { value: 'now', label: 'Right away' },
  { value: 'later', label: 'Pick a time' }
] as const

describe('SegmentedChoice', () => {
  it('is a radio group named by its label, that reports the choice', async () => {
    const onChange = jest.fn()
    renderDs(
      <>
        <span id="starts">Starts:</span>
        <SegmentedChoice
          labelledBy="starts"
          value="now"
          choices={CHOICES}
          onChange={onChange}
        />
      </>
    )

    expect(screen.getByRole('radiogroup', { name: 'Starts:' })).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Right away' })).toBeChecked()
    await userEvent.click(screen.getByText('Pick a time'))
    expect(onChange).toHaveBeenCalledWith('later')
  })
})
