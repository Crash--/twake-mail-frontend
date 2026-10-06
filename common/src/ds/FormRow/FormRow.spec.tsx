import { Account } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { FormRow } from './FormRow'

describe('FormRow', () => {
  it('names its control with the visible label', () => {
    renderDs(
      <FormRow label="From" htmlFor="from" icon={Account}>
        <input id="from" />
      </FormRow>
    )

    expect(screen.getByRole('textbox', { name: 'From' })).toBeVisible()
  })
})
