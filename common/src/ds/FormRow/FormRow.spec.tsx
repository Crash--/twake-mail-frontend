import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { FormRow } from './FormRow'

describe('FormRow', () => {
  it('names its control with the visible label', () => {
    renderDs(
      <FormRow label="From" htmlFor="from">
        <input id="from" />
      </FormRow>
    )

    expect(screen.getByRole('textbox', { name: 'From' })).toBeVisible()
  })

  it('names a control pointing at its label by id', () => {
    renderDs(
      <FormRow label="Sort by" id="sort-label">
        <div role="combobox" aria-labelledby="sort-label" tabIndex={0} />
      </FormRow>
    )

    expect(screen.getByRole('combobox', { name: 'Sort by' })).toBeVisible()
    expect(screen.getByText('Sort by').tagName).toBe('SPAN')
  })
})
